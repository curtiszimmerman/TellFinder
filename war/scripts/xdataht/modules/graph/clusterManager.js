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
define([ '../util/ui_util', '../util/rest'], function( ui_util, rest) {

    var baseURL;

    var clusterByAttributes = function(clusterConfiguration, callback, onError) {
        rest.post(baseURL + 'rest/clusterManager/new',clusterConfiguration,'Perform Clustering', callback, false, onError);
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

    var fetchCurrentJobs = function(callback) {
        rest.get(baseURL + 'rest/clusterManager','Get Clustering Jobs', callback);
    };

    var fetchClusteringJobInfo = function(handle, callback) {
        rest.get(baseURL + 'rest/clusterManager/' + handle, 'Fetch clustering job info for ' + handle, callback);
    };

    var killJob = function(handle) {
        rest.delete(baseURL + 'rest/clusterManager/kill/' + handle, null, 'Kill job ' + handle);
    };

    var removeCompletedJob = function(handle) {
        rest.delete(baseURL + 'rest/clusterManager/removeCompleted/' + handle, null, 'Remove completed job ' + handle);
    };

    var createJobContainer = function(container, title, onClick, onRemove) {
        var titleDiv = $('<div>' + title + '</div>');
        container.append(titleDiv);

        var jobRowArea = $('<div/>');
        jobRowArea.width(container.width()).height(container.height()-18);
        container.append(jobRowArea);

        var handleToRow = {};

        var addJobRow = function(label,handle) {
            var row = $('<div/>').addClass('clusterJobRow').width('100%').height(20).click(function() {
                $('.clusterJobRow').css('background-color','');
                row.css({
                    'background-color' : 'hotpink'
                });
                onClick(handle);
            });

            var labelDiv = $('<div>' + label + '</div>').css('display','inline-block');
            var removeButton = $('<button/>', {title:'Kill cluster process'}).click(function() {
                row.remove();
                onRemove(handle);
            }).html('x').css({
                display:'inline-block'
            });

            row.append(labelDiv);
            row.append(removeButton);
            jobRowArea.append(row);
            handleToRow[handle] = row;
        };

        var focusJobRow = function(handle) {
            if (handleToRow.hasOwnProperty(handle)) {
                handleToRow[handle].click();
            }
        };

        var removeJobRow = function(handle) {
            if (handleToRow.hasOwnProperty(handle)) {
                handleToRow[handle].remove();
                delete handleToRow[handle];
            }
        };

        var containsJobRow = function(handle) {
            return handleToRow.hasOwnProperty(handle);
        };

        return {
            add: addJobRow,
            remove: removeJobRow,
            focus: focusJobRow,
            contains: containsJobRow
        };
    };

    var onClickJobRow = function(widget, handle, onShowJobDetails) {
        widget.newClusterControlContainer.css('display','none');
        widget.outputTextArea.val('Fetching job info from server');
        fetchClusteringJobInfo(handle, function(response) {
            if (response.status == 'completed' && widget.currentJobContainer.contains(response.handle)) {
                clearPoll(widget);
                widget.currentJobContainer.remove(response.handle);
                widget.completedJobContainer.add(response.datasetName + ' - ' + response.clustersetName, response.handle);
                widget.completedJobContainer.focus(response.handle);
            }
            widget.outputTextArea.val(response.info);
        });
        onShowJobDetails();
    };

    var clearPoll = function(widget) {
        if (widget.pollToken != null) {
            window.clearInterval(widget.pollToken);
            widget.pollToken = null;
        }
    };


    var createWidget = function(container, datasetToColumnNames, selectedDataset, onShowActiveJobDetails, onShowCompletedJobDetails) {

        var clusterWidget = {
            attributes: [],
            attributeRows: [],
            attributeWeights : [],
            datasetDropdown: null,
            datasetOutput: null,
            attributeArea: null,
            currentJobContainer: null,
            completedJobContainer: null,
            newClusterControlContainer:null,
            outputTextArea:null,
            selectedCompletedJobHandle:null,
            pollToken:null,
            datasetToColumnNames : datasetToColumnNames,
            init: function() {
                var that = this;

                var jobsDiv = $('<div/>').width(628).height(208);
                var currentJobsDiv = $('<div/>').width(300).height(200).css({
                    'position':'absolute',
                    'top':'5px',
                    'left':'10px',
                    'border' : '1px solid black',
                    'margin' : '1px'
                });
                jobsDiv.append(currentJobsDiv);
                var completedJobsDiv = $('<div/>').width(300).height(200).css({
                    'position':'absolute',
                    'top':'5px',
                    'left':'320px',
                    'border': '1px solid black',
                    'margin' : '1px'
                });
                jobsDiv.append(completedJobsDiv);
                $(container).append(jobsDiv);

                this.currentJobContainer = createJobContainer(currentJobsDiv, 'Current Jobs', function(handle) {
                    clearPoll(clusterWidget);
                    clusterWidget.pollToken = window.setInterval(function() {
                        onClickJobRow(clusterWidget, handle, onShowActiveJobDetails);
                    }, 5000);
                    onClickJobRow(clusterWidget, handle, onShowActiveJobDetails);
                }, function(handle) {
                    clearPoll(clusterWidget);
                    killJob(handle);
                    var output = clusterWidget.outputTextArea.val();
                    output += '\nOPERATION TERMINATED\n';
                    clusterWidget.outputTextArea.val(output);
                });

                this.completedJobContainer = createJobContainer(completedJobsDiv, 'Completed Jobs', function(handle) {
                    onClickJobRow(clusterWidget, handle, onShowCompletedJobDetails);
                    that.selectedCompletedJobHandle = handle;
                }, function(handle) {
                    removeCompletedJob(handle);
                });

                this.newClusterControlContainer = $('<div/>');
                $(container).append(this.newClusterControlContainer);

                var datasetLabel = $('<div>Dataset Name:</div>').css('display','inline-block');
                this.newClusterControlContainer.append(datasetLabel);
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
                this.newClusterControlContainer.append(this.datasetDropdown);

                var clustersetLabel = $('<div>Clusterset Name:</div>').css('display','inline-block');
                this.newClusterControlContainer.append(clustersetLabel);
                this.datasetOutput = $('<input/>');
                this.datasetOutput.val('new clusterset name');
                this.newClusterControlContainer.append(this.datasetOutput);



                this.attributeArea = $('<div/>');
                this.newClusterControlContainer.append(this.attributeArea);

                var addButton = $("<button/>");
                addButton.html('+');
                addButton.click(function() {
                    that.createAttributeRow('Cluster By', true);
                });
                this.newClusterControlContainer.append(addButton);

                this.datasetDropdown.change();

                var outputDiv = $('<div/>').width(500).attr('id','clusteringOutput');
                var outputLabel = $('<div/>').html('Output:');

                this.outputTextArea = $('<textarea/>').width(500).height(300);

                outputDiv.append(outputLabel);
                outputDiv.append(this.outputTextArea);
                $(container).append(outputDiv);


                fetchCurrentJobs(function(clusteringJobs){

                    var addEntry = function(jobContainer, entry) {
                         jobContainer.add(entry.value.datasetName + ' - ' + entry.value.clustersetName, entry.key);
                    };

                    if (clusteringJobs.activeJobs) {
                        if (_.isArray(clusteringJobs.activeJobs.entry)) {
                            for (var i = 0; i < clusteringJobs.activeJobs.entry.length; i++) {
                                var entry = clusteringJobs.activeJobs.entry[i];
                                addEntry(that.currentJobContainer, entry);
                            }
                        } else {
                            var entry = clusteringJobs.activeJobs.entry;
                            addEntry(that.currentJobContainer, entry);
                        }
                    }
                    if (clusteringJobs.completedJobs) {
                        if (_.isArray(clusteringJobs.completedJobs.entry)) {
                            for (var i = 0; i < clusteringJobs.completedJobs.entry.length; i++) {
                                var entry = clusteringJobs.completedJobs.entry[i];
                                addEntry(that.completedJobContainer, entry);
                            }
                        } else {
                            var entry = clusteringJobs.completedJobs.entry;
                            addEntry(that.completedJobContainer, entry);
                        }
                    }
                });
            },
            createAttributeRow: function(label, bCreateWeight) {
                var rowObject = createAttributeRow(this, label, bCreateWeight);
                this.attributeRows.push(rowObject);
            },
            cluster : function(callback, method) {
                this.outputTextArea.val('Creating new clustering job\n');

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

                var that = this;
                var onClusterSuccess = function(response) {
                    var label = response.datasetName + " - " + response.clustersetName;
                    var handle = response.handle;
                    that.currentJobContainer.add(label,handle);
                    that.currentJobContainer.focus(handle);
                };

                var onClusterFail = function(response) {
                    var ibreak = 0;
                    ibreak++;
                };

                clusterByAttributes(clusterConfig,onClusterSuccess,onClusterFail);
            },

            resize: function(width,height) {

            }
        };
        clusterWidget.init();
        return clusterWidget;
    };

    var showNewClusterSetDialog = function(baseUrl, datasetToColumnNames, selectedDataset, linkCallback) {
        baseURL = baseUrl;
        var that = this;
        var dialogDiv = $('<div/>');
        $('body').append(dialogDiv);

        var onShowActiveJobDetails = function() {
            var jobDetailsButtonset = [
                {text: "New", title: 'Create a new clusterset', click:function() {
                    dialogDiv.empty();
                    clusterWidget = createWidget(dialogDiv[0], datasetToColumnNames, selectedDataset, onShowActiveJobDetails, onShowCompletedJobDetails);
                    dialogDiv.dialog("option", "buttons", clusterButtonSet);
                }},
                {text: "Back", title: 'Close this dialog', click:onBack}
            ];
            dialogDiv.dialog("option", "buttons", jobDetailsButtonset);
        };

        var onShowCompletedJobDetails = function() {
            clearPoll(clusterWidget);
            var jobDetailsButtonset = [
                {text: "Link", title: 'Link tooltip goes here', click: function() {
                    clearPoll(clusterWidget);
                    // Collected completed jobs
                    var completedJobs = [];
                    var that = this;
                    fetchCurrentJobs(function(clusteringJobs){

                        var selectedDatasetName = null;
                        var selectedClustersetName = null;
                        var selectedHandle = null;

                        if (clusteringJobs.completedJobs) {
                            if (_.isArray(clusteringJobs.completedJobs.entry)) {
                                for (var i = 0; i < clusteringJobs.completedJobs.entry.length; i++) {
                                    var entry = clusteringJobs.completedJobs.entry[i];
                                    completedJobs.push({
                                        datasetName: entry.value.datasetName,
                                        clustersetName: entry.value.clustersetName,
                                        handle: entry.key
                                    });
                                    if (entry.key == clusterWidget.selectedCompletedJobHandle) {
                                        selectedDatasetName = entry.value.datasetName;
                                        selectedClustersetName = entry.value.clustersetName;
                                        selectedHandle = entry.key;
                                    }
                                }
                            } else {
                                var entry = clusteringJobs.completedJobs.entry;
                                completedJobs.push({
                                    datasetName: entry.value.datasetName,
                                    clustersetName: entry.value.clustersetName,
                                    handle: entry.key
                                });
                                selectedDatasetName = entry.value.datasetName;
                                selectedClustersetName = entry.value.clustersetName;
                                selectedHandle = entry.key;
                            }

                            linkCallback(completedJobs,selectedDatasetName, selectedClustersetName);

                            //remove from recently completed
                            removeCompletedJob(selectedHandle);
                        }

                        $(that).dialog("close");
                    });
                }},
                {text: "New", title: 'Create a new clusterset', click:function() {
                    dialogDiv.empty();
                    clusterWidget = createWidget(dialogDiv[0], datasetToColumnNames, selectedDataset, onShowActiveJobDetails, onShowCompletedJobDetails);
                    dialogDiv.dialog("option", "buttons", clusterButtonSet);
                }},
                {text: "Back", title: 'Close this dialog', click:onBack}
            ];
            dialogDiv.dialog("option", "buttons", jobDetailsButtonset);
        };

        var clusterWidget = createWidget(dialogDiv[0],datasetToColumnNames, selectedDataset, onShowActiveJobDetails, onShowCompletedJobDetails);

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

        var onLink = function(newClustersets, selectedDataset, selectedClusterset) {
            clearPoll(clusterWidget);
            $(this).dialog("close");
            linkCallback(newClustersets, selectedDataset, selectedClusterset);
        };

        var onBack = function(){
            clearPoll(clusterWidget);
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
        show: showNewClusterSetDialog
    };
});
