package oculus.memex.graph;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import oculus.memex.clustering.AttributeDetails;
import oculus.memex.clustering.AttributeValue;
import oculus.memex.clustering.ClusterDetails;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.util.DataUtil;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;
import oculus.xdataht.model.GraphResult;
import oculus.xdataht.model.RestLink;
import oculus.xdataht.model.RestNode;
import oculus.xdataht.model.StringMap;

import org.json.JSONObject;

public class ClusterGraph {
	private static final int MAX_GRAPH_SIZE = 300;

	public static HashMap<Integer,HashMap<String,String>> getClusterDetails(Integer clusterid) {
		HashSet<Integer> clusteridset = new HashSet<Integer>();
		clusteridset.add(clusterid);
		return getClusterDetails(clusteridset);
	}

	public static HashMap<Integer,HashMap<String,String>> getClusterDetails(HashSet<Integer> clusterids) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		String sqlStr = "SELECT clusterid,adcount,phonelist,emaillist,weblist,namelist,ethnicitylist,timeseries,locationlist,sourcelist,keywordlist,clustername,latestad FROM " + 
				ClusterDetails.CLUSTER_DETAILS_TABLE + " WHERE clusterid IN " + StringUtil.hashSetToSqlList(clusterids);
		HashMap<Integer,HashMap<String,String>> result = new HashMap<Integer,HashMap<String,String>>();
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer clusterid = rs.getInt("clusterid");
				String clustername = rs.getString("clustername");
				if (clustername==null) clustername = "";
				HashMap<String, String> details = getDetailsFromSQL(rs);
				details.put("clustername",clustername);
				result.put(clusterid, details);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
		db.close(localConn);
		return result;
	}

	public static HashMap<Integer,HashMap<String,String>> getClusterSummary(Integer clusterid) {
		HashSet<Integer> clusteridset = new HashSet<Integer>();
		clusteridset.add(clusterid);
		return getClusterSummary(clusteridset);
	}

	public static HashMap<Integer,HashMap<String,String>> getClusterSummary(HashSet<Integer> clusterids) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		String sqlStr = "SELECT clusterid,adcount,clustername FROM " +
				ClusterDetails.CLUSTER_DETAILS_TABLE + " WHERE clusterid IN " + StringUtil.hashSetToSqlList(clusterids);
		HashMap<Integer,HashMap<String,String>> result = new HashMap<Integer,HashMap<String,String>>();
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer clusterid = rs.getInt("clusterid");
				String clustername = rs.getString("clustername");
				if (clustername==null) clustername = "";
				HashMap<String, String> summary = new HashMap<String, String>();
				summary.put("adcount", rs.getString("adcount"));
				summary.put("clustername", clustername);
				result.put(clusterid, summary);
			}
		} catch (Exception e) {
            System.err.println("ERROR EXECUTING: " + sqlStr);
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
		db.close(localConn);
		return result;
	}

	private static HashMap<Integer,HashMap<String,String>> getAttributeDetails(HashSet<Integer> attrids) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		String sqlStr = "SELECT id,adcount,phonelist,emaillist,weblist,namelist,ethnicitylist,timeseries,locationlist,sourcelist,keywordlist,attribute,value,latestad FROM " + 
				AttributeDetails.ATTRIBUTE_DETAILS_TABLE +
				" WHERE id IN (";
		boolean isFirst = true;
		for (Integer attrid:attrids) {
			if (isFirst) isFirst = false;
			else sqlStr += ",";
			sqlStr += attrid;
		}
		sqlStr += ")";
		HashMap<Integer,HashMap<String,String>> result = new HashMap<Integer,HashMap<String,String>>();
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer attrid = rs.getInt("id");
				String attrValue = rs.getString("value");
				if (attrValue==null) attrValue = "";
				HashMap<String, String> details = getDetailsFromSQL(rs);				
				String attribute = rs.getString("attribute");
				details.put("attribute", attribute==null?"":attribute);				
				details.put("name",attrValue);
				result.put(attrid, details);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
		db.close(localConn);
		return result;
	}

	public static HashMap<String, String> getDetailsFromSQL(ResultSet rs)
			throws SQLException {
		int adcount = rs.getInt("adcount");
		String phonelist = rs.getString("phonelist");
		String emaillist = rs.getString("emaillist");
		String weblist = rs.getString("weblist");
		String namelist = rs.getString("namelist");
		String ethnicitylist = rs.getString("ethnicitylist");
		String timeseries = rs.getString("timeseries");
		String locationlist = rs.getString("locationlist");
		String sourcelist = rs.getString("sourcelist");
		String keywordlist = rs.getString("keywordlist");
		String latestad = rs.getString("latestad");
		if (phonelist==null) phonelist = "";
		if (emaillist==null) emaillist = "";
		if (weblist==null) weblist = "";
		if (namelist==null) namelist = "";
		if (ethnicitylist==null) ethnicitylist = "";
		if (timeseries==null) timeseries = "";
		if (locationlist==null) locationlist = "";
		if (sourcelist==null) sourcelist = "";
		if (keywordlist==null) keywordlist = "";
		if (latestad==null) latestad = "";
		if (latestad.length()>10)
			latestad=latestad.substring(0,10);
		HashMap<String,String> details = new HashMap<String,String>();
		details.put("adcount", "" + adcount);
		details.put("phonelist",phonelist);
		details.put("emaillist",emaillist);
		details.put("weblist",weblist);
		details.put("namelist",namelist);
		details.put("ethnicitylist",ethnicitylist);
		details.put("timeseries",timeseries);
		details.put("locationlist",locationlist);
		details.put("sourcelist",sourcelist);
		details.put("keywordlist",keywordlist);
		details.put("latestad",latestad);
		return details;
	}

	@SuppressWarnings("unchecked")
	public static void fetchAttributeLinks(HashSet<AttributeValue> matchingAttributes,
			HashMap<Integer, AttributeValue> allAttributes, int[] clusterSizeRange, GraphResult result, int ringCount) {

		// Find all links for each ring. Add new values to matching attributes. Keep track of inner rings.
		ArrayList<HashSet<AttributeValue>> rings = new ArrayList<HashSet<AttributeValue>>();
		HashMap<AttributeValue, HashMap<AttributeValue,Integer>> allAttributeLinks = null;
		for (int i=0; i<ringCount-1; i++) {
			rings.add((HashSet<AttributeValue>)matchingAttributes.clone());
			if (matchingAttributes.size()>MAX_GRAPH_SIZE) continue;
			allAttributeLinks = AttributeLinks.getLinks(matchingAttributes);
			for (AttributeValue attr:allAttributeLinks.keySet()) {
				matchingAttributes.add(attr);
				if (matchingAttributes.size()>MAX_GRAPH_SIZE) break;
			}
		}

		HashMap<AttributeValue,Integer> attributeToId = new HashMap<AttributeValue,Integer>();
		for (Entry<Integer,AttributeValue> e:allAttributes.entrySet()) {
			attributeToId.put(e.getValue(), e.getKey());
		}
		
		HashSet<Integer> attrids = new HashSet<Integer>();
		for (AttributeValue av:matchingAttributes) {
			attrids.add(attributeToId.get(av));
		}
		
		// Get all the details for all the attributes
		HashMap<Integer, HashMap<String, String>> attributeDetails = getAttributeDetails(attrids);

		// Create RestNode results for all of the details
		for (Map.Entry<Integer, HashMap<String, String>> attributeDetailEntry:attributeDetails.entrySet()) {
			Integer attributeid = attributeDetailEntry.getKey();
			AttributeValue av = allAttributes.get(attributeid);
			HashMap<String,String> details = attributeDetailEntry.getValue();
			RestNode rn = new RestNode();
			rn.setId(Integer.toString(attributeid));
			rn.setLatestad(details.get("latestad"));
			rn.setAttribute(details.get("attribute"));
			boolean found = false;
			for (int i=0; i<ringCount-1; i++) {
				if (rings.get(i).contains(av)) {
					rn.setRing(i);
					found = true;
					break;
				}
			}
			if (!found) rn.setRing(ringCount-1);
			int count = Integer.parseInt(details.get("adcount"));
			rn.setClusterSize(count);
			rn.setSize(count);
			if (count<clusterSizeRange[0]) clusterSizeRange[0] = count;
			if (count>clusterSizeRange[1]) clusterSizeRange[1] = count;
			HashMap<AttributeValue,Integer> links = allAttributeLinks.get(av);
			HashSet<String> linkReasons = new HashSet<String>();

			if (links!=null && links.size()>0) {
				ArrayList<StringMap> outlinks = new ArrayList<StringMap>(links.size());
				for (Entry<AttributeValue,Integer> e:links.entrySet()) {
					AttributeValue av2 = e.getKey();
					Integer attrid2 = attributeToId.get(av2);
					StringMap destLink = new StringMap();
					outlinks.add(destLink);
					linkReasons.add("\"" + av2.attribute + " (" + av2.value + ")\":" + e.getValue());
					if (av.value.compareTo(av2.value)>0) {
						result.addLink(new RestLink(Integer.toString(attributeid), Integer.toString(attrid2), e.getValue(), av2.attribute));
						destLink.put("id", attributeid + "_" + attrid2);
						destLink.put("other", Integer.toString(attrid2));
					} else {
						destLink.put("id", attrid2 + "_" + attributeid);
						destLink.put("other", Integer.toString(attrid2));
					}
				}
				rn.setLinks(outlinks);
			}
			String linkReasonStr = linkReasons.toString();
			details.put("linkreasons",linkReasonStr.substring(1,linkReasonStr.length()-1));
			attributeAttributes(rn, details);
			result.addNode(rn);
		}
	}

	
	@SuppressWarnings("unchecked")
	public static void fetchLinks(HashSet<Integer> matchingClusters, int[] clusterSizeRange, GraphResult result, int ringCount) {

		// Create links between the subsequent layers out to ring count
		ArrayList<HashSet<String>> rings = new ArrayList<HashSet<String>>();
		HashMap<Integer, HashMap<Integer,Pair<String, String>>> allClusterLinks = null;
		for (int i=0; i<ringCount-1; i++) {
			rings.add((HashSet<String>)matchingClusters.clone());
			if (matchingClusters.size()>MAX_GRAPH_SIZE) continue;
			allClusterLinks = ClusterLinks.getLinks(matchingClusters);
			for (HashMap<Integer,Pair<String, String>> singleClusterLinks:allClusterLinks.values()) {
				for (Integer otherid:singleClusterLinks.keySet()) {
					matchingClusters.add(otherid);
					if (matchingClusters.size()>MAX_GRAPH_SIZE) break;
				}
				if (matchingClusters.size()>MAX_GRAPH_SIZE) break;
			}
		}

		// Get all the details for all the clusters
		HashMap<Integer, HashMap<String, String>> clusterDetails = getClusterDetails(matchingClusters);

		for (Map.Entry<Integer, HashMap<String, String>> clusterDetailEntry:clusterDetails.entrySet()) {
			Integer clusterid = clusterDetailEntry.getKey();
			HashMap<String,String> details = clusterDetailEntry.getValue();
			RestNode rn = new RestNode();
			rn.setId(Integer.toString(clusterid));
			rn.setLatestad(details.get("latestad"));
			boolean found = false;
			for (int i=0; i<ringCount-1; i++) {
				if (rings.get(i).contains(clusterid)) {
					rn.setRing(i);
					found = true;
					break;
				}
			}
			if (!found) rn.setRing(ringCount-1);
			int count = Integer.parseInt(details.get("adcount"));
			rn.setClusterSize(count);
			rn.setSize(count);
			if (count<clusterSizeRange[0]) clusterSizeRange[0] = count;
			if (count>clusterSizeRange[1]) clusterSizeRange[1] = count;
			HashMap<Integer,Pair<String, String>> links = allClusterLinks.get(clusterid);
			HashSet<String> linkReasons = new HashSet<String>();

			if (links!=null && links.size()>0) {
				ArrayList<StringMap> outlinks = new ArrayList<StringMap>(links.size());
				for (Map.Entry<Integer, Pair<String,String>> e:links.entrySet()) {
					StringMap destLink = new StringMap();
					outlinks.add(destLink);
					String attribute = e.getValue().getFirst();
					String value = e.getValue().getSecond();
					linkReasons.add(attribute + " (" + value + ")");
					if (clusterid.compareTo(e.getKey())>0) {
						result.addLink(new RestLink(Integer.toString(clusterid), Integer.toString(e.getKey()), 0, attribute));
						destLink.put("id", clusterid + "_" + e.getKey());
					} else {
						destLink.put("id", e.getKey() + "_" + clusterid);
					}
					destLink.put("other", Integer.toString(e.getKey()));
					destLink.put("attribute", attribute);
					destLink.put("value", value);
				}
				rn.setLinks(outlinks);
			}
			orgClusterAttributes(rn, details, linkReasons);
			result.addNode(rn);
		}
		
	}
	
	/**
	 * Return the first value as the title and other values separated by ,s and \ns from
	 * data of the form key1:count1,key2:count2
	 */
	@SuppressWarnings("rawtypes")
	private static String orgTooltipString(String listStr) {
		if (listStr==null || listStr.length()==0) return "";
		try {
			Map<String,Integer> map = new HashMap<String,Integer>();
			JSONObject jo = new JSONObject("{"+listStr+"}");
			Iterator iter = jo.keys();
			while (iter.hasNext()) {
				String val = (String)iter.next();
				map.put(DataUtil.sanitizeHtml(val), Integer.parseInt(jo.getString(val)));
			}
			String valueStr = "";
			boolean isFirst = true;
			int count = 0;
			for (String key:sortByValue(map).keySet()) {
				if (isFirst) {
					isFirst = false;
					if(key.equals("none")){
						if(map.size()<2) return "";
						else continue;
					}
				} else if(key.equals("none")) {
					continue;
				} else {
					valueStr += "\n";
				}
				int num = map.get(key);
				valueStr += num + "\t" + key;
				count++;
				if (count>10) {
					valueStr += "\n&hellip;";
					break;
				}
			}
			return valueStr;
		} catch (Exception e) {
			e.printStackTrace();
		}
		return "";
	}
	
	private static void setTooltipDetail(String title, String accessor, RestNode rn, HashMap<String, String> details,
			StringMap attributes) {
		String detailList = details.get(accessor);
		String detailStr = orgTooltipString(detailList);
		attributes.put(title, detailStr);
	}


	private static void attributeAttributes(RestNode rn, HashMap<String, String> details) {
		StringMap attributes = new StringMap();
		rn.setName(details.get("name"));
		rn.setLabel(details.get("name"));

		setTooltipDetail("Email Addresses", "emaillist", rn, details, attributes);
		setTooltipDetail("Phone Numbers", "phonelist", rn, details, attributes);
		setTooltipDetail("Websites", "weblist", rn, details, attributes);
		setTooltipDetail("Link Reasons", "linkreasons", rn, details, attributes);

		rn.setAttributes(attributes);
	}

	
	private static void orgClusterAttributes(RestNode rn,
			HashMap<String, String> details, HashSet<String> linkReasons) {
		StringMap attributes = new StringMap();
		rn.setName(details.get("clustername"));
		rn.setLabel(details.get("clustername"));

		setTooltipDetail("Email Addresses", "emaillist", rn, details, attributes);
		setTooltipDetail("Phone Numbers", "phonelist", rn, details, attributes);
		setTooltipDetail("Websites", "weblist", rn, details, attributes);
		String linkReasonsStr = "";
		for (String lr:linkReasons) linkReasonsStr += lr + "\n";
		attributes.put("Link Reasons", linkReasonsStr);
		
		rn.setAttributes(attributes);
	}

	private static <K, V extends Comparable<? super V>> Map<K, V> sortByValue(
			Map<K, V> map) {
		List<Map.Entry<K, V>> list = new LinkedList<Map.Entry<K, V>>(map.entrySet());
		
		Collections.sort(list, new Comparator<Map.Entry<K, V>>() {
			public int compare(Map.Entry<K, V> o1, Map.Entry<K, V> o2) {
				return (o2.getValue()).compareTo(o1.getValue());
			}
		});

		Map<K, V> result = new LinkedHashMap<K, V>();
		for (Map.Entry<K, V> entry : list) {
			result.put(entry.getKey(), entry.getValue());
		}
		return result;
	}

}
