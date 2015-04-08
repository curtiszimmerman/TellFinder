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
define([ '../util/ui_util'], function( ui_util) {

    var attributeList = null;
    var DEFAULT_NAME = 'Link Criteria Name';


    var criteriaDialog = function(existingObject, callback) {
    	var criteriaDialogObj = {
    		nameInput: null,
    		nameSet: false,
			init: function() {
		        var dialogDiv = $('<div/>');
		        $('body').append(dialogDiv);

		        if (existingObject!=null) this.nameSet = true;
		        this.initializeDialogBody(dialogDiv, existingObject);

		        var that = this;
		        dialogDiv.dialog({
		            zIndex:30000000,
		            width:650,
		            modal:true,
		            buttons: {
		                "Ok" : function() {
		                    var attributeDropdowns = $('.linkCriteriaAttribute');
		                    var attributes = [];

		                    // If we only have one attribute and user hasn't set the name, name this criteria the
		                    // name of the single attribute they've created.
		                    var name = that.nameInput.val();
		                    if (attributeDropdowns.length>0 && name == DEFAULT_NAME) {
		                        name = $(attributeDropdowns[0]).val();
		                    }

		                    for (var i = 0; i < attributeDropdowns.length; i++) {
		                        attributes.push($(attributeDropdowns[i]).val());
		                    }
		                    if (attributes.length > 0) {
		                        callback({
		                            name: name,
		                            attributes: attributes
		                        });
		                    }
		                    $(this).dialog("close");
		                    dialogDiv.remove();
		                },
		                "Cancel" : function(){
		                    $(this).dialog("close");
		                    dialogDiv.remove();
		                }
		            },
		            // These two lines prevent the "x" from appearing in the corner of dialogs.   It's annoying to handle closing the dialog
		            // this way so this is how we can prevent the user from doing this
		            closeOnEscape: false,
		            open: function(event, ui) {
		                $(this).parent().children().children('.ui-dialog-titlebar-close').hide();

		            },
		            close: function() {
		                dialogDiv.remove();
		            },
		            resizeStop: function(event, ui) {}
		        });
			},
		    initializeDialogBody: function(container, existingObject) {
		    	var that = this;
		    	var header = $('<div/>');
		        header.append( document.createTextNode('Name:') );

		        this.nameInput = $('<input/>');
		        if (existingObject) {
		        	this.nameInput.val(existingObject.name);
		        } else {
		        	this.nameInput.val(DEFAULT_NAME);
		        }
		        this.nameInput.change(function(event) {
		        	that.nameSet = true;
		        });
		        header.append(this.nameInput);

		        var body = $('<div/>');
		        body.css('position','relative');
		        var attributeLabel = $('<div/>');
		        attributeLabel.html('Attributes:');
		        body.append(attributeLabel);

		        var addButton = $('<button/>');
		        addButton.click(function() {
		            that.addAttribute(body);
		        });
		        addButton.html('Add Attribute');

		        container.append(header);
		        container.append(body);
		        container.append(addButton);

		        if (existingObject) {
		            for (var i = 0; i < existingObject.attributes.length; i++) {
		                this.addAttribute(body, existingObject.attributes[i]);
		            }
		        } else {
		        	this.addAttribute(body);
		        }

		    },
		    addAttribute: function(container, selectedOption) {
		    	var that = this;
		    	var attributeContainer = $('<div/>');

		        var dropdown = $('<select/>');
		        dropdown.addClass('linkCriteriaAttribute');
		        for (var i = 0; i < attributeList.length; i++) {
		            var option = $('<option/>');
		            option.attr('value',attributeList[i]);
		            option.html(attributeList[i]);
		            dropdown.append(option);
		        }
		        if (selectedOption) {
		            dropdown.val(selectedOption);
		        }
		        dropdown.change(function(event) {
                    var attribute = $(event.currentTarget).val();
		        	if (!that.nameSet) {
		        		that.nameInput.val(attribute);
		        	}
		        });
		        dropdown.css({
		            position:'relative',
		            left:'0px',
		            width:'200px'
		        });
		        attributeContainer.append(dropdown);

		        var removeButton = $('<button/>');
		        removeButton.html('-');
		        removeButton.css({
		            position:'relative',
		            left: '5px'
		        });
		        removeButton.click(function() {
		            attributeContainer.remove();
		        });
		        attributeContainer.append(removeButton);

		        $(container).append(attributeContainer);
		    }
			
    	};
    	criteriaDialogObj.init();
    	return criteriaDialogObj;
    };
    
    return {
        new: function(callback) {
            new criteriaDialog(null, callback);
        },
        edit: function(linkCriteriaObject, callback) {
        	new criteriaDialog(linkCriteriaObject,callback);
        },
        updateAttributes: function(attributes) {
            attributeList = [];
            for (var i = 0; i < attributes.length; i++) {
                attributeList.push(attributes[i]);
            }
        }
    };
});