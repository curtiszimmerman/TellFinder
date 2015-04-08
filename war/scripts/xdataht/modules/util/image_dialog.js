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
	var showImageDialog = function(url, width) {
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
					.dialog('option', 'width', width + 'px');
				$img.css('width', '100%');
				$dialog.dialog('option','position',{
					my: 'right bottom',
					at: 'right bottom',
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
			'width': width + 'px',
			position: {
				my: 'right bottom',
				at: 'right bottom',
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
	
	return {showImageDialog:showImageDialog}
});