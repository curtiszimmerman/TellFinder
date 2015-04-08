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
define([ '../util/rest','lib/Cloud5', '../util/colors'], function( rest,Cloud5,Colors) {

    var STOP_WORDS = aperture.config.get()['xdataht.config']['word-cloud']['stop-words'].split(',');

    var KEYWORDS = ['stable',
        'bottom',
        'daddy',
        'super bowl',
        'new year',
        'christmas',
        'newly arrived',
        'just visiting',
        'new in town',
        'fob',
        'fotb',
        'BB',
        'BBBJ',
        'OWO',
        'PSE',
        'baby',
        'fresh',
        'little',
        'young',
        'just started',
        'barely legal',
        'teen',
        'petite',
        'new to the game'
    ];
    var FLAGGED_WORD_MAP = {};          // built in init()

    var WHOLE_WORD_CLOUD_COLUMNS = [
        {col: 'region', sanitize: false},
        {col: 'name', sanitize: false},
        {col: 'ethnicity', sanitize: false},
        {col: 'age', sanitize: false},
        {col: 'bust', sanitize: false},
        {col: 'incall', sanitize: false},
        {col: 'city', sanitize: true} // Lots of junk in this column
    ];

    var SPLITTABLE_WORD_CLOUD_COLUMNS = [
        {col: 'title', sanitize: true, delim: ' '},
        {col: 'text_field', sanitize: true, delim: ' '},
        {col: 'outcall', sanitize: true, delim: ';'}
    ];

    var baseURL = null;

    // TODO: Make sure these regexps aren't too slow for the client.
    var sanitizeString = function(string) {
//        console.log('Before:\n' + string);
        string = string.toLowerCase();

        string = string.replace(/<(?:.|\n)*?>/gm, ''); // Strip HTML tags
        string = string.replace(/&(?:[a-z\d]+|#\d+|#x[a-f\d]+);/g, ''); // Strip character entities ('&nbsp', etc.)
        string = string.replace(/ad number: \d+/g,' '); // Replace "ad number: 532032"

        // TODO: Where would we like to go with matching phone numbers?
        // Match all phone numbers and add them to a list (do this before stripping special chars)
//        var phoneMatches = string.match(/^\s*([\(]?)\[?\s*\d{3}\s*\]?[\)]?\s*[\-]?[\.]?\s*\d{3}\s*[\-]?[\.]?\s*\d{4}$/g);

        string = string.replace(/\n/g,' '); // Replace newlines
        string = string.replace(/[_\W]/g, ' '); // Replace all non-alphanumeric chars

        string = string.trim();
        string = string.replace(/\s{2,}/g, ' ');

//        if (phoneMatches) {
//            for (var i=0; i<phoneMatches.length; i++) {
//                string += ' '+phoneMatches[i];
//            }
//        }

//        console.log('AFTER:\n'+ '\n------------------------------\n\n' + string );
        return string;
    };

    var createWidget = function(baseUrl, container, histogramData, selection) {
        baseURL = baseUrl;
        var widgetObj = {
            width: null,
            height: null,
            imageCallback: null,
            cloud : null,
            wordMap: {},
            wordToAdId : {},
            adIdToWord : {},
            filteredAdIds : [],
            processedRows : false,
            canvas : null,
            init: function() {
                this.imageCallback = function(response) {
                    var id = response.id;
                    var url = baseUrl + 'rest/image/' + id;
                    container.css('background-image','url('+url+')');
                };
                var jqCanvas = $('<canvas/>');
                container.append(jqCanvas);
                this.canvas = jqCanvas[0];

                KEYWORDS.forEach(function(keyword) {
                    keyword.split(' ').forEach(function(piece) {
                        if (STOP_WORDS.indexOf(piece)===-1) {
                            FLAGGED_WORD_MAP[piece] = true;
                        }
                    });
                });
            },

            selectionChanged: function(selectedAdIdArray) {
                if (this.width <= 0 || this.height <= 0) {
                    return;
                }
                if (!selectedAdIdArray || selectedAdIdArray.length == 0) {
                    this.filteredAdIds = [];
                } else {
                    this.filteredAdIds = selectedAdIdArray;
                }
                var words = {};
                var that = this;
                selectedAdIdArray.forEach(function(adid) {
                    var adwords = that.adIdToWord[adid];
                    adwords.forEach(function(word) {
                        words[word] = true;
                    });
                });
                if (this.cloud) {
	                this.cloud.unhighlight();
	                this.cloud.highlight(Object.keys(words),Colors.WORD_CLOUD_HIGHLIGHT);
                }
            },
            
            processRows: function() {
                // Compute a map of every word found in the included data fields for this cluster
                this.wordMap = {};
                this.wordToAdId = {};
                this.adIdToWord = {};

                var that = this;
                Object.keys(histogramData).forEach(function(id) {
                    if (that.filteredAdIds.indexOf(id) == -1 && that.filteredAdIds.length != 0) {
                        return;
                    }
                    var histogram = histogramData[id];
                    Object.keys(histogram).forEach(function(word) {
                        var count = that.wordMap[word];
                        if (count) {
                            that.wordMap[word] = count+1;
                        } else {
                            that.wordMap[word] = 1;
                        }

                        var adsForWord = that.wordToAdId[word];
                        if (!adsForWord) {
                            adsForWord = [];
                        }
                        adsForWord.push(id);
                        that.wordToAdId[word] = adsForWord;
                    });
                    that.adIdToWord[id] = Object.keys(histogram);
                });
            },

            fetchImage: function() {
                if (this.width <= 0 || this.height <= 0) {
                    return;
                }

                if (!this.processedRows) {
                    this.processRows();
                }

                var that = this;

                var getWordCounts = function(wordMap) {
                    var ret = [];
                    for (var word in wordMap) {
                        if (wordMap.hasOwnProperty(word)) {
                            ret.push({
                                word: word,
                                count: wordMap[word]
                            });
                        }
                    }
                    return ret;
                };
                var selectedWords = {};
                this.cloud = new Cloud5()
                    .canvas(this.canvas)
                    .width(this.width)
                    .height(this.height)
                    .maxWords(300)
                    .stop(STOP_WORDS)
                    .color(function(renderInfo,word) {
                        if (FLAGGED_WORD_MAP[word]) {
                            return 'red';
                        } else {
                            return 'black';
                        }
                    })
                    .wordMap(this.wordMap)
                    .onWordClick(function(word,e) {
                        var ctrl = e.ctrlKey;
                        // Update highlight in word cloud
                        if (ctrl) {
                            if (selectedWords[word]) {
                                that.cloud.unhighlight(word);
                                delete selectedWords[word];
                                selection.toggle('Word Cloud',that.wordToAdId[word]);
                            } else {
                                selectedWords[word] = true;
                                that.cloud.highlight(word,Colors.WORD_CLOUD_HIGHLIGHT);
                                selection.add('Word Cloud',that.wordToAdId[word]);
                            }
                        } else {
                            if (selectedWords[word]) {
                                that.cloud.unhighlight();
                                selectedWords = {};
                                selection.set('Word Cloud', []);
                            } else {
                                selectedWords = {};
                                selectedWords[word] = word;
                                that.cloud.unhighlight();
                                that.cloud.highlight(word, Colors.WORD_CLOUD_HIGHLIGHT);
                                selection.set('Word Cloud', that.wordToAdId[word]);
                            }
                        }


                    });
                var maxFontSize = this.canvas.height/2;
                var minFontSize = this.canvas.height/30;
                var fontFamily = $(document.body).css('fontFamily');
                if (fontFamily) {
                    this.cloud.font(fontFamily);
                }


                this.cloud.minFontSize(minFontSize)
                    .maxFontSize(maxFontSize)
                    .generate();
            },

            resize: function(width, height) {
                this.width = Math.floor(width);
                this.height = Math.floor(height);


                this.fetchImage();

            },

            destroy: function() {
                this.filteredAdIds = [];
            }
        };
        widgetObj.init();
        return widgetObj;
    };

    return {
        createWidget:createWidget
    }
});