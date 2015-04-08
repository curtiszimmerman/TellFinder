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
define(['../util/rest', '../util/image_dialog', '../util/colors', '../util/ui_util', '../util/menu', './events'], function(rest,image_dialog,Colors,Util,Menu,Events) {

    var COLUMN_WIDTH = aperture.config.get()['xdataht.config']['explorer']['column_width'];
    var SANKEY_WIDTH = aperture.config.get()['xdataht.config']['explorer']['sankey_width'];

    var TOOLTIP_WARNING_BRANCH_COUNT = aperture.config.get()['xdataht.config']['explorer']['tooltip_warning_branch_count'];
    var DIALOG_WARNING_BRANCH_COUNT = aperture.config.get()['xdataht.config']['explorer']['dialog_warning_branch_count'];


    return {
        create : function(explorerwidget,column, cluster, attributeName,attributeValues,attributeLinks,bAttributeMode) {

            var LOAD_INTERVAL = 20;
            var _element = $('<div/>').addClass('explorer-cluster-attribute-row-container');
            var _listVisible = false;
            var _index;
            var _imageMap;          // maps bin # to image url
            var _branchMap = {};    // maps div id of expansion element to a list of target cluster ids
            var _branchIdToValues = {};

            var dropTarget;

            var _branchButton;
            var _attributeBranchButtonMap = {};

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

            /**
             * Handler for adding more attributes to the list.
             * @param addRow - add row function
             * @param container - the attribute list container
             */
            var onShowMore = function(addRow,container) {
                var i = _index + 1;
                var count = 1;

                // Remove 'show more' from container
                $(this).detach();

                // Add next LOAD_INTERVAL items
                for (i; i < attributeValues.length; i++) {
                    addRow(attributeValues[i]);
                    if(++count>LOAD_INTERVAL) break;
                }

                // Read 'show more' if necessary
                if(i<attributeValues.length) {
                    _index = i;
                    $(this).appendTo(container);
                }

                Events.publish(Events.topics.SHOW_MORE, {
                    column : column,
                    cluster : cluster,
                    attributeName : attributeName,
                    attributeValues : attributeValues
                });

            };

            /**
             * Show a warning dialog before we commit to branching on an attribute
             * @param anchorElement - the element around which to display the dialog
             * @param count - the number of branch targets
             * @param onOk - the function to execute upon clicking 'ok'
             */
            var showWarningDialog = function(anchorElement,count,onOk) {



                $('<div/>')
                    .text('Are you sure you want to load ' + count + ' entities? This operation is resource intensive and not recommended.')
                    .attr('title', 'WARNING')
                    .css({
                        position: 'relative',
                        width: '100%'
                    })
                    .dialog({
                        resizeable: false,
                        width: '300px',
                        modal: true,
                        position: {
                            my: 'center left',
                            at: 'right center',
                            of: anchorElement
                        },
                        buttons: {
                            Cancel: function () {
                                $(this).remove();
                            },
                            OK: function () {
                                onOk();
                                $(this).remove();
                            }
                        },
                        show: {
                            effect: "fade",
                            duration: 250
                        },
                        hide: {
                            effect: "fade",
                            duration: 250
                        }
                    });
            };


            /**
             * Creates the branch button element for a row
             * @param id -
             * @param attributeValues
             * @param attributeLinks
             * @param bImageExpand
             * @returns {*|jQuery}
             */
            var createBranchHandle = function(id,attributeValues,attributeLinks,bImageExpand,bIsHeader) {
                var element = $('<div/>')
                    .addClass('explorer-node-attribute-expand-button')
                    .css('left',COLUMN_WIDTH + 'px')
                    .css('background-color',Colors.ARROWS)
                    .attr('id',id);

                var totalBranchTargets = attributeLinks ? attributeLinks.length : attributeValues.length;

                function getTitleText() {
                    var titleText;
                    var aName = attributeName;
                    if (bImageExpand) aName = 'image';

                    var remainingTargets = totalBranchTargets - getNumVisibleClusterIds();
                    var sAction = remainingTargets > 0 ? 'open' : 'close';

                    if (bAttributeMode) {
                        if (bIsHeader) {
                            titleText = 'Click to ' + sAction + ' all nodes for these ' + aName + 's';
                        } else {
                            titleText = 'Click to ' + sAction + ' a node for this ' + aName;
                        }
                    } else {
                        if (bIsHeader) {
                            titleText = 'Click to ' + sAction + ' ' + totalBranchTargets + ' node' + ((totalBranchTargets > 1) ? 's' : '') + ' containing these ' + aName + 's.';
                        } else {
                            titleText = 'Click to ' + sAction + ' ' + totalBranchTargets + ' node' + ((totalBranchTargets > 1) ? 's' : '') + ' containing this ' + aName + '.';
                        }
                    }
                    if (totalBranchTargets >= TOOLTIP_WARNING_BRANCH_COUNT) {
                        titleText += '\n' + 'WARNING:  Branching on this attribute could be a lengthy operation and is not reccomended.';
                    }
                    return titleText;
                }
                element.attr('title',getTitleText());

                function getNumVisibleClusterIds() {
                    var allClusterIds = explorerwidget.getClusterIds();
                    var visibleClusterIds = 0;
                    if (attributeLinks) {
                        attributeLinks.forEach(function (id) {
                            if (allClusterIds[id]) {
                                visibleClusterIds++;
                            }
                        });
                    } else {
                        var attributeIds = attributeValues.map(function (attributeValue) {
                            return explorerwidget.getAttributeNodeId(attributeName, attributeValue);
                        });
                        attributeIds.forEach(function (id) {
                            if (allClusterIds[id]) {
                                visibleClusterIds++;
                            }
                        });
                    }
                    return visibleClusterIds;
                }



                element.click(function() {
                    var that = this;
                    var remainingTargets = totalBranchTargets - getNumVisibleClusterIds();

                    function doBranch() {
                        var branchTopic = cluster.objectType === 'attributeNode' ? Events.topics.BRANCH_ATTRIBUTE : Events.topics.BRANCH_CLUSTER;
                        Events.publish(branchTopic, {
                            column : column,
                            cluster : cluster,
                            attributeName : attributeName,
                            attributeValues : attributeValues,
                            attributeLinks : attributeLinks
                        });
                    }


                    if (remainingTargets >= DIALOG_WARNING_BRANCH_COUNT) {
                        showWarningDialog(this,remainingTargets, function() {
                            doBranch();
                        });
                    } else if (remainingTargets>0) {
                        doBranch();
                    } else {
                        Events.publish(Events.topics.PRUNE,{
                            column : column,
                            cluster : cluster,
                            attributeName : attributeName,
                            attributeValues : attributeValues,
                            branchTargets : _branchMap[$(this).attr('id')]
                        });
                    }
                    return false;
               });



                // Create the label
                $('<span/>')
                    .addClass('explorer-arrow-text')
                    .text('(' + getNumVisibleClusterIds() + '/' + totalBranchTargets + ')')
                    .appendTo(element);

                // Add a + to indicate we can branch
                //$('<span/>')
                //    .addClass('explorer-arrow-plus')
                //    .text('+')
                //    .appendTo(element);

                if (bImageExpand) {
                    element.addClass('explorer-node-attribute-expand-image-button');
                }
                return element;
            };

            /**
             * Create a list of image attributes
             * @param container
             */
            var addImageValuesToAttributeList = function(container) {
                var $more = $('<div/>')
                        .addClass('explorer-node-attribute-row')
                        .addClass('explorer-node-attribute-row-show-more')
                        .text('more...')
                        .click(function() {
                            onShowMore.call(this,addRow,container);
                        }),
                    addRow = function(val) {
                        var valueDiv = $('<div/>')
                            .addClass('explorer-node-attribute-row')
                            .addClass('explorer-node-image-value')
                            .attr('attrvalue',val.bin)
                            .click(function() {
                                Events.publish(Events.topics.SELECT_ATTRIBUTE,{
                                    column : column,
                                    cluster : cluster,
                                    attributeName : attributeName,
                                    attributeValue : val
                                });
                            })
                            .mouseover(function() {
                                Events.publish(Events.topics.MOUSE_OVER_ATTRIBUTE,{
                                    column : column,
                                    cluster : cluster,
                                    attributeName : attributeName,
                                    attributeValues : [val]
                                });
                            })
                            .mouseout(function() {
                                Events.publish(Events.topics.MOUSE_OUT_ATTRIBUTE,{
                                    column : column,
                                    cluster : cluster,
                                    attributeName : attributeName,
                                    attributeValues : [val]
                                });
                            });

                        var valueLabelDiv = $('<div/>')
                                .addClass('explorer-node-value-label')
                                .text((val.count === "")? '�':val.count)
                                .attr('title',val.count);

                        container.append(valueDiv);

                        valueDiv.append(valueLabelDiv);

                        // TODO:   make this an 'unknown' image so we can remove the ajax spinner
                        var imgUrl = _imageMap[val.bin] ? _imageMap[val.bin].url : '';

                        var imageDiv = document.createElement('div');

                        $(imageDiv).attr('src',imgUrl);
                        $(imageDiv).bind('contextmenu',onImageContextClick);


                        imageDiv.style.width = '25px';
                        imageDiv.style.height = '25px';
                        imageDiv.style.backgroundImage = 'url(' + imgUrl + ')';
                        imageDiv.style['-webkit-filter'] = amplify.store('tableBlur') ? 'blur(10px)' : '';
                        imageDiv.className = 'img-dialog .image_'+val.bin+ ' explorer-node-attribute-row-image';
                        valueDiv.append($('<div/>').css({'text-align':'left',width:'calc(100% - 55px)',float:'left'}).append(imageDiv));

                        var $dialog;
                        imageDiv.onmouseenter = function(event) {
                            var width = $(window).width() - explorerwidget.graphCanvas.width() - 5.4;
                            $dialog = image_dialog.showImageDialog(imgUrl, width);
                        };
                        imageDiv.onmouseleave = function(event) {
                            $dialog.dialog('close').remove();
                            aperture.tooltip.hideTooltip();
                        };

                        if ((val.links && val.links.length)||bAttributeMode) {
                            var branchId = Util.uuid();

                            _attributeBranchButtonMap[branchId] = createBranchHandle(branchId,[val],val.links,true,false)
                                .appendTo(valueDiv);

                            _branchMap[branchId] = val.links;
                            _branchIdToValues[branchId] = [val];
                        }
                    };

                var binMap = {};
                var binArray = [];
                attributeValues.forEach(function(image) {
                    if (!binArray[image.bin]) {
                        binMap[image.bin] = true;
                        binArray.push(image.bin);
                    }
                });
                rest.post(
                    explorerwidget.baseUrl + 'rest/imagehash/exemplars',
                    binArray,
                    'get image exemplars at once',
                    function(response) {
                        _imageMap = response;
                        for (var i = 0; i < Math.min(LOAD_INTERVAL, attributeValues.length); i++) {
                            addRow(attributeValues[i]);
                        }
                        if(i<attributeValues.length) {
                            _index = i;
                            container.append($more);
                        }
                    }
                );
            };

            /**
             * Create a list of text attributes (phone email,website)
             * @param container
             */
            var addValuesToAttributeList = function(container) {
                var $more = $('<div/>')
                        .addClass('explorer-node-attribute-row')
                        .addClass('explorer-node-attribute-row-show-more')
                        .text('more...')
                        .click(function() {
                            onShowMore.call(this,addRow,container);
                        }),
                    addRow = function (val) {

                        var valueContainer = $('<div/>').addClass('explorer-node-attribute-row');
                        valueContainer.attr('attrvalue',val.value);
                        valueContainer.click(function() {
                            Events.publish(Events.topics.SELECT_ATTRIBUTE,{
                                column : column,
                                cluster : cluster,
                                attributeName : attributeName,
                                attributeValue : val
                            });
                        });
                        valueContainer.mouseenter(function() {
                            Events.publish(Events.topics.MOUSE_OVER_ATTRIBUTE,{
                                column : column,
                                cluster : cluster,
                                attributeName : attributeName,
                                attributeValues : [val]
                            });
                        });
                        valueContainer.mouseleave(function() {
                            Events.publish(Events.topics.MOUSE_OUT_ATTRIBUTE,{
                                column : column,
                                cluster : cluster,
                                attributeName : attributeName,
                                attributeValues : [val]
                            });
                        });

                        var stringValue = val.value !== undefined ? val.value : val.bin;
                        valueContainer.draggable({
                            opacity: 0,
                            appendTo: 'body',
                            containment: 'window',
                            scroll: false,
                            helper: function() {
                                return $('<span>').text(stringValue);
                            },
                            start: function () {
                                if (!dropTarget) {
                                    dropTarget = explorerwidget.getSidePanel('buildCase').widget.dropTarget;
                                }

                                explorerwidget.getSidePanel('buildCase').canvas.append(dropTarget);
                            },
                            stop: function () {
                                dropTarget.remove();
                                dropTarget = null;
                            }
                        }).data('data',{
                            summary : {
                                attribute: attributeName,
                                value: stringValue,
                                contents: null
                            }
                        });

                        container.append(valueContainer);

                        // Create the label
                        $('<div/>')
                            .addClass('explorer-node-value-label')
                            .text((val.count === "")? '�':val.count)
                            .attr('title',val.count)
                            .appendTo(valueContainer);

                        // Create the value
                        $('<div/>')
                            .addClass('explorer-node-value-value')
                            .text(val.value)
                            .attr('title',val.value)
                            .appendTo(valueContainer);


                        // Create the branch button
                        if ((val.links && val.links.length)||bAttributeMode) {
                            var branchId = Util.uuid();
                            _attributeBranchButtonMap[branchId] = createBranchHandle(branchId,[val],val.links,false,false)
                                .appendTo(valueContainer);

                            _branchMap[branchId] = val.links;
                            _branchIdToValues[branchId] = [val];
                        }
                    };
                for (var i = 0; i < Math.min(LOAD_INTERVAL, attributeValues.length); i++) {
                    addRow(attributeValues[i]);
                }
                if(i<attributeValues.length) {
                    _index = i;
                    container.append($more);
                }
            };

            var attribute = {

                objectType : 'clusterAttribute',

                // For debugging
                attributeName : attributeName,
                attributeValues : attributeValues,
                attributeLinks : attributeLinks,

                /**
                 * Create the attribute row header and expansion list
                 */
                initialize : function() {
                    if (attributeValues && attributeValues.length > 0) {

                        var attrHeaderDiv = $('<div/>')
                            .addClass('explorer-node-attribute-header')
                            .addClass('explorer-node-attribute-row')
                            .mouseenter(function() {
                                Events.publish(Events.topics.MOUSE_OVER_ATTRIBUTE,{
                                    column : column,
                                    cluster : cluster,
                                    attributeName : attributeName,
                                    attributeValues : attributeValues
                                });
                            })
                            .mouseleave(function() {
                                Events.publish(Events.topics.MOUSE_OUT_ATTRIBUTE,{
                                    column : column,
                                    cluster : cluster,
                                    attributeName : attributeName,
                                    attributeValues : attributeValues
                                });
                            });
                        _element.append(attrHeaderDiv);


                        var openCloseIcon = $('<div/>')
                            .addClass('explorer-node-attribute-row-icon')
                            .addClass('ui-icon')
                            .addClass('ui-icon-triangle-1-e')
                            .appendTo(attrHeaderDiv);

                        var toggleList = function () {
                            _listVisible = !_listVisible;
                            if(_listVisible) {
                                openCloseIcon.removeClass('ui-icon-triangle-1-e');
                                openCloseIcon.addClass('ui-icon-triangle-1-s');
                                attrListDiv.show(ANIMATE_DIV_TIME, function() {
                                    Events.publish(Events.topics.EXPAND_ROW,{
                                        column : column,
                                        cluster : cluster,
                                        attributeName : attributeName,
                                        attributeValues : attributeValues,
                                        element : $(this).find('.explorer-node-attribute-row')
                                    });
                                });
                            }
                            else {
                                openCloseIcon.addClass('ui-icon-triangle-1-e');
                                openCloseIcon.removeClass('ui-icon-triangle-1-s');
                                attrListDiv.hide(ANIMATE_DIV_TIME, function() {
                                    Events.publish(Events.topics.COLLAPSE_ROW,{
                                        column : column,
                                        cluster : cluster,
                                        attributeName : attributeName,
                                        attributeValues : attributeValues,
                                        element : $(this).find('.explorer-node-attribute-row')
                                    });
                                });
                            }
                        };
                        
                        var attrText = attributeName.trim() + ' (' + attributeValues.length + ')';
                        var attrTextDiv = $('<div/>')
                            .addClass('explorer-node-attribute-text')
                            .text(attrText);

                        attrHeaderDiv.append(attrTextDiv);
                        var attrListDiv = $('<div/>')
                            .addClass('explorer-node-attribute-list')
                            .css({
                                display: 'none'
                            });

                        _element.append(attrListDiv);
                        if ((attributeLinks && attributeLinks.length)||bAttributeMode) {

                            // Create parent branch button
                            var branchId = Util.uuid();
                            _branchButton = createBranchHandle(branchId,attributeValues,attributeLinks,false,true)
                                .appendTo(attrHeaderDiv);

                            _branchMap[branchId] = attributeLinks;
                            _branchIdToValues[branchId] = attributeValues;
                        }

                        if (attributeName === 'images'){
                            addImageValuesToAttributeList(attrListDiv);
                        } else {
                            addValuesToAttributeList(attrListDiv);
                        }

                        _listVisible = false;
                        var ANIMATE_DIV_TIME = 100;
                        openCloseIcon.click(toggleList);
                        attrTextDiv.click(toggleList);
                    }
                },

                /**
                 * Get element containing everything
                 * @returns {*|jQuery|HTMLElement}
                 */
                getElement : function() {
                    return _element;
                },

                getHeader : function() {
                    return _element.find('.explorer-node-attribute-header');
                },

                /**
                 * Gets the source/target offsets for the header element of this attribute
                 * @returns {{source: {left: number, top: number}, target: {left: *, top: number}}}
                 */
                getHeaderOffsets : function() {
                    var headerElement = this.getHeader();
                    var headerOffset = headerElement.offset();

                    return {
                        source : {
                            left : 0,
                            top : headerOffset.top - (headerElement.height()/2)
                        },
                        target : {
                            left : SANKEY_WIDTH,
                            top : headerOffset.top - (headerElement.height()/2)
                        }
                    };
                },

                /**
                 * Gets the offsets (source and target) of the link points for
                 * the given attribute value.   If it's not visible, return the
                 * offsets for the header
                 * @param value - the attribute value to find
                 * @returns {
                 *      source : { top : Number, left : Number },
                 *      target : { top : Number, left : Number }
                 *  }
                 */
                getLinkOffsets : function(value) {
                    if (!_listVisible) {

                        // If list isn't visible, link to the header
                        return attribute.getHeaderOffsets();
                    } else {

                        var targetRow = this.getElementForValue(value);
                        var offset = targetRow.offset();
                        return {
                            source : {
                                top : offset.top - targetRow.height() / 2 ,
                                left : 0
                            },
                            target : {
                                top : offset.top - targetRow.height() / 2 ,
                                left : SANKEY_WIDTH
                            }
                        };
                    }
                },

                /**
                 * Returns the HTML element row for a given attribute value
                 * @param value - the raw string value
                 * @returns {*}
                 */
                getElementForValue : function(value) {
                    if (!_listVisible) {

                        // If list isn't visible, link to the header
                        return this.getHeader();
                    } else {

                        // If we can't find the row, link to the "more" element as we need to expand to see it
                        var targetRow = null;
                        var targetRows = _element.find('.explorer-node-attribute-row');
                        for (var i = 0; i < targetRows.length; i++) {
                            var row = targetRows[i];

                            if ($(row).hasClass('.explorer-node-attribute-header')) {
                                continue;
                            }

                            var rowVal = $(row).attr('attrvalue');
                            var valueVal;
                            if (value.value !== undefined || value.bin !== undefined) {
                                valueVal = (value.value !== undefined) ? value.value : value.bin;
                            } else {
                                valueVal = value;
                            }
                            if (rowVal == valueVal) {
                                targetRow = $(row);
                                break;
                            }
                        }


                        if (!targetRow || targetRow.length === 0) {
                            targetRow = _element.find('.explorer-node-attribute-row-show-more');
                        }

                        return targetRow;
                    }
                },

                isExpanded : function() {
                    return _listVisible;
                },


                /**
                 * Update the counts on branch handles
                 * @param allClusterIds
                 */
                updateBranchHandle : function(allClusterIds) {
                    if (_branchButton) {
                        var expandButtonTargets = _branchMap[_branchButton.attr('id')];

                        if (bAttributeMode) {
                            expandButtonTargets = this.attributeValues.map(function(value) {
                                return explorerwidget.getAttributeNodeId(attributeName,value);
                            });
                        }

                        if (expandButtonTargets) {
                            var visibleTargets = 0;
                            expandButtonTargets.forEach(function(id) {
                                if (allClusterIds[id]) {
                                    visibleTargets++;
                                }
                            });
                            _branchButton.find('.explorer-arrow-text')
                                .text('(' + visibleTargets + '/' + expandButtonTargets.length + ')');
                        }
                    }
                    for (var key in _attributeBranchButtonMap) {
                        if (_attributeBranchButtonMap.hasOwnProperty(key)) {
                            var attributeExpandButton = _attributeBranchButtonMap[key];
                            var expandButtonTargets = _branchMap[attributeExpandButton.attr('id')];

                            if (bAttributeMode) {
                                var values = _branchIdToValues[key];

                                expandButtonTargets = values.map(function(value) {
                                    return explorerwidget.getAttributeNodeId(attributeName,value);
                                });
                            }

                            if (expandButtonTargets) {
                                var visibleTargets = 0;
                                expandButtonTargets.forEach(function(id) {
                                    if (allClusterIds[id]) {
                                        visibleTargets++;
                                    }
                                });
                                attributeExpandButton.find('.explorer-arrow-text')
                                    .text('(' + visibleTargets + '/' + expandButtonTargets.length + ')');
                            }
                        }
                    }
                },

                values : function() {
                    return attributeValues;
                },

                name : function() {
                    return name;
                },

                setAttributeSelection : function(attributeValue) {
                    var element = this.getElementForValue(attributeValue);
                    element.addClass('explorer-node-attribute-row-highlighted');
                },

                clearAttributeSelection : function() {
                    _element.find('.explorer-node-attribute-row').removeClass('explorer-node-attribute-row-highlighted');
                }
            };

            attribute.initialize();
            return attribute;
        }
    }
});