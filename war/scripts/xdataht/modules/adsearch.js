
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

define([ './util/ui_util', './graph/table', './util/rest', './graph/timeline', './graph/attr_chart', './graph/map', './graph/wordcloud', './graph/images', './graph/selection', './util/colors'],
    function( ui_util, table, rest, timeline, attr_chart, map, wordcloud, images, selection, colors) {
	var WIDGET_TITLE_HEIGHT = 20,
		BORDER_STYLE = '1px solid '+ colors.BORDER_DARK,
		TRANSITION_TIME = 700;

	var createSidePanel = function(label, hasDetails) {
		var result = {
			label:label,
			widget:null,
			hasDetails:false,
			header:null,
			canvas:null,
			collapsed:true,
			collapseDiv:null,
			uncollapse:120,
			height:WIDGET_TITLE_HEIGHT,
			amp:null
		}
		return result;
	};
	

    var createWidget = function(container, baseUrl, tip, type) {
		var adSearchWidgetObj = {
			sidePanels: {
				movement: createSidePanel('Movement',true),
				map: createSidePanel('Map',true),
				wordcloud: createSidePanel('Word Cloud',true),
				attributes: createSidePanel('Attributes',true),
				images: createSidePanel('Images',true)
			},
			sidePanelWidth:300,
			selection:selection.createSelectionManager(),

			init: function() {
				var that = this;
				var jqContainer = $(container);
				this.detailsCanvas = $('<div/>');
				this.detailsCanvas.css({
					position:'absolute',
					top:'22px',
					right:'0px',
					left:'0px',
					bottom:'0px', 
					overflow:'auto',
					'border-top':'1px solid #DEDEDE', 
					'border-right':'1px solid #DEDEDE'});
				jqContainer.append(this.detailsCanvas);
				
				this.createTipEntry();
				
				if (tip && tip.length>1) {
					this.tipInputBox.val(tip);
					this.onSearchTip(type);
				}
				this.initSidePanels();

				this.amplifyInit();
			},

			amplifyInit: function() {
				var setPanel = function (panel, amp) {
						panel.height = Math.max(WIDGET_TITLE_HEIGHT,amp.height);
						panel.uncollapse = amp.uncollapse;
						panel.collapsed = amp.collapsed;
					},
					sidePanelWidthAmp = amplify.store('sidePanelWidth'),
					detailsHeightAmp = amplify.store('detailsHeight');

				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						var panel = this.sidePanels[sidePanelIter];
						panel.amp = amplify.store(sidePanelIter);
						if (panel.amp) setPanel(panel,panel.amp);
					}
				}
					
				this.sidePanelWidth = sidePanelWidthAmp?sidePanelWidthAmp:300;
			},
			
			initSidePanels: function () {
				var that = this,
					jqContainer = $(container),
					startX = 0, startY = 0;
				var that = this,
					jqContainer = $(container),
					startX = 0, startY = 0,
					makeCollapsible = function(sidePanel) {
						sidePanel.collapseDiv = $('<div/>')
							.addClass('ui-icon')
							.addClass(sidePanel.collapsed?'ui-icon-triangle-1-e':'ui-icon-triangle-1-s')
							.css({
								position:'relative',
								float:'left',
								cursor:'pointer',
								width:'16px',
								height:'16px'
							});
						sidePanel.label.css({
							height:WIDGET_TITLE_HEIGHT+'px',
							cursor:'pointer',
							position:'relative',
							width: 'calc(100% - 17px)',
							float:'left',
							'padding-top':'1.5px',
							'font-weight':'bold',
							'white-space': 'nowrap',
							color: colors.SIDEPANEL_LABEL,
							overflow:'hidden'
						});
						sidePanel.header.append(sidePanel.collapseDiv);
						sidePanel.header.append(sidePanel.label);
						sidePanel.header.on('click', function(event) {
							var i,
								numUncollapsed = 0;
							if (sidePanel.collapsed) {
								var heightToSteal = 0,
									heightTaken = 0,
									curHeightTaken;
	
								sidePanel.collapsed = false;
								sidePanel.collapseDiv.removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-s');
	
								for (sidePanelIter in that.sidePanels) {
									if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
										var panel = that.sidePanels[sidePanelIter];
										if (panel==sidePanel) continue;
										if (!panel.collapsed) {
											numUncollapsed++;
											heightToSteal += panel.height;
										}
									}
								}
	
								if (numUncollapsed>0) {
									for (sidePanelIter in that.sidePanels) {
										if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
											var panel = that.sidePanels[sidePanelIter];
											if (panel==sidePanel) continue;
											if (!panel.collapsed) {
												curHeightTaken = panel.height/(numUncollapsed+1);
												panel.height -= curHeightTaken;
												heightTaken += curHeightTaken;
											}
										}
									}
									sidePanel.height += heightTaken;
								} else {
									sidePanel.height = sidePanel.uncollapse;
								}
							} else {
								sidePanel.collapsed = true;
								sidePanel.collapseDiv.removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
	
								for (sidePanelIter in that.sidePanels) {
									if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
										var panel = that.sidePanels[sidePanelIter];
										if (panel==sidePanel) continue;
										if (!panel.collapsed) numUncollapsed++;
									}
								}
								if (numUncollapsed>0) {
									for (sidePanelIter in that.sidePanels) {
										if (that.sidePanels.hasOwnProperty(sidePanelIter)) {
											var panel = that.sidePanels[sidePanelIter];
											if (panel==sidePanel) continue;
											if (!panel.collapsed) panel.height += sidePanel.height/numUncollapsed;
										}
									}
								}
								sidePanel.uncollapse = sidePanel.height;
								sidePanel.height = WIDGET_TITLE_HEIGHT;
							}
							that.panelResize();
						});
					},
					createPanel = function(sidePanel) {
						sidePanel.header = $('<div/>')
							.css({
								width:that.sidePanelWidth+'px',
								top:sidePanel.top+'px',
								position:'absolute'
							}).addClass('moduleHeader');
						sidePanel.label = $('<div/>')
							.css({
								position:'absolute',
								left:'2px',
								top:'1px'
							}).text(sidePanel.label);
						sidePanel.canvas = $('<div/>')
							.css({
								position:'absolute',
								top:WIDGET_TITLE_HEIGHT+'px',
								right:'0px',
								'padding-top':'1.5px',
								width:that.sidePanelWidth+'px',
								height:(sidePanel.height-WIDGET_TITLE_HEIGHT)+'px',
								overflow:'hidden',
								'border-left': BORDER_STYLE,
								cursor: 'default'
							});
						jqContainer.append(sidePanel.header).append(sidePanel.canvas);
					},
					makeDraggable = function(upperPanel, sidePanel) {
						sidePanel.header.draggable({
							axis:'y',
							helper: 'clone',
							start: function(event, ui) {
								if (upperPanel.collapsed||sidePanel.collapsed) return false;
								startY = event.clientY;
							},
							stop: function(event, ui) {
								var endY = event.clientY,
									delta = endY-startY;
								if (sidePanel.height-delta<WIDGET_TITLE_HEIGHT) delta = sidePanel.height-WIDGET_TITLE_HEIGHT;
								if (upperPanel.height+delta<WIDGET_TITLE_HEIGHT) delta = WIDGET_TITLE_HEIGHT-upperPanel.height;
								sidePanel.height -= delta;
								upperPanel.height += delta;
								that.panelResize();
							}
						});
					};

				//add the side panels
				var prevPanel = null;
				var curY = 0;
				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						var panel = this.sidePanels[sidePanelIter];
						panel.top = curY;
						panel.height = WIDGET_TITLE_HEIGHT;
						curY += WIDGET_TITLE_HEIGHT;
						createPanel(panel);
						makeCollapsible(panel);
						if (prevPanel!=null) {
							makeDraggable(prevPanel,panel);
						}
						prevPanel = panel;
					}
				}
	
				//resize for side panel
				this.resizeBar = $('<div/>')
					.css({
						position:'absolute',
						bottom:'0px',
						top:'0px',
						width:'3px',
						right:this.sidePanelWidth+'px',
						background:'#EEE',
						cursor:'ew-resize'
					}).draggable({
						axis:'x',
						cursor: 'ew-resize',
						helper: 'clone',
						start: function(event, ui) {
							startX = event.clientX;
						},
						stop: function(event, ui) {
							var endX = event.clientX,
								w = that.sidePanelWidth-(endX-startX);
							if (w<10) w = 10;
							that.sidePanelWidth = w;
							amplify.store('sidePanelWidth', w);
							that.panelResize();
						}
					});
				jqContainer.append(this.resizeBar);
				
			},			
			
			createTipEntry: function() {
				var that = this;
				var enterTipContainer = $('<div/>')
						.css({
							'margin':'2px',
							width: '800px',
							height: '22px',
							position: 'relative',
							float:'left',
							'font-weight':'bold'
						}),
				enterTip = $('<div/>')
					.css({
						width:'70px',
						position:'relative',
						float:'left',
						'padding-top':'1px'
					});
                enterTip.text('Enter Tip');
                container.appendChild(enterTipContainer.get(0));
				enterTipContainer.append(enterTip);

                this.tipInputBox = $('<input/>').attr('type','text');
                $(this.tipInputBox).css({
                    position:'relative',
					float:'left',
                	height: '12px',
                	width: '600px'
                }).keypress(function(event) {
                    if (event.keyCode == 13) {
                        that.onSearchTip();
                    }
                });
				enterTipContainer.append(this.tipInputBox);

                this.searchButton = $('<button/>').text('Search').button({
                    text:false,
                    icons:{
                        primary:'ui-icon-search'
                    }
                }).css({
                    position:'relative',
                    top:'0px',
					float:'left',
                    width:'18px',
                    height:'18px'
                }).click(function() {
                    that.onSearchTip();
                });
				enterTipContainer.append(this.searchButton);
			},

			onSearchTip: function(type) {
				var that = this,
					newTip = this.tipInputBox.val();
				if(newTip!==tip&&!type) {
					tip = newTip;
				}
            	this.showLoadingDialog('Loading tip data');
		        rest.get(baseUrl + 'rest/tipAdDetails/' + ((type===null||type===undefined)?'tip':type) + '/' + tip,
		        	'Get tip ads', function(adDetails) {
		        		that.hideLoadingDialog();

						that.detailsCanvas.empty();
						if (that.table) {
							that.table.destroyTable();
						}

						if(adDetails) {
							that.showAdDetails(adDetails, tip);
						} else {
							alert('No ads found for search tip: ' + tip);
						}
		        	}, true,
		        	function(failedResult) {
		        		that.hideLoadingDialog();
		        		alert('Failed to get tip data ' + failedResult.status + ': ' + failedResult.message);
		        	});
			},
			
			showLoadingDialog: function(message) {
            	this.dialog = $('<div/>');
            	this.dialog.css({'background' : 'url("./img/ajaxLoader.gif") no-repeat center center'});
            	this.dialog.html(message+'. Please wait...');
				this.dialog.dialog();
			},

			hideLoadingDialog: function() {
	        	$(this.dialog).dialog('destroy');
			},
			
            showAdDetails: function(response, title) {
                var i, j,
					headerList = [],
					objectData = [];
                for (i=0; i<response.memberDetails.length; i++) {
                    var fields = response.memberDetails[i].map.entry;
                    var obj = {};
                    for (j=0; j<fields.length; j++) {
                    	if (i==0) headerList.push(fields[j].key);
                    	obj[fields[j].key] = fields[j].value;
                    }
                    objectData.push(obj);
                }

				this.table = table.createWidget(baseUrl, null, this.detailsCanvas, headerList, objectData, title, this.selection, false);
				this.table.searchFn = function(attribute, value) {
					window.open(baseUrl+'adsearch.html?tip='+value)
				};
				
				var entityDetails,
					transformedResponse = { memberDetails : [] };
				for (i=0; i < response.memberDetails.length; i++) {
					entityDetails = {};
					for (j = 0; j < response.memberDetails[i].map.entry.length; j++) {
						entityDetails[response.memberDetails[i].map.entry[j].key] = response.memberDetails[i].map.entry[j].value;
					}
					transformedResponse.memberDetails.push(entityDetails);
				}

				this.showClusterDetails(transformedResponse, title);
            },
            
			showClusterDetails: function(response, title) {
				var headerList = [],
				objectData = [],
				that = this,
				i = 0, fields;

				if (!title && response.label) {
					title = response.label;
				}
	
				for (i; i<response.memberDetails.length; i++) {
					fields = response.memberDetails[i];
					if (i==0) {
						for (var field in fields) {
							if (fields.hasOwnProperty(field)) {
								headerList.push(field);
							}
						}
					}
					fields.locationLabel = fields.location;
					objectData.push(fields);
				}

				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						this.sidePanels[sidePanelIter].canvas.css('background-image', '');
					}
				}

				this.sidePanels['movement'].canvas.empty();
				if (this.sidePanels['movement'].widget) {
					this.sidePanels['movement'].widget.destroy();
				}
				this.sidePanels['movement'].widget = new timeline.createWidget(this.sidePanels['movement'].canvas.get(0), objectData, this.selection);
				this.sidePanels['movement'].widget.resize(this.sidePanelWidth, this.sidePanels['movement'].height);
	
				this.sidePanels['map'].canvas.empty();
				this.sidePanels['map'].widget = new map.createWidget(baseUrl, this.sidePanels['map'].canvas.get(0), objectData, this.selection);
				this.sidePanels['map'].widget.resize(this.sidePanelWidth, this.sidePanels['map'].height);
	
				this.sidePanels['wordcloud'].canvas.empty();
				if (this.sidePanels['wordcloud'].widget) {
					this.sidePanels['wordcloud'].widget.destroy();
				}
				this.sidePanels['wordcloud'].widget = new wordcloud.createWidget(baseUrl, this.sidePanels['wordcloud'].canvas, objectData, this.selection);
				this.sidePanels['wordcloud'].widget.resize(this.sidePanelWidth, this.sidePanels['wordcloud'].canvas.height());
	
				this.sidePanels['attributes'].canvas.empty();
				if (this.sidePanels['attributes'].widget) {
					this.sidePanels['attributes'].widget.destroy();
				}
				this.sidePanels['attributes'].widget = new attr_chart.createWidget(this.sidePanels['attributes'].canvas, objectData);
				this.sidePanels['attributes'].widget.resize(this.sidePanelWidth, this.sidePanels['attributes'].canvas.height());
	
				this.sidePanels['images'].canvas.empty();
				if (this.sidePanels['images'].widget) {
					this.sidePanels['images'].widget.destroy();
				}
				this.sidePanels['images'].widget = new images.createWidget(baseUrl, this.sidePanels['images'].canvas, objectData, this.selection);
				this.sidePanels['images'].widget.resize(this.sidePanelWidth, this.sidePanels['images'].canvas.height());
				this.sidePanels['images'].widget.searchFn = function(value) {
					that.fetchImageGraph(value);
				};
	
				this.selection.listen('table', function(selectedIds) { that.table.selectionChanged(selectedIds); });
				this.selection.listen('timeline', function(selectedIds) { that.sidePanels['movement'].widget.selectionChanged(selectedIds); });
				this.selection.listen('map', function(selectedIds) { that.sidePanels['map'].widget.selectionChange(selectedIds); });
				this.selection.listen('images', function(selectedIds) { that.sidePanels['images'].widget.selectionChanged(selectedIds); });
			},

			panelResize: function() {
				var totalHeight = 0,
					overflow,
					delta;
	
				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						var panel = this.sidePanels[sidePanelIter];
						totalHeight += panel.height;
					}
				}
				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						var panel = this.sidePanels[sidePanelIter];
						if (totalHeight>this.height && panel.height>WIDGET_TITLE_HEIGHT) {
							overflow = totalHeight-this.height;
							delta = Math.min(overflow,panel.height-WIDGET_TITLE_HEIGHT);
							panel.height -= delta;
							totalHeight -= delta;
						}
					}
				}
				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						var panel = this.sidePanels[sidePanelIter];
						if (totalHeight<this.height && !panel.collapsed) {
							panel.height += this.height-totalHeight;
							totalHeight = this.height;
						}
					}
				}
	
				var curY = 0;
				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						var panel = this.sidePanels[sidePanelIter];
						panel.header.css({width:this.sidePanelWidth + 'px', top:curY + 'px'});
						curY += WIDGET_TITLE_HEIGHT;
						panel.canvas.css({width:this.sidePanelWidth + 'px', top:curY + 'px',height:(panel.height-WIDGET_TITLE_HEIGHT) + 'px'});
						curY += panel.height-WIDGET_TITLE_HEIGHT;
						if (panel.widget) {
							panel.widget.resize(this.sidePanelWidth, panel.canvas.height());
						}
					}
				}

				
				this.detailsCanvas.css({right:this.sidePanelWidth+'px',height:this.detailsHeight+'px'});
				this.resizeBar.css({right:this.sidePanelWidth+'px'});

				this.amplifyUpdate();
			},
			
			amplifyUpdate: function() {
				for (sidePanelIter in this.sidePanels) {
					if (this.sidePanels.hasOwnProperty(sidePanelIter)) {
						var panel = this.sidePanels[sidePanelIter];
						var amplifyStore = {
								height: panel.height,
								uncollapse: panel.uncollapse,
								collapsed: panel.collapsed
							};

						amplify.store(sidePanelIter, amplifyStore);
					};
				}
			},

			
			resize: function(w,h) {
				this.width = w;
				this.height = h;
				this.panelResize();
			},
		    displayDetailsSpinners: function() {
                this.detailsCanvas.empty();
		    	this.detailsCanvas.css({'background' : 'url("./img/ajaxLoader.gif") no-repeat center center'});
		    },
            softClear : function() {
                this.detailsCanvas.empty();
            }
		};
		adSearchWidgetObj.init();
		return adSearchWidgetObj;
	};
	
	return {
		createWidget:createWidget
	}
});
