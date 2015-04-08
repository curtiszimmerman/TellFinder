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
    var REFINE_METHODS = [
          'ngram',
          'fingerprint',
          'metaphone',
          'phonetic'
    ];

    var baseURL = null;

    var createAttributeRow = function(widget, label) {
        var rowObject = {};
        rowObject.attributeDiv = document.createElement('div');

        $(rowObject.attributeDiv).css({
            'position':'relative',
            'padding':5
        });

        rowObject.dropdown = ui_util.createDropdown(widget.clusterableAttributes, 200, function() {});

        $(rowObject.dropdown).css({
            'position' : 'absolute',
            'top' : 0,
            'left' : 90
        });

        rowObject.attributeDiv.appendChild(document.createTextNode(label));
        rowObject.attributeDiv.appendChild(rowObject.dropdown);

        var removeButton = document.createElement("button");
        removeButton.innerHTML = 'x';
        $(removeButton).click(function() {
            widget.attributeArea.removeChild(rowObject.attributeDiv);
            var rowIdx = widget.attributeRows.indexOf(rowObject);
            if (rowIdx != -1) {
                widget.attributeRows = widget.attributeRows.splice(rowIdx,1);
            }
        }).css({position:'absolute',left:'580px', top:0});
        rowObject.attributeDiv.appendChild(removeButton);
        rowObject.textNode = document.createElement('div');
        rowObject.attributeDiv.appendChild(rowObject.textNode);
        widget.attributeArea.appendChild(rowObject.attributeDiv);
        return rowObject;
    };

    var createMethodRow = function(widget, label) {
        var rowObject = {};
        rowObject.methodDiv = document.createElement('div');

        $(rowObject.methodDiv).css({
            'position':'relative',
            'padding':5
        });

        rowObject.dropdown = ui_util.createDropdown(REFINE_METHODS, 200, function() {});

        $(rowObject.dropdown).css({
            'position' : 'absolute',
            'top' : 0,
            'left' : 90
        });

        rowObject.methodDiv.appendChild(document.createTextNode(label));
        rowObject.methodDiv.appendChild(rowObject.dropdown);

        var removeButton = document.createElement("button");
        removeButton.innerHTML = 'x';
        $(removeButton).click(function() {
            widget.methodArea.removeChild(rowObject.methodDiv);
            var rowIdx = widget.methodRows.indexOf(rowObject);
            if (rowIdx != -1) {
                widget.methodRows = widget.methodRows.splice(rowIdx,1);
            }
        }).css({position:'absolute',left:'580px', top:0});
        rowObject.methodDiv.appendChild(removeButton);
        rowObject.textNode = document.createElement('div');
        rowObject.methodDiv.appendChild(rowObject.textNode);
        widget.methodArea.appendChild(rowObject.methodDiv);
        return rowObject;
    };

    var updateAttributeRows = function(widget) {
        for (var i=0; i<widget.attributeRows.length; i++) {
            var rowObject = widget.attributeRows[i];
            ui_util.setDropdownOptions(rowObject.dropdown, widget.clusterableAttributes);
        }
    };

    var createWidget = function(container, baseUrl, datasetNames, selectedDataset, datasetToColumnNames) {
        baseURL = baseUrl;
        var refineWidget = {
            attributeArea: null,
            attributeRows: [],
            methodArea: null,
            methodRows: [],
            datasetDropdown: null,
            clusterableAttributes : null,
            init: function() {
            	var description = document.createElement('div');
            	$(description).text("Note: Refining the data will delete all previously " +
            			"created refined columns and create new columns for every " +
            			"(attribute,method) pair requested. The process may take hours.");
                container.appendChild(description);
            	
                var datasetLabel = document.createTextNode("Dataset Name:");
                container.appendChild(datasetLabel);
                this.datasetDropdown = document.createElement('select');
                for (var i = 0; i < datasetNames.length; i++) {
                    var option = $('<option/>');
                    option.attr('value', datasetNames[i]);
                    option.html(datasetNames[i]);
                    $(this.datasetDropdown).append(option);
                }
                $(this.datasetDropdown).val(selectedDataset);
                container.appendChild(this.datasetDropdown);
                this.clusterableAttributes = datasetToColumnNames[selectedDataset];

                var that = this;

                this.attributeArea = document.createElement('div');
                container.appendChild(this.attributeArea);
                this.createAttributeRow('Refine Columns:', true);

                var addButton = document.createElement("button");
                addButton.innerHTML = '+';
                $(addButton).click(function() {
                    that.createAttributeRow('Refine column', true);
                });
                container.appendChild(addButton);

                this.methodArea = document.createElement('div');
                container.appendChild(this.methodArea);
                this.createMethodRow('Refine Method:', true);

                var addMethodButton = document.createElement("button");
                addMethodButton.innerHTML = '+';
                $(addMethodButton).click(function() {
                    that.createMethodRow('Refine Method', true);
                });
                container.appendChild(addMethodButton);

            },
            createAttributeRow: function(label, bCreateWeight) {
                var rowObject = createAttributeRow(this, label, bCreateWeight);
                this.attributeRows.push(rowObject);
            },
            createMethodRow: function(label, bCreateWeight) {
                var rowObject = createMethodRow(this, label, bCreateWeight);
                this.methodRows.push(rowObject);
            },
            refine: function() {
                var previousOutput = $('#refineOutput');
                if (previousOutput) {
                    previousOutput.remove();
                }
                var outputDiv = $('<div/>').width(500).attr('id','refineOutput');
                var outputLabel = $('<div/>').html('Output:');
                var outputTextArea = $('<textarea/>').width(500).height(200);
                outputDiv.append(outputLabel);
                outputDiv.append(outputTextArea);
                $(container).append(outputDiv);

                outputTextArea.val('Beginning refinement...');
            	
            	var datasetName = $(this.datasetDropdown).val();
                var columns = [];
                for (var i = 0; i < this.attributeRows.length; i++) {
                    columns.push(this.attributeRows[i].dropdown.value);
                }
                var methods = [];
                for (i = 0; i < this.methodRows.length; i++) {
                	methods.push(this.methodRows[i].dropdown.value);
                }
            	var refineConfiguration = {
            		columns: columns,
            		methods: methods,
            		ngramSize: 2
            	};
            	rest.post(baseURL + 'rest/refine/'+datasetName, refineConfiguration, 'Perform text refinement', function(response) {
                    outputTextArea.val("done refinement");
            	});
            },
            
            resize: function(width,height) {

            }
        };
        refineWidget.init();
        return refineWidget;
    };

	var showRefineDialog = function(baseUrl, datasetToColumnNames, selectedDataset) {
		var that = this;
        var dialogDiv = $('<div/>');
        $('body').append(dialogDiv);
        var datasets = [];
        for (var datasetName in datasetToColumnNames) {
            if (datasetToColumnNames.hasOwnProperty(datasetName)) {
                datasets.push(datasetName);
            }
        }
        var refineWidget = createWidget(dialogDiv[0], baseUrl, datasets, selectedDataset, datasetToColumnNames);

        var onRefine = function() {
            refineWidget.refine();
        };

        var onBack = function(){
            $(this).dialog("close");
        };

        var refineButtonSet = {
            "Refine" : onRefine,
            "Back" : onBack
        };

        dialogDiv.dialog({
            zIndex:30000000,
            width:650,
            modal:true,
            title:'Refine',

            // These two lines prevent the "x" from appearing in the corner of dialogs.   It's annoying to handle closing the dialog
            // this way so this is how we can prevent the user from doing this
            closeOnEscape: false,
            open: function(event, ui) {
                $(this).parent().children().children('.ui-dialog-titlebar-close').hide();
            },
            buttons: refineButtonSet,
            close: function() {
                dialogDiv.remove();
            },
            resizeStop: function(event, ui) {}
        });
	};
    
    
    return {
        createWidget:createWidget,
        showRefineDialog:showRefineDialog
    };
});
