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
define([ '../util/ui_util', '../util/colors', '../util/rest'], function( ui_util, colors, rest) {
	var TIME_AXIS_HEIGHT = 25,
		LINE_OFFSET = 19,
		MIN_SPAN_WIDTH = 4.5,
		timeLabelWidth = 167,

		createWidget = function(container, baseUrl, callback) {
			var widgetObj = {
				minTime: null,
				maxTime: null,
				centerTime:null,
				timeSpan:null,
				data:null,
				spans:[],
				timeline:null,
				$lineAxisContainer:null,
				$linesContainer:null,
				init: function() {
					var that = this;
					rest.get(baseUrl + 'rest/server/processingprogress/', 'Get time series', function(result) {
						that.minTime= new Date(result.minTime);
						that.maxTime= new Date(result.maxTime);
						that.data=result.data;
						that.initTimeline();
						that.draw(result.processes);
						if(callback) callback();
					});
				},

				initTimeline: function() {
					var that = this,
						id = ui_util.uuid(),
						timelineData = {
							band:{
								"start":Date.parse(this.minTime)-(3600000*12),
								"end":Date.parse(this.maxTime)+(3600000*12)
							},
							color: colors.STATUS_TIMELINE_BACKGROUND,
							allowWheel: true
						},
						linkFn = function(linkData) {
							//wheelZoomListener
							if(!linkData ) {
								that.timeSpan = this.getWindow().end - this.getWindow().start;
								that.centerTime = this.centerTime;
								that.pan();
								that.redraw();
							} else if (linkData.action==='dragmove') {
								that.pan();
							}
						};
					//add container div for timeline
					$(container).append($('<div/>')
							.attr('id', id)
							.attr('title','Scroll to zoom')
							.css({
								position:'absolute',
								width:'calc(100% - ' + timeLabelWidth + 'px)',
								height:TIME_AXIS_HEIGHT + 'px',
								right:'0px',
								bottom:'-1px',
								'z-index':10
							})
					);
					this.timeline = new aperture.timeline.Timeline( {id:id, data:timelineData, linker:linkFn} );
					this.timeline.wheelZoomListener = linkFn;
					this.timeline.resize($(container).width()-timeLabelWidth,TIME_AXIS_HEIGHT);
					this.timeSpan = this.timeline.getWindow().end - this.timeline.getWindow().start;
					this.centerTime = this.timeline.centerTime;
				},

				draw: function(processes) {
					var $processLabel, $lineContainer, startX, startY,
						that = this,
						data = this.data,
						i = 0,
						panning=false,
						splitting=false,
						getMousePos = function(e) {
							var clientX = e.clientX,
								clientY = e.clientY;
							if (clientX==undefined) {
								if (e.originalEvent) {
									clientX = e.originalEvent.clientX;
									clientY = e.originalEvent.clientY;
								} else if (e.source) {
									clientX = e.source.clientX;
									clientY = e.source.clientY;
								}
							}
							return {x:clientX,y:clientY};
						},
						$processes = $('<div/>').css({
							position: 'relative',
							background: colors.STATUS_LABEL_DEFAULT,
							width: timeLabelWidth + 'px',
							height: '100%',
							float: 'left',
							clear: 'left',
							'z-index': 8
						}),
						$splitter = $('<div id="progressSplitter"/>').css({
							position:'absolute',
							height:'100%',
							width:'4px',
							cursor:'w-resize',
							left:(timeLabelWidth-2)+'px',
							'z-index':8,
							opacity:0
						}).draggable({
							axis:'x',
							start: function(e) {
								if (!panning) {
									splitting=true;
									startX = getMousePos(e).x;
									that.$linesContainer.css('display','none');
									return true;
								}
							},
							drag: function(e) {
								if(splitting && !panning && timeLabelWidth>=25) {
									var mp = getMousePos(e),
										newTimeLabelWidth = timeLabelWidth+(mp.x-startX);
									timeLabelWidth=newTimeLabelWidth>25?newTimeLabelWidth:25;
									startX = mp.x;
									$processes.css('width',timeLabelWidth+'px');
								} else {
									splitting=false;
									timeLabelWidth=26;
								}
							},
							stop: function() {
								splitting = false;
								$splitter.css('left',+(timeLabelWidth-2)+'px');
								$('#'+that.timeline.uuid).css('width',$locationContainer.width()-timeLabelWidth+'px');
								that.$linesContainer.css({
									width: 'calc(100% - ' + timeLabelWidth + 'px)',
									display:''
								});
								that.resize(that.$linesContainer.width(),$locationContainer.height());
							}
						}),
						$locationContainer = $('<div id="processContainer"/>').css({
							top:'0px',
							float:'left',
							width:'100%',
							'overflow-y':'scroll',
							'overflow-x':'hidden',
							height:'calc(100% - ' + (LINE_OFFSET + 3) + 'px)'
						}).bind('mousedown', function(e){
							if($(e.target).attr('id')!=='progressSplitter') {
								var mp = getMousePos(e);
								panning = true;
								startX = mp.x;
								startY = mp.y;
								that.timeline.handleDragEvent({eventType: 'dragstart'});
								e.preventDefault();
							}
						}).bind('mousemove', function(e){
							if(!splitting && panning) {
								var s = $locationContainer.scrollTop(),
									mp = getMousePos(e);
								$locationContainer.scrollTop(s-(mp.y-startY));
								startY=mp.y;
								e.preventDefault();
								that.timeline.handleDragEvent({
									eventType:'drag',
									dx: mp.x-startX
								});
							}
						}).bind('mouseup', function() {
							panning=false;
						}).bind("mousewheel DOMMouseScroll", null, function(e) {
							e.preventDefault();
						});
					$(container).append($locationContainer);
					this.timeline.bindMouseWheel('processContainer');
					this.$linesContainer = $('<div/>').css({
						position: 'relative',
						'overflow': 'none',
						width: 'calc(100% - ' + timeLabelWidth + 'px)',
						height: '100%',
						float:'left',
						left:'0px'
					});
					this.$lineAxisContainer = $('<div/>').css({
						position: 'absolute',
						'overflow': 'none',
						width: '100%',
						height: '100%',
						float:'left',
						left:'0px'
					});
					for (i; i < processes.length; i++) {
						var processName = processes[i];
						$processLabel = $('<div/>').css({
							'overflow-x': 'hidden',
							'white-space': 'nowrap',
							'padding-top': '4px',
							'background-color':colors.STATUS_LABEL_DEFAULT,
							position: 'relative',
							width: '100%',
							float: 'left',
							clear: 'left',
							cursor: 'default'
						})
						.text(processName)
						.mouseenter(function(e) {
							if(!panning && !splitting) {
								var data = $(this).data('data'),
									html = '<B>' + data.name + '</B> processed ' + data.records + ' times' +
										'<BR/><B>Average duration</B>: ' + formatDuration(parseInt(data.avgDuration));
								e.source = e;
								aperture.tooltip.showTooltip({event:e,html:html});
								$(this).css({'background-color': colors.STATUS_HOVER});
							}
						})
						.mouseleave(function() {
							if(!panning && !splitting) {
								aperture.tooltip.hideTooltip();
								$(this).css({'background-color': colors.STATUS_LABEL_DEFAULT});
							}
						})
						.data('data', addData(data[processName], processName));
						$processes.append($processLabel);
						//the container for the spans
						$lineContainer = $('<div/>').css({
							position: 'absolute',
							top: (LINE_OFFSET * i) + 'px',
							width: '100%',
							height: LINE_OFFSET + 'px',
							left: '-5px',
							'font-size':'20px'
						});
						this.$linesContainer.append($lineContainer);
						$locationContainer.append($processes).append($splitter).append(this.$linesContainer);
						if (data[processName] && data[processName].length) {
							this.createSpans($lineContainer, data[processName], $processLabel.data('data'));
						}
						//add an axis line
						this.$lineAxisContainer.append($('<div/>').css({
							'border-top': '1px solid '+ colors.STATUS_SHADOW,
							position: 'absolute',
							top: ((LINE_OFFSET / 2) + (LINE_OFFSET * i)) + 'px',
							width: '100%',
							height: '1px',
							left:'0px',
							overflow:'hidden'
						}));
					}
					this.$linesContainer.append(this.$lineAxisContainer);
				},

				createSpans: function($lineContainer, dataArr, metaData) {
					var $span, data, width, leftOffset, color,
						avgDuration = metaData.avgDuration,
						i = 0,
						left = this.timeline.getWindow().start,
						diff = this.timeline.getWindow().end-left,
						offsetFactor = 100/this.timeSpan,
						getColor= function(duration) {
							var v = Math.abs((duration - avgDuration) / avgDuration);
							if(v > .95) {return colors.STATUS_HEALTH_POOR}
							else if( v > .7) {return colors.STATUS_HEALTH_FAIR}
							return colors.STATUS_HEALTH_GOOD
						};

					for(i;i<dataArr.length;i++) {
						data = dataArr[i];
						color = getColor(data.duration);
						data.color=color;
						data.name=metaData.name;
						width = (data.duration*1000 / diff) * this.$linesContainer.width();
						leftOffset = (data.start-left)*offsetFactor+'%';
						$span = $('<div class="span"/>').css({
							position:'absolute',
							top:'5px',
							cursor:'pointer',
							height:'10px',
							clear:'none',
							'box-shadow': '2px 2px 1px ' + colors.STATUS_SHADOW,
							'border-radius': '5px',
							width:(width<MIN_SPAN_WIDTH?MIN_SPAN_WIDTH:width) + 'px',
							background:color,
							'z-index':3,
							left:leftOffset
						})
						.data('data',data)
						//hover css changes
						.mouseenter(function(e) {
							var data = $(this).data('data'),
								html = '<B>Process</B>: ' + data.name +
									'<BR/><B>Started</B>: ' + new Date(data.start).toString() +
									'<BR/><B>Ended</B>: ' + new Date(data.end).toString() +
									'<BR/><B>Duration</B>: ' + formatDuration(data.duration) +
									'<BR/><B>Ads processed</B>: ' + data.processed + ' (max ID: ' + data.last_processed + ')' +
									'<BR/><B>Clusters processed</B>: ' + data.clusterid + ' (max ID: ' + data.last_clusterid + ')';
							e.source = e;
							aperture.tooltip.showTooltip({event:e,html:html});
							$(this).css({background:colors.STATUS_HOVER});
						})
						.mouseleave(function() {
							$(this).css({background:$(this).data('data').color});
							aperture.tooltip.hideTooltip();
						});

						this.spans.push({
							data: data,
							$span:$span
						});
						$lineContainer.append($span);
					}
				},

				redraw: function() {
					var leftOffset, width, data,
						i = 0,
						left = this.timeline.getWindow().start,
						diff = this.timeline.getWindow().end-left,
						offsetFactor = 100/this.timeSpan;
					for(i;i<this.spans.length;i++) {
						data = this.spans[i].data;
						width = (data.duration*1000 / diff) * this.$linesContainer.width();
						leftOffset = (data.start-left)*offsetFactor+'%';
						this.spans[i].$span.css({'left':leftOffset+'%', width:(width<MIN_SPAN_WIDTH?MIN_SPAN_WIDTH:width) + 'px'});
					}
				},

				createDashboard: function($container) {
					$container
						.css('z-index', 8)
						.append($('<div/>').css({
							position:'absolute',
							top:'2px',
							width:'100%',
							'text-align':'center',
							height:'16px',
							'font-weight':'bold',
							'font-size':'130%'
						})
						.text('Oculus Pre-Processing Progress'));

					var spanCSS = {
							position:'relative',
							top:'1.5px',
							float:'left',
							clear:'left',
							'margin-bottom':'7px',
							cursor:'pointer',
							height:'10px',
							'box-shadow': '2px 2px 1px ' + colors.STATUS_SHADOW,
							'border-radius': '5px',
							width: MIN_SPAN_WIDTH + 'px'
						},
						spanTitleCSS = {
							position:'relative',
							'padding-left':'5px',
							float:'left',
							cursor:'pointer',
							height:'10px'
						},
						$legend = $('<div/>').css({
							position:'absolute',
							width:'600px',
							'padding-left':'10px',
							bottom:'3px'
						}),
						$goodSpan = $('<div/>').css(spanCSS).css('background',colors.STATUS_HEALTH_GOOD),
						$goodSpanTitle = $('<div/>')
							.css(spanTitleCSS)
							.text('Duration within 20% of average'),
						$fairSpan = $('<div/>').css(spanCSS).css('background',colors.STATUS_HEALTH_FAIR),
						$fairSpanTitle = $('<div/>')
							.css(spanTitleCSS)
							.text('Duration between 20% and 45% of average'),
						$poorSpan = $('<div/>').css(spanCSS).css('background',colors.STATUS_HEALTH_POOR),
						$poorSpanTitle = $('<div/>')
							.css(spanTitleCSS)
							.text('Duration outside of 45% of average');
					$legend
						.append($goodSpan)
						.append($goodSpanTitle)
						.append($fairSpan)
						.append($fairSpanTitle)
						.append($poorSpan)
						.append($poorSpanTitle);
					$container.append($legend);
				},

				resize: function(width,height) {
					this.height = height;
					if(this.width !== width && this.timeline) {
						this.timeline.resize($(container).width()-timeLabelWidth,TIME_AXIS_HEIGHT);
						var oldLeft = parseFloat(this.$linesContainer.css('left')),
							left = ((width/this.width)*oldLeft);
						this.$linesContainer.css('left',left + 'px');
						this.$lineAxisContainer.css('left', (this.timeline.centerRatio<0)?left:(-1*left) + 'px');
						this.width = width;
					}
				},

				pan: function() {
					var range = this.timeline.getWindow(),
						width = this.$linesContainer.width(),
						left = (((this.centerTime-range.start)/(range.end-range.start))*width)-(width/2);
					this.$linesContainer.css('left',left + 'px');
					this.$lineAxisContainer.css('left', (this.timeline.centerRatio<0)?left:(-1*left) + 'px');
				}
			},

			formatDuration = function(duration) {
				var hours = Math.floor(duration / 3600);
				duration %= 3600;
				var minutes = Math.floor(duration / 60),
					seconds = duration % 60,
					result = '';
				if(hours > 0) {
					result += hours + ' hour';
					if(hours > 1) result += 's';
				}
				if(minutes > 0) {
					result += (result.length>0?', ':'') + minutes + ' minute';
					if(minutes > 1) result += 's';
				}
				result += (result.length>0?', ':'') + seconds + ' second';
				if(seconds != 1) result += 's';
				return result;
			},

			addData = function(data, processName) {
				var avgDuration = 0;
				if (!data || !data.length) {
					return {
						records: 0,
						name: processName,
						avgDuration: 0
					};
				}
				data.sort(function(a,b) {
					return a.start - b.start;
				});
				for(var i = 0;i<data.length;i++) {
					avgDuration += data[i].duration;
					if(i===0) {
						data[i].processed = data[i].last_processed;
						data[i].clusterid = data[i].last_clusterid;
					} else {
						data[i].processed = data[i].last_processed - data[i-1].last_processed;
						data[i].clusterid = data[i].last_clusterid - data[i-1].last_clusterid ;
					}
				}
				return {
					records: data.length,
					name: processName,
					avgDuration: avgDuration/data.length
				};
			};
			widgetObj.init();
			return widgetObj;
		};

	return {
		createWidget:createWidget
	};
});