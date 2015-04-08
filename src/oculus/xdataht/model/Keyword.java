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

import javax.xml.bind.annotation.XmlRootElement;

/** A single keyword and the classifier / concept it is associated with. */
@XmlRootElement
public class Keyword {
	
	protected String keyword;
	protected String classifier;
	
	public Keyword() { }
	
	public Keyword(String keyword, String classifier) {
		this.keyword = keyword;
		this.classifier = classifier;
	}
	
	public String getKeyword() 				{ return keyword; }
	public void setKeyword(String keyword) 	{ this.keyword = keyword; }
	
	public String getClassifier() 					{ return classifier; }
	public void setClassifier(String classifier) 	{ this.classifier = classifier; }
}
