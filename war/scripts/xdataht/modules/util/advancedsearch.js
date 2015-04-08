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
define(['./colors'], function(colors) {
    var FIELDS = {
        PHONE : 'Phone',
        WEBSITE : 'Website',
        EMAIL : 'Email',
        LOCATION : 'Location',
        TEXT : 'Text',
        STARTDATE: 'Start Date',
        ENDDATE: 'End Date'
    };
    var DATE_FIELDS = [FIELDS.STARTDATE,FIELDS.ENDDATE];

    var MODES = {
        EXPLORE : 'Explore Ads',
        GRAPH : 'Graph Ads',
        ENTITIES : 'List Entities',
        ATTRIBUTES : 'List Attributes'
    };

    var createModeSelectElement = function() {
        var element = $('<div/>');
        var label = $('<label/>')
            .addClass('advanced-search-mode-label')
            .text('Action:');
        element.append(label);
        var select = $('<select/>')
            .addClass('advanced-search-mode-select');
        element.append(select);

        Object.keys(MODES).forEach(function(modeKey) {
            var mode = MODES[modeKey];
            var option = $('<option/>')
                .text(mode);
            select.append(option);
        });
        return element;
    };

    var createTitleElement = function() {
        var element = $('<div/>')
            .addClass('advanced-search-text-summary')
            .append($('<span>Search for entities where all of the following apply</span>'))
        return element;
    };


    return {
        create : function(searchableProperties,searchCallback) {
            var _element = $('<div/>')
                .attr('title','Advanced Search')
                .addClass('advanced-search-dialog');

            var titleElement = createTitleElement();
            _element.html(titleElement);

            var onCancel = function() {
                $(this).remove();
            };

            var onSearch = function() {
                var descriptors = [];
                $.each(_element.find('.advanced-search-field-container'), function(idx,element) {
                    var attributeName = $(element).find('.advanced-search-field-label').text().trim();

                    var attributeValue = $(element).find('.advanced-search-field-input').val().trim();
                    if (DATE_FIELDS.indexOf(attributeName) !== -1 && attributeValue && attributeValue != '') {
                        attributeValue = $(element).find('.advanced-search-field-input').datepicker('getDate').getTime();
                    }

                    if (attributeValue !== '') {
                        descriptors.push({
                            name : attributeName,
                            value : attributeValue
                        });
                    }
                });

                var mode = _element.find('.advanced-search-mode-select').val();

                if (descriptors.length) {
                    searchCallback(descriptors, mode);
                    $(this).remove();
                } else {
                    alert('Please fill in at least one field to search on.');
                }
            };

            var fieldsContiner = $('<div/>')
                .addClass('advanced-search-fields')
                .appendTo(_element);
            Object.keys(FIELDS).forEach(function(fieldKey) {
                var fieldName = FIELDS[fieldKey];
                if (searchableProperties && searchableProperties.length > 0 && searchableProperties.indexOf(fieldName) === -1) {
                    return;
                }

                var fieldContainer = $('<div/>')
                    .addClass('advanced-search-field-container');

                var label = $('<div/>')
                    .addClass('advanced-search-field-label')
                    .text(fieldName);
                fieldContainer.append(label);

                var input = $('<input/>')
                    .attr('type','text')
                    .addClass('advanced-search-field-input');
                fieldContainer.append(input);

                // Special case, dates!
                if (DATE_FIELDS.indexOf(FIELDS[fieldKey]) !== -1) {
                    input.datepicker();
                }

                fieldsContiner.append(fieldContainer);
            });

            _element.append(createModeSelectElement());


            _element.dialog({
                resizeable:false,
                width:'400px',
                modal:true,
                position : {
                    my : 'center',
                    at : 'center',
                    of : window
                },
                buttons : {
                    Cancel : onCancel,
                    Search : onSearch
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
        },
        MODES : MODES,
        FIELDS : FIELDS
    }
});