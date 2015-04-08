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
define([], function() {
	var createDropdown = function(options, width, callback) {
		var select = document.createElement('select');
		if (options) {
			for (var i=0; i<options.length; i++) {
				var option = options[i];
				var o = document.createElement('option');
				o.value = option;
				o.innerHTML = option;
				select.appendChild(o);
			}
		}
		$(select).change(callback).css({
            width:width+'px'
        });
		return select;
	};
	
	var setDropdownOptions = function(dropdown, options) {
		$(dropdown).empty();
		for (var i=0; i<options.length; i++) {
			var option = options[i];
			var o = document.createElement('option');
			o.value = option;
			o.innerHTML = option;
			dropdown.appendChild(o);
		}
	};
	
	var uuid = function() { 
		var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''), uuid = new Array(36), rnd=0, r;
		
    	for (var i = 0; i < 36; i++) {
      		if (i==8 || i==13 ||  i==18 || i==23) {
        		uuid[i] = '-';
      		} else if (i==14) {
        		uuid[i] = '4';
      		} else {
        		if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
        		r = rnd & 0xf;
        		rnd = rnd >> 4;
        		uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      		}
    	}
    	return uuid.join('');	
	};
	
	var entityMap = {
	    "&": "&amp;",
	    "<": "&lt;",
	    ">": "&gt;",
	    '"': '&quot;',
	    "'": '&#39;',
	    "/": '&#x2F;'
	  };

	var escapeHtml = function(string) {
		return String(string).replace(/[&<>"'\/]/g, function (s) {
			return entityMap[s];
		});
	};
	
	var getParameter = function(paramName) {
		var searchString = window.location.search.substring(1),
			i, val, params = searchString.split("&");
		for (i=0;i<params.length;i++) {
			val = params[i].split("=");
			if (val[0] == paramName) {
				return unescape(val[1]);
			}
		}
		return null;
	};
	
	var getParameters = function() {
		var searchString = window.location.search.substring(1),
			i, val, params = searchString.split("&"), result = {};
		for (i=0;i<params.length;i++) {
			val = params[i].split("=");
			result[val[0]] = unescape(val[1]);
		}
		return result;
	};
	
    var twoDigits = function(num) {
    	if (num<10) return "0" + num;
    	return num;
    };
    
    var isValidDate = function(d) {
  	  if ( Object.prototype.toString.call(d) !== "[object Date]" )
  	    return false;
  	  return !isNaN(d.getTime());
	};

    var makeDateTimeString = function(d) {
    	if (!isValidDate(d)) return "Invalid Date";
		return d.getFullYear() + "/" + twoDigits(1+d.getMonth()) + "/" + twoDigits(d.getDate()) + " " + 
			twoDigits(d.getHours()) + ":" + twoDigits(d.getMinutes());
    };

    var makeDateString = function(d) {
    	if (!isValidDate(d)) return "Invalid Date";
		return d.getFullYear() + "/" + twoDigits(1+d.getMonth()) + "/" + twoDigits(d.getDate());
    };

    var makeUTCDateString = function(d) {
    	if (!isValidDate(d)) return "Invalid Date";
		return d.getUTCFullYear() + "/" + twoDigits(1+d.getUTCMonth()) + "/" + twoDigits(d.getUTCDate());
    };

	var trunc = function(s, length){
		if(length && s.length>=length) {
			return s.substring(0,(length-3)) + '...';
		} else if (s.length>50) {
			return s.substring(0,47) + '...';
		}
		return s;
	};

	var clamp = function(minV,maxV,v) {
		if (v < minV) {
			return minV;
		} else if (v > maxV) {
			return maxV;
		} else {
			return v;
		}
	};

	/**
	 * Read CSV text with a header line and return an object with an array
	 * of objects for each subsequent line and an array of headers.
	 */
	var getObjectsFromCSV = function(text) {
		var i, lines = text.split('\n'),
			headers = lines[0].split(',');
		for (i=0; i<headers.length; i++) {
			headers[i] = headers[i].trim();
		}
		var result = {objects:[],headers:headers};
		for (i=1; i<lines.length; i++) {
			var fields = lines[i].split(','),
				object = {};
			if (fields.length==headers.length) {
				for (var j=0; j<headers.length; j++) {
					fields[j] = fields[j].trim();
					object[headers[j]] = fields[j];
				}
			}
			result.objects.push(object);
		}
		return result;
	};
	
	
	var makeFileDropTarget = function(elem, func) {
		function readFile(f) {
			var reader = new FileReader();
			// Closure to capture the file information.
			reader.onload = (function(theFile) {
				return function(e) {
				//var csvContents = getObjectsFromCSV(e.target.result);
					var csvContents = e.target.result.split('\n');
					func(csvContents);
				};
			})(f);

			reader.readAsText(f);
		}

		function readImage(f) {
			func(f,'image');
		}

        function readUrl(url) {
            func(url,'url');
        }

		function handleFileSelect(evt) {
			evt.stopPropagation();
			evt.preventDefault();
            if (evt.dataTransfer.files && evt.dataTransfer.files.length > 0) {
                var files = evt.dataTransfer.files;
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    if (file.type.indexOf('image') >= 0) {
                        readImage(file);
                    } else {
                        readFile(file);
                    }
                }
            } else if (evt.dataTransfer.items) {
                evt.dataTransfer.items[1].getAsString(function(html) {
                    var sources = []
                    $(html).each(function(idx,el) {
                        if (el.nodeName === 'IMG') {
                            sources.push(el.src);
                        }
                    });

                    readUrl(sources[0]);
                });
            }
		}

		function noopCallback(evt) {
			evt.stopPropagation();
			evt.preventDefault();
		}
		
		if ( elem.addEventListener ) {
			elem.addEventListener("dragenter", noopCallback, false);
			elem.addEventListener("dragexit", noopCallback, false);
			elem.addEventListener("dragover", noopCallback, false);
			elem.addEventListener('drop', handleFileSelect, false);
		}
	};

	var clearAmplify = function() {
		$.each(amplify.store(), function (storeKey) {
			// Delete the current key from Amplify storage
			amplify.store(storeKey, null);
		});
	};

	var formatTooltip = function (event, items) {
		var	item, i = 0,
			$attrContainer = $('<div/>').css({
				'text-align':'left',
				'font-weight':'bold',
				display:'inline-block',
				'margin-right':'3px'
			}),
			$valContainer = $('<div/>').css({
				'text-align':'left',
				display:'inline-block'
			}),
			getAttrDiv = function (text) {
				return $('<p/>').css({
					position:'relative',
					margin:'0px',
					right:'0px'
				}).text(text + ':');
			},
			getValDiv = function (text) {
				var num = parseFloat(text);
				if (!isNaN(num)) {
					if(num !== parseInt(text)) {
						text = num.toFixed(2);
					}
				}
				return $('<p/>').css({
					position:'relative',
					margin:'0px',
					left:'0px'
				}).text(text);
			};
		for (i; i<items.length; i++) {
			item = items[i];
			if(item.attr && (item.val || item.val == 0)) {
				$attrContainer.append(getAttrDiv(item.attr));
				$valContainer.append(getValDiv(item.val));
			} else if(item.header) {
				$attrContainer.append(getAttrDiv('').text(item.header));
				$valContainer.append(getValDiv(' '));
			}
		}
		return {event:event, html:($('<div/>').append($attrContainer).append($valContainer)).html()};
	};

	return {
		makeFileDropTarget:makeFileDropTarget,
		createDropdown:createDropdown,
		setDropdownOptions:setDropdownOptions,
		escapeHtml:escapeHtml,
		uuid:uuid,
		getParameter:getParameter,
		getParameters:getParameters,
		makeDateTimeString:makeDateTimeString,
		makeDateString:makeDateString,
		makeUTCDateString:makeUTCDateString,
		isValidDate:isValidDate,
		trunc:trunc,
		clamp:clamp,
		clearAmplify:clearAmplify,
		formatTooltip:formatTooltip
	}
});
