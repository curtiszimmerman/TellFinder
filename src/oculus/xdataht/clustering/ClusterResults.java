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
package oculus.xdataht.clustering;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import oculus.memex.clustering.ClusterLink;
import oculus.memex.util.Pair;
import oculus.xdataht.data.DataRow;
import oculus.xdataht.data.DataTable;
import oculus.xdataht.data.DenseDataTable;
import oculus.xdataht.data.TableDB;
import oculus.xdataht.data.TableDistribution;
import oculus.xdataht.model.RestLinkCriteria;

import org.json.JSONArray;
import org.json.JSONException;

import com.oculusinfo.ml.Instance;
import com.oculusinfo.ml.unsupervised.cluster.Cluster;
import com.oculusinfo.ml.unsupervised.cluster.ClusterResult;

public class ClusterResults implements Serializable {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;
	private Map<String, Set<String>> _clusteringResult = new HashMap<String, Set<String>>();
	private final String _datasetName;
	private final List<Pair<String,Double>> _clusterParameters;
	private final String _clusterParamtersString;
	
	public ClusterResults(String datasetName, String clusterParamtersString) {
		_datasetName = datasetName;
		_clusterParameters =  new ArrayList<Pair<String,Double>>();
		_clusterParamtersString = clusterParamtersString;
	}
	
	public ClusterResults(String datasetName, ClusterResult mlClusterResult, List<Pair<String,Double>> params, String clusterParamtersString) {
		_clusterParamtersString = clusterParamtersString;
		
		// Convert ml result into hashmap of membership
		for (Cluster c : mlClusterResult){
			Set<String> members = new HashSet<String>();
			for (Instance inst : c.getMembers()) {
				members.add(inst.getId());
			}
			_clusteringResult.put(c.getId(), members);
		}
		
		_datasetName = datasetName;
		_clusterParameters = params;
		sortClusterParams();
	}
	
	public HashMap<String,String> getSummary() { 
		HashMap<String,String> summary = new HashMap<String,String>();
		
		// Total clusters
		summary.put("Total Clusters", _clusteringResult.size() + "");
		
		// Max/Min
		int maxSize = Integer.MIN_VALUE;
		int minSize = Integer.MAX_VALUE;
		int totalSize = 0;
		for (String id : _clusteringResult.keySet()) {
			Set<String> members = _clusteringResult.get(id);
			if (members.size() > maxSize) {
				maxSize = members.size();
			}
			if (members.size() < minSize) {
				minSize = members.size();
			}
			totalSize += members.size();
		}
		double averageSize = (double)totalSize / _clusteringResult.size();
		 
		summary.put("Minimum Cluster Size", minSize + "");
		summary.put("Maximum Cluster Size", maxSize + "");
		summary.put("Average Cluster Size", averageSize + "");
		
		return summary;
	}

	private void sortClusterParams() {
		Collections.sort(_clusterParameters, new Comparator<Pair<String,Double>>() {
			public int compare(Pair<String, Double> o1, Pair<String, Double> o2) {
				return o1.getSecond().compareTo(o2.getSecond());
			}
		});
	}
	
	public ClusterResults(String datasetName, Map<String, Set<String>> clusteringResult, String clusterParamtersString) {
		_clusterParamtersString = clusterParamtersString;
		_datasetName = datasetName;
		_clusteringResult = clusteringResult;
		_clusterParameters = new ArrayList<Pair<String,Double>>();
		
		// Build param list from the supplied JSON string
		String[] paramsSplit = clusterParamtersString.split("-");
		try {
			JSONArray attrsJson = new JSONArray(paramsSplit[1]);
			ArrayList<String> attrs = new ArrayList<String>();
			for (int i = 0; i < attrsJson.length(); i++) {
				attrs.add(attrsJson.getString(i));
			}
			
			JSONArray weightsJson = new JSONArray(paramsSplit[2]);
			ArrayList<Double> weights = new ArrayList<Double>();
			for (int i = 0; i < weightsJson.length(); i++) {
				weights.add(weightsJson.getDouble(i));
			}
			
			if (attrs.size() != weights.size()) throw new IllegalArgumentException();
			
			for (int i = 0; i < attrs.size(); ++i) {
				_clusterParameters.add(new Pair<String, Double>(attrs.get(i), weights.get(i)));
			}
		} catch (JSONException e) {
			throw new IllegalArgumentException();
		}
		
		sortClusterParams();
	}
	
	public List<Pair<String,Double>> getClusterParameters() {
		return _clusterParameters;
	}
	
	public Map<String, Set<String>> getClustersById() {
		return _clusteringResult;
	}
	
	public Set<String> getMembers(String id) {
		return _clusteringResult.get(id);
	}
	
	
	private static HashMap<String, Integer> getFeatureCounts(DataTable table, String key, Set<String> c) {
		HashMap<String, Integer> valueCounts = new HashMap<String, Integer>();
		if (table != null) {
			for (String memberId : c) {
				DataRow originalRow = table.getRowById(memberId);
				if (originalRow != null) {
					String value = originalRow.get(key);
					if (value!=null) value = value.trim().toLowerCase();
					if (!(value==null||value.startsWith("null")||value.length()==0)) {
						Integer currentCount = valueCounts.get(value);
						if (currentCount == null) {
							currentCount = 0;
						}
						currentCount++;
						valueCounts.put(value, currentCount);
					}
				}
			}
		}
		return valueCounts; 
	}
	
	private static int getCommonPropertyValueCount(DataTable table, Set<String> a, Set<String> b, String key, HashSet<String> ignoreValues) {
		
		HashMap<String, Integer> aCounts = getFeatureCounts(table, key, a);
		HashMap<String, Integer> bCounts = getFeatureCounts(table, key, b);
		HashMap<String, Integer> commonValues = new HashMap<String,Integer>();
		
		// Create a map of all common keys between aCounts and bCounts
		Set<String> allKeys = new HashSet<String>(aCounts.keySet());
		allKeys.addAll(bCounts.keySet());
		
		// Get counts of all common attributes
		for (String value : allKeys) {
			if (ignoreValues!=null && ignoreValues.contains(value)) continue;
			Integer bCount = bCounts.get(value);
			Integer aCount = aCounts.get(value);
			if (aCount != null && bCount != null) {
				commonValues.put(value, Math.min(aCount, bCount));
			}
		}
		
		// Return the sum of all count values
		Integer count = 0;
		for (String value : commonValues.keySet()) {
			count += commonValues.get(value);
		}
		return count;
	}
	
	public List<String> filter(Map<String,Integer> excludedClusters) {
		List<String> result = new ArrayList<String>();
		for (String clusterId : _clusteringResult.keySet()) {
			if (!excludedClusters.containsKey(clusterId)) {
				result.add(clusterId);
			}
		}
		return result;
	}

	public List<String> dbFilter(ArrayList<LinkFilter> filters) {
		List<String> result = new ArrayList<String>();
		String where = "where ";
		boolean doSqlSelect = false;
		boolean testClusterSize = false;
		double sizeThreshold = 0;
		LinkFilter.Condition sizeCondition = LinkFilter.Condition.LT;
		boolean isFirst = true;
		ArrayList<LinkFilter> tagFilters = new ArrayList<LinkFilter>();
		for (LinkFilter filter:filters) {
			if (filter.filterAttribute.equals("Cluster Size")) {
				testClusterSize = true;
				sizeThreshold = Double.parseDouble(filter.value);
				sizeCondition = filter.condition;
			} else if (filter.filterAttribute.equals("tag")) {
				doSqlSelect = true;
				tagFilters.add(filter);		// defer processing of tag filters until others are done
			}else {
				doSqlSelect = true;
				if (isFirst) isFirst = false;
				else where += " AND ";
				where += filter.getWhereClause();
			}
		}
		
		if (tagFilters.size() > 0) {
			if (!where.equals("where ")) {
				where += " AND ";
			}
			where += "( ";
			for (int i = 0; i < tagFilters.size() - 1; i++) {
				where += tagFilters.get(i).getWhereClause() + " OR ";
			}
			where += tagFilters.get(tagFilters.size() - 1).getWhereClause() + ")";
		}

		List<String> matchingAds = doSqlSelect?TableDB.getInstance().getMatches(_datasetName, where, tagFilters.size() > 0):null;
		for (String clusterId : _clusteringResult.keySet()) {
			Set<String> members = _clusteringResult.get(clusterId);
			if (testClusterSize) {
				int size = members.size();
				if (!LinkFilter.testNumber(size, sizeThreshold, sizeCondition)) {
					continue;
				} else if (!doSqlSelect) {
					result.add(clusterId);
				}
			}
			if (doSqlSelect) {
				for (String member:members) {
					if (matchingAds.contains(member)) {
						result.add(clusterId);
						break;
					}
				}
			}
		}
		return result;
	}
	
	public List<String> filter(ArrayList<LinkFilter> filters) {
		List<String> result = new ArrayList<String>(); 
		ArrayList<String> columns = new ArrayList<String>();
		for (LinkFilter filter:filters) {
			if (!( filter.filterAttribute.equals("Cluster Size") || filter.filterAttribute.equals("tag"))) {
				columns.add(filter.filterAttribute);
			}
		}
		DataTable table = TableDB.getInstance().getDataTableColumns(_datasetName, columns);
		for (String clusterId : _clusteringResult.keySet()) {
			Set<String> members = _clusteringResult.get(clusterId);
			boolean addCluster = true;
			for (LinkFilter lf : filters) {
				addCluster &= lf.testCluster(table,members,_datasetName);
				if (!addCluster) {
					break;
				}
			}
			if (addCluster) {
				result.add(clusterId);
			}
			
		}
		return result;
	}
	
	public Map<String, List<ClusterLink>> getConnectivity(Iterable<String> srcClusters,Iterable<String> dstClusters, String datasetName, ArrayList<RestLinkCriteria> linkCriteria, boolean ignoreCommon) {
		Map<String, List<ClusterLink>> links = new HashMap<String, List<ClusterLink>>();
		Set<String> addedLinks = new HashSet<String>(); 

		ArrayList<String> allLinkKeys = new ArrayList<String>();
		for (RestLinkCriteria rlc : linkCriteria) {
			for (String attr : rlc.getAttributes()) {
				if (allLinkKeys.indexOf(attr) == -1) {
					allLinkKeys.add(attr);
				}
			}
		}
		if (allLinkKeys.size()==0) return links;
		DataTable table = TableDB.getInstance().getDataTableColumns(datasetName, allLinkKeys);
		
		HashMap<String,HashSet<String>> ignoreValues = new HashMap<String,HashSet<String>>();
		if (ignoreCommon) {
			// Create sets of values to ignore (because they are too common) for each linkBy attribute
			for (String key : allLinkKeys) {
				TableDistribution td = TableDB.getInstance().getValueCounts(datasetName, key);
				for (Map.Entry<String,Integer> entry:td.distribution.entrySet()) {
					if (entry.getValue()>20) {
						HashSet<String> ignore = ignoreValues.get(key);
						if (ignore==null) {
							ignore = new HashSet<String>();
							ignoreValues.put(key, ignore);
						}
						ignore.add(entry.getKey());
					}
				}
			}
		}
		
		double sum = 0.0;
		for (RestLinkCriteria rlc : linkCriteria) {
			sum += rlc.getWeight();
		}
		HashMap<RestLinkCriteria,Double> normalizedWeights = new HashMap<RestLinkCriteria,Double>();
		for (RestLinkCriteria rlc : linkCriteria) {
			normalizedWeights.put(rlc,  rlc.getWeight() / sum );
		}
				
		for (String srcId : srcClusters) {
			for (String dstId : dstClusters) {
				
				if ( srcId.equals(dstId) ) {
					continue;
				}
								
				
				// Each set of attributes in the RestLinkCriteria must be true for a pair of clusters to be connected
				// Create a link for each RestLinkCriteria (if they pass the connectivity test)
				for (RestLinkCriteria rlc : linkCriteria) {
					
					// Make sure we don't double up links
					if (addedLinks.contains(srcId + "-" + dstId + "-" + rlc.getName()) || addedLinks.contains(dstId + "-" + srcId + "-" + rlc.getName())) {
						continue;
					}

					boolean createLink = true;
					for (String attr : rlc.getAttributes()) {
						int numSharedValues = getCommonPropertyValueCount(table, _clusteringResult.get(srcId), _clusteringResult.get(dstId), attr, ignoreValues.get(attr));
						if (numSharedValues <= 0) {
							createLink = false;
							break;
						}
					}
					if (createLink) {
						List<ClusterLink> srcAdjList = links.get(srcId);
						if (srcAdjList == null) {
							srcAdjList = new ArrayList<ClusterLink>();
						}
						ClusterLink edge = new ClusterLink();
						edge.linkedClusterId = dstId;
						edge.clusterLinkAttribute = rlc.getName();
						edge.weight = normalizedWeights.get(rlc);
						
						addedLinks.add(srcId + "-" + dstId + "-" + rlc.getName());
						
						srcAdjList.add(edge);
						links.put(srcId, srcAdjList);
					}
				}
			}
		}
		return links;
	}

	public Map<String, List<ClusterLink>> getConnectivity(Iterable<String> clusters, String datasetName, ArrayList<RestLinkCriteria> linkCriteria) {
		return getConnectivity(clusters, clusters, datasetName, linkCriteria, false);
	}
	
	public List<DataRow> getClusterDetails(String clusterId) {		
		List<DataRow> results = new ArrayList<DataRow>();
		
		Set<String> members = _clusteringResult.get(clusterId);
		DataTable table = TableDB.getInstance().getDataTableMembers(_datasetName, members);
				
		for (String memberId : members) {
			DataRow row = table.getRowById(memberId);
			if (row != null) {
				
				// Add any user tags to the row
				ArrayList<String> tags = TableDB.getInstance().getTags(memberId);
				String tagString = "";
				if (tags != null && tags.size() > 0) {
					for (int i = 0; i < tags.size() - 1; i++) {
						tagString += tags.get(i) + ',';
					}
					tagString += tags.get(tags.size()-1);
				}
				row.put("tags", tagString);
				results.add(row);
			}
		}

		return results;
	}

	public Set<String> getCluster(String clusterId) {
		return _clusteringResult.get(clusterId);
	}
	
	public String getClusterName(DataTable table, String clusterId) {
		// Grab any example of highest weighted feature
		Set<String> members = _clusteringResult.get(clusterId);
		String key = _clusterParameters.get(0).getFirst();		// List is sorted by weight
		for (String memberId : members) {
			DataRow row = table.getRowById(memberId);
			String value = row.get(key);
			if (value != null) {
				return value; 
			} else {
				return "";
			}
		}
		return "EMPTY";
	}

	public String getClusterName(DenseDataTable table, String clusterId) {
		// Grab any example of highest weighted feature
		Set<String> members = _clusteringResult.get(clusterId);
		String key = _clusterParameters.get(0).getFirst();		// List is sorted by weight
		int keyIdx = table.columns.indexOf(key);
		for (String memberId : members) {
			String[] row = table.getRowById(memberId);
			String value = row[keyIdx];
			if (value != null) {
				return value; 
			} else {
				return "";
			}
		}
		return "EMPTY";
	}

	public String getClusterParametersString() {
		return _clusterParamtersString;
	}
	
}
