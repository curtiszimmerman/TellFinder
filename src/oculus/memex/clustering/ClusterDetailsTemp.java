package oculus.memex.clustering;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;

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
import oculus.memex.util.TimeLog;

/**
 * Create a table of clusterid->details (phone,email,location,source,name) distributions, etc.
 */
public class ClusterDetailsTemp extends ClusterDetails {
	static final public String CLUSTER_DETAILS_TABLE = "clusters_details";
	private static final int MAX_CLUSTERS_PER_BATCH = 50000;
	public static final int BATCH_INSERT_SIZE = 2000;
	
	public static HashMap<Integer,ClusterData> getPreclusterAggregation(int startclusterid, int endclusterid, HashMap<Integer, HashSet<Pair<String,String>>> adKeywords, AdLocationSet adLocations, HashMap<Integer, String> sources) {
		HashMap<Integer,ClusterData> result = new HashMap<Integer,ClusterData>();
		
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		long start = System.currentTimeMillis();
		getAdsInClusters(startclusterid, endclusterid, htconn);
		System.out.print(" Fetch Ads:" + (System.currentTimeMillis()-start)/1000 + "s");
		
		long mainTime = 0;
		long extraTime = 0;
		long phoneTime = 0;
		long end;
		
		start = System.currentTimeMillis();
		getMainDetails(adKeywords, adLocations, result, htconn, sources);
		end = System.currentTimeMillis();
		mainTime += (end-start);
		start = end;
		getExtraDetails(result, htconn);
		end = System.currentTimeMillis();
		extraTime += (end-start);
		start = end;
		getPhones(result, oculusconn);
		end = System.currentTimeMillis();
		phoneTime += (end-start);

		System.out.print(" details: (" + (mainTime/1000) + "," + (extraTime/1000) + "," + (phoneTime/1000) + ") ");
		
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		return result;
	}

	public static void getAdsInClusters(int startclusterid, int endclusterid, Connection oculusconn) {
		String sqlStr = "CREATE TEMPORARY TABLE IF NOT EXISTS " + ScriptDBInit._htSchema +".tempclusterads ( INDEX(ads_id) ) AS (SELECT ads_id,clusterid FROM " + ScriptDBInit._oculusSchema + "." + Cluster.CLUSTER_TABLE + " where clusterid>="+startclusterid+" and clusterid<" + endclusterid + ")";
		DBManager.tryStatement(oculusconn, "DROP TABLE IF EXISTS " + ScriptDBInit._htSchema +".tempclusterads");
		DBManager.tryStatement(oculusconn, sqlStr);
	}
	
	private static void getExtraDetails(HashMap<Integer, ClusterData> result, Connection htconn) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT clusterid,ads_attributes.ads_id,attribute,value FROM ads_attributes INNER JOIN tempclusterads ON ads_attributes.ads_id=tempclusterads.ads_id";
		stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int clusterid = rs.getInt("clusterid");
				ClusterData cd = result.get(clusterid);
				if (cd==null) {
					cd = new ClusterData();
					result.put(clusterid, cd);
					cd.adcount++;
				}
				String attribute = rs.getString("attribute");
				String value = rs.getString("value");
				if (attribute.compareTo("phone")==0) {
//					incrementCounts(value, cd.phonelist);
				} else if (attribute.compareTo("email")==0) {
					HashCount.incrementCounts(value, cd.emaillist);
				} else if (attribute.compareTo("website")==0) {
					HashCount.incrementCounts(value, cd.weblist);
				} else if (attribute.compareTo("ethnicity")==0) {
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

	private static void getPhones(HashMap<Integer, ClusterData> result, Connection oculusconn) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT " + AdExtraction.ADS_PHONE_TABLE + ".ads_id,clusterid,value FROM " + ScriptDBInit._oculusSchema + "." + AdExtraction.ADS_PHONE_TABLE + " INNER JOIN tempclusterads ON " + AdExtraction.ADS_PHONE_TABLE + ".ads_id=tempclusterads.ads_id";
		stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int clusterid = rs.getInt("clusterid");
				ClusterData cd = result.get(clusterid);
				if (cd==null) {
					cd = new ClusterData();
					result.put(clusterid, cd);
					cd.adcount++;
				}
				String phone = rs.getString("value");
				HashCount.incrementCounts(phone, cd.phonelist);
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
			Connection htconn,
			HashMap<Integer,String> sources) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT clusterid,id,email,website,sources_id,posttime FROM ads INNER JOIN tempclusterads ON ads.id=tempclusterads.ads_id";
		stmt = null;
		try {
			Calendar c = Calendar.getInstance();
			stmt = htconn.createStatement();
			int count = 0;
			long start = System.currentTimeMillis();
			long t = start;
			long e = start;
			long dbTime = 0;
			long pTime = 0;
			ResultSet rs = stmt.executeQuery(sqlStr);
			e = System.currentTimeMillis();
			dbTime += (e-t);
			t = e;
			while (rs.next()) {
				count++;
				int adid = rs.getInt(2);
				int clusterid = rs.getInt(1);
				String email = rs.getString(3);
				String website = rs.getString(4);
				String source = sources.get(rs.getInt(5));
				Date date = rs.getDate(6);
				ClusterData cd = result.get(clusterid);
				if (cd==null) {
					cd = new ClusterData();
					result.put(clusterid, cd);
				}
				
//				incrementCounts(StringUtil.stripNonNumeric(rs.getString("phone")), cd.phonelist);
				HashCount.incrementCounts(email, cd.emaillist);
				HashCount.incrementCounts(website, cd.weblist);
				HashCount.incrementCounts(source, cd.sourcelist);
				HashCount.incrementCounts(adKeywords.get(adid), cd.keywordlist);
				HashCount.incrementCount(adLocations.getLocation(adid), cd.locationlist);
				cd.adcount++;
				if (date!=null) {
					c.setTime(date);
					c.set(Calendar.HOUR,0);
					c.set(Calendar.MINUTE,0);
					c.set(Calendar.SECOND,0);
					c.set(Calendar.MILLISECOND,0);
					long time = c.getTimeInMillis()/1000;
					Integer i = cd.timeseries.get(time);
					if (i==null) {
						i = new Integer(1);
					} else {
						i++;
					}
					cd.timeseries.put(time, i);
				}
				e = System.currentTimeMillis();
				pTime += (e-t);
				t = e;
 			}
			System.out.print(" Main Details: " + count + "," + (System.currentTimeMillis()-start)/1000);
			System.out.print(" DB: " + dbTime + " Process: " + pTime);
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
	
	public static void lowMemDetails() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		initTable(db, conn);
		db.close(conn);
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
			HashMap<Integer,ClusterData> clusterTable = getPreclusterAggregation(count, count+MAX_CLUSTERS_PER_BATCH, adKeywords, adLocations, sources);
			long end = System.currentTimeMillis();
			System.out.println(" in " + ((end-start)/1000) + " seconds.");
			start = end;
			count+=MAX_CLUSTERS_PER_BATCH;
			insertClusterData(clusterTable, clusterAttributes);
			end = System.currentTimeMillis();
			System.out.println("\tWrote in " + ((end-start)/1000) + " seconds.");
			start = end;
		}
	}
	
	public static void test() {
		HashMap<Integer, HashSet<Pair<String,String>>> adKeywords = new HashMap<Integer, HashSet<Pair<String,String>>>();
		AdLocationSet adLocations = new AdLocationSet();
		HashMap<Integer,ClusterData> result = new HashMap<Integer,ClusterData>();
		HashMap<Integer, String> sources = new HashMap<Integer, String>();
		
//		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
//		Connection oculusconn = oculusdb.open();
//
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		long start = System.currentTimeMillis();
		System.out.print(" Fetch Ads:");
		getAdsInClusters(0, MAX_CLUSTERS_PER_BATCH, htconn);
		System.out.println("Fetch :" + (System.currentTimeMillis()-start)/1000 + "s");
		
		getMainDetails(adKeywords, adLocations, result, htconn, sources);
		getPhones(result, htconn);
		System.out.println(" Main Details:" + (System.currentTimeMillis()-start)/1000 + "s");
	}
	
	public static void main(String[] args) {
//		test();
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
