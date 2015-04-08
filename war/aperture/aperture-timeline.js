/**
 * Copyright (C) 2011-2015 Uncharted Software Inc.
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
 * Source: aperture-timeline.js
 * Copyright (C) 2012 Oculus Info Inc.
 * @fileOverview Aperture TimeLine Layer
 */

/**
 * @namespace
 * The timeline visualization package. If not used, the timeline package may be excluded.
 */
aperture.timeline = (
/** @private */
function(namespace) {
	var DEFAULT_HEIGHT = 45;
	var DEFAULT_WIDTH = 600;
	var DATE_LABEL_BAND_HEIGHT = 20;
	var DEFAULT_START = 1230786000000;
	var DEFAULT_END = 1357016400000;
	var RANGELINE_Y_INTERVAL = 3;
	
	var Timeline = aperture.vizlet.make(aperture.chart.ChartLayer,function(spec){
	$.extend(this,{
		// The visible window is 1/3 of the range between fullStartTime and
		// fullEndTime centred at centerRatio
		centerRatio:0.5,
		fullStartTime:DEFAULT_START,
		fullEndTime:DEFAULT_END,

		// PAN/ZOOM variables
		panning:false,
		startCenter:null,
		currentDragPos:null,
		dragAdjustment:null,

		tlData:spec.data,
		linker:spec.linker,
		uuid:spec.id,
		width:(this.tlData&&this.tlData.width)?this.tlData.width:DEFAULT_WIDTH,
		height:(this.tlData&&this.tlData.height)?this.tlData.height:DEFAULT_HEIGHT,

		init: function() {
			// INITIALIZE THE PLOT
			this.mapAll({
				'width' : this.width,
				'height' : this.height,
				'background-color' : this.tlData.color?this.tlData.color:'#F3F3F4',
				'title-margin' : 0,
				'margin':0,
				'clipped' : true
			});

			// Initialize data
			this.all(this.tlData);
			
			// Initialize extended window start/end times
			if (this.tlData&&this.tlData.band) {
				var duration = this.tlData.band.end-this.tlData.band.start;
				this.fullStartTime = this.tlData.band.start-duration;
				this.fullEndTime = this.tlData.band.end+duration;
			}

			this.updateTimeMapping();

			// Map the x-value into the visible window (1/3 of the whole time line)
			var that = this;
			function filter(value) {
				return (value - that.centerRatio)*3 + 0.5;
			}
			this.map('x').filter(filter);

			// Create the range layer below the labels
			if (this.tlData.showRanges) {
				this.createRangeLayer();
			}
			
			// Create the time labels
			this.createAxes();

			// Create the icon layer
			if (!this.tlData.hideIcons) {
				this.createIconLayer();
			}

			// Listen for drag panning
			if (!this.tlData.disablePan) {
				this.setupPanning();
			}
			
			// Listen for wheel zoom
			if (spec.data.allowWheel) {
				this.bindMouseWheel(spec.id);
			}
		},

		resize: function(w, h) {
			this.width = w;
			this.height = h;
			this.map('width').asValue(w);
			this.map('height').asValue(h);
			this.updateTimeMapping();
			this.updateTimeLabels();
			this.repositionRangeData();
			this.all().redraw();
		},

		/**
		 * Setup the major and minor time axis and [0,1] y axis
		 */
		createAxes: function() {
			// Create the primary x-axis.
			var primeXAxis = this.createXAxis();
			primeXAxis.all(this.mapKeyX);

			// Create the secondary xAxis.
			var secXAxis = this.createXAxis(1, 10);
			var nextOrder = this.bandedX.formatter().nextOrder();
			if (nextOrder) {
				var secBandedX = this.bandedX.banded({
					span : 1,
					units : nextOrder
				});
				secXAxis.all(secBandedX.mapKey([0,1]));
			}

			// Create the y-axis.
			var yAxis = this.yAxis();
			yAxis.map('margin').asValue(0);
			var rangeY = new aperture.Scalar('vertical', [0,1]);
			this.map('y').using(rangeY.mapKey([1,0]));
		},
		
		/**
		 * Set up some common parameters used by both time axes
		 */
		createXAxis: function(order, axisOffset){
			var axisLayer = this.xAxis(order);
			axisLayer.map('margin').asValue(0);
			axisLayer.map('visible').asValue(true);
			axisLayer.map('v-align').asValue('top');
			axisLayer.map('layout').asValue('top');
			axisLayer.map('text-anchor').asValue('start');
			axisLayer.map('tick-width').asValue(1);
			axisLayer.map('tick-length').asValue(10);
			axisLayer.map('label-offset-x').asValue(2);
			axisLayer.map('label-offset-y').asValue(6);
			axisLayer.map('font-size').asValue(10);
			axisLayer.map('stroke').asValue('#aaa');
			axisLayer.map('title-margin').asValue(0);
			if (axisOffset>0) {
				axisLayer.map('tick-offset').asValue(axisOffset);
			}
			return axisLayer;
		},
		
		/**
		 * Set up the mapping from time -> [0,1] x position
		 */
		updateTimeMapping: function() {
			this.timeSpan = this.fullEndTime-this.fullStartTime;
			this.centerTime = this.fullStartTime+(this.timeSpan/2);

			var rangeX = new aperture.TimeScalar('time', [this.fullStartTime,this.fullEndTime]);
			this.bandCount = 3*this.width/100;
			this.bandedX = rangeX.banded(this.bandCount, false);
			this.mapKeyX = this.bandedX.mapKey([0,1]);
			this.map('x').from('start').using(this.mapKeyX);
		},
		
		/**
		 * Set the major time labels to be the next order from the minor ones
		 */
		updateTimeLabels: function() {
			this.xAxis(0).all(this.mapKeyX);
		
			var nextOrder = this.bandedX.formatter().nextOrder();
			if (nextOrder){
				var secBandedX = this.bandedX.banded({
					'span' : 1,
					'units' : nextOrder
				});
				this.xAxis(1).all(secBandedX.mapKey([0,1]));
			}
			// If the next time order is undefined, hide the secondary axis.
			this.xAxis(1).map('visible').asValue(!!nextOrder);
		},

		createIconLayer: function() {
			// Create an icon layer and add it to the timeline
			this.iconLayer = this.addLayer(aperture.IconLayer, {
					'width'    : 24,
					'height'   : 24,
					'anchor-x' : 0.5,
					'anchor-y' : 0.5,
					'y'        : 0.5
				});
			this.iconLayer.all(this.tlData.events);
			this.iconLayer.map('url').from('iconUrl');

			// Add click listeners
			var that = this;
			this.iconLayer.on('click', function(event) {
				if (that.clickFn) that.clickFn(event);
			});
			this.iconLayer.on('dblclick', function(event) {
				if (that.dblclickFn) that.dblclickFn(event);
			});
			
			// Add tooltip listeners
			this.iconLayer.on('mouseover', function(event) {
				var content = '<B>' + event.data.name + '</B><BR>'
				var date = new Date(event.data.start);
				content +=  '<B>Start Date:</B>' + date.toDateString() + " " + date.toLocaleTimeString();
				if (event.data.end && event.data.end!=event.data.start) {
					date = new Date(event.data.end);
					content +=  '<BR><B>End Date:</B>' + date.toDateString() + " " + date.toLocaleTimeString();
				}
				if (event.data.properties) {
					for (var i=0; i<event.data.properties.length; i++) {
						content += "<BR><B>" + event.data.properties[i].key + ":</B>" +event.data.properties[i].value;
					}
				}
				aperture.tooltip.showTooltip({'event':event, 'html':content, 'delay':500});
			});
			this.iconLayer.on('mouseout', function(event) {
				aperture.tooltip.hideTooltip();
			});
		},
		
		updateLineLevelCount: function(){
			this.numYLevels = Math.floor(this.height/RANGELINE_Y_INTERVAL);
		},
		
		/**
		 * Calculate y position for a duration lines given an index
		 */
		getLineY: function(idx) {
		        var paddingTop = 1/this.height; // set padding to 2px; normalize against height
		        var paddingBottom = 3/this.height;
		        var lineRegionHeight = 1 - paddingTop - paddingBottom;
		        var intervalHeight = lineRegionHeight/(this.numYLevels-1);
		        
			var halfLevels = Math.ceil(this.numYLevels/2);
			if (idx<halfLevels) {
			    return (lineRegionHeight+paddingBottom) - intervalHeight*2*idx; 
			}else{
        	            return (lineRegionHeight+paddingBottom - intervalHeight) - intervalHeight*2*(idx-halfLevels);
        		}
		},
		
		/**
		 * Create a set of duration lines that overlap as little as possible
		 */
		generateLines: function() {
			this.updateLineLevelCount();
			this.tlData.events.sort(function(a,b) {return a.start-b.start;});
			var rangeEvents = [];
			for (var i=0; i<this.tlData.events.length; i++) {
				var e = this.tlData.events[i]
				if (e.start&&e.end) {
					var ev = {src:e, start:e.start, end:e.end, yIndex:0};
					var overlap = [];
					for (var level=0; level<this.numYLevels; level++) {
						overlap[level] = 0;
					}
					for(var j=0; j<rangeEvents.length; j++){
						var re = rangeEvents[j];
						if((re.end>ev.start)&&(re.start<ev.end)){
							overlap[re.yIndex]++;
						}
					}
					var minoverlap=overlap[0];
					var minoverlapidx=0;
					for (var level=1; level<this.numYLevels; level++) {
						if (overlap[level]<minoverlap) {
							minoverlapidx = level;
							minoverlap = overlap[level];
						}
					}
					ev.yIndex = minoverlapidx;
					rangeEvents.push(ev);
				}
			}
			for (var i=0; i<rangeEvents.length; i++) {
				rangeEvents[i].y = this.getLineY(rangeEvents[i].yIndex);
			}
			return rangeEvents;
		},
		
		/**
		 * Create start and end points for each duration line
		 */
		generateEndpoints: function(linedata) {
			var endpoints = [];
			for (var i=0; i<linedata.length; i++) {
				var e = linedata[i];
				if (e.start&&e.end) {
				    var ev2 = {src:e.src, start:e.end, color:'#50c2eb', y:e.y};
				    endpoints.push(ev2);
				}
			}
			return endpoints;
		},
		
		/**
		 * update duration line positioning
		 */
		repositionRangeData: function() {
		    if(!this.linedata)
		        return;
		    this.updateLineLevelCount();
			
		    for (var i=0; i<this.linedata.length; i++) {
				var e = this.linedata[i]
				if (e.start&&e.end) {
				    var overlap = [];
				    for (var level=0; level<this.numYLevels; level++) {
				    	overlap[level] = 0;
					}
					for(var j=0; j<i; j++){
						var re = this.linedata[j];
						if((re.end>e.start)&&(re.start<e.end)){
							overlap[re.yIndex]++;
						}
					}
					var minoverlap=overlap[0];
					var minoverlapidx=0;
					for (var level=1; level<this.numYLevels; level++) {
						if (overlap[level]<minoverlap) {
							minoverlapidx = level;
							minoverlap = overlap[level];
						}
					}
					e.yIndex = minoverlapidx;
				}
			}
			for (var i=0; i<this.linedata.length; i++) {
				this.linedata[i].y = this.getLineY(this.linedata[i].yIndex);
				if(this.epdata&&this.epdata[i]){
				    this.epdata[i].y = this.linedata[i].y;
				}
			}
		},
		
		showRangeLayer: function(visible) {
			this.timerangeLayer.map('visible').asValue(visible);
			this.all().redraw();
		},
		
		/**
		 * Create bar layers to render the start, end and span of duration events
		 */
		createRangeLayer: function(){
		    var that = this;
			// Create a time range layer and add it to the timeline.
			this.timerangeLayer = this.addLayer( aperture.BarLayer, {
					'orientation' : 'horizontal',
					'width' : 2,
					'fill' : '#93e0fd'
				}
			);
			this.linedata = this.generateLines();
			this.timerangeLayer.all(this.linedata);
			
			this.timerangeLayer.map('y').from('y');
			this.timerangeLayer.map('length').from(function() {  
			    if ((!this.end)||(!this.start)||(!that.timeSpan)) {
			        return 0;
			    }
				
			    var totalRange = that.timeSpan/3;  // visible timespan is 1/3 full time span
			    var eventRange = this.end - Math.max(this.start, that.fullStartTime); // start pt used to compute the end pt drawn is clamped at timeline start 
			    var rel = eventRange/totalRange;
			    var pixelRange = rel * that.width;
			    pixelRange = Math.max(0,pixelRange);
			    
			    return pixelRange;
			});
			
			var tooltipFn = function(event) {
				var content = '<B>' + event.data.src.name + '</B><BR>'
				var date = new Date(Number(event.data.src.start));
				content +=  '<B>Start Date:</B>' + date.toDateString() + " " + date.toLocaleTimeString();
				if (event.data.src.end && event.data.src.end!=event.data.src.start) {
					date = new Date(Number(event.data.src.end));
					content +=  '<BR><B>End Date:</B>' + date.toDateString() + " " + date.toLocaleTimeString();
				}
				if (event.data.src.properties) {
					for (var i=0; i<event.data.src.properties.length; i++) {
						content += "<BR><B>" + event.data.src.properties[i].key + ":</B>" +event.data.src.properties[i].value;
					}
				}
				aperture.tooltip.showTooltip({'event':event, 'html':content, 'delay':500});
			};
			
			// Create a time range endpoint layer and add it to the timeline.
			this.timerangeEndpointLayer = this.addLayer( aperture.RadialLayer );
			this.epdata = this.generateEndpoints(this.linedata);
			this.timerangeEndpointLayer.all(this.epdata);
			
			this.timerangeEndpointLayer.map('y').from(function(index) {
				var barHeight = 2;
			    return this.y - (0.5*barHeight)/that.height;  // center point on range bar
			    });
			
			this.timerangeEndpointLayer.map('color').from('color');
			this.timerangeEndpointLayer.map('fill').from('color');
			this.timerangeEndpointLayer.map('radius').asValue(2);
			
			this.timerangeEndpointLayer.on('mouseover', tooltipFn);
			this.timerangeEndpointLayer.on('mouseout', function(event) {
				aperture.tooltip.hideTooltip();
			});
			this.timerangeEndpointLayer.on('click', function(event) {
				if (that.clickFn) {
					event.data = event.data.src;
					that.clickFn(event);
				}
			});
			this.timerangeLayer.on('mouseover', tooltipFn);
			this.timerangeLayer.on('mouseout', function(event) {
				aperture.tooltip.hideTooltip();
			});
			this.timerangeLayer.on('click', function(event) {
				if (that.clickFn) {
					event.data = event.data.src;
					that.clickFn(event);
				}
			});
		},
		
		setEvents: function(events) {
			this.tlData.events = events;
			if (events) {
				if (this.tlData.showRanges) {
					this.linedata = this.generateLines(this.tlData);
					this.timerangeLayer.all(this.linedata);
					this.epdata = this.generateEndpoints(this.linedata);
					this.timerangeEndpointLayer.all(this.epdata);
				}
				if (!this.tlData.hideIcons) {
					this.iconLayer.all(this.tlData.events);
				}
			}
		},
		
		/**
		 * Get parameters for saving and restoring time layout
		 */
		getParams: function() {
			return [this.centerRatio, this.fullStartTime, this.fullEndTime];
		},
		setParams:function(params) {
			this.centerRatio = params[0];
			this.fullStartTime = params[1];
			this.fullEndTime = params[2];
			this.updateTimeMapping();
			this.updateTimeLabels();
			this.all().redraw();
		},

		handleDragStart: function() {
			this.startCenter = this.centerRatio;
			this.dragAdjustment = 0;
			this.panning = false;
			if (this.linker) this.linker({id:this.uuid,action:'dragstart'});
		},

		handleDragMove: function(x) {
			// don't start unless movement is significant.
			this.currentDragPos = x;
			this.panning = this.panning || Math.abs(this.currentDragPos) > 3;

			if (this.panning) {
				var amt = (this.currentDragPos+this.dragAdjustment) / this.width / 3;
				this.doPan(this.startCenter - amt );
				if (this.linker) this.linker({id:this.uuid,action:'dragmove',dragPos:this.currentDragPos});
			}
		},
		
		handleDragEvent: function(event) {
			switch (event.eventType) {
			case 'dragstart':
				this.handleDragStart();
				break;

			case 'dragmove':
			case 'drag':
				this.handleDragMove(event.dx);
			}
		},
		
		setupPanning: function() {
			// Set up the drag handler that applies the panning.
			this.on('drag', this.handleDragEvent);
		},
		
		doPan: function(c) {
			var changed;
			if (this.centerRatio!=c) {
				if (c<0.3 || c>0.7) {
					this.centerTime = this.fullStartTime + (this.timeSpan*c);
					this.fullStartTime = this.centerTime - (this.timeSpan/2);
					this.fullEndTime = this.centerTime + (this.timeSpan/2);
					this.centerRatio = 0.5;
					this.startCenter = 0.5;
					this.dragAdjustment = -this.currentDragPos;
					this.updateTimeMapping();
					this.updateTimeLabels();
				} else {
					this.centerRatio = c;
					this.centerTime = this.fullStartTime + (this.timeSpan*this.centerRatio);
				}
				changed = true;
			}
			if (changed) {
				this.trigger('zoom', {
					eventType:'zoom',
					data:this.tlData,
					layer:this
				});
				this.all().redraw(); // Note: lots of work done here
			}
		},

		bindMouseWheel: function(id) {
			var that = this;
			this.currentWheelIdx = 0;
			$('#'+id).bind("mousewheel DOMMouseScroll", null, function(event) {
				var delta = 0;
			    if ( event.originalEvent.wheelDelta ) delta = event.originalEvent.wheelDelta/120;
			    if ( event.originalEvent.detail ) delta = -event.originalEvent.detail/3;
			    var posX = event.originalEvent.pageX-$(that.canvas_.root_).offset().left
			    that.doZoom(delta, posX);
			    if (that.wheelZoomListener) that.wheelZoomListener();
			});
		},
		
		doZoom: function(delta, xOffset) {
			var ruleVisibleRatio = 0.5;
			if (xOffset) {
				ruleVisibleRatio = xOffset/this.width;
			}
			var ruleRatio = this.centerRatio + (ruleVisibleRatio-0.5)/3;
			var ruleTime = this.fullStartTime + (this.timeSpan*ruleRatio);
			var newRuleRatio = 0.5 + (ruleVisibleRatio-0.5)/3;
			this.timeSpan = (delta>0)?this.timeSpan/2:this.timeSpan*2;
			this.centerTime = ruleTime + this.timeSpan*(0.5-newRuleRatio);
			
			this.fullStartTime = this.centerTime - (this.timeSpan/2);
			this.fullEndTime = this.centerTime + (this.timeSpan/2);
			this.centerRatio = 0.5;
			this.startCenter = 0.5;
			this.updateTimeMapping();
			this.updateTimeLabels();
			this.trigger('zoom', {
				eventType : 'zoom',
				data:this.tlData,
				layer:this
			});

			this.all().redraw();
		},

		/**
		 * Get and set the visible window using start/end times
		 */
		getWindow: function() {
			return {
				start:this.centerTime-this.timeSpan/6,
				end:this.centerTime+this.timeSpan/6
			};
		},
		setWindow: function(start,end) {
			var span = end-start;
			this.fullStartTime = start-span;
			this.fullEndTime = end+span;
			this.centerTime = start+(span/2);
			this.centerRatio = 0.5;
			this.startCenter = 0.5;
			this.updateTimeMapping();
			this.updateTimeLabels();
			this.trigger('zoom', {
				eventType : 'zoom',
				data : this.tlData,
				layer : this
			});
			this.all().redraw();
		},
		

		/**
		 * Return the {min,max} of the data times
		 */
		getDataTimeRange: function(filter) {
			var result = null;
			for (var i=0; i<this.tlData.events.length; i++) {
				e = this.tlData.events[i];
				if (filter&&e.type!=filter) continue;
				if (!result) {
					result = { min: e.start, max: e.end?e.end:e.start };
				} else {
					if (e.start<result.min) result.min = e.start;
					if (e.end) {
						if (e.end>result.max) result.max = e.end;
					} else if (e.start>result.max) result.max = e.start;
				}
			}
			return result;
		},
		
		fitTimes: function(filter) {
			if (!this.tlData.events || this.tlData.events.length==0) return;
			var range = this.getDataTimeRange(filter);
			if (!range) return;
			this.setWindow(range.min, range.max);
			if (this.linker) this.linker({id:this.uuid,action:'fit'});
		},
		
		syncEvent: function(eventType, time, x) {
			var nearestEvent = null;
			for (var i=0; i<this.tlData.events.length; i++) {
				e = this.tlData.events[i];
				if (e.type==eventType) {
					if (nearestEvent==null) {
						nearestEvent = e;
					} else if (Math.abs(nearestEvent.start-time)>Math.abs(e.start-time)) {
						nearestEvent = e;
					}
				}
			}
			if (nearestEvent!=null) {
				// Put nearestEvent.start at x
				var ratio = (x-$(this.canvas_.root_).offset().left)/this.width;
				var syncTime = nearestEvent.start;
				var start = syncTime-ratio*this.timeSpan/3;
				var end = start + this.timeSpan/3;
				this.setWindow(start, end);
			}
		},
		
		/**
		 * Handle linked timeline panning. Called when another timeline pans.
		 */
		linkFn: function(linkData) {
			if (linkData.id===this.uuid) return;
			switch(linkData.action) {
			case 'dragstart':
				this.startCenter = this.centerRatio;
				this.dragAdjustment = 0;
				break;
			case 'dragmove':
				this.currentDragPos = linkData.dragPos;
				var amt = (this.currentDragPos+this.dragAdjustment) / this.width / 3;
				this.doPan(this.startCenter - amt );
				break;
			}
		}
	});
	this.init();
	});
	

	namespace.Timeline = Timeline;
	return namespace;
}(aperture.timeline || {}));

return aperture;
}(aperture || {}));