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

define([ '../util/ui_util', './table', './timeline', './attr_chart', './map', './wordcloud', './buildCase', './nodeSummary', './clusterManager', '../util/rest', './linkCriteria', './refine', './graph', './../explorer/explorer', './searchpanel', './simplesearchpanel', './pagingpanel', './selection', '../util/colors', './images'],
	function( ui_util, table, timeline, attr_chart, map, wordcloud, buildCase, nodeSummary, cluster, rest, linkCriteria, refine, graph, explorer, searchpanel, simplesearchpanel, pagingpanel, selection, colors, images) {


	var SIMPLE_SEARCH_WIDTH = 317,
		SIMPLE_SEARCH_HEIGHT = 27,
		WIDGET_TITLE_HEIGHT = 20,
		TRANSITION_TIME = 350,
		BORDER_STYLE = '1px solid '+ colors.BORDER_DARK,

		getClusterDetails = function(baseUrl, datasetName, clustersetName, clusterId, callback) {
			rest.get(baseUrl + 'rest/clusterDetails/' + datasetName + '/' + clustersetName + "/" + clusterId, 'Get cluster details', function(response) {
				var entityDetails, j, i = 0,
					transformedResponse = {
						memberDetails : []
					};

				for (i; i < response.memberDetails.length; i++) {
					 entityDetails = {};
					for (j = 0; j < response.memberDetails[i].map.entry.length; j++) {
						entityDetails[response.memberDetails[i].map.entry[j].key] = response.memberDetails[i].map.entry[j].value;
					}
					transformedResponse.memberDetails.push(entityDetails);
				}

				callback(transformedResponse);
			});
		},

		detailsCallback = function(response, callback) {
			var entityDetails, j, i = 0,
				transformedResponse = { memberDetails : [], wordHistograms : [] };
            if (response) {
                for (i; i < response.memberDetails.length; i++) {
                    entityDetails = {};
                    for (j = 0; j < response.memberDetails[i].map.entry.length; j++) {
                        entityDetails[response.memberDetails[i].map.entry[j].key] = response.memberDetails[i].map.entry[j].value;
                    }
                    transformedResponse.memberDetails.push(entityDetails);
                }

                for (i = 0; i < response.wordHistograms.length; i++) {
                    var histogram = {};
                    if (response.wordHistograms[i].map && response.wordHistograms[i].map.entry && response.wordHistograms[i].map.entry.length) {
	                    for (j = 0; j < response.wordHistograms[i].map.entry.length; j++) {
	                        histogram[response.wordHistograms[i].map.entry[j].key] = response.wordHistograms[i].map.entry[j].value;
	                    }
                    }
                    transformedResponse.wordHistograms.push(histogram);
                }
            }

			callback(transformedResponse);
		},

		searchTipDetailsCallback = function(graph, widget, callback) {
			var entityDetails, j, i, current, nodeId, key,
				nodeDetails={},
				response = graph.response,
				maxNode = {memberDetails: {length: -1}},
				transformedResponse, nodeMap = {};
			for (var h=0; h<graph.nodes.length;h++) {
				nodeMap[graph.nodes[h].id] = {
					label: graph.nodes[h].name,
					ring: graph.nodes[h].ring
				}
			}
			graph.nodeMap=nodeMap;
			for (var k = 0; k<response.memberDetails.entry.length;k++) {
				transformedResponse = { memberDetails : [] };
				key = response.memberDetails.entry[k].key;
				current = [].concat(response.memberDetails.entry[k].value.memberDetails);
				for (i = 0; i < current.length; i++) {
					entityDetails = {};
					for (j = 0; j < current[i].map.entry.length; j++) {
						entityDetails[current[i].map.entry[j].key] = current[i].map.entry[j].value;
					}
					transformedResponse.memberDetails.push(entityDetails);
				}
				if (transformedResponse.memberDetails.length>maxNode.memberDetails.length && nodeMap[key].ring==0) {
					maxNode = transformedResponse;
					nodeId = key;
				}
				nodeDetails[key] = transformedResponse;
				nodeDetails[key].label = nodeMap[key].label;
			}
			widget.nodeDetails = nodeDetails;
			if(callback) {
				callback(nodeId);
			}
		},

		getPreclusterDetails = function(baseUrl, preclusterType, clusterId, callback) {
			rest.get(baseUrl + 'rest/preclusterDetails/' + preclusterType + "/" + clusterId, 'Get precluster details', function(response) {
				detailsCallback(response, callback);
			});
		},

		getPreclusterSearchDetails = function(baseUrl, graph, widget, callback) {
			var attributeIds = [];
			for (var i=0;i<graph.nodes.length;i++) {
				attributeIds.push(graph.nodes[i].id);
			}
			graph.attributeIds = attributeIds;
			rest.post(baseUrl + "rest/preclusterDetails/fetchAds/",
					'{ids:'+ JSON.stringify(graph.attributeIds) + '}',
				"Cluster Search Details",
				function (response) {
					graph.response=response;
					searchTipDetailsCallback(graph, widget, callback);
				},
				false,
				function () {
					alert('error fetching ads');
				});
		},

		getAttributeSearchDetails = function(baseUrl, graph, widget, callback) {
			var attributeIds = [];
			for (var i=0;i<graph.nodes.length;i++) {
				attributeIds.push(graph.nodes[i].id);
			}
			graph.attributeIds = attributeIds;
			rest.post(baseUrl + "rest/attributeDetails/fetchAds/",
				'{ids:'+ JSON.stringify(graph.attributeIds) + '}',
				"Attribute Search Details",
				function (response) {
					graph.response=response;
					searchTipDetailsCallback(graph, widget, callback);
				},
				false,
				function () {
					alert('error fetching ads');
				});
		},

		getAttributeDetails = function(baseUrl, attribute, value, callback) {
			rest.get(baseUrl + 'rest/attributeDetails/' + attribute + "/" + value, 'Get attribute details', function(response) {
				detailsCallback(response, callback);
			});
		},

		getAttributeIdDetails = function(baseUrl, attributeid, callback) {
			rest.get(baseUrl + 'rest/attributeDetails/id/' + attributeid, 'Get attribute id details', function(response) {
				detailsCallback(response, callback);
			});
		},

        getTipDetails = function(baseUrl, tip, callback) {
            rest.get(baseUrl + 'rest/attributeDetails/tip/' + tip, 'Get tip node details', function(response) {
                detailsCallback(response,callback);
            });
        },

		createSidePanel = function(label, hasDetails) {
			return {
				label: label,
				widget: null,
				hasDetails: hasDetails,
				header: null,
				canvas: null,
				collapsed: true,
				collapseDiv: null,
				uncollapse: 120,
				height: WIDGET_TITLE_HEIGHT,
				amp: null
			};
		},
		
		createWidget = function(container, baseUrl, bExplorer) {
			var linkWidgetObj = {
				searchPanel: null,
				graphCanvasContainer: null,
				simpleSearchContainer: null,
				simpleSearch: null,
				sidePanels: {
						nodeSummary: createSidePanel('Node Summary',true),
						buildCase: createSidePanel('Case Builder',false),
						movement: createSidePanel('Movement',true),
						map: createSidePanel('Map',true),
						wordcloud: createSidePanel('Word Cloud',true),
						attributes: createSidePanel('Attributes',true),
						images: createSidePanel('Images',true)
				},
				searchToggleButton:null,
				isAdvancedSearchMode:false,
				sidePanelWidth:null,
				detailsHeight:null,
				visitedNodes:[],
				nodeDetails:{},
                attributeDetails:{},
                tipDetails:{},
				selection:selection.createSelectionManager(),
				classifiers : [],

				init: function() {
                    this.initSidePanels();
					this.createGraphCanvas();
					this.createSimpleSearchCanvas();
					this.pagingPanel = pagingpanel.createWidget(this);
					this.amplifyInit();
					this.fetchClassifiers();
				},

				amplifyInit: function() {
					var setPanel = function (panel, amp) {
							panel.height = Math.max(WIDGET_TITLE_HEIGHT,amp.height);
							panel.uncollapse = amp.uncollapse;
							panel.collapsed = amp.collapsed;
						},
						sidePanelWidthAmp = amplify.store('sidePanelWidth'),
						detailsHeightAmp = amplify.store('detailsHeight');

					for (var sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							var panel = this.sidePanels[sidePanelIter];
							panel.amp = amplify.store(sidePanelIter);
							if (panel.amp) setPanel(panel,panel.amp);
							panel.collapseDiv.addClass(panel.collapsed?'ui-icon-triangle-1-e':'ui-icon-triangle-1-s');
						}
					}
						
					this.sidePanelWidth = sidePanelWidthAmp?sidePanelWidthAmp:300;
					this.detailsHeight = detailsHeightAmp?detailsHeightAmp:300;
				},

				initSidePanels: function () {
					var that = this,
						jqContainer = $(container),
						startX = 0, startY = 0,
						makeCollapsible = function(sidePanel) {
							sidePanel.collapseDiv = $('<div/>')
								.addClass('ui-icon')
								.css({
									position:'relative',
									float:'left',
									cursor:'pointer',
									width:'16px',
									height:'16px'
								});
							sidePanel.label.css({
								height:WIDGET_TITLE_HEIGHT+'px',
								cursor:'pointer',
								position:'relative',
								width: 'calc(100% - 17px)',
								float:'left',
								'padding-top':'1.5px',
								'font-weight':'bold',
								'white-space': 'nowrap',
								color: colors.SIDEPANEL_LABEL,
								overflow:'hidden'
							});
							sidePanel.header.append(sidePanel.collapseDiv);
							sidePanel.header.append(sidePanel.label);
							sidePanel.header.on('click', function(event) {
								var i, panel,
									numUncollapsed = 0;
								if (sidePanel.collapsed) {
									var heightToSteal = 0,
										heightTaken = 0,
										curHeightTaken;

									sidePanel.collapsed = false;
									sidePanel.collapseDiv.removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-s');

									for (sidePanelIter in that.sidePanels) {
										if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
											panel = that.sidePanels[sidePanelIter];
											if (panel==sidePanel) continue;
											if (!panel.collapsed) {
												numUncollapsed++;
												heightToSteal += panel.height;
											}
										}
									}

									if (numUncollapsed>0) {
										for (sidePanelIter in that.sidePanels) {
											if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
												panel = that.sidePanels[sidePanelIter];
												if (panel==sidePanel) continue;
												if (!panel.collapsed) {
													curHeightTaken = panel.height/(numUncollapsed+1);
													panel.height -= curHeightTaken;
													heightTaken += curHeightTaken;
												}
											}
										}
										sidePanel.height += heightTaken;
									} else {
										sidePanel.height = sidePanel.uncollapse;
									}
								} else {
									sidePanel.collapsed = true;
									sidePanel.collapseDiv.removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');

									for (sidePanelIter in that.sidePanels) {
										if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
											panel = that.sidePanels[sidePanelIter];
											if (panel==sidePanel) continue;
											if (!panel.collapsed) numUncollapsed++;
										}
									}
									if (numUncollapsed>0) {
										for (sidePanelIter in that.sidePanels) {
											if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
												panel = that.sidePanels[sidePanelIter];
												if (panel==sidePanel) continue;
												if (!panel.collapsed) panel.height += sidePanel.height/numUncollapsed;
											}
										}
									}
									sidePanel.uncollapse = sidePanel.height;
									sidePanel.height = WIDGET_TITLE_HEIGHT;
								}
								that.panelResize();
							});
						},
						createPanel = function(sidePanel) {
							sidePanel.header = $('<div/>')
								.css({
									width:that.sidePanelWidth+'px',
									top:sidePanel.top+'px',
									position:'absolute'
								}).addClass('moduleHeader');
							sidePanel.label = $('<div/>')
								.css({
									position:'absolute',
									left:'2px',
									top:'1px'
								}).text(sidePanel.label);
							sidePanel.canvas = $('<div/>')
								.css({
									position:'absolute',
									top:WIDGET_TITLE_HEIGHT+'px',
									right:'0px',
									'padding-top':'1px',
									width:that.sidePanelWidth+'px',
									height:(sidePanel.height-WIDGET_TITLE_HEIGHT)+'px',
									overflow:'hidden',
									'border-left': BORDER_STYLE,
									cursor: 'default'
								});
							jqContainer.append(sidePanel.header).append(sidePanel.canvas);
						},
						makeDraggable = function(upperPanel, sidePanel) {
							sidePanel.header.draggable({
								axis:'y',
								helper: 'clone',
								start: function(event, ui) {
									if (upperPanel.collapsed||sidePanel.collapsed) return false;
									startY = event.clientY;
								},
								stop: function(event, ui) {
									var endY = event.clientY,
										delta = endY-startY;
									if (sidePanel.height-delta<WIDGET_TITLE_HEIGHT) delta = sidePanel.height-WIDGET_TITLE_HEIGHT;
									if (upperPanel.height+delta<WIDGET_TITLE_HEIGHT) delta = WIDGET_TITLE_HEIGHT-upperPanel.height;
									sidePanel.height -= delta;
									upperPanel.height += delta;
									that.panelResize();
								}
							});
						};

					//add the side panels
					var prevPanel = null,
						curY = 0;
					for (var sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							var panel = this.sidePanels[sidePanelIter];
							panel.top = curY;
							panel.height = WIDGET_TITLE_HEIGHT;
							curY += WIDGET_TITLE_HEIGHT;
							createPanel(panel);
							makeCollapsible(panel);
							if (prevPanel!=null) {
								makeDraggable(prevPanel,panel);
							}
							prevPanel = panel;
						}
					}

					//add other elements
					this.detailsCanvas = $('<div/>')
						.css({
							'background':'url(\'img/table.png\')',
							'background-position':'center',
							'background-repeat':'no-repeat',
							'background-size':'100% 100%',
							position:'absolute',
							height:this.detailsHeight+'px',
							right:this.sidePanelWidth+'px',
							left:'0px',
							bottom:'0px',
							overflow:'auto',
							'border-top':BORDER_STYLE,
							'border-right':BORDER_STYLE,
							cursor: 'default'
						});
					jqContainer.append(this.detailsCanvas);

					this.searchToggleButton = $('<div/>')
						.button({
							text:false,
							disabled:true,
							icons:{
								primary:'ui-icon-triangle-1-e'
							},
							label:'Advanced controls (disabled)'
						})
						.css({
							position:'absolute',
							top:WIDGET_TITLE_HEIGHT+4+'px',
							left:'2px',
							margin:'0px',
							width:'20px',
							height:'20px',
							display: 'none' //TODO remove
						})
						.click(function() {
							if (that.isAdvancedSearchMode) {
								that.onSimpleSearch();
							} else {
								that.onAdvancedSearch();
							}
						});
					jqContainer.append(this.searchToggleButton);

					//resize for side panel
                    var that = this;
					this.resizeBar = $('<div/>')
						.css({
							position:'absolute',
							bottom:'0px',
							top:'0px',
							width:'3px',
							right:this.sidePanelWidth+'px',
							background:colors.APPWIDGET_RESIZE_BAR,
							cursor:'ew-resize'
						})
						.draggable({
							axis:'x',
							cursor: 'ew-resize',
							helper: 'clone',
							start: function(event, ui) {
								startX = event.clientX;
							},
							stop: function(event, ui) {
								var endX = event.clientX,
									w = that.sidePanelWidth-(endX-startX);
								if (w<10) w = 10;
								that.sidePanelWidth = w;
								amplify.store('sidePanelWidth', w);
								that.panelResize();
							}
						});
					jqContainer.append(this.resizeBar);

					//resize for details table
					this.detailResizeBar = $('<div/>')
						.css({
							position:'absolute',
							bottom:this.detailsHeight+'px',
							height:'3px',
							left:'0px',
							right:this.sidePanelWidth+'px',
							background:colors.APPWIDGET_RESIZE_BAR,
							cursor:'ns-resize'
						})
						.draggable({
							axis:'y',
							cursor: 'ns-resize',
							helper: 'clone',
							start: function(event, ui) {
								startY = event.clientY;
                                if (that.table) {
                                    that.table.isResizing = true;
                                }
							},
							stop: function(event, ui) {
								var endY = event.clientY,
									h = that.detailsHeight-(endY-startY);
								if (h<WIDGET_TITLE_HEIGHT) h = WIDGET_TITLE_HEIGHT;
								that.detailsHeight = h;
								amplify.store('detailsHeight', h);
								that.panelResize();
                                if (that.table) {
                                    that.table.isResizing = false;
                                }
							}
						});
					jqContainer.append(this.detailResizeBar);
				},

				onSimpleSearch: function() {
					var that = this;
					this.graphHeader.animate({left:'0px'}, TRANSITION_TIME);
					this.graphCanvasContainer.animate({left:'0px'}, TRANSITION_TIME, function() {
						that.graphCanvasContainer.resize();
					});
					this.searchToggleButton.animate({left:'2px'}, TRANSITION_TIME, function() {
						that.searchToggleButton.button({
							icons:{
								primary:'ui-icon-triangle-1-e'
							},
							label:'Show advanced controls'
						});
					});
					this.graphPropertiesCanvas.animate({width:'0px'}, TRANSITION_TIME, function() {
						that.simpleSearchContainer.animate({top:WIDGET_TITLE_HEIGHT+'px', opacity:1}, TRANSITION_TIME);
					});
					this.isAdvancedSearchMode = false;
				},

                doAdvancedSearch: function(params,clusterType,bExplorer) {
                    var that = this;
                    this.softClear();
                    this.graphWidget.displayLoader();
                    this.pagingPanel.hidePagingControls();
                    if (bExplorer) {
                        this.graphWidget.fromAdvanced(params);
                        this.graphLabel.text('Explore search results and coreferenced attributes');
                    } else {
                        this.graphWidget.advancedGraph(baseUrl, params, clusterType, function (graph) {
                            that.pagingPanel.setFullGraph(graph, null, null, clusterType);
                            that.displayDetailsSpinners();
                            //that.graphWidget.markSelectedCluster(searchStr);  // Todo: How?
                            getPreclusterDetails(baseUrl, clusterType, clusterid, function (response) {
                                that.graphWidget.getSelectedSummary(function(summary) {
                                    that.showClusterDetails(response, summary.label);
                                });
                                that.nodeDetails[searchStr] = response;
                            });
                        }, function () {
                            alert('Error fetching graph');
                            that.softClear();
                        });
                    }
                },

				doSimpleSearch: function(searchStr,clusterType,bExplorer) {
					var that = this;
					this.softClear();
					this.graphWidget.displayLoader();
					this.pagingPanel.hidePagingControls();
					if (bExplorer) {
						this.graphWidget.fromTip(searchStr);
						this.graphLabel.text('Explore search results and coreferenced attributes');
					} else {
						this.graphWidget.simpleGraph(baseUrl, searchStr, clusterType, function (graph) {
							that.pagingPanel.setFullGraph(graph, null, null, clusterType);
							that.displayDetailsSpinners();
							that.graphWidget.markSelectedCluster(searchStr);
							getPreclusterDetails(baseUrl, clusterType, clusterid, function (response) {
                                that.graphWidget.getSelectedSummary(function(summary) {
                                    that.showClusterDetails(response, summary.label);
                                });
                                that.nodeDetails[searchStr] = response;
							});
						}, function () {
							alert('Error fetching graph');
							that.softClear();
						});
					}
				},

				onSelectCluster : function(clusterType,id,title) {
					var that = this;
					that.displayDetailsSpinners();

					if (id && !this.nodeDetails[id]) {
						getPreclusterDetails(baseUrl, clusterType, id, function(response) {
							that.nodeDetails[id] = response;
	                        that.showClusterDetails(response, title);
						});
					} else {
                        this.showClusterDetails(this.nodeDetails[id], title);
					}
				},

                onSelectAttributeNode : function(attributeName,attributeValue) {
                    var key = attributeName + ':' + attributeValue;
                    var that = this;

                    this.displayDetailsSpinners();
                    if (!this.attributeDetails[key]) {
                        getAttributeDetails(baseUrl,attributeName,attributeValue,function(response) {
                            that.attributeDetails[key] = response;
                            that.showClusterDetails(that.attributeDetails[key], key);
                        });
                    } else {
                        that.showClusterDetails(that.attributeDetails[key], key);
                    }
                },

                onSelectTipNode : function(tipString) {
                    var key = tipString;
                    var that = this;

                    this.displayDetailsSpinners();
                    if (!this.tipDetails[key]) {
                        getTipDetails(baseUrl,tipString,function(response) {
                            that.tipDetails[key] = response;
                            that.showClusterDetails(that.tipDetails[key], 'tip:'+key);
                        });
                    } else {
                        that.showClusterDetails(that.tipDetails[key], 'tip:'+key);
                    }
                },

				fetchClusterId: function(clusterid,clusterType) {
					var that = this;
					this.softClear();
					this.graphWidget.displayLoader();
					this.pagingPanel.hidePagingControls();
					if (bExplorer) {
						this.graphWidget.fetchClusterId(baseUrl, clusterid, clusterType, function(node) {
							var title = node['label'];
							that.graphWidget.displayGraph(node);

							that.onSelectCluster(clusterType,clusterid,title);
						});
						this.graphLabel.text('Explore entity relationships with coreferenced attributes');
						
					} else {
						this.graphWidget.fetchClusterId(baseUrl, clusterid, clusterType, function(graph) {
							var title = graph.nodes[0].label;
							that.pagingPanel.setFullGraph(graph, null, null, clusterType);
							that.displayDetailsSpinners();
							getPreclusterDetails(baseUrl, clusterType, clusterid, function(response) {
                                that.nodeDetails[clusterid] = response;
                                that.showClusterDetails(response, title);
							});


							that.graphWidget.markSelectedCluster(clusterid);
						}, function() {
							alert('Error fetching graph');
							that.softClear();
						});
					}
				},

				redirect: function(attribute, value, callback) {
					var that = this,
						$dSpinner = $('#details-spinner');
					this.table.mainDiv.css('display','none');
					$dSpinner.css('display','');
					rest.get(baseUrl + 'rest/attributeDetails/getattrid/'+attribute+'/'+value,
						"get Attribute ID",
						function (response) {
							if(response) {
								var caseid;
								if (that.sidePanels['buildCase'].currentCase && that.sidePanels['buildCase'].currentCase.case_id) {
									caseid = that.sidePanels['buildCase'].currentCase.case_id;
								}
								window.open(baseUrl + 'graph.html?attributeid=' + response + (caseid ? '&case_id=' + caseid : ''), '_self');
							} else {
								that.table.mainDiv.css('display','inline');
								$dSpinner.css('display','none');
								alert('cluster for ' + attribute + ': ' + value + ' could not be found.');
								callback(false);
							}
						},
						function () {
							alert('error fetching cluster for ' + attribute + ': ' + value);
							callback(false);
						});
				},

				fetchAttribute: function(attribute, value) {
					var that = this;
					this.softClear();
					this.graphWidget.displayLoader();
					this.pagingPanel.hidePagingControls();
					this.graphWidget.fetchAttribute(baseUrl, attribute, value, function(graph) {
						that.graphWidget.ATTRIBUTE_MODE = true;
						that.graphWidget.createControlsCanvas();
						that.pagingPanel.setFullGraph(graph, null, null, "attribute");
						that.graphWidget.selectCluster(graph.nodes[0].id);
						that.displayDetailsSpinners();
						getAttributeDetails(baseUrl, attribute, value, function(response) {
							that.showClusterDetails(response, graph.nodes[0].label);
						});
					}, function() {
						alert('Error fetching graph');
						that.softClear();
					});
				},

				fetchAttributeId: function(attributeid,bExplorer) {
					var that = this;
					this.softClear();
					this.graphWidget.displayLoader();
					this.pagingPanel.hidePagingControls();
                    if (bExplorer) {
                        this.graphWidget.fromAttribute(attributeid);
						this.graphLabel.text('Explore attributes with coreferences');
                    } else {
                        this.graphWidget.fetchAttributeId(baseUrl, attributeid, function (graph) {
                            if (graph) {
                                var title = graph.nodes[0].label;
                                that.pagingPanel.setFullGraph(graph, null, null, "attribute");
                                that.displayDetailsSpinners();
                                that.visitedNodes.push(attributeid);
                                getAttributeIdDetails(baseUrl, attributeid, function (response) {
                                    that.showClusterDetails(response, title);
                                    that.nodeDetails[attributeid] = response;
                                });
                                that.graphWidget.markSelectedCluster(attributeid);
                                that.graphWidget.markVisitedNodes(that.visitedNodes);
                            } else {
                                alert('Error fetching graph');
                                that.softClear();
                            }
                        }, function () {
                            alert('Error fetching graph');
                            that.softClear();
                        });
                    }
				},

				fetchImageGraph: function(type, value) {
					var that = this;
					this.softClear();
					this.graphWidget.displayLoader();
					this.pagingPanel.hidePagingControls();
					if (bExplorer) {
                        this.graphWidget.fromImage(type, value);
					} else {
						this.graphWidget.fetchImageGraph(baseUrl, type, value, function(graph) {
							if ((!graph) || (!graph.nodes)) {
								alert('No results found');
								this.graphWidget.empty();
								return;
							}
							var title = graph.nodes[0].label;
							that.pagingPanel.setFullGraph(graph, null, null, 'org');
							that.displayDetailsSpinners();
							getPreclusterDetails(baseUrl, 'org', clusterid, function(response) {
								that.showClusterDetails(response, title);
								that.nodeDetails[clusterid] = response;
							});
							that.graphWidget.markSelectedCluster(clusterid);
						}, function() {
							alert('Error fetching graph');
							that.softClear();
						});
					}
				},

				fetchClassifiers : function() {
					var that = this;
					rest.get(baseUrl + "rest/classifiers/fetch", "Get classifiers + keywords",
						function(result) {
							for (var i = 0; i < result.classifiers.length; i++) {
								that.classifiers.push(result.classifiers[i].classifier);
							}
						}
					);
				},
				
				onAdvancedSearch: function() {
					var that = this;
					this.simpleSearchContainer.animate({top:'-50px', opacity:0}, TRANSITION_TIME, function() {
						that.graphHeader.animate({left:'300px'}, TRANSITION_TIME);
						that.graphCanvasContainer.animate({left:'300px'}, TRANSITION_TIME, function() {
							that.graphCanvasContainer.resize();
						});
						that.graphPropertiesCanvas.animate({width:'300px'}, TRANSITION_TIME);
						that.searchToggleButton.animate({left:(300+2)+'px'}, TRANSITION_TIME,function(){
							that.searchToggleButton.button({
								icons:{
									primary:'ui-icon-triangle-1-w'
								},
								label:'Show simple controls'
							});
						});
					});
					this.isAdvancedSearchMode = true;
				},

				createGraphCanvas: function() {
					var that = this,
						jqContainer = $(container),
						$logout = $('<div/>')
							.text('Logout')
							.button()
							.addClass('logoutButton')
							.css({
								position:'absolute',
								top:'1px',
								right:'-3.5px',
								height:'14px',
								padding: '.1em .5em'
							})
							.on('click',function(event) {
								window.location.href = 'logout';
							});

					this.graphHeader = $('<div/>')
						.css({
							height:WIDGET_TITLE_HEIGHT+'px',
							top:'0px',
							left:'0px',
							right:this.sidePanelWidth,
							position:'absolute',
							'border-left': BORDER_STYLE,
							'border-right': BORDER_STYLE
						}).addClass('moduleHeader');
					this.graphLabel = $('<div/>')
						.css({
							position:'absolute',
							left:'2px',
							top:'1px'
						});
					this.graphHeader.append(this.graphLabel).append($logout);
					jqContainer.append(this.graphHeader);

					this.graphCanvasContainer = $('<div/>')
						.css({
							'background':'url(\'img/graph.png\')',
							'background-position':'center',
							'background-repeat':'no-repeat',
							position:'absolute',
							top:WIDGET_TITLE_HEIGHT+'px',
							left:'0px',
							right:(this.sidePanelWidth+3)+'px',
							bottom:(this.detailsHeight+3)+'px',
							'border-left': BORDER_STYLE,
							overflow:'hidden'
						});
					jqContainer.append(this.graphCanvasContainer);

					if (bExplorer) {
						this.graphWidget = explorer.createWidget(this, baseUrl, that.selection);
                    } else {
						this.graphWidget = graph.createWidget(this, baseUrl, function(event, datasetName, clustersetName, preclusterType) {
							var clusterId = event.data.id;
							if (event.eventType === 'dblclick') {
								if (datasetName && clustersetName) {
									that.displayDetailsSpinners();
									getClusterDetails(baseUrl, datasetName, clustersetName, clusterId, function (response) {
										that.showClusterDetails(response, clustersetName);
									});
								} else if (preclusterType) {
									if (preclusterType == 'attribute') {
										that.fetchAttributeId(clusterId);
									} else {
										that.fetchClusterId(clusterId, preclusterType);
									}
								} else if (event.data.fields) {
									var html = '';
									for (var field in event.data.fields) {
										html += '<BR/><B>' + field + ':</B>' + ui_util.escapeHtml(event.data.fields[field]);
									}
									that.detailsCanvas.html(html);
								}
							} else if (event.eventType === 'click') {
								if(that.graphWidget.ATTRIBUTE_MODE) {
									that.onSelectAttributeNode(event.data.attribute,event.data.name);
								} else {
									that.onSelectCluster(preclusterType, clusterId, clustersetName);
								}
							}
						});
						this.graphLabel.text('Ads grouped by ' + (this.graphWidget.ATTRIBUTE_MODE?'Attribute':'Entity'));
					}
				},

				createSimpleSearchCanvas: function() {
					this.simpleSearchContainer = $('<div/>')
						.css({
						position:'absolute',
						top:WIDGET_TITLE_HEIGHT+'px',
						left:'26px',
						width:SIMPLE_SEARCH_WIDTH + 'px',
						height:SIMPLE_SEARCH_HEIGHT + 'px',
						border:'1px solid ' + colors.BORDER_DARK,
						overflow:'hidden',
						opacity:1,
						display: 'none' //TODO remove
					});
					$(container).append(this.simpleSearchContainer);

					this.simpleSearch = simplesearchpanel.createWidget(this.simpleSearchContainer, this, baseUrl);
				},

				createGraphPropertiesCanvas: function() {
					var jqContainer = $(container);

					this.graphPropertiesHeader = $('<div/>')
						.css({
							height:WIDGET_TITLE_HEIGHT+'px',
							width:'300px',
							top:'0px',
							left:'0px',
							position:'absolute'
						}).addClass('moduleHeader');
					this.graphPropertiesLabel = $('<div/>')
						.css({
							position:'absolute',
							left:'2px',
							top:'1px'
						}).text('Advanced Search');
					this.graphPropertiesHeader.append(this.graphPropertiesLabel);
					jqContainer.append(this.graphPropertiesHeader);

					this.graphPropertiesCanvas = $('<div/>')
						.css({
							top:WIDGET_TITLE_HEIGHT+'px',
							width:'0px',
							bottom:this.detailsHeight+'px',
							left:'0px',
							position:'absolute',
							'overflow-y':'auto'
						});
					jqContainer.append(this.graphPropertiesCanvas);

					this.searchPanel = searchpanel.createWidget(this.graphPropertiesCanvas, this, baseUrl);
				},

				displayLoader: function() {
					this.graphWidget.displayLoader();
				},

				showClusterDetails: function(response, title) {
					var objectData = [],
                        histogramData = {},
						that = this,
						i = 0, fields;

					if (!title && response.label) {
						title = response.label;
					}
					if (!title) title='';

					for (i; i<response.memberDetails.length; i++) {
						fields = response.memberDetails[i];
						fields.locationLabel = fields.location;
						objectData.push(fields);
					}

                    for (i=0; i<response.wordHistograms.length;i++) {
                        var histogram = response.wordHistograms[i];
                        var id = response.memberDetails[i].id;
                        histogramData[id] = histogram;
                    }

					//add node link click function
					this.graphWidget.selectLinksFn = function(event) {
						var i, j, detailsList, found1, found2,
							val1 = event.data.source.label,
							val2 = event.data.target.label,
							attributes = ['phone', 'email', 'websites'],
							result = [];

						for(i=0;i<objectData.length;i++) {
							found1 = found2 = false;
							for(j=0;j<attributes.length;j++) {
								detailsList = objectData[i][attributes[j]];
								if (!found1 && detailsList && detailsList.indexOf(val1) > -1) {
									found1 = true;
								}
								if (!found2 && detailsList && detailsList.indexOf(val2) > -1) {
									found2 = true;
								}
								if (found1 && found2) {
									result.push(objectData[i].id);
									break;
								}
							}
						}
						that.selection.set('graph', result);
					};

					for (var sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							this.sidePanels[sidePanelIter].canvas.css('background-image', '');
						}
					}

					this.detailsCanvas.css('background-image', '').empty();

					if (this.table) {
						this.table.destroyTable();
					}
					this.table = table.createWidget(baseUrl, this, this.detailsCanvas, this.classifiers, objectData, title, this.selection);
					this.table.searchFn = function(attribute, value, callback) {
						if (attribute=='images') {
							that.fetchImageGraph('id', value);
						} else {
							that.redirect(attribute, value, callback);
						}
					};

					if (!this.sidePanels['buildCase'].widget) {
						var caseId = decodeURIComponent(ui_util.getParameter('case_id'));
						this.sidePanels['buildCase'].widget = buildCase.createWidget(this.sidePanels['buildCase'].canvas, baseUrl, bExplorer);
						if(caseId && caseId!=undefined && caseId!=null && caseId!='null') {
							this.sidePanels['buildCase'].widget.loadCaseContentsURL(caseId);
						}
					}
					this.sidePanels['buildCase'].widget.resize(this.sidePanelWidth, this.sidePanels['buildCase'].canvas.height());

					this.sidePanels['movement'].canvas.empty();
					if (this.sidePanels['movement'].widget) {
						this.sidePanels['movement'].widget.destroy();
					}
					this.sidePanels['movement'].widget = new timeline.createWidget(this.sidePanels['movement'].canvas.get(0), objectData, this.selection);
					this.sidePanels['movement'].widget.resize(this.sidePanelWidth, this.sidePanels['movement'].height);

					this.sidePanels['map'].canvas.empty();
					this.sidePanels['map'].widget = new map.createWidget(baseUrl, this.sidePanels['map'].canvas.get(0), objectData, this.selection);
					this.sidePanels['map'].widget.resize(this.sidePanelWidth, this.sidePanels['map'].height);

					this.sidePanels['wordcloud'].canvas.empty();
					if (this.sidePanels['wordcloud'].widget) {
						this.sidePanels['wordcloud'].widget.destroy();
					}
					this.sidePanels['wordcloud'].widget = new wordcloud.createWidget(baseUrl, this.sidePanels['wordcloud'].canvas, histogramData, this.selection);
					this.sidePanels['wordcloud'].widget.resize(this.sidePanelWidth, this.sidePanels['wordcloud'].canvas.height());

					this.sidePanels['attributes'].canvas.empty();
					if (this.sidePanels['attributes'].widget) {
						this.sidePanels['attributes'].widget.destroy();
					}
					this.sidePanels['attributes'].widget = new attr_chart.createWidget(this.sidePanels['attributes'].canvas, objectData);
					this.sidePanels['attributes'].widget.resize(this.sidePanelWidth, this.sidePanels['attributes'].canvas.height());

					this.sidePanels['images'].canvas.empty();
					if (this.sidePanels['images'].widget) {
						this.sidePanels['images'].widget.destroy();
					}
					this.sidePanels['images'].widget = new images.createWidget(baseUrl, this.sidePanels['images'].canvas, objectData, this.selection);
					this.sidePanels['images'].widget.resize(this.sidePanelWidth, this.sidePanels['images'].canvas.height());
					this.sidePanels['images'].widget.searchFn = function(value) {
						that.fetchImageGraph('bin', value);
					};

                    if (!this.sidePanels['nodeSummary'].widget) {
                        this.sidePanels['nodeSummary'].widget = new nodeSummary.createWidget(this,this.sidePanels['nodeSummary'].canvas,baseUrl);
                    }

                    that.graphWidget.getSelectedSummary(function(summary) {
						summary.attributeOrder = ['Email Addresses', 'Phone Numbers', 'Websites'];
                        that.sidePanels['nodeSummary'].widget.set(summary);
                    });

					this.selection.setAttributeMapping(objectData);
					this.selection.listen('table', function(selectedIds) { that.table.selectionChanged(selectedIds); });
					this.selection.listen('timeline', function(selectedIds) { that.sidePanels['movement'].widget.selectionChanged(selectedIds); });
					this.selection.listen('map', function(selectedIds) { that.sidePanels['map'].widget.selectionChange(selectedIds); });
					this.selection.listen('images', function(selectedIds) { that.sidePanels['images'].widget.selectionChanged(selectedIds); });
                    this.selection.listen('Word Cloud', function(selectedIds) { that.sidePanels['wordcloud'].widget.selectionChanged(selectedIds); });
				},

				panelResize: function() {
					var totalHeight = 0,
						overflow,
						delta,
						sidePanelIter, panel;

					for (sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							panel = this.sidePanels[sidePanelIter];
							totalHeight += panel.height;
						}
					}
					for (sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							panel = this.sidePanels[sidePanelIter];
							if (totalHeight>this.height && panel.height>WIDGET_TITLE_HEIGHT) {
								overflow = totalHeight-this.height;
								delta = Math.min(overflow,panel.height-WIDGET_TITLE_HEIGHT);
								panel.height -= delta;
								totalHeight -= delta;
							}
						}
					}
					for (sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							panel = this.sidePanels[sidePanelIter];
							if (totalHeight<this.height && !panel.collapsed) {
								panel.height += this.height-totalHeight;
								totalHeight = this.height;
							}
						}
					}

					var curY = 0;
					for (sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							panel = this.sidePanels[sidePanelIter];
							panel.header.css({width:this.sidePanelWidth + 'px', top:curY + 'px'});
							curY += WIDGET_TITLE_HEIGHT;
							panel.canvas.css({width:this.sidePanelWidth + 'px', top:curY + 'px',height:(panel.height-WIDGET_TITLE_HEIGHT) + 'px'});
							curY += panel.height-WIDGET_TITLE_HEIGHT;
							if (panel.widget) {
								panel.widget.resize(this.sidePanelWidth, panel.canvas.height());
							}
						}
					}

					this.detailsCanvas.css({right:this.sidePanelWidth+'px',height:this.detailsHeight+'px'});
					this.resizeBar.css({right:this.sidePanelWidth+'px'});
					this.detailResizeBar.css({bottom:this.detailsHeight+'px',right:this.sidePanelWidth+'px'});
					if(this.table) this.table.updateSelectedOverlay();

					this.graphHeader.css({right:this.sidePanelWidth});
					this.graphCanvasContainer.css({right:(this.sidePanelWidth+3)+'px',bottom:(this.detailsHeight+3)+'px'});
					if (this.graphWidget) this.graphWidget.resize(this.width-this.sidePanelWidth, this.graphCanvasContainer.height());
					if (this.graphPropertiesCanvas) this.graphPropertiesCanvas.css({bottom:this.detailsHeight+'px'});

					this.amplifyUpdate();
				},

				amplifyUpdate: function() {
					for (var sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							var panel = this.sidePanels[sidePanelIter],
								amplifyStore = {
									height: panel.height,
									uncollapse: panel.uncollapse,
									collapsed: panel.collapsed
								};

							amplify.store(sidePanelIter, amplifyStore);
						}
					}
				},

				resize: function(w,h) {
					this.width = w;
					this.height = h;
					this.panelResize();
					if (this.graphWidget) {
						this.graphWidget.resize(w,h);
					}
				},

				displayDetailsSpinners: function() {
					for (sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							var panel = this.sidePanels[sidePanelIter];
							if (panel.hasDetails) {
								panel.canvas.empty();
								panel.canvas.css({'background' : 'url("./img/ajaxLoader.gif") no-repeat center center'});
							}
						}
					}
					this.detailsCanvas.empty();
					this.detailsCanvas.css({'background' : 'url("./img/ajaxLoader.gif") no-repeat center center'});
				},

				softClear : function() {
					for (sidePanelIter in this.sidePanels) {
						if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
							var panel = this.sidePanels[sidePanelIter];
							panel.canvas.empty();
							panel.canvas.css('background-image', '');
						}
					}
					this.graphWidget.empty();
					this.detailsCanvas.empty();

					this.graphCanvasContainer.css('background-image', '');
					this.detailsCanvas.css('background-image', '');

					//this.movementPanel.canvas.append(this.movementPanel.description);

					this.selection.clear();
				}
			};
			linkWidgetObj.init();
			return linkWidgetObj;
	};
	
	return {
		createWidget:createWidget
	}
});