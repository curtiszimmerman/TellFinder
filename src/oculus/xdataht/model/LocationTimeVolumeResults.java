package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class LocationTimeVolumeResults {
	ArrayList<LocationTimeVolumeResult> results;
	
	public LocationTimeVolumeResults() {}

	public LocationTimeVolumeResults(ArrayList<LocationTimeVolumeResult> results) {
		super();
		this.results = results;
	}

	public ArrayList<LocationTimeVolumeResult> getResults() {
		return results;
	}

	public void setResults(ArrayList<LocationTimeVolumeResult> results) {
		this.results = results;
	}
}
