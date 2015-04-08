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
define([ '../util/rest', '../util/ui_util', '../util/colors'], function( rest, ui_util, colors) {
	var createWidget = function(container, baseUrl) {
		var aggregateMapWidget = {
			geoData: [],
			map: null,
			locations: null,
			init: function() {
				this.createMap();
                this.fetchData();
			},
			createMap: function() {
				var that = this;
				var selectedNodes = new aperture.Set('id');
                var highlightColor = new aperture.Color(colors.CIRCLE_HOVER);

                // Create the map in the DOM
                this.map = new aperture.geo.Map(container.get(0).id);
                this.locations = this.map.addLayer( aperture.geo.MapNodeLayer );
                this.locations.map('latitude').from('lat');
                this.locations.map('longitude').from('lon');
                this.locations.all(this.geoData);

                // TODO: once we support a dot layer on the map, take the counts into effect
                var bubbles = this.locations.addLayer( aperture.RadialLayer );
                bubbles.map('radius').from(function() {
                    return (this.count/500);
                });
                bubbles.map('opacity').asValue(aperture.config.get()['xdataht.config']['map-node-opacity']);
                bubbles.map('fill').asValue(colors.AGGREGATEMAP_TOTAL)
                    .filter(selectedNodes.filter(function(color) {
                        return highlightColor;
                    }));
                bubbles.map('stroke').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-color']);
                bubbles.map('stroke-width').asValue(aperture.config.get()['xdataht.config']['map-node-stroke-width'])
                    .filter(selectedNodes.constant('highlight'));

                var nodeOver = function(event) {
                    var html = '<B>Location:</B>' + event.data.location + '<BR/>' +
                        '<B>Ad Count:</B>' + event.data.count + '<BR/>' +
                        '<B>Longitude:</B>' + event.data.lon + '<BR/>' +
                        '<B>Latitude:</B>' + event.data.lat;
                    aperture.tooltip.showTooltip({event:event, html:html});
                    $(container).css('cursor','pointer');
                };
                var nodeOut = function(event) {
                    aperture.tooltip.hideTooltip();
                    $(container).css('cursor','default');
                };

                bubbles.on('mouseover', nodeOver);
                bubbles.on('mouseout', nodeOut);
                
                this.map.setExtents(-125, 50, -70, 20);
                this.map.all().redraw();

			},

			createCustomMapControls: function() {
                var clickHandler = function(event){};
    			var mainControl = new aperture.mapcontrol.MapControl({zoomStopHeight:10}, clickHandler);
    			var customControls = [
    				new OpenLayers.Control.DragPan(), // mousedrag functionality
    				mainControl
    			];
    			for (var i=0; i<customControls.length; i++) {
    				var control = customControls[i];
    				this.map.olMap_.addControl(control);
    				control.activate();
    			}
			},
			
			fetchData: function() {
				var that = this;
		        rest.get(baseUrl + 'rest/overview/locations/', 'Get location ad volume', function(result) {
		        	that.geoData.length = 0;
		        	for (var i=0; i<result.results.length; i++) {
		        		that.geoData.push(result.results[i]);
		        	}
	                that.map.all().redraw();
		        });
			},
			resize: function(width,height) {
				this.width = width;
				this.height = height;
			}
		};
		aggregateMapWidget.init();
		return aggregateMapWidget;
	};
	
	return {
		createWidget:createWidget
	}
});
