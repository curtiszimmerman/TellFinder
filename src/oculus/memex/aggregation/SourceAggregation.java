package oculus.memex.aggregation;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;

import oculus.memex.clustering.ClusterDetails;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;

public class SourceAggregation {
	static final public String SOURCE_TABLE = "source_counts";
	private static final int BATCH_INSERT_SIZE = 2000;

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+SOURCE_TABLE+"` (" +
						  "count INT(11) NULL," +
						  "source varchar(32)," +
						  "PRIMARY KEY (source) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
		
	}
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, SOURCE_TABLE)) {
			System.out.println("Clearing table: " + SOURCE_TABLE);
			db.clearTable(conn, SOURCE_TABLE);
		} else {			
			System.out.println("Creating table: " + SOURCE_TABLE);
			createTable(db, conn);
		}
		db.close(conn);
		
	}
	
	
	private static void aggregateSources() {
		MemexHTDB db = MemexHTDB.getInstance();
		Connection htconn = db.open();
		HashMap<Integer, String> sourceMapping = ClusterDetails.getSources(htconn);
		HashMap<Integer,Integer> sourceCounts = getSources(htconn);
		db.close(htconn);
		insertSourceCounts(sourceMapping, sourceCounts);
	}

	private static void insertSourceCounts(HashMap<Integer, String> sourceMapping, HashMap<Integer, Integer> sourceCounts) {
		PreparedStatement pstmt = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + SOURCE_TABLE + "(source,count) VALUES (?, ?)");
			int count = 0;
			for (Integer sourceid:sourceCounts.keySet()) {
				String sourceName = sourceMapping.get(sourceid);
				if (sourceName!=null) {
					pstmt.setString(1, sourceName);
					pstmt.setInt(2, sourceCounts.get(sourceid));
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


	private static HashMap<Integer, Integer> getSources(Connection htconn) {
		HashMap<Integer,Integer> result = new HashMap<Integer,Integer>();
		String sqlStr = "SELECT sources_id from ads";
		Statement stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer source = rs.getInt("sources_id");
				Integer i = result.get(source);
				if (i==null) result.put(source,1);
				else result.put(source,i+1);
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
	
	public static void main(String[] args) {
		DateFormat dateFormat = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
		Calendar cal = Calendar.getInstance();
		System.out.println(dateFormat.format(cal.getTime()));

		System.out.println("Begin source aggregation...");
		long start = System.currentTimeMillis();

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);

		initTable();
		aggregateSources();

		long end = System.currentTimeMillis();
		System.out.println("Done time aggregation in: " + (end-start) + "ms");

	}

}
