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
define([ './ui_util'], function( ui_util) {

    var request = function (type, url, contentType, datastr, description, callback, ignoreEmptyResult, onError) {
        var request = {
            url: url,
            type: type,
            contentType: contentType,
            dataType: 'json',
            async: true,
            complete: function (result) {
                if (result.status!=200) {
                    if (result.status==204) {
                        if (ignoreEmptyResult) {
                            callback();
                            return;
                        }
                    }
                    if (onError) {
                        onError(result);
                    }
                    return;
                }
                var data = $.parseJSON(result.responseText);
                callback(data);
            },
            error: function (request, status, error) {
            	if (onError) onError({status:request.status,message:request.statusText});
            }
        };

        if (datastr) {
            if (typeof datastr == 'string' || datastr instanceof String) {
                request.data = datastr;
            } else {
                request.data = JSON.stringify(datastr);
            }
        }
        try {
        	$.ajax(request);
        } catch (err) {
            if (onError) {
                onError(err);
            }
        }
    };


    return {
        post : function (url, datastr, description, callback, ignoreEmptyResult, onError) {
            request('Post', url, 'application/json; charset=utf-8', datastr, description, callback, ignoreEmptyResult,onError);
        },
        postBinary: function (url, data, description, callback, ignoreEmptyResult, onError) {
            request('Post', url, 'multipart/form-data', data, description, callback, ignoreEmptyResult,onError);
        },
        get : function(url, description, callback, onError) {
            request('Get', url, 'application/json; charset=utf-8', '', description, callback, false, onError);
        },
        delete : function(url, params, description, callback, ignoreEmptyResult, onError) {
            request('Delete', url, 'application/json; charset=utf-8', params, description, callback, ignoreEmptyResult,onError);
        },
        hashMapToJSON : function(map) {
            var ret = {};
            for (var i = 0; i < map.map.entry.length; i++) {
                ret[ map.map.entry[i].key] =  map.map.entry[i].value;
            }
            return ret;
        }
    };
});
