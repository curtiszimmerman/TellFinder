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
package oculus.memex.image;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.HashSet;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

public class AdImages {

	public static String IMAGES_TABLE = "ads_images";
	public static String IMAGES_ATTRIBUTES_TABLE = "images_attributes";
	
	public static HashSet<Integer> getMatchingAds(Integer image_id) {
		TimeLog log = new TimeLog();
		log.pushTime("Get matching ads for image id: " + image_id);
		HashSet<Integer> result = new HashSet<Integer>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT ads_id FROM " + IMAGES_TABLE + " WHERE images_id='" + image_id + "'");
			while(rs.next()) {
				result.add(rs.getInt("ads_id"));
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(conn);
		log.popTime();
		return result;
	}
	
	public static HashSet<Integer> getMatchingAds(HashSet<Integer> image_ids) {
		TimeLog log = new TimeLog();
		log.pushTime("Get matching ads for image ids: " + image_ids.size());
		HashSet<Integer> result = new HashSet<Integer>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT ads_id FROM " + IMAGES_TABLE + " WHERE images_id IN " + StringUtil.hashSetToSqlList(image_ids));
			while(rs.next()) {
				result.add(rs.getInt("ads_id"));
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(conn);
		log.popTime();
		return result;
	}
	
	public static String getLocation(int image_id) {
		TimeLog log = new TimeLog();
		log.pushTime("Get url for image id: " + image_id);
		MemexHTDB db = MemexHTDB.getInstance();
		Connection conn = db.open();
		Statement stmt = null;
		String result = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT location FROM images WHERE id=" + image_id);
			while(rs.next()) {
				result = rs.getString("location");
				break;
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		db.close(conn);
		log.popTime();
		return result;
	}
		
	public static void transfer() {
		TimeLog log = new TimeLog();
		log.pushTime("Images id transfer");
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();		
		Statement stmt = null;
		try {
			int maxadid = DBManager.getInt(conn, "select max(ads_id) from " + IMAGES_TABLE, "Get max ads_id from ads_images");
			log.pushTime("Transfer from images table " + maxadid);
			stmt = conn.createStatement();
			stmt.executeUpdate("INSERT INTO " + IMAGES_TABLE + " (`images_id`,`ads_id`) "
					+ "SELECT `id`,`ads_id` FROM " + ScriptDBInit._htSchema + ".images where ads_id>" + maxadid);
			log.popTime();
			log.pushTime("Transfer from images_attributes table " + maxadid);
			stmt.executeUpdate("INSERT INTO " + IMAGES_TABLE + " (`images_id`,`ads_id`) "
					+ "SELECT `images_id`,`value` FROM  " + ScriptDBInit._htSchema + ".images_attributes where value>" + maxadid);
			log.popTime();
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		int maxadid = DBManager.getInt(conn, "select max(ads_id) from " + IMAGES_TABLE, "Get max ads_id from ads_images");
		int duration = (int)(log.popTime()/1000);
		Progress.updateProgress(db, conn, "ads_images", maxadid, 0, duration);
		db.close(conn);
	}
	

	public static void initTable(MemexOculusDB db) {
		Connection conn = db.open();
		System.out.println("IMAGE INITIALIZATION");
		if(!db.tableExists(conn, IMAGES_TABLE)) {
			String sqlCreate = "CREATE TABLE `" + IMAGES_TABLE + "` ("
					+ "`id` int(11) NOT NULL AUTO_INCREMENT,"
					+ "`images_id` INT(11) UNSIGNED NOT NULL, "
					+ "`ads_id` INT(11) UNSIGNED DEFAULT NULL, "
					+ "PRIMARY KEY (`id`), "
					+ "KEY `ia` (`images_id`, `ads_id`), "
					+ "KEY `ai` (`ads_id`, `images_id`), "
					+ "KEY `images_id` (`images_id`), "
					+ "KEY `ads_id` (`ads_id`) )";
			if (DBManager.tryStatement(conn, sqlCreate)) {
				System.out.println("\t" + IMAGES_TABLE + " table initialized.");
			} else {
				System.out.println("\tError creating " + IMAGES_TABLE + " table.");
			}
		} else {
			System.out.println("\t" + IMAGES_TABLE + " table exists.");
		}
		if(!db.tableExists(conn, IMAGES_ATTRIBUTES_TABLE)) {
			String sqlCreate = "CREATE TABLE `" + IMAGES_ATTRIBUTES_TABLE + "` ("
					+ "`id` int(11) NOT NULL AUTO_INCREMENT,"
					+ "`images_id` INT(11) DEFAULT NULL, "
					+ "`value` VARCHAR(1024) DEFAULT NULL, "
					+ "PRIMARY KEY (`id`) )";
			if (DBManager.tryStatement(conn, sqlCreate)) {
				System.out.println("\t" + IMAGES_ATTRIBUTES_TABLE + " table initialized.");
			} else {
				System.out.println("\tError creating " + IMAGES_ATTRIBUTES_TABLE + " table.");
			}
		} else {
			System.out.println("\t" + IMAGES_ATTRIBUTES_TABLE + " table exists.");
		}
		db.close(conn);		
	}
	
	public static void ingestCMU () {
		TimeLog log = new TimeLog();
		log.pushTime("Ingesting CMU data");
		BufferedReader br;
		log.pushTime("Reading in valid features");
		try {
			br = new BufferedReader(new FileReader("c:\\bill.csv"));
			HashSet<String> valid = new HashSet<String>();
			String line;
			while ((line = br.readLine()) != null) {
				valid.add(line);
			}	
			br.close();
			log.popTime();
			log.pushTime("Reading image features csv");
			br = new BufferedReader(new FileReader("c:\\oculusb.csv"));			
			String [] lineArray;
			boolean first;
			HashMap<Integer,HashSet<String>> set = new HashMap<Integer,HashSet<String>>();
			while ((line = br.readLine()) != null) {
				line = line.replace("\"", "");
				lineArray = line.split(",");
				first=true;
				HashSet<String> imageFeatureSet = new HashSet<String>();
				int images_id=-1;;
				for(String str: lineArray) {
					if(first) {
						images_id = Integer.parseInt(str);
						first = false;
						imageFeatureSet = new HashSet<String>();
						set.put(images_id, imageFeatureSet);
					} else {
						if(valid.contains(str)){
							imageFeatureSet.add(str);
						}
					}
				}
				set.put(images_id, imageFeatureSet);
			}
			br.close();
			log.popTime();
			log.pushTime("add image features");
			MemexOculusDB db = MemexOculusDB.getInstance();
			Connection conn = db.open();
			PreparedStatement pstmt = null;
			HashSet<String> currentFeatures;
			try {
				//conn.setAutoCommit(false);
				int count = 0;
				for(Integer images_id: set.keySet()) {
					currentFeatures = set.get(images_id);
					pstmt = conn.prepareStatement("INSERT INTO " + IMAGES_ATTRIBUTES_TABLE + " (images_id, value) VALUES (?,?)");
					for(String feature: currentFeatures) {
						pstmt.setInt(1,images_id);
						pstmt.setString(2,feature);
						pstmt.addBatch();
					}
					count++;
					if (count % 500==0) {
						pstmt.executeBatch();
					}
				}
				pstmt.executeBatch();
			} catch (SQLException e) {
				e.printStackTrace();
			}
			db.close(conn);
			log.popTime();
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		} catch (IOException e) {
			e.printStackTrace();
		}
		log.popTime();
	}
	
	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Image extraction");

		ScriptDBInit.readArgs(args);
		MemexOculusDB oculusdb = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		initTable(oculusdb);
		transfer();
//		ingestCMU();

		tl.popTime();
	}
}
