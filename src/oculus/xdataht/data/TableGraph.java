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
package oculus.xdataht.data;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import oculus.memex.clustering.ClusterLink;
import oculus.memex.util.DataUtil;
import oculus.memex.util.Pair;
import oculus.xdataht.clustering.ClusterResults;
import oculus.xdataht.graph.GraphLink;
import oculus.xdataht.graph.GraphNode;
import oculus.xdataht.model.GraphResult;
import oculus.xdataht.model.RestLink;
import oculus.xdataht.model.RestNode;
import oculus.xdataht.model.StringMap;

public class TableGraph {
	private static int next_link_id = 0;
	
	public static void create(ArrayList<DataRow> subset, Map<String, Object> result, ArrayList<String> linkAttributes) {
		ArrayList<GraphNode> nodes = new ArrayList<GraphNode>();		
		for (DataRow dr:subset) {
			GraphNode gn = new GraphNode();
			gn.data = dr;
			nodes.add(gn);
		}
		ArrayList<GraphNode> attributeNodes = new ArrayList<GraphNode>();
		ArrayList<GraphLink> links = new ArrayList<GraphLink>();
		for (String attribute:linkAttributes) {
			linkAttribute(nodes, links, attributeNodes, attribute);
		}
		nodes.addAll(attributeNodes);
		
		ArrayList<HashMap<String,Object>> rnodes = new ArrayList<HashMap<String,Object>>();
		result.put("nodes", rnodes);
		int maxLinks = 0;
		for (int i=0 ;i<nodes.size(); i++) {
			GraphNode node = nodes.get(i);
			HashMap<String,Object> rnode = new HashMap<String,Object>();
			rnode.put("id", node.data.get("id"));
			rnode.put("name", node.data.get("name"));
			rnode.put("label", node.data.get("title"));
			rnode.put("fields", node.data.copyFields());
			rnode.put("ring", node.isAttribute?0:1);
			rnode.put("links", getLinks(node));
			rnodes.add(rnode);
			int linkCount = node.links.size();
			if (linkCount>maxLinks) maxLinks = linkCount;
		}

		result.put("connectedness", maxLinks);
		ArrayList<HashMap<String,Object>> rlinks = new ArrayList<HashMap<String,Object>>();
		result.put("links", rlinks);
		for (int i=0 ;i<links.size(); i++) {
			GraphLink link = links.get(i);
			HashMap<String,Object> rlink = new HashMap<String,Object>();
			rlink.put("id", ""+link.id);
			rlink.put("sourceId", link.source.data.get("id"));
			rlink.put("targetId", link.target.data.get("id"));
			rlinks.add(rlink);
		}
	}
	public static void create(	ClusterResults fullResults,
								Iterable<String> filteredResults,
								Map<String, List<ClusterLink>> connectivity, 
								GraphResult result,
								boolean onlyLinkedNodes,
								String datasetName,
								ArrayList<String> attributesOfInterest,
								Map<String, Integer> existingNodeLevels) {
		int clusterNo = 1;
		int clusterSizeMin = Integer.MAX_VALUE;
		int clusterSizeMax = Integer.MIN_VALUE;
		
		int newLevel = 0;
		if (existingNodeLevels.size() != 0) {
			int maxLevel = Integer.MIN_VALUE;
			for (String clusterId : existingNodeLevels.keySet()) {
				if (existingNodeLevels.get(clusterId) > maxLevel) {
					maxLevel = existingNodeLevels.get(clusterId);
				}
			}
			newLevel = maxLevel + 1;
		}

		
		// Get all nodes that have incoming OR outgoing connections
		Set<String> connectedNodeIds = new HashSet<String>();
		if (onlyLinkedNodes == true) {
			for (String id : connectivity.keySet()) {
				List<ClusterLink> adjacentNodes = connectivity.get(id);
				for (ClusterLink link : adjacentNodes) {
					connectedNodeIds.add(link.linkedClusterId);
				}
				connectedNodeIds.add(id);
			}
		}
		HashMap<String,ArrayList<StringMap>> nodeLinksMap = new HashMap<String,ArrayList<StringMap>>();
		
		ArrayList<String> fetchAttributes = new ArrayList<String>();
		if (attributesOfInterest!=null) fetchAttributes.addAll(attributesOfInterest);
		List<Pair<String, Double>> clusterParameters = fullResults.getClusterParameters();
		for (Pair<String,Double> param:clusterParameters) fetchAttributes.add(param.getFirst());

		System.out.println("\tFetching ads");
		ArrayList<String> allMembers = new ArrayList<String>();
		for (String clusterId : filteredResults) {
			Set<String> members = fullResults.getCluster(clusterId);
			if (members.size()>100) {
				Set<String> subset = new HashSet<String>();
				int count = 0;
				for (String member:members) {
					subset.add(member);
					count++;
					if (count>99) break;
				}
			}
			allMembers.addAll(members);
		}
		if (allMembers.size()==0) {
			return;
		}

		DataTable table;
		if (allMembers.size()<2000) {
			TableDB.getInstance().open();
			try {
				table = TableDB.getInstance().getDataTableColumns(datasetName, fetchAttributes, allMembers);
			} catch (Exception e) {
				e.printStackTrace();
				return;
			}
			TableDB.getInstance().close();
		} else {
			table = TableDB.getInstance().getDataTableColumns(datasetName, fetchAttributes);
		}

		System.out.println("\tCreating result nodes");
		for (String clusterId : filteredResults) {
			
			Set<String> members = fullResults.getCluster(clusterId);
			
			if (onlyLinkedNodes == true && !connectedNodeIds.contains(clusterId)) {
				clusterNo++;
				continue;
			}
			
			RestNode rnode = new RestNode();
			String nameStr = fullResults.getClusterName(table, clusterId);
			rnode.setId(clusterId);
			rnode.setName("Entity " + clusterNo);
			rnode.setLabel("Entity " + clusterNo);
			
			if (existingNodeLevels.size() == 0) {
				rnode.setRing(0);
			} else {
				Integer existingLevel = existingNodeLevels.get(clusterId);
				if (existingLevel == null) {
					existingLevel = newLevel;
				} 
				rnode.setRing(existingLevel);
			}
			
			HashMap<String,String> attributeOutput = new HashMap<String,String>();

			for (String attribute:fetchAttributes) {
				String valueStr = createAttributeTooltipString(table, members,attribute);
				attributeOutput.put(attribute, valueStr);
			}
			if (nameStr!=null && nameStr.length()>0) {
				rnode.setName(nameStr);
				rnode.setLabel(nameStr);
			}
			rnode.setSize(members.size());
			if (attributeOutput.size()>0) {
				rnode.setAttributes(new StringMap(attributeOutput));
			}
			ArrayList<StringMap> nodeLinks = new ArrayList<StringMap>();
			rnode.setLinks(nodeLinks);
			nodeLinksMap.put(clusterId, nodeLinks);
			
			if (members.size() > clusterSizeMax) {
				clusterSizeMax = members.size();
			}
			if (members.size() < clusterSizeMin) {
				clusterSizeMin = members.size();
			}
			rnode.setClusterSize(members.size());
			rnode.setSize(members.size());
			result.addNode(rnode);
			
			clusterNo++;
		}
		
		// Normlize cluster sizes
		System.out.println("\tNormalize and sort");
		for (RestNode rnode : result.getNodes()) {
			int size = (int)(rnode.getSize());
			double range = clusterSizeMax-clusterSizeMin;
			if (range==0) {
				rnode.setSize(0);
			} else {
				double normalizedSize = (size - clusterSizeMin)/range;
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
		
		System.out.println("\tCreating link set");
		ArrayList<RestLink> rlinks = new ArrayList<RestLink>();
		result.setLinks(rlinks);
		for (String sourceId : connectivity.keySet()) {
			List<ClusterLink> adjacentClusters = connectivity.get(sourceId);
			for (ClusterLink link : adjacentClusters ) {
				String targetId = link.linkedClusterId;
				RestLink rlink = new RestLink(sourceId, targetId, link.weight, null);
				rlinks.add(rlink);
				
				ArrayList<StringMap> srcLinks = nodeLinksMap.get(sourceId);
				StringMap srcLink = new StringMap();
				srcLink.put("id", sourceId + "_" + targetId);
				srcLink.put("other", targetId);
				srcLinks.add(srcLink);
				ArrayList<StringMap> destLinks = nodeLinksMap.get(targetId);
				StringMap destLink = new StringMap();
				destLink.put("id", sourceId + "_" + targetId);
				destLink.put("other", sourceId);
				destLinks.add(destLink);
			}
		}		
	}
	private static String createAttributeTooltipString(DataTable table, Set<String> members, String attribute) {
		HashSet<String> values = new HashSet<String>();
		for (String memberId : members) {
			DataRow row = table.getRowById(memberId);
			if (row!=null) values.add(DataUtil.sanitizeHtml(row.get(attribute)));
		}
		String valueStr = "";
		boolean isFirst = true;
		int count = 0;
		for (String value:values) {
			if (isFirst) isFirst = false;
			else valueStr += "\n";
			valueStr += value;
			count++;
			if (count>10) {
				valueStr += "\n&hellip;";
				break;
			}
		}
		return valueStr;
	}
	public static String createAttributeTooltipString(DenseDataTable table, Set<String> members, String attribute) {
		HashSet<String> values = new HashSet<String>();
		int attributeIdx =  table.columns.indexOf(attribute);
		for (String memberId : members) {
			String[] row = table.getRowById(memberId);
			if (row!=null) values.add(DataUtil.sanitizeHtml(row[attributeIdx]));
		}
		String valueStr = "";
		boolean isFirst = true;
		int count = 0;
		for (String value:values) {
			if (isFirst) isFirst = false;
			else valueStr += "\n";
			valueStr += value;
			count++;
			if (count>10) {
				valueStr += "\n&hellip;";
				break;
			}
		}
		return valueStr;
	}
	private static ArrayList<HashMap<String,String>> getLinks(GraphNode node) {
		ArrayList<HashMap<String,String>> result = new ArrayList<HashMap<String,String>>();
		String nid = node.data.get("id");
		for (int i=0; i<node.links.size(); i++) {
			GraphLink link = node.links.get(i);
			HashMap<String,String> rlink = new HashMap<String,String>();
			rlink.put("id", ""+link.id);
			String sid = ((DataRow)link.source.data).get("id");
			String tid = ((DataRow)link.target.data).get("id");
			if (nid.equals(sid)) {
				rlink.put("other", tid);
			} else {
				rlink.put("other", sid);
			}
			result.add(rlink);
		}
		return result;
	}
	@SuppressWarnings("unchecked")
	public static void linkAttribute(ArrayList<GraphNode> nodes, ArrayList<GraphLink> links, ArrayList<GraphNode> attributeNodes, String attribute) {
		ArrayList<GraphNode> remainingNodes = (ArrayList<GraphNode>)nodes.clone();
		while (remainingNodes.size()>0) {
			GraphNode gn = remainingNodes.remove(0);
			DataRow dr = (DataRow)gn.data;
			String value = dr.get(attribute);
			GraphNode attributeNode = new GraphNode();
			attributeNode.isAttribute = true;
			attributeNode.data = new DataRow(attribute + " " + value, attribute, value);

			attributeNodes.add(attributeNode);
			linkNodes(links, gn, attributeNode);
			int idx = 0;
			while (idx<remainingNodes.size()) {
				GraphNode gn2 = remainingNodes.get(idx);
				DataRow dr2 = (DataRow)gn2.data;
				String value2 = dr2.get(attribute);
				if (((value2!=null)&&(value2.equals(value)))||(value==null)) {
					remainingNodes.remove(idx);
					linkNodes(links, gn2, attributeNode);
				} else {
					idx++;
				}
			}
		}
	}
	private static void linkNodes(ArrayList<GraphLink> links, GraphNode n1,	GraphNode n2) {
		GraphLink gl = new GraphLink();
		gl.id = next_link_id++;
		gl.source = n1;
		gl.target = n2;
		links.add(gl);
		n1.links.add(gl);
		n2.links.add(gl);
	}
}
