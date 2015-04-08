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
package oculus.memex.tags;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.TimeLog;

public class Tags {
	public static final String TAGS_TABLE = "tags";
	private static final int BATCH_INSERT_SIZE = 2000;

	public static void initTable(MemexOculusDB db) {		
		Connection conn = db.open();
		System.out.println("TAGS INITIALIZATION");
		// Create a table to store tags for ads
		if (db.tableExists(conn, TAGS_TABLE)) {
			System.out.println("\t" + TAGS_TABLE + " table exists.");
		} else {
			String sqlStr = "CREATE TABLE " + TAGS_TABLE + 
					"(`ad_id` INT(11) NOT NULL, " +
					"`tag` VARCHAR(250) NOT NULL,"
					+ "`user_name` VARCHAR(32) NOT NULL," +
					"PRIMARY KEY(ad_id, tag, user_name) )";
			try {
				DBManager.tryStatement(conn, sqlStr);
				System.out.println("\t" + TAGS_TABLE + " table initialized.");
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		db.close(conn);
	}
	
	public static ArrayList<String> getTags(String adId, String user_name) {
		TimeLog log = new TimeLog();
		log.pushTime("getTags: " + adId + " for user: " + user_name);
		ArrayList<String> tags = new ArrayList<String>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		String sqlStr = "SELECT tag from " + TAGS_TABLE + " WHERE ad_id=? AND user_name=?";
		PreparedStatement pstmt  = null;
		try {
			pstmt = conn.prepareStatement(sqlStr);
			pstmt.setString(1, adId);
			pstmt.setString(2, user_name);
			ResultSet rs = pstmt.executeQuery();
			while (rs.next()) {
				tags.add(rs.getString("tag"));
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		db.close(conn);
		log.popTime();
		return tags;
	}
	
	public static void resetAllTags(String user_name) {
		TimeLog log = new TimeLog();
		log.pushTime("resetAllTags for user: " + user_name);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		PreparedStatement pstmt = null;
		try {
			pstmt = conn.prepareStatement("DELETE FROM " + TAGS_TABLE + " WHERE user_name=?");
			pstmt.setString(1, user_name);
			pstmt.executeUpdate();
		} catch (SQLException e) {
			e.printStackTrace();
		}
		db.close(conn);
		log.popTime();
	}
	
	public static void addTags(List<String> ids, List<String> newTags, String user_name) {
		if(ids.isEmpty() || newTags.isEmpty()) return;
		TimeLog log = new TimeLog();
		log.pushTime("addTags for user: " + user_name);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();		
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + TAGS_TABLE + 
					"(ad_id,tag,user_name) VALUES (?, ?, ?)");
			int count = 0;
			for (String id : ids) {
				for (String tag : newTags) {
					pstmt.setString(1, id);
					pstmt.setString(2, tag);
					pstmt.setString(3, user_name);
					pstmt.addBatch();
						
					++count;
					if (count % BATCH_INSERT_SIZE == 0) {
						pstmt.executeBatch();
					}
				}
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		db.close(conn);
		log.popTime();
	}
	
	public static void removeTags( List<String> adIds, List<String> tagsToRemove, String user_name) {
		TimeLog log = new TimeLog();
		log.pushTime("removeTags for user: " + user_name);
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();		
		PreparedStatement pstmt = null;
		try {
			pstmt = conn.prepareStatement("DELETE FROM " + TAGS_TABLE + 
					" WHERE ad_id IN ? AND tag IN ? AND user_name=?");
			pstmt.setString(1, adIds.toString());
			pstmt.setString(2, tagsToRemove.toString());
			pstmt.setString(3, user_name);
			pstmt.executeUpdate();			
		} catch (SQLException e) {
			e.printStackTrace();
		}
		db.close(conn);
		log.popTime();
	}
	
	public static void main(String[] args) {
		ScriptDBInit.readArgs(args);
		MemexOculusDB db = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		initTable(db);
	}
}
