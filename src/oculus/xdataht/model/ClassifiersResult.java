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
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;

import javax.xml.bind.annotation.XmlRootElement;

/** A set of {@link ClassifierResult}s. */
@XmlRootElement
public class ClassifiersResult {
	
	private ArrayList<ClassifierResult> classifiers;
	
	public ClassifiersResult() { }

	public ClassifiersResult(HashMap<String,HashSet<String>> classifiers) {
		super();
		this.classifiers = new ArrayList<ClassifierResult>();
		for (Entry<String, HashSet<String>>  entry : classifiers.entrySet()) {
			this.classifiers.add(new ClassifierResult(entry.getKey(), entry.getValue()));
		}
	}	
		
	public ArrayList<ClassifierResult> getClassifiers() {
		return classifiers;
	}

	public void setClassifiers(ArrayList<ClassifierResult> classifiers) {
		this.classifiers = classifiers;
	}		
}
