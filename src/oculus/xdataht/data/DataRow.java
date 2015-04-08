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
package oculus.xdataht.data;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import org.codehaus.jackson.annotate.JsonProperty;

/**
 * Let's keep the _fields private so we can always strip unsafe html from the values before they go out.
 * It could be that some analysis/tool requires the bad html in there, in which case this isn't the best place
 * to do the filtering.
 *
 */
public class DataRow {
	@JsonProperty("fields")
	private HashMap<String,String> _fields = new HashMap<String,String>();
	
	
	public DataRow(ArrayList<String> columns, List<String> line) {
		for (int i=0; i<columns.size(); i++) {
			put(columns.get(i), line.get(i));
		}
	}
	
	public DataRow(String id, String name, String title) {
		put("id", id);
		put("name", name);
		put("title", title);
	}
	
	public DataRow() {
	}
	
	public void put(String columnName, String value) {
		_fields.put(columnName, value);
	}
	
	public String get(String id) {
		return _fields.get(id);
	}
	
	public HashMap<String, String> copyFields() {
		return new HashMap<String, String>(_fields);
	}

}
