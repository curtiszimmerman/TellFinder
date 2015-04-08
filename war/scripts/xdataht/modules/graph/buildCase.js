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
define([ '../util/ui_util', '../util/rest', '../util/menu', '../util/colors'], function( ui_util, rest, menu, colors) {
	var BORDER_STYLE = '1px solid ' + colors.CASE_BORDER,

	createWidget = function(container, baseUrl, explorer) {
		var widgetObj = {
			currentCase: {},
			user: null,
			nodeIds:{true:{},false:{}},
			nodeCount:0,
			isNew:null,
			newData:null,
			$fileButton: $('<div/>'),
			$exportButton: $('<div/>'),
			$publicButton: $('<div/>'),
			$notifier:$('<div/>'),
			$nodeTable:$('<div/>'),
			$loadPopup:$('<div/>'),
			$getCaseNamePopup:$('<div/>'),
            dropTarget : $('<div class="case-builder-drop-target"><span class="case-builder-drop-target-inner">Drop Here</span></div>'),

			init: function() {

				this.width = container.width();
				this.height = container.height();
				var that = this,
					BUTTON_WIDTH = '62px',
					PADDING = '4px',
					$buttonContainer = $('<div/>').css({
						width: container.width()+'px',
						'padding-top': PADDING
					}),
					$caseTitleContainer = $('<div/>').css({
							position: 'relative',
							'padding-top': PADDING,
							'margin-left': '5px',
							clear: 'both',
							width: '100%'
						}).append($('<i id="case-title-icon" style="float:left" class="ui-icon ui-icon-folder-collapsed"></i>'
						)).append($('<span id="case-title""></span>').css({
									'padding-left': PADDING,
									'font-size': '14px',
									'font-weight': 'bold',
									'font-family': 'Arial,Helvetica,sans-serif'
								})
					),
					createContextMenu = function(event, isFile) {
						var items = [];
						if(isFile) {
							items.push({
								type: 'action',
								label: 'Load',
								callback: function() {
									that.loadCase()
								}
							});
							items.push({
								type: 'action',
								label: 'New',
								callback: function() {
									that.newCase()
								}
							});
							if(that.currentCase.case_name) {
								items.push({
									type: 'action',
									label: 'Save As',
									callback: function() {
										that.saveAs()
									}
								});
								if (that.user === that.currentCase.case_owner) {
									items.push({
										type: 'action',
										label: 'Delete case',
										callback: function () {
											$('<div/>')
												.text('Are you sure you want to delete case: ' + that.currentCase.case_name + '?')
												.attr('title', 'Delete Case?')
												.css({
													position: 'relative',
													width: '100%'
												})
												.dialog({
													resizeable: false,
													width: '300px',
													modal: true,
													position: {
														my: 'center top',
														at: 'left top',
														of: $caseTitleContainer
													},
													buttons: {
														Cancel: function () {
															$(this).remove();
														},
														OK: function () {
															var $dialog = this;
															that.deleteCase(this);
															$(this).dialog('close');
															setTimeout(function () {
																$dialog.remove();
															}, 500);
														}
													},
													show: {
														effect: "fade",
														duration: 250
													},
													hide: {
														effect: "fade",
														duration: 250
													}
												});
										}
									});
									items.push({
										type: 'action',
										label: 'Close case',
										callback: function () {
											that.reset()
										}
									});
								}
							}
							menu.createContextMenu(event,items);
						} else {
							items.push({
								type: 'action',
								label: 'Cluster CSV',
								callback: function() {
									that.downloadCSV()
								}
							});
							items.push({
								type: 'action',
								label: 'Ads CSV',
								callback: function() {
									that.fetchCSVDetails()
								}
							});
							menu.createContextMenu(event,items);
						}
					};

				this.getUser(function(user){
					that.user = user;
				});

				/**
				 * add style and event to elements
				 */
				this.$fileButton.css({
						float: 'left',
						position: 'relative',
						width: BUTTON_WIDTH
					}).append('<button/>')
						.text('File')
						.button()
						.click(function(e) {
							createContextMenu(e, true);
						});
				this.$exportButton.css({
						float: 'left',
						position: 'relative',
						width: BUTTON_WIDTH
					}).append('<button/>')
						.text('Export')
						.button()
						.click(function(e) {
							createContextMenu(e);
					}).button('option', 'disabled', true);
				this.$publicButton.css({
					float: 'left',
					position: 'relative',
					width: BUTTON_WIDTH,
					'font-weight': 'bold',
					visibility: 'hidden'
				}).append('<button/>')
					.button()
					.click(function() {
						that.togglePublic();
					});
				this.$notifier.css({
					position: 'absolute',
					bottom: '0px',
					right: '0px',
					color: colors.CASE_NOTIFIER,
					'text-align': 'right'
				});
				this.$nodeTable.css({
					position:'relative',
					width: '100%',
					height: '250px',
					'overflow-x': 'hidden',
					'overflow-y': 'scroll',
					visibility: 'hidden',
					'border-bottom': '2px solid ' + colors.CASE_BORDER
				});
				this.setupNodeTable();
				container.append(this.$loadPopup);
				$(this.$loadPopup).dialog({
					autoOpen:false,
					resizeable: false,
					width: '300px',
					'max-height': '150px',
					modal: true,
					'overflow-y': 'hidden',
					position: {
						my: 'center top',
						at: 'left top',
						of: $caseTitleContainer
					},
					title: 'Load Case',
					buttons: {
						Cancel: function () {
							$(this).dialog('close');
						}
					},
					show: {
						effect: "fade",
						duration: 250
					},
					hide: {
						effect: "fade",
						duration: 250
					}
				});
				this.$loadPopup.append($('<div/>').css('clear','both')
					.append($('<div/>').css({
						position: 'relative',
						width: '75%',
						float: 'left',
						'font-weight': 'bold'
					}).text('Case'))
					.append($('<div/>').css({
						position: 'relative',
						float: 'left',
						left: '-13px',
						'font-weight': 'bold'
					}).text('Owner')));
				container.append(this.$getCaseNamePopup);
				$(this.$getCaseNamePopup)
					.append($('<div><form><label for="case_name">Case Name</label><br/><input type="text" maxlength="128" name="case_name"'
					+ 'id="newcase_name" value="myCase" class="text ui-widget-content ui-corner-all"></form>')
						.css({
							position: 'relative',
							width: '100%'
						})
					).dialog({
					autoOpen:false,
					resizeable: false,
					width: '300px',
					modal: true,
					position:{
						my: 'center top',
						at: 'left top',
						of: $caseTitleContainer
					},
					buttons: {
						Cancel: function () {
							$(this).dialog('close');
						},
						OK: function () {
							var $dialog = this;
							if(that.isNew) {
								that.setCase($('#newcase_name').val(), function () {
									$($dialog).dialog('close');
									that.currentCase.case_owner = that.user;
									that.addNode();
									that.setPublicButton(false, that.user);
								});
							} else {
								that.getCaseName($('#newcase_name').val(), function(newCase) {
								that.currentCase = {
									case_name: newCase.case_name,
									case_owner: that.user,
									case_id: newCase.case_id
								};
								$('#case-title-icon').removeClass('ui-icon-folder-collapsed').addClass('ui-icon ui-icon-folder-open');
								$('#case-title').text(that.currentCase.case_name);
								that.saveCase();
								that.setPublicButton(false, that.user);
								$($dialog).dialog('close');
								});
							}
						}
					},
					show: {
						effect: "fade",
						duration: 250
					},
					hide: {
						effect: "fade",
						duration: 250
					}
				}).keypress(function(e){
					if(e.keyCode == 13) {
						e.preventDefault();
						$(that.$getCaseNamePopup).dialog('option','buttons')['OK'].apply(that.$getCaseNamePopup);
					}
				});

				/**
				 * 	add all elements to the container
				 */
				$buttonContainer.append(this.$fileButton).append(this.$exportButton).append(this.$publicButton);

				$(container)
					.append($buttonContainer)
					.append($caseTitleContainer)
					.append(this.$nodeTable)
					.append(this.$notifier);
				this.$notifier.text('Case Builder ready.');
				$(container).droppable({
					drop: function(event, ui){
						$(this).css('cursor','default');
						var data = $(ui.draggable).data("data");
						if (data) {
							if(data.summary){
								that.fetchSummaryDetails(data.summary, function(data){
									that.newData = data;
									that.currentCase.case_name ? that.addNode() : that.newCase();
								});
							} else {
								that.newData = data;
								that.currentCase.case_name ? that.addNode() : that.newCase();
							}
						}
					},
					over: function () {
						$(this).css('cursor','progress');
					},
					out: function () {
						$(this).css('cursor','no-drop');
					}
				});
			},

			newCase: function(){
				$(this.$getCaseNamePopup).dialog('option', 'title', 'New Case');
				$('#newcase_name').val('myCase');
				this.isNew=true;
				this.$getCaseNamePopup.dialog('open');
			},

			getCaseName: function(case_name, callback) {
				var that=this;
				rest.post(baseUrl + "rest/casebuilder/createcase/",
					case_name,
					"Case builder create case",
					function(result){
						if(!result.Error && result.case_name) {
							callback(result);
						} else {
							that.$notifier.text(result.Error?result.Error:'error creating case');
						}
					},
					false,
					function() {
						that.$notifier.text('error creating case');
					});
			},

			setCase: function(case_name, callback) {
				var that=this;
					this.getCaseName(case_name, function(newCase) {
						that.reset();
						that.setupNodeTable();
						that.currentCase = {
							case_name: newCase.case_name,
							case_owner: that.user,
							case_id: newCase.case_id
						};
						that.$nodeTable.css('visibility', 'visible');
						$('#case-title-icon').removeClass('ui-icon-folder-collapsed').addClass('ui-icon-folder-open');
						$('#case-title').text(that.currentCase.case_name);
						callback();
					});
			},

			loadCase: function() {
				var that = this;
				this.getCases(function (cases) {
					that.cases = {};
					var $case_namesContainer,
						$case_name,
						$case_owner,
						$rowContainer,
						i=0;
					if(cases.length > 0) {
						$('#load-case-names').remove();
						$case_namesContainer = $('<div id="load-case-names"></div>').css({
							position: 'relative',
							'overflow-x': 'hidden',
							'overflow-y': 'scroll',
							height: '100%',
							'max-height': '150px',
							'padding-top': '4px',
							clear:'both'
						}).mouseover(function() {
							$(this).css({
								cursor: 'hand'
							});
						}).mouseout(function() {
							$(this).css({
								cursor: 'pointer'
							});
						});
						for(i; i<cases.length; i++) {
							that.cases[cases[i].case] = cases[i].id;
							$case_name = $('<div>' + cases[i].case + '</div>')
								.css({
									position: 'relative',
									width: '75%',
									float: 'left'
								});
							$case_owner = $('<div>' + cases[i].owner + '</div>')
								.css({
									position: 'relative',
									float: 'left'
								});
							$rowContainer = $('<div/>').css({
								position: 'relative',
								width:'100%',
								height: '16px',
								clear: 'both',
								cursor: 'hand'
							});
							$rowContainer.append($case_name).append($case_owner);
							$rowContainer.case_id = cases[i].id;
							$($rowContainer)
								.mouseover(function() {
									$(this).css('background-color', colors.CASE_HOVER);
								})
								.mouseout(function() {
									$(this).css('background-color', '');
								}).click(function () {
									that.$loadPopup.dialog('close');
									that.currentCase = {
										'case_name':	this.childNodes[0].textContent,
										'case_owner': this.childNodes[1].textContent,
										'case_id': that.cases[this.childNodes[0].textContent]
									};
									that.loadCaseContents();
								});
							$case_namesContainer.append($rowContainer);
						}
						that.$loadPopup.append($case_namesContainer);
						that.$loadPopup.dialog('open');
					} else {
						that.$notifier.text('No cases on file');
					}
				});
			},

			togglePublic: function() {
				var that = this,
					buttonLabel = this.$publicButton.checked?'PRIVATE':'PUBLIC';
				this.$notifier.text('...toggling case to ' + buttonLabel);
				rest.post(baseUrl + "rest/casebuilder/togglepublic/",
					that.currentCase.case_id+'',
					"Case builder toggle public",
					function(result){
						if(result.Success) {
							that.$notifier.text('case set to ' + buttonLabel);
							that.$publicButton.checked = !that.$publicButton.checked;
							that.$publicButton.attr('title', that.$publicButton.checked?'click to make case private':'click to make case public');
							that.$publicButton.button('option', 'label', buttonLabel);
							that.$publicButton.css('background',that.$publicButton.checked?colors.CASE_HIGHLIGHT:colors.CASE_PRIVATE);
						} else {
							that.$notifier.text('error toggling case to ' + buttonLabel);
						}
					},
					false,
					function() {
						that.$notifier.text('error toggling case to ' + buttonLabel);
					});
			},

			setPublicButton: function(publicFlag, case_owner) {
				this.$publicButton.checked = publicFlag;
				this.$publicButton.attr('title', publicFlag?'click to make case private':'click to make case public');
				this.$publicButton.button('option', 'label', publicFlag?'PUBLIC':'PRIVATE');
				this.$publicButton.css({
					visibility: 'visible',
					background: publicFlag?colors.CASE_HIGHLIGHT:colors.CASE_PRIVATE
				});
				this.$publicButton.button('option', 'disabled', this.user!==case_owner);
			},

			loadCaseContentsURL: function(id) {
				if(!(Math.floor(id) == id && $.isNumeric(id))) {
					return;
				}
				var that = this;
				this.$notifier.text('...loading case id: ' + id);
				rest.post(baseUrl + "rest/casebuilder/getcasedetails/",
					id+'',
					"Case builder get case details",
					function (result) {
						if(result.case_name) {
							that.currentCase.case_name = result.case_name;
							that.currentCase.case_owner = result.user_name;
							that.currentCase.case_id = id;
							that.loadCaseContents();
						} else {
							that.$notifier.text(result.Error?result.Error:'error loading case details');
						}
					},
					false,
					function () {
						that.$notifier.text('error loading case details');
					}
				);
			},

			loadCaseContents: function() {
				var that = this,
					c;
				this.$notifier.text('...loading case ' + this.currentCase.case_name);
				c = {'case_name': this.currentCase.case_name, 'case_owner': this.currentCase.case_owner, 'case_id': this.currentCase.case_id};
				rest.post(baseUrl + "rest/casebuilder/getcase/",
					c,
					"Case builder loadCaseContents",
					function (result) {
						if (result[that.currentCase.case_name]) {
							$('#case-title-icon').removeClass('ui-icon-folder-collapsed').addClass('ui-icon-folder-open');
							$('#case-title').text(that.currentCase.case_name);
							that.nodeIds = {true: {}, false: {}};
							that.$notifier.text(that.currentCase.case_name + ' successfully loaded');
							that.buildNodeTable(result[that.currentCase.case_name]);
							that.setPublicButton(result.public, that.currentCase.case_owner);
						} else {
							that.$notifier.text('error loading case: ' + result.Success);
						}
					},
					false,
					function () {
						that.$notifier.text('error loading case');
					}
				);
			},

			buildNodeTable: function(data) {
				var datum,
					nodeId,
					i = 0;
				this.setupNodeTable();
				this.nodeCount=0;
				for(i; i<data.length; i++) {
					datum = data[i];
					nodeId = datum.id;
					this.nodeIds[datum.ATTRIBUTE_MODE][nodeId] = datum;
					this.$nodeTable.append(this.addNodeTableRow(datum, nodeId));
				}
				if(this.nodeCount>0) {
					this.$exportButton.button('option', 'disabled', false);
				} else {
					this.$exportButton.button('option', 'disabled', true);
				}
				this.$nodeTable.css('visibility', 'visible');
				$('#newcase_name').val('myCase');
			},

			saveCase: function() {
				var that = this,
					caseContents = {true:'',false:''},
					ids;

				for(var ATTRIBUTE_MODE in this.nodeIds) {
					ids = '';
					for(var node in this.nodeIds[ATTRIBUTE_MODE]) {
						ids+= node + ',';
					}
					if(ids.length > 0) {
						ids = ids.substring(0,ids.length-1);
					}
					caseContents[ATTRIBUTE_MODE]=ids;
				}
				caseContents.caseDetailsString = this.currentCase;
				this.$notifier.text('...saving');
				rest.post(baseUrl + "rest/casebuilder/savecase/",
					caseContents,
					"Case builder saveCase",
					function (result) {
						result.Success === 'true' ?
							that.$notifier.text('saved') : that.$notifier.text('error saving case: ' + result.Success);
						if(that.nodeCount!=result.nodeCount) {
							that.loadCaseContents();
						}
					},
					false,
					function () {
						that.$notifier.text('error saving case');
					});
			},

			saveAs: function() {
				this.isNew=false;
				$(this.$getCaseNamePopup).dialog('option', 'title', 'Save As');
				$('#newcase_name').val(this.currentCase.case_name+'_copy');
				this.$getCaseNamePopup.dialog('open');
			},

			getCases: function(callback) {
				rest.get(baseUrl + "rest/casebuilder/getcases/","Get Cases",function(result) {
					callback(result.cases);
				});
			},

			getUser: function(callback) {
				rest.get(baseUrl + "rest/casebuilder/getuser/","Get user",function(result) {
					callback(result.user);
				});
			},

			addNodeTableRow:function(data, nodeId) {
				var buttonDim = 14,
					cluster = data.label,
					size = data['Cluster Size'],
					latest = data.latestad?data.latestad:'',
					that=this,
					$delete =$('<button/>').text('Delete ' + cluster + ' cluster').button({
							disabled: true,
							text:false,
							icons:{
								primary:'ui-icon-trash'
							}
						}).css({
						position:'absolute',
						left:'-4px',
						'margin-top':'1px',
						width:buttonDim+'px',
						height:buttonDim+'px'
					}),
					$cluster = $('<div/>').css({
						position:'absolute',
						left:'17px',
						width: 'calc(100% - ' + (buttonDim + 5 + 150) + 'px)',
						height:buttonDim+'px',
						'overflow-x':'hidden',
						'overflow-y':'hidden'
					}).html(cluster),
					$number = $('<div/>').css({
						position:'relative',
						float:'right',
						width:'75px',
						height:buttonDim+2+'px',
						'text-align':'center',
						'border-left': BORDER_STYLE
					}).html(size),
					$latest = $('<div/>').css({
						position:'relative',
						float:'right',
						width:'75px',
						height:buttonDim+2+'px',
						'overflow': 'hidden',
						'text-align':'center',
						'border-left': BORDER_STYLE
					}).html(latest).attr('title',latest),
					$row = $('<div/>').attr('selected',false).css({
						width:'100%',
						height:buttonDim+2+'px',
						'border-bottom': BORDER_STYLE,
						clear:'both'
					}).mouseenter(function() {
						$(this).css({'background-color':this.selected==true?colors.CASE_SELECTED_HOVER:colors.CASE_HOVER});
					}).mouseleave(function() {
						$(this).css({'background-color':this.selected==true?colors.CASE_HIGHLIGHT:''});
					});

				//add tooltip
				$row.attr('title', (data.ATTRIBUTE_MODE===true || data.ATTRIBUTE_MODE ==='true'?'Attribute':'Org') + ' Cluster');

				//Highlight and enable deletion.
				$($row).on('click', function() {
					if(that.currentCase.case_owner===that.user) {
						$row[0].selected = !$row[0].selected;
						if($row[0].selected) {
							$(this).css({'background-color': colors.CASE_HIGHLIGHT});
							$($delete).button('option', 'disabled', false);
						} else {
							$(this).css({'background-color': colors.CASE_HOVER});
							$($delete).button('option', 'disabled', true);
						}
						$row.mouseenter();
					} else {
						that.$notifier.text(that.currentCase.case_name + ' can only be modified by user: ' + that.currentCase.case_owner +
							'. Save a copy to make changes.');
					}
				});

				//Centre graph on the row selected.
				$([$cluster, $number, $latest]).each(function() {
					this.on('dblclick', function() {
						window.open(baseUrl + 'graph.html?' + ((data.ATTRIBUTE_MODE===true || data.ATTRIBUTE_MODE ==='true')?'attributeid=':'clusterid=') + data.id + '&case_id=' + encodeURIComponent(that.currentCase.case_id) + '&explorer='+explorer, "_self");
					})
				});

				$($row)
					.mouseover(function() {
					$(this).css({
						cursor: 'hand'
					});
				}).mouseout(function() {
					$(this).css({
						cursor: 'pointer'
					});
				});

				$($delete).on('click', function(e){
					e.preventDefault();
					that.deleteNode(data, function(count) {
						$row.remove();
						delete that.nodeIds[data.ATTRIBUTE_MODE][nodeId];
						if(count!=that.nodeCount) {
							that.loadCaseContents();
						}
					});
				});
				this.nodeCount++;
				return $($row).append($delete).append($cluster).append($latest).append($number)
			},

			reset: function(){
				this.nodeIds = {true:{},false:{}};
				this.nodeCount = 0;
				this.setupNodeTable();
				this.$exportButton.button('option', 'disabled', true);
				this.currentCase = {};
				$('#case-title-icon').removeClass('ui-icon-folder-open').addClass('ui-icon-folder-collapsed');
				$('#case-title').text('');
				this.$notifier.text('');
				this.$publicButton.css('visibility','hidden');
			},

			deleteNode: function(data, callback) {
				var that = this,
					st = {
						'cluster_id': data.id,
						'is_attribute': data.ATTRIBUTE_MODE,
						'case_name': this.currentCase.case_name,
						'case_id': this.currentCase.case_id
					};
				this.$notifier.text('...deleting node ' + data.label);
				rest.post(baseUrl + "rest/casebuilder/deletenode/",
					st,
					"Case builder deleteNode",
					function (result) {
						result.Success === 'true' ?
							that.$notifier.text('node ' + data.label + ' deleted') : that.$notifier.text('error deleting node ' + result.Success);
						that.nodeCount--;
						callback(result.Count);
					},
					false,
					function () {
						that.$notifier.text('error deleting node ' + data.label);
					});
			},

			deleteCase: function() {
				var that = this;
				this.$notifier.text('...deleting case ' + this.currentCase.case_name);
				rest.post(baseUrl + "rest/casebuilder/deletecase/",
					this.currentCase,
					"Case builder deleteCase",
					function (result) {
						if(result.Success === 'true') {
							var message = that.currentCase.case_name + ' case deleted';
							that.reset();
							that.$notifier.text(message);
						} else {
							that.$notifier.text('error deleting case ' + that.currentCase.case_name);
						}
					},
					false,
					function () {
						that.$notifier.text('error deleting case ' + that.currentCase.case_name);
					});
			},

			addNode: function(){
				if(this.user === this.currentCase.case_owner) {
					if (this.newData) {
						var data = this.newData,
							nodeId = ui_util.trunc(data.id.trim());
						this.newData = null;
						if (!this.nodeIds[data.ATTRIBUTE_MODE][nodeId]) {
							this.nodeIds[data.ATTRIBUTE_MODE][nodeId] = data;
							this.$nodeTable.append(this.addNodeTableRow(data, nodeId));
							this.saveCase();
						} else {
							this.$notifier.text(data.label + ' cluster already in case: ' + this.currentCase.case_name);
						}
						if (this.nodeCount > 0) {
							this.$exportButton.button('option', 'disabled', false);
						}
					}
				} else {
					this.$notifier.text(this.currentCase.case_name + ' can only be modified by user: ' + this.currentCase.case_owner +
						'. Save a copy to make changes.');
				}
			},

			fetchSummaryDetails: function(av, callback) {
				var that=this,
					name = ui_util.trunc(av.value,25);
				this.$notifier.text('...fetching ' + name + ' cluster details');
				if(av.contents) {
					callback(av.contents);
				} else {
					rest.post(baseUrl + "rest/casebuilder/getsummarydetails/",
						av,
						"Case builder fetchSummaryDetails",
						function(result){
							if(result.details) {
								callback(result.details);
							} else
								that.$notifier.text(result.Error);
						},
						false,
						function() {
							that.$notifier.text('error fetching cluster ' + name);
						});
				}
			},

			//TODO add the node tooltip to each row
			/*addToolTip: function($cluster, data){
				var nodeId = ui_util.trunc(data.id.trim()),
					html = '<B>ID: </B>' + nodeId + '<BR/>' +
					'<B>Name: </B>' + ui_util.trunc(data.name.trim()) + '<BR/>' +
					'<B>Label: </B>' + ui_util.trunc(data.label.trim());
				if (data['Cluster Size']) {
					html += '<BR/><B>Cluster Size: </B>' + data['Cluster Size'] + '<BR/>';
				}
				if (data.attributes) {
					//we want the attributes to appear in this order
					var attributeNames = [ 'Email Addresses', 'Phone Numbers', 'Websites', 'Link Reasons', 'Common Ads'];
					for (var j = 0; j < attributeNames.length; j++) {
						var attributeName = attributeNames[j];
						if (data.attributes[attributeName]) {
							var attribute = attributeName,
								val = data.attributes[attribute],
								vals = val.split('\n');
							if (vals.length > 0) {
								html += '<B>' + attribute.trim() + ':</B>';
								for (var i = 0; i < vals.length && i < 5; i++) {
									var strs = ui_util.trunc(vals[i]).split('\t');
									if (strs.length === 2) {
										html += '<div style="overflow:hidden;position:relative;width:100%;height:15px;">' +
											'<div style="text-align: right;float:left;padding-right:3px;width:25px;">' +
											((strs[0] === "") ? ' </div>' : (strs[0] + ':</div>')) +
											'<div style="text-align: left; width:calc(100% - 35px);float:left;">' +
											strs[1] + '</div></div>';
									}
								}
							}
						}
					}
				}
			},*/

			downloadCSV: function() {
				var eol = '\r\n',
					result =  '"Ad ID","Ad Group Name",Type,"# of ads"'+eol,
					node,
					fileName = this.currentCase.case_name + '.csv';

				//build the csv string
				for(node in this.nodeIds.false) {
					result += 	this.nodeIds.false[node].id + ',"' +
						this.nodeIds.false[node].label + '",' +
						'cluster,' +
						this.nodeIds.false[node]['Cluster Size'] +
						eol;
				}
				for(node in this.nodeIds.true) {
					result += 	this.nodeIds.true[node].id + ',"' +
						this.nodeIds.true[node].label + '",' +
						'attribute,' +
						this.nodeIds.true[node]['Cluster Size'] +
						eol;
				}

				this.triggerCSV(result, fileName);
			},

			downloadCSVDetails: function(data) {
				var eol = '\r\n',
					entityDetails,
					isAttribute,
					delim = ',',
					fileName = this.currentCase.case_name + '_details.csv',
					i = 0,
					j,
					val,
					result = '"Ad Group Name"' + delim +
						'"Cluster ID"' + delim +
						'"Cluster Type"' + delim +
						'"Post Time"' + delim +
						'Source' + delim +
						'Location' + delim +
						'Phone' + delim +
						'"Main Phone"' + delim +
						'Title' + delim +
						'"External Websites"' + delim +
						'Tags' + delim +
						'Email' + delim +
						'Name' + delim +
						'Ethnicity' + delim +
						'age' + delim +
						'height' + delim +
						'weight' + delim +
						'"Full Text"' + delim +
						'"First ID"' + delim +
						'ID' + delim +
						'Website' + delim +
						'URL' + delim +
						'"User Location"' + delim +
						'latitude' + delim +
						'longitude' + delim +
						'rate30' + delim +
						'rate60'+eol,
					attributeList=[
						'posttime',
						'source',
						'location',
						'phone',
						'mainphone',
						'title',
						'otherads',
						'tags',
						'email',
						'name',
						'ethnicity',
						'age',
						'height',
						'weight',
						'text',
						'first_id',
						'id',
						'website',
						'url',
						'userlocation',
						'latitude',
						'longitude',
						'rate30',
						'rate60'
					];

				for (i; i < data.length; i++) {
					entityDetails = {};
					for (j = 0; j < data[i].map.entry.length; j++) {
						entityDetails[data[i].map.entry[j].key] = data[i].map.entry[j].value;
					}
					isAttribute = entityDetails.isAttribute==='true'?'Attribute':'Cluster';
					//convert posttime from unix time to human readable date
					if (entityDetails.posttime) {
						entityDetails.posttime = (new Date(parseInt(entityDetails.posttime))).toGMTString();
					}
					result += this.nodeIds[entityDetails.isAttribute][entityDetails.clusterId].label +
						delim + entityDetails.clusterId + delim + isAttribute +  delim +'"';
					for(j = 0; j<attributeList.length; j++) {
						val = entityDetails[attributeList[j]];
						if (val) {
							val = val.replace(/\"/g, '');
							val = val.replace(/\n/g, ',');
							result += val;
						}
						result += '"' + delim + '"';
					}
					result = result.substring(0,result.length-5)+eol;
				}
				this.$notifier.text('finished CSV Ads');
				this.triggerCSV(result,fileName);
			},

			/**
			 * @param result csv formatted string
			 * @param fileName
			 */
			triggerCSV: function (result, fileName) {
				var blob = new Blob([result], {type:'text/csv'}),
					wUrl = window.URL || window.webkitURL,
					a;
				//Internet Explorer
				if(window.navigator.msSaveBlob) {
					window.navigator.msSaveBlob(blob, fileName);
				} else { //other browsers
					a = document.createElement('a');
					a.href = wUrl.createObjectURL(blob);
					a.download = fileName;
					$(document.body).append(a);
					setTimeout(function () {
						a.click();
						$(a).remove();
					}, 250);
				}
			},

			fetchCSVDetails: function() {
				var that=this;
				this.$notifier.text('...fetching CSV Ads');
				rest.post(baseUrl + "rest/casebuilder/csv/",
					this.currentCase,
					"Case builder fetchCSVDetails",
					function(result){
						if(result.memberDetails) {
							that.downloadCSVDetails(result.memberDetails);
						}
					},
					false,
					function() {
						that.$notifier.text('error downloading CSV Ads');
					});
			},

			resize: function(width, height) {
				this.width = width;
				this.height = height;
			},

			setupNodeTable: function() {
				this.$nodeTable.empty();
				var buttonDim = 14,
					$clusterHeader = $('<div/>').css({
						position:'relative',
						float:'left',
						width:'calc(99% - 151px)',
						'font-weight':'bold',
						'border-top': BORDER_STYLE
					}).text(' Ad group name'),
					$numberHeader = $('<div/>').css({
						position:'relative',
						float:'right',
						width:'75px',
						'font-weight':'bold',
						'border-left': BORDER_STYLE,
						'border-top': BORDER_STYLE
					}).text(' # of ads'),
					$latestAdHeader = $('<div/>').css({
						position:'relative',
						float:'right',
						width:'75px',
						'font-weight':'bold',
						'border-left': BORDER_STYLE,
						'border-top': BORDER_STYLE
					}).text('Latest Ad');
				this.$nodeTable.append($('<div/>').css({width:'100%', height:buttonDim+2+'px', 'border-bottom':BORDER_STYLE})
					.append($clusterHeader)
					.append($latestAdHeader)
					.append($numberHeader));
				this.$nodeTable.css('visibility', 'hidden');
			}
		};
		widgetObj.init();
		return widgetObj;
	};

	return {
		createWidget:createWidget
	}
});