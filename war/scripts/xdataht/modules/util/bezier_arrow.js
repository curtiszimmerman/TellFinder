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

	var requestAnimationFrame =  
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        function(callback) {
          return setTimeout(callback, 1);
        };

    var bezierPoint = function(p1,p2,p3,p4,t) {
    	return {x:p1.x*Math.pow(1-t,3)+3*p2.x*t*Math.pow(1-t,2)+3*p3.x*t*t*(1-t)+p4.x*t*t*t,
    		y:p1.y*Math.pow(1-t,3)+3*p2.y*t*Math.pow(1-t,2)+3*p3.y*t*t*(1-t)+p4.y*t*t*t
    		};
    };

    var bezierSlope = function(p1,p2,p3,p4,t) {
    	var c0 = (-3*Math.pow(1-t,2));
    	var c1 = (3*Math.pow(1-t,2)-6*t*(1-t));
    	var c2 = (-3*t*t+6*t*(1-t));
    	var c3 = (3*t*t);
    	return {x:c0*p1.x + c1*p2.x + c2*p3.x + c3*p4.x,
    		y:c0*p1.y + c1*p2.y + c2*p3.y+c3*p4.y};
    };
    
    var drawPartialBezier = function(context, p1,p2,p3,p4,t) {
        var step = 0.05;
        if (t<step) return {x:p1.x,y:p1.y};
        context.beginPath();
        context.moveTo(p1.x,p1.y);
        var a = step;
        var pt;
        while (a<=t) {
        	pt = bezierPoint(p1,p2,p3,p4,a);
        	context.lineTo(pt.x,pt.y);
        	a+=step;
        }
        context.stroke();
        return pt;
    };
    
    var drawArrowhead = function(context, ep, slope) {
    	var angle = Math.PI/2;
    	if (Math.abs(slope.y)>0.001) angle = (slope.y>0?Math.PI:0)+Math.atan(-slope.x/slope.y);
    	context.save();
        context.beginPath();
        context.translate(ep.x,ep.y);
        context.rotate(angle);
        context.moveTo(0,0);
        context.lineTo(7,15);
        context.lineTo(-7,15);
        context.closePath();
        context.fill();              
        context.restore();
    };
    
    var normalizePt = function(pt) {
    	var len = Math.sqrt(pt.x*pt.x+pt.y*pt.y);
    	return {x:pt.x/len, y:pt.y/len};
    };
    
    var drawPartialArrow = function(context, canvas, startPoints, t) {
        // Clear the canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the square
        context.strokeStyle=colors.ARROWS;
        context.fillStyle=colors.ARROWS;
        context.lineWidth=7;

        // draw the line
        var ep, slope, p1, p2, p3;
        if (t<1) {
            for(var i = 0; i<startPoints.length; i++) {
                p1 = startPoints[i];
                p2 = p1.p2;
                ep = drawPartialBezier(context,p1,{x:p2.x,y:p1.y},{x:p1.x,y:p2.y},p2,t);
	            slope = bezierSlope(p1,{x:p2.x,y:p1.y},{x:p1.x,y:p2.y},p2,t);
    	        slope = normalizePt(slope);
        	    ep.x += slope.x*7;
            	ep.y += slope.y*7;
            	drawArrowhead(context, ep, slope);
            }
        } else if (t<2){
            for(i = 0; i<startPoints.length; i++) {
                p1 = startPoints[i];
                p2 = p1.p2;
                context.beginPath();
                context.moveTo(p1.x, p1.y);
                context.bezierCurveTo(p2.x, p1.y, p1.x, p2.y, p2.x, p2.y);
                context.lineTo(p2.x,p2.y);
                context.stroke();
            }

            for(i = 0; i<startPoints.length; i++) {
                var endPoints = startPoints[i].endPoints;
                p2 = startPoints[i].p2;
                for (var j = 0; j < endPoints.length; j++) {
                    p3 = endPoints[j];
                    //context.bezierCurveTo(p3.x,p2.y,p2.x,p3.y,p3.x,p3.y);
                    //context.stroke();
                    //ep = p3;
                    ep = drawPartialBezier(context, p2, {x: p3.x, y: p2.y}, {x: p2.x, y: p3.y}, p3, t - 1);
                    slope = bezierSlope(p2, {x: p3.x, y: p2.y}, {x: p2.x, y: p3.y}, p3, t - 1);
                    slope = normalizePt(slope);
                    ep.x += slope.x * 7;
                    ep.y += slope.y * 7;
                    drawArrowhead(context, ep, slope);
                }
            }
        } else {
            for(i = 0; i<startPoints.length; i++) {
                p1 = startPoints[i];
                p2 = p1.p2;
                context.beginPath();
                context.moveTo(p1.x, p1.y);
                context.bezierCurveTo(p2.x, p1.y, p1.x, p2.y, p2.x, p2.y);
                context.lineTo(p2.x,p2.y);
                context.stroke();
            }

            for(i = 0; i<startPoints.length; i++) {
                var endPoints = startPoints[i].endPoints;
                p2 = startPoints[i].p2;
                for (var j = 0; j < endPoints.length; j++) {
                    p3 = endPoints[j];
                    context.beginPath();
                    context.moveTo(p2.x, p2.y);
                    context.bezierCurveTo(p3.x, p2.y, p2.x, p3.y, p3.x, p3.y);
                    context.lineTo(p3.x,p3.y);
                    context.stroke();
                    ep = p3;
                    slope = bezierSlope(p2, {x: p3.x, y: p2.y}, {x: p2.x, y: p3.y}, p3, t - 1);
                    slope = normalizePt(slope);
                    ep.x += slope.x * 7;
                    ep.y += slope.y * 7;
                    drawArrowhead(context, ep, slope);
                }
            }

        }
    };

    var drawArrow = function(canvas, startPoints) {
    	if (!canvas.getContext) return;
    	var context = canvas.getContext('2d');
		drawPartialArrow(context, canvas, startPoints, 2);
    };
    
    var animateArrow = function(canvas, startPoints) {
    	if (!canvas.getContext) return;
    	var context = canvas.getContext('2d'),
            step = 0.05,
            t = step;
    	var render = function() {
    		drawPartialArrow(context, canvas, startPoints, t);
            // Redraw
            if (t<2) {
                t+=step;
                requestAnimationFrame(render);
            }
        };

        // Start the redrawing process
        render();
    };
	
	return {
		animateArrow:animateArrow,
		drawArrow:drawArrow
	}
});