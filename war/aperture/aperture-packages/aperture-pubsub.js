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

/*
 * Aperture
 */
aperture = (function(aperture){

/**
 * Source: pubsub.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Publish / Subscribe (PubSub) API implementation
 */

/**
 * @namespace Aperture Publish / Subscribe (PubSub) API.
 * @requires OpenAjax Hub
 */
aperture.pubsub = (function() {

	/**
	 * @private
	 * Used for all propogated calls.
	 */
	function callHub( method, args ) {
		if (window.OpenAjax && OpenAjax.hub) {
			return OpenAjax.hub[method].apply( OpenAjax.hub, Array.prototype.slice.call(args, 0) );
		}
		else {
			aperture.log.error('An OpenAjax hub is required for aperture.pubsub, such as that provided by OpenAjaxUnmanagedHub.js.');
		}
	}
	
	/**
	 * Use the OpenAjax Hub for aperture pub sub
	 */
	return {
		
		/**
		 * Publishes a message
		 * @param {String} topic
		 *      The named message topic
		 * 
		 * @param message 
		 *      The payload of the message
		 * 
		 * @name aperture.pubsub.publish
		 * @function
		 */
		publish : function () {
			return callHub( 'publish', arguments );
		},

		/**
		 * Subscribes to a message topic
		 * @param {String} topic
		 *      The named message topic
		 * 
		 * @param {Function} handler 
		 *      The message handler function.
		 * 
		 * @param {Object} [context]
		 *      The optional context that will be the value of this when 
		 *      the handler is invoked.
		 * 
		 * @param {*} [subscriberData]
		 *      The optional data to pass as an argument to the handler.
		 * 
		 * @returns {String}
		 *      A subscription id to use for unsubscription.
		 * 
		 * @name aperture.pubsub.subscribe
		 * @function
		 */
		subscribe : function () {
			return callHub( 'subscribe', arguments );
		},
		
		/**
		 * Unsubscribes from a previous subscription.
		 * 
		 * @param {String} subscriptionId
		 *      A subscription id returned by a call to subscribe.
		 * 
		 * @name aperture.pubsub.unsubscribe
		 * @function
		 */
		unsubscribe : function () {
			return callHub( 'unsubscribe', arguments );
		}
	};
}());


return aperture;
}(aperture || {}));