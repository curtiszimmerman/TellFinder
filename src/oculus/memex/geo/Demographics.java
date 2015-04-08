package oculus.memex.geo;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.List;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.graph.AttributeLinks;
import oculus.memex.util.CsvParser;

public class Demographics {
	public static String DEMOGRAPHICS_TABLE = "location_demographics";

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
			"CREATE TABLE " + DEMOGRAPHICS_TABLE + " (" +
					"id int(11) NOT NULL AUTO_INCREMENT," +
					 "`location` TEXT," +
					 "`rape` FLOAT(14,7)," +                                                  
					 "`robbery` FLOAT(14,7)," +                                                  
					 "`expenditures` FLOAT(14,7)," +                                                  
					 "`ads` FLOAT(14,7)," +                                                  
					 "`white` FLOAT(14,7)," +                                                  
					 "`black` FLOAT(14,7)," +                                                  
					 "PRIMARY KEY (id) )";
			
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	public static void initTable() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		if (!db.tableExists(conn, DEMOGRAPHICS_TABLE)) {
			System.out.println("Creating table: " + DEMOGRAPHICS_TABLE);
			createTable(db, conn);
		} else {
			db.clearTable(conn, DEMOGRAPHICS_TABLE);
		}
		db.close(conn);
	}

	private static void readCSV(String filename) {
		BufferedReader br = null;
		PreparedStatement pstmt = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			br = new BufferedReader(new FileReader(filename));
			String line;
			boolean isFirst = true;

			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + DEMOGRAPHICS_TABLE + 
					"(location,rape,robbery,expenditures,ads,white,black) VALUES (" + AttributeLinks.commasAndQuestions(7) + ")");
			while ((line = br.readLine()) != null) {
				if (isFirst) {
					isFirst = false;
					continue;
				}
				List<String> cols = CsvParser.fsmParse(line);
				pstmt.setString(1, cols.get(0));
				for (int i=2; i<8; i++) {
					pstmt.setFloat(i, Float.parseFloat(cols.get(i-1)));
				}
				pstmt.addBatch();
				pstmt.executeBatch();
			}
			br.close();
		} catch (FileNotFoundException e) {
			System.out.println("File: " + filename + " not found.");
		} catch (IOException e) {
			e.printStackTrace();
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
	}

	public static void main(String[] args) {
		DateFormat dateFormat = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
		Calendar cal = Calendar.getInstance();
		System.out.println(dateFormat.format(cal.getTime()));

		System.out.println("Begin location calculation...");
		long start = System.currentTimeMillis();

		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		initTable();
		readCSV("c:/dev/location_demographics.csv");

		long end = System.currentTimeMillis();
		System.out.println("Done location calculation in: " + (end-start) + "ms");

	}

}
