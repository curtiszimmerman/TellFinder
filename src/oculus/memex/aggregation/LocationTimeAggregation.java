package oculus.memex.aggregation;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map.Entry;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.geo.AdLocations;
import oculus.memex.progress.Progress;
import oculus.memex.util.TimeLog;
import oculus.xdataht.model.LocationTimeVolumeResult;
import oculus.xdataht.model.TimeVolumeResult;

public class LocationTimeAggregation {
	static final public String LOCATION_TIME_TABLE = "locationtime";
	public static final int BATCH_INSERT_SIZE = 2000;
	public static final int BATCH_SELECT_SIZE = 100000;

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+LOCATION_TIME_TABLE+"` (" +
						  "location varchar(128) NOT NULL," +
						  "count INT(11) NULL," +
						  "lat float(10,6) NULL," +
						  "lon float(10,6) NULL," +
						  "day INT(11) not NULL," +
						  "PRIMARY KEY (location,day) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
		
	}
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, LOCATION_TIME_TABLE)) {
			System.out.println("Clearing table: " + LOCATION_TIME_TABLE);
			db.clearTable(conn, LOCATION_TIME_TABLE);
		} else {			
			System.out.println("Creating table: " + LOCATION_TIME_TABLE);
			createTable(db, conn);
		}
		db.close(conn);
		
	}
	
	private static class LocationTimeSeries {
		HashMap<Long,Integer> counts = new HashMap<Long,Integer>();
		float lat;
		float lon;
		public LocationTimeSeries(float lat, float lon) {
			this.lat = lat;
			this.lon = lon;
		}
		
	}
	
	private static void computeLocations(TimeLog tl) {
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		tl.pushTime("Reading location time series data");
		HashMap<String,LocationTimeSeries> locations = getLocationTimeSeries();
		tl.popTime();
		ArrayList<LocationTimeVolumeResult> locationArray = new ArrayList<LocationTimeVolumeResult>();
		tl.pushTime("Geocoding and aggregating");
		try {
			for (Entry<String,LocationTimeSeries> timeseries:locations.entrySet()) {
				String location = timeseries.getKey();
				if (location==null) continue;
				LocationTimeSeries ts = timeseries.getValue();
				ArrayList<TimeVolumeResult> timeArray = new ArrayList<TimeVolumeResult>();
				for (Entry<Long, Integer> e:timeseries.getValue().counts.entrySet()) {
					timeArray.add(new TimeVolumeResult(e.getKey(), e.getValue()));
				}
				Collections.sort(timeArray, new Comparator<TimeVolumeResult>() {
					public int compare(TimeVolumeResult o1, TimeVolumeResult o2) {
						return o1.getDay()>o2.getDay()?1:-1;
					};
				});
				locationArray.add(new LocationTimeVolumeResult(location, ts.lat, ts.lon, timeArray));
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		tl.popTime();
		tl.pushTime("Inserting location time series data");
		insertLocationTimeData(oculusdb, locationArray);
		tl.popTime();		
	}


	
	private static HashMap<String, LocationTimeSeries> getLocationTimeSeries() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		HashMap<String,LocationTimeSeries> result = new HashMap<String,LocationTimeSeries>();
		Statement stmt = null;
		Connection conn = db.open();
		int maxlocationid = DBManager.getInt(conn, "SELECT max(id) FROM " + AdLocations.AD_LOCATIONS_TABLE, "Get max location id");
		int nextid = 0;
		while (nextid<maxlocationid) {
			String sqlStr = "SELECT label,latitude,longitude,posttime from " + AdLocations.AD_LOCATIONS_TABLE +
					" where id>=" + nextid + " and id<=" + (nextid+BATCH_SELECT_SIZE);
			nextid += BATCH_SELECT_SIZE+1;
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				Calendar c = Calendar.getInstance();
				while (rs.next()) {
					Timestamp timestamp = rs.getTimestamp("posttime");
					long time = (timestamp==null)?0:timestamp.getTime();
					String label = rs.getString("label");
					Float lat = rs.getFloat("latitude");
					Float lon = rs.getFloat("longitude");
					LocationTimeSeries locationSeries = result.get(label);
					if (locationSeries==null) {
						locationSeries = new LocationTimeSeries(lat,lon);
						result.put(label, locationSeries);
					}
					c.setTimeInMillis(time);
					c.set(Calendar.HOUR,0);
					c.set(Calendar.MINUTE,0);
					c.set(Calendar.SECOND,0);
					c.set(Calendar.MILLISECOND,0);
					time = c.getTimeInMillis()/1000;
					Integer i = locationSeries.counts.get(time);
					if (i==null) locationSeries.counts.put(time,1);
					else locationSeries.counts.put(time,i+1);
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
		db.close(conn);
		return result;
	}
	

	public static void insertLocationTimeData(MemexOculusDB db, ArrayList<LocationTimeVolumeResult> data) {
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + LOCATION_TIME_TABLE + "(location,lat,lon,day,count) VALUES (?,?,?,?,?)");
			int count = 0;
			for (LocationTimeVolumeResult l:data) {
				for (TimeVolumeResult r:l.getTimeseries()) {
					pstmt.setString(1,l.getLocation());
					pstmt.setFloat(2, l.getLat());
					pstmt.setFloat(3, l.getLon());
					pstmt.setFloat(4, r.getDay());
					pstmt.setInt(5, r.getCount());
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
	
	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Location time aggregation");
		ScriptDBInit.readArgs(args);
		MemexOculusDB oculusdb = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB htdb = MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);

		Connection htconn = htdb.open();
		int maxadid = DBManager.getInt(htconn, "select max(id) from memex_ht.ads", "Get max ads id");
		htdb.close(htconn);

		initTable();
		computeLocations(tl);
		int duration = (int)(tl.popTime()/1000);

		Connection oculusconn = oculusdb.open();
		Progress.updateProgress(oculusdb, oculusconn, "locationtime", maxadid, 0, duration);
		oculusdb.close(oculusconn);

	}

}
