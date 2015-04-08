package oculus.memex.rest;

import java.math.BigInteger;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;

import oculus.memex.casebuilder.CaseBuilder;
import oculus.memex.clustering.AttributeDetails;
import oculus.memex.clustering.ClusterDetails;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.util.DataUtil;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;
import oculus.xdataht.model.ClusterDetailsResult;
import oculus.xdataht.model.StringMap;

import org.json.JSONException;
import org.json.JSONObject;

@Path("/casebuilder")
public class CaseBuilderResource {

	@Context
	UriInfo _uri;
	
	private int getCaseSize(MemexOculusDB db, Connection conn, int id) {
		String sqlStr = "SELECT COUNT(*) AS count FROM " + CaseBuilder.CASE_TABLE + 
				" JOIN " + CaseBuilder.CASE_CONTENTS_TABLE + 
				" WHERE id=? AND id=case_id;";
		
		try {
			PreparedStatement pstmt = conn.prepareStatement(sqlStr);
			pstmt.setInt(1,id);
			ResultSet rs = pstmt.executeQuery();
			if(rs.next())
				return rs.getInt("count");
			return -1;
		} catch (SQLException e) {
			e.printStackTrace();
			return -2;
		}
	}

	private int getCaseId(Connection conn, String case_name, String user_name) {
		int result = -1;
		try {
			PreparedStatement pstmt = conn.prepareStatement("SELECT id FROM " + CaseBuilder.CASE_TABLE + 
					" WHERE case_name=? AND user_name=?");
			pstmt.setString(1, case_name);
			pstmt.setString(2, user_name);
			ResultSet rs = pstmt.executeQuery();
			if(rs.next())
				result = rs.getInt("id");
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return result;
	}

	private HashSet<Integer> getClustersInCase(MemexOculusDB db, int id, boolean is_attribute) {
		HashSet<Integer> result = new HashSet<Integer>();
		String sqlStr = "SELECT cluster_id FROM " + CaseBuilder.CASE_TABLE + " JOIN " + CaseBuilder.CASE_CONTENTS_TABLE +
				" WHERE id=case_id AND id=? AND is_attribute=?";
		Connection conn = db.open();
		try {
			PreparedStatement pstmt = conn.prepareStatement(sqlStr);
			pstmt.setInt(1, id);
			pstmt.setBoolean(2,is_attribute);
			ResultSet rs = pstmt.executeQuery();
			while(rs.next()) {
				result.add(rs.getInt("cluster_id"));
			}
		} catch (SQLException e) {
			e.printStackTrace();
			result = null;
		}
		db.close(conn);
		return result;
	}

	/** 
	 * @param name The case name being tested.
	 * @param user_name 
	 * @param conn 
	 * @param db 
	 * @return True if there exists a case with the String name provided.
	 */
	private boolean caseExists(String case_name, String user_name, MemexOculusDB db, Connection conn) {
		try {
			PreparedStatement pstmt = 
					conn.prepareStatement("SELECT * FROM " + CaseBuilder.CASE_TABLE + 
							" WHERE case_name=? AND user_name=?");
			pstmt.setString(1, case_name);
			pstmt.setString(2, user_name);
			ResultSet rs = pstmt.executeQuery();
			boolean result = rs.next();
			pstmt.close();
			return result;			
		} catch (SQLException e) {
			e.printStackTrace();
			return true;
		}
	}

	private boolean getCaseVisibility(MemexOculusDB db, int id) {
		boolean result = false;
		Connection conn = db.open();
		PreparedStatement pstmt;		
		try {
			pstmt = conn.prepareStatement("SELECT public FROM " + CaseBuilder.CASE_TABLE + " WHERE id=?");
			pstmt.setInt(1, id);
			ResultSet rs = pstmt.executeQuery();
			if(rs.next())
				result = rs.getBoolean("public");
		} catch (SQLException e) {
			e.printStackTrace();
		}		
		db.close(conn);
		return result;
	}
	
	private class CaseDetails {
		String case_name;
		String case_owner;
		int case_id;		
		public CaseDetails(String caseDetailsString) {
			super();
			JSONObject caseJSON = new JSONObject();
			try {
				caseJSON = new JSONObject(caseDetailsString);
			} catch (JSONException e) {
				e.printStackTrace();
			}
			try {
				this.case_name = caseJSON.getString("case_name");
			} catch (JSONException e) {
				e.printStackTrace();
			}
			try {
				this.case_owner = caseJSON.getString("case_owner");
			} catch (JSONException e) {
				e.printStackTrace();
			}
			try {
				this.case_id = caseJSON.getInt("case_id");
			} catch (JSONException e) {
				e.printStackTrace();
			}
		}
		public String getCase_name() {
			return case_name;
		}
		public String getCase_owner() {
			return case_owner;
		}
		public int getCase_id() {
			return case_id;
		}	
	}

	@GET
	@Path("getuser")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getUser(@Context HttpServletRequest request) {
		String user = request.getRemoteUser();
		return "{\"user\":\"" + user + "\"}";
	}
	
	@POST
	@Path("createcase")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String createCase(String case_name, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		String user_name = request.getRemoteUser();
		log.pushTime("create case: " + case_name + " for user: " + user_name);
		JSONObject result = new JSONObject();
		case_name = DataUtil.sanitizeHtml(case_name);
		String uniqueName = case_name;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		int ver = 2;
		while(caseExists(uniqueName, user_name, db, conn)){
			uniqueName=case_name+"_"+ver;
			ver++;
		}
		try {
			PreparedStatement pstmt = conn.prepareStatement("INSERT INTO " + 
					CaseBuilder.CASE_TABLE + " (case_name,user_name) VALUES (?,?)");
			pstmt.setString(1, uniqueName);
			pstmt.setString(2, user_name);
			int rslt = pstmt.executeUpdate();
			if (rslt > -1) {
				result.put("case_name", uniqueName);
				result.put("case_id", getCaseId(conn, uniqueName, user_name));
			}  else {
				result.put("Error","Could not create case " + uniqueName);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} catch (JSONException e) {
			e.printStackTrace();
		}
		db.close(conn);
		log.popTime();
		return result.toString();		
	}

	@GET
	@Path("getcases")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getCases(@Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		String user_name = request.getRemoteUser();
		log.pushTime("Get case names for user: " + user_name);
		StringBuilder result = new StringBuilder("{\"cases\": ");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		ArrayList<JSONObject> c = new ArrayList<JSONObject>();
		String sqlStr = "SELECT id, case_name, user_name FROM " + CaseBuilder.CASE_TABLE + 
				" WHERE user_name='" + user_name + "' OR public ORDER BY case_name";
		Statement stmt;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while(rs.next()) {
				JSONObject record = new JSONObject();
				record.put("case", rs.getString("case_name"));
				record.put("owner", rs.getString("user_name"));
				record.put("id", rs.getInt("id"));
				c.add(record);
			}
			stmt.close();			
			result.append(c.toString()+"}");
		} catch (SQLException e) {
			e.printStackTrace();
			result = new StringBuilder("{\"Success\": \"SQL Error\"}");
		} catch (JSONException e) {
			e.printStackTrace();
			result = new StringBuilder("{\"Success\": \"JSON Error\"}");
		}
		db.close(conn);
		log.popTime();
		return result.toString();
	}

	@POST
	@Path("getcasedetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getCaseDetails(String id) {
		JSONObject result = new JSONObject();
		TimeLog log = new TimeLog();
		log.pushTime("Get case details");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();		
		try {	
			PreparedStatement pstmt = conn.prepareStatement("SELECT case_name, user_name FROM " + 
					CaseBuilder.CASE_TABLE + " WHERE id=?");
			pstmt.setInt(1, Integer.parseInt(id));
			ResultSet rs = pstmt.executeQuery();
			if(rs.next()) {
				result.put("case_name", rs.getString("case_name"));
				result.put("user_name", rs.getString("user_name"));
			} else {
				result.put("Error","Case with id " + id + " does not exist");
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} catch (JSONException e) {
			e.printStackTrace();
		}		
		db.close(conn);
		log.popTime();
		return result.toString();
	}
	
	@POST
	@Path("getcase")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getCase(String caseDetailsString, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		CaseDetails caseDetails = new CaseDetails(caseDetailsString);		
		String case_name = caseDetails.getCase_name();
		String user_name = request.getRemoteUser();
		log.pushTime("Get case: " + case_name + " for user: " + user_name);
		String result = null;
		MemexOculusDB db = MemexOculusDB.getInstance();	
		Connection conn = db.open();
		try {
			int id = caseDetails.getCase_id();
			user_name = caseDetails.getCase_owner();
			boolean isPublic = getCaseVisibility(db, id);
			String attributeIds = StringUtil.hashSetToSqlList(getClustersInCase(db, id, true));
			String clusterIds = StringUtil.hashSetToSqlList(getClustersInCase(db, id, false));
			ResultSet rs;
			Statement stmt = conn.createStatement();
			JSONObject records = new JSONObject();
			ArrayList<JSONObject> nodes = new ArrayList<JSONObject>();
			if(!clusterIds.equals("()")) {
				rs = stmt.executeQuery("SELECT clusterid, adcount, clustername, latestad FROM " + 
						ClusterDetails.CLUSTER_DETAILS_TABLE + " WHERE clusterid IN " + clusterIds +
						" ORDER BY adcount DESC");			
				while(rs.next()) {
					JSONObject record = new JSONObject();
					record.put("ATTRIBUTE_MODE", "false");
					record.put("Cluster Size", rs.getString("adcount"));
					record.put("label", rs.getString("clustername"));
					record.put("id", rs.getInt("clusterid"));
					record.put("latestad", rs.getDate("latestad"));
					nodes.add(record);
				}
			}
			if(!attributeIds.equals("()")) {
				rs = stmt.executeQuery("SELECT id, adcount, value, latestad FROM " + 
						AttributeDetails.ATTRIBUTE_DETAILS_TABLE + " WHERE id IN " + attributeIds + 
						" ORDER BY adcount DESC");			
				while(rs.next()) {
					JSONObject record = new JSONObject();
					record.put("ATTRIBUTE_MODE", "true");
					record.put("Cluster Size", rs.getString("adcount"));
					record.put("label", rs.getString("value"));
					record.put("id", rs.getInt("id"));
					record.put("latestad", rs.getDate("latestad"));
					nodes.add(record);
				}
			}
			stmt.close();			
			if(nodes.isEmpty()) {
				result = "{\"" + case_name + "\": [], \"public\": " + isPublic + "}";
			} else {
				records.put(case_name, nodes.toArray());
				records.put("public",isPublic);
				result = records.toString();
			}
		} catch (SQLException e) {
			e.printStackTrace();
			result = "{\"Success\": \"SQL Error\"}";
		} catch (JSONException e) {
			e.printStackTrace();
			result = "{\"Success\": \"JSON Error\"}";
		}
		db.close(conn);
		log.popTime();
		return result;
	}

	
	@POST
	@Path("getsummarydetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getSummaryDetails(String av) {
		TimeLog log = new TimeLog();		
		log.pushTime("Get summary details");
		String result = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			JSONObject avJSON = new JSONObject(av);
			String attribute = avJSON.getString("attribute");
			String value = avJSON.getString("value");

            // Attributes table is indexed on name/value.   Pull the matching name/value out of that table (quick) to get the id, and do a join on the details table
            // which IS indexed on id.
            String sql = "SELECT " + AttributeDetails.ATTRIBUTE_DETAILS_TABLE + ".id, adcount, latestad FROM "
                    + AttributeDetails.ATTRIBUTE_TABLE +
                    " INNER JOIN " + AttributeDetails.ATTRIBUTE_DETAILS_TABLE + " ON " + AttributeDetails.ATTRIBUTE_TABLE + ".id=" + AttributeDetails.ATTRIBUTE_DETAILS_TABLE + ".id " +
                    " WHERE " + AttributeDetails.ATTRIBUTE_TABLE + ".attribute=? AND " + AttributeDetails.ATTRIBUTE_TABLE + ".value=?";

			PreparedStatement pstmt = conn.prepareStatement(sql);
			pstmt.setString(1, attribute);
			pstmt.setString(2, value);

			ResultSet rs = pstmt.executeQuery();
			if(rs.next()){
				JSONObject summaryDetails = new JSONObject();
				summaryDetails.put("label", value);
				summaryDetails.put("id",rs.getString("id"));
				summaryDetails.put("Cluster Size", rs.getString("adcount"));
				summaryDetails.put("latestad", rs.getDate("latestad"));
				summaryDetails.put("ATTRIBUTE_MODE", true);
				result = "{\"details\":" + summaryDetails.toString() + "}";
			} else {
				result = "{\"Error\": \"could not find cluster " + value + "\"}";
			}
		} catch (JSONException e) {
			e.printStackTrace();
			result = "{\"Error\": \"JSON Exception\"}";
		} catch (SQLException e) {
			e.printStackTrace();
			result = "{\"Error\": \"SQL Exception\"}";
		}
		db.close(conn);
		log.popTime();
		return result;
	}
	@POST
	@Path("savecase")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String saveCase(String caseAdditions, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		String user_name = request.getRemoteUser();
		log.pushTime("Save case for user: " + user_name);
		String result = null;
		JSONObject jo = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			jo = new JSONObject(caseAdditions);
			PreparedStatement pstmt = null;
			CaseDetails caseDetails = new CaseDetails(jo.getString("caseDetailsString"));		
			String case_name = caseDetails.getCase_name();
			int id = caseDetails.getCase_id();
			if(!user_name.equals(caseDetails.getCase_owner())) {
				db.close(conn);
				return "{\"Success\": \"" + user_name + " does not own " + case_name + "\"}";
			}
			pstmt = conn.prepareStatement("INSERT IGNORE INTO " + CaseBuilder.CASE_CONTENTS_TABLE + 
					" (case_id, cluster_id, is_attribute) VALUES (?,?,?)");
			String attrs = jo.getString("true");
			String clust = jo.getString("false");
			if(attrs.length()>0) {
				String[] attributes = attrs.split(",");
				for(int i = 0; i<attributes.length; i++) {
					pstmt.setInt(1, id);
					pstmt.setInt(2, Integer.parseInt(attributes[i]));
					pstmt.setBoolean(3, true);
					pstmt.addBatch();
				}
			}
			if(clust.length()>0) {
				String[] clusters = clust.split(",");
				for(int i = 0; i<clusters.length; i++) {
					pstmt.setInt(1, id);
					pstmt.setInt(2, Integer.parseInt(clusters[i]));
					pstmt.setBoolean(3, false);
					pstmt.addBatch();
				}
			}
			pstmt.executeBatch();
			pstmt.close();
			JSONObject resultObj = new JSONObject();
			resultObj.put("Success", "true");
			resultObj.put("nodeCount", Integer.toString(getCaseSize(db, conn, id)));
			result = resultObj.toString();
		} catch (JSONException e) {
			e.printStackTrace();
			result = "{\"Success\": \"JSON parsing Error\"}";
		} catch (SQLException e) {
			e.printStackTrace();
			result = "{\"Success\": \"SQL Error\"}";
		}
		db.close(conn);
		log.popTime();
		return result;
	}

	@POST
	@Path("deletecase")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String deleteCase(String caseDetailsString, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		String user_name = request.getRemoteUser();
		CaseDetails caseDetails = new CaseDetails(caseDetailsString);
		log.pushTime("Delete Case: " + caseDetails.getCase_name() + " for user: " + user_name);
		String result = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		PreparedStatement pstmt;
		try {
			pstmt = conn.prepareStatement("DELETE FROM " + CaseBuilder.CASE_TABLE + 
					" WHERE id=?");
			pstmt.setInt(1, caseDetails.getCase_id());
			int response = pstmt.executeUpdate();
			if(response!=-1) {
				result = "{\"Success\": \"true\"}";
			} else {
				result = "{\"Success\": \"false\"}";
			}
		} catch (SQLException e) {
			e.printStackTrace();
			result = "{\"Success\": \"SQL Error\"}";
		}
		db.close(conn);
		log.popTime();
		return result;
	}

	@POST
	@Path("deletenode")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String deleteNode(String node, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		String user_name = request.getRemoteUser();
		log.pushTime("Delete Node: " + node + " for user: " + user_name);
		String result = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		PreparedStatement pstmt;
		JSONObject jo;		
		try {
			jo = new JSONObject(node);
			int case_id = jo.getInt("case_id");
			pstmt = conn.prepareStatement("DELETE FROM " + CaseBuilder.CASE_CONTENTS_TABLE +
					" WHERE case_id=? AND cluster_id=? AND is_attribute=?");
			pstmt.setInt(1, case_id);
			pstmt.setInt(2, jo.getInt("cluster_id"));
			pstmt.setBoolean(3, jo.getBoolean("is_attribute"));
			int response = pstmt.executeUpdate();
			int count = getCaseSize(db, conn, case_id);
			if(response!=-1) {
				result = "{\"Success\": \"true\", \"Count\": \"" + count + "\"}";
			} else {
				result = "{\"Success\": \"false\"}";
			}
		} catch (JSONException e) {
			e.printStackTrace();
			result = "{\"Success\": \"JSON parsing Error\"}";
		} catch (SQLException e) {
			e.printStackTrace();
			result = "{\"Success\": \"SQL Error\"}";
		}
		db.close(conn);
		log.popTime();
		return result;
	}

	@POST
	@Path("togglepublic")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String togglePublic(String case_id, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		log.pushTime("Toggle Public: case_id: " + case_id + " for user: " + request.getRemoteUser());
		String result = "{\"Error\": \"SQL Error\"}";
		String sqlStr = "UPDATE " + CaseBuilder.CASE_TABLE + " SET public = !public "
				+ "WHERE id=?";
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		PreparedStatement pstmt;		
		try {
			pstmt = conn.prepareStatement(sqlStr);
			pstmt.setInt(1, Integer.parseInt(case_id));
			int response = pstmt.executeUpdate();
			if(response==1) {
				result = "{\"Success\": \"true\"}";
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
		db.close(conn);
		log.popTime();
		return result;
	}
	
	@POST
	@Path("csv")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public ClusterDetailsResult getCSV(String caseDetailsString, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		ArrayList<StringMap> result = new ArrayList<StringMap>();
		
		CaseDetails caseDetails = new CaseDetails(caseDetailsString);
		String case_name = caseDetails.getCase_name();
		int id = caseDetails.getCase_id();
		
		log.pushTime("Get CSV: " + case_name + " for user: " + request.getRemoteUser());
		
		ArrayList<StringMap> details = new ArrayList<StringMap>();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		
		log.pushTime("Get CSV org cluster details");
		HashSet<Integer> orgClusters = getClustersInCase(oculusdb, id, false);
		PreclusterDetailsResource pdr = new PreclusterDetailsResource();
		for(Integer cluster: orgClusters) {
			details = pdr.handleGet("org", cluster, request).getMemberDetails();
			for(int i = 0; i < details.size(); i++){
				StringMap map = details.get(i);
				map.put("isAttribute", "false");
				map.put("clusterId", cluster.toString());
				result.add(map);
			}
		}
		log.popTime();
		
		log.pushTime("Get CSV attribute cluster details");		
		HashSet<Integer> attributeClusters = getClustersInCase(oculusdb, id, true);
		AttributeDetailsResource adr = new AttributeDetailsResource();
		for(Integer cluster: attributeClusters) {
			details = adr.handleGet("id", Integer.toString(cluster), request).getMemberDetails();
			for(int i = 0; i < details.size(); i++){
				StringMap map = details.get(i);
				map.put("isAttribute", "true");
				map.put("clusterId", cluster.toString());
				result.add(map);
			}
		}
		log.popTime();

		Collections.sort(result, new Comparator<StringMap>() {
			public int compare(StringMap o1, StringMap o2) {
				String d1 = o2.getmap().get("posttime");
				String d2 = o1.getmap().get("posttime");
				if (d1==null && d2==null) return 0;
				if (d1==null) return -1;
				if (d2==null) return 1;
				return (new BigInteger(d1)).compareTo(new BigInteger(d2));					
			}
		});
		
		log.popTime();
		return new ClusterDetailsResult(result);
	}
}