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

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;

import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;

import org.json.JSONException;
import org.json.JSONObject;
import org.restlet.resource.ResourceException;

import oculus.memex.aggregation.TimeAggregation;
import oculus.memex.aggregation.TimeHealthAggregation;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.progress.Progress;
import oculus.memex.training.InvalidateAttribute;
import oculus.memex.training.RenameAttribute;
import oculus.memex.util.TimeLog;
import oculus.xdataht.model.TimeVolumeResult;
import oculus.xdataht.model.TimeVolumeResults;

@Path("/server")
public class ServerResource {
	@Context
	UriInfo _uri;

	@POST
	@Path("renameValue")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String renameValue(String attrval) {
		String attribute, encodedNewValue = null, encodedOldValue = null;		
		Long result = new Long(-1);
		try {
			JSONObject jo = new JSONObject(attrval);
			attribute = jo.getString("attribute");
			encodedOldValue = jo.getString("oldValue");
			encodedNewValue = jo.getString("newValue");
			result = RenameAttribute.renameValueStatic(attribute, URLDecoder.decode(encodedOldValue,"UTF-8"), URLDecoder.decode(encodedNewValue,"UTF-8"))/1000;
		} catch (ResourceException e) {
			e.printStackTrace();
			return "{\"message\":\"Error: " + e.getMessage() + "\"}";
		} catch (JSONException e) {
			e.printStackTrace();
			return "{\"message\":\"Error: Could not parse JSON" + attrval + "\"}";
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
		}
		int resultInt = result.intValue();
		String returnStr = "{\"message\":\"Took " + resultInt +"s to rename " + encodedOldValue + " to " + encodedNewValue + "\","
				+ "\"result\":" + resultInt + "}";
		return returnStr;
	}
	
	@POST
	@Path("invalidateValue")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String invalidateValue(String attrval) {
		String attribute, encodedValue = null;		
		Long result = new Long(-1);
		try {
			JSONObject jo = new JSONObject(attrval);
			attribute = jo.getString("attribute");
			encodedValue = jo.getString("value");
			result = InvalidateAttribute.invalidateValueStatic(attribute, URLDecoder.decode(encodedValue,"UTF-8"))/1000;
		} catch (ResourceException e) {
			e.printStackTrace();
			return "{\"message\":\"Error: " + e.getMessage() + "\"}";
		} catch (JSONException e) {
			e.printStackTrace();
			return "{\"message\":\"Error: Could not parse JSON" + attrval + "\"}";
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace();
		}
		int resultInt = result.intValue();
		String returnStr = "{\"message\":\"Took " + resultInt +"s to remove " + encodedValue + "\","
				+ "\"result\":" + resultInt + "}";
		return returnStr;
	}
	
	@GET
	@Path("timeseries")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public TimeVolumeResults getTimeSeries() {
		TimeLog log = new TimeLog();
		log.pushTime("Fetch global import time series");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		ArrayList<TimeVolumeResult> a = new ArrayList<TimeVolumeResult>();
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + TimeAggregation.IMPORT_TIME_TABLE);  
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
		log.popTime();
		return new TimeVolumeResults(a);
	}

	@GET
	@Path("timeseriessources")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getTimeSeriesSources() {
		TimeLog log = new TimeLog();
		log.pushTime("Fetch system health time series");
		HashMap<Integer,String> sourcesMap = getSourcesMap();
		//source-->type-->list<JSONObject(day,count)>
		HashMap<String, HashMap<String, ArrayList<JSONObject>>> resultMap = initResultMap(sourcesMap);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		try {
			stmt = localConn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + TimeHealthAggregation.TIME_HEALTH_TABLE);  
			while (rs.next()) {
				String joString = "{\"day\": " + rs.getLong("day")*1000 + ", \"count\": " + rs.getInt("count") + "}";
				int sourceId = rs.getInt("sources_id");
				String type = rs.getString("type");
				String sourceName = sourcesMap.get(sourceId);
				if (sourceName==null) continue;
				HashMap<String, ArrayList<JSONObject>> sourceData = resultMap.get(sourceName);
				sourceData.get(type).add(new JSONObject(joString));
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		db.close(localConn);
		
		HashMap<String,HashMap<String,Long>> timeMetaData = getTimeSeriesTotals(resultMap);
		sortTimeVolumeResultArray(resultMap);
		JSONObject result = new JSONObject();
		try {
			result.put("sources", resultMap);
			result.put("timeMetaData", timeMetaData);
		} catch (JSONException e) {
			e.printStackTrace();
		}
		log.popTime();
		return result.toString();
	}

	@GET
	@Path("processingprogress")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public String getAllProgressRecords() {
		TimeLog log = new TimeLog();
		log.pushTime("Fetch processing progress time series");
		HashMap<String,HashSet<JSONObject>> resultMap = new HashMap<String,HashSet<JSONObject>>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		Statement stmt = null;
		long minTime = Long.MAX_VALUE;
		long maxTime = Long.MIN_VALUE;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + Progress.PROCESSING_PROGRESS_TABLE);
			while(rs.next()) {
				String name = rs.getString("process_name");
				int duration = rs.getInt("duration");
				long endTime = rs.getTimestamp("time").getTime();
				long startTime = endTime - (duration * 1000);
				if(endTime > maxTime) maxTime = endTime;
				if(startTime < minTime && startTime > 18000000) minTime = startTime;
				HashSet<JSONObject> recordSet = resultMap.get(name);
				if(recordSet==null) {
					recordSet = new HashSet<JSONObject>();
					resultMap.put(name, recordSet);
				}
				JSONObject jo = new JSONObject();
				jo.put("last_processed",rs.getInt("last_processed"));
				jo.put("last_clusterid",rs.getInt("last_clusterid"));
				jo.put("duration",duration);
				jo.put("start",startTime);
				jo.put("end",endTime);
				recordSet.add(jo);
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
		JSONObject result = new JSONObject();
		try {
			result.put("data", resultMap);
			result.put("minTime", minTime);
			result.put("maxTime", maxTime);
			result.put("processes",getProcessOrder());
			
		} catch (JSONException e) {
			e.printStackTrace();
		}		
		log.popTime();
		return result.toString();
	}

	//return value should represent the current order of pre-processing execution
	private ArrayList<String> getProcessOrder() {
		ArrayList<String> result = new ArrayList<String>();
		result.add("memex_ht.ads");
		result.add("memex_ht.ads_attributes");
		result.add("memex_ht.images");
		result.add("memex_ht.images_attributes");
		result.add("ads_images");
		result.add("ads_keywords");
		result.add("ads_prices");
		result.add("ads_extraction");
		result.add("ads_locations");
		result.add("locationtime");
		result.add("cluster");
		result.add("attribute");
		result.add("clusters_locations");
		result.add("cluster_details");
		result.add("attribute_links");
		result.add("attribute_details");
		return result;
	};
	
	@SuppressWarnings("unused")
	private HashSet<ProgressRecord> getLatestProgressRecords() {
		HashSet<ProgressRecord> result = new HashSet<ProgressRecord>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT process_name, last_processed, last_clusterid, duration, "
					+ "MAX(time) AS time FROM " + Progress.PROCESSING_PROGRESS_TABLE + " GROUP BY process_name");
			while(rs.next()) {
				result.add(new ProgressRecord(rs.getString("process_name"),rs.getInt("last_processed"), rs.getInt("last_clusterid"), rs.getInt("duration"), rs.getTimestamp("time")));
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

	private HashMap<String,HashMap<String,Long>> getTimeSeriesTotals(HashMap<String, HashMap<String, ArrayList<JSONObject>>> resultMap) {		
		HashMap<String,HashMap<String,Long>> timeMetaDataMap = new HashMap<String,HashMap<String,Long>>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection localConn = db.open();
		Statement stmt = null;
		Long day, minTime, maxTime, maxCount, 
			maxCountDay = new Long(0), 
			count = new Long(0);
		String timeType;
		for(String tableName: TimeAggregation.getTimeAggregationTableNames()) {
			timeType = tableName.split("_")[1];
			HashMap<String,Long> timeMetaData = timeMetaDataMap.get(timeType);
			if(timeMetaData == null) {
				timeMetaData = new HashMap<String,Long>();
				timeMetaDataMap.put(timeType, timeMetaData);
				minTime = Long.MAX_VALUE;
				maxTime = Long.MIN_VALUE;
				maxCount = new Long(0);
			} else {
				minTime = timeMetaData.get("minTime");
				maxTime = timeMetaData.get("maxTime");
				maxCount = timeMetaData.get("maxCount");
			}
			
			try {
				stmt = localConn.createStatement();
				ResultSet rs = stmt.executeQuery("SELECT * FROM " + tableName);  
				HashMap<String, ArrayList<JSONObject>> allTotals = resultMap.get("Total");
				while (rs.next()) {
					day = rs.getLong("day")*1000;
					count = rs.getLong("count");
					if(day < minTime && day > 18000000) minTime=day;
					if(day > maxTime) maxTime=day;
					if(count > maxCount && day > 18000000) {
						maxCount = count;
						maxCountDay = day;
					}
					String joString = "{\"day\": " + day + ", \"count\": " + count + "}";
					ArrayList<JSONObject> typeTotals = allTotals.get(timeType);
					if (typeTotals==null) {
						typeTotals = new ArrayList<JSONObject>();
						allTotals.put(timeType, typeTotals);
					}
					typeTotals.add(new JSONObject(joString));
				}
				timeMetaData.put("minTime", minTime);
				timeMetaData.put("maxTime", maxTime);
				timeMetaData.put("maxCount", maxCount);
				timeMetaData.put("maxCountDay", maxCountDay);
			} catch (Exception e) {
				e.printStackTrace();
			}	
		}
		db.close(localConn);
		return timeMetaDataMap;
	}

	private HashMap<Integer, String> getSourcesMap() {
		HashMap<Integer, String> result = new HashMap<Integer, String>();
		Statement stmt = null;
		MemexHTDB db = MemexHTDB.getInstance();
		Connection conn = db.open();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT id, name FROM sources");
			while(rs.next()) {
				result.put(rs.getInt("id"),rs.getString("name"));
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

	private HashMap<String, HashMap<String, ArrayList<JSONObject>>> initResultMap(HashMap<Integer, String> sourcesIdMap) {
		HashMap<String, HashMap<String, ArrayList<JSONObject>>> result = new HashMap<String, HashMap<String, ArrayList<JSONObject>>>();
		Statement stmt = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashSet<String> types = new HashSet<String>();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT DISTINCT(type) FROM " + TimeHealthAggregation.TIME_HEALTH_TABLE);
			while(rs.next()) {
				types.add(rs.getString("type"));
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
		
		//add individual sources
		for(Integer sources_id: sourcesIdMap.keySet()) {
			HashMap<String, ArrayList<JSONObject>> typeToList = new HashMap<String, ArrayList<JSONObject>>();
			for(String type: types) {
				typeToList.put(type,new ArrayList<JSONObject>());
			}
			result.put(sourcesIdMap.get(sources_id),typeToList);
		}
		
		//add total
		HashMap<String, ArrayList<JSONObject>> typeToList = new HashMap<String, ArrayList<JSONObject>>();
		for(String type: types) {
			typeToList.put(type,new ArrayList<JSONObject>());
		}
		result.put("Total",typeToList);

		return result;
	}

	private void sortTimeVolumeResultArray(HashMap<String, HashMap<String, ArrayList<JSONObject>>> resultMap) {
		for(String type: resultMap.keySet()) {
			HashMap<String,ArrayList<JSONObject>> sourcesMap = resultMap.get(type);
			for(String source_name: sourcesMap.keySet()) {
				Collections.sort(sourcesMap.get(source_name), new Comparator<JSONObject>() {
					public int compare(JSONObject o1, JSONObject o2) {
						try {
							long day1 = o1.getLong("day");
							long day2 = o2.getLong("day");
							if (day1>day2) {return 1;} 
							else if (day1<day2) {return -1;} 
							else {return 0;}
						} catch (JSONException e) {
							e.printStackTrace();
							return -1;
						}
					};
				});
			}
		}		
	}
	
	private class ProgressRecord{
		public String name;
		public int last_processed, last_clusterid, duration;
		public Timestamp time;
		public ProgressRecord(String name, int last_processed, int last_clusterid, int duration, Timestamp time) {
			super();
			this.name = name;
			this.last_processed = last_processed;
			this.last_clusterid = last_clusterid;
			this.duration = duration;
			this.time = time;
		}		
		@Override
		public String toString() {
			return "{"
					+ "\"name\":\"" + name + "\","
					+ "\"last_processed\":"	+ last_processed
					+ ",\"last_clusterid\":" + last_clusterid
					+ ",duration\":" + duration 
					+ ",\"time\":" + time.getTime()
					+ "}";
		}
	}
}