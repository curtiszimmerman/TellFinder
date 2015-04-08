/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 *
 * Property of Uncharted (TM), formerly Oculus Info Inc.
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

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package oculus.memex.rest;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URL;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;

import javax.imageio.ImageIO;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;

import oculus.memex.aggregation.AttributeLocation;
import oculus.memex.aggregation.LaborCategory;
import oculus.memex.aggregation.LaborLocationTimeAggregation;
import oculus.memex.aggregation.LocationCluster;
import oculus.memex.aggregation.LocationTimeAggregation;
import oculus.memex.aggregation.SourceAggregation;
import oculus.memex.aggregation.TimeAggregation;
import oculus.memex.aggregation.TimeLaborAggregation;
import oculus.memex.clustering.AttributeDetails;
import oculus.memex.clustering.AttributeValue;
import oculus.memex.clustering.Cluster;
import oculus.memex.clustering.ClusterDetails;
import oculus.memex.clustering.MemexAd;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.elasticsearch.MemexAdSearch;
import oculus.memex.geo.AdLaborLocations;
import oculus.memex.geo.Demographics;
import oculus.memex.geo.Locations;
import oculus.memex.graph.AttributeLinks;
import oculus.memex.image.AdImages;
import oculus.memex.image.ImageHistogramHash;
import oculus.memex.init.PropertyManager;
import oculus.memex.util.Pair;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;
import oculus.xdataht.model.AdvancedSearchRequest;
import oculus.xdataht.model.DemographicResult;
import oculus.xdataht.model.DemographicResults;
import oculus.xdataht.model.LocationTimeVolumeResult;
import oculus.xdataht.model.LocationTimeVolumeResults;
import oculus.xdataht.model.TimeVolumeResult;
import oculus.xdataht.model.TimeVolumeResults;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.jsoup.Jsoup;
import org.jsoup.safety.Whitelist;

import com.sun.jersey.core.header.FormDataContentDisposition;
import com.sun.jersey.multipart.FormDataParam;


@Path("/overview")
public class OverviewResource {
	@Context
	UriInfo _uri;
	
	@GET
	@Path("timeseries/{dataset}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public TimeVolumeResults getTimeSeries(@PathParam("dataset") String dataset) {
		TimeLog log = new TimeLog();
		log.pushTime("Fetch global time series");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		ArrayList<TimeVolumeResult> a = new ArrayList<TimeVolumeResult>();
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + (dataset.equals("labor")?TimeLaborAggregation.POST_TIME_TABLE:TimeAggregation.POST_TIME_TABLE));  
			while (rs.next()) {
				a.add(new TimeVolumeResult(rs.getLong("day")*1000, rs.getInt("count")));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);
		Collections.sort(a, new Comparator<TimeVolumeResult>() {
			public int compare(TimeVolumeResult o1, TimeVolumeResult o2) {
				return (int)((o1.getDay()-o2.getDay())/1000);
			};
		});
		TimeVolumeResults results = new TimeVolumeResults(a);
		log.popTime();
		return results;
	}
	
	@GET
	@Path("sourcecounts")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getSourceCounts() {
		ArrayList<Pair<Integer,String>> counts = new ArrayList<Pair<Integer,String>>();
		TimeLog log = new TimeLog();
		log.pushTime("Fetch global source counts");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + SourceAggregation.SOURCE_TABLE);  
			while (rs.next()) {
				counts.add(new Pair<Integer,String>(rs.getInt("count"), rs.getString("source")));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);
		Collections.sort(counts, new Comparator<Pair<Integer,String>>() {
			public int compare(Pair<Integer,String> o1, Pair<Integer,String> o2) {
				return (o2.getFirst()-o1.getFirst());
			};
		});
		log.popTime();
		
		JSONObject result = new JSONObject();
		
		JSONArray jarray = new JSONArray();
		try {
			result.put("sourcecounts", jarray);
			for (Pair<Integer,String> count:counts) {
				JSONObject sourcecount = new JSONObject();
				sourcecount.put("source", count.getSecond());
				sourcecount.put("count", count.getFirst());
				jarray.put(sourcecount);
			}		
		} catch (JSONException e) {
			e.printStackTrace();
		}
		return result.toString();
	}
	
	/** Get the daily ad counts for each location, optionally filtered by longitude.
	 *  @param dataset
	 *  @param minLon	Filter by locations with longitude >= this value. Optional.
	 *  @param maxLon	Filter by locations with longitude < this value. Optional.
	 *  @return */	
	@GET
	@Path("locationtime/{dataset}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})		
	public LocationTimeVolumeResults getLocationTimes(	@PathParam("dataset") String dataset, 
			  											@QueryParam("minLon") Float minLon,
			  											@QueryParam("maxLon") Float maxLon) 
	{
		TimeLog log = new TimeLog();
		log.pushTime("Fetch all location time series");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		ArrayList<LocationTimeVolumeResult> a = new ArrayList<LocationTimeVolumeResult>();
		try {
			stmt = localConn.createStatement();
			String query = "SELECT * FROM " + (dataset.equals("labor") ? LaborLocationTimeAggregation.LOCATION_TIME_TABLE : LocationTimeAggregation.LOCATION_TIME_TABLE);
			if (minLon != null || maxLon != null) {
				query += " WHERE ";
				String minClause = (minLon != null) ? "lon >= " +  minLon : "" ;
				String maxClause = (maxLon != null) ? "lon < " + maxLon : "" ;
				String andClause = (minLon != null && maxLon != null) ? " AND " : "";
				query += minClause + andClause + maxClause;
			}

			ResultSet rs = stmt.executeQuery(query);  
			String currentLocation = "unset";
			LocationTimeVolumeResult currentResult = null;
			ArrayList<TimeVolumeResult> currentTimeSeries = null;
			while (rs.next()) {
				String location = rs.getString("location");
				Float lat = rs.getFloat("lat");
				Float lon = rs.getFloat("lon");
				if (!currentLocation.equals(location)) {
					currentTimeSeries = new ArrayList<TimeVolumeResult>();
					currentResult = new LocationTimeVolumeResult(location, lat, lon, currentTimeSeries);
					currentLocation = location;
					a.add(currentResult);
				}
				currentTimeSeries.add(new TimeVolumeResult(rs.getLong("day")*1000, rs.getInt("count")));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);
		LocationTimeVolumeResults results = new LocationTimeVolumeResults(a);
		log.popTime();
		return results;
	}
	
	@POST
	@Path("locationtimeseries")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getLocationTimeseries(String location) {
		TimeLog log = new TimeLog();
		log.pushTime("Location Timeseries: " + location);

		String sqlStr = "SELECT `date`, NewToTown, count, baseline, expected, p_value from memex_cmu.timeseries" +
				" WHERE `location`='" + location + "' ORDER BY `date` DESC";
		HashMap<Long,Float[]> timeseries = new HashMap<Long,Float[]>();
		Calendar c = Calendar.getInstance();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);  
			while (rs.next()) {
				int newToTown = rs.getInt("NewToTown")+1;
				Float[] rowvals = new Float[]{rs.getFloat("count"),rs.getFloat("baseline"),rs.getFloat("expected"),rs.getFloat("p_value")};
				Timestamp timestamp = rs.getTimestamp("date");
				long time = (timestamp==null)?0:timestamp.getTime();
				if (time<=0) continue;
				c.setTimeInMillis(time);
				c.set(Calendar.HOUR,0);
				c.set(Calendar.MINUTE,0);
				c.set(Calendar.SECOND,0);
				c.set(Calendar.MILLISECOND,0);
				time = c.getTimeInMillis()/1000;
				
				Float[] vals = timeseries.get(time);
				if (vals==null) {
					vals = new Float[]{0f,0f,0f,0f,0f,0f,0f,0f,0f,0f,0f,0f,0f,0f,0f,0f};
					timeseries.put(time, vals);
				}
				for (int i=0; i<4; i++) {
					Float rowval = rowvals[i];
					if (rowval!=null) vals[newToTown*4+i] = rowval;
				}
			}
		} catch (Exception e) {
			System.out.println("**WARNING** Failed to load location timeseries: " + e.getMessage());
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);

		ArrayList<Pair<Long,Float[]>> orderedResult = new ArrayList<Pair<Long,Float[]>>();
		for (Long time:timeseries.keySet()) {
			orderedResult.add(new Pair<Long,Float[]>(time,timeseries.get(time)));
		}
		Collections.sort(orderedResult, new Comparator<Pair<Long,Float[]>>() {
			@Override
			public int compare(Pair<Long, Float[]> o1, Pair<Long, Float[]> o2) {
				return (o1.getFirst()-o2.getFirst()<0)?-1:1;
			}			
		});
		
		log.popTime();
		
		JSONObject result = new JSONObject();
		try {
			JSONArray jFeatures = new JSONArray();
			result.put("features", jFeatures);
			for (int i=0; i<16; i++) {
				JSONObject jLine = new JSONObject();
				jFeatures.put(jLine);
				String type = "count";
				if (i%4==1) type = "baseline";
				if (i%4==2) type = "expected";
				if (i%4==3) type = "p-value";
				jLine.put("type", type);
				String newToTown = "Total";
				if ((int)(i/4)==1) newToTown = "Local";
				if ((int)(i/4)==2) newToTown = "New to town";
				if ((int)(i/4)==3) newToTown = "New to ads";
				jLine.put("newToTown", newToTown);
				JSONArray jTimeseries = new JSONArray();
				jLine.put("data",jTimeseries);
				for (Pair<Long,Float[]> day:orderedResult) {
					JSONArray jDay = new JSONArray();
					jDay.put(day.getFirst());
					Float[] dayData = day.getSecond();
					jDay.put(dayData[i]);
					jTimeseries.put(jDay);
				}
			}
		} catch (JSONException e) {
			e.printStackTrace();
		}
		
		return result.toString();
	}
	
	@GET
	@Path("demographics/{column}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public DemographicResults getDemographics(@PathParam("column") String column) {
		TimeLog log = new TimeLog();
		log.pushTime("Fetch demographics");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		ArrayList<DemographicResult> a = new ArrayList<DemographicResult>();
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT location,latitude,longitude," + column + " FROM " + Demographics.DEMOGRAPHICS_TABLE +
					" inner join locations on locations.label=demographics.location");  
			while (rs.next()) {
				String location = rs.getString("location");
				Float lat = rs.getFloat("latitude");
				Float lon = rs.getFloat("longitude");
				Float value = rs.getFloat(column);
				a.add(new DemographicResult(location, lat, lon, value));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);
		DemographicResults results = new DemographicResults(a);
		log.popTime();
		return results;
	}
	
	@GET
	@Path("ldemographics")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public DemographicResults getLocationDemographics() {
		TimeLog log = new TimeLog();
		log.pushTime("Fetch demographics");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		ArrayList<DemographicResult> a = new ArrayList<DemographicResult>();
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT location,latitude,longitude,rape,robbery,expenditures,ads,white,black FROM " + Demographics.DEMOGRAPHICS_TABLE +
					" inner join locations on locations.label=location_demographics.location");  
			while (rs.next()) {
				String location = rs.getString("location");
				Float lat = rs.getFloat("latitude");
				Float lon = rs.getFloat("longitude");
				Float rape = rs.getFloat("rape");
				Float robbery = rs.getFloat("robbery");
				Float expenditures = rs.getFloat("expenditures");
				Float ads = rs.getFloat("ads");
				Float white = rs.getFloat("white");
				Float black = rs.getFloat("black");
				a.add(new DemographicResult(location, lat, lon, rape, robbery, expenditures, ads, white, black));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);
		DemographicResults results = new DemographicResults(a);
		log.popTime();
		return results;
	}
	
	/** Get the cluster details for the specified location.
	 *  @param location  The location of interest.
	 *  @param startIdx  For paging through the data, the starting index (1 based) of the desired page. 
	 *  				 Optional - use null to get all records.
	 *  @param batchSize The number of records to retrieve when paging. 
	 *  				 Optional - use null to get all records.
	 */
	@POST
	@Path("locationclusterdetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getLocationClusterDetails(String location, @QueryParam("startIdx") Integer startIdx, @QueryParam("batchSize") Integer batchSize) {
		TimeLog log = new TimeLog();
		log.pushTime("Location Cluster Details: " + location);
		log.pushTime("Scores");
		String sqlScoreStr = "SELECT target_id,score FROM " + LocationCluster.LOCATION_CLUSTER_TABLE + " INNER JOIN memex_hti.htic_clusters_details ON htic_clusters_details.target_id=" +
				LocationCluster.LOCATION_CLUSTER_TABLE + ".clusterid WHERE `location`='" + location + "'";
		HashMap<String, Float> scores = getClusterScores(sqlScoreStr);
		log.popTime();
		StringBuilder result = new StringBuilder(200);
		result.append("{\"details\":[");
		String sqlStr = "SELECT " + LocationCluster.LOCATION_CLUSTER_TABLE + ".clusterid as id,matches," +
				"adcount,phonelist,emaillist,weblist,namelist,ethnicitylist,timeseries,locationlist,sourcelist,keywordlist,clustername as name,latestad FROM " + 
				LocationCluster.LOCATION_CLUSTER_TABLE + " INNER JOIN " + ClusterDetails.CLUSTER_DETAILS_TABLE +
				" ON " + LocationCluster.LOCATION_CLUSTER_TABLE + ".clusterid=" + ClusterDetails.CLUSTER_DETAILS_TABLE + ".clusterid" +
				" WHERE `location`='" + location + "' ORDER BY adcount DESC";

		String sqlCount = "SELECT count(*) FROM " + LocationCluster.LOCATION_CLUSTER_TABLE + " INNER JOIN " + ClusterDetails.CLUSTER_DETAILS_TABLE +
							" ON " + LocationCluster.LOCATION_CLUSTER_TABLE + ".clusterid=" + ClusterDetails.CLUSTER_DETAILS_TABLE + ".clusterid" + 
							" WHERE `location`='" + location + "'";
		
		boolean batched = (startIdx != null && batchSize != null);
		if (batched) {
			sqlStr += " LIMIT " + startIdx + "," + (startIdx + batchSize - 1);
		}
		
		int totalResults = fetchClusterDetails(sqlStr, log, result, null, false, scores);
		
		result.append("],");
		
		if (batched) {
			log.pushTime("Count location cluster details results");
			MemexOculusDB db = MemexOculusDB.getInstance();
			Connection localConn = db.open();
			totalResults = MemexOculusDB.getInt(localConn, sqlCount, "Count location cluster details results");
			db.close(localConn);
			log.popTime();
		}
		
		result.append("\"totalResults\": " + totalResults + "}");
		log.popTime();
		return result.toString();
	}

	@GET
	@Path("clusterads/{clusterid}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getClusterAds(@PathParam("clusterid") int clusterid) {
		TimeLog log = new TimeLog();
		log.pushTime("Cluster Ads: " + clusterid);
		HashSet<Integer> ads = new HashSet<Integer>();
		Cluster.getAdsInCluster(clusterid, ads, 100);
		JSONArray result = new JSONArray();
		for (Integer ad:ads) {
			result.put(ad);
		}
		return result.toString();
	}

	@GET
	@Path("attributeads/{clusterid}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getAttributeAds(@PathParam("clusterid") int attributeid) {
		TimeLog log = new TimeLog();
		log.pushTime("Attribute Ads: " + attributeid);
		HashSet<Integer> ads = new HashSet<Integer>();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		HashMap<Integer,AttributeValue> allAttributes = AttributeLinks.getAttributes(oculusconn);
		AttributeDetails.getAdsInAttributes(attributeid, attributeid, allAttributes, oculusconn, htconn, ads);
		oculusdb.close(oculusconn);
		htdb.close(htconn);
		JSONArray result = new JSONArray();
		for (Integer ad:ads) {
			result.put(ad);
		}
		return result.toString();
	}

	
	
	private HashMap<String,Float> getClusterScores(String sqlStr) {
		HashMap<String,Float> result = new HashMap<String,Float>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String clusterid = rs.getString("target_id");
				Float score = rs.getFloat("score");
				result.put(clusterid, score);
			}
		} catch (Exception e) {
			System.out.println("**WARNING** Failed to load HTI scores: " + e.getMessage());
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);
		return result;
	}
	
	@POST
	@Path("locationattributedetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getLocationAttributeDetails(String location) {
		TimeLog log = new TimeLog();
		log.pushTime("Location Attribute Details: " + location);
		StringBuilder result = new StringBuilder(200);
		result.append("{\"details\":[");
		String sqlStr = "SELECT " + AttributeLocation.ATTRIBUTE_LOCATION_TABLE + ".attributeid as id,matches," +
				"adcount,phonelist,emaillist,weblist,namelist,ethnicitylist,timeseries,locationlist,sourcelist,keywordlist,value as name,latestad FROM " + 
				AttributeLocation.ATTRIBUTE_LOCATION_TABLE + " INNER JOIN " + AttributeDetails.ATTRIBUTE_DETAILS_TABLE +
				" ON " + AttributeLocation.ATTRIBUTE_LOCATION_TABLE + ".attributeid=" + AttributeDetails.ATTRIBUTE_DETAILS_TABLE + ".id" +
				" WHERE `location`='" + location + "' ORDER BY adcount DESC";
		fetchClusterDetails(sqlStr, log, result, null, false);
		result.append("]}");
		log.popTime();
		return result.toString();
	}
	
	@POST
	@Path("laborlocationdetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getLaborLocationDetails(String location) {
		TimeLog log = new TimeLog();
		log.pushTime("Labor Location Details: " + location);
		JSONArray result = new JSONArray();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashMap<Integer, String> categories = LaborCategory.getCategoriesById(conn);
		HashSet<Integer> location_ids = Locations.getLocationIdByLabel(location, conn);
		Statement stmt;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT category_id,count FROM " + AdLaborLocations.LABOR_CATEGORY_TABLE + " WHERE location_id IN " + StringUtil.hashSetToSqlList(location_ids) + " ORDER BY count DESC");
			while(rs.next()) {
				JSONObject categoryJo = new JSONObject();
				Integer category_id = rs.getInt("category_id");
				categoryJo.put("category_id",category_id);
				categoryJo.put("category",categories.get(rs.getInt("category_id")));
				categoryJo.put("count",rs.getInt("count"));
				result.put(categoryJo);
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
	@Path("getadhtml/{ad_id}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getAdHtml(@PathParam("ad_id") String ad_id) {
		JSONObject result = new JSONObject();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			Statement stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT body FROM roxy_scrape.backpage_incoming where id=" + ad_id);
			rs.next();
			result.put("body",rs.getString("body"));
		} catch (SQLException e) {
			e.printStackTrace();
			try {
				result.put("error", e.getMessage());
			} catch (JSONException e1) {
				e1.printStackTrace();
			}
		} catch (JSONException e) {
			e.printStackTrace();
			try {
				result.put("error", e.getMessage());
			} catch (JSONException e1) {
				e1.printStackTrace();
			}
		}
		
		db.close(conn);
		return result.toString();
	}

	@GET
	@Path("laborlocationcategory/{category}/{location}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getAdIdsByLocationAndCategory(@PathParam("category") String category_id, @PathParam("location") String encodedLocation) {
		JSONObject result = new JSONObject();
		try {
			String location = java.net.URLDecoder.decode(encodedLocation, "UTF-8");
			result.put("location", location);
			result.put("category", LaborCategory.getCategory(category_id));
			result.put("ads", AdLaborLocations.getAdIdsByLocationAndCategory(location, category_id));
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
			try {
				result.put("error",e.getMessage());
			} catch (JSONException e1) {
				e1.printStackTrace();
			}
		} catch (JSONException e) {
			e.printStackTrace();
			try {
				result.put("error",e.getMessage());
			} catch (JSONException e1) {
				e1.printStackTrace();
			}
		}
		return result.toString();
	}

    private String getClustersFromAds(HashSet<Integer> adIds, TimeLog log) {
        log.pushTime(" Get clusters for search results");
        HashMap<String,Integer> matchingClusters = Cluster.getSimpleClusterCounts(adIds);
        log.popTime();
        if (matchingClusters==null||matchingClusters.size()==0) {
            return "{\"details\":[]}";
        }

        String clusteridList = "(";
        boolean isFirst = true;
        for (String clusterid:matchingClusters.keySet()) {
            if (isFirst) isFirst = false;
            else clusteridList += ",";
            clusteridList += clusterid;
        }
        clusteridList += ")";

        StringBuilder result = new StringBuilder(200);
        result.append("{\"details\":[");
        String sqlStr = "SELECT " + ClusterDetails.CLUSTER_DETAILS_TABLE + ".clusterid as id," +
                "adcount,phonelist,emaillist,weblist,namelist,ethnicitylist,timeseries,locationlist,sourcelist,keywordlist,clustername as name,latestad FROM " +
                ClusterDetails.CLUSTER_DETAILS_TABLE +
                " WHERE clusterid IN " + clusteridList + " ORDER BY adcount DESC";
        fetchClusterDetails(sqlStr, log, result, matchingClusters, false);
        result.append("]}");
        return result.toString();
    }

    @POST
    @Path("advancedclusterdetails")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    @Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String getAdvancedClusterDetails(String advancedSearchStr) throws JSONException {
        AdvancedSearchRequest asr = new AdvancedSearchRequest(new JSONObject(advancedSearchStr));

        TimeLog log = new TimeLog();
        log.pushTime("Advanced Cluster Details: " + advancedSearchStr);

        log.pushTime("Fetch matching ads");
        HashSet<Integer> adIds = MemexAdSearch.getAdIds("",asr,Integer.MAX_VALUE);
        log.popTime();

        String result = getClustersFromAds(adIds,log);
        return result;
    }

    @GET
    @Path("elasticsearchproperties")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String useElasticSearch() throws JSONException {
        String elasticURL = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_URL);
        JSONObject result = new JSONObject();
        if (elasticURL != null && elasticURL.trim() != "") {
            result.put("useElasticSearch",true);
            String propertiesStr = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_PROPERTIES);
            JSONArray jsonProperties = new JSONArray();
            if (propertiesStr != null && propertiesStr != "") {
                String []properties = propertiesStr.split(",");
                for (String prop : properties) {
                    jsonProperties.put(prop);
                }
            }
            result.put("properties",jsonProperties);
        } else {
            result.put("useElasticSearch",false);
        }
        return result.toString();
    }

    @POST
    @Path("advancedattributedetails")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    @Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String getAdvancedAttributeDetails(String advancedSearchStr) throws JSONException {
        AdvancedSearchRequest asr = new AdvancedSearchRequest(new JSONObject(advancedSearchStr));

        TimeLog log = new TimeLog();
        log.pushTime("Advanced Attribute Details: " + advancedSearchStr);

        log.pushTime("Fetch matching ads");
        HashSet<Integer> adIds = MemexAdSearch.getAdIds("",asr,Integer.MAX_VALUE);
        log.popTime();

        String result = getAttributeNodesFromAds(adIds,log);
        return result;
    }

	@POST
	@Path("tipclusterdetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getTipClusterDetails(String tip) {
		TimeLog log = new TimeLog();
		log.pushTime("Tip Cluster Details: " + tip);

		if (tip==null || tip.trim().length()==0) {
			log.popTime();
			return "{\"details\":[]}";
		}
		
		HashSet<Integer> matchingAds = GraphResource.fetchMatchingAds(tip, log);
		if (matchingAds==null||matchingAds.size()==0) {
			log.popTime();
			return "{\"details\":[]}";
		}


        String result = getClustersFromAds(matchingAds,log);
        log.popTime();
        return result;
	}

	@POST
	@Path("tipattributedetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getTipAttributeDetails(String tip) {
		TimeLog log = new TimeLog();
		log.pushTime("Tip Attribute Details: " + tip);

		if (tip==null || tip.trim().length()==0) {
			log.popTime();
			return "{\"details\":[]}";
		}
		
		HashSet<Integer> matchingAds = GraphResource.fetchMatchingAds(tip, log);
		if (matchingAds==null||matchingAds.size()==0) {
			log.popTime();
			return "{\"details\":[]}";
		}

        String result = getAttributeNodesFromAds(matchingAds,log);
        log.popTime();
        return result;
	}

    private String getAttributeNodesFromAds(HashSet<Integer> adIds, TimeLog log) {
        log.pushTime(" Get attributes for search results");

        HashSet<String> matchingAttributeValues = new HashSet<String>();
        HashMap<String,Integer> matchingAttributes = new HashMap<String,Integer>();
        MemexHTDB htdb = MemexHTDB.getInstance();
        MemexOculusDB oculusdb = MemexOculusDB.getInstance();
        Connection htconn = htdb.open();
        Connection oculusconn = oculusdb.open();
        try {
            HashMap<Integer, MemexAd> adbatch = MemexAd.fetchAdsOculus(htconn, oculusconn, adIds);
            for (MemexAd ad:adbatch.values()) {
                for (Entry<String,HashSet<String>> e:ad.attributes.entrySet()) {
                    // String attribute = e.getKey();
                    for (String value:e.getValue()) {
                        String lcval = value.toLowerCase();
                        matchingAttributeValues.add(lcval);
                        Integer matchCount = matchingAttributes.get(lcval);
                        if (matchCount==null) matchCount = 0;
                        matchCount++;
                        matchingAttributes.put(lcval, matchCount);

                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        htdb.close(htconn);
        oculusdb.close(oculusconn);

        log.popTime();

        StringBuilder valuesStr = new StringBuilder();
        boolean isFirst = true;
        for (String val:matchingAttributeValues) {
            if (isFirst) isFirst = false;
            else valuesStr.append(",");
            valuesStr.append("'" + val + "'");
        }

        log.pushTime("Get details for attributes");
        StringBuilder result = new StringBuilder(200);
        result.append("{\"details\":[");
        String sqlStr = "SELECT " + AttributeLinks.ATTRIBUTES_TABLE + ".id as id," +
                "adcount,phonelist,emaillist,weblist,namelist,ethnicitylist,timeseries,locationlist,sourcelist,keywordlist,latestad," +
                AttributeDetails.ATTRIBUTE_DETAILS_TABLE + ".value as name FROM " +
                AttributeLinks.ATTRIBUTES_TABLE + " INNER JOIN " + AttributeDetails.ATTRIBUTE_DETAILS_TABLE +
                " ON " + AttributeLinks.ATTRIBUTES_TABLE + ".id=" + AttributeDetails.ATTRIBUTE_DETAILS_TABLE + ".id" +
                " WHERE " + AttributeLinks.ATTRIBUTES_TABLE + ".value IN (" + valuesStr.toString() + ") ORDER BY adcount DESC";
        fetchClusterDetails(sqlStr, log, result, matchingAttributes, true);
        result.append("]}");
        log.popTime();
        return result.toString();
    }

	@POST
	@Path("csvclusterdetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.TEXT_HTML, MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getCSVClusterDetails(String phoneStr) {
		TimeLog log = new TimeLog();
		String[] phones = phoneStr.split(",");
		log.pushTime("CSV Cluster Details: " + phones.length);

		HashSet<Integer> matchingAds = GraphResource.fetchMatchingAds(phones, log);
		if (matchingAds==null||matchingAds.size()==0) {
			log.popTime();
			return "{\"details\":[]}";
		}

		String result = getClustersFromAds(matchingAds, log);
		log.popTime();
		return result;
	}
	
	private int fetchClusterDetails(String sqlStr, TimeLog log, StringBuilder result, HashMap<String,Integer> matchingClusters, boolean nameIsId) {
		return fetchClusterDetails(sqlStr, log, result, matchingClusters, nameIsId, null);
	}
	
	private int fetchClusterDetails(String sqlStr, TimeLog log, StringBuilder result, HashMap<String,Integer> matchingClusters, boolean nameIsId, HashMap<String,Float> scores) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		int resultCount = 0;
		try {
			log.pushTime("SQL Select");
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			log.popTime();
			log.pushTime("Build result");
			boolean isFirst = true;
			while (rs.next()) {
				if (isFirst) {
					isFirst = false;
				} else {
					result.append(",");
				}
				String clusterid = rs.getString("id");
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
				String clustername = rs.getString("name");
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
				if (clustername==null) clustername = "";
				if (latestad==null) latestad = "";
				if (latestad.length()>10)
					latestad=latestad.substring(0,10);
				result.append("{\"id\":");
				result.append(clusterid); 
				result.append(",\"ads\":");
				result.append(adcount);
				if (clustername!=null) {
					clustername = Jsoup.clean(clustername, Whitelist.none());
					result.append(",\"clustername\":\"");
					result.append(clustername);
					result.append("\"");
				}
				if (scores!=null) {
					Float score = scores.get(clusterid);
					if (score!=null) score = Math.round(score*100)/100f;
					result.append(",\"score\":");
					result.append(score);
				}
				if (matchingClusters!=null) {
					result.append(",\"matches\":");
					result.append(matchingClusters.get(nameIsId?clustername:clusterid));
				} else {
					result.append(",\"matches\":");
					result.append(rs.getInt("matches"));
				}
				result.append(",\"phonelist\":{");
				result.append(phonelist);
				result.append("},\"emaillist\":{");
				result.append(emaillist);
				result.append("},\"weblist\":{");
				weblist = weblist.replaceAll("\\\\", "\\\\\\\\");
				result.append(weblist);
				result.append("},\"namelist\":{");
				result.append(namelist);
				result.append("},\"ethnicitylist\":{");
				result.append(ethnicitylist);
				result.append("},\"timeseries\":{");
				result.append(timeseries);
				result.append("},\"locationlist\":{");
				result.append(locationlist);
				result.append("},\"sourcelist\":{");
				result.append(sourcelist);
				result.append("},\"keywordlist\":{");
				result.append(keywordlist);
				result.append("},\"latestad\":\"");
				result.append(latestad);
				result.append("\"}");
				
				resultCount++;
			}
			log.popTime();

		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(localConn);
		return resultCount;
	}

    @POST
    @Path("imagehashclusterdetails")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String getClusterDetailsFromHash(String histogram) {
    	TimeLog log = new TimeLog();
    	HashSet<Integer> matchingAds = new HashSet<Integer>();
        try {
            MemexOculusDB db = MemexOculusDB.getInstance();
            Connection oculusconn = db.open();
            HashSet<Integer> imageids = new HashSet<Integer>();
            ImageHistogramHash.getIdsForHistogram(oculusconn, histogram, imageids);
            db.close(oculusconn);
            matchingAds = AdImages.getMatchingAds(imageids);
        } catch (Exception e) {
            e.printStackTrace();
        }

        return getClustersFromAds(matchingAds, log);
    }


    @POST
    @Path("imageurlclusterdetails")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String getImageClusterDetailsFromUrl(String url) {
        TimeLog log = new TimeLog();
        log.pushTime("Image Cluster Details: " + url);

        BufferedImage img = null;
        try {
            img = ImageIO.read(new URL(url));
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (img != null) {
            String histogram = ImageHistogramHash.histogramHash(img);
            return getClusterDetailsFromHash(histogram);
        } else {
            log.popTime();
            System.err.println("Error: Couldn't read image from Url.   Probably an unsupported format.  Please check the URL and try again");
            return "{\"details\":[]}";
        }
    }
    
	@POST
	@Path("imageclusterdetails")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes(MediaType.MULTIPART_FORM_DATA)
	public String getImageClusterDetails(@FormDataParam("file") InputStream uploadedInputStream,
			@FormDataParam("file") FormDataContentDisposition fileDetail) {
		TimeLog log = new TimeLog();
		log.pushTime("Image Cluster Details: " + fileDetail.getFileName());

		BufferedImage img = null;
		try {
			img = ImageIO.read(uploadedInputStream);
		} catch (Exception e) {
			e.printStackTrace();
		}

        String histogram = ImageHistogramHash.histogramHash(img);
		return getClusterDetailsFromHash(histogram);
	}

    @POST
    @Path("imageurlhash")
    @Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
    public String getImageHashFromUrl(String url) {
        TimeLog log = new TimeLog();
        log.pushTime("Image Cluster Details: " + url);

        BufferedImage img = null;
        try {
            img = ImageIO.read(new URL(url));
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (img != null) {
            return ImageHistogramHash.histogramHash(img);
        } else {
            log.popTime();
            System.err.println("Error: Couldn't read image from Url.   Probably an unsupported format.  Please check the URL and try again");
            return null;
        }
    }

	@POST
	@Path("imagehash")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes(MediaType.MULTIPART_FORM_DATA)
	public String getImageHash(@FormDataParam("file") InputStream uploadedInputStream,
			@FormDataParam("file") FormDataContentDisposition fileDetail) {
		TimeLog log = new TimeLog();
		log.pushTime("Image Cluster Details: " + fileDetail.getFileName());

		BufferedImage img = null;
		try {
			img = ImageIO.read(uploadedInputStream);
		} catch (Exception e) {
			e.printStackTrace();
		}
        return ImageHistogramHash.histogramHash(img);
	}
	
	public static void main(String[] args) {
		OverviewResource or = new OverviewResource();
		String result = or.getLocationClusterDetails("San Francisco, CA, USA", null, null);
		File f = new File("c:/dev/sfdeets.json");
		FileWriter fw;
		try {
			fw = new FileWriter(f);
			fw.write(result);
			fw.close();
		} catch (Exception e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
	}
}
