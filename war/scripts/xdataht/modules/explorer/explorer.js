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
define(['../util/ui_util', '../util/rest', '../util/colors', '../util/bezier_arrow', '../util/image_dialog', '../util/process_each', './explorercolumn', '../util/colors', './events'],
    function( ui_util, rest, colors, bezier_arrow, image_dialog,process,Column,Colors,Events) {

        var expandable = true;
        var $loader = $('<div/>').addClass('explorer-loader');

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


        var toggleLoader = function () {
            expandable = !expandable;
            $loader.css('display',expandable?'none':'');
        };

        var getAttributeNodeId = function(attributeName,attributeValue) {
            var val = attributeValue.value ? attributeValue.value : attributeValue.bin;
            return 'attributeNode_' + attributeName + '_' + val;
        };

        var createWidget = function(appwidget, baseUrl, selectionManager) {
            var container = appwidget.graphCanvasContainer,
                graphWidgetObj = {
                    baseUrl: baseUrl,
                    columns: [],
                    links : {},
                    highlightlinks : {},
                    branchType : null,
                    graphCanvas: null,
                    selection : selectionManager,
                    selecedAttribute : null,
                    selectedCluster: null,

                    init: function() {
                        container.css('padding-left', '5px');
                        this.createGraphCanvas();
                        this.bindEventHandlers();
                    },

                    getSidePanel : function(name) {
                        return appwidget.sidePanels[name]
                    },

                    createGraphCanvas: function() {
                        this.graphCanvas = $('<div/>', {id: 'NodeLink' + ui_util.uuid()});
                        this.graphCanvas.css({
                            'position':'relative',
                            'top':'0px',
                            'left':'0px',
                            overflow:'auto'
                        });
                        this.graphCanvas.width(container.width());
                        this.graphCanvas.height(container.height());
                        container.append(this.graphCanvas);
                    },

                    bindEventHandlers : function() {
                        Events.subscribe(Events.topics.COLLAPSE_ROW,this.onExpandAndCollapse,graphWidgetObj);
                        Events.subscribe(Events.topics.EXPAND_ROW,this.onExpandAndCollapse,graphWidgetObj);
                        Events.subscribe(Events.topics.SHOW_MORE,this.onExpandAndCollapse,graphWidgetObj);
                        Events.subscribe(Events.topics.MOUSE_OVER_ATTRIBUTE,this.onMouseOverAttribute,graphWidgetObj);
                        Events.subscribe(Events.topics.MOUSE_OUT_ATTRIBUTE,this.onMouseOutAttribute,graphWidgetObj);
                        Events.subscribe(Events.topics.SELECT_NODE,this.selectCluster,graphWidgetObj);
                        Events.subscribe(Events.topics.SELECT_ATTRIBUTE,this.selectAttribute,graphWidgetObj);
                        Events.subscribe(Events.topics.PRUNE,this.onPrune,graphWidgetObj);
                        Events.subscribe(Events.topics.BRANCH_CLUSTER,this.onBranch,graphWidgetObj);
                        Events.subscribe(Events.topics.BRANCH_ATTRIBUTE,this.onBranchAttribute,graphWidgetObj);
                    },

                    updateSelection: function() {

                        var that = this;

                        function clear() {
                            that.columns.forEach(function(column) {
                                column.getClusters().forEach(function(cluster) {
                                    cluster.clearAttributeSelection();
                                });
                            });
                        }


                        if (this.selecedAttribute) {

                            var name = this.selecedAttribute.name;
                            var value = this.selecedAttribute.value;

                            clear();

                            this.columns.forEach(function(column) {
                                column.getClusters().forEach(function(cluster) {
                                    cluster.setAttributeSelection(name,value);
                                });
                            });
                        } else {
                            clear();
                        }
                    },

                    update: function() {
                        this.columns.forEach(function(col) {
                            col.update();
                        });
                    },

                    selectCluster: function(data) {
                        var cluster = data.cluster;

                        if (this.selectedCluster) {
                            this.selectedCluster.deselect();
                        }
                        cluster.select();
                        this.selectedCluster = cluster;

                        var id = cluster.getId();
                        if (id && id.indexOf('attributeNode') !== -1) {
                            var nv = this.getAttributeNameValueFromId(id);
                            appwidget.onSelectAttributeNode(nv.attributeName,nv.attributeValue);
                        } else if (id >= 0) {
                            appwidget.onSelectCluster('org', cluster.getId(), cluster.clusterName);
                        } else if (id == -1) {
                            appwidget.onSelectTipNode(cluster.clusterName);
                        }
                    },

                    selectAttribute : function(data) {

                        var name = data.attributeName;
                        var value = data.attributeValue.value !== undefined ? data.attributeValue.value : data.attributeValue.bin;

                        if (this.selecedAttribute && this.selecedAttribute.name === name && this.selecedAttribute.value === value) {

                            this.selection.set('Graph Cluster', []);
                            this.selecedAttribute = null;

                        } else {

                            this.selecedAttribute = {
                                name : name,
                                value : value
                            };

                            this.selection.setAttributeSelected(
                                'Graph Cluster',
                                name === 'images' ? 'images_hash' : name,       // @HACK: Why does selection manager not use the attribute name?
                                value
                            );
                        }

                        this.updateSelection();
                    },

                    getAttributeNodeId : function(attributeName,attributeValue) {
                        return getAttributeNodeId(attributeName,attributeValue);
                    },

                    getRawAttributeId : function(attributeName,attributeValue, callback) {
                        rest.get(baseUrl + 'rest/attributeDetails/getattrid/'+attributeName+'/'+attributeValue,
                            "get Attribute ID",
                            function (id) {
                                if(id) {
                                    callback(id)
                                } else {
                                    callback(null);
                                }
                            },
                            function () {
                                callback(false);
                        });
                    },


                    /**
                     * Returns a map of all cluster ids in all columns
                     * @returns {{}}
                     */
                    getClusterIds : function() {
                        var ids = {};
                        graphWidgetObj.columns.forEach(function(column) {
                            var columnIds = column.getClusterIds();
                            Object.keys(columnIds).forEach(function(id) {
                                ids[id] = true;
                            });
                        });
                        return ids;
                    },

                    getAttributeNameValueFromId : function(attributeNodeId) {
                        var trimmed = attributeNodeId.replace('attributeNode_','');
                        var attributeName = trimmed.substring(0,trimmed.indexOf('_'));
                        trimmed = trimmed.replace(attributeName+'_','');
                        var attributeValue = trimmed;

                        return {
                            attributeName : attributeName,
                            attributeValue : attributeValue
                        };
                    },

                    /**
                     * Ensures the canvases between the columns are sized correctly to accomodate
                     * the sankeys
                     * @param column
                     */
                    rebalanceColumnHeights : function() {
                        graphWidgetObj.columns.forEach(function(col) {
                            var idx = col.getIndex();
                            var next = graphWidgetObj.columns[idx+1];
                            if (next) {
                                var maxHeight = Math.max(col.height(),next.height());
                                col.height(maxHeight);
                                next.height(maxHeight);
                            }
                        })
                    },

                    /**
                     * Called when a column is rendered with placeholders and begins to fetch
                     * each cluster
                     * @param column
                     */
                    onColumnReady : function(column) {
                        graphWidgetObj.rebalanceColumnHeights();
                    },


                    /**
                     * Returns a list of start points and end points for a given row attribute.
                     * If both attribute lists are expanded in source and target, we need to keep
                     * duplicates as we can only render 1-1, many-1, or 1-many offsets.
                     * @param column
                     * @param cluster
                     */
                    calculateLinkOffsets : function(sourceCluster,targetCluster,attributeName,attributeValues) {

                        // Get the attribute values that have links relevent to target cluster
                        var linkValues = attributeValues.filter(function(value) {
                            var val = value.value ? value.value : value.bin;
                            return targetCluster.hasAttributeValue(attributeName,val);
                        });

                        if (!linkValues || linkValues.length === 0) {
                            return {
                                source : [],
                                target : []
                            };
                        }

                        var bKeepDuplicates = sourceCluster.isAttributeExpanded(attributeName) && targetCluster.isAttributeExpanded(attributeName);

                        // Get all the source offsets
                        var sourceOffsetMap = {};
                        var sourceOffsets = linkValues.map(function(value) {
                            var offset = sourceCluster.getRowOffset(attributeName,value).source;
                            offset.top += graphWidgetObj.graphCanvas.scrollTop();
                            return offset;
                        });
                        if (!bKeepDuplicates) {
                            // Remove duplicates
                            sourceOffsets = sourceOffsets.filter(function (offset) {
                                if (!sourceOffsetMap[offset.top + ',' + offset.left]) {
                                    sourceOffsetMap[offset.top + ',' + offset.left] = true;
                                    return offset;
                                }
                            });
                        }


                        // Get all the target offsets
                        var targetOffsetMap = {};
                        var targetOffsets = linkValues.map(function(value) {
                            var offset = targetCluster.getRowOffset(attributeName,value).target;
                            offset.top += graphWidgetObj.graphCanvas.scrollTop();
                            return offset;
                        });
                        if (!bKeepDuplicates) {
                            // Remove duplicates
                            targetOffsets = targetOffsets.filter(function (offset) {
                                if (!targetOffsetMap[offset.top + ',' + offset.left]) {
                                    targetOffsetMap[offset.top + ',' + offset.left] = true;
                                    return offset;
                                }
                            });
                        }

                        return {
                            source : sourceOffsets,
                            target : targetOffsets
                        };
                    },

                    /**
                     * Update all links in all columns
                     */
                    updateAllLinks : function() {
                        graphWidgetObj.columns.forEach(function(column) {
                            graphWidgetObj.updateColumnLinks(column);
                        });
                    },

                    /**
                     * Recompute the offsets for the links we have already added.   Called when
                     * the size of something changes (collapse,expand,cluster loaded,etc)
                     * @param column - the column to update the outgoing links from
                     */
                    updateColumnLinks : function(column) {
                        // Get any column links
                        var columnLinkIds = column.getLinkIds();
                        var columnLinks = columnLinkIds.map(function(linkId) {
                            return graphWidgetObj.links[linkId];
                        });

                        // Update the offsets of the links
                        columnLinks.forEach(function(link) {
                            var offsets = graphWidgetObj.calculateLinkOffsets(link.source,link.target,link.attributeName,link.attributeValues);
                            var linkColor = link.type === 'forwardlink' ? Colors.ARROWS : Colors.BACKLINK;
                            column.updateLink(link.id,offsets.source,offsets.target,linkColor,link.highlighted);
                        });

                        column.update();
                    },

                    /**
                     * Called when we resize a column by expanding or collapsing
                     * @param column - column affected
                     */
                    onExpandAndCollapse : function(data) {
                        graphWidgetObj.rebalanceColumnHeights();
                        graphWidgetObj.updateSelection();

                        graphWidgetObj.updateColumnLinks(data.column);
                        if (data.column.getIndex()>0) {
                            graphWidgetObj.updateColumnLinks(graphWidgetObj.columns[data.column.getIndex()-1]);
                        }
                    },


                    onMouseOverAttribute : function(data) {

                        var column = data.column;
                        var attributeNode = data.cluster;
                        var attributeName = data.attributeName;
                        var attributeValues = data.attributeValues;

                        graphWidgetObj._clearHighlight();

                        var prevCol = (column.getIndex()-1 >= 0) ? graphWidgetObj.columns[column.getIndex()-1] : null;
                        if (prevCol) {
                            var bRedraw = false;
                            prevCol.getClusters().forEach(function(node) {

                                // Start from the source and figure out which attribute values match in the target cluster
                                var matchingAttributeValues = node.getAttributeValues(attributeName).filter(function(sourceValue) {
                                    for (var i = 0; i < attributeValues.length; i++) {
                                        var targetValue = attributeValues[i];
                                        var sourceVal = sourceValue.value !== undefined ? sourceValue.value : sourceValue.bin;
                                        var targetVal = targetValue.value !== undefined ? targetValue.value : targetValue.bin;

                                        if (sourceVal === targetVal) {
                                            return true;
                                        }
                                    }
                                    return false;
                                });

                                matchingAttributeValues.forEach(function(attributeValue) {

                                    var offsets = graphWidgetObj.calculateLinkOffsets(node,attributeNode,attributeName,[attributeValue]);
                                    if (offsets.source.length && offsets.target.length) {
                                        prevCol.addHighlight(offsets.source[0], offsets.target[0]);
                                        bRedraw = true;
                                    }
                                });
                            });
                            if (bRedraw) {
                                prevCol.update();
                            }
                        }
                        var nextCol = (column.getIndex()+1 < graphWidgetObj.columns.length) ? graphWidgetObj.columns[column.getIndex()+1] : null;
                        if (nextCol) {
                            bRedraw =false;
                            nextCol.getClusters().forEach(function(node) {
                                attributeValues.forEach(function(attributeValue) {
                                    var offsets = graphWidgetObj.calculateLinkOffsets(attributeNode,node,attributeName,[attributeValue]);
                                    if (offsets.source.length && offsets.target.length) {
                                        column.addHighlight(offsets.source[0], offsets.target[0]);
                                        bRedraw = true;
                                    }
                                });
                            });

                            if (bRedraw) {
                                column.update();
                            }
                        }

                    },

                    onMouseOutAttribute : function(data) {
                        graphWidgetObj._clearHighlight();
                    },

                    _clearHighlight : function() {
                        graphWidgetObj.columns.forEach(function(column) {
                            column.clearHighlight();
                            column.update();
                        });

                    },

                    onPrune : function(data) {

                        var sourceColumn = data.column;
                        var attributeName = data.attributeName;
                        var attributeValues = data.attributeValues;
                        var branchTargets = data.branchTargets;

                        var nextCol = sourceColumn.getIndex() + 1 < graphWidgetObj.columns.length ? graphWidgetObj.columns[sourceColumn.getIndex()+1] : null;
                        if (nextCol) {

                            // Get a list of clusters to remove that match the attribute(s) we're closing
                            var clustersToRemove = [];
                            if (branchTargets && branchTargets.length > 0) {    // cluster mode
                                branchTargets.forEach(function(clusterId) {
                                    var cluster = nextCol.getCluster(clusterId);
                                    if (cluster) {
                                        clustersToRemove.push(cluster);
                                    }
                                })
                            } else {
                                attributeValues.forEach(function (attributeValue) {     // attribute mode
                                    var attributeClusterId = graphWidgetObj.getAttributeNodeId(attributeName, attributeValue);
                                    var node = nextCol.getCluster(attributeClusterId);
                                    if (node) {
                                        clustersToRemove.push(node);
                                    }
                                });
                            }

                            // Iterate over each cluster we're removing and remove it from the column.   As well,
                            // remove any links this cluster was a part of
                            clustersToRemove.forEach(function(cluster) {

                                nextCol.removeCluster(cluster.getId());

                                var idsToDelete = [];
                                Object.keys(graphWidgetObj.links).forEach(function(linkId) {
                                    var link = graphWidgetObj.links[linkId];
                                    if (link.source.getId() === cluster.getId() || link.target.getId() === cluster.getId()) {
                                        link.sourceColumn.removeLink(linkId);
                                        idsToDelete.push(linkId);
                                    }
                                });
                                idsToDelete.forEach(function(id) {
                                    delete graphWidgetObj.links[id];
                                });

                            });

                            // Resize the sankey canvases
                            graphWidgetObj.rebalanceColumnHeights();

                            // Update the values on the handle
                            var allClusterIds = graphWidgetObj.getClusterIds();
                            graphWidgetObj.columns.forEach(function (column) {
                                column.updateBranchHandles(allClusterIds);
                            });

                            graphWidgetObj.removeOrphans(sourceColumn.index + 1);
                            graphWidgetObj.updateAllLinks();
                            graphWidgetObj.update();
                        }
                    },

                    removeOrphans : function (startColumn) {
                        for(var i = startColumn; i<graphWidgetObj.columns.length; i++) {
                            var column = this.columns[i];
                            var clusterIds = column.getClusterIds();
                            var clustersToKeep = {};

                            Object.keys(graphWidgetObj.links).forEach(function(linkId) {
                               var targetClusterId = graphWidgetObj.links[linkId].target.getId();
                                if(clusterIds[targetClusterId]) {
                                    clustersToKeep[targetClusterId] = true;
                                }
                            });

                            Object.keys(clusterIds).forEach(function(clusterId) {
                                if(!clustersToKeep[clusterId]) {
                                    column.removeCluster(clusterId);
                                }
                            });
                        }
                    },

                    onBranchAttribute : function(data) {

                        var column = data.column;
                        var cluster = data.cluster;
                        var originalAttributeName = data.attributeName;
                        var originalAttributeValues = data.attributeValues;

                        /**
                         * Called when cluster details come back from the server.  Rebalance
                         * the column heights because the sizes have changed.   Also get the connectivity
                         * between the source and target clusters and add the necessary links.
                         *
                         * @param targetCol - the column in which the cluster has loaded
                         * @param targetCluster - the cluster that we now have details for
                         */
                        function onBranchClusterLoaded(targetCol,targetCluster) {
                            graphWidgetObj.rebalanceColumnHeights();
                            graphWidgetObj.updateSelection();


                            //back links
                            cluster.getAttributeNames().forEach(function(attributeName) {
                                var attributeValues = cluster.getAttributeValues(attributeName);
                                if (attributeName === originalAttributeName) {
                                    attributeValues = attributeValues.filter(function(value) {
                                        var valueVal = value.value ? value.value : value.bin;
                                        for (var i = 0; i < originalAttributeValues.length; i++) {
                                            var originalValueVal = originalAttributeValues[i].value ? originalAttributeValues[i].value : originalAttributeValues[i].bin;
                                            if (valueVal === originalValueVal) {
                                                return false;
                                            }
                                        }
                                        return true;
                                    });
                                }


                                var backOffsets = graphWidgetObj.calculateLinkOffsets(cluster,targetCluster,attributeName,attributeValues);

                                if (backOffsets.source.length === 0 || backOffsets.target.length === 0) {
                                    return;
                                }

                                var backlinkStrokeStyle = Colors.BACKLINK;
                                var linkId = column.addLink(backOffsets.target,backOffsets.source,backlinkStrokeStyle,1);
                                graphWidgetObj.links[linkId] = {
                                    source : cluster,
                                    target : targetCluster,
                                    sourceColumn : column,
                                    targetColumn : targetCol,
                                    attributeName : attributeName,
                                    attributeValues : attributeValues,
                                    type: 'backlink',
                                    id : linkId
                                };
                            });


                            // forward links
                            var offsets = graphWidgetObj.calculateLinkOffsets(cluster,targetCluster,originalAttributeName,originalAttributeValues);
                            if (offsets.source.length === 0 || offsets.target.length === 0) {
                                return;
                            }

                            var strokeStyle = Colors.ARROWS_SELECTED;
                            var linkId = column.addLink(offsets.source,offsets.target,strokeStyle,0);
                            graphWidgetObj.links[linkId] = {
                                source : cluster,
                                target : targetCluster,
                                sourceColumn : column,
                                targetColumn : targetCol,
                                attributeName : originalAttributeName,
                                attributeValues : originalAttributeValues,
                                type : 'forwardlink',
                                id : linkId
                            };


                            column.update();
                        }


                        // If we're branching on a different type, remove
                        // all columns to the right of this one
                        var idx = column.getIndex();
                        if (graphWidgetObj.branchType && originalAttributeName !== graphWidgetObj.branchType) {

                            var otherColumns = graphWidgetObj.columns.splice(idx + 1, graphWidgetObj.columns.length - (idx + 1));
                            otherColumns.forEach(function (col) {
                                col.destroy();
                            });

                            var removed = column.removeAllLinks();
                            removed.forEach(function(linkid) {
                                delete graphWidgetObj.links[linkid];
                            });

                            // Stop any existing requests we have pending
                            column.stopPendingRequests();

                            column.update();

                        }



                        var ids = originalAttributeValues.map(function(value) {
                            return getAttributeNodeId(originalAttributeName,value);
                        });

                        // Get a list of cluster ids to fetch for the next column,
                        // (we exclude ones that already exist)
                        var allClusterIds = graphWidgetObj.getClusterIds();
                        var attributeNodesToFetch = ids.filter(function (id) {
                            if (!allClusterIds[id]) {
                                return id;
                            }
                        });

                        // Save the type we're branched from
                        graphWidgetObj.branchType = originalAttributeName;


                        // Create the new column or add to the existing one
                        var nextColumn = graphWidgetObj.columns[idx + 1];
                        if (!nextColumn) {
                            var newColumn = Column.create(graphWidgetObj, attributeNodesToFetch, graphWidgetObj.columns.length, graphWidgetObj.onColumnReady)
                                .onClusterLoaded(onBranchClusterLoaded);

                            graphWidgetObj.columns.push(newColumn);
                        } else {
                            nextColumn.onClusterLoaded(onBranchClusterLoaded);
                            nextColumn.addAttributeNodes(attributeNodesToFetch, graphWidgetObj.onColumnReady);
                        }


                        // Update branch handle counts
                        allClusterIds = graphWidgetObj.getClusterIds();
                        graphWidgetObj.columns.forEach(function (column) {
                            column.updateBranchHandles(allClusterIds);
                        });
                    },


                    /**
                     * Called when we click a branch button for an attribute
                     * @param column - column where the branch originates
                     * @param cluster - cluster we're branching from
                     * @param row - attribute row we're branching on
                     * @param targets - cluster ids linked by the attribute row
                     */
                    onBranch : function(data) {

                        var column = data.column;
                        var cluster = data.cluster;
                        var originalAttributeName = data.attributeName;
                        var originalAttributeValues = data.attributeValues;
                        var targets = data.attributeLinks;

                        /**
                         * Called when cluster details come back from the server.  Rebalance
                         * the column heights because the sizes have changed.   Also get the connectivity
                         * between the source and target clusters and add the necessary links.
                         *
                         * @param targetCol - the column in which the cluster has loaded
                         * @param targetCluster - the cluster that we now have details for
                         */
                        function onBranchClusterLoaded(targetCol,targetCluster) {
                            graphWidgetObj.rebalanceColumnHeights();
                            graphWidgetObj.updateSelection();

                            //back links
                            cluster.getAttributeNames().forEach(function(attributeName) {
                                var attributeValues = cluster.getAttributeValues(attributeName);
                                if (attributeName === originalAttributeName) {
                                    attributeValues = attributeValues.filter(function(value) {
                                        var valueVal = value.value ? value.value : value.bin;
                                        for (var i = 0; i < originalAttributeValues.length; i++) {
                                            var originalValueVal = originalAttributeValues[i].value ? originalAttributeValues[i].value : originalAttributeValues[i].bin;
                                            if (valueVal === originalValueVal) {
                                                return false;
                                            }
                                        }
                                        return true;
                                    });
                                }

                                var backOffsets = graphWidgetObj.calculateLinkOffsets(cluster,targetCluster,attributeName,attributeValues);

                                if (backOffsets.source.length === 0 || backOffsets.target.length === 0) {
                                    return;
                                }

                                var backlinkStrokeStyle = Colors.BACKLINK;
                                var linkId = column.addLink(backOffsets.target,backOffsets.source,backlinkStrokeStyle,1);
                                graphWidgetObj.links[linkId] = {
                                    source : cluster,
                                    target : targetCluster,
                                    sourceColumn : column,
                                    targetColumn : targetCol,
                                    attributeName : attributeName,
                                    attributeValues : attributeValues,
                                    type: 'backlink',
                                    id : linkId
                                };
                            });


                            // forward links
                            var offsets = graphWidgetObj.calculateLinkOffsets(cluster,targetCluster,originalAttributeName,originalAttributeValues);
                            if (offsets.source.length === 0 || offsets.target.length === 0) {
                                return;
                            }

                            var strokeStyle = Colors.ARROWS_SELECTED;
                            var linkId = column.addLink(offsets.source,offsets.target,strokeStyle,0);
                            graphWidgetObj.links[linkId] = {
                                source : cluster,
                                target : targetCluster,
                                sourceColumn : column,
                                targetColumn : targetCol,
                                attributeName : originalAttributeName,
                                attributeValues : originalAttributeValues,
                                type : 'forwardlink',
                                id : linkId
                            };


                            column.update();
                        }


                        // If we're branching on a different type, remove
                        // all columns to the right of this one
                        var idx = column.getIndex();
                        if (graphWidgetObj.branchType && originalAttributeName !== graphWidgetObj.branchType) {

                            var otherColumns = graphWidgetObj.columns.splice(idx + 1, graphWidgetObj.columns.length - (idx + 1));
                            otherColumns.forEach(function (col) {
                                col.destroy();
                            });

                            var removed = column.removeAllLinks();
                            removed.forEach(function(linkid) {
                                delete graphWidgetObj.links[linkid];
                            });

                            // Stop any existing requests we have pending
                            column.stopPendingRequests();

                            column.update();

                        }

                        // Save the type we're branched from
                        graphWidgetObj.branchType = originalAttributeName;


                        // Get a list of cluster ids to fetch for the next column,
                        // (we exclude ones that already exist)
                        var allClusterIds = graphWidgetObj.getClusterIds();
                        var clustersToFetch = targets.filter(function (id) {
                            if (!allClusterIds[id]) {
                                return id;
                            }
                        });

                        // Create the new column or add to the existing one
                        var nextColumn = graphWidgetObj.columns[idx + 1];
                        if (!nextColumn) {
                            var newColumn = Column.create(graphWidgetObj, clustersToFetch, graphWidgetObj.columns.length, graphWidgetObj.onColumnReady)
                                .onClusterLoaded(onBranchClusterLoaded);
                            graphWidgetObj.columns.push(newColumn);
                        } else {
                            nextColumn.onClusterLoaded(onBranchClusterLoaded);
                            nextColumn.addClusters(clustersToFetch, graphWidgetObj.onColumnReady);
                        }

                        // Update branch handle counts
                        allClusterIds = graphWidgetObj.getClusterIds();
                        graphWidgetObj.columns.forEach(function (column) {
                            column.updateBranchHandles(allClusterIds);
                        });
                    },

                    displayGraphFromAttributeNode : function(attributeNodeDetails) {
                        this.graphCanvas.empty();
                        this.columns.length = 0;

                        var column = Column.create(graphWidgetObj,null, 0);

                        column.addTipNode(attributeNodeDetails);

                        var attributeNode = column.getClusterByIndex(0);
                        attributeNode.select();
                        Events.publish(Events.topics.SELECT_NODE,{
                            column : column,
                            cluster : attributeNode
                        });

                        this.columns.push(column);

                        // Update branch handle counts
                        var allClusterIds = graphWidgetObj.getClusterIds();
                        graphWidgetObj.columns.forEach(function (column) {
                            column.updateBranchHandles(allClusterIds);
                        });
                    },

                    /**
                     * Display the initial graph given a starting node
                     * @param node
                     * @param selectionWidget
                     */
                    displayGraph: function(node) {
                        this.graphCanvas.empty();
                        this.columns.length = 0;

                        // Select the column initially once it's been loaded in
                        var that = this;
                        var onColumnLoaded = function() {
                            // Select the singleton cluster
                            var cluster = column.getClusterByIndex(0);
                            that.selectedCluster = cluster;
                            cluster.select();
                        };

                        var column = Column.create(graphWidgetObj,[node.clusterid], 0, onColumnLoaded);

                        this.columns.push(column);
                    },

                    getSelectedSummary : function(callback) {
                        var that = this;
                        this.getClusterDetails(this.selectedCluster.getId(),function(details) {
                            var summary = {
                                id: details.clusterid == -1 ? 'N/A' : that.selectedCluster.getId(),
                                name: details.clusterName,
                                label: details.label,
                                latestAd: details.latestad,
                                size: details.adcount,
                                attributes : {}
                            };

                            Object.keys(details.attributes).forEach(function(attributeName) {
                                var i,attributeValue;
                                if (attributeName === 'email') {
                                    summary.attributes['Email Addresses'] = [];
                                    for (i = 0; i < details.attributes[attributeName].length > 0; i++) {
                                        attributeValue = details.attributes[attributeName][i];
                                        summary.attributes['Email Addresses'].push({
                                            name : attributeName,
                                            value : attributeValue.value,
                                            count : attributeValue.count
                                        });
                                    }
                                }  else if (attributeName === 'phone') {
                                    summary.attributes['Phone Numbers'] = [];
                                    for (i = 0; i < details.attributes[attributeName].length > 0; i++) {
                                        attributeValue = details.attributes[attributeName][i];
                                        summary.attributes['Phone Numbers'].push({
                                            name : attributeName,
                                            value : attributeValue.value,
                                            count : attributeValue.count
                                        });
                                    }
                                } else if (attributeName === 'website') {
                                    summary.attributes['Websites'] = [];
                                    for (i = 0; i < details.attributes[attributeName].length > 0; i++) {
                                        attributeValue = details.attributes[attributeName][i];
                                        summary.attributes['Websites'].push({
                                            name : attributeName,
                                            value : attributeValue.value,
                                            count : attributeValue.count
                                        });
                                    }
                                }
                            });
                            callback(summary);
                        });
                    },


                    fromTip : function(tip) {
                        var that = this;
                        this.fetchTipNode(tip,function(attributeNode) {
                            that.displayGraphFromAttributeNode(attributeNode);
                        },function(err) {
                            alert(err);
                        });
                    },

                    fromAdvanced : function(params) {
                        var that = this;
                        this.fetchAdvancedNode(params,function(attributeNode) {
                            that.displayGraphFromAttributeNode(attributeNode);
                        },function(err) {
                            alert(err);
                        });
                    },

                    fromAttribute : function(attributeId) {
                        var that = this;
                        this.fetchAttributeNode(attributeId,function(attributeNode) {
                            that.displayGraphFromAttributeNode(attributeNode);
                        },function(err) {
                            alert(err);
                        });
                    },

                    fromImage : function(type, value) {
                	   var that = this;
                	   this.fetchAttributeNodes((type=='bin')?'images':'image',value,function(attributeNode) {
                	       that.displayGraphFromAttributeNode(attributeNode);
                	   }, function(err) {
                	       alert(err);
                	   });
                	},
                    
                    fetchTipNode : function(tip,callback,errcallback) {
                        rest.post(baseUrl + "rest/graph/tipnode/",
                            tip,
                            "Compute a dynamic cluster based on a tip",
                            callback,
                            errcallback
                        );
                    },

                    fetchAdvancedNode : function(params,callback,errorcallback) {
                        rest.post(baseUrl + 'rest/graph/advanced/',
                            params,
                            "Compute a dynamic cluster from a set of advanced criteria",
                            callback,
                            errorcallback
                        );
                    },

                    fetchAttributeNode : function(attributeId, callback, errcallback) {
                        rest.post(baseUrl + 'rest/graph/attributenodefromid/',
                            attributeId,
                            "Compute a dynamic cluster based on an attirbute id",
                            callback,
                            errcallback
                        );
                    },

                    fetchAttributeNodes : function(attributeName, attributeValue, callback, errcallback) {
                        var data = {
                            attributeName : attributeName,
                            attributeValue : attributeValue
                        };
                        rest.post(baseUrl + 'rest/graph/attributenode/',
                            data,
                            "Compute a dynamic cluster based on attribute name/value pair",
                            callback,
                            errcallback
                        );
                    },

                    fetchClusterId: function(baseURL, clusterid, clusterType, callback, errcallback) {
                        if(!baseURL) baseURL = baseUrl;
                        rest.post(baseURL + "rest/graph/clusternode/",
                            clusterid,
                            "Compute graph and connectivity",
                            callback,
                            errcallback
                        );
                    },

                    empty: function() {
                        this.graphCanvas.empty();
                    },

                    resize: function(w,h) {
                        this.graphCanvas.css({
                            width: container.css('width'),
                            height: container.css('height')
                        });
                    },

                    getClusterDetails : function(clusterid,callback) {
                        for (var i = 0; i < graphWidgetObj.columns.length; i++) {
                            var col = graphWidgetObj.columns[i];
                            if (col.contains(clusterid)) {
                                col.getClusterDetails(clusterid,callback);
                                break;
                            }
                        }
                    },

                    // TODO:  remove this
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

                    toggleAjaxLoader : function() {
                        toggleLoader();
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
            var test_count = 1;
            return graphWidgetObj;
        };

        return {
            createWidget:createWidget
        }
    });