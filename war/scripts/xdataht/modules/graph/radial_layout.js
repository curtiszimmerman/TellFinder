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
    		for (i=ring.nodes180.length-1; i>=0; i--) {
    			node = ring.nodes180[i];
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
    		for (i=0; i<ring.nodes270.length; i++) {
    			node = ring.nodes270[i];
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
    		for (i=ring.nodes360.length-1; i>=0; i--) {
    			node = ring.nodes360[i];
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
    var positionRadialNodeAndChildrenOld = function(widget, node, layoutData, centerX, centerY) {
    	if (node.processed) return;
    	node.processed = true;
    	var ring = layoutData.rings[node.ring];
    	var dirX = Math.cos(ring.angle);
    	var dirY = Math.sin(ring.angle);
    	node.x = centerX + dirX*ring.radius;
    	node.y = centerY + dirY*ring.radius;
    	node.tag = {
    			visible: true,
    			anchorX: (node.x>centerX)?'left':'right',
    			anchorY: (node.y>centerY)?'top':'bottom',
    			offsetX: dirX*10,
    			offsetY: dirY*10
    	};

    	ring.angle += ring.angleIncrement;
    	for (var i=0; i<node.links.length; i++) {
    		var link = node.links[i];
            var child = widget.linkData.nodeMap[link.other];
    		positionRadialNodeAndChildren(widget, child, layoutData, centerX, centerY);
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
    	var dirX = Math.cos(ring.angle);
    	var dirY = Math.sin(ring.angle);
    	node.x = centerX + dirX*ring.radius;
    	node.y = centerY + dirY*ring.radius;
    	if (node.ring==0 && ring.count==0 && ring.angle==0) {
        	node.x = centerX;
        	node.y = centerY;
    	}
    	if (node.size!=undefined) {
    		node.radius = (node.size * (layoutData.maxSize - layoutData.minSize))+layoutData.minSize;
    	} else {
    		node.radius = (layoutData.maxSize + layoutData.minSize)/2;
    	}
    	node.tag = {
    			visible: true,
    			anchorX: (node.x>=centerX)?'left':'right',
    			anchorY: (node.y>centerY)?'top':'bottom',
    			offsetX: dirX*node.radius,
    			offsetY: dirY*node.radius,
    			connect: false,
    			connectX: dirX*node.radius,
    			connectY: dirY*node.radius
    	};

    	var currentAngle = ring.angle;
    	if (currentAngle<Math.PI/2) ring.nodes90.push(node);
    	else if (currentAngle<Math.PI) ring.nodes180.push(node);
    	else if (currentAngle<3*Math.PI/2) ring.nodes270.push(node);
    	else ring.nodes360.push(node);
    	ring.angle += ring.angleIncrement;
    	var childCount = node.links.length;
    	if (childCount>0) {
    		var innerChildren = [];
    		var outerChildren = [];
	    	for (var i=0; i<node.links.length; i++) {
	    		var link = node.links[i];
	            var child = widget.linkData.nodeMap[link.other];
	            if ((!child) || child.processed) continue;
	            if (child.ring==node.ring) {
	            	innerChildren.push(child);
	            } else if (child.ring>node.ring) {
	            	outerChildren.push(child);
	            }
	    	}
	    	if (outerChildren.length>0) {
		    	var nextRing = layoutData.rings[node.ring+1];
		    	if (nextRing.angle<currentAngle) {
		    		nextRing.angle = currentAngle;
		    	}
		    	if (nextRing.count>0) nextRing.angleIncrement = (2*Math.PI-nextRing.angle)/nextRing.count;
		    	if (nextRing.angleIncrement>ring.angleIncrement) nextRing.angleIncrement = ring.angleIncrement;
		    	var childAngleRange = outerChildren.length*nextRing.angleIncrement;
		    	var tempIncrement = nextRing.angleIncrement;
		    	// TODO: If second ring and only one in first ring, don't limit
		    	if (ring.count>0 && childAngleRange>MAX_CHILD_ARC) {
		    		childAngleRange = MAX_CHILD_ARC;
		    		nextRing.angleIncrement = childAngleRange/outerChildren.length;
		    	}
		    	if (childAngleRange+nextRing.angle>Math.PI*2) {
		    		childAngleRange = Math.PI*2-nextRing.angle;
		    		nextRing.angleIncrement = childAngleRange/outerChildren.length;
		    	}
		    	for (var i=0; i<outerChildren.length; i++) {
		            var child = outerChildren[i];
		    		positionRadialNodeAndChildren(widget, child, layoutData, centerX, centerY);
		    	}
		    	if (ring.angle<nextRing.angle) {
		    		ring.angle = nextRing.angle;
			    	var minIncrement = (2*Math.PI-ring.angle)/ring.count;
			    	if (minIncrement<ring.angleIncrement) ring.angleIncrement = minIncrement;
		    	}
		    	nextRing.angleIncrement = tempIncrement;
		    	var minIncrement = (2*Math.PI-nextRing.angle)/nextRing.count;
		    	if (minIncrement<nextRing.angleIncrement) nextRing.angleIncrement = minIncrement;
	    	}
	    	for (var i=0; i<innerChildren.length; i++) {
	            var child = innerChildren[i];
	    		positionRadialNodeAndChildren(widget, child, layoutData, centerX, centerY);
	    	}
    	}
    	
    };
    
    /** 
	 * Set widget.linkData.nodes[] x,y,tag={visible,anchorX,anchorY,offsetX}
	 */
    var layout = function(widget, w, h) {
    	if (!widget.linkData.nodes) return;
        var nodeSizeMinMax = aperture.config.get()['xdataht.config']['node-size'];
    	var nodeCount = widget.linkData.nodes.length;
    	var layoutData = {
    			minSize:nodeSizeMinMax.min,
    			maxSize:nodeSizeMinMax.max,    			
    			rings:[]
    	};
    	var maxRing = 3;
    	for (var i=0; i<nodeCount; i++) {
    		var node = widget.linkData.nodes[i];
    		if (node.ring!=null && node.ring+1>maxRing) maxRing = node.ring+1;
    	}
    	for (var i=0; i<maxRing; i++) {
        	layoutData.rings.push({angle:i*Math.PI/20, angleIncrement:0, count:0, radius:0, 
        		nodes90:[], nodes180:[], nodes270:[], nodes360:[]});
    	}
    	var temp = 0;
    	for (var i=0; i<nodeCount; i++) {
    		var node = widget.linkData.nodes[i];
    		if (node.ring==null || node.ring==undefined) node.ring = temp;
    		if (temp==0) temp = 1;
    		else temp = 0;
    		layoutData.rings[node.ring].count++;
    		node.processed = false;
    	}

        var centerX = w/2;
        var centerY = h/2;
        var radius = Math.min(w,h)/6;

    	for (var i=0; i<maxRing; i++) {
        	layoutData.rings[i].angleIncrement = 2*Math.PI/layoutData.rings[i].count;
        	layoutData.rings[i].radius = (i+1)*Math.min(w,h)/8
    	}
    	for (var i=0; i<nodeCount; i++) {
    		var node = widget.linkData.nodes[i];
    		angle = positionRadialNodeAndChildren(widget, node, layoutData, centerX, centerY);
    	}

    	offsetLabels(layoutData);
    	widget.update();
    };

	return {
		layout:layout
	}
});
