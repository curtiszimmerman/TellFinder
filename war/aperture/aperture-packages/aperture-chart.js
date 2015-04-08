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

/*
 * Aperture
 */
aperture = (function(aperture){

/**
 * Source: AxisLayer.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Axis Layer
 */

/**
 * @namespace
 * The chart visualization package. If not used, the chart package may be excluded.
 */
aperture.chart = (
/** @private */
function(namespace) {
	/**
	 * @private
	 * Creates the {@link aperture.LabelLayer} used to
	 * display a title for this axis.
	 */
	var DEFAULT_TICK_LENGTH = 4,
		DEFAULT_TICK_WIDTH = 1,
		palette = aperture.palette.color,
	
	createTitleLayer = function(node){
		// Lazy creation of the title LabelLayer.
		this.titleLayer = this.addLayer(aperture.LabelLayer);
		// Detach the title of the axis from inheriting any parent x-mappings.
		// We don't want the label to be able to pan horizontally.
		this.titleLayer.map('x').from('x').only().using(this.DEFAULT_RANGE.mapKey([0,1]));
		this.titleLayer.map('y').from('y').using(this.DEFAULT_RANGE.mapKey([1,0]));
		this.titleLayer.map('text').from('text');
		this.titleLayer.map('text-anchor').asValue('middle');

		// Setup optional mappings.
		this.titleLayer.map('orientation').from('orientation');
		this.titleLayer.map('offset-x').from('offset-x');
		this.titleLayer.map('offset-y').from('offset-y');
		this.titleLayer.map('font-family').asValue(this.valueFor('font-family', node.data, null));
		this.titleLayer.map('font-size').asValue(this.valueFor('font-size', node.data,null));
		this.titleLayer.map('font-weight').asValue(this.valueFor('font-weight', node.data, null));
	},

	setDefaultValues = function(){
		var type = this.valueFor('axis');
		var vAlign = this.valueFor('text-anchor-y');
		var textAlign = this.valueFor('text-anchor');
		var layout = this.valueFor('layout');
		if (type === 'x'){
			if (!layout){
				this.map('layout').asValue('bottom');
			}
			if (!vAlign){
				this.map('text-anchor-y').asValue('top');
			}
			if (!textAlign){
				this.map('text-anchor').asValue('middle');
			}
		}
		else{
			if (!layout){
				this.map('layout').asValue('left');
			}
			if (!vAlign){
				this.map('text-anchor-y').asValue('middle');
			}
			if (!textAlign){
				this.map('text-anchor').asValue('end');
			}
		}
	},

	getLabelPadding = function(type, layout, vAlign, textAlign){
		var xPadding=0, yPadding=0;
		var labelOffsetX = this.valueFor('label-offset-x', null, 0);
		var labelOffsetY = this.valueFor('label-offset-y', null, 0);
		if (type === 'x') {
			if (layout === 'top'){
				yPadding = -labelOffsetY;
			}
			else if (layout === 'bottom'){
				yPadding = labelOffsetY;
			}

			if (textAlign === 'start'){
				xPadding = labelOffsetX;
			}
			else if (textAlign === 'end'){
				xPadding = -labelOffsetX;
			}
		}
		else {
			if (layout === 'left'){
				xPadding = -labelOffsetX;
			}
			else if (layout === 'right'){
				xPadding = labelOffsetX;
			}
			if (vAlign === 'bottom'){
				yPadding = labelOffsetY;
			}
			else if (vAlign === 'top'){
				yPadding = -labelOffsetY;
			}
		}
		return {'x':xPadding, 'y':yPadding};
	},

	/**
	 * @private
	 * Renders the tick marks for this label and creates a list of
	 * tick mark labels that will be passed on to the child {@link aperture.LabelLayer}
	 * for rendering.
	 * @param {Object} node Render node for this layer
	 */
	createAxis = function(node){
		var w,
			h,
			left = node.position[0],
			top = node.position[1],
			right = left + node.width,
			bottom = top + node.height,
			type = this.valueFor('axis', node.data, null);

		node.userData[type] = node.userData[type] || {};
		node.graphics.removeAll(node.userData[type].axis);

		// The margin defines the width of the axis for vertical AxisLayers;
		// the height of the axis for horizontal AxisLayers.
		var axisMargin = this.valueFor('margin',node.data,0),
			ruleWidth = this.valueFor('rule-width',node.data,0);

		setDefaultValues.call(this);

		var tickWidth = this.valueFor('tick-width',node.data, DEFAULT_TICK_WIDTH);
		var tickLength = this.valueFor('tick-length',node.data, DEFAULT_TICK_LENGTH);
		// The offset of the tick mark from the chart layer.
		var offset = this.valueFor('tick-offset',node.data,0);

		// Check the type of axis we are drawing.
		// x-axis = horizontal
		// y-axis = vertical

		var vAlign = (this.valueFor('text-anchor-y', null, 'bottom')).toLowerCase();
		var layout = null;

		if (type == 'x') {
			w = node.width;
			h = axisMargin || node.height;
			layout = (this.valueFor('layout', null, 'bottom')).toLowerCase();
			if (layout === 'top'){
				tickLength *= -1;
				offset *= -1;
			}
		}
		else {
			w = axisMargin || node.width;
			h = node.height;
			layout = (this.valueFor('layout', null, 'left')).toLowerCase();
			if (layout === 'right'){
				tickLength *= -1;
				offset *= -1;
			}
		}

		//TODO:
		// Create set for storing tick visuals for updating/removal.

		// Now we render the ticks at the specifed intervals.
		var path = '';

		var min=0, max=0;
		var mapKey = node.data;
		var axisRange = node.data.from();

		// no range? show no ticks.
		if (axisRange.get()) {
			var tickArray = {ticks:axisRange.get()};
			var xPos=0,yPos=0;
			var tickLabels = [];
	
			// Check if the label layer is visible.
			if (this.labelLayer){
				if (type === 'y'){
					// We use a default mapper for the x-coordinate of the labels so that we can
					// align the vertical labels with the left side of the chart by mapping them
					// to zero.
					this.labelLayer.map('x').from('labels[].x').using(this.DEFAULT_RANGE.mapKey([0,1]));
					this.labelLayer.map('y').from('labels[].y');
					//this.labelLayer.map('text-anchor').asValue('end');
				}
				else if (type === 'x'){
					this.labelLayer.map('x').from('labels[].x');
					// We use a default mapper for the y-coordinate of the labels so that we can
					// align the horizontal labels with the bottom of the chart by mapping them
					// to zero.
					this.labelLayer.map('y').from('labels[].y').using(this.DEFAULT_RANGE.mapKey([1,0]));
					//this.labelLayer.map('text-anchor').asValue('middle');
				}
	
				// Setup optional font attribute mappings. Default values are provided by label layer
				// if no explicit value is provided locally.
				this.labelLayer.map('font-family').asValue(this.valueFor('font-family', node.data, null));
				this.labelLayer.map('font-size').asValue(this.valueFor('font-size',node.data,null));
				this.labelLayer.map('font-weight').asValue(this.valueFor('font-weight', node.data, null));
			}
	
			// Draw the tick marks for a banded or ordinal range.
			var hasBands = axisRange.typeOf(/banded/),
				mappedValue, tickId, tick, tickMin, tickLimit,
				bandwidth = 0;
			if (tickArray.ticks.length > 1){
				// Calculate the distance between bands by sampling the first 2 intervals.
				bandwidth = (this.valueFor('x', tickArray, 0, 1)-this.valueFor('x', tickArray, 0, 0))*node.width;
			}
	
			if (hasBands || axisRange.typeOf(aperture.Ordinal)){
				for (tickId=0; tickId < tickArray.ticks.length; tickId++){
					tick = tickArray.ticks[tickId];
					if (!tick) {
						continue;
					}
					tickMin = hasBands?tick.min:tick;
					tickLimit = hasBands?tick.limit:tick;
					if (type === 'x'){
						mappedValue = this.valueFor('x', tickArray, 0, tickId);
						xPos = (mappedValue*node.width) + left;
						yPos = bottom + offset;
						if (xPos < left || xPos > right){
							continue;
						}
	
						path += 'M' + xPos + ',' + yPos + 'L' + xPos + ',' + (yPos+tickLength);
						tickLabels.push({'x':tickMin,'y':0, 'text':axisRange.format(tickMin)});
						// If we're on the last tick, and there is a bounded upper limit,
						// include a tick mark for the upper boundary value as well.
						if (tickId == tickArray.ticks.length-1 && tickLimit != Number.MAX_VALUE){
							// Create a fake data source so that the mapped value will account
							// for any filters.
							mappedValue = this.valueFor('x', {'ticks':[{'min':tickLimit}]}, 0, 0);
							xPos = (mappedValue*node.width) + left;
							path += 'M' + xPos + ',' + yPos + 'L' + xPos + ',' + (yPos+tickLength);
							// If this is a banded scalar, we want to show the label.
							if (axisRange.typeOf(aperture.Scalar)){
								tickLabels.push({'x':tickLimit,'y':0, 'text':axisRange.format(tickLimit)});
							}
						}
					}
					else if (type === 'y'){
						mappedValue = this.valueFor('y', tickArray, 0, tickId);
						xPos = left - (tickLength + offset) - (0.5*ruleWidth);
						yPos = (mappedValue*h) + top;
						path += 'M' + xPos + ',' + yPos + 'L' + (xPos+tickLength) + ',' + yPos;
	
						// If we're on the last tick, and there is a bounded upper limit,
						// include a tick mark for the upper boundary value as well.
						if (tickId == tickArray.ticks.length-1 && tickLimit != Number.MAX_VALUE){
							mappedValue = this.valueFor('y', {'ticks':[{'min':tickLimit}]}, 0, 0);
							yPos = (mappedValue*h) + top;
							path += 'M' + xPos + ',' + yPos + 'L' + (xPos+tickLength) + ',' + yPos;
							tickLabels.push({'x':0,'y':tickLimit, 'text':axisRange.format(tickLimit)});
						}
						tickLabels.push({'x':0,'y':tickMin, 'text':axisRange.format(tickMin)});
					}
				}
			}
	
			// Draw the tick marks for a scalar range.
			else {
				for (tickId=0; tickId < tickArray.ticks.length; tickId++){
					tick = tickArray.ticks[tickId];
					if (tick !== -Number.MAX_VALUE){
						mappedValue = axisRange.map(tick);
						if (type === 'x'){
							xPos = mappedValue*node.width + left;
							if (xPos < left || xPos > right){
								continue;
							}
							// Calculate the axis position in a top-down fashion since the origin
							// is in the top-left corner.
							yPos = bottom + offset;
							path += 'M' + xPos + ',' + yPos + 'L' + xPos + ',' + (yPos+tickLength);
							tickLabels.push({'x':tick,'y':0, 'text':axisRange.format(tick)});
						}
	
						else if (type === 'y'){
							xPos = left - (tickLength + offset) - ruleWidth;
							// Calculate the axis position in a top-down fashion since the origin
							// is in the top-left corner.
							yPos = mappedValue*node.height + top;
							if (yPos < top || yPos > bottom){
								continue;
							}
							
							path += 'M' + xPos + ',' + yPos + 'L' + (xPos+tickLength) + ',' + yPos;
							tickLabels.push({'x':0,'y':tick, 'text':axisRange.format(tick)});
						}
					}
				}
			}

			this.labelLayer.all({'labels':tickLabels});
		}
		// Unless specifically overridden, the axis colour will be the same as the
		// border colour of the parent ChartLayer.
		var axisColor = this.valueFor('stroke') || palette('rule');

		var axisSet = [];
		if (!!ruleWidth){
			var rulePath;
			if (type === 'y'){
				rulePath = 'M'+left + ',' + top + 'L' + left + ',' + bottom;
			}
			else if (type === 'x'){
				yPos = bottom + offset;
				rulePath = 'M'+left + ',' + yPos + 'L' + right + ',' + yPos;
			}
			var axisRule = node.graphics.path(rulePath).attr({fill:null, stroke:axisColor, 'stroke-width':ruleWidth});
			axisSet.push(axisRule);
		}

		// Take the path of the ticks and create a Raphael visual for it.
		var axisTicks = node.graphics.path(path).attr({fill:null, stroke:axisColor, 'stroke-width':tickWidth});
		axisSet.push(axisTicks);
		node.userData[type].axis = axisSet;

		// Check to see if this axis layer has a title.
		var title = this.valueFor('title', node.data, null);
		if (title){
			var axisTitle;
			if (!this.titleLayer){
				createTitleLayer.call(this, node);
			}
			// For vertical titles, we need to rotate the text so that it is aligned
			// parallel to the axis.
			if (type === 'y'){
				axisTitle = {'x':0, 'y':0.5, 'text':title, 'orientation':-90, 'offset-x': -axisMargin};
			}
			else if (type === 'x'){
				axisTitle = {'x':0.5, 'y':0, 'text':title, 'offset-y': axisMargin};
			}
			this.titleLayer.all(axisTitle);
		}
	};

	/**
	 * @exports AxisLayer as aperture.chart.AxisLayer
	 */
	var AxisLayer = aperture.PlotLayer.extend( 'aperture.chart.AxisLayer',
	/** @lends AxisLayer# */
	{
		/**
		 * @augments aperture.PlotLayer
		 * @class An AxisLayer provides visual representation of a single axis 
		 * for its parent {@link aperture.chart.ChartLayer ChartLayer}. AxisLayers are not added 
		 * to a chart in conventional layer fashion, rather they are instantiated the first time
		 * they are referenced via chart.{@link aperture.chart.ChartLayer#xAxis xAxis} or
		 * chart.{@link aperture.chart.ChartLayer#yAxis yAxis}

		 * @mapping {String} stroke
		 *   The color of the axis rule and ticks.
		 * 
		 * @mapping {Number=0} rule-width
		 *   The width of the line (in pixels) used to visually represent the baseline of an axis. Typically, the
		 *   parent {@link aperture.chart.ChartLayer ChartLayer} will have a border visible, which subsequently provides
		 *   the baseline for the axis, thus 'rule-width' is set to zero by default. If no border is present in
		 *   the parent chart, then this property should be assigned a non-zero value.
		 *   Tick marks will extend perpendicularly out from this line.
		 * 
		 * @mapping {Number=0} tick-length
		 *   The length of a tick mark on the chart axis.
		 * 
		 * @mapping {Number=0} tick-width
		 *   The width of a tick mark on the chart axis.
		 * 
		 * @mapping {Number=0} tick-offset
		 *   The gap (in pixels) between the beginning of the tick mark and the axis it belongs too.
		 * 
		 * @mapping {Number=0} label-offset-x
		 *   The horizontal gap (in pixels) between the end of a tick mark, and the beginning of the tick mark's label.
		 * 
		 * @mapping {Number=0} label-offset-y
		 *   The vertical gap (in pixels) between the end of a tick mark, and the beginning of the tick mark's label.
		 * 
		 * @mapping {Number} margin
		 *   The space (in pixels) to allocate for this axis.
		 *   For vertical (y) axes, this refers to the width reserved for the axis.
		 *   For horizontal (x) axes, this refers to the height reserved for the axis.
		 * 
		 * @mapping {String} title
		 *   The text of the axis title.
		 * 
		 * @mapping {String='Arial'} font-family
		 *   The font family used to render all the text of this layer.
		 * 
		 * @mapping {Number=10} font-size
		 *   The font size (in pixels) used to render all the text of this layer.
		 * 
		 * @mapping {String='normal'} font-weight
		 *   The font weight used to render all the text of this layer.
		 * 
		 * @constructs
		 * @factoryMade
		 */
		init : function(spec, mappings) {
			aperture.PlotLayer.prototype.init.call(this, spec, mappings);
			// Add a LabelLayer for rendering the tick mark labels.
			this.labelLayer = this.addLayer(aperture.LabelLayer);
			// Set up the expected mappings for the LabelLayer.
			this.labelLayer.map('text').from('labels[].text');
			this.labelLayer.map('label-count').from('labels.length');

			// Setup optional mappings.
			this.labelLayer.map('orientation').from('orientation');
			this.labelLayer.map('offset-x').from('offset-x');
			this.labelLayer.map('offset-y').from('offset-y');
			this.labelLayer.map('font-family').from('font-family');
			this.labelLayer.map('font-size').from('font-size');
			this.labelLayer.map('font-weight').from('font-weight');

			this.DEFAULT_RANGE = new aperture.Scalar('default_range', [0,1]);
		},

		canvasType : aperture.canvas.VECTOR_CANVAS,

		render : function(changeSet) {

			// Process the modified components.
			aperture.util.forEach(changeSet.updates, function(node) {
				createAxis.call(this, node);
			}, this);

			
			// will call renderChild for each child.
			aperture.PlotLayer.prototype.render.call(this, changeSet);
		},

		/**
		 * @private
		 * Before the child {@link aperture.LabelLayer} is rendered, we need to adjust
		 * the position of the child layer to account for the tick marks of the axis.
		 */
		renderChild : function(layer, changeSet) {
			// The type of axis we are drawing.
			// Vertical axes are drawn on the left (typically the y-axis)
			// Horizontal axes are drawn at the bottom of the graph (typically the x-axis).

			var i;

			// Before we create the child LabelLayer, we may need to change the starting
			// position and anchor point of the layer depending on the type of axis
			// we are drawing, and how the parent ChartLayer is oriented.
			var toProcess = changeSet.updates;
			for (i=0; i < toProcess.length; i++){
				var node = toProcess[i],
					left = node.position[0],
					top = node.position[1];

				var ruleWidth = this.valueFor('rule-width', null, 1);

				var type = this.valueFor('axis', null, null);

				// (may be better to use these constant values instead).
				var anchorMap = {left: 'start', right: 'end', middle: 'middle'};
						
				if (layer === this.labelLayer){
					var vAlign = this.valueFor('text-anchor-y', null, 'bottom');
					var textAlign = this.valueFor('text-anchor', null, null);
					var layout = this.valueFor('layout', null, null);

					// Set the anchor position of the label based on
					// the alignment properties of this axis.
					layer.map('text-anchor-y').asValue(vAlign);

					// Handle the case of a banded or ordinal range.

					//TODO: Re-work the handling of the changed
					// nodes. This seems inefficient.
					// If this node is an existing one, just leave
					// it where it is. The label is already positioned
					// in the correct location.
					if (aperture.util.has(changeSet.changed, node)){
						continue;
					}

					var tickWidth = this.valueFor('tick-width', node.data, DEFAULT_TICK_WIDTH);
					var tickLength = this.valueFor('tick-length', node.data, DEFAULT_TICK_LENGTH);
					var offset = this.valueFor('tick-offset', node.data, 0);
					var axisMargin = this.valueFor('margin', node.data, 0); // TODO: smart default based on what's showing

					var mapKey = node.parent.data;
					var axisRange = mapKey.from();
					var tickArray = axisRange.get();
					var childPos, bandWidth;

					// If the axis ticks/labels are being drawn in the interior
					// of the plot area, flip these values to correspond with
					// that.
					if ((type === 'x' && layout === 'top')||
							(type === 'y' && layout === 'right')){
						tickLength *= -1;
						offset *= -1;
					}

					if (axisRange.typeOf(/banded|Ordinal/)){
						if (type === 'x'){
							// If this is a banded scalar value, we want to align the tick labels
							// with the tick marks. For ordinals, the labels are shifted to fall
							// between tick marks.
							if (axisRange.typeOf(aperture.Scalar)){
								childPos = [left, top + (tickLength+offset)];
							}
							else {
								bandWidth = (node.width-(2*tickWidth))/tickArray.length;
								childPos = [left + (0.5*bandWidth), top + (tickLength+offset)];
							}
							node.position = childPos;
						}
						else if (type === 'y'){
							// Get the orientation of the parent chart layer.
							// The default orientation is vertical.
							// e.g For the case of a bar chart, a vertical orientation draws
							// the bars top-to-bottom. Whereas a horizontal orientation would
							// draw the bars left-to-right.
							var orientation = this.valueFor('orientation', node.data, 'vertical');
							// Handle a horizontal orientation.
							if (orientation == 'horizontal'){
								// Special case for a banded scalar range.
								// If this is a vertical axis (e.g. Y-axis) but the chart is oriented
								// horizontally, we want the label of any scalar tick marks to
								// align with the tick itself, and not be slotted in between tick marks
								// as we do for ordinal tick marks.
								if (axisRange.typeOf(aperture.Scalar)){
									childPos = [left-(tickLength+offset), top];
								}
								else {
									bandWidth = (node.height-(2*tickWidth))/tickArray.length;
									childPos = [left-(tickLength+offset), top-(0.5*bandWidth)];
								}
							}
							// Default assumption is a vertical orientation.
							else {
								childPos = [left-(tickLength+offset), top];
							}
							node.position = childPos;
						}
					}
					// Handle the default case of an unbanded or scalar range.
					else {
						if (type === 'x'){
							childPos = [left, top + (tickLength+offset)];
							node.position = childPos;
						}
						else if (type === 'y'){
							childPos = [left-(tickLength+offset), top];
							node.position = childPos;
						}
					}
					var padding = getLabelPadding.call(this, type, layout, vAlign, textAlign);
					node.position[0] = node.position[0] + padding.x;
					node.position[1] = node.position[1] + padding.y;
				}
				else if (layer.uid == (this.titleLayer && this.titleLayer.uid)){
					childPos = [left, top];
					node.position = childPos;

					this.titleLayer.map('text-anchor-y').asValue(type === 'y'? 'top': 'bottom');
				}
			}
			layer.render( changeSet );
		}
	});

	namespace.AxisLayer = AxisLayer;
	return namespace;
}(aperture.chart || {}));
/**
 * Source: BarSeriesLayer.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Bar Chart Layer
 */

/**
 * @namespace
 * The chart visualization package. If not used, the chart package may be excluded.
 */
aperture.chart = (
/** @private */
function(namespace) {

	/**
	 * @private
	 * Creates a simple identifier for a given bar segment. For
	 * unstacked bars, there will only ever be one segment.
	 * @param {Object} Spec used to generate the identifier.
	 */
	var getBarId = function (barSpec){
		return barSpec.x.toString() + barSpec.y.toString();
	},

	/**
	 * @private
	 * Calculates the actual dimensions to render a bar, accounting for chart
	 * orientation and border width.
	 * @param {String} Orientation of the chart (i.e. 'bar-layout').
	 * @param {Number[0,1]} Normalized value of the x-coordinate data value .
	 * @param {Number[0,1]} Normalized value of the y-coordinate data value.
	 * @param {Number} Width of a bar visual.
	 * @param {Number} Width of the border around the chart.
	 */
	getBarRenderSize = function(orientation, xValue, yValue, w, h, barWidth, borderWidth){
		var localBarWidth=0,localBarHeight=0;

		if (orientation === 'horizontal'){
			localBarWidth = xValue*w;
			localBarHeight = barWidth-borderWidth;
		}
		else {
			var canvasY = yValue*h;
			// Take the y-point and calculate the height of the corresponding bar.
			// We subtract the stroke width of the top and bottom borders so that
			// the bar doesn't blead over the border.
			localBarWidth = barWidth;
			localBarHeight = Math.max((h-canvasY) - borderWidth,0);
		}
		return {'width':localBarWidth, 'height':localBarHeight};
	},

	/**
	 * @private
	 * Calculates the width of a bar visual.
	 * @param {Object} Node object
	 * @param {Number} Width of the chart
	 * @param {Number} Height of the chart
	 * @param {Number} Number of series.
	 */
	getBarWidth = function(node, canvasWidth, canvasHeight, seriesCount){
		var barSeriesData = node.data,
			strokeWidth = this.valueFor('stroke-width', barSeriesData, 1),
			numPoints = this.valueFor('point-count', barSeriesData, 0),
			spacer = this.valueFor('spacer', null, 0),
			orientation = this.valueFor('orientation', null, 'vertical'),
			bandWidth = (orientation==='horizontal'?canvasHeight:canvasWidth)/numPoints,
			maxBarWidth = (bandWidth-((seriesCount-1)*spacer)-(seriesCount*2*strokeWidth))/seriesCount;

		// See if a value has been provided for the bar width, if there isn't
		// we'll use the one we calculated. If the user provided a bar width,
		// make sure it doesn't exceed the max bar width.
		var barWidth = Math.min(this.valueFor('width', node.data, maxBarWidth), maxBarWidth);

		// If the bar width is less than or equal to zero, return a bar width of 1 pixel anyways.
		// The user should understand that the chart is too crowded and either reduce the number
		// of bars to plot or increase the chart's dimensions.
		if (barWidth <= 0){
			return 1;
		}

		return barWidth;
	},

	getBarPosition = function(seriesId, index, canvasWidth, canvasHeight, barOffset,
			footprint, node){

		var barSeriesData = node.data,
			xValue = this.valueFor('x', barSeriesData, 0, index),
			yValue = this.valueFor('y', barSeriesData, 0, index),
			strokeWidth = this.valueFor('stroke-width', barSeriesData, 1),
			orientation = this.valueFor('orientation', null, 'vertical'),
			borderWidth = this.valueFor('border-width', barSeriesData, 1),
			barLayout = this.valueFor('bar-layout', null, this.DEFAULT_BAR_LAYOUT),
			canvasY = yValue*canvasHeight;

		var xPoint=0, yPoint=0;

		if (orientation === 'horizontal'){
			xPoint = node.position[0] + borderWidth;
			yPoint = canvasY + node.position[1];
			// Account for the bar offset and the height of the
			// top/bottom borders of the bar.
			yPoint += barOffset - 0.5*(footprint);
			if (seriesId > 0 && barLayout !== 'stacked'){
				yPoint -= 0.5*strokeWidth;
			}
		}
		else {
			xPoint = (xValue*canvasWidth) + node.position[0];
			yPoint = canvasY + node.position[1] - 0.5*(borderWidth+strokeWidth);

			// Adjust the positioning of the bar if there are multiple series
			// and center the width of the bar wrt the data point.
			xPoint += barOffset - 0.5*(footprint);
			if (seriesId > 0 && barLayout !== 'stacked'){
				xPoint += 0.5*strokeWidth;
			}
		}
		return {'x': xPoint, 'y': yPoint};
	};

	/**
	 * @exports BarSeriesLayer as aperture.chart.BarSeriesLayer
	 */
	var BarSeriesLayer = aperture.BarLayer.extend( 'aperture.chart.BarSeriesLayer',
	/** @lends BarSeriesLayer# */
	{
		/**
		 * @augments aperture.BarLayer
		 * 
		 * @class A layer that takes a list of data points and plots a bar chart. This layer
		 * is capable of handling data with multiple series, as well as producing stacked bar charts.
		 * For plotting simpler bar visuals, refer to {@link aperture.BarLayer}

		 * @mapping {Number} point-count
		 *   The number of points in a given bar chart data series.
		 * 
		 * @mapping {String='vertical'} orientation
		 *   Sets the orientation of the chart. Vertically oriented charts will have bars that expand along the y-axis,
		 *   while horizontally oriented charts will have bars expanding along the x-axis. By default, this property
		 *   is set to 'vertical'.
		 *  
		 * @mapping {Number} width
		 *   Sets the width of each bar in the chart (i.e. the bar's thickness). If no mapping for this attribute is
		 *   provided, the width of the bars will be automatically calculated. For charts with a
		 *   horizontal orientation, the width is measured along the y-axis. Similarly, for vertically
		 *   oriented charts, the width is measured along the x-axis.
		 * 
		 * @mapping {Number} length
		 *   Mapping for determining the length of each bar in the chart. For charts with a horizontal
		 *   orientation, the length is measured along the x-axis. Similarly, for vertically oriented
		 *   charts, the length is measured along the y-axis.
		 * 
		 * @mapping {'clustered'|'stacked'} bar-layout
		 *   Determines how the bar series of the chart are positioned, either 
		 *   adjacent or stacked on top of each other.
		 * 
		 * @mapping {Number=0} spacer
		 *   Sets the space between bars from different bands<br>
		 *   i.e. the gap between the last bar of Band#0 and the first bar of Band#1.
		 * 
		 * @mapping {String} fill
		 *   Sets the fill colour of the bar.<br>

		 * @constructs
		 * @factoryMade
		 */
		init : function(spec, mappings){
			aperture.BarLayer.prototype.init.call(this, spec, mappings);

			this.DEFAULT_BAR_LAYOUT = 'clustered';
		},

		canvasType : aperture.canvas.VECTOR_CANVAS,

		render : function(changeSet) {
			this.updateLayer(this.applyLayout(changeSet.updates), changeSet.transition);
		}
		
	});
	
	
	/**
	 * Overrides the layout methods of BarLayer. This method provides logic
	 * for handling multiples series as well as stacked bar charts.
	 */
	BarSeriesLayer.prototype.applyLayout = function(dataObjects){
		
		var seriesId= -1;
		var masterBarWidth = 0,
			barOffset = 0;

		var seriesSpec = [],
			barSpecs;
		
		var totalBarLength = {};

		aperture.util.forEach( dataObjects, function (node) {
			seriesId++;
			barSpecs = [];
			if (!node.userData.bars){
				node.userData.bars = {};
			}

			var barSeriesData = node.data;
			if (barSeriesData.length != 0) {

				// If the barchart style is stacked, we can treat this chart as if it
				// only contained a single series.
				var barLayout = this.valueFor('bar-layout', barSeriesData, this.DEFAULT_BAR_LAYOUT);
	
				// FIX: this count is incorrect if added in multiple steps.
				var seriesCount = barLayout === 'stacked'?1:dataObjects.length;
	
				var strokeWidth = this.valueFor('stroke-width', barSeriesData, 1);
	
				var w = node.width;
				var h = node.height;
	
				// For calculating the x-axis scale, we need to take into account
				// how many series are being plotted.
				// For multiple series, the bars of subsequent series are placed
				// adjacent to each other. This needs to be accounted for in the
				// x-axis scale, otherwise they will get clipped and not visible.
				var orientation = this.valueFor('orientation', barSeriesData, 'vertical');
				var numPoints = this.valueFor('point-count', barSeriesData, 0);
				var borderWidth = this.valueFor('border-width', barSeriesData, 0);
				if (numPoints > 0) {
					// If no bar width is provided, calculate one based on the
					// the number of points.
					if (!masterBarWidth) {
						masterBarWidth = getBarWidth.call(this, node, w, h, seriesCount);
					}
	
					// Calculate the total effective footprint of all the bars in a given band.
					var footprint = (seriesCount*masterBarWidth) + (seriesCount-1)*(strokeWidth);
					// Now shift each bar an appropriate distance such that all the bars for a
					// given band are (as a group) centered on the band's midpoint.
					// If the bar is stacked, we treat it as if it was a chart with only
					// 1 series.
					var seriesIndex = barLayout==='stacked'?0:seriesId;
					barOffset = seriesIndex*(masterBarWidth + strokeWidth);
				}

				for (index=0; index< numPoints; index++){
					var xValue = this.valueFor('x', barSeriesData,0,index),
						yValue = this.valueFor('y', barSeriesData,0,index);

					var renderBarDim = getBarRenderSize.call(this, orientation, xValue,
							yValue, w, h, masterBarWidth, borderWidth);
	
					var position = getBarPosition.call(this, seriesId, index, w, h, barOffset,
							footprint, node),
						xPoint = position.x,
						yPoint = position.y;

					// If we are dealing with stacked bars, we need to account for the length of the previous
					// bar for a given bin.
					if (barLayout === 'stacked'){
						var lOffset = 0;
						if (!totalBarLength ){
							totalBarLength  = {};
						}
						if (!totalBarLength[index]){
							totalBarLength[index] = 0;
							totalBarLength[index] = orientation === 'vertical'?-renderBarDim.height:renderBarDim.width;
						}
						else {
							lOffset = totalBarLength[index];
							totalBarLength[index] += orientation === 'vertical'?-renderBarDim.height:renderBarDim.width;
						}
						if (orientation === 'vertical') {
							yPoint += lOffset;
						} else {
							xPoint += lOffset;
						}
					}
					
					var barSpec = {
						node : node,
						x : xPoint,
						y : yPoint,
						size : renderBarDim,
						strokeWidth : strokeWidth,
						orientation : orientation
					};
					barSpecs.push(barSpec);
				}
				seriesSpec.push(barSpecs);
			}
		}, this);
		return seriesSpec; 
	};
	
	namespace.BarSeriesLayer = BarSeriesLayer;
	return namespace;
	
}(aperture.chart || {}));
/**
 * Source: ChartLayer.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Chart Layer
 */

/**
 * @namespace
 * The chart visualization package. If not used, the chart package may be excluded.
 */
aperture.chart = (
function(namespace) {

	var palette = aperture.palette.color,
		updatePlotVisual = function(node){
		var fill = this.valueFor('background-color', node.data, '#fff');
		var borderStroke = this.valueFor('border-stroke', node.data, palette('border'));
		var borderWidth = this.valueFor('border-width', node.data, 1);
		var opacity = this.valueFor('opacity', node.data, 1);
		var plotWidth = node.userData.plotBounds.width;
		var plotHeight = node.userData.plotBounds.height;
		var borderXPos = node.userData.plotBounds.position[0];
		var borderYPos = node.userData.plotBounds.position[1];
		// Subtract the width of the border to get the
		// actual dimensions of the chart.
		var chartWidth = plotWidth - borderWidth;
		var chartHeight = plotHeight - borderWidth;
		var chart = node.userData.plotVisual;
		if (!chart){
			chart = node.graphics.rect(borderXPos,
				borderYPos,
				chartWidth,
				chartHeight);
			node.userData.plotVisual = chart;
		}
		chart.attr({'stroke':borderWidth?borderStroke:null,
				'stroke-width':borderWidth,
				'opacity':opacity,
				'x': borderXPos,
				'y': borderYPos,
				'fill':fill, //Fill can't be a null value otherwise the chart will not be pannable.
				'width':chartWidth,
				'height':chartHeight});
		chart.data('width', chartWidth);
	},

	calculateChartSpecs = function(node){
		var chart = node.userData.chart;
		var innerCanvas = node.userData.chart.innerCanvas = {};

		var titleSpec = this.valueFor('title-spec', node.data, null);

		// Check if any axes margins have been specified.
		var yMargin = this.valueFor('y-margin', node.data, 0),
			xMargin = this.valueFor('x-margin', node.data, 0);

		if (!yMargin && this.axisArray.y[0]){
			yMargin = this.axisArray.y[0].valueFor('margin', node.data, 0);
		}
		if (!xMargin && this.axisArray.x[0]){
			xMargin = this.axisArray.x[0].valueFor('margin', node.data, 0);
		}

		// Get the size of the title margin, if any. There are 2 scenarios to consider:
		// 1. If a title has been specified, use the associated title margin value.
		// If none has been provided, use the minimum default title margin value.
		// 2. If the y-axis is visible, we want to make sure there is a little space
		// reserved for the topmost tick label to bleed into. Since the labels are typically
		// aligned with the centre of a tick mark, if the topmost tick falls inline with the
		// top of the chart border, then the top half of the accompanying label will actually
		// be positioned above the chart. We leave a little space so that the top of the label
		// doesn't get clipped.
		var yVisible = this.axisArray.y[0] && this.axisArray.y[0].valueFor('visible', null, false);
		var	titleMargin = (titleSpec && this.valueFor('title-margin', node.data, this.MIN_TITLE_MARGIN))
			|| (yVisible && yMargin && this.MIN_TITLE_MARGIN)||0;

		// If the axis layer is not visible AND no axis margin has been
		// allocated, we can shortcut the rest of the chart dimension
		// calculations.
		if (yMargin === 0 && xMargin === 0){
			node.userData.plotBounds = {width:chart.width,
				height:chart.height-titleMargin,
				position:[chart.position[0], chart.position[1]+titleMargin]};

			innerCanvas.width = chart.width;
			innerCanvas.height = chart.height-titleMargin;
			innerCanvas.position = [chart.position[0], chart.position[1]+titleMargin];
			return;
		}

		var borderWidth = chart.width-yMargin;
		var borderHeight = chart.height-xMargin-titleMargin;
		var borderXPos = yMargin + chart.position[0];
		var borderYPos = titleMargin + chart.position[1];

		node.userData.plotBounds = {width:borderWidth, height:borderHeight,
				position:[borderXPos, borderYPos]};

		innerCanvas.width = borderWidth;
		innerCanvas.height = borderHeight;
		innerCanvas.position = [borderXPos, borderYPos];
	},

	//TODO: Expose this with a getter like how the axes logic has been done.
	configureTitle = function(node){
		var titleSpec = this.valueFor('title-spec', node.data, null);
		if (titleSpec){
			// Check to see if we have a text layer for the title, if not
			// we'll lazily create it.
			if (!this.titleLayer){
				this.titleLayer = this.addLayer(aperture.LabelLayer);
				this.titleLayer.map('text-anchor').asValue('middle');
				this.titleLayer.map('x').from('x').only().using(this.DEFAULT_RANGE.mapKey([0,1]));
				this.titleLayer.map('y').from('y').only().using(this.DEFAULT_RANGE.mapKey([1,0]));
				this.titleLayer.map('text').from('text');
				this.titleLayer.map('text-anchor-y').asValue('top');
				this.titleLayer.map('orientation').asValue(null);

				// Setup optional font attribute mappings. Default values are provided
				// if no explicit value is provided.
				this.titleLayer.map('font-family').asValue(titleSpec['font-family']||null);
				this.titleLayer.map('font-size').asValue(titleSpec['font-size']||null);
				this.titleLayer.map('font-weight').asValue(titleSpec['font-weight']||null);
			}
			this.titleLayer.all({'x':0.5, 'y':1,'text': titleSpec.text});
		}
	},

	configureAxes = function(){
		var hasAxis = false;

		aperture.util.forEach(this.axisArray.x, function(xAxisLayer){
			if (xAxisLayer.valueFor('visible') == true){
				// Makes sure a data object has been supplied since
				// the user may have created an axis through the getter
				// and not assigned a data source.
				var mapKeyX = this.mappings().x.transformation;
				var rangeX = mapKeyX.from();
				if (xAxisLayer == this.axisArray.x[0] || !xAxisLayer.hasLocalData) {
					xAxisLayer.all(mapKeyX);
				}

				if (rangeX.typeOf(/banded/)){
					xAxisLayer.map('x').from('ticks[].min');
				}
				else {
					xAxisLayer.map('x').from('ticks[]');
				}

				// Make sure that the value for the margin of the primary axis and
				// the value allocated by the chart match.
				var chartMargin = this.valueFor('x-margin', null, 0);
				var axisMargin = this.axisArray.x[0].valueFor('margin', null, 0);
				if (axisMargin != chartMargin){
					this.map('x-margin').asValue(axisMargin);
				}
			}
		}, this);

		// Check if the y-axis is enabled.
		aperture.util.forEach(this.axisArray.y, function(yAxisLayer){
			if (yAxisLayer.valueFor('visible') == true){
				// Set the y-range object as the data source for the y axislayer.
				var mapKeyY = this.mappings().y.transformation;
				var rangeY = mapKeyY.from();
				if (yAxisLayer == this.axisArray.y[0] || !yAxisLayer.hasLocalData) {
					yAxisLayer.all(mapKeyY);
				}

				if (rangeY.typeOf(/banded/)){
					yAxisLayer.map('y').from('ticks[].min');
				}
				else {
					yAxisLayer.map('y').from('ticks[]');
				}

				// Make sure that the value for the margin of the primary axis and
				// the value allocated by the chart match.
				var chartMargin = this.valueFor('y-margin', null, 0);
				var axisMargin = this.axisArray.y[0].valueFor('margin', null, 0);
				if (axisMargin != chartMargin){
					this.map('y-margin').asValue(axisMargin);
				}
			}
		},this);
	},

	//TODO: Add min-ticklength for other examples.
	isManagedChild = function( layer ) {
		switch (layer) {
		case this.axisArray.x[0]:
		case this.axisArray.y[0]:
		case this.titleLayer:
			return true;
		}
		return false;
	},

	// validate and apply a change to the center.
	doCenter = function( c ) {
		if ( c == null) {
			return this.center;
		}

		c = Math.max(0.5 / this.zoomValue, Math.min(1 - 0.5 / this.zoomValue, c));
		if (this.center != c) {
			this.center = c;
			return true;
		}
	};


	/**
	 * @exports ChartLayer as aperture.chart.ChartLayer
	 */
	var ChartLayer = aperture.PlotLayer.extend( 'aperture.chart.ChartLayer',
	/** @lends ChartLayer# */
	{
		/**
		 * @augments aperture.PlotLayer
		 * 
		 * @class The underlying base layer for charts. Type-specific
		 * charts are created by adding child layers (e.g. {@link aperture.chart.LineSeriesLayer LineSeriesLayer},
		 * {@link aperture.chart.BarSeriesLayer BarSeriesLayer}) to this layer. Axes and "rules" / grid lines
		 * can be constructed and configured using the {@link #xAxis xAxis}, {@link #yAxis yAxis}
		 * and {@link #ruleLayer ruleLayer} methods.
		 *
		 * @mapping {Number} width
		 *   The width of the chart.
		 *   
		 * @mapping {Number} height
		 *   The height of the chart.
		 *   
		 * @mapping {String} stroke
		 *   The line colour used to plot the graph.
		 * 
		 * @mapping {Number=1} stroke-width
		 *   The width of the line used to plot the graph.
		 *   
		 * @mapping {Number=1} border-width 
		 *   The width of the border (if any) around the chart. Setting this value to zero will hide the
		 *   chart borders.
		 *   
		 * @mapping {String='border'} border-stroke
		 *   The line colour used to draw the chart border.
		 * 
		 * @mapping {'vertical', 'horizontal'} orientation
		 *   The direction that data points are plotted.
		 *   E.g. A bar chart with a <span class="fixedFont">'vertical'</span> orientation will have bars drawn top-down.
		 *   A bar chart with a <span class="fixedFont">'horizontal'</span> orientation will have bars drawn left-right
		 *   
		 * @mapping {Number} title-margin 
		 *   The vertical space allocated to the chart title (in pixels).
		 *   
		 * @mapping {Object} title-spec 
		 *   Defines the attributes of the chart's main title. For example:<br>
		 *<pre>{
		 *   text: 'Main Chart Title',
		 *   font-family: 'Arial',
		 *   font-size: 25
		 *}</pre></br>
		 *
		 * @constructs
		 * @factoryMade
		 */
		init : function(spec, mappings) {
			aperture.PlotLayer.prototype.init.call(this, spec, mappings);
			this.specData = spec.data;
			this.DEFAULT_XMARGIN = 40;
			this.DEFAULT_YMARGIN = 50;
			this.DEFAULT_RANGE = new aperture.Scalar('default_range', [0,1]);
			this.DEFAULT_BANDS = 5;
			this.MIN_TITLE_MARGIN = 10;
			// Default values.
			this.map('border-width').asValue(1);
			this.map('border-stroke').asValue(palette('border'));
			this.map('orientation').asValue('vertical');
			this.axisArray = {'x':[], 'y':[]};
		},

		canvasType : aperture.canvas.VECTOR_CANVAS,

		render : function(changeSet) {
			// process the changed components.
			var toProcess = changeSet.updates;

			var that = this;

			if (toProcess.length > 0){
				var i;
				for (i=0; i < toProcess.length; i++){
					node = toProcess[i];

					// Cache the true canvas dimensions.
					node.userData.chart = {};
					this.width = node.userData.chart.width = this.valueFor('width', node.data, node.width);
					this.height = node.userData.chart.height = this.valueFor('height', node.data, node.height);
					node.userData.chart.position = node.position;

					calculateChartSpecs.call(this,node);
					updatePlotVisual.call(this, node);
					configureTitle.call(this,node);
				}
				configureAxes.apply(this);
			}

			// Iterate through all the children and render them.
			aperture.PlotLayer.prototype.render.call(this, changeSet);

		},

		renderChild : function(layer, changeSet) {
			// Before we create any child layers, we want to apply any chart
			// margins and axes compensations to the chart width/height.

			// If the range is banded, we need to shift the data points
			// so that they fall between the tick marks.
			// Tick marks for ordinal ranges indicate the bounds of a band.
			aperture.util.forEach( changeSet.updates, function (node) {
				var parentData = node.parent.userData.chart.innerCanvas;
				// Get the width of the border around the chart, if any.
				var borderWidth = this.valueFor('border-width', node.data, 1);
				node.width = parentData.width;
				node.height = parentData.height;
				node.position = [parentData.position[0], parentData.position[1]];

				// If this is the title layer we want to change the anchor point.
				if (layer === this.titleLayer){
					node.position = [parentData.position[0], node.parent.position[1]];
				}

				// If the range is banded, we may need to apply a shift the starting position
				// of any sub layers.
				// This is only for layers that are not an axis layer or rule layer.
				else if (!isManagedChild.call(this, layer)){
					node.position = [node.position[0], node.position[1]];

					var orientation = this.valueFor('orientation', node.data, 'vertical');
					if (orientation == 'horizontal'){
						var mapKeyY = this.mappings().y.transformation;
						var rangeY = mapKeyY.from();
						if (rangeY.typeOf(aperture.Ordinal)){
							var bandHeight = (node.height)/(rangeY.get().length);
							// Visuals are rendered top-down (i.e. (0,0) is in the upper-left
							// corner of the canvas) so we need to subtract half the band height
							// from the y-position so that our bars begin drawing from the
							// midpoint between tick marks.
							node.position = [node.position[0], node.position[1]-(0.5*bandHeight)];
						}
					}

					else {
						// If the range is ordinal or banded, we need to shift all the data
						// points by half the width of a band. Tick marks indicate the bounds between
						// bands, but we want the data point to be centered within the band, so to
						// compensate we use this offset.
						var mapKeyX = this.mappings().x.transformation;
						var rangeX = mapKeyX.from();
						// If this is banded, we need to check if this band
						// was derived from a scalar range, we only want to do
						// this shift for bands derived from an ordinal range.
						if (rangeX.typeOf(aperture.Ordinal)){
							var bandWidth = (node.width)/rangeX.get().length;
							node.position = [node.position[0] + (0.5*bandWidth), node.position[1]];
						}
					}

					// Set the clip region.
					node.graphics.clip(this.valueFor('clipped', node.data, true)?
							[parentData.position[0], parentData.position[1],
							parentData.width, parentData.height] : null);
				}
			}, this);
			
			
			layer.render( changeSet );
		},

		/**
		 * This method retrieves the {@link aperture.chart.RuleLayer} with the given index.
		 * @param {Number} index
		 *  the index of the RuleLayer to retrieve. If no index is provided, a list of all 
		 *  RuleLayers is returned. 
		 *
		 * @returns {aperture.chart.RuleLayer|Array}
		 *  the RuleLayer for the given index. If no order is specified, a list of all RuleLayer is returned.
		 * @function
		 */		
		ruleLayer : function(index) {
			var ruleLayers = this.ruleLayers || [];
			if (index == undefined) {
				return ruleLayers;
			}
			else if (index == null) {
				index = 0;
			}
			var layer = ruleLayers[index];
			
			if (!layer) {
				layer = ruleLayers[index] = this.addLayer(aperture.chart.RuleLayer);
				// Since we only allow panning along the x-axis, we only want to allow 
				// rule layers for the x-axis to pan.
				var that = this;
				layer.map('rule').filter(function( value ){
						if (layer.valueFor('axis', this, null) == 'x'){
							return that.panfilter(value);
						}
						else {
							return value;
						}
					}
				);
				
				this.ruleLayers = ruleLayers;
				layer.toBack(); // Send the rule layer to the back.
			}
			return layer;
		},
		
		/**
		 * This method retrieves the {@link aperture.chart.AxisLayer} of the given order for the X axis.
		 * 
		 * @param {Number} [order] 
		 *  the order of the axis to be retrieved (e.g. the primary axis would be order=0), or
		 *  -1 to retrieve an array of all axes. If no order is provided, the primary axis is returned. 
		 *
		 * @returns {aperture.chart.AxisLayer|Array}
		 *  the AxisLayer for the given order, or a list of all X AxisLayers.
		 */		
		xAxis : function (order) {
			if (order === -1) {
				return this.axisArray.x;
			} else if (!order || order > 1) {
				// Currently, charts only support secondary axes.
				order = 0;
			}
			
			var axisLayer = this.axisArray.x[order];
			if (!axisLayer){
				axisLayer = this.addLayer( aperture.chart.AxisLayer );
				axisLayer.map('visible').asValue(true);
				axisLayer.map('axis').asValue('x');
				this.axisArray.x[order] = axisLayer;
			}
			return axisLayer;
		},
		
		/**
		 * This method retrieves the {@link aperture.chart.AxisLayer} of the given order for the Y axis.
		 * 
		 * @param {Number} [order] 
		 *  the order of the axis to be retrieved (e.g. the primary axis would be order=0), or
		 *  -1 to retrieve an array of all axes. If no order is provided, the primary axis is returned. 
		 *
		 * @returns {aperture.chart.AxisLayer|Array}
		 *  the AxisLayer for the given order, or a list of all Y axis AxisLayers.
		 */		
		yAxis : function (order) {
			if (order === -1) {
				return this.axisArray.y;
			} else if (!order || order > 1) {
				// Currently, charts only support secondary axes.
				order = 0;
			}

			var axisLayer = this.axisArray.y[order];
			if (!axisLayer){
				axisLayer = this.addLayer( aperture.chart.AxisLayer );
				axisLayer.map('visible').asValue(true);
				axisLayer.map('axis').asValue('y');
				this.axisArray.y[order] = axisLayer;
				// We don't want the y-AxisLayer to pan horizontally
				// so we use the only() method to prevent it from
				// inheriting any x-mappings from its parent.
				var mapX = this.mappings().x;
				if (mapX){
					var mapKeyX = mapX.transformation;
					this.axisArray.y[order].map('x').only().using(mapKeyX);
				}
			}
			return axisLayer;
		}
	});

	namespace.ChartLayer = ChartLayer;

	/**
	 * @class Chart is a {@link aperture.chart.ChartLayer ChartLayer} vizlet, suitable for adding to the DOM.
	 * See the layer class for a list of supported mappings.
	 * 
	 * @augments aperture.chart.ChartLayer
	 * @name aperture.chart.Chart
	 *
	 * @constructor
	 * @param {Object|String|Element} spec
	 *  A specification object detailing how the vizlet should be constructed or
	 *  a string specifying the id of the DOM element container for the vizlet or
	 *  a DOM element itself.
	 * @param {String|Element} spec.id
	 *  If the spec parameter is an object, a string specifying the id of the DOM
	 *  element container for the vizlet or a DOM element itself.
	 *
	 * @see aperture.chart.ChartLayer
	 */
	namespace.Chart = aperture.vizlet.make( ChartLayer, function(spec){
		// Default values for zooming and panning logic.
		this.zoomValue = 1;
		this.center = 0.5;
		this.panning = false;
		this.startCenter = {};

		// set up the drag handler that applies the panning.
		this.on('drag', function(event) {
			switch (event.eventType) {
			case 'dragstart':
				this.startCenter = this.center;
				this.panning = false;
				break;

			case 'drag':
				// don't start unless movement is significant.
				this.panning = this.panning || Math.abs(event.dx) > 3;

				if (this.panning) {
					this.zoomTo(this.startCenter - event.dx / this.width / this.zoomValue );
				}
				break;
			}
			return true;
		});

		// the x filter function - applies a final transform on the x mapping based on pan/zoom
		var that = this;
		this.panfilter = function(value) {
			return (value - that.center) * that.zoomValue + 0.5;
		};

		// Support panning along the x-axis.
		this.map('x').filter(this.panfilter);
		this.updateAxes = function(center){
			var bandCount = this.width / 100;
			// update bands
			if (this.axisArray.x[0]){
				var mapKeyX = this.mappings().x.transformation;
				var rangeX = mapKeyX.from();
				// Reband the range to reflect the desired zoom level.
				var bandedX = rangeX.banded(bandCount*this.zoomValue);
				mapKeyX = bandedX.mapKey([0,1]);
				this.map('x').using(mapKeyX);
				this.xAxis(0).all(mapKeyX);
				// Update the rule layers of the x-axis, if any.
				aperture.util.forEach(this.ruleLayer(), function(layer){
					if (layer.valueFor('axis')==='x'){
						layer.all(bandedX.get());
						layer.map('rule').using(mapKeyX);
					}
				});
			}

			// TODO: Does secondary axis logic belong here?
			if (this.axisArray.x[1]){
				var nextOrder = bandedX.formatter().nextOrder();
				if (nextOrder){
					var secBandedX = bandedX.banded({
						'span' : 1,
						'units' : nextOrder
					});
					this.xAxis(1).all(secBandedX.mapKey([0,1]));
				}
				// If the next time order is undefined, hide the secondary axis.
				this.xAxis(1).map('visible').asValue(!!nextOrder);
			}
		};

		// EXPOSE A ZOOM FUNCTION
		// apply a zoom, revalidating center as necessary, and update
		this.zoomTo = function(x, y, z) {
			var changed;

			z = Math.max(z || this.zoomValue, 1);

			if (this.zoomValue != z) {
				this.zoomValue = z;
				changed = true;

				// update bands
				this.updateAxes();
			}
			if (doCenter.call(this, x ) || changed) {
				this.trigger('zoom', {
					eventType : 'zoom',
					layer : this
				});
				this.updateAxes(x);
				this.all().redraw(); // todo: not everything.
			}
		};

		// expose getter, and setter of zoom only.
		this.zoom = function(z) {
			if ( z == null ) {
				return {
					zoom : this.zoomValue,
					x : this.center,
					y : 0.5
				};
			}
			this.zoomTo(this.center, null, z);
		};
	} );



	return namespace;

}(aperture.chart || {}));/**
 * Source: LineSeriesLayer.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture LineSeriesLayer Layer
 */

/**
 * @namespace
 * The chart visualization package. If not used, the chart package may be excluded.
 */
aperture.chart = (
/** @private */
function(namespace) {
	/**
	 * @private
	 * converts a stroke style to an svg dash pattern.
	 */
	function strokeStyleToDash(strokeStyle) {
		// Determine dash array
		switch (strokeStyle) {
		case 'dashed':
			return '- ';
		case 'dotted':
			return '. ';
		case 'none':
			return null;
		case '':
		case 'solid':
			return '';
		}
		return strokeStyle;
	}
	
	/**
	 * @private
	 * Tokenize the data points into line path segments, using
	 * changes in line style as the delimiter. For a series with
	 * a homogeneous line style, there will only be one token.
	 * @param {Array} pointList An array of js objects describing the points of this line chart.
	 * @returns An array of path segments.
	 */
	var tokenizeSeries = function(pointList){
		var pathSegments = [];

		var pathStartPos = 0;
		var lastStrokeStyle = strokeStyleToDash(this.valueFor('stroke-style', pointList, 'solid', 0));
		var lastStroke = this.valueFor('stroke', pointList,'#000000', 0);

		// The style of each segment is defined by the rightmost
		// point. We assume the points in a given series are sorted.
		var numPoints = this.valueFor('point-count', pointList, 1, 0);
		if (numPoints<2){
			return pathSegments;
		}
		var segmentPoints = [{x: this.valueFor('x', pointList, 0, 0),
			y: this.valueFor('y', pointList, 0, 0)}],
			i;

		// We want to collect all points that share the same color and stroke style
		// and render them together as a single path.
		for (i=1; i < numPoints; i++) {
			// Get the stroke style and color of this line segment.
			var strokeStyle = strokeStyleToDash(this.valueFor('stroke-style', pointList, 'solid', i));
			var lineStroke = this.valueFor('stroke', pointList, '#000000', i);

			var hasSegmentChange = (strokeStyle !== lastStrokeStyle)||(lineStroke !== lastStroke);

			var hasMorePoints = i < numPoints - 1;
			// Check to see if the x-value is ordinal.
			var xPoint = this.valueFor('x', pointList, 0, i);
			var yPoint = this.valueFor('y', pointList, 0, i);

			segmentPoints.push({x: xPoint, y: yPoint});
			// If the point is part of the same line segment, continue
			// collecting the points.
			if (!hasSegmentChange && hasMorePoints) {
				continue;
			}
			pathSegments.push({'points' : segmentPoints, 'stroke-style' : lastStrokeStyle, 'stroke' : lastStroke});
			segmentPoints = [{x: xPoint, y: yPoint}];
			pathStartPos = i - 1;
			lastStrokeStyle = strokeStyle;
			lastStroke = lineStroke;
		}

		return pathSegments;
	},

	/**
	 * @private
	 * Construct a SVG path from the specified data points.
	 * @param {Array} pathSpec An array of js objects that describe the path segments
	 * (i.e. tokenized points) of this line series.
	 */
	constructPath = function(pathSpec){
		var path, point, xPoint, yPoint, i,
			chartPosition = pathSpec.node.position;
		for (i=0; i < pathSpec.points.length; i++){
			point = pathSpec.points[i];
			xPoint = (point.x * pathSpec.node.width)
				+ (chartPosition[0]||0);
			yPoint = (point.y * pathSpec.node.height)
				+ (chartPosition[1]||0);

			if (i==0){
				path = "M" + xPoint + "," + yPoint;
			}
			path += "L" + xPoint + "," + yPoint;
		}
		return path;
	};

	/**
	 * @exports LineSeriesLayer as aperture.chart.LineSeriesLayer
	 */
	var LineSeriesLayer = aperture.Layer.extend( 'aperture.chart.LineSeriesLayer',
	/** @lends LineSeriesLayer# */
	{
		/**
		 * @augments aperture.Layer
		 * 
		 * @class A layer that takes sets of points and graphs a line for each.
		 * 
		 * @mapping {Number=1} point-count
		 *   The number of points in a line series. 
		 *   
		 * @mapping {String} stroke
		 *   Color of a line series.
		 *   
		 * @mapping {Number=1} stroke-width
		 *  The width of a line series.
		 * 
		 * @mapping {'solid'|'dotted'|'dashed'|'none'| String} stroke-style
		 *  The line style as a predefined option or custom dot/dash/space pattern such as '--.-- '.
		 *  A 'none' value will result in the line not being drawn.
		 * 
		 * @mapping {Number=1} opacity
		 *  The opacity of a line series. Values for opacity are bound with the range [0,1], with 1 being opaque.
		 * 
		 * @constructs
		 * @factoryMade
		 */
		init : function(spec, mappings){
			aperture.Layer.prototype.init.call(this, spec, mappings);
		},

		canvasType : aperture.canvas.VECTOR_CANVAS,

		render : function(changeSet) {

			// Create a list of all additions and changes.
			var i, toProcess = changeSet.updates;
			for (i=toProcess.length-1; i >= 0; i--){
				var node = toProcess[i];

				// Make sure we have a proper canvas node.
				if (node.data.length == 0) {
					continue;
				}
				if (!node.userData.pathSegments) {
					node.userData.pathSegments = [];
				}

				// Get the visual properties of the chart.
				var strokeWidth = this.valueFor('stroke-width', node.data, 1);
				var strokeOpacity = this.valueFor('opacity', node.data, 1);

				// Tokenize the series into line segments.
				var lines = this.valueFor('lines', node.data, null);
				var pathSegments = [], lineNo, segNo;
				if (lines) {
					for (lineNo=0; lineNo<lines.length; lineNo++) {
						var newSegs = tokenizeSeries.call(this, lines[lineNo]);
						for (segNo=0;segNo<newSegs.length;segNo++) {
							pathSegments.push(newSegs[segNo]);
						}
					}
				} else {
					pathSegments = tokenizeSeries.call(this, node.data);
				}


				var path, pathSpec, segmentInfo, strokeStyle,
					points, point, index, segment, 
					oldn = node.userData.pathSegments.length, n = pathSegments.length;

				// Remove any extra previously rendered segments
				if ( oldn > n ) {
					node.graphics.removeAll(node.userData.pathSegments.splice(n, oldn-n));
				}
				
				// Iterate through the current segments and update or re-render.
				for (index=0; index < n; index++){
					segmentInfo = pathSegments[index];
					points = segmentInfo.points;
					pathSpec = {
							points:points,
							node:node
					};

					// Construct the SVG path for this line segment.
					path = constructPath.call(this, pathSpec);

					segment = node.userData.pathSegments[index];

					// Determine dash array
					strokeStyle = segmentInfo['stroke-style'];

					if (strokeStyle === null) {
						strokeStyle = '';
						strokeOpacity = 0;
					}

					var attrSet = {
							'stroke':segmentInfo.stroke,
							'stroke-width':strokeWidth,
							'stroke-linejoin': 'round',
							'stroke-dasharray':strokeStyle,
							'stroke-opacity':strokeOpacity};							
					
					// If this path has already exists, we don't need to render
					// it again. We just need to check if it's visual properties
					// have changed.
					var hasDataChange = true;
					if (segment){
						var prevPath = segment.attr('path').toString();
						if (path === prevPath){
							// No data change, update attributes and continue
							if (segment.attr('stroke') != segmentInfo.stroke){
								attrSet['stroke'] = segmentInfo.stroke;
							}
							if (segment.attr('stroke-width') != strokeWidth){
								attrSet['stroke-width'] = strokeWidth;
							}
							if (segment.attr('stroke-dasharray') != strokeStyle){
								attrSet['stroke-dasharray'] = strokeStyle;
							}
							if (segment.attr('stroke-opacity') != strokeOpacity){
								attrSet['stroke-opacity'] = strokeOpacity;
							}
							hasDataChange = false;
						} else {
							// Data has changed, update the line's path.
							attrSet['path'] = path;
						}
					}

					else {
						// Create a visual for the new path segment.
						segment = node.graphics.path(path);
					}
					// Apply attributes to the segment.
					node.graphics.update(segment, 
							attrSet, 
							changeSet.transition);
					// If the data has changed, update the
					// corresponding references.
					if (hasDataChange){
						node.graphics.data( segment, node.data );

						// Store the visuals associated with this node.
						node.userData.pathSegments[index] = segment;
					}
				}
			}
		}
	});
	namespace.LineSeriesLayer = LineSeriesLayer;

	return namespace;
}(aperture.chart || {}));
/**
 * Source: RuleLayer.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Rule Layer
 */

/**
 * @namespace
 * The chart visualization package. If not used, the chart package may be excluded.
 */
aperture.chart = (
/** @private */
function(namespace) {

	var palette = aperture.palette.color;
	
	/**
	 * @private
	 * Renders a single horizontal or vertical rule.
	 * @param {Object} node
	 */
	var createRule = function(node){
		if (!(node)) {
			return;
		}

		var borderWidth = this.valueFor('border-width', node.data, 0);
		var opacity = this.valueFor('opacity', node.data, 1);

		var axis = this.valueFor('axis', node.data, 'x');
		var value = this.valueFor('rule', node.data, 0);
		
		var lineColor = this.valueFor('stroke', node.data, palette('rule'));
		var lineWidth = this.valueFor('stroke-width', node.data, 1);
		
		// Get the stroke-style, if any, and translate into the corresponding
		// stroke dasharray value.
		var lineStyle = this.valueFor('stroke-style', node.data, '');
		switch (lineStyle) {
		case 'dashed':
			lineStyle = '- ';
			break;
		case 'dotted':
			lineStyle = '. ';
			break;
		case 'none':
			opacity = 0;
		case '':
		case 'solid':
			lineStyle = '';
		}

		var path = '';

		var xPos=0,yPos=0, xOffset=0, yOffset=0;
		var rangeX = this.mappings().x.transformation.from();
		var rangeY = this.mappings().y.transformation.from();
		
		// If this is a banded range, we need to offset the x-position by
		// half the bandwidth.
		if (rangeX.typeOf(aperture.Ordinal)){
			xOffset = 0.5*(node.width/rangeX.get().length);	
		}
		if (rangeY.typeOf(aperture.Ordinal)){
			yOffset = 0.5*(node.height/rangeY.get().length);	
		}
		// Check if the rule line orientation is vertical.
		if (axis === 'x'){
			xPos = (value*node.width) + node.position[0] + xOffset;
			yPos = node.position[1] + yOffset;
			path += 'M' + xPos + ',' + yPos + 'L' + xPos + ',' + (yPos+node.height-borderWidth);
		}
		// Default rule line orientation is horizontal.
		else {

			xPos = node.position[0] - xOffset;
			yPos = (value*node.height) + node.position[1] + yOffset;

			path += 'M' + xPos + ',' + yPos + 'L' + (xPos+node.width-borderWidth) + ',' + yPos;
		}

		//TODO: Add logic for caching rule lines for reuse.
		var line = node.graphics.path(path).attr({
				'fill':null, 
				'stroke':lineColor, 
				'stroke-width':lineWidth,
				'stroke-dasharray':lineStyle,
				'opacity':opacity
			});
		node.userData.rulelines.push(line);
	};

	/**
	 * @exports RuleLayer as aperture.chart.RuleLayer
	 */
	var RuleLayer = aperture.Layer.extend( 'aperture.chart.RuleLayer',
	/** @lends RuleLayer# */
	{
		/**
		 * @augments aperture.Layer
		 * @class A layer that renders horizontal or vertical lines
		 * across a {@link aperture.chart.ChartLayer ChartLayer}. RuleLayers are not added 
		 * to a chart in conventional layer fashion, rather they are instantiated the first time
		 * they are referenced via chart.{@link aperture.chart.ChartLayer#ruleLayer ruleLayer}
		 * 
		 * @mapping {'x'|'y'} axis
		 *   Specifies whether the line is vertically or horizontally aligned.
		 * 
		 * @mapping {Number} rule
		 *   Raw data value to be mapped to a pixel position on the chart.
		 * 
		 * @mapping {Number=1} opacity
		 *   The opacity of the rule line.
		 * 
		 * @mapping {String='rule'} stroke
		 *   The colour used to draw the rule lines.
		 * 
		 * @mapping {Number=1} stroke-width
		 *   The width of the rule line.
		 *   
		 * @mapping {'solid'|'dotted'|'dashed'|'none'| String} stroke-style
		 *  The line style as a predefined option or custom dot/dash/space pattern such as '--.-- '.
		 *  A 'none' value will result in the rule not being drawn.
		 * 
		 * @constructs
		 * @factoryMade
		 */
		init : function(spec, mappings) {
			aperture.Layer.prototype.init.call(this, spec, mappings);
		},

		canvasType : aperture.canvas.VECTOR_CANVAS,

		render : function(changeSet) {
			// Get the changed components.
			aperture.util.forEach( changeSet.updates, function (node) {
				node.graphics.removeAll(node.userData.rulelines);
				node.userData.rulelines = [];
				createRule.call(this, node);
			}, this);
		}
	});

	namespace.RuleLayer = RuleLayer;
	return namespace;
}(aperture.chart || {}));


return aperture;
}(aperture || {}));