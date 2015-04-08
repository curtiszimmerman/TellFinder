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
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

package oculus.xdataht.model;

import java.util.ArrayList;
import java.util.Collection;

import javax.xml.bind.annotation.XmlRootElement;

/** A single classifier / concept and its associated keywords. */
@XmlRootElement
public class ClassifierResult {
	
	private String classifier;
	private ArrayList<String> keywords;
	
	public ClassifierResult() { }
	
	public ClassifierResult(String classifier, Collection<String> keywords) {
		this.classifier = classifier;
		this.keywords = new ArrayList<String>(keywords);
	}
	
	public String getClassifier() 					{ return this.classifier; }
	public void setClassifier(String classifier) 	{ this.classifier = classifier; }
	
	public ArrayList<String> getKeywords() 				{ return this.keywords; }
	public void setKeywords(ArrayList<String> keywords) { this.keywords = keywords; }
	
}
