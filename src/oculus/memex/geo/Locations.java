package oculus.memex.geo;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.Charset;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.CsvParser;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class Locations {
	private static String LOCATIONS_TABLE = "locations";
	private static HashMap<String,LocationData> locationCache = null;
	private static HashSet<String> locationsToWrite = new HashSet<String>();
	private static HashSet<String> failedGeocoding = new HashSet<String>();
	private static HashMap<String,String> craigslistLocations = null;
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
			"CREATE TABLE " + LOCATIONS_TABLE + " (" +
			  "id int(11) NOT NULL AUTO_INCREMENT," +
			  "region varchar(128) DEFAULT NULL," +
			  "city varchar(128) DEFAULT NULL," +
			  "state varchar(64) DEFAULT NULL," +
			  "country varchar(64) DEFAULT NULL," +
			  "address varchar(128) DEFAULT NULL," +
			  "latitude float DEFAULT NULL," +
			  "longitude float DEFAULT NULL," +
			  "label text," +
			  "PRIMARY KEY (id) )";
			
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (!db.tableExists(conn, LOCATIONS_TABLE)) {
			System.out.println("Creating table: " + LOCATIONS_TABLE);
			createTable(db, conn);
		}
		db.close(conn);
	}

	public static void populateLocationCache(Connection oculusconn) {
		locationCache = new HashMap<String,LocationData>();
		String sqlStr = "select region,longitude,latitude,label from " + LOCATIONS_TABLE;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String region = rs.getString("region");
				Float latitude = rs.getFloat("latitude");
				Float longitude = rs.getFloat("longitude");
				String label = rs.getString("label");
				locationCache.put(region, new LocationData(label,latitude,longitude,0));
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
	
	private static String readAll(Reader rd) throws IOException {
		StringBuilder sb = new StringBuilder();
		int cp;
		while ((cp = rd.read()) != -1) {
		  sb.append((char) cp);
		}
		return sb.toString();
	}

	public static JSONObject readJsonFromUrl(String url) throws IOException, JSONException {
		JSONObject json = null;
		InputStream is = new URL(url).openStream();
		try {
			BufferedReader rd = new BufferedReader(new InputStreamReader(is, Charset.forName("UTF-8")));
			String jsonText = readAll(rd);
			json = new JSONObject(jsonText);
		} finally {
			is.close();
		}
		return json;
	}	
	
	public static HashMap<String,String> getCraigslistLocations()  {
		if (craigslistLocations!=null) return craigslistLocations;
		craigslistLocations = new HashMap<String,String>();
		try {
			InputStream is = new URL("http://www.craigslist.org/about/sites").openStream();
			BufferedReader rd = new BufferedReader(new InputStreamReader(is, Charset.forName("UTF-8")));
			String html = readAll(rd);
			is.close();
			Pattern p = Pattern.compile("<li><a href=\"http://(.*)\\.craigslist\\.org\\\">(.*)</a></li>");
			Matcher  matcher = p.matcher(html);
			while (matcher.find()) {
				String urlpart = matcher.group(1);
				String label = matcher.group(2);
				craigslistLocations.put(urlpart, label);
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		return craigslistLocations;
	}
	
	public static LocationData getByRegion(Connection oculusconn, String lookupName, String regionName) {
		if (locationCache==null) {
			populateLocationCache(oculusconn);
		}
		LocationData result = locationCache.get(lookupName);
		if (result==null) {
			if (failedGeocoding.contains(lookupName)) return null;
			result = googleGeocode(lookupName, regionName);
			if (result==null) {
				failedGeocoding.add(lookupName);
			}
		}
		return result;
	}

	public static boolean googleFailed = false;
	public static LocationData googleGeocode(String lookupName, String regionName) {
		if (googleFailed) return null;
		try {
			String regionEnc = URLEncoder.encode(regionName,"utf8");
			String url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + regionEnc + "&key=AIzaSyA6o3BjlgVACuT_-ONSIJJm56BvK27axSM";
			JSONObject loc = readJsonFromUrl(url);
			if (loc==null) {
				System.out.println("No response geocoding: " + regionName);
				return null;
			}
			JSONArray results = loc.getJSONArray("results");
			if (results==null || results.length()==0) {
				System.out.println("No results geocoding: " + regionName);
				googleFailed = true;
				return null;
			}
			JSONObject firstResult = results.getJSONObject(0);
			String locStr = firstResult.getString("formatted_address");
			JSONObject geometry = firstResult.getJSONObject("geometry");
			JSONObject location = geometry.getJSONObject("location");
			double lat = location.getDouble("lat");
			double lon = location.getDouble("lng");
			LocationData result = new LocationData(locStr, (float)lat, (float)lon, 0);
			locationCache.put(lookupName, result);
			locationsToWrite.add(lookupName);
			return result;
		} catch (Exception e) {
			e.printStackTrace();
		}
		return null;
	}

	public static void writeLocations(Connection oculusconn) {
//		private static HashMap<String,LocationData> locationCache = null;
//		private static HashSet<String> locationsToWrite = new HashSet<String>();
		if (locationsToWrite.size()==0) return;
		PreparedStatement pstmt = null;
		try {
			oculusconn.setAutoCommit(false);
			pstmt = oculusconn.prepareStatement("INSERT INTO " + LOCATIONS_TABLE + 
					"(region,longitude,latitude,label) VALUES (?,?,?,?)");
			for (String location:locationsToWrite){
				LocationData ld = locationCache.get(location);
				pstmt.setString(1, location);
				pstmt.setFloat(2, ld.lon);
				pstmt.setFloat(3, ld.lat);
				String label = ld.label;
				label = label.replaceAll("\"", "");
				pstmt.setString(4, label);
				pstmt.addBatch();
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			try {
				oculusconn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
	}
	
	public static LocationData getByRegionUncached(Connection oculusconn, String region) {
		String sqlStr = "select longitude,latitude,label from " + LOCATIONS_TABLE + " where region='" + region + "'";
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Float latitude = rs.getFloat("latitude");
				Float longitude = rs.getFloat("longitude");
				String label = rs.getString("label");
				return new LocationData(label,latitude,longitude, 0);
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
		return null;
	}
	
	private static void readCSV(String filename) {
		BufferedReader br = null;
		PreparedStatement pstmt = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			br = new BufferedReader(new FileReader(filename));
			String line;
			boolean isFirst = true;

			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + LOCATIONS_TABLE + 
					"(region,longitude,latitude,label) VALUES (?,?,?,?)");
			while ((line = br.readLine()) != null) {
				if (isFirst) {
					isFirst = false;
					continue;
				}
				List<String> cols = CsvParser.fsmParse(line);
				pstmt.setString(1, cols.get(0));
				pstmt.setFloat(2, Float.parseFloat(cols.get(2)));
				pstmt.setFloat(3, Float.parseFloat(cols.get(3)));
				String label = cols.get(4);
				label = label.replaceAll("\"", "");
				pstmt.setString(4, label);
				pstmt.addBatch();
			}
			pstmt.executeBatch();
			br.close();
		} catch (FileNotFoundException e) {
			System.out.println("File: " + filename + " not found.");
		} catch (IOException e) {
			e.printStackTrace();
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
		DateFormat dateFormat = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
		Calendar cal = Calendar.getInstance();
		System.out.println(dateFormat.format(cal.getTime()));

		System.out.println("Begin location calculation...");
		long start = System.currentTimeMillis();

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		initTable();
		readCSV("data/locations.csv");

		long end = System.currentTimeMillis();
		System.out.println("Done location calculation in: " + (end-start) + "ms");

	}

	public static HashMap<String, Integer> getLocationIdsByLabel(Connection conn) {
		HashMap<String, Integer> locationMap = new HashMap<String, Integer>();
		Statement stmt;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT id,label FROM " + LOCATIONS_TABLE);
			while(rs.next()) {
				locationMap.put(rs.getString("label"),rs.getInt("id"));
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return locationMap;
	}

	public static HashSet<Integer> getLocationIdByLabel(String location, Connection conn) {
		HashSet<Integer> location_ids = new HashSet<Integer>();		
		try {
			Statement stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT id FROM " + LOCATIONS_TABLE + " WHERE label = '" + location + "'");
			while(rs.next()) {
				location_ids.add(rs.getInt("id"));			
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}		
		return location_ids;
	}
}
