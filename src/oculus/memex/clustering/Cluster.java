package oculus.memex.clustering;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;

import oculus.memex.aggregation.LocationCluster;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.graph.ClusterLinks;
import oculus.memex.progress.Progress;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

import org.json.JSONArray;


public class Cluster {
	public static final String CLUSTER_TABLE = "ads_clusters";
	private static int AD_PROCESS_BATCH_SIZE = 1000;
	public static boolean DEBUG_MODE = false;

	private static void createClusterTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+CLUSTER_TABLE+"` (" +
						  "id INT NOT NULL AUTO_INCREMENT," +
						  "clusterid INT(10) NOT NULL," +
						  "ads_id INT(10) NOT NULL," +
						  "PRIMARY KEY (id)," + 
						  "KEY ads_idx (ads_id)," +
						  "KEY cluster_idx (clusterid) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	

	private static void initTables() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (!db.tableExists(conn, CLUSTER_TABLE)) {
			System.out.println("Creating table: " + CLUSTER_TABLE);
			createClusterTable(db, conn);
		} else {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + CLUSTER_TABLE);
				db.clearTable(conn, CLUSTER_TABLE);
			}
		}
		ClusterAttributes.initTable(db, conn);
		LocationCluster.initTable(db,conn);
		ClusterDetails.initTable(db, conn);
		ClusterLinks.initTable(db, conn);
		db.close(conn);
	}
	
	/**
	 * Loop over new ads. Update cluster and cluster_attributes table to put each new ad into a cluster.
	 * @param tl 
	 */
	public static void clusterTable(TimeLog tl) {
		tl.pushTime("Clustering");
		ArrayList<String> clusterAttributes = new ArrayList<String>();
		clusterAttributes.add("phone");
		clusterAttributes.add("email");
		clusterAttributes.add("website");
		clusterAttributes.add("first_id");
		
		// Get the next ad to be processed
		// Find clusters which match phone,email,website
		//    Look at (cluster,attribute,value) table
		// Pick the best match cluster
		// Add the ad to the cluster
		//    Update (ad,cluster) table
		//    Update (cluster,attribute,value) table

		tl.pushTime("Get max ids");
		Pair<Integer,Integer> lastIDs = Progress.getLastID("cluster");
		int lastID = lastIDs.getFirst();
		int nextID = lastID+1;
		int oldLastCluster = lastIDs.getSecond();
		int lastCluster = oldLastCluster;
		if (DEBUG_MODE || ScriptDBInit._clearDB) {
			lastID = 0;
			nextID = 1;
			lastCluster = 0;
		}
		int maxID = MemexAd.getMaxID();
		tl.popTime("MAX AD:" + maxID);
		
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		ClusterAttributes attributeToClusters = new ClusterAttributes();
		if (!DEBUG_MODE) {
			attributeToClusters.readFromDB(oculusconn);
		}
		ClusterUpdateManager updater = new ClusterUpdateManager();
		int iterations = 0;
		tl.pushTime("Processing from " + nextID + ". Max: " + maxID);
		while (nextID<maxID) {
			HashMap<Integer, MemexAd> adbatch = MemexAd.fetchAdsOculus(htconn, oculusconn, nextID, nextID+AD_PROCESS_BATCH_SIZE-1);
			for (MemexAd ad:adbatch.values()) {
				int clusterid = attributeToClusters.getBestMatch(ad, clusterAttributes);
				if (clusterid==-1) {
					lastCluster++;
					updater.createCluster(oculusdb, oculusconn, lastCluster, ad, clusterAttributes, attributeToClusters);
				} else {
					if (lastCluster<clusterid) lastCluster = clusterid;
					updater.addToCluster(oculusdb, oculusconn, clusterid, ad, clusterAttributes, attributeToClusters);
				}
				if (ad.id>lastID) lastID = ad.id;
			}
			nextID += AD_PROCESS_BATCH_SIZE;
			iterations++;
			if ((iterations%1000)==0) {
				tl.popTime();
				tl.pushTime("Processing " + nextID + " of " + maxID + ". Last id: " + lastID );
			}
		}
		tl.popTime();
		
		if (!DEBUG_MODE) {
			updater.batchInsert(oculusconn);
	
			tl.pushTime("Deleting cluster attributes");
			oculusdb.clearTable(oculusconn, ClusterAttributes.CLUSTER_ATTRIBUTE_TABLE);
			tl.popTime();
			tl.pushTime("Writing cluster attributes");
			attributeToClusters.writeToDatabase(oculusdb, oculusconn);
			tl.popTime();
			
			int duration = (int)(tl.popTime()/1000);
			Progress.updateProgress(oculusdb, oculusconn, "cluster", lastID, lastCluster, duration);
		} else {
			tl.popTime();
		}

		oculusdb.close(oculusconn);
		htdb.close(htconn);

		// Update the details tables
		if (!DEBUG_MODE) {
			tl.pushTime("Update details");
			updater.updateDetails(tl, attributeToClusters);
			int duration = (int)(tl.popTime()/1000);
			oculusconn = oculusdb.open();
			Progress.updateProgress(oculusdb, oculusconn, "cluster_details", lastID, lastCluster, duration);
			oculusdb.close(oculusconn);
		}
	}

	/**
	 * Loop over new ads. Update cluster and cluster_attributes table to put each new ad into a cluster.
	 * @param tl 
	 */
	public static void handleUnclusteredAds(TimeLog tl) {
		tl.pushTime("Clustering");
		ArrayList<String> clusterAttributes = new ArrayList<String>();
		clusterAttributes.add("phone");
		clusterAttributes.add("email");
		clusterAttributes.add("website");
		clusterAttributes.add("first_id");
		
		tl.pushTime("Get max ids");
		Pair<Integer,Integer> lastIDs = Progress.getLastID("cluster");
		int lastID = lastIDs.getFirst();
		int oldLastCluster = lastIDs.getSecond();
		int lastCluster = oldLastCluster;
		tl.popTime();
		
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		ClusterAttributes attributeToClusters = new ClusterAttributes();
		if (!DEBUG_MODE) {
			attributeToClusters.readFromDB(oculusconn);
		}
		ClusterUpdateManager updater = new ClusterUpdateManager();
		int iterations = 0;
		boolean done = false;
		tl.pushTime("Processing iteration 0");
		while (!done) {
			HashSet<Integer> unclusteredAds = getUnclusteredAds(htconn);
			if (unclusteredAds.size()<=0) {
				done = false;
				break;
			}
			HashMap<Integer, MemexAd> adbatch = MemexAd.fetchAdsOculus(htconn, oculusconn, unclusteredAds);
			for (MemexAd ad:adbatch.values()) {
				int clusterid = attributeToClusters.getBestMatch(ad, clusterAttributes);
				if (clusterid==-1) {
					lastCluster++;
					updater.createCluster(oculusdb, oculusconn, lastCluster, ad, clusterAttributes, attributeToClusters);
				} else {
					if (lastCluster<clusterid) lastCluster = clusterid;
					updater.addToCluster(oculusdb, oculusconn, clusterid, ad, clusterAttributes, attributeToClusters);
				}
				if (ad.id>lastID) lastID = ad.id;
			}
			iterations++;
			if ((iterations%1000)==0) {
				tl.popTime();
				tl.pushTime("Processing iteration " + iterations );
			}
		}
		tl.popTime();
		
		if (!DEBUG_MODE) {
			updater.batchInsert(oculusconn);
	
			tl.pushTime("Deleting cluster attributes");
			oculusdb.clearTable(oculusconn, ClusterAttributes.CLUSTER_ATTRIBUTE_TABLE);
			tl.popTime();
			tl.pushTime("Writing cluster attributes");
			attributeToClusters.writeToDatabase(oculusdb, oculusconn);
			tl.popTime();
			
			int duration = (int)(tl.popTime()/1000);
			Progress.updateProgress(oculusdb, oculusconn, "cluster", lastID, lastCluster, duration);
		} else {
			tl.popTime();
		}

		oculusdb.close(oculusconn);
		htdb.close(htconn);

		// Update the details tables
		if (!DEBUG_MODE) {
			tl.pushTime("Update details");
			updater.updateDetails(tl, attributeToClusters);
			int duration = (int)(tl.popTime()/1000);
			oculusconn = oculusdb.open();
			Progress.updateProgress(oculusdb, oculusconn, "cluster_details", lastID, lastCluster, duration);
			oculusdb.close(oculusconn);
		}
	}	
	
	public static HashSet<Integer> getUnclusteredAds(Connection conn) {
		HashSet<Integer> result = new HashSet<Integer>();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT ads.id from memex_ht.ads LEFT JOIN memex_oculus.ads_clusters ON ads.id=ads_id where ads_id IS NULL limit 2000");
			while (rs.next()) {
				int id = rs.getInt("id");
				result.add(id);
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
		return result;
	}

	public static HashMap<String,ArrayList<Pair<String,Integer>>> getClusterAttributes(MemexOculusDB db, Connection conn, int clusterid) {
		HashMap<String,ArrayList<Pair<String,Integer>>> result = new HashMap<String,ArrayList<Pair<String,Integer>>>();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT attribute,value,count FROM " + ClusterAttributes.CLUSTER_ATTRIBUTE_TABLE + " WHERE clusterid=" + clusterid + " ORDER BY count DESC");
			while (rs.next()) {
				String attribute = rs.getString("attribute");
				ArrayList<Pair<String,Integer>> values = result.get(attribute);
				if (values==null) {
					values = new ArrayList<Pair<String,Integer>>();
					result.put(attribute, values);
				}
				values.add(new Pair<String,Integer>(rs.getString("value"),rs.getInt("count")));
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
		return result;
	}

	public static void getAdsInClusters(JSONArray clusterids, HashMap<Integer,HashSet<Integer>> clusterAds, int limit) {
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();		
		for(int i = 0;i<clusterids.length();i++) {
			Statement stmt = null;
			try {
				int clusterid = clusterids.getInt(i);
				String sqlStr = "SELECT ads_id FROM " + CLUSTER_TABLE + 
						" WHERE clusterid="+clusterid+(limit>0?" LIMIT "+limit:"");
				HashSet<Integer> ads = new HashSet<Integer>();
				stmt = oculusconn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					int adid = rs.getInt("ads_id");
					ads.add(adid);
				}
				clusterAds.put(clusterid, ads);
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
		oculusdb.close(oculusconn);
	}
	
	public static void getAdsInCluster(int clusterid, HashSet<Integer> ads, int limit) {
		String sqlStr = "SELECT ads_id FROM " + CLUSTER_TABLE + " WHERE clusterid=" + clusterid + " order by ads_id desc" + (limit>0?" LIMIT "+limit:"");
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				ads.add(adid);
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
		oculusdb.close(oculusconn);
	}
	
	public static void getAdsInClusters(HashSet<Integer> clusterids, HashSet<Integer> ads) {
		if (clusterids.size()==0) return;
		String sqlStr = "SELECT ads_id FROM " + CLUSTER_TABLE + " WHERE clusterid IN "+StringUtil.hashSetToSqlList(clusterids);
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				ads.add(adid);
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
		oculusdb.close(oculusconn);
	}
	
	public static void deleteClusters(HashSet<Integer> clusterids) {
		if (clusterids.size()==0) return;
		String clusterStr = StringUtil.hashSetToSqlList(clusterids);
		String sqlStr = "DELETE FROM " + CLUSTER_TABLE + " WHERE clusterid IN " + clusterStr;
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		DBManager.tryStatement(oculusconn, sqlStr);
		
		deleteClusterDetails(oculusconn, clusterStr);

		oculusdb.close(oculusconn);
	}

	private static void deleteClusterDetails(Connection oculusconn, String clusterStr) {
		String sqlStr;
		sqlStr = "DELETE FROM " + ClusterAttributes.CLUSTER_ATTRIBUTE_TABLE + " WHERE clusterid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
		
		sqlStr = "DELETE FROM " + ClusterDetails.CLUSTER_DETAILS_TABLE + " WHERE clusterid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
		
		sqlStr = "DELETE FROM " + ClusterLinks.CLUSTER_LINKS_TABLE + " WHERE clusterid IN " + clusterStr + " OR otherid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
		
		sqlStr = "DELETE FROM " + LocationCluster.LOCATION_CLUSTER_TABLE + " WHERE clusterid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
	}
	
	public static void precomputeClusters(TimeLog tl) {

		if (!DEBUG_MODE) {
			tl.pushTime("Init tables");
			initTables();
			tl.popTime();
		}
		
		try {
			clusterTable(tl);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public static HashMap<String,Integer> getSimpleClusterCounts(HashSet<Integer> matchingAds) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		String sqlStr = "SELECT clusterid,count(*) AS matching FROM " + CLUSTER_TABLE + " WHERE ads_id IN (";
		boolean isFirst = true;
		for (Integer adid:matchingAds) {
			if (isFirst) isFirst = false;
			else sqlStr += ",";
			sqlStr += adid;
		}
		sqlStr += ") group by clusterid";
		Statement stmt = null;
		HashMap<String,Integer> result = new HashMap<String,Integer>();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String clusterid = rs.getString("clusterid");
				Integer matching = rs.getInt("matching");
				result.put(clusterid, matching);
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
	
	public static HashSet<Integer> getSimpleClusters(HashSet<Integer> matchingAds) {
		HashSet<Integer> result = new HashSet<Integer>();
		if (matchingAds.size()==0) return result;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		String sqlStr = "SELECT DISTINCT clusterid FROM " + CLUSTER_TABLE + " WHERE ads_id IN " + StringUtil.hashSetToSqlList(matchingAds);

		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int clusterid = rs.getInt("clusterid");
				result.add(clusterid);
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

	public static HashSet<Integer> recalculateClustersForAds(HashSet<Integer> matchingAds, ClusterAttributes attributeToClusters, TimeLog tl) {
		// Fetch clusterids containing the ads
		HashSet<Integer> matchingClusters = getSimpleClusters(matchingAds);
		HashSet<Integer> alteredClusters = new HashSet<Integer>();

		if (matchingAds==null||matchingAds.size()==0) return alteredClusters;
		
		// Expand the list of ads to include all those in the affected clusters
		getAdsInClusters(matchingClusters, matchingAds);

		deleteClusters(matchingClusters);

		tl.pushTime("Read attributes");
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		attributeToClusters.readFromDB(oculusconn); // TODO: This is a large operation. Cache?
		oculusdb.close(oculusconn);
		tl.popTime();
		
		
		ArrayList<String> clusterAttributes = new ArrayList<String>();
		clusterAttributes.add("phone");
		clusterAttributes.add("email");
		clusterAttributes.add("website");
		clusterAttributes.add("first_id");
		
		Pair<Integer,Integer> lastIDs = Progress.getLastID("cluster");

		int lastCluster = lastIDs.getSecond();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		oculusconn = oculusdb.open();
		ClusterUpdateManager updater = new ClusterUpdateManager();

		HashMap<Integer, MemexAd> adbatch = MemexAd.fetchAdsOculus(htconn, oculusconn, matchingAds);

		for (MemexAd ad:adbatch.values()) {
			int clusterid = attributeToClusters.getBestMatch(ad, clusterAttributes);
			if (clusterid==-1) {
				lastCluster++;
				clusterid = lastCluster;
				updater.createCluster(oculusdb, oculusconn, clusterid, ad, clusterAttributes, attributeToClusters);
			} else {
				if (lastCluster<clusterid) lastCluster = clusterid;
				updater.addToCluster(oculusdb, oculusconn, clusterid, ad, clusterAttributes, attributeToClusters);
			}
			alteredClusters.add(clusterid);
		}

		updater.batchInsert(oculusconn);

		String clusterStr = StringUtil.hashSetToSqlList(alteredClusters);
		deleteClusterDetails(oculusconn, clusterStr);
		
		attributeToClusters.writeSubset(oculusdb, oculusconn, alteredClusters);
			
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		
		return alteredClusters;
	}

	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Preclustering");

		ScriptDBInit.readArgs(args);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		precomputeClusters(tl);

		tl.popTime();
	}

}