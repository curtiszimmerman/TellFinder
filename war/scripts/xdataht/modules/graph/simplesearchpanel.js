
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

define([],
    function(){

        var createWidget = function(jqContainer, appWidget, baseUrl) {

            var BUTTONSET_WIDTH = 65;
            var OBJECT_PADDING = 2;
            var BUTTON_DIM = 20;
            var INPUT_DIV_WIDTH = 202;

            var searchWidgetObj = {
                iconContainer:null,
                inputBox:null,
                searchButton:null,
                init: function() {
                    this.createSimpleSearchCanvas();
                },

                onSearch: function() {
    				var that = this;
                    var person = this.personInput.is(':checked');
    				var org = this.organizationInput.is(':checked');
    				var location = this.locationInput.is(':checked');
    				var clusterType = 'person';
    				if (person) clusterType = 'person';
    				if (org) clusterType = 'org';
    				if (location) clusterType = 'location';
    				var searchStr = this.inputBox.val();
    				appWidget.doSimpleSearch(searchStr,clusterType);
                },

                createSimpleSearchCanvas: function() {
                    var that = this;

                    this.iconContainer = $('<div/>').attr('id','simpleSearchRadioButtons');
                    this.iconContainer.css({
                        position:'absolute',
                        left:OBJECT_PADDING + 'px',
                        top:'2px',
                        height:'20px',
                        width:BUTTONSET_WIDTH + 'px'
                    });
                    jqContainer.append(this.iconContainer);
                    this.createButtonSet(this.iconContainer);

                    var inputDiv = $('<div/>').css({
                        position:'absolute',
                        top:'1px',
                        left: (BUTTONSET_WIDTH) + 'px',
                        display:'inline-block',
                        width: INPUT_DIV_WIDTH
                    });
                    var inputLabel = $('<div/>').html('Search:').css({
                        display:'inline-block'
                    });
                    inputDiv.append(inputLabel);

                    this.inputBox = $('<input/>').attr('type','text');
                    $(this.inputBox).keypress(function(event) {
                        if (event.keyCode == 13) {
                            that.onSearch();
                        }
                    });
                    inputDiv.append(this.inputBox);
                    jqContainer.append(inputDiv);

                    this.searchButton = $('<button/>').text('Search').button({
                        text:false,
                        icons:{
                            primary:'ui-icon-search'
                        }
                    }).css({
                        position:'absolute',
                        top:'4px',
                        left:(BUTTONSET_WIDTH + INPUT_DIV_WIDTH) + 'px',
                        width:BUTTON_DIM + 'px',
                        height:BUTTON_DIM+ 'px'
                    }).click(function() {
                        that.onSearch();
                    });
                    jqContainer.append(this.searchButton);

                    this.infoButton = $('<button/>').text('Tutorial').button({
                        text:false,
                        icons:{
                            primary:'ui-icon-info'
                        }
                    }).css({
                        position:'absolute',
                        top:'4px',
                        left:(BUTTONSET_WIDTH + INPUT_DIV_WIDTH + (BUTTON_DIM+OBJECT_PADDING) ) + 'px',
                        width: BUTTON_DIM + 'px',
                        height: BUTTON_DIM + 'px'
                    }).click(function() {
                        window.open(baseUrl + 'help.html','_blank');
                    });
                    jqContainer.append(this.infoButton);
                },

                createButtonSet: function(container) {
                    this.personInput = $('<input/>').attr({
                        type:'radio',
                        id:'personInput',
                        name:'simpleSearchRadioButtons'
                    });
                    var personInputLabel = $('<label/>').attr('for','personInput').prop('title','Search on people clusters').width(BUTTON_DIM).height(BUTTON_DIM);
                    this.iconContainer.append(this.personInput);
                    this.iconContainer.append(personInputLabel);
                    $("#personInput").button({icons:{primary:'person'}}).width(BUTTON_DIM).height(BUTTON_DIM);

                    this.organizationInput = $('<input/>').attr({
                        type:'radio',
                        id:'organizationInput',
                        checked:'true',
                        name:'simpleSearchRadioButtons'
                    });
                    var organizationInputLabel = $('<label/>').attr('for','organizationInput').prop('title','Search on organization clusters').width(BUTTON_DIM).height(BUTTON_DIM);;
                    this.iconContainer.append(this.organizationInput);
                    this.iconContainer.append(organizationInputLabel);
                    $("#organizationInput").button({icons:{primary:'organization'}}).width(BUTTON_DIM).height(BUTTON_DIM);

                    this.locationInput = $('<input/>').attr({
                        type:'radio',
                        id:'locationInput',
                        name:'simpleSearchRadioButtons'
                    });
                    var locationInputLabel = $('<label/>').attr('for','locationInput').width(BUTTON_DIM).height(BUTTON_DIM).prop('title','Search on location clusters');
                    this.iconContainer.append(this.locationInput);
                    this.iconContainer.append(locationInputLabel);
                    $("#locationInput").button({icons:{primary:'place'}}).width(BUTTON_DIM).height(BUTTON_DIM);

                    container.buttonset();
                    $('#locationInput').attr("disabled", "disabled");
                    $("#simpleSearchRadioButtons").buttonset("refresh");
                },

                resize: function(w,h) {
                    this.width = w;
                    this.height = h;
                }
            };
            searchWidgetObj.init();
            return searchWidgetObj;
        };

        return {
            createWidget:createWidget
        }
    }
);