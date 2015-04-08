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
define(['../util/rest', '../util/ui_util', '../util/menu', '../util/colors'], function( rest, ui_util, menu, colors) {
	var WINDOW_START_TIME = new Date('2014/03/30'),
		WINDOW_END_TIME = new Date(),
		AMPLIFY_PREFIX = 'status_',

	createWidget = function(container, baseUrl) {
		var aggregateTimeWidget = {
		timeChart: null,
		lineDisplayButton: null,
		temporalSourceData:null,
		timeMetaData:null,
		windowStart:null,
		windowEnd:null,
		maxY: 0,
		height:null,
		width:null,

		init: function() {
			var rangeX = new aperture.TimeScalar('time', [WINDOW_START_TIME,WINDOW_END_TIME]),
				bandedX = rangeX.banded(10,false),
				mapKey = bandedX.mapKey([0,1]);
			this.timeChart = new aperture.chart.Chart(container.get(0).id);
			this.timeChart.map('x').using(mapKey);
			var rangeY = new aperture.Scalar('vertical', [0,1]);
			this.timeChart.map('y').using(rangeY.mapKey([1,0]));
		},

		fetchData: function(callback) {
			var that = this;
			rest.get(baseUrl + 'rest/server/timeseriessources/', 'Get time series', function(result) {
				that.timeMetaData = result.timeMetaData;
				that.setData(result.sources['Total']['import']);
				that.setSourceData(result.sources);
				that.addLines();
				that.createLineDisplayButton();
				if(callback) callback();
			});
		},

		setTimeWindow: function(start, end) {
			var rangeX = new aperture.TimeScalar('time', [start,end]);
			var bandedX = rangeX.banded(10,false);
			var mapKey = bandedX.mapKey([0,1]);
			this.timeChart.map('x').using(mapKey);
			this.timeChart.all().redraw();
			this.windowStart = start;
			this.windowEnd = end;
		},

		getTimeWindow: function() {return {start: WINDOW_START_TIME.getTime(),	end: WINDOW_END_TIME.getTime()};},

		setData: function(data) {
			var rangeY = new aperture.Scalar('vertical', [0,1]), c;
			for (var i=0; i<data.length; i++) {
				if (data[i].day<=0) continue;
				c = Number(data[i].count);
				if (this.maxY<c) this.maxY = c;
			}
			this.setTimeWindow(WINDOW_START_TIME.getTime(), WINDOW_END_TIME.getTime());
			this.timeChart.map('y').using(rangeY.mapKey([1,0]));
			this.timeChart.all().redraw();
		},

		setSourceData: function(data) {
			var sourceData, source, isValid, typeArr, j, i = 0, visible,
				sources = Object.getOwnPropertyNames(data).sort(),
				types = Object.getOwnPropertyNames(data[sources[0]]).sort();
			this.temporalSourceData = [];
			for(i; i < sources.length; i++) {
				source = sources[i];
				sourceData = [];
				isValid = false;

				//only add sources that have at least one type of non-empty temporal data
				for(j = 0; j < types.length; j++) {if(data[source][types[j]] && data[source][types[j]].length>0) isValid = true;}

				for(j = 0; j < types.length; j++) {
					typeArr = data[source][types[j]];
					visible = amplify.store(AMPLIFY_PREFIX+source+'_'+types[j]);
					if(visible === undefined) {
						visible = false;
						amplify.store(AMPLIFY_PREFIX+source+'_'+types[j],visible);
					}
					sourceData.push({
						data: typeArr,
						records: typeArr?typeArr.length:0,
						color: i<colors.STATUS_SOURCES_ARRAY.length?colors.STATUS_SOURCES_ARRAY[i]:colors.STATUS_LINE_DEFAULT,
						type: types[j],
						visible: visible,
						source: source
					});
				}

				if(isValid) {
					fillDays(sourceData);
					for(j=0; j < sourceData.length; j++) {this.temporalSourceData.push(sourceData[j]);}
				}
			}
		},

		addLines: function() {
			var that = this;

			this.lineLayer = this.timeChart.addLayer( aperture.chart.LineSeriesLayer );
			this.lineLayer.all(this.temporalSourceData, 'source');

			this.lineLayer.map('x').from(function(index){return Number(this.data[index]['day']);});
			this.lineLayer.map('y').from(function(index) {
				return (index>=this.data.length)?0:(Number(Math.log(this.data[index].count) / Math.log(that.maxY)));
			});
			this.lineLayer.map('point-count').from('data.length');
			this.lineLayer.map('stroke-width').asValue(1);
			this.lineLayer.map('visible').from(function() {return (this.visible);});
			this.lineLayer.map('stroke').from(function() {return this.color;});
			this.lineLayer.map('stroke-style').from(function() {
				if(this.type=='import') return 'solid';
				else if (this.type=='mod') return 'dashed';
				else return 'dotted';
			});

			this.lineLayer.on('mouseover', function(event) {
				var tRange = that.windowEnd - that.windowStart,
					overtime = that.windowStart + tRange*event.source.clientX/$(container).width(),
					overrange = 1000*60*60*24,
					overstart = overtime - overrange,
					overend = overtime + overrange,
					html = '<B>' + event.data.source + ' ' + event.data.type + '</B> on ' + new Date(overtime).toDateString();

				for (var i=0; i<event.data.data.length; i++) {
					var d = event.data.data[i];
					if (d.day>=overstart && d.day<=overend) {
						html += '<BR/><B>' + (new Date(d.day)).toDateString() + ' count:</B>' + d.count;
					}
				}
				aperture.tooltip.showTooltip({event:event,html:html});
			});
			this.lineLayer.on('mouseout', function(event) {
				aperture.tooltip.hideTooltip();
			});
			this.timeChart.all().redraw();
		},

		createLineDisplayButton: function() {
			var that = this;
			if (this.lineDisplayButton) {
				this.lineDisplayButton.remove();
			}
			this.lineDisplayButton = $('<button/>').text('Select Sources').button({
				text:false,
				icons:{primary:'ui-icon-triangle-1-e'}
			}).css({
				position:'absolute',
				left:'0px',
				bottom:'2px',
				width:'14px',
				height:'14px',
				margin:'1px 2px 0px 2px'
			}).click(function(e) {
				that.createLineDisplayMenu(e);
			});
			$(container).append(this.lineDisplayButton);
		},

		createLineDisplayMenu: function(e) {
			var that = this,
				items = [],
				collections = {},
				sourcediv = $('<div/>')
					.css({position:'relative',overflow:'hidden',width:'100%','font-weight':'bold'})
					.on('mouseover',function() {$(this).css('background',colors.STATUS_HOVER);})
					.on('mouseout',function() {$(this).css('background','');}),
				labeldiv = $('<div/>').text('Source').css({position:'relative',float:'left'}),
				typediv = $('<div/>').text('Import/Mod/Post').css({position:'relative',float:'right','padding-left':'5px'});

			sourcediv.append(labeldiv).append(typediv);
			items.push({type: 'div', div: sourcediv});

			for (var i=0; i<this.temporalSourceData.length; i++) {
				var d = that.temporalSourceData[i],
					source = d.source;
				(function (d, source) {
					if (!collections[source]) {
						collections[source] = {
							use: false,
							type: 'collection',
							label: source,
							items: []
						};
					}

					if(collections[source].use===false) {collections[source].use = true;}

					collections[source].items.push({
						type: 'tandem_checkbox',
						label: d.records + ' ' + d.type + ' time records',
						checked: d.visible,
						callback: (d.data.length<1)?null:function(checked) {
								d.visible=checked;
								amplify.store(AMPLIFY_PREFIX+ d.source+'_'+ d.type, d.visible);
								that.timeChart.all().redraw();
							}
					});

					if(collections[source].use && source!=='Total') {
						delete (collections[source].use);
						items.push(collections[source]);
					}
				})(d, source);
			}
			delete (collections['Total'].use);
			items.push(collections['Total']);
			menu.createContextMenu(e, items);
		},

		createDashboard: function($container) {
			var timeTypes = Object.getOwnPropertyNames(this.timeMetaData).sort(),
				pCSS = {
					margin:'0px',
					'margin-bottom':'2px',
					'font-weight':'bold',
					'text-align':'center'
				},
				containerCSS = {
					position:'absolute',
					width:'310px',
					bottom:'0px'
				},
				infoCSS = {
					position:'relative',
					float: 'right',
					clear: 'right',
					'margin-bottom':'7px',
					height:'10px'
				},
				$summary = $('<div/>').css(containerCSS).css({'padding-left':'10px',left:'0px'})
					.append($('<p/>').css(pCSS).text('Time Spans')),
				$maxCounts = $('<div/>').css(containerCSS).css({'padding-right':'15px',right:'0px'})
					.append($('<p/>').css(pCSS).text('Maximum Counts'));
			for (var i = 0; i<timeTypes.length; i++) {
				var timeType = timeTypes[i],
					tmd = this.timeMetaData[timeType],
					$timeInfo = $('<div/>').css(infoCSS)
						.text(timeType + 's span: ' + new Date(tmd.minTime).toDateString() + ' to ' +
													new Date(tmd.maxTime).toDateString()),
					$countInfo = $('<div/>').css(infoCSS)
						.text(tmd.maxCount.toLocaleString() + ' ads ' + timeType + 'ed on ' +
													new Date(tmd.maxCountDay).toDateString());
				$summary.append($timeInfo);
				$maxCounts.append($countInfo);
			}
			$container
				.append($summary)
				.append($maxCounts)
				.append($('<div/>').css({
					position:'absolute',
					width:'100%',
					'text-align':'center',
					height:'16px',
					'padding-top':'3px',
					bottom:$summary.height()+'px',
					'font-weight':'bold',
					'font-size':'130%'
				}).text('Ad Crawl Aggregation'));
		},

		resize: function(width,height) {
			this.width = width;
			this.height = height;
			this.timeChart.all({width:width+'px',height:height+'px'}).redraw();
		}
	},

	fillDays = function(sourceData) {
		var d, yd, interval = 3600000*24,
			padDays = function(arr, min, max) {
				while(min < max) {
					arr.push({'count': 0, 'day': min});
					min += interval;
				}
			};
		for(var i = 0; i < sourceData.length; i++) {
			var newArr = [],
				arr = sourceData[i].data;
			newArr.push(arr[0]);
			for (var j = 1; j < arr.length; j++) {
				d = arr[j].day;
				yd = arr[j - 1].day;
				if(d - yd > (interval*1.5)) {
					padDays(newArr, yd + interval, d);
				}
				newArr.push({'count': arr[j].count, 'day': d});
			}
			sourceData[i].data = newArr;
		}
	};

	aggregateTimeWidget.init();
	return aggregateTimeWidget;
	};

	return {
		createWidget:createWidget
	}
});