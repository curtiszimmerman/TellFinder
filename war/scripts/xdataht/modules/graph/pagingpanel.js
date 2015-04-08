
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

define([ '../util/ui_util', '../util/colors'],
    function( ui_util, colors) {

		var mergeGraphs = function(fullGraph, plusGraph) {
			var addNodes = [];
			var addLinks = [];
			var found = false;
			for (var i=0; i<plusGraph.nodes.length; i++) {
				found = false;
				for (var j=0; j<fullGraph.nodes.length; j++) {
					if (fullGraph.nodes[j].id==plusGraph.nodes[i].id) found = true;
				}
				if (!found) {
					addNodes.push(plusGraph.nodes[i]);
					plusGraph.nodes[i].ring = 4;
				}
			}
			for (i=0; i<plusGraph.links.length; i++) {
				found = false;
				for (j=0; j<fullGraph.links.length; j++) {
					if (fullGraph.links[j].id==plusGraph.links[i].id) found = true;
				}
				if (!found) addLinks.push(plusGraph.links[i]);
			}
			fullGraph.nodes = fullGraph.nodes.concat(addNodes);
			fullGraph.links = fullGraph.links.concat(addLinks);
		};
	
        var createWidget = function(appwidget) {

            var OBJECT_PADDING = 2;
            var BUTTON_DIM = 20;
            var PAGING_STRING_WIDTH = 120;
            var PAGING_CONTROLS_WIDTH = 213;
            var PAGE_SIZE = 20;

            var pagingWidgetObj = {
                pagingCanvas:null,
                pagingStringArea:null,
                fullGraph:null,
                centerRingNodes:null,
                pageStart:null,
                preclusterType:null,
                datasetName:null,
                clustersetName:null,
                init: function() {
                    this.createPagingControls();
                },
                setFullGraph: function(graph, datasetName, clustersetName, preclusterType) {
                    this.datasetName = datasetName;
                    this.clustersetName = clustersetName;
                    this.preclusterType = preclusterType;
//                    if (this.fullGraph) {
//                    	mergeGraphs(this.fullGraph, graph);
//                    } else {
                    	this.fullGraph = graph;
//                    }
                    this.pageStart = 1;

                    this.centerRingNodes = [];
                    if (this.fullGraph && this.fullGraph.nodes) {
                    	if (this.fullGraph.nodes.length>400) {
                    		alert('Warning: To many graph results. ' + 
								'Not all matching or related clusters will be displayed. Choose a more specific ' +
								'search term (e.g. phone or email) or do an advanced search for better results.');
                    	}
                        for (var i = 0; i < this.fullGraph.nodes.length; i++) {
                            if (this.fullGraph.nodes[i].ring == '0' || this.fullGraph.nodes[i].ring == 0) {
                                this.centerRingNodes.push(this.cloneNode(this.fullGraph.nodes[i]));
                            }
                        }
                    }

                    if (this.centerRingNodes.length > PAGE_SIZE) {
                        this.showPagingControls();
                        this.updatePagingControls(this.pageStart, PAGE_SIZE, this.centerRingNodes.length);
                        var filteredGraph = this.filterGraph();
                        appwidget.graphWidget.displayGraph(filteredGraph,datasetName,clustersetName,preclusterType);
                    } else {
                        appwidget.graphWidget.displayGraph(this.fullGraph,datasetName,clustersetName,preclusterType);
                    }
                	
                },
                filterGraph: function() {
                    var filteredGraph = {
                        nodes: null,
                        links: this.fullGraph.links
                    };

                    var allDisplayedNodeIds = {};

                    var firstRingNodes = [];
                    // Get a windowed list of center ring nodes we're displaying
                    for (var i = this.pageStart-1; i < this.pageStart-1 + PAGE_SIZE && i < this.centerRingNodes.length; i++) {
                        firstRingNodes.push(this.cloneNode(this.centerRingNodes[i]));
                        allDisplayedNodeIds[this.centerRingNodes[i].id] = true;
                    }

                    // Add all nodes they're linked to
                    var secondRingNodes = [];
                    for (i = 0; i < firstRingNodes.length; i++) {
                        var links = firstRingNodes[i].links;
                        if (links) {
                            for (var j = 0; j < links.length; j++) {
                                var otherNodeId = links[j].map.entry[1].value;
                                var node = this.getNodeById(otherNodeId);
                                if (!allDisplayedNodeIds[otherNodeId] && node.ring == '1') {
                                    secondRingNodes.push(this.cloneNode(node));
                                    allDisplayedNodeIds[otherNodeId] = true;
                                }
                            }
                        }
                    }

                    // And all nodes they're linked to
                    var thirdRingNodes = [];
                    for (i = 0; i < secondRingNodes.length; i++) {
                        var links = secondRingNodes[i].links;
                        if (links) {
                            for (var j = 0; j < links.length; j++) {
                                var otherNodeId = links[j].map.entry[1].value;
                                var node = this.getNodeById(otherNodeId);
                                if (!allDisplayedNodeIds[otherNodeId] && node.ring == '2') {
                                    thirdRingNodes.push(this.cloneNode(node));
                                    allDisplayedNodeIds[otherNodeId] = true;
                                }
                            }
                        }
                    }

                    filteredGraph.nodes = firstRingNodes.concat(secondRingNodes).concat(thirdRingNodes);

                    // Remove all the links that are attached to nodes
                    for (i = 0; i < filteredGraph.nodes.length; i++) {
                        node = filteredGraph.nodes[i];
                        if (node.links) {
                            for (j = 0; j < node.links.length; j++) {
                                var otherNodeId = node.links[j].map.entry[1].value;
                                if (!allDisplayedNodeIds[otherNodeId]) {
                                    node.links.splice(j,1);
                                }
                            }
                        }
                    }

                    // Remove link objects from the graph
                    filteredGraph.links = [];
                    if (this.fullGraph.links) {
                        for (i = 0; i < this.fullGraph.links.length; i++) {
                            if (allDisplayedNodeIds[this.fullGraph.links[i].sourceId] && allDisplayedNodeIds[this.fullGraph.links[i].targetId]) {
                                filteredGraph.links.push(this.fullGraph.links[i]);
                            }
                        }
                    }

                    return filteredGraph;
                },
                getNodeById: function(id) {
                    for (var i = 0; i < this.fullGraph.nodes.length; i++) {
                        if (this.fullGraph.nodes[i].id == id) {
                            return this.fullGraph.nodes[i];
                        }
                    }
                    return null;
                },
                cloneNode: function(node) {
                    var clonedNode = _.clone(node);
                    if (node.links) {
                        clonedNode.links = [];
                        for (var i = 0; i < node.links.length; i++) {
                            clonedNode.links.push(node.links[i]);
                        }
                    }
                    return clonedNode;
                },
                createPagingControls: function() {
                    var that = this;
                    this.outerCanvas = $('<div/>');
                    this.outerCanvas.css({
                        position:'absolute',
                        top: '0px',
                        right: '0px',
                        width: '212px',
                        height: '0px',
                        border: '0px',
                        overflow:'hidden',
                        opacity:'0px'
                    });
                    appwidget.graphCanvasContainer.append(this.outerCanvas);
                    
                    this.pagingCanvas = $('<div/>');
                    this.pagingCanvas.css({
                        position:'absolute',
                        top: OBJECT_PADDING + 'px',
                        right: OBJECT_PADDING + 'px',
                        width: '212px',
                        height: '22px'
                    });
                    this.outerCanvas.append(this.pagingCanvas);

                    var firstBtn = $('<button/>').button({
                        text:false,
                        icons:{
                            primary:'ui-icon-seek-first'
                        }
                    }).css({
                            position:'absolute',
                            top:'0px',
                            left:'0px',
                            width: BUTTON_DIM + 'px',
                            height: BUTTON_DIM + 'px'
                    }).click(function() {
                        that.pageStart = 1;
                        appwidget.softClear();
                        var filteredGraph = that.filterGraph();
                        appwidget.graphWidget.displayGraph(filteredGraph,that.datasetName,that.clustersetName,that.preclusterType);
                        that.updatePagingControls(that.pageStart, PAGE_SIZE, that.centerRingNodes.length);
                    });
                    this.pagingCanvas.append(firstBtn);

                    var backBtn = $('<button/>').button({
                        text:false,
                        icons:{
                            primary:'ui-icon-seek-prev'
                        }
                    }).css({
                            position:'absolute',
                            top:'0px',
                            left:BUTTON_DIM + OBJECT_PADDING + 'px',
                            width: BUTTON_DIM + 'px',
                            height: BUTTON_DIM + 'px'
                    }).click(function() {
                        that.pageStart = that.pageStart - PAGE_SIZE;
                        if (that.pageStart <= 0) {
                            that.pageStart = 1;
                        }
                        appwidget.softClear();
                        var filteredGraph = that.filterGraph();
                        appwidget.graphWidget.displayGraph(filteredGraph,that.datasetName,that.clustersetName,that.preclusterType);
                        that.updatePagingControls(that.pageStart, PAGE_SIZE, that.centerRingNodes.length);
                    });
                    this.pagingCanvas.append(backBtn);

                    this.pagingStringArea = $('<div/>').width(PAGING_STRING_WIDTH).height(20).css({
                        position:'absolute',
                        top:'0px',
                        left:2*BUTTON_DIM + 4*OBJECT_PADDING + 'px',
                        'text-align' : 'center',
                        'vertical-align' : 'middle',
                        'line-height' : '20px'
                    });
                    this.pagingCanvas.append(this.pagingStringArea);

                    var nextBtn = $('<button/>').button({
                        text:false,
                        icons:{
                            primary:'ui-icon-seek-next'
                        }
                    }).css({
                            position:'absolute',
                            top:'0px',
                            left:2*BUTTON_DIM + 2*OBJECT_PADDING + PAGING_STRING_WIDTH + 'px',
                            width: BUTTON_DIM + 'px',
                            height: BUTTON_DIM + 'px'
                        }).click(function() {
                            if (that.pageStart + PAGE_SIZE <= that.centerRingNodes.length) {
                                that.pageStart = that.pageStart + PAGE_SIZE;
                                var filteredGraph = that.filterGraph();
                                appwidget.softClear();
                                appwidget.graphWidget.displayGraph(filteredGraph,that.datasetName,that.clustersetName,that.preclusterType);
                                that.updatePagingControls(that.pageStart, PAGE_SIZE, that.centerRingNodes.length);
                            }
                        });
                    this.pagingCanvas.append(nextBtn);

                    var lastBtn = $('<button/>').button({
                        text:false,
                        icons:{
                            primary:'ui-icon-seek-end'
                        }
                    }).css({
                            position:'absolute',
                            top:'0px',
                            left:3*BUTTON_DIM + 3*OBJECT_PADDING + PAGING_STRING_WIDTH + 'px',
                            width: BUTTON_DIM + 'px',
                            height: BUTTON_DIM + 'px'
                        }).click(function() {
                            that.pageStart = Math.floor(that.centerRingNodes.length / PAGE_SIZE) * PAGE_SIZE;
                            var filteredGraph = that.filterGraph();
                            appwidget.softClear();
                            appwidget.graphWidget.displayGraph(filteredGraph,that.datasetName,that.clustersetName,that.preclusterType);
                            that.updatePagingControls(that.pageStart, PAGE_SIZE, that.centerRingNodes.length);
                        });
                    this.pagingCanvas.append(lastBtn);
                },
                hidePagingControls: function() {
                	this.outerCanvas.css({border:'0px'});
                    this.outerCanvas.animate({height:'0px',opacity:0});
                },
                showPagingControls: function() {
                	this.outerCanvas.css({border:'1px solid ' + colors.BORDER_DARK});
                    this.outerCanvas.animate({height:'24px',opacity:1});
                },
                updatePagingControls: function(currentPage, pageSize, totalResults) {
                    this.pagingStringArea.html('<b>' + currentPage + ' to ' + Math.min(currentPage + pageSize - 1, totalResults) + '</b> of ' + totalResults);
                },
                resize: function(w,h) {
                    this.width = w;
                    this.height = h;
                }
            };
            pagingWidgetObj.init();
            return pagingWidgetObj;
        };

        return {
            createWidget:createWidget
        }
    });
