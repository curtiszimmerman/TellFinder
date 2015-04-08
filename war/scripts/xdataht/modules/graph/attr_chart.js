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
define([ '../util/ui_util', '../util/colors'], function( ui_util, colors) {
    var ATTR_COLUMN_HEADER_HEIGHT = 30;
    var ATTR_HEADER_HEIGHT = 18;
    var ATTR_BARCHART_HEIGHT = 12;
    var ATTR_DIST_CHART_SPACING = 3;
    var CHART_HORIZ_MARGIN = 7;
    var EXPANSION_BUTTON_WIDTH = 10;
    var ATTR_VALUE_CHART_INDENT = 10;
    var SCROLLBAR_WIDTH = 17;

    var STRONG_ATTRS = ['phone','name','email','websites','phone_numbers','rb_inbox'];
    var WEAK_ATTRS = ['city','age','ethnicity','eye_color','hair_color','build','cup','location','imageFeatures'];
    var ATTR_NAMES = {
    		phone: 'Phone Numbers',
    		name: 'Names',
    		email: 'Emails',
    		websites: 'Websites',
    		phone_numbers: 'Phone Numbers',
    		rb_inbox: 'Redbook Inboxes',
    		city: 'Cities',
    		age: 'Ages',
    		ethnicity: 'Ethnicities',
    		eye_color: 'Eye Colors',
    		hair_color: 'Hair Colors',
    		build: 'Builds',
    		cup: 'Cup Sizes',
    		location: 'Locations',
			imageFeatures: 'Image Features'
    };
    var MISSING_ATTR_VAL = 'none';

    var insert_array = function(original_array, new_values, insert_index) {
        for (var i=0; i<new_values.length; i++) {
            original_array.splice((insert_index + i), 0, new_values[i]);
        }
        return original_array;
    };

    var incrementAttrValueCount = function(attr, attrCounts, attrVal, qty) {
    	if (!attrCounts.hasOwnProperty(attrVal)) {
        	attrCounts[attrVal] = 0;
        }
        attrCounts[attrVal] += qty;
        return attrCounts[attrVal];
    };

    // Collect up a count of each distinct value for attribute 'attr' and sort by descending frequency
    var getAttrValueDist = function(attr, dataRows, filteredAdIds) {
        var attrCounts = {};
        var foundValidValue = false;
        for (var i=0; i<dataRows.length; i++) {

            if (filteredAdIds.indexOf(dataRows[i]['id']) == -1 && filteredAdIds.length != 0) {
                continue;
            }

            var ad = dataRows[i];
            var attrVal = ad[attr];

            // TODO: Refine what counts as missing.
            if (attrVal === null || attrVal === undefined || attrVal === '' || attrVal === 'EMPTY') {
                attrVal = MISSING_ATTR_VAL;
            } else {
            	foundValidValue = true;
            }

            var vals = attrVal.split(',');
            for (var j=0; j<vals.length; j++) {
            	var val = vals[j];
                if ( (attr=='websites') && 
                		( (val.indexOf('backpage')>0)||
                			(val.indexOf('craigslist')>0)||
                			(val.indexOf('myproviderguide')>0) ) ) {
                	continue;
                }
            	incrementAttrValueCount(attr, attrCounts, val, 1);
            }
        }
        if (!foundValidValue) return null;
        
        var attrValsArray = [];
        var totalCount = 0;
        for (var key in attrCounts) {
            if (attrCounts.hasOwnProperty(key)) {
                var attrCount = attrCounts[key];
                totalCount += attrCount;
                attrValsArray.push({
                    attrValue: key,
                    count: attrCount
                })
            }
        }

        for (i=0; i<attrValsArray.length; i++) {
            var attrValEntry = attrValsArray[i];
            attrValEntry.proportion = attrValEntry.count/totalCount;
        }

        attrValsArray.sort(function(a,b) {
            return b.count-a.count;
        });

        return attrValsArray;
    };

    var getColorMapping = function(attrValueDist) {
        // Build an Aperture color mapping
        var attrVals = [];
        var attrColors = [];

        for (var i=0; i<attrValueDist.length; i++) {
            var attrValEntry = attrValueDist[i];
            attrVals.push(attrValEntry.attrValue);
            attrColors.push(computeAttrColor(attrValEntry.attrValue, i));
        }

        return new aperture.Ordinal('fill', attrVals).mapKey(attrColors);
    };

    var computeAttrColor = function(attrValue, attrIndex) {
        var color = colors.BARCHART_MISSING_DATA;
        if (attrValue !== MISSING_ATTR_VAL) {
        	color = colors.getBarchartColor(attrIndex);
        }
        return color;
    };

    var createAttrDistChart = function(containerDiv, top, left, attr, attrValueDist, colorMapping,
                                       expandCtrl) {
        if (attr === MISSING_ATTR_VAL) attr = 'N/A';

        var mainDiv = $('<div/>');
        mainDiv.css({position: 'absolute',
            left: left+'px',
            right: '0px',
            top: top+'px',
            overflow: 'hidden',
            marginLeft: CHART_HORIZ_MARGIN+'px',
            marginRight: CHART_HORIZ_MARGIN+'px',
            height: ATTR_HEADER_HEIGHT+ATTR_BARCHART_HEIGHT+'px'
        });
        containerDiv.append(mainDiv);

        //
        // Create the header bar
        //
        var headerDiv = $('<div/>');
        mainDiv.append(headerDiv);
        headerDiv.css({position: 'absolute',
            left: '0px',
            right: '0px',
            top: '0px',
            overflow: 'hidden',
            height: ATTR_HEADER_HEIGHT+'px'
        });
        var ctrlDiv = null;
        if (expandCtrl) {
            ctrlDiv = $('<div/>');
            ctrlDiv.css({
                cursor: 'default',
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: EXPANSION_BUTTON_WIDTH+'px',
                overflow: 'hidden',
                bottom: '0px'
            }).text('+');
            headerDiv.append(ctrlDiv);
            ctrlDiv.expState = 'collapsed';
        }
        var attrLabelDiv = $('<div/>');

        var attrLabelText = ATTR_NAMES[attr];
        if (!attrLabelText) attrLabelText = attr;
        
        if (!expandCtrl) {
            // for attribute value entries, show a tooltip
            var titleOver = function(event) {
                aperture.tooltip.showTooltip({event:{source:event}, html:attrLabelText});
            };
            var titleOut = function(event) {
                aperture.tooltip.hideTooltip();
            };

            attrLabelDiv.mouseover(titleOver);
            attrLabelDiv.mouseout(titleOut);
        }

        attrLabelDiv.addClass('ellipsis');
        attrLabelDiv.css({
            position: 'absolute',
            left: (expandCtrl?EXPANSION_BUTTON_WIDTH:0)+'px',
            top: '0px',
            right: '0px',
            bottom: '0px',
            overflow: 'hidden'
        }).text(attrLabelText);
        headerDiv.append(attrLabelDiv);

        //
        // Create the Aperture bar chart.
        //
        var chartDiv = $('<div/>', {id:ui_util.uuid()});
        mainDiv.append(chartDiv);
        chartDiv.css({position: 'absolute',
            left: '0px',
            right: '0px',
            bottom: '0px',
            overflow: 'hidden',
            height: ATTR_BARCHART_HEIGHT+'px'
        });

        // Aperture-ify the data structure
        var data = {
            series: []
        };

        for (var i=0; i<attrValueDist.length; i++) {
            var attrValEntry = attrValueDist[i];
            data.series.push(attrValEntry);
        }

        var rangeX = new aperture.Scalar('x', [0,1]);
        var rangeY = new aperture.Scalar('y', [1,0]);
        
        chartDiv.on('mouseover', function(event) {
            var tooltipText = '<B>Distribution of ' + attrLabelText + '</B><BR/>';
        	for (var i=0; i<data.series.length; i++) {
        		var d = data.series[i];
        		tooltipText += d.attrValue + ': ' + d.count + '<BR/>';
        	}
    		aperture.tooltip.showTooltip({event:{source:event}, html:tooltipText});
        });
        chartDiv.on('mouseout', function(event) {
    		aperture.tooltip.hideTooltip();
        });

        var barchart = new aperture.chart.Chart(chartDiv.get(0).id);
        barchart.all(data);
        barchart.map('width').asValue(mainDiv.width());
        barchart.map('height').asValue(ATTR_BARCHART_HEIGHT);
        barchart.map('x').using(rangeX.mapKey([0,1]));
        barchart.map('y').using(rangeY.mapKey([1,0]));
        barchart.map('border-width').asValue(0);
        barchart.map('background-color').asValue('none');

        var bar = barchart.addLayer( aperture.chart.BarSeriesLayer );
        bar.all(function(data){
            return data.series;
        });
        bar.map('x').from('proportion');
        bar.map('y').asValue(0.5);
        bar.map('point-count').asValue(1);
        bar.map('stroke-width').asValue(0);
        bar.map('border-width').asValue(0);
        bar.map('bar-layout').asValue('stacked');
        bar.map('orientation').asValue('horizontal');
        bar.map('fill').from(function(index) {
            return this.attrValue;
        }).using(colorMapping);

        barchart.all().redraw();

        return {
            attr: attr,
            chart: barchart,
            div: mainDiv,
            ctrlDiv: ctrlDiv
        };
    };

    var createWidget = function(container, data) {
        var widgetObj = {
            strongAttrsDiv:null,
            weakAttrsDiv:null,
            strongChartEntries:[],
            weakChartEntries:[],
            width: null,
            height: null,
            filteredAdIds : [],
            init: function() {
                // TODO: Strong/Weak classification provided by server
                this.width = container.width();
                this.height = container.height();

                var colWidth = this.width/2;
                this.strongAttrsDiv = $('<div/>');
                this.strongAttrsDiv.css({
                        position: 'absolute',
                        top: '0px',
                        left: '0px',
                        width: colWidth
                });
                container.append(this.strongAttrsDiv);

                this.weakAttrsDiv = $('<div/>');
                this.weakAttrsDiv.css({
                    position: 'absolute',
                    top: '0px',
                    left: colWidth+'px',
                    width: colWidth
                });
                container.append(this.weakAttrsDiv);


                this.createAttrDistBlock(this.weakAttrsDiv, WEAK_ATTRS, this.weakChartEntries);
                this.createAttrDistBlock(this.strongAttrsDiv, STRONG_ATTRS, this.strongChartEntries);
            },

            selectionChanged: function(selectedAdIdArray) {
                if (!selectedAdIdArray || selectedAdIdArray.length == 0) {
                    that.filteredAdIds = [];
                } else {
                    that.filteredAdIds = selectedAdIdArray;
                }
                that.weakAttrsDiv.empty();
                that.weakChartEntries = [];
                that.createAttrDistBlock(that.weakAttrsDiv, WEAK_ATTRS, that.weakChartEntries);

                that.strongAttrsDiv.empty();
                that.strongChartEntries = [];
                that.createAttrDistBlock(that.strongAttrsDiv, STRONG_ATTRS, that.strongChartEntries);
            },

            createAttrDistBlock: function(containerDiv, attrs, chartEntries) {
                var that = this;
                var currTop = 0;
                for (var i=0; i<attrs.length; i++) {
                    var attr = attrs[i];
                    var attrValueDist = getAttrValueDist(attr, data, this.filteredAdIds);
                    if (attrValueDist==null) continue;
                    var colorMapping = getColorMapping(attrValueDist);
                    var chartEntry = createAttrDistChart(containerDiv, currTop, 0, attr, attrValueDist, colorMapping, true);
                    chartEntries.push(chartEntry);

                    (function(_chartEntry, _attr, _attrValueDist) {

                        var expandCollapseFn =  function() {
                            var ourIndex = 0,
								j;
                            for (j=0; j<chartEntries.length; j++) {
                                var entry = chartEntries[j];
                                if (entry.attr === _attr) break;
                                ++ourIndex;
                            }

                            var chartEntryHeight = $(_chartEntry.div).height()+ATTR_DIST_CHART_SPACING;
                            var currTopY = (ourIndex+1)*chartEntryHeight;

                            if (_chartEntry.ctrlDiv.expState === 'expanded') {
                                _chartEntry.ctrlDiv.expState = 'collapsed';
                                _chartEntry.ctrlDiv.innerHTML = '+';

                                var elementsRemaining = _attrValueDist.length;
                                var index = ourIndex+1;
                                while (elementsRemaining) {
                                    chartEntries[index++].div.remove();
                                    --elementsRemaining;
                                }

                                chartEntries.splice(ourIndex+1, _attrValueDist.length);

                                // Re-position elements below our removed sub charts
                                for (j=ourIndex+1; j<chartEntries.length; j++) {
                                    $(chartEntries[j].div).css({
                                        top: currTopY + 'px'
                                    });
                                    currTopY += chartEntryHeight;
                                }
                            } else {
                                _chartEntry.ctrlDiv.expState = 'expanded';
                                _chartEntry.ctrlDiv.innerHTML = '-';

                                var newSubCharts = [];
                                for (j=0; j<_attrValueDist.length; j++) {
                                    var attrEntry = _attrValueDist[j];
                                    var cm = new aperture.Ordinal('fill',
                                        [attrEntry.attrValue]).mapKey([computeAttrColor(attrEntry.attrValue, j)]);

                                    var subChartEntry = createAttrDistChart(containerDiv, currTopY, ATTR_VALUE_CHART_INDENT,
                                        attrEntry.attrValue, [attrEntry], cm, false);
                                    newSubCharts.push(subChartEntry);

                                    currTopY += chartEntryHeight;
                                }

                                // Re-position elements below our new sub charts
                                for (j=ourIndex+1; j<chartEntries.length; j++) {
                                    $(chartEntries[j].div).css({
                                        top: currTopY + 'px'
                                    });
                                    currTopY += chartEntryHeight;
                                }

                                insert_array(chartEntries, newSubCharts, ourIndex+1);
                            }
                            that.resize(that.width, that.height);
                        };

                        $(_chartEntry.div).click(expandCollapseFn).css('cursor','pointer');


                    }(chartEntry, attr, attrValueDist));

                    currTop += $(chartEntry.div).height()+ATTR_DIST_CHART_SPACING;
                }
            },

            resizeCharts: function(charts, width) {
                for (var i=0; i<charts.length; i++) {
                    var chartEntry = charts[i];
                    var chartWidth = width-2*CHART_HORIZ_MARGIN;
                    if (!chartEntry.ctrlDiv) chartWidth -= ATTR_VALUE_CHART_INDENT;
                    chartEntry.chart.map('width').asValue(Math.round(chartWidth));
                    chartEntry.chart.all().redraw();
                }
            },

            calcColumnHeight: function(charts) {
                var height = 0;
                for (var i=0; i<charts.length; i++) {
                    var chartEntry = charts[i];
                    height += $(chartEntry.div).height()+ATTR_DIST_CHART_SPACING;
                }
                return height;
            },

            resize: function(width, height) {
                this.width = width;
                this.height = height;

                var containerHeight = $(container).height();
                var maxColHeight = ATTR_COLUMN_HEADER_HEIGHT + Math.max(this.calcColumnHeight(this.strongChartEntries),
                    this.calcColumnHeight(this.weakChartEntries));

                var colWidth = width/2;
                if (maxColHeight > containerHeight) {
                    colWidth -= SCROLLBAR_WIDTH/2; // TODO: Calculate this width to be more precise.
                }

                $(this.strongAttrsDiv).width(colWidth);
                $(this.weakAttrsDiv).css({
                    width: colWidth,
                    left: colWidth
                });
                this.resizeCharts(this.strongChartEntries, colWidth);
                this.resizeCharts(this.weakChartEntries, colWidth);
            },

            destroy: function() {
                this.filteredAdIds = [];
            }
        };
        widgetObj.init();
        return widgetObj;
    };

    return {
        createWidget:createWidget
    }
});