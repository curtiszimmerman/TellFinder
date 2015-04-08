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

define([ '../util/colors'],
	function( colors){

		var createWidget = function(widget, defaultHeight){

			var OBJECT_PADDING = 2,
                BUTTON_DIM = 20,
                LEGEND_LINE_WIDTH = 50,
                LEGEND_LINE_HEIGHT = 5,
				jqContainer = widget.controlsPanelContainer,
                legendWidgetObj = {
                    legendButton:null,
					bshowingLegend:amplify.store('bshowingLegend'),
                    legendCanvas:null,
					toggleButton:null,
                    init: function(){
						if(this.bshowingLegend===undefined) this.bshowingLegend = true;
                        this.createLegendCanvas();
                    },

                    onShowLegend: function() {
                        jqContainer.animate({
                            height: defaultHeight + 'px'
                        });
                        this.legendCanvas.animate({
                            opacity:1
                        });
                    },

                    onHideLegend: function() {
                        jqContainer.animate({
                            height: BUTTON_DIM + OBJECT_PADDING + 'px'
                        });
                        this.legendCanvas.animate({
                            opacity:0
                        });
                    },

                    createLegendCanvas: function(){
                        var that = this;

						//create toggle button
						this.toggleButton = $('<button/>').text('Toggle Layout').button({
							text:false,
							icons:{
								primary:'ui-icon-refresh'
							}
						}).css({
							position:'absolute',
							width: BUTTON_DIM + 'px',
							height: BUTTON_DIM + 'px',
							right: BUTTON_DIM + OBJECT_PADDING + 'px',
							'z-index': '999'
						}).click(function() {
							widget.isRadialLayout = !widget.isRadialLayout;
							amplify.store("graphLayout", widget.isRadialLayout);
							widget.layout();
						});

						jqContainer.append(this.toggleButton);

						//create legend button
                        this.legendButton = $('<button/>').text('Show legend').button({
                            text:false,
                            icons:{
                                primary:'ui-icon-help'
                            }
                        }).css({
                            position:'absolute',
                            width: BUTTON_DIM + 'px',
                            height: BUTTON_DIM + 'px',
                            right: '0px',
                            'z-index': '999'
                        }).click(function() {
                            if (that.bshowingLegend) {
                                that.onHideLegend();
                            } else {
                                that.onShowLegend();
                            }
							that.bshowingLegend = !that.bshowingLegend;
							amplify.store('bshowingLegend',that.bshowingLegend);
                        });
                        jqContainer.append(this.legendButton);

						//create the legend
                        this.legendCanvas = $('<div/>');
                        this.legendCanvas.append($('<div style="position: relative; left: 5px;">Linked by</div>'));
						var nodeLabel = $('<div/>').css({
								position: 'relative',
								float: 'right'
							}),
							node = $('<div/>')
								.css({
									background: colors.CIRCLE_TOTAL,
									'-moz-border-radius': '50%',
									'-webkit-border-radius': '50%',
									position: 'relative',
									'border-radius': '50%',
									border: '1.5px solid black',
									width:'15px',
									height:'15px',
									'z-index': 1,
									left: '16px'
								});
                        if(widget.ATTRIBUTE_MODE) {
                            var commonAdsLegend = $('<div/>'),
                                commonAdsLine = $('<div/>').css({
                                    width: LEGEND_LINE_WIDTH + 'px',
                                    height: LEGEND_LINE_HEIGHT + 'px',
                                    display: 'inline-block',
                                    top: '0px',
                                    position: 'relative',
                                    'background-color': colors.LINK_DEFAULT
                                }),
                                commonAdsLabel = $('<div/>').html('Common Ads').css({
                                    display: 'inline-block',
                                    'padding-left': OBJECT_PADDING + 'px',
									position: 'relative',
									top: '2px'
                                });
                            commonAdsLegend.append(commonAdsLine).append(commonAdsLabel);

							nodeLabel
								.html('Attribute Groups')
								.css({
									'padding-right': '18px',
									top:'-16px'
								});
							this.legendCanvas.append(commonAdsLegend).append(node.css('top','-1px')).append(nodeLabel);
                        } else {
                            var websiteLegend = $('<div/>');
                            var websiteLine = $('<div/>').css({
                                width: LEGEND_LINE_WIDTH + 'px',
                                height: LEGEND_LINE_HEIGHT + 'px',
                                display: 'inline-block',
                                top: '-2px',
                                position: 'relative',
                                'background-color': colors.LINK_WEBSITE
                            });
                            var websiteLabel = $('<div/>').html('Website').css({
                                display: 'inline-block',
                                'padding-left': OBJECT_PADDING + 'px'
                            });
                            websiteLegend.append(websiteLine).append(websiteLabel);
                            this.legendCanvas.append(websiteLegend);

                            var phoneLegend = $('<div/>');
                            var phoneLine = $('<div/>').css({
                                width: LEGEND_LINE_WIDTH + 'px',
                                height: LEGEND_LINE_HEIGHT + 'px',
                                display: 'inline-block',
                                top: '-2px',
                                position: 'relative',
                                'background-color': colors.LINK_PHONE
                            });
                            var phoneLabel = $('<div/>').html('Phone Number').css({
                                display: 'inline-block',
                                'padding-left': OBJECT_PADDING + 'px'
                            });
                            phoneLegend.append(phoneLine).append(phoneLabel);
                            this.legendCanvas.append(phoneLegend);

                            var emailLegend = $('<div/>');
                            var emailLine = $('<div/>').css({
                                width: LEGEND_LINE_WIDTH + 'px',
                                height: LEGEND_LINE_HEIGHT + 'px',
                                display: 'inline-block',
                                top: '-2px',
                                position: 'relative',
                                'background-color': colors.LINK_EMAIL
                            });
                            var emailLabel = $('<div/>').html('Email Address').css({
                                display: 'inline-block',
                                'padding-left': OBJECT_PADDING + 'px'
                            });
                            emailLegend.append(emailLine).append(emailLabel);
                            this.legendCanvas.append(emailLegend);
							nodeLabel
								.html('Entity Groups')
								.css({
									'padding-right': '19.5px',
									top: '-17.5px'
								});
							this.legendCanvas.append(node.css('top','-2px')).append(nodeLabel);
                        }
                        this.legendCanvas.width(jqContainer.width());
                        this.legendCanvas.css({
                            position: 'relative',
                            width: '100%',
                            height: defaultHeight + 'px',
                            opacity: 0
                        });
                        jqContainer.append(this.legendCanvas);
                        this.bshowingLegend?this.onShowLegend():this.onHideLegend();
                    }
			    };
			legendWidgetObj.init();
			return legendWidgetObj;
		};
		
		return{
			createWidget:createWidget
		}
	}
);