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

    var baseURL = null;

    var updateTagsOnServer = function(updateTagRequest, callback) {
        rest.post(baseURL + 'rest/tags/update',updateTagRequest,'UpdateTags', callback, true);
    };

    var resetAllTags = function(baseUrl, callback) {
        var that = this;
        var dialogDiv = $('<div title="WARNING">This will remove all tags for every ad.   Are you sure you wish to continue?</div>');
        $('body').append(dialogDiv);
        var onCancel = function(){
            $(this).dialog("close");
        };

        var onOk = function() {
            rest.delete(baseUrl + 'rest/tags/resetAllTags', null, 'Reset all tags', callback, true);
            $(this).dialog("close");
        };

        var buttonSet = {
            "Ok" : onOk,
            "Cancel" : onCancel
        };

        dialogDiv.dialog({
            zIndex:30000000,
            width:650,
            modal:true,

            // These two lines prevent the "x" from appearing in the corner of dialogs.   It's annoying to handle closing the dialog
            // this way so this is how we can prevent the user from doing this
            closeOnEscape: false,
            open: function(event, ui) {
                $(this).parent().children().children('.ui-dialog-titlebar-close').hide();

            },
            buttons: buttonSet,
            close: function() {
                dialogDiv.remove();
            },
            resizeStop: function(event, ui) {}
        });
    };

    var fetchTags = function(adIds, callback) {
        rest.post(baseURL + 'rest/tags/fetch',{list:adIds},'Fetch tags', callback);
    };

    var modifyTags = function(adIds, tagArray, add, callback) {
        if (tagArray && tagArray.length > 0) {
            var request = {
                tags : tagArray,
                adIds : adIds,
                add : add
            };
            updateTagsOnServer(request, callback);
        } else {
            callback();
        }
    };

    var addTagRow = function(container, tag, bShowRemoveButton, tagsToRemove) {
        var tagDivContainer = $('<div/>');
        container.append(tagDivContainer);

        var tagDiv = $('<div/>').css({display:'inline-block'});
        tagDiv.html(tag);
        tagDivContainer.append(tagDiv);

        if (bShowRemoveButton) {
            var removeButton = $('<button/>').button({
                text:false,
                icons: {
                    primary: 'ui-icon-close'
                }
            });
            removeButton.click(function() {
                tagsToRemove.push(tag);
                tagDivContainer.remove();
            });
            tagDivContainer.append(removeButton);
        }
    };

    var convertAdIdsResponse = function(adIdsToTags) {
        var adIdsJSON = {};
        if (_.isArray(adIdsToTags.entry) ) {
            for (var i = 0; i < adIdsToTags.entry.length; i++) {
                var idAndTagList = adIdsToTags.entry[i];
                if (idAndTagList.value) {
                    adIdsJSON[idAndTagList.key] = _.isArray(idAndTagList.value.list) ? idAndTagList.value.list : [idAndTagList.value.list];
                }
            }
        } else {
            if (adIdsToTags.entry.value) {
                adIdsJSON[adIdsToTags.entry.key] = _.isArray(adIdsToTags.entry.value.list) ? adIdsToTags.entry.value.list : [adIdsToTags.entry.value.list];
            }
        }
        return adIdsJSON;
    };

    var createWidget = function(container, baseUrl, adIds) {
        baseURL = baseUrl;
        var adIdsToTags = null;
        var tagsToRemove = [];
        var tagsToAdd = [];
        var allCurrentTags = {};
        var tagWidget = {
            init: function() {

                var existingTagContainer = $('<div/>').html("Existing Tags:");
                $(container).append(existingTagContainer);

                var tagContainer = $('<div/>').html("Tags:");
                $(container).append(tagContainer);

                var controlContainer = $('<div/>');
                $(container).append(controlContainer);

                var tagInput = $('<input/>');
                tagInput.attr('type','text');
                controlContainer.append(tagInput);

                var addTagButton = $('<button/>');
                addTagButton.html("Add");
                addTagButton.click(function() {
                    var newTag = tagInput.val();
                    if (tagsToAdd.indexOf(newTag) == -1) {
                        addTagRow(tagContainer, tagInput.val());
                        tagsToAdd.push(newTag);
                        tagInput.val('');
                    }
                });
                controlContainer.append(addTagButton);


                var clearAllTagsButton = $('<button/>');
                clearAllTagsButton.html("Clear All");
                clearAllTagsButton.click(function() {
                    existingTagContainer.empty();
                    for (var tag in allCurrentTags) {
                        if (allCurrentTags.hasOwnProperty(tag)) {
                            tagsToRemove.push(tag);
                        }
                    }
                });
                controlContainer.append(clearAllTagsButton);



                fetchTags(adIds, function(response) {
                    var i;
                    var tagCounts = {};
                    if (response.adIdToTags == null) {

                    } else {
                        var adIdToTags = convertAdIdsResponse(response['adIdToTags']);

                        var adCount = 0;
                        for (var adId in adIdToTags) {
                            if (adIdToTags.hasOwnProperty(adId)) {
                                adCount++;
                                for (i = 0; i < adIdToTags[adId].length; i++) {
                                    if (tagCounts[adIdToTags[adId][i]]) {
                                        tagCounts[adIdToTags[adId][i]] = tagCounts[adIdToTags[adId][i]] + 1;
                                    } else {
                                        tagCounts[adIdToTags[adId][i]] = 1;
                                    }
                                }
                            }
                        }

                        var addMultipleTagsText = false;
                        for (var tag in tagCounts) {
                            allCurrentTags[tag] = true;
                            if (tagCounts.hasOwnProperty(tag)) {
                                if (tagCounts[tag] == adCount) {
                                    addTagRow(existingTagContainer, tag, true, tagsToRemove);
                                } else {
                                    addMultipleTagsText = true;
                                }
                            }
                        }
                        if (addMultipleTagsText) {
                            addTagRow(existingTagContainer, "Multiple Tags", false);
                        }
                    }
                });
            },
            updateTags: function(callback) {
                modifyTags(adIds, tagsToRemove, false, function() {
                    modifyTags(adIds, tagsToAdd, true, function() {
                        callback(tagsToAdd, tagsToRemove);
                    });
                });
            }
        };
        tagWidget.init();
        return tagWidget;
    };

    var showTagDialog = function(baseUrl, adIdsToTagMap, callback) {
        var that = this;
        var dialogDiv = $('<div/>');
        $('body').append(dialogDiv);
        var tagWidget = createWidget(dialogDiv[0], baseUrl, adIdsToTagMap);

        var onCancel = function(){
            $(this).dialog("close");
        };

        var onOk = function() {
            tagWidget.updateTags(callback);
            $(this).dialog("close");
        };

        var clusterButtonSet = {
            "Ok" : onOk,
            "Cancel" : onCancel
        };

        dialogDiv.dialog({
            zIndex:30000000,
            width:650,
            modal:true,

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
        showTagDialog: showTagDialog,
        resetAllTags: resetAllTags
    };
});

