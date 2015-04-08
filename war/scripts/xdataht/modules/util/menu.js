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
define([ './colors'], function( colors) {
	var ROW_INDENT = 10,

	createCheckboxItem = function(parent, itemElem, item) {
		var checkElem = $('<input type="checkbox"/>')
				.css({float:'left', cursor:item.callback?'pointer':'default'})
				.prop('checked', item.checked)
				.click(function(e) {
					e.stopPropagation();
					if(item.callback) {
						item.callback(checkElem.get(0).checked);
					}
				});
		itemElem
			.click(function() {checkElem.click();})
			.css({'cursor':'pointer',overflow:'hidden',clear:'both','font-weight': 'normal'})
			.mouseenter(function() {
				$(this).css({'background-color':colors.MENU_HOVER});
			}).mouseleave(function() {
				$(this).css({'background-color':''});
			});
		parent.append(itemElem.append(checkElem));
	},

	createTandemCheckboxItem = function(parent, itemElem, item) {
		var $checkboxes = parent.find('.checkboxes');
		if($checkboxes.length < 1) {
			$(parent).css('font-weight','');
			$checkboxes = $('<div/>')
				.addClass('checkboxes')
				.css({
					'float':'right',
					'position':'absolute',
					right:'0px',
					top:'0px'
				});
			parent.append($checkboxes);
		}
		var checkElem = $('<input type="checkbox"/>')
			.css({cursor:item.callback?'pointer':'default'})
			.prop('disabled',item.callback?false:true)
			.prop('checked', item.checked)
			.click(function(e) {
				e.stopPropagation();
				if(item.callback) {
					item.callback(checkElem.get(0).checked);
				}
			}).mouseenter(function(e) {
				aperture.tooltip.showTooltip({event:{source:event}, html:item.label});
				$(parent).css({'background-color':colors.MENU_HOVER});
			}).mouseleave(function(e) {
				aperture.tooltip.hideTooltip();
				$(parent).css({'background-color':''});
			});
		$checkboxes.append(checkElem);
	},

	createActionItem = function(parent, itemElem, callback, data) {
		itemElem
			.css({'cursor': callback?'pointer':'default', 'font-weight': 'normal'})
			.click(function() {
				if(callback) {
					callback(data);
					parent.data('parent').remove();
					document.activeContextMenu = null;
					document.oncontextmenu = function() {return true;};
					$(document).off('click');
				}
			}).mouseenter(function() {
				$(this).css({'background-color':colors.MENU_HOVER});
			}).mouseleave(function() {
				$(this).css({'background-color':''});
			});
		parent.append(itemElem);
	},

	createDivItem = function (parent, item) {
		item.div
			.css({'cursor':item.callback?'pointer':'default', 'padding-left':parent.data('indent')*ROW_INDENT + 'px'})
			.click(function() {
				if(item.callback) {
					item.callback();
				}
			});
		parent.append(item.div);
	},

	createContextMenuDiv = function(event, contentdiv) {
    	var jqBody = $(document.body),
			jqTarget = $(event.target),
			targetpos = {pos:jqTarget.offset()};

		if (jqTarget.is('path')) {
			targetpos.h=jqTarget[0].getBBox().height;
			targetpos.w=jqTarget[0].getBBox().width;
		} else {
			targetpos.h=jqTarget.height();
			targetpos.w=jqTarget.width();
		}
    	
    	// Return if there is already a context menu
    	if (document.activeContextMenu) return;

    	var overlayItem = $('<div/>', {id:'oculusBlockingLayer'})
				.css({position:'absolute',left:'0px',right:'0px',top:'0px',bottom:'0px',opacity:'0', 'z-index':99999998});

		var destroy = function() {
			contentdiv.hide(150, function() {
				contentdiv.remove();
				overlayItem.remove();
				document.activeContextMenu = null;
				document.oncontextmenu = function() {return true;};
				$(document).off('click');
			});
		};

		overlayItem.on('mousemove',function(event) {
			var buffer = 15,
				p = contentdiv.offset();
			if (event.clientX>(p.left-buffer) &&
				event.clientX<(p.left + $(contentdiv).width()+buffer) &&
				event.clientY>(p.top-buffer) &&
				event.clientY<(p.top + $(contentdiv).height()+buffer)) {
				return;
			}
			destroy();
    	});
    	jqBody.append(overlayItem);
    	
		jqBody.append(contentdiv);
		document.activeContextMenu = contentdiv;

		// Destroy the context menu if clicked elsewhere
		var initialClick = true;
		$(document).on('click', function() {
			if (initialClick) {
				initialClick = false;
				return;
			}
			if (event.clientX>targetpos.pos.left && event.clientX<targetpos.pos.left+targetpos.w
					&& event.clientY>targetpos.pos.top && event.clientY<targetpos.pos.top+targetpos.h) {
				return true;
			}
			destroy();
		});

		// Destroy the context menu if a second context menu is created
		var initialContextMenu = true;
		document.oncontextmenu = function(event) {
			if (initialContextMenu) {
				initialContextMenu = false;
				return false;
			}
			if (event.clientX>targetpos.pos.left && event.clientX<targetpos.pos.left+targetpos.w
					&& event.clientY>targetpos.pos.top && event.clientY<targetpos.pos.top+targetpos.h) {
				return true;
			}
			destroy();
			return false;
		};

		var x = event.clientX,
			y = event.clientY,
			h = $(window).height(),
			w = $(window).width(),
			cssObj = {position:'absolute', top: y + 'px', 'z-index':99999999};
		if (y>h/2) {
			cssObj.top = '';
			cssObj.bottom = (h-y) + 'px';
		}
		if (x<w/2) {
			if (x+60>w) x = x-60;
			cssObj.left = x + 'px';
		} else {
			cssObj.right = (w-x) + 'px';
		}
		
		contentdiv.css(cssObj).menu();
	},

	addItems = function(parent, items) {
		var item, indent, listElem;
		for (var i = 0; i<items.length; i++) {
			item = items[i];
			indent = parent.data('indent');
			listElem = $('<li>')
				.text(item.label)
				.css('padding-left', indent*ROW_INDENT + 'px');
			if (item.type=='collection') {
				indent++;
				listElem
					.css({'font-weight':'bold',cursor:'default',position:'relative'})
					.data('indent', indent)
					.data('parent', parent);
				parent.append(listElem);
				addItems(listElem, item.items);
			} else if (item.type=='checkbox') {
				createCheckboxItem(parent, listElem, item);
			} else if (item.type=='tandem_checkbox') {
				createTandemCheckboxItem(parent, listElem, item);
			} else if (item.type == 'action') {
				createActionItem(parent, listElem, item.callback, item.data);
			} else if (item.type =='div') {
				createDivItem(parent, item);
			} else { //text to be listed only
				parent.append(listElem.css('font-weight','normal'));
			}
		}
	},

	createContextMenu = function(event, items) {
		var listElem = $('<ul>', {id:'oculusMenu'})
			.css({
				'font-size':'14px',
				'list-style-type': 'none',
				display: 'none'
			})
			.data('indent',0);
		createContextMenuDiv(event, listElem);
		listElem.data('parent', listElem);
		addItems(listElem, items);
		var x = parseInt(listElem.css('width')),
			$checkBoxes = listElem.find('.checkboxes');
		if($checkBoxes.length>0) {
			x += parseInt($($checkBoxes.get(0)).css('width'));
			listElem.css('width',x+'px');
		}
		listElem.show(150);
    };
    
	return {createContextMenu:createContextMenu}
});