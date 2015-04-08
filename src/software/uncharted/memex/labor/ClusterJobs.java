package software.uncharted.memex.labor;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map.Entry;

import oculus.memex.clustering.Cluster;
import oculus.memex.clustering.ClusterDetails;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.util.TimeLog;

/**
 *  Create a table of job -> clusterid
 */
public class ClusterJobs {
	static final public String CLUSTER_JOBS_TABLE = "clusters_jobs";
	public static final int BATCH_INSERT_SIZE = 2000;
	public static final int BATCH_SELECT_SIZE = 50000;
	private static final int MAX_CLUSTERS_PER_BATCH = 5000;
	private static final int AD_SELECT_BATCH_SIZE = 1000;
	private static int MAX_CLUSTER_ID = 0;
	
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+CLUSTER_JOBS_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "title varchar(256) NOT NULL," +
						  "clusterid INT(10) NOT NULL," +
						  "matches INT(10) NOT NULL," +
						  "PRIMARY KEY (id)," +
						  "KEY clusteridIdx (clusterid)," +
						  "KEY titleIdx (title)" +
						  " )";
			
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable(MemexOculusDB db, Connection conn) {
		if (db.tableExists(conn, CLUSTER_JOBS_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + CLUSTER_JOBS_TABLE);
				db.clearTable(conn, CLUSTER_JOBS_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + CLUSTER_JOBS_TABLE);
			createTable(db, conn);
		}		
	}
	
	public static int getMaxClusterID() {
		String sqlStr = "SELECT max(clusterid) as max FROM " + Cluster.CLUSTER_TABLE;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		int result = MemexOculusDB.getInt(conn, sqlStr, "Get max cluster id");
		db.close(conn);
		return result;
	}	
	
	/**
	 * Get a map of Job Title->clusterid->count where the clusters under a job title contain 'count' ads for that job title.
	 * @param jobToCluster 
	 */
	private static void getJobsToClusters(Connection conn, HashMap<String, HashMap<Integer, Integer>> jobToCluster, int startclusterid, int endclusterid) {
		Statement stmt = null;
		HashMap<Integer,Integer> adToCluster = new HashMap<Integer,Integer>();
		ArrayList<Integer> ads = new ArrayList<Integer>();
		ClusterDetails.getAdsInClusters(startclusterid, endclusterid, adToCluster, conn, ads);

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

			String sqlStr = "SELECT ads_id,title FROM " + LaborData.ADS_JOBS_TABLE + " WHERE ads_id IN " + adstring;
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					Integer adid = rs.getInt("ads_id");
					Integer clusterid = adToCluster.get(adid);
					String title = rs.getString("title");
					if (clusterid!=null) {
						addClusterJobToMap(jobToCluster, clusterid, title);
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
			i+=AD_SELECT_BATCH_SIZE;
		}		
	}

	public static void addClusterJobToMap(HashMap<String, HashMap<Integer, Integer>> result, Integer clusterid, String title) {
		if (result==null) return;
		if (title==null) return;
		HashMap<Integer,Integer> clusters = result.get(title);
		if (clusters==null) {
			clusters = new HashMap<Integer,Integer>();
			result.put(title, clusters);
		}
		Integer count = clusters.get(clusterid);
		if (count==null) {
			clusters.put(clusterid, 1);
		} else {
			clusters.put(clusterid, count+1);
		}
	}
	
	public static void insertJobClusterData(HashMap<String, HashMap<Integer,Integer>> resultMap) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + CLUSTER_JOBS_TABLE + "(title,clusterid,matches) VALUES (?,?,?)");
			int count = 0;
			for (Entry<String,HashMap<Integer,Integer>> e:resultMap.entrySet()) {
				String title = e.getKey();
				HashMap<Integer,Integer> clusters = e.getValue();
				for (Integer clusterId:clusters.keySet()) {
					if (clusterId>MAX_CLUSTER_ID) MAX_CLUSTER_ID = clusterId;
					Integer matches = clusters.get(clusterId);
					pstmt.setString(1,title);
					pstmt.setInt(2, clusterId);
					pstmt.setInt(3, matches);
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
		db.close(conn);
	}
	
	
	private static void computeJobs(TimeLog tl) {
		HashMap<String,HashMap<Integer,Integer>> jobToCluster = new HashMap<String,HashMap<Integer,Integer>>();
		int maxid = getMaxClusterID();
		int count = 0;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		tl.pushTime("Compute cluster jobs");
		long start = System.currentTimeMillis();
		while (count<maxid) {
			System.out.println("Clusterid:" + count);
			getJobsToClusters(conn, jobToCluster, count, count+MAX_CLUSTERS_PER_BATCH);
			count += MAX_CLUSTERS_PER_BATCH;
			if (count%100000==0) {
				long end = System.currentTimeMillis();
				System.out.println();
				System.out.println("Computed jobs: " + count + " in " + ((end-start)/1000));
				start = end;
			}
		}
		db.close(conn);
		tl.popTime();

		tl.pushTime("Insert into " + CLUSTER_JOBS_TABLE);
		insertJobClusterData(jobToCluster);
		tl.popTime();
	}

	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Job title clustering...");
		ScriptDBInit.readArgs(args);
		MemexOculusDB oculusdb = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		Connection conn = oculusdb.open();
		initTable(oculusdb, conn);
		oculusdb.close(conn);
		computeJobs(tl);
		int duration = (int)(tl.popTime()/1000);
		
		conn = oculusdb.open();
		Progress.updateProgress(oculusdb, conn, CLUSTER_JOBS_TABLE, 0, MAX_CLUSTER_ID, duration);
		oculusdb.close(conn);
	}
}