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
define([ '../util/ui_util', '../util/colors', '../util/menu'], function( ui_util, colors, menu) {

	var publishAdSelection = function (widget, adids, ctrlKey) {
		if (ctrlKey) {
			widget.selection.add('images', adids);
		} else {
			widget.selection.toggle('images', adids);
		}
		widget.selectionChanged(widget.selection.selectedAds);
	};
	
	var showDialog = function(url) {
		var $dialog = $('<div/>');

		if (url!=null && url!='null') {
			$dialog.css({
				background: 'url("./img/ajaxLoader.gif") no-repeat center center',
				'overflow': 'hidden'
			})
			.attr('title', 'Press the x key to toggle blur');
			var $img = $('<img/>').attr('src', url).css({
				'width': 'auto',
				'-webkit-filter': amplify.store('tableBlur') ? 'blur(10px)' : ''
			}).addClass('img-dialog');
			$dialog.append($img);
			$img.on('load', function () {
				$dialog
					.css({'background':''})
					.dialog('option', 'width', Math.round($(window).width()/4) + 'px');
				$img.css('width', '100%');
				$dialog.dialog('option','position',{
					my: 'left top',
					at: 'left top',
					of: window
				});
			});
		} else {
			$dialog.css({
				background: '',
				'overflow': 'hidden'
			})
			.attr('title', 'No Cached Image Available');
		}

		$dialog.dialog({
			'max-height': $(window).height() + 'px',
			'width': Math.round($(window).width()/4) + 'px',
			position: {
				my: 'left top',
				at: 'left top',
				of: window
			},
			show: {
				effect: "fade",
				duration: 250
			},
			hide: {
				effect: "fade",
				duration: 250
			}
		});
		
		return $dialog;
	};
	
	var imageIconMouseEnter = function(event) {
		//add background-color style to attribute class
		var img = $(this).data().img,
			attrSelector = '.images_' + img.id;
		$(attrSelector).css('background-color', colors.IMAGES_ATTRIBUTE_HOVER);
    	var url = img.url;

        aperture.tooltip.showTooltip({event:{source:event}, html:
        	((url==null || url=='null')?'<B>Missing Image</B><BR/>':'') +
        	'<B>Image ID:</B>' + img.id + '<BR/>' +
        	'<B>Bin:</B>' + img.hash + '<BR/>' +
        	'<B>Count:</B>' + img.count + '<BR/>' +
        	'<B>Right click for options</B>'
        	});
		var $dialog = showDialog(img.url);
		$(this).data('dialog',$dialog);
	};
	
	var imageIconMouseLeave = function() {
		var img = $(this).data().img;
        aperture.tooltip.hideTooltip();
		$(this).data().dialog.dialog('close').remove();
		var attrSelector = '.images_' + img.id;
		$(attrSelector).css('background-color', '');
	};
	
	var doImageSearch = function(widget, bin, dialog) {
		if (widget.searchFn) {
			if(dialog) {
				dialog.dialog('close');
				setTimeout(function () {
					dialog.remove();
				}, 250);
			}
			widget.searchFn(bin);
		}
		aperture.tooltip.hideTooltip();
	};
	
	var imageIconDoubleClick = function() {
		var widget = $(this).data().widget;
		var img = $(this).data().img;
		var dialog = $(this).data('dialog');
		doImageSearch(widget, img.hash, dialog);
	};
	
	var imgIconContextMenu = function(e) {
	     var img = $(this).data().img;
	     var widget = $(this).data().widget;
	     var that = this;
	     e.preventDefault();
	     menu.createContextMenu(e, [
 	       {type: 'action', 
     	   	label:'Search database', 
     	   	callback:function() {
     	   		doImageSearch(widget, img.hash, null);
 	     	}},
	       {type: 'action', 
     	   	label:'Open image in new tab', 
     	   	callback:function() {
     	   		window.open(img.url, '_blank');
     	    }}
     	 ]);
	};
	
	var createImageDiv = function(widget,container,img) {
		img.$imgdiv = $('<div/>').css({height:'40px',width:'40px',overflow:'hidden',float:'left',border:'1px solid black'});
    	var url = img.url;
    	if (url==null || url=='null') url = 'img/blankthumbnail.png';
		var $img = $('<img/>')
			.addClass('img-dialog images_' + img.id)
			.css({'max-width':'40px',
				'-webkit-filter': amplify.store('tableBlur') ? 'blur(10px)' : ''})
			.attr('src', url)
			.click(function (e) {
				e.stopPropagation();
				publishAdSelection(widget, img.ads, e.ctrlKey);
			})
			.mouseenter(imageIconMouseEnter)
			.dblclick(imageIconDoubleClick)
			.mouseleave(imageIconMouseLeave)
			.bind('contextmenu', imgIconContextMenu)	
			.data('img',img)
			.data('widget',widget);
		
		img.$imgdiv.append($img);
    	container.append(img.$imgdiv);
	};
	
	var imageBinMouseEnter = function(event) {
		var bin = $(this).data().bin;
		var url = bin.imagesArray[0].url;
		aperture.tooltip.showTooltip({event:{source:event}, html:
        	((url==null || url=='null')?'<B>Missing Image</B><BR/>':'') +
        	'<B>Similar Image Set</B><BR/>' +
        	'<B>Bin:</B>' + bin.hash + '<BR/>' +
        	'<B>Count:</B>' + bin.count + '<BR/>' +
        	'<B>Right click for options</B>'
        	});
    	for (var i=0; i<bin.imagesArray.length; i++) {
    		var img = bin.imagesArray[i],
				attrSelector = '.images_' + img.id;
			$(attrSelector).css('background-color', colors.IMAGES_ATTRIBUTE_HOVER);
    	}
    	if (bin.imagesArray.length>0) {
    		img = bin.imagesArray[0];
			var $dialog = showDialog(img.url);
			$(this).data('dialog',$dialog);
    	}
	};
	
	var imageBinMouseOut = function(event) {
		var bin = $(this).data().bin,
			$dialog = $(this).data().dialog;
		if ($dialog) $dialog.dialog('close').remove();
		aperture.tooltip.hideTooltip();
    	for (var i=0; i<bin.imagesArray.length; i++) {
    		var img = bin.imagesArray[i],
				attrSelector = '.images_' + img.id;
			$(attrSelector).css('background-color', '');
    	}
	};
	
	var imageBinClick = function(event) {
		var bin = $(this).data().bin,
			widget = $(this).data().widget,
			allads = [];
    	for (var i=0; i<bin.imagesArray.length; i++) {allads = allads.concat(bin.imagesArray[i].ads);}
		publishAdSelection(widget, allads, event.ctrlKey);
	};

	var imageBinDoubleClick = function() {
		var widget = $(this).data().widget;
		var bin = $(this).data().bin;
		var dialog = $(this).data('dialog');
		doImageSearch(widget, bin.hash, dialog);
	};
	
	var toggleSetDisplay = function() {
		var bin = $(this).data().bin;
		var widget = $(this).data().widget;
		var $rowdiv = bin.$rowdiv;
		var $setdiv = bin.$setdiv;
		if ($setdiv) {
			$setdiv.remove();
			$rowdiv.css({overflow:'hidden',width:'40px',height:'40px'});
			bin.$setdiv = null;
		} else {
			$setdiv = $('<div>');
			bin.$setdiv = $setdiv;
			$rowdiv.css({overflow:'auto',width:'',height:''});
			$rowdiv.append($setdiv);
	    	for (var i=0; i<bin.imagesArray.length; i++) {createImageDiv(widget, $setdiv, bin.imagesArray[i]);}
			
		}
	};
	
	var imgBinContextMenu = function(e) {
		var bin = $(this).data().bin;
		var widget = $(this).data().widget;

		var that = this;
	    e.preventDefault();
    	if (bin.imagesArray.length>0) {
    		var img = bin.imagesArray[0];
    		var that = this;
		    menu.createContextMenu(e, [
		       {type: 'action', 
			    	label:'Search database', 
			    	callback:function() {
			    		doImageSearch(widget, bin.hash, null);
			    	}},
		       {type: 'action',
		    	label:'Select ads',
		    	callback:function() {
					var allads = [];
			    	for (var i=0; i<bin.imagesArray.length; i++) {allads = allads.concat(bin.imagesArray[i].ads);}
					publishAdSelection(widget, allads, event.ctrlKey);
		    	}},
		       {type: 'action', 
	    	   	label:'Open in new tab',
	    	   	callback:function() {
	    	   		window.open(img.url, '_blank');
	    	    }},
		       {type: 'action', 
	    	   	label:'Toggle similar image display', 
	    	   	callback:function() {
	    	   		toggleSetDisplay.call(that);
	    	    }}
	    	 ]);
    	}
	};
	
	var createBinRow = function(widget,container,bin) {
    	var $rowdiv = $('<div/>').css({height:'40px',width:'40px',overflow:'hidden',float:'left',border:'1px solid black'});
    	var url = bin.imagesArray[0].url;
    	if (url==null || url=='null') url = 'img/blankthumbnail.png';
    	var	$img = $('<img/>')
				.css({'max-width':'40px',
					'-webkit-filter': amplify.store('tableBlur') ? 'blur(10px)' : ''})
				.attr('src', url) // widget.baseUrl+'rest/imagehash/thumbnail/'+bin.imagesArray[0].id)
				.addClass('img-dialog')
				.mouseenter(imageBinMouseEnter)
				.mouseout(imageBinMouseOut)
				.click(imageBinClick)
				.dblclick(imageBinDoubleClick)
				.bind('contextmenu', imgBinContextMenu)	
				.data('bin',bin)
				.data('widget',widget);
    	$rowdiv.append($img);
		bin.$rowdiv = $rowdiv;
    	container.append($rowdiv);
	};
	
	var extractBinData = function(ads, binArray, binMap) {
		for (var i=0; i<ads.length; i++) {
			var ad = ads[i];
			if (ad.images && ad.images.length>0) {
				var vals = ad.images.split(','),
					ids = ad.images_id.split(','),
					hashes = ad.images_hash?ad.images_hash.split(','):null;
		        for (var j=0; j<vals.length; j++) {
		        	var id = ids[j],
						url = vals[j],
						hash = hashes?hashes[j]:id;
		        	if (hash==null || hash=='null') continue;
		        	if (!binMap[hash]) {
		        		binMap[hash] = {hash:hash,images:{},imagesArray:[],count:0};
		        		binArray.push(binMap[hash]);
		        	}
		        	if (!binMap[hash].images[id]) {
		        		binMap[hash].images[id] = {id:id,url:url,ads:[],count:0,hash:hash};
		            	binMap[hash].imagesArray.push(binMap[hash].images[id]);
		        	}
		        	binMap[hash].images[id].ads.push(ad.id);
		        	binMap[hash].images[id].count++;
		        	binMap[hash].count++;
		        }
			}
		}
		binArray.sort(function(a,b) {
			return b.count-a.count;
		});
		return binArray;
	};
	
    var createWidget = function(baseUrl, container, data, selection) {
        var widgetObj = {
        	binMap: {},
    	    binArray: [],
			selection: selection,
			baseUrl: baseUrl,
			imagesInitialized: false,
            init: function() {
                container.css({overflow:'auto'});
                extractBinData(data, this.binArray, this.binMap);
            },
            showImages: function() {
            	if (this.height && (this.height>1) && !this.imagesInitialized) {
                    container.append($('<div/>').text('Images grouped by color fingerprint: ' + this.binArray.length));
                	for (var i=0; i<this.binArray.length; i++) {
                		var bin = this.binArray[i];
                		bin.imagesArray.sort(function(a,b) { return b.count-a.count; });
    					bin.index=i+2;
                		createBinRow(this,container,bin);
                	}
            		this.imagesInitialized = true;
            	}
            },
            selectionChanged: function(adids) {
            	if (!this.imagesInitialized) return;
            	var fadeUnselected = (adids.length>0);
            	for (var hash in this.binMap) {
            		if (this.binMap.hasOwnProperty(hash)) {
            			var imgs = this.binMap[hash].images;
						var $rowdiv = this.binMap[hash].$rowdiv;
                    	for (var id in imgs) {
                    		if (imgs.hasOwnProperty(id)) {
                    			var image = imgs[id], found = false;
                    			for (var i=0; i<image.ads.length; i++) {
									if(adids.indexOf(image.ads[i]) > -1) {
										found = true;
										break;
									}
                    			}
                    			if (found) {
                    				$rowdiv.css({border:'1px solid ' + colors.IMAGES_HIGHLIGHT, opacity: 1});
                    				if (image.$imgdiv) image.$imgdiv.css('background-color',colors.IMAGES_HIGHLIGHT);
                    			} else {
                    				$rowdiv.css({border:'1px solid black',opacity:fadeUnselected?0.2:1});
                    				if (image.$imgdiv) image.$imgdiv.css('background-color','');
                    			}
                    		}
                    	}
            		}
            	}
            },
            destroy: function() {
            },
            resize: function(width, height) {
                this.width = width;
                this.height = height;
                container.css({width:width,height:height});
                this.showImages();
            }
        };
        widgetObj.init();
        return widgetObj;
    };

    return {
        createWidget:createWidget
    }
});