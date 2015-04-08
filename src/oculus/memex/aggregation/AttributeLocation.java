package oculus.memex.aggregation;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;

import oculus.memex.clustering.AttributeDetails;
import oculus.memex.clustering.AttributeValue;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.geo.AdLocations;
import oculus.memex.geo.AdLocations.AdLocationSet;
import oculus.memex.graph.AttributeLinks;
import oculus.memex.util.TimeLog;

/**
 *  Create a table of location -> attributeid
 */
public class AttributeLocation {
	static final public String ATTRIBUTE_LOCATION_TABLE = "attributes_location";
	private static final int MAX_ATTRIBUTES_PER_BATCH = 5000;
	public static final int BATCH_INSERT_SIZE = 2000;

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ATTRIBUTE_LOCATION_TABLE+"` (" +
						  "location varchar(128) NOT NULL," +
						  "attributeid INT(10) NOT NULL," +
						  "matches INT(10) NOT NULL," +
						  "PRIMARY KEY (location,attributeid)," +
						  "KEY attributeIdx (attributeid)," +
						  "KEY locationIdx (location)" +
						  " )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, ATTRIBUTE_LOCATION_TABLE)) {
			System.out.println("Clearing table: " + ATTRIBUTE_LOCATION_TABLE);
			db.clearTable(conn, ATTRIBUTE_LOCATION_TABLE);
		} else {			
			System.out.println("Creating table: " + ATTRIBUTE_LOCATION_TABLE);
			createTable(db, conn);
		}
		db.close(conn);
		
	}

	/**
	 * Get a map of location->attributeid->count where the attributes under a location contain 'count' ads at that location.
	 */
	private static void getAttributeLocations(int startAttrId, int endAttrId,
			AdLocationSet adLocations,
			HashMap<Integer, AttributeValue> allAttributes,
			HashMap<String, HashMap<Integer, Integer>> locationToAttributes) {

		// Open both databases
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();

		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		// Get the ad->attribute list mapping
		HashSet<Integer> ads = new HashSet<Integer>();
		HashMap<Integer,HashSet<Integer>> adsToAttributes = AttributeDetails.getAdsInAttributes(startAttrId, endAttrId, allAttributes, oculusconn, htconn, ads);

		for (Entry<Integer,HashSet<Integer>> adToAttributes:adsToAttributes.entrySet()) {
			Integer adid = adToAttributes.getKey();
			if (adid==null) continue;
			String location = adLocations.getLocation(adid);
			if (location==null) continue;
			HashMap<Integer, Integer> attributes = locationToAttributes.get(location);
			if (attributes==null) {
				attributes = new HashMap<Integer, Integer>();
				locationToAttributes.put(location, attributes);
			}
			for (Integer attrid:adToAttributes.getValue()) {
				Integer count = attributes.get(attrid);
				if (count==null) {
					attributes.put(attrid, 1);
				} else {
					attributes.put(attrid, count+1);
				}
			}
		}
		
		htdb.close(htconn);
		oculusdb.close(oculusconn);
		
	}

	
	
	private static void insertLocationClusterData(HashMap<String, HashMap<Integer,Integer>> resultMap) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + ATTRIBUTE_LOCATION_TABLE + "(location,attributeid,matches) VALUES (?,?,?)");
			int count = 0;
			for (Entry<String,HashMap<Integer,Integer>> e:resultMap.entrySet()) {
				String location = e.getKey();
				HashMap<Integer,Integer> clusters = e.getValue();
				for (Integer clusterId:clusters.keySet()) {
					if (clusterId==null) continue;
					Integer matches = clusters.get(clusterId);
					if (matches==null) continue;
					pstmt.setString(1,location);
					pstmt.setInt(2, clusterId);
					pstmt.setInt(3, matches);
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
	
	
	private static void computeLocations() {
		long start = System.currentTimeMillis();
		long end;
		System.out.print("Fetch ad locations...");
		AdLocationSet adLocations = AdLocations.getAdLocations();
		end = System.currentTimeMillis();
		System.out.println((end-start) + "ms");
		start = end;

		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		System.out.print("Fetch all attributes...");
		HashMap<Integer,AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
		oculusdb.close(oculusconn);
		end = System.currentTimeMillis();
		System.out.println((end-start) + "ms");
		start = end;

		HashMap<String,HashMap<Integer,Integer>> locationToAttributes = new HashMap<String,HashMap<Integer,Integer>>();
		int maxid = AttributeDetails.getMaxAttributeID();
		int count = 0;
		// Loop over all attributes, calculate details and write to database
		while (count<maxid) {
			// Calculate locations for count->count+MAX_ATTRIBUTES_PER_BATCH-1
			System.out.print("\tProcessing: " + count + " to " + (count+MAX_ATTRIBUTES_PER_BATCH-1));
			getAttributeLocations(count, count+MAX_ATTRIBUTES_PER_BATCH-1, adLocations, allAttributes, locationToAttributes);
			count+=MAX_ATTRIBUTES_PER_BATCH;
			end = System.currentTimeMillis();
			System.out.println(" in " + ((end-start)/1000) + " seconds.");
			start = end;
		}

		System.out.println("Inserting attribute locations: " + locationToAttributes.size());
		insertLocationClusterData(locationToAttributes);
	}

	public static void main(String[] args) {
		TimeLog tl = new TimeLog();

		tl.pushTime("Attribute location determination");
		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		initTable();
		computeLocations();
		tl.popTime();
	}

}
