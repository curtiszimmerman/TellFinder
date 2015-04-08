package oculus.memex.geo;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;

import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.Pair;

public class Geocoder {
	private static String CITIES_TABLE_NAME = "world_cities";
	private static String STATES_TABLE_NAME = "states_provinces";
	
	private static String STATES_NAME_COLUMN = "name";
	private static String CITIES_NAME_COLUMN = "city";
	private static String CITIES_ALPHA_NAME_COLUMN = "cityalpha";
	
	public static ArrayList<Pair<Float,Float>> geocodeAlphaOnly(MemexOculusDB db, Connection localConn, ArrayList<String> locations) {
		return geocode(db, localConn, locations, true);
	}
	
	public static Pair<Float,Float> geocode(MemexOculusDB db, Connection localConn, String location) {
		return geocode(db, localConn, location, true);
	}
	
	public static ArrayList<Pair<Float,Float>> geocode(MemexOculusDB db, Connection localConn, ArrayList<String> locations) {
		return geocode(db, localConn, locations, false);
	}
	
	public static boolean isProvinceOrState(MemexOculusDB db, Connection localConn, String location) {
		if (!db.tableExists(localConn, STATES_TABLE_NAME)) {
			return false;
		}
		
		String locStr = location.replaceAll(" ", "");
		String sqlStr = "SELECT * FROM "+STATES_TABLE_NAME+" WHERE namealpha like ?";
		PreparedStatement pstmt = null;
		try {
			pstmt = localConn.prepareStatement(sqlStr);
			pstmt.setString(1, locStr);
			ResultSet rs = pstmt.executeQuery();
			if (rs.next()) {
				return true;
			} else {
				return false;
			}
		} catch (Exception e) {
			System.out.println("Failed state select: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (Exception e) {
				System.out.println("Failed to find state: " + location);
				e.printStackTrace();
			}
		}
		return false;
		
	}

	private static Pair<Float,Float> geocode(MemexOculusDB db, Connection localConn, String location, boolean alphaOnly) {
		if (location==null) return null;
		String[] places = location.split(",");
		
		// Look at names in order trying to geocode cities, then states
		for (int i=0; i<places.length; i++) {
			String place = places[i];
			place = place.trim();
			if ((places.length-i>2) || (!isProvinceOrState(db, localConn, place))) {
				Pair<Float,Float> latlon = null;
				if ((places.length-i)>1) {
					String state = places[i+1].trim();
					latlon = geocodeCity(localConn, place, state, alphaOnly);
				} else {
					latlon = geocodeCity(localConn, place, alphaOnly);
				}
				if (latlon != null && latlon.getFirst() != null && latlon.getSecond() != null) {
					return latlon;
				}
			} else {
				return geocodeState(db, localConn, places[i].trim(), alphaOnly);
			}
		}
		
		return null;
	}
	
	private static Pair<Float,Float> geocodeState(MemexOculusDB db, Connection localConn, String location, boolean alphaOnly) {
		if (db.tableExists(localConn, STATES_TABLE_NAME)) {
			return geocode(localConn, location, STATES_TABLE_NAME, alphaOnly ? STATES_NAME_COLUMN + "alpha" : STATES_NAME_COLUMN);
		} else {
			return null;
		}
	}
	
	private static Pair<Float,Float> geocodeCity(Connection oculusconn, String location, boolean alphaOnly) {
		return geocode(oculusconn, location, CITIES_TABLE_NAME, alphaOnly ? CITIES_ALPHA_NAME_COLUMN:CITIES_NAME_COLUMN);
	}
	
	private static Pair<Float,Float> geocodeCity(Connection oculusconn, String location, String state, boolean alphaOnly) {
		return geocodeCityState(oculusconn, location, state);
	}
	
	private static Pair<Float,Float> geocode(Connection oculusconn, String location, String tableName, String columnName) {
		PreparedStatement pstmt = null;
		ResultSet rs = null;
		String sqlStr = null;
		try {
			if (tableName.equals(CITIES_TABLE_NAME)) {
				sqlStr = "SELECT lat,lon FROM "+tableName+" WHERE " + columnName + " like ? ORDER BY population DESC LIMIT 0,1";
			} else if (tableName.equals(STATES_TABLE_NAME)) {
				sqlStr = "SELECT lat,lon FROM "+tableName+" WHERE " + columnName + " like ?";
			}
			pstmt = oculusconn.prepareStatement(sqlStr);
			String locStr = location.replaceAll(" ", "");
			pstmt.setString(1, locStr);
			if (sqlStr!=null) {
				rs = pstmt.executeQuery();
			}
			if (rs != null && rs.next()) {
				float lat = rs.getFloat(1);
				float lon = rs.getFloat(2);
				return new Pair<Float,Float>(lat,lon);
			}
		} catch (Exception e) {
			System.out.println("Failed geocode SQL: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		return null;
	}
	
	private static Pair<Float,Float> geocodeCityState(Connection oculusconn, String city, String state) {
		Pair<Float,Float> result = null;
		PreparedStatement pstmt = null;
		ResultSet rs = null;
		String sqlStr = null;
		try {
			sqlStr = "SELECT lat,lon,region FROM "+CITIES_TABLE_NAME+" WHERE " + CITIES_ALPHA_NAME_COLUMN + " like ? ORDER BY population DESC";
			String locStr = city.replaceAll(" ", "");
			pstmt = oculusconn.prepareStatement(sqlStr);
			pstmt.setString(1, locStr);
			rs = pstmt.executeQuery();
			if (rs != null) {
				float firstLat = -999;
				float firstLon = 0;
				while (rs.next()) {
					float lat = rs.getFloat(1);
					float lon = rs.getFloat(2);
					if (firstLat==-999) {
						firstLat = lat;
						firstLon = lon;
					}
					String region = rs.getString("region");
					if (region.compareToIgnoreCase(state)==0) {
						result = new Pair<Float,Float>(lat,lon);
						break;
					}
				}
				if (result==null) result = new Pair<Float,Float>(firstLat,firstLon);
			}
		} catch (Exception e) {
			System.out.println("Failed geocode SQL: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		return null;
	}

	public static ArrayList<Pair<Float,Float>> geocode(MemexOculusDB db, Connection localConn, ArrayList<String> locations, boolean alphaOnly) {
		ArrayList<Pair<Float,Float>> result = new ArrayList<Pair<Float,Float>>();
		for (String location : locations) {
			result.add(geocode(db, localConn, location));
		}
		return result;
	}

	public static void main(String[] args) {
		ScriptDBInit.readArgs(args);
		MemexOculusDB db = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		Connection localConn = db.open();
//		Pair<Float,Float> location = Geocoder.geocodeCity(db, localConn, "toronto", true);
//		Pair<Float,Float> location = Geocoder.geocode(db, localConn, "Washington, USA");
//		addValues(db, localConn);
		Pair<Float,Float> location = Geocoder.geocode(db, localConn, "Twin Cities, MN, USA");
		System.out.println(location.getFirst() + "," + location.getSecond());
		db.close(localConn);
	}

	public static String getLocationCode(String region, String city, String state, String country) {
		String result = city;
		if (result==null) {
			if (region!=null) result = region;
			else result = ((state!=null)?state:"")+","+((country!=null)?country:"");
		}
		if (result.length()>45) {
			System.out.println("Too long: " + result.length() + ":" + result + ":" + region + "," + city + "," + state + "," + country);
			result = result.substring(result.length()-44);
		}
		return result;
	}
	
}
