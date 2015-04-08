package software.uncharted.memex.labor;

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
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

public class LaborData {

	private static final int BATCH_INSERT_SIZE = 5000;
	public static final String ADS_JOBS_TABLE = "ads_jobs";
	
	public LaborData() {
	}
	
	public static void initTable(MemexOculusDB oculusDB) {
		Connection conn = oculusDB.open();
		System.out.println("LABOR INITIALIZATION");
		if(oculusDB.tableExists(conn, ADS_JOBS_TABLE)){
			System.out.println("\t" + ADS_JOBS_TABLE + " table exists.");
		} else {
			createAdsJobsTable(conn);
			System.out.println("\t" + ADS_JOBS_TABLE + " table initialized.");
		}
		oculusDB.close(conn);
	}
	
	private static void createAdsJobsTable (Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `" + ADS_JOBS_TABLE + "` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "title VARCHAR(256) NOT NULL," +
						  "PRIMARY KEY(id)," +
						  "KEY `ads_id` (`ads_id`)," +
						  "KEY `title` (`title`) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	private static void processOculusLabor(TimeLog log) {
		log.pushTime("Get Mike's Labour id data");
		MemexOculusDB oculusDB = MemexOculusDB.getInstance();
		Connection conn = oculusDB.open();
		//oculus_ads_id --> IST ads_id
		HashMap<Integer,Integer> oculusToIstAdIdMap = new HashMap<Integer,Integer>();
		try {
			log.pushTime("Get IST ads_id -> Oculus ads_id map");
			Statement stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT ist.id ist_id, oculus.id oculus_id "
					+ "FROM memex_ht.ads ist INNER JOIN memex_labor.ads oculus "
					+ "ON ist.sources_id = oculus.sources_id AND ist.incoming_id = oculus.incoming_id");
			while(rs.next()) {
				oculusToIstAdIdMap.put(rs.getInt("oculus_id"), rs.getInt("ist_id"));
			}
			log.popTime();
			
			log.pushTime("Get ads_id -> {jobTitle} map");
			//IST ads_id -> {job title}
			HashMap<Integer, HashSet<String>> jobs = new HashMap<Integer, HashSet<String>>(); 
			rs = stmt.executeQuery("SELECT ads_id, value FROM memex_labor.ads_attributes"
					+ " WHERE ads_id IN " + StringUtil.hashSetToSqlList(oculusToIstAdIdMap.keySet())
					+ " AND attribute IN ('post_category','job_type')");
			while(rs.next()) {
				int ads_id = oculusToIstAdIdMap.get(rs.getInt("ads_id"));
				HashSet<String> currentJobs = jobs.get(ads_id);
				if(currentJobs == null) {
					currentJobs = new HashSet<String>();
					jobs.put(ads_id, currentJobs);
				}
				currentJobs.add(rs.getString("value"));
			}
			log.popTime();			
			writeOculusJobs(jobs, conn, log);
		} catch (SQLException e) {
			e.printStackTrace();
		}
		oculusDB.close(conn);
		log.popTime();
	}

	private static void writeOculusJobs(HashMap<Integer, HashSet<String>> jobs, Connection conn, TimeLog log) {
		log.pushTime("Write oculus job data to " + ADS_JOBS_TABLE + " table");

		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + ADS_JOBS_TABLE + 
					" (ads_id, title) VALUES (?,?)");
			int count = 0;
			for(Integer ads_id: jobs.keySet()) {
				for(String title: jobs.get(ads_id)) {
					pstmt.setInt(1, ads_id);
					pstmt.setString(2, title);
					pstmt.addBatch();
					count++;
					if(count%BATCH_INSERT_SIZE==0) {
						pstmt.executeBatch();
					}
				}
			}
			pstmt.executeBatch();
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		log.popTime();
	}

	private static void processISTLabor(TimeLog log) {
		log.pushTime("Get IST's Labour id data");
		MemexHTDB memexHTDB = MemexHTDB.getInstance();
		Connection conn = memexHTDB.open();
		HashMap<Integer, HashSet<String>> jobs = new HashMap<Integer, HashSet<String>>();
		try {
			int ads_id;
			HashSet<String> currentJob;
			Statement stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT id ads_id, value title FROM memex_ht.ads_attributes "
					+ "WHERE attribute = 'jobtype'" );
			while(rs.next()) {
				ads_id = rs.getInt("ads_id");
				currentJob = jobs.get(ads_id);
				if(currentJob == null) {
					currentJob = new HashSet<String>();
					jobs.put(ads_id, currentJob);
				}
				currentJob.add(rs.getString("title"));
			}
			writeISTJobs(jobs, log);
		} catch (SQLException e) {
			e.printStackTrace();
		}		
		memexHTDB.close(conn);
		log.popTime();		
	}

	private static void writeISTJobs(HashMap<Integer, HashSet<String>> jobs, TimeLog log) {
		log.pushTime("Write IST job data to " + ADS_JOBS_TABLE + " table" );
		MemexOculusDB oculusDB = MemexOculusDB.getInstance();
		Connection conn = oculusDB.open();
		PreparedStatement pstmt = null;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement("INSERT INTO " + ADS_JOBS_TABLE + 
					" (ads_id, title) VALUES (?,?)");
			int count = 0;
			for(Integer ads_id: jobs.keySet()) {
				for(String title: jobs.get(ads_id)) {
					pstmt.setInt(1, ads_id);
					pstmt.setString(2, title);
					pstmt.addBatch();
					count++;
					if(count%BATCH_INSERT_SIZE==0) {
						pstmt.executeBatch();
					}
				}
			}
			pstmt.executeBatch();
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null) { pstmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
			
			try {
				conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		oculusDB.close(conn);
		log.popTime();		
	}

	private static void processAdsJobs(TimeLog log) {
		log.pushTime("Populate " + ADS_JOBS_TABLE);
	
		processOculusLabor(log);
		
		processISTLabor(log);
		
		log.popTime();
	}

	public static void main(String[] args) {
		TimeLog log = new TimeLog();
		log.pushTime("Create " + ADS_JOBS_TABLE);
		initTable(MemexOculusDB.getInstance());
		log.popTime();

		processAdsJobs(log);
	}
}