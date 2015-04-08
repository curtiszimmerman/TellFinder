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
define([ '../util/ui_util', '../util/menu', '../util/colors'], function( ui_util, menu, colors) {
	var MAX_ROWS = 100,
		SCROLL_BAR_WIDTH = 15,
		OPEN_BUTTON_WIDTH = 21,
		WIDGET_TITLE_HEIGHT = 20,
		BORDER_STYLE = '1px solid ' + colors.CLUSTER_BORDER,
		ROW_SELECTED_STYLE = {border:'1px inset ' + colors.CLUSTER_BORDER,background:colors.CLUSTER_HIGHLIGHT},
		ROW_DESELECTED_STYLE = {border:'','border-bottom':'1px solid ' + colors.CLUSTER_BORDER,background:''},
		fullUrl = document.location.href,
		GEPHI_URL = fullUrl.indexOf('localhost')<0?'http://memexdemo.istresearch.com:7080/gqt-alpha/':'http://localhost:8081/gqt/',

		getRowWidth = function(columns) {
			var result = OPEN_BUTTON_WIDTH+1;
			for (var i=0; i<columns.length; i++) {
				var column = columns[i];
				if (column.visible) result += column.width+1;
			}
			return result;
		},

		launchClusterInGephi = function(adids) {
			var f = $('<form>').attr('action',GEPHI_URL).attr('target','_blank');
			$('<input>').attr('name', 'adids').attr('value', adids).appendTo(f);
			f.submit();
		},

		launchPhoneInGephi = function(details) {
			var phones = [];
			for (var value in details['phonelist']) {
				if (details['phonelist'].hasOwnProperty(value)) {
					phones.push({phone:value,count:details['phonelist'][value]});
				}
			}
			phones.sort(function(a,b) { return b.count-a.count;});

			window.open(GEPHI_URL+'?query=phone:'+phones[0].phone, '_blank');
		},

		createContextMenu = function(widget, details, event) {

			var showDistributionText = function(title, accessor) {
					var result = '<B>' + title + ': </B><UL style="margin:2px">';
					for (var value in details[accessor]) {
						if (details[accessor].hasOwnProperty(value)) {
							result += '<LI>' + value + '</LI>'; // ': ' + details[accessor][value] + '</LI>';
						}
					}
					result += '</UL>';
					return result;
				},
				items = [
					{
						type: 'action',
						label: 'Entity Graph',
						callback: function() {
							if(widget.clickFn) {
								widget.clickFn(details.id, false);
							}
						}
					},
					{
						type: 'action',
						label: 'Entity Explorer',
						callback: function() {
							if(widget.clickFn) {
								widget.clickFn(details.id, true);
							}
						}
					},
//					{
//						type: 'action',
//						label: 'Attribute Graph for Ads',
//						callback: function() {
//							if (details.adidlist) {
//								launchClusterInGephi(details.adidlist);
//							} else if (widget.fetchIdFn) {
//								widget.fetchIdFn(details.id, function(response) {
//									launchClusterInGephi(response);
//								});
//							}
//						}
//					},
//					{
//						type: 'action',
//						label: 'Attribute Graph for Main Phone',
//						callback: function() {
//							launchPhoneInGephi(details);
//						}
//					},
					{
						type: 'action',
						label: 'Group Summary Report',
						callback: function() {
							var text = '<B>Cluster ID: </B>' + details.id;
							text += '<BR/><B>Total Ads: </B>' + details.ads + '<BR/>';
							text += showDistributionText('Phone numbers', 'phonelist');
							text += showDistributionText('Emails', 'emaillist');
							text += showDistributionText('Websites', 'weblist');
							text += showDistributionText('Names', 'namelist');
							text += showDistributionText('Ethnicities', 'ethnicitylist');
							text += showDistributionText('Locations', 'locationlist');
							text += showDistributionText('Sources', 'sourcelist');
							text += showDistributionText('Keywords', 'keywordlist');
							var dialogDiv = $('<div/>');
							dialogDiv.html(text);
							dialogDiv.css({overflow:'auto', 'white-space':'nowrap'});
							$(document.body).append(dialogDiv);

							dialogDiv.dialog({width:400, height:400,
								close: function(event,ui) {$(this).dialog('destroy').remove()}});
						}
					}
				];

			menu.createContextMenu(event, items);
		},

		setBarWidths = function(bars, column, total) {
			if (bars.length==0) return;
			var usedWidth = 0;
			for (var i=0; i<bars.length; i++) {
				var bar = bars[i];
				bar.width = Math.floor(column.width*bars[i].value/total);
				usedWidth += bar.width;
			}
			if (usedWidth<column.width) {
				var remainder = column.width-usedWidth;
				var addon = Math.ceil(remainder/bars.length);
				var curBar = 0;
				while (remainder>0) {
					bars[curBar].width += Math.min(remainder,addon);
					remainder -= addon;
					curBar++;
				}
			}
		},

		updateDistributionBar = function(details, column, cellDiv) {
			cellDiv.css({width: column.width+'px', display:column.visible?'block':'none'});
			var accessor = column.accessor;
			if (column.subaccessor) accessor = column.subaccessor;

			var bars = details[accessor+'bars'];
			var total = details[accessor+'total'];
			setBarWidths(bars, column, total);

			var tooltipText = '<B>' + column.label + ' distribution</B><BR/>';
			for (var i=0; i<bars.length; i++) {
				var bar = bars[i];
				tooltipText += bars[i].key + ':' + bars[i].value + '<BR/>';
				var barDiv = $('<div/>');
				var color = colors.CLUSTER_ARRAY[i%colors.CLUSTER_ARRAY.length];
				if (bars[i].key=='none') color = colors.CLUSTER_ARRAY_NONE;
				barDiv.css({width:bars[i].width+'px', height: WIDGET_TITLE_HEIGHT+'px', overflow:'hidden', float:'left', background:color});
				cellDiv.append(barDiv);
			}
			if (bars.length==0) tooltipText += 'No data';
			details[accessor+'tooltip'] = tooltipText;

			cellDiv.mouseover(function(event) {
				aperture.tooltip.showTooltip({event:{source:event}, html:tooltipText});
			});
			cellDiv.mouseout(function(event) {
				aperture.tooltip.hideTooltip();
			});
		},

		createDistributionBar = function(details, column) {
			var cellDiv = $('<div/>');
			cellDiv.css({'border-right': BORDER_STYLE, height: WIDGET_TITLE_HEIGHT+'px', float:'left', overflow:'hidden'});
			updateDistributionBar(details, column, cellDiv);
			return cellDiv;
		},

		processDistribution = function(details, column, totals, matchValue) {
			var accessor = column.accessor;
			var distObject = details[column.accessor];
			if (column.subaccessor) {
				distObject = distObject[column.subaccessor];
				accessor = column.subaccessor;
			}
			var bars = [];
			var total = 0;
			var noneSize = 0;
			var max = 0;
			for (var prop in distObject) {
				if (distObject.hasOwnProperty(prop)) {
					var count = Number(distObject[prop]);
					total += count;
					if (prop=='none') {
						noneSize = count;
					} else {
						bars.push({key:prop,value:count});
						if (count>max) max = count;
					}
					var lcProp = prop.toLowerCase();
					if (totals) {
						if (column.subaccessor) {
							if (totals.dist[column.subaccessor][lcProp]) totals.dist[column.subaccessor][lcProp] += 1;
							else totals.dist[column.subaccessor][lcProp] = 1;
						} else {
							if (totals[lcProp]) totals[lcProp] += 1;
							else totals[lcProp] = 1;
						}
					}
					if (matchValue&&(lcProp==matchValue)) details.matches = count;
				}
			}
			if (matchValue&&(!details.matches)) details.matches = 0;
			details[accessor+'bars'] = bars;
			details[accessor+'total'] = total;
			details[accessor+'none'] = noneSize;
			details[accessor+'max'] = max;

			if (bars.length==0) return;

			bars.sort(function(a,b) { return b.value-a.value;});

			if (noneSize>0) {
				bars.push({key:'none',value:noneSize});
			}
		},

		createTableRow = function(widget, details, columns, location, summary) {
			for (var i=0; i<columns.length; i++) {
				var column = columns[i];
				if (column.isDistribution) {
					if (column.accessor=='locationlist') {
						processDistribution(details, column, summary[column.summaryaccessor], (details.matches!=undefined)?null:location);
					} else if (column.summaryaccessor) {
						processDistribution(details, column, summary[column.summaryaccessor]);
					} else {
						processDistribution(details, column);
					}
				}
			}

			return {
				rowDiv:null,
				details:details
			}
		},

		fixTooltip = function(cellDiv, tooltipText) {
			cellDiv.mouseover(function(event) {
				aperture.tooltip.showTooltip({event:{source:event}, html:tooltipText});
			});
			cellDiv.mouseout(function(event) {
				aperture.tooltip.hideTooltip();
			});
		},

		addMouseEvents = function(row) {
			row.rowDiv.mouseenter(function() {
				$(this).css('background-color',row.selected?colors.CLUSTER_SELECTED_HOVER:colors.CLUSTER_HOVER);
			}).mouseleave(function() {
				$(this).css('background-color',row.selected?colors.CLUSTER_HIGHLIGHT:'');
			});
		},

		createTableRowDiv = function(widget, row, columns, rowWidth) {
			var i, column, accessor;
			if (row.rowDiv!=null) {
				// Oddly, jquery buttons and tooltips get confused when removed and readded to the DOM
				row.rowDiv.openButton.button({
					text:false,
					icons:{
						primary:'ui-icon-search'
					}
				}).click(function(e) {
					createContextMenu(widget, row.details, e);
				});
				for (i = 0; i<columns.length; i++) {
					column = columns[i];
					accessor = column.accessor;
					if (column.subaccessor) accessor = column.subaccessor;
					if (column.isDistribution) fixTooltip(row.cells[accessor], row.details[accessor+'tooltip']);
				}
				return;
			}
			var rowDiv = $('<div/>');
			rowDiv.get(0).clusterid = row.details.id;
			rowDiv.css({'border-bottom': BORDER_STYLE, height:'20px',overflow:'hidden', width:rowWidth+'px', cursor:'default'});

			rowDiv.openButton = $('<button/>').text('Open').button({
				text:false,
				icons:{
					primary:'ui-icon-search'
				}
			}).css({
				float:'left',
				width:'18px',
				height:'18px',
				margin:'1px 2px 0px 2px'
			}).click(function(e) {
				createContextMenu(widget, row.details, e);
			});
			rowDiv.append(rowDiv.openButton);

			row.cells = {};
			for (i=0; i<columns.length; i++) {
				column = columns[i];
				accessor = column.accessor;
				if (column.subaccessor) accessor = column.subaccessor;
				if (column.isDistribution) row.cells[accessor] = createDistributionBar(row.details, column);
			}

			for (i=0; i<columns.length; i++) {
				column = columns[i];
				accessor = column.accessor;
				if (column.subaccessor) accessor = column.subaccessor;
				if (column.isDistribution) {
					rowDiv.append(row.cells[accessor]);
				} else {
					var cellDiv = $('<div/>');
					cellDiv.css({'border-right': BORDER_STYLE, width: column.width+'px', height: '20px', overflow:'hidden', float:'left',display:column.visible?'block':'none'});
					cellDiv.text(row.details[accessor]);
					rowDiv.append(cellDiv);
					row.cells[accessor] = cellDiv;
				}
			}

			row.rowDiv = rowDiv;
			addMouseEvents(row);
			if (row.selected) {
				row.rowDiv.css(ROW_SELECTED_STYLE);
			} else {
				row.rowDiv.css(ROW_DESELECTED_STYLE);
			}
		},

		createHeaderCell = function(rowDiv, column, index, sortFn) {
			var cellDiv = $('<div/>');
			cellDiv.css({'border-right': BORDER_STYLE, width: (column.width-1)+'px', height: '20px', overflow:'hidden', float:'left',padding:'1px 0px 0px 1px', cursor:'pointer', display:column.visible?'block':'none'});
			if (column.tooltip) cellDiv.attr('title',column.tooltip);
			var labelDiv = $('<div/>');
			labelDiv.text(column.label);
			labelDiv.css({position:'relative',width:(column.width-1)+'px',height:'20px'});
			cellDiv.append(labelDiv);
			cellDiv.click(function() {
				sortFn(index, labelDiv);
			});
			rowDiv.append(cellDiv);
			var accessor = column.accessor;
			if (column.subaccessor) accessor = column.subaccessor;
			rowDiv.cells[accessor] = cellDiv;
			rowDiv.labels[accessor] = labelDiv;
		},

		createHeaderRow = function(columns, sortFn) {
			var rowDiv = $('<div/>');
			var rowWidth = getRowWidth(columns);
			rowDiv.css({'border-bottom': BORDER_STYLE, height:'20px', width:rowWidth+'px', overflow:'hidden', 'text-align':'left',top:'0px',left:'0px',position:'absolute'});

			var cellDiv = $('<div/>');
			cellDiv.css({'border-right': BORDER_STYLE, width: OPEN_BUTTON_WIDTH+'px', height: '20px', overflow:'hidden', float:'left'});
			rowDiv.append(cellDiv);
			rowDiv.cells = {};
			rowDiv.labels = {};
			for (var i=0; i<columns.length; i++) {
				createHeaderCell(rowDiv, columns[i], i, sortFn)
			}

			return {
				rowDiv:rowDiv
			}
		},

		getSummaryDiv = function(summaryData, clickFn, useSubaccessor) {
			var outarray = [];
			if (summaryData.useSubaccessor) {
				for (var subaccessor in summaryData.dist) {
					if (summaryData.dist.hasOwnProperty(subaccessor)) {
						for (var subdatum in summaryData.dist[subaccessor]) {
							if (summaryData.dist[subaccessor].hasOwnProperty(subdatum)) {
								outarray.push({label:subdatum,count:summaryData.dist[subaccessor][subdatum],subaccessor:subaccessor});
							}
						}
					}
				}
			} else {
				for (var summaryDatum in summaryData) {
					if (summaryData.hasOwnProperty(summaryDatum)) {
						outarray.push({label:summaryDatum,count:summaryData[summaryDatum]});
					}
				}
			}
			outarray.sort(function(a,b) {return b.count-a.count;});
			var resultDiv = $('<div/>'),
				outelem,
				outrow,
				labelDiv,
				countDiv,
				i = 0;
			for (i; i<outarray.length; i++) {
				outelem = outarray[i];
				outrow = $('<div/>').attr('selected',false)
					.mouseenter(function() {
						$(this).css({'background-color':this.selected==true?colors.CLUSTER_SELECTED_HOVER:colors.CLUSTER_HOVER});
					}).mouseleave(function() {
						$(this).css({'background-color':this.selected==true?colors.CLUSTER_HIGHLIGHT:'', border:''});
					})
					.css({height:'20px',overflow:'hidden',position:'relative',cursor: 'pointer'});
				(function(specificRow, specificValue, subaccessor) {
					specificRow.click(function(event) {
						clickFn(specificRow, specificValue, subaccessor);
					});
				})(outrow, outelem.label, outelem.subaccessor);
				labelDiv = $('<div/>')
					.html(outelem.label)
					.css({
						position:'relative',
						float:'left',
						clear:'left',
						width:'calc(100% - 44px)',
						'overflow':'hidden',
						'margin-left':'2px',
						'white-space': 'nowrap'
					});
				countDiv = $('<div/>')
					.html(outelem.count)
					.css({
						position:'relative',
						float:'right',
						clear:'right',
						'margin-right':'2px',
						'text-align':'right',
						width:'40px'
					});
				resultDiv.append(outrow.append(labelDiv).append(countDiv));
			}
			return resultDiv;
		},

		createWidget = function(container, data, location) {
			var widgetObj = {
				columns: null,
				width: null,
				height: null,
				mainDiv: null,
				sortIndicator: null,
				rows: [],
				clickFn: null,
				page: 0,
				sortColumn: 3,
				reverseSort: false,
				sidebarWidth: null,
				showAllColumns: null,
				locationSummary:null,
				ethnicitySummary:null,
				sourceSummary:null,
				keywordSummary:null,
				summaryPanels:null,

				amplifyInit: function () {
					this.sidebarWidth = amplify.store('clusterTableSidebarWidth');
					if(this.sidebarWidth === undefined) this.sidebarWidth = 200;
					this.showAllColumns = amplify.store('showAllColumns');
					if(this.showAllColumns === undefined) this.showAllColumns = false;
					this.columns = amplify.store('clusterTableColumns');
					if(this.columns === undefined) {
						var v = this.showAllColumns;
						this.columns = [
							{label:'ID', accessor:'id', tooltip:'Group Identifier (click to sort)', width:60, minWidth:60, visible:false, isDistribution:false},
							{label:'Group Name', accessor:'clustername', tooltip:'Group Name (click to sort)', width:80, minWidth:80, visible:true, isDistribution:false},
							{label:'Total Ads', accessor:'ads', tooltip:'Total Ads in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:false},
							{label:'Matching', accessor:'matches', tooltip:'Total Matching Ads in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:false},
							{label:'Latest Ad', accessor:'latestad', tooltip:'Latest Ad added to Group (click to sort)', width:75, minWidth:75, visible:true, isDistribution:false},
							{label:'Phone', accessor:'phonelist', tooltip:'Phone Numbers in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:true},
							{label:'Email', accessor:'emaillist', tooltip:'Emails in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:true},
							{label:'Web', accessor:'weblist', tooltip:'Websites in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:true},
							{label:'Names', accessor:'namelist', tooltip:'Names in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:true},
							{label:'Location', accessor:'locationlist', tooltip:'Locations in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:true, summaryaccessor:'locations'},
							{label:'Source', accessor:'sourcelist', tooltip:'Source Websites in Group (click to sort)', width:60, minWidth:60, visible:true, isDistribution:true, summaryaccessor:'source'},
//							{label:'HTI Score', accessor:'score', tooltip:'Human Trafficking Index', width:60, minWidth:60, visible:v?v:false, isDistribution:false},
							{label:'Ethnicity', accessor:'ethnicitylist', tooltip:'Ethnicities in Group (click to sort)', width:60, minWidth:60, visible:v?v:false, isDistribution:true, summaryaccessor:'ethnicity'},
							{label:'Underage', accessor:'keywordlist', subaccessor:'underage',tooltip:'Underage Indicators in Group (click to sort)', width:60, minWidth:60, visible:v?v:false, isDistribution:true, summaryaccessor:'keyword'},
							{label:'Risky', accessor:'keywordlist', subaccessor:'risky',tooltip:'Risky Behaviour Indicators in Group (click to sort)', width:60, minWidth:60, visible:v?v:false, isDistribution:true, summaryaccessor:'keyword'},
							{label:'Coercion', accessor:'keywordlist', subaccessor:'coercion',tooltip:'Coercion Indicators in Group (click to sort)', width:60, minWidth:60, visible:v?v:false, isDistribution:true, summaryaccessor:'keyword'},
							{label:'Movement', accessor:'keywordlist', subaccessor:'movement',tooltip:'Movement Indicators in Group (click to sort)', width:60, minWidth:60, visible:v?v:false, isDistribution:true, summaryaccessor:'keyword'},
							{label:'Events', accessor:'keywordlist', subaccessor:'events',tooltip:'Event Indicators in Group (click to sort)', width:60, minWidth:60, visible:v?v:false, isDistribution:true, summaryaccessor:'keyword'}
						];
					}
				},

				init: function() {
					this.amplifyInit();
					var that = this,
						timeChartHeight = amplify.store('timeChartHeight');
					this.width = container.width();
					this.height = container.height();
					if(timeChartHeight) this.height -= timeChartHeight;

					var rowWidth = getRowWidth(this.columns);

					this.mainDiv = $('<div/>');
					this.mainDiv.css({position:'absolute', top:'0px', bottom:'0px',
						width:(rowWidth+SCROLL_BAR_WIDTH+2)+'px', border: BORDER_STYLE, overflow:'hidden'});
					this.headerRow = createHeaderRow(this.columns, function(columnIdx, headerDiv) {
						// Sort
						if (columnIdx==that.sortColumn) {
							that.reverseSort = !that.reverseSort;
						} else {
							that.reverseSort = false;
						}
						that.sortColumn = columnIdx;
						that.sortColumnHeaderDiv = headerDiv;
						that.sortByColumn();
						that.updateColumns(that.showAllColumns);
					});
					this.mainDiv.append(this.headerRow.rowDiv);

					var buttonDiv = $('<div/>', {title:this.showAllColumns?'Hide detail columns':'Show all columns'});
					buttonDiv.addClass('ui-icon');
					buttonDiv.addClass(this.showAllColumns?'ui-icon-minusthick':'ui-icon-plusthick');
					buttonDiv.css({position:'absolute', width: '16px', height: '20px', overflow:'hidden', right:'0px', top:'0px', cursor: 'pointer'});
					buttonDiv.click(function(event) {
						if (that.showAllColumns) {
							that.showAllColumns = false;
							buttonDiv.removeClass('ui-icon-minusthick').addClass('ui-icon ui-icon-plusthick');
							buttonDiv.attr('title', 'Show all columns');
							that.updateColumns(false);
						} else {
							that.showAllColumns = true;
							buttonDiv.removeClass('ui-icon-plusthick').addClass('ui-icon ui-icon-minusthick');
							buttonDiv.attr('title', 'Hide detail columns');
							that.updateColumns(true);
						}
						amplify.store('showAllColumns',that.showAllColumns);
						amplify.store('clusterTableColumns',that.columns);
					});
					this.mainDiv.append(buttonDiv);

					// Create a scrollable div for the content rows
					this.scrollDiv = $('<div/>');
					this.scrollDiv.css({
						overflow:'auto',
						bottom:'20px',
						top:'21px',
						left:'0px',
						width:(rowWidth+SCROLL_BAR_WIDTH+2)+'px',
						position:'absolute',
						'text-align':'right'
					}).scroll(function() {
						that.headerRow.rowDiv.css({'margin-left':'-'+that.scrollDiv.get(0).scrollLeft+'px'});
					});
					this.mainDiv.append(this.scrollDiv);

					this.pageDiv = $('<div/>');
					this.pageDiv.css({height:'20px',overflow:'hidden',position:'absolute',bottom:'0px'});
					this.mainDiv.append(this.pageDiv);

					// Build table rows in the scroll div
					var summary = {locations:{},ethnicity:{},source:{},
							keyword:{dist:{underage:{},risky:{},coercion:{},movement:{},events:{}}, useSubaccessor:true}
					};
					for (var i=0; i<data.details.length; i++) {
						var row = createTableRow(this, data.details[i], this.columns, location, summary);
						this.rows.push(row);
					}
					this.sortByColumn();
					container.append(this.mainDiv);
					this.showSummaryDiv(summary);
					this.summaryPanels = [this.locationSummary, this.ethnicitySummary, this.sourceSummary, this.keywordSummary];
				},

				getPageRange: function() {
					var start = MAX_ROWS*this.page;
					var pages = Math.floor(this.rows.length/MAX_ROWS);
					if (start>this.rows.length) {
						this.page = pages;
						start = MAX_ROWS*this.page;
					}
					var end = start + MAX_ROWS;
					if (end>this.rows.length) end = this.rows.length;
					return {start:start,end:end};
				},

				renderPage: function() {
					this.scrollDiv.empty();
					this.pageDiv.empty();

					var that = this,
						pageRange = this.getPageRange(),
						rowWidth = getRowWidth(this.columns);
					for (var i=pageRange.start; i<pageRange.end; i++) {
						var row = this.rows[i];
						createTableRowDiv(this, row, this.columns, rowWidth);
						this.scrollDiv.append(row.rowDiv);
						addMouseEvents(row); // add mouseevents again, after the divs have been added to the DOM
					}
					var backButton = $('<button/>')
							.text('Back a page')
							.button({
								text:false,
								disabled:(that.page==0),
								icons:{
									primary:'ui-icon-triangle-1-w'
								}
							}).css({
								float:'left',
								width:'16px',
								height:'16px',
								margin:'1px 2px 0px 2px'
							}).click(function(e) {
								that.page--;
								that.renderPage();
							});
					this.pageDiv.append(backButton);

					var pageTitleDiv = $('<div/>')
							.css({float:'left',width:'200px','text-align':'center'})
							.text((pageRange.start+1) + ' to ' + pageRange.end + ' of ' + this.rows.length + ' ad groups');
					this.pageDiv.append(pageTitleDiv);
					var nextButton = $('<button/>')
							.text('Next page').button({
								text:false,
								disabled:(pageRange.end>=this.rows.length),
								icons:{
									primary:'ui-icon-triangle-1-e'
								}
							}).css({
								float:'left',
								width:'16px',
								height:'16px',
								margin:'1px 2px 0px 2px'
							}).click(function(e) {
								that.page++;
								that.renderPage();
							});
					this.pageDiv.append(nextButton);
				},

				sortByColumn: function() {
					if (this.sortIndicator) this.sortIndicator.remove();
					if (this.sortColumnHeaderDiv) {
						this.sortIndicator = $('<div/>');
						this.sortIndicator.addClass('ui-icon');
						this.sortIndicator.addClass('ui-icon-carat-1-'+(this.reverseSort?'s':'n'));
						this.sortIndicator.css({position:'absolute',right:'-2px',top:'-4px'});
						this.sortColumnHeaderDiv.append(this.sortIndicator);
					}
					var column = this.columns[this.sortColumn];
					var accessor = column.accessor;
					var sortMultiplier = this.reverseSort?-1:1;
					if (accessor.indexOf('list')!==-1) {
						if (column.subaccessor) accessor = column.subaccessor;
						var ta = accessor+'total';
						var na = accessor+'none';
						var ma = accessor+'max';
						this.rows.sort(function(a,b) {
							if (a.selected&&!b.selected) return -1;
							if (b.selected&&!a.selected) return 1;
							var at = a.details[ta] - a.details[na];
							var bt = b.details[ta] - b.details[na];
							if ((!at)||at==0) return 1*sortMultiplier;
							if ((!bt)||bt==0) return -1*sortMultiplier;
							if (at<bt) return sortMultiplier;
							return ((a.details[ma]<b.details[ma])?1:-1)*sortMultiplier;
						});
					} else {
						this.rows.sort(function(a,b) {
							if (a.selected&&!b.selected) return -1;
							if (b.selected&&!a.selected) return 1;
							var v1 = a.details[accessor];
							var v2 = b.details[accessor];
							if (v1==null || v1.length==0) return 1*sortMultiplier;
							if (v2==null || v2.length==0) return -1*sortMultiplier;
							if ($.isNumeric(v1)&&$.isNumeric(v2)) return (v2-v1)*sortMultiplier;
							return (v1<v2?1:-1)*sortMultiplier;
						});
					}
					this.page = 0;
					this.renderPage();
				},

				select: function(summaryDiv, attribute, value, subaccessor) {
					var i,
						row,
						distObject,
						found,
						prop;
					if (this.selectedSummaryDiv) {
						this.selectedSummaryDiv[0].selected = !this.selectedSummaryDiv[0].selected;
						this.selectedSummaryDiv.css(ROW_DESELECTED_STYLE).css('border','');
						if (this.selectedSummaryDiv==summaryDiv) {
							this.selectedSummaryDiv.css('background-color',colors.CLUSTER_HOVER);
							for (i = 0; i<this.rows.length; i++) {//update the table
								row = this.rows[i];
								row.selected = false;
								if (row.rowDiv) row.rowDiv.css(ROW_DESELECTED_STYLE);
							}
							this.selectedSummaryDiv = null;
							this.sortByColumn();
							this.updateColumns(this.showAllColumns);
							return;
						}
					}
					this.selectedSummaryDiv = summaryDiv;
					this.selectedSummaryDiv.css(ROW_SELECTED_STYLE).css('border','');
					this.selectedSummaryDiv[0].selected = !this.selectedSummaryDiv[0].selected;
					for (i = 0; i<this.rows.length; i++) {
						row = this.rows[i];
						distObject = row.details[attribute];
						if (subaccessor) distObject = distObject[subaccessor];
						found = false;
						for (prop in distObject) {
							if (distObject.hasOwnProperty(prop)) {
								var lcprop = prop.toLowerCase();
								if (lcprop==value) {
									found = true;
									break;
								}
							}
						}
						row.selected = found;
						if (row.rowDiv) {
							if (found) {
								row.rowDiv.css(ROW_SELECTED_STYLE);
							} else {
								row.rowDiv.css(ROW_DESELECTED_STYLE);
							}
						}
					}
					summaryDiv.mouseenter();
					this.sortByColumn();
					this.updateColumns(this.showAllColumns);
				},

				updateColumns: function(showAllColumns){
					for(var i = 11; i < this.columns.length; i++){
						this.columns[i].visible = showAllColumns;
					}
					this.resize(this.width, this.height);
				},

				showSummaryDiv: function(summary) {
					this.summaryDiv = $('<div/>')
						.css({'padding-left':'5px', border: BORDER_STYLE, overflow:'hidden',
							width:this.sidebarWidth+'px', position:'absolute', top:'0px', right:'0px'});

					var that = this,
						summaryPanels = [
							{
								label: 'locationSummary',
								summaryDiv: getSummaryDiv(summary.locations, function(summaryDiv, value) {
									that.select(summaryDiv, 'locationlist', value);
								})
							},
							{
								label: 'ethnicitySummary',
								summaryDiv: getSummaryDiv(summary.ethnicity, function(summaryDiv, value) {
									that.select(summaryDiv, 'ethnicitylist', value);
								})
							},
							{
								label: 'sourceSummary',
								summaryDiv: getSummaryDiv(summary.source, function(summaryDiv, value) {
									that.select(summaryDiv, 'sourcelist', value);
								})
							},
							{
								label: 'keywordSummary',
								summaryDiv: getSummaryDiv(summary.keyword, function(summaryDiv, value, subaccessor) {
									that.select(summaryDiv, 'keywordlist', value, subaccessor);
								}, true)
							}
						];

					//loads amplified stored state for each side panel if available, default otherwise
					//initializes title and scroll divs for each side panel
					for(var i = 0; i<summaryPanels.length; i++) {
						var panel = summaryPanels[i],
							amplifyDefault = {height:0, collapsed:true, uncollapse:200, label:summaryPanels[i].label},
							widget = amplify.store(panel.label);
						if (widget===undefined) {
							amplify.store(panel.label, amplifyDefault);
							widget = amplifyDefault;
						}
						widget.title = $('<div/>');
						widget.scroll = $('<div/>')
							.css({'border-top': BORDER_STYLE,'border-bottom': BORDER_STYLE, height:'0px',
								top:WIDGET_TITLE_HEIGHT + (i*WIDGET_TITLE_HEIGHT) +'px', left:'0px', right:'0px',
								position:'absolute', overflow:'auto'})
							.append(panel.summaryDiv);
						this[panel.label] = widget;
						this.summaryDiv.append(widget.title).append(widget.scroll);
					}

					container.append(this.summaryDiv);
					this.ewResizeDiv = $('<div/>')
						.css({position:'absolute',right:(this.sidebarWidth+5)+'px',top:'0px',bottom:'0px',width:'3px',background:colors.CLUSTER_RESIZE_BAR,cursor:'ew-resize','z-index':1,opacity:0.7});
					var startX = 0;
					this.ewResizeDiv.draggable({
						axis:'x',
						cursor: 'ew-resize',
						helper: 'clone',
						start: function(event, ui) {
							startX = event.clientX;
						},
						stop: function(event, ui) {
							var endX = event.clientX;
							var w = that.sidebarWidth-(endX-startX);
							if (w<10) w = 10;
							that.sidebarWidth = w;
							amplify.store('clusterTableSidebarWidth', that.sidebarWidth);
							that.resize(that.width, that.height);
						}
					});
					container.append(this.ewResizeDiv);

					var startY = 0;
					this.ethnicitySummary.title.draggable({
						axis:'y',
						cursor: 'ns-resize',
						helper: 'clone',
						start: function(event, ui) {
							if (that.ethnicitySummary.collapsed||that.locationSummary.collapsed) return false;
							startY = event.clientY;
						},
						stop: function(event, ui) {
							var endY = event.clientY;
							var delta = endY-startY;
							if (that.locationSummary.height+delta<0) delta = -that.locationSummary.height;
							if (that.ethnicitySummary.height-delta<0) delta = that.ethnicitySummary.height;
							that.locationSummary.height += delta;
							that.ethnicitySummary.height -= delta;
							that.resizeSidebar();
						}
					});
					this.sourceSummary.title.draggable({
						axis:'y',
						cursor: 'ns-resize',
						helper: 'clone',
						start: function(event, ui) {
							if (that.sourceSummary.collapsed||that.ethnicitySummary.collapsed) return false;
							startY = event.clientY;
						},
						stop: function(event, ui) {
							var endY = event.clientY;
							var delta = endY-startY;
							if (that.ethnicitySummary.height+delta<0) delta = -that.ethnicitySummary.height;
							if (that.sourceSummary.height-delta<0) delta = that.sourceSummary.height;
							that.ethnicitySummary.height += delta;
							that.sourceSummary.height -= delta;
							that.resizeSidebar();
						}
					});
					this.keywordSummary.title.draggable({
						axis:'y',
						cursor: 'ns-resize',
						helper: 'clone',
						start: function(event, ui) {
							if (that.keywordSummary.collapsed||that.sourceSummary.collapsed) return false;
							startY = event.clientY;
						},
						stop: function(event, ui) {
							var endY = event.clientY;
							var delta = endY-startY;
							if (that.sourceSummary.height+delta<0) delta = -that.sourceSummary.height;
							if (that.keywordSummary.height-delta<0) delta = that.keywordSummary.height;
							that.sourceSummary.height += delta;
							that.keywordSummary.height -= delta;
							that.resizeSidebar();
						}
					});

					var setupCollapse = function(summaryPanel, label) {
						summaryPanel.title.css({
							width:'100%',
							height:WIDGET_TITLE_HEIGHT+'px',
							position:'absolute',
							'background-color': colors.CLUSTER_TITLE_BAR,
							left:'0px',
							'padding-top':'1.5px'
						});
						summaryPanel.collapse = $('<div/>')
							.addClass('ui-icon')
							.addClass(summaryPanel.collapsed?'ui-icon-triangle-1-e':'ui-icon-triangle-1-s');
						summaryPanel.title.on('click', function(event) {
							var i,
								numUncollapsed = 0,
								summaryPanels = that.summaryPanels;
							if (summaryPanel.collapsed) {
								summaryPanel.collapsed = false;
								summaryPanel.collapse.removeClass('ui-icon-triangle-1-e').addClass('ui-icon-triangle-1-s');

								var heightToSteal = 0;
								for (i=0; i<summaryPanels.length; i++) {
									if (summaryPanels[i]==summaryPanel) continue;
									if (!summaryPanels[i].collapsed) {
										numUncollapsed++;
										heightToSteal += summaryPanels[i].height;
									}
								}

								if (numUncollapsed>0) {
									var heightTaken = 0;
									for (i=0; i<summaryPanels.length; i++) {
										if (summaryPanels[i]==summaryPanel) continue;
										if (!summaryPanels[i].collapsed) {
											var curHeightTaken = summaryPanels[i].height/(numUncollapsed+1);
											summaryPanels[i].height -= curHeightTaken;
											heightTaken += curHeightTaken;
										}
									}
									summaryPanel.height += heightTaken;
								} else {
									summaryPanel.height = summaryPanel.uncollapse;
								}
							} else {
								summaryPanel.collapsed = true;
								summaryPanel.collapse.removeClass('ui-icon-triangle-1-s').addClass('ui-icon-triangle-1-e');
								for (i=0; i<summaryPanels.length; i++) {
									if (summaryPanels[i]==summaryPanel) continue;
									if (!summaryPanels[i].collapsed) numUncollapsed++;
								}
								if (numUncollapsed>0) {
									for (i=0; i<summaryPanels.length; i++) {
										if (summaryPanels[i]==summaryPanel) continue;
										if (!summaryPanels[i].collapsed) summaryPanels[i].height += summaryPanel.height/numUncollapsed;
									}
								}
								summaryPanel.uncollapse = summaryPanel.height;
								summaryPanel.height = 0;
							}
							that.resizeSidebar();
						});
						summaryPanel.collapse.css({
							position:'relative',
							float:'left',
							cursor:'pointer',
							width:'16px',
							height:'16px'
						});
						summaryPanel.title.append(summaryPanel.collapse);
						summaryPanel.title.append($('<div/>')
								.html('<B>' + label + '</B>')
								.css({
									height:WIDGET_TITLE_HEIGHT+'px',
									cursor:'pointer',
									position:'relative',
									width: 'calc(100% - 17px)',
									float:'left',
									'padding-top':'1.5px',
									'font-weight':'bold',
									'white-space': 'nowrap',
									color: colors.CLUSTER_LABEL,
									overflow:'hidden'
								})
						);
					};

					setupCollapse(this.locationSummary, 'Location Distribution');
					setupCollapse(this.ethnicitySummary, 'Ethnicity Distribution');
					setupCollapse(this.sourceSummary, 'Source Distribution');
					setupCollapse(this.keywordSummary, 'Keyword Distribution');
				},

				resizeTable: function() {
					var width = getRowWidth(this.columns);
					this.headerRow.rowDiv.css({width:width});
					var pageRange = this.getPageRange();
					for (var i=pageRange.start; i<pageRange.end; i++) {
						var row = this.rows[i];
						row.rowDiv.css({width:width});
						for (var j=0; j<this.columns.length; j++) {
							var column = this.columns[j];
							var accessor = column.accessor;
							if (column.subaccessor) accessor = column.subaccessor;
							var cellDiv = row.cells[accessor];
							cellDiv.css({width:column.width+'px',display:column.visible?'block':'none'});
							if (column.isDistribution) {
								cellDiv.empty();
								updateDistributionBar(row.details, column, cellDiv);
							}
							var headerCell = this.headerRow.rowDiv.cells[accessor];
							var headerLabel = this.headerRow.rowDiv.labels[accessor];
							headerCell.css({width:(column.width-1)+'px',display:column.visible?'block':'none'});
							headerLabel.css({width:(column.width-1)+'px'});
						}
					}
				},

				resizeSidebar: function() {
					var i, summaryPanel,
						summaryPanels = this.summaryPanels,
						that = this,
						getSideBarHeight = function () {
							var result = 0;
							for(var i = 0; i<summaryPanels.length;i++) {
								result += summaryPanels[i].height;
							}
							return result;
						},
						sidebarHeight = getSideBarHeight(),
						subtractHeight = function(summaryPanel) {
							if (sidebarHeight>that.height-82 && summaryPanel.height>0) {
								var delta = Math.min(summaryPanel.height, sidebarHeight-that.height+82);
								summaryPanel.height -= delta;
								sidebarHeight -= delta;
							}
						},
						addHeight = function(summaryPanel) {
							if (sidebarHeight<that.height-82 && !summaryPanel.collapsed) {
								summaryPanel.height += that.height-82-sidebarHeight;
								sidebarHeight = that.height-82;
							}
						};

					for (i = 0; i<summaryPanels.length; i++) {
						subtractHeight(summaryPanels[i]);
					}
					for (i = 0; i<summaryPanels.length; i++) {
						addHeight(summaryPanels[i]);
					}
					for (i = 0; i<summaryPanels.length; i++) {
						summaryPanels[i].height = Math.max(0, summaryPanels[i].height);
					}

					var curY = WIDGET_TITLE_HEIGHT;
					this.locationSummary.scroll.css({height:this.locationSummary.height+'px'});
					curY += this.locationSummary.height;
					this.ethnicitySummary.title.css({top:curY+'px'});
					curY += WIDGET_TITLE_HEIGHT;
					this.ethnicitySummary.scroll.css({top:curY+'px',height:this.ethnicitySummary.height+'px'});
					curY += this.ethnicitySummary.height;
					this.sourceSummary.title.css({top:curY+'px'});
					curY += WIDGET_TITLE_HEIGHT;
					this.sourceSummary.scroll.css({top:curY+'px',height:this.sourceSummary.height+'px'});
					curY += this.sourceSummary.height;
					this.keywordSummary.title.css({top:curY+'px'});
					curY += WIDGET_TITLE_HEIGHT;
					this.keywordSummary.scroll.css({top:curY+'px', height:this.keywordSummary.height+'px'});

					//store state of side panels
					for (i = 0; i<this.summaryPanels.length;i++) {
						summaryPanel = this.summaryPanels[i];
						amplify.store(summaryPanel.label,{
							height:summaryPanel.height,
							collapsed:summaryPanel.collapsed,
							uncollapse:summaryPanel.uncollapse,
							label:summaryPanel.label
						});
					}
				},

				resize: function(width,height) {
					this.width = width;
					this.height = height;
					var i, column, expansion, toRemove, overflow, perColumnExpansion,
						visibleColumns = 0,
						lastVisibleColumn = null,
						tableWidth = (getRowWidth(this.columns)+SCROLL_BAR_WIDTH+2);
					if (width<this.sidebarWidth+tableWidth+8) {
						// Reduce table columns
						overflow = tableWidth+this.sidebarWidth+8-width;
						for (i=this.columns.length-1; i>=0; i--) {
							column = this.columns[i];
							if (column.visible) {
								toRemove = Math.min(overflow, column.width-column.minWidth);
								column.width -= toRemove; overflow -= toRemove; tableWidth -= toRemove;
							}
						}
						this.resizeTable();
						this.scrollDiv.css({width:(width-this.sidebarWidth-8)+'px'});
						this.mainDiv.css({width:(width-this.sidebarWidth-8)+'px'});
					} else {
						// Expand the table
						for (i=0; i<this.columns.length; i++) {
							if (this.columns[i].visible) visibleColumns++;
						}
						expansion = width-tableWidth-this.sidebarWidth-8;
						tableWidth += expansion;
						perColumnExpansion = Math.floor(expansion/visibleColumns);
						for (i=0; i<this.columns.length; i++) {
							column = this.columns[i];
							if (column.visible) {
								column.width += perColumnExpansion;
								expansion -= perColumnExpansion;
								lastVisibleColumn = column;
							}
						}
						lastVisibleColumn.width += expansion;
						this.resizeTable();
						this.sidebarWidth = (width-tableWidth-8);
						amplify.store('clusterTableSidebarWidth', this.sidebarWidth);
						this.scrollDiv.css({width:tableWidth+'px'});
						this.mainDiv.css({width:tableWidth+'px'});
					}
					this.mainDiv.css({height:(height-2)+'px'});
					this.summaryDiv.css({height:(height-2)+'px', width:this.sidebarWidth+'px'});

					this.ewResizeDiv.css({right:(this.sidebarWidth+5)+'px'});
					this.resizeSidebar();
				}
			};

			widgetObj.init();
			return widgetObj;
		};

	return {
		createWidget:createWidget
	}
});