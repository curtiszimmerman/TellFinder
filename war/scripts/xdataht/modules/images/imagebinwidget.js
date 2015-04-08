
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

define([ '../util/ui_util', '../util/rest'],
	function( ui_util, rest) {
		var createHistogram = function(histogram) {
			var $resultdiv = $('<div/>').css({width:'320px',height:'100px',background:'gray',position:'relative',float:'left'});
			for (var j=0; j<histogram.length; j+=2) {
				var size = parseInt('0x' + histogram[j] + histogram[j+1]);
				size = Math.min(100,size);
				var r = 64*((j>>5)&0x3);
				var g = 64*((j>>3)&0x3);
				var b = 64*((j>>1)&0x3);
				var $bar = $('<div/>').css({width:'5px',height:size+'px',overflow:'hidden',background:'rgb('+r+','+g+','+b+')',
					position:'absolute',left:((j/2)*5)+'px',bottom:'0px'});
				var $bar2 = $('<div/>').css({width:'5px',height:'20px',overflow:'hidden',background:'rgb('+r+','+g+','+b+')',
					position:'absolute',left:((j/2)*5)+'px',top:'0px'});
				$resultdiv.append($bar);
				$resultdiv.append($bar2);
			}
			return $resultdiv;
		};
		
		var createWidget = function(container, baseUrl) {
			var imagesWidgetObj = {
				init: function() {
					this.$imgscontainer = $('<div/>').css({position:'absolute',top:'0px',bottom:'0px',left:'0px',right:'0px',overflow:'auto'});
					$(container).append(this.$imgscontainer);
					var bin = ui_util.getParameter('bin');
					this.fetchImages(bin);
				},
				fetchImages: function(val) {
					var that = this;
					rest.get(baseUrl + 'rest/imagehash/bin/'+val, 'Fetch image bin',
						function(response) {
							that.$imgscontainer.empty();
							var histograms = {};
							for (var i=0; i<response.images.length; i++) {
								var image = response.images[i];
								if (histograms[image.histogram]) {
									histograms[image.histogram].hashes.push[{hash:image.sha1,width:image.width,height:image.height}];
								} else {
									histograms[image.histogram] = {url:image.url,hashes:[{hash:image.sha1,width:image.width,height:image.height}]};
								}
							}
							for (histogramStr in histograms) {
								if (!histograms.hasOwnProperty(histogramStr)) continue;
								var histogram = histograms[histogramStr];
								var $img = $('<img>');
								$img.attr('src', histogram.url);
								$img.css({float:'left'});
								var $imgcontainer = $('<div/>').css({overflow:'hidden'});
								$imgcontainer.append($img);
								$imgcontainer.append(createHistogram(histogramStr));
								var htext = $('<div/>')
								var html = histogramStr + '<BR/>';
								for (var i=0; i<histogram.hashes.length; i++) {
									var hash = histogram.hashes[i];
									html += hash.hash + ' (' + hash.width + ',' + hash.height + ')<BR/>';
								}
								htext.html(html);
								htext.css({position:'relative',float:'left'});
								$imgcontainer.append(htext);
								that.$imgscontainer.append($imgcontainer);								
							}
						}
					);
				}
			};
			imagesWidgetObj.init();
			return imagesWidgetObj;
	};
	
	return {
		createWidget:createWidget
	}
});
