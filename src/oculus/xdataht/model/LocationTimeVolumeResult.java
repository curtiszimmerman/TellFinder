package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class LocationTimeVolumeResult {
	String location;
	float lat;
	float lon;
	ArrayList<TimeVolumeResult> timeseries;
	
	public LocationTimeVolumeResult() { }

	public LocationTimeVolumeResult(String location, float lat, float lon,
			ArrayList<TimeVolumeResult> timeseries) {
		super();
		this.location = location;
		this.lat = lat;
		this.lon = lon;
		this.timeseries = timeseries;
	}

	public String getLocation() {
		return location;
	}

	public void setLocation(String location) {
		this.location = location;
	}

	public float getLat() {
		return lat;
	}

	public void setLat(float lat) {
		this.lat = lat;
	}

	public float getLon() {
		return lon;
	}

	public void setLon(float lon) {
		this.lon = lon;
	}

	public ArrayList<TimeVolumeResult> getTimeseries() {
		return timeseries;
	}

	public void setTimeseries(ArrayList<TimeVolumeResult> timeseries) {
		this.timeseries = timeseries;
	}


}
