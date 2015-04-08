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
define([], function() {
    var topics = {};
    return {
        /**
         * Subscribe to a message channel
         * @param topic - the channel to subscribe to
         * @param listener - the callback function
         * @param self - option parameter.   Will be 'this' in the callback
         * @returns {{remove: Function}}
         */
        subscribe: function(topic, listener, self) {
            // Create the topic's object if not yet created
            if(!topics[topic]) {
                topics[topic] = { queue: [] };
            }

            // Add the listener to queue
            var index = topics[topic].queue.push({
                    func : listener,
                    self : self
                }) -1;

            // Provide handle back for removal of topic
            return {
                remove: function() {
                    delete topics[topic].queue[index];
                }
            };
        },

        /**
         * Publishes a message on the given channel
         * @param topic - the message channel publishing to
         * @param info - data object passed to the handler
         */
        publish: function(topic, info) {
            // If the topic doesn't exist, or there's no listeners in queue, just leave
            if(!topics[topic] || !topics[topic].queue.length) {
                return;
            }

            // Cycle through topics queue, fire!
            var items = topics[topic].queue;
            items.forEach(function(item) {
                if (item.self) {
                    item.func.call(item.self, info || {});
                } else {
                    item.func(info || {});
                }
            });
        },

        /**
         * An enum of topics that can be pub/subbed
         */
        topics: {
            'BRANCH_CLUSTER' 	    : 'branch_cluster',
            'BRANCH_ATTRIBUTE'      : 'branch_attribute',
            'PRUNE'                 : 'prune',
            'EXPAND_ROW' 		    : 'expand_row',
            'COLLAPSE_ROW'		    : 'collapse_row',
            'SHOW_MORE'			    : 'show_more',
            'SELECT_NODE'           : 'select_node',
            'SELECT_ATTRIBUTE'      : 'select_attribute',
            'CLEAR_SELECT_ATTRIBUTE': 'clear_select_attribute',
            'MOUSE_OVER_NODE'	    : 'mouse_over_node',
            'MOUSE_OUT_NODE'	    : 'mouse_out_node',
            'MOUSE_OVER_ATTRIBUTE'	: 'mouse_over_attribute',
            'MOUSE_OUT_ATTRIBUTE'	: 'mouse_out_attribute'
        }
    };
});