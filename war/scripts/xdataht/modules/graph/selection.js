
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

define([ '../util/ui_util'],
    function( ui_util) {

    var createSelectionManager = function() {
		var selectionManager = {
			selectedAds:[],  		// Array of ad ids
			selectedAttribute:null,
			attributeAdMapping:{},
			listeners:{},			// Map of name->selection change callback
			set: function(setterName, adids) {
				this.selectedAds.length = 0;
				this.selectedAds.push.apply(this.selectedAds, adids);
				this.notify(setterName);
			},
			toggle: function(setterName, adids) {
				adids.sort();
				var sameAsSelected = false;
				if (adids.length==this.selectedAds.length) {
					sameAsSelected = true;
					for (var i=0; i<adids.length; i++) {
						if (adids[i]!=this.selectedAds[i]) sameAsSelected = false;
					}
				}
				this.selectedAds.length = 0;
				if (!sameAsSelected) {
					this.selectedAds.push.apply(this.selectedAds, adids);
				}
				this.notify(setterName);
			},
			add: function(setterName, adids) {
				adids.sort();
				var allfound = true;
				for (var i=0; i<adids.length; i++) {
					var newid = adids[i];
					if (this.selectedAds.indexOf(newid)<0) {
						allfound = false;
						this.selectedAds.push(newid);
					}
				}
				if (allfound) {	this.selectedAds = $(this.selectedAds).not(adids).get(); }
				this.notify(setterName);
			},
			listen: function(name, callback) {
				if (callback==null) delete this.listeners[name];
				else this.listeners[name] = callback;
			},
			notify: function(setterName) {
				for (var listener in this.listeners) {
					if (this.listeners.hasOwnProperty(listener) && listener!=setterName) {
						this.listeners[listener](this.selectedAds);
					}
				}
			},
			clear: function() {
				this.selectedAds.length = 0;
			},
			
			setAttributeSelected: function(setterName, type, value) {
				if (this.attributeAdMapping[type]) {
					var adids = this.attributeAdMapping[type][value];
					if (adids && adids.length>0) {
						this.set(setterName, adids);
					}
				}
			},
			addAttributeMapping: function(ad, attribute) {
				if (!ad[attribute]) return;
				var values = ad[attribute].split(',');
				for (var i=0; i<values.length; i++) {
					var val = values[i].trim();
					if (!this.attributeAdMapping[attribute]) {
						this.attributeAdMapping[attribute] = {};
					}
					if (!this.attributeAdMapping[attribute][val]) {
						this.attributeAdMapping[attribute][val] = [];
					}
					this.attributeAdMapping[attribute][val].push(ad.id);
				}
			},
			setAttributeMapping: function(ads) {
				for (var i=0; i<ads.length; i++) {
					var ad = ads[i];
					this.addAttributeMapping(ad, "phone");
					this.addAttributeMapping(ad, "images_hash");
					this.addAttributeMapping(ad, "email");
					this.addAttributeMapping(ad, "website");
				}
			}
		};
		return selectionManager;
	};
	
	return {
		createSelectionManager:createSelectionManager
	}
});