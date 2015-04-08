/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * 
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
define(['../util/bezier_arrow','../util/ui_util', '../util/colors'], function(Bezier,Util,Colors) {

    var SANKEY_WIDTH = aperture.config.get()['xdataht.config']['explorer']['sankey_width'];
    var SANKEY_ANIMATION_TIME = aperture.config.get()['xdataht.config']['explorer']['sankey_animation_time'];
    var SANKEY_BEZIER_STEP =  aperture.config.get()['xdataht.config']['explorer']['sankey_bezier_step'];
    var HIGHLIGHT_STROKE = Colors.hexToRGBA(Colors.EXPLORER_HOVER,0.8);


    var requestAnimationFrame =
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        function(callback) {
            return setTimeout(callback, 1);
        };

    var generateHighlightKey = function(source,target) {
        return source.left + ',' + source.top + '_' +  target.left + ',' + target.top;
    };


    return {
        create : function(container) {
            var _sankeys = {};
            var _highlight = {};
            var _animatedSankeys = {};
            var _element;
            var _context;

            var _highlightElement;
            var _highlightContext;

            var _isArmHighlighted = function(startpoint,endpoint) {
                return _highlight[ generateHighlightKey(startpoint,endpoint) ] || _highlight[ generateHighlightKey(endpoint,startpoint)];
            };


            /**
             * Draws an unanimated, static bezier curve
             * @param sankeyInstance - {
             *      startpoints : array of starting offsets
             *      endpoints : array of ending offsets
             *  }
             */
            var drawBezier = function(sankeyInstance) {

                if (sankeyInstance.startpoints.length === sankeyInstance.endpoints.length) {
                    for (var i = 0; i < sankeyInstance.startpoints.length; i++) {

                        var p1 = sankeyInstance.startpoints[i];
                        var p2 = sankeyInstance.endpoints[i];

                        var ctx = _context;
                        if (_isArmHighlighted(p1,p2)) {
                            ctx = _highlightContext;
                        }


                        var strokeStyle = ctx.strokeStyle;
                        if (sankeyInstance.strokeStyle) {
                            ctx.strokeStyle = sankeyInstance.strokeStyle;
                        }
                        if (_isArmHighlighted(p1,p2)) {
                            ctx.strokeStyle = HIGHLIGHT_STROKE;
                        }



                        ctx.beginPath();
                        ctx.moveTo(p1.left, p1.top);
                        ctx.bezierCurveTo(p2.left, p1.top, p1.left, p2.top, p2.left, p2.top);
                        ctx.lineTo(p2.left, p2.top);
                        ctx.stroke();
                        ctx.strokeStyle = strokeStyle;
                    }
                } else if (sankeyInstance.startpoints.length && sankeyInstance.endpoints.length === 1) {

                    var p2 = sankeyInstance.endpoints[0];

                    for (var i = 0; i < sankeyInstance.startpoints.length; i++) {
                        var p1 = sankeyInstance.startpoints[i];

                        var ctx = _context;
                        if (_isArmHighlighted(p1,p2)) {
                            ctx = _highlightContext;
                        }


                        var strokeStyle = ctx.strokeStyle;
                        if (sankeyInstance.strokeStyle) {
                            ctx.strokeStyle = sankeyInstance.strokeStyle;
                        }

                        if (_isArmHighlighted(p1,p2)) {
                            ctx.strokeStyle = HIGHLIGHT_STROKE;
                        }

                        ctx.beginPath();
                        ctx.moveTo(p1.left, p1.top);
                        ctx.bezierCurveTo(p2.left, p1.top, p1.left, p2.top, p2.left, p2.top);
                        ctx.lineTo(p2.left, p2.top);
                        ctx.stroke();
                        ctx.strokeStyle = strokeStyle;
                    }
                } else if (sankeyInstance.startpoints.length === 1 && sankeyInstance.endpoints.length) {
                    var p1 = sankeyInstance.startpoints[0];
                    for (var i = 0; i < sankeyInstance.endpoints.length; i++) {
                        var p2 = sankeyInstance.endpoints[i];


                        var ctx = _context;
                        if (_isArmHighlighted(p1,p2)) {
                            ctx = _highlightContext;
                        }


                        var strokeStyle = ctx.strokeStyle;
                        if (sankeyInstance.strokeStyle) {
                            ctx.strokeStyle = sankeyInstance.strokeStyle;
                        }

                        if (_isArmHighlighted(p1,p2)) {
                            ctx.strokeStyle = HIGHLIGHT_STROKE;
                        }

                        ctx.beginPath();
                        ctx.moveTo(p1.left, p1.top);
                        ctx.bezierCurveTo(p2.left, p1.top, p1.left, p2.top, p2.left, p2.top);
                        ctx.lineTo(p2.left, p2.top);
                        ctx.stroke();
                        ctx.strokeStyle = strokeStyle;
                    }
                } else {
                    var minLength = Math.min(sankeyInstance.startpoints.length,sankeyInstance.endpoints.length);
                    for (var i = 0; i < minLength-1; i++) {
                        var p1 = sankeyInstance.startpoints[i];
                        var p2 = sankeyInstance.endpoints[i];

                        var ctx = _context;
                        if (_isArmHighlighted(p1,p2)) {
                            ctx = _highlightContext;
                        }

                        var strokeStyle = ctx.strokeStyle;
                        if (sankeyInstance.strokeStyle) {
                            ctx.strokeStyle = sankeyInstance.strokeStyle;
                        }

                        if (_isArmHighlighted(p1,p2)) {
                            ctx.strokeStyle = HIGHLIGHT_STROKE;
                        }

                        ctx.beginPath();
                        ctx.moveTo(p1.left, p1.top);
                        ctx.bezierCurveTo(p2.left, p1.top, p1.left, p2.top, p2.left, p2.top);
                        ctx.lineTo(p2.left, p2.top);
                        ctx.stroke();
                        ctx.strokeStyle = strokeStyle;
                    }

                    if (sankeyInstance.startpoints.length > sankeyInstance.endpoints.length) {
                        var p2 = sankeyInstance.endpoints[minLength-1];

                        for (var i = minLength-1; i < sankeyInstance.startpoints.length; i++) {
                            var p1 = sankeyInstance.startpoints[i];

                            var ctx = _context;
                            if (_isArmHighlighted(p1,p2)) {
                                ctx = _highlightContext;
                            }

                            var strokeStyle = ctx.strokeStyle;
                            if (sankeyInstance.strokeStyle) {
                                ctx.strokeStyle = sankeyInstance.strokeStyle;
                            }

                            if (_isArmHighlighted(p1,p2)) {
                                ctx.strokeStyle = HIGHLIGHT_STROKE;
                            }

                            ctx.beginPath();
                            ctx.moveTo(p1.left, p1.top);
                            ctx.bezierCurveTo(p2.left, p1.top, p1.left, p2.top, p2.left, p2.top);
                            ctx.lineTo(p2.left, p2.top);
                            ctx.stroke();
                            ctx.strokeStyle = strokeStyle;
                        }
                    } else {
                        var p1 = sankeyInstance.startpoints[minLength-1];
                        for (var i = minLength-1; i < sankeyInstance.endpoints.length; i++) {
                            var p2 = sankeyInstance.endpoints[i];

                            var ctx = _context;
                            if (_isArmHighlighted(p1,p2)) {
                                ctx = _highlightContext;
                            }

                            var strokeStyle = ctx.strokeStyle;
                            if (sankeyInstance.strokeStyle) {
                                ctx.strokeStyle = sankeyInstance.strokeStyle;
                            }

                            if (_isArmHighlighted(p1,p2)) {
                                ctx.strokeStyle = HIGHLIGHT_STROKE;
                            }

                            ctx.beginPath();
                            ctx.moveTo(p1.left, p1.top);
                            ctx.bezierCurveTo(p2.left, p1.top, p1.left, p2.top, p2.left, p2.top);
                            ctx.lineTo(p2.left, p2.top);
                            ctx.stroke();
                            ctx.strokeStyle = strokeStyle;
                        }
                    }

                }
            };

            /**
             * Draws an animated sankey.   Should only be called the first time we update
             * after adding an animated sankey.   This function ticks the 't' parameter on
             * the sankey so that subsequent update calls will render it as a partial bezier curve.
             *
             * After t >= 1, this function will remove 'animated' properties, take it out of the
             * animated sankey set, and place it in the static sankey set.
             *
             * @param sankeyInstance - {
             *      startpoints : array of start offsets
             *      endpoints : array of end offsets
             *      animated : true
             *      t : the time parameter (between 0 and 1)
             *  }
             */
            var animateBezier = function(sankeyInstance) {
                var start = null;

                var tickFn = function(ts) {

                    // If we've been deleted, bail
                    if (!_animatedSankeys[sankeyInstance.id]) {
                        return;
                    }

                    if (!start) {
                        start = ts;
                    }
                    var t = (ts - start)/SANKEY_ANIMATION_TIME;
                    if (t < 1) {
                        sankeyInstance.t = t;
                        sankey.update();
                        requestAnimationFrame(tickFn);
                    } else {

                        _sankeys[sankeyInstance.id] = sankeyInstance;
                        delete _animatedSankeys[sankeyInstance.id];
                        delete sankeyInstance.t;
                        delete sankeyInstance.animated;
                        delete sankeyInstance.id;
                        sankey.update();
                    }
                }
                requestAnimationFrame(tickFn);
            };

            /**
             * Draws a partial bezier curve
             * @param sankeyInstance - {
             *      startpoints : array of start offsets
             *      endpoints : array of end offsets
             *      animated : true
             *      t : the time parameter (between 0 and 1)
             *  }
             */
            var drawPartialBezier = function(sankeyInstance) {
                var t = sankeyInstance.t;
                if (t < SANKEY_BEZIER_STEP) {
                    return;
                }

                if (sankeyInstance.startpoints.length === sankeyInstance.endpoints.length) {
                    for (var i = 0; i < sankeyInstance.startpoints.length; i++) {

                        var start = sankeyInstance.startpoints[i];
                        var end = sankeyInstance.endpoints[i];

                        var p1 = start;
                        var p2 = {
                            left : end.left,
                            top : start.top
                        };
                        var p3 = {
                            left : start.left,
                            top : end.top
                        };
                        var p4 = end;

                        var ctx = _context;
                        if (_isArmHighlighted(start,end)) {
                            ctx = _highlightContext;
                        }

                        var strokeStyle = ctx.strokeStyle;
                        if (sankeyInstance.strokeStyle) {
                            ctx.strokeStyle=sankeyInstance.strokeStyle;
                        }

                        if (_isArmHighlighted(start,end)) {
                            ctx.strokeStyle = HIGHLIGHT_STROKE;
                        }

                        ctx.beginPath();
                        ctx.moveTo(start.left, start.top);
                        var a = SANKEY_BEZIER_STEP;
                        var pt;
                        while (a <= t) {
                            pt = bezierPoint(p1, p2, p3, p4, a);
                            ctx.lineTo(pt.left, pt.top);
                            a += SANKEY_BEZIER_STEP;
                        }
                        ctx.stroke();
                        ctx.strokeStyle = strokeStyle;
                    }
                } else if (sankeyInstance.startpoints.length && sankeyInstance.endpoints.length === 1) {
                    var end = sankeyInstance.endpoints[0];
                    for (var i = 0; i < sankeyInstance.startpoints.length; i++) {
                        var start = sankeyInstance.startpoints[i];

                        var p1 = start;
                        var p2 = {
                            left: end.left,
                            top: start.top
                        };
                        var p3 = {
                            left: start.left,
                            top: end.top
                        };
                        var p4 = end;

                        var ctx = _context;
                        if (_isArmHighlighted(start,end)) {
                            ctx = _highlightContext;
                        }

                        var strokeStyle = ctx.strokeStyle;
                        if (sankeyInstance.strokeStyle) {
                            ctx.strokeStyle = sankeyInstance.strokeStyle;
                        }

                        if (_isArmHighlighted(start,end)) {
                            ctx.strokeStyle = HIGHLIGHT_STROKE;
                        }

                        ctx.beginPath();
                        ctx.moveTo(start.left, start.top);
                        var a = SANKEY_BEZIER_STEP;
                        var pt;
                        while (a <= t) {
                            pt = bezierPoint(p1, p2, p3, p4, a);
                            ctx.lineTo(pt.left, pt.top);
                            a += SANKEY_BEZIER_STEP;
                        }
                        ctx.stroke();
                        ctx.strokeStyle = strokeStyle;
                    }
                } else if (sankeyInstance.startpoints.length === 1 && sankeyInstance.endpoints.length) {
                    var start = sankeyInstance.startpoints[0];

                    for (var i = 0; i < sankeyInstance.endpoints.length; i++) {
                        var end = sankeyInstance.endpoints[i];

                        var p1 = start;
                        var p2 = {
                            left: end.left,
                            top: start.top
                        };
                        var p3 = {
                            left: start.left,
                            top: end.top
                        };
                        var p4 = end;

                        var ctx = _context;
                        if (_isArmHighlighted(start,end)) {
                            ctx = _highlightContext;
                        }

                        var strokeStyle = ctx.strokeStyle;
                        if (sankeyInstance.strokeStyle) {
                            ctx.strokeStyle = sankeyInstance.strokeStyle;
                        }

                        if (_isArmHighlighted(start,end)) {
                            ctx.strokeStyle = HIGHLIGHT_STROKE;
                        }

                        ctx.beginPath();
                        ctx.moveTo(start.left, start.top);
                        var a = SANKEY_BEZIER_STEP;
                        var pt;
                        while (a <= t) {
                            pt = bezierPoint(p1, p2, p3, p4, a);
                            ctx.lineTo(pt.left, pt.top);
                            a += SANKEY_BEZIER_STEP;
                        }
                        ctx.stroke();
                        ctx.strokeStyle = strokeStyle;
                    }
                }
            };

            /**
             * Gets a point on the bezier curve given 4 points and a time value between [0,1].  If the start
             * and endpoints are at the same top offset (happens often) animate a line between the two instead of
             * a bezier.   The animation will 'stall' in the center if we animate it as a bezier curve.
             *
             * @param start - start point { left, top }
             * @param ct1 - control point 1 { left, top }
             * @param ct2 - control point 2 { left, top }
             * @param end - end point { left, top }
             * @param t - value between [0,1]
             * @returns {{left: number, top: number}}
             */
            var bezierPoint = function(start,ct1,ct2,end,t) {
                if (start.top === end.top) {
                    return {
                        left : start.left + (t * (ct1.left - start.left)),
                        top : start.top
                    };
                } else {
                    return {
                        left: (start.left * Math.pow(1 - t, 3)) + (3 * ct1.left * t * Math.pow(1 - t, 2)) + (3 * ct2.left * t * t * (1 - t)) + (end.left * t * t * t),
                        top: (start.top * Math.pow(1 - t, 3)) + (3 * ct1.top * t * Math.pow(1 - t, 2)) + (3 * ct2.top * t * t * (1 - t)) + (end.top * t * t * t)
                    };
                }
            };


            var sankey = {

                /**
                 * Create HTML canvas element for the sankey
                 */
                initialize : function() {
                    _element = $('<canvas/>')
                        .addClass('explorer-sankey')
                        .appendTo(container);
                    _element[0].width = SANKEY_WIDTH;
                    _element.width(SANKEY_WIDTH);
                    _context = _element[0].getContext('2d');

                    _highlightElement = $('<canvas/>')
                        .addClass('explorer-sankey')
                        .appendTo(container);
                    _highlightElement[0].width = SANKEY_WIDTH;
                    _highlightElement.width(SANKEY_WIDTH);
                    _highlightContext = _highlightElement[0].getContext('2d');

                },

                /**
                 * return <canvas> element for sankey
                 * @returns {*}
                 */
                css : function(attrs) {
                    _element.css(attrs);
                    _highlightElement.css(attrs);
                    return this;
                },

                /**
                 * Gets/sets the height for the sankey.   Width is immutable.
                 * @param newHeight
                 * @returns {*}
                 */
                height : function(newHeight) {
                    if (newHeight) {
                        _element[0].height = newHeight;
                        _element.height(newHeight);
                        _highlightElement[0].height = newHeight;
                        _highlightElement.height(newHeight);
                        sankey.update();
                        return sankey;
                    } else {
                        return _element.height();
                    }
                },

                /**
                 * Clear the sankey
                 */
                clear : function() {
                    _context.clearRect(0,0,_element[0].width,_element[0].height);
                    _highlightContext.clearRect(0,0,_highlightElement[0].width,_highlightElement[0].height);
                },

                /**
                 * Update the sankey.   Just redraw the links we have
                 */
                update : function() {
                  sankey.draw();
                },

                /**
                 * Render each link set we have added
                 */
                draw : function() {
                    sankey.clear();

                    var KEY_WIDTH = 7;

                    _context.strokeStyle=Colors.ARROWS;
                    _context.fillStyle=Colors.ARROWS;
                    _context.lineWidth=KEY_WIDTH;
                    _highlightContext.lineWidth=KEY_WIDTH;

                    // Sort by zOrder
                    var orderedSankeys = Object.keys(_sankeys).map(function(id) {
                        return _sankeys[id];
                    }).sort(function(s1,s2) {
                        return s2.zOrder - s1.zOrder;
                    });


                    // Draw all static beziers and kick off the animation callbacks for anythign that needs to move
                    var animatedIds = [];
                    orderedSankeys.forEach(function(sankeyInstance) {
                        if (sankeyInstance.animated) {
                            animatedIds.push(sankeyInstance.id);
                            animateBezier(sankeyInstance);
                        }
                    });

                    // Remove animated beziers from the list of static ones and place them in their own map
                    animatedIds.forEach(function(id) {
                        var sankeyInstance = _sankeys[id];
                        _animatedSankeys[id] = sankeyInstance;
                        delete _sankeys[id];
                    });

                    // Draw the partial beziers of all sankeys that are still animating

                    orderedSankeys = Object.keys(_animatedSankeys).map(function(id) {
                        return _animatedSankeys[id];
                    }).concat(Object.keys(_sankeys).map(function(id) {
                        return _sankeys[id];
                    })).sort(function(s1,s2) {
                            return s2.zOrder - s1.zOrder;
                    });


                    orderedSankeys.forEach(function(sankeyInstance) {
                        if (sankeyInstance.animated) {438
                            drawPartialBezier(sankeyInstance);
                        } else {
                            drawBezier(sankeyInstance);
                        }
                    });
                },

                /**
                 * Add a link set to the sankey.   Called from addLink in explorercolumn.jss
                 * @param startpoints - list of startpoints (top,left) relative to _element
                 * @param endpoints - list of endpoints (top,left) relative to _element
                 * @returns linkId of link set
                 */
                add : function(startpoints,endpoints,strokeStyle,zOrder) {
                    var id = Util.uuid();
                    _sankeys[id] = {
                        startpoints : startpoints,
                        endpoints : endpoints,
                        animated : true,
                        id : id,
                        t : 0,
                        strokeStyle : strokeStyle,
                        zOrder : zOrder !== undefined ? zOrder : 0
                    };
                    return id;
                },

                highlight : function(source,target) {
                    var key = generateHighlightKey(source,target);
                    _highlight[key] = true;
                },

                unhighlight : function() {
                    _highlight = {};
                },

                /**
                 * Update the start/endpoints of a link, given an id
                 * @param id - id of the link returned from add(...)
                 * @param startpoints - array of start offsets
                 * @param endpoints - array of end offsets
                 * @param strokeStyle - (optional) stroke style for the sankey
                 * @returns {*}
                 */
                updateLink : function(id,startpoints,endpoints,strokeStyle,highlighted) {
                    var sankeyInstance = _sankeys[id] || _animatedSankeys[id];

                    var stroke = strokeStyle;
                    if (highlighted) {
                         stroke = Colors.CIRCLE_HOVER;
                    }

                    if (sankeyInstance) {
                        sankeyInstance.startpoints = startpoints;
                        sankeyInstance.endpoints = endpoints;
                        sankeyInstance.strokeStyle = stroke;
                        return id;
                    }
                },

                /**
                 * Remove a linkset
                 * @param id - id of linkset returned from add(...)
                 */
                remove : function(id) {
                    if (_sankeys[id]) {
                        delete _sankeys[id];
                    } else if (_animatedSankeys[id]) {
                        delete _animatedSankeys[id];
                    }
                },

                /**
                 * Removes all links and returns the ids of all removed
                 * @returns {Array}
                 */
                removeAll : function() {
                    var ids = this.getIds();
                    _sankeys = {};
                    _animatedSankeys = {};
                    return ids;
                },

                /**
                 * Destroy the sankey by removing it from the dom
                 */
                destroy : function() {
                    this.clear();
                    _sankeys = {};
                    _highlight = {};
                    _element.remove();
                    _highlightElement.remove();
                },

                /**
                 * Return all link ids in this sankey
                 * @returns {Array}
                 */
                getIds : function() {
                    return Object.keys(_sankeys).concat(Object.keys(_animatedSankeys));
                }
            };

            sankey.initialize();
            return sankey;
        }
    }
});