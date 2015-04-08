/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * http://uncharted.software/
 *
 * Released under the MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package oculus.memex.rest;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;

import oculus.memex.clustering.AttributeDetails;
import oculus.memex.clustering.AttributeValue;
import oculus.memex.clustering.MemexAd;
import oculus.memex.clustering.WordCloudDetails;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.extraction.AdExtraction;
import oculus.memex.graph.AttributeLinks;
import oculus.memex.util.DataUtil;
import oculus.memex.util.TimeLog;
import oculus.xdataht.data.DataRow;
import oculus.xdataht.model.ClusterDetailsResult;
import oculus.xdataht.model.ClustersDetailsResult;
import oculus.xdataht.model.IntegerMap;
import oculus.xdataht.model.StringMap;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@Path("/attributeDetails")
public class AttributeDetailsResource  {
	@Context
	UriInfo _uri;

    private ClusterDetailsResult getResultFromMembers(HashSet<Integer> members, TimeLog log, String remoteUser) {
        List<DataRow> results = new ArrayList<DataRow>();

        log.pushTime("Fetch Ad Contents");
        PreclusterDetailsResource.getDetails(log, members, results, remoteUser);
        log.popTime();

        log.pushTime("Prepare results");

        ArrayList<HashMap<String,String>> details = DataUtil.sanitizeHtml(results);

        ArrayList<StringMap> serializableDetails = new ArrayList<StringMap>();
        for (HashMap<String,String> map : details) {
            serializableDetails.add( new StringMap(map));
        }
        log.popTime();

        log.pushTime("Computing word histograms");
        HashMap<String, HashMap<String,Integer>> adIdToWordHistogram = WordCloudDetails.getWordCountsForAdIds(details);

        ArrayList<IntegerMap> serializableHistograms = new ArrayList<IntegerMap>();
        for (StringMap sm : serializableDetails) {
            HashMap<String,Integer> wordHistogram = adIdToWordHistogram.get(sm.get("id"));
            serializableHistograms.add(new IntegerMap(wordHistogram));
        }
        log.popTime();

        log.popTime();
        return new ClusterDetailsResult(serializableDetails,serializableHistograms);
    }

    @GET
    @Path("images/{value}")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public ClusterDetailsResult handleGetImages(@PathParam("value")String value, @Context HttpServletRequest request) {
        String attribute = "images";
        TimeLog log = new TimeLog();
        log.pushTime("Attribute details: " + attribute + ":" + value);


        // Get ad ids with this image
        log.pushTime("Fetch Ad IDs");
        MemexOculusDB db = MemexOculusDB.getInstance();
        Connection conn = db.open();
        HashSet<Integer> members = MemexAd.getAdIdsWithValue(conn, "ads_imagebins", "bin", attribute, value);
        db.close(conn);
        log.popTime();

        // Build the rest of the result
        return getResultFromMembers(members,log,request.getRemoteUser());
    }

    @GET
    @Path("tip/{tip}")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public ClusterDetailsResult handleGetTip(@PathParam("tip")String tip, @Context HttpServletRequest request) {

        TimeLog log = new TimeLog();
        log.pushTime("Tip details: " + tip);


        // Get ad ids with this tip
        log.pushTime("Fetch Ad IDs");
        HashSet<Integer> members = GraphResource.fetchMatchingAds(tip,log);
        log.popTime();

        // Build the rest of the result
        return getResultFromMembers(members,log,request.getRemoteUser());
    }

	
	@GET
	@Path("{attribute}/{value}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public ClusterDetailsResult handleGet(@PathParam("attribute")String attribute, @PathParam("value")String value, @Context HttpServletRequest request) {

        TimeLog log = new TimeLog();
        log.pushTime("Attribute details: " + attribute + ":" + value);


        // Get ad ids with this attribute
        log.pushTime("Fetch Ad IDs");
        MemexOculusDB db = MemexOculusDB.getInstance();
        Connection conn = db.open();


        String attributeName = attribute;
        String attributeValue = value;
        if (attribute.equals("id")) {
            Integer attrId = Integer.parseInt(value);
            AttributeValue attrVal = AttributeLinks.getAttribute(conn, attrId);
            attributeName = attrVal.attribute;
            attributeValue = attrVal.value;
        }

        String tableName = null;
        if (attributeName.equals("phone")) {
            tableName = AdExtraction.ADS_PHONE_TABLE;
        } else if (attributeName.equals("email")) {
            tableName = AdExtraction.ADS_EMAILS_TABLE;
        } else if (attributeName.equals("website")) {
            tableName = AdExtraction.ADS_WEBSITES_TABLE;
        }

        HashSet<Integer> members = MemexAd.getAdIdsWithValue(conn, tableName, "value", attributeName, attributeValue);

        log.popTime();
        db.close(conn);

        // Build the rest of the result
        return getResultFromMembers(members,log,request.getRemoteUser());
	}
	
	/**
	 * 
	 * @param attributesIds
	 * @param request
	 * @return Map of attributeid --> ClusterDetailsResource
	 */
	@POST
	@Path("fetchAds")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public ClustersDetailsResult fetchAds(String attributesIds, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		log.pushTime("Fetching attribute graph ad details for user " + request.getRemoteUser());
		HashMap<Integer, ClusterDetailsResult> results = new HashMap<Integer, ClusterDetailsResult>();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection oculusconn;
		Connection htconn;

		try {
			JSONObject jo = new JSONObject(attributesIds);
			JSONArray attributeClusterIds = jo.getJSONArray("ids");
			oculusconn = oculusdb.open();
			HashMap<Integer,AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
			oculusdb.close(oculusconn);
			for(int i = 0;i<attributeClusterIds.length();i++) {
				Integer attrid = Integer.parseInt(attributeClusterIds.get(i).toString());

				// Get the ad->attribute list mapping
				log.pushTime("Fetch Ad IDs for cluster " + attrid);
				HashSet<Integer> ads = new HashSet<Integer>();
				htconn = htdb.open();
				oculusconn = oculusdb.open();
				HashMap<Integer,HashSet<Integer>> adToAttributes = AttributeDetails.getAdsInAttributes(attrid, attrid, allAttributes, oculusconn, htconn, ads);
				htdb.close(htconn);
				oculusdb.close(oculusconn);
				HashSet<Integer> members = new HashSet<Integer>(adToAttributes.keySet());
				log.popTime();
				
				log.pushTime("Fetch ad contents for cluster " + attrid);
				List<DataRow> result = new ArrayList<DataRow>();
				PreclusterDetailsResource.getDetails(log, members, result, request.getRemoteUser());
				log.popTime();

				log.pushTime("Prepare results for attribute cluster: " + attrid);
				ArrayList<HashMap<String,String>> details = DataUtil.sanitizeHtml(result);
				ArrayList<StringMap> serializableDetails = new ArrayList<StringMap>();
				for (HashMap<String,String> map : details) {
					serializableDetails.add( new StringMap(map));
				}
				results.put(attrid, new ClusterDetailsResult(serializableDetails));
				log.popTime();
			}			
			log.popTime();
			return new ClustersDetailsResult(results);
		} catch (JSONException e) {
			e.printStackTrace();
		}
		return null;
	}
	
	
	@GET
	@Path("getattrid/{attribute}/{value}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getAttributeId(@PathParam("attribute")String attribute, @PathParam("value")String value) {
		TimeLog log = new TimeLog();
		log.pushTime("Fetching attribute id for attribute " + attribute + ", value " + value);
		String result = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
            String sql = "SELECT id FROM " + AttributeDetails.ATTRIBUTE_TABLE + " WHERE attribute='"+attribute+"' AND value='"+value+"'";
            System.out.println(sql);
			ResultSet rs = stmt.executeQuery(sql);
			rs.next();
			result = rs.getString("id");
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(conn);
		log.popTime();
		return result;
	}
}