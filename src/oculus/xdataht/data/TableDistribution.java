/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * http://uncharted.software/
 *
 * Released under the MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package oculus.xdataht.data;

import java.util.ArrayList;
import java.util.HashMap;

import oculus.xdataht.model.Distribution;

public class TableDistribution {
	public HashMap<String, Integer> distribution;
	public String maxKey;
	public String minKey;
	
	public TableDistribution() { 
		distribution = new HashMap<String, Integer>();
	}
	
	public void increment(String key) {
		Integer count = distribution.get(key);
		if (count == null) {
			count = new Integer(0);
		}
		count++;
		distribution.put(key,  count);
		
		if (maxKey == null) {
			maxKey = key;
		} else {
			if (distribution.get(key) > distribution.get(maxKey)) {
				maxKey = key;
			}
		}
		
		if (minKey == null) {
			minKey = key;
		} else {
			if (distribution.get(key) < distribution.get(minKey)) {
				minKey = key;
			}
		}
	}
	
	public static ArrayList<Distribution> getDistribution(String tableName, String columnName) {
		TableDistribution td = TableDB.getInstance().getValueCounts(tableName, columnName);
		
		// Get counts based on cluster size
		HashMap<Integer, Integer> clusterDistrubution = new HashMap<Integer, Integer>();
		for (String key : td.distribution.keySet()) {
			if ((key==null) || key.equalsIgnoreCase("null")) continue;
			int valueCount = td.distribution.get(key);
			Integer clusterCount = clusterDistrubution.get(valueCount);
			if (clusterCount == null) {
				clusterCount = new Integer(0);
			}
			clusterCount++;
			clusterDistrubution.put(valueCount, clusterCount);
		}
		
		ArrayList<Distribution> dist = new ArrayList<Distribution>();
		for (Integer key : clusterDistrubution.keySet()) {
			Integer count = clusterDistrubution.get(key);
			Distribution distObject = new Distribution(key, count);
			dist.add(distObject);
		}
		
		return dist;
	}

}
