/**
 * Copyright (C) 2011-2015 Uncharted Software Inc.
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

/*
 * Aperture
 */
aperture = (function(aperture){

aperture.datetimepicker = (
function(namespace) {
	var DateTimeWidget = function(elem) {
		var DateTimeWidgetObject = {
			init: function() {
				this.datePicker = document.createElement('input');
				this.datePicker.type = "text";
				elem.appendChild(this.datePicker);
				$(this.datePicker).datepicker().addClass("ui-widget ui-widget-content ui-corner-all").css({width:"150px",height:"22px",margin:"2px"});
				
				this.hourPicker = document.createElement('input');
				elem.appendChild(this.hourPicker);
				$(this.hourPicker).spinner({max:23,min:0}).css({width:"30px", display:"inline"});
				
				this.minutePicker = document.createElement('input');
				elem.appendChild(this.minutePicker);
				$(this.minutePicker).spinner({max:59,min:0}).css({width:"30px", display:"inline"});
			},
			setDate: function(date) {
				var year = date.getFullYear();
				var month = date.getMonth()+1;
				var day = date.getDate();
				var hour = date.getHours();
				var minute = date.getMinutes();
				$(this.datePicker).datepicker("setDate", month + "/" + day + "/" + year);
				$(this.hourPicker).spinner("value",hour);
				$(this.minutePicker).spinner("value",minute);
			},
			getDate: function() {
				var hour = $(this.hourPicker).spinner("value");
				if (hour==undefined) hour = 0;
				var minute = $(this.minutePicker).spinner("value");
				if (minute==undefined) minute = 0;
				var result = $(this.datePicker).datepicker("getDate");
				if (!result) return null;
				result.setHours(hour);
				result.setMinutes(minute);
				result.setSeconds(0);
				result.setMilliseconds(0);
				return result;
			}
		}
		DateTimeWidgetObject.init();
		return DateTimeWidgetObject;
	}
	
	namespace.DateTimeWidget = DateTimeWidget;

	return namespace;
}(aperture.datetimepicker || {}));

return aperture;
}(aperture || {}));