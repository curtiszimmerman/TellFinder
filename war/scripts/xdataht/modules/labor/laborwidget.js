
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

define([ '../util/ui_util', '../util/rest'],
	function( ui_util, rest) {

		
		var createWidget = function(container, baseUrl, location, category_id) {
			var rowOpenOver = function() {
					this.className += " ui-state-hover";
				},
				rowOpenOut = function() {
					this.className = this.className.replace(/\bui-state-hover\b/, " ");
				},
				laborWidgetObj = {
				ads : null,
				category : null,
				selectedRowDiv: null,
				bodyDiv: document.createElement('div'),
				init: function() {
					this.fetchAds();
				},
				fetchAds: function() {
					var that = this;
					rest.get(baseUrl + 'rest/overview/laborlocationcategory/'+category_id+'/'+encodeURIComponent(location), 'Get source counts', function(result) {
						that.ads = result.ads;
						that.category = result.category;
						that.createTable();
					});
				},
				createTable: function() {
					var that = this,
						rowHeight = '15px',
						posttimeWidth = '200px',
						idWidth = '70px',
						border = '1px solid gray',
						$containerDiv = $('<div/>').css('width','500px'),
						$header = $('<div/>').css({width:'100%',float:'left',height:rowHeight,'text-align':'center',clear:'right','margin-bottom':'2px'}),
						$tableContainer = $('<div/>').css({width:'298px',height:parseInt($(window).height())-50 + 'px', 'overflow-y':'scroll', 'overflow-x':'hidden'}).attr('title','click to view original HTML');


					$header.append($('<div/>').css({width:posttimeWidth,float:'left',border:border,height:rowHeight}).text('Post Time'));
					$header.append($('<div/>').css({width:idWidth,float:'left',border:border,'border-left':'',height:rowHeight}).text('Ad id'));
					$containerDiv.append($('<div/>').text(this.ads.length + ' ' + this.category + ' backpage ads found in ' + location))
						.append($header)
						.append($tableContainer);
					$(container).append($containerDiv);

					this.bodyDiv.style.width = 'calc(100% - 525px)';
					this.bodyDiv.style.overflowY = 'scroll';
					this.bodyDiv.style.position = 'absolute';
					this.bodyDiv.style.top = '5px';
					this.bodyDiv.style.right = '5px';
					this.bodyDiv.style.bottom = '5px';
					this.bodyDiv.style.border = '3px solid gray';

					$(container).append(this.bodyDiv);
					for(var i = 0; i<this.ads.length; i++) {
						var ad = this.ads[i],
							rowDiv = document.createElement('div'),
							postTimeDiv =  document.createElement('div'),
							adIdDiv = document.createElement('div');

						rowDiv.style.width = '274px';
						rowDiv.style.cssFloat = 'left';
						rowDiv.style.height = rowHeight;
						rowDiv.style.clear = 'right';
						rowDiv.style.cursor = 'pointer';
						rowDiv.id = ad.id;
						$(rowDiv).click(function(){
							if(that.selectedRowDiv)	that.selectedRowDiv.style.background = '';
							that.selectedRowDiv = this;
							this.style.background = '#AFA';
							that.bodyDiv.innerHTML = null;
							rest.get(baseUrl + 'rest/overview/getadhtml/'+this.id, 'Get source counts', function(result) {
								that.bodyDiv.innerHTML = result.body;
							});
						});
						rowDiv.onmouseover = rowOpenOver;
						rowDiv.onmouseout = rowOpenOut;

						postTimeDiv.innerHTML = new Date(ad.posttime).toUTCString();
						postTimeDiv.style.width = posttimeWidth;
						postTimeDiv.style.height = rowHeight;
						postTimeDiv.style.cssFloat = 'left';
						postTimeDiv.style.border = border;

						adIdDiv.innerHTML = ad.id;
						adIdDiv.style.width = idWidth;
						adIdDiv.style.height = rowHeight;
						adIdDiv.style.cssFloat = 'left';
						adIdDiv.style.border = border;
						adIdDiv.style.borderLeft = '';

						rowDiv.appendChild(postTimeDiv);
						rowDiv.appendChild(adIdDiv);

						$tableContainer[0].appendChild(rowDiv);
					}
				}
			};
			laborWidgetObj.init();
			return laborWidgetObj;
	};
	
	return {
		createWidget:createWidget
	}
});