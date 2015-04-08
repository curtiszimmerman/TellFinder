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

import oculus.memex.clustering.MemexAd;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.util.TimeLog;

/**
 * Extract locations from ads.
 */
public class AdLocations {	
	static final public String AD_LOCATIONS_TABLE = "ads_locations";
	public static final int BATCH_SELECT_SIZE = 50000;
	public static final int BATCH_INSERT_SIZE = 2000;

	
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+AD_LOCATIONS_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "latitude float DEFAULT NULL," +
						  "longitude float DEFAULT NULL," +
						  "label VARCHAR(128)," +
						  "posttime DATETIME," +
						  "PRIMARY KEY (id)," + 
						  "KEY ads_idx (ads_id) )";
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
	
	/**
	 * For each ad in memex_ht.ads, look up the location and write to memex_oculus.ads_locations
	 */
	public static int getLocations(Connection htconn, Connection oculusconn) {
		int maxadid = MemexHTDB.getInt(htconn, "SELECT max(id) FROM ads", "Get max ad id");
		int maxlocid = MemexOculusDB.getInt(oculusconn, "SELECT max(ads_id) FROM ads_locations", "Get max ads_locations ads_id");
		
		long start = System.currentTimeMillis();
		int nextid = maxlocid+1;
		int adcount = 0;
		int outcount = 0;
		while (nextid<maxadid) {
			HashMap<Integer,LocationData> result = new HashMap<Integer,LocationData>();
			String sqlStr = "SELECT id,url,sources_id,region,city,state,country,posttime FROM ads where id>=" + nextid + " and id<=" + (nextid+BATCH_SELECT_SIZE);
			nextid += BATCH_SELECT_SIZE+1;
			Statement stmt = null;
			try {
				stmt = htconn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					adcount++;
					Integer id = rs.getInt("id");
					Integer source = rs.getInt("sources_id");
					String url = rs.getString("url");
					String region = rs.getString("region");
					String city = rs.getString("city");
					String state = rs.getString("state");
					String country = rs.getString("country");
					Timestamp posttime = rs.getTimestamp("posttime");
					extractLocationData(oculusconn, id, source, url, region, city, state, country, posttime==null?0:posttime.getTime(), result);
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
		Locations.writeLocations(oculusconn);
		return maxadid;
	}
	
	static HashSet<String> notfoundcities = new HashSet<String>();
	private static void extractLocationData(Connection oculusconn, Integer id, Integer source, String url, String region, String city, String state, String country, Long posttime, HashMap<Integer, LocationData> result) {
		LocationData ld = null;
		if (source==1) { // backpage
			if (region!=null) {
				ld = Locations.getByRegion(oculusconn, region, region);
			}
		} else if (source==2||source==3) { // craigslist | classivox
			if (url!=null) {
				int startIdx = url.indexOf("//");
				if (startIdx<=0) return;
				startIdx += 2;
				int endIdx = url.indexOf(".", startIdx);
				if (endIdx<=0) return;
				String cityid = url.substring(startIdx, endIdx);
				String loc = Locations.getCraigslistLocations().get(cityid);
				if (loc==null) loc = cityid;
				ld = Locations.getByRegion(oculusconn, cityid, loc);
				if (ld==null) {
					cityid.replaceAll("-", "");
					ld = Locations.getByRegion(oculusconn, cityid, loc);
				}
			}
			if (ld==null && city!=null) {
				String cityid = city.trim().toLowerCase();
				ld = Locations.getByRegion(oculusconn, cityid, cityid);
			}
		} else if (source==4||source==5||source==7) { // My provider guide || naughty reviews || cityvibe
			if (ld==null && city!=null) {
				String cityid = city.trim().toLowerCase();
				ld = Locations.getByRegion(oculusconn, cityid, cityid);
				if (ld==null) {
					cityid.replaceAll("-", "");
					ld = Locations.getByRegion(oculusconn, cityid, cityid);
				}
			}
		} else if (source==6) { // myredbook, look at incall/outcall
		} else if (source==8) { // Massage troll
			if (ld==null && city!=null) {
				String cityid = city.trim().toLowerCase();
				ld = Locations.getByRegion(oculusconn, cityid, cityid);
			}
		}
			// Not found. 
			if (ld==null && city!=null) {
			}
			if (region!=null) {
				String regionid = region.trim().toLowerCase();
				ld = Locations.getByRegion(oculusconn, regionid, regionid);
			}

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
					System.out.println("Could not geocode city: " + id + "," + source + "," + region + "," + city + "," + state + "," + country);
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
					System.out.println("Could not geocode region: " + id + "," + source + "," + region + "," + city + "," + state + "," + country);
				} else {
					ld.time = posttime;
					result.put(id, ld);
					return;
				}
			}
		}
		if (region!=null||city!=null||state!=null||country!=null) {
			String concatName = region+city+state+country;
			if (!notfoundcities.contains(region+city+state+country) ) {
				notfoundcities.add(concatName);
				System.out.println("Could not geocode: " + id + "," + source + "," + region + "," + city + "," + state + "," + country);
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
		long fullstart = System.currentTimeMillis();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		initTable(oculusdb, oculusconn);
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		int maxadid = getLocations(htconn, oculusconn);
		long fullend = System.currentTimeMillis();
		int duration = (int)((fullend-fullstart)/1000);
		Progress.updateProgress(oculusdb, oculusconn, "ads_locations", maxadid, 0, duration);
		oculusdb.close(oculusconn);
		htdb.close(htconn);
	}

	public static class AdLocationSet {
		HashMap<Integer, Integer> adToLocationHash = new HashMap<Integer,Integer>();
		HashMap<Integer,String> hashToLocation = new HashMap<Integer,String>();
		public void setLocation(Integer ad, String location) {
			Integer hash = location.hashCode();
			String distinctLocation = hashToLocation.get(hash);
			if (distinctLocation==null) {
				hashToLocation.put(hash, location);
			}
			adToLocationHash.put(ad, hash);
		}
		public String getLocation(Integer ad) {
			Integer hash = adToLocationHash.get(ad);
			return hashToLocation.get(hash);
		}
	}
	
	public static void getAdLocations(Connection oculusconn, AdLocationSet result, int startAdId, int endAdId) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT ads_id,label FROM " + AdLocations.AD_LOCATIONS_TABLE + " where ads_id>=" + startAdId + " and ads_id<=" + endAdId;
		stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				String location = rs.getString("label");
				result.setLocation(adid, location);
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
	
	public static void getAdLocations(Connection oculusconn, AdLocationSet result, String adsStr) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT ads_id,label FROM " + AdLocations.AD_LOCATIONS_TABLE + " where ads_id IN " + adsStr;
		stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				String location = rs.getString("label");
				result.setLocation(adid, location);
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

	public static void getAdLocations(MemexOculusDB db, Connection conn, AdLocationSet adLocations, HashSet<Integer> ads) {
		int count = 0;
		boolean isFirst = true;
		StringBuffer adstr = new StringBuffer();
		adstr.append("(");
		for (Integer adid:ads) {
			if (isFirst) isFirst = false;
			else adstr.append(",");
			adstr.append(adid);
			count++;
			if (count%BATCH_SELECT_SIZE==0) {
				adstr.append(")");
				getAdLocations(conn, adLocations, adstr.toString());
				count = 0;
				isFirst = true;
				adstr = new StringBuffer();
				adstr.append("(");
			}
		}
		if (count>0) {
			adstr.append(")");
			getAdLocations(conn, adLocations, adstr.toString());
		}
	}
	
	
	public static AdLocationSet getAdLocations() {
		int maxadid = MemexAd.getMaxID();
		AdLocationSet result = new AdLocationSet();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection oculusconn = db.open();
		long start = System.currentTimeMillis();
		for (int adid=0; adid<maxadid; adid+=BATCH_SELECT_SIZE) {
			if (adid%1000000==0) System.out.println("Processing ad location: " + adid + " time: " + (System.currentTimeMillis()-start));
			getAdLocations(oculusconn, result, adid, adid+BATCH_SELECT_SIZE-1);
		}
		db.close(oculusconn);
		return result;
	}

	public static void main(String[] args) {
		
		TimeLog tl = new TimeLog();
		tl.pushTime("Ad location calculation");

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		extractLocations();

		tl.popTime();
	}

}
