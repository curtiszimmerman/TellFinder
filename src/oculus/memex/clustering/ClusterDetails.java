package oculus.memex.clustering;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Map.Entry;

import oculus.memex.aggregation.LocationCluster;
import oculus.memex.concepts.AdKeywords;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.extraction.AdExtraction;
import oculus.memex.geo.AdLocations;
import oculus.memex.geo.AdLocations.AdLocationSet;
import oculus.memex.util.HashCount;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

/**
 * Create a table of clusterid->details (phone,email,location,source,name) distributions, etc.
 */
public class ClusterDetails {
	static final public String CLUSTER_DETAILS_TABLE = "clusters_details";
	private static final int MAX_CLUSTERS_PER_BATCH = 5000;
	private static final int AD_SELECT_BATCH_SIZE = 1000;
	public static final int BATCH_INSERT_SIZE = 2000;
	private static boolean UPDATE_ATTRIBUTES = false;
	
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+CLUSTER_DETAILS_TABLE+"` (" +
						  "clusterid INT(11) NOT NULL," +
						  "clustername TEXT NOT NULL," +
						  "adcount INT(11) NOT NULL," +
						  "phonelist TEXT," +
						  "emaillist TEXT," +
						  "weblist TEXT," +
						  "namelist TEXT," +
						  "ethnicitylist TEXT," +
						  "locationlist TEXT," +
						  "sourcelist TEXT," +
						  "keywordlist TEXT," +
						  "timeseries TEXT," +
						  "latestad DATETIME," + 
						  "PRIMARY KEY (clusterid) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable(MemexOculusDB db, Connection conn) {
		if (db.tableExists(conn, CLUSTER_DETAILS_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + CLUSTER_DETAILS_TABLE);
				db.clearTable(conn, CLUSTER_DETAILS_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + CLUSTER_DETAILS_TABLE);
			createTable(db, conn);
		}
		UPDATE_ATTRIBUTES = ClusterAttributes.initTable(db, conn);
	}
	
	
	public static HashMap<Integer,ClusterData> calculateClusterDetails(int startclusterid, int endclusterid, HashMap<Integer, HashSet<Pair<String,String>>> adKeywords, AdLocationSet adLocations, HashMap<Integer, String> sources) {
		HashMap<Integer,ClusterData> result = new HashMap<Integer,ClusterData>();
		
		HashMap<Integer,Integer> adToCluster = new HashMap<Integer,Integer>();
		ArrayList<Integer> ads = new ArrayList<Integer>();

		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		getAdsInClusters(startclusterid, endclusterid, adToCluster, oculusconn, ads);
		
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		int i=0;
		while (i<ads.size()) {
			StringBuffer adstring = new StringBuffer("(");
			boolean isFirst = true;
			for (int j=0; j<AD_SELECT_BATCH_SIZE&&(i+j<ads.size()); j++) {
				if (isFirst) isFirst = false;
				else adstring.append(",");
				adstring.append(ads.get(i+j));
			}
			adstring.append(")");
			getMainDetails(adKeywords, adLocations, result, adToCluster, htconn, sources, adstring, null);
			getExtraDetails(result, adToCluster, htconn, adstring);
			getAttributes(result, AdExtraction.ADS_PHONE_TABLE, adToCluster, oculusconn, adstring);
			getAttributes(result, AdExtraction.ADS_EMAILS_TABLE, adToCluster, oculusconn, adstring);
			getAttributes(result, AdExtraction.ADS_WEBSITES_TABLE, adToCluster, oculusconn, adstring);
			i+=AD_SELECT_BATCH_SIZE;
		}
		
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		return result;
	}

	public static HashMap<Integer,ClusterData> calculateClusterDetails(HashSet<Integer> adsSet, HashMap<Integer, Integer> adToCluster, HashMap<Integer, HashSet<Pair<String,String>>> adKeywords, AdLocationSet adLocations, HashMap<Integer, String> sources, HashMap<String, HashMap<Integer,Integer>> clusterLocationCounts) {
		HashMap<Integer,ClusterData> result = new HashMap<Integer,ClusterData>();
		
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		int i=0;
		ArrayList<Integer> ads = new ArrayList<Integer>(adsSet);
		while (i<ads.size()) {
			StringBuffer adstring = new StringBuffer("(");
			boolean isFirst = true;
			for (int j=0; j<AD_SELECT_BATCH_SIZE&&(i+j<ads.size()); j++) {
				if (isFirst) isFirst = false;
				else adstring.append(",");
				adstring.append(ads.get(i+j));
			}
			adstring.append(")");
			getMainDetails(adKeywords, adLocations, result, adToCluster, htconn, sources, adstring, clusterLocationCounts);
			getExtraDetails(result, adToCluster, htconn, adstring);
			getAttributes(result, AdExtraction.ADS_PHONE_TABLE, adToCluster, oculusconn, adstring);
			getAttributes(result, AdExtraction.ADS_EMAILS_TABLE, adToCluster, oculusconn, adstring);
			getAttributes(result, AdExtraction.ADS_WEBSITES_TABLE, adToCluster, oculusconn, adstring);
			i+=AD_SELECT_BATCH_SIZE;
		}
		
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		return result;
	}

	public static void getAdsInClusters(int startclusterid, int endclusterid,
			HashMap<Integer, Integer> adToCluster, Connection oculusconn, ArrayList<Integer> ads) {
		String sqlStr = "SELECT ads_id,clusterid FROM " + Cluster.CLUSTER_TABLE + " where clusterid>="+startclusterid+" and clusterid<" + endclusterid;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				int clusterid = rs.getInt("clusterid");
				ads.add(adid);
				adToCluster.put(adid, clusterid);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}
	
	public static void getAdsInClusters(HashSet<Integer> clusterids,
			HashMap<Integer, Integer> adToCluster, Connection oculusconn, HashSet<Integer> ads) {
		if (clusterids.size()==0) return;
		String clusterStr = StringUtil.hashSetToSqlList(clusterids);
		String sqlStr = "SELECT ads_id,clusterid FROM " + Cluster.CLUSTER_TABLE + " where clusterid IN " + clusterStr;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				int clusterid = rs.getInt("clusterid");
				ads.add(adid);
				adToCluster.put(adid, clusterid);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}
	
	public static void deleteClusterDetails(Connection oculusconn, HashSet<Integer> clusterids) {
		if (clusterids.size()==0) return;
		String clusterStr = StringUtil.hashSetToSqlList(clusterids);
		String sqlStr = "delete FROM " + CLUSTER_DETAILS_TABLE + " where clusterid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
		sqlStr = "delete FROM " + LocationCluster.LOCATION_CLUSTER_TABLE + " where clusterid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
	}
	
	private static void getExtraDetails(HashMap<Integer, ClusterData> result,
			HashMap<Integer, Integer> adToCluster, Connection htconn,
			StringBuffer adstring) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT ads_id,attribute,value FROM ads_attributes where ads_id IN " + adstring.toString();
		stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				int clusterid = adToCluster.get(adid);
				ClusterData cd = result.get(clusterid);
				if (cd==null) {
					cd = new ClusterData();
					result.put(clusterid, cd);
					cd.adcount++;
				}
				String attribute = rs.getString("attribute");
				String value = rs.getString("value");
//				if (attribute.compareTo("phone")==0) {
//					incrementCounts(value, cd.phonelist);
//				} else if (attribute.compareTo("email")==0) {
//					incrementCounts(value, cd.emaillist);
//				} else if (attribute.compareTo("website")==0) {
//					incrementCounts(value, cd.weblist);
//				} else 
				if (attribute.compareTo("ethnicity")==0) {
					HashCount.incrementCounts(value, cd.ethnicitylist);
				} else if (attribute.compareTo("name")==0) {
					HashCount.incrementCounts(value, cd.namelist);
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	private static void getAttributes(HashMap<Integer, ClusterData> result, String table,
			HashMap<Integer, Integer> adToCluster, Connection oculusconn,
			StringBuffer adstring) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT ads_id,value FROM " + table + " where ads_id IN " + adstring.toString();
		stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				int clusterid = adToCluster.get(adid);
				ClusterData cd = result.get(clusterid);
				if (cd==null) {
					cd = new ClusterData();
					result.put(clusterid, cd);
					cd.adcount++;
				}
				String value = rs.getString("value");
				if (table.compareTo(AdExtraction.ADS_PHONE_TABLE)==0) HashCount.incrementCounts(value, cd.phonelist);
				else if (table.compareTo(AdExtraction.ADS_WEBSITES_TABLE)==0) HashCount.incrementCounts(value, cd.weblist);
				if (table.compareTo(AdExtraction.ADS_EMAILS_TABLE)==0) HashCount.incrementCounts(value, cd.emaillist);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	private static void getMainDetails(
			HashMap<Integer, HashSet<Pair<String, String>>> adKeywords,
			AdLocationSet adLocations, HashMap<Integer, ClusterData> result,
			HashMap<Integer, Integer> adToCluster, Connection htconn,
			HashMap<Integer,String> sources,
			StringBuffer adstring, HashMap<String, HashMap<Integer, Integer>> clusterLocationCounts) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT id,sources_id,posttime FROM ads WHERE id IN " + adstring.toString();
		stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			Calendar c = Calendar.getInstance();
			while (rs.next()) {
				int adid = rs.getInt("id");
				int clusterid = adToCluster.get(adid);
				ClusterData cd = result.get(clusterid);
				if (cd==null) {
					cd = new ClusterData();
					result.put(clusterid, cd);
				}
				String location = adLocations.getLocation(adid);
				HashCount.incrementCounts(sources.get(rs.getInt("sources_id")), cd.sourcelist);
				HashCount.incrementCounts(adKeywords.get(adid), cd.keywordlist);
				HashCount.incrementCount(location, cd.locationlist);
				LocationCluster.addClusterLocationToMap(clusterLocationCounts, clusterid, location);
				cd.adcount++;
				Date date = rs.getDate("posttime");
				long time = 0;
				if(date!=null) {
					if(cd.latestAd.compareTo(date)<0) {
						cd.latestAd=date;
					}						
					c.setTime(date);
					c.set(Calendar.HOUR,0);
					c.set(Calendar.MINUTE,0);
					c.set(Calendar.SECOND,0);
					c.set(Calendar.MILLISECOND,0);
					time = c.getTimeInMillis()/1000;
				}
				Integer i = cd.timeseries.get(time);
				if (i==null) {
					i = new Integer(1);
				} else {
					i++;
				}
				cd.timeseries.put(time, i);
			}
			
		} catch (Exception e) {
			System.out.println("Failed: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	public static HashMap<Integer,String> getSources(Connection htconn) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT id,name from sources";
		stmt = null;
		HashMap<Integer,String> result = new HashMap<Integer,String>();
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int id = rs.getInt("id");
				String name = rs.getString("name");
				result.put(id, name);
			}
		} catch (Exception e) {
			System.out.println("Failed: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		return result;
		
	}
	

	public static HashSet<String> getPreclusterIDs() {
		HashSet<String> result = new HashSet<String>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		String sqlStr = "SELECT distinct clusterid FROM " + Cluster.CLUSTER_TABLE;
		Connection conn = db.open();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String org = rs.getString("clusterid");
				result.add(org);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		db.close(conn);
		return result;
	}

	public static int getMaxID() {
		String sqlStr = "SELECT max(clusterid) as max FROM " + Cluster.CLUSTER_TABLE;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		int result = MemexOculusDB.getInt(conn, sqlStr, "Get max cluster id");
		db.close(conn);
		return result;
	}

	
	public static void insertClusterData(HashMap<Integer,ClusterData> resultMap, ClusterAttributes clusterAttributes) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Integer clusterId = null;
		ClusterData cd = null;
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + CLUSTER_DETAILS_TABLE + 
					"(clusterid, adcount, phonelist, emaillist, weblist, namelist, ethnicitylist, locationlist, sourcelist, keywordlist, timeseries, clustername, latestad) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
			int count = 0;
			for (Entry<Integer,ClusterData> e:resultMap.entrySet()) {
				Pair<String,Integer> maxPhone = new Pair<String,Integer>(null,0);
				Pair<String,Integer> maxEmail = new Pair<String,Integer>(null,0);
				Pair<String,Integer> maxName =new Pair<String,Integer>(null,0);
				clusterId = e.getKey();
				cd = e.getValue();
				pstmt.setInt(1, clusterId);
				pstmt.setInt(2, cd.adcount);
				if (UPDATE_ATTRIBUTES) clusterAttributes.setValues(clusterId, cd.phonelist, cd.weblist, cd.emaillist);
				pstmt.setString(3, HashCount.mapToString(cd.phonelist, maxPhone));
				pstmt.setString(4, HashCount.mapToString(cd.emaillist, maxEmail));
				pstmt.setString(5, HashCount.mapToString(cd.weblist, null));
				pstmt.setString(6, HashCount.mapToString(cd.namelist, maxName));
				pstmt.setString(7, HashCount.mapToString(cd.ethnicitylist, null));
				pstmt.setString(8, HashCount.mapToString(cd.locationlist, null));
				pstmt.setString(9, HashCount.mapToString(cd.sourcelist, null));
				pstmt.setString(10, HashCount.classifierMapToString(cd.keywordlist));
				pstmt.setString(11, HashCount.longMapToString(cd.timeseries));
				pstmt.setString(12, getClusterName(clusterId,maxEmail,maxPhone,maxName));
				pstmt.setDate(13, new java.sql.Date(cd.latestAd.getTime()));
				pstmt.addBatch();
				count++;
				if (count % BATCH_INSERT_SIZE == 0) {
					pstmt.executeBatch();
				}
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			System.out.println("Failed to write cluster details batch");
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		
		pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + LocationCluster.LOCATION_CLUSTER_TABLE + "(location,clusterid,matches) VALUES (?,?,?)");
			int count = 0;
			for (Entry<Integer,ClusterData> e:resultMap.entrySet()) {
				clusterId = e.getKey();
				cd = e.getValue();
				if (cd==null || cd.locationlist==null) continue;
				for (Map.Entry<String, Integer> loc:cd.locationlist.entrySet()) {
					String location = loc.getKey();
					if (location.length()>127) location = location.substring(0,126); // TODO: Remove this, make the table bigger
					Integer loccount = loc.getValue();
					pstmt.setString(1, location);
					pstmt.setInt(2, clusterId);
					pstmt.setInt(3, loccount);
					pstmt.addBatch();
					count++;
					if (count % BATCH_INSERT_SIZE == 0) {
						pstmt.executeBatch();
					}
				}
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			System.out.println("Failed to write cluster locations batch");
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}

		db.close(conn);
	}
	
	private static String getClusterName(Integer clusterid, Pair<String, Integer> maxEmail, Pair<String, Integer> maxPhone, Pair<String, Integer> maxName) {
		String result = maxPhone.getFirst();
		int count = maxPhone.getSecond();
		if (maxEmail.getSecond()>2||maxEmail.getSecond()>count) {
			result = maxEmail.getFirst();
		} else if (maxName.getSecond()>2||maxName.getSecond()>count) {
			result = maxName.getFirst();
		}
		if (result==null) result = ""+clusterid;
		return result;
	}

	public static void updateDetails(TimeLog tl, HashSet<Integer> clusterids) {
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		deleteClusterDetails(oculusconn, clusterids);

		HashMap<Integer,Integer> adToCluster = new HashMap<Integer,Integer>();
		HashSet<Integer> ads = new HashSet<Integer>();
		getAdsInClusters(clusterids, adToCluster, oculusconn, ads);
		oculusdb.close(oculusconn);
		
		if (ads.size()==0) {
			System.out.println("No Ads to fix");
			return;
		}

		tl.pushTime("Fetch ad keywords");
		HashMap<Integer, HashSet<Pair<String,String>>> adKeywords = AdKeywords.getAdKeywords(ads);
		tl.popTime();
		tl.pushTime("Fetch ad locations");
		AdLocationSet adLocations = new AdLocationSet();
		oculusconn = oculusdb.open();
		AdLocations.getAdLocations(oculusdb, oculusconn, adLocations, ads);
		oculusdb.close(oculusconn);
		tl.popTime();
		tl.pushTime("Fetch sources");
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		HashMap<Integer,String> sources = getSources(htconn);
		htdb.close(htconn);
		tl.popTime();

		HashMap<String, HashMap<Integer,Integer>> clusterLocationCounts = new HashMap<String, HashMap<Integer,Integer>>();
		
		ClusterAttributes clusterAttributes = new ClusterAttributes();
		HashMap<Integer,ClusterData> clusterTable = calculateClusterDetails(ads, adToCluster, adKeywords, adLocations, sources, clusterLocationCounts);
		insertClusterData(clusterTable, clusterAttributes);
//		LocationCluster.insertLocationClusterData(clusterLocationCounts);  // NOW HANDLED ABOVE
		
	}
	
	public static void lowMemDetails() {
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		initTable(oculusdb, oculusconn);
		oculusdb.close(oculusconn);
		TimeLog tl = new TimeLog();
		tl.pushTime("Fetch ad keywords");
		HashMap<Integer, HashSet<Pair<String,String>>> adKeywords = AdKeywords.getAdKeywords();
		tl.popTime();
		tl.pushTime("Fetch ad locations");
		AdLocationSet adLocations = AdLocations.getAdLocations();
		tl.popTime();
		tl.pushTime("Fetch sources");
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		HashMap<Integer,String> sources = getSources(htconn);
		htdb.close(htconn);
		tl.popTime();

		ClusterAttributes clusterAttributes = new ClusterAttributes();
		
		tl.pushTime("Fetch max ID");
		int maxid = getMaxID();
		tl.popTime();
		int count = 0;
		long start = System.currentTimeMillis();
		while (count<maxid) {
			System.out.print("\tProcessing: " + count + " to " + (count+MAX_CLUSTERS_PER_BATCH));
			HashMap<Integer,ClusterData> clusterTable = calculateClusterDetails(count, count+MAX_CLUSTERS_PER_BATCH, adKeywords, adLocations, sources);
			long end = System.currentTimeMillis();
			System.out.println(" in " + ((end-start)/1000) + " seconds.");
			start = end;
			count+=MAX_CLUSTERS_PER_BATCH;
			insertClusterData(clusterTable, clusterAttributes);
			end = System.currentTimeMillis();
			System.out.println("\tWrote in " + ((end-start)/1000) + " seconds.");
			start = end;
		}

		if (UPDATE_ATTRIBUTES) {
			oculusconn = oculusdb.open();
			clusterAttributes.writeToDatabase(oculusdb, oculusconn);
			oculusdb.close(oculusconn);
		}
	}

	public static void test() {
		HashMap<Integer, HashSet<Pair<String,String>>> adKeywords = new HashMap<Integer, HashSet<Pair<String,String>>>();
		AdLocationSet adLocations = new AdLocationSet();
		HashMap<Integer,ClusterData> result = new HashMap<Integer,ClusterData>();
		HashMap<Integer, String> sources = new HashMap<Integer, String>();
		HashMap<Integer,Integer> adToCluster = new HashMap<Integer,Integer>();
		ArrayList<Integer> ads = new ArrayList<Integer>();
		
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		long start = System.currentTimeMillis();
		System.out.print(" Fetch Ads:");
		getAdsInClusters(0, MAX_CLUSTERS_PER_BATCH, adToCluster, oculusconn, ads);
		System.out.println("Fetch :" + (System.currentTimeMillis()-start)/1000 + "s");
		
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		int i=0;
		while (i<ads.size()) {
			StringBuffer adstring = new StringBuffer("(");
			boolean isFirst = true;
			for (int j=0; j<AD_SELECT_BATCH_SIZE&&(i+j<ads.size()); j++) {
				if (isFirst) isFirst = false;
				else adstring.append(",");
				adstring.append(ads.get(i+j));
			}
			adstring.append(")");
			getMainDetails(adKeywords, adLocations, result, adToCluster, htconn, sources, adstring, null);
			i+=AD_SELECT_BATCH_SIZE;
		}
		System.out.println(" Main Details:" + (System.currentTimeMillis()-start)/1000 + "s");
	}
	
	public static void main(String[] args) {
		DateFormat dateFormat = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
		Calendar cal = Calendar.getInstance();
		System.out.println(dateFormat.format(cal.getTime()));

		System.out.println("Begin cluster details calculation...");
		long start = System.currentTimeMillis();

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		lowMemDetails();

		long end = System.currentTimeMillis();
		System.out.println("Done cluster details calculation in: " + (end-start) + "ms");
		
	}

}
