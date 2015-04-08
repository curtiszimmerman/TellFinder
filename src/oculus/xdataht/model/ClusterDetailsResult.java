package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class ClusterDetailsResult {
	private ArrayList<StringMap> memberDetails;
    private ArrayList<IntegerMap> wordHistograms;
	
	public ClusterDetailsResult() { }

	public ClusterDetailsResult(ArrayList<StringMap> memberDetails) {
        super();
        initialize(memberDetails,null);
	}

    public ClusterDetailsResult(ArrayList<StringMap> memberDetails, ArrayList<IntegerMap> wordHistograms) {
        super();
        initialize(memberDetails,wordHistograms);
    }

    private void initialize(ArrayList<StringMap> memberDetails, ArrayList<IntegerMap> wordHistograms) {
        this.memberDetails = memberDetails;
        this.wordHistograms = wordHistograms;
    }

	public ArrayList<StringMap> getMemberDetails() {
		return memberDetails;
	}

    public ArrayList<IntegerMap> getWordHistograms() {
        return wordHistograms;
    }

	public void setMemberDetails(ArrayList<StringMap> memberDetails) {
		this.memberDetails = memberDetails;
	}
    public void setWordHistograms(ArrayList<IntegerMap> wordHistograms) {
        this.wordHistograms = wordHistograms;
    }
}
