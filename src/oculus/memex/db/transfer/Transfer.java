package oculus.memex.db.transfer;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;

import oculus.memex.db.DBManager;
import oculus.memex.util.StringUtil;

public class Transfer {
	private static int BATCH_INSERT_SIZE = 2000;

	public static String createInsertSQL(String table, String[] columns) {
		String columnStr = "";
		boolean isFirst = true;
		for (int i=0; i<columns.length; i++) {
			if (isFirst) isFirst = false;
			else columnStr += ",";
			columnStr += columns[i];
		}
		return "insert into " + table + " (" + columnStr + ") values ("+ StringUtil.commasAndQuestions(columns.length) + ")";
	}

	
	public static void write(DBManager db, ArrayList<String[]> data, String sql) {
		PreparedStatement pstmt = null;
		Connection conn = db.open();
		int i = 0;
		try {
			conn.setAutoCommit(false);
			pstmt = conn.prepareStatement(sql);
			int count = 0;
			for (i=0; i<data.size(); i++) {
				String[] ad = data.get(i);
				for (int j=0; j<ad.length; j++) {
					pstmt.setString(j+1,ad[j]);
				}
				pstmt.addBatch();
				count++;
				if (count % BATCH_INSERT_SIZE == 0) {
					pstmt.executeBatch();
				}
			}
			pstmt.executeBatch();
		} catch (Exception e) {
			e.printStackTrace();
			System.exit(0);
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
	
	public static ArrayList<String[]> read(DBManager db, String table, String whereClause, String[] columns) {
		ArrayList<String[]> result = new ArrayList<String[]>();
		Connection conn = db.open();
		String sqlStr = "SELECT * from " + table + " where " + whereClause;
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String[] ad = new String[columns.length];
				for (int i=0; i<columns.length; i++) {
					ad[i] = rs.getString(columns[i]);
				}
				result.add(ad);
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
