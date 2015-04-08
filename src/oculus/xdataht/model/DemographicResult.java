package oculus.xdataht.model;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class DemographicResult {
	String location;
	float lat;
	float lon;
	float value;
	float rape;
	float robbery;
	float expenditures;
	float ads;
	float white;
	float black;
	
	public DemographicResult() { }

	public DemographicResult(String location, float lat, float lon,
			float value) {
		super();
		this.location = location;
		this.lat = lat;
		this.lon = lon;
		this.value = value;
	}

	public DemographicResult(String location, float lat, float lon,
			float rape, float robbery, float expenditures, float ads,
			float white, float black) {
		this.location = location;
		this.lat = lat;
		this.lon = lon;
		this.rape = rape;
		this.robbery = robbery;
		this.expenditures = expenditures;
		this.ads = ads;
		this.white = white;
		this.black = black;
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

	public float getValue() {
		return value;
	}

	public void setValue(float value) {
		this.value = value;
	}

	public float getRape() {
		return rape;
	}

	public void setRape(float rape) {
		this.rape = rape;
	}

	public float getRobbery() {
		return robbery;
	}

	public void setRobbery(float robbery) {
		this.robbery = robbery;
	}

	public float getExpenditures() {
		return expenditures;
	}

	public void setExpenditures(float expenditures) {
		this.expenditures = expenditures;
	}

	public float getAds() {
		return ads;
	}

	public void setAds(float ads) {
		this.ads = ads;
	}

	public float getWhite() {
		return white;
	}

	public void setWhite(float white) {
		this.white = white;
	}

	public float getBlack() {
		return black;
	}

	public void setBlack(float black) {
		this.black = black;
	}

}
