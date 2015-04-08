package oculus.memex.graph;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;

import oculus.memex.clustering.AttributeDetails;
import oculus.memex.clustering.AttributeValue;
import oculus.memex.clustering.MemexAd;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

/**
 * Create a table of attribute -> related attribute, adcount
 * 
 */
public class AttributeLinks {
	static final public String ATTRIBUTES_TABLE = "attributes";
	static final public String ATTRIBUTES_LINKS_TABLE = "attributes_links";
	public static final int BATCH_INSERT_SIZE = 2000;
	private static int AD_PROCESS_BATCH_SIZE = 1000;
	private static final int WHERE_IN_SELECT_SIZE = 2000;

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ATTRIBUTES_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "attribute VARCHAR(32) NOT NULL," +
						  "value VARCHAR(2500) NOT NULL," +
						  "PRIMARY KEY (id) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	private static void createLinksTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ATTRIBUTES_LINKS_TABLE+"` (" +
						  "linkid INT(11) NOT NULL AUTO_INCREMENT," +
						  "attr1 VARCHAR(32) NOT NULL," +
						  "attr2 VARCHAR(32) NOT NULL," +
						  "val1 VARCHAR(2500)," +
						  "val2 VARCHAR(2500)," +
						  "count INT(11)," +
						  "PRIMARY KEY (linkid) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public static void initTables() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, ATTRIBUTES_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ATTRIBUTES_TABLE);
				db.clearTable(conn, ATTRIBUTES_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + ATTRIBUTES_TABLE);
			createTable(db, conn);
		}
		if (db.tableExists(conn, ATTRIBUTES_LINKS_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ATTRIBUTES_LINKS_TABLE);
				db.clearTable(conn, ATTRIBUTES_LINKS_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + ATTRIBUTES_LINKS_TABLE);
			createLinksTable(db, conn);
		}
		db.close(conn);
	}
	
	public static void insertAttributes(HashSet<AttributeValue> alteredAttributes) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + ATTRIBUTES_TABLE + "(attribute,value) VALUES (?,?)");
			int count = 0;
			for (AttributeValue av:alteredAttributes) {
				pstmt.setString(1, av.attribute);
				pstmt.setString(2, av.value);
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

	
	public static int insertAttributeLinks(HashMap<AttributeValue, HashMap<AttributeValue, Integer>> linkTable, HashSet<AttributeValue> alteredAttributes) {
		// TODO: Consider partial delete/insert... requires an index
		// Delete links with one end in alteredAttributes
		// Write links with one end in alteredAttributes

		MemexOculusDB db = MemexOculusDB.getInstance();
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		db.clearTable(conn, ATTRIBUTES_LINKS_TABLE);
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + ATTRIBUTES_LINKS_TABLE + 
					"(attr1,attr2,val1,val2,count) VALUES (?,?,?,?,?)");
			int count = 0;
			for (Entry<AttributeValue, HashMap<AttributeValue, Integer>> e:linkTable.entrySet()) {
				AttributeValue val1 = e.getKey();
				for (Entry<AttributeValue,Integer> e2:e.getValue().entrySet()) {
					AttributeValue val2 = e2.getKey();
					Integer linkCount = e2.getValue();
					pstmt.setString(1, val1.attribute);
					pstmt.setString(2, val2.attribute);
					pstmt.setString(3, val1.value);
					pstmt.setString(4, val2.value);
					pstmt.setInt(5, linkCount);
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
		int maxLink = DBManager.getInt(conn, "select max(linkid) from " + ATTRIBUTES_LINKS_TABLE, "Get max Linkid");
		db.close(conn);
		return maxLink;
	}

	/**
	 * Loop over ads and increment link counts between attributes on each ad.
	 */
	private static HashMap<AttributeValue,HashMap<AttributeValue,Integer>> getAttributeLinks(HashSet<AttributeValue> alteredAttributes, int maxID) {
		HashMap<AttributeValue,HashMap<AttributeValue,Integer>> result = getAllLinks();

		Pair<Integer,Integer> lastIDs = Progress.getLastID("attribute_links");
		int lastID = lastIDs.getFirst();
		int nextID = lastID+1;
//		int oldLastAttribute = lastIDs.getSecond();

		System.out.println("Previous max ad: " + lastID + " New max ad:" + maxID);
		long start = System.currentTimeMillis();
		
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		int iterations = 0;
		int totalLinks = 0;
		while (nextID<maxID) {
			// For each ad
			HashMap<Integer, MemexAd> adbatch = MemexAd.fetchAdsOculus(htconn, oculusconn, nextID, nextID+AD_PROCESS_BATCH_SIZE, false);
			for (MemexAd ad:adbatch.values()) {
				if (ad.id>lastID) lastID = ad.id;
				// For each attribute
				for (Entry<String,HashSet<String>> e:ad.attributes.entrySet()) {
					String attribute = e.getKey();
					for (String value:e.getValue()) {
						AttributeValue av = new AttributeValue(attribute,value.toLowerCase());
						alteredAttributes.add(av);
						HashMap<AttributeValue, Integer> linkedAttrs = result.get(av);
						if (linkedAttrs==null) {
							linkedAttrs = new HashMap<AttributeValue,Integer>();
							result.put(av, linkedAttrs);
						}
						// For each other attribute in same ad, make a link
						for (Entry<String,HashSet<String>> e2:ad.attributes.entrySet()) {
							String attribute2 = e2.getKey();
							for (String value2:e2.getValue()) {
								AttributeValue av2 = new AttributeValue(attribute2,value2.toLowerCase());
								if (av.equals(av2)) continue;

								Integer linkCount = linkedAttrs.get(av2);
								if (linkCount==null) {
									linkedAttrs.put(av2, 1);
								} else {
									linkedAttrs.put(av2, linkCount+1);
								}
								totalLinks++;
							}
						}
					}
				}
			}
			nextID += AD_PROCESS_BATCH_SIZE;
			iterations++;
			if ((iterations%1000)==0) {
				long end = System.currentTimeMillis();
				System.out.println("Processed 1M ads in " + (end-start) + "ms. Ending on: " + nextID + ". Links: " + totalLinks);
				start = end;
			}
		}
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		
		return result;
	}

	/**
	 * Loop over ads, return links involving alteredAttributes.
	 */
	private static HashMap<AttributeValue,HashMap<AttributeValue,Integer>> getAttributeLinks(HashSet<AttributeValue> alteredAttributes, HashSet<Integer> ads) {
		HashMap<AttributeValue,HashMap<AttributeValue,Integer>> result = new HashMap<AttributeValue,HashMap<AttributeValue,Integer>>();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		HashMap<Integer, MemexAd> adbatch = MemexAd.fetchAdsOculus(htconn, oculusconn, ads);
		for (MemexAd ad:adbatch.values()) {
			// For each attribute
			for (Entry<String,HashSet<String>> e:ad.attributes.entrySet()) {
				String attribute = e.getKey();
				for (String value:e.getValue()) {
					AttributeValue av = new AttributeValue(attribute,value.toLowerCase());
					HashMap<AttributeValue, Integer> linkedAttrs = result.get(av);
					if (linkedAttrs==null) {
						linkedAttrs = new HashMap<AttributeValue,Integer>();
						result.put(av, linkedAttrs);
					}
					// For each other attribute in same ad, make a link
					for (Entry<String,HashSet<String>> e2:ad.attributes.entrySet()) {
						String attribute2 = e2.getKey();
						for (String value2:e2.getValue()) {
							AttributeValue av2 = new AttributeValue(attribute2,value2.toLowerCase());
							if (av.equals(av2)) continue;
							if (alteredAttributes.contains(av) || alteredAttributes.contains(av2)) {
								Integer linkCount = linkedAttrs.get(av2);
								if (linkCount==null) {
									linkedAttrs.put(av2, 1);
								} else {
									linkedAttrs.put(av2, linkCount+1);
								}
							}
						}
					}
				}
			}
		}
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		
		return result;
	}

	private static void computeLinks(TimeLog tl) {
		initTables();

		tl.pushTime("Attribute Link Calculation");
		tl.pushTime("Reading attribute data");
		int maxID = MemexAd.getMaxID();
		HashSet<AttributeValue> alteredAttributes = new HashSet<AttributeValue>();
		HashMap<AttributeValue,HashMap<AttributeValue,Integer>> linkTable = getAttributeLinks(alteredAttributes, maxID);
		tl.popTime();
		
		tl.pushTime("Writing attribute links");
		int lastLink = insertAttributeLinks(linkTable, alteredAttributes);
		tl.popTime();
		
		// Read attributes
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection oculusconn = db.open();
		HashSet<AttributeValue> oldAttributes = getAttributeSet(oculusconn);
		db.close(oculusconn);

		HashSet<AttributeValue> newAttributes = new HashSet<AttributeValue>(alteredAttributes);
		
		// Write alteredAttributes not in all attributes
		newAttributes.removeAll(oldAttributes);
		tl.pushTime("Writing attributes..." + newAttributes.size());
		insertAttributes(newAttributes);
		tl.popTime();
		int duration = (int)(tl.popTime()/1000);

		oculusconn = db.open();
		Progress.updateProgress(db, oculusconn, "attribute_links", maxID, lastLink, duration);
		db.close(oculusconn);
		
		tl.pushTime("Recompute details");
		if (oldAttributes.size()>0) {
			AttributeDetails.recomputeDetails(tl, alteredAttributes);
		} else {
			AttributeDetails.lowMemDetails(tl);
		}
		duration = (int)(tl.popTime()/1000);
		oculusconn = db.open();
		int maxDetail = DBManager.getInt(oculusconn, "select max(id) from " + AttributeDetails.ATTRIBUTE_DETAILS_TABLE, "Get max attribute details id"); 
		Progress.updateProgress(db, oculusconn, "attribute_details", maxID, maxDetail, duration);
		db.close(oculusconn);
	}

	private static String WHERE_IN_PSTMT_QUESTIONS = null;
	public static String commasAndQuestions(int count) {
		if (count==WHERE_IN_SELECT_SIZE) {
			if (WHERE_IN_PSTMT_QUESTIONS!=null) {
				return WHERE_IN_PSTMT_QUESTIONS;
			}
		}
		String result = StringUtil.commasAndQuestions(count);
		if (count==WHERE_IN_SELECT_SIZE) {
			WHERE_IN_PSTMT_QUESTIONS = result;
			return WHERE_IN_PSTMT_QUESTIONS;
		}
		return result;
	}

	/**
	 * Fetch attribute links from the database.
	 * Triples are (attribute1, attribute2, count).
	 */
	public static HashMap<AttributeValue,HashMap<AttributeValue,Integer>> getAllLinks() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<AttributeValue,HashMap<AttributeValue,Integer>> result = new HashMap<AttributeValue,HashMap<AttributeValue,Integer>>();
		PreparedStatement stmt = null;
		try {
			stmt = conn.prepareStatement("SELECT attr1,attr2,val1,val2,count from " + ATTRIBUTES_LINKS_TABLE);
			ResultSet rs = stmt.executeQuery();
			while (rs.next()) {
				String val1 = rs.getString("val1").toLowerCase();
				String val2 = rs.getString("val2").toLowerCase();
				String attr1 = rs.getString("attr1").toLowerCase();
				String attr2 = rs.getString("attr2").toLowerCase();
				Integer count = rs.getInt("count");

				AttributeValue av1 = new AttributeValue(attr1, val1);
				AttributeValue av2 = new AttributeValue(attr2, val2);
				
				// Add the link (av1->av2)
				HashMap<AttributeValue,Integer> links = result.get(av1);
				if (links==null) {
					links = new HashMap<AttributeValue,Integer>();
					result.put(av1, links);
				}
				links.put(av2, count);

				// Add the reverse link (av2->av1)
				links = result.get(av2);
				if (links==null) {
					links = new HashMap<AttributeValue,Integer>();
					result.put(av2, links);
				}
				links.put(av1, count);
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

	/**
	 * Given a list of attribute values, fetch related attributes and their shared ad count. 
	 * Triples are (attribute1, attribute2, count).
	 */
	public static HashMap<AttributeValue,HashMap<AttributeValue,Integer>> getLinks(HashSet<AttributeValue> values) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<AttributeValue,HashMap<AttributeValue,Integer>> result = new HashMap<AttributeValue,HashMap<AttributeValue,Integer>>();
		PreparedStatement stmt = null;
		try {
			String cq = commasAndQuestions(values.size());
			stmt = conn.prepareStatement("SELECT attr1,attr2,val1,val2,count from " 
					+ ATTRIBUTES_LINKS_TABLE + " WHERE val1 IN (" + cq + 
					") OR val2 IN (" + cq + ")");
			int i = 1;
			for (AttributeValue val:values) {
				stmt.setString(i, val.value);
				stmt.setString(values.size()+i, val.value);
				i++;
			}
			ResultSet rs = stmt.executeQuery();
			while (rs.next()) {
				String val1 = rs.getString("val1").toLowerCase();
				String val2 = rs.getString("val2").toLowerCase();
				String attr1 = rs.getString("attr1").toLowerCase();
				String attr2 = rs.getString("attr2").toLowerCase();
				Integer count = rs.getInt("count");

				AttributeValue av1 = new AttributeValue(attr1, val1);
				AttributeValue av2 = new AttributeValue(attr2, val2);
				
				// Add the link (av1->av2)
				HashMap<AttributeValue,Integer> links = result.get(av1);
				if (links==null) {
					links = new HashMap<AttributeValue,Integer>();
					result.put(av1, links);
				}
				links.put(av2, count);

				// Add the reverse link (av2->av1)
				links = result.get(av2);
				if (links==null) {
					links = new HashMap<AttributeValue,Integer>();
					result.put(av2, links);
				}
				links.put(av1, count);
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

    public static AttributeValue getAttribute(Connection oculusconn, int attributeId) {
        HashSet<AttributeValue> singletonAttribute = getAttributes(oculusconn,attributeId,attributeId);
        return singletonAttribute.iterator().next();
    }

	public static HashSet<AttributeValue> getAttributes(Connection oculusconn, int startid, int endid) {
		HashSet<AttributeValue> result = new HashSet<AttributeValue>();
		String sqlStr = "SELECT attribute,value FROM " + ATTRIBUTES_TABLE + " where id>="+startid+" and id<=" + endid;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String attribute = rs.getString("attribute");
				String value = rs.getString("value");
				result.add(new AttributeValue(attribute,value.toLowerCase()));
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

	public static HashMap<Integer,AttributeValue> getAttributes(Connection oculusconn) {
		 HashMap<Integer,AttributeValue> result = new  HashMap<Integer,AttributeValue>();
		String sqlStr = "SELECT id,attribute,value FROM " + ATTRIBUTES_TABLE;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer id = rs.getInt("id");
				String attribute = rs.getString("attribute");
				String value = rs.getString("value").toLowerCase();
				result.put(id, new AttributeValue(attribute,value.toLowerCase()));
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

	public static void deleteAttribute(TimeLog tl, String attribute, String value) {
		tl.pushTime("Deleting attribute " + attribute + " " + value);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		int attrid = DBManager.getInt(conn, "select id from memex_oculus.attributes where attribute='" + attribute + "' and value='" + value + "'", "Get attribute id");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes where attribute='" + attribute + "' and value='" + value + "'");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_details where attribute='" + attribute + "' and value='" + value + "'");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_links where attr1='" + attribute + "' and val1='" + value + "'");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_links where attr2='" + attribute + "' and val2='" + value + "'");
		if (attrid!=0) DBManager.tryStatement(conn, "delete from memex_oculus.attributes_location where attributeid=" + attrid);
		db.close(conn);
		tl.popTime();
	}

	public static void renameAttribute(TimeLog tl, String attribute, String oldValue, String newValue) {
		tl.pushTime("Renaming attribute " + attribute + " " + oldValue + " to " + newValue);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		int attrid = DBManager.getInt(conn, "select id from memex_oculus.attributes where attribute='" + attribute + "' and value='" + newValue + "'", "Get attribute id");
		if (attrid>0) {
			DBManager.tryStatement(conn, "delete from memex_oculus.attributes where attribute='" + attribute + "' and value='" + oldValue + "'");
		} else {
			DBManager.tryStatement(conn, "update memex_oculus.attributes set value='" + newValue + "' where attribute='" + attribute + "' and value='" + oldValue + "'");
		}
		attrid = DBManager.getInt(conn, "select id from memex_oculus.attributes where attribute='" + attribute + "' and value='" + newValue + "'", "Get attribute id");

		// Recalculate attribute details
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_details where attribute='" + attribute + "' and value='" + oldValue + "'");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_details where attribute='" + attribute + "' and value='" + newValue + "'");
		db.close(conn);
		
		HashSet<AttributeValue> alteredAttributes = new HashSet<AttributeValue>();
		alteredAttributes.add(new AttributeValue(attribute,newValue));
		HashSet<Integer> ads = AttributeDetails.recomputeDetails(tl, alteredAttributes);

		// Recalculate attribute links
		conn = db.open();
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_links where attr1='" + attribute + "' and val1='" + oldValue + "'");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_links where attr2='" + attribute + "' and val2='" + oldValue + "'");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_links where attr1='" + attribute + "' and val1='" + newValue + "'");
		DBManager.tryStatement(conn, "delete from memex_oculus.attributes_links where attr2='" + attribute + "' and val2='" + newValue + "'");
		db.close(conn);
		HashMap<AttributeValue,HashMap<AttributeValue,Integer>> linkTable = getAttributeLinks(alteredAttributes, ads);
		insertAttributeLinks(linkTable, alteredAttributes);

		if (attrid!=0) {
			conn = db.open();
			DBManager.tryStatement(conn, "delete from memex_oculus.attributes_location where attributeid=" + attrid);
			db.close(conn);
		}
		tl.popTime();
		
	}
	
	public static HashSet<AttributeValue> getAttributeSet(Connection oculusconn) {
		 HashSet<AttributeValue> result = new  HashSet<AttributeValue>();
		String sqlStr = "SELECT attribute,value FROM " + ATTRIBUTES_TABLE;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String attribute = rs.getString("attribute");
				String value = rs.getString("value").toLowerCase();
				result.add(new AttributeValue(attribute,value.toLowerCase()));
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
		TimeLog tl = new TimeLog();
		tl.pushTime("Attribute links calculation");

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		computeLinks(tl);

		tl.popTime();
	}

}
