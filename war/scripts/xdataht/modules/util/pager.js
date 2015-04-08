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
    return {
        create : function(parentElement) {

            /**
             * HTML Elements
             */
            var _element;
            var _firstPage,_lastPage,_prevPage,_nextPage;
            var _pageCountElement,_totalPagesElement;

            /**
             * Handlers
             */
            var _onPageChange;
            var _onPageChangeContext;

            /**
             * State
             */
            var _page;
            var _totalPages;
            var _rows;
            var _rowsPerPage;

            var onPageChange = function() {
                if (_onPageChangeContext) {
                    _onPageChange.call(_onPageChangeContext, _getPageRows());
                } else {
                    _onPageChange(_getPageRows());
                }
            };

            var onFirst = function() {
                _page = 0;
                _update();
                onPageChange();
            };

            var onLast = function() {
                _page = _totalPages-1;
                _update();
                onPageChange();
            };

            var onPrev = function() {
                _page--;
                _update();
                onPageChange();
            };

            var onNext = function() {
                _page++;
                _update();
                onPageChange();
            };

            var goToPage = function(pageIdx) {
                _page = pageIdx;
                _update();
                onPageChange();
            };

            var _getPageRows = function() {
                var startRow = _page * _rowsPerPage;
                var endRow = startRow + _rowsPerPage;
                return _rows.slice(startRow,endRow);
            };

            var _initialize = function() {
                _page = 0;

                _element = $('<div/>')
                    .addClass('pager-container');

                _firstPage = $('<button/>')
                    .addClass('ui-button')
                    .addClass('pager-button')
                    .addClass('pager-button-first')
                    .click(function() {
                        onFirst();
                    }).appendTo(_element);
                _firstPage.button({
                    icons: {
                        primary: 'ui-icon-arrowthickstop-1-w'
                    },
                    text: false
                });

                _prevPage = $('<button/>')
                    .addClass('pager-button')
                    .addClass('ui-button')
                    .addClass('pager-button-prev')
                    .click(function() {
                        onPrev();
                    }).appendTo(_element);
                _prevPage.button({
                    icons: {
                        primary: 'ui-icon-arrowthick-1-w'
                    },
                    text: false
                });

                var countSpan = $('<span/>').appendTo(_element);
                _pageCountElement = $('<span/>')
                    .addClass('pager-page-count')
                    .appendTo(countSpan);

                $('<span/>').html('/').appendTo(countSpan);

                _totalPagesElement = $('<span/>')
                    .addClass('pager-pager-total')
                    .appendTo(countSpan);


                _nextPage = $('<button/>')
                    .addClass('pager-button')
                    .addClass('ui-button')
                    .addClass('pager-button-next')
                    .click(function() {
                        onNext();
                    }).appendTo(_element);
                _nextPage.button({
                    icons: {
                        primary: 'ui-icon-arrowthick-1-e'
                    },
                    text: false
                });


                _lastPage = $('<button/>')
                    .addClass('pager-button')
                    .addClass('ui-button')
                    .addClass('pager-button-last')
                    .click(function() {
                        onLast();
                    }).appendTo(_element);
                _lastPage.button({
                    icons: {
                        primary: 'ui-icon-arrowthickstop-1-e'
                    },
                    text: false
                });


                _update();
            };


            var _update = function() {

                _element.find('.pager-button').button({
                    disabled : false
                });

                _element.css('visibility','hidden');

                if (_rows && _rowsPerPage && _rows.length > _rowsPerPage) {
                    _totalPages = Math.ceil(_rows.length / _rowsPerPage);
                    _element.css('visibility','visible');
                } else {
                    _totalPages = 1;
                }

                if (_page === 0) {
                    _firstPage.button({
                        disabled : true
                    });
                    _prevPage.button({
                        disabled : true
                    });
                } else if (_page === _totalPages - 1) {
                    _lastPage.button({
                        disabled : true
                    });
                    _nextPage.button({
                        disabled : true
                    });
                }

                _pageCountElement.html(_page+1);
                _totalPagesElement.html(_totalPages);
            };
            _initialize();

            return {
                getElement : function() {
                    return _element;
                },
                rows : function(rows) {
                    if (rows) {
                        _rows = rows;
                        _page = 0;
                        _update();
                        return this;
                    } else {
                        return _rows;
                    }
                },
                rowsPerPage : function(rowsPerPage) {
                    _rowsPerPage = rowsPerPage;
                    _update();
                    return this;
                },
                onPageChange : function(callback,context) {
                    _onPageChange = callback;
                    _onPageChangeContext = context;
                    return this;
                },
                getPageRows : function() {
                    return _getPageRows();
                },
                sort : function(sortFn) {
                    _rows.sort(sortFn);
                    _page = 0;
                    _update();
                    onPageChange();
                },
                findRow : function(compareFn) {
                    if (_rows) {
                        for (var i = 0; i < _rows.length; i++) {
                            if (compareFn(_rows[i])) {
                                return i;
                            }
                        }
                    }
                },
                getPageForIndex : function(idx) {
                    return Math.floor(idx/_rowsPerPage);
                },
                goToPage : function(pageIdx) {
                    goToPage(pageIdx);
                }
            }
        }
    };
});
