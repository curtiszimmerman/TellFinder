package oculus.memex.extraction;

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

import oculus.memex.clustering.MemexAd;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.training.InvalidateAttribute;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

/**
 * Scans the ads table 'body' column using regular expressions to detect measurements and post ids. 
 * Writes the results to ads_numbers and uses the values to cull invalid phone numbers.
 */
public class AdExtraction {
	private static String ADS_NUMBERS_TABLE = "ads_numbers";
	private static String ADS_BAD_PHONE_TABLE = "ads_bad_phones";
	public static String ADS_PHONE_TABLE = "ads_phones";
	public static String ADS_EMAILS_TABLE = "ads_emails";
	public static String ADS_WEBSITES_TABLE = "ads_websites";
	public static final int BATCH_SELECT_SIZE = 100000;
	public static final int BATCH_INSERT_SIZE = 2000;
	private static final int PHONE_FIX_BATCH_SIZE = 2000;
	private static final int VALUE_WRITE_BATCH_SIZE = 2000;

	
	/**
	 *  A class to hold a regular expression and labels defining the meaning of the groups
	 *  matched by the expression.
	 */
	private static class RegexExtractor {
		String regex;
		String[] values;
		public RegexExtractor(String regex, String[] values) {
			super();
			this.regex = regex;
			this.values = values;
		}
	}

	// Some common RE substrings (unused)
	public static String WEIGHT_RE = "(1[0-5][0-9])";
	public static String WEIGHT_RE2 = "(\\d{2,3})\\s*lbs?";
	public static String HEIGHT_RE = "([4-5]['\\?\\s]*[0-9][0-1]?\"?)";
	public static String AGE_RE = "([1-3][0-9])";
	public static String SEPERATOR_RE = "[\\.,\\s&-\\(\\)]+";

	// Extractors to be run on each roxy_ui.ads.body column.
	private static RegexExtractor[] EXTRACTORS = {
		new RegexExtractor(AGE_RE+SEPERATOR_RE+HEIGHT_RE+SEPERATOR_RE+WEIGHT_RE,  new String[] {"age", "height", "weight"}),
		new RegexExtractor(HEIGHT_RE+SEPERATOR_RE+WEIGHT_RE, new String[] {"height", "weight"}),
		new RegexExtractor(HEIGHT_RE+SEPERATOR_RE+"(\\d{2,3})\\s*cm", new String[] {"height", "heightmetric"}),
		new RegexExtractor(AGE_RE+SEPERATOR_RE+"y/o", new String[] {"age"}),
		new RegexExtractor(AGE_RE+SEPERATOR_RE+"yrs", new String[] {"age"}),
		new RegexExtractor(AGE_RE+SEPERATOR_RE+"years", new String[] {"age"}),
		new RegexExtractor("age"+SEPERATOR_RE+AGE_RE, new String[] {"age"}),
		new RegexExtractor(WEIGHT_RE2, new String[] {"weight"}),
		new RegexExtractor(HEIGHT_RE+"[, &-]+([2-4][0-9][A-Ea-e]{0,3})[, -]+([2-4][0-9])[, -]+([2-4][0-9])", new String[] {"height", "chest", "waist", "hips"}),
		new RegexExtractor("([1-3][0-9])[, &-]+([2-4][0-9][A-Ea-e]{0,3})[, &-]+" + HEIGHT_RE + SEPERATOR_RE + WEIGHT_RE,  new String[] {"age", "chest", "height", "weight"}),
		new RegexExtractor("([2-4][0-9][A-Ea-e]{0,3})[, -]+([2-4][0-9])[, -]+([2-4][0-9])[\\., &-]+(\\d{2,3})\\s*HH?", new String[] {"chest", "waist", "hips", "hourprice"}),
		new RegexExtractor("([2-4][0-9][A-Ea-e]{0,3})[, -]+([2-4][0-9])[, -]+([2-4][0-9])[\\., &-]+(\\d{2,3})\\s*lbs?", new String[] {"chest", "waist", "hips", "weight"}),
		new RegexExtractor(HEIGHT_RE+"[, &-]+(1[0-5][0-9])[, &-]+([2-4][0-9][A-Ea-e]{0,3})",  new String[] {"height", "weight", "chest"}),
		new RegexExtractor("<strong>Post ID:</strong> (\\d{7})", new String[] {"postid"}),
		new RegexExtractor("Post - (\\d{7})", new String[] {"postid"}),
		new RegexExtractor("featured_title_(\\d{7})", new String[] {"featureid"}),
		new RegexExtractor("UA-(\\d{8})-(\\d)", new String[] {"googleanalyticskey"})
		//		new RegexExtractor("((\\(?\\d{3}\\)?)+[- ]*\\d{3}[- ]*\\d{4})",  new String[] {"phone", "area code"}),
	};
	
	
	/**
	 * Create a table to store the measurements, etc.
	 */
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ADS_NUMBERS_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "age VARCHAR(8)," +
						  "height VARCHAR(8)," +
						  "weight VARCHAR(8)," +
						  "chest VARCHAR(8)," +
						  "hips VARCHAR(8)," +
						  "waist VARCHAR(8)," +
						  "phone VARCHAR(16)," +
						  "PRIMARY KEY (id) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
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

	/**
	 * Create a table of ads_id->phone numbers
	 */
	private static void createPhoneTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ADS_PHONE_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "value VARCHAR(16)," +
						  "PRIMARY KEY (id),KEY `ads_id` (`ads_id`),KEY value_idx (value) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	/**
	 * Create a table of ads_id->websites
	 */
	private static void createWebsitesTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ADS_WEBSITES_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "value VARCHAR(2500)," +
						  "PRIMARY KEY (id),KEY `ads_id` (`ads_id`),KEY value_idx (value(4)) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	/**
	 * Create a table of ads_id->emails
	 */
	private static void createEmailsTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+ADS_EMAILS_TABLE+"` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "value VARCHAR(2500)," +
						  "PRIMARY KEY (id),KEY `ads_id` (`ads_id`),KEY value_idx (value(4)) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	/**
	 * Check to see if the table exists and clear or create.
	 */
	public static void initTables() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (db.tableExists(conn, ADS_NUMBERS_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ADS_NUMBERS_TABLE);
				db.clearTable(conn, ADS_NUMBERS_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + ADS_NUMBERS_TABLE);
			createTable(db, conn);
		}
		if (db.tableExists(conn, ADS_BAD_PHONE_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ADS_BAD_PHONE_TABLE);
				db.clearTable(conn, ADS_BAD_PHONE_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + ADS_BAD_PHONE_TABLE);
			createBadPhoneTable(db, conn);
		}
		if (db.tableExists(conn, ADS_PHONE_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ADS_PHONE_TABLE);
				db.clearTable(conn, ADS_PHONE_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + ADS_PHONE_TABLE);
			createPhoneTable(db, conn);
		}
		if (db.tableExists(conn, ADS_WEBSITES_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ADS_WEBSITES_TABLE);
				db.clearTable(conn, ADS_WEBSITES_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + ADS_WEBSITES_TABLE);
			createWebsitesTable(db, conn);
		}
		if (db.tableExists(conn, ADS_EMAILS_TABLE)) {
			if (ScriptDBInit._clearDB) {
				System.out.println("Clearing table: " + ADS_EMAILS_TABLE);
				db.clearTable(conn, ADS_EMAILS_TABLE);
			}
		} else {			
			System.out.println("Creating table: " + ADS_EMAILS_TABLE);
			createEmailsTable(db, conn);
		}
		db.close(conn);
	}
	
	/**
	 * Loop over the ads table body and phone_numbers to identify and fix bad phone numbers.
	 */
	public static void extractData() {
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		MemexHTDB htdb = MemexHTDB.getInstance();
		Connection htconn = htdb.open();

		long fullstart = System.currentTimeMillis();
		
		HashSet<String> badPhonesList = readBadValues(oculusconn, InvalidateAttribute.BAD_PHONES);
		HashSet<String> badEmailsList = readBadValues(oculusconn, InvalidateAttribute.BAD_EMAILS);
		HashSet<String> badWebsitesList = readBadValues(oculusconn, InvalidateAttribute.BAD_WEBSITES);
		HashMap<Integer,HashSet<String>> pricePhoneList = AdExtraBadPhones.getBadPricePhones(oculusconn);
		
		Pattern patterns[] = new Pattern[EXTRACTORS.length];
		for (int i=0; i<EXTRACTORS.length; i++) {
			patterns[i] = Pattern.compile(EXTRACTORS[i].regex);
		}

		int maxphoneadid = MemexOculusDB.getInt(oculusconn, "SELECT max(ads_id) FROM ads_phones", "Get max phone ad id");

		long start = System.currentTimeMillis();
		int maxadid = MemexHTDB.getInt(htconn, "SELECT max(id) FROM ads", "Get max ad id");
		int nextid = maxphoneadid+1;
		int adcount = 0;
		Statement stmt = null;
		String sqlStr = null;
		ResultSet rs = null;
		while (nextid<maxadid) {

			HashMap<Integer,String> adText = new HashMap<Integer,String>();
			stmt = null;
			try {
				stmt = htconn.createStatement();
				sqlStr = "SELECT id,text FROM ads where id>=" + nextid + " and id<=" + (nextid+BATCH_SELECT_SIZE);
				rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					adcount++;
					Integer adid = rs.getInt("id");
					adText.put(adid, rs.getString("text"));
					if (adid>maxadid) maxadid = adid;
				}
				stmt.close();
				stmt = null;

				HashMap<Integer, MemexAd> ads = MemexAd.fetchAdsHT(htconn, "ads_id>=" + nextid + " and ads_id<=" + (nextid+BATCH_SELECT_SIZE));

				HashMap<Integer,HashMap<String,String>> adExtracts = new HashMap<Integer,HashMap<String,String>>();
				HashMap<Integer,HashSet<String>> adBadPhones = new HashMap<Integer,HashSet<String>>();
				for (int adid:adText.keySet()) {
					String body = adText.get(adid);
					MemexAd ad = ads.get(adid);

					// Remove emails from badEmailList
					HashSet<String> emails = ad.attributes.get("email");
					HashSet<String> goodEmails = new HashSet<String>();
					HashSet<String> badEmails = new HashSet<String>();
					if (emails!=null) { 
						for (String email:emails) {
							if (badEmailsList.contains(email)) {
								badEmails.add(email);
							} else if (email!=null) {
								goodEmails.add(email.trim().toLowerCase());
							}
						}
					}
					ad.attributes.put("email", goodEmails);

					// Remove websites from badWebsitesList
					HashSet<String> websites = ad.attributes.get("website");
					HashSet<String> goodWebsites = new HashSet<String>();
					HashSet<String> badWebsites = new HashSet<String>();
					if (websites!=null) { 
						for (String website:websites) {
							if (badWebsitesList.contains(website)) {
								badWebsites.add(website);
							} else if (website!=null) {
								// TODO: Ignore if website.trim().contains(" ")?
								goodWebsites.add(website.trim().toLowerCase());
							}
						}
						websites.removeAll(badWebsites);
					}
					ad.attributes.put("website", goodWebsites);

					// Remove phones from badPhonesList and pricePhones
					HashSet<String> phones = ad.attributes.get("phone");
					HashSet<String> pricePhones = pricePhoneList.get(adid);
					HashSet<String> badPhones = new HashSet<String>();
					if (pricePhones!=null) {
						badPhones.addAll(pricePhones);
					}
					if (phones!=null) { 
						for (String phone:phones) {
							if (badPhonesList.contains(phone)) {
								badPhones.add(phone);
							}
						}
						phones.removeAll(badPhones);
					}
					// Extract values from body
					if (body!=null) {
						body = body.replaceAll("&quot;", "\"");
						body = body.replaceAll("&amp;", "\"");
						HashMap<String, String> extracted = extractValues(patterns, body, adid, phones, badPhones);
						adExtracts.put(adid, extracted);
					}
					if (badPhones.size()>0) adBadPhones.put(adid, badPhones);
				}				

				writeValues(oculusconn, ADS_WEBSITES_TABLE, "website", ads);
				writeValues(oculusconn, ADS_EMAILS_TABLE, "email", ads);
				writeValues(oculusconn, ADS_PHONE_TABLE, "phone", ads);
				writePhoneFixes(oculusconn, adBadPhones);
				insertExtracted(oculusconn, adExtracts);
				
				long end = System.currentTimeMillis();
				System.out.println("Processed " + adcount + " in " + (end-start) + "ms");
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

		long fullend = System.currentTimeMillis();
		int duration = (int)((fullend-fullstart)/1000);
		Progress.updateProgress(oculusdb, oculusconn, "ads_extraction", maxadid, 0, duration);
			
		htdb.close(htconn);
		oculusdb.close(oculusconn);
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

	public static HashSet<String> readBadValues(Connection oculusconn, String table) {
		HashSet<String> values = new HashSet<String>();
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			String sqlStr = "SELECT value FROM " + table;
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String value = rs.getString("value");
				values.add(value);
			}
			stmt.close();
			stmt = null;
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
		return values;
	}

	private static void writeValues(Connection conn, String table, String attribute, HashMap<Integer, MemexAd> ads) {
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + table + "(ads_id,value) VALUES (?,?)");
			int count = 0;
			for (Entry<Integer,MemexAd> entry:ads.entrySet()) {
				Integer adid = entry.getKey();
				MemexAd ad = entry.getValue();
				HashSet<String> values = ad.attributes.get(attribute);
				if (values==null) continue;
				for (String value:values) {
					pstmt.setInt(1,adid);
					pstmt.setString(2,value);
					pstmt.addBatch();
					count++;
					if ((count%VALUE_WRITE_BATCH_SIZE)==0) {
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
	 * Write table adextracted
	 */
	public static void insertExtracted(Connection oculusconn, HashMap<Integer, HashMap<String, String>> resultMap) {
		PreparedStatement pstmt = null;
		try {
			oculusconn.setAutoCommit(false);
			pstmt = oculusconn.prepareStatement("INSERT INTO " + ADS_NUMBERS_TABLE + 
					"(ads_id,age,height,weight,chest,hips,waist,phone) VALUES (?,?,?,?,?,?,?,?)");
			int count = 0;
			for (Entry<Integer,HashMap<String, String>> e:resultMap.entrySet()) {
				Integer adId = e.getKey();
				HashMap<String, String> extracted = e.getValue();
				if (extracted.size()>0) {
					pstmt.setInt(1, adId);
					pstmt.setString(2, extracted.get("age"));
					pstmt.setString(3, extracted.get("height"));
					pstmt.setString(4, extracted.get("weight"));
					pstmt.setString(5, extracted.get("chest"));
					pstmt.setString(6, extracted.get("hips"));
					pstmt.setString(7, extracted.get("waist"));
					pstmt.setString(8, extracted.get("phone"));
					pstmt.addBatch();
					count++;
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
				oculusconn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
	}

	/**
	 * Using the given RE patterns, find matches in the body text and remove bad phone numbers from the array.
	 */
	public static HashMap<String, String> extractValues(Pattern[] patterns, String body, Integer id, HashSet<String> phones, HashSet<String> badPhones) {
		HashMap<String,String> extracted = new HashMap<String,String>();
		if (body!=null) {
			for (int i=0; i<patterns.length; i++) {
				Matcher  matcher = patterns[i].matcher(body);
				String[] values = EXTRACTORS[i].values;
				while (matcher.find()) {
					String fullMatch = matcher.group(0);
					String fullStripped = StringUtil.stripNonNumeric(fullMatch);
//					System.out.println(i + ":" + fullMatch);
					checkBadPhones(fullMatch, fullStripped, phones, badPhones);
					for (int j=0; j<values.length; j++) {
						String val = matcher.group(j+1);
						String stripped = StringUtil.stripNonNumeric(val);
						if (stripped.length()>45) stripped = stripped.substring(0, 44);
						String oldVal = extracted.get(values[j]);
						if (oldVal==null) {
							extracted.put(values[j], stripped);
						}
					}
				}
			}
		}
		return extracted;
	}

	/**
	 * Given a match value and numeric content, check to see if any phone numbers contain the extracted numbers.
	 * Remove bad phone numbers from the array.
	 */
	static int BAD_PHONE_COUNT = 0;
	private static boolean checkBadPhones(String val, String stripped, HashSet<String> phones, HashSet<String> badPhones) {
		if (phones==null) return false;
		if (stripped.length()<5) return false;
		boolean found = false;
		for (String phone:phones) {
			boolean phoneLonger = phone.length()>stripped.length();
			if ( (phoneLonger&&phone.contains(stripped)) || 
					((!phoneLonger)&&stripped.contains(phone)) ) {
				badPhones.add(phone);
				found = true;
			}
		}
		phones.removeAll(badPhones);
		return found;
	}

	/**
	 * A tester for the regular expressions.
	 */
	public static void test() {
//		String str = "Height:5' 10\" (178cm)";
		String str = "<b>SAFE SERVICE <u>ONLY</u></b> <br /> <br /> Hello gentlemen my name is <b>Carlita</b>, <br /> <br /> <b>5'7 130 34DD </b> Spanish beauty <br /> Sexy all natural curves and perky tits and juicy booty . <br /> Green eyes and soft tanned skin with a beautiful face . <br /> Very friendly , down to earth personality . <br /> <br /> <b>100% REAL &amp; RECENT PICTURES</b> <br /> <br /> Don't miss out ! Call to make an appointment . <br /> Let me show you my freaky side , I can't wait to see you ! xo <br /> <br /> Clean &amp; Unrushed . <br /> <br /> <u>No blocked calls please</u> <br /> (416)889-0363 <b>Carlita</b>. <br /> <i>Incall and Outcalls</i>";
		str = str.replaceAll("&quot;", "\"");
		str = str.replaceAll("&amp;", "\"");

		Pattern patterns[] = new Pattern[EXTRACTORS.length];
		for (int i=0; i<EXTRACTORS.length; i++) {
			patterns[i] = Pattern.compile(EXTRACTORS[i].regex);
		}
		HashMap<String, String> extracted = extractValues(patterns, str, null, null, null);

		for (Entry<String,String> e:extracted.entrySet()) {
			System.out.println(e.getKey() + ":" + e.getValue());
		}
	}

	/**
	 * Read the database, extract the data and write the results.
	 */
	private static void process() {
		initTables();
		extractData();
	}
	
	/**
	 * The main function to initialize the database, log timing and execute the process.
	 */
	public static void main(String[] args) {
		TimeLog tl = new TimeLog();

		tl.pushTime("Regular Expression Extraction");

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		process();

		tl.popTime();
	}

}
