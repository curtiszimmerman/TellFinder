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
define(['../util/ui_util', '../util/colors', './aggregatesourcestime', './progress_timeline', './attributemodify'], function( ui_util, colors, aggregatesourcestime, progresstimeline, attributemodify) {

	var createWidget = function(container, baseUrl) {
		var	GLOBAL_START_TIME = new Date('2011/01/01'),
			GLOBAL_END_TIME = new Date(GLOBAL_START_TIME.getTime()+(3600000*24)*365*5),
			TIMELINE_BORDER = '2px solid ' + colors.STATUS_TIMELINE_BORDER,
			TIMELINE_HEIGHT = 25,
			TIMECONTROL_HEIGHT = 25,
			TITLE_HEIGHT = 20,
			DASHBOARD_HEIGHT = 85,
			ATTRIBUTE_MODIFY_HEIGHT = 110,
			statusWidget = {
			$attributeModifyContainer: null,
			$progressTimelineContainer: null,
			$timeChartContainer: null,
			$timelineContainer: null,
			$timelineControlContainer: null,
			attributeModify: null,
			progressChartHeight: null,
			progressTimeline: null,
			timeChart: null,
			timeline: null,
			timelineControl: null,
			timeChartHeight: null,

			init: function() {
				var that = this;
				//create title
				$(container).append($('<div/>')
					.css({
						float:'left',
						height: TITLE_HEIGHT + 'px',
						'font-family': 'Arial,Helvetica,sans-serif',
						'font-size': TITLE_HEIGHT - 1 + 'px'
					})
					.text('Memex TellFinder - System Health')
				);

				//create attributeModify widget
				this.createAttributeModify();


				//create processing progress widget
				this.createProgressTimeline();

				//create ad aggregation widget
				this.createTimeseries();
				this.timeChart.fetchData(function() {
					that.createDashboard(that.timeChart, parseInt(that.$timelineControlContainer.css('bottom')) + TIMECONTROL_HEIGHT + 'px');
				});
				this.createTimelineControl();
				this.createTimeline();
			},

			showStatus: function(status) {
				this.$serverStatus = $('<div/>').html('Server status<BR/>Active: ' + status.active + '<BR/>Staged: ' + status.staged);
				$(container).append(this.$serverStatus);
			},

			createProgressTimeline: function() {
				var that = this;
				this.progressChartHeight = this.getProgressChartHeight();
				this.$progressTimelineContainer = $('<div/>', {id:ui_util.uuid()}).css({
					position: 'absolute',
					width: '100%',
					height: this.progressChartHeight + 'px',
					top: TITLE_HEIGHT + DASHBOARD_HEIGHT + 'px',
					'border-bottom': TIMELINE_BORDER
				});
				$(container).append(this.$progressTimelineContainer);
				this.progressTimeline = progresstimeline.createWidget(this.$progressTimelineContainer, baseUrl, function() {
					that.createDashboard(that.progressTimeline, $(window).height() - parseInt(that.$progressTimelineContainer.css('top')) + 'px');
				});
			},

			createTimelineControl: function() {
				var that = this,
					id = ui_util.uuid(),
					timeWindow = this.timeChart.getTimeWindow(),
					data = {
						global_start: GLOBAL_START_TIME.getTime(),
						global_end: GLOBAL_END_TIME.getTime(),
						window_start: timeWindow.start,
						window_end: timeWindow.end
					};
				data.color = colors.STATUS_TIMELINE_BACKGROUND;
				this.$timelineControlContainer = $('<div/>', {id:id}).css({
					position: 'absolute',
					width: 'calc(100% - 4px)',
					height: TIMECONTROL_HEIGHT + 'px',
					'border-left': '2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					'border-right': '2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					bottom: parseInt(this.$timeChartContainer.css('bottom')) + this.timeChartHeight + TIMELINE_HEIGHT + 'px'
				});
				container.appendChild(this.$timelineControlContainer.get(0));
				this.timelineControl = new aperture.timelinecontrol.TimelineControl(this.$timelineControlContainer.get(0), id, data);
				this.timelineControl.windowListener = function(start,end) {
					that.timeline.setWindow(start,end);
					that.timeChart.setTimeWindow(start,end);
				};
				this.timelineControl.resize(parseInt($(container).width()),TIMELINE_HEIGHT);
			},

			createTimeseries: function() {
				this.timeChartHeight = this.getTimeChartHeight();
				this.$timeChartContainer = $('<div/>', {id:ui_util.uuid()});
				this.$timeChartContainer.css({
					position: 'absolute',
					width: 'calc(100% - 4px)',
					height: this.timeChartHeight + 'px',
					'border-left': '2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					'border-right': '2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					bottom: ATTRIBUTE_MODIFY_HEIGHT + 2 + 'px'
				});
				$(container)
					.append(this.$timeChartContainer)
					.append($('<div/>').css({
						position: 'absolute',
						bottom: ATTRIBUTE_MODIFY_HEIGHT + 'px',
						width: 'calc(100% - 4px)',
						'margin-top':'1px',
						border: TIMELINE_BORDER,
						'border-top':''
					}));
				this.timeChart = aggregatesourcestime.createWidget(this.$timeChartContainer, baseUrl);
				this.timeChart.resize(parseInt($(container).width()),this.timeChartHeight);
			},

			createTimeline: function() {
				this.$timelineContainer = $('<div/>', {id:ui_util.uuid()}).css({
					position: 'absolute',
					width: 'calc(100% - 4px)',
					height: TIMELINE_HEIGHT + 'px',
					bottom: parseInt(this.$timeChartContainer.css('bottom')) + this.timeChartHeight + 'px',
					'border':'2px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					'border-top':'3px solid ' + colors.OVERVIEW_TIMELINE_BORDER,
					'border-bottom':''
				});
				this.$timelineContainer.addClass('ui-corner-top');
				container.appendChild(this.$timelineContainer.get(0));

				var that = this,
					data = {
						band: this.timeChart.getTimeWindow(),
						color: colors.STATUS_TIMELINE_BACKGROUND,
						allowWheel: true
					},
					linkFn = function() {
						var timeWindow = that.timeline.getWindow();
						that.timelineControl.setControlWindow(timeWindow);
						that.timeChart.setTimeWindow(timeWindow.start,timeWindow.end);
					};
				// Create the timeline in the DOM
				this.timeline = new aperture.timeline.Timeline( {id:this.$timelineContainer.get(0).id, data:data, linker:linkFn} );
				this.timeline.wheelZoomListener = linkFn;
				this.timeline.resize(parseInt($(container).width()),TIMELINE_HEIGHT);
			},

			createAttributeModify: function() {
				var that = this;
				this.$attributeModifyContainer = $('<div/>').css({
					position: 'absolute',
					width: Math.min(600,$(window).width()) + 'px',
					height: ATTRIBUTE_MODIFY_HEIGHT + 'px',
					bottom: '0px'
				});
				$(container).append(this.$attributeModifyContainer);
				this.attributeModify = attributemodify.createWidget(this.$attributeModifyContainer, baseUrl, function() {
					var display = that.$attributeModifyContainer.css('display');
					if(display==='none') {

					} else {
						that.$attributeModifyContainer.css('display', 'none');
					}
				});
			},

			createDashboard: function(widget, bottom) {
				widget.$dashboard = $('<div/>').css({
					position: 'absolute',
					left: '0px',
					right: '0px',
					height: DASHBOARD_HEIGHT + 'px',
					bottom: bottom,
					'border-bottom':TIMELINE_BORDER,
					'background': colors.STATUS_LABEL_DEFAULT
				});

				$(container).append(widget.$dashboard);
				widget.createDashboard(widget.$dashboard);
			},

			resize: function(width,height) {
				this.width = width;
				this.height = height;

				this.timeChartHeight = this.getTimeChartHeight();
				this.$timeChartContainer.css('height', this.timeChartHeight+'px');
				this.$timelineContainer.css('bottom', parseInt(this.$timeChartContainer.css('bottom')) + this.timeChartHeight + 1 + 'px');
				this.$timelineControlContainer.css('bottom', parseInt(this.$timeChartContainer.css('bottom')) + this.timeChartHeight + TIMELINE_HEIGHT + 'px');
				if (this.timeChart) {
					this.timeChart.resize(width, this.timeChartHeight);
					if (this.timeChart.$dashboard) this.timeChart.$dashboard.css('bottom', parseInt(this.$timelineControlContainer.css('bottom')) + TIMECONTROL_HEIGHT + 'px');
				}
				if (this.timelineControl) this.timelineControl.resize(width,TIMECONTROL_HEIGHT);
				if (this.timeline) this.timeline.resize(width,TIMECONTROL_HEIGHT);

				this.progressChartHeight = this.getProgressChartHeight();
				this.$progressTimelineContainer.css('height', this.progressChartHeight + 'px');
				if (this.progressTimeline) {
					this.progressTimeline.resize(this.width,this.progressChartHeight);
					if (this.progressTimeline.$dashboard) this.progressTimeline.$dashboard.css('bottom', $(window).height() - parseInt(this.$progressTimelineContainer.css('top')) + 'px');
				}
			},

			getProgressChartHeight: function() {return (($(window).height()-ATTRIBUTE_MODIFY_HEIGHT-TITLE_HEIGHT)/2)-DASHBOARD_HEIGHT-4;},

			getTimeChartHeight: function() {
				var totalh = $(window).height();
				var timeh = Math.floor((totalh-ATTRIBUTE_MODIFY_HEIGHT-TITLE_HEIGHT)/2);
				return (timeh-DASHBOARD_HEIGHT-TIMECONTROL_HEIGHT-TIMELINE_HEIGHT-2);
			}
		};
		statusWidget.init();
		return statusWidget;
	};
	
	return {
		createWidget:createWidget
	}
});