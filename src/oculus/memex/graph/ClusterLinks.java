package oculus.memex.graph;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.Map.Entry;

import oculus.memex.clustering.ClusterAttributes;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;

/**
 * Create a table of organization clusterid -> related clusterid, link column, link value
 * 
 */
public class ClusterLinks {
	static final public String CLUSTER_LINKS_TABLE = "clusters_links";
	public static final int BATCH_INSERT_SIZE = 2000;

	public static class LinkData {
		Integer clusterid;
		String attribute;
		String value;
		public LinkData(Integer clusterid, String attribute, String value) {
			this.clusterid = clusterid;
			this.attribute = attribute;
			this.value = value;
		}
		
	}
	
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+CLUSTER_LINKS_TABLE+"` (" +
						  "linkid INT(11) NOT NULL AUTO_INCREMENT," +
						  "clusterid INT(11) NOT NULL," +
						  "otherid INT(11) NOT NULL," +
						  "attribute TEXT," +
						  "value TEXT," +
						  "PRIMARY KEY (linkid) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable(MemexOculusDB db, Connection conn) {
		if (db.tableExists(conn, CLUSTER_LINKS_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + CLUSTER_LINKS_TABLE);
				db.clearTable(conn, CLUSTER_LINKS_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + CLUSTER_LINKS_TABLE);
			createTable(db, conn);
		}
		
	}
	
	public static HashMap<Integer,ArrayList<LinkData>> doLinkCreation() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		ClusterAttributes attributesToClusters = new ClusterAttributes();
		attributesToClusters.readFromDB(conn);
		db.close(conn);

		HashMap<Integer,ArrayList<LinkData>> result = new HashMap<Integer,ArrayList<LinkData>>();

		HashMap<Integer,HashMap<String,HashSet<String>>> clusterToAttributes = attributesToClusters.getClusterToAttributes();
		
		createLinks(result, attributesToClusters, clusterToAttributes);
		
		return result;
	}
	
	public static void deleteClusterLinks(HashSet<Integer> clusterids) {
		if (clusterids.size()==0) return;
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		String clusterStr = StringUtil.hashSetToSqlList(clusterids);
		String sqlStr = "delete FROM " + CLUSTER_LINKS_TABLE + " where clusterid IN " + clusterStr;
		DBManager.tryStatement(oculusconn, sqlStr);
		oculusdb.close(oculusconn);
	}
	
	/**
	 * Given (clusterid->attribute->field values) and (attribute->field value->clusterids) 
	 * create a list of (clusterid1,clusterid2,commonvalue) links.
	 */
	private static void createLinksForClusters(HashMap<Integer, ArrayList<LinkData>> result,
			ClusterAttributes attributesToClusters,
			HashMap<Integer, HashMap<String, HashSet<String>>> clusterToAttributes, HashSet<Integer> clusterids) {

		deleteClusterLinks(clusterids);
		
		for (Integer clusterid:clusterids) {
			HashMap<String,HashSet<String>> attributeValues = clusterToAttributes.get(clusterid);
			ArrayList<LinkData> links = result.get(clusterid);
			for (String attribute:attributeValues.keySet()) {
				HashSet<String> values = attributeValues.get(attribute);
				for (String value:values) {
					HashSet<Integer> related = attributesToClusters.getClusters(attribute, value);
					for (Integer otherid:related) {
						// Make links only one direction
						if (otherid<clusterid) {
							if (links==null) {
								links = new ArrayList<LinkData>();
								result.put(clusterid, links);
							}
							links.add(new LinkData(otherid, attribute, value));
						}
					}
				}
			}
		}
	}

	/**
	 * Given (clusterid->attribute->field values) and (attribute->field value->clusterids) 
	 * create a list of (clusterid1,clusterid2,commonvalue) links.
	 */
	private static void createLinks(HashMap<Integer, ArrayList<LinkData>> result,
			ClusterAttributes attributesToClusters,
			HashMap<Integer, HashMap<String, HashSet<String>>> clusterToAttributes) {

		for (Map.Entry<Integer,HashMap<String,HashSet<String>>> entry:clusterToAttributes.entrySet()) {
			int clusterid = entry.getKey();
			HashMap<String,HashSet<String>> attributeValues = entry.getValue();
			ArrayList<LinkData> links = result.get(clusterid);
			for (String attribute:attributeValues.keySet()) {
				HashSet<String> values = attributeValues.get(attribute);
				for (String value:values) {
					HashSet<Integer> related = attributesToClusters.getClusters(attribute, value);
					for (Integer otherid:related) {
						// Make links only one direction
						if (otherid<clusterid) {
							if (links==null) {
								links = new ArrayList<LinkData>();
								result.put(clusterid, links);
							}
							links.add(new LinkData(otherid, attribute, value));
						}
					}
				}
			}
		}
	}
	
	public static void insertClusterLinks(String table, HashMap<Integer,ArrayList<LinkData>> linkMap) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + table + 
					"(clusterid, otherid, attribute, value) VALUES (?,?,?,?)");
			int count = 0;
			for (Entry<Integer,ArrayList<LinkData>> e:linkMap.entrySet()) {
				Integer clusterId = e.getKey();
				for (LinkData ld:e.getValue()) {
					pstmt.setInt(1, clusterId);
					pstmt.setInt(2, ld.clusterid);
					pstmt.setString(3, ld.attribute);
					pstmt.setString(4, ld.value);
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

	public static void computeLinks(HashSet<Integer> clusterids, ClusterAttributes attributesToClusters) {
		HashMap<Integer,ArrayList<LinkData>> linkTable = new HashMap<Integer,ArrayList<LinkData>>();

		HashMap<Integer,HashMap<String,HashSet<String>>> clusterToAttributes = attributesToClusters.getClusterToAttributes();
		createLinksForClusters(linkTable, attributesToClusters, clusterToAttributes, clusterids);
		insertClusterLinks(CLUSTER_LINKS_TABLE, linkTable);
	}
	
	private static void computeLinks() {
		System.out.println("Reading precluster data...");
		HashMap<Integer,ArrayList<LinkData>> linkTable = doLinkCreation();
		
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		initTable(db, conn);
		db.close(conn);
		System.out.println("Writing cluster links...");
		insertClusterLinks(CLUSTER_LINKS_TABLE, linkTable);
	}

	public static HashMap<Integer,HashMap<Integer,Pair<String,String>>> getLinks(Integer clusterid) {
		HashSet<Integer> clusterset = new HashSet<Integer>();
		clusterset.add(clusterid);
		return getLinks(clusterset);
	}

	/**
	 * Given a list of cluster ids, fetch related clusters and their link reasons. 
	 * Triples are (otherid, shared attribute, shared value).
	 */
	public static HashMap<Integer,HashMap<Integer,Pair<String,String>>> getLinks(HashSet<Integer> clusterids) {
		HashMap<Integer,HashMap<Integer,Pair<String,String>>> result = new HashMap<Integer,HashMap<Integer,Pair<String,String>>>();
		getLinks(result,CLUSTER_LINKS_TABLE,clusterids);
//		getLinks(result,ClusterImageBinLinks.CLUSTER_IMAGE_LINKS_TABLE,clusterids);
		return result;
	}
	
	public static HashMap<String, HashMap<String, HashSet<Integer>>> getAttributeLinkMap(Integer clusterid, HashMap<Integer, Pair<String, String>> links) {
		HashMap<String, HashMap<String, HashSet<Integer>>> result = new HashMap<String, HashMap<String, HashSet<Integer>>>();
		if(links == null) return result;
		String attribute, value;
		HashMap<String, HashSet<Integer>> attributeMap;
		HashSet<Integer> clusterSet;
		for(Integer id: links.keySet()) {
			Pair<String, String> pair = links.get(id);
			attribute = pair.getFirst();
			value = pair.getSecond();
			attributeMap = result.get(attribute);
			if(attributeMap == null) {
				attributeMap = new HashMap<String, HashSet<Integer>>();
				result.put(attribute, attributeMap);
			}
			clusterSet = attributeMap.get(value);
			if(clusterSet == null) {
				clusterSet = new HashSet<Integer>();
				attributeMap.put(value, clusterSet);
			}
			clusterSet.add(id);			
		}		
		return result;
	}
	
	private static void getLinks(HashMap<Integer,HashMap<Integer,Pair<String,String>>> result, String table, HashSet<Integer> clusterids) {
		if (clusterids==null || clusterids.size()==0) return;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		String clusterList = StringUtil.hashSetToSqlList(clusterids);
		String sqlStr = "SELECT clusterid,otherid,attribute,value from " + table
				+ " WHERE clusterid IN " + clusterList + " OR otherid IN " + clusterList;
		
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer clusterid = rs.getInt("clusterid");
				Integer otherid = rs.getInt("otherid");
				String attribute = rs.getString("attribute");
				String value = rs.getString("value");

				// Add the link (clusterid->otherid)
				HashMap<Integer,Pair<String,String>> links = result.get(clusterid);
				if (links==null) {
					links = new HashMap<Integer,Pair<String,String>>();
					result.put(clusterid, links);
				}
				links.put(otherid, new Pair<String,String>(attribute, value));

				// Add the reverse link (otherid->clusterid)
				links = result.get(otherid);
				if (links==null) {
					links = new HashMap<Integer,Pair<String,String>>();
					result.put(otherid, links);
				}
				links.put(clusterid, new Pair<String,String>(attribute, value));
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
	}

	public static void mergeClusters() {
		System.out.println("Read clusters...");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		String sqlStr = "SELECT clusterid,otherid from " + CLUSTER_LINKS_TABLE;
		HashMap<String,HashSet<String>> allLinks = new HashMap<String,HashSet<String>>();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String id1 = rs.getString("clusterid");
				String id2 = rs.getString("otherid");
				HashSet<String> set = allLinks.get(id1);
				if (set==null) {
					set = new HashSet<String>();
					allLinks.put(id1, set);
				}
				set.add(id2);
				set = allLinks.get(id2);
				if (set==null) {
					set = new HashSet<String>();
					allLinks.put(id2, set);
				}
				set.add(id1);
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

		System.out.println("Merge " + allLinks.size() + " clusters...");

		int maxSize = 0;
		int totalSize = 0;
		
		// Remove items from all links while creating connected sets in toMerge
		HashMap<String,HashSet<String>> toMerge = new HashMap<String,HashSet<String>>();
		while (allLinks.size()>0) {
			String clusterid = allLinks.keySet().iterator().next();
			HashSet<String> children = allLinks.remove(clusterid);
			toMerge.put(clusterid, children);
			@SuppressWarnings("unchecked")
			HashSet<String> toExplore = (HashSet<String>)children.clone();
			while (toExplore.size()>0) {
				String childid = toExplore.iterator().next();
				toExplore.remove(childid);
				HashSet<String> subChildren = allLinks.remove(childid);
				if (subChildren!=null) {
					for (String subChild:subChildren) {
						if (!children.contains(subChild)) {
							children.add(subChild);
							toExplore.add(subChild);
						}
					}
				}
			}
			if (children.size()>maxSize) {
				maxSize = children.size();
				System.out.println("Max Size: " + maxSize);
			}
			totalSize += children.size();
		}
		System.out.println("Average Size: " + (totalSize/toMerge.size()));
		System.out.println("Total Clusters: " + toMerge.size());
		db.close(conn);
	}

	public static void main(String[] args) {
		DateFormat dateFormat = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
		Calendar cal = Calendar.getInstance();
		System.out.println(dateFormat.format(cal.getTime()));

		System.out.println("Begin cluster links calculation...");
		long start = System.currentTimeMillis();

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		computeLinks();
//		mergeClusters();

		long end = System.currentTimeMillis();
		System.out.println("Done location cluster links calculation in: " + (end-start) + "ms");

	}
}