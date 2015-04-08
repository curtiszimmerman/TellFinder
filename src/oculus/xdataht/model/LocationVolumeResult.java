package oculus.xdataht.model;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class LocationVolumeResult {
	int count;
	float lat;
	float lon;
	String location;
	
	public LocationVolumeResult() { }

	public int getCount() {
		return count;
	}

	public void setCount(int count) {
		this.count = count;
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

	public String getLocation() {
		return location;
	}

	public void setLocation(String location) {
		this.location = location;
	}

	public LocationVolumeResult(int count, float lat, float lon, String location) {
		this.count = count;
		this.lat = lat;
		this.lon = lon;
		this.location = location;
	}

	
}
