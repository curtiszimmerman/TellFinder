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
package oculus.memex.db;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;



public class MemexHTDB extends DBManager {
	public static final int BATCH_INSERT_SIZE = 2000;
	static final public String MEMEX_ADS_TABLE = "ads";
	private static MemexHTDB _instance = null;

	public static MemexHTDB getInstance() {
		if (_instance==null) {
			try {
				_instance = new MemexHTDB();
			} catch (Exception e) {
				System.out.println("FAILED TO CONNECT TO DATABASE: " + e.getMessage());
			}
		}
		return _instance;
	}
	
	public static MemexHTDB getInstance(String name, String type, String hostname, String port, String user, String pass) {
		if (_instance==null) {
			try {
				_instance = new MemexHTDB(name, type, hostname, port, user, pass);
			} catch (Exception e) {
				System.out.println("FAILED TO CONNECT TO DATABASE: " + e.getMessage());
			}
		}
		return _instance;
	}
	
	private MemexHTDB() throws Exception {
		super(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
	}
	
	public MemexHTDB(String name, String type, String hostname, String port, String user, String pass) throws Exception {
		super(name, type, hostname, port, user, pass);
	}

	public static HashSet<Integer> getAds(String whereClause) {
		MemexHTDB db = MemexHTDB.getInstance();
		Connection conn = db.open();
		String sqlStr = "SELECT id from ads where " + whereClause;
		Statement stmt = null;
		HashSet<Integer> result = new HashSet<Integer>();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result.add(rs.getInt("id"));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		db.close(conn);
		return result;
	}	
	
	
	
}
