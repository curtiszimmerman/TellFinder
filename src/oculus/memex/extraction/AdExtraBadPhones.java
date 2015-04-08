package oculus.memex.extraction;

import java.io.UnsupportedEncodingException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map.Entry;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.util.TimeLog;

/**
 * Scans the ads table 'body' column using regular expressions to detect measurements and post ids. 
 * Writes the results to ads_numbers and uses the values to cull invalid phone numbers.
 */
public class AdExtraBadPhones {
	private static String ADS_BAD_PHONE_TABLE = "ads_price_phones";
	public static final int BATCH_SELECT_SIZE = 100000;
	private static final int PHONE_FIX_BATCH_SIZE = 2000;

	// Extractors to be run on each roxy_ui.ads.body column.
	private static String[] EXTRACTORS = {
		"\\$[1-5][0-9]0[^0-9]", // Rounded to ten, $100-590
		"\\$[4-9][0|5][^0-9]",   // Rounded to five, $40-95
		"[^0-9][4-6][0|5][^0-9]+[6-9][0|5][^0-9]" // (non-digit) 40-65 (non-digit)* 60-95 (non-digit)
	};
	
	/**
	 * Create a table of ads_id->bad phone numbers
	 */
	private static void createBadPhoneTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ADS_BAD_PHONE_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "phone VARCHAR(16)," +
						  "raw VARCHAR(45)," +
						  "PRIMARY KEY (id),KEY `ads_id` (`ads_id`) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTables() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn,ADS_BAD_PHONE_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ADS_BAD_PHONE_TABLE);
				db.clearTable(conn, ADS_BAD_PHONE_TABLE);
			}
		} else {
			System.out.println("Creating table: " + ADS_BAD_PHONE_TABLE);
			createBadPhoneTable(db, conn);
		}
		db.close(conn);
	}

	/**
	 * Write to the bad phone table (ads_id,phone) using a prepared statement and batches.
	 */
	public static void writePhoneFixes(Connection conn,	HashMap<Integer, HashSet<String>> updates) {
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + ADS_BAD_PHONE_TABLE + "(ads_id,phone) VALUES (?,?)");
			int count = 0;
			for (Entry<Integer,HashSet<String>> entry:updates.entrySet()) {
				Integer adid = entry.getKey();
				for (String badPhone:entry.getValue()) {
					pstmt.setInt(1,adid);
					pstmt.setString(2,badPhone);
					pstmt.addBatch();
					count++;
					if ((count%PHONE_FIX_BATCH_SIZE)==0) {
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
	}

	/**
	 * Loop over the ads table body and phone_numbers to identify and fix bad phone numbers.
	 * @return 
	 */
	public static int process(HashMap<Integer,HashSet<String>> adBadPhones) {
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();
		
		Pattern patterns[] = new Pattern[EXTRACTORS.length];
		for (int i=0; i<EXTRACTORS.length; i++) {
			patterns[i] = Pattern.compile(EXTRACTORS[i]);
		}
		
		
		// ads_id->(phone,extractedraw)

		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		int maxphoneid = MemexOculusDB.getInt(oculusconn, "SELECT max(ads_id) from " + ADS_BAD_PHONE_TABLE, "Get max bad phone ad id"); 
		oculusdb.close(oculusconn);
		
		long start = System.currentTimeMillis();
		int maxadid = MemexHTDB.getInt(htconn, "SELECT max(id) FROM ads", "Get max ad id");
		int nextid = maxphoneid+1;
		int adcount = 0;
		Statement stmt = null;
		String sqlStr = null;
		ResultSet rs = null;
		while (nextid<maxadid) {

			stmt = null;
			try {
				stmt = htconn.createStatement();
				sqlStr = "SELECT ads_id,value,extractedraw FROM ads_attributes where attribute='phone' and ads_id>=" + nextid + " and ads_id<=" + (nextid+BATCH_SELECT_SIZE);
				rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					adcount++;
					try {
						int adid = rs.getInt("ads_id");
						checkPhone(patterns, adid, rs.getString("value"), rs.getString("extractedraw"), adBadPhones);
						if (adid>maxadid) maxadid = adid;
					} catch (Exception e) {
						e.printStackTrace();
					}
				}
				stmt.close();
				stmt = null;
				long end = System.currentTimeMillis();
				System.out.println("Processed " + adcount + " in " + (end-start) + "ms. Bad:" + count);
			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				try {
					if (stmt != null) { stmt.close(); }
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
			nextid += BATCH_SELECT_SIZE+1;
		}
			
		htdb.close(htconn);
		return maxadid;
	}

	private static int count = 0;

	private static void checkPhone(Pattern[] patterns, int ads_id, String phone, String raw,HashMap<Integer, HashSet<String>> adBadPhones) throws UnsupportedEncodingException {

		int phoneStart = -1;
		int phoneIdx = 0;
		int rawIdx = 0;
		if (phone==null||raw==null) return;
		byte[] phoneBytes = phone.getBytes("US-ASCII");
		byte[] rawBytes = raw.getBytes("US-ASCII");
		while (rawIdx<rawBytes.length) {
			if (rawBytes[rawIdx]==phoneBytes[phoneIdx]) {
				if (phoneIdx==0) phoneStart = rawIdx;
				phoneIdx++;
				if (phoneIdx==phoneBytes.length) {
					// Found the phone number
					String phoneSub = raw.substring(phoneStart, rawIdx);
					boolean foundBad = false;
					for (int i=0; i<patterns.length; i++) {
						Matcher  matcher = patterns[i].matcher(phoneSub);
						while (matcher.find()) {
//							String fullMatch = matcher.group(0);
							foundBad = true;
							break;
						}
						if (foundBad) break;
					}
					if (foundBad) {
						HashSet<String> badPhones = adBadPhones.get(ads_id);
						if (badPhones==null) {
							badPhones = new HashSet<String>();
							adBadPhones.put(ads_id, badPhones);
						}
						badPhones.add(phone);
						count++;
//						System.out.println("Bad phone: " + count + "\t" + phone + "\t" + raw);
					}
					return;
				}
			} else if (rawBytes[rawIdx]>='0'&&rawBytes[rawIdx]<='9') {
				// A digit not in the phone number... reset
				phoneIdx = 0;
			}
			rawIdx++;
		}
	}

	public static HashMap<Integer,HashSet<String>> getBadPricePhones(Connection oculusconn) {
		HashMap<Integer,HashSet<String>> result = new HashMap<Integer,HashSet<String>>();
		String sqlStr = "SELECT ads_id,phone FROM " + ADS_BAD_PHONE_TABLE;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				Integer adid = rs.getInt("ads_id");
				String phone = rs.getString("phone");
				HashSet<String> phones = result.get(adid);
				if (phones==null) {
					phones = new HashSet<String>();
					result.put(adid, phones);
				}
				phones.add(phone);
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
		
		return result;
	}

	public static void test() {
//		Pattern pattern = Pattern.compile(EXTRACTORS[0]);
//		Matcher  matcher = pattern.matcher("32654$157ggre");
//		while (matcher.find()) {
//			String fullMatch = matcher.group(0);
//			System.out.println(fullMatch);
//		}
		
//		HashMap<Integer, HashSet<String>> adBadPhones = new HashMap<Integer, HashSet<String>>();
//		checkPhone(0, "61758663518573", "/>bodywork:1 hr/$60<br/>:617-586-6351:857-3", adBadPhones);
//		checkPhone(0, "6080120", "60$  80$ 120$ ", adBadPhones);
		
	}
	
	public static void main(String[] args) {
		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		
		TimeLog tl = new TimeLog();
		tl.pushTime("Processing extra bad phone numbers");
		tl.pushTime("Extracting numbers");
		HashMap<Integer, HashSet<String>> updates = new HashMap<Integer,HashSet<String>>();
		int maxadid = process(updates);
		tl.popTime();

		tl.pushTime("Writing fixes");
		initTables();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection oculusconn = db.open();
		writePhoneFixes(oculusconn, updates);
		tl.popTime();
		int duration = (int)(tl.popTime()/1000);
		Progress.updateProgress(db, oculusconn, "ads_prices", maxadid, 0, duration);
		db.close(oculusconn);
		
	}

}
