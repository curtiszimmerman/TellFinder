package oculus.xdataht.model;

import java.util.HashMap;

public class IntegerMap {
    private HashMap<String,Integer> map;

    public IntegerMap() { }
    public IntegerMap(HashMap<String,Integer> map) {
        setmap(map);
    }

    public void setmap(HashMap<String,Integer> map) { this.map = map; }
    public HashMap<String,Integer> getmap() { return map; }

    public void put(String key, Integer value) {
        if (map == null) {
            map = new HashMap<String,Integer>();
        }
        map.put(key, value);
    }

    public Integer get(String key) {
        if (map == null) {
            return null;
        } else {
            return map.get(key);
        }
    }
}
