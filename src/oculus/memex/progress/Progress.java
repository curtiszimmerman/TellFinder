package oculus.memex.progress;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.util.Pair;

public class Progress {
	static final public String PROCESSING_PROGRESS_TABLE = "processing_progress";

	private static void createProgressTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = null;
			
			if (db.database_type.equals("impala")) {
				sqlCreate = 
					"CREATE TABLE `"+PROCESSING_PROGRESS_TABLE+"` (" +
						  "id INT," +
						  "process_name STRING," +
						  "last_processed INT," +
						  "last_clusterid INT," +
						  "time TIMESTAMP," +
						  "duration INT)";
			}
			else {
				sqlCreate =
					"CREATE TABLE `"+PROCESSING_PROGRESS_TABLE+"` (" +
						  "id INT NOT NULL AUTO_INCREMENT," +
						  "process_name VARCHAR(45) NOT NULL," +
						  "last_processed INT(10) NOT NULL," +
						  "last_clusterid INT(10) NOT NULL," +
						  "time TIMESTAMP," +
						  "duration INT(11)," +
						  "PRIMARY KEY (id) )";	
			}
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	/**
	 * Get  (last processed ad, last clusterid) from the processing table.
	 * @return
	 */
	public static Pair<Integer,Integer> getLastID(String process) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		Pair<Integer,Integer> result = new Pair<Integer,Integer>(-1,-1);
		if (!db.tableExists(conn, PROCESSING_PROGRESS_TABLE)) {
			System.out.println("Creating table: " + PROCESSING_PROGRESS_TABLE);
			createProgressTable(db, conn);
		} else {
			String sqlStr = "SELECT last_processed,last_clusterid from " + PROCESSING_PROGRESS_TABLE + " where process_name='" + process + "' order by time desc";
			Statement stmt = null;
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				if (rs.next()) {
					result.setFirst(rs.getInt(1));
					result.setSecond(rs.getInt(2));
				}
			} catch (Exception e) {
				System.out.println("Failed to get last processed (" + sqlStr + ")");
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
		return result;
	}
	

	public static void updateProgress(MemexOculusDB db, Connection oculusconn, String process, int lastID, int lastCluster, int duration) {
		//    Update progress table
		if (!db.tableExists(oculusconn, PROCESSING_PROGRESS_TABLE)) {
			System.out.println("Creating table: " + PROCESSING_PROGRESS_TABLE);
			createProgressTable(db, oculusconn);
		}
		String sqlStr = null;
		if (db.database_type.equals("impala")) {
			sqlStr = "insert into " + PROCESSING_PROGRESS_TABLE + "(process_name,last_processed,last_clusterid,time,duration) values ('" + process + "'," + lastID + "," + lastCluster + ",now(),"+duration+")";
		}
		else {
			sqlStr = "insert into " + PROCESSING_PROGRESS_TABLE + "(process_name,last_processed,last_clusterid,time,duration) values ('" + process + "'," + lastID + "," + lastCluster + ",CURRENT_TIMESTAMP,"+duration+")";			
		}
		DBManager.tryStatement(oculusconn, sqlStr);
	}

	public static void main(String[] args) {
		Pair<Integer, Integer> lastID = getLastID("cluster");
		System.out.println("Last ad id: " + lastID.getFirst() + " Last cluster id: " + lastID.getSecond());
	}
	
}
