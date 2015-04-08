package oculus.memex.clustering;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;

public class ClusterAttributes {
	public static final int BATCH_SELECT_SIZE = 20000;
	public static final String CLUSTER_ATTRIBUTE_TABLE = "clusters_attributes";

	// [phone|email|website]->value->clusters
	private HashMap<String,HashMap<String,HashSet<Integer>>> _attributeToClusters = new HashMap<String,HashMap<String,HashSet<Integer>>>();

	// cluster->[phone|email|website]->value->count
	private HashMap<Integer,HashMap<String,HashMap<String,Integer>>> _clusterToAttributes = new HashMap<Integer,HashMap<String,HashMap<String,Integer>>>();

	public static void createClusterAttributeTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+CLUSTER_ATTRIBUTE_TABLE+"` (" +
						  "id INT NOT NULL AUTO_INCREMENT," +
						  "clusterid INT(10) NOT NULL," +
						  "attribute VARCHAR(32)," +
						  "value VARCHAR(2500)," +
						  "count INT," +
						  "PRIMARY KEY (id) )," +
						  "KEY `IX_" + CLUSTER_ATTRIBUTE_TABLE + "_clusterid` (`clusterid`)";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public static boolean initTable(MemexOculusDB db, Connection conn) {
		if (db.tableExists(conn, CLUSTER_ATTRIBUTE_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + CLUSTER_ATTRIBUTE_TABLE);
				db.clearTable(conn, CLUSTER_ATTRIBUTE_TABLE);
			}
		} else {
			System.out.println("Creating table: " + CLUSTER_ATTRIBUTE_TABLE);
			createClusterAttributeTable(db, conn);
			return true;
		}
		return false;
	}
	
	public void addValue(int clusterid, String attribute, String value, int addcount) {
		// Add attribute->value->cluster
		HashMap<String, HashSet<Integer>> attributeMap = _attributeToClusters.get(attribute);
		if (attributeMap==null) {
			attributeMap = new HashMap<String, HashSet<Integer>>();
			_attributeToClusters.put(attribute, attributeMap);
		}
		HashSet<Integer> clusters = attributeMap.get(value);
		if (clusters==null) {
			clusters = new HashSet<Integer>();
			attributeMap.put(value, clusters);
		}
		clusters.add(clusterid);

		// Add cluster->attribute->value
		HashMap<String, HashMap<String,Integer>> clusterAttributeMap = _clusterToAttributes.get(clusterid);
		if (clusterAttributeMap==null) {
			clusterAttributeMap = new HashMap<String, HashMap<String,Integer>>();
			_clusterToAttributes.put(clusterid, clusterAttributeMap);
		}
		HashMap<String,Integer> clusterValues = clusterAttributeMap.get(attribute);
		if (clusterValues==null) {
			clusterValues = new HashMap<String,Integer>();
			clusterAttributeMap.put(attribute, clusterValues);
		}
		Integer count = clusterValues.get(value);
		if (count==null) count = 0;
		clusterValues.put(value,count+addcount);
		
	}

	public HashMap<String, HashMap<String,Integer>> getClusterAttributes(int clusterid) {
		return _clusterToAttributes.get(clusterid);
	}
	
	public HashSet<Integer> getClusters(String attribute, String value) {
		HashMap<String, HashSet<Integer>> values = _attributeToClusters.get(attribute);
		if (values==null) return null;
		return values.get(value);
	}
	
	/**
	 * Populate the in memory cache from the database
	 */
	public void readFromDB(Connection oculusconn) {
		int maxID = MemexOculusDB.getInt(oculusconn, "select max(id) from "+ CLUSTER_ATTRIBUTE_TABLE, "Get max cluster attribute id");
		int nextID = 0;
		while (nextID<maxID) {
			String sqlStr = "SELECT clusterid,attribute,value,count from " + CLUSTER_ATTRIBUTE_TABLE + " where id>=" + nextID + " and id<" + (nextID+BATCH_SELECT_SIZE);
			nextID += BATCH_SELECT_SIZE;
			Statement stmt = null;
			try {
				stmt = oculusconn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					int id = rs.getInt("clusterid");
					String attribute = rs.getString("attribute");
					String value = rs.getString("value");
					int count = rs.getInt("count");
					addValue(id, attribute, value, count);
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
	}
	
	/**
	 * Insert all of the attribute values for the given cluster.
	 */
	public void insertValues(int clusterid, HashMap<String, HashSet<String>> attributes,
			ArrayList<String> clusterAttributes) {
		for (String attribute:clusterAttributes) {
			HashSet<String> values = attributes.get(attribute);
			if (values!=null) {
				for (String value:values) {
					addValue(clusterid, attribute, value, 1);
				}
			}
		}
	}			
	
	/**
	 * Write the cached cluster attribute values to the database
	 */
	public void writeToDatabase(MemexOculusDB db, Connection conn) {
		String sqlStr = "INSERT INTO "+CLUSTER_ATTRIBUTE_TABLE+"(clusterid,attribute,value,count)" + " values (?,?,?,?)";
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement(sqlStr);
			int count = 1;
			for (Integer clusterid:_clusterToAttributes.keySet()) {
				HashMap<String, HashMap<String, Integer>> attributes = _clusterToAttributes.get(clusterid);
				for (String attribute:attributes.keySet()) {
					HashMap<String, Integer> values = attributes.get(attribute);
					for (String value:values.keySet()) {
						Integer matches = values.get(value);
						pstmt.setInt(1, clusterid);
						pstmt.setString(2, attribute);
						pstmt.setString(3, value);
						pstmt.setInt(4, matches);
						pstmt.addBatch();
						count++;
						if (count%MemexOculusDB.BATCH_INSERT_SIZE==0) {
							pstmt.executeBatch();
						}
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

	/**
	 * Write the cached cluster attribute values to the database
	 */
	public void writeSubset(MemexOculusDB db, Connection conn, HashSet<Integer> clusterids) {
		String sqlStr = "INSERT INTO "+CLUSTER_ATTRIBUTE_TABLE+"(clusterid,attribute,value,count)" + " values (?,?,?,?)";
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement(sqlStr);
			int count = 1;
			for (Integer clusterid:clusterids) {
				HashMap<String, HashMap<String, Integer>> attributes = _clusterToAttributes.get(clusterid);
				for (String attribute:attributes.keySet()) {
					HashMap<String, Integer> values = attributes.get(attribute);
					for (String value:values.keySet()) {
						Integer matches = values.get(value);
						pstmt.setInt(1, clusterid);
						pstmt.setString(2, attribute);
						pstmt.setString(3, value);
						pstmt.setInt(4, matches);
						pstmt.addBatch();
						count++;
						if (count%MemexOculusDB.BATCH_INSERT_SIZE==0) {
							pstmt.executeBatch();
						}
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

	/**
	 * Get the cluster that has the most attributes in common with the ad. Return -1 if there are 
	 * no clusters with common attributes.
	 * @param attributeToClusters 
	 */
	public int getBestMatch(MemexAd ad, ArrayList<String> clusterAttributes) {
		HashMap<Integer,Integer> clusteridToMatchCount = new HashMap<Integer,Integer>();
		for (String attribute:clusterAttributes) {
			HashMap<String,HashSet<Integer>> clusterValues = _attributeToClusters.get(attribute);
			if (clusterValues==null) continue;
			HashSet<String> adValues = ad.attributes.get(attribute);
			if (adValues==null) continue;
			for (String adValue:adValues) {
				HashSet<Integer> matches = clusterValues.get(adValue);
				if (matches!=null) {
					for (Integer clusterid:matches) {
						Integer oldcount = clusteridToMatchCount.get(clusterid);
						Integer clustermatches = _clusterToAttributes.get(clusterid).get(attribute).get(adValue);
						clusteridToMatchCount.put(clusterid, (oldcount==null)?clustermatches:(oldcount+clustermatches));
					}
				}
			}
		}
		if (clusteridToMatchCount.size()>0) {
			int bestCluster = -1;
			int maxMatches = -1;
			for (Map.Entry<Integer,Integer> e:clusteridToMatchCount.entrySet()) {
				if (e.getValue()>maxMatches) {
					maxMatches = e.getValue();
					bestCluster = e.getKey();
				}
			}
			return bestCluster;
		}
		return -1;
	}

	/**
	 * Create the inverse mapping from cluster->attribute->values
	 */
	public HashMap<Integer,HashMap<String,HashSet<String>>> getClusterToAttributes() {
		HashMap<Integer,HashMap<String,HashSet<String>>> clusterToAttributes = new HashMap<Integer,HashMap<String,HashSet<String>>>();

		for (String attribute:_attributeToClusters.keySet()) {
			HashMap<String, HashSet<Integer>> values = _attributeToClusters.get(attribute);
			for (String value:values.keySet()) {
				HashSet<Integer> clusters = values.get(value);
				for (Integer cluster:clusters) {
					HashMap<String, HashSet<String>> resultAttributes = clusterToAttributes.get(cluster);
					if (resultAttributes==null) {
						resultAttributes = new HashMap<String, HashSet<String>>();
						clusterToAttributes.put(cluster, resultAttributes);
					}
					HashSet<String> resultValues = resultAttributes.get(attribute);
					if (resultValues==null) {
						resultValues = new HashSet<String>();
						resultAttributes.put(attribute, resultValues);
					}
					resultValues.add(value);
				}
			}
		}
		return clusterToAttributes;
		
	}

	public void setValues(Integer clusterid, HashMap<String, Integer> phonelist, HashMap<String, Integer> weblist, HashMap<String, Integer> emaillist) {
		for (Map.Entry<String, Integer> e:phonelist.entrySet()) {
			addValue(clusterid, "phone", e.getKey(), e.getValue());
		}
		for (Map.Entry<String, Integer> e:emaillist.entrySet()) {
			addValue(clusterid, "email", e.getKey(), e.getValue());
		}
		for (Map.Entry<String, Integer> e:weblist.entrySet()) {
			addValue(clusterid, "website", e.getKey(), e.getValue());
		}
	}

	public static void deleteValueAds(String attribute, String value) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		String sqlStr = "delete from " + CLUSTER_ATTRIBUTE_TABLE + " where value='" + value + "' and attribute='" + attribute + "'";
		DBManager.tryStatement(conn, sqlStr);
		db.close(conn);
	}

	public static void renameValueAds(String attribute, String oldValue, String newValue) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<Integer,Integer> oldCounts = new HashMap<Integer,Integer>();
		Statement stmt = null;
		String sqlStr = "select clusterid,count from " + CLUSTER_ATTRIBUTE_TABLE + " where value='" + oldValue + "' and attribute='" + attribute + "'";
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int id = rs.getInt("clusterid");
				int count = rs.getInt("count");
				oldCounts.put(id, count);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) { stmt.close(); }
			} catch (Exception e) {	e.printStackTrace(); }
		}

		HashMap<Integer,Integer> newCounts = new HashMap<Integer,Integer>();
		stmt = null;
		sqlStr = "select clusterid,count from " + CLUSTER_ATTRIBUTE_TABLE + " where value='" + newValue + "' and attribute='" + attribute + "'";
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int id = rs.getInt("clusterid");
				int count = rs.getInt("count");
				newCounts.put(id, count);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) { stmt.close(); }
			} catch (Exception e) {	e.printStackTrace(); }
		}

		for (Integer clusterid:oldCounts.keySet()) {
			Integer oldCount = oldCounts.get(clusterid);
			Integer newCount = newCounts.get(clusterid);
			if (newCount==null || newCount==0) {
				sqlStr = "update " + CLUSTER_ATTRIBUTE_TABLE + " set value='" + newValue + "' where clusterid=" + clusterid + " and value='" + oldValue + "' and attribute='" + attribute + "'";
				DBManager.tryStatement(conn, sqlStr);
			} else {
				sqlStr = "delete from " + CLUSTER_ATTRIBUTE_TABLE + " where clusterid=" + clusterid + " and value='" + oldValue + "' and attribute='" + attribute + "'";
				DBManager.tryStatement(conn, sqlStr);
				sqlStr = "update " + CLUSTER_ATTRIBUTE_TABLE + " set count=" + (oldCount+newCount) + " where clusterid=" + clusterid + " and value='" + newValue + "' and attribute='" + attribute + "'";
				DBManager.tryStatement(conn, sqlStr);
			}
		}
		db.close(conn);
	}


}
