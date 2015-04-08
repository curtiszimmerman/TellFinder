
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

define([ '../util/ui_util', './clusterManager', '../util/rest', './linkCriteria', './refine', '../util/colors'],
    function( ui_util, cluster, rest, linkCriteria, refine, colors) {

		var COMPARATOR_DROPDOWN_CONTENTS = [
				'less than',
				'greater than',
				'greater than or equal to',
				'less than or equal to',
				'equals',
				'not equals',
				'contains'
			],
		CUSTOM_SEARCH_CRITERIA = ["Cluster Size", "tag"],
		LINK_CONTROLS_HEIGHT = 120,
		DATASET_CONTROLS_HEIGHT = 105,
		LINK_CONTROLS_WIDTH = 300,

		BORDER_STYLE = '1px solid ' + colors.BORDER_DARK;

    var fetchDBInfo = function(baseUrl, callback) {
        rest.get(baseUrl + "rest/data/clusterSets", 'Get initial DB info', callback);
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
        graphOnEnter(rowObject.attributeDropdown, widget);
        rowObject.attributeDiv.append(rowObject.attributeDropdown);
        rowObject.attributeDropdown.value = 'name';

        rowObject.conditionDropdown = ui_util.createDropdown(COMPARATOR_DROPDOWN_CONTENTS, 90, function(event){});
        graphOnEnter(rowObject.conditionDropdown, widget);
        rowObject.attributeDiv.append(rowObject.conditionDropdown);
        rowObject.conditionDropdown.value = 'contains';

        rowObject.inputBox = $('<input/>');
        rowObject.inputBox.css({left:'180px',right:'30px',position:'absolute'});
        graphOnEnter(rowObject.inputBox, widget);
        rowObject.attributeDiv.append(rowObject.inputBox);

        var removeButton = $('<button/>');
        removeButton.text('x');
        removeButton.click(function() {
            rowObject.attributeDiv.remove();
            var rmIdx = widget.attributeRows.indexOf(rowObject);
            widget.attributeRows.splice(rmIdx, 1);
        }).css({position:'absolute',right:'0px'});
        rowObject.attributeDiv.append(removeButton);
        widget.searchCriteriaArea.append(rowObject.attributeDiv);
        return rowObject;
    };

	var updateAttributeRows = function(widget) {
        var filterContents = widget.attributes.slice(0);
        for (var i = 0; i < CUSTOM_SEARCH_CRITERIA.length; i++) {
            filterContents.unshift(CUSTOM_SEARCH_CRITERIA[i]);
        }
		for (i=0; i<widget.attributeRows.length; i++) {
			var rowObject = widget.attributeRows[i];
			if (rowObject.type == 'filter') {
				ui_util.setDropdownOptions(rowObject.attributeDropdown, filterContents);
	            rowObject.attributeDropdown.value = 'name';
			} else {
				ui_util.setDropdownOptions(rowObject.attributeDropdown, widget.attributes);
				rowObject.attributeDropdown.value = 'phone';
			}
		}
	};

    var createLinkCriteriaControlCanvas = function(widget, container) {
    	var titleDiv = $('<div/>');
    	titleDiv.text('Link Attributes');
        container.append(titleDiv);
        var linkAttributeArea = $('<div/>');
        linkAttributeArea.css({
            overflow: 'auto',
            height:'70px',
            position:'relative'
        });
        container.append(linkAttributeArea);

        var addLinkCriteriaButton = $('<button/>', {title:'Add connections between nodes'});
        addLinkCriteriaButton.html('Add');
        addLinkCriteriaButton.click(function() {
            linkCriteria.new(function (linkCriteriaObject) {
                widget.linkCriteria.push(linkCriteriaObject);
                updateLinkCriteria(widget, linkAttributeArea);
            });
        });
        container.append(addLinkCriteriaButton);
    };

    var updateLinkCriteria = function(widget, container) {
        $(container).empty();
        for (var i = 0; i < widget.linkCriteria.length; i++) {
            (function() {
                var rowObject = {};

                rowObject.attributeDiv = $('<div/>');
                rowObject.attributeDiv.css({
                    'position':'relative',
                    'height':'20px'
                });
                rowObject.attributeLabel = $('<div/>');
                rowObject.attributeLabel.html(widget.linkCriteria[i].name);
                rowObject.attributeLabel.css({
                    'padding-top':'5px',
                    'position':'absolute'
                });
                rowObject.attributeDiv.append(rowObject.attributeLabel);


                rowObject.slider = $('<div/>').width(80).css('top',0).slider({
                    value:100,
                    change: function(event,ui) {
                        for (var i = 0; i < widget.linkCriteria.length; i++) {
                            if (widget.linkCriteria[i].name == rowObject.attributeLabel.html()) {
                                widget.linkCriteria[i].weight = rowObject.slider.slider('value')/100.0;
                            }
                        }
                    }
                });
                widget.linkCriteria[i].weight = 1.0;
                rowObject.slider.css({
                    'position':'absolute',
                    'top':7,
                    'right': '53px'
                });

                rowObject.attributeDiv.append(rowObject.slider);
                rowObject.idx = i;

                var editButton = $('<button/>');
                editButton.button({
                    text:false,
                    icons: {
                        primary: 'ui-icon-pencil'
                    }
                }).height(19).width(18);
                editButton.click(function() {
                    linkCriteria.edit(widget.linkCriteria[rowObject.idx], function(newLinkCriteria) {
                        widget.linkCriteria[rowObject.idx] = newLinkCriteria;
                        widget.linkCriteria[rowObject.idx].weight = rowObject.slider.slider('value')/100.0;
                        rowObject.attributeLabel.html(newLinkCriteria.name);
                    });
                }).css({
                        position:'absolute',
                        right:'19px',
                        top:'4px'
                    });

                var removeButton = $('<button/>');
                removeButton.button({
                    text:false,
                    icons: {
                        primary: 'ui-icon-close'
                    }
                }).height(19).width(18);
                removeButton.click(function() {
                    // Remove from widget.linkCriteria
                    var removeIdx = -1;
                    for (var i = 0; i < widget.linkCriteria.length; i++) {
                        if (widget.linkCriteria[i].name == rowObject.attributeLabel.html()) {
                            removeIdx = i;
                            break;
                        }
                    }
                    if (removeIdx != -1) {
                        widget.linkCriteria.splice(i,1);
                    }
                    // Remove from DOM
                    rowObject.attributeDiv.remove();
                }).css({
                    position:'absolute',
                    right:'0px',
                    top:'4px'
                });
                rowObject.attributeDiv.append(removeButton);
                rowObject.attributeDiv.append(editButton);
                $(container).append(rowObject.attributeDiv);
            })();
        }
    };

    var onDatasetChange = function(widget, datasetName) {
        // update clusterset name dropdown
        var clustersetList = widget.datasetToClusterSetNames[datasetName];
        widget.clustersetDropdown.empty();
        if (clustersetList) {
            widget.enableGraphing();
            for (var i = 0; i < clustersetList.length; i++) {
                var option = $('<option/>');
                option.attr('value', clustersetList[i]);
                option.html(clustersetList[i]);
                widget.clustersetDropdown.append(option);
            }
        } else {
            widget.disableGraphing();
        }

        // update attribute lists
        widget.attributes = widget.datasetToColumnNames[datasetName];
        linkCriteria.updateAttributes(widget.datasetToColumnNames[datasetName]);
        if (widget.attributes.indexOf("NONE")<0) widget.attributes.splice(0,0,"NONE");
        updateAttributeRows(widget);
    };

    var graphOnEnter = function(element, widget) {
        $(element).keypress(function(event) {
            if (event.keyCode == 13) {
                widget.onGraph();
            }
        });
    };

    var createWidget = function(jqContainer, appWidget, baseUrl) {
		var searchWidgetObj = {
			attributes: [],
			attributeRows: [],
            linkCriteria: [],
            datasetToColumnNames: {},
            datasetToClusterSetNames: {},
			datasetDropdown: null,
            clustersetDropdown : null,
            controlCanvas : null,
            searchControlCanvas: null,
            graphButton: null,
            relatedButton: null,
            nextRingLevel : 0,
			init: function() {
				var that = this;
				this.createGraphPropertiesCanvas();
                fetchDBInfo(baseUrl, function(response) {
                	that.populateDropdowns(response);
                });
			},
			createGraphPropertiesCanvas: function() {
				var that = this;

                this.controlCanvas = $('<div/>');
                jqContainer.append(this.controlCanvas);
                this.controlCanvas.css({
                    'position':'absolute',
                    'top':'0px',
                    'left':'0px',
                    'right':'0px',
                    'height':DATASET_CONTROLS_HEIGHT+'px',
                    'border-bottom': BORDER_STYLE
                });

                this.searchControlCanvas = $('<div/>');
                jqContainer.append(this.searchControlCanvas);
                this.searchControlCanvas.css({
                    'position':'absolute',
                    top:DATASET_CONTROLS_HEIGHT + 1 + 'px',
                    left:'0px',
                    'right':'0px',
                    height:LINK_CONTROLS_HEIGHT + 'px',
                    overflow:'hidden',
                    'border-bottom': BORDER_STYLE
                });

				this.linkControlCanvas = $('<div/>');
				jqContainer.append(this.linkControlCanvas);
				this.linkControlCanvas.css({
                    'position':'absolute',
                    top:DATASET_CONTROLS_HEIGHT + LINK_CONTROLS_HEIGHT + 1 + 'px',
                    left:'0px',
                    'right':'0px',
                    height:LINK_CONTROLS_HEIGHT + 'px',
                    overflow:'hidden',
                    'border-bottom': BORDER_STYLE
                });

                this.graphButtonCanvas = $('<div/>');
                jqContainer.append(this.graphButtonCanvas);
                this.graphButtonCanvas.css({
                    'position':'absolute',
                    top: DATASET_CONTROLS_HEIGHT + (LINK_CONTROLS_HEIGHT*2) + 3 +'px',
                    left:'0px',
                    'right':'0px',
                    height:'30px',
                    overflow:'hidden'
                });

                var datasetInputContainer = $('<div/>');
                datasetInputContainer.css({position:'absolute', left:'0px', right:'0px'});
				var datasetLabel = $('<div/>');
				datasetLabel.text('Dataset');
				datasetLabel.css({position:'absolute',left:'2px',top:'2px'});
                datasetInputContainer.append(datasetLabel);
				this.datasetDropdown = $('<select/>');
                this.datasetDropdown.change(function(event) {
                    var datasetName = $(event.currentTarget).val();
                    onDatasetChange(that, datasetName);
                }).css({position:'absolute',left:'80px',width:'160px'});

                var subsetOption = $('<option>');
                subsetOption.value = 'subset';
                subsetOption.innerHTML = 'subset';
                this.datasetDropdown.append(subsetOption);
                datasetInputContainer.append(this.datasetDropdown);
                $(this.controlCanvas).append(datasetInputContainer);

                var refineButton = $('<button/>', {title:'Create derived columns'});
                refineButton.html("Refine");
                refineButton.css({position:'absolute',width:'50px',right:'2px'});
                refineButton.click(function(){
                    var selectedDataset = that.datasetDropdown.val();
                	refine.showRefineDialog(baseUrl, that.datasetToColumnNames, selectedDataset);
                });
                datasetInputContainer.append(refineButton);

                
                var clustersetInputContainer = $('<div/>');
                clustersetInputContainer.css({position:'absolute',top:'22px', left:'0px', right:'0px'});
                var clustersetLabel = $('<div/>');
                clustersetLabel.text('Clusterset');
                clustersetLabel.css({position:'absolute',left:'2px',top:'2px'});
                clustersetInputContainer.append(clustersetLabel);
                this.clustersetDropdown = $('<select/>');
                clustersetInputContainer.append(this.clustersetDropdown);
                this.clustersetDropdown.css({position:'absolute',left:'80px',width:'160px'});
                this.controlCanvas.append(clustersetInputContainer);

                var newClusterSetButton = $('<button/>', {title:'Cluster ads by customizable criteria'});
                newClusterSetButton.html("New");
                newClusterSetButton.css({position:'absolute',width:'50px',right:'2px'});
                newClusterSetButton.click(function(){
                    var selectedDataset = that.datasetDropdown.val();
                	cluster.show(baseUrl, that.datasetToColumnNames, selectedDataset,
            			function(newDataSetClustersetPairs, selectedDatasetName, selectedClustersetName) {

                            var sets;
                            for (var i = 0; i < newDataSetClustersetPairs.length; i++) {
                                sets = that.datasetToClusterSetNames[ newDataSetClustersetPairs[i].datasetName ];
                                if (sets.indexOf(newDataSetClustersetPairs[i].clustersetName)<0) sets.push(newDataSetClustersetPairs[i].clustersetName);
                            }

                            that.datasetDropdown.val(selectedDatasetName);
		                    onDatasetChange(that, selectedDatasetName);
                            $(that.clustersetDropdown).val(selectedClustersetName);
                            appWidget.softClear();
                    	});
                });
                clustersetInputContainer.append(newClusterSetButton);

                var deleteButton = $('<button/>', {title:'Delete cluster set'}).text('Delete')
                	.click(function() {
                    	var dialog = $('<div/>', {title:'Delete Clusterset'});
                    	dialog.append($('<div/>').text('Are you sure you want to delete clusterset: ' + that.clustersetDropdown.val()));
                    	dialog.dialog({buttons:[
                    	  {text:'OK', click: function() {that.deleteClusterset(); $(this).dialog('close');}},
                    	  {text:'Cancel', click: function() {$(this).dialog('close');}}
                    	]});
                }).css({position:'absolute', top:'44px', right:'0px'
                });
                this.controlCanvas.append(deleteButton);

                var helpButton = $('<button/>').text('Help').button({
                	icons: {
                		primary: 'ui-icon-help'
                	},
                	text: false
                }).click(function() {
                	var dialog = $('<div/>', {title:'Help'});
                	dialog.append($('<OL>' +
                			'<LI>Choose a dataset.</LI>' +
                			'<LI>Choose or create a cluster set. Cluster sets are ' +
                			'groups of ads.</LI>' +
                			'<LI>Enter search criteria and optionally link criteria.</LI>' +
                			'<LI>Click the graph button to see results</LI>' +
                			'<LI>Resulting nodes can be selected to visualize ' +
                			'the ads within the cluster.</LI></OL>'));
                	dialog.dialog();
                }).css({position:'absolute',width:'20px',height:'20px', top:'75px', right:'0px'
                });
                this.controlCanvas.append(helpButton);
                
                var distributionButton = $('<button/>', {title:'View attribute distributions'}).text('Distribution').button().click(function() {
                	window.open('chart.html');
                }).css({position:'absolute',height:'20px', top:'75px', right:'25px'});
                this.controlCanvas.append(distributionButton);

                createLinkCriteriaControlCanvas(this, this.linkControlCanvas);

                var searchTitle = $('<div/>');
                searchTitle.text('Search Criteria');
                this.searchControlCanvas.append(searchTitle);
                this.searchCriteriaArea = $('<div/>');
				this.searchCriteriaArea.css({overflow:'auto', height:'70px'});
                this.searchControlCanvas.append(this.searchCriteriaArea);
                this.addCriteriaButton = $('<button/>', {title:'Add search criteria (AND)'});
                this.addCriteriaButton.text('Add Criteria');
                $(this.addCriteriaButton).click(function() {
                    that.createFilterRow();
                    var controlCanvas = $(that.searchControlCanvas);
                    controlCanvas.scrollTop(
                        controlCanvas[0].scrollHeight - controlCanvas.height()
                    );
                });
				this.createFilterRow();

				this.graphButton = $('<button/>', {title:'Redraw graph according to search criteria and links'});
                this.graphButton.text('Graph');
				this.graphButton.click(function() {
                    that.onGraph();
				});
				this.graphButtonCanvas.append(this.graphButton);

                this.relatedButton = $('<button/>', {title:'Fetch additional nodes linked to existing nodes'});
                this.relatedButton.text('Related');
                this.relatedButton.click(function() {
                    that.relatedNodes();
                });
                this.graphButtonCanvas.append(this.relatedButton);

                this.onlyLinkedCheckbox = $('<input/>', {type:'checkbox'}).css({position:'absolute',left:'130px',top:'5px'});
                this.onlyLinkedCheckbox.checked = false;
                var onlyLinkedTitle = $('<div/>').text('Only Linked Nodes').css({position:'absolute',left:'150px',top:'5px'});
                this.graphButtonCanvas.append(this.onlyLinkedCheckbox);
                this.graphButtonCanvas.append(onlyLinkedTitle);
			},
			populateDropdowns: function(response) {
                // Populate maps from table name to a list of cluster set and a list of column values
                var i, tableName, clusterSets;
                for (i = 0; i < response['tableToClusterSets'].length; i++) {
                    tableName = response['tableToClusterSets'][i].string;
                    this.datasetToClusterSetNames[tableName] = response['tableToClusterSets'][i].list||[];
                }

                for (i = 0; i < response['tableToColumns'].length; i++) {
                    tableName = response['tableToColumns'][i].string;
                    this.datasetToColumnNames[tableName] = response['tableToColumns'][i].list;
                }

                this.datasetDropdown.empty();
                for (tableName in this.datasetToClusterSetNames) {
                    if (this.datasetToClusterSetNames.hasOwnProperty(tableName)) {
                        var option = $('<option/>');
                        option.attr('value',tableName);
                        option.html(tableName);
                        this.datasetDropdown.append(option);
                    }
                }
                onDatasetChange(this, this.datasetDropdown.val());

                this.searchControlCanvas.append(this.addCriteriaButton);
			},
			
			deleteClusterset: function() {
				var that = this;
				var datasetName = that.datasetDropdown.val();
				var clustersetName = this.clustersetDropdown.val();
				rest.delete(baseUrl + 'rest/clusterManager/delete/' + datasetName + '/' + clustersetName, null, 'Delete clusterset',
						function(result) {
							var sets = that.datasetToClusterSetNames[datasetName];
							sets.splice(sets.indexOf(clustersetName),1);
		                    onDatasetChange(that, datasetName);
						});
			},
			
			getClusterSetId: function() {
                if (this.clustersetDropdown&&this.clustersetDropdown.val().length>0) {
                	return this.clustersetDropdown.val();
                }
                return null;
			},
			
			getDatasetName: function() {
				return this.datasetDropdown.val()
			},
			
			
		    onGraph: function() {
		    	this.previousGraphData = null;
		    	appWidget.displayLoader();
		    	this.fetchData();
		    },

			disableGraphing: function() {
                this.graphButton.disabled = true;
                this.relatedButton.disabled = true;
			},
            enableGraphing: function() {
                this.graphButton.disabled = false;
                this.relatedButton.disabled = false;
            },
            createFilterRow: function() {
                var rowObject = createFilterRow(this);
                this.attributeRows.push(rowObject);
            },
			
            resize: function(w,h) {
				this.width = w;
				this.height = h;
			},
			fetchData: function() {
				var that = this;
                var graphParams = this.getGraphParams();
				var datasetName = this.datasetDropdown.val();
                var clustersetName = this.clustersetDropdown.val();
                var onlyLinked = this.onlyLinkedCheckbox.is(':checked');
                appWidget.pagingPanel.hidePagingControls();
				appWidget.graphWidget.getGraph(baseUrl, datasetName, graphParams.linkCriteria, graphParams.filters,
                    clustersetName, null, onlyLinked, function(graph) {
                    that.nextRingLevel = 1;
                	appWidget.softClear();
                    appWidget.pagingPanel.setFullGraph(graph,datasetName,clustersetName,null);
				}, function() {
                	alert('Error fetching graph');
                	appWidget.softClear();
                });
			},
            relatedNodes : function() {
                var existingNodes = [];

                appWidget.displayLoader();

                var nodes = appWidget.graphWidget.linkData.nodes;
                for (var i = 0; i < nodes.length; i++) {
                    existingNodes.push({
                        id : nodes[i].id,
                        level : nodes[i].ring
                    });
                }

                var datasetName = appWidget.graphWidget.datasetName;
                var clustersetName = appWidget.graphWidget.clustersetName;
                var graphParams = this.getGraphParams();
                var onlyLinked = this.onlyLinkedCheckbox.is(':checked');
                var that = this;
                appWidget.pagingPanel.hidePagingControls();
                appWidget.graphWidget.getGraph(baseUrl, datasetName, graphParams.linkCriteria, [], clustersetName,
                    existingNodes, onlyLinked, function(graph) {
                    that.nextRingLevel++;
                	appWidget.softClear();
                    appWidget.pagingPanel.setFullGraph(graph,datasetName,clustersetName,null);
                }, function() {
                	alert('Error fetching graph');
                	appWidget.softClear();
                });
            },
            getGraphParams: function() {
                var linkCriteria = [];
                var filters = [];
                for (var i=0; i<this.attributeRows.length; i++) {
                    filters.push({
                        filterAttribute: this.attributeRows[i].attributeDropdown.value,
                        comparator: this.attributeRows[i].conditionDropdown.value,
                        value: this.attributeRows[i].inputBox.val()
                    });
                }
                for (i = 0; i < this.linkCriteria.length; i++) {
                    linkCriteria.push(this.linkCriteria[i]);
                }
                return {
                    linkCriteria: linkCriteria,
                    filters: filters
                };
            }
        };
		searchWidgetObj.init();
		return searchWidgetObj;
	};
	
	return {
		createWidget:createWidget
	}
});
