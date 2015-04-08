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
define([ '../util/ui_util', '../util/colors'], function( ui_util, colors) {
	var TIME_AXIS_HEIGHT = 25,
		LINE_OFFSET = 19,
		TIME_LABEL_WIDTH = 100;

	var extractLocations = function(dataRows) {
		var locationMap = {}, result = [];

		for (var i=0; i<dataRows.length; i++) {
			var ad = dataRows[i];
			var locationName = ad['incall'];
			var timeStr = ad['posttime'];
			if (!locationName) locationName = ad['locationLabel'];
			if (!locationMap[locationName]) {
				locationMap[locationName] = [];
			}
			if (timeStr==null) timeStr = ad['post_time'];
			if (timeStr==null) timeStr = ad['timestamp'];
			if (timeStr==null) timeStr = Number(ad['post_timestamp'])*1000;
			if (timeStr!=null) timeStr = Number(timeStr);
			if (timeStr==null || timeStr==0) continue;
			locationMap[locationName].push({ad:ad, time:new Date(timeStr), id:ad.id});
		}
		for (var l in locationMap) {
			if (!locationMap.hasOwnProperty(l)) continue;
			locationMap[l].sort(function(a,b) {
				if (!ui_util.isValidDate(a.time)) return 1;
				if (!ui_util.isValidDate(b.time)) return -1;
				return a.time-b.time;
			});
			result.push({name:l,ads:locationMap[l]});
		}
		result.sort(function(a,b) {
			if (a.ads.length==0) return 1;
			if (b.ads.length==0) return -1;
			if (!ui_util.isValidDate(a.ads[0].time)) return 1;
			if (!ui_util.isValidDate(b.ads[0].time)) return -1;
			return a.ads[0].time-b.ads[0].time;
		});
		return result;
	};

	var tickOver = function(e) {
		var elem = e.target,
			highlighted = elem.widget.adIds[elem.id].highlighted;
		elem.style.color = highlighted?colors.MOVEMENT_SELECTED_HOVER:colors.MOVEMENT_HOVER;
		elem.style['z-index'] = 4;
	};

	var tickOut = function(e) {
		var elem = e.target,
			highlighted = elem.widget.adIds[elem.id].highlighted;
		elem.style.color = (highlighted?colors.MOVEMENT_HIGHLIGHT:colors.MOVEMENT_TICK_DEFAULT);
		elem.style['z-index'] = (highlighted?3:1);
	};

	var tickClick = function(e) {
		if (e.ctrlKey) {
			this.selection.add('timeline', [this.id]);
		} else {
			this.selection.toggle('timeline', [this.id]);
		}
		this.widget.selectionChanged(this.selection.selectedAds);
		tickOver(e);
	};

	var getMousePos = function(e) {
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
	};
		
	/**
	 * FIELDS should be an array of {accessor, header, width}
	 * frame implements getTablePage and tableRowClicked
	 */
	createWidget = function(container, data, selection) {
		var widgetObj = {
			minTime:-1,
			maxTime:-1,
			centerTime:null,
			timeSpan:null,
			locationArray:null,
			adIds : {},
			ticks:[],
			timeline:null,
			$lineAxisContainer:null,
			$linesContainer:null,

			panning:false,
			splitting:false,
			initialized:false,

			init: function() {
				var that = this;
				this.initData();
				this.locationArray = extractLocations(data);
				this.setMinMaxTime();
			},

			selectionChanged: function(selectedAdIdArray) {
				//reset the adIds to unselected (false)
				for (var ad in this.adIds) {
					this.adIds[ad].highlighted = false;
				}
				//if the adId in selectedAdIdArray exists in the adIds, set it to selected (true)
				for (var i=0; i<selectedAdIdArray.length; i++) {
					var ad = selectedAdIdArray[i];
					if (this.adIds[ad]) this.adIds[ad].highlighted = true;
				}
				//trigger event to set styling
				for (var i=0;i<this.ticks.length;i++) {
					if (this.ticks[i].ad.posttime) tickOut({target: this.ticks[i].div});
				}
			},

			initData: function() {
				this.minTime = new Date("2012/01/01");
				this.maxTime = new Date(this.minTime.getTime()+(3600000*24)*365*2);
				for(var i=0;i<data.length;i++){
					this.adIds[data[i].id] = {
						highlighted : false,
						ad : data[i]
					};
				}
			},

			setMinMaxTime: function() {
				var tmin = -1,
					tmax = -1;
				for (var i=0; i<this.locationArray.length; i++) {
					for (var j=0; j<this.locationArray[i].ads.length; j++) {
						var time = this.locationArray[i].ads[j].time;
						if (ui_util.isValidDate(time)) {
							if (tmin==-1||tmin>time) tmin = time;
							if (tmax==-1||tmax<time) tmax = time;
						}
					}
				}
				if (tmin<0) {
					tmin = new Date();
					tmax = new Date();
				}
				this.minTime = new Date(tmin.getFullYear(), tmin.getMonth(), 0);
				if (tmax.getMonth()==11) {
					this.maxTime = new Date(tmax.getFullYear()+1, 0, 0);
				} else {
					this.maxTime = new Date(tmax.getFullYear(), tmax.getMonth()+1, 0);
				}
			},

			initTimeline: function() {
				var that = this,
					id = ui_util.uuid(),
					timelineData = {
						band:{
							"start":Date.parse(this.minTime),
							"end":Date.parse(this.maxTime)
						},
						allowWheel: true,
						color: colors.MOVEMENT_TIMELINE_BACKGROUND
					},
					linkFn = function(linkData) {
						//wheelZoomListener
						if(!linkData ) {
							that.timeSpan = this.getWindow().end - this.getWindow().start;
							that.centerTime = this.centerTime;
							that.pan();
							that.updateTicks();
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
							width:'calc(100% - ' + TIME_LABEL_WIDTH + 'px)',
							height:TIME_AXIS_HEIGHT + 'px',
							right:'0px',
							bottom:'1.5px',
							'z-index':10
						})
				);
				this.timeline = new aperture.timeline.Timeline( {id:id, data:timelineData, linker:linkFn} );
				this.timeline.wheelZoomListener = linkFn;
				this.timeline.resize($(container).width()-TIME_LABEL_WIDTH,TIME_AXIS_HEIGHT);
				this.timeSpan = this.timeline.getWindow().end - this.timeline.getWindow().start;
				this.centerTime = this.timeline.centerTime;
			},

			createCityLabel: function(locationData) {
				var that = this;
				var ads = locationData.ads.length;
				var tooltip = locationData.name + '\n' + ads + ' ad' + ((ads != 1)?'s':'');
				var label = $('<div class="cityLabel"/>').css({
						'overflow-x': 'hidden',
						'white-space': 'nowrap',
						'padding-top': '4px',
						'background-color':colors.MOVEMENT_CITY_LABEL_DEFAULT,
						position: 'relative',
						width: '100%',
						float: 'left',
						clear: 'left'
					})
					.text(locationData.name)
					.attr('title', tooltip)
					.mouseenter(function() {
						if(!that.panning && !that.splitting) {
							$(this).css({
								'background-color': colors.MOVEMENT_HOVER,
								cursor: 'pointer'
							});
						}
					})
					.mouseleave(function(e) {
						if(!that.panning && !that.splitting) {
							$(this).css({
								'background-color': colors.MOVEMENT_CITY_LABEL_DEFAULT,
								cursor: 'default'
							});
						}
					}).bind('click', function(e) {
						var $locationData = $(this).data(),
							adids = [];
						for (var i=0; i<$locationData.ads.ads.length; i++) {
							adids.push($locationData.ads.ads[i].id);
						}
						if(e.ctrlKey) {
							selection.add('timeline', adids);
						} else {
							selection.toggle('timeline', adids);
						}
						that.selectionChanged(selection.selectedAds);
					}).data('ads', locationData).data('highlighted',false);
				return label;
			},
			
			createSplitter: function() {
				var that = this;
				var startX, startY;
				this.$splitter = $('<div id="movementSplitter"/>').css({
					position:'absolute',
					height:'100%',
					width:'4px',
					cursor:'w-resize',
					left:(TIME_LABEL_WIDTH-2)+'px',
					'z-index':8,
					opacity:0
				}).draggable({
					axis:'x',
					start: function(e, ui) {
						if (!that.panning) {
							that.splitting=true;
							startX = getMousePos(e).x;
							that.$linesContainer.css('display','none');
							return true;
						}
					},
					drag: function(e, ui) {
						if (that.splitting && !that.panning && TIME_LABEL_WIDTH>=25) {
							var mp = getMousePos(e),
								newTimeLabelWidth = TIME_LABEL_WIDTH+(mp.x-startX);
							newTimeLabelWidth>25?TIME_LABEL_WIDTH=newTimeLabelWidth:TIME_LABEL_WIDTH=25;
							startX = mp.x;
							that.$cities.css('width',TIME_LABEL_WIDTH+'px');
						} else {
							that.splitting=false;
							TIME_LABEL_WIDTH=26;
						}
					},
					stop: function(e, ui) {
						that.splitting = false;
						that.$splitter.css('left',+(TIME_LABEL_WIDTH-2)+'px');
						$('#'+that.timeline.uuid).css('width',that.$locationContainer.width()-TIME_LABEL_WIDTH+'px');
						that.$linesContainer.css({
							width: 'calc(100% - ' + TIME_LABEL_WIDTH + 'px)',
							display:''
						});
						that.resize(that.$linesContainer.width(),that.$locationContainer.height());
					}
				});
			},
			
			createLocationContainer: function() {
				var that = this;
				var startX, startY;
				this.$locationContainer = $('<div id="locationContainer"/>').css({
					top:'0px',
					float:'left',
					width:'100%',
					'overflow-y':'scroll',
					'overflow-x':'hidden',
					height:'calc(100% - ' + (LINE_OFFSET + 3) + 'px)'
				}).bind('mousedown', function(e){
					if($(e.target).attr('id')!=='movementSplitter') {
						var mp = getMousePos(e);
						that.panning = true;
						startX = mp.x;
						startY = mp.y;
						that.timeline.handleDragEvent({eventType: 'dragstart'});
						e.preventDefault();
					}
				}).bind('mousemove', function(e){
					if(!that.splitting && that.panning) {
						var s = that.$locationContainer.scrollTop(),
							mp = getMousePos(e);
						that.$locationContainer.scrollTop(s-(mp.y-startY));
						startY=mp.y;
						e.preventDefault();
						that.timeline.handleDragEvent({
							eventType:'drag',
							dx: mp.x-startX
						});
					}
				}).bind('mouseup', function() {
					that.panning=false;
				}).bind("mousewheel DOMMouseScroll", null, function(e) {
					e.preventDefault();
				});
				$(container).append(this.$locationContainer);
			},
			
			draw: function() {
				if (this.initialized || this.height<21) return;
				this.initialized = true;
				var that = this;
				this.$cities = $('<div/>').css({
						position: 'relative',
						background: colors.MOVEMENT_CITY_LABEL_DEFAULT,
						width: TIME_LABEL_WIDTH + 'px',
						height: '100%',
						float: 'left',
						clear: 'left',
						'z-index': 8
					});
				this.createSplitter();
				this.createLocationContainer();
				this.initTimeline();
				this.timeline.bindMouseWheel('locationContainer');
				this.$linesContainer = $('<div/>').css({
					position: 'relative',
					'overflow': 'none',
					width: 'calc(100% - ' + TIME_LABEL_WIDTH + 'px)',
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
				for (var i=0; i < this.locationArray.length; i++) {
					var $cityLabel = this.createCityLabel(this.locationArray[i]);
					this.$cities.append($cityLabel);
					//the container for the ticks
					var $lineContainer = $('<div/>').css({
						position: 'absolute',
						top: (LINE_OFFSET * i) + 'px',
						width: '100%',
						height: LINE_OFFSET + 'px',
						left: '-5px', //offset for the UTF8 char ('\u25bc');// 2666
						'font-size':'20px'
					});
					this.locationArray[i].div = $lineContainer;
					this.createLocationTicks(this.locationArray[i]);
					this.$linesContainer.append($lineContainer);
					//add an axis line
					this.$lineAxisContainer.append($('<div/>').css({
						'border-top': '1px solid '+ colors.MOVEMENT_TICK_DEFAULT,
						position: 'absolute',
						top: ((LINE_OFFSET / 2) + (LINE_OFFSET * i)) + 'px',
						width: '100%',
						height: '1px',
						left:'0px',
						overflow:'hidden'
					}));
				}
				this.renderTicks();
				this.$linesContainer.append(this.$lineAxisContainer);
				this.$locationContainer.append(this.$cities).append(this.$splitter).append(this.$linesContainer);

				//add a reset button
				$(container).append($('<div/>').text('Clear Selected Ads')
						.button({
							disabled: false,
							text: false,
							icons:{
								primary:'ui-icon-arrowrefresh-1-e'
							}
						}).css({
							position: 'absolute',
							bottom:'1px',
							left:'-4px'
						}).click(function() {
							selection.set('timeline', []);
							that.selectionChanged(selection.selectedAds);
						})
				);
			},

			createLocationTicks: function(data) {
				var $lineContainer = data.div;
				var left = this.timeline.getWindow().start;
				var offsetFactor = 100/this.timeSpan;

				// Compute the location of all of the ticks and push them onto this.ticks
				for (var i=0; i<data.ads.length; i++) {
					var ad = data.ads[i].ad;
					var posttime = parseFloat(ad.posttime);
					if(isNaN(posttime)) continue;
					var leftOffset = (posttime - left) * offsetFactor + '%';
					this.ticks.push({
						ad: ad,
						adId: data.ads[i].id,
						container: $lineContainer,
						offset: leftOffset,
						posttime: posttime
					});
				}
			},
			
			renderTicks: function(data) {
				for (var i=0; i<this.ticks.length; i++) {
					var tick = this.ticks[i];
					var location = tick.ad.location;
					var title = tick.ad.title;
					var highlighted = this.adIds[tick.adId].highlighted;
					tickDiv = document.createElement('div');
					tick.div = tickDiv;
					tickDiv.widget = this;
					tickDiv.selection = selection;
					tickDiv.style.position = 'absolute';
					tickDiv.style.top = '-1px';
					tickDiv.style.cursor = 'pointer';
					tickDiv.style.height = '11px';
					tickDiv.style.clear = 'none';
					tickDiv.style.width = '5px';
					tickDiv.style['z-index'] = highlighted ? 3 : 1;
					tickDiv.style.color = (highlighted ? colors.MOVEMENT_HIGHLIGHT : colors.MOVEMENT_TICK_DEFAULT);
					tickDiv.style.left = tick.offset;
					tickDiv.id = tick.adId;
					tickDiv.title = ('ID: ' + tick.adId + ((location && location.length>0)?'\nLocation: ' + location:'') +
								 (tick.posttime ? '\nTimestamp: ' + (new Date(tick.posttime)).toString() : '') +
								 (title && title.length > 0 ? '\nTitle: ' + title : ''));
					//hover css changes
					tickDiv.onmouseover = tickOver;
					tickDiv.onmouseout = tickOut;
					tickDiv.onclick = tickClick;
					tickDiv.innerHTML = '\u25bc';// 2666
					tick.container[0].appendChild(tickDiv);
				}
			},

			updateTicks: function() {
				var left = this.timeline.getWindow().start;
				var offsetFactor = 100/this.timeSpan;
				for(var i=0; i<this.ticks.length; i++) {
					var tick = this.ticks[i];
					var posttime = parseFloat(tick.ad.posttime);
					if(isNaN(posttime)) continue;
					var leftOffset = (posttime-left)*offsetFactor;
					tick.div.style.left = leftOffset+'%';
				}
			},

			resize: function(width,height) {
				var redraw = (this.width !== width)
				this.height = height;
				this.width = width;
				this.draw();

				if (redraw && this.initialized) {
					this.timeline.resize($(container).width()-TIME_LABEL_WIDTH,TIME_AXIS_HEIGHT);
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
			},

			destroy: function() {}
		};
		widgetObj.init();
		return widgetObj;
	};

	return {
		createWidget:createWidget
	};
});