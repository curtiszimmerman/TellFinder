package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class GraphResult {
	private ArrayList<RestNode> nodes = new ArrayList<RestNode>();
	private ArrayList<RestLink> links = new ArrayList<RestLink>();
	
	public GraphResult() { }

	public GraphResult(ArrayList<RestNode> nodes, ArrayList<RestLink> links) {
		this.nodes = nodes;
		this.links = links;
	}

	public ArrayList<RestNode> getNodes() {
		return nodes;
	}

	public void setNodes(ArrayList<RestNode> nodes) {
		this.nodes = nodes;
	}
	
	public void addNode(RestNode r) {
		nodes.add(r);
	}
	
	public ArrayList<RestLink> getLinks() { 
		return links;
	}
	
	public void setLinks(ArrayList<RestLink> links) {
		this.links = links;
	}
	
	public void addLink(RestLink l) {
		links.add(l);
	}
}
