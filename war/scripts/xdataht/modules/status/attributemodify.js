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
define([ '../util/ui_util', '../util/colors', '../util/rest'], function( ui_util, colors, rest) {
	var TEXT_INPUT_WIDTH = 200,
		createWidget = function($container, baseUrl) {
			var getDropDown = function() {
					return $('<select/>').css({
						position:'relative',
						float: 'left',
						height:'21px',
						width:'90px',
						'margin-right': '3px'
					})  .append($('<option/>').attr('value','email').text('email'))
						.append($('<option/>').attr('value','phone').text('phone'))
						.append($('<option/>').attr('value','website').text('website'));
				},

				widgetObj = {
				$invalidateAttributeContainer:null,
				$loaderDiv:null,
				$notifier:null,
				$renameAttributeContainer:null,

				init: function() {
					this.$loaderDiv = $('<div/>').css({
						'background' : 'url("./img/ajaxLoader.gif") no-repeat center center',
						'display' : 'none',
						'width' : $container.width(),
						'height' : $container.height()
					});
					this.$notifier =  $('<div/>').css({
						position: 'absolute',
						bottom: '0px',
						right: '0px',
						color: colors.STATUS_NOTIFIER,
						'text-align': 'right'
					});
					$container.append(this.$loaderDiv).append(this.$notifier);
					this.createInvalidateAttributeInput();
					this.createRenameAttributeInput();
				},

				createInvalidateAttributeInput: function() {
					var that = this,
						$instructions = $('<div/>').css({
							position:'relative',
							float:'left',
							clear:'right',
							width:'calc(100% - 20px)'
						}).text('Invalidate an attribute. WARNING! This is a potentially destructive and irreversible operation.'),
						$dropDown = getDropDown(),
						$textInput = $('<input/>')
							.attr('type','text')
							.attr('value','enter value to be invalidated')
							.css({
								position:'relative',
								float: 'left',
								width:TEXT_INPUT_WIDTH*2 + 7 + 'px',
								'margin-right': '3px'
							}),
						$invalidateButton = $('<button/>').css({
								position:'relative',
								width: '70px',
								float: 'left'
							})
							.text('Invalidate')
							.click(function() {
								that.toggleSpinner();
								that.invalidateAttribute($dropDown.find('option:selected').text(),$textInput.val());
							});
					this.$invalidateAttributeContainer = $('<div/>')
						.css({
							position:'relative',
							float:'left',
							width:'600px',
							padding:'5px'
						})
						.append($instructions)
						.append($dropDown)
						.append($textInput)
						.append($invalidateButton);
					$container.append(this.$invalidateAttributeContainer);
				},

				invalidateAttribute: function(attribute, value) {
					var that = this;
					rest.post(baseUrl + 'rest/server/invalidateValue/',
						'{"attribute":"' + attribute + '","value":"' + encodeURIComponent(value) + '"}',
						'Get time series',
						function(result) {
							that.toggleSpinner();
							that.$notifier.text(decodeURIComponent(result.message));
					});
				},

				createRenameAttributeInput: function() {
					var that = this,
						$instructions = $('<div/>').css({
							position:'relative',
							float:'left',
							clear:'right',
							width:'calc(100% - 20px)'
						}).text('Rename an attribute. WARNING! This is a potentially destructive and irreversible operation.'),
						$dropDown = getDropDown(),
						$textInputOldVal = $('<input/>')
							.attr('type','text')
							.attr('value','old value')
							.css({
								position:'relative',
								float: 'left',
								width:TEXT_INPUT_WIDTH + 'px',
								'margin-right': '3px'
							}),
						$textInputNewVal = $('<input/>')
							.attr('type','text')
							.attr('value','new value')
							.css({
								position:'relative',
								float: 'left',
								width:TEXT_INPUT_WIDTH + 'px',
								'margin-right': '3px'
							}),
						$renameButton = $('<button/>').css({
							position:'relative',
							width: '70px',
							float: 'left'
						})
							.text('Rename')
							.click(function() {
								that.toggleSpinner();
								that.renameAttribute($dropDown.find('option:selected').text(),$textInputOldVal.val(), $textInputNewVal.val());
							});
					this.$renameAttributeContainer = $('<div/>')
						.css({
							position:'relative',
							float:'left',
							width:'600px',
							padding:'10px'
						})
						.append($instructions)
						.append($dropDown)
						.append($textInputOldVal)
						.append($textInputNewVal)
						.append($renameButton);
					$container.append(this.$renameAttributeContainer);
				},

				renameAttribute: function(attribute, oldValue, newValue) {
					var that = this;
					if(oldValue.indexOf('\\') + newValue.indexOf('\\')>-2) {
						alert('Invalid string: cannot contain "\\"');
					} else {
						rest.post(baseUrl + 'rest/server/renameValue/',
							'{"attribute":"' + attribute +
							'","oldValue":"' + encodeURIComponent(oldValue) +
							'","newValue":"' + encodeURIComponent(newValue) + '"}',
							'Get time series',
							function (result) {
								that.toggleSpinner();
								that.$notifier.text(decodeURIComponent(result.message));
							});
					}
				},

				toggleSpinner: function() {
					if(this.$loaderDiv.css('display')==='none') {
						this.$notifier.text('');
						this.$loaderDiv.css('display','');
						this.$invalidateAttributeContainer.css('display','none');
						this.$renameAttributeContainer.css('display','none');
					} else {
						this.$loaderDiv.css('display','none');
						this.$invalidateAttributeContainer.css('display','');
						this.$renameAttributeContainer.css('display','');
					}
				}
			};
			widgetObj.init();
			return widgetObj;
		};

	return {
		createWidget:createWidget
	};
});