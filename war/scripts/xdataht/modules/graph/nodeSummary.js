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
define([ '../util/ui_util', '../util/rest', '../util/colors'], function( ui_util, rest, colors) {

    var createWidget = function(appwidget, container, baseUrl, spec) {

        var _element = container;
        var dropTarget = null;

        /**
         * Adds a row to the summary
         * @param label - string
         * @param value - string
         * @returns {*|jQuery} - element of row
         * @private
         */
        var _add = function(label,value,attributesContainer) {
            if (!value) {
                return;
            }

            var rowElement = $('<div/>')
                .addClass('node-summary-row');

            if (label) {
                $('<span/>')
                    .addClass('node-summary-row-label')
                    .html(label + ' : ')
                    .appendTo(rowElement);
            }

            $('<span/>')
                .addClass('node-summary-row-value')
                .text(value)
                .appendTo(rowElement);

            attributesContainer?attributesContainer.append(rowElement):_element.append(rowElement);

            return rowElement;
        };

        /**
         * Adds a list of attributes
         * @param label - title for list
         * @param values - triple { label, name, value }
         * @private
         */
        var _addAttributeList = function(label,values) {
            if (!values || values.length === 0) {
                return;
            }

            var header = $('<div/>')
                .css('clear','left')
                .appendTo(_element);

            var openCloseIcon = $('<div/>')
                .addClass('node-summary-list-header')
                .addClass('ui-icon')
                .addClass('ui-icon-triangle-1-e')
                .appendTo(header);

            var headerLabel = $('<div/>')
                .addClass('node-summary-list-header')
                .html(label + ' (' + values.length + '):')
                .appendTo(header);

            var attributesContainer = $('<div/>')
                .css('display','none')
                .css('clear','left')
                .appendTo(_element);

            header[0].icon = openCloseIcon;
            header[0].attributesContainer = attributesContainer;
            header[0].collapsed = true;

                header.click(function() {
                    var icon = this.icon;
                    var attributesContainer = this.attributesContainer;
                    var collapsed = !this.collapsed;

                    this.collapsed = collapsed;

                    if(collapsed) {
                        attributesContainer.css('display','none');
                        icon.removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
                    } else {
                        attributesContainer.css('display','');
                        icon.removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-s');
                    }

                }).mouseover(function() {
                    $(this).css('cursor','pointer');
                }).mouseout(function() {
                    $(this).css('cursor','');
                });
            values.forEach(function(labelValuePair) {
                var attributeName = labelValuePair.name;
                var attributeValue = labelValuePair.value;

                var row = _add(labelValuePair.label,attributeValue,attributesContainer)
                    .addClass('node-summary-list-row');

                row.find('.node-summary-row-label')
                    .addClass('node-summary-list-label');

                row.find('.node-summary-row-value')
                    .addClass('node-summary-list-row-value')
                    .attr('attributename',attributeName)
                    .attr('attributevalue',attributeValue)
                    .attr('type','attribute')
                    .mouseover(function() {
                        $(this).css({'background-color': colors.SUMMARY_HOVER});
                    })
                    .mouseout(function() {
                        $(this).css({'background-color': ''});
                    }).draggable({
                        opacity: 0,
                        appendTo: 'body',
                        containment: 'window',
                        scroll: false,
                        helper: function() {
                            return $('<span>').text(attributeValue);
                        },
                        start: function () {
                            if (!dropTarget) {
                                dropTarget = appwidget.sidePanels['buildCase'].widget.dropTarget;
                            }
                            appwidget.sidePanels['buildCase'].canvas.append(dropTarget);
                        },
                        stop: function () {
                            dropTarget.remove();
                        }
                    })
                    .data('data',{
                        summary : {
                            attribute: attributeName,
                            value: attributeValue,
                            contents: null
                        }
                    })
                    .bind('dblclick', function () {
                        _openAttribute(attributeName,attributeValue);
                    });
            });
        };

        var _openAttribute = function(attributeName,attributeValue) {
            rest.get(baseUrl + 'rest/attributeDetails/getattrid/' + attributeName + '/' + encodeURIComponent(attributeValue),
                "get Attribute ID",
                function(attributeId) {
                    var caseId = ui_util.getParameter('case_id');
                    var explorer = ui_util.getParameter('explorer');
                    var url = baseUrl + 'graph.html?attributeid=' + attributeId;
                    if (caseId) {
                        url += '&case_id=' + caseId;
                    }
                    if (explorer) {
                        url += '&explorer=' + explorer;
                    }
                    window.open(url, '_self');
                }
            );
        };


        var widgetObj = {

            init: function() {
                //container.empty();

                _element.addClass('node-summary')
                    .addClass('noselect');

                if (spec) {
                    this.set(spec);
                }
                //this.resize(container.width(),container.height());
            },

            set : function(spec) {
                _element.empty();

                _add('ID',spec.id);
                _add('Name',spec.name);
                _add('Label',spec.label);
                _add('Cluster Size',spec.size);
                _add('Latest Ad',spec.latestAd);

                if (spec.attributes) {
                    for(var i = 0; i<spec.attributeOrder.length; i++) {
                        var attributeLabel = spec.attributeOrder[i];
                        var attributes = spec.attributes[attributeLabel];
                        if(!attributes) {
                            continue;
                        }
                        var labelValues = attributes.map(function(top) {
                            return {
                                label : top.count,
                                value : top.value,
                                name : top.name
                            };
                        });

                        _addAttributeList(attributeLabel,labelValues);
                    }
                }

                if (spec.linkReasons) {
                    // TODO:
                }
            },
            resize: function(width,height) {
                var bottomPadding = 5;
                _element.width(width).height(height-bottomPadding);
            }


        };
        widgetObj.init();
        return widgetObj;
    };

    return {
        createWidget:createWidget
    }
});