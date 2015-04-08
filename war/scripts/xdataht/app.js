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
/**
 * Main module that defines the xDataHT application
 *
 */
define(['./modules/graph/appwidget',
		'./modules/cluster',
		'./modules/util/ui_util',
        './modules/util/advancedsearch',
			// Supporting libraries:
			'lib/underscore', 'lib/dragscrollable'],
			
/**
 * Application startup code. Fills in the rootContainer with a widget defined in appwidget.js when the
 * DOM is ready.
 */

function(appwidget, cluster, ui_util, AdvancedSearch) {
	var AppController = function() {
		this.start = function() {
			var jqwindow = $(window);
			var elem = document.getElementById("rootContainer");
			var fullUrl = document.location.href;
			var baseUrl = fullUrl.match('^.+?[^/:](?=[?/]|$).+?(?=[?/]|$)') + '/';
			this.widget = new appwidget.createWidget(elem, baseUrl, ui_util.getParameter('explorer')==='true');
            if(this.widget.resize){
			    this.widget.resize(jqwindow.width(), jqwindow.height());
            }
			var that = this;
			window.onresize = function() {
				that.widget.resize(jqwindow.width(), jqwindow.height());
			};

            var bExplorer = ui_util.getParameter('explorer');
            bExplorer = (bExplorer === 'true') ? true : false;

            var bAdvanced = ui_util.getParameter('advanced');
            bAdvanced = (bAdvanced === 'true') ? true : false;

            if (bAdvanced) {
                // TODO:   handle advanced searching in here
                var params = ['phone','email','website','text','location','startdate','enddate'];
                var paramsObj = {};
                params.forEach(function(param) {
                    var value = ui_util.getParameter(param);
                    if (value && value !== '') {
                        paramsObj[param] = value;
                    }
                });
                this.widget.doAdvancedSearch(paramsObj,'org',bExplorer);

            } else {

                var tip = ui_util.getParameter('tip');
                if (tip && tip.length > 1) {
                    this.widget.simpleSearch.inputBox.val(tip);
                    this.widget.doSimpleSearch(tip, 'org', bExplorer);
                    return;
                }

                var clusterid = ui_util.getParameter('clusterid');
                if (clusterid && clusterid.length > 0) {
                    this.widget.fetchClusterId(clusterid, 'org');
                    return;
                }

                var attributeid = ui_util.getParameter('attributeid');
                if (attributeid && attributeid.length > 0) {
                    this.widget.fetchAttributeId(attributeid, bExplorer);
                    return;
                }


                var attribute = ui_util.getParameter('attribute');
                var value = ui_util.getParameter('value');
                if (attribute && value && (value.length > 1)) {
                    this.widget.fetchAttribute(attribute, value);
                    return;
                }
            }
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
