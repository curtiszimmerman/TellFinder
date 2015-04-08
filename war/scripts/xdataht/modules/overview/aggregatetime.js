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
define([ '../util/rest', '../util/ui_util', '../util/menu', '../util/colors'], function( rest, ui_util, menu, colors) {
	var GLOBAL_START_TIME = new Date("2012/01/01");
	var GLOBAL_END_TIME = new Date(GLOBAL_START_TIME.getTime()+(3600000*24)*365*4);
	var WINDOW_START_TIME = new Date(GLOBAL_START_TIME.getTime()+(3600000*24)*(365+212));
	var WINDOW_END_TIME = new Date(GLOBAL_START_TIME.getTime()+(3600000*24)*(365*2+120));

	var createWidget = function(container, baseUrl, initialStartTime, initialEndTime) {
		var aggregateTimeWidget = {
			timeData: [],
			timeChartContainer: null,
			timeChart: null,
			barsVisible: true,
			maxY: 0,
			init: function() {
				this.createTimeseries();
			},

			createTimeseries: function(){
				var that = this;
				
			    this.timeChart = new aperture.chart.Chart(container.get(0).id);

			    var rangeX = new aperture.TimeScalar('time', [WINDOW_START_TIME,WINDOW_END_TIME]);
			    var bandedX = rangeX.banded(10,false);
			    var mapKey = bandedX.mapKey([0,1]);
			    this.timeChart.map('x').using(mapKey);

			    var rangeY = new aperture.Scalar('vertical', [0,1]);
			    this.timeChart.map('y').using(rangeY.mapKey([1,0]));

			    var yAxis = this.timeChart.yAxis(0);
			    yAxis.map('margin').asValue(1);

			    this.barLayer = this.timeChart.addLayer( aperture.BarLayer );
			    this.barLayer.all(function(data) {
			        return [{content:'Ad Volume', data:that.timeData}];
			    });
			    this.barLayer.map('visible').from(function(){ return that.barsVisible; });

			    this.barLayer.map('x').from(function(index){
			        return (index>=this.data.length)?0:(Number(this.data[index].day));
			    });
			    this.barLayer.map('y').asValue(0);
			    this.barLayer.map('length').from(function(index) {
			    	var divisor = (that.maxY>0 && that.height>0)?(that.maxY/that.height):1;
			        return (index>=this.data.length)?0:(Number(this.data[index].count)/divisor);
			    });
			    this.barLayer.map('bar-count').from(function() {
			    	return this.data.length;
			    });
			    this.barLayer.map('bar-visible').from(function(index) {
			        return (index>=this.data.length)?false:
			        	(this.data[index].day>that.windowStart && this.data[index].day<that.windowEnd);
			    });

                var nodeOver = function(event) {
                	var idx = event.index[0];
                    var html = '<B>Date: </B>' + (new Date(Number(event.data.data[idx].day))).toDateString() + '<BR/>' +
                        '<B>Ad Count: </B>' + event.data.data[idx].count;
                    aperture.tooltip.showTooltip({event:event, html:html});
                    $(container).css('cursor','pointer');
                };
                var nodeOut = function(event) {
                    aperture.tooltip.hideTooltip();
                    $(container).css('cursor','default');
                };

                this.barLayer.on('mouseover', nodeOver);
                this.barLayer.on('mouseout', nodeOut);

                this.timeChart.all({width:'400px',height:'100px'}).redraw();
			},
			
			setTimeWindow: function(start, end) {
		        var rangeX = new aperture.TimeScalar('time', [start,end]);
			    var bandedX = rangeX.banded(10,false);
			    var mapKey = bandedX.mapKey([0,1]);
			    this.timeChart.map('x').using(mapKey);
			    this.timeChart.all().redraw();
			    
			    this.windowStart = start;
			    this.windowEnd = end;
			    var daySpan = (end-start)/(3600000*24);
			    var barWidth = Math.floor(this.width/daySpan);
			    this.barLayer.map('width').asValue(barWidth);
			    this.barLayer.all().redraw();
			},
			
			fetchData: function(dataset) {
				var that = this;
				rest.get(baseUrl + 'rest/overview/timeseries/' + dataset, 'Get time series', function(result) {
					that.setData(result.results);
				});
			},
			getData: function() {
				return this.timeData;
			},
			setData: function(data) {
	        	this.timeData.length = 0;
	        	this.maxY = 0;
			    var rangeY = new aperture.Scalar('vertical', [0,1]);
	        	for (var i=0; i<data.length; i++) {
	        		var c = Number(data[i].count);
	        		if (data[i].day<=0) continue;
	        		this.timeData.push(data[i]);
	        		if (this.maxY<c) this.maxY = c;
	        	}
	        	this.setTimeWindow(initialStartTime, initialEndTime);
	        	this.timeChart.map('y').using(rangeY.mapKey([1,0]));
	        	this.timeChart.all().redraw();
	        	this.barLayer.all().redraw();
			},
			
			addLines: function(data) {
				var that = this;
				this.lineLayerData = data;
				this.maxBaseline = 1;
				for (var i=0; i<this.lineLayerData.length; i++) {
					var d = this.lineLayerData[i];
					d.visible = amplify.store(d.newToTown + d.type);
					if(d.visible === undefined) {
						d.visible = false;
						amplify.store(d.newToTown + d.type, d.visible);
					}
					if (d.type=='baseline') {
						for (var j=0;j<d.data.length;j++) {
							var t = d.data[j][0];
							var c = d.data[j][1];
							if (t>0 && this.maxBaseline<c) this.maxBaseline = c;
						}
					}
				}
				
				this.lineLayer = this.timeChart.addLayer( aperture.chart.LineSeriesLayer );
			    this.lineLayer.all(this.lineLayerData);

			    this.lineLayer.map('x').from(function(index){
			        return (index>=this.length)?0:(Number(this.data[index][0]))*1000;
			    });
			    this.lineLayer.map('y').from(function(index) {
			    	var divisor = (that.maxY>0)?that.maxY:1;
			    	if (this.type=='p-value') {
			           return (index>=this.data.length||this.data[index][1]==0)?0:-Math.log(this.data[index][1])/100;
					} else if (this.type=='baseline') {
						divisor = that.maxBaseline;
					}
			        return (index>=this.data.length)?0:(Number(this.data[index][1])/divisor);
			    });
			    this.lineLayer.map('point-count').from('data.length');
			    this.lineLayer.map('stroke-width').asValue(1);
			    this.lineLayer.map('visible').from(function(index) {
			    	return (this.visible);
			    });
			    this.lineLayer.map('stroke').from(function() {
			    	if (this.newToTown=='New to ads') return colors.AGGREGATETIME_NEW_TO_ADS;
			    	else if (this.newToTown=='New to town') return colors.AGGREGATETIME_NEW_TO_TOWN;
			    	else if (this.newToTown=='Local') return colors.AGGREGATETIME_LOCAL;
			    	return colors.AGGREGATETIME_DEFAULT_LINE;
		    	});
			    this.lineLayer.map('stroke-style').from(function() {
			    	if (this.type=='count') return 'solid';
			    	else if (this.type=='baseline') return 'dashed';
			    	else if (this.type=='expected') return 'dotted';
			    	return '-.';
			    });
			    
			    this.lineLayer.on('mouseover', function(event) {
			    	var tRange = that.windowEnd - that.windowStart;
			    	var w = $(container).width();
			    	var overtime = that.windowStart + tRange*event.source.clientX/w;
			    	var overrange = 1000*60*60*24*3;
			    	var overstart = overtime - overrange;
			    	var overend = overtime + overrange;
			    	var html = '<B>' + event.data.newToTown + '</B> : ' + event.data.type;
			    	html += '<br/><B>Date:</B>' + (new Date(overtime)).toDateString();
			    	for (var i=0; i<event.data.data.length; i++) {
			    		var d = event.data.data[i];
			    		var t = d[0]*1000;
			    		if (t>=overstart && t<=overend) {
					    	html += '<br/><B>' + (new Date(t)).toDateString() + ':</B>' + d[1];
			    		}
			    	}
			    
			    	aperture.tooltip.showTooltip({event:event,html:html});
			    });
			    this.lineLayer.on('mouseout', function(event) {
			    	aperture.tooltip.hideTooltip();
			    });
	        	this.timeChart.all().redraw();
	        	this.createLineDisplayButton();
			},

			createLineDisplayMenu: function(e) {
				var that = this,
					items = [],
					collections = {};
				for (var i=0; i<this.lineLayerData.length; i++) {
					var d = this.lineLayerData[i];
					(function (d) {
						if (!collections[d.newToTown]) {
							collections[d.newToTown] = {
								type: 'collection',
								label: d.newToTown,
								items: []
							};
							items.push(collections[d.newToTown]);
						}
						collections[d.newToTown].items.push({
							type: 'checkbox',
							label: d.type,
							checked: d.visible,
							callback: function (checked) {
								d.visible = checked;
								amplify.store(d.newToTown + d.type, d.visible);
								that.timeChart.all().redraw();
							}
						});
					})(d);
				}
				items.push({
					type: 'checkbox',
					label: 'Count Histogram',
					checked: this.barsVisible,
					callback: function (checked) {
						that.barsVisible = checked;
						amplify.store('barsVisible', that.barsVisible);
						that.timeChart.all().redraw();
					}
				});
				menu.createContextMenu(e, items);
			},
			
			createLineDisplayButton: function() {
				var that = this;
				if (this.lineDisplayButton) {
					this.lineDisplayButton.remove();
				}
				this.lineDisplayButton = $('<button/>').text('Show Lines').button({
					text:false,
					icons:{
						primary:'ui-icon-triangle-1-e'
					}
				}).css({
					position:'absolute',
					left:'0px',
					bottom:'0px',
					width:'14px',
					height:'14px',
					margin:'1px 2px 0px 2px'
				}).click(function(e) {
					that.createLineDisplayMenu(e);
				});
				$(container).append(this.lineDisplayButton);
			},
			
			resize: function(width,height) {
				this.width = width;
				this.height = height;
                this.timeChart.all({width:width+'px',height:height+'px'}).redraw();
			}
		};
		aggregateTimeWidget.init();
		return aggregateTimeWidget;
	};
	
	return {
		createWidget:createWidget
	}
});
