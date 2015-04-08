package oculus.memex.clustering;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import oculus.memex.aggregation.AttributeLocation;
import oculus.memex.concepts.AdKeywords;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.extraction.AdExtraction;
import oculus.memex.geo.AdLocations;
import oculus.memex.geo.AdLocations.AdLocationSet;
import oculus.memex.graph.AttributeLinks;
import oculus.memex.util.HashCount;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

/**
 * Create a table of (attribute,value)->details (phone,email,location,source,name) distributions, etc.
 */
public class AttributeDetails {
	static final public String ATTRIBUTE_DETAILS_TABLE = "attributes_details";
    static final public String ATTRIBUTE_TABLE = "attributes";
	private static final int MAX_ATTRIBUTES_PER_BATCH = 5000;
	private static final int AD_SELECT_BATCH_SIZE = 1000;
	public static final int BATCH_INSERT_SIZE = 2000;
	public static final int BATCH_UPDATE_SIZE = 2000;

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ATTRIBUTE_DETAILS_TABLE+"` (" +
						  "id INT(11) NOT NULL," +
						  "attribute VARCHAR(12) NOT NULL," +
						  "value VARCHAR(2500) NOT NULL," +
						  "adcount INT(11) NOT NULL," +
						  "phonelist TEXT DEFAULT NULL," +
						  "emaillist TEXT DEFAULT NULL," +
						  "weblist TEXT DEFAULT NULL," +
						  "namelist TEXT DEFAULT NULL," +
						  "ethnicitylist TEXT DEFAULT NULL," +
						  "locationlist TEXT DEFAULT NULL," +
						  "sourcelist TEXT DEFAULT NULL," +
						  "keywordlist TEXT DEFAULT NULL," +
						  "timeseries TEXT DEFAULT NULL," +
						  "latestad DATETIME," +
						  "PRIMARY KEY (id) ) ENGINE=InnoDB DEFAULT CHARSET=utf8";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, ATTRIBUTE_DETAILS_TABLE)) {
			System.out.println("Clearing table: " + ATTRIBUTE_DETAILS_TABLE);
			db.clearTable(conn, ATTRIBUTE_DETAILS_TABLE);
		} else {			
			System.out.println("Creating table: " + ATTRIBUTE_DETAILS_TABLE);
			createTable(db, conn);
		}
		db.close(conn);
		
	}
	

	/**
	 * Calculate ClusterData details for all attributes from startAttrId->endAttrId
	 * @param sources 
	 */
	private static HashMap<Integer, ClusterData> getAttributeAggregation(TimeLog tl, int startAttrId, int endAttrId, 
			HashMap<Integer, HashSet<Pair<String,String>>> adKeywords, 
			HashMap<Integer, AttributeValue> allAttributes, 
			HashMap<Integer, String> sources) {

		// Open both databases
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		// Get the ad->attribute list mapping
		HashSet<Integer> ads = new HashSet<Integer>();
		tl.pushTime(" Fetch ads: ");
		HashMap<Integer,HashSet<Integer>> adToAttributes = getAdsInAttributes(startAttrId, endAttrId, allAttributes, oculusconn, htconn, ads);
		tl.popTime();

		tl.pushTime("Fetch ad locations");
		AdLocationSet adLocations = new AdLocationSet();
		AdLocations.getAdLocations(oculusdb, oculusconn, adLocations, ads);
		tl.popTime();
		
		HashMap<Integer,ClusterData> result = readAdDetails(oculusconn, htconn, adKeywords, adLocations, allAttributes, sources, adToAttributes, ads);
		
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		return result;
	}

	/**
	 * Calculate ClusterData details for all attributes in the updated set
	 * @param sources 
	 */
	private static HashMap<Integer, ClusterData> getAttributeAggregation(HashMap<Integer,AttributeValue> updateSet, 
			HashMap<Integer, HashSet<Pair<String,String>>> adKeywords, 
			AdLocationSet adLocations, 
			HashMap<Integer, AttributeValue> allAttributes, 
			HashMap<Integer, String> sources) {

		// Open both databases
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		// Get the ad->attribute list mapping
		HashSet<Integer> ads = new HashSet<Integer>();
		long start = System.currentTimeMillis();
		System.out.print(" Fetch ads: ");
		HashMap<Integer,HashSet<Integer>> adToAttributes = getAdsInAttributes(updateSet, allAttributes, oculusconn, htconn, ads);
		long end = System.currentTimeMillis();
		System.out.print((end-start)+"ms");
		start = end;

		HashMap<Integer,ClusterData> result = readAdDetails(oculusconn, htconn, adKeywords, adLocations, allAttributes, sources, adToAttributes, ads);
		
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		return result;
	}

	private static HashMap<Integer,ClusterData> readAdDetails(Connection oculusconn, Connection htconn,
			HashMap<Integer, HashSet<Pair<String, String>>> adKeywords,
			AdLocationSet adLocations,
			HashMap<Integer, AttributeValue> allAttributes,
			HashMap<Integer, String> sources,
			HashMap<Integer, HashSet<Integer>> adToAttributes,
			HashSet<Integer> ads) {
		HashMap<Integer,ClusterData> result = new HashMap<Integer,ClusterData>();
		long start;
		long end;
		long mainTime = 0;
		long extraTime = 0;
		long phoneTime = 0;
		
		// Fetch all the ad details and update the attribute data
		StringBuffer adstring = new StringBuffer("(");
		boolean isFirst = true;
		int batchSize = 0;
		for (Integer adid:ads) {
			if (isFirst) isFirst = false;
			else adstring.append(",");
			adstring.append(adid);
			batchSize++;
			if (batchSize==AD_SELECT_BATCH_SIZE) {
				adstring.append(")");
				start = System.currentTimeMillis();
				getMainDetails(allAttributes, adKeywords, adLocations, result, adToAttributes, htconn, sources, adstring);
				end = System.currentTimeMillis();
				mainTime += (end-start);
				start = end;
				getExtraDetails(allAttributes, result, adToAttributes, htconn, adstring);
				end = System.currentTimeMillis();
				extraTime += (end-start);
				start = end;
				getAttributes(allAttributes, result, AdExtraction.ADS_PHONE_TABLE, adToAttributes, oculusconn, adstring);
				getAttributes(allAttributes, result, AdExtraction.ADS_EMAILS_TABLE, adToAttributes, oculusconn, adstring);
				getAttributes(allAttributes, result, AdExtraction.ADS_WEBSITES_TABLE, adToAttributes, oculusconn, adstring);
				end = System.currentTimeMillis();
				phoneTime += (end-start);
				adstring = new StringBuffer("(");
				isFirst = true;
				batchSize = 0;
			}
		}
		System.out.println(" details: " + ads.size() + ":(" + mainTime + "," + extraTime + "," + phoneTime + ") ");
		return result;
	}

	/**
	 * Populate adToAttributes and ads with a mapping of ads_id to attributes_ids and a list of ads_id
	 */
	public static HashSet<Integer> getAdsInAttributes(HashSet<AttributeValue> updateSet, HashMap<Integer,AttributeValue> allAttributes,
			Connection oculusconn, Connection htconn) {
		HashSet<String> phones = new HashSet<String>();
		HashSet<String> emailVals = new HashSet<String>();
		HashSet<String> webVals = new HashSet<String>();
		for (AttributeValue av:updateSet) {
			if (av==null) continue;
			if (av.attribute.equals("phone")) {
				phones.add(av.value);
			} else if (av.attribute.equals("email")){
				emailVals.add(av.value);
			} else {
				webVals.add(av.value);
			}
		}

		HashSet<Integer> ads = getAdsForPhoneEmailWebsite(oculusconn, phones, emailVals, webVals);
		
		return ads;
	}


	/**
	 * Populate adToAttributes and ads with a mapping of ads_id to attributes_ids and a list of ads_id
	 */
	public static HashMap<Integer,HashSet<Integer>> getAdsInAttributes(HashMap<Integer,AttributeValue> updateSet, HashMap<Integer,AttributeValue> allAttributes,
			Connection oculusconn, Connection htconn, HashSet<Integer> ads) {
		HashMap<String,Integer> phones = new HashMap<String,Integer>();
		HashMap<String,Integer> emailVals = new HashMap<String,Integer>();
		HashMap<String,Integer> webVals = new HashMap<String,Integer>();
		for (Map.Entry<Integer,AttributeValue> e:updateSet.entrySet()) {
			Integer i = e.getKey();
			AttributeValue av = e.getValue();
			if (av==null) continue;
			if (av.attribute.equals("phone")) {
				phones.put(av.value, i);
			} else if (av.attribute.equals("email")){
				emailVals.put(av.value, i);
			} else {
				webVals.put(av.value, i);
			}
		}

		HashMap<Integer,HashSet<Integer>> adToAttributes = getAdsForPhoneEmailWebsite(oculusconn, phones, emailVals, webVals);
		
		ads.addAll(adToAttributes.keySet());
		return adToAttributes;
	}

	/**
	 * Populate adToAttributes and ads with a mapping of ads_id to attributes_ids and a list of ads_id
	 */
	public static HashMap<Integer,HashSet<Integer>> getAdsInAttributes(int startid, int endid, HashMap<Integer,AttributeValue> allAttributes,
			Connection oculusconn, Connection htconn, HashSet<Integer> ads) {
		HashMap<String,Integer> phones = new HashMap<String,Integer>();
		HashMap<String,Integer> emailVals = new HashMap<String,Integer>();
		HashMap<String,Integer> webVals = new HashMap<String,Integer>();
		for (int i=startid; i<=endid; i++) {
			AttributeValue av = allAttributes.get(i);
			if (av==null) continue;
			if (av.attribute.equals("phone")) {
				phones.put(av.value, i);
			} else if (av.attribute.equals("email")){
				emailVals.put(av.value, i);
			} else {
				webVals.put(av.value, i);
			}
		}

		HashMap<Integer,HashSet<Integer>> adToAttributes = getAdsForPhoneEmailWebsite(oculusconn, phones, emailVals, webVals);
		
		ads.addAll(adToAttributes.keySet());
		return adToAttributes;
	}

	private static HashMap<Integer, HashSet<Integer>> getAdsForPhoneEmailWebsite(Connection oculusconn,
			HashMap<String, Integer> phones,
			HashMap<String, Integer> emailVals,
			HashMap<String, Integer> webVals) {
		HashMap<Integer,HashSet<Integer>> adToAttributes = new HashMap<Integer,HashSet<Integer>>();
		HashMap<String, HashSet<Integer>> adsForPhones = MemexAd.getAdsForValues(oculusconn, AdExtraction.ADS_PHONE_TABLE, phones.keySet());
		for (Entry<String,HashSet<Integer>> e:adsForPhones.entrySet()) {
			String phone = e.getKey();
			Integer attrid = phones.get(phone);
			for (int adid:e.getValue()) {
				HashSet<Integer> attrSet = adToAttributes.get(adid);
				if (attrSet==null) {
					attrSet = new HashSet<Integer>();
					adToAttributes.put(adid, attrSet);
				}
				attrSet.add(attrid);
			}
		}

		HashMap<String, HashSet<Integer>> adsForEmails = MemexAd.getAdsForValues(oculusconn, AdExtraction.ADS_EMAILS_TABLE, emailVals.keySet());
		for (Entry<String,HashSet<Integer>> e:adsForEmails.entrySet()) {
			String email = e.getKey();
			if (emailVals==null || email==null) {
				System.out.println("Missing emails: " + emailVals + "," + email);
				continue;
			}
			Integer attrid = emailVals.get(email);
			if (attrid==null) {
				continue;
			}
			for (int adid:e.getValue()) {
				HashSet<Integer> attrSet = adToAttributes.get(adid);
				if (attrSet==null) {
					attrSet = new HashSet<Integer>();
					adToAttributes.put(adid, attrSet);
				}
				attrSet.add(attrid);
			}
		}

		HashMap<String, HashSet<Integer>> adsForWebsites = MemexAd.getAdsForValues(oculusconn, AdExtraction.ADS_WEBSITES_TABLE, webVals.keySet());
		for (Entry<String,HashSet<Integer>> e:adsForWebsites.entrySet()) {
			String website = e.getKey();
			Integer attrid = webVals.get(website);
			for (int adid:e.getValue()) {
				HashSet<Integer> attrSet = adToAttributes.get(adid);
				if (attrSet==null) {
					attrSet = new HashSet<Integer>();
					adToAttributes.put(adid, attrSet);
				}
				attrSet.add(attrid);
			}
		}
		return adToAttributes;
	}

	private static HashSet<Integer> getAdsForPhoneEmailWebsite(Connection oculusconn,
			HashSet<String> phones,
			HashSet<String> emailVals,
			HashSet<String> webVals) {
		HashSet<Integer> ads = new HashSet<Integer>();
		HashMap<String, HashSet<Integer>> adsForPhones = MemexAd.getAdsForValues(oculusconn, AdExtraction.ADS_PHONE_TABLE, phones);
		for (Entry<String,HashSet<Integer>> e:adsForPhones.entrySet()) {
			ads.addAll(e.getValue());
		}

		HashMap<String, HashSet<Integer>> adsForEmails = MemexAd.getAdsForValues(oculusconn, AdExtraction.ADS_EMAILS_TABLE, emailVals);
		for (Entry<String,HashSet<Integer>> e:adsForEmails.entrySet()) {
			ads.addAll(e.getValue());
		}

		HashMap<String, HashSet<Integer>> adsForWebsites = MemexAd.getAdsForValues(oculusconn, AdExtraction.ADS_WEBSITES_TABLE, webVals);
		for (Entry<String,HashSet<Integer>> e:adsForWebsites.entrySet()) {
			ads.addAll(e.getValue());
		}
		return ads;
	}

	private static void getExtraDetails(HashMap<Integer, AttributeValue> allAttributes, HashMap<Integer, ClusterData> result,
			HashMap<Integer, HashSet<Integer>> adToAttributes, Connection htconn,
			StringBuffer adstring) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT ads_id,attribute,value FROM ads_attributes where ads_id IN " + adstring.toString();
		stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				HashSet<Integer> attrids = adToAttributes.get(adid);
				if (attrids==null) continue;
				for (Integer attrid:attrids) {
					AttributeValue av = allAttributes.get(attrid);
					if (av==null) {
						continue;
					}
					ClusterData cd = result.get(attrid);
					if (cd==null) {
						cd = new ClusterData();
						result.put(attrid, cd);
						cd.adcount++;
					}
					String attribute = rs.getString("attribute");
					String value = rs.getString("value").toLowerCase();
//					if (attribute.compareTo("phone")==0) {
//						incrementCounts(value, cd.phonelist);
//					} else if (attribute.compareTo("email")==0) {
//						incrementCounts(value, cd.emaillist);
//					} else if (attribute.compareTo("website")==0) {
//						incrementCounts(value, cd.weblist);
//					} else 
					if (attribute.compareTo("ethnicity")==0) {
						HashCount.incrementCounts(value, cd.ethnicitylist);
					} else if (attribute.compareTo("name")==0) {
						HashCount.incrementCounts(value, cd.namelist);
					}
				}
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

	private static void getAttributes(HashMap<Integer, AttributeValue> allAttributes, HashMap<Integer, ClusterData> result, String table,
			HashMap<Integer, HashSet<Integer>> adToAttributes, Connection oculusconn,
			StringBuffer adstring) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT ads_id,value FROM " + table + " where ads_id IN " + adstring.toString();
		stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int adid = rs.getInt("ads_id");
				HashSet<Integer> attrids = adToAttributes.get(adid);
				if (attrids==null) continue;
				for (Integer attrid:attrids) {
					AttributeValue av = allAttributes.get(attrid);
					if (av==null) {
						continue;
					}
					ClusterData cd = result.get(attrid);
					if (cd==null) {
						cd = new ClusterData();
						result.put(attrid, cd);
						cd.adcount++;
					}
					String value = rs.getString("value");
					if (table.compareTo(AdExtraction.ADS_PHONE_TABLE)==0) HashCount.incrementCounts(value, cd.phonelist);
					else if (table.compareTo(AdExtraction.ADS_WEBSITES_TABLE)==0) HashCount.incrementCounts(value, cd.weblist);
					if (table.compareTo(AdExtraction.ADS_EMAILS_TABLE)==0) HashCount.incrementCounts(value, cd.emaillist);
				}
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

	/**
	 * Fetch details from memex_ht.ads for every ad in adstring. Store the resulting details with each attribute.
	 */
	private static void getMainDetails(
			HashMap<Integer, AttributeValue> allAttributes, HashMap<Integer, HashSet<Pair<String, String>>> adKeywords,
			AdLocationSet adLocations, HashMap<Integer, ClusterData> result,
			HashMap<Integer, HashSet<Integer>> adToAttributes, Connection htconn,
			HashMap<Integer,String> sources,
			StringBuffer adstring) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT id,sources_id,posttime FROM ads WHERE id IN " + adstring.toString();
		stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			Calendar c = Calendar.getInstance();
			while (rs.next()) {
				int adid = rs.getInt("id");

				// For all of the attributes that contain this add, increment the cluster details
				HashSet<Integer> attrids = adToAttributes.get(adid);
				if (attrids==null) continue;
				for (Integer attrid:attrids) {
					AttributeValue av = allAttributes.get(attrid);
					if (av==null) {
						continue;
					}
					ClusterData cd = result.get(attrid);
					if (cd==null) {
						cd = new ClusterData();
						result.put(attrid, cd);
					}
					HashCount.incrementCounts(sources.get(rs.getInt("sources_id")), cd.sourcelist);
					HashCount.incrementCounts(adKeywords.get(adid), cd.keywordlist);
					HashCount.incrementCount(adLocations.getLocation(adid), cd.locationlist);
					cd.adcount++;
					Date date = rs.getDate("posttime");
					long time = 0;
					if(date!=null) {
						if(cd.latestAd.compareTo(date)<0) {
							cd.latestAd=date;
						}						
						c.setTime(date);
						c.set(Calendar.HOUR,0);
						c.set(Calendar.MINUTE,0);
						c.set(Calendar.SECOND,0);
						c.set(Calendar.MILLISECOND,0);
						time = c.getTimeInMillis()/1000;
					}
					Integer i = cd.timeseries.get(time);
					if (i==null) {
						i = new Integer(1);
					} else {
						i++;
					}
					cd.timeseries.put(time, i);
				}					
			}
			
		} catch (Exception e) {
			System.out.println("Failed: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}
	
	public static HashMap<Integer,String> getSources(Connection htconn) {
		String sqlStr;
		Statement stmt;
		sqlStr = "SELECT id,name from sources";
		stmt = null;
		HashMap<Integer,String> result = new HashMap<Integer,String>();
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int id = rs.getInt("id");
				String name = rs.getString("name");
				result.put(id, name);
			}
		} catch (Exception e) {
			System.out.println("Failed: " + sqlStr);
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
	

	public static HashSet<String> getPreclusterIDs() {
		HashSet<String> result = new HashSet<String>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		String sqlStr = "SELECT distinct clusterid FROM " + Cluster.CLUSTER_TABLE;
		Connection conn = db.open();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String org = rs.getString("clusterid");
				result.add(org);
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

	public static int getMaxAttributeID() {
		String sqlStr = "SELECT max(id) as max FROM " + AttributeLinks.ATTRIBUTES_TABLE;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		int result = MemexOculusDB.getInt(conn, sqlStr, "Get max attribute id");
		db.close(conn);
		return result;
	}

	
	public static void insertAttributeData(HashMap<Integer, AttributeValue> allAttributes, HashMap<Integer, ClusterData> clusterTable) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		AttributeValue av = null;
		ClusterData cd = null;
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + ATTRIBUTE_DETAILS_TABLE + 
					"(id, attribute, value, adcount, phonelist, emaillist, weblist, namelist, ethnicitylist, locationlist, sourcelist, keywordlist, timeseries, latestad) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
			int count = 0;
			for (Entry<Integer,ClusterData> e:clusterTable.entrySet()) {
				Pair<String,Integer> maxPhone = new Pair<String,Integer>(null,0);
				Pair<String,Integer> maxEmail = new Pair<String,Integer>(null,0);
				Pair<String,Integer> maxName =new Pair<String,Integer>(null,0);
				Integer attrid = e.getKey();
				av = allAttributes.get(attrid);
				cd = e.getValue();
				pstmt.setInt(1, attrid);
				pstmt.setString(2, av.attribute);
				pstmt.setString(3, av.value);
				pstmt.setInt(4, cd.adcount);
				pstmt.setString(5, HashCount.mapToString(cd.phonelist, maxPhone));
				pstmt.setString(6, HashCount.mapToString(cd.emaillist, maxEmail));
				pstmt.setString(7, HashCount.mapToString(cd.weblist, null));
				pstmt.setString(8, HashCount.mapToString(cd.namelist, maxName));
				pstmt.setString(9, HashCount.mapToString(cd.ethnicitylist, null));
				pstmt.setString(10, HashCount.mapToString(cd.locationlist, null));
				pstmt.setString(11, HashCount.mapToString(cd.sourcelist, null));
				pstmt.setString(12, HashCount.classifierMapToString(cd.keywordlist));
				pstmt.setString(13, HashCount.longMapToString(cd.timeseries));
				pstmt.setDate(14, new java.sql.Date(cd.latestAd.getTime()));
				pstmt.addBatch();
				count++;
				if (count % BATCH_INSERT_SIZE == 0) {
					pstmt.executeBatch();
				}
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			System.out.println("Failed to write cluster details batch");
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		
		pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + AttributeLocation.ATTRIBUTE_LOCATION_TABLE + "(location,attributeid,matches) VALUES (?,?,?)");
			int count = 0;
			for (Entry<Integer,ClusterData> e:clusterTable.entrySet()) {
				Integer attrid = e.getKey();
				cd = e.getValue();
				if (cd==null || cd.locationlist==null) continue;
				for (Map.Entry<String, Integer> loc:cd.locationlist.entrySet()) {
					String location = loc.getKey();
					if (location.length()>127) location = location.substring(0,126); // TODO: Remove this, make the table bigger
					Integer loccount = loc.getValue();
					pstmt.setString(1, location);
					pstmt.setInt(2, attrid);
					pstmt.setInt(3, loccount);
					pstmt.addBatch();
					count++;
					if (count % BATCH_INSERT_SIZE == 0) {
						pstmt.executeBatch();
					}
				}
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			System.out.println("Failed to write attribute locations batch");
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

	public static HashSet<Integer> recomputeDetails(TimeLog tl, HashSet<AttributeValue> alteredAttributes) {

		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		tl.pushTime("Fetch all attributes");
		HashMap<Integer,AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
		tl.popTime();
		
		tl.pushTime("Fetch sources");
		HashMap<Integer,String> sources = getSources(htconn);
		tl.popTime();

		tl.pushTime("Ads for attributes");
		HashSet<Integer> ads = getAdsInAttributes(alteredAttributes, allAttributes, oculusconn, htconn);
		tl.popTime("ads: " + ads.size());

		tl.pushTime("Fetch ad locations");
		AdLocationSet adLocations = new AdLocationSet();
		AdLocations.getAdLocations(oculusdb, oculusconn, adLocations, ads);
		tl.popTime();

		oculusdb.close(oculusconn);
		htdb.close(htconn);

		tl.pushTime("Fetch ad keywords for " + ads.size() + " ads");
		HashMap<Integer, HashSet<Pair<String,String>>> adKeywords = AdKeywords.getAdKeywords(ads); 
		tl.popTime();

		
		HashMap<Integer,AttributeValue> updateSet = new HashMap<Integer,AttributeValue>();
		int count = 0;
		tl.pushTime("Update attributes " + count + " remaining: " + alteredAttributes.size());
		for (Map.Entry<Integer, AttributeValue> e:allAttributes.entrySet()) {
			AttributeValue av = e.getValue();
			if (alteredAttributes.remove(av)) {
				count++;
				updateSet.put(e.getKey(), av);
				if (updateSet.size()==BATCH_UPDATE_SIZE) {
					deleteAttributeDetails(updateSet);
					HashMap<Integer,ClusterData> clusterTable = getAttributeAggregation(updateSet, adKeywords, adLocations, allAttributes, sources);
					insertAttributeData(allAttributes, clusterTable);
					updateSet.clear();
					tl.popTime();
					tl.pushTime("Update attributes " + count + " remaining: " + alteredAttributes.size());
				}
			}
		}
		if (updateSet.size()>0) {
			deleteAttributeDetails(updateSet);
			HashMap<Integer,ClusterData> clusterTable = getAttributeAggregation(updateSet, adKeywords, adLocations, allAttributes, sources);
			insertAttributeData(allAttributes, clusterTable);
		}
		tl.popTime();
		
		return ads;
	}
	
	private static void deleteAttributeDetails(HashMap<Integer, AttributeValue> updateSet) {		
		if (updateSet.size()==0) return;
		Set<Integer> keySet = updateSet.keySet();
		String clusterStr = StringUtil.hashSetToSqlList(keySet);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection oculusconn = db.open();
		String sqlStr = "delete FROM " + ATTRIBUTE_DETAILS_TABLE + " where id IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
		sqlStr = "delete FROM " + AttributeLocation.ATTRIBUTE_LOCATION_TABLE + " where attributeid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
		db.close(oculusconn);
	}

	public static void lowMemDetails(TimeLog tl) {
		initTable();
		AttributeLocation.initTable();
		
		tl.pushTime("Fetch ad keywords...");
		HashMap<Integer, HashSet<Pair<String,String>>> adKeywords = AdKeywords.getAdKeywords(); 
		tl.popTime();

		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		tl.pushTime("Fetch all attributes");
		HashMap<Integer,AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
		oculusdb.close(oculusconn);
		tl.popTime();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		HashMap<Integer,String> sources = getSources(htconn);
		htdb.close(htconn);
		
		int maxid = getMaxAttributeID();
		int count = 0;
		// Loop over all attributes, calculate details and write to database
		while (count<maxid) {
			// Calculate details for count->count+MAX_ATTRIBUTES_PER_BATCH-1
			tl.pushTime("\tProcessing: " + count + " to " + (count+MAX_ATTRIBUTES_PER_BATCH-1));
			HashMap<Integer,ClusterData> clusterTable = getAttributeAggregation(tl, count, count+MAX_ATTRIBUTES_PER_BATCH-1, adKeywords, allAttributes, sources);
			tl.popTime();

			tl.pushTime("Writing attribute data");
			insertAttributeData(allAttributes, clusterTable);
			count+=MAX_ATTRIBUTES_PER_BATCH;
			tl.popTime();
		}
	}
	

//	public static void test(int id) {
//		HashMap<Integer, HashSet<Pair<String,String>>> adKeywords = new HashMap<Integer, HashSet<Pair<String,String>>>();
//
//		AdLocationSet adLocations = new AdLocationSet();
//
//		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
//		Connection oculusconn = oculusdb.open();
//		HashMap<Integer,AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
//		oculusdb.close();
//
//		HashMap<Integer,String> sources = new HashMap<Integer,String>();
//		
//			// Calculate details for count->count+MAX_ATTRIBUTES_PER_BATCH-1
//		System.out.print("\tProcessing: " + id);
//		HashMap<Integer,ClusterData> clusterTable = getAttributeAggregation(id-1, id+1, adKeywords, adLocations, allAttributes, sources);
//
//	}

	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Attribute details calculation");

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		lowMemDetails(tl);

		tl.popTime();
	}

}
