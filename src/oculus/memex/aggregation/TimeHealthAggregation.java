/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * http://uncharted.software/
 *
 * Released under the MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package oculus.memex.aggregation;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.util.TimeLog;
import oculus.xdataht.model.TimeVolumeResult;

public class TimeHealthAggregation {
	static final public String TIME_HEALTH_TABLE = "temporal_sources";
	private static final int BATCH_INSERT_SIZE = 2000;
	private static final int BATCH_SELECT_SIZE = 500000;
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, TIME_HEALTH_TABLE)) {
			System.out.println("Clearing table: " + TIME_HEALTH_TABLE);
			db.clearTable(conn, TIME_HEALTH_TABLE);
		} else {			
			System.out.println("Creating table: " + TIME_HEALTH_TABLE);
			createTable(db, conn);
		}
		db.close(conn);
	}

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+TIME_HEALTH_TABLE+"` (" +
					  "type ENUM('post','import','mod') NOT NULL," +
					  "sources_id INT(10) UNSIGNED NOT NULL," +
					  "day INT(11) NOT NULL," +
					  "count INT(11) NULL," +						  
					  "PRIMARY KEY (type, sources_id, day) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	private static HashSet<Integer> getSourcesIds() {
		HashSet<Integer> result = new HashSet<Integer>();
		Statement stmt = null;
		MemexHTDB db = MemexHTDB.getInstance();
		Connection conn = db.open();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("Select id from sources");
			while(rs.next()) {
				result.add(rs.getInt("id"));
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

	private static int getMaxAdsID() {
		String sqlStr = "SELECT max(id) as max FROM ads";
		MemexHTDB db = MemexHTDB.getInstance();
		Connection conn = db.open();
		int result = MemexHTDB.getInt(conn, sqlStr, "Get max attribute id");
		db.close(conn);
		return result;
	}

	private static void insertTemporalData(ArrayList<TimeVolumeResult> data, String type, Integer sources_id) {
		PreparedStatement pstmt = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + TIME_HEALTH_TABLE + " (type,sources_id,day,count) VALUES (?, ?, ?, ?)");
			int count = 0;
			for (TimeVolumeResult r:data) {
				pstmt.setString(1, type);
				pstmt.setInt(2, sources_id);
				pstmt.setLong(3, r.getDay());
				pstmt.setInt(4, r.getCount());
				pstmt.addBatch();
				count++;
				if (count % BATCH_INSERT_SIZE == 0) {
					pstmt.executeBatch();
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
	
	private static void insertTimeMapData(HashMap<Integer, HashMap<Long, Integer>> timeMap, Integer sources_id, Date date, Calendar c) {
		long time = 0;
		if (date!=null) {
			c.setTime(date);
			c.set(Calendar.HOUR,0);
			c.set(Calendar.MINUTE,0);
			c.set(Calendar.SECOND,0);
			c.set(Calendar.MILLISECOND,0);
			time = c.getTimeInMillis()/1000;
		}
		HashMap<Long, Integer> times = timeMap.get(sources_id);
		if (times==null) {
			times = new HashMap<Long, Integer>();
			timeMap.put(sources_id, times);
		}
		
		Integer i = times.get(time);
		if (i==null) times.put(time,1);
		else times.put(time,i+1);
	}

	private static HashMap<Integer, HashMap<Long, Integer>> initTimeMap(HashSet<Integer> sources_ids) {
		HashMap<Integer, HashMap<Long, Integer>> result = new HashMap<Integer, HashMap<Long, Integer>>();
		for(Integer id: sources_ids) {
			result.put(id, new HashMap<Long, Integer>());
		}
		return result;
	}

	private static HashMap<String, HashMap<Integer, HashMap<Long,Integer>>> getTimeSeries() {
		HashMap<String, HashMap<Integer, HashMap<Long,Integer>>> result = new HashMap<String, HashMap<Integer, HashMap<Long,Integer>>>();
		//sources_id-->(day-->count)
		HashSet<Integer> sources_ids = getSourcesIds();
		HashMap<Integer, HashMap<Long,Integer>> posttimeMap = initTimeMap(sources_ids);
		HashMap<Integer, HashMap<Long,Integer>> importtimeMap = initTimeMap(sources_ids);
		HashMap<Integer, HashMap<Long,Integer>> modtimeMap = initTimeMap(sources_ids);
		int id = 0;
		int maxID = getMaxAdsID();
		String sqlStr;
		Statement stmt = null;
		MemexHTDB db = MemexHTDB.getInstance();
		Connection conn = db.open();
		try {
			stmt = conn.createStatement();
			while(id<maxID) {
				sqlStr = "SELECT posttime, importtime , modtime, sources_id FROM ads WHERE id >= " + id + " AND id < " + (id+BATCH_SELECT_SIZE);
				ResultSet rs = stmt.executeQuery(sqlStr);
				Calendar c = Calendar.getInstance();
				while (rs.next()) {
					int sources_id = rs.getInt("sources_id");
					insertTimeMapData(posttimeMap, sources_id, rs.getDate("posttime"), c);
					insertTimeMapData(importtimeMap, sources_id, rs.getDate("importtime"), c);
					insertTimeMapData(modtimeMap, sources_id, rs.getDate("modtime"), c);
				}
				id += BATCH_SELECT_SIZE;
			}
			result.put("post", posttimeMap);
			result.put("import", importtimeMap);
			result.put("mod", modtimeMap);
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
	
	private static void computeTimes() {
		HashMap<String, HashMap<Integer, HashMap<Long, Integer>>> typeToTotalTimeseries = getTimeSeries();
		for(String type: typeToTotalTimeseries.keySet()){
			HashMap<Integer, HashMap<Long, Integer>> sourcesTimeseries = typeToTotalTimeseries.get(type);
			for(Integer sources_id: sourcesTimeseries.keySet()) {
				ArrayList<TimeVolumeResult> a = new ArrayList<TimeVolumeResult>();
				for (Entry<Long, Integer> r:sourcesTimeseries.get(sources_id).entrySet()) {
					a.add(new TimeVolumeResult(r.getKey(), r.getValue()));
				}
				Collections.sort(a, new Comparator<TimeVolumeResult>() {
					public int compare(TimeVolumeResult o1, TimeVolumeResult o2) {
						return (int)(o1.getDay()-o2.getDay());
					};
				});
				if(!a.isEmpty()){
					insertTemporalData(a, type, sources_id);
				}
			}
		}
	}

	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Time Health aggregation");

		ScriptDBInit.readArgs(args);
		MemexOculusDB oculusdb = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB htdb = MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);

		Connection htconn = htdb.open();
		int maxadid = DBManager.getInt(htconn, "select max(id) from memex_ht.ads", "Get max ads id");
		htdb.close(htconn);

		initTable();
		computeTimes();

		int duration = (int)(tl.popTime()/1000);

		Connection oculusconn = oculusdb.open();
		Progress.updateProgress(oculusdb, oculusconn, "timehealth", maxadid, 0, duration);
		oculusdb.close(oculusconn);
	}
}