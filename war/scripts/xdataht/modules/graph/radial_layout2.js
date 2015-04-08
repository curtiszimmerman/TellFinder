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
    var MAX_CHILD_ARC = Math.PI/2;
	var LINE_HEIGHT = 15;

	/**
	 * Set tag {offsetX, offsetY, connect} to determine if and how lines
	 * are drawn to connect nodes to labels.
	 */
    var offsetLabels = function(layoutData) {
    	for (var ringNum=0; ringNum<layoutData.rings.length; ringNum++) {
    		var ring = layoutData.rings[ringNum];
    		var h = -1;
    		for (var i=0; i<ring.nodes90.length; i++) {
    			var node = ring.nodes90[i];
    			if (h==-1) {
    				h = node.y + node.tag.offsetY;
    				continue;
    			} else {
    				var nextH = node.y + node.tag.offsetY;
    				if (nextH<h+LINE_HEIGHT) {
    					nextH = h+LINE_HEIGHT;
    					node.tag.offsetY = nextH-node.y;
    					node.tag.connect = true;
    				}
    				h = nextH;
    			}
    		}
    		h = -1;
    		for (var i=ring.nodes180.length-1; i>=0; i--) {
    			var node = ring.nodes180[i];
    			if (h==-1) {
    				h = node.y + node.tag.offsetY;
    				continue;
    			} else {
    				var nextH = node.y + node.tag.offsetY;
    				if (nextH<h+LINE_HEIGHT) {
    					nextH = h+LINE_HEIGHT;
    					node.tag.offsetY = nextH-node.y;
    					node.tag.connect = true;
    				}
    				h = nextH;
    			}
    		}
    		h = -1;
    		for (var i=0; i<ring.nodes270.length; i++) {
    			var node = ring.nodes270[i];
    			if (h==-1) {
    				h = node.y + node.tag.offsetY;
    				continue;
    			} else {
    				var nextH = node.y + node.tag.offsetY;
    				if (nextH>h-LINE_HEIGHT) {
    					nextH = h-LINE_HEIGHT;
    					node.tag.offsetY = nextH-node.y;
    					node.tag.connect = true;
    				}
    				h = nextH;
    			}
    		}
    		h = -1;
    		for (var i=ring.nodes360.length-1; i>=0; i--) {
    			var node = ring.nodes360[i];
    			if (h==-1) {
    				h = node.y + node.tag.offsetY;
    				continue;
    			} else {
    				var nextH = node.y + node.tag.offsetY;
    				if (nextH>h-LINE_HEIGHT) {
    					nextH = h-LINE_HEIGHT;
    					node.tag.offsetY = nextH-node.y;
    					node.tag.connect = true;
    				}
    				h = nextH;
    			}
    		}
    	}
    };
    
    /**
     * Set the node x,y,tag,processed based upon the ring
     */
    var positionRadialNodeAndChildren = function(widget, node, layoutData, centerX, centerY) {
    	if (node.processed) return;
    	node.processed = true;
    	var ring = layoutData.rings[node.ring];
    	ring.count--;

		var angleSpan = node.childCount*ring.anglePerCount;
		ring.endAngle = ring.startAngle + angleSpan;
		ring.angle = (ring.startAngle+ring.endAngle)/2;
    	
		// Position and size the current node at ring.angle
    	var dirX = Math.cos(ring.angle);
    	var dirY = Math.sin(ring.angle);
    	node.x = centerX + dirX*ring.radius;
    	node.y = centerY + dirY*ring.radius;
    	if (node.size!=undefined) {
    		node.radius = (node.size * (layoutData.maxSize - layoutData.minSize))+layoutData.minSize;
    	} else {
    		node.radius = (layoutData.maxSize + layoutData.minSize)/2;
    	}
    	node.tag = {
    			visible: true,
    			anchorX: (node.x>centerX)?'left':'right',
    			anchorY: (node.y>centerY)?'top':'bottom',
    			offsetX: dirX*node.radius,
    			offsetY: dirY*node.radius,
    			connect: false,
    			connectX: dirX*node.radius,
    			connectY: dirY*node.radius
    	}

    	// Store the node in 90/180/270/360 so we can fix the labels later
    	var currentAngle = ring.angle;
    	if (currentAngle<Math.PI/2) ring.nodes90.push(node);
    	else if (currentAngle<Math.PI) ring.nodes180.push(node);
    	else if (currentAngle<3*Math.PI/2) ring.nodes270.push(node);
    	else ring.nodes360.push(node);
    	
    	// Add children
    	var childCount = node.links.length;
    	if (childCount>0) {
    		var innerChildren = [];
    		var outerChildren = [];
    		var childSpanTotal = 0;
    		for (var i=0; i<node.links.length; i++) {
	    		var link = node.links[i];
	            var child = widget.linkData.nodeMap[link.other];
	            if (child.processed) continue;
	            if (child.ring<=node.ring) {
	            	innerChildren.push(child);
	            } else {
	            	outerChildren.push(child);
	            	childSpanTotal += child.childCount;
	            }
	    	}
	    	if (outerChildren.length>0) {
		    	var nextRing = layoutData.rings[node.ring+1];
		    	if (angleSpan<Math.PI/2) {
			    	nextRing.anglePerCount = angleSpan/childSpanTotal;
			    	nextRing.startAngle = ring.startAngle;
		    	} else {
			    	nextRing.anglePerCount = (Math.PI/2)/childSpanTotal;
			    	nextRing.startAngle = ring.startAngle+(angleSpan-Math.PI/2)/2;
		    	}
		    	for (var i=0; i<outerChildren.length; i++) {
		            var child = outerChildren[i];
		    		positionRadialNodeAndChildren(widget, child, layoutData, centerX, centerY);
		    	}
	    	}
    		ring.startAngle = ring.endAngle;
	    	for (var i=0; i<innerChildren.length; i++) {
	            var child = innerChildren[i];
	    		positionRadialNodeAndChildren(widget, child, layoutData, centerX, centerY);
	    	}
    	} else {
    		ring.startAngle = ring.endAngle;
    	}
    };


    /**
     * Calculate a childCount for each node. The base value is 1, next ring counts as 1/2 and outer ring 1/4
     */
    calculateSubnodeCounts = function(widget, node, layoutData) {
    	if (node.processed) return;
    	node.processed = true;
    	node.childCount = 1;

    	var childCount = node.links.length;
    	if (childCount>0) {
    		var outerChildren = [];
	    	for (var i=0; i<node.links.length; i++) {
	    		var link = node.links[i];
	            var child = widget.linkData.nodeMap[link.other];
	            if (child.processed) continue;
	            if (child.ring==(node.ring+1)) {
	            	outerChildren.push(child);
	            }
	    	}
	    	node.childCount = outerChildren.length/2;
	    	if (outerChildren.length>0) {
		    	for (var i=0; i<outerChildren.length; i++) {
		            var child = outerChildren[i];
		            calculateSubnodeCounts(widget, child, layoutData);
		            if (child.childCount>2) node.childCount += (child.childCount-2)/4;
		    	}
	    	}
    	}
    	layoutData.rings[node.ring].maxSubCount += Math.max(layoutData.rings[node.ring].maxSubCount, node.childCount);
    	layoutData.rings[node.ring].fullSubCount += node.childCount;
    	
    };
    
    /** 
	 * Set widget.linkData.nodes[] x,y,tag={visible,anchorX,anchorY,offsetX}
	 */
    var layout = function(widget, w, h) {
    	// For each node: count subnodes, half weight for two removed
    	// Divide ring according to subnode counts, {start angle, end angle}
    	
    	if (!widget.linkData.nodes) return;
        var nodeSizeMinMax = aperture.config.get()['xdataht.config']['node-size'];
    	var nodeCount = widget.linkData.nodes.length;
    	var layoutData = {
    			minSize:nodeSizeMinMax.min,
    			maxSize:nodeSizeMinMax.max,
    			rings:[]
    	};
    	for (var i=0; i<3; i++) {
        	layoutData.rings.push({startAngle:0, endAngle:0, count:0, fullSubCount:0, maxSubCount:0, radius:0, 
        		nodes90:[], nodes180:[], nodes270:[], nodes360:[]});
    	}

    	for (var i=0; i<nodeCount; i++) {
    		var node = widget.linkData.nodes[i];
    		layoutData.rings[node.ring].count++;
    		node.processed = false;
    	}

   		for (var i=0; i<nodeCount; i++) {
    		var node = widget.linkData.nodes[i];
    		calculateSubnodeCounts(widget, node, layoutData);
    	}

   		for (var i=0; i<nodeCount; i++) {
    		var node = widget.linkData.nodes[i];
    		node.processed = false;
    	}
   		
    	
        var centerX = w/2;
        var centerY = h/2;
        var radius = Math.min(w,h)/6;
   		layoutData.rings[0].anglePerCount = layoutData.rings[0].fullSubCount/(Math.PI*2);
        layoutData.rings[0].startAngle = 0;
        layoutData.rings[0].endAngle = null;

    	for (var i=0; i<3; i++) {
        	layoutData.rings[i].radius = (i+1)*Math.min(w,h)/8
    	}
    	for (var i=0; i<nodeCount; i++) {
    		var node = widget.linkData.nodes[i];
    		if (node.ring==0) {
    			positionRadialNodeAndChildren(widget, node, layoutData, centerX, centerY);
    		}
    	}

    	offsetLabels(layoutData);
    	widget.update();
    };

	return {
		layout:layout
	}
});
