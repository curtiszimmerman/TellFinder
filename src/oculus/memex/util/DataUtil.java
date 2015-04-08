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
package oculus.memex.util;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map.Entry;

import oculus.xdataht.data.DataRow;

import org.jsoup.Jsoup;
import org.jsoup.safety.Whitelist;

public class DataUtil {
	private static Whitelist TAG_WHITELIST = Whitelist.simpleText().addTags("br", "hr");
	
	public static ArrayList<HashMap<String, String>> sanitizeHtml(List<DataRow> dataRows) {
		ArrayList<HashMap<String, String>> result = new ArrayList<HashMap<String, String>>();
		for (int i=0; i < dataRows.size(); i++) {
			HashMap<String, String> row = dataRows.get(i).copyFields();
			for (Entry<String, String> entry : row.entrySet()) {
				String value = entry.getValue();
				// The indexOf check speeds this up by about 35%.
				if (value != null && value.indexOf('<') != -1) {
					entry.setValue(Jsoup.clean(value, TAG_WHITELIST));
				}
			}
			result.add(row);
		}
		return result;
	}
	
	public static String sanitizeHtml(String value) {
		if (value != null && value.indexOf('<') != -1) {
			value = Jsoup.clean(value, TAG_WHITELIST);
		}
		return value;
	}
}
