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
define(['../util/menu'], 
function(menu) {
	var createWidget = function(container, baseUrl) {
		var helpMenuWidget = {
			init: function() {
				var that = this;
				this.statusButton = $('<button/>').text('TellFinder Setup').button({
                    text:false,
                    icons:{
                        primary:'ui-icon-help'
                    }
                }).css({
                    position:'absolute',
                    top:'1px',
                    right:'-3px',
                    width:'18px',
                    height:'18px'
                }).click(function(event) {
                	menu.createContextMenu(event, [
                       {type: 'action', label:'Help', callback:function() {that.onHelp();}},
                       {type: 'action', label:'Version', callback:function() {that.onVersion();}},
                       {type: 'action', label:'Server Status', callback:function() {that.onServerStatus();}}
                	]);
                });
                container.appendChild(this.statusButton[0]);
			
			},
			onServerStatus: function() {
                window.open(baseUrl + 'status.html','_blank');
			},
			onVersion: function() {
				window.open(baseUrl + 'version.html','_blank');
			},
			onHelp: function() {
				window.open(baseUrl + 'docs','_blank');
			}
		};
		helpMenuWidget.init();
		return helpMenuWidget;
	};


	return {
		createWidget:createWidget
	}
});
