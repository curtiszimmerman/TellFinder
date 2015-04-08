package oculus.memex.graph;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.HashSet;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

/**
 * Create a table of organization clusterid -> related clusterid, link column, link value
 * 
 */
public class ClusterImageBinLinks {
	public static final int BATCH_INSERT_SIZE = 2000;
	public static final int CLUSTER_UPDATE_BATCH_SIZE = 2000;

	public static void doLinkCreation(TimeLog tl, MemexOculusDB db, Connection conn) {
		// Create ads_imagebins and clusters_imagebins
		makeAdsImageBins(tl, db, conn);
		makeClustersImageBins(tl, db, conn);
		

	}

	/**
	 * Join ads_images, images_hash and imagehash_details to make ads_imagebins
	 */
	private static void makeAdsImageBins(TimeLog tl, MemexOculusDB db, Connection conn) {
		// Create ads_imagebins table to map ads_ids to bins
		tl.pushTime("Creating ads_imagebins");
		if (db.tableExists(conn, ScriptDBInit._oculusSchema + ".ads_imagebins")) {
			DBManager.tryStatement(conn, "drop table " + ScriptDBInit._oculusSchema + ".ads_imagebins");
		}
		String sqlStr = "create table " + ScriptDBInit._oculusSchema + ".ads_imagebins select ads_images.ads_id,imagehash_details.bin " +
				"from " + ScriptDBInit._oculusSchema + ".ads_images " +
				"inner join " + ScriptDBInit._oculusSchema + ".images_hash on images_hash.images_id=ads_images.images_id " +
				"inner join " + ScriptDBInit._oculusSchema + ".imagehash_details on imagehash_details.hash=images_hash.hash";
		DBManager.tryStatement(conn, sqlStr);
		tl.popTime();
		
		tl.pushTime("Indexing ads_imagebins");
		sqlStr = "ALTER TABLE " + ScriptDBInit._oculusSchema + ".ads_imagebins " +
				"ADD INDEX ads_id (ads_id ASC)";
		DBManager.tryStatement(conn, sqlStr);
		sqlStr = "ALTER TABLE " + ScriptDBInit._oculusSchema + ".ads_imagebins " +
				"ADD INDEX bin (bin ASC)";
		DBManager.tryStatement(conn, sqlStr);
		tl.popTime();
	}

	private static final void updateAdsImageBins(MemexOculusDB db, Connection oculusconn) {
		int maxbinadid = MemexOculusDB.getInt(oculusconn, "SELECT max(ads_id) FROM ads_imagebins", "Get max image bin ad id");
		String sqlStr = "insert into " + ScriptDBInit._oculusSchema + ".ads_imagebins (ads_id,bin) select ads_images.ads_id,imagehash_details.bin " +
				"from " + ScriptDBInit._oculusSchema + ".ads_images " +
				"inner join " + ScriptDBInit._oculusSchema + ".images_hash on images_hash.images_id=ads_images.images_id " +
				"inner join " + ScriptDBInit._oculusSchema + ".imagehash_details on imagehash_details.hash=images_hash.hash " +
				"where ads_images.ads_id>" + maxbinadid;
		DBManager.tryStatement(oculusconn, sqlStr);
	}
	
	/**
	 * Join ads_clusters and ads_imagebins to make clusters_imagebins
	 */
	private static void makeClustersImageBins(TimeLog tl, MemexOculusDB db,	Connection conn) {
		tl.pushTime("Creating clusters_imagebins");
		if (db.tableExists(conn, ScriptDBInit._oculusSchema + ".clusters_imagebins")) {
			DBManager.tryStatement(conn, "drop table " + ScriptDBInit._oculusSchema + ".clusters_imagebins");
		}
		String sqlStr = "create table " + ScriptDBInit._oculusSchema + ".clusters_imagebins " +
				"select distinct clusterid,bin,count(ads_clusters.ads_id) as count from " +
				ScriptDBInit._oculusSchema + ".ads_clusters " +
				"inner join " + ScriptDBInit._oculusSchema + ".ads_imagebins on ads_clusters.ads_id=ads_imagebins.ads_id group by clusterid,bin";
		DBManager.tryStatement(conn, sqlStr);
		tl.popTime();
		
		tl.pushTime("Indexing clusters_imagebins");
		sqlStr = "ALTER TABLE " + ScriptDBInit._oculusSchema + ".clusters_imagebins " +
				"ADD INDEX bin (bin ASC)";
		DBManager.tryStatement(conn, sqlStr);
		sqlStr = "ALTER TABLE " + ScriptDBInit._oculusSchema + ".clusters_imagebins " +
				"ADD INDEX clusterid (clusterid ASC)";
		DBManager.tryStatement(conn, sqlStr);
		tl.popTime();
	}

	private static void updateClustersImageBins(MemexOculusDB db, Connection conn, HashSet<Integer> clusterids) {
		HashSet<Integer> processSet = new HashSet<Integer>();
		for (Integer clusterid:clusterids) {
			processSet.add(clusterid);
			if (processSet.size()>=CLUSTER_UPDATE_BATCH_SIZE) {
				processClustersImageBins(db, conn, processSet);
				processSet.clear();
			}
		}
		processClustersImageBins(db, conn, processSet);
	}
	
	private static void processClustersImageBins(MemexOculusDB db, Connection conn, HashSet<Integer> processSet) {
		if (processSet.size()==0) return;
		String clusterIdsStr = StringUtil.hashSetToSqlList(processSet);
		String sqlStr = "delete from " + ScriptDBInit._oculusSchema + ".clusters_imagebins where clusterid IN " + clusterIdsStr;
		DBManager.tryStatement(conn, sqlStr);

		sqlStr = "insert into " + ScriptDBInit._oculusSchema + ".clusters_imagebins (clusterid,bin,count) " +
				"select distinct clusterid,bin,count(ads_clusters.ads_id) as count from " +
				ScriptDBInit._oculusSchema + ".ads_clusters " +
				"inner join " + ScriptDBInit._oculusSchema + ".ads_imagebins on ads_clusters.ads_id=ads_imagebins.ads_id " +
				" where clusterid IN " + clusterIdsStr +
				" group by clusterid,bin";
		DBManager.tryStatement(conn, sqlStr);
	}

	/**
	 * Return the image bins and occurrence counts for a given clusterid.
	 */
	public static HashMap<Integer,Integer> getExemplars(int clusterid) {
		HashMap<Integer,Integer> counts = new HashMap<Integer,Integer>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		Statement stmt = null;
		String sqlStr = "select bin,count from " + ScriptDBInit._oculusSchema + ".clusters_imagebins where clusterid=" + clusterid;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer bin = rs.getInt("bin");
				Integer count = rs.getInt("count");
				counts.put(bin, count);
			}
		} catch (Exception e) {
			System.out.println("Failed sql: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		db.close(conn);
		return counts;
	}

	public static HashMap<Integer,HashSet<Integer>> getLinks(int clusterid) {
		HashMap<Integer,HashSet<Integer>> links = new HashMap<Integer,HashSet<Integer>>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();

		// Select the image bins associated with the clusterid
		Statement stmt = null;
		String sqlStr = "select bin from " + ScriptDBInit._oculusSchema + ".clusters_imagebins where clusterid=" + clusterid;
		HashSet<Integer> bins = new HashSet<Integer>();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer bin = rs.getInt("bin");
				bins.add(bin);
			}
		} catch (Exception e) {
			System.out.println("Failed sql: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

		if (bins.size()>0) {
			String binStr = StringUtil.hashSetToSqlList(bins);
			sqlStr = "select bin,clusterid from " + ScriptDBInit._oculusSchema + ".clusters_imagebins where bin IN " + binStr;
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					Integer bin = rs.getInt("bin");
					Integer lclusterid = rs.getInt("clusterid");
					if (lclusterid==clusterid) continue;
					HashSet<Integer> others = links.get(bin);
					if (others==null) {
						others = new HashSet<Integer>();
						links.put(bin, others);
					}
					others.add(lclusterid);
				}
			} catch (Exception e) {
				System.out.println("Failed sql: " + sqlStr);
				e.printStackTrace();
			} finally {
				try {
					if (stmt != null) { stmt.close(); }
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		}
		
		db.close(conn);
		return links;
	}

	public static void computeLinks(TimeLog tl, HashSet<Integer> fixClusters) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection oculusconn = db.open();
		tl.pushTime("Update ads_imagebins");
		updateAdsImageBins(db, oculusconn);
		tl.popTime();
		tl.pushTime("Update clusters_imagebins");
		updateClustersImageBins(db, oculusconn, fixClusters);
		tl.popTime();
		
		db.close(oculusconn);
	}
	
	public static void computeLinks(TimeLog tl) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();

		tl.pushTime("Compute image links");
		doLinkCreation(tl, db, conn);
		tl.popTime();
		
	}

	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Cluster image links calculation");

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		computeLinks(tl);

		tl.popTime();
	}

}
