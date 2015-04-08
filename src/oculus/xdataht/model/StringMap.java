package oculus.xdataht.model;

import java.util.HashMap;

public class StringMap {
	private HashMap<String,String> map;
	
	public StringMap() { }
	public StringMap(HashMap<String,String> map) { 
		setmap(map);
	}
	
	public void setmap(HashMap<String,String> map) { this.map = map; }
	public HashMap<String,String> getmap() { return map; }
	
	public void put(String key, String value) {
		if (map == null) {
			map = new HashMap<String,String>();
		}
		map.put(key, value);
	}

	public String get(String key) {
		if (map == null) {
			return null;
		} else {
			return map.get(key);
		}
	}
}
