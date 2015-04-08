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
define(['../util/rest', '../util/ui_util', '../util/menu', '../util/colors', '../util/advancedsearch'], function(rest, ui_util, menu, colors, AdvancedSearch) {
	var dataset = 'ht',
		ATTRIBUTE_MODE = false;

	createWidget = function(container, baseUrl, domain, onSearchTip, onSearchCSV, onSearchImage, onAdvancedSearch, onSearchUrl) {
		var searchWidget = {
			init: function() {
				if (domain) dataset = domain;
				var that = this;
                var _populateMenu = function() {
                    that.createTipEntry();
                };

                this.useElasticSearch = false;
                rest.get(baseUrl+'rest/overview/elasticsearchproperties', 'Use elastic search?', function(response) {
                    that.useElasticSearch = response.useElasticSearch;
                    that.elasticSearchProperties = response.properties;
                    _populateMenu();
                },_populateMenu);

			},
			doSearchTip: function(query) {
				this.tipInputBox.val(query);
				onSearchTip(false, this.tipInputBox.val());
			},
			onExploreTip : function() {
				var tip = this.tipInputBox.val();
				if (tip === null) {
					return;
				} else {
					tip = tip.trim();
				}
				window.open(baseUrl + 'graph.html?tip=' + tip + '&explorer=true','_blank');
			},
            doAdvancedSearch : function(descriptors,mode) {
                var _getDescriptorURLParameter = function(descriptor) {
                    var param = '';
                    switch(descriptor.name) {
                        case AdvancedSearch.FIELDS.PHONE:
                            param += 'phone';
                            break;
                        case AdvancedSearch.FIELDS.WEBSITE:
                            param += 'website';
                            break;
                        case AdvancedSearch.FIELDS.EMAIL:
                            param += 'email';
                            break;
                        case AdvancedSearch.FIELDS.LOCATION:
                            param += 'location';
                            break;
                        case AdvancedSearch.FIELDS.TEXT:
                            param += 'text';
                            break;
                        case AdvancedSearch.FIELDS.STARTDATE:
                            param += 'startdate';
                            break;
                        case AdvancedSearch.FIELDS.ENDDATE:
                            param += 'enddate';
                            break;
                    }
                    param += '=';
                    param += encodeURIComponent(descriptor.value);
                    return param;
                };


                var params = '';
                for (var i = 0; i < descriptors.length-1; i++) {
                    params += _getDescriptorURLParameter(descriptors[i]) + '&';
                }
                params += _getDescriptorURLParameter(descriptors[descriptors.length-1]);

                switch(mode) {
                    case AdvancedSearch.MODES.EXPLORE:
                        var url = baseUrl + 'graph.html?advanced=true&explorer=true&' + params;
                        window.open(url,'_blank');
                        break;
                    case AdvancedSearch.MODES.GRAPH:
                        var url = baseUrl + 'graph.html?advanced=true&explorer=false' + params;
                        window.open(url,'_blank');
                        break;
                    case AdvancedSearch.MODES.ATTRIBUTES:
                        onAdvancedSearch(true);
                        break;
                    case AdvancedSearch.MODES.ENTITIES:
                        onAdvancedSearch(false);
                        break;
                }
            },

			buildSearchDialog: function() {
				var that = this;

				this.searchDialog = $('<div/>');
				this.searchDialog.css({position:'absolute',
					top:'40px',right:'0px',width:'200px', 
					background:'white', 
					border:'1px solid black','border-radius':'5px'});
				this.searchDialog.visible = false;

				var searchAds = $('<button/>').text('Search Ads').button().css({'margin-top':'5px'}).click(function() {
					window.open(baseUrl + 'adsearch.html?tip=' + that.tipInputBox.val(),'_blank');
				});
				this.searchDialog.append(searchAds);
				var brElem = document.createElement('br');
				this.searchDialog.append(brElem);

				var searchEntities = $('<button/>').text('Search Entities').button().css({'margin-top':'5px'}).click(function() {onSearchTip(false, that.tipInputBox.val());});
				this.searchDialog.append(searchEntities);
				brElem = document.createElement('br');
				this.searchDialog.append(brElem);

				var searchAttributes = $('<button/>').text('Search Attributes').button().css({'margin-top':'5px'}).click(function() {onSearchTip(true, this.tipInputBox.val());});
				this.searchDialog.append(searchAttributes);
				brElem = document.createElement('br');
				this.searchDialog.append(brElem);

				var formDiv = document.createElement('form');
				formDiv.action = baseUrl + 'rest/overview/imageclusterdetails';
				formDiv.method = 'POST';
				formDiv.enctype = 'multipart/form-data';
				var fileInput = document.createElement('input');
				fileInput.type = 'file';
				fileInput.name = 'file';
				fileInput.size = 45;
				$(formDiv).append(fileInput);
				var submit = document.createElement('input');
				submit.type = 'submit';
				submit.value = 'Search Image';
				$(formDiv).append(submit);
				formDiv.addEventListener("submit", function(e) {
					e.preventDefault();
					return true;
//					$(that.container).dialog("close");
				}, false);
				this.searchDialog.append(formDiv);

				
				container.appendChild(this.searchDialog[0]);
			},
			
			toggleSearchDialog: function() {
				if (!this.searchDialog) {
					this.buildSearchDialog();
				}
				if (this.searchDialog.visible) {
					this.searchDialog.css('display','none');
				} else {
					this.searchDialog.css('display','');
				}
				this.searchDialog.visible = !this.searchDialog.visible;
			},
			
			createTipEntry: function() {
				var that = this;
				var enterTip = $('<div/>');
                enterTip.css({
                	right: '20px',
                	width: '185px',
                	top: '20px',
                	height: '20px',
                	position: 'absolute',
                	'font-weight':'bold'
                });
                enterTip.text('Enter Tip');
                container.appendChild(enterTip.get(0));

                this.tipInputBox = $('<input/>').attr('type','text');
                $(this.tipInputBox).css({
                    position:'absolute',
                    left:'60px',
                	height: '12px',
                	width: '100px'
                }).keypress(function(event) {
                    if (event.keyCode == 13) {
                        onSearchTip(false, that.tipInputBox.val());
                    }
                });
                enterTip.append(this.tipInputBox);
				this.tipInputBox.focus();

                this.searchButton = $('<button/>').text('Search').button({
                    text:false,
                    icons:{
                        primary:'ui-icon-search'
                    }
                }).css({
                    position:'absolute',
                    top:'0px',
                    left:'161px',
                    width:'18px',
                    height:'18px'
                }).click(function() {
                    onSearchTip(false, that.tipInputBox.val());
                });
                enterTip.append(this.searchButton);

				this.searchSelectButton = $('<button/>').text('Search Options').button({
					text:false,
					icons:{
						primary:'ui-icon-triangle-1-s'
					}
				}).css({
					position:'absolute',
					left:'180px',
					top:'0px',
					width:'18px',
					height:'18px'
				}).click(function(e) {
                    var contextMenuSpec = [
                        {type: 'action', label:'List Entities', callback:function() {onSearchTip(false, that.tipInputBox.val());}},
                        {type: 'action', label:'Explore Ads', callback:function() {that.onExploreTip();}},
                        {type: 'action', label:'List Ads', callback:function() {
                            window.open(baseUrl + 'adsearch.html?tip=' + that.tipInputBox.val(),'_blank');
                        }},
                        {type: 'action', label:'List Attributes', callback:function() {onSearchTip(true, that.tipInputBox.val());}}
                    ];

                    if (that.useElasticSearch) {
                        contextMenuSpec.push({type: 'action', label:'Advanced Options...', callback:function() {AdvancedSearch.create(that.elasticSearchProperties, that.doAdvancedSearch);}});
                    }
	            	menu.createContextMenu(e, contextMenuSpec);
				});
//				this.searchSelectButton.attr('title', 'Toggle Advanced Search')
                enterTip.append(this.searchSelectButton);
                
        		function handleFileDrop(contents, type) {
        			if (type=='image') {
        				onSearchImage(contents);
        			} else if (type=='url') {
                        onSearchUrl(contents);
                    }
                    else {
        				onSearchCSV(contents);
        			}
        		}
        		ui_util.makeFileDropTarget(container, handleFileDrop);

				//disable the drop feature for the window, highlight the tip input box.
				$('#rootContainer').bind({
					dragover: function (e) {
						that.tipInputBox.css('background-color',colors.OVERVIEW_HIGHLIGHT);
					},
					dragleave: function(event) {
						that.tipInputBox.css('background-color', '');
					}
				});
			},
		};
		searchWidget.init();
		return searchWidget;
	};


	return {
		createWidget:createWidget
	}
});
