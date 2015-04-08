package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class TimeVolumeResults {
	ArrayList<TimeVolumeResult> results;
	
	public TimeVolumeResults() {}

	public TimeVolumeResults(ArrayList<TimeVolumeResult> results) {
		super();
		this.results = results;
	}

	public ArrayList<TimeVolumeResult> getResults() {
		return results;
	}

	public void setResults(ArrayList<TimeVolumeResult> results) {
		this.results = results;
	}
}
