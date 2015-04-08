package oculus.xdataht.model;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class SimpleGraphRequest {
	private String searchString;
	private String clusterType;
	private int ringCount;
	
	public SimpleGraphRequest() { }

	public SimpleGraphRequest(String searchString, String clusterType, int ringCount) {
		super();
		this.searchString = searchString;
		this.clusterType = clusterType;
		this.setRingCount(ringCount);
	}

	public String getSearchString() {
		return searchString;
	}

	public void setSearchString(String searchString) {
		this.searchString = searchString;
	}

	public String getClusterType() {
		return clusterType;
	}

	public void setClusterType(String clusterType) {
		this.clusterType = clusterType;
	}

	public int getRingCount() {
		return ringCount;
	}

	public void setRingCount(int ringCount) {
		this.ringCount = ringCount;
	}
	
	
}
