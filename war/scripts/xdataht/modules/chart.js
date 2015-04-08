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
define([ './util/ui_util', './util/rest'], function( ui_util, rest) {
	var getAttributeDistribution = function(baseUrl, datasetName, attributeName, callback){
		rest.get(baseUrl + 'rest/data/distribution/'+datasetName+'/'+attributeName, 'Get distribution', callback)
	};

    var fetchDBInfo = function(baseURL, callback) {
        rest.get(baseURL + "rest/data/clusterSets", 'Get initial DB info', callback);
    };

	var createAttributeRow = function(widget, baseUrl) {
        var datasetName = widget.datasetDropdown.val();
		var columns = widget.datasetToColumnNames[datasetName];
		var rowObject = {};
		rowObject.attributeDiv = document.createElement('div');
		rowObject.chartDiv = document.createElement('div');
		$(rowObject.chartDiv).css({width:600,height:100});
		rowObject.chartDiv.id = ui_util.uuid();
		rowObject.dropdown = ui_util.createDropdown(columns, 200, function() {
			$(rowObject.chartDiv).empty();
			if (rowObject.dropdown.value=='NONE') {
				return;
			}
	        var datasetName = widget.datasetDropdown.val();
			getAttributeDistribution(baseUrl, datasetName, rowObject.dropdown.value, function(data) {
				updateRowChart(rowObject, data);
			});
		});
		rowObject.attributeDiv.appendChild(document.createTextNode('Attribute:'));
		rowObject.attributeDiv.appendChild(rowObject.dropdown);
		var removeButton = document.createElement("button");
		removeButton.innerHTML = 'x';
		$(removeButton).click(function() {
			widget.attributeArea.removeChild(rowObject.attributeDiv);
			widget.attributeRows.remove(rowObject);
		}).css({position:'absolute',left:'580px'});
		rowObject.attributeDiv.appendChild(removeButton);
		rowObject.attributeDiv.appendChild(rowObject.chartDiv);
		rowObject.textNode = document.createElement('div');
		rowObject.attributeDiv.appendChild(rowObject.textNode);
		widget.attributeArea.appendChild(rowObject.attributeDiv);
	    return rowObject;
	};
	
	var updateAttributeRows = function(widget, datasetName) {
		var columns = widget.datasetToColumnNames[datasetName];
		for (var i=0; i<widget.attributeRows.length; i++) {
			var rowObject = widget.attributeRows[i];
			ui_util.setDropdownOptions(rowObject.dropdown, columns);
		}
	};
	
	var updateRowChart = function(rowObject, data) {
		rowObject.chart = new aperture.chart.Chart(rowObject.chartDiv.id);
		rowObject.chart.map('width').asValue(600);
		rowObject.chart.map('height').asValue(100);

		var rangeX = new aperture.Scalar('Cluster Size');
		var rangeY = new aperture.Scalar('Number of Clusters');

		var maxSize = 0;
		var clusterCount = 0;
		for (var i = 0; i < data.distribution.length; i++) {
            var xVal = data.distribution[i].size;
            var yVal = data.distribution[i].clusters;
            if (xVal>maxSize) maxSize = xVal;
            clusterCount += yVal;

            rangeX.expand(xVal);
            rangeY.expand(yVal);
        }
		rangeY.expand(0);

        rowObject.textNode.innerHTML = 'Largest Cluster: ' + maxSize + ' Total Clusters: ' + clusterCount;
		var bandedX = rangeX.banded(10);
	    var bandedY = rangeY.banded(4);
	    var xMapping = bandedX.mapKey([0,1]), yMapping = bandedY.mapKey([1,0]);
	    rowObject.chart.map('x').using(xMapping);
	    rowObject.chart.map('y').using(yMapping);
	    rowObject.chart.all(data);
	    createAxes(rowObject.chart);

	    var dotLayer = rowObject.chart.addLayer( aperture.RadialLayer );
	    dotLayer.all(data.distribution);
	    dotLayer.map('x').from('size');
	    dotLayer.map('y').from('clusters');
	    dotLayer.map('stroke-width').asValue(1);
	    dotLayer.map('stroke').asValue('#000');
	    dotLayer.map('fill').asValue('#F00');
	    dotLayer.map('radius').asValue(3);
	    rowObject.chart.all().redraw();
	};
	
	var createAxes = function(chart){
	    var xAxisLayer = chart.xAxis(0);
	    xAxisLayer.map('margin').asValue(40);
	    xAxisLayer.map('title').asValue('Cluster Size');
	    xAxisLayer.map('font-size').asValue(10); // Set the font size of the axes text.

	    var yAxisLayer = chart.yAxis(0);
	    yAxisLayer.map('title').asValue('Cluster Count');
	    yAxisLayer.map('margin').asValue(50);
	    yAxisLayer.map('font-size').asValue(10); // Set the font size of the axes text.
	    yAxisLayer.map('label-offset-x').asValue(2);
	};
	
	var createWidget = function(container, baseUrl) {
		var chartWidget = {
			attributeRows: [],
			datasetDropdown: null,
			attributeArea: null,
			datasetToColumnNames: {},
			init: function() {
				var datasetLabel = document.createTextNode("Dataset Name:");
				container.appendChild(datasetLabel);

				this.datasetDropdown = $('<select/>');
                this.datasetDropdown.change(function(event) {
                    var datasetName = $(event.currentTarget).val();
                    updateAttributeRows(that, datasetName);
                });
				container.appendChild(this.datasetDropdown.get(0));

				var linkButton = document.createElement("button");
				linkButton.innerHTML = 'links';
				$(linkButton).click(function() {
					window.location.assign(baseUrl + '#link');
					window.location.reload(true);
				});
				container.appendChild(linkButton);
				
				var searchButton = document.createElement("button");
				searchButton.innerHTML = 'search';
				$(searchButton).click(function() {
					window.location.assign(baseUrl + '#subset');
					window.location.reload(true);
				});
				container.appendChild(searchButton);
				
				this.attributeArea = document.createElement('div');
				container.appendChild(this.attributeArea);

				var that = this;
				
				var addButton = document.createElement("button");
				addButton.innerHTML = '+';
				$(addButton).click(function() {
					that.createAttributeRow();
				});
				container.appendChild(addButton);

				fetchDBInfo(baseUrl, function(response) {
                    that.datasetDropdown.empty();
					for (var i=0; i < response.tableToColumns.length; i++) {
	                    tableName = response.tableToColumns[i].string;
	                    that.datasetToColumnNames[tableName] = response.tableToColumns[i].list;

	                    var option = $('<option/>');
                        option.attr('value',tableName);
                        option.html(tableName);
                        that.datasetDropdown.append(option);
	                }
					updateAttributeRows(that, that.datasetDropdown.val());
				});
			},
			createAttributeRow: function() {
				var rowObject = createAttributeRow(this, baseUrl);
				this.attributeRows.push(rowObject);
			},
			
			resize: function(width,height) {
				
			}
		};
		chartWidget.init();
		return chartWidget;
	};
	
	return {
		createWidget:createWidget
	}
});
