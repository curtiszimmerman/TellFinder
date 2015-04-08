package oculus.memex.test;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;

import oculus.memex.aggregation.LocationTimeAggregation;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.rest.OverviewResource;
import oculus.memex.util.TimeLog;
import oculus.xdataht.model.LocationTimeVolumeResult;
import oculus.xdataht.model.LocationTimeVolumeResults;
import oculus.xdataht.model.TimeVolumeResult;

public class ImpalaTest {

	private static void mapTest(TimeLog tl, Connection conn) {
		tl.pushTime("Map test");
		Statement stmt = null;
		ArrayList<LocationTimeVolumeResult> a = new ArrayList<LocationTimeVolumeResult>();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + LocationTimeAggregation.LOCATION_TIME_TABLE);  
			String currentLocation = "unset";
			LocationTimeVolumeResult currentResult = null;
			ArrayList<TimeVolumeResult> currentTimeSeries = null;
			while (rs.next()) {
				String location = rs.getString("location");
				Float lat = rs.getFloat("lat");
				Float lon = rs.getFloat("lon");
				if (!currentLocation.equals(location)) {
					currentTimeSeries = new ArrayList<TimeVolumeResult>();
					currentResult = new LocationTimeVolumeResult(location, lat, lon, currentTimeSeries);
					currentLocation = location;
					a.add(currentResult);
				}
				currentTimeSeries.add(new TimeVolumeResult(rs.getLong("day")*1000, rs.getInt("count")));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		tl.popTime();
	}
	
	@SuppressWarnings("unused")
	private static void locationTest(TimeLog tl, Connection conn) {
		tl.pushTime("Location test");
		Statement stmt = null;
		ArrayList<LocationTimeVolumeResult> a = new ArrayList<LocationTimeVolumeResult>();
		try {
			String sqlStr = "SELECT clusters_location.clusterid as id,matches,adcount,phonelist,emaillist,weblist,namelist,ethnicitylist,timeseries,locationlist,sourcelist,keywordlist,clustername as name,latestad FROM clusters_location INNER JOIN clusters_details ON clusters_location.clusterid=clusters_details.clusterid WHERE `location`='Salt Lake City, UT, USA' ORDER BY adcount DESC";
//			String sqlStr = "SELECT clusters_location.clusterid as id FROM clusters_location WHERE `location`='Salt Lake City, UT, USA'";
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);  
			int count = 0;
			while (rs.next()) {
				count++;
				String clusterid = rs.getString("id");
//				int adcount = rs.getInt("adcount");
//				String phonelist = rs.getString("phonelist");
//				String emaillist = rs.getString("emaillist");
//				String weblist = rs.getString("weblist");
//				String namelist = rs.getString("namelist");
//				String ethnicitylist = rs.getString("ethnicitylist");
//				String timeseries = rs.getString("timeseries");
//				String locationlist = rs.getString("locationlist");
//				String sourcelist = rs.getString("sourcelist");
//				String keywordlist = rs.getString("keywordlist");
//				String clustername = rs.getString("name");
//				String latestad = rs.getString("latestad");
//				if (phonelist==null) phonelist = "";
//				if (emaillist==null) emaillist = "";
//				if (weblist==null) weblist = "";
//				if (namelist==null) namelist = "";
//				if (ethnicitylist==null) ethnicitylist = "";
//				if (timeseries==null) timeseries = "";
//				if (locationlist==null) locationlist = "";
//				if (sourcelist==null) sourcelist = "";
//				if (keywordlist==null) keywordlist = "";
//				if (clustername==null) clustername = "";
//				if (latestad==null) latestad = "";
//				if (latestad.length()>10)
//					latestad=latestad.substring(0,10);
			}
			System.out.println("SQL: " + sqlStr);
			System.out.println("Count: " + count);
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		tl.popTime();
	}
	
	public static void main(String[] args) {
		// Parse database.properties file
		String [] db_prop = {args[0]};
		ScriptDBInit.readArgs(db_prop);

		MemexOculusDB db = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		Connection conn = db.open();
		int id = DBManager.getInt(conn, "select max(ads_id) from ads_phones", "Get max ads_phone ads_id");
		System.out.println(id);
		
		TimeLog tl = new TimeLog();
		mapTest(tl, conn);
		locationTest(tl, conn);
		
		db.close(conn);

		OverviewResource or = new OverviewResource();
		LocationTimeVolumeResults lt = or.getLocationTimes("escort", null, null);
		System.out.println(lt.getResults().size());
	}
}