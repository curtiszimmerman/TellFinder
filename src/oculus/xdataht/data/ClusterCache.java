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

import java.awt.EventQueue;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;

import oculus.xdataht.clustering.ClusterResults;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

public class ClusterCache {
	// TODO: Configurability
	static Cache<String, ClusterResults> clusterResultCache = CacheBuilder
			.newBuilder().maximumSize(100)
			.expireAfterAccess(30, TimeUnit.MINUTES)
			.build();
	
	static HashMap<String, HashMap<String,List<String>>> connectivity = new HashMap<String, HashMap<String,List<String>>>();
	
	static public boolean containsResults(String id, String params) {
		ClusterResults result = clusterResultCache.getIfPresent(id);
		if (result == null) {
			return TableDB.getInstance().containsClusterResults(id, params);
		}
		
		return result.getClusterParametersString().equals(params);
	}
	
	static public ClusterResults getResults(String dataset, String id) {
		ClusterResults result = clusterResultCache.getIfPresent(id);
		if (result == null) {
			result = TableDB.getInstance().getClusterResults(dataset, id);
			if (result != null) clusterResultCache.put(id, result);
		}
		return result;
	}
	static public void putResults(final String name, final ClusterResults res) {
		clusterResultCache.put(name, res);
				
		EventQueue.invokeLater(new Runnable() {
			
			@Override
			public void run() {
				try {
					TableDB.getInstance().putClusterResults(name, res);
				} catch (InterruptedException e) {
					TableDB.getInstance().clearClusterResults(name);
					TableDB.getInstance().close();
				}
			}
		}); 
	}
	
	static public HashMap<String,List<String>> getConnectivity(String key) { 
		return connectivity.get(key); 
	}
	
	static public void putConnectivity(String key, HashMap<String,List<String>> con)  { 
		connectivity.put(key, con); 
	}
	
	public static List<DataRow> getClusterDetails(String dataset, String clustersetName, String clusterId) {
		ClusterResults r = getResults(dataset, clustersetName);
		if (r != null) {
			return r.getClusterDetails(clusterId);
		} else {
			return null;
		}
	}
}
