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
define(['../util/rest','./explorersankey','./explorercluster', '../util/process_each'], function(rest,Sankey,Cluster,Process) {


    /**
     * Gets basic information about a group of cluster ids
     * @param baseURL - baseurl of app
     * @param clusterIds - array of cluster ids to get summaries for
     * @param callback - on complete function
     * @param errcallback - on error function
     */
    function fetchClusterSummaries(baseURL, clusterIds, callback, errcallback) {
        if (!baseURL) baseURL = baseUrl;
        rest.post(
            baseURL + 'rest/graph/clustersummary',
            clusterIds,
            'Fetch cluster summaries',
            function(response) {
                // sort by adcount
                var summaries = [];
                for (var clusterid in response) {
                    if (response.hasOwnProperty(clusterid)) {
                        var summary = response[clusterid];
                        summary['clusterid'] = clusterid;
                        summaries.push(summary);
                    }
                }
                summaries.sort(function (s1, s2) {
                    return s2.adcount - s1.adcount;
                });
                callback(summaries);
            },
            errcallback
        );
    }

    /**
     * Gets full information about a cluster
     * @param baseURL - base url of app
     * @param clusterid - id of cluster
     * @param clusterType - type of cluster
     * @param callback - on complete function
     * @param errcallback - on error function
     */
    function fetchClusterDetails(baseURL, clusterid, clusterType, callback, errcallback) {
        if(!baseURL) baseURL = baseUrl;
        rest.post(baseURL + "rest/graph/clusternode/",
            clusterid,
            "Compute graph and connectivity",
            callback,
            errcallback
        );
    }

    function fetchAttributeNodeDetails(baseURL, attributeName, attributeValue, callback, errcallback) {
        if (!baseURL) baseURL = baseUrl;
        var data = JSON.stringify({
            attributeName : attributeName,
            attributeValue : attributeValue
        });
        rest.post(baseURL + "rest/graph/attributenode",
            data,
            "Get attribute node data for name/value pair",
            callback,
            errcallback
        );
    }

    var COLUMN_WIDTH = aperture.config.get()['xdataht.config']['explorer']['column_width'];
    var SANKEY_WIDTH = aperture.config.get()['xdataht.config']['explorer']['sankey_width'];
    var COLUMN_PADDING = aperture.config.get()['xdataht.config']['explorer']['column_padding'];


    return {
        create : function(explorerWidget,initialClusterIds,index,onReady) {

            var _clusters = [];
            var _idToCluster = {};
            var _idToDetails = {};
            var allClusterIds = {};
            var _clusterProcessId = null;
            var _attributeNodeProcessId = null;
            var _sankey;
            var _element = null;
            var _onClusterLoaded;
            var _container = explorerWidget.graphCanvas;


            /**
             * Forward column ready message to the workspace.  Called when placeholders
             * are visible in the column and cluster details begin to load in.
             */
            function onColumnReady() {
                if (onReady) {
                    onReady(column);
                }
            }

            /**
             * Column interface
             */
            var column = {

                objectType : 'column',
                index : index,

                /**
                 * Initialize the column by fetching summaries about the clusters, once they
                 * come back, get the full details
                 */
                initialize : function() {
                    explorerWidget.toggleAjaxLoader();

                    // Create the container for the column and position it within the container
                    _element = $('<div/>')
                        .addClass('explorer-column')
                        .width(COLUMN_WIDTH)
                        .css({
                            'padding-left:' : COLUMN_PADDING + 'px',
                            left : index * (COLUMN_WIDTH + SANKEY_WIDTH + 2*COLUMN_PADDING)
                        })
                        .appendTo(_container);

                    // Create the sankey for the column
                    _sankey = Sankey.create(_element);
                    _sankey.css({
                        left : COLUMN_WIDTH + COLUMN_PADDING
                    });

                    // Add the clusters asynchonously
                    if (initialClusterIds) {
                        var clusterIds = [];
                        var attributeNodeIds = [];
                        initialClusterIds.forEach(function(id) {
                            if (id.toString().indexOf('attributeNode') !== -1) {
                                attributeNodeIds.push(id);
                            } else {
                                clusterIds.push(id);
                            }
                        });
                        if (clusterIds.length) {
                            column.addClusters(clusterIds, onColumnReady);
                        }
                        if (attributeNodeIds.length) {
                            column.addAttributeNodes(attributeNodeIds,onColumnReady);
                        }

                    }
                },

                /**
                 * Remove this column from the graph widget
                 */
                destroy : function() {
                    column.stopPendingRequests();
                    _sankey.destroy();
                    _element.remove();
                },

                /**
                 * Update the column.   Redraw sankeys
                 */
                update: function () {
                    _sankey.update();
                },

                addAttributeNodes : function(attributeNodeIds, onColumnVisible) {
                    attributeNodeIds.forEach(function(id) {
                        allClusterIds[id] = true;
                    });

                    // Create placeholders
                    attributeNodeIds.forEach(function(attributeNodeId) {
                        var attributeNameValue = explorerWidget.getAttributeNameValueFromId(attributeNodeId);
                        var label = attributeNameValue.attributeName + ' : ' + attributeNameValue.attributeValue;
                        var adCount = 1;        // TODO:  this is really unknown and expensive to count.   Any better way?
                        var summary = {
                            clustername : label,
                            label : label,
                            adCount : adCount,
                            clusterid : attributeNodeId
                        };
                        var attributeNode = column.addAttributeNode(summary);
                        _idToCluster[attributeNodeId] = attributeNode;
                        _element.append(attributeNode.getElement());
                    });

                    onColumnVisible();

                    // Now fetch the details for all our summaries and update the clusters as they come in
                    _attributeNodeProcessId = Process.each(attributeNodeIds,function(attributeNodeId,processNext) {

                        var attrNameVal = explorerWidget.getAttributeNameValueFromId(attributeNodeId);

                        fetchAttributeNodeDetails(explorerWidget.baseUrl, attrNameVal.attributeName, attrNameVal.attributeValue, function (response) {
                            if (Process.isActive(_attributeNodeProcessId)) {

                                var cluster = column.getCluster(attributeNodeId);
                                cluster.update(response);
                                _idToDetails[cluster.getId()] = response;

                                if (_onClusterLoaded) {
                                    _onClusterLoaded(column,cluster);
                                }

                                processNext();
                            }
                        }, null);
                    });

                },

                addTipNode : function(attributeNodeDetails) {
                    var attributeNode = this.addAttributeNode(attributeNodeDetails);

                    attributeNode.update(attributeNodeDetails);

                    _idToDetails[attributeNode.getId()] = attributeNodeDetails;

                    if (_onClusterLoaded) {
                        _onClusterLoaded(column,attributeNode);
                    }
                },

                addAttributeNode : function(attributeNodeSumary) {
                    var attributeNode = Cluster.create(explorerWidget,column,attributeNodeSumary, true);


                    _clusters.push(attributeNode);
                    _element.append(attributeNode.getElement());
                    _idToCluster[attributeNode.getId()] = attributeNode;
                    allClusterIds[attributeNode.getId()] = true;

                    return attributeNode;
                },

                /**
                 * Adds a cluster to the column given a cluster summary
                 * @param clustersummary
                 */
                addCluster: function (clustersummary) {
                    var id = clustersummary.clusterid;

                    var cluster = Cluster.create(explorerWidget,column,clustersummary);

                    _clusters.push(cluster);
                    _idToCluster[id] = cluster;
                    return cluster;
                },

                /**
                 * Asynchronously add clusters given a list of cluster ids
                 * @param clusterIds
                 */
                addClusters : function(clusterIds, onColumnVisible) {

                    clusterIds.forEach(function(id) {
                        allClusterIds[id] = true;
                    });


                    fetchClusterSummaries(explorerWidget.baseUrl, clusterIds, function(summaries) {
                        explorerWidget.toggleAjaxLoader();

                        // Add placeholders that will get replaced when the details come in
                        summaries.forEach(function (clustersummary) {
                            var cluster = column.addCluster(clustersummary);
                            _element.append(cluster.getElement());
                        });

                        onColumnVisible();

                        // Now fetch the details for all our summaries and update the clusters as they come in
                        _clusterProcessId = Process.each(summaries,function(clustersummary,onComplete) {
                            fetchClusterDetails(explorerWidget.baseUrl, clustersummary.clusterid, 'org', function (response) {
                                if (Process.isActive(_clusterProcessId)) {

                                    var cluster = column.getCluster(clustersummary.clusterid);
                                    cluster.update(response);
                                    _idToDetails[cluster.getId()] = response;

                                    if (_onClusterLoaded) {
                                        _onClusterLoaded(column,cluster);
                                    }

                                    onComplete();
                                }
                            }, null);
                        });
                    });
                },

                stopPendingRequests : function() {
                    if (_clusterProcessId != null) {
                        Process.cancel(_clusterProcessId);
                        _clusterProcessId = null;
                    }
                    if (_attributeNodeProcessId != null) {
                        Process.cancel(_attributeNodeProcessId);
                        _attributeNodeProcessId = null;
                    }
                },

                /**
                 * Removes a cluster from the column by clusterid
                 * @param clusterid
                 */
                removeCluster: function (clusterid) {
                    var idx = -1;
                    for (var i = 0; i < _clusters.length; i++) {
                        if (_clusters[i].getId() === clusterid) {
                            idx = i;
                            break;
                        }
                    }
                    if (idx != -1) {
                        var removed = _clusters.splice(idx, 1)[0];
                        removed.getElement().remove();
                        delete _idToCluster[clusterid];
                        delete _idToDetails[clusterid];
                        delete allClusterIds[clusterid];
                    }
                },

                /**
                 * Gets a cluster object by clusterid
                 * @param clusterid
                 * @returns {*}
                 */
                getCluster: function (clusterid) {
                    return _idToCluster[clusterid];
                },

                /**
                 * Gets a cluster object by order in the column
                 * @param idx
                 * @returns {*}
                 */
                getClusterByIndex: function(idx) {
                    if (_clusters.length > idx) {
                        return _clusters[idx];
                    }
                },

                getClusters : function() {
                    return _clusters;
                },

                /**
                 * Returns the index of the column in the graph widget
                 * @returns {*}
                 */
                getIndex : function() {
                    return index;
                },

                /**
                 * Returns the ids for the outgoing links in this column
                 * @returns {*}
                 */
                getLinkIds : function() {
                    return _sankey.getIds();
                },

                /**
                 * Sets onClusterLoaded handler for the column
                 * @param handler
                 * @returns this
                 */
                onClusterLoaded : function(handler) {
                    _onClusterLoaded = handler;
                    return column;
                },


                updateLink : function(id,sourceOffsets,targetOffsets,strokeStyle,highlighted) {
                    return _sankey.updateLink(id,sourceOffsets,targetOffsets,strokeStyle,highlighted);
                },

                /**
                 * Adds a set of links to the column.  3 cases:
                 *      1)  one source, multiple targets
                 *      2)  multiple sources, one target
                 *      3)  equal number of sources and targets
                 * @param sourceOffsets - list of (x,y) positions relative to column for sources
                 * @param targetOffsets - list of (x,y) positions relative to column for targets
                 * @param strokeStyle - (optional) stroke style for the sankey
                 * @returns link id for set
                 */
                addLink : function(sourceOffsets,targetOffsets,strokeStyle,zOrder) {
                    return _sankey.add(sourceOffsets,targetOffsets,strokeStyle,zOrder);
                },

                addHighlight : function(sourceOffset,targetOffset) {
                    return _sankey.highlight(sourceOffset,targetOffset);
                },

                clearHighlight : function() {
                    _sankey.unhighlight();
                },



                /**
                 * Removes a set of links given the id returned from addLink
                 * @param linkid
                 */
                removeLink : function(linkid) {
                    _sankey.remove(linkid);
                },

                /**
                 * Remove all the links from the column and return ids for the links we got rid of
                 * @returns {Array|*}
                 */
                removeAllLinks : function() {
                    return _sankey.removeAll();
                },

                /**
                 * Returns a map of all contained cluster ids in this column
                 */
                getClusterIds : function() {
                    return allClusterIds;
                },

                /**
                 * Returns true if this column contains a cluster with the given id.   May or may not have details
                 * loaded for that cluster
                 * @param clusterId
                 * @returns {boolean}
                 */
                contains : function(clusterId) {
                    return _idToCluster[clusterId] !== undefined;
                },

                /**
                 * Set all visible cluster ids
                 * @param visibleClusterIds
                 */
                updateBranchHandles : function(visibleClusterIds) {
                    _clusters.forEach(function(c) {
                        c.updateBranchHandles(visibleClusterIds);
                    });
                },

                /**
                 * Get/set the height of the sankey.   Width is never modified
                 * @param height
                 * @returns {*}
                 */
                height : function(height) {
                    if (height) {
                        _sankey.height(height);
                        return column;
                    } else {
                        return _element.height();
                    }
                },

                /**
                 * Returns the details response from the server for a given cluster id.  Null if it doesn't exist
                 * @param clusterid
                 * @returns {*|null}
                 */
                getClusterDetails : function(clusterid,callback) {
                    if (_idToDetails[clusterid]) {
                        callback(_idToDetails[clusterid]);
                    } else {
                        explorerWidget.fetchClusterId(null,clusterid,'org',function(details) {
                            callback(details);
                        });
                    }

                }
            };


            column.initialize();

            return column;
        }
    }
});