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
define([ '../util/ui_util'],
	function( ui_util) {

		var layout = function(widget, w, h, rightPadding) {
			var LEFT_PADDING = 125,
				VERTICAL_PADDING = 25,
				maxColumn = 3,
				currentX = LEFT_PADDING,
				spacingX = (w - (LEFT_PADDING + rightPadding*1.7)) / (maxColumn-1),
				nodesPerColumn = getNodesPerColumn(widget),
				nodeSizeMinMax = aperture.config.get()['xdataht.config']['node-size'],
				LABEL_OFFSET_X = nodeSizeMinMax.max,
				LABEL_OFFSET_Y = 10,
				MIN_Y_SPACING = 11;

			//setup X and Y offset for all nodes
			for (var i = 0; i<maxColumn; i++) {
				var numNodes = nodesPerColumn[i].length,
					spacingY = Math.max((h - (2* VERTICAL_PADDING)) / (numNodes+1), MIN_Y_SPACING),
					startY = VERTICAL_PADDING + ((h - (2* VERTICAL_PADDING)) / (2*numNodes));

				for (var j = 0; j<numNodes; j++) {
					var node = nodesPerColumn[i][j],
						currentY = startY + (spacingY * j);

					node.x = currentX;
					node.y = currentY;
					if (node.size!=undefined) {
						node.radius = (node.size * (nodeSizeMinMax.max - nodeSizeMinMax.min))+nodeSizeMinMax.min;
					} else {
						node.radius = (nodeSizeMinMax.max + nodeSizeMinMax.min)/2;
					}
					node.tag = {
						visible: true,
						anchorX: 'left',
						anchorY: 'bottom',
						offsetX: LABEL_OFFSET_X,
						offsetY: LABEL_OFFSET_Y,
						connect: false,
						connectX: null,
						connectY: null
					};
				}
				currentX += spacingX;
			}
			widget.update();
		};

		var getNodesPerColumn = function(widget){
			var nodesPerColumn = [
					[],
					[],
					[]
				],
				i;

			for (i = 0; i < widget.linkData.nodes.length; i++) {
				var node = widget.linkData.nodes[i];
				node.processed = false;
				if (node.ring === 0) {
					nodesPerColumn[0].push(node);
				}
				if (node.ring === 1) {
					nodesPerColumn[1].push(node);
				}
				if (node.ring === 2) {
					nodesPerColumn[2].push(node);
				}
			}

			if (widget.ATTRIBUTE_MODE) {
				for (i = 0; i < nodesPerColumn.length; i++) {
					var email = [],
						phone = [],
						website = [],
						unbinned = [];
					for (var j = 0; j < nodesPerColumn[i].length; j++) {
						node = nodesPerColumn[i][j];

						if (node.attribute === 'phone') {
							phone.push(node);
						} else if (node.attribute === 'email') {
							email.push(node);
						} else if (node.attribute === 'website') {
							website.push(node);
						} else {
							unbinned.push(node);
						}
					}

					// after binning, we also want each bin to be ordered by cluster size
					$([email, phone, website, unbinned]).each(function () {
							this.sort(function (a, b) {
								return b['Cluster Size'] - a['Cluster Size'];
							});
						}
					);
					nodesPerColumn[i] = email.concat(phone, website, unbinned);
				}
			} else {
				for (i = 0; i < nodesPerColumn.length; i++) {
					nodesPerColumn[i].sort(function(a,b) {
						return b['Cluster Size'] - a['Cluster Size'] ;
					})
				}
			}
			return nodesPerColumn;
		};

		return {
			layout:layout
		}
	}
);