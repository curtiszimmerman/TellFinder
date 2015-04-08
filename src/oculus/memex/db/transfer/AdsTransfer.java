package oculus.memex.db.transfer;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.ArrayList;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.progress.Progress;
import oculus.memex.util.TimeLog;

public class AdsTransfer {
	public static final String[] AD_COLUMNS = {
		  "id",
		  "first_id",
		  "sources_id",
		  "incoming_id",
		  "url",
		  "title",
		  "text",
		  "type",
		  "sid",
		  "region",
		  "city",
		  "state",
		  "country",
		  "phone",
		  "age",
		  "website",
		  "email",
		  "gender",
		  "service",
		  "posttime",
		  "importtime",
		  "modtime"
	};

	public static final String[] ATTRIBUTE_COLUMNS = {
		"id",
		"ads_id",
		"attribute",
		"value",
		"extracted",
		"extractedraw",
		"modtime"
	};
	
	public static final String[] IMAGE_COLUMNS = {
		"id",
		"sources_id",
		"ads_id",
		"url",
		"location",
		"importtime",
		"modtime"
	};
	
	public static final String[] IMAGE_ATTRIBUTE_COLUMNS = {
		"id",
		"images_id",
		"attribute",
		"value",
		"extracted",
		"extractedraw",
		"modtime"
	};
	
	private static int BATCH_FETCH_SIZE = 100000;
	
	private static String INSERT_AD_STATEMENT = Transfer.createInsertSQL("ads", AD_COLUMNS);
	private static String INSERT_ATTRIBUTE_STATEMENT = Transfer.createInsertSQL("ads_attributes", ATTRIBUTE_COLUMNS);
	private static String INSERT_IMAGE_STATEMENT = Transfer.createInsertSQL("images", IMAGE_COLUMNS);
	private static String INSERT_IMAGE_ATTRIBUTE_STATEMENT = Transfer.createInsertSQL("images_attributes", IMAGE_ATTRIBUTE_COLUMNS);

	public static void transferAll(TimeLog tl) throws Exception {
		MemexHTDB localdb = MemexHTDB.getInstance();
		MemexHTDB remotedb = new MemexHTDB("memex_ht", "mysql", "", "", "", "");
		transferTable(tl, localdb, remotedb, "ads", AD_COLUMNS, INSERT_AD_STATEMENT);
		transferTable(tl, localdb, remotedb, "ads_attributes", ATTRIBUTE_COLUMNS, INSERT_ATTRIBUTE_STATEMENT);
		transferTable(tl, localdb, remotedb, "images", IMAGE_COLUMNS, INSERT_IMAGE_STATEMENT);
		transferTable(tl, localdb, remotedb, "images_attributes", IMAGE_ATTRIBUTE_COLUMNS, INSERT_IMAGE_ATTRIBUTE_STATEMENT);
	}

	private static void transferTable(TimeLog tl, MemexHTDB localdb, MemexHTDB remotedb, String table, String[] columns, String insertStatement) {
		tl.pushTime("Get max ids");
		Connection localconn = localdb.open();
		int maxid = DBManager.getInt(localconn, "select max(id) from " + table, "Get max local " + table + " id");
		localdb.close(localconn);
		
		Connection remoteconn = remotedb.open();
		int remoteid = DBManager.getInt(remoteconn, "select max(id) from " + table, "Get max remote " + table + " id");
		remotedb.close(remoteconn);
		tl.popTime();

		tl.pushTime("Updating local " + table + ": " + maxid + " to remote " + remoteid);
		for (int i=maxid+1; i<remoteid; i+=BATCH_FETCH_SIZE) {
			ArrayList<String[]> ads = Transfer.read(remotedb, table, "id>=" + i + " and id<" + (i+BATCH_FETCH_SIZE), columns);
			Transfer.write(localdb, ads, insertStatement);
			System.out.println(i);
		}
		long duration = tl.popTime();
		MemexOculusDB oculusdb = MemexOculusDB.getInstance();
		Connection oculusconn = oculusdb.open();
		Progress.updateProgress(oculusdb, oculusconn, "memex_ht." + table, remoteid, 0, (int)(duration/1000));
		oculusdb.close(oculusconn);
	}

	public static void test2() throws Exception {
		MemexHTDB localdb = MemexHTDB.getInstance();
		MemexHTDB remotedb = new MemexHTDB("memex_ht", "mysql", "", "", "", "");
		ArrayList<String[]> ads = Transfer.read(remotedb, "ads", "id=35441544", AD_COLUMNS);
		Transfer.write(localdb, ads, INSERT_AD_STATEMENT);
	}
	
	public static void test() throws Exception {
//		byte[] b = {(byte)0xF0,(byte)0x9F,(byte)0x8C,(byte)0xB9,(byte)0xF0,(byte)0x9F};
		byte[] t = {78, 101, 119, 97, 114, 107, 33, 32, -16, -97, -111, -123, 66, 108, 111, 110, 100, 101, 32, 66, 117, 110, 110, 121, 32, 51, 56, 68, 68, 38, 66, 111, 79, 116, 121, 32, -30, -104, -123, 40, 85, 76, 84, 105, 77, 65, 116, 69, 41, 32, -16, -97, -110, -117, 80, 76, 69, 65, 83, 85, 82, 69, -30, -104, -122, 32, 40, 49, 48, 48, 37, 82, 101, 97, 108, 38, 32, 82, 69, 86, 73, 69, 87, 69, 68, 41, -16, -97, -110, -117, 32, 73, 110, 38, 79, 117, 116, 99, 97, 108, 108, 32, 83, 112, 101, 99, 105, 97, 108, 32, 45, 32, 100, 101, 108, 97, 119, 97, 114, 101, 32, 101, 115, 99, 111, 114, 116, 115, 32, 45, 32, 98, 97, 99, 107, 112, 97, 103, 101, 46, 99, 111, 109};
		String test = new String(t, "utf8"); //"Cityxguide"; 
//		int adid = 35440603;
		PreparedStatement pstmt = null;
		MemexHTDB localdb = MemexHTDB.getInstance();
		Connection conn = localdb.open();
		try {
			conn.setAutoCommit(false);
//			pstmt = conn.prepareStatement("update ads set title=? where id=?");
			pstmt = conn.prepareStatement("insert into memex_oculus.test (utf8test) values (?)");
			pstmt.setString(1, test); 
//			pstmt.setInt(2, adid);
			pstmt.addBatch();
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
		localdb.close(conn);
	}
	
	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Transfer ads");
		ScriptDBInit.readArgs(args);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		try {
//			test();
			transferAll(tl);
		} catch (Exception e) {
			e.printStackTrace();
		}
		tl.popTime();
	}
}
