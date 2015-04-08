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
define([ './util/rest', './util/ui_util', './graph/table', './graph/timeline'], function( rest, ui_util, table, timeline) {
    var COMPARATOR_DROPDOWN_CONTENTS = ['less than',
                                        'greater than',
                                        'greater than or equal to',
                                        'less than or equal to',
                                        'equals',
                                        'not equals',
                                        'contains'];
    var CUSTOM_SEARCH_CRITERIA = ["Cluster Size", "tag"];

	var getAttributeList = function(baseURL, datasetName, callback) {
        rest.get(baseURL + "rest/data/attributes/" + datasetName, 'Get attributes', callback);
	};

	var getAttributeValues = function(baseURL, datasetName, attributeName, callback){
        rest.get(baseURL + "rest/data/values/" + datasetName + "/" + attributeName, 'Get values', callback);
	};

	var searchClusters = function(baseURL, datasetName, outputName, filters, callback){
        rest.post(baseURL + "rest/search", 
        		{ datasetName : datasetName, outputName : outputName, filters: filters}, 
        		"Search ads", callback, false);
	};

	
    var createFilterRow = function(widget) {
        var rowObject = {};
        rowObject.type = "filter";
        rowObject.attributeDiv = $('<div/>');

        var attributeDropdownContents = widget.attributes.slice(0);
        for (var i = 0; i < CUSTOM_SEARCH_CRITERIA.length; i++) {
            attributeDropdownContents.unshift(CUSTOM_SEARCH_CRITERIA[i]);
        }
        rowObject.attributeDropdown = ui_util.createDropdown(attributeDropdownContents, 90, function(event) {});
        rowObject.attributeDiv.append(rowObject.attributeDropdown);
        rowObject.attributeDropdown.value = 'name';

        rowObject.conditionDropdown = ui_util.createDropdown(COMPARATOR_DROPDOWN_CONTENTS, 90, function(event){});
        rowObject.attributeDiv.append(rowObject.conditionDropdown);
        rowObject.conditionDropdown.value = 'contains';

        rowObject.inputBox = $('<input/>');
        rowObject.inputBox.css({left:'180px',right:'30px',position:'absolute'});
        rowObject.attributeDiv.append(rowObject.inputBox);

        var removeButton = $('<button/>');
        removeButton.text('x');
        removeButton.click(function() {
            rowObject.attributeDiv.remove();
            var rmIdx = widget.attributeRows.indexOf(rowObject);
            widget.attributeRows.splice(rmIdx, 1);
        }).css({position:'absolute',right:'0px'});
        rowObject.attributeDiv.append(removeButton);
        widget.attributeArea.appendChild(rowObject.attributeDiv.get(0));
        return rowObject;
    };
	
	var updateAttributeRows = function(widget) {
		for (var i=0; i<widget.attributeRows.length; i++) {
			var rowObject = widget.attributeRows[i];
			ui_util.setDropdownOptions(rowObject.attributeDropdown, widget.attributes);
		}
	};
	
	var createWidget = function(container, baseUrl) {
		var subsetWidget = {
			attributes: [],
			attributeRows: [],
			datasetInput: null,
			attributeArea: null,
			resultArea: null,
			init: function() {
				var that = this;
				var datasetLabel = document.createTextNode("Dataset Name:");
				container.appendChild(datasetLabel);
				this.datasetInput = document.createElement('input');
				this.datasetInput.value = 'ads';
				container.appendChild(this.datasetInput);

				this.attributeArea = document.createElement('div');
				container.appendChild(this.attributeArea);

				var addButton = document.createElement("button");
				addButton.innerHTML = '+';
				$(addButton).click(function() {
					that.createAttributeRow();
				});
				container.appendChild(addButton);

				container.appendChild(document.createElement('br'));
				
				var outputLabel = document.createTextNode("Output Name:");
				container.appendChild(outputLabel);
				this.outputInput = document.createElement('input');
				this.outputInput.value = 'subset';
				container.appendChild(this.outputInput);
				
				var searchButton = document.createElement("button");
				searchButton.innerHTML = 'search';
				$(searchButton).click(function() {
					that.doSearch();
				});
				container.appendChild(searchButton);
				
				var linksButton = document.createElement("button");
				linksButton.innerHTML = 'links';
				$(linksButton).click(function() {
					window.location.assign(baseUrl + '#link');
					window.location.reload(true);
				});
				container.appendChild(linksButton);
				
				this.resultArea = document.createElement('div');
				container.appendChild(this.resultArea);

				getAttributeList(baseUrl, this.datasetInput.value, function(response) {
					that.attributes = response.columns.list;
                    if(!that.attributes){
                        return;
                    }
					that.attributes.splice(0,0,"NONE");
					updateAttributeRows(that);
				});
			},
			doSearch: function() {
				var that = this;
				var filters = [];
				for (var i=0; i<this.attributeRows.length; i++) {
					filters.push({
						filterAttribute: this.attributeRows[i].attributeDropdown.value,
						comparator: this.attributeRows[i].conditionDropdown.value,
						value: this.attributeRows[i].inputBox.val()
					});
				}

                searchClusters(baseUrl, this.datasetInput.value, this.outputInput.value, filters, function(response) {
					$(that.resultArea).empty();
					that.resultArea.appendChild(document.createTextNode('Matches: ' + response.memberDetails.length));
					var tableDiv = $('<div></div>');
                    tableDiv.addClass('searchTable');
                    $(that.resultArea).append(tableDiv);
					var headers = [];
					var dataRows = [];
					for (var i=0; i<response.memberDetails.length; i++) {
                        var entries = response.memberDetails[i].map.entry;
						var values = {};
						for (var j=0; j<entries.length; j++) {
							var entry = entries[j];
							if (i==0) {
                                headers.push(entry.key);
                            }
							values[entry.key] = entry.value;
						}
						dataRows.push(values);
					}
					that.table = table.createJQTable(baseUrl,tableDiv, headers, dataRows);
					
					var timelineDiv = document.createElement('div');
					$(timelineDiv).css({position:'absolute',top:'150px',height:'150px',left:'0px',right:'0px'});
					that.resultArea.appendChild(timelineDiv);
					that.timeline = new timeline.widget(timelineDiv, dataRows);
					that.timeline.resize($(container).width(), 150);

				});
			},
			createAttributeRow: function() {
//				var rowObject = createAttributeRow(baseUrl, this);
				var rowObject = createFilterRow(this);
				this.attributeRows.push(rowObject);
			},
			
			resize: function(width,height) {
				if (this.table) {
					this.table.fnAdjustColumnSizing();
				}
			}
		}
		subsetWidget.init();
		return subsetWidget;
	}
	
	return {
		createWidget:createWidget
	}
});
