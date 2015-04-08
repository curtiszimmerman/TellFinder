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
define([ './util/ui_util'], function( ui_util) {
    var incrementBucket = function(data, bin, qty, log) {
        if (!data.hasOwnProperty(bin)) {
            data[bin] = 0;
//            if (log) {
//                console.log("Bin doesn't exist.")
//            }
        }
        data[bin] += qty;
        return data[bin];
    }

    var createWidget = function(container, dataRows) {
        var barChartWidget = {
            init: function() {
                if (!dataRows) return;

                this.chartDiv = document.createElement('div');
                container.appendChild(this.chartDiv);
                $(this.chartDiv).css({position: 'absolute',
                    left: '0px',
                    top: '0px',
                    right: '0px',
                    bottom: '0px'
                });
                this.chartDiv.id = ui_util.uuid();

                // Pull time from the field 'post_time': "Jan. 9 2013, 7:46 pm"
                var dateIdx = null;
                var attributes = dataRows[0];
                for (var i=0; i<attributes.length; i++) {
                    if (attributes[i] === 'post_time') {
                        dateIdx = i;
                        break;
                    }
                }

                if (!dateIdx) {
                    console.log("Couldn't find column post_time."); // TODO: Cross-browser?
                    return;
                }

                var minTime = null;
                var maxTime = null;
                var timeEntries = [];
                for (var i=1; i<dataRows.length; i++) {
                    var row = dataRows[i];
                    // TODO: Can probably just pull directly from 'post_time'
                    var dateString = row[dateIdx].replace('\"', '');

//                    console.log(dateString);

                    var time = Date.parse(dateString); // TODO: Cross-browser?
                    timeEntries.push(time);
                    if (minTime==null || time<minTime) minTime = time;
                    if (maxTime==null || time>maxTime) maxTime = time;
                }

                // TODO: For now, produce a 'magic' number of time buckets.
                var range = maxTime - minTime;
                var bucketPeriod = Math.round(range/7);

//                var perInDays = bucketPeriod/(1000*60*60*24);
//                console.log("Bucket period (days):"+perInDays);

                var dataMap = {};
                var rangeX = new aperture.TimeScalar('time');
                var rangeY = new aperture.Scalar('count');

                // Initialize bucket range with zeros
                var currBucket = Math.floor((minTime/bucketPeriod)) * bucketPeriod;
                var lastBucket = Math.floor((maxTime/bucketPeriod)) * bucketPeriod;
                rangeX.expand(currBucket);

                while (currBucket<=lastBucket) {
//                    var currBucketTime = new Date(currBucket);
//                    console.log("Bucket start: "+currBucketTime);
                    incrementBucket(dataMap, currBucket+ Math.round(bucketPeriod/2.0), 0);
                    currBucket += bucketPeriod;
                }

                rangeX.expand(currBucket);

                // Bucket by the given range
                for (var i=0; i<timeEntries.length; i++) {
                    var bucket = Math.floor((timeEntries[i]/bucketPeriod)) * bucketPeriod + Math.round(bucketPeriod/2.0);
                    var newVal = incrementBucket(dataMap, bucket, 1, true);
                    rangeY.expand(newVal);
                }

                var dataArray = [];
                for (var prop in dataMap) {
                    if (dataMap.hasOwnProperty(prop)) {
                        dataArray.push({time:Number(prop), count:dataMap[prop]});
                    }
                }

                var data = {data:dataArray};
                rangeY.expand(0);
                rangeY.expand(rangeY.get()[1]*1.1);

                var barchart = new aperture.chart.Chart(this.chartDiv.id);
                barchart.all(data);
                barchart.map('width').asValue($(container).width());
                barchart.map('height').asValue($(container).height());
                barchart.map('x').using(rangeX.mapKey([0,1]));
                barchart.map('y').using(rangeY.mapKey([1,0]));
                barchart.map('border-width').asValue(0);
                barchart.map('background-color').asValue('none');

//                barchart.xAxis().mapAll({
//                    'title' : 'Time',
//                    'margin' : 40,
//                    'visible' : true,
//                    'label-offset-y' : -5,
//                    'tick-length' : 10,
//                    'stroke' : '#000',
//                    'rule-width': 1 // Draw the x-axis line.
//                });
//
//                barchart.yAxis().mapAll({
//                    'title' : 'Ad Count',
//                    'margin' : 40,
//                    'tick-length' : 10,
//                    'visible' : true,
//                    'stroke' : '#000',
//                    'label-offset-x' : 2
//                });

                var barSeries = barchart.addLayer(aperture.chart.BarSeriesLayer);
                barSeries.map('x').from('data[].time');
                barSeries.map('y').from('data[].count');
                barSeries.map('stroke').asValue('#C7C7C7');
                barSeries.map('fill').asValue('#FEABB9');
                barSeries.map('spacer').asValue(40); // TODO: This has no effect.
                barSeries.map('point-count').from('data.length');

                barchart.all().redraw();
            },

            resize: function(width, height) {
                // TODO
            }
        };
        barChartWidget.init();
        return barChartWidget;
    };

    return {
        createWidget:createWidget
    }
});