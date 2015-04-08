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
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import oculus.memex.clustering.AttributeValue;
import oculus.memex.clustering.Cluster;
import oculus.memex.clustering.ClusterLink;
import oculus.memex.clustering.MemexAd;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.elasticsearch.MemexAdSearch;
import oculus.memex.geo.Geocoder;
import oculus.memex.graph.AttributeLinks;
import oculus.memex.graph.ClusterGraph;
import oculus.memex.graph.ClusterImageBinLinks;
import oculus.memex.graph.ClusterLinks;
import oculus.memex.image.AdImages;
import oculus.memex.image.ImageHistogramHash;
import oculus.memex.init.PropertyManager;
import oculus.memex.training.InvalidateAttribute;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;
import oculus.xdataht.clustering.ClusterResults;
import oculus.xdataht.clustering.LinkFilter;
import oculus.xdataht.data.ClusterCache;
import oculus.xdataht.data.TableGraph;
import oculus.xdataht.model.AdvancedSearchRequest;
import oculus.xdataht.model.ClusterLevel;
import oculus.xdataht.model.GraphRequest;
import oculus.xdataht.model.GraphResult;
import oculus.xdataht.model.RestFilter;
import oculus.xdataht.model.RestLinkCriteria;
import oculus.xdataht.model.RestNode;
import oculus.xdataht.model.SimpleGraphRequest;
import oculus.xdataht.model.StringMap;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.restlet.resource.ResourceException;

@Path("/graph")
public class GraphResource  {

	public void mergeConnectivity(Map<String, List<ClusterLink>> c1, Map<String, List<ClusterLink>> c2) {
		for (String clusterId : c2.keySet()) {
			List<ClusterLink> oldLinks = c1.get(clusterId);
			List<ClusterLink> newLinks = c2.get(clusterId);
			if (oldLinks == null) {
				c1.put(clusterId,newLinks);
			} else {
				for (ClusterLink link : newLinks) {
					oldLinks.add(link);
				}
				c1.put(clusterId, oldLinks);
			}
		}
	}
	
	@POST
	@Path("link")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public GraphResult handlePost(GraphRequest request) throws ResourceException {
		GraphResult result = new GraphResult();
		TimeLog timeLog = new TimeLog();

		timeLog.pushTime("Advanced search (" + request.getDatasetName() + "," + request.getClustersetName() + ")");
		timeLog.pushTime("Setup");
		String datasetName = request.getDatasetName();

		String clustersetName = request.getClustersetName();

		ClusterResults clusterResults = ClusterCache.getResults(datasetName, clustersetName);
					
		ArrayList<RestFilter> restFilters = request.getFilters();
		if (restFilters == null) {
			restFilters = new ArrayList<RestFilter>();
		}
		
		ArrayList<RestLinkCriteria> linkCriteria = request.getLinkCriteria();
		if (linkCriteria == null) {
			linkCriteria = new ArrayList<RestLinkCriteria>();
		}

		timeLog.popTime();
		timeLog.pushTime("Get existing clusters");
		ArrayList<ClusterLevel> existingClusters = request.getExistingClusters();
		Map<String, Integer> existingNodes = new HashMap<String,Integer>();
		
		if (existingClusters != null) {
			for (ClusterLevel level : existingClusters) {
				String id = level.getId();
				Integer ring = level.getLevel();
				existingNodes.put(id, ring);
			}
		}
		
		if (clusterResults != null && linkCriteria != null) {
			
			timeLog.popTime();
			timeLog.pushTime("Get attributes of interest");

			// Get attributes of interest
			ArrayList<String> attributesOfInterest = new ArrayList<String>();
			for (RestLinkCriteria rlc : linkCriteria) {
				for (String attr : rlc.getAttributes()) {
					if (attributesOfInterest.indexOf(attr) == -1) {
						attributesOfInterest.add(attr);
					}
				}
			}

			// Compute connectivity adjacency lists

			timeLog.popTime();
			timeLog.pushTime("Get filters");
			ArrayList<LinkFilter> filters = getFilters(restFilters, attributesOfInterest);

			if (existingNodes.keySet().size() != 0) {
				timeLog.popTime();
				timeLog.pushTime("Fetching related clusters");
				List<String> newAndOldNodeList = getRelatedClusters(datasetName, clusterResults, existingNodes,	linkCriteria);
				
				// Recompute connectivity between all new nodes
				timeLog.popTime();
				timeLog.pushTime("Computing connectivity");
				Map<String, List<ClusterLink>> connectivity = clusterResults.getConnectivity(newAndOldNodeList, datasetName, linkCriteria);
				
				timeLog.popTime();
				timeLog.pushTime("Creating Graph");
				boolean onlyLinkedNodes = request.getOnlyLinkedNodes();
				TableGraph.create(clusterResults, newAndOldNodeList, connectivity, result, onlyLinkedNodes, datasetName, attributesOfInterest, existingNodes);
				
			} else {
				// Standard case, getting a graph
				timeLog.popTime();
				timeLog.pushTime("Filtering clusters");
				List<String> filteredClusters = clusterResults.dbFilter(filters);

				timeLog.popTime();
				timeLog.pushTime("Computing connectivity");
				Map<String, List<ClusterLink>> connectivity = clusterResults.getConnectivity(filteredClusters, datasetName, linkCriteria);
			
				timeLog.popTime();
				timeLog.pushTime("Creating Graph");
				boolean onlyLinkedNodes = request.getOnlyLinkedNodes();
				TableGraph.create(clusterResults, filteredClusters, connectivity, result, onlyLinkedNodes, datasetName, attributesOfInterest, existingNodes);
			}
			timeLog.popTime();
		}
		timeLog.popTime();
		
		return result;
	}

	public static String getPhone(String str) {
		String result = "";
		for (int i=0; i<str.length(); i++) {
			char c = str.charAt(i);
			if ('0'<=c && c<='9') {
				result += c;
			} else if (c=='('||c==')'||c=='-') {
				// do nothing
			} else {
				return null;
			}
		}
		return result;
	}
	
	public static String getLocation(String str) {
		String result = new String(str).toLowerCase();
		result = result.replaceAll("\\s+","");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Pair<Float,Float> pos = Geocoder.geocode(db, localConn, str);
		db.close(localConn);
		if (pos==null) return null;
		return result;
	}

    private GraphResult graphResultFromAdIds(HashSet<Integer> matchingAds, int ringcount, TimeLog timeLog) {
        if (matchingAds==null || matchingAds.size()==0) {
            return new GraphResult();
        }

        timeLog.pushTime("Get clusters for search results");

        // Fetch the clusters that correspond to the matching ads
        HashSet<Integer> matchingClusters = Cluster.getSimpleClusters(matchingAds);

        timeLog.popTime();
        timeLog.pushTime("Create result nodes");

        int[] clusterSizeRange = {Integer.MAX_VALUE, Integer.MIN_VALUE};
        GraphResult result = new GraphResult();

        ClusterGraph.fetchLinks(matchingClusters, clusterSizeRange, result, ringcount);

        normalizeAndSort(clusterSizeRange, result);

        timeLog.popTime();

        return result;
    }

    @POST
    @Path("advancedgraph")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    @Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public GraphResult advancedSearch(String requestStr) throws JSONException {
        TimeLog timeLog = new TimeLog();
        JSONObject request = new JSONObject(requestStr);
        AdvancedSearchRequest asr = new AdvancedSearchRequest(request);

        timeLog.pushTime("Advanced search (" + requestStr + ")");
        HashSet<Integer> matchingAds = MemexAdSearch.getAdIds("",asr,Integer.MAX_VALUE);
        timeLog.popTime();

        return graphResultFromAdIds(matchingAds,3, timeLog);
    }
	
	@POST
	@Path("simple")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public GraphResult simpleSearch(SimpleGraphRequest request) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Simple search (" + request.getSearchString() + "," + request.getClusterType() + ")");

		String search = request.getSearchString();
		HashSet<Integer> matchingAds = fetchMatchingAds(search, timeLog);
        timeLog.popTime();

        return graphResultFromAdIds(matchingAds,request.getRingCount(), timeLog);
	}
	
	@POST
	@Path("getlinkadids")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public String getLinkAdIds(String link, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		log.pushTime("Get Graph node link Ad IDs");
		String[] clusterIDs = link.split("_");
		HashSet<String> result = new HashSet<String>();		
		AttributeDetailsResource adr = new AttributeDetailsResource();
		HashSet<String> ad_ids = new HashSet<String>();
		ArrayList<StringMap> details = adr.handleGet("id", clusterIDs[0], request).getMemberDetails();
		for(int i = 0; i < details.size(); i++) {
			ad_ids.add(details.get(i).get("id"));
		}
		details = adr.handleGet("id", clusterIDs[1], request).getMemberDetails();
		String newID;
		for(int i = 0; i < details.size(); i++) {
			newID = details.get(i).get("id");
			if(ad_ids.contains(newID)) {
				result.add("\"" + details.get(i).get("id") + "\"");
			}
		}
		log.popTime();
		return result.toString();
	}

	static int USE_FULL_TEXT = 0; // 0->unknown, 1->yes, 2->no
	public static boolean useFullText() {
		if (USE_FULL_TEXT==0) {
			MemexHTDB htdb = MemexHTDB.getInstance();
			Connection htconn = htdb.open();
			String sqlStr = "SELECT DISTINCT column_name FROM INFORMATION_SCHEMA.STATISTICS WHERE (table_schema,table_name)=('" + ScriptDBInit._htSchema +"','ads') AND index_type='FULLTEXT'";
			int check = DBManager.getResultCount(htconn, sqlStr, "Full Text Index check");
			htdb.close(htconn);
			USE_FULL_TEXT = (check>0)?1:2;
		}
		return USE_FULL_TEXT==1;
	}	

	public static HashSet<Integer> fetchMatchingAds(String search, TimeLog timeLog) {
		timeLog.pushTime("Fetch matching ads");
		HashSet<Integer> matchingAds = null;
		String phone = getPhone(search);
		if (phone!=null) {
			timeLog.pushTime("Search Phone Numbers");
			matchingAds = MemexOculusDB.getPhoneAds("value = '"+phone+"'");
			timeLog.popTime();
			timeLog.popTime();
			return matchingAds;
		}

		String elasticURL = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_URL);
		if (elasticURL!=null && elasticURL.length()>5) {
			timeLog.pushTime("Elastic search for ads");
			HashSet<Integer> result =  MemexAdSearch.getAdIds(elasticURL, search, 2000);
			timeLog.popTime("results: " + result.size());
			timeLog.popTime();
			return result;
		}
		
		// Search the database for ads matching the search string
		String location = getLocation(search);
		if (location!=null) {
			timeLog.pushTime("Search Region");
			matchingAds = MemexHTDB.getAds("region like '%"+location+"%'");
		}
		if (matchingAds==null || matchingAds.size()==0) {
//				timeLog.pushTime("Search Text");
//				matchingAds = MemexOculusDB.getValueAds("ads_websites", search, false);
//				matchingAds.addAll(MemexOculusDB.getValueAds("ads_emails", search, false));
				if (useFullText()) {
					timeLog.pushTime("Search Full Text");
					matchingAds = MemexHTDB.getAds("match(text,title,email,website) against('"+search+"*' in boolean mode)");
				} else {
					timeLog.pushTime("Search Text Like");
					matchingAds = MemexHTDB.getAds("text like '%"+search+"%' or title like '%"+search+"%' or email like '%"+search+"%' or website like '%"+search+"%'");
				}
		}
		timeLog.popTime();
		timeLog.popTime();
		return matchingAds;
	}

	private static int PHONE_SELECT_BATCH_SIZE = 500;
	public static HashSet<Integer> fetchMatchingAds(String[] phones, TimeLog timeLog) {
		HashSet<Integer> matchingAds = new HashSet<Integer>();
		timeLog.pushTime("Fetch matching ads for " + phones.length + " phone numbers");
		int i=0;
		while (i<phones.length) {
			String whereClause = "value IN (";
			boolean isFirst = true;
			for (int idx = 0; (idx<PHONE_SELECT_BATCH_SIZE) && (i+idx<phones.length); idx++) {
				if (isFirst) isFirst = false;
				else whereClause += ",";
				whereClause += "'" + StringUtil.stripNonNumeric(phones[i+idx]) + "'";
			}
			i += PHONE_SELECT_BATCH_SIZE;
			whereClause += ")";
			matchingAds.addAll(MemexOculusDB.getPhoneAds(whereClause));
		}
		timeLog.popTime();
		return matchingAds;
	}

	@POST
	@Path("cluster")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public GraphResult clusterGraph(SimpleGraphRequest request) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Cluster graph (" + request.getSearchString() + "," + request.getClusterType() + ")");

		GraphResult result = new GraphResult();

		HashSet<Integer> matchingClusters = new HashSet<Integer>();
		matchingClusters.add(Integer.parseInt(request.getSearchString()));
		int[] clusterSizeRange = {Integer.MAX_VALUE, Integer.MIN_VALUE};

		ClusterGraph.fetchLinks(matchingClusters, clusterSizeRange, result, request.getRingCount());

		normalizeAndSort(clusterSizeRange, result);
		
		timeLog.popTime();
		
		return result;
	}

	@POST
	@Path("clustersummary")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String clusterSummary(String clusteridsString) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Fetching cluster summaries for " + clusteridsString);
		HashSet<Integer> clusterids = new HashSet<Integer>();
		try {
			JSONArray clusteridsArr = new JSONArray(clusteridsString);
			for(int i = 0; i<clusteridsArr.length();i++) {
				clusterids.add(clusteridsArr.getInt(i));
			}
		} catch (JSONException e) {
			e.printStackTrace();
			return null;
		}

		HashMap<Integer, HashMap<String, String>> summaries = ClusterGraph.getClusterSummary(clusterids);

		JSONObject result = new JSONObject();
		for (Integer id : summaries.keySet()) {
			JSONObject jsonSummary = new JSONObject();
			HashMap<String,String> summaryElements = summaries.get(id);
			try {
				for (String key : summaryElements.keySet()) {
					String value = summaryElements.get(key);
					jsonSummary.put(key, value);
				}
				result.put(id.toString(),jsonSummary);
			} catch (JSONException e) {
				throw new ResourceException(e);
			}
		}
		timeLog.popTime();
		return result.toString();
	}

	private JSONArray getAdAttributeDetails(HashSet<Integer> ads, String tableName, String attributeName, String columnName) throws JSONException {
		JSONArray result = new JSONArray();
        HashMap<Integer,MemexAd> resultMap = new HashMap<Integer,MemexAd>();

		String whereClause = "ads_id IN " + StringUtil.hashSetToSqlList(ads);

        MemexOculusDB db = MemexOculusDB.getInstance();
        Connection oculusconn = db.open();
		MemexAd.fetchAdsOculusAttribute(oculusconn, tableName, attributeName, columnName, whereClause, resultMap);

		HashMap<String,Integer> attributeMap = new HashMap<String, Integer>();
        HashSet<String> uniqueAttributeValues = new HashSet<String>();
		for (MemexAd ad : resultMap.values()) {
			HashSet<String> attributes = ad.attributes.get(attributeName);
			for (String attribute : attributes) {
				Integer count = attributeMap.get(attribute);
				if (count == null) {
					count = 0;
				}
				count++;
				attributeMap.put(attribute,count);
                uniqueAttributeValues.add(attribute);
			}
		}

        //HashMap<String,Integer> foreignCounts = MemexAd.fetchAdCountsForAttributes(oculusconn,tableName,columnName,uniqueAttributeValues);

        db.close(oculusconn);


        ArrayList<Pair<String,Integer>> kvps = new ArrayList<Pair<String,Integer>>();
        for (String key : attributeMap.keySet()) {
            Integer val = attributeMap.get(key);
            kvps.add(new Pair<String,Integer>(key,val));
        }

        Collections.sort(kvps, new Comparator<Pair<String,Integer>>() {
            public int compare(Pair<String,Integer> o1, Pair<String,Integer> o2) {
                Integer c1 = (Integer)o1.getSecond();
                Integer c2 = (Integer)o2.getSecond();
                return c2-c1;
            }
        });

        for(Pair<String,Integer> p : kvps) {
		    String key = (String)p.getFirst();
			Integer val = (Integer)p.getSecond();
			JSONObject obj = new JSONObject();
			obj.put(columnName,key);
			obj.put("count",val);

//            Integer foreignCount = foreignCounts.get(key);
//            if (foreignCount != null) {
//                obj.put("foreignCount",foreignCount);
//            }

			result.put(obj);
		}


		return result;
	}

    private JSONObject buildAttributeNode(String label, HashSet<Integer> adIds, TimeLog timeLog) {
        return buildAttributeNode(label,adIds,null,null,timeLog);
    }


    private JSONObject buildAttributeNode(String label, HashSet<Integer> adIds, String name, String value, TimeLog timeLog) {
		JSONObject jsNode = new JSONObject();
		try {
			jsNode.put("adcount", adIds.size());
			jsNode.put("label",label);
			jsNode.put("clustername",label);

            String id = "-1";
            if (name != null && value != null) {
                id = "attributeNode_" + name + "_" + value;
            }

			jsNode.put("clusterid",id);

			JSONObject jsAttributes = new JSONObject();
			jsAttributes.put("phone",getAdAttributeDetails(adIds,"ads_phones","phone","value"));
			jsAttributes.put("email",getAdAttributeDetails(adIds,"ads_emails","email", "value"));
            jsAttributes.put("website", getAdAttributeDetails(adIds,"ads_websites","website","value"));
			jsAttributes.put("images",getAdAttributeDetails(adIds,"ads_imagebins","images","bin"));

			jsNode.put("attributes",jsAttributes);

		} catch (JSONException e) {
			e.printStackTrace();
		}

		timeLog.popTime();

		return jsNode;
	}

    @POST
    @Path("attributenodefromid")
    @Consumes({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String attributeNodeFromId(String attributeidStr, @Context HttpServletRequest request) throws ResourceException {
        TimeLog timeLog = new TimeLog();
        int attributeid = Integer.parseInt(attributeidStr);

        try {
            timeLog.pushTime("Fetching Attribute (id="+attributeidStr+")");

            MemexOculusDB oculusdb = MemexOculusDB.getInstance();
            Connection oculusconn = oculusdb.open();
            AttributeValue attribute = AttributeLinks.getAttribute(oculusconn,attributeid);
            oculusdb.close(oculusconn);
            timeLog.popTime();

            if (attribute == null) {
                return null;
            } else {
                return fetchAttributeNode(attribute.attribute,attribute.value,timeLog).toString();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return "";
    }

    private JSONObject fetchAttributeNode(String attributeName, String attributeValue, TimeLog timeLog) {
        timeLog.pushTime("Searching Attributes (" + attributeName + "," + attributeValue + ")");

        MemexOculusDB db = MemexOculusDB.getInstance();
        Connection conn = db.open();

        String tableName = null;
        String columnName = "value";
        if (attributeName.equals("phone")) {
            tableName = "ads_phones";
        } else if (attributeName.equals("website")) {
            tableName = "ads_websites";
        } else if (attributeName.equals("email")) {
            tableName = "ads_emails";
        } else if (attributeName.equals("images")) {
            tableName = "ads_imagebins";
            columnName = "bin";
        } else if (attributeName.equals("image")) {
        	HashSet<Integer> imageids = ImageHistogramHash.getIdsForSha1(conn, attributeValue);
        	HashSet<Integer> adids = AdImages.getMatchingAds(imageids);
            db.close(conn);
            return buildAttributeNode(attributeName + " : " + attributeValue,adids,attributeName,attributeValue,timeLog);
        }


        HashSet<Integer> adIds = MemexAd.getAdIdsWithValue(conn, tableName, columnName, attributeName, attributeValue);
        db.close(conn);
        return buildAttributeNode(attributeName + " : " + attributeValue,adIds,attributeName,attributeValue,timeLog);
    }

	@POST
	@Path("attributenode")
    @Consumes({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String attributeNode(String jsonData, @Context HttpServletRequest request) throws ResourceException {
		TimeLog timeLog = new TimeLog();

        try {
            JSONObject data = new JSONObject(jsonData);

            String attributeName = data.getString("attributeName");
            String attributeValue = data.getString("attributeValue");

            return fetchAttributeNode(attributeName,attributeValue,timeLog).toString();

        } catch (JSONException e) {
            e.printStackTrace();
        }

        return "";
	}

    @POST
    @Path("advanced")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String advancedNode(String paramsStr, @Context HttpServletRequest request) throws ResourceException {
    	
    	String elasticURL = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_URL);
    	
		if (elasticURL == null || elasticURL.length() <= 5) {
			// TODO: Bail out here ... return empty response
		}

        try {
            JSONObject params = new JSONObject(paramsStr);
            TimeLog timeLog = new TimeLog();
            timeLog.pushTime("Advanced searching " + paramsStr);
            HashSet<Integer> adIds = MemexAdSearch.getAdIds(elasticURL, new AdvancedSearchRequest(params), 2000); // @TODO @HACK : limit this to 2000 ads for now
            timeLog.popTime(adIds.size() + " results returned.");

            timeLog.pushTime("Building attribute node");
            JSONObject tipResult = buildAttributeNode("Advanced Search", adIds, timeLog);        // TODO:  clever way of labelling?
            try {
                tipResult.put("label", tipResult.getString("label") + " search results");
            } catch (Exception e) {
                e.printStackTrace();
            }

            return tipResult.toString();
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return "{}";
    }


	@POST
	@Path("tipnode")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String tipNode(String tipString, @Context HttpServletRequest request) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Searching Tip " + tipString);

		HashSet<Integer> adIds = fetchMatchingAds(tipString, timeLog);
        JSONObject tipResult = buildAttributeNode(tipString,adIds, timeLog);
        try {
            String label;
            if (adIds.size() == 0) {
                label = "No Results for \"" + tipResult.getString("label") + "\"";
            } else {
                label = tipResult.getString("label") + " search results";
            }
            tipResult.put("label", label);
        } catch (Exception e) {
            e.printStackTrace();
        }

		return tipResult.toString();
	}


	@POST
	@Path("clusternode")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String clusterNode(String clusteridString) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Cluster node " + clusteridString);

		int clusterid = Integer.parseInt(clusteridString,10);

		HashMap<Integer, HashMap<Integer, Pair<String, String>>> links = ClusterLinks.getLinks(clusterid);
		HashMap<Integer, HashMap<String, String>> details = ClusterGraph.getClusterDetails(clusterid);

		timeLog.pushTime("Fetch details for node " + clusterid);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<String,ArrayList<Pair<String, Integer>>> attributes = Cluster.getClusterAttributes(db, conn, clusterid);
		db.close(conn);
		HashMap<String,String> clusterdetails = details.get(clusterid);
		JSONObject jsNode = new JSONObject();
		if (clusterdetails != null) {
			try {
				jsNode.put("adcount", Integer.parseInt(clusterdetails.get("adcount")));
				jsNode.put("label", clusterdetails.get("clustername"));
				jsNode.put("clusterid", clusterid);
				jsNode.put("latestad", clusterdetails.get("latestad"));
				HashMap<String, HashMap<String, HashSet<Integer>>> attributeLinkMap = ClusterLinks.getAttributeLinkMap(clusterid, links.get(clusterid));
				JSONObject jsattributes = new JSONObject();
				jsNode.put("attributes", jsattributes);
				HashMap<String, HashSet<Integer>> attributeLinkTotals = new HashMap<String, HashSet<Integer>>();
				for (String attribute : attributes.keySet()) {
					ArrayList<Pair<String, Integer>> vals = attributes.get(attribute);
					JSONArray jsattribute = new JSONArray();
					jsattributes.put(attribute, jsattribute);
					for (int i = 0; i < vals.size(); i++) {
						Pair<String, Integer> val = vals.get(i);
						JSONObject jsvalue = new JSONObject();
						jsvalue.put("value", val.getFirst());
						jsvalue.put("count", val.getSecond());
						HashMap<String, HashSet<Integer>> attributeMap = attributeLinkMap.get(attribute);
						if (attributeMap != null) {
							HashSet<Integer> clusters = attributeMap.get(val.getFirst());
							if (clusters != null) {
								jsvalue.put("links", clusters);
								HashSet<Integer> attributeLinks = attributeLinkTotals.get(attribute);
								if (attributeLinks == null) {
									attributeLinks = new HashSet<Integer>();
									attributeLinkTotals.put(attribute, attributeLinks);
								}
								attributeLinks.addAll(clusters);
							}
						}
						jsattribute.put(jsvalue);
					}
					HashSet<Integer> attributeLinks = attributeLinkTotals.get(attribute);
					if (attributeLinks != null) {
						jsattributes.put(attribute + "_links", attributeLinks);
					}
				}

				getJSONClusterImages(clusterid, jsattributes);

			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		timeLog.popTime();

		timeLog.popTime();
		return jsNode.toString();
	}

	private void getJSONClusterImages(Integer clusterid, JSONObject jsattributes)	throws JSONException {
		JSONArray jsimages = new JSONArray();
		jsattributes.put("images", jsimages);
		HashSet<Integer> allLinks = new HashSet<Integer>();
		HashMap<Integer, Integer> exemplars = ClusterImageBinLinks.getExemplars(clusterid);
		HashMap<Integer, HashSet<Integer>> links = ClusterImageBinLinks.getLinks(clusterid);
		for (Map.Entry<Integer, Integer> entry:exemplars.entrySet()) {
			JSONObject jsvalue = new JSONObject();
			Integer bin = entry.getKey();
			HashSet<Integer> binlinks = links.get(bin);
			jsvalue.put("bin", bin);
			jsvalue.put("count", entry.getValue());
			JSONArray jslinks = new JSONArray();
			if (binlinks!=null) {
				for (Integer link:binlinks) {
					jslinks.put(link);
					allLinks.add(link);
				}
			}
			jsvalue.put("links", jslinks);
			jsimages.put(jsvalue);
		}
		if (allLinks.size()>0) {
			jsattributes.put("images_links",allLinks);
		}
	}

	@POST
	@Path("image")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public GraphResult imageGraph(SimpleGraphRequest request) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Image graph (" + request.getSearchString() + "," + request.getClusterType() + ")");

		GraphResult result = new GraphResult();

		String search = request.getSearchString();
		String type = request.getClusterType();
		if (search==null) {
			timeLog.popTime();
			return result;
		}

		String hash = search;
		if (type.compareTo("id")==0) {
			HashSet<String> imageid = new HashSet<String>();
			imageid.add(search);
			
			// Find image hash
			timeLog.pushTime("Fetch image hashes");
			HashMap<String,String> hashes = ImageHistogramHash.getHashes(imageid);
			hash = hashes.get(search);
			if (hash==null) {
				timeLog.popTime();
				return result;
			}
			timeLog.popTime();
		}
		
		// Find all imageids with the hash
		HashSet<Integer> imageids;
		HashSet<Integer> matchingAds;
		imageids = ImageHistogramHash.getIdsSql(hash);
		matchingAds = AdImages.getMatchingAds(imageids);
		
		// Find clusters matching ads
		HashSet<Integer> matchingClusters = Cluster.getSimpleClusters(matchingAds);		
		
		int[] clusterSizeRange = {Integer.MAX_VALUE, Integer.MIN_VALUE};
		ClusterGraph.fetchLinks(matchingClusters, clusterSizeRange, result, request.getRingCount());

		normalizeAndSort(clusterSizeRange, result);
		
		timeLog.popTime();
		
		return result;
	}

	@POST
	@Path("attribute/{attribute}/{value}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public GraphResult attributeGraph(@PathParam("attribute")String attribute, @PathParam("value")String value) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Attribute graph (" + attribute + "," + value + ")");

		GraphResult result = new GraphResult();

		HashSet<AttributeValue> matchingAttributes = new HashSet<AttributeValue>();
		matchingAttributes.add(new AttributeValue(attribute,value));
		int[] clusterSizeRange = {Integer.MAX_VALUE, Integer.MIN_VALUE};

		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		HashMap<Integer, AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
		oculusdb.close(oculusconn);
		
		ClusterGraph.fetchAttributeLinks(matchingAttributes, allAttributes, clusterSizeRange, result, 3);

		normalizeAndSort(clusterSizeRange, result);
		
		timeLog.popTime();
		
		return result;
	}

	@POST
	@Path("attributeid/{attributeid}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public GraphResult attributeIdGraph(@PathParam("attributeid")int attributeid) throws ResourceException {
		TimeLog timeLog = new TimeLog();
		timeLog.pushTime("Attribute graph (" + attributeid + ")");

		GraphResult result = new GraphResult();

		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		HashMap<Integer, AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
		oculusdb.close(oculusconn);
		
		HashSet<AttributeValue> matchingAttributes = new HashSet<AttributeValue>();
		AttributeValue primaryAV = allAttributes.get(attributeid);
		if (primaryAV == null) {
			timeLog.popTime();
			return null;
		}
		matchingAttributes.add(primaryAV);
		int[] clusterSizeRange = {Integer.MAX_VALUE, Integer.MIN_VALUE};

		ClusterGraph.fetchAttributeLinks(matchingAttributes, allAttributes, clusterSizeRange, result, 3);

		normalizeAndSort(clusterSizeRange, result);
		
		timeLog.popTime();
		
		return result;
	}

	@POST
	@Path("invalidate/{attribute}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public void invalidateValue(@PathParam("attribute")String attribute, String value) throws ResourceException {
		InvalidateAttribute.invalidateValueStatic(attribute, value);
	}

	private void normalizeAndSort(int[] clusterSizeRange, GraphResult result) {
		double range = clusterSizeRange[1]-clusterSizeRange[0];
		for (RestNode rnode : result.getNodes()) {
			int size = (int)(rnode.getSize());
			if (range==0) {
				rnode.setSize(0);
			} else {
				double normalizedSize = (size - clusterSizeRange[0])/range;
				rnode.setSize(normalizedSize);
			}
		}
		Collections.sort(result.getNodes(), new Comparator<RestNode>() {
			public int compare(RestNode o1, RestNode o2) {
				Integer ring1 = (Integer)o1.getRing();
				Integer ring2 = (Integer)o2.getRing();
				if (ring2==ring1) {
					Integer size1 = (Integer)o1.getClusterSize();
					Integer size2 = (Integer)o2.getClusterSize();
					return size2-size1;
				}
				return ring1-ring2;
			}
		});
	}

	public static void updateMap(String id, String fieldStr, HashMap<String,HashSet<String>> map) {
		if (fieldStr==null || fieldStr.length()==0) return;
		String[] values = fieldStr.split(",");
		for (String v:values) {
			if (v==null||v.length()==0) continue;
			HashSet<String> idList = map.get(v);
			if (idList==null) {
				idList = new HashSet<String>();
				map.put(v, idList);
			}
			idList.add(id);
		}
	}

	private ArrayList<LinkFilter> getFilters(ArrayList<RestFilter> restFilters,
			ArrayList<String> attributesOfInterest) {
		ArrayList<LinkFilter> filters = new ArrayList<LinkFilter>();
		for (RestFilter restFilter : restFilters) {
			LinkFilter lf = new LinkFilter(restFilter);
			filters.add(lf);
			if (!(lf.filterAttribute.equals("Cluster Size")||lf.filterAttribute.equals("tag"))) {
				attributesOfInterest.add(lf.filterAttribute);
			}
		}
		return filters;
	}

	private List<String> getRelatedClusters(String datasetName,
			ClusterResults clusterResults, Map<String, Integer> existingNodes,
			ArrayList<RestLinkCriteria> linkCriteria) {
		// Create list from node map
		List<String> existingNodeList = new ArrayList<String>();
		for (String clusterId : existingNodes.keySet()) {
			existingNodeList.add(clusterId);
		}
		
		// Get all clusters that don't exist already
		List<String> otherClusters = clusterResults.filter(existingNodes);
		
		// Get connectivity between other clusters and existing clusters
		System.out.print("\tComputing new connectivity between new nodes and old nodes...");
		Map<String,List<ClusterLink>> newAndOldConnectivity = clusterResults.getConnectivity(otherClusters, existingNodeList, datasetName, linkCriteria, true);
		System.out.println("done");
		
		// Merge existing nodes and nodes that are now connected to find a master list of every node we need to display
		Set<String> newAndOldNodes = new HashSet<String>();
		for (String connectedCluster : newAndOldConnectivity.keySet()) {
			newAndOldNodes.add(connectedCluster);
		}
		for (String oldClusterId : existingNodeList) {
			newAndOldNodes.add(oldClusterId);
		}
		List<String> newAndOldNodeList = new ArrayList<String>();
		newAndOldNodeList.addAll(newAndOldNodes);
		return newAndOldNodeList;
	}
}