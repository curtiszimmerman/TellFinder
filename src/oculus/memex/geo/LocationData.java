package oculus.memex.geo;

import java.io.Serializable;

public class LocationData implements Serializable {
	private static final long serialVersionUID = 1L;

	public String label;
	public float lat;
	public float lon;
	public long time;
	public LocationData(String label, float lat, float lon, long time) {
		this.label = label;
		this.lat = lat;
		this.lon = lon;
		this.time = time;
	}

}
