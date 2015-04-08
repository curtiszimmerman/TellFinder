package oculus.xdataht.model;

import java.util.HashMap;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class ClustersDetailsResult {
	private HashMap<Integer, ClusterDetailsResult> memberDetails;
	
	public ClustersDetailsResult() { }

	public ClustersDetailsResult(HashMap<Integer, ClusterDetailsResult> memberDetails) {
		super();
		this.memberDetails = memberDetails;
	}

	public HashMap<Integer, ClusterDetailsResult> getMemberDetails() {
		return memberDetails;
	}

	public void setMemberDetails(HashMap<Integer, ClusterDetailsResult> memberDetails) {
		this.memberDetails = memberDetails;
	}	
}