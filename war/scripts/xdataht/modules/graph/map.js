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
define([ '../util/ui_util', './geocoder', '../util/colors'], function( ui_util, geocoder, colors) {

    var createWidget = function(baseUrl, container, data, selection) {

        var DEGREES_TO_RADIANS = 0.0174532925,
			RADIANS_TO_DEGREES = 57.2957795,
			nextMapNodeId = 0;

        var calculateCenter = function(data) {

            // Convert lat/lon to cartesian coordinates for each location
            var x = 0, y = 0, z = 0;
            var lat,lon;
            for (var i = 0; i < data.length; i++) {
                lat = data[i].lat * DEGREES_TO_RADIANS;
                lon = data[i].lon * DEGREES_TO_RADIANS;
                x += Math.cos(lat) * Math.cos(lon);
                y += Math.cos(lat) * Math.sin(lon);
                z += Math.sin(lat);
            }

            x /= data.length;
            y /= data.length;
            z /= data.length;

            // convert back to spherical coordinates
            return {
                lat : Math.atan2(z, Math.sqrt(x*x + y*y)) * RADIANS_TO_DEGREES,
                lon : Math.atan2(y,x) * RADIANS_TO_DEGREES
            };
        };

        var getExtents = function(data) {
            var lonMin = Number.POSITIVE_INFINITY;
            var lonMax = Number.NEGATIVE_INFINITY;
            var latMin = Number.POSITIVE_INFINITY;
            var latMax = Number.NEGATIVE_INFINITY;

            for (var i = 0; i < data.length; i++) {
                if (data[i].lat < latMin) {
                    latMin = data[i].lat;
                }

                if (data[i].lat > latMax) {
                    latMax = data[i].lat;
                }

                if (data[i].lon < lonMin) {
                    lonMin = data[i].lon;
                }

                if (data[i].lon > lonMax) {
                    lonMax = data[i].lon;
                }
            }
            return {
                left: lonMin,
                top: latMax,
                right: lonMax,
                bottom: latMin
            };
        };

        var getMemexGeoRegionData = function(data, widget, callback) {
        	var locations = {};
            for (var i =0; i < data.length; i++) {
            	var location = data[i].location;
            	if (location) {
                	if (locations[location]) {
                		locations[location].ids.push(data[i].id);
                		locations[location].count++;
                	} else {
                		locations[location] = {
                			ids: [data[i].id],
                			count: 1,
                			lat: data[i].latitude,
                			lon: data[i].longitude,
                			id:nextMapNodeId++
                		}
                	}
                }
            }

            var geoData = [];
            var minCount = Number.POSITIVE_INFINITY;
            var maxCount = Number.NEGATIVE_INFINITY;


            // Geocode on the server
            for (location in locations) {
            	if (!locations.hasOwnProperty(location)) continue;
                geoData.push({
                    lat: locations[location].lat,
                    lon: locations[location].lon,
                    place: location,
                    count: locations[location].count,
                    size: locations[location].count,
                    id: locations[location].id,
                    adIds : locations[location].ids
                });
                if (locations[location].count < minCount) minCount = locations[location].count;
                if (locations[location].count > maxCount) maxCount = locations[location].count;
            }

            // Scale counts to radius for radialLayer
            var mapNodeSize = aperture.config.get()['xdataht.config']['map-node-size'];
            for (i = 0; i < geoData.length; i++) {
                if (maxCount-minCount != 0) {
                    geoData[i].size = ( geoData[i].size - minCount ) / (maxCount - minCount);       // normalize between [0-1]
                    geoData[i].size = mapNodeSize.min + (mapNodeSize.max-mapNodeSize.min) * geoData[i].size;    // scale radius
                } else {
                    geoData[i].size = mapNodeSize.min;
                }
            }

			widget.geoData = geoData;
            callback(geoData);
        };

        var getGeoRegionData = function(data, widget, callback) {
            var placeCounts = {};
            var geocodeRequests = [];
            var locationToRequest = {};
            var regionToRequest = {};
            for (var i =0; i < data.length; i++) {

                // Extract a map of places from location
                var places = {};
                var newRequest = null;
                if (data[i].location) {
                    var friendlyString = data[i].location;
                    data[i].location = data[i].location.replace(/ /g, '').toLowerCase();

                    if (locationToRequest[data[i].location]) {
                        locationToRequest[data[i].location].ids.push(data[i].id);
                        continue;
                    }

                    newRequest = {
                        ids: [data[i].id],
                        city: data[i].location,
                        originalData: friendlyString,
                        field: 'location'
                    };

                    geocodeRequests.push(newRequest);
                    locationToRequest[data[i].location] = newRequest;
                } else if (data[i].region) {
                    if (regionToRequest[data[i].region]) {
                        regionToRequest[data[i].region].ids.push(data[i].id);
                        continue;
                    }
                    newRequest = {
                        ids: [data[i].id],
                        city: data[i].region,
                        originalData: data[i].region,
                        field: 'location'
                    };
                    geocodeRequests.push(newRequest);
                    regionToRequest[data[i].region] = newRequest;
                }
            }

            var geoData = [];
            var minCount = Number.POSITIVE_INFINITY;
            var maxCount = Number.NEGATIVE_INFINITY;

            // Geocode on the server
            var latlonMap = {};
            geocoder.geocode_server(baseUrl, geocodeRequests, function(response) {

                if (!response || !response.results) {
                    return;
                }

                if (!_.isArray(response.results)) {
                    response.results = [response.results];
                }

                for (var i = 0; i < response.results.length; i++) {

                    if (!_.isArray(response.results[i].ids)) {
                        response.results[i].ids = [response.results[i].ids];
                    }

                    geoData.push({
                        lat: response.results[i].lat,
                        lon: response.results[i].lon,
                        place: response.results[i].location,
                        size: response.results[i].ids.length,
                        id: nextMapNodeId++,
                        count: response.results[i].ids.length,
                        adIds : response.results[i].ids
                    });
                    if (response.results[i].ids.length < minCount) {
                        minCount = response.results[i].ids.length;
                    }
                    if (response.results[i].ids.length > maxCount) {
                        maxCount = response.results[i].ids.length;
                    }
                }



                // Scale counts to radius for radialLayer
                var mapNodeSize = aperture.config.get()['xdataht.config']['map-node-size'];
                for (i = 0; i < geoData.length; i++) {
                    if (maxCount-minCount != 0) {
                        geoData[i].size = ( geoData[i].size - minCount ) / (maxCount - minCount);       // normalize between [0-1]
                        geoData[i].size = mapNodeSize.min + (mapNodeSize.max-mapNodeSize.min) * geoData[i].size;    // scale radius
                    } else {
                        geoData[i].size = mapNodeSize.min;
                    }
                }

				widget.geoData = geoData;
                callback(geoData);
            });
        };

        var widgetObj = {
			selectedNodes: new aperture.Set('id'),
			geoData: null,
            init: function() {
                var that = this,
					hoverNode = new aperture.Set('id'),
					highlightColor = new aperture.Color(colors.MAP_HIGHLIGHT),
					hoverColor = new aperture.Color(colors.MAP_HOVER),
					selectedHoverColor = new aperture.Color(colors.MAP_SELECTED_HOVER);

				// Create the map in the DOM
				this.map = new aperture.geo.Map(container);

                var regionsEncodedCallback = function(geoData) {
                    // Create a content position layer
                    var locations = that.map.addLayer( aperture.geo.MapNodeLayer );
                    locations.map('latitude').from('lat');
                    locations.map('longitude').from('lon');
                    locations.all(geoData);

                    // TODO: once we support a dot layer on the map, take the counts into effect
                    var bubbles = locations.addLayer( aperture.RadialLayer );
                    bubbles.map('series-count').from(function() {
						if (this.selectedCount&&this.unselectedCount) return 2;
						return 1;
					});
                    bubbles.map('radius').from(function(index) {
                    	if (this.selectedCount&&this.unselectedCount&&index==0) {
                    		return this.selectedCount*this.size/(this.selectedCount+this.unselectedCount);
                    	}
                    	return this.size;
                    });
                    bubbles.map('opacity').asValue(aperture.config.get()['xdataht.config']['map-node-opacity']);
                    bubbles.map('fill').from(function(index) {
                    	if (this.selectedCount&&this.unselectedCount) {
                    		if (index==0) return highlightColor;
                    		else return colors.MAP_TOTAL;
                    	}
                    	if (this.selectedCount) return highlightColor;
                    	return colors.MAP_TOTAL;
                    }).filter(hoverNode.filter(function(color, index) {
                    		if (this.selectedCount) return selectedHoverColor;
							return hoverColor;
					}));
                    var strokeColor = aperture.config.get()['xdataht.config']['map-node-stroke-color'];
                    bubbles.map('stroke').from(function(index) {
                    	if (this.selectedCount&&this.unselectedCount) {
                    		if (index==1) return hoverColor;
                    		return highlightColor;
                    	}
                    	return strokeColor;
                    });
                    var strokeWidth = aperture.config.get()['xdataht.config']['map-node-stroke-width'];
                    bubbles.map('stroke-width').from(function(index) {
                    	return strokeWidth;
                    });

                    var nodeOver = function(event) {
						var items = [
							{	attr: 'Location',
								val: event.data.place},
							{	attr: 'Ad Count',
								val: event.data.count},
							{	attr: 'Selected Ads',
								val: event.data.selectedCount},
							{	attr: 'Longitude',
								val: event.data.lon},
							{	attr: 'Latitude',
								val: event.data.lat}
						];
                        aperture.tooltip.showTooltip(ui_util.formatTooltip(event, items));
                        $(container).css('cursor','pointer');
						hoverNode.add(event.data.id);
						locations.all().redraw();
                    };
                    var nodeOut = function(event) {
                        aperture.tooltip.hideTooltip();
                        $(container).css('cursor','default');
						hoverNode.remove(event.data.id);
						locations.all().redraw();
                    };
                    var nodeClick = function(event) {
						var i, id = event.data.id,
							adIds = event.data.adIds;
						if (event.source.ctrlKey) {
							selection.add('map',adIds);
						} else {
							selection.toggle('map',adIds);
						}
						that.selectionChange(selection.selectedAds);
                    };

                    bubbles.on('mouseover', nodeOver);
                    bubbles.on('mouseout', nodeOut);
                    bubbles.on('mousedown', nodeClick);

                    var center = calculateCenter(geoData);

                    that.map.zoomTo( center.lat, center.lon, 3 );
                    var extents = getExtents(geoData);
                    that.map.setExtents(extents.left, extents.top, extents.right, extents.bottom);
                    that.map.all().redraw();
                };
                if (document.HT_SCHEMA) {
                	getGeoRegionData(data,this,regionsEncodedCallback);

                } else {
                	getMemexGeoRegionData(data,this,regionsEncodedCallback);
                }		
            },
			selectionChange: function (selectedIds) {
				this.selectedNodes.clear();
				for(var i = 0; i<this.geoData.length; i++) {
					var location = this.geoData[i],
						adIds = location.adIds,
						allads = true,
						selected = 0,
						unselected = 0;
					for (var j = 0; j<adIds.length; j++) {
						if (selectedIds.indexOf(adIds[j])<0) {
							allads = false;
							unselected++;
						} else {
							selected++;
						}
					}
					location.selectedCount = selected;
					location.unselectedCount = unselected;
					if (allads) {
						this.selectedNodes.add(i);
					}
				}
				this.map.all().redraw();
			},
            resize: function(width,height) {
            	if (this.map) {
	            	this.map.map('width').asValue(width);
	            	this.map.map('height').asValue(height);
	            	this.map.olMap_.updateSize();
	            	this.map.all().redraw();
            	}
            }
        };
        widgetObj.init();
        return widgetObj;
    };

    return {
        createWidget:createWidget
    };
});