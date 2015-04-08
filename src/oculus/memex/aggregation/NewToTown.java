package oculus.memex.aggregation;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.Pair;

public class NewToTown {
	static final public String NEW_TO_TOWN_TABLE = "new_to_town";
	public static final int BATCH_INSERT_SIZE = 2000;

	private static class LocationMapping {
		HashMap<Integer,String> _idToLabel = new HashMap<Integer,String>();
		HashMap<String,Integer> _labelToId = new HashMap<String,Integer>();
		int _nextID = 1;
		public Integer getId(String label) {
			Integer result = _labelToId.get(label);
			if (result==null) {
				_idToLabel.put(_nextID, label);
				_labelToId.put(label, _nextID);
				_nextID++;
			}
			return result;
		}
	}
	
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+NEW_TO_TOWN_TABLE+"` (" +
						  "clusterid INT(11)," +
						  "ads_id INT(11)," +
						  "day INT(11)," +
						  "location varchar(128)," +
						  "PRIMARY KEY (source) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
		
	}
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, NEW_TO_TOWN_TABLE)) {
			System.out.println("Clearing table: " + NEW_TO_TOWN_TABLE);
			db.clearTable(conn, NEW_TO_TOWN_TABLE);
		} else {			
			System.out.println("Creating table: " + NEW_TO_TOWN_TABLE);
			createTable(db, conn);
		}
		db.close(conn);
		
	}

	public static HashMap<Integer,Pair<Integer,Long>> getAdLocationTimes(LocationMapping locationMapping) {
		HashMap<Integer,Pair<Integer,Long>> result = new HashMap<Integer,Pair<Integer,Long>>();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		String sqlStr = "SELECT ads_id,label,posttime from ads_locations";
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			Calendar c = Calendar.getInstance();
			while (rs.next()) {
				Integer adsid = rs.getInt("ads_id");
				String label = rs.getString("label");
				int locationid = locationMapping.getId(label);
				Timestamp timestamp = rs.getTimestamp("posttime");
				long time = (timestamp==null)?0:timestamp.getTime();
				c.setTimeInMillis(time);
				c.set(Calendar.HOUR,0);
				c.set(Calendar.MINUTE,0);
				c.set(Calendar.SECOND,0);
				c.set(Calendar.MILLISECOND,0);
				time = c.getTimeInMillis()/1000;
				result.put(adsid, new Pair<Integer,Long>(locationid,time));
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
		return result;
	}
	
	public static HashMap<Integer,HashSet<Integer>> getClusters() {
		HashMap<Integer,HashSet<Integer>> result = new HashMap<Integer,HashSet<Integer>>();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		String sqlStr = "SELECT ads_id,clusterid from ads_clusters";
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer adsid = rs.getInt("ads_id");
				Integer clustersid = rs.getInt("clusterid");
				HashSet<Integer> ads = result.get(clustersid);
				if (ads==null) {
					ads = new HashSet<Integer>();
				}
				ads.add(adsid);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		return result;
	}
	
	
	public static void main(String[] args) {
		DateFormat dateFormat = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
		Calendar cal = Calendar.getInstance();
		System.out.println(dateFormat.format(cal.getTime()));

		System.out.println("Begin new to town calculation...");
		long start = System.currentTimeMillis();

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);

		initTable();

		long end = System.currentTimeMillis();
		System.out.println("Done time aggregation in: " + (end-start) + "ms");

	}

}
