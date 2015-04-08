
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

define([ '../util/ui_util', '../util/rest', '../util/colors'],
function( ui_util, rest, colors) {
	var TITLE_HEIGHT = 20;
	var NEW_AD_THRESHOLD = 1000*3600*24*10;

	var rowOverFn = function() {
		$(this).css({
			background:colors.CASE_HOVER,
			cursor:'pointer'
		});
	};
	var rowOutFn = function() {
		$(this).css({
			background:'',
			cursor:''
		});
	};
	
	var rowClickFn = function() {
		var c = $(this).data('case');
		var content = $(this).data('content');
		var widget = $(this).data('widget');
		var url = widget.baseUrl + "graph.html?" + (content.ATTRIBUTE_MODE==='true'?"attributeid=":"clusterid=") + content.id +
				"&case_id=" + c.id + "&explorer=true";
		window.open(url, '_blank');
	};
	
	/**
	 * Fetch the data for a single case and add row divs to the case div
	 */
	var loadCase = function(widget, c) {
		var postdata = {'case_name': c.data.case, 'case_owner': c.data.owner, 'case_id': c.data.id};
		rest.post(widget.baseUrl + "rest/casebuilder/getcase/",
			postdata,
			"Case builder loadCaseContents",
			function (result) {
				var contents = result[c.data.case];
				if (!(contents&&contents.length)) {
					console.log("No data for case: " + c.data.case);
				}
				var maxDate = null;
				var totalAds = 0;
				for (var i=0; i<contents.length; i++) {
					var d = new Date(contents[i]['latestad']);
					var $rowDiv = $('<div/>').css({width:'100%',height:'15px'});
					var $rowLabel = $('<div/>').css({float:'left',width:'180px', 'padding-left':'20px', overflow:'hidden'}).text(contents[i].label);
					var $rowCount = $('<div/>').css({float:'left',width:'100px', 'padding-left':'5px', overflow:'hidden'}).text(contents[i]['Cluster Size'] );
					var $rowDate = $('<div/>').css({float:'left',width:'150px', 'padding-left':'5px', overflow:'hidden'}).text(ui_util.makeUTCDateString(d));
					var $rowAlert = $('<div>').css({width:'150px', 'padding-left':'5px', overflow:'hidden',color:'red'});
					if (new Date()-new Date(contents[i]['latestad'])<NEW_AD_THRESHOLD) {
						$rowAlert.text('New Data Alert!')
					}
					$rowDiv.attr('title', 'Click to explore ' + contents[i].label + ' in case ' + c.data.case);
					$rowDiv.append($rowLabel);
					$rowDiv.append($rowCount);
					$rowDiv.append($rowDate);
					$rowDiv.append($rowAlert);
					$rowDiv.mouseover(rowOverFn);
					$rowDiv.mouseout(rowOutFn);
					$rowDiv.click(rowClickFn);
					$rowDiv.data('case',c.data);
					$rowDiv.data('content',contents[i]);
					$rowDiv.data('widget',widget);
					c.$contentdiv.append($rowDiv);
					totalAds += Number(contents[i]['Cluster Size']);
					if (maxDate==null || d>maxDate) {
						maxDate = d;
					}
				}
				var $countLabel = $('<div>').css({float:'left',width:'100px', 'padding-left':'5px', overflow:'hidden'}).text(totalAds);
				c.$headerdiv.append($countLabel);
				var $latestLabel = $('<div>').css({float:'left',width:'150px', 'padding-left':'5px', overflow:'hidden'});
				if (maxDate) $latestLabel.text(ui_util.makeUTCDateString(maxDate));
				c.$headerdiv.append($latestLabel);
				var $alertLabel = $('<div>').css({width:'150px', 'padding-left':'5px', overflow:'hidden',color:'red'});
				if (maxDate && (new Date()-maxDate<NEW_AD_THRESHOLD)) {
					$alertLabel.text('New Data Alert!');
				}
				c.$headerdiv.append($alertLabel);
			},
			false,
			function () {
				console.log('Failed to get case data: ' + c.data.case);
			}
		);
	};

	/**
	 * Toggle visibility of case contents on click
	 */
	var caseDivClick = function(event) {
		var c = $(this).data('casedata');
		var widget = $(this).data('widget');
		c.contentVisible = !c.contentVisible;
		if (c.contentVisible) {
			c.$contentdiv.css('display','');
		} else {
			c.$contentdiv.css('display','none');
		}
	};

	/**
	 * Build the case display widget. Shows a list of cases with expandable contents.
	 */
	var createWidget = function(container, baseUrl) {
		var casesWidgetObj = {
			cases: {},
			baseUrl: baseUrl,
			init: function() {
				this.$casescontainer = $('<div/>').css({position:'absolute',top:(TITLE_HEIGHT+30)+'px',bottom:'0px',left:'0px',right:'0px',overflow:'auto'});
				$(container).append(this.$casescontainer);
				var bin = ui_util.getParameter('bin');
				this.createTitle();
				this.createLogout();
				this.fetchCases(bin);
			},

			createTitle: function() {
                this.imgDiv = $('<img/>', {src:'img/TellFinder_black.png'});
                this.imgDiv.css({
                	left: '2px',
                	right: '0px',
                	top: '0px',
                	height: '24px',
                	position: 'absolute'
                });
                container.appendChild(this.imgDiv.get(0));
                this.titleDiv = $('<div/>');
                this.titleDiv.css({
                	left: '160px',
                	right: '0px',
                	top: '0px',
                	height: TITLE_HEIGHT+'px',
                	position: 'absolute',
                	'font-family': 'Arial,Helvetica,sans-serif',
                	'font-size': '18px'
                });
                this.titleDiv.text("Case Files");
                container.appendChild(this.titleDiv.get(0));
			},

			createLogout: function() {
				var that = this;
				this.logoutButton = $('<button/>').text('Logout').button({
                    text:true
                }).addClass('logoutButton').css({
                    position:'absolute',
                    top:'1px',
                    right:'16px',
                    height:'18px',
                    padding: '.1em .5em'
                }).on('click',function(event) { 
                	window.location.href = 'logout';
                });
                container.appendChild(this.logoutButton[0]);
			
			},
			
			createTableHeaderDiv: function() {
				var $headerDiv = $('<div>').css({width:'100%',height:'20px',
	            	'font-family': 'Arial,Helvetica,sans-serif',
	            	'font-size': '15px',
	            	'font-weight': 'bold'
				});

				var $label = $('<div>').css({float:'left',width:'200px',overflow:'hidden'});
				$label.text("Case Name");
				$headerDiv.append($label);
				/*var $entityCount = $('<div>').css({float:'left',width:'100px','padding-left':'5px',overflow:'hidden'});
				$entityCount.text("Entity Count");
				$headerDiv.append($entityCount);*///TODO
				var $adCount = $('<div>').css({float:'left',width:'100px','padding-left':'5px',overflow:'hidden'});
				$adCount.text("Ad Count");
				$headerDiv.append($adCount);
				var $latestad = $('<div>').css({width:'150px','padding-left':'5px',overflow:'hidden'});
				$latestad.text("Latest Ad");
				$headerDiv.append($latestad);
				this.$casescontainer.append($headerDiv);
			},
			
			buildCaseDiv: function(data) {
				var that = this;
				var c = {
					data: data,
					$casediv: $('<div>'),
					$headerdiv:  $('<div>').css({width:'100%',height:'15px','user-select':'none'}),
					$contentdiv: $('<div>'),
					contentVisible: false
				};
				this.cases[c.id] = c;
				c.$headerdiv.mouseover(rowOverFn);
				c.$headerdiv.mouseout(rowOutFn);
				c.$headerdiv.attr('title', 'Click to expand ' + c.data.case);
				c.$headerdiv.data('casedata',c);
				c.$headerdiv.data('widget',this);
				c.$headerdiv.click(caseDivClick);
				var $label = $('<div>').css({float:'left',width:'200px',overflow:'hidden'});
				$label.text(c.data['case']);
				c.$headerdiv.append($label);
				c.$casediv.append(c.$headerdiv);
				c.$casediv.append(c.$contentdiv);
				c.$contentdiv.css('display','none');
				setTimeout(function() {loadCase(that,c);});
				this.$casescontainer.append(c.$casediv);
			},

			fetchCases: function(val) {
				var that = this;
				rest.get(baseUrl + "rest/casebuilder/getcases/","Get Cases",function(result) {
					that.$casescontainer.empty();
					that.createTableHeaderDiv();
					if (!(result&&result.cases&&result.cases.length)) return;
					for (var i=0; i<result.cases.length; i++) {
						that.buildCaseDiv(result.cases[i]);
					}
				});
			}
		};
		casesWidgetObj.init();
		return casesWidgetObj;
	};
	
	return {
		createWidget:createWidget
	}
});
