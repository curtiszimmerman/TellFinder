package oculus.memex.util;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

import org.jsoup.Jsoup;
import org.jsoup.safety.Whitelist;

/**
 * Tools for manipulating hash maps of counts of things
 */
public class HashCount {
	private static final int MIN_KEY_LENGTH = 2;
	private static final int MAX_KEY_LENGTH = 200;
	private static final String NO_AGGREGATE_VALUE = "none";
	private static final int MAX_NUM_DETAILS = 40;
	
	public static void incrementCounts(String attrVal, HashMap<String,Integer> counts) {
		if (attrVal==null) {
			incrementCount(NO_AGGREGATE_VALUE, counts);
			return;
		}
		attrVal = attrVal.trim().toLowerCase();
		attrVal = Jsoup.clean(attrVal, Whitelist.none());
		String[] vals = attrVal.split(",");
		for (String val:vals) {
			incrementCount(val, counts);
		}
	}

	public static void incrementCounts(HashSet<Pair<String,String>> kwClassifiers, HashMap<String, HashMap<String, Integer>> counts) {
		if (kwClassifiers==null) {
			return;
		}
		for (Pair<String,String> kwClassifier:kwClassifiers) {
			String classifier = kwClassifier.getSecond();
			HashMap<String,Integer> cmap = counts.get(classifier);
			if (cmap==null) {
				cmap = new HashMap<String,Integer>();
				counts.put(classifier,  cmap);
			}
			incrementCount(kwClassifier.getFirst(), cmap);
		}
	}
	
	public static void incrementCount(String val, HashMap<String,Integer> counts) {
		if (val==null) val = NO_AGGREGATE_VALUE;
		val = val.trim();
		val = Jsoup.clean(val, Whitelist.none());
		Integer count = counts.get(val);
		if (count==null) {
			count = new Integer(1);
		} else {
			count++;
		}
		counts.put(val, count);
	}
	
	public static String mapToString(HashMap<String, Integer> map, Pair<String, Integer> maxValue) {
		if (map==null) return "";
		ArrayList<Pair<String,Integer>> a = new ArrayList<Pair<String,Integer>>();
		for (Map.Entry<String, Integer> e:map.entrySet()) {
			String key = e.getKey();
			key = key.trim();
			if (key.length()<MIN_KEY_LENGTH) continue;
			if (key.length()>MAX_KEY_LENGTH) key = key.substring(0, MAX_KEY_LENGTH);
			a.add(new Pair<String,Integer>(key,e.getValue()));
		}
		Collections.sort(a, new Comparator<Pair<String,Integer>>() {
			public int compare(Pair<String, Integer> o1, Pair<String, Integer> o2) {
				return o2.getSecond()-o1.getSecond();
			}
		});

		String result = "";
		boolean isFirst = true;
		for (int i=0; i<MAX_NUM_DETAILS && i<a.size(); i++) {
			Pair<String,Integer> p = a.get(i);
			if (isFirst) {
				isFirst = false;
				if ((maxValue!=null) && (p.getFirst().compareTo("none")!=0)) maxValue.set(p.getFirst(), p.getSecond());
			} else result += ",";
			result += "\"" + p.getFirst() + "\":" + p.getSecond();
		}
		return result.replaceAll("[^\\u0000-\\uFFFFFF]", "?");
	}

	public static String longMapToString(HashMap<Long, Integer> map) {
		String result = "";
		boolean isFirst = true;
		for (Map.Entry<Long,Integer> e:map.entrySet()) {
			if (isFirst) isFirst = false;
			else result += ",";
			result += "\"" + e.getKey() + "\":" + e.getValue();
		}
		return result;
	}
	
	public static String classifierMapToString(HashMap<String, HashMap<String, Integer>> classifierMap) {
		if (classifierMap==null) return "";
		HashMap<String,ArrayList<Pair<String,Integer>>> classifierArrays = new HashMap<String,ArrayList<Pair<String,Integer>>>();
		for (Map.Entry<String, HashMap<String, Integer>> e:classifierMap.entrySet()) {
			String classifier = e.getKey();
			HashMap<String,Integer> map = e.getValue();
			ArrayList<Pair<String,Integer>> a = new ArrayList<Pair<String,Integer>>();
			classifierArrays.put(classifier, a);
			for (Map.Entry<String,Integer> ke:map.entrySet()) {
				String key = ke.getKey();
				key = key.trim();
				if (key.length()<MIN_KEY_LENGTH) continue;
				if (key.length()>MAX_KEY_LENGTH) key = key.substring(0, MAX_KEY_LENGTH);
				a.add(new Pair<String,Integer>(key,ke.getValue()));
			}
			Collections.sort(a, new Comparator<Pair<String,Integer>>() {
				public int compare(Pair<String, Integer> o1, Pair<String, Integer> o2) {
					return o2.getSecond()-o1.getSecond();
				}
			});
		}

		String result = "";
		boolean isFirstClassifier = true;
		for (Map.Entry<String, ArrayList<Pair<String, Integer>>> e:classifierArrays.entrySet()) {
			if (isFirstClassifier) {
				isFirstClassifier = false;
			} else result += ",";
			result += "\"" + e.getKey() + "\":{";
			ArrayList<Pair<String,Integer>> a = e.getValue();
			boolean isFirst = true;
			for (int i=0; i<MAX_NUM_DETAILS && i<a.size(); i++) {
				Pair<String,Integer> p = a.get(i);
				if (isFirst) {
					isFirst = false;
				} else result += ",";
				result += "\"" + p.getFirst() + "\":" + p.getSecond();
			}
			result += "}";
		}
		return result;
	}

}
