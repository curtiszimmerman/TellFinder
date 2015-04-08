package oculus.memex.geo;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;

import org.json.JSONArray;

import oculus.memex.aggregation.LaborCategory;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

public class AdLaborLocations {
	static final public String AD_LOCATIONS_TABLE = "ads_labor_locations";
	static final public String LABOR_CATEGORY_TABLE = "labor_category_location";
	public static final int BATCH_SELECT_SIZE = 50000;
	public static final int BATCH_INSERT_SIZE = 2000;
	
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `" + AD_LOCATIONS_TABLE + "` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "latitude float DEFAULT NULL," +
						  "longitude float DEFAULT NULL," +
						  "label VARCHAR(128)," +
						  "posttime DATETIME," +
						  "PRIMARY KEY (id)," + 
						  "KEY ads_idx (ads_id)," + 
						  "KEY label_idx (label) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable(MemexOculusDB db, Connection conn) {
		if (db.tableExists(conn, AD_LOCATIONS_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + AD_LOCATIONS_TABLE);
				db.clearTable(conn, AD_LOCATIONS_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + AD_LOCATIONS_TABLE);
			createTable(db, conn);
		}
	}
	
	public static void createLaborCategoryTable(Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `" + LABOR_CATEGORY_TABLE + "` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "location_id INT(11) NOT NULL," +
						  "category_id INT(11) NOT NULL," +
						  "count INT(11) NOT NULL," +
						  "PRIMARY KEY (id)," + 
						  "KEY location_idx (location_id)," +
						  "KEY category_idx (category_id) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	/**
	 * For each ad in memex_ht.ads, look up the location and write to memex_oculus.ads_locations
	 */
	public static int getLocations(Connection htconn, Connection oculusconn) {
		TimeLog log = new TimeLog();
		log.pushTime("get labor locations");
		int maxadid = MemexHTDB.getInt(htconn, "SELECT max(id) FROM backpage_incoming", "Get max ad id");
		int maxlocid = MemexOculusDB.getInt(oculusconn, "SELECT max(ads_id) FROM " + AD_LOCATIONS_TABLE , "Get max ads_labor_locations ads_id");
		
		long start = System.currentTimeMillis();
		int nextid = maxlocid+1;
		int adcount = 0;
		int outcount = 0;
		
		HashMap<String, HashSet<Integer>> categories = new HashMap<String, HashSet<Integer>>();
		while (nextid<maxadid) {
			HashMap<Integer,LocationData> result = new HashMap<Integer,LocationData>();
			String sqlStr = "SELECT id,url,timestamp FROM backpage_incoming where id>=" + nextid + " and id<=" + (nextid+BATCH_SELECT_SIZE);
			nextid += BATCH_SELECT_SIZE+1;
			Statement stmt = null;
			try {
				stmt = htconn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					adcount++;
					Integer id = rs.getInt("id");
					String url = rs.getString("url");
					Timestamp posttime = rs.getTimestamp("timestamp");
					extractLocationData(oculusconn, id, url, posttime==null?0:posttime.getTime(), result, categories);
					if (id>maxadid) maxadid=id;
				}
				long end = System.currentTimeMillis();
				System.out.println("Processed " + adcount + " in " + (end-start) + "ms");
			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				try {
					if (stmt != null) { stmt.close(); }
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
			outcount += result.size();
			insertAdLocations(oculusconn, result);
			long end = System.currentTimeMillis();
			System.out.println("Wrote " + result.size() + " of " + outcount + " in " + (end-start) + "ms");
		}
		log.popTime();
		log.pushTime("Write locations");
		Locations.writeLocations(oculusconn);
		log.popTime();
		log.pushTime("add labor ids by category");
		LaborCategory.addIdsByCategory(oculusconn, categories);
		log.popTime();
		return maxadid;
	}
	
	static HashSet<String> notfoundcities = new HashSet<String>();
	private static void extractLocationData(Connection oculusconn, Integer id, String url, Long posttime, HashMap<Integer, 
														LocationData> result, HashMap<String, HashSet<Integer>> categories) {
		LocationData ld = null;		
		String[] urlArr = url.substring(7).split("\\.");
		String region = urlArr[0];
		String category= urlArr[2].split("/")[1];
		HashSet<Integer> idsByCategory = categories.get(category);		
		if(idsByCategory == null) {
			idsByCategory = new HashSet<Integer>();
			categories.put(category, idsByCategory);
		}
		idsByCategory.add(id);
		String city = region;
		ld = Locations.getByRegion(oculusconn, region, region);
		// SUCCESS
		if (ld!=null) {
			ld.time = posttime;
			result.put(id, ld);
			return;
		}
		// FAILURE FALLBACK. Check city and region and add to list of unknown cities
		if (city!=null) {
			if (!notfoundcities.contains(city)) {
				String cityid = city.trim().toLowerCase();
				ld = Locations.getByRegion(oculusconn, cityid, cityid);
				if (ld==null) {
					notfoundcities.add(city);
					System.out.println("Could not geocode city: " + id + "," + region + "," + city + ", from url " + url);
				} else {
					ld.time = posttime;
					result.put(id, ld);
					return;
				}
			}
		}
		if (region!=null) {
			if (!notfoundcities.contains(region) ) {
				String cityid = region.trim().toLowerCase();
				ld = Locations.getByRegion(oculusconn, cityid, cityid);
				if (ld==null) {
					notfoundcities.add(region);
					System.out.println("Could not geocode city: " + id + "," + region + "," + city + ", from url " + url);
				} else {
					ld.time = posttime;
					result.put(id, ld);
					return;
				}
			}
		}
		if (region!=null||city!=null) {
			String concatName = region+city;
			if (!notfoundcities.contains(region+city) ) {
				notfoundcities.add(concatName);
				System.out.println("Could not geocode city: " + id + "," + region + "," + city + ", from url " + url);
			}
		}
	}

	public static void insertAdLocations(Connection conn, HashMap<Integer, LocationData> resultMap) {
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + AD_LOCATIONS_TABLE + 
					"(ads_id, latitude, longitude, label, posttime) VALUES (?,?,?,?,?)");
			int count = 0;
			for (Entry<Integer,LocationData> e:resultMap.entrySet()) {
				Integer adId = e.getKey();
				LocationData ld = e.getValue();
				if (ld.label.length()>128) continue;
				pstmt.setInt(1, adId);
				pstmt.setFloat(2, ld.lat);
				pstmt.setFloat(3, ld.lon);
				pstmt.setString(4, ld.label);
				pstmt.setTimestamp(5, new Timestamp(ld.time));
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
	}

	private static void extractLocations() {
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		initTable(oculusdb, oculusconn);
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		getLocations(htconn, oculusconn);
		oculusdb.close(oculusconn);
		htdb.close(htconn);
	}

	public static void adLocationLaborCategory() {
		TimeLog log = new TimeLog();
		log.pushTime("ad data by location and category");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		int maxid = MemexOculusDB.getInt(conn, "SELECT max(id) FROM " + AD_LOCATIONS_TABLE , "Get max ads_labor_locations id");		
		int nextid = 1;

		//location label --> location_id
		HashMap<String,Integer> locationIdByLabel = Locations.getLocationIdsByLabel(conn);
		//ad_id --> category_id
		HashMap<Integer,Integer> adCategoryMap = LaborCategory.getAdsByCategory(conn);
		//location --> category_id --> ad_count
		HashMap<Integer,HashMap<Integer,Integer>> result = new HashMap<Integer,HashMap<Integer,Integer>>();
		
		while (nextid<maxid) {
			try {
				Statement stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery("SELECT ads_id, label FROM " + AD_LOCATIONS_TABLE + " WHERE id>=" + nextid + " AND id<" + (nextid+BATCH_SELECT_SIZE));
				nextid+=BATCH_SELECT_SIZE;
				while(rs.next()) {
					Integer location_id = locationIdByLabel.get(rs.getString("label"));
					HashMap<Integer,Integer> categoryMap = result.get(location_id);
					if(categoryMap==null) {
						categoryMap = new HashMap<Integer,Integer>();
						result.put(location_id,categoryMap);
					}
					Integer category_id = adCategoryMap.get(rs.getInt("ads_id"));
					Integer count = categoryMap.get(category_id);
					if(count==null) {
						categoryMap.put(category_id, 1);
					} else {
						categoryMap.put(category_id, count+1);
					}
				}
			} catch (SQLException e) {
				e.printStackTrace();
			}
		}
		
		log.pushTime("write ad category data");
		if(!db.tableExists(conn, LABOR_CATEGORY_TABLE)) {
			createLaborCategoryTable(conn);
		}
		writeAdCategoryData(result, conn);
		log.popTime();
		db.close(conn);
		log.popTime();
	}

	private static void writeAdCategoryData(HashMap<Integer, HashMap<Integer, Integer>> result, Connection conn) {
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + LABOR_CATEGORY_TABLE + 
					"(location_id, category_id, count) VALUES (?,?,?)");
			int count = 0;
			for (Integer location_id:result.keySet()) {
				HashMap<Integer,Integer> categoryMap = result.get(location_id);
				for(Integer category_id:categoryMap.keySet()) {
					pstmt.setInt(1, location_id);
					pstmt.setInt(2, category_id);
					pstmt.setInt(3, categoryMap.get(category_id));
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
	}

	public static JSONArray getAdIdsByLocationAndCategory(String location_label, String category_id) {
		TimeLog log = new TimeLog();
		log.pushTime("Get ad_ids at location: " + location_label + ", and category: " + category_id);
		JSONArray result = new JSONArray();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashSet<Integer> adsByLocation = new HashSet<Integer>();
		try {
			Statement stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT ads_id FROM " + AD_LOCATIONS_TABLE + " WHERE label='" + location_label + "'");
			while(rs.next()) {
				adsByLocation.add(rs.getInt("ads_id"));
			}
			
		} catch (SQLException e) {
			e.printStackTrace();
		}
		try {
			Statement stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT a.ads_id, posttime FROM " + LaborCategory.LABOR_ADS_CATEGORY_TABLE + 
					" a INNER JOIN " + AD_LOCATIONS_TABLE + " b ON a.ads_id=b.ads_id WHERE category=" + category_id + 
					" AND a.ads_id IN " + StringUtil.hashSetToSqlList(adsByLocation) + " ORDER BY posttime DESC");
			while(rs.next()) {
				HashMap<String,Long> ad = new HashMap<String,Long>();
				ad.put("id", rs.getLong("ads_id"));
				ad.put("posttime", rs.getTimestamp("posttime").getTime());
				result.put(ad);
			}				
		} catch (SQLException e) {
			e.printStackTrace();
		}		
		db.close(conn);
		log.popTime();
		return result;
	}
	
	public static void main(String[] args) {		
		TimeLog tl = new TimeLog();
		tl.pushTime("Ad location calculation");

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance("roxy_scrape", "mysql", "localhost", "3306", "root", "admin");
		
		extractLocations();
		adLocationLaborCategory();
		tl.popTime();
	}
}