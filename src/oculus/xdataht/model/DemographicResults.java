package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class DemographicResults {
	ArrayList<DemographicResult> results;
	
	public DemographicResults() {}

	public DemographicResults(ArrayList<DemographicResult> results) {
		super();
		this.results = results;
	}

	public ArrayList<DemographicResult> getResults() {
		return results;
	}

	public void setResults(ArrayList<DemographicResult> results) {
		this.results = results;
	}
}
