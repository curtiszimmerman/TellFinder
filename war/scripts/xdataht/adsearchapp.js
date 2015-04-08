/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * Property of Uncharted (TM), formerly Oculus Info Inc.
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
/**
 * Main module that defines the xDataHT application
 *
 */
define(['./modules/adsearch',
		'./modules/util/ui_util',
			// Supporting libraries:
			'lib/underscore', 'lib/dragscrollable'],
			
/**
 * Application startup code. Fills in the rootContainer with a widget defined in appwidget.js when the
 * DOM is ready.
 */
function(adsearch, ui_util) {
	var AppController = function() {
		this.start = function() {
			var jqwindow = $(window);
			var elem = document.getElementById("rootContainer");
			var fullUrl = document.location.href;
			var baseUrl = fullUrl.match('^.+?[^/:](?=[?/]|$).+?(?=[?/]|$)') + '/';
			var tip = ui_util.getParameter('tip');
			var type = ui_util.getParameter('type');
			this.widget = new adsearch.createWidget(elem, baseUrl, tip, type);

			if(this.widget.resize){
			    this.widget.resize(jqwindow.width(), jqwindow.height());
            }
			var that = this;
			window.onresize = function() {
				that.widget.resize(jqwindow.width(), jqwindow.height());
			};

		};
	};

	return {
		app : null,
		setup : function() {
			this.app = new AppController();
		},
		start : function() {
			this.app.start();
		}
	};
});
