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
define(['../util/rest', '../util/ui_util', './aggregatetime', './clustertable', '../util/menu', '../util/colors'], 
function(rest, ui_util, aggregatetime, clustertable, menu, colors) {
	var GLOBAL_START_TIME = new Date('2012/01/01'),
		GLOBAL_END_TIME = new Date(GLOBAL_START_TIME.getTime()+(3600000*24)*365*4),
		WINDOW_START_TIME = new Date(GLOBAL_START_TIME.getTime()+(3600000*24)*(365+212)),
		WINDOW_END_TIME = new Date((new Date()).getTime()+(3600000*24)*30),
		TIMELINE_HEIGHT = 24,
		TITLE_HEIGHT = 20,
		LIST_TOP = 40,
		pageTitle = 'List of Ads grouped by (phone,email,website)',

	createWidget = function(container, baseUrl) {
		var entityListWidget = {
			timeData: [],
			timeChartContainer: null,
			timeChart: null,
			timelineContainer: null,
			timeline: null,
			timeChartHeight: amplify.store('timeChartHeight'),
			listBottom: amplify.store('listBottom'),
			location:null,
			attributeMode:false,
			domain:'ht',
			init: function() {
				if (this.timeChartHeight===undefined) this.timeChartHeight = 100;
				if (this.listBottom===undefined) this.listBottom = this.timeChartHeight+TIMELINE_HEIGHT*2+1;
				this.createTimeseries();
				this.createTimelineControl();
				this.createTimeline();
				this.createTitle();
                this.createLogout();
                this.readParams();
			},
			
			onSearchCSV: function(query) {
				var that = this;
            	this.showLoadingDialog('Loading data matching csv contents');
            	var url = baseUrl + 'rest/overview/csvclusterdetails/';
            	rest.post(url,
		        	query,
		        	'Get csv clusters', function(clusterDetails) {
	                	that.showClusterDetails(location, clusterDetails, 'Matching .csv contents');
		        	}, true,
		        	function(failedResult) {
		        		that.hideLoadingDialog();
		        		alert('Failed to get data matching csv ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
		        	});
			},
			
			readParams: function() {
				var that = this;
				
				var params = ui_util.getParameters();
				this.attributeMode = (params.attribute=='true');
				if (params.data=='csv') {
					this.onSearchCSV(document.csvdata);
					return;
				}
				if (params.advanced=='true') {
					params.advanced = undefined;
		           	this.showLoadingDialog('Executing advanced search');
	                var url = baseUrl + 'rest/overview/';
	                if (this.attributeMode) {
	                    url += 'advancedattributedetails/';
	                } else {
	                    url += 'advancedclusterdetails/';
	                }
	                rest.post(url,
	                    params,
	                    'Get advanced ' + (that.attributeMode) ? 'attributes' : 'clusters', function(details) {
	                    	that.showClusterDetails(location, details, 'Advanced Search Details');       // TODO:  better label?
	                    }, true,
	                    function(failedResult) {
	                    	that.hideLoadingDialog();
	                        alert('Failed to get advanced search data ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
	                    });
	                return;
				}
				var tip = params.tip;
				if (tip) {
		           	this.showLoadingDialog('Loading tip data');
	            	var url = baseUrl + 'rest/overview/tipclusterdetails/';
	            	if (that.attributeMode) url =  baseUrl + 'rest/overview/tipattributedetails/';
			        rest.post(url,
			        	tip,
			        	'Get tip clusters', function(clusterDetails) {
		                	that.showClusterDetails('Global', clusterDetails, 'Matching: ' + tip);
			        	}, true,
			        	function(failedResult) {
			        		that.hideLoadingDialog();
			        		alert('Failed to get tip data ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
			        	});
	                return;
				}
				var location = params.location;
				var domain = params.domain;
				if (location) {
					this.showLoadingDialog('Loading location data');
					var url = baseUrl + 'rest/overview/locationclusterdetails/';
					if (that.attributeMode) url = baseUrl + 'rest/overview/locationattributedetails/';
					if (domain=='labor') url = baseUrl + 'rest/overview/laborlocationdetails/';
					rest.post(url,
						location,
						'Get location clusters', function(clusterDetails) {
							that.showClusterDetails(location, clusterDetails, 'From: ' + location);
							that.fetchLocationTimeseries(location);
						}, true,
						function(failedResult) {
							that.hideLoadingDialog();
							alert('Failed to get location data ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
						});					
	                return;
				}
				var imagehash = params.imagehash;
				if (imagehash) {
	            	this.showLoadingDialog('Loading data matching image');
	            	var url = baseUrl + 'rest/overview/imagehashclusterdetails';
	            	if (that.attributeMode) url =  baseUrl + 'rest/overview/imagehashattributedetails';
			        rest.post(url,
			        		imagehash,
				        	'Get image clusters', function(clusterDetails) {
			                	that.showClusterDetails('Global', clusterDetails, 'Matching image');
				        	}, true,
				        	function(failedResult) {
				        		that.hideLoadingDialog();
				        		alert('Failed to get image search results ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
				        	});
	                return;
				}
			},
			createTitle: function() {
                this.imgDiv = $('<img/>', {src:'img/TellFinder_black.png'});
                this.imgDiv.css({
                	left: '2px',
                	right: '0px',
                	top: '0px',
                	height: '24px',
                	position: 'absolute'
                });
                container.appendChild(this.imgDiv.get(0));
                this.titleDiv = $('<div/>');
                this.titleDiv.css({
                	left: '160px',
                	right: '0px',
                	top: '0px',
                	height: TITLE_HEIGHT+'px',
                	position: 'absolute',
                	'font-family': 'Arial,Helvetica,sans-serif',
                	'font-size': '18px'
                });
                this.titleDiv.text(pageTitle);
                container.appendChild(this.titleDiv.get(0));
			},
			
			showTableTitle: function(focusString) {
				var that = this;
				if (this.tableTitle) {
					this.tableTitle.remove();
					this.tableTitle.empty();
				}
				this.tableTitle = $('<div/>');
                this.tableTitle.css({
                	left: '2px',
                	right: '200px',
                	top: '23px',
                	height: '20px',
                	position: 'absolute',
                	'font-family': 'Arial,Helvetica,sans-serif'
                });
                this.tableTitle.text('Characterization of groups');
                container.appendChild(this.tableTitle.get(0));
                this.titleDiv.text('List of Ads grouped by (phone,email,website) - ' + focusString);
			},
			
			createLogout: function() {
				var that = this;
				this.logoutButton = $('<button/>').text('Logout').button({
                    text:true
                }).addClass('logoutButton').css({
                    position:'absolute',
                    top:'1px',
                    right:'16px',
                    height:'18px',
                    padding: '.1em .5em'
                }).on('click',function(event) { 
                	window.location.href = 'logout';
                });
                container.appendChild(this.logoutButton[0]);
			
			},

			fetchLocationTimeseries: function(location) {
				var that = this;
				var url = baseUrl + 'rest/overview/locationtimeseries/';
		        rest.post(url,
		        		location,
		        		'Get location timeseries', function(timeseries) {
		        			that.timeChart.addLines(timeseries.features);
		        }, true,
		        function(failedResult) {
		        	alert('Failed to get location timeseries ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
		        });
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
			
			showClusterDetails: function(location, clusterDetails, focusText) {
        		this.hideLoadingDialog();
				if ((!clusterDetails) || (!clusterDetails.details) || (!clusterDetails.details.length)) {
					alert("No results found!");
					return;
				}
            	this.createClusterTable(location, clusterDetails);
            	this.showClusterTimeSeries(clusterDetails.details);
			    this.showTableTitle(focusText);
			},
			
			createClusterTable: function(location, clusterDetails) {
				var that = this;
				if (this.clusterTableContainer) {
					this.clusterTableContainer.remove();
				}
				this.clusterTableContainer = $('<div/>');
            	container.appendChild(this.clusterTableContainer.get(0));
            	this.clusterTableContainer.css({top:LIST_TOP+'px',bottom:(this.listBottom+3)+'px',left:'0px',right:'0px',position:'absolute',overflow:'auto'});
            	this.clusterTable = clustertable.createWidget(this.clusterTableContainer, clusterDetails, location);
            	this.clusterTable.clickFn = function(clusterid, bExplorer) {
            		if (that.attributeMode) {
            			window.open(baseUrl + 'graph.html?attributeid=' + clusterid + '&explorer='+bExplorer,'_blank');
            		} else {
            			window.open(baseUrl + 'graph.html?clusterid=' + clusterid + '&explorer='+bExplorer,'_blank');
            		}
            	};
            	this.clusterTable.fetchIdFn = function(clusterid, callback) {
            		if (that.attributeMode) {
            			rest.get(baseUrl + 'rest/overview/attributeads/' + clusterid,'Get attribute ads',callback);
            		} else {
            			rest.get(baseUrl + 'rest/overview/clusterads/' + clusterid,'Get cluster ads',callback);
            		}
            	};
            	this.clusterTable.resize(this.width, this.height-LIST_TOP-this.listBottom-4);
			},

			showClusterTimeSeries: function(details) {
				var timemap = {};
				for (var i=0; i<details.length; i++) {
					var cluster = details[i];
					for (var day in cluster.timeseries) {
						if (cluster.timeseries.hasOwnProperty(day)) {
							if (timemap[day]) timemap[day] += cluster.timeseries[day];
							else timemap[day] = cluster.timeseries[day];
						}
					}
				}
				var timeseries = [];
				for (day in timemap) {
					if (timemap.hasOwnProperty(day)) {
						timeseries.push({day:Number(day)*1000,count:timemap[day]});
					}
				}
				timeseries.sort(function(a,b){return b.day-a.day;});
				this.timeChartContainer.empty();
				var window = this.timelineControl.getControlWindow();
				this.fullTimeData = this.timeChart.getData();
			    this.timeChart = aggregatetime.createWidget(this.timeChartContainer, baseUrl, window.start, window.end);
				this.timeChart.barsVisible = amplify.store('barsVisible');
				if(this.timeChart.barsVisible === undefined) {
					this.timeChart.barsVisible = true;
					amplify.store('barsVisible', this.timeChart.barsVisible);
				}
				this.timeChart.resize(this.width, this.timeChartHeight);
			    this.timeChart.setData(timeseries);
			},
			
			createTimeseries: function() {
				this.timeChartContainer = $('<div/>', {id:ui_util.uuid()});
                this.timeChartContainer.css({
                	left: '0px',
                	right: '0px',
                	height: this.timeChartHeight+'px',
                	bottom: '0px',
                	position: 'absolute',
                	'border-left': '2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
                	'border-right': '2px solid ' + colors.OVERVIEW_TIMELINE_BORDER
                });
                container.appendChild(this.timeChartContainer.get(0));
                this.timeChart = aggregatetime.createWidget(this.timeChartContainer, baseUrl, WINDOW_START_TIME, WINDOW_END_TIME);
			},

			createTimeline: function() {
				this.timelineContainer = $('<div/>', {id:ui_util.uuid()});
                this.timelineContainer.css({
                	left: '0px',
                	right: '0px',
                	height: '25px',
                	bottom: this.timeChartHeight+'px',
                	position: 'absolute'
                });
                container.appendChild(this.timelineContainer.get(0));

				var that = this,
					data = {
						band:{
							"start":WINDOW_START_TIME.getTime(),
							"end":WINDOW_END_TIME.getTime()
						},
						color: colors.OVERVIEW_TIMELINE,
						allowWheel:true
					},
					linkFn = function(linkData) {
						var timeWindow = that.timeline.getWindow();
						that.timelineControl.setControlWindow(timeWindow);
						that.timeChart.setTimeWindow(timeWindow.start,timeWindow.end);
					};
				
				// Create the timeline in the DOM
				this.timeline = new aperture.timeline.Timeline( {id:this.timelineContainer.get(0).id, data:data, linker:linkFn} );
				//this.timeline.map('border-width').asValue(0);  // this is not needed - causing border to be drawn in latest aperture update
				this.timeline.wheelZoomListener = linkFn;
				this.timeline.dblclickFn = function(event) {
					if (that.tlIconClickFn) that.tlIconClickFn(event);
				};
				this.timeline.clickFn = function(event) {
					that.setSelection(event.data.archiveid);
				};

				this.timelineContainer.addClass('ui-corner-top');
				this.timelineContainer.css({'border-top':'2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					'border-left':'2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					'border-right':'2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					'border-bottom':'none'});
			},

			createTimelineControl: function(elem) {
				var that = this;
				var id = ui_util.uuid();
				this.timelineControlContainer = $('<div/>', {id:id});
                this.timelineControlContainer.css({
                	left: '0px',
                	right: '0px',
                	height: '25px',
                	bottom: this.timeChartHeight+TIMELINE_HEIGHT+'px',
                	position: 'absolute'
                });
                container.appendChild(this.timelineControlContainer.get(0));

                this.resizeBar = $('<div/>');
                this.resizeBar.css({position:'absolute',bottom:this.listBottom+'px',height:'3px',left:'0px',right:'0px',background:colors.OVERVIEW_BORDER,cursor:'ns-resize'});
                var startY = 0;
                this.resizeBar.draggable({
                	axis:'y',
        			cursor: 'ns-resize',
        			helper: 'clone',
        			start: function(event, ui) {
        				startY = event.clientY;
            		},
            		stop: function(event, ui) {
            			var endY = event.clientY;
            			var h = that.timeChartHeight-(endY-startY);
            			if (h<10) h = 10;
            			that.timeChartHeight = h;
            			that.listBottom = that.timeChartHeight+TIMELINE_HEIGHT*2+1;
            			that.ontimelinesize();
            		}
                });
                container.appendChild(this.resizeBar.get(0));

				var data = {
					global_start:GLOBAL_START_TIME.getTime(),
					global_end:GLOBAL_END_TIME.getTime(),
					window_start:WINDOW_START_TIME.getTime(),
					window_end:WINDOW_END_TIME.getTime(),
					color:colors.OVERVIEW_TIMELINE
				};
				this.timelineControl = new aperture.timelinecontrol.TimelineControl(this.timelineControlContainer.get(0), id, data);
				this.timelineControl.windowListener = function(start,end) {
					that.timeline.setWindow(start,end);
					that.timeChart.setTimeWindow(start,end);
				};
				this.timelineControl.resizeListener = function(start,delta) {
					that.timelineHeight = that.timelineHeight - delta;
					that.timelineHeight = Math.max(Math.min(that.timelineHeight, that.fullheight*MAX_TIMELINE_PORTION), MIN_TIMELINE_HEIGHT);
					that.resize(that.fullwidth, that.fullheight);
				};
			},
			
			ontimelinesize: function() {
				amplify.store('timeChartHeight', this.timeChartHeight);
				amplify.store('listBottom', this.listBottom);
                this.resizeBar.css({bottom:this.listBottom+'px'});
				if (this.timeChart) {
	                this.timeChartContainer.css({height:this.timeChartHeight+'px'});
					this.timeChart.resize(this.width, this.timeChartHeight);
				}
            	if (this.clusterTable) {
                	this.clusterTableContainer.css({bottom:(this.listBottom+3)+'px',height:(this.height-this.listBottom-LIST_TOP-4)+'px'});
            		this.clusterTable.resize(this.width, this.height-this.listBottom-LIST_TOP-4);
            	}
                this.timelineContainer.css({bottom: this.timeChartHeight+'px'});
                this.timelineControlContainer.css({bottom: this.timeChartHeight+TIMELINE_HEIGHT+'px'});
			},
			
			resize: function(width,height) {
				this.width = width;
				this.height = height;
				if (this.timeChart) this.timeChart.resize(width, this.timeChartHeight);
				if (this.timelineControl) this.timelineControl.resize(width,25);
				if (this.timeline) this.timeline.resize(width,25);
            	if (this.clusterTable) this.clusterTable.resize(this.width, this.height-this.listBottom-LIST_TOP-4);
			}
		};
		entityListWidget.init();
		return entityListWidget;
	};


	return {
		createWidget:createWidget
	}
});
