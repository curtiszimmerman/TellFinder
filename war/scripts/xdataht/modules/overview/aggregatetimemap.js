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
define([ '../util/rest', '../util/ui_util', '../util/kmeans', '../util/colors'], function( rest, ui_util, kmeans, colors) {
	var DEMOGRAPHICS = ['ads', 'rape', 'robbery', 'expenditures', 'black', 'white'];
	var createWidget = function(container, baseUrl, initialStartTime, initialEndTime, dataset) {
		var aggregateTimeMapWidget = {
			geoTimeData: [],
			demographicsData: [],
			dmaxCounts: [0,0,0,0,0,0],
			geoData: [],
			maxCount: 12000,
			maxDelta: 200,
			maxClusterCount: 0,
			map: null,
			initMapExtents : { left: -125, top: 50, right: -70, bottom: 20 },
			locations: null,
			locationMap: {},
			timeStart: initialStartTime,
			timeEnd: initialEndTime,
			clickFn: null,
			mode: 0, // 0=normalized ad volume, 1=delta, 2=percent change, 3=aggregate
			init: function() {
				this.createMap();
                this.fetchData();

			},
			showDemographics: function() {
				this.fetchDemographics();
				this.createDemographics();
			},
			createMap: function() {
				var that = this;
				var selectedNodes = new aperture.Set('id');
                var highlightColor = new aperture.Color(colors.CIRCLE_SELECTED);

                // Create the map in the DOM
                this.map = new aperture.geo.Map(container.get(0).id);
                this.locations = this.map.addLayer( aperture.geo.MapNodeLayer );
                this.locations.map('latitude').from('lat');
                this.locations.map('longitude').from('lon');
                this.locations.all(this.geoData);

                // TODO: once we support a dot layer on the map, take the counts into effect
                var bubbles = this.locations.addLayer( aperture.RadialLayer );
                bubbles.map('radius').from(function() {
                	if (that.mode==0) return 2+24*(this.count/that.maxCount);
                	if (that.mode==1) return 2+24*(this.delta/that.maxDelta);
                	if (that.mode==3) return 2+24*(this.count/that.maxClusterCount);
                	return 2+this.ratioDelta*10;
                });
                bubbles.map('opacity').asValue(aperture.config.get()['xdataht.config']['map-node-opacity']);
                bubbles.map('fill').from(function() {
                	if (that.mode==0||that.mode==3) {
                		return colors.CIRCLE_TOTAL;
                	}
                	return this.isPositive?colors.CIRCLE_INCREASE:colors.CIRCLE_DECREASE;
                })
                    .filter(selectedNodes.filter(function(color) {
                        return highlightColor;
                    }));
                bubbles.map('stroke').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-color']);
                bubbles.map('stroke-width').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-width'])
                    .filter(selectedNodes.constant('highlight'));

                var nodeOver = function(event) {
					var items = [];
                	if (that.mode==3) {
						items.push({header:'Locations'});
                		event.data.members.sort(function(a,b) {return b.count- a.count;});
                		for (var i=0; i<event.data.members.length && i<5; i++) {
                			items.push({attr:event.data.members[i].location,val:event.data.members[i].count});
                		}
                		if (event.data.members.length>5) { items.push({header:'...'}); }
						items.push({attr:'Total Ads', val:event.data.count});
                	} else {
						items.push({attr:'Location', val:event.data.location});
						items.push({attr:'Ad Count', val:event.data.count});
                	}
					items.push({attr:'Longitude', val:event.data.lon});
					items.push({attr:'Latitude', val:event.data.lat});
                    if (that.mode==1 || that.mode==2) {
						items.push({attr:'Overall Average Day', val:event.data.avgDay});
						items.push({attr:'Period Average Day', val:event.data.periodAvgDay});
						items.push({attr:'Change in Average', val:(event.data.periodAvgDay-event.data.avgDay)});
                    	if (that.mode==2) { items.push({attr:'Percent Change', val:(event.data.ratioDelta*100)}); }
                    }
                    aperture.tooltip.showTooltip(ui_util.formatTooltip(event,items));
                    $(container).css('cursor','pointer');
                };
                var nodeOut = function(event) {
                    aperture.tooltip.hideTooltip();
                    $(container).css('cursor','default');
                };
                var nodeClick = function(event) {
		        	if (that.clickFn) {
		        		that.clickFn(event);
		        	}
                };

                bubbles.on('mouseover', nodeOver);
                bubbles.on('mouseout', nodeOut);
                bubbles.on('click', nodeClick);
                
                this.map.setExtents(this.initMapExtents.left, this.initMapExtents.top,
									this.initMapExtents.right, this.initMapExtents.bottom);
                this.map.all().redraw();
                
                this.map.olMap_.events.register("moveend", this.map.olMap_, function(e) {
                	that.updateMapData();
                });

                this.maxCountElem = $('<div/>');
                this.maxCountElem.css({position:'absolute',right:'2px',bottom:'2px','z-index':9999});
                this.maxCountElem.text('Maximum visible ad count: 0');
                container.append(this.maxCountElem);
                
			},

			createDemographics: function() {
				var that = this;
                this.dlocations = this.map.addLayer( aperture.geo.MapNodeLayer );
                this.dlocations.map('latitude').from('lat');
                this.dlocations.map('longitude').from('lon');
                this.dlocations.all(this.demographicsData);

                var bubbles = this.dlocations.addLayer( aperture.RadialLayer );
                bubbles.map('sector-count').asValue(DEMOGRAPHICS.length);
                bubbles.map('series-count').asValue(1);
                bubbles.map('opacity').asValue(0.5);
                bubbles.map('form').asValue('bloom');
                bubbles.map('radius').from(function(sector,series) {
                	return 2+40*(this[DEMOGRAPHICS[sector]]/that.dmaxCounts[sector]);
                });
                bubbles.map('fill').from(function() {
                	return colors.CIRCLE_DEMOGRAPHIC;
                });

                bubbles.map('stroke').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-color']);
                bubbles.map('stroke-width').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-width']);


                var nodeOver = function(event) {
                	// TODO remove html string generation,
                	// call aperture.tooltip.showTooltip(ui_util.formatTooltip(event, items))
					// needs to be tested with location_demographics table
                	var html = '',
						items = [{attr:'Location',val:event.data.location}],
						overStr = DEMOGRAPHICS[event.index[0]];

                	html += '<B>Location:</B>' + event.data.location + '<BR/>';
                	if (event.index[0]==0) {
						items.push({attr:'Ads Per Capita',val:event.data.ads});
                		html += '<B>Ads Per Capita:</B>' + event.data.ads + '<BR/>';
                	} else if (event.index[0]==1) {
						items.push({attr:'Rape Rate',val:event.data.rape});
                        html += '<B>Rape Rate:</B>' + event.data.rape + '<BR/>';
                	} else if (event.index[0]==2) {
						items.push({attr:'Robbery Rate',val:event.data.robbery});
						html += '<B>Robbery Rate:</B>' + event.data.robbery + '<BR/>';
                	} else if (event.index[0]==3) {
						items.push({attr:'Expenditures',val:event.data.expenditures});
						html += '<B>Expenditures:</B>' + event.data.expenditures + '<BR/>';
                	} else if (event.index[0]==4) {
						items.push({attr:'Black population',val:event.data.black});
                        html += '<B>Black population:</B>' + event.data.black + '<BR/>';
                	} else if (event.index[0]==5) {
						items.push({attr:'White population',val:event.data.white});
                        html += '<B>White population:</B>' + event.data.white + '<BR/>';
                	}
					items.push({attr:'Longitude',val:event.data.lon});
					items.push({attr:'Latitude',val:event.data.lat});
                	html += '<B>Longitude:</B>' + event.data.lon + '<BR/>' + '<B>Latitude:</B>' + event.data.lat;

                    aperture.tooltip.showTooltip({event:event, html:html});
                    $(container).css('cursor','pointer');
                };
                var nodeOut = function(event) {
                    aperture.tooltip.hideTooltip();
                    $(container).css('cursor','default');
                };
                var nodeClick = function(event) {
		        	if (that.clickFn) {
		        		that.clickFn(event.data.location);
		        	}
                };

                bubbles.on('mouseover', nodeOver);
                bubbles.on('mouseout', nodeOut);
                bubbles.on('click', nodeClick);

			},

			createLinkLayer: function(location, linklocations) {
				var that = this;

				this.linkdata = {tracks:[]};
				var p1 = this.locationMap[location];
				for (var i=0; i<linklocations.length && i<20; i++) {
					var p2 = this.locationMap[linklocations[i].location];
					var c = linklocations[i].count;
					if (p2)	this.linkdata.tracks.push({count:c,points:[{x:p1[0],y:p1[1]},{x:p2[0],y:p2[1]}]});
				}
				
				this.llocations = this.map.addLayer( aperture.geo.MapNodeLayer );
                this.llocations.map('latitude').from('lat');
                this.llocations.map('longitude').from('lon');
                this.llocations.all(this.linkdata);

                var lines = this.llocations.addLayer( aperture.chart.LineSeriesLayer );
                lines.map('lines').from('tracks');
                lines.map('point-count').from(function(index) {
    				return this.points.length;
    			});
                lines.map('x').from(function(index) {
                	var pt = this.points[index];
                	that.mapPos = that.llocations.getXY(pt.x, pt.y);
    				return that.mapPos.x;
    			});
                lines.map('y').from(function(index) {
    				return that.mapPos.y;
    			});
                lines.map('stroke').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-color']);
                lines.map('stroke-width').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-width']);
                this.llocations.all().redraw();

			},

			setMode: function(mode) {
				this.mode = mode;
				this.updateMapData();
			},
			
			setTimeWindow: function(start, end) {
				this.timeStart = start;
				this.timeEnd = end;
				var that = this;
				if (!this.pendingRedraw) {
					this.pendingRedraw = true;
					setTimeout(function() {
						that.pendingRedraw = false;
						that.updateMapData();
					}, 100);
				}
			},
			
			updateMapData: function() {
				this.maxCount = 0;
				this.maxDelta = 0;
				this.maxClusterCount = 0;
				this.geoData.length = 0;
				var mapExtent = this.locations._layer.getLonLatExtent();
				if (mapExtent.left>mapExtent.right) {
					if (mapExtent.left>0) mapExtent.left-=360;
					if (mapExtent.right<0) mapExtent.right+=360;
				}
				for (var i=0; i<this.geoTimeData.length; i++) {
					var locationData = this.geoTimeData[i];
					var pt = {lon: Number(locationData.lon), lat:Number(locationData.lat)};
					this.locationMap[locationData.location] = [pt.lat, pt.lon];
					if (pt.lon<mapExtent.left || pt.lon>mapExtent.right || pt.lat<mapExtent.bottom || pt.lat>mapExtent.top) continue;
					var count = 0;
					var fullCount = 0;
					var minDay = 0;
					var maxDay = 0;
					var dayCounts = [];
					var first = new Date(Number(this.timeStart));
					var second = new Date(Number(this.timeEnd));
					var one = new Date(first.getFullYear(), first.getMonth(), first.getDate()+1);
				    var two = new Date(second.getFullYear(), second.getMonth(), second.getDate()-1);
					var windowDayStart = one.getTime();
					var windowDayEnd = two.getTime();
					for (var j=0; j<locationData.timeseries.length; j++) {
						var timeData = locationData.timeseries[j];
						if (minDay==0 || timeData.day<minDay) minDay = timeData.day;
						if (maxDay==0 || timeData.day>maxDay) maxDay = timeData.day;
						var c = Number(timeData.count);
						var day = new Date(Number(timeData.day));
						day = new Date(day.getFullYear(), day.getMonth(), day.getDate());
						if (day>=windowDayStart && day<=windowDayEnd) {
							count += c;
						}
						fullCount += c;
						dayCounts.push(c);
					}
					var data = {location:locationData.location,lat:pt.lat,lon:pt.lon,count:count};
					fullCount = 0;
					if (dayCounts.length>0) {
						dayCounts.sort();
						var avgStart = Math.floor(dayCounts.length/5), avgEnd = Math.ceil(4*dayCounts.length/5);
						for (j=avgStart; j<avgEnd+1; j++) {
							fullCount += dayCounts[j];
						}
						data.avgDay = fullCount/(avgEnd-avgStart);
					} else {
						data.avgDay = 0;
					}
					var daySpan = Math.floor((windowDayEnd-windowDayStart)/60/60/24/1000);
					data.periodAvgDay = count/(daySpan+1);
					if (data.periodAvgDay>data.avgDay) {
						data.isPositive = true;
						data.ratioDelta = (data.periodAvgDay/data.avgDay)-1;
						data.delta = data.periodAvgDay-data.avgDay;
					} else {
						data.isPositive = false;
						data.ratioDelta = (data.avgDay-data.periodAvgDay)/data.avgDay;
						data.delta = data.avgDay-data.periodAvgDay;
					}
					if (this.maxCount<count) this.maxCount = count;
					if (this.maxDelta<data.delta) this.maxDelta = data.delta;
					this.geoData.push(data);
				}
				if (this.mode==3) {
					var clusters = kmeans.kmeans(this.geoData, 100);
					for (i=0; i<clusters.length; i++) {
						var cluster = clusters[i];
						cluster.count = 0;
						for (j=0;j<cluster.members.length;j++) cluster.count+=cluster.members[j].count;
						if (cluster.count>this.maxClusterCount) this.maxClusterCount = cluster.count;
					}
					this.geoData = clusters;
				} else if (this.geoData.length>100) {
					if (this.mode==0) {
						this.geoData.sort(function(a,b) { return b.count-a.count; });
					} else {
						this.geoData.sort(function(a,b) { return Math.pow(b.avgDay-b.periodAvgDay,2)-Math.pow(a.avgDay-a.periodAvgDay,2); });
					}
					this.geoData.length = 100;
				}
                this.locations.all(this.geoData).redraw();
                if (this.mode==0) {
                	this.maxCountElem.text('Maximum visible ad count: ' + this.maxCount);
                } else if (this.mode==1) {
                	this.maxCountElem.text('Maximum visible ad delta: ' + this.maxDelta);
                } else if (this.mode==3) {
                	this.maxCountElem.text('Maximum visible ad count: ' + this.maxClusterCount);
                }
			},
						
			createCustomMapControls: function() {
                var clickHandler = function(event){};
    			var mainControl = new aperture.mapcontrol.MapControl({zoomStopHeight:10}, clickHandler);
    			var customControls = [
    				new OpenLayers.Control.DragPan(), // mousedrag functionality
    				mainControl
    			];
    			for (var i=0; i<customControls.length; i++) {
    				var control = customControls[i];
    				this.map.olMap_.addControl(control);
    				control.activate();
    			}
			},

			showLoadingDialog: function(message) {
            	this.dialog = $('<div/>');
            	this.dialog.css({'background' : 'url("./img/ajaxLoader.gif") no-repeat center center'});
            	this.dialog.html(message+'. Please wait...');
				this.dialog.dialog();
			},

			hideLoadingDialog: function() {
	        	$(this.dialog).dialog('destroy');
			},
			
			fetchData: function() {
				var that = this;
				this.showLoadingDialog('Fetching overview data');
				var url = baseUrl + 'rest/overview/locationtime/' + dataset;

				rest.get(url + '?minLon=' + that.initMapExtents.left + '&maxLon=' + that.initMapExtents.right, 'Get location ad volume time series',
					function(result) {		// first get data for the visible portion of the map
						that.geoTimeData.length = 0;
						that.geoTimeData = result.results;
						that.setTimeWindow(that.timeStart, that.timeEnd);
						that.hideLoadingDialog();

						// now get the rest
						rest.get(url + '?minLon=' + that.initMapExtents.right, 'Get location ad volume time series',
							function(result) {
								$.merge(that.geoTimeData, result.results);
							});

						rest.get(url + '?maxLon=' + that.initMapExtents.left, 'Get location ad volume time series',
							function(result) {
								$.merge(that.geoTimeData, result.results);
							});
					});
			},

			fetchDemographics: function() {
				var that = this;
				rest.get(baseUrl + 'rest/overview/ldemographics', 'Get demographic data', function(result) {
		        	that.demographicsData.length = 0;
		        	for (var d=0; d<DEMOGRAPHICS.length; d++) {
		        		var key = DEMOGRAPHICS[d];
			        	that.dmaxCounts[d] = 0;
		        	}
		        	for (var i=0; i<result.results.length; i++) {
			        	for (var d=0; d<DEMOGRAPHICS.length; d++) {
			        		var key = DEMOGRAPHICS[d];
			        		result.results[i][key] = Number(result.results[i][key]);
			        		that.demographicsData.push(result.results[i]);
			        		if (result.results[i][key]>that.dmaxCounts[d]) that.dmaxCounts[d] = result.results[i][key];
			        	}
		        	}
		        });
			},
			resize: function(width,height) {
				this.width = width;
				this.height = height;
            	this.map.olMap_.updateSize();
                this.map.all().redraw();
			}
		};
		aggregateTimeMapWidget.init();
		return aggregateTimeMapWidget;
	};
	
	return {
		createWidget:createWidget
	}
});
