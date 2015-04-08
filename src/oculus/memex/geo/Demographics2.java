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

public class Demographics2 {
	public static String DEMOGRAPHICS_TABLE = "demographics";

	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
			"CREATE TABLE " + DEMOGRAPHICS_TABLE + " (" +
					"id int," +
					"location varchar(128)," +
					"city varchar(128)," +
					"state varchar(128)," +
					"population int," +
					"median_income int," +
					"white_population int," +
					"black_population int," +
					"male_school_0 int," + 
					"male_school_4 int," +
					"male_school_6 int," +
					"male_school_8 int," +
					"male_school_9 int," +
					"male_school_10 int," +
					"male_school_11 int," +
					"male_school_12 int," +
					"male_school_HS int," +
					"male_school_C0 int," +
					"male_school_C1 int," +
					"male_school_CA int," +
					"male_school_CB int," +
					"male_school_CM int," +
					"male_school_CP int," +
					"months int," +
					"population2 int," +
					"violent_crime int," +
					"murder int," +
					"rape int," +
					"robbery int," +
					"assault int," +
					"property_crime int," +
					"burglary int," +
					"larceny_theft int," +
					"vehicle_theft int," +
					"violent_crime_rate float(10,3)," +
					"murder_rate float(10,3)," +
					"rape_rate float(10,3)," +
					"robbery_rate float(10,3)," +
					"assault_rate float(10,3)," +
					"property_crime_rate float(10,3)," +
					"burglary_rate float(10,3)," +
					"larceny_theft_rate float(10,3)," +
					"motor_vehicle_theft_rate float(10,3)," +
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
					"(id,location,city,state,population,median_income, " +
					"white_population,black_population," +
					"male_school_0, male_school_4,male_school_6,male_school_8,male_school_9,male_school_10,male_school_11," +
					"male_school_12,male_school_HS,male_school_C0,male_school_C1,male_school_CA,male_school_CB,male_school_CM,male_school_CP,male_school_other," +
					"months,population2,violent_crime,murder,rape,robbery,assault,property_crime,burglary," +
					"larceny_theft,vehicle_theft,violent_crime_rate,murder_rate,rape_rate,robbery_rate,assault_rate,property_crime_rate," +
					"burglary_rate,	larceny_theft_rate,motor_vehicle_theft_rate) VALUES (" + AttributeLinks.commasAndQuestions(44) + ")");
			while ((line = br.readLine()) != null) {
				if (isFirst) {
					isFirst = false;
					continue;
				}
				List<String> cols = CsvParser.fsmParse(line);
				pstmt.setInt(1, Integer.parseInt(cols.get(0)));
				for (int i=2; i<5; i++) {
					String str = cols.get(i-1);
					if (str.startsWith("\"")) str = str.substring(1,str.length()-2);
					pstmt.setString(i, cols.get(i-1));
				}
				for (int i=5; i<35; i++) {
					pstmt.setInt(i, Integer.parseInt(cols.get(i-1)));
				}
				for (int i=35; i<45; i++) {
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
		readCSV("c:/dev/demographics.csv");

		long end = System.currentTimeMillis();
		System.out.println("Done location calculation in: " + (end-start) + "ms");

	}

}
