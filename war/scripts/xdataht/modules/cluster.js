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

    var clusterByAttributes = function(baseURL, clusterConfiguration, callback, onError) {
        rest.post(baseURL + 'rest/cluster',clusterConfiguration,'Perform Clustering', callback, false, onError);
    };

    var createAttributeRow = function(widget, label, bCreateSlider) {
        var rowObject = {};
        rowObject.attributeDiv = document.createElement('div');

        $(rowObject.attributeDiv).css({
            'position':'relative',
            'padding':5
        });

        var selectedDataset = $(widget.datasetDropdown).val();
        var clusterableAttributes = widget.datasetToColumnNames[selectedDataset];

        if (clusterableAttributes) {
            rowObject.dropdown = $(ui_util.createDropdown(clusterableAttributes, 200, function() {}));
        } else {
            rowObject.dropdown = $(ui_util.createDropdown(['NONE'], 200, function() {}));
        }
        rowObject.dropdown.css({
            'position' : 'absolute',
            'top' : 0,
            'left' : 90
        });

        if (bCreateSlider) {
            rowObject.slider = $('<div/>').width(200).css('top',0).slider({
                value:100
            });
            $(rowObject.slider).css({
               'position':'absolute',
                'top':7,
                'left':310
            });
            $(rowObject.attributeDiv).append(rowObject.slider);
        }
        $(rowObject.attributeDiv).append($('<div>' + label + '</div>'));
        $(rowObject.attributeDiv).append(rowObject.dropdown);

        var removeButton = $("<button/>");
        removeButton.html('x');
        removeButton.click(function() {
            $(rowObject.attributeDiv).remove();
            var rowIdx = widget.attributeRows.indexOf(rowObject);
            if (rowIdx != -1) {
                widget.attributeRows = widget.attributeRows.splice(rowIdx,1);
            }
        }).css({position:'absolute',left:'580px', top:0});
        $(rowObject.attributeDiv).append(removeButton);
        rowObject.textNode = $('<div/>');
        $(rowObject.attributeDiv).append(rowObject.textNode);
        widget.attributeArea.append($(rowObject.attributeDiv));
        return rowObject;
    };

    var updateAttributeRows = function(widget) {
        var selectedDataset = $(widget.datasetDropdown).val();
        var clusterableAttributes = widget.datasetToColumnNames[selectedDataset];

        for (var i=0; i<widget.attributeRows.length; i++) {
            var rowObject = widget.attributeRows[i];
            ui_util.setDropdownOptions(rowObject.dropdown, clusterableAttributes);
        }
    };

    var fetchCurrentJobs = function(baseURL, callback) {
        rest.get(baseURL + 'rest/clusterManager','Get Clustering Jobs', callback);
    };

    var createWidget = function(container, baseURL, datasetToColumnNames, selectedDataset) {
        var clusterWidget = {
            attributes: [],
            attributeRows: [],
            attributeWeights : [],
            datasetDropdown: null,
            datasetOutput: null,
            attributeArea: null,
            datasetToColumnNames : datasetToColumnNames,
            init: function() {
                var that = this;

                var newClusterControlContainer = $('<div/>');
                $(container).append(newClusterControlContainer);

                var datasetLabel = $('<div>Dataset Name:</div>').css('display','inline-block');
                newClusterControlContainer.append(datasetLabel);
                this.datasetDropdown = $('<select/>');
                for (var datasetName in datasetToColumnNames) {
                    if (datasetToColumnNames.hasOwnProperty(datasetName)) {
                        var option = $('<option/>');
                        option.attr('value',datasetName);
                        option.html(datasetName);
                        this.datasetDropdown.append(option);
                    }
                }
                this.datasetDropdown.change(function(e) {
                    var newDatasetName = $(e.currentTarget).val();
                    that.attributeArea.empty();
                    that.attributeRows = [];
                    that.createAttributeRow('Cluster By:', true);
                });
                this.datasetDropdown.val(selectedDataset);
                newClusterControlContainer.append(this.datasetDropdown);

                var clustersetLabel = $('<div>Clusterset Name:</div>').css('display','inline-block');
                newClusterControlContainer.append(clustersetLabel);
                this.datasetOutput = $('<input/>');
                this.datasetOutput.val('new clusterset name');
                newClusterControlContainer.append(this.datasetOutput);



                this.attributeArea = $('<div/>');
                newClusterControlContainer.append(this.attributeArea);

                var addButton = $("<button/>");
                addButton.html('+');
                addButton.click(function() {
                    that.createAttributeRow('Cluster By', true);
                });
                newClusterControlContainer.append(addButton);

                this.datasetDropdown.change();

                fetchCurrentJobs(baseURL, function(clusteringJobs){

                });
            },
            createAttributeRow: function(label, bCreateWeight) {
                var rowObject = createAttributeRow(this, label, bCreateWeight);
                this.attributeRows.push(rowObject);
            },
            cluster : function(callback, method) {
                var previousOutput = $('#clusteringOutput');
                if (previousOutput) {
                    previousOutput.remove();
                }
                var outputDiv = $('<div/>').width(500).attr('id','clusteringOutput');
                var outputLabel = $('<div/>').html('Output:');
                var outputTextArea = $('<textarea/>').width(500).height(300);
                outputDiv.append(outputLabel);
                outputDiv.append(outputTextArea);
                $(container).append(outputDiv);

                outputTextArea.val('Beginning clustering...');

                var clusterBy = [];
                var weights = [];
                for (var i = 0; i < this.attributeRows.length; i++) {
                    clusterBy.push(this.attributeRows[i].dropdown.val());
                    weights.push(this.attributeRows[i].slider.slider('option','value') / 100);
                }

                var datasetName = $(this.datasetDropdown).val();
                var clustersetName = $(this.datasetOutput).val();

                var clusterParameters = [];
                for (i = 0; i < clusterBy.length; i++) {
                    clusterParameters.push({
                        field: clusterBy[i],
                        clusterWeight: weights[i]
                    });
                }

                var clusterConfig = {
                    datasetName : datasetName,
                    clustersetName : clustersetName,
                    params : clusterParameters
                };

                if (method) {
                	clusterConfig.method = method;
                }

                var onClusterSuccess = function(response) {
                    var clusteringSummary = rest.hashMapToJSON(response['clusteringSummary']);
                    var txt = outputTextArea.val();
                    txt += "done";
                    if (response['cached'] == true) {
                        txt += " (cached)\n";
                    } else {
                        txt += '\n';
                    }
                    for (var key in clusteringSummary) {
                        if (clusteringSummary.hasOwnProperty(key)) {
                            txt += key + " : " + clusteringSummary[key] + "\n";
                        }
                    }
                    outputTextArea.val(txt);
                    if (callback) {
                        callback.call(this, datasetName, clustersetName);
                    }
                };

                var onClusterFail = function(response) {
                    var txt = outputTextArea.val();
                    txt += "Error.   Clustering Failed.\n";
                    if (response.message) {
                        txt+= response.message;
                    }
                    outputTextArea.val(txt);
                };
                
                clusterByAttributes(baseURL, clusterConfig,onClusterSuccess,onClusterFail);
            },

            resize: function(width,height) {

            }
        };
        clusterWidget.init();
        return clusterWidget;
    };

	var showNewClusterSetDialog = function(baseURL, datasetToColumnNames, selectedDataset, linkCallback) {
		var that = this;
        var dialogDiv = $('<div/>');
        $('body').append(dialogDiv);

        var clusterWidget = createWidget(dialogDiv[0], baseURL, datasetToColumnNames, selectedDataset);

        var newClustersetName = null;
        var newDatasetName = null;

        var onCluster = function() {
            dialogDiv.dialog("option", "buttons", clusterButtonSet);
            clusterWidget.cluster(function(datasetName, clustersetName) {
                newClustersetName = clustersetName;
                newDatasetName = datasetName;
                dialogDiv.dialog("option", "buttons", linkButtonSet);
            });
        };

        var onOrgCluster = function() {
            dialogDiv.dialog("option", "buttons", clusterButtonSet);
            clusterWidget.cluster(function(datasetName, clustersetName) {
                newClustersetName = clustersetName;
                newDatasetName = datasetName;
                dialogDiv.dialog("option", "buttons", linkButtonSet);
            }, "organization");
        };

        var onLouvain = function() {
            dialogDiv.dialog("option", "buttons", clusterButtonSet);
            clusterWidget.cluster(function(datasetName, clustersetName) {
                newClustersetName = clustersetName;
                newDatasetName = datasetName;
                dialogDiv.dialog("option", "buttons", linkButtonSet);
            }, "louvain");
        };

        var onLink = function() {
            $(this).dialog("close");
            linkCallback(newDatasetName, newClustersetName);
        };

        var onBack = function(){
            $(this).dialog("close");
        };

        var clusterButtonSet = [
    		{text: "Fuzzy", title: 'Slow fuzzy match on selected attributes', click:onCluster},
    		{text: "Exact", title: 'Fast exact match on selected attributes', click:onOrgCluster},
    		{text: "Louvain", title: 'Minimize graph modularity', click:onLouvain},
    		{text: "Back", title: 'Close this dialog', click:onBack}
        ];

        var linkButtonSet = [
        		{text: "Fuzzy", title: 'Slow fuzzy match on selected attributes', click:onCluster},
        		{text: "Exact", title: 'Fast exact match on selected attributes', click:onOrgCluster},
        		{text: "Louvain", title: 'Minimize graph modularity', click:onLouvain},
        		{text: "Link", title: 'Use this new cluster set', click:onLink},
        		{text: "Back", title: 'Close this dialog', click:onBack}
        ];

        dialogDiv.dialog({
            zIndex:30000000,
            width:650,
            modal:true,
            title:'Create a new cluster set',

            // These two lines prevent the "x" from appearing in the corner of dialogs.   It's annoying to handle closing the dialog
            // this way so this is how we can prevent the user from doing this
            closeOnEscape: false,
            open: function(event, ui) {
                $(this).parent().children().children('.ui-dialog-titlebar-close').hide();

            },
            buttons: clusterButtonSet,
            close: function() {
                dialogDiv.remove();
            },
            resizeStop: function(event, ui) {}
        });
	};
    
    
    return {
        createWidget:createWidget,
        showNewClusterSetDialog: showNewClusterSetDialog
    };
});
