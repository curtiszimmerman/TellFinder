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


aperture.timelinecontrol = (

function(namespace) {

	var makeNiceDate = function(timelong) {
		var m = new Date(timelong);
		var dateString =
		  m.getFullYear() +"/"+
		  ("0" + (m.getMonth()+1)).slice(-2) +"/"+
		  ("0" + m.getDate()).slice(-2) + " " +
		  ("0" + m.getHours()).slice(-2) + ":" +
		  ("0" + m.getMinutes()).slice(-2) + ":" +
		  ("0" + m.getSeconds()).slice(-2);		
		return dateString;
	};
	
	var zoomToDateDialog = function(title, ranges, okcallback) {
		var resultObj = {
			container: null,
			startTimeWidget: null, 
			endTimeWidget:null,
			init: function() {
				var that = this;
				this.container = document.createElement('div');
				this.container.title = title;
				
				this.container.appendChild(document.createTextNode("Range Start Time:"));
				var rangeStartTimeDiv = document.createElement('div');
				this.container.appendChild(rangeStartTimeDiv);
				this.rangeStartTimeWidget = aperture.datetimepicker.DateTimeWidget(rangeStartTimeDiv);
				
				this.container.appendChild(document.createTextNode("Window Start Time:"));
				var windowStartTimeDiv = document.createElement('div');
				this.container.appendChild(windowStartTimeDiv);
				this.windowStartTimeWidget = aperture.datetimepicker.DateTimeWidget(windowStartTimeDiv);
				
				this.container.appendChild(document.createTextNode("Window End Time:"));
				var windowEndTimeDiv = document.createElement('div');
				this.container.appendChild(windowEndTimeDiv);
				this.windowEndTimeWidget = aperture.datetimepicker.DateTimeWidget(windowEndTimeDiv);
				
				this.container.appendChild(document.createTextNode("Range End Time:"));
				var rangeEndTimeDiv = document.createElement('div');
				this.container.appendChild(rangeEndTimeDiv);
				this.rangeEndTimeWidget = aperture.datetimepicker.DateTimeWidget(rangeEndTimeDiv);

				this.rangeStartTimeWidget.setDate(new Date(ranges.range_start));
				this.windowStartTimeWidget.setDate(new Date(ranges.window_start));
				this.windowEndTimeWidget.setDate(new Date(ranges.window_end));
				this.rangeEndTimeWidget.setDate(new Date(ranges.range_end));

				document.body.appendChild(this.container);
				$(this.container).dialog({
					zIndex:30000000,
					width:'auto',
					minHeight:'auto',
					modal:true,
					
					// These two lines prevent the "x" from appearing in the corner of dialogs.   It's annoying to handle closing the dialog
					// this way so this is how we can prevent the user from doing this
					closeOnEscape: false,
		   			open: function(event, ui) { 
		   				var jqObj = $(this);
		   				jqObj.parent().children().children('.ui-dialog-titlebar-close').hide(); 
		   				setTimeout(function() {
			   				that.rangeStartTimeWidget.datePicker.blur();
			   				$(that.rangeStartTimeWidget.datePicker).datepicker('hide');
			   				jqObj.parent().find('.ui-dialog-buttonset').children().get(0).focus();
		   				},0);
		   			},
		   			
					buttons: {
						"Ok" : function() {
							var window_start = that.windowStartTimeWidget.getDate();
							var window_end = that.windowEndTimeWidget.getDate();
							var range_start = that.rangeStartTimeWidget.getDate();
							var range_end = that.rangeEndTimeWidget.getDate();
							if ( range_start && range_end && window_start && window_end ) {
								okcallback({
									range_start:range_start.getTime(),
									range_end:range_end.getTime(),
									window_start:window_start.getTime(),
									window_end:window_end.getTime()
								});
							}
							$(this).dialog("close");
						},
						"Cancel" : function() {
							$(this).dialog("close");
						}
					},
					resizeStop: function(event, ui) {
					},
					close: function(event, ui) {
						$(this).dialog("destroy");
					}
					
				}).css({"font-size":"12px"});
			}
		};
		resultObj.init();
		return resultObj;
	};
	
    var TimelineControl = aperture.Class.extend({
    	unclippedLeft: 0,
    	unclippedWidth: 0,
    	init : function(elem, uuid, data) {
			this.canvas_ = elem;
			this.uuid_ = uuid;
			this.data = data;
			this.createTimelineControl();
		},
		createTimelineControl: function() {
			this.canvas_.id = "mapTimelineControl_" + this.uuid_;
			this.canvas_.style.overflow = 'hidden';

			var data = {
				band:{
					"start":this.data.global_start,
					"end":this.data.global_end
				},
				allowWheel:true,
				disablePan:false,
				color:this.data.color
			};

			var that = this;
			var linkFn = function(linkData) {
				that.refreshControlWindow();
			};
			
			// Create the timeline in the DOM
			this.timeline = new aperture.timeline.Timeline( {id:this.canvas_.id, data:data, linker:linkFn} );
			this.timeline.wheelZoomListener = linkFn;
			this.timeline.all().redraw();
			
			this.tlcHandle= document.createElement('div');
			this.tlcHandle.id = "tlcHandle";
			this.tlcHandle.style.position = 'absolute';
			this.tlcHandle.style.top = '0px';
			this.tlcHandle.style.width = this.canvas_.offsetWidth + 'px';
			this.tlcHandleConstraintLeft = document.createElement('div');
			this.tlcHandleConstraintLeft.id = "tlcHandleConstraintLeft";
			this.tlcHandleConstraintLeft.style.width = '150px';
			this.tlcHandleConstraintLeft.style.position = 'absolute';
			this.tlcHandleLeft = document.createElement('div');
			$(this.tlcHandleLeft).css({opacity:1.0,width:'10px',height:'24px',left:'40px',position:'absolute',cursor:'e-resize','z-index':1});
			this.tlcHandleLeft.className = "timeline_handle_left";
			this.tlcHandleConstraintRight = document.createElement('div');
			this.tlcHandleConstraintRight.id = "tlcHandleConstraintRight";
			this.tlcHandleConstraintRight.style.width = (this.canvas_.offsetWidth>50?(this.canvas_.offsetWidth-50):0)+'px';
			this.tlcHandleConstraintRight.style.left = '50px';
			this.tlcHandleConstraintRight.style.position = 'absolute';
			this.tlcHandleRight = document.createElement('div');
			this.tlcHandleRight.id = "tlcHandleRight";
			$(this.tlcHandleRight).css({opacity:1.0,width:'10px',height:'24px',left:'100px',position:'absolute',cursor:'e-resize','z-index':1});
			this.tlcHandleRight.className = "timeline_handle_right";
			this.tlcHandleSpan = document.createElement('div');
			this.tlcHandleSpan.id = "tlcHandleSpan";
			this.tlcHandleSpan.className = "timeline_handle_background";
			$(this.tlcHandleSpan).css({width:'100px',height:'24px',left:'50px',position:'absolute'});
			this.tlcHandleSpanLeft = document.createElement('div');
			this.tlcHandleSpanLeft.id = "tlcHandleSpanLeft";
			$(this.tlcHandleSpanLeft).css({opacity:0.6,background:'#BBB',width:'50px',height:'22px',left:'0px',position:'absolute','z-index':1,'pointer-events':'none'});
			this.tlcHandleSpanRight = document.createElement('div');
			this.tlcHandleSpanRight.id = "tlcHandleSpanRight";
			$(this.tlcHandleSpanRight).css({opacity:0.6,background:'#BBB',width:'800px',height:'22px',left:'150px',position:'absolute','z-index':1,'pointer-events':'none'});
			
			$(this.tlcHandleLeft).mouseover(function(event) {
				aperture.tooltip.showTooltip({event:{source:event},html:"Window Start " + makeNiceDate(that.data.window_start) + "<BR/><B>Drag to adjust time window start</B>",delay:100});
			});
			$(this.tlcHandleLeft).mouseout(function() {
				aperture.tooltip.hideTooltip();
			});
			
			$(this.tlcHandleLeft).draggable({
				axis:'x',
				containment: 'parent',
				start: function(event,ui) {
					this.dragStartX = event.clientX;
					this.dragStartSpan = that.tlcHandleSpan.offsetWidth;
					this.dragStartLeft = that.tlcHandleSpan.offsetLeft;
				},
				drag: function(event,ui) {
					var delta = event.clientX - this.dragStartX;
					if (delta>this.dragStartSpan) delta = this.dragStartSpan;
					if (delta<10-this.dragStartLeft) delta = 10-this.dragStartLeft;
					that.updateControl(this.dragStartLeft + delta, this.dragStartSpan - delta);
					aperture.tooltip.showTooltip({event:{source:event},html:"Window Start " + makeNiceDate(that.data.window_start) + "<BR/><B>Drag to adjust time window start</B>"});
				},
				stop: function(event,ui) {
				}
			});
			
			$(this.tlcHandleRight).mouseover(function(event) {
				aperture.tooltip.showTooltip({event:{source:event},html:"Window End " + makeNiceDate(that.data.window_end) + "<BR/><B>Drag to adjust time window end</B>",delay:100});
			});
			$(this.tlcHandleRight).mouseout(function() {
				aperture.tooltip.hideTooltip();
			});
			
			$(this.tlcHandleRight).draggable({
				axis:'x',
				containment: 'parent',
				start: function(event,ui) {
					this.dragStartX = event.clientX;
					this.dragStartSpan = that.tlcHandleSpan.offsetWidth;
					this.dragStartLeft = that.tlcHandleSpan.offsetLeft;
				},
				drag: function(event,ui) {
					var delta = event.clientX - this.dragStartX;
					if (delta<-this.dragStartSpan) delta = -this.dragStartSpan;
					if (delta+this.dragStartLeft+this.dragStartSpan>that.canvas_.offsetWidth) delta = that.canvas_.offsetWidth-this.dragStartSpan-this.dragStartLeft;
					that.updateControl(this.dragStartLeft, this.dragStartSpan + delta);
					aperture.tooltip.showTooltip({event:{source:event},html:"Window End " + makeNiceDate(that.data.window_end) + "<BR/><B>Drag to adjust time window end</B>"});
				},
				stop: function(event,ui) {
				}
			});
			
			$(this.tlcHandleSpan).mouseover(function(event) {
				aperture.tooltip.showTooltip({event:{source:event},html:makeNiceDate(that.data.window_start) + " - " + makeNiceDate(that.data.window_end) + "<BR/><B>Drag to pan time window</B>",delay:100});
			});
			$(this.tlcHandleSpan).mouseout(function() {
				aperture.tooltip.hideTooltip();
			});
			$(this.tlcHandleSpan).draggable({
				axis:'x',
				containment: 'parent',
				helper: 'clone',
				start: function(event,ui) {
					this.dragStartX = event.clientX;
					this.dragStartSpan = that.unclippedWidth;
					this.dragStartLeft = that.unclippedLeft;
				},
				drag: function(event,ui) {
					var delta = event.clientX - this.dragStartX;
					var newLeft = this.dragStartLeft + delta;
					that.updateControl(newLeft, this.dragStartSpan);
					aperture.tooltip.showTooltip({event:{source:event},html:makeNiceDate(that.data.window_start) + " - " + makeNiceDate(that.data.window_end) + "<BR/><B>Drag to pan time window</B>"});
				},
				stop: function(event,ui) {
				}
			}).dblclick(function(event) {
				var timeWindow = that.timeline.getWindow();
				var initialRanges = {
						range_start:timeWindow.start,range_end:timeWindow.end,
						window_start:that.data.window_start,window_end:that.data.window_end};
				new zoomToDateDialog('Select date ranges', initialRanges, function(ranges) {
					var timeWindow = that.timeline.setWindow(ranges.range_start, ranges.range_end);
					that.setControlWindow({start:ranges.window_start,end:ranges.window_end});
				});
			});
			
			
			this.tlcHandleResize = document.createElement('div');
			this.tlcHandleResize.id = 'TL_resize_handle';
			$(this.tlcHandleResize).css({opacity:1.0,width:'10px',height:'24px',left:'0px',position:'absolute',cursor:'n-resize','z-index':1});
			this.tlcHandleResize.className = "timeline_handle_resize";
			
			this.tlcHandleResizeConstraint = document.createElement('div');
			this.tlcHandleResizeConstraint.id = "tlcHandleResizeConstraint";
			this.tlcHandleResizeConstraint.style.width = '10px';
			this.tlcHandleResizeConstraint.style.position = 'absolute';
			
			$(this.tlcHandleResize).draggable({
				axis:'x', // y
				containment: 'parent',
				start: function(event,ui) {
					this.dragStartY = event.clientY;
				},
				drag: function(event,ui) {
					var delta = event.clientY - this.dragStartY;
					that.updateResizeControl(this.dragStartY, delta);
					this.dragStartY = event.clientY;
				},
				stop: function(event,ui) {
					var delta = event.clientY - this.dragStartY;
					that.updateResizeControl(this.dragStartY, delta);
				}
			});
			
			
			this.canvas_.appendChild(this.tlcHandle);
			
			this.tlcHandle.appendChild(this.tlcHandleSpanLeft);
			this.tlcHandle.appendChild(this.tlcHandleSpan);
			this.tlcHandle.appendChild(this.tlcHandleSpanRight);
			
			this.tlcHandle.appendChild(this.tlcHandleResizeConstraint);
			this.tlcHandleResizeConstraint.appendChild(this.tlcHandleResize);
			
			this.tlcHandleConstraintLeft.appendChild(this.tlcHandleLeft);
			this.tlcHandle.appendChild(this.tlcHandleConstraintLeft);
			this.tlcHandleConstraintRight.appendChild(this.tlcHandleRight);
			this.tlcHandle.appendChild(this.tlcHandleConstraintRight);
			
			
		},
		updateControl: function(left,width,nonotify) {
			this.unclippedLeft = left;
			this.unclippedWidth = width;
			var pixelSpan = this.canvas_.offsetWidth;
			var clipleft = left;
			if (clipleft<0) clipleft = 0;
			if (clipleft>pixelSpan) clipleft = pixelSpan;
			var clipright = left + width;
			if (clipright<0) clipright = 0;
			if (clipright>pixelSpan) clipright = pixelSpan;
			var clipwidth = clipright-clipleft;

			this.tlcHandleSpan.style.width = clipwidth + 'px';
			this.tlcHandleSpan.style.left = clipleft + 'px';
			this.tlcHandleSpanLeft.style.width = clipleft + 'px';
			this.tlcHandleSpanRight.style.width = (pixelSpan-clipleft-clipwidth) + 'px';
			this.tlcHandleSpanRight.style.left = (clipleft+clipwidth) + 'px';
			this.tlcHandleConstraintLeft.style.width = (clipleft+clipwidth) + 'px';
			this.tlcHandleLeft.style.left = (clipleft-10) + 'px';
			this.tlcHandleConstraintRight.style.left = clipleft + 'px';
			this.tlcHandleConstraintRight.style.width = (pixelSpan-clipleft) + 'px';
			this.tlcHandleRight.style.left = (clipwidth) + 'px';
			
			var timeWindow = this.timeline.getWindow();
			var timeSpan = timeWindow.end-timeWindow.start;
			var start = timeWindow.start+timeSpan*left/pixelSpan;
			var end = timeWindow.start+timeSpan*(left+width)/pixelSpan;
			this.data.window_start = start;
			this.data.window_end = end;
			
			if (this.windowListener&&!nonotify) {
				this.windowListener(start,end);
			}
		},
		updateResizeControl: function(top, delta, nonotify){
			if (this.resizeListener&&!nonotify) {
				this.resizeListener(top,delta);
			}
		},
		resize: function(w,h) {
			this.timeline.resize(w,h);
			this.tlcHandle.style.width = w + 'px';
			this.tlcHandleConstraintLeft.style.width = (this.tlcHandleSpan.offsetLeft+this.tlcHandleSpan.offsetWidth)+'px';
			this.tlcHandleConstraintRight.style.width = (w-this.tlcHandleSpan.offsetLeft)+'px';
			this.tlcHandleConstraintRight.style.left = this.tlcHandleSpan.offsetLeft+'px';
			
			var tlcHandleSpanRightLeftVal = this.tlcHandleSpanRight.style.left;
			if ( tlcHandleSpanRightLeftVal.length ) {
				if (tlcHandleSpanRightLeftVal.indexOf('px', tlcHandleSpanRightLeftVal.length - 2) !== -1) {
					tlcHandleSpanRightLeftVal.length -= 2;
					tlcHandleSpanRightLeftVal = parseInt(tlcHandleSpanRightLeftVal);
				}
			}
			
			this.tlcHandleSpanRight.style.width = (w-tlcHandleSpanRightLeftVal) + 'px';
			
			this.tlcHandleResizeConstraint.style.top = '0px';
			this.tlcHandleResizeConstraint.style.left = (w-10) + 'px';
			this.tlcHandleResizeConstraint.style.top = '0px';
			this.tlcHandleResize.style.left = '0px';
			
			this.refreshControlWindow();
		},
		setControlWindow:function(controlWindow) {
			var timeWindow = this.timeline.getWindow();
			var timeSpan = timeWindow.end-timeWindow.start;
			var pixelSpan = this.canvas_.offsetWidth;
			var controlSpan = controlWindow.end-controlWindow.start;
			var left = pixelSpan*(controlWindow.start-timeWindow.start)/timeSpan;
			var width = pixelSpan*controlSpan/timeSpan;
			this.updateControl(left,width,true);
		},
		refreshControlWindow:function() {
			this.setControlWindow({start:this.data.window_start,end:this.data.window_end});
		},
        getControlWindow:function() {
            return {
                start:this.data.window_start,
                end:this.data.window_end
            }
        }
	});
	
	namespace.TimelineControl = TimelineControl;
	
	return namespace;
}(aperture.timelinecontrol || {}));

return aperture;
}(aperture || {}));