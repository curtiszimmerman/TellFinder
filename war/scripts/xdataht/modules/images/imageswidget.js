
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
				bins:null,
				selection:null,
				blur:true,
				init: function() {
					var that = this;
					$(window).unbind('keypress');
					$(window).keypress(function(e){
						if(e.charcode == 88 || e.charcode == 120 || e.which == 88 || e.which == 120) {
							that.blur = !that.blur;
							$('.htimage').css('-webkit-filter',that.blur?'blur(10px)':'');
						}
					});
					var $input = $('<input/>');
					$(container).append($input);
					var $b = $('<button/>').text('Fetch Images').button().click(
						function(event) {
							that.fetchImages($input.val());
						});
					var $b2 = $('<button/>').text('Fetch Bins').button().click(
							function(event) {
								that.fetchBins();
							});
					$(container).append($b);
					$(container).append($b2);
					this.$binscontainer = $('<div/>').css({position:'absolute',top:'40px',bottom:'0px',left:'0px',width:'150px',overflow:'auto'});
					$(container).append(this.$binscontainer);
					this.$imgscontainer = $('<div/>').css({position:'absolute',top:'40px',bottom:'0px',left:'150px',right:'0px',overflow:'auto'});
					$(container).append(this.$imgscontainer);
					this.fetchBins();
				},
				createBins: function() {
					var that = this;
					this.$binscontainer.empty();
					for (var i=0; i<this.bins.length; i++) {
						var bin = this.bins[i];
						if (bin.count<10) continue;
						var $bindiv = $('<div/>');
						$bindiv.data('bin', bin.bin);
						$bindiv.data('bindiv', $bindiv);
						$bindiv.text('Bin: ' + bin.bin + ' Count: ' + bin.count);
						this.$binscontainer.append($bindiv);
						$bindiv.click(function(event) { 
							that.fetchImages($(this).data('bin')); 
							if (that.selection!=null) {
								that.selection.css('background', '#AFA');
							}
							that.selection = $(this).data('bindiv');
							that.selection.css('background', '#AAF');
						} );
						$bindiv.mouseover(function(event) {
							that.fetchExemplar($(this).data('bin'));
//							var html = '<img src=' + 
//							aperture.tooltip.showTooltip({event:event,html:html});
						});
						$bindiv.mouseout(function(event) {
//							aperture.tooltip.hideTooltip();
						});
					}
				},
				fetchBins: function() {
					var that = this;
					if (this.bins==null) {
						rest.get(baseUrl + 'rest/imagehash/list', 'Fetch image list',
							function(response) {
								that.bins = response.bins;
								that.createBins();
							}
						);
					} else {
						this.createBins();
					}
				},
				showImages: function(response) {
					this.$imgscontainer.empty();
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
						$img.addClass('htimage');
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
						this.$imgscontainer.append($imgcontainer);								
					}
					$('.htimage').css('-webkit-filter',this.blur?'blur(10px)':'');
				},				
				fetchImages: function(val) {
					var that = this;
					rest.get(baseUrl + 'rest/imagehash/bin/'+val, 'Fetch image bin',
						function(response) {
							that.showImages(response);
						}
					);
				},
				fetchExemplar: function(val) {
					var that = this;
					rest.get(baseUrl + 'rest/imagehash/exemplar/'+val, 'Fetch image bin exemplar',
						function(response) {
							that.showImages(response);
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
