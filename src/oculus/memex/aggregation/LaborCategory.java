package oculus.memex.aggregation;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;

public class LaborCategory {
	public static final String LABOR_ADS_CATEGORY_TABLE = "labor_ads_category";
	public static final String LABOR_CATEGORY_TABLE = "labor_category";
	private static final int BATCH_INSERT_SIZE = 5000;
	
	public static void addIdsByCategory(Connection oculusconn, HashMap<String, HashSet<Integer>> categories) {
		initTable(MemexOculusDB.getInstance(), oculusconn);
		HashMap<String, Integer> sourceCategories = checkCategories(oculusconn, categories.keySet());
		PreparedStatement pstmt = null;
		try {
			oculusconn.setAutoCommit(false);
			pstmt = oculusconn.prepareStatement("INSERT INTO " + LABOR_ADS_CATEGORY_TABLE + "(ads_id, category) VALUES (?,?)");
			int count = 0;
			for(String category: categories.keySet()) {
				HashSet<Integer> ids = categories.get(category);
				for(Integer id: ids) {
					pstmt.setInt(1,id);
					pstmt.setInt(2, sourceCategories.get(category));
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

	public static HashMap<String, Integer> getCategories(Connection oculusconn) {
		HashMap<String, Integer> result = new HashMap<String, Integer>();
		initCategoryTable(MemexOculusDB.getInstance(), oculusconn);
		Statement stmt;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery("Select * from " + LABOR_CATEGORY_TABLE);
			while(rs.next()) { 
				result.put(rs.getString("category"),rs.getInt("id")); 
			}				
		} catch (SQLException e) {
			e.printStackTrace();
		}	
		return result;
	}
	
	public static HashMap<Integer, String> getCategoriesById(Connection oculusconn) {
		HashMap<Integer, String> result = new HashMap<Integer, String>();
		initCategoryTable(MemexOculusDB.getInstance(), oculusconn);
		Statement stmt;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery("Select * from " + LABOR_CATEGORY_TABLE);
			while(rs.next()) { 
				result.put(rs.getInt("id"),rs.getString("category")); 
			}				
		} catch (SQLException e) {
			e.printStackTrace();
		}	
		return result;
	}

	public static HashMap<Integer, Integer> getAdsByCategory(Connection conn) {
		HashMap<Integer,Integer> adCategoryMap = new HashMap<Integer,Integer>();
		Statement stmt;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT ads_id, category FROM " + LABOR_ADS_CATEGORY_TABLE);
			while(rs.next()) {
				adCategoryMap.put(rs.getInt("ads_id"),rs.getInt("category"));
			}
		} catch (SQLException e) {
			e.printStackTrace();
		}
		return adCategoryMap;
	}
	
	private static void createTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `" + LABOR_ADS_CATEGORY_TABLE + "` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "ads_id INT(11) NOT NULL," +
						  "category INT(11) NOT NULL," +
						  "PRIMARY KEY (id)," + 
						  "KEY ads_idx (ads_id)," +
						  "KEY category_idx (category) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	private static void initTable(MemexOculusDB db, Connection conn) {
		if (db.tableExists(conn, LABOR_ADS_CATEGORY_TABLE)) {
			System.out.println("Clearing table: " + LABOR_ADS_CATEGORY_TABLE);
			db.clearTable(conn, LABOR_ADS_CATEGORY_TABLE);
		} else {			
			System.out.println("Creating table: " + LABOR_ADS_CATEGORY_TABLE);
			createTable(db, conn);
		}
	}

	private static void initCategoryTable(MemexOculusDB db, Connection conn) {		
		if (!db.tableExists(conn, LABOR_CATEGORY_TABLE)) {			
			try {
				String sqlCreate = 
						"CREATE TABLE `"+LABOR_CATEGORY_TABLE+"` (" +
							  "id INT(11) NOT NULL AUTO_INCREMENT," +
							  "category VARCHAR(64) NOT NULL," +
							  "PRIMARY KEY (id)," + 
							  "KEY category_idx (category) )";
				DBManager.tryStatement(conn, sqlCreate);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	private static HashMap<String, Integer> checkCategories(Connection oculusconn, Set<String> set) {
		HashMap<String, Integer> currentCategoryMap = getCategories(oculusconn);
		currentCategoryMap.keySet().removeAll(set);
		PreparedStatement pstmt = null;
		try {
			oculusconn.setAutoCommit(false);
			pstmt = oculusconn.prepareStatement("INSERT INTO " + LABOR_CATEGORY_TABLE + "(category) VALUES (?)");
			int count = 0;
			for(String category: currentCategoryMap.keySet()) {
					pstmt.setString(1, category);
					pstmt.addBatch();
					count++;
					if (count % BATCH_INSERT_SIZE == 0) {
						pstmt.executeBatch();
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
		return getCategories(oculusconn);
	}

	public static String getCategory(String category_id) {
		String result = null;
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		try {
			Statement stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT category FROM " + LABOR_CATEGORY_TABLE + " WHERE id="+category_id);
			rs.next();
			result = rs.getString("category");
		} catch (SQLException e) {
			e.printStackTrace();
		}
		db.close(conn);
		return result;
	}
}