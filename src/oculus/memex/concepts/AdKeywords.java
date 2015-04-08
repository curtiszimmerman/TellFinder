package oculus.memex.concepts;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.elasticsearch.MemexAdSearch;
import oculus.memex.init.PropertyManager;
import oculus.memex.progress.Progress;
import oculus.memex.util.Pair;
import oculus.memex.util.TimeLog;

/**
 * Extract concepts from ads.
 */
public class AdKeywords {	
	static final public String AD_KEYWORD_TABLE = "ads_keywords";
	public static final int BATCH_SELECT_SIZE = 100000;
	public static final int BATCH_INSERT_SIZE = 2000;
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+AD_KEYWORD_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "keyword VARCHAR(45) NOT NULL," +
						  "classifier VARCHAR(45) NOT NULL," +
						  "count INT(11) NOT NULL," +
						  "PRIMARY KEY (id)," + 
						  "KEY ads_idx (ads_id) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public static void initTable(MemexOculusDB db, Connection conn, boolean forceClear) {
		if (db.tableExists(conn, AD_KEYWORD_TABLE)) {
			if (ScriptDBInit._clearDB || forceClear) {
				System.out.println("Clearing table: " + AD_KEYWORD_TABLE);
				db.clearTable(conn, AD_KEYWORD_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + AD_KEYWORD_TABLE);
			createTable(db, conn);
		}
	}
	
	static class KeywordPattern {
		String classifier;
		String keyword;
		Pattern pattern;
		public KeywordPattern(String keyword, String classifier) {
			this.keyword = keyword;
			this.classifier = classifier;
			this.pattern = Pattern.compile("\\b" + keyword + "\\b");
		}
	}
	
	protected static volatile int percentComplete = 0;
	
	public static int getPercentComplete() { return percentComplete; }
	
	public static int getKeywordCounts(Connection htconn, Connection oculusconn) {
		int maxadid = 0;
		int maxkeywordadid = MemexOculusDB.getInt(oculusconn, "SELECT max(ads_id) FROM ads_keywords", "Get max keyword ad id");
		
		String elasticBaseURL = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_BASE_URL);
		String elasticAdSearchURL = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_URL);
		
		if (elasticAdSearchURL != null && elasticAdSearchURL.length() > 5 && 
			elasticBaseURL !=null &&  elasticBaseURL.length() > 5) {
			maxadid = getKeywordCountsElastic(oculusconn, maxkeywordadid + 1);
		
		} else {
			maxadid = getKeywordCountsSQL(htconn, oculusconn, maxkeywordadid + 1);
		}
			
		return maxadid;
	}
	
	/** Get the keyword counts using SQL queries.
	 *  @param htconn
	 *  @param oculusconn
	 *  @param startId 		Get keywords from all ads with ID >= this value. Use 0 to search all ads.
	 *  @return				The maximum ID amongst the ads processed.
	 */
	protected static int getKeywordCountsSQL(Connection htconn, Connection oculusconn, Integer startId) {		
		HashMap<String, HashSet<String>> keywords = Keywords.getKeywords(oculusconn);
		
		int maxadid = MemexHTDB.getInt(htconn, "SELECT max(id) FROM ads", "Get max ad id");
		int adsToProcess = MemexHTDB.getInt(htconn, "select count(*) from ads where id >= " + startId + " and id <= " + maxadid, "Count ads to process.");
		
		ArrayList<KeywordPattern> patterns = new ArrayList<KeywordPattern>();
		for (String classifier:keywords.keySet()) {
			HashSet<String> kws = keywords.get(classifier);
			for (String kw:kws) {
				patterns.add(new KeywordPattern(kw, classifier));
			}
		}
		
		long start = System.currentTimeMillis();
		int nextid = startId;
		int adcount = 0;
		while (nextid < maxadid) {
			HashMap<Integer,HashMap<String,Pair<String,Integer>>> result = new HashMap<Integer,HashMap<String,Pair<String,Integer>>>();
			String sqlStr = "SELECT id,text FROM ads where id>=" + nextid + " and id<=" + (nextid+BATCH_SELECT_SIZE);
			nextid += BATCH_SELECT_SIZE+1;
			Statement stmt = null;
			try {
				stmt = htconn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					adcount++;
					Integer id = rs.getInt("id");
					String body = rs.getString("text");
					extractKeywords(id, body, patterns, result);
					if (id > maxadid) maxadid = id;
				}
				long end = System.currentTimeMillis();
				System.out.println("Processed " + adcount + " in " + (end-start) + "ms");
			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				try {
					if (stmt != null) { stmt.close(); }
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
			insertAdKeywords(oculusconn, result);
			long end = System.currentTimeMillis();
			System.out.println("Wrote " + adcount + " in " + (end-start) + "ms");
			percentComplete = (adcount * 100) / adsToProcess;
		}
		return maxadid;
	}
		
	/** Get the keyword counts using elastic search
	 *  @param oculusconn
	 *  @param startId		Get keywords from all ads with ID >= this value. Use 0 to search all ads.
	 *  @return				The maximum ID amongst the ads processed.
	 */
	protected static int getKeywordCountsElastic(Connection oculusconn, Integer startId) {
		String elasticBaseURL = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_BASE_URL);
		String elasticAdSearchURL = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_URL);
		
		HashMap<String, HashSet<String>> keywords = Keywords.getKeywords(oculusconn);
		int numKeywords = 0, keywordsProcessed = 0, keywordsFound = 0;

		long start = System.currentTimeMillis();			
		int maxadid = MemexAdSearch.getMaxAdId(elasticAdSearchURL);

		for (String classifier : keywords.keySet()) {
			numKeywords += keywords.get(classifier).size();
		}
						
		for (String classifier:keywords.keySet()) {
			HashSet<String> kws = keywords.get(classifier);
			for (String kw:kws) {
				HashMap<Integer,HashMap<String,Pair<String,Integer>>> result = new HashMap<Integer,HashMap<String,Pair<String,Integer>>>();						
				HashSet<Integer> adIds = MemexAdSearch.getKeyWordMatches(elasticBaseURL, elasticAdSearchURL, kw, startId);
				for (Integer adId : adIds) {
					HashMap<String, Pair<String, Integer>> adKeywords = result.get(adId);
					if (adKeywords==null) {
						adKeywords = new HashMap<String, Pair<String, Integer>>();
						result.put(adId, adKeywords);
					}
					Pair<String,Integer> matches = adKeywords.get(kw);
					if (matches == null) matches = new Pair<String,Integer>(classifier,0);
					matches.setSecond(matches.getSecond()+1);
					adKeywords.put(kw,matches);					
					keywordsFound++; 
				}
				insertAdKeywords(oculusconn, result);
				keywordsProcessed++;
				percentComplete = (keywordsProcessed * 100) / numKeywords;
			}
		}		
				
		long end = System.currentTimeMillis();
		System.out.println("Wrote " + keywordsFound + " ad keywords in " + (end-start) + "ms");
		
		return maxadid;
	}
	
	private static void extractKeywords(Integer id, String body,
			ArrayList<KeywordPattern> patterns,
			HashMap<Integer, HashMap<String, Pair<String, Integer>>> result) {
		for (int i=0; i<patterns.size(); i++) {
			if (body==null || body.length()<2) continue;
			KeywordPattern p = patterns.get(i);
			Matcher matcher = p.pattern.matcher(body);
			int count = 0;
			while (matcher.find()) {
				count++;
			}
			if (count>0) {
				HashMap<String, Pair<String, Integer>> adKeywords = result.get(id);
				if (adKeywords==null) {
					adKeywords = new HashMap<String, Pair<String, Integer>>();
					result.put(id, adKeywords);
				}
				Pair<String,Integer> matches = adKeywords.get(p.keyword);
				if (matches==null) matches = new Pair<String,Integer>(p.classifier,0);
				matches.setSecond(matches.getSecond()+1);
				adKeywords.put(p.keyword,matches);
			}
		}
	}

	public static void insertAdKeywords(Connection conn, HashMap<Integer, HashMap<String, Pair<String,Integer>>> resultMap) {
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + AD_KEYWORD_TABLE + 
					"(ads_id, keyword, count, classifier) VALUES (?,?,?,?)");
			int count = 0;
			for (Entry<Integer,HashMap<String, Pair<String,Integer>>> e:resultMap.entrySet()) {
				Integer adId = e.getKey();
				HashMap<String, Pair<String,Integer>> keywords = e.getValue();
				for (Entry<String,Pair<String,Integer>> kw:keywords.entrySet()) {
					pstmt.setInt(1, adId);
					pstmt.setString(2, kw.getKey());
					pstmt.setInt(3, kw.getValue().getSecond());
					pstmt.setString(4, kw.getValue().getFirst());
					pstmt.addBatch();
					count++;
					if (count % BATCH_INSERT_SIZE == 0) {
						pstmt.executeBatch();
					}
				}
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
	}

	/** Analyze ad text for the presence of keywords.
	 *  @param forceClear Set true to force a full reclassification of all ads for all currently defined
	 *  				  keywords & classifiers.
	 */
	public static void extractKeywords(boolean forceClear) {
		long fullstart = System.currentTimeMillis();
		percentComplete = 0;
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		initTable(oculusdb, oculusconn, forceClear);
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		int maxadid = getKeywordCounts(htconn, oculusconn);
		long fullend = System.currentTimeMillis();
		int duration = (int)((fullend-fullstart)/1000);
		Progress.updateProgress(oculusdb, oculusconn, "ads_keywords", maxadid, 0, duration);
		oculusdb.close(oculusconn);
		htdb.close(htconn);
	}

	public static HashMap<Integer,HashSet<Pair<String,String>>> getAdKeywords() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<Integer,HashSet<Pair<String,String>>> result = new HashMap<Integer,HashSet<Pair<String,String>>>();

		int maxKeywordId = MemexOculusDB.getInt(conn, "SELECT max(id) FROM ads_keywords", "Get max ad keyword id");
		int nextID = 0;
		while (nextID<maxKeywordId) {
			String sqlStr = "SELECT ads_id,keyword,classifier FROM " + AdKeywords.AD_KEYWORD_TABLE + " where id>=" + nextID + " and id<" + (nextID + BATCH_SELECT_SIZE);
			nextID += BATCH_SELECT_SIZE;
			Statement stmt = null;
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					Integer adid = rs.getInt("ads_id");
					String keyword = rs.getString("keyword");
					String classifier = rs.getString("classifier");
					HashSet<Pair<String,String>> set = result.get(adid);
					if (set==null) {
						set = new HashSet<Pair<String,String>>();
						result.put(adid, set);
					}
					set.add(new Pair<String,String>(keyword,classifier));
				}
			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				try {
					if (stmt != null) { stmt.close(); }
				} catch (SQLException e) {e.printStackTrace();}
			}
		}
		db.close(conn);
		return result;
	}		
	
	private static String KEYWORD_FETCH_SQL = "SELECT ads_id,keyword,classifier FROM " + AdKeywords.AD_KEYWORD_TABLE + " where ads_id in ";
	private static void getAdKeywords(Connection conn, String adsString, HashMap<Integer, HashSet<Pair<String, String>>> result) {
		String sqlStr = KEYWORD_FETCH_SQL + adsString;
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer adid = rs.getInt("ads_id");
				String keyword = rs.getString("keyword");
				String classifier = rs.getString("classifier");
				HashSet<Pair<String,String>> set = result.get(adid);
				if (set==null) {
					set = new HashSet<Pair<String,String>>();
					result.put(adid, set);
				}
				set.add(new Pair<String,String>(keyword,classifier));
			}
		} catch (Exception e) {
			System.out.println("Failed sql: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
	}		
	

	public static HashMap<Integer,HashSet<Pair<String,String>>> getAdKeywords(String adsString) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<Integer,HashSet<Pair<String,String>>> result = new HashMap<Integer,HashSet<Pair<String,String>>>();
		getAdKeywords(conn, adsString, result);
		db.close(conn);
		return result;
	}

	public static HashMap<Integer,HashSet<Pair<String,String>>> getAdKeywords(HashSet<Integer> ads) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<Integer,HashSet<Pair<String,String>>> result = new HashMap<Integer,HashSet<Pair<String,String>>>();
		int count = 0;
		boolean isFirst = true;
		StringBuffer adstr = new StringBuffer();
		adstr.append("(");
		for (Integer adid:ads) {
			if (isFirst) isFirst = false;
			else adstr.append(",");
			adstr.append(adid);
			count++;
			if (count%BATCH_SELECT_SIZE==0) {
				adstr.append(")");
				getAdKeywords(conn, adstr.toString(), result);
				count = 0;
				isFirst = true;
				adstr = new StringBuffer();
				adstr.append("(");
			}
		}
		if (count>0) {
			adstr.append(")");
			getAdKeywords(conn, adstr.toString(), result);
		}
		db.close(conn);
		return result;
	}		
	
	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Keyword calculation");

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		extractKeywords(false);

		tl.popTime();
	}
}
