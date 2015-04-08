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
define(['../util/rest', '../util/image_dialog', './explorerclusterattribute','../util/menu', './events', '../util/colors'], function(rest,image_dialog,ClusterAttribute,Menu,Events,Colors) {
    return {
        create : function(explorerwidget,explorercolumn,summary,bAttributeMode) {

            var _element;           // base jquery element for cluster
            var _detailsElement;    // details jquery element container
            var _attributes = {};

            /**
             * Update the alternating grid lines on our cluster
             */
            function updateGridLines() {
                var visibleRows = _element.find('.explorer-node-attribute-row');
                var visibleIdx = 0;
                $.each(visibleRows,function(idx,rowEl) {
                    var row = $(rowEl);
                    if (!row.is(':visible')) {
                        return;
                    }
                    if (visibleIdx%2==0) {
                        row.removeClass('explorer-node-attribute-row-odd');
                        row.addClass('explorer-node-attribute-row-even');
                    } else {
                        row.removeClass('explorer-node-attribute-row-even');
                        row.addClass('explorer-node-attribute-row-odd');
                    }
                    visibleIdx++;
                });
            }

            var onImageContextClick = function(e) {
                var url = $(this).attr('src');
                e.preventDefault();
                Menu.createContextMenu(e, [
                    {type: 'action',
                        label:'Open Exemplar in New Tab',
                        callback:function() {
                            window.open(url, '_blank');
                        }
                    }
                ]);
            };

            var onClusterContextClick = function(e) {

                function getUrl(callback) {
                    var url = explorerwidget.baseUrl + 'graph.html?';
                    var args = '';
                    if (cluster.objectType === 'attributeNode') {

                        if (cluster.getId() != -1) {

                            var nameValPair = explorerwidget.getAttributeNameValueFromId(cluster.getId());
                            if (nameValPair.attributeName !== 'images') {
                                explorerwidget.getRawAttributeId(nameValPair.attributeName,nameValPair.attributeValue,function(id) {
                                    args += 'attributeid=' + id + '&explorer=false';
                                    callback(url + args);
                                });
                            } else {
                                alert('Operation not supported on images.');
                                callback(null);
                            }

                        } else {
                            alert('Operation not supported on tips.');
                            callback(null);
                        }
                    } else {
                        args += 'clusterid=' + cluster.getId() + '&explorer=false';
                        callback(url + args);
                    }
                    args += '';
                }



                e.preventDefault();
                Menu.createContextMenu(e, [
                    {type: 'action',
                        label:'Open "' + cluster.clusterName + '" in graph view',
                        callback:function() {
                            getUrl(function(url) {
                                if (url) {
                                    window.open(url, '_blank');
                                }
                            });
                        }
                    }
                ]);
            };

            var cluster = {
                objectType : bAttributeMode ? 'attributeNode' : 'cluster',
                clusterName : summary.clustername,

                initialize : function() {

                    _element = $('<div/>')
                        .addClass('explorer-node')
                        .addClass('explorer-node-placeholder')
                        .mouseenter(function() {
                            Events.publish(Events.topics.MOUSE_OVER_NODE,{
                                column : explorercolumn,
                                cluster : cluster
                            });
                        })
                        .mouseleave(function() {
                            Events.publish(Events.topics.MOUSE_OUT_NODE,{
                                column : explorercolumn,
                                cluster : cluster
                            });
                        })
                        .attr('id',summary.clusterid)
                        .bind('contextmenu',onClusterContextClick);


                    // Add the label from the summary
                    $('<div/>')
                        .addClass('explorer-node-label')
                        .html(summary.clustername)
                        .click(function() {
                            Events.publish(Events.topics.SELECT_NODE, {
                                column : explorercolumn,
                                cluster : cluster
                            });
                        })
                        .appendTo(_element);

                    _detailsElement = $('<div/>')
                        .appendTo(_element);



                    this.bindEventHandlers();

                },

                bindEventHandlers : function() {
                    Events.subscribe(Events.topics.EXPAND_ROW,updateGridLines,cluster);
                    Events.subscribe(Events.topics.COLLAPSE_ROW,updateGridLines,cluster);
                    Events.subscribe(Events.topics.SHOW_MORE,updateGridLines,cluster);
                },

                getElement : function() {
                    return _element;
                },

                /**
                 * Updates the cluster with details fetched from the server
                 * @param details - full details of cluster
                 */
                update : function(details) {
                    _element.removeClass('explorer-node-placeholder');
                    _detailsElement.empty();
                    _attributes = {};

                    // Insert the images.  Add placeholders and then fetch the urls from
                    // the server.
                    var images = details.attributes.images;
                    if (images && images.length>0) {

                        var imagesDiv = $('<div/>')
                            .addClass('explorer-node-images')
                            .appendTo(_detailsElement);


                        images.sort(function(a,b) { return b.count-a.count;});

                        var NUM_EXEMPLARS = 4;
                        for (var i=0; i<NUM_EXEMPLARS && i<images.length; i++) {
                            (function(bin) {
                                // Add placeholders for the images
                                var imageDiv = $('<div/>')
                                    .addClass('explorer-node-image')
                                    .css({
                                        width : Math.floor(100/NUM_EXEMPLARS) + '%',
                                        'background-image' : 'url(./img/ajaxLoader.gif)'
                                    })
                                    .appendTo(imagesDiv);


                                rest.get(explorerwidget.baseUrl + 'rest/imagehash/exemplar/'+bin, 'Fetch image bin exemplar',
                                    function(response) {
                                        if (response.images && response.images.length>0) {
                                            imageDiv.bind('contextmenu',onImageContextClick);
                                            imageDiv
                                                .attr('src',response.images[0].url)
                                                .css({
                                                    '-webkit-filter' : (amplify.store('tableBlur') ? 'blur(10px)' : ''),
                                                    'background-image' : 'url(' + response.images[0].url + ')'
                                                })
                                                .addClass('img-dialog');

                                            // Update the large image dialog on mouseover
                                            var $dialog;
                                            imageDiv.mouseover(function(event) {
                                                var width = $(window).width() - explorerwidget.graphCanvas.width() - 5.4;
                                                $dialog = image_dialog.showImageDialog(response.images[0].url, width);
                                            });
                                            imageDiv.mouseout(function(event) {
                                                $dialog.dialog('close').remove();
                                                aperture.tooltip.hideTooltip();
                                            });
                                        }
                                    }
                                );
                            })(images[i].bin);
                        }
                    }

                    // Create the ad count element
                    if (details['adcount']) {
                        var text = 'Ads in cluster: ' + details['adcount'];
                        $('<div/>')
                            .addClass('explorer-node-attribute-header')
                            .text(text)
                            .attr('title',text)
                            .appendTo(_detailsElement);
                    }

                    // Create each attribute row
                    if (details.attributes) {
                        //we want the attributes to appear in this order
                        var attributeNames = [ 'email', 'phone', 'website', 'images'];
                        for (var j = 0; j<attributeNames.length; j++) {
                            var attributeName = attributeNames[j];
                            var attributeValues = details.attributes[attributeName];
                            var attributeLinks = details.attributes[attributeName + '_links'];
                            if (attributeValues) {

                                var attributeRow = ClusterAttribute.create(explorerwidget,explorercolumn,cluster,attributeName,attributeValues,attributeLinks,bAttributeMode);

                                _attributes[attributeName] = attributeRow;
                                _detailsElement.append(attributeRow.getElement());
                            }
                        }
                        updateGridLines();
                    }
                    return cluster;
                },

                /**
                 * Updates the visible/total counts on the branch handles
                 * @param allClusterIds - a list of all clusterIds that are visible in the graph
                 */
                updateBranchHandles : function(allClusterIds) {
                    for (var key in _attributes) {
                        if (_attributes.hasOwnProperty(key)) {
                            var row = _attributes[key];
                            row.updateBranchHandle(allClusterIds);
                        }
                    }
                },

                getAttributeValues : function(attributeName) {
                    return _attributes[attributeName] ? _attributes[attributeName].values() : [];
                },

                getAttributeNames : function() {
                    return Object.keys(_attributes);
                },

                isAttributeExpanded : function(attributeName) {
                    return _attributes[attributeName].isExpanded();
                },

                /**
                 * Returns the offset (top,left) of an attribute name/value pair.
                 * If the attribute isn't visible, it returns the offset of the
                 * header element
                 * @param attributeName
                 * @param attributeValue
                 */
                getRowOffset : function(attributeName,attributeValue) {
                    var attribute = _attributes[attributeName];
                    return attribute.getLinkOffsets(attributeValue);
                },

                hasAttributeValue : function(attributeName, attributeValue) {
                    var values = this.getAttributeValues(attributeName);
                    for (var i = 0; i < values.length; i++) {
                        var val = values[i].value ? values[i].value : values[i].bin;
                        if (val === attributeValue) {
                            return true;
                        }
                    }
                    return false;
                },

                getId : function() {
                    return summary.clusterid;
                },

                getName : function() {
                    return summary.name;
                },

                select : function() {
                    _element.css({'border-color':'#C2C'});
                },
                deselect : function() {
                    _element.css({'border-color':''});
                },
                setAttributeSelection : function(attributeName,attributeValue) {
                    if (this.hasAttributeValue(attributeName,attributeValue)) {
                        _element.addClass('explorer-node-highlighted');
                        if (_attributes[attributeName]) {
                            _attributes[attributeName].setAttributeSelection(attributeValue);
                        }
                    }
                },
                clearAttributeSelection : function() {
                    if (_element.hasClass('explorer-node-highlighted')) {
                        _element.removeClass('explorer-node-highlighted');
                        Object.keys(_attributes).forEach(function(attributeName) {
                            _attributes[attributeName].clearAttributeSelection();
                        });
                    }
                }
            };
            cluster.initialize();
            return cluster;
        }
    }
});