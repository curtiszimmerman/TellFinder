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
define([ '../util/ui_util', './tag', '../util/menu', '../util/colors', '../util/rest', '../util/image_dialog', '../util/pager'], function( ui_util, tag, menu, colors, rest, image_dialog, Pager) {
	var OPEN_BUTTON_WIDTH = 17,
		POPROX_URL = 'http://localhost/roxy/ads/view/',
		BORDER_STYLE = '1px solid ' + colors.TABLE_BORDER,
		fullUrl = document.location.href;
	if (fullUrl.indexOf('localhost')<0) {
//		var domainUrl = fullUrl.match('^.+?[^/:](?=[?/]|$)') + '/';
//		var domainUrlSplit = domainUrl.split(':');
//		domainUrl = domainUrlSplit[0] + ':' + domainUrlSplit[1] + '/';
//		POPROX_URL = domainUrl + 'roxy/ads/view/';
//		POPROX_URL = 'https://roxy.istresearch.com/roxy/ads/view/';
		POPROX_URL = 'https://poprox.istresearch.com/poprox/ads/view/'
	}

	var ID_STR = 'id',
		URL_STR = 'url',
		BODY_STR = 'text',
		TIME_STR = 'posttime',
		PHONE_STR = 'phone';
	if (document.HT_SCHEMA) {
		ID_STR = 'parent_id';
		URL_STR = 'websites';
		BODY_STR = 'body';
		TIME_STR = 'post_timestamp';
		PHONE_STR = 'phone_numbers';
	}

	var getTableWidth = function(columns) {
		var result = columns.length + OPEN_BUTTON_WIDTH + 1;
		for (var i=0; i<columns.length; i++) result += columns[i].visible?columns[i].width:0;
		return result;
	};

	var contains = function(details, selectedAdIdArray) {
		if(!selectedAdIdArray) return false;
		if(selectedAdIdArray.indexOf(details.id) > -1) return true;
		if(details.revisions) {
			for (var i = 0; i < details.revisions.length; i++) {
				if(selectedAdIdArray.indexOf(details.revisions[i].id) > -1) return true;
			}
		}
		return false;
	};

	var createRevisionsPopup = function(widget, ads, args) {
		var title = args.nonMember?'Non-member ad: ' + ads[0].id:'Ads in subgroup <' + args.title + '> of ad id ' + ads[0].first_id + ': ' + ads.length,
			$popup = $('<div/>').dialog({
				modal: true,
				'overflow-y': 'hidden',
				position: {
					my: 'center bottom',
					at: 'center top',
					of: widget.mainDiv
				},
				width: Math.min($(window).width(),2000),
				height: Math.min($(window).height()-$(widget.mainDiv).height(),17*ads.length+130),
				title: title,
				show: {
					effect: "fade",
					duration: 250
				},
				hide: {
					effect: "fade",
					duration: 250
				},
				close: function() {
					widget.revisionTable = null;

				}
			});
		if(ads[0].clusterid && window.location.href.indexOf('?attributeid=')<0) {
			$popup.dialog('option','buttons',{
				'Open Graph': function() {
					window.open(args.baseUrl + 'graph.html?clusterid=' + ads[0].clusterid, "_self");
				}
			});
		}
			widget.revisionTable = createWidget(args.baseUrl, widget, $popup, null, ads, null, args.selection, true);
	};

	var addRevisions = function(widget, details, parentDiv, args) {
		var length = 0, title = '';
		if(details.revisions) {
			length = details.revisions.length;
			title += 'Click to view ' + length + ' revision';
			if (length>1) title += 's';
		}
		var revDiv = document.createElement('div');
		revDiv.title = title;
		revDiv.className = 'ui-icon ui-icon-info';
		revDiv.style.cssFloat = 'right';
		revDiv.style.width = '14px';
		revDiv.style.height = '14px';
		revDiv.style.opacity = .7;
		revDiv.style['padding-right'] = '2px';
		revDiv.onclick = function(e) {
			e.stopPropagation();
			var revisions = this.oculusdata['revisions'];
			if(revisions) createRevisionsPopup(widget, revisions, args);
		};
		revDiv.oculusdata = {'revisions':details.revisions};
		parentDiv.appendChild(revDiv);
	};

	var addFetchFirstId = function(widget, details, parentDiv, args) {
		var title = 'This ad ' + ((details.revisions)?'(and it\'s revisions) have ':'has ') +
		 	'an originating ad that does not belong to ' + args.title + '\nClick to view ad ' + details.first_id;

		var firstDiv = document.createElement('div');
		firstDiv.title = title;
		firstDiv.className = 'ui-icon ui-icon-notice';
		firstDiv.style.cssFloat = 'right';
		firstDiv.style.width = '14px';
		firstDiv.style.height = '14px';
		firstDiv.style.cursor = 'pointer';
		firstDiv.style.opacity = .7;
		firstDiv.style['padding-right'] = '2px';
		firstDiv.onclick = function(e) {
			e.stopPropagation();
			var first_id = this.oculusdata['first_id'];
			if(first_id) {
				fetchAd(first_id, args, widget);
			}
		};
		firstDiv.oculusdata = {'first_id':details.first_id};
		
		parentDiv.appendChild(firstDiv);
	};

	var fetchAd = function(first_id, args, widget) {
		rest.post(args.baseUrl + "rest/preclusterDetails/fetchAd/",
			first_id,
			'Fetch Ad ' + first_id,
			function (response) {
				var newArgs = {
						title: 'Non-member ad ' + first_id,
						nonMember: true,
						baseUrl: args.baseUrl,
						selection: args.selection
					},
					ads = [];
				ads.push(response);
				createRevisionsPopup(widget, ads, newArgs)
			},
			false,
			function () {
				alert('error fetching ad ' + first_id);
			});
	};

	var imageAttrMouseOver = function(event) {
		//add background-color style to attribute class
		var attributeClass,
			attrSelector = '.' + this.oculusdata['attribute'] + '_' + this.oculusdata['image_id'];
		var widget = this.oculusdata['widget'];
		$(attrSelector).css('background-color', colors.TABLE_ATTRIBUTE_HOVER);
		var image_hash = this.oculusdata['image_hash'];
		if (image_hash && image_hash.length>0) {
			attributeClass = widget.attributeMap[image_hash];
			attrSelector = '.' + this.oculusdata['attribute'] + '_' + attributeClass;
			$(attrSelector).css('background-color', colors.TABLE_ATTRIBUTE_HOVER);
		}

		var similar = $(attrSelector).size()-1;
        aperture.tooltip.showTooltip({event:{source:event}, html:
        	'<B>' + ((similar<1)?'No':similar) + '</B> similar images in this cluster<BR/>' +
        	'<B>Click To Select All</B><BR/>' +
        	'<B>Double Click To Search</B>'
        	});

		var url = this.oculusdata['url'];
		var width = $(window).width() - $(widget.mainDiv[0]).width() - 5.4;
		this.oculusdata['dialog'] = image_dialog.showImageDialog(url, width);
	};
	
	var imgAttrMouseOut = function(event) {
		var widget = this.oculusdata['widget'];
        aperture.tooltip.hideTooltip();
        this.oculusdata['dialog'].dialog('close').remove();
		var attrSelector = '.' + this.oculusdata['attribute'] + '_' + this.oculusdata['image_id'];
		$(attrSelector).css('background-color', '');
		var image_hash = this.oculusdata['image_hash'];
		if (image_hash && image_hash.length>0) {
			attrSelector = '.' + this.oculusdata['attribute'] + '_' + widget.attributeMap[image_hash];
			$(attrSelector).css('background-color', '');
		}
	};
	
	var imgAttrDoubleClick = function(event) {
		var widget = this.oculusdata['widget'];
		if (widget.searchFn) {
			var dialog = this.oculusdata['dialog'];
			if(dialog) {
				dialog.dialog('close');
				setTimeout(function () {
					dialog.remove();
				}, 250);
			}
			widget.searchFn(this.oculusdata['attribute'], this.oculusdata['image_id']);
		}
		aperture.tooltip.hideTooltip();
	};
	
	var imgAttrOnClick = function(event) {
		var widget = this.oculusdata['widget'];
		event.stopPropagation();
		if(!widget.dblClick) {
			var ads = $('.' + this.oculusdata['attribute'] + '_' + this.oculusdata['image_id']),
				imageHashUUID = this.oculusdata['image_uuid'];
			if (imageHashUUID) {
				ads = ads.add('.' + this.oculusdata['attribute'] + '_' + imageHashUUID);
			}
			publishAdSelection(widget, ads, event.ctrlKey);
		}
	};	
	
	var imgAttrContextMenu = function(e) {
		var url = this.oculusdata['url'];
		e.preventDefault();
	    menu.createContextMenu(e, [
	       {type: 'action', 
    	   	label:'Open image in new tab', 
    	   	callback:function() {
    	   		window.open(url, '_blank');
    	    }
    	   }
    	 ]);
	};

    var getAttributeCounts = function(widget, attributeName, attributeValue) {

        var testRowFn = function(rowData) {
            if (rowData[attributeName] && rowData[attributeName]) {
                var values = rowData[attributeName].split(',');
                if (values.indexOf(attributeValue) != -1) {
                    return true;
                }
            }
            return false;
        };

        var selectedTotal;
        if (widget.selection && widget.selection.selectedAds && widget.selection.selectedAds.length > 0) {
            if (widget.internalSelection) {
                selectedTotal = widget.originalData.filter(function(rowData) {
                    return testRowFn(rowData) && widget.selection.selectedAds.indexOf(rowData.id) != -1;
                }).length
            } else {
                selectedTotal = widget.pager.rows().filter(testRowFn).length;
            }
        } else {
            selectedTotal = 0;
        }

        var total = widget.originalData.filter(testRowFn).length;

        return {
            selected : selectedTotal,
            total : total
        };

    };

	var makeClickableTableCell = function(widget, column, cellDiv, details, text) {
		var i, attrElem,
			values = text.split(','),
			value,
			attributeClass,
			attribute = column.accessor;
		if(attribute === 'images') {
			var images_ids = details['images_id'].split(','),
				images_hashes = details['images_hash']?details['images_hash'].split(','):null;
			for (i = 0; i < values.length; i++) {
				var image_id = images_ids[i];
				var image_hash = images_hashes?images_hashes[i]:null;
				var imageHashUUID = null;
				if (image_hash && image_hash.length>0 && image_hash!=='null') {
					if(widget.attributeMap[image_hash]) {
						attributeClass = widget.attributeMap[image_hash];
					} else {
						attributeClass = ui_util.uuid(image_hash);
						widget.attributeMap[image_hash] = attributeClass;
					}
					imageHashUUID = attributeClass;
				}
				value = values[i];
				attrElem = document.createElement('div');
				attrElem.oculusdata = {};
				attrElem.style.cssFloat='left';
				attrElem.style.height='18px';
				attrElem.style.width='18px';
				attrElem.style.marginLeft='4px';
				attrElem.className=attribute + '_' + image_id + ' ui-icon ui-icon-image';
				attrElem.ondblclick = imgAttrDoubleClick;
				attrElem.onclick = imgAttrOnClick; 
				attrElem.oculusdata['url'] = value;
				attrElem.oculusdata['image_id'] = image_id;
				attrElem.oculusdata['attribute'] = attribute;
				attrElem.oculusdata['adid'] = details.id;
				attrElem.oculusdata['widget'] = widget;

				if (imageHashUUID) {
					attrElem.oculusdata['image_hash'] = image_hash;
					attrElem.oculusdata['image_uuid'] = imageHashUUID;
					attrElem.className += ' ' + attribute + '_' + imageHashUUID;
				}
				
				attrElem.onmouseover = imageAttrMouseOver;
				attrElem.onmouseout = imgAttrMouseOut;
				attrElem.oncontextmenu = imgAttrContextMenu;
				
				cellDiv.appendChild(attrElem);
			}
		} else {
			for (i = 0; i < values.length; i++) {
				value = values[i];
				if(widget.attributeMap[value]) {
					attributeClass = widget.attributeMap[value];
				} else {
					attributeClass = ui_util.uuid(value);
					widget.attributeMap[value] = attributeClass;
				}
				attrElem = document.createElement('div');
				attrElem.oculusdata = {};
				if (value) attrElem.innerHTML=value;
				attrElem.className=attributeClass;
				attrElem.style.cssFloat='left';
				attrElem.onmouseenter = function () {
					var attrSelector = '.'+ this.oculusdata['class'];
					$(attrSelector).css('background-color',colors.TABLE_ATTRIBUTE_HOVER);

                    var attributeCounts = getAttributeCounts(widget,this.oculusdata.attribute,this.oculusdata.value);

		            aperture.tooltip.showTooltip({event:{source:event}, html:
		            	'' + attribute + ' <B>' +  this.oculusdata['value'] + '</B><BR/>' +
		            	'Appears <B>' + attributeCounts.total + '</B> times in this cluster<BR/>' +
                        (attributeCounts.selected ? 'Appears <B>' + attributeCounts.selected + '</B> times in selection<BR/>' : '') +
		            	'<B>Click To Select All</B><BR/>' +
		            	'<B>Double Click To Search</B><BR/>' +
                        '<B>Drag Into Case Builder</B>'
		            	});
				};
				attrElem.onmouseleave = function () {
		            aperture.tooltip.hideTooltip();
					$('.'+ this.oculusdata['class'])
						.css('background-color', $(this).parent().css('background-color'));
				};
				attrElem.onclick = function (e) {
					var attrSelector = '.'+ this.oculusdata['class'];
					e.stopPropagation();
					setTimeout(function () {
						if (!widget.dblClick) {
							publishAdSelection(widget, $(attrSelector), e.ctrlKey);
						}
					},150);
				};

                if (!widget.isPopup && widget.getSidePanel('buildCase')) {
                    $(attrElem).draggable({
                        opacity: 0,
                        appendTo: 'body',
                        containment: 'window',
                        scroll: false,
                        helper: function () {
                            return $('<span>').text(value);
                        },
                        start: function () {
                            if (!widget.dropTarget) {
                                widget.dropTarget = widget.getSidePanel('buildCase').widget.dropTarget;
                            }

                            widget.getSidePanel('buildCase').canvas.append(widget.dropTarget);
                        },
                        stop: function () {
                            widget.dropTarget.remove();
                        }
                    }).data('data', {
                        summary: {
                            attribute: attribute,
                            value: value,
                            contents: null
                        }
                    });
                }

				attrElem.oculusdata['value'] = value;
				attrElem.oculusdata['attribute'] = attribute;
				attrElem.oculusdata['class'] = attributeClass;
				attrElem.oculusdata['adid'] = details.id;

				//search only on hard attributes
				if((attribute === 'phone' ||
					attribute === 'email' ||
					attribute === 'website' ||
					attribute === 'websites') ) {
					attrElem.ondblclick = function (e) {
						e.stopPropagation();
						if(widget.searchFn) {
							widget.dblClick = true;
							widget.searchFn(this.oculusdata['attribute'], this.oculusdata['value'], function (result) {
								widget.dblClick = result;
							});
						}
						aperture.tooltip.hideTooltip();
					};
				}
				cellDiv.appendChild(attrElem);
				if (i != values.length - 1) {
					var commaDiv = document.createElement('div');
					commaDiv.innerHTML=',';
					commaDiv.style.cssFloat='left';
					cellDiv.appendChild(commaDiv);
				}
			}
		}
	};
	
	var createTableCell = function(widget, rowDiv, details, column, args) {
		var sites, cellDiv, i,
			attribute = column.accessor,
			text = details[attribute];

		if (attribute==TIME_STR) {
			text = ui_util.makeDateTimeString(new Date(Number(text)*(document.HT_SCHEMA?1000:1)));
		} else if ((attribute=='websites') && (text!=null || details.website)) {
			if(details.website) {
				if(text) {
					text += "," + details.website;
				} else {
					text = details.website;
				}
			}
			sites = text.split(',');
			var site,
				externalSiteText = '',
				urlText = sites.length>0?sites[0]:'',
				isFirst = true;
			for (i=0; i<sites.length; i++) {
				site = sites[i];
				if (site.indexOf('backpage')>0 || site.indexOf('craigslist')>0 || site.indexOf('myproviderguide')>0) {
				} else {
					if (isFirst) isFirst = false;
					else externalSiteText += ',';
					externalSiteText += site;
				}
			}
			if (attribute=='websites') text = externalSiteText;
			else text = urlText;
		} else if (attribute=='url') {
			if(details.url) {
				text = details.url;
			} else {
				text = details['websites'];
				if (text != null) {
					sites = text.split(',');
					text = sites[0];
				}
			}
		}
		cellDiv = document.createElement('div');
		cellDiv.style.borderRight=BORDER_STYLE;
		cellDiv.style.width=column.width+'px';
		cellDiv.style.height='20px';
		cellDiv.style.overflow='hidden';
		cellDiv.style.cssFloat='left';
		cellDiv.style.display=column.visible?'block':'none';
		if(text && (attribute === 'phone' ||
					attribute === 'email' ||
					attribute === 'website' ||
					attribute === 'websites' ||
					attribute === 'ethnicity' ||
					attribute === 'images' ||
					attribute === 'imageFeatures')) {
			var innerCellDiv = document.createElement('div');

			innerCellDiv.style.height='20px';
			innerCellDiv.style.width=widget.width+'px';
			innerCellDiv.style.position='relative';
			cellDiv.appendChild(innerCellDiv);
			makeClickableTableCell(widget, column, innerCellDiv, details, text);
		} else if (attribute === 'revisions') {
			var textDiv = document.createElement('div');
			cellDiv.appendChild(textDiv);
			if(details.revisions) {
				textDiv.innerHTML = details.revisions.length;
				addRevisions(widget, details, textDiv, args);
			}
			if(!widget.isPopup && details.first_id) addFetchFirstId(widget, details, textDiv, args);
		} else if (text) {
			if(attribute ==='title' || attribute === BODY_STR) {
				cellDiv.appendChild(document.createTextNode(text));
			} else {cellDiv.innerHTML=text;}
			cellDiv.title=text;
		}
		rowDiv.appendChild(cellDiv);
		rowDiv.cells[attribute] = cellDiv;
	};

	var rowOpenButtonClick = function(e) {
		var openButton = this,
			details = this.oculusdata['details'];
		e.stopPropagation();
		menu.createContextMenu(e,[
			{
				type:'action',
				label:'Launch in Poprox',
				callback: function() {
					var id = details[ID_STR],
						url = POPROX_URL + id + '?oculus=0aca893fbfa448fb64bb165c09abe62410e51d360f9b4c9817199c0af21f4750';
					window.open(url,'_blank');
				}
			},
			{
				type:'action',
				label:'Open URL',
				callback: function() {
					var url = details[URL_STR];
					window.open(url,'_blank');
				}
			},
			{
				type:'action',
				label:'Show Contents',
				callback: function() {
					$('<div/>')
						.html(details[BODY_STR])
						.dialog({position: {my: 'left bottom', at: 'right top', of: openButton}});
				}
			}
		]);
	};

	var rowOpenOver = function(e) {
		this.className += " ui-state-hover";			
	};

	var rowOpenOut = function(e) {
		this.className = this.className.replace(/\bui-state-hover\b/, " ");
	};
	
	var createTableRow = function(widget, details, columns, tableWidth, args) {
		var rowDiv = document.createElement('div');
		rowDiv.cells = {};
		rowDiv.style.borderBottom=BORDER_STYLE;
		rowDiv.style.width=tableWidth+'px';
		rowDiv.style.height='15px';
		rowDiv.style.overflow='hidden';

        if (args.highlightRows) {
            rowDiv.style['background-color'] = colors.TABLE_HIGHLIGHT;
        }

		var openButton = document.createElement('button');
		openButton.title = 'Open';
		openButton.className = 'ui-button ui-corner-all ui-icon ui-icon-search ui-state-default';
		openButton.style.cssFloat = 'left';
		openButton.style.width = '14px';
		openButton.style.height = '14px';
		openButton.style.margin = '1px 2px 0px 2px';
		openButton.style['background-position'] = '-162px -115px';
		openButton.oculusdata = {details:details};
		openButton.onclick = rowOpenButtonClick;
		openButton.onmouseover = rowOpenOver;
		openButton.onmouseout = rowOpenOut;
		rowDiv.appendChild(openButton);
		rowDiv.sortValue = details[TIME_STR];

		for (var i=0; i<columns.length; i++) createTableCell(widget, rowDiv, details, columns[i], args);

		return {
			rowDiv:rowDiv,
			details:details,
			filtered: false
		}
	};

	var createColumnHideButton = function(widget, cellDiv, labelDiv, column, oncolumnsize) {
		labelDiv.hidebutton = $('<button/>').text('Hide').button({
			text:false,
			icons:{
				primary:'ui-icon-closethick'
			}
		}).css({
			position:'absolute',
			right:'2px',
			top:'0px',
			width:'14px',
			height:'14px',
			margin:'1px 2px 0px 2px',
			display: 'none'
		}).click(function(e) {
			e.stopPropagation();
			column.visible = false;
			cellDiv.css({display:'none'});
			oncolumnsize();
		});
		labelDiv.append(labelDiv.hidebutton);
	};

	var createHeaderCell = function(widget, rowDiv, columns, idx, onsort, oncolumnsize) {
		var cellDiv = $('<div/>')
				.css({'border-right': BORDER_STYLE, width: columns[idx].width+'px', height: '16px',
					overflow:'hidden', float:'left', display: columns[idx].visible?'block':'none'}),
			labelDiv = $('<div/>')
				.text(columns[idx].label)
				.css({position:'relative',width:columns[idx].width+'px',height:'16px',cursor:'pointer'});
		if(columns[idx].accessor === widget.sortColumn) {
			widget.sortColumnHeaderDiv = labelDiv;
		}
		cellDiv
			.append(labelDiv)
			.click(function(event) {
				onsort(event, columns[idx].accessor, labelDiv);
			})
			.mouseover(function(event) {
				var removeHideButton = function() {
					if (widget.columnHideButton) {
						widget.mainDiv.unbind('mouseover');
						widget.columnHideButton.css({display:'none'});
						widget.columnHideButton = null;
					}
				};
				removeHideButton();
				widget.columnHideButton = labelDiv.hidebutton;
				if(labelDiv.hidebutton) labelDiv.hidebutton.css({display:'block'});
				widget.mainDiv.mouseover(function(event) {
					var pos = labelDiv.offset();
					if (event.clientX<pos.left || event.clientX>pos.left+cellDiv.width() || event.clientY<pos.top || event.clientY>pos.top+cellDiv.height()) {
						removeHideButton();
					}
				});
			});
		createColumnHideButton(widget, cellDiv, labelDiv, columns[idx], oncolumnsize);
		var startX = 0,
			resizeDiv = $('<div/>')
				.css({position:'absolute',right:'0px',top:'0px',height:'16px',width:'5px',opacity:0,background: + colors.TABLE_BORDER,cursor:'ew-resize','z-index':1})
				.draggable({axis:'x',
					cursor: 'ew-resize',
					helper: 'clone',
					appendTo: rowDiv,
					start: function(event, ui) {
						startX = event.clientX;
					},
					drag:function(event,ui) {
						var endX = event.clientX;
						var w = columns[idx].width+(endX-startX);
						if (w<10) w = 10;
						columns[idx].width = w;
						cellDiv.css({width:columns[idx].width+'px'});
						labelDiv.css({width:columns[idx].width+'px'});
						oncolumnsize();
						startX = endX;
					},
					stop: function(event, ui) {
						var endX = event.clientX;
						var w = columns[idx].width+(endX-startX);
						if (w<10) w = 10;
						columns[idx].width = w;
						cellDiv.css({width:columns[idx].width+'px'});
						labelDiv.css({width:columns[idx].width+'px'});
						oncolumnsize();
					}
				});
		labelDiv.append(resizeDiv);
		rowDiv.append(cellDiv);
		rowDiv.cells[columns[idx].accessor] = cellDiv;
	};

	var createColumnMenu = function(widget, event) {
		var items = [];
		for (var i=0; i<widget.columns.length; i++) {
			var column = widget.columns[i];
			(function(column) {
				items.push({
					type: 'checkbox',
					label: column.label,
					checked: column.visible,
					callback: function(checked) {
						column.visible = checked;
						widget.columnResize();
					}
				});
			})(column);
		}
		menu.createContextMenu(event, items);
	};

	var createColumnDisplayButton = function(widget, parent) {
		var cdButton = $('<button/>').text('Show Columns').button({
				text:false,
				icons:{
					primary:'ui-icon-triangle-1-e'
				}
			}).css({
				position:'absolute',
				right:'0px',
				top:'0px',
				width:'14px',
				height:'14px',
				margin:'1px 2px 0px 2px'
			}).click(function(e) {
				createColumnMenu(widget, e);
			});
		parent.append(cdButton);
	};

	var createHeaderRow = function(widget, onsort, oncolumnsize, columns) {
		var width = getTableWidth(columns),
			rowDiv = $('<div/>');
		rowDiv.cells = {};
		rowDiv.css({border: BORDER_STYLE, 'border-right': '', width:width+'px', height:'16px', overflow:'hidden',
			'font-weight':'bold', 'text-align':'center',top:'25px',left:'0px',position:'absolute'});

		var cellDiv = $('<div/>');
		cellDiv.css({'border-right': BORDER_STYLE, width: OPEN_BUTTON_WIDTH+'px', height: '20px', overflow:'hidden', float:'left', position:'relative'});
		createColumnDisplayButton(widget, cellDiv);
		rowDiv.append(cellDiv);

		for (var i=0; i<columns.length; i++) createHeaderCell(widget, rowDiv, columns, i, onsort, oncolumnsize);

		return {
			rowDiv:rowDiv
		}
	};

	var publishAdSelection = function (widget, ads, ctrlKey) {
		var adids = [];
		ads.each(function(ad) {
			if (this.oculusdata) adids.push(this.oculusdata['adid']);
		});
		if (ctrlKey) {
			widget.selection.add('table', adids);
		} else {
			widget.selection.toggle('table', adids);
		}
	};

	var genData = function(data) {
		var result = [], revisions = [], firstIDMap = {}, resultMap={}, datum, first;
		for(var i = 0; i<data.length; i++) {
			datum = data[i];
			if(datum.first_id) {
				first = firstIDMap[datum.first_id];
				if(!first) {
					first = [];
					firstIDMap[datum.first_id] = first;
					revisions.push(datum.first_id);
				}
				first.push(datum);
			} else {
				result.push(datum);
				resultMap[datum.id]=datum;
			}
		}
		for(i = 0; i < revisions.length; i++) {
			datum = resultMap[revisions[i]];
			first = firstIDMap[revisions[i]];
			if(datum) {
				datum.revisions = first;
			} else {
				var newFirst = first[0];
				result.push(newFirst);
				first.splice(0,1);
				if(first.length>0) newFirst.revisions = first;
			}
		}
		return result;
	};

	var createScrollbarOverlayDiv = function(selectedOverlay, top, bottom) {
		var h = bottom-top;
		if (h<2) h=2;
		selectedOverlay.append($('<div/>')
				.css({
					position: 'absolute',
					height: h + 'px',
					border: '1px solid ' + colors.TABLE_OVERLAY_BORDER,
					right: '3px',
					top: top + 'px',
					width: '8px',
					'background-color': colors.TABLE_HIGHLIGHT,
					opacity:0.5
				})
			);
	};
	
	var renderScrollbarHighlights = function(selectedOverlay, scrollbarHighlights) {
		selectedOverlay.empty();
		scrollbarHighlights.sort();
		var curStart = -10;
		var curEnd = -10;
		for (var i=0; i<scrollbarHighlights.length; i++) {
			var top = scrollbarHighlights[i];
			if (curStart>=0) {
				if (top-curEnd<2) {
					curEnd = top;
				} else {
					createScrollbarOverlayDiv(selectedOverlay, curStart, curEnd);
					curStart = top;
					curEnd = top;
				}
			} else {
				curStart = top;
				curEnd = top;
			}
		}
		if (curStart>=0) {
			createScrollbarOverlayDiv(selectedOverlay, curStart, curEnd);
		}
	};
	
	var createWidget = function(baseUrl, appwidget, container, classifiers, data, title, selection, isPopup) {
		var widgetObj = {
			amplifyPrefix: isPopup?'revision_':'',
			columns:[
				{label: 'Post Time', accessor: TIME_STR, width: 105, visible: true},
				{label: 'Source', accessor: 'source', width: 80, visible: true},
				{label: 'Location', accessor: 'location', width: 120, visible: true},
				{label: 'Phone', accessor: PHONE_STR, width: 100, visible: true},
				{label: 'Title', accessor: 'title', width: 200, visible: true},
				{label: 'Hourly Rate', accessor: 'Cost_hour_mean', width: 80, visible: true},
				{label: 'Images', accessor: 'images', width: 80, visible: true},
				{label: 'Image Features', accessor: 'imageFeatures', width: 80, visible: true},
				{label: 'External Websites', accessor: 'websites', width: 200, visible: true},
				{label: 'Email', accessor: 'email', width: 100, visible: true},
				{label: 'Name', accessor: 'name', width: 80, visible: true},
				{label: 'Ethnicity', accessor: 'ethnicity', width: 80, visible: true},
				{label: 'Full Text', accessor: BODY_STR, width: 200, visible: true},
				{label: 'ID', accessor: 'id', width: 80, visible: true},
				{label: 'Revisions', accessor: 'revisions', width: 80, visible: true},
				{label: 'URL', accessor: 'url', width: 200, visible: true},
				{label: 'Tags', accessor: 'tags', width: 80, visible: true}
			],
			selectedRows: [],
			rows: [],
			revisions: {},
			revisionTable:null,
			sortColumn: TIME_STR,
			reverseSort: false,
			blur: true,
			attributeMap:{},
			dblClick:false,
			selection:selection,
			isPopup:isPopup,
            isResizing:false,
			table_version:1.0,
            originalData : null,
            dropTarget : null,
			init: function() {
				var that = this;
				for (var i = 0; classifiers && i < classifiers.length; i++) {
					this.columns.push(
						{ label : classifiers[i], accessor : classifiers[i], width : 80, visible : true }
					);
				}
				this.amplifyInit();
				if (this.isPopup) this.columns.splice(14, 1);	// remove the revisions column
				this.width = container.width();
				this.height = container.height();
				if (!isPopup) data = genData(data);

				this.originalData = data;

				this.pager = Pager.create()
					.rowsPerPage(50)
					.onPageChange(function(pageRows) {
						that.populateTable(pageRows, that.selection && that.selection.selectedAds && that.internalSelection === false);
					}, this)
					.rows(data);

				this.createHeaderAndPopulateRows();
				if (!isPopup) {
					this.createButtons();
					$(window).unbind('keypress');
					$(window).keypress(function(e) {
						if (e.charcode == 88 || e.charcode == 120 || e.which == 88 || e.which == 120) {
							that.toggleBlurred();
						}
					});
				}
			},

			amplifyInit: function() {
				//sets and stores defaults if any are previously undefined
				if (amplify.store('table_version')!=this.table_version) {
					amplify.store('table_version', this.table_version);
					return;
				}
				var amplifyColumns = amplify.store(this.amplifyPrefix + 'tablecolumns');
				if (amplifyColumns) this.columns = amplifyColumns;
				var amplifyReverse = amplify.store(this.amplifyPrefix + 'tableReverseSort');
				if (amplifyReverse!=undefined) this.reverseSort = amplifyReverse;
				var amplifySort = amplify.store(this.amplifyPrefix + 'tableSortColumn');
				if (amplifySort!=undefined) this.sortColumn = amplifySort;
				var tableBlur = amplify.store('tableBlur');
				if (tableBlur!=undefined) this.blur = tableBlur;
			},
            getSidePanel : function(name) {
                if (appwidget) {
                    return appwidget.sidePanels[name];
                } else {
                    return null;
                }
            },
			createHeaderAndPopulateRows: function() {
				var that = this,
					$loaderDiv = $('<div id="details-spinner"/>').css({
						'background' : 'url("./img/ajaxLoader.gif") no-repeat center center',
						'display' : 'none',
						'width' : container.width(),
						'height' : container.height()
					});
				this.mainDiv = $('<div id="details-table"/>').css({position:'absolute',top:'0px',bottom:'0px',left:'0px',right:'0px',overflow:'hidden'});

				if(!isPopup) {
					this.topDiv = $('<div/>').css({height:'25px',top:'0px',right:'0px',left:'0px', position:'absolute',
						background:colors.TABLE_TITLE_BAR, color:colors.TABLE_LABEL, 'font-weight':'bold'});
					this.mainDiv.append(this.topDiv);

					this.filterArea = $('<div/>').css({height:'20px',top:'0px',right:'0px',position:'absolute',
						background:colors.TABLE_TITLE_BAR, color:colors.TABLE_LABEL, 'font-weight':'bold'});
					this.topDiv.append(this.filterArea);

					this.titleDiv = $('<div/>')
						.css({position:'absolute',top:'0px',height:'21px',left:'0px',overflow:'hidden',
							'padding-top':'4px', 'padding-left':'3px'})
						.text('Ads in group <' + title + '>: ' + data.length);
					this.topDiv.append(this.titleDiv);
				}
				this.headerRow = createHeaderRow(this, function(event, accessor, headerDiv) {
					// on sort
					that.sortColumnHeaderDiv = headerDiv;
					that.sortByColumn(accessor);
				}, function() {
					// on column resize
					that.columnResize();
				}, this.columns);
				this.mainDiv.append(this.headerRow.rowDiv);

				// Create a scrollable div for the content rows
				this.scrollDiv = $('<div id="details-table-scrollDiv"/>');
				this.scrollDiv.css({
					overflow:'auto',
					bottom:'0px',
					top:'43px',
					left:'0px',
					right:'0px',
					position:'absolute',
					'border-left': BORDER_STYLE,
					'white-space':'nowrap'
				}).scroll(function() {
					that.headerRow.rowDiv.css({'margin-left':'-'+that.scrollDiv.get(0).scrollLeft+'px'});
				});


				this.mainDiv.append(this.scrollDiv);


                this.populateTable(this.pager.getPageRows());

				container.append(this.mainDiv).append($loaderDiv);

				this.selectedOverlay = $('<div/>')
					.css({
						position: 'absolute',
						'pointer-events': 'none',
						top: '58px', // 43+15
						width: '15px',
						right:'0px',
						bottom: '32px' // 17 for the horizontal scroll and 15 for the button
					});
				this.mainDiv.append(this.selectedOverlay);
				this.sortByColumn();
				if(isPopup) this.selectionChanged(selection.selectedAds);
			},

            populateTable : function(pageRows, bHighlighted) {

                var that = this;
                var updateHighlight = function() {
                    that.rows.forEach(function(row) {
                        if (selection.selectedAds.indexOf(row.details.id) != -1){
                            $(row.rowDiv).prop('highlighted',true);
                            row.rowDiv.style['background-color'] = colors.TABLE_HIGHLIGHT;
                        } else {
                            $(row.rowDiv).prop('highlighted',false);
                            row.rowDiv.style['background-color'] = '';
                        }
                    });
                };

                this.scrollDiv.empty();

                var tableRowArgs = {
                    baseUrl: baseUrl,
                    title: title,
                    selection: selection,
                    highlightRows : bHighlighted
                };

                var width = getTableWidth(this.columns);

                this.rows = [];
                for (var i=0; i<pageRows.length; i++) {
                    var row = createTableRow(this, pageRows[i], this.columns, width, tableRowArgs);
                    $(row.rowDiv).prop('highlighted',bHighlighted);
                    if (this.internalSelection && this.selection && this.selection.selectedAds.indexOf(row.details.id) != -1) {
                        $(row.rowDiv).prop('highlighted',true);
                    }
                    this.rows.push(row);
                    (function(row) {
                        if (!isPopup) {
                            row.rowDiv.onclick = function (event) {

                                // If we went from external selection to clicking on a row, reset the selection
                                if (that.internalSelection === false) {
                                    selection.set('table',[]);
                                    that.pager.rows(data);
                                    that.populateTable(that.pager.getPageRows(),false);

                                    // goto page with this element on it
                                    var rowIndex = that.pager.findRow(function(pageRow) {
                                        return row.details.id === pageRow.id;
                                    });
                                    that.pager.goToPage(that.pager.getPageForIndex(rowIndex));

                                }

                                that.internalSelection = true;

                                if (event.ctrlKey || event.shiftKey) {
                                    selection.add('table', [row.details.id]);
                                } else {
                                    selection.toggle('table', [row.details.id]);
                                }

                                updateHighlight();
                                that.internalSelectionChanged(selection.selectedAds);
                                $(this).mouseenter();
                            };
                        }
                        row.rowDiv.onmouseover = function() {
                            if (!that.isResizing)
                                $(this).css({
                                    'cursor':'pointer',
                                    'background-color':($(row.rowDiv).prop('highlighted')?colors.TABLE_SELECTED_HOVER:colors.TABLE_HOVER)
                                });
                        };
                        row.rowDiv.onmouseleave = function() {
                            if (!that.isResizing)
                                $(this).css({
                                    'cursor':'default',
                                    'background-color':($(row.rowDiv).prop('highlighted')?colors.TABLE_HIGHLIGHT:'')
                                });
                        };
                    })(row);
                }

                updateHighlight();

                for (var i=0; i<this.rows.length; i++) {
                    var row = this.rows[i];
                    this.scrollDiv.append(row.rowDiv);
                }
            },

			columnResize: function() {
				var width = getTableWidth(this.columns),
					i = 0, j = 0, row;
				this.headerRow.rowDiv.css({width:width});
				for (j; j<this.columns.length; j++) {
					this.headerRow.rowDiv.cells[this.columns[j].accessor]
						.css({width:this.columns[j].width+'px', display: this.columns[j].visible?'block':'none'});
				}
				for (i; i<this.rows.length; i++) {
					row = this.rows[i];
					row.rowDiv.style.width = width + "px";
					for (j = 0; j<this.columns.length; j++) {
						var cellDiv = row.rowDiv.cells[this.columns[j].accessor];
						cellDiv.style.width = this.columns[j].width+'px';
						cellDiv.style.display = this.columns[j].visible?'block':'none';
					}
				}
				amplify.store(this.amplifyPrefix + 'tablecolumns', this.columns);
			},
			sortByColumn: function(accessor) {
				if (this.sortColumn && accessor == this.sortColumn) {
					this.reverseSort = !this.reverseSort;
					amplify.store(this.amplifyPrefix + 'tableReverseSort', this.reverseSort);
				} else if (accessor) {
					this.reverseSort = false;
					amplify.store(this.amplifyPrefix + 'tableReverseSort', this.reverseSort);
				}

				if(accessor===undefined) {
					accessor = this.sortColumn;
				}
				if(this.sortColumn !== accessor) {
					this.sortColumn = accessor;
					amplify.store(this.amplifyPrefix + 'tableSortColumn', this.sortColumn);
				}

				if (this.sortIndicator) this.sortIndicator.remove();
				if (this.sortColumnHeaderDiv) {
					this.sortIndicator = $('<div/>');
					this.sortIndicator.addClass('ui-icon');
					this.sortIndicator.addClass('ui-icon-carat-1-'+(this.reverseSort?'s':'n'));
					this.sortIndicator.css({position:'absolute',left:'-2px',top:'-4px'});
					this.sortColumnHeaderDiv.append(this.sortIndicator);
				}

				var sortMultiplier = this.reverseSort?-1:1;
				this.pager.sort(function(a,b) {
					var v1, v2;
					if(accessor==='revisions') {
						v2 = 0;
						if (a.revisions) v2 += a.revisions.length;
						if (a.first_id!==undefined) v2 += .5;
						v1 = 0;
						if (b.revisions) v1 += b.revisions.length;
						if (b.first_id!==undefined) v1 += .5;
					} else	{
						v1 = a[accessor];
						v2 = b[accessor];
						if (v1 == null || v1.length == 0) return sortMultiplier;
						if (v2 == null || v2.length == 0) return -1 * sortMultiplier;
						if (accessor === 'images') {
							var temp = v1.split(',').length;
							v1 = v2.split(',').length;
							v2 = temp;
						}
					}
					if ($.isNumeric(v1)&&$.isNumeric(v2)) return (v1-v2)*sortMultiplier;
					return (v2<v1?1:-1)*sortMultiplier;
				});
				for (var i=0; i<this.rows.length; i++) {
					var row = this.rows[i];
					this.scrollDiv.append(row.rowDiv);
				}
				this.updateSelectedOverlay();
			},

            internalSelectionChanged: function(selectedAdIdArray) {

            },
			
			selectionChanged: function(selectedAdIdArray) {
                this.internalSelection = false;
				if (this.dblClick) return;

                if (selectedAdIdArray.length > 0) {
                    var selectedRows = data.filter(function (element) {
                        for (var i = 0; i < selectedAdIdArray.length; i++) {
                            if (element.id === selectedAdIdArray[i]) {
                                return true;
                            }
                        }
                        return false;
                    });
                    this.pager.rows(selectedRows);
                    this.populateTable(this.pager.getPageRows(),true);
                } else {
                    this.pager.rows(data);
                    this.populateTable(this.pager.getPageRows(),false);
                }
			},

			toggleBlurred: function() {
				this.blur = !this.blur;
				amplify.store('tableBlur', this.blur);
				if(this.blurButton) {
					this.blurButton
						.attr('title', this.blur ? 'click to unblur images' : 'click to blur images')
						.button('option', 'label', this.blur ? 'BLURRED' : 'UNBLURRED')
						.css('background', this.blur ? colors.TABLE_HIGHLIGHT : colors.TABLE_BLURRED);
				}
				if(this.revisionTable) this.revisionTable.blur = this.blur;
				$('.img-dialog').css('-webkit-filter',this.blur?'blur(10px)':'');
			},

			destroyTable: function() {

			},

			createButtons: function() {
				var that = this;

                // Append the pager control
                this.pager.getElement()
                    .appendTo(this.filterArea);

				this.blurButton = $('<button/>')
					.button()
					.button('option', 'label', this.blur?'BLURRED':'UNBLURRED')
					.attr('title', this.blur?'click to unblur images':'click to blur images')
					.css({
						'background':this.blur?colors.TABLE_HIGHLIGHT:colors.TABLE_BLURRED,
						width:'76px'
					})
					.click(function() {
						that.toggleBlurred();
					}).appendTo(this.filterArea);

				var selectAll = function() {
					var adids = [];
					for (var rowIndex = 0; rowIndex < that.rows.length; rowIndex++) {
						var row = that.rows[rowIndex];
						adids.push(row.details.id);
					}
					selection.set('table', adids);
					that.selectionChanged(selection.selectedAds);
                };
                
                var deselectAll = function() {
					selection.set('table', []);
					that.selectionChanged(selection.selectedAds);
                };
                
                var openSelected = function() {
					var urlStrings = [],
						parent_id,
						data_source;
					for (var i = 0; i < that.selectedRows.length; i++) {
						var row = that.selectedRows[i];
						if (row && row.details['id']) {
							if(row.details['parent_id']) {
								parent_id = row.details['parent_id'];
							} else {
								parent_id = row.details['id'];
							}
							data_source = row.details['source'];
							urlStrings.push(POPROX_URL + parent_id +
								'?oculus=0aca893fbfa448fb64bb165c09abe62410e51d360f9b4c9817199c0af21f4750');
						}
					}
					// TODO:  display a warning if we have too many ads selected?
					for (i = 0; i < urlStrings.length; i++) {
						window.open(urlStrings[i],'_blank');
					}
	            };
				
	            var tagSelected = function() {
					var highlightedAdIds = [];
					for (var i = 0; i < that.selectedRows.length; i++) {
						var row = that.selectedRows[i];
						if (row && row.details['id']) highlightedAdIds.push(row.details['id']);
					}
					tag.showTagDialog(baseUrl, highlightedAdIds, function(tagsToAdd, tagsToRemove) {
						for (var i=0; i<that.rows.length; i++) {
							var row = that.rows[i];
							if (!row.selected) continue;
							// Grab existing data
							var currentTagString = row.details['tags'];
							var currentTags = [];
							if (currentTagString && currentTagString != '') {
								currentTags = currentTagString.split(',');
							}

							// Remove tagsToRemove
							for (var j = 0; j < tagsToRemove.length; j++) {
								var removeIdx = currentTags.indexOf(tagsToRemove[j]);
								if (removeIdx != -1) {
									currentTags.splice(removeIdx,1);
								}
							}

							// Add tags to add
							for (j = 0; j < tagsToAdd.length; j++) {
								currentTags.push(tagsToAdd[j]);
							}

							// Rebuild string
							currentTagString = '';
							if (currentTags.length > 0 ) {
								for (j = 0; j < currentTags.length-1; j++) {
									currentTagString += currentTags[j] + ',';
								}
								currentTagString += currentTags[ currentTags.length -1 ];
							}

							// Update data row
							row.details['tags'] = currentTagString;
							row.rowDiv.cells['tags'].innerHTML = currentTagString;
						}
					});
                };
                
                var resetTags = function() {
					// Update data row
					for (var i = 0; i < that.rows.length; i++) {
						var row = that.rows[i];
						row.details['tags'] = '';
						row.rowDiv.cells['tags'].innerHTML = '';
					}
				};
	            
				var onExport = function() {
					var eol ='\r\n',
						delim = ',',
						fileName = 'ad_details.csv',
						i = 0, j = 0,
						result = "",
						row,
						value = "";
					if (that.selectedRows.length==0) {
						alert('Select some rows before exporting.');
						return;
					}
					
					for (i = 0; i < that.columns.length; i++) {
						result += that.columns[i].label;
						result += (i < that.columns.length - 1) ? delim : eol;
					}
		
					for (i = 0; i < that.selectedRows.length; i++) {
						row = that.selectedRows[i];
						for (j = 0; j < that.columns.length; j++) {
							value = "";
							if (row.details[that.columns[j].accessor] != undefined) {
								value = row.details[that.columns[j].accessor];
								if (that.columns[j].accessor === TIME_STR) {
									value = ui_util.makeDateTimeString(new Date(Number(value)*(document.HT_SCHEMA?1000:1)));
								}
							}
							result += '"' + value + '"';
							result += (j < that.columns.length - 1) ? delim : eol;
						}
					}
		
					var blob = new Blob([result], {type:'text/csv'}),
						wUrl = window.URL || window.webkitURL,
						a;
		
					if (window.navigator.msSaveBlob) { 	// Internet Explorer
						window.navigator.msSaveBlob(blob, fileName);
					} else { 							//other browsers
						a = document.createElement('a');
						a.href = wUrl.createObjectURL(blob);
						a.download = fileName;
						$(document.body).append(a);
						setTimeout(function () {
							a.click();
							$(a).remove();
						}, 250);
					}
				};
				
				if (!isPopup) {
					this.selectionButton = $('<button/>').text('Selection operations').button({
						text:false,
						icons:{
							primary:'ui-icon-triangle-1-s'
						}
					}).click(function(e) {
		            	menu.createContextMenu(e, [
	                        {type: 'action', label:'Select All', callback:selectAll},
	                        {type: 'action', label:'Deselect All', callback:deselectAll},
	                        {type: 'action', label:'Open Selected', callback:openSelected},
	                        {type: 'action', label:'Tag Selected', callback:tagSelected},
	                        {type: 'action', label:'Reset Tags', callback:resetTags},
	                        {type: 'action', label:'Export Details', callback:onExport}
	                	]);
					}).appendTo(this.filterArea);
				}				
			},
			updateSelectedOverlay: function(){
				var width = parseInt(this.selectedOverlay.width()) - 5 + 'px',
					increment = (parseInt(this.selectedOverlay.height())/this.rows.length),
					selectedAdIdArray = selection.selectedAds;
				if(!selectedAdIdArray || selectedAdIdArray.length===0) return;
				var scrollbarHighlights = [];
				for (var rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
					if (contains(this.rows[rowIndex].details, selectedAdIdArray)) {
						scrollbarHighlights.push(rowIndex * increment);
					}
				}
				renderScrollbarHighlights(this.selectedOverlay, scrollbarHighlights);
			},
			resize: function(width,height) {
			}
		};
		widgetObj.init();
		return widgetObj;
	};

	return {
		createWidget:createWidget
	};
});