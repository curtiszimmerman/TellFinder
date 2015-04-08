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
 * Source: AjaxAppender.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Logging AJAX Appender Implementation
 */

/**
 * @namespace
 * @ignore
 * Ensure namespace exists
 */
aperture.log = (function(ns) {

	var AjaxAppender = aperture.log.Appender.extend(
	{
		init : function( spec ) {
			spec = spec || {};

			aperture.log.Appender.prototype.init.call(this, spec.level || aperture.log.LEVEL.WARN);
			this.url = spec.url;
			this.buffer = [];

			// Force the scope of postData to this, no matter
			// how it's usually called.
			this.postData = aperture.util.bind(this.postData, this);
			
			// Post data at requested interval
			setInterval(this.postData, spec.timeout || 3000 );

			// Also post if navigating away from the page
			$(window).unload( this.postData );
		},

		/** @private */
		logString : function( level, message ) {
			// Push a log record onto the stack
			this.buffer.push( {
				level: level,
				message: message,
				when: new Date()
			} );
		},

		/** @private */
		logObjects : function( level, objs ) {
			// Push a log record onto the stack
			this.buffer.push( {
				level: level,
				data: objs,
				when: new Date()
			} );
		},

		/**
		 * @private
		 * Causes the appender to post any queued log messages to the server
		 */
		postData : function() {
			if( buffer.length ) {
				// Simple fire and forget POST of the data
				$.ajax( {
					url: this.url,
					type: 'POST',
					data: this.buffer
				});

				// Clear buffer
				this.buffer = [];
			}
		}
	});

	/**
	 * @name aperture.log.addAjaxAppender
	 * @function
	 * @description
	 * <p>Creates and adds an AJAX appender object.
	 * The AJAX Appender POSTs log messages to a provided end-point URI
	 * using a JSON format.  Log messages are buffered on the client side
	 * and only sent to the server once every N seconds where N is settable
	 * upon construction.</p>
	 * <p>The data will be posted with the following format:</p>
	 * <pre>
	 * [
	 * { level:"warn", message:"A log message", when:"2011-09-02T17:57:33.692Z" },
	 * { level:"error", data:{some:"data"}, when:"2011-09-02T17:57:34.120Z" }
	 * ]
	 * </pre>
	 *
	 * @param {Object} spec specification object describing the properties of
	 * the ajax appender to build
	 * @param {String} spec.url the server endpoint to which log messages will be
	 * POSTed.
	 * @param {Number} [spec.timeout] period in milliseconds between when collected
	 * log messages are sent to the server.  Defaults to 3000
	 * @param {aperture.log.LEVEL} [spec.level] initial appender logging threshold level, defaults to WARN
	 *
	 * @returns {aperture.log.Appender} a new AJAX appender object that has been added
	 * to the logging system
	 */
	ns.addAjaxAppender = function(spec) {
		return ns.addAppender( new AjaxAppender(spec) );
	};

	return ns;
}(aperture.log || {}));
/**
 * Source: AlertBoxAppender.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Logging Alert Box Appender Implementation
 */

/**
 * @namespace
 * @ignore
 * Ensure namespace exists
 */
aperture.log = (function(ns) {


	var AlertBoxAppender = aperture.log.Appender.extend(
	{

		init : function(spec) {
			spec = spec || {};
			// Default to only popping up an alertbox for errors
			aperture.log.Appender.prototype.init.call(this, spec.level || aperture.log.LEVEL.ERROR);
		},

		logString : function( level, message ) {
			// Simply
			alert( level.toUpperCase() + ':\n' + message );
		}
	});

	/**
	 * @name aperture.log.addAlertBoxAppender
	 * @function
	 * @description Creates and adds an alert box implementation of a logging Appender to
	 * the logging system.  Pops up an alert box for every log message that passes the
	 * appender's threshold.  By default the threshold is set to ERROR to ensure alert boxes
	 * rarely appear.
	 *
	 * @param {Object} [spec] specification object describing the properties of the appender
	 * @param {aperture.log.LEVEL} [spec.level] initial appender logging threshold level, defaults to ERROR
	 *
	 * @return {aperture.log.Appender} a new alert box appender instance
	 */
	ns.addAlertBoxAppender = function(spec) {
		return ns.addAppender( new AlertBoxAppender(spec) );
	};

	return ns;
}(aperture.log || {}));
/**
 * Source: BufferingAppender.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Logging Buffering Appender Implementation
 */

/**
 * @namespace
 * @ignore
 * Ensure namespace exists
 */
aperture.log = (function(ns) {

	/*
	 * TODO A buffering appender may be much more useful if it decorates another
	 * appender.  A call to flush the buffer will log all buffered messages to
	 * the decorated appender.
	 */
	var BufferingAppender = aperture.log.Appender.extend(
	{
		init : function(spec) {
			spec = spec || {};

			aperture.log.Appender.prototype.init.call(this, spec.level || aperture.log.LEVEL.INFO);
			this.depth = spec.bufferDepth || 100;
			this.buffer = [];
		},

		logString : function( level, message ) {
			this.buffer.push( {level:level, message:message, when:new Date()} );
			if( this.buffer.length > this.depth ) {
				this.buffer.shift();
			}
		},

		logObjects : function( level, objs ) {
			this.buffer.push( {level:level, objects:objs, when:new Date()} );
			if( this.buffer.length > this.depth ) {
				this.buffer.shift();
			}
		},

		getBuffer : function( keepBuffer ) {
			var returnValue = this.buffer;
			if( !keepBuffer ) {
				this.buffer = [];
			}
			return returnValue;
		}
	});

	/**
	 * @name aperture.log.addBufferingAppender
	 * @function
	 *
	 * @description Creates and adds a buffering appender to the logging system.
	 * This appender stores most recent N log messages internally
	 * and provides a list of them on demand via a 'getBuffer' function.
	 *
	 * @param {Object} [spec] specification object describing how this appender
	 * should be constructed.
	 * @param {Number} [spec.bufferDepth] maximum number of log records to keep in
	 * the buffer, defaults to 100
	 * @param {aperture.log.LEVEL} [spec.level] initial appender logging threshold level, defaults to INFO
	 *
	 * @returns {aperture.log.Appender} a new buffering appender instance
	 */
	ns.addBufferingAppender = function(spec) {
		return ns.addAppender( new BufferingAppender(spec) );
	};

	return ns;
}(aperture.log || {}));
/**
 * Source: ConsoleAppender.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Logging Console Appender Implementation
 */

/*
 * console is a tricky thing to get working cross browser.  Potential
 * problems:
 * <ul>
 * <li>IE 7: No console object</li>
 * <li>IE 8: 'console' only exists after dev tools are open.  console.log functions
 * are not true JS Function functions and do not support 'call' or 'apply'.  A work
 * around using Function.prototype.bind to make an applyable version of the functions
 * (http://whattheheadsaid.com/2011/04/internet-explorer-9s-problematic-console-object)
 * is not possible due to missing Function.prototype.bind.</li>
 * <li>IE 9: 'console' only exists after dev tools are open.  console.log functions
 * are not true JS Function functions and do not support 'call' or 'apply'.
 * Function.prototype.bind does exist.</li>
 * </ul>
 *
 * Ben Alman / Paul Irish (see attribution below) wrote a nice bit of code that will
 * gracefully fallback if console.error, etc are not found.  Craig Patik addressed issues
 * in IE where the console is not available until the dev tools are opened as well as
 * calling the native console functions using .apply.  .apply calls are more desirable than
 * Alman/Irish solution since the browser may nicely format the passed in data instead of
 * logging everything as an array (like Alman/Irish do).
 *
 * @see Bits and pieces of Paul Irish and Ben Alman's
 * <a href="http://benalman.com/projects/javascript-debug-console-log/">console wrapper</a>
 * code was copied and modified below.
 * Original copyright message:
	 * JavaScript Debug - v0.4 - 6/22/2010
	 * http://benalman.com/projects/javascript-debug-console-log/
	 *
	 * Copyright (c) 2010 "Cowboy" Ben Alman
	 * Dual licensed under the MIT and GPL licenses.
	 * http://benalman.com/about/license/
	 *
	 * With lots of help from Paul Irish!
	 * http://paulirish.com/
 *
 * @see Craig Patik's <a href="http://patik.com/blog/complete-cross-browser-console-log/">original post</a>
 * inspired a number of the tweaks included below.
 */

/**
 * @namespace
 * @ignore
 * Ensure namespace exists
 */
aperture.log = (function(ns) {

	var ConsoleAppender = aperture.log.Appender.extend(
	{
		init : function(spec) {
			spec = spec || {};
			aperture.log.Appender.prototype.init.call(this, spec.level || aperture.log.LEVEL.INFO);

			this.map = [];
			// create a map of log level to console function to invoke
			// if console doesn't have the function, use log
			// level values actually map to console methods (conveniently enough)
			aperture.util.forEach(aperture.log.LEVEL, function(level, key) {
				this.map[level] = function() {
					var con = window.console;

					if ( typeof con == 'undefined' ) {
						return;
					}

					if (typeof con.log == 'object') {
						// IE 8/9, use Andy E/Craig Patik/@kangax call.call workaround
						// since the console.x functions will not support .apply directly
						// Note: Could call F.p.apply.call to truly emulate calling console.log(a,b,c,...)
						// but IE concatenates the params with no space, no ',' so kind of ugly
						if (con[ level ]) {
							Function.prototype.apply.call(con[level], con, arguments);
						} else {
							Function.prototype.apply.call(con.log, con, arguments);
						}
					} else {
						// Modern browser
						if (con.firebug) {
							con[ level ].apply( window, arguments );
						} else if (con[ level ]) {
							con[ level ].apply( con, arguments );
						} else {
							con.log.apply( con, arguments );
						}
					}
				};
			},
			this );
		},

		logString : function( level, message ) {
			// Simply log the string to the appropriate logger
			this.map[level]( message );
		},

		logObjects : function( level, objArray ) {
			// Call the appropriate logger function with all the arguments
			this.map[level].apply( null, objArray );
		}
	});

	/**
	 * @name aperture.log.addConsoleAppender
	 * @function
	 * @description Creates and adds a console implementation of a logging Appender to
	 * the logging system.  This appender works as follows:
	 * <ol>
	 * <li>If firebug exists, it will be used</li>
	 * <li>If console.error, console.warn, console.info and console.debug exist, they will
	 * be called as appropriate</li>
	 * <li>If they do not exist console.log will be called</li>
	 * <li>If console.log or console do not exist, this appender does nothing</li>
	 * </ol>
	 *
	 * @param {Object} [spec] specification object describing the properties of the appender
	 * @param {aperture.log.LEVEL} [spec.level] initial appender logging threshold level, defaults to INFO
	 *
	 * @returns {aperture.log.Appender} a new console appender instance
	 */
	ns.addConsoleAppender = function(spec) {
		return ns.addAppender( new ConsoleAppender(spec) );
	};

	return ns;
}(aperture.log || {}));
/**
 * Source: DOMAppender.js
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * @fileOverview Aperture Logging DOM Appender Implementation
 */

/**
 * @namespace
 * @ignore
 * Ensure namespace exists
 */
aperture.log = (function(ns) {

	var DOMAppender = aperture.log.Appender.extend(
	{
		init : function(spec) {
			spec = spec || {};

			aperture.log.Appender.prototype.init.call(this, spec.level || aperture.log.LEVEL.INFO);

			// Add the list
			var list = this.list = $('<ol class="aperture-log-display"></ol>')
				.appendTo( spec.container );

			// Add a clear button
			$('<button class="aperture-log-clear" type="button">Clear</button>')
				.click( function() { list.empty(); } )
				.appendTo( spec.container );
		},

		logString : function( level, message ) {
			// Append a list item styled by the log level to the list
			$('<li></li>')
				.text('[' + level + '] ' + message)
				.addClass('aperture-log-'+level)
				.appendTo(this.list);
		}
	});

	/**
	 * @name aperture.log.addDomAppender
	 * @function
	 *
	 * @description Creates and adds a DOM appender to the logging system. The DOM Appender
	 * logs all messages to a given dom element.  The given DOM
	 * element will have an ordered list of log messages and a "Clear" button added to it.
	 * Log messages will be styled 'li' tags with the class 'aperture-log-#' where # is the
	 * log level, one of 'error', 'warn', 'info', 'debug', or 'log'.  The list itself
	 * will have the class 'aperture-log-display' and the button will have the class
	 * 'aperture-log-clear'.
	 *
	 * @param {Object} spec specification object describing the properties of the appender
	 * @param {Element} spec.container the DOM element or selector string to the DOM element
	 * that should be used to log all messages.
	 * @param {aperture.log.LEVEL} [spec.level] initial appender logging threshold level, defaults to INFO
	 *
	 * @returns {aperture.log.Appender} a new DOM appender instance
	 */
	ns.addDomAppender = function(spec) {
		return ns.addAppender( new DOMAppender(spec) );
	};

	return ns;
}(aperture.log || {}));


return aperture;
}(aperture || {}));