/*
 * Copyright (c) 2015 Uncharted Software Inc.
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

define(function(require) {
	var rest = 	require('xdataht/modules/util/rest');
	require('lib/underscore');

	var baseUrl = "rest/classifiers";
	var classifiers = null; 	// array of classifier names and corresponding keywords

	var selectedClassifier = null;
	var keywordsAdded = [];
	var keywordsRemoved = [];

	var newKeywordField, newConceptField, progressbar, applyCtrl, discardCtrl;

	function start() {
		getClassifiers();

		$('#addKeywordCtrl').click(onAddKeyword);
		newKeywordField = $('#newKeywordField');
		newKeywordField.keyup(function (event) {
			if (event.which === 13) { onAddKeyword(); }
		});

		$('#addConceptCtrl').click(onAddConcept);
		newConceptField = $('#newConceptField');
		newConceptField.keyup(function (event) {
			if (event.which === 13) { onAddConcept(); }
		});

		applyCtrl = $('#applyChangesCtrl').button({disabled : true}).click(updateKeywordsOnServer);
		discardCtrl = $('#discardChangesCtrl').button({disabled : true}).click(getClassifiers);
		$('#reclassifyCtrl').button().click(reclassify);

		progressbar = $( "#progressbar" ).progressbar({ value: 0 });
	}

	/** Get the set of classifiers and keywords from the server. */
	function getClassifiers() {
		$('#errorMsg').text('');
		var fetchUrl = baseUrl + '/fetch';
		$.getJSON(fetchUrl).then(
			function(data, status, jqXHR) {         // success
				classifiers = data.classifiers;
				updateClassifierDisplay();
			},

			function(jqXHR, status, error) {        // fail
				$('#errorMsg').text("Error encountered - unable to retrieve classifiers from server.");
			}
		);
	}

	/** Update the displayed set of classifiers. */
	function updateClassifierDisplay() {
		var conceptContainer = $('#conceptContainer');
		var conceptElem, concept, removeCtrl;
		conceptContainer.empty();

		for (var i = 0; i < classifiers.length; i++) {
			conceptElem = $('<div/>');
			conceptElem.addClass('concept');
			conceptElem.attr('id','concept-'+ classifiers[i].classifier.replace(/ /g,"-"));
			conceptElem.click(classifiers[i].classifier, function(event) {
				selectClassifier(event.data);
			});

			concept = $('<span/>');
			concept.html(classifiers[i].classifier);

			removeCtrl = $('<span class="ui-icon ui-icon-trash" style="display: inline-block" title="Remove concept">');
			removeCtrl.click({ classifier : classifiers[i].classifier}, onRemoveConcept);

			conceptElem.append(concept);
			conceptElem.append(removeCtrl);
			conceptContainer.append(conceptElem);
		}

		selectClassifier(selectedClassifier || classifiers[0].classifier);
	}

	/** Update UI in response to selection of a classifier.
	 *  @param {string} classifierName The name of the classifier to be selected.
	 */
	function selectClassifier(classifierName) {
		var classifier = findClassifier(classifierName);
		$('.concept').removeClass('selected');
		if (classifier) {
			selectedClassifier = classifier.classifier;
			$('#concept-' + selectedClassifier.replace(/ /g,"-")).addClass('selected');
			updateKeywordDisplay();
		}
	}

	/** Update the displayed list of keywords for the currently selected concept. */
	function updateKeywordDisplay() {
		var keywordContainer = $('#keywordContainer');
		keywordContainer.empty();

		if (selectedClassifier) {
			var classifier = findClassifier(selectedClassifier);
			if (!classifier) { return; }

			var keywordEl, keyword, removeCtrl;
			for (var i = 0; i < classifier.keywords.length; i++) {
				keywordEl = $('<div/>');
				keyword = $('<span/>');
				keyword.html(classifier.keywords[i]);

				removeCtrl = $('<span class="ui-icon ui-icon-trash" style="display: inline-block" title="Remove keyword">');
				removeCtrl.click({ classifier : classifier.classifier, keyword : classifier.keywords[i]}, onRemoveKeyword);

				keywordEl.append(keyword);
				keywordEl.append(removeCtrl);
				keywordContainer.append(keywordEl);
			}
		}
	}

	/** Add the keyword from the current text in the new keyword control and update the UI. */
	function onAddKeyword() {
		var newKeyword = newKeywordField.val();
		if (newKeyword === "") { return; }
		addKeyword(selectedClassifier, newKeyword);
		newKeywordField.val('');
		updateKeywordDisplay();
		updateControls();
	}

	/** Remove the keyword when the remove control is clicked
	 * 	@param event The event data should contain the classifier and keyword selected for removal.
	 * 					i.e. event.data.classifier and event.data.keyword
	 */
	function onRemoveKeyword(event) {
		removeKeyword(event.data.classifier, event.data.keyword);
		updateKeywordDisplay();
		updateControls();
	}

	/** Add a new Concept from the current text in the new concept field and update the UI. */
	function onAddConcept() {
		var newConcept = newConceptField.val();
		if (newConcept === "") { return; }
		if (findClassifier(newConcept)) { return; }
		addConcept(newConcept);
		newConceptField.val('');
	}

	/** Remove a concept when it's remove control is clicked.
	 *  @param event The event data should contain the concept / classifier name selected for removal.
	 * 					e.g. event.data.classifier
	 */
	function onRemoveConcept(event) {
		removeConcept(event.data.classifier);
		if (event.data.classifier === selectedClassifier) { selectedClassifier = null; }
		updateClassifierDisplay();
		updateControls();
	}

	/** Add the specified keyword to the classifier.
	 *  @param {string} classifierName 	The classifier (concept) to which the keyword will be added.
	 *  @param {string} keyword			The keyword to add.
	 */
	function addKeyword(classifierName, keyword) {
		if (!classifierName || classifierName === '') 	{ return; }
		if (!keyword || keyword === '') 				{ return; }

		var classifier = findClassifier(classifierName);
		if (classifier && !_.contains(classifier.keywords, keyword)) {
			classifier.keywords.push(keyword);
			keywordsAdded.push( {	classifier : classifierName,
									keyword : keyword });
		}
	}

	/** Remove the specified keyword from the classifier.
	 *  @param classifierName	The classifier (concept) from which the keyword will be removed
	 *  @param keyword			The keyword to remove.
	 */
	function removeKeyword(classifierName, keyword) {
		// check if removed keyword is a new one the user has added, but not applied yet
		var newKeyword = _.find(keywordsAdded, function (addedKw) { return (addedKw.classifier === classifierName && addedKw.keyword === keyword) });
		if (newKeyword) {
			keywordsAdded = _.reject(keywordsAdded, function (addedKw) { return (addedKw.classifier === classifierName && addedKw.keyword === keyword) } );
 		} else {
			keywordsRemoved.push( {	classifier : classifierName,
									keyword : keyword });
		}

		var classifier = findClassifier(classifierName);
		if (classifier) {
			classifier.keywords = _.reject(classifier.keywords, function(kw) {
				return kw === keyword;
			});
		}
	}

	/** Add a new concept
	 *  @param {string} concept The name of the concept.
	 */
	function addConcept(concept) {
		if (!concept || concept === '')	{ return; }

		var classifier = { classifier : concept, keywords : [] };
		classifiers.push(classifier);

		updateClassifierDisplay();
		selectClassifier(concept);
		newKeywordField.focus();
	}

	/** Delete the specified classifier and all it's associated keywords. */
	function removeConcept(classifierName) {
		var classifier = findClassifier(classifierName);
		if (!classifier) { return; }

		for (var i = classifier.keywords.length - 1; i >= 0; i--) { // start at end so removing keywords doesn't affect the iteration
			removeKeyword(classifierName, classifier.keywords[i]);
		}

		classifiers = _.reject(classifiers, function(curClass) { return curClass.classifier === classifierName; });
	}

	/** Update= the control / button state to reflect whether any keywords have been added or removed. */
	function updateControls() {
		var disabled = (keywordsAdded.length === 0 && keywordsRemoved.length === 0);
		applyCtrl.button("option", "disabled", disabled);
		discardCtrl.button("option", "disabled", disabled);
	}

	/** Find the classifier object (name and keyword list) for the specified classifier name.
	 *  @param {string} classifierName
	 *  @return {Object} Object containing the classifier name and keyword list. Null if no matching object was found
	 */
	function findClassifier(classifierName) {
		if (!classifierName || classifierName === "") { return null; }

		var result = null;
		for (var i = 0; i < classifiers.length; i++) {
			if (classifiers[i].classifier === classifierName) {
				result = classifiers[i];
				break;
			}
		}
		return result;
	}

	function updateKeywordsOnServer() {
		var updateUrl = baseUrl + '/update';
		var payload = null;
		if (keywordsAdded.length > 0) {
			payload = { keywords : keywordsAdded };
			rest.post(updateUrl, payload, 'Update keywords', updateCallback, true);
			keywordsAdded = [];
		}

		if (keywordsRemoved.length > 0) {
			payload = { keywords : keywordsRemoved };
			rest.delete(updateUrl, payload, 'Update keywords', updateCallback, true);
			keywordsRemoved = [];
		}

		updateControls();
	}

	function updateProgress() {
		$.getJSON(baseUrl + "/progress").then(
			function(result) {
				progressbar.progressbar( "option", "value", result.percentComplete );
				if (result.percentComplete < 100) {
					setTimeout(updateProgress, 3000);
				}
			},

			function(error) {
				$('#errorMsg').text("Error encountered - unable to retrieve extraction progress from server.");
			}
		);
	}

	/** Trigger the server to re-classify the ads based on the current set of concepts and keywords. */
	function reclassify() {
		var reclassUrl = baseUrl + '/classify';
		rest.get(reclassUrl, "Reclassify ads", updateCallback);
		progressbar.progressbar( "option", "value", 0);
		$('#progressContainer').css("visibility", "visible");
		updateProgress();
	}

	function updateCallback() { }  // no-op for now

	return {
		start : start
	}

});