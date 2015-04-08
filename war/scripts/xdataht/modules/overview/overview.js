/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 *
 * Property of Uncharted (TM), formerly Oculus Info Inc.
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
define(['../util/rest', '../util/ui_util', './aggregatetimemap', './aggregatetime', './clustertable', './searchwidget', './helpmenu', '../util/menu', '../util/colors', '../util/advancedsearch'], 
function(rest, ui_util, aggregatetimemap, aggregatetime, clustertable, searchwidget, helpmenu, menu, colors, AdvancedSearch) {
	var dataset = 'ht',
		GLOBAL_START_TIME = new Date(dataset==='labor'?'2014/02/15':'2012/01/01'),
		GLOBAL_END_TIME = new Date(dataset==='labor'?'2015/03/15':GLOBAL_START_TIME.getTime()+(3600000*24)*365*4),
		WINDOW_START_TIME = new Date(dataset==='labor'?'2014/11/15':GLOBAL_START_TIME.getTime()+(3600000*24)*(365+212)),
		WINDOW_END_TIME = new Date(dataset==='labor'?'2015/01/15':(new Date()).getTime()+(3600000*24)*30),
		TIMELINE_HEIGHT = 24,
		TITLE_HEIGHT = 20,
		MAP_TOP = 40,
		ATTRIBUTE_MODE = false,
		pageTitle = 'Public Advertisements for Adult Services - Overview',

	createWidget = function(container, baseUrl, domain) {
		if (domain) {
			dataset = domain;
			GLOBAL_START_TIME = new Date(dataset==='labor'?'2014/02/15':'2012/01/01');
			GLOBAL_END_TIME = new Date(dataset==='labor'?'2015/03/15':GLOBAL_START_TIME.getTime()+(3600000*24)*365*4);
			WINDOW_START_TIME = new Date(dataset==='labor'?'2014/11/15':GLOBAL_START_TIME.getTime()+(3600000*24)*(365+212));
			WINDOW_END_TIME = new Date(dataset==='labor'?'2015/01/15':(new Date()).getTime()+(3600000*24)*30);
			if (dataset=='labor') pageTitle = 'Public Advertisements for Labor Services - Overview';
		}
		var overviewWidget = {
			mapContainer: null,
			map: null,
			timeData: [],
			timeChartContainer: null,
			timeChart: null,
			timelineContainer: null,
			timeline: null,
			timeChartHeight: amplify.store('timeChartHeight'),
			mapBottom: amplify.store('mapBottom'),
			location:null,
			init: function() {
				if (this.timeChartHeight===undefined) this.timeChartHeight = 100;
				if (this.mapBottom===undefined) this.mapBottom = this.timeChartHeight+TIMELINE_HEIGHT*2+1;
				this.createMap();
				this.createTimeseries();
			    this.timeChart.fetchData(dataset);
				this.createTimelineControl();
				this.createTimeline();
				this.createTitle();
                this.createLogout();
                this.showViewSelector();
				
                var that = this;
                this.searchWidget = searchwidget.createWidget(container, baseUrl, domain, 
                		function(forceAttributeMode, tip) {that.onSearchTip(forceAttributeMode, tip);}, 
                		function(contents) {that.onSearchCSV(contents);}, 
                		function(contents) {that.onSearchImage(contents);},
                		function(imageUrl) {that.onSearchUrl(imageUrl);});

                this.helpmenu = helpmenu.createWidget(container, baseUrl);
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
			onSearchTip: function(attributeMode, tip) {
				var that = this;
				if (tip==null) return;
				tip = tip.trim();
				if (tip.length==0) return;
            	window.open(baseUrl + 'entitylist.jsp?tip='+tip+'&attribute='+attributeMode);
			},
			onSearchCSV: function(csvContents) {
				var that = this;
            	var query = '';
            	var isFirst = true;
            	for (var i=0; i<csvContents.length; i++) {
            		if (csvContents[i]==null) continue;
            		var val = csvContents[i].trim();
            		if (val.length>0) {
            			if (isFirst) isFirst = false;
            			else query += ',';
            			query += val;
            		}
            	}
				var url = baseUrl + 'entitylist.jsp?data=csv';
				var form = $('<form action="' + url + '" method="post" target="_blank">' +
				  '<input type="text" name="csvdata" value="' + query + '" />' +
				  '</form>');
				$('body').append(form);
				form.submit();
			},

            onSearchUrl : function(imageUrl) {
                function onError(err) {
                    if (err.status==200) return; // jQuery doesn't like this JSON for some reason I think...
                    alert('Image search failed. Refresh and try again.');
                }

                rest.post(
                    restUrl,
                    imageUrl,
                    'Search by image from a URL',
                    function(hash) {
                        window.open(baseUrl + 'entitylist.jsp?imagehash='+hash+'&attribute='+ATTRIBUTE_MODE);
                    },true,
                    onError
                )
            },

			onSearchImage: function(contents) {
            	var url = baseUrl + 'rest/overview/imagehash';

           		var formData = new FormData();
           		formData.append("file", contents);
           		$.ajax({
           	      url : url,
           	      type : 'post',
           	      data : formData,
           	      async : true,
           	      cache : false,
           	      dataType : 'text/plain',
           	      contentType : false,
           	      processData : false,
           	      complete: function(result) {
                      if (result.status!=200) {
                    	  alert('Failed to search image... AJAX error');
                    	  return;
                      }
                      var hash = result.responseText;
                      window.open(baseUrl + 'entitylist.jsp?imagehash='+hash+'&attribute='+ATTRIBUTE_MODE);
           	      },
           	      error: function(err) {
           	    	  if (err.status==200) return; // jQuery doesn't like this JSON for some reason I think...
           	    	  alert('Image search failed. Refresh and try again.');
           	      }
           	   });
			},

            onAdvancedSearch: function(attributeMode,callback) {
                overviewWidget.showLoadingDialog('Performing advanced search');
                var url = baseUrl + 'entitylist.jsp?advanced=true&attribute='+attributeMode;
                descriptors.forEach(function(descriptor) {
                	url += '&' + descriptor.name.toLowerCase() + '=' + descriptor.value;
                });
                window.open(url);
            },
			
			showViewSelector: function() {
				var that = this;
				if (this.focusControl) {
					this.focusControl.remove();
					this.focusControl.empty();
				}
				this.focusControl = $('<div/>');
                this.focusControl.css({
                	left: '2px',
                	top: '23px',
                	height: '20px',
                	position: 'absolute',
                	'font-family': 'Arial,Helvetica,sans-serif',
                	'font-weight': 'bold'
                });
                container.appendChild(this.focusControl.get(0));

                var casesMenu = $('<div/>').css({position:'relative',float:'left',cursor:'pointer'});
                var casesLabel = $('<div/>').text('Cases').css({position:'relative',float:'left'});
                casesMenu.append(casesLabel);
                casesMenu.click(function(event) {
                	window.open(baseUrl + 'cases.html', '_blank');
                });
                this.focusControl.append(casesMenu);
                
                var domainMenu = $('<div/>').css({position:'relative',float:'left','padding-left':'10px',cursor:'pointer'});
                var domainLabel = $('<div/>').text('Domain').css({position:'relative',float:'left'});
                domainMenu.append(domainLabel);
                domainMenu.click(function(event) {
                	menu.createContextMenu(event, [
                       {type: 'action', label:'Labor', callback:function() {that.setDomain('labor');}},
                       {type: 'action', label:'Prostitution', callback:function() {that.setDomain('escorts');}}
                	]);
                });
                var downDiv = $('<div/>');
                downDiv.addClass('ui-icon ui-icon-triangle-1-s');
                downDiv.css({position:'relative',float:'left'});
                domainMenu.append(downDiv);
                this.focusControl.append(domainMenu);

                var viewMenu = $('<div/>').css({position:'relative',float:'left','padding-left':'10px',cursor:'pointer'});
                var viewLabel = $('<div/>').text('View').css({position:'relative',float:'left'});
                viewMenu.append(viewLabel);
                viewMenu.click(function(event) {
                	menu.createContextMenu(event, [
                       {type: 'action', label:'Total Ads', callback:function() {that.map.setMode(0);}},
                       {type: 'action', label:'Total change in Ads', callback:function() {that.map.setMode(1);}},
                       {type: 'action', label:'Percent change in Ads', callback:function() {that.map.setMode(2);}},
                       {type: 'action', label:'Group by proximity', callback:function() {that.map.setMode(3);}},
                       {type: 'action', label:'Show demographics', callback:function() {that.map.showDemographics();}}
                	]);
                });
                var downDiv = $('<div/>');
                downDiv.addClass('ui-icon ui-icon-triangle-1-s');
                downDiv.css({position:'relative',float:'left'});
                viewMenu.append(downDiv);
                this.focusControl.append(viewMenu);

                var sourceMenu = $('<div/>').css({position:'relative',float:'left','padding-left':'10px',cursor:'pointer'});
                var sourceLabel = $('<div/>').text('Sources').css({position:'relative',float:'left'});
                sourceMenu.append(sourceLabel);
                sourceMenu.click(function(event) {
                	if (that.sourcecounts) {
                		that.showSourceCounts(event);
                	} else {
	                	var url = baseUrl + 'rest/overview/sourcecounts/';
	    		        rest.get(url, 'Get source counts', function(sourcecounts) {
	    		        	that.sourcecounts = sourcecounts;
	    		        	that.showSourceCounts(event);
	    		        });
                	}
                });
                var sourceDownDiv = $('<div/>');
                sourceDownDiv.addClass('ui-icon ui-icon-triangle-1-s');
                sourceDownDiv.css({position:'relative',float:'left'});
                sourceMenu.append(sourceDownDiv);
                this.focusControl.append(sourceMenu);
			
			},

			showSourceCounts: function(event) {
	        	var sourcecount, sourcediv, labeldiv, countdiv,
					items = [], totalCount = 0;
	        	for (var i=0; i<this.sourcecounts.sourcecounts.length; i++) {
	        		sourcecount = this.sourcecounts.sourcecounts[i];
	        		sourcediv = $('<div/>').css({position:'relative',overflow:'hidden'}).
	        			on('mouseover',function(event) {
							$(this).css({background:colors.OVERVIEW_HOVER});
						}).
	        			on('mouseout',function(event) {$(this).css({background:''});});
	        		labeldiv = $('<div/>').text(sourcecount.source).css({position:'relative',float:'left'});
	        		countdiv = $('<div/>').text(sourcecount.count).css({position:'relative',float:'right','padding-left':'5px'});
	        		sourcediv.append(labeldiv).append(countdiv);
					items.push({type: 'div', div: sourcediv});
					totalCount += sourcecount.count;
	        	}

				//add Total count
				sourcediv = $('<div/>').css({position:'relative',overflow:'hidden','border-top':'1px solid gray'}).
					on('mouseover',function(event) {$(this).css({background:colors.OVERVIEW_HOVER});}).
					on('mouseout',function(event) {$(this).css({background:''});});
				labeldiv = $('<div/>').text('Total').css({position:'relative',float:'left','font-weight':'bold'});
				countdiv = $('<div/>').text(totalCount).css({position:'relative',float:'right','padding-left':'5px','font-weight':'bold'});
				sourcediv.append(labeldiv).append(countdiv);
				items.push({type: 'div', div: sourcediv});
	        	menu.createContextMenu(event, items);
			},

			openClusterTable: function(location, attributeMode) {
                window.open(baseUrl + 'entitylist.jsp?location='+location+'&attribute='+attributeMode);
			},

			openLaborDetails: function(locationData) {
				window.open(baseUrl + 'labor.html?category=' + locationData.category_id + '&location=' + encodeURIComponent(locationData.location));
			},

			fetchLaborLocationData: function(location, callback) {
				var that = this;
				this.location = location;
				rest.post(baseUrl + 'rest/overview/laborlocationdetails/',
					location,
					'Get location clusters', function(locationdetails) {
						if(callback) callback(locationdetails);
					}, true,
					function(failedResult) {
						alert('Failed to get location data ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
					});
			},

//			showRelated: function(location) {
//				var that = this;
//				var url = baseUrl + 'rest/overview/locationclusterdetails/';
//				if (ATTRIBUTE_MODE) url = baseUrl + 'rest/overview/locationattributedetails/';
//				this.showLoadingDialog('Loading location data');
//				rest.post(url,
//					location,
//					'Get location clusters', function(clusterDetails) {
//						that.hideLoadingDialog();
//						that.showRelatedLocations(location, clusterDetails);
//					}, true,
//					function(failedResult) {
//						that.hideLoadingDialog();
//						alert('Failed to get location data ' + failedResult.status + ': ' + failedResult.message + '\n A refresh may be required.');
//					});
//			},
//			showRelatedLocations: function(location,clusterDetails) {
//				var mappings = {}, relatedloc, ad, i, count;
//				for (i=0; i<clusterDetails.details.length; i++) {
//					ad = clusterDetails.details[i];
//					for (relatedloc in ad.locationlist) {
//						if (ad.locationlist.hasOwnProperty(relatedloc)) {
//							count = Number(ad.locationlist[relatedloc]);
//							if (!mappings[relatedloc]) mappings[relatedloc] = 1;
//							else mappings[relatedloc]++;
//						}
//					}
//				}
//				var relatedlist = [];
//				for (relatedloc in mappings) {
//					if (mappings.hasOwnProperty(relatedloc)) {
//						count = Number(mappings[relatedloc]);
//						relatedlist.push({location:relatedloc,count:count});
//					}
//				}
//				relatedlist.sort(function(a,b) { return b.count-a.count; });
//				this.map.createLinkLayer(location,relatedlist);
//			},
			
			createMap: function() {
				var that = this;
				var id = ui_util.uuid();
                this.mapContainer = $('<div/>', {id:id});
                this.mapContainer.css({
                	left: '0px',
                	right: '0px',
                	top: MAP_TOP+'px',
                	bottom: this.mapBottom+'px',
                	position: 'absolute'
                });
                container.appendChild(this.mapContainer.get(0));
                this.map = aggregatetimemap.createWidget(this.mapContainer, baseUrl, WINDOW_START_TIME, WINDOW_END_TIME, dataset);
                this.map.clickFn = function(event) {
					var location =  event.data.location,
						items = [
							{
								type: 'collection',
								label: location
							}
						];
					if(dataset==='labor') {
						that.fetchLaborLocationData(location, function(locationData) {
							items[0].items = [];
							for(var i = 0;i<locationData.length;i++) {
								locationData[i].location = location;
								items[0].items.push(
									{
										type: 'action',
										label: locationData[i].count + ' ' + locationData[i].category,
										data: locationData[i],
										callback: function (data) {
											that.openLaborDetails(data);
										}
									}
								);
							}
							menu.createContextMenu(event.source, items);
						});

					} else {
						items[0].items = [
							{
								type: 'action',
								label: 'Show Entity List',
								callback: function () {
									that.openClusterTable(location, false);
								}
							},
							{
								type: 'action',
								label: 'Show Phone/Email/Website List',
								callback: function () {
									that.openClusterTable(location, true);
								}
							}
//							,
//							{
//								type: 'action',
//								label: 'Show Regions Sharing Entities',
//								callback: function () {
////											that.showRelated(location);
//									alert('Not yet implemented');
//								}
//							}
						];
						menu.createContextMenu(event.source, items);
					}
                };
			},

			setDomain: function(domain) {
				if (domain=='labor') {
					window.location = baseUrl + '?domain=labor';
				} else {
					window.location = baseUrl;
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
						that.map.setTimeWindow(timeWindow.start,timeWindow.end);
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
                this.resizeBar.css({position:'absolute',bottom:this.mapBottom+'px',height:'3px',left:'0px',right:'0px',background:colors.OVERVIEW_BORDER,cursor:'ns-resize'});
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
            			that.mapBottom = that.timeChartHeight+TIMELINE_HEIGHT*2+1;
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
					that.map.setTimeWindow(start,end);
				};
				this.timelineControl.resizeListener = function(start,delta) {
					that.timelineHeight = that.timelineHeight - delta;
					that.timelineHeight = Math.max(Math.min(that.timelineHeight, that.fullheight*MAX_TIMELINE_PORTION), MIN_TIMELINE_HEIGHT);
					that.resize(that.fullwidth, that.fullheight);
				};
			},
			
			ontimelinesize: function() {
				amplify.store('timeChartHeight', this.timeChartHeight);
				amplify.store('mapBottom', this.mapBottom);
                this.resizeBar.css({bottom:this.mapBottom+'px'});
				if (this.map) {
	                if (!this.mapHidden) this.mapContainer.css({bottom:this.mapBottom+'px'});
					this.map.resize(this.width, this.height-this.mapBottom-MAP_TOP-1);
				}
				if (this.timeChart) {
	                this.timeChartContainer.css({height:this.timeChartHeight+'px'});
					this.timeChart.resize(this.width, this.timeChartHeight);
				}
            	if (this.clusterTable) {
                	if (this.mapHidden) this.clusterTableContainer.css({bottom:(this.mapBottom+3)+'px',height:(this.height-this.mapBottom-MAP_TOP-4)+'px'});
            		this.clusterTable.resize(this.width, this.height-this.mapBottom-MAP_TOP-4);
            	}
                this.timelineContainer.css({bottom: this.timeChartHeight+'px'});
                this.timelineControlContainer.css({bottom: this.timeChartHeight+TIMELINE_HEIGHT+'px'});
			},
			
			resize: function(width,height) {
				this.width = width;
				this.height = height;
				if (this.map) this.map.resize(width, height-this.mapBottom-MAP_TOP-1);
				if (this.timeChart) this.timeChart.resize(width, this.timeChartHeight);
				if (this.timelineControl) this.timelineControl.resize(width,25);
				if (this.timeline) this.timeline.resize(width,25);
            	if (this.clusterTable) this.clusterTable.resize(this.width, this.height-this.mapBottom-MAP_TOP-4);
			}
		};
		overviewWidget.init();
		return overviewWidget;
	};


	return {
		createWidget:createWidget
	}
});
