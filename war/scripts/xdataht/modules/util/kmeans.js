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

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
define([], function() {

	var getRange = function(data) {
		var result = {
			minX:null, 
			maxX:null, 
			minY:null, 
			maxY:null
		};
		for (var i=0; i<data.length; i++) {
			var datum = data[i];
			if (result.minX==null || result.minX>datum.lon) result.minX = datum.lon;
			if (result.maxX==null || result.maxX<datum.lon) result.maxX = datum.lon;
			if (result.minY==null || result.minY>datum.lat) result.minY = datum.lat;
			if (result.maxY==null || result.maxY<datum.lat) result.maxY = datum.lat;
		}
		return result;
	};

	var initKmeans = function(data,k) {
		var range = getRange(data);
		var xsteps = Math.ceil(Math.sqrt(k));
		var xstep = (range.maxX-range.minX)/xsteps;
		var ysteps = Math.ceil(k/xsteps);
		var ystep = (range.maxY-range.minY)/ysteps;
		var clusters = [];
		var curX = 0, curY = 0;
		for (var i=0; i<k; i++) {
			curX = Math.floor(i/ysteps);
			curY = i-curX*ysteps;
			clusters.push({lon:range.minX+xstep*curX,lat:range.minY+ystep*curY,members:[]});
		}
		return clusters;
	};

	var assignClusters = function(data, clusters) {
		var anyChanges = false;
		for (var i=0; i<data.length; i++) {
			var datum = data[i];
			var bestMatch = null;
			var bestDistance = null;
			for (var j=0; j<clusters.length; j++) {
				var cluster = clusters[j];
				var distance = Math.pow(cluster.lon-datum.lon,2)+Math.pow(cluster.lat-datum.lat,2);
				if (bestDistance==null || distance<bestDistance) {
					bestMatch = j;
					bestDistance = distance;
				}
			}
			if ((!datum.cluster)||(datum.cluster!=bestMatch)) {
				anyChanges = true;
				datum.cluster = bestMatch;
			}
			clusters[bestMatch].members.push(datum);
		}
		return anyChanges;
	};
	
	var computeCentroids = function(clusters) {
		for (var i=0; i<clusters.length; i++) {
			var cluster = clusters[i];
			var sumX = 0, sumY = 0;
			for (var j=0; j<cluster.members.length; j++) {
				sumX += cluster.members[j].lon;
				sumY += cluster.members[j].lat;
			}
			if (cluster.members.length!=0) {
				cluster.lon = sumX/cluster.members.length;
				cluster.lat = sumY/cluster.members.length;
			}
		}
	};
	
	var clearClusters = function(clusters) {
		for (var i=0; i<clusters.length; i++) {
			clusters[i].members.length = 0;
		}
	};
	
	var kmeans = function(data, k) {
		var clusters = initKmeans(data,k);
		assignClusters(data, clusters);
		var anyChanges = true;
		var iteration = 0;
		while (anyChanges && iteration<100) {
			computeCentroids(clusters);
			clearClusters(clusters);
			anyChanges = assignClusters(data, clusters);
			iteration++;
		}
		var result = [];
		for (var i=0; i<clusters.length; i++) {
			var cluster = clusters[i];
			if (cluster.members.length>0) result.push(cluster);
		}
		return result;
	};
	
	return {
		kmeans:kmeans
	}
});
