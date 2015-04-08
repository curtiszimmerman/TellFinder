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

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import oculus.memex.util.CsvParser;

public class DenseDataTable {
	private static String DATA_DIR = "c:/dev";
	
	public ArrayList<String[]> rows;
	public ArrayList<String> columns;
	private HashMap<String, String[]> _rowById = new HashMap<String, String[]>();
	public DenseDataTable() {
	}
	
	public String[] getRowById(String id) {
		return _rowById.get(id);
	}
	
	public void updateRowLookup() {
		_rowById = new HashMap<String, String[]>();
		for (String[] row : rows) {
			_rowById.put(row[0], row);
		}
	}
	
	public void merge(DenseDataTable other) {
		
		for (String col : columns) {
			assert(other.columns.indexOf(col) != -1);
		}
		assert(other.columns.size() == columns.size());
		
		for (String[] row : other.rows) {
			rows.add(row);
		}
		updateRowLookup();
	}
	
	protected void readCSV(String filename) {
		BufferedReader br = null;
		try {
			InputStream is = new FileInputStream(DATA_DIR + "/" + filename);
			br = new BufferedReader(new InputStreamReader(is));
			
			String lineString = br.readLine();
			List<String> line = CsvParser.fsmParse(lineString);
			columns = new ArrayList<String>(line);
			rows = new ArrayList<String[]>();
			while ((lineString = br.readLine()) != null) {
				line = CsvParser.fsmParse(lineString);
				if (line.size()==columns.size()) {
					String[] row = (String[])line.toArray();
					String id = row[0];
					_rowById.put(id, row);
					rows.add(row);
				} else {
					System.out.println(line.size() + ": " + lineString);
				}
			}
		} catch (IOException e) {
			e.printStackTrace();
		} finally {
			try {
				if (br!=null) br.close();
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}

	public int size() {
		if (rows == null || rows.size() == 0) {
			return 0;
		} else {
			return rows.size();
		}
	}
}
