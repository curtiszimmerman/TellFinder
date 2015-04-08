
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

define([ '../util/ui_util', './radial_layout', './column_layout', '../util/rest', './controlsPanel', '../util/colors'],
    function( ui_util, radial_layout, column_layout, rest, controlsPanel, colors) {

    var ENABLE_ZOOM_PAN = aperture.config.get()['xdataht.config']['enable-zoom-pan'],
		MAX_GRAPH_NODES = aperture.config.get()['xdataht.config']['max-graph-nodes'],
		GRAPH_CONTROLS_CONTAINER_WIDTH = 150;

    var displayAjaxLoader = function(container) {
        var loaderDiv = $('<div/>');
        container.empty();
        loaderDiv.css({
            'background' : 'url("./img/ajaxLoader.gif") no-repeat center center',
            'height' : '100%',
            'width' : '100%'
        });
        container.append(loaderDiv);
    };

    var getMousePos = function(e) {
        var clientX = e.clientX;
        var clientY = e.clientY;
        if (clientX==undefined) {
        	if (e.originalEvent) {
        		clientX = e.originalEvent.clientX;
        		clientY = e.originalEvent.clientY;
        	} else if (e.source) {
				clientX = e.source.clientX;
				clientY = e.source.clientY;
        	}
        }
        return {x:clientX,y:clientY};
    };
    
    var createWidget = function(appwidget, baseUrl, nodeClickCallback) {

    	var container = appwidget.graphCanvasContainer,
			graphWidgetObj = {
    			graphCanvas: null,
    			graphCanvasPadding: {top:0,bottom:0,left:0,right:0},
    			graphCanvasOffset: {x:0,y:0},
    			graphZoom: 0,
    			graphPan: {x:0,y:0},
    			bDisplayingGraph: false,
    			preclusterType:null,
    			datasetName:null,
    			clustersetName:null,
    			plot: null,
				controlsPanelContainer: null,
				controlsPanel: null,
    			previousGraphData: null,
    			ATTRIBUTE_MODE: window.location.href.indexOf('?attributeid=')!=-1,
				isRadialLayout: amplify.store('graphLayout'),
				rLayer:null,
				linkLayer:null,
				nodeLayer:null,

			init: function() {
				if (this.isRadialLayout === undefined) this.isRadialLayout = false;
				this.createGraphCanvas();
				this.createControlsCanvas();
			},

			createControlsCanvas: function(){
                var jqContainer = $(container),
					controlsPanelContainerHeight = 79;
				if (this.controlsPanelContainer) {
					this.controlsPanelContainer.empty();
					this.controlsPanel = null;
				}
                this.controlsPanelContainer = $('<div/>');
                this.controlsPanelContainer.css({
                    position:'absolute',
                    top:'2px',
                    right:'-1px',
                    width:GRAPH_CONTROLS_CONTAINER_WIDTH + 'px',
                    height:controlsPanelContainerHeight + 'px',
                    overflow:'hidden',
                    opacity:1
                });
                jqContainer.append(this.controlsPanelContainer);

                this.controlsPanel = controlsPanel.createWidget(this, controlsPanelContainerHeight);
            },

            createGraphCanvas: function() {
                this.graphCanvas = $('<div/>', {id: 'NodeLink' + ui_util.uuid()});
                this.graphCanvas.css({
                    'position':'relative',
                    'top':'0px',
                    'left':'0px'
                });
				this.graphCanvas.width(container.width());
				this.graphCanvas.height(container.height());
                container.append(this.graphCanvas);
            },

            update: function() {
                if (this.plot) {
                    this.sizeChanged();
                    return;
                }
                this.createPlot();
            },

            getSelectedSummary : function(callback) {
                var selectedId = this.selectedNodes.get(0);
                var summary = {};
                var details = null;
                this.linkData.nodes.forEach(function(nodeDetails) {
                    if (nodeDetails.id === selectedId) {
                        details = nodeDetails;
                    }
                });
                if (details) {

                    summary = {
                        id: details.id,
                        name: details.name,
                        label: details.label,
                        latestAd: details.latestad,
                        size: details['Cluster Size'],
                        attributes: {}
                    };

                    Object.keys(details.attributes).forEach(function (attributeName) {
                        if (attributeName === 'Link Reasons') {
                            return;
                        }
                        var attributeSummaryString = details.attributes[attributeName];
                        if (!attributeSummaryString || attributeSummaryString === '') {
                            return;
                        }
                        var attributeSummaryRows = attributeSummaryString.split('\n');

                        var remaining = 3;
                        for (var i = 0; i < attributeSummaryRows.length && remaining > 0; i++, remaining--) {
                            var row = attributeSummaryRows[i];
                            var pieces = row.split('\t');
                            var count = pieces[0];
                            var value = pieces[1];
                            var name = '';
                            if (attributeName === 'Email Addresses') {
                                name = 'email'
                            } else if (attributeName === 'Phone Numbers') {
                                name = 'phone'
                            } else if (attributeName === 'Websites') {
                                name = 'website';
                            }
                            if (!summary.attributes[attributeName]) {
                                summary.attributes[attributeName] = [];
                            }
                            summary.attributes[attributeName].push({
                                name : name,
                                value : value,
                                count : count
                            });
                        }
                    });

                    callback(summary);
                }
            },

			selectCluster: function(nodeId) {
				var updated = this.selectedNodes.clear();
				updated.push(this.selectedNodes.add(nodeId));
				this.nodeLayer.all().where('id', updated).and(this.linkLayer.all()).redraw().toFront('labeled');
			},

			selectLinkedAds: function (event) {
				if(this.selectLinksFn) this.selectLinksFn(event);
			},
			
			buildRings: function() {
				if (!this.rLayer) return;
				if(this.isRadialLayout) {
					this.rLayer.all([
						{color: colors.GRAPH_RING_4, radius: 2.5},
						{color: colors.GRAPH_RING_3, radius: 0.4375},
						{color: colors.GRAPH_RING_2, radius: 0.3125},
						{color: colors.GRAPH_RING_1, radius: 0.1875}
					]);
				} else {
					this.rLayer.all([
						{color: colors.GRAPH_RING_4, radius: 2.5}
					]);
				}
			},
			
            createPlot: function() {
				var startMousePos = null,
					startPan = null;
                this.plot = new aperture.NodeLink(this.graphCanvas.get(0).id);

				//setup radial Layer
				this.rLayer = this.plot.addLayer(aperture.RadialLayer);
				this.rLayer.map('fill').from('color');
				this.rLayer.map('x').from(function () {
					var scale = Math.pow(1.5, that.graphZoom);
					var viewportWidth = container.width();
					var w = viewportWidth * scale;
					var viewX = w * 0.5;
					var windowX = viewX + that.graphCanvasPadding.left + that.graphCanvasOffset.x;
					return windowX / (w + that.graphCanvasPadding.left + that.graphCanvasPadding.right);
				});
				this.rLayer.map('y').from(function () {
					var scale = Math.pow(1.5, that.graphZoom);
					var viewportHeight = container.height();
					var h = viewportHeight * scale;
					var viewY = h * 0.5;
					var windowY = viewY + that.graphCanvasPadding.top + that.graphCanvasOffset.y;
					return windowY / (h + that.graphCanvasPadding.top + that.graphCanvasPadding.bottom);
				});
				this.rLayer.map('radius').from(function (data) {
					return Math.min(that.graphCanvas.width() - that.graphCanvasPadding.left - that.graphCanvasPadding.right,
							that.graphCanvas.height() - that.graphCanvasPadding.top - that.graphCanvasPadding.bottom) * this.radius;
				});
				this.buildRings();

                // add a node layer
                this.nodeLayer = this.plot.addLayer(aperture.NodeLayer);
                this.nodeLayer.all(this.linkData.nodes, 'id');

                // size of node is based on overall connectedness.
                var nodeSize = this.nodeLayer.map('radius').from('radius');

                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // SET UP A FEW HIGHLIGHT THINGS
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                var focusNodes = new aperture.Set('id'),
					selectedLinks = new aperture.Set('id');
                this.selectedNodes = new aperture.Set('id');
                this.visitedNodes = new aperture.Set('id');
                var highlightedNodes = new aperture.Set('id');
                var highlightedLinks = new aperture.Set('id');

                // the graph will be sorted into three planes based on highlight state.
                this.nodeLayer.map('plane').from(function() {
                        return (this.tag&&this.tag.visible)? 'labeled' : 'normal';
                    })
                    .filter(highlightedNodes.constant('highlight'))
                    .filter(this.visitedNodes.constant('visited'))
                    .filter(this.selectedNodes.constant('selected'))
                    .filter(focusNodes.constant('focus'));


                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // CREATE THE LINK REPRESENTATION.
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                this.linkLayer = this.plot.addLayer( aperture.LinkLayer );
                this.linkLayer.all(this.linkData.links, 'id');
                this.linkLayer.map('source').from('source');
                this.linkLayer.map('target').from('target');
                this.linkLayer.map('opacity').asValue(0.5).filter(highlightedLinks.constant(1)).filter(selectedLinks.constant(1));

				var maxLinks = Math.max.apply(Math,this.linkData.links.map(function(link){return link.weight;}));
				if(maxLinks <= 0)
					maxLinks = 1;
                this.linkLayer.map('stroke-width').from(function() {
					if(that.ATTRIBUTE_MODE){
						return (this.weight/maxLinks)*10+1;
					} else {
						return 2;
					}
                });
                this.linkLayer.map('link-style').asValue('arc');

                // The color key for node connectedness, which is applied to links too.
                var highlightColor = new aperture.Color(colors.CIRCLE_HOVER),
					selectColor = new aperture.Color(colors.CIRCLE_SELECTED),
					visitedColor = new aperture.Color(colors.CIRCLE_VISITED),
					linkSelectColor = new aperture.Color(colors.LINK_SELECTED);

                // these mappings will be assigned a source later
                this.nodeLayer.map('fill').asValue('#000')
                    .filter(highlightedNodes.filter(function(color) {
                        return highlightColor;
                    }))
					.filter(this.visitedNodes.filter(function(color) {
						return visitedColor;
					}))
                    .filter(this.selectedNodes.filter(function(color) {
                        return selectColor;
                    }));
                this.linkLayer.map('stroke').from(function() {
					if (that.ATTRIBUTE_MODE) {
						return colors.LINK_DEFAULT;
					} else if (this.type=='phone') {
                        return colors.LINK_PHONE;
                    } else if (this.type=='email') {
                        return colors.LINK_EMAIL;
                    } else if (this.type=='website') {
                        return colors.LINK_WEBSITE;
                    } else if (this.type=='image') {
                        return colors.LINK_IMAGE;
                    }
                    return colors.LINK_DEFAULT;
                }).filter(highlightedLinks.constant(highlightColor))
					.filter(selectedLinks.constant(linkSelectColor));

                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // CREATE THE NODE REPRESENTATION.
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                var dotLayer = this.nodeLayer.addLayer( aperture.RadialLayer );
                dotLayer.map('fill').asValue(colors.CIRCLE_TOTAL);
                dotLayer.map('stroke').from(function() {
                    return (this.tag&&this.tag.visible)? colors.GRAPH_DOT_STROKE: 'none';
                });
                dotLayer.map('stroke-width').asValue(1.5);

                // the same offset is used for links and labels, derived from the radius mapping
                function nodeOffset() {
                    return 2+ nodeSize.valueFor(this);
                }

                // link offsets from the radius of each node.
                this.linkLayer.map('source-offset').from(nodeOffset);
                this.linkLayer.map('target-offset').from(nodeOffset);

                var toTa = {left: 'start', middle: 'middle', right: 'end'};

                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // ADD NODE LABELS.
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                var labelLayer = this.nodeLayer.addLayer(aperture.LabelLayer);
				labelLayer.map('text').from(function(){
					return ui_util.trunc(this.name,40);
				});
                labelLayer.map('visible').from('tag.visible');
                labelLayer.map('text-anchor').from(function() {
                    return toTa[this.tag.anchorX];
                });
                labelLayer.map('text-anchor-y').from('tag.anchorY');
                labelLayer.map('font-family').asValue('Arial');
                labelLayer.map('connect').from('tag.connect');
                labelLayer.map('connect-x').from('tag.connectX');
                labelLayer.map('connect-y').from('tag.connectY');
                labelLayer.map('font-size').asValue(14);
                labelLayer.map('font-weight').asValue('bold');
                labelLayer.map('offset-x').from('tag.offsetX');
                labelLayer.map('offset-y').from('tag.offsetY');
                labelLayer.map('fill').asValue('#000').filter(this.visitedNodes.filter(function(color) { return visitedColor;
                })).filter(this.selectedNodes.filter(function(color) { return selectColor;
                })).filter(highlightedNodes.filter(function(color) { return highlightColor; }));

                var that = this;
                var nodeClick = function(event) {
					that.selectCluster(event.data.id);
                    nodeClickCallback(event, that.datasetName, that.clustersetName?that.clustersetName:event.data.name, that.preclusterType);
                };

                var nodeOver = function(event) {
					//make the node draggable and attach the data
					var node = document.elementFromPoint(event.source.clientX, event.source.clientY),
						buildCasePanel = appwidget.sidePanels['buildCase'].canvas,
						$dropHere = $('<div/>').css({
							position: 'absolute',
							top: '0px',
							border: '3px dashed gray',
							width: 'calc(100% - 6px)',
							height: 'calc(100% - 6px)',
							'text-align': 'center',
							'overflow':'hidden'
						}).append($('<span>Drop Here</span>').css({
							position: 'relative',
							top: (buildCasePanel.height()/2)+'px',
							'font-size': '24px',
							color: colors.CASE_DROP_HERE,
							'font-weight': 'bold'
						}));
					$(node).css('cursor','pointer');
					event.data.ATTRIBUTE_MODE = that.ATTRIBUTE_MODE;
					$(node).draggable({
						cursor: 'no-drop',
						start: function (event) {
							buildCasePanel.append($dropHere);
						},
						stop: function (event) {
							$dropHere.remove();
						}
					}).data('data', event.data);

                    if (that.noHover_ || !focusNodes.add(event.data.id)) {
                        return;
                    }

                    var changed = [highlightedNodes.add(event.data.id)];

                    // Add the appropriate target nodes to the selection set.
                    aperture.util.forEach(event.data.links, function(link) {
                        var add = highlightedNodes.add(link.other);
                        changed.push(add);
                        highlightedLinks.add(link.id);
                    },this);

                    // update graphics then pop the nodes of interest to front.
                    that.nodeLayer.all().where('id', changed).and(that.linkLayer.all()).redraw().toFront(['labeled', 'highlight', 'focus', 'selected']);
                    var html = '<B>ID: </B>' + ui_util.trunc(event.data.id.trim()) + '<BR/>' +
                        '<B>Name: </B>' + ui_util.trunc(event.data.name.trim()) + '<BR/>' +
                        '<B>Label: </B>' + ui_util.trunc(event.data.label.trim());
                    if (event.data['Cluster Size']) {
                        html += '<BR/><B>Cluster Size: </B>'+event.data['Cluster Size'] +'<BR/>';
                    }
					if (event.data.latestad) {
						html += '<B>Latest Ad: </B>'+event.data.latestad +'<BR/>';
					}

                    if (event.data.attributes) {
						//we want the attributes to appear in this order
						var attributeNames = [ 'Email Addresses', 'Phone Numbers', 'Websites', 'Link Reasons', 'Common Ads'];
						for (var j = 0; j<attributeNames.length; j++) {
							var attributeName = attributeNames[j];
							if(event.data.attributes[attributeName]) {
								var attribute = attributeName,
									val = event.data.attributes[attribute],
									vals = val.split('\n');
								if (vals.length > 0) {
									html += '<B>' + attribute.trim() + ':</B>';
									for (var i = 0; i < vals.length && i < 5; i++) {
										var strs = ui_util.trunc(vals[i]).split('\t');
										if (strs.length === 2) {
											html += '<div style="overflow:hidden;position:relative;width:100%;height:15px;">' +
												'<div style="text-align: right;float:left;padding-right:3px;width:30px;">' +
												((strs[0] === "") ? ' </div>' : ('<b>' + strs[0]+ '</b>:</div>')) +
												'<div style="text-align: left; width:calc(100% - 35px);float:left;white-space:nowrap;">' +
												strs[1] + '</div></div>';
										} else if (vals[i].length>0) {
											html += '<div style="overflow:hidden;position:relative;width:100%;height:15px;">' + vals[i] + '</div>';
										}
									}
								}
							}
                        }
                    }
                    aperture.tooltip.showTooltip({event:event, html:html});
                };

                var nodeOut = function(event) {
                    if (focusNodes.clear()) {
                        // clear everything.
                        highlightedLinks.clear();
                        var updated = highlightedNodes.clear();
                        that.nodeLayer.all().where('id', updated).and(that.linkLayer.all()).redraw().toFront('labeled');
                    }
                    aperture.tooltip.hideTooltip();
                };

				var panMouseDown = function(e) {
					that.mouseDown = true;
					startMousePos = getMousePos(e);
					startPan = {x:that.graphPan.x, y:that.graphPan.y};
					that.noHover_ = true;
				};

				var panMouseUp = function(e) {
					that.mouseDown = false;
					startMousePos = null;
					startPan = null;
					that.noHover_ = false;
					that.sizeChanged();
				};

				var panMouseMove = function(e) {
					if (that.mouseDown && that.bDisplayingGraph) {
						var mousePos = getMousePos(e);
						var deltaX = mousePos.x - startMousePos.x;
						var deltaY = mousePos.y - startMousePos.y;

						that.graphPan.x = startPan.x + deltaX;
						that.graphPan.y = startPan.y + deltaY;

						that.updatePan();
					} else {
						that.mouseDown = false;
					}
				};

                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // WHEN HOVERING OVER A NODE HIGHLIGHT JUST IT AND ITS CONNECTED NODES.
                // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                dotLayer.on('mouseover', nodeOver);
                dotLayer.on('mouseout', nodeOut);
                dotLayer.on('dblclick', nodeClick);
				dotLayer.on('click', nodeClick);
                labelLayer.on('mouseover', nodeOver);
                labelLayer.on('mouseout', nodeOut);

				//setup Panning
				this.rLayer.on('mousedown', panMouseDown);
				this.rLayer.on('mouseup', panMouseUp);
				this.rLayer.on('drag', panMouseMove);
				if(that.ATTRIBUTE_MODE) {
					this.linkLayer.on('mousedown', function(e) {that.selectLinkedAds(e)});
					this.linkLayer.on('mousemove', function(e){
						var html;
						html = 'Common Ads: ' + e.data.weight;
						$(document.elementFromPoint(e.source.clientX, e.source.clientY)).css('cursor','pointer');
						aperture.tooltip.showTooltip({event:e, html:html});
					});
					this.linkLayer.on('mouseout', function(e){
						aperture.tooltip.hideTooltip();
						$(document.elementFromPoint(e.source.clientX, e.source.clientY)).css('cursor','default');
					});

				} else {
					this.linkLayer.on('mousedown', panMouseDown);
					this.linkLayer.on('mouseup', panMouseUp);
					this.linkLayer.on('drag', panMouseMove);
				}

                //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // SET UP ZOOM AND PAN
                //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                // zoom with scroll wheel.
                if ( ENABLE_ZOOM_PAN ) {
                	this.setupZoom();
                }

                // track button state so hovers are deactivated when dragging.
                $(this.contentsId_).mousedown(function(e) {
                    that.noHover_ = true;
                    dotLayer.trigger('mouseout');
                });
                $('body').mouseup(function(e) {
                    that.noHover_ = false;
                });

                this.nodeLayer.all().toFront('labeled');

                this.sizeChanged();
			},
			
			setupZoom: function() {
				var that = this;
                container.unbind('DOMMouseScroll mousewheel').bind('DOMMouseScroll mousewheel', function(e) {
                    if (!that.bDisplayingGraph) {
                        return;
                    }

                	var delta = e.originalEvent.wheelDelta || -e.originalEvent.detail;
                	var zoomIn = delta > 0;
                    var oldscale = Math.pow(1.5, that.graphZoom);
                    if (zoomIn) {
                        that.graphZoom++;
                    } else if (that.graphZoom>0){
                        that.graphZoom--;
                    }

                    var newscale = Math.pow(1.5, that.graphZoom);
                    var scaleFactor = newscale/oldscale;
                    var canvasOffset = that.graphCanvas.offset();

                    var mousePos = getMousePos(e);
                    var mouseGraphX = mousePos.x - canvasOffset.left - that.graphCanvasPadding.left - that.graphCanvasOffset.x;
                    var mouseGraphY = mousePos.y - canvasOffset.top - that.graphCanvasPadding.top - that.graphCanvasOffset.y;

                    var mouseGraphXNew = mouseGraphX*scaleFactor;
                    var mouseGraphYNew = mouseGraphY*scaleFactor;
                    that.graphPan.x = that.graphPan.x + mouseGraphX - mouseGraphXNew;
                    that.graphPan.y = that.graphPan.y + mouseGraphY - mouseGraphYNew;

                    that.layout('organic');
                    that.updatePan();
                    that.sizeChanged();

                    e.preventDefault();
                });
			},
			
            updateZoom: function() {
                var viewportWidth = container.width();
                var viewportHeight = container.height();

                var scale = Math.pow(1.5, this.graphZoom);
                var w = viewportWidth * scale;
                var h = viewportHeight * scale;

                this.graphCanvas.width(w + this.graphCanvasPadding.left + this.graphCanvasPadding.right);
                this.graphCanvas.height(h + this.graphCanvasPadding.top + this.graphCanvasPadding.bottom);
            },
            
            updatePan: function() {
                var newTop = this.graphPan.y - this.graphCanvasOffset.y - this.graphCanvasPadding.top;
                var newLeft = this.graphPan.x - this.graphCanvasOffset.x - this.graphCanvasPadding.left;
                this.graphCanvas.css({
                    'top':newTop + 'px',
                    'left':newLeft + 'px'
                });
            },
            
			sizeChanged: function() {
				if (this.width) {
                    var viewportWidth = container.width();
                    var viewportHeight = container.height();
                    var scale = Math.pow(1.5, this.graphZoom);
                    var w = viewportWidth * scale;
                    var h = viewportHeight * scale;
                    this.graphCanvasPadding.left = viewportWidth;
                    this.graphCanvasPadding.right = viewportWidth;
                    this.graphCanvasPadding.top = viewportHeight;
                    this.graphCanvasPadding.bottom = viewportHeight;
                    this.graphCanvasOffset.x = this.graphPan.x;
                    this.graphCanvasOffset.y = this.graphPan.y;
                    this.updatePan();
                    this.updateZoom();

					this.plot.map('node-x').from('x').using(new aperture.Scalar('w', [-this.graphCanvasPadding.left-this.graphCanvasOffset.x,w+this.graphCanvasPadding.right-this.graphCanvasOffset.x]).mapKey([0,w+this.graphCanvasPadding.left+this.graphCanvasPadding.right]));
				    this.plot.map('node-y').from('y').using(new aperture.Scalar('h', [-this.graphCanvasPadding.top-this.graphCanvasOffset.y,h+this.graphCanvasPadding.bottom-this.graphCanvasOffset.y]).mapKey([0,h+this.graphCanvasPadding.top+this.graphCanvasPadding.bottom]));
					this.plot.map('width').asValue(w);
					this.plot.map('height').asValue(h);
					this.plot.all().redraw();
					this.linkLayer.toFront();
					this.nodeLayer.toFront();
				}
			},
			
			layout: function(type) {
				var graphData = this.linkData;
				if (!graphData) return;

                var viewportWidth = container.width();
                var viewportHeight = container.height();

                var scale = Math.pow(1.5, this.graphZoom);
                var w = viewportWidth * scale;
                var h = viewportHeight * scale;

                this.buildRings();
				if(this.isRadialLayout) {
					radial_layout.layout(this, w, h);
				} else {
					column_layout.layout(this, w, h, GRAPH_CONTROLS_CONTAINER_WIDTH);
				}
			},
			
            getGraph: function(baseURL, datasetName, linkCriteria, filters, clustersetName, existingClusterIds, onlyLinked, callback, errcallback) {
                this.attributeBased = false;
                var graphRequest = {
                    datasetName : datasetName,
                    clustersetName : clustersetName,
                    onlyLinkedNodes : onlyLinked
                };
                if (linkCriteria && linkCriteria.length > 0) {
                    graphRequest.linkCriteria = linkCriteria
                }
                if (filters && filters.length > 0) {
                    graphRequest.filters = filters;
                }
                if (existingClusterIds && existingClusterIds.length > 0) {
                    graphRequest.existingClusters = existingClusterIds;
                }
                rest.post(baseURL + "rest/graph/link", graphRequest, "Compute graph and connectivity", callback, false, errcallback);
            },

            simpleGraph: function(baseURL, searchString, clusterType, callback, errcallback) {
                this.attributeBased = false;
                var graphRequest = {
                    searchString : searchString,
                    clusterType : clusterType,
                    ringCount: 3
                };
                rest.post(baseURL + "rest/graph/simple", graphRequest, "Compute graph and connectivity", callback, false, errcallback);
            },

            advancedGraph : function(baseURL, params, clusterType, callback, errorcallback) {
                this.attributeBased = false;
                var graphRequest = {
                    params : params,
                    clusterType : clusterType,
                    ringCount: 3
                };
                rest.post(baseURL + "rest/graph/advancedgraph", graphRequest, "Compute graph and connectivity", callback, false, errcallback);
            },

            fetchClusterId: function(baseURL, clusterid, clusterType, callback, errcallback) {
                this.attributeBased = false;
                var graphRequest = {
                        searchString : clusterid,
                        clusterType : clusterType,
                        ringCount: 3
                    };
                rest.post(baseURL + "rest/graph/cluster", graphRequest, "Compute graph and connectivity", callback, false, errcallback);
            },

            fetchAttribute: function(baseURL, attribute, value, callback, errcallback) {
                this.attributeBased = true;
                value = encodeURIComponent(value);
                rest.post(baseURL + "rest/graph/attribute/" + attribute + "/" + value, null, "Compute graph and connectivity", callback, false, errcallback);
            },

            fetchAttributeId: function(baseURL, attributeid, callback, errcallback) {
                this.attributeBased = true;
                rest.post(baseURL + "rest/graph/attributeid/" + attributeid, null, "Compute graph and connectivity", callback, false, errcallback);
            },

            fetchImageGraph: function(baseURL, type, value, callback, errcallback) {
                this.attributeBased = false;
                var graphRequest = {
                        searchString : value,
                        clusterType : type,
                        ringCount: 3
                    };
                rest.post(baseURL + "rest/graph/image", graphRequest, "Compute image graph and connectivity", callback, false, errcallback);
            },

            markSelectedCluster: function(clusterid) {
                var updated = this.selectedNodes.clear();
                updated.push(this.selectedNodes.add(clusterid));
                this.nodeLayer.all().where('id', updated).and(this.linkLayer.all()).redraw().toFront('labeled');
            },

            markVisitedNodes: function(visitedNodes) {
                for (var i=0; i<visitedNodes.length; i++) {
                    var visitedNode = visitedNodes[i];
                    this.visitedNodes.add(visitedNode);
                }
                this.nodeLayer.all().where('id', visitedNodes).and(this.linkLayer.all()).redraw().toFront('labeled');
            },

            displayGraph: function(graphIn, datasetName, clustersetName, preclusterType) {
                var i, j, k;

                var bCleanupData = true;

                if (preclusterType) {
                    this.preclusterType = preclusterType;
                    this.datasetName = null;
                    this.clustersetName = null;
                } else {
                    this.preclusterType = null;
                    this.datasetName = datasetName;
                    this.clustersetName = clustersetName;
                }

                this.graphCanvas.empty();
                this.bDisplayingGraph = true;

                if (!graphIn) graphIn = {nodes:[],links:[]};
                if (!graphIn.nodes) graphIn.nodes = [];
                if (!graphIn.links) graphIn.links = [];

                var graph = graphIn;
                var tooManyNodesMsg = 'Your search returned too many nodes.';
                if (graph.nodes.length==0) {
                    alert('Your search returned no results.');
                } else if (graph.nodes.length > MAX_GRAPH_NODES) {
                    if (this.previousGraphData) {
                        alert(tooManyNodesMsg + '  Please refine your search by adding link attributes or click the "Only Linked Nodes" checkbox.  Reverting to previous graph.');
                        graph = this.previousGraphData;
                        bCleanupData = false;
                    } else {
                        alert(tooManyNodesMsg + '  Please refine your search by adding search criteria.');
                        graph.nodes = [];
                        graph.links = [];
                    }
                }

                if (bCleanupData) {
                    // Do some data formatting and cleanup on the nodes
                    for (i = 0; i < graph.nodes.length; i++) {
                        var attributes = {};
                        if (graph.nodes[i].attributes && graph.nodes[i].attributes.map && graph.nodes[i].attributes.map.entry) {
                            for (j = 0; j < graph.nodes[i].attributes.map.entry.length; j++) {
                                var attr = graph.nodes[i].attributes.map.entry[j];
                                attributes[attr.key] = attr.value;
                            }
                        }
                        graph.nodes[i].attributes = attributes;
                        graph.nodes[i].ring = parseInt(graph.nodes[i].ring);
                        graph.nodes[i].size = parseFloat(graph.nodes[i].size);
                        graph.nodes[i]['Cluster Size'] = parseInt(graph.nodes[i].clusterSize);
                        delete graph.nodes[i]['clusterSize'];

                        // Clean up node links
                        if (!graph.nodes[i].links) {
                            graph.nodes[i].links = [];
                        } else {
                            var links = [];
                            if (graph.nodes[i].links instanceof Array) {
                                for (j = 0; j < graph.nodes[i].links.length; j++) {
                                    link = {};
                                    if (graph.nodes[i].links[j].map) {
                                        for (k = 0; k < graph.nodes[i].links[j].map.entry.length; k++) {
											linkattr = graph.nodes[i].links[j].map.entry[k];
                                            link[linkattr.key] = linkattr.value;
                                        }
                                        links.push(link);
                                    } else {
                                        links.push(graph.nodes[i].links[j]);
                                    }
                                }
                            } else {
                                link = {};
                                for (k = 0; k < graph.nodes[i].links.map.entry.length; k++) {
                                    var linkattr = graph.nodes[i].links.map.entry[k];
                                    link[linkattr.key] = linkattr.value;
                                }
                                links.push(link);
                            }
                            graph.nodes[i].links = links;
                        }
                    }

                    // Clean up the links
                    for (i = 0; i < graph.links.length; i++) {
                        graph.links[i].weight = parseFloat(graph.links[i].weight);
                    }
                }

                this.linkData = {
                    nodes: [],
                    links: [],
                    nodeMap: {},
                    connectednessRange: new aperture.Scalar('Connectedness')
                };
                this.linkData.connectednessRange.expand(0);
                this.linkData.connectednessRange.expand(graph['connectedness']);
                this.linkData.nodes = graph.nodes;
                if (this.linkData.nodes) {
                    for (i=0; i<this.linkData.nodes.length; i++) {
                        var node = this.linkData.nodes[i];
                        this.linkData.nodeMap[node.id] = node;
                    }
                }

                this.linkData.links = graph.links;
                if (graph.links) {
                    for (i=0; i<graph.links.length; i++) {
                        var link = graph.links[i];
                        link.source = this.linkData.nodeMap[link.sourceId];
                        link.target = this.linkData.nodeMap[link.targetId];
                    }
                }

                this.graphZoom = 0;
                this.updateZoom();
                this.graphCanvas.css({
                    top : '0px',
                    left: '0px'
                });
                this.layout('organic');

                this.previousGraphData = graph;
            },
            empty: function() {
                this.graphCanvas.empty();
                this.plot = null;
            },

            resize: function(w,h) {
                // Keep track of total scale since last graph relayout
                if (!this.scaleFactorX) {
                    this.scaleFactorX = 1;
                    this.scaleFactorY = 1;
                }
                this.scaleFactorX = this.scaleFactorX*w/this.width;
                this.scaleFactorY = this.scaleFactorY*h/this.height;

                this.width = w;
                this.height = h;

                if (this.resizing) {
                    clearTimeout(this.resizing);
                }

                var that = this;
                this.resizing = setTimeout(function() {
                    that.adjustCanvasOnResize(that.scaleFactorX, that.scaleFactorY);
                    that.updateZoom();
                    that.layout('organic');
                    that.resizing = null;
                    that.scaleFactorX = 1;
                    that.scaleFactorY = 1;
                }, 200);
            },

            displayLoader: function() {
                this.plot = null;
                this.graphCanvas.css({
                    top:'0px',
                    left:'0px'
                });
				this.graphCanvas.width(container.width());
				this.graphCanvas.height(container.height());
                displayAjaxLoader(this.graphCanvas);
            },

            adjustCanvasOnResize: function(scaleX, scaleY) {
                var oldpos = this.graphCanvas.position();
                this.graphCanvas.css({
                    left: (oldpos.left*scaleX) + 'px',
                    top : (oldpos.top*scaleY) + 'px'
                });
            }
	    };
        graphWidgetObj.init();
        return graphWidgetObj;
	};
	
	return {
		createWidget:createWidget
	}
});
