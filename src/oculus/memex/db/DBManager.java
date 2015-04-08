package oculus.memex.db;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Properties;

import oculus.memex.util.StringUtil;

public class DBManager {
	public static int BATCH_SELECT_RANGE = 100000;
	public static int POOL_SIZE = 30;
	
	public String database_type = ScriptDBInit._type;
	public String database_hostname = ScriptDBInit._hostname;
	public String database_port = ScriptDBInit._port;
	public String database_user = ScriptDBInit._user;
	public String database_password = ScriptDBInit._pass;
	public String database_name = ScriptDBInit._oculusSchema;

	Connection[] _connections = new Connection[POOL_SIZE];
	public Object _dbLock = new Object();
	public boolean _locked = false;
	public boolean _driverLoaded = false;

	public static abstract class ResultHandler {
		public abstract void handleResult(ResultSet rs) throws SQLException ;
	}
	
	public DBManager(String name, String type, String hostname, String port, String user, String pass) throws Exception {
		database_type = type;
		database_hostname = hostname;
		database_port = port;
		database_user = user;
		database_password = pass;
		database_name = name;

		System.out.println("Logging in to database: (" + name + ", " + type + ", " + hostname + ", " + port + ", " + user + ", " + pass + ")");
		initDriver();
		initDatabase();
	}
	
	private void initDatabase() throws Exception {
		Properties connectionProps = new Properties();
		connectionProps.put("user", database_user);
		connectionProps.put("password", database_password);
		if (database_type.equals("mysql")) {
			connectionProps.put("rewriteBatchedStatements", "true");
		}
		
		String connectionStr = "";	//construct DB connection URL
		Connection conn = null;
		if (database_type.equals("impala")) {
			connectionStr = "jdbc:" + "hive2://" + database_hostname +	":" + database_port + "/;auth=noSasl";
			conn = DriverManager.getConnection(connectionStr, connectionProps);
			tryStatement(conn, "INVALIDATE METADATA");	//refreshes impala's metadata for tables/db's	
		} else {
			connectionStr = "jdbc:" + database_type + "://" + database_hostname +	":" + database_port + "/" + database_name;
			conn = DriverManager.getConnection(connectionStr, connectionProps);
		}
				
		boolean dbExists = false;
		ResultSet rs = null;
		try {
			// Iterate our set of catalogs (i.e., databases)
			rs = (database_type.equals("hive2") || database_type.equals("impala")) ? conn.getMetaData().getSchemas() : conn.getMetaData().getCatalogs();
			while (rs.next()) {
				if (rs.getString(1).equals(database_name)) {
					dbExists = true;
					break;
				}
			}
		} finally {
			try {
				if (rs != null) { rs.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

		if (!dbExists) {
			tryStatement(conn, "CREATE DATABASE " + database_name);
			conn.close();
		}	
	}
	
	private void initDriver() {
		if (_driverLoaded) return;
		try {
			if ("postgresql".equals(database_type)) {
				Class.forName("org.postgresql.Driver");
			} else if ("hive2".equals(database_type) || "impala".equals(database_type)) {
				Class.forName("org.apache.hive.jdbc.HiveDriver");
			} else {
				Class.forName("com.mysql.jdbc.Driver");
			}
			_driverLoaded = true;
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public Connection open() {
		return open(database_name);
	}	
	private Connection open(String db) {
		Connection conn = null;
		try {
			while (conn==null) {
				synchronized (_dbLock) {
					for (int i=0;i<POOL_SIZE; i++) {
						if (_connections[i]==null) {
							conn = getConnection(db);
							_connections[i] = conn;
							break;
						}
					}
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		return conn;
	}
	public void close(Connection conn) {
		try {
			synchronized (_dbLock) {
				for (int i=0;i<POOL_SIZE; i++) {
					if (_connections[i]==conn) {
						conn.close();
						_connections[i] = null;
						break;
					}
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	private Connection getConnection(String db) throws SQLException {
		Connection conn = null;
		Properties connectionProps = new Properties();
		connectionProps.put("user", database_user);
		connectionProps.put("password", database_password);
		if (database_type.equals("mysql")) {
			connectionProps.put("rewriteBatchedStatements", "true");
		}

		String connectionStr = "";
		if (database_type.equals("impala")) {
			connectionStr = "jdbc:" + "hive2://" + database_hostname +	":" + database_port + "/;auth=noSasl";
			conn = DriverManager.getConnection(connectionStr, connectionProps);
			tryStatement(conn, "INVALIDATE METADATA");	//refreshes Impala's metadata for tables/db's
			tryStatement(conn, "USE " + db);			//creates Impala connection to desired database		
		}
		else {
			connectionStr = "jdbc:" + database_type + "://" + database_hostname +	":" + database_port + "/" + db;
			conn = DriverManager.getConnection(connectionStr, connectionProps);
		}
		return conn;
	}


	public static boolean tryStatement(Connection conn, String sqlStr) {
		boolean success = false;
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			stmt.execute(sqlStr);
			success = true;
		} catch (Exception e) {
			System.out.println("Failed sql: " + sqlStr);
			e.printStackTrace();
			success = false;
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		
		return success;
	}
	
	public static int getInt(Connection conn, String sqlStr, String description) {
		int result = 0;
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result = rs.getInt(1);
			}
		} catch (Exception e) {
			System.out.println("Failed sql (" + description + ") (" + sqlStr + ")");
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
	
	public static int getResultCount(Connection conn, String sqlStr, String description) {
		int result = 0;
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result++;
			}
		} catch (Exception e) {
			System.out.println("Failed sql (" + description + ") (" + sqlStr + ")");
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
	
	public boolean tableExists(Connection conn, String table) {
		ResultSet tables = null;
		try {
			DatabaseMetaData dbm = conn.getMetaData();
			tables = dbm.getTables(null, null, table, null);
			return tables.next();
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			if (tables!=null) {
				try {
					tables.close();
				} catch (SQLException e) {
					e.printStackTrace();
				}
			}
		}
		return false; 
	}
	
	public void clearTable(Connection conn, String table) {		
		try {
			if (database_type.equals("impala")) {
				throw new Exception("TRUNCATE command not supported for Impala.  Need to DROP and re-CREATE table instead.");
			}
			tryStatement(conn, "TRUNCATE TABLE " + table);
		}
		catch (Exception e) {
			e.printStackTrace();
		}
	}

	public static void getResults(Connection conn, String[] columns, String table, ResultHandler rh) {
		getResults(conn, "id", columns, table, rh);
	}
	public static void getResults(Connection conn, String indexColumn, String[] columns, String table, ResultHandler rh) {
		int maxid = getInt(conn, "select max(" + indexColumn + ") from " + table, "Get max " + indexColumn + " from " + table);
		String baseSqlStr = "select " + columns[0];
		for (int j=1; j<columns.length; j++) {
			baseSqlStr += "," + columns[j];
		}
		baseSqlStr += " from " + table;
		Statement stmt = null;
		for (int i=0; i<maxid; i+=BATCH_SELECT_RANGE) {
			String sqlStr = baseSqlStr + " where " + indexColumn + ">=" + i + " and " + indexColumn + "<" + (i + BATCH_SELECT_RANGE);
			stmt = null;
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					rh.handleResult(rs);
				}
			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				try {
					if (stmt != null) { stmt.close(); }
				} catch (SQLException e) {e.printStackTrace();}
			}
		}
		
	}
	public static void getResultsOrdered(Connection conn, String indexColumn, String[] columns, String table, ResultHandler rh) {
		int maxid = getInt(conn, "select max(" + indexColumn + ") from " + table, "Get max " + indexColumn + " from " + table);
		String baseSqlStr = "select " + columns[0];
		for (int j=1; j<columns.length; j++) {
			baseSqlStr += "," + columns[j];
		}
		baseSqlStr += " from " + table;
		Statement stmt = null;
		for (int i=0; i<maxid; i+=BATCH_SELECT_RANGE) {
			String sqlStr = baseSqlStr + " where " + indexColumn + ">=" + i + " and " + indexColumn + "<" + (i + BATCH_SELECT_RANGE) + " order by " + indexColumn;
			stmt = null;
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					rh.handleResult(rs);
				}
			} catch (Exception e) {
				e.printStackTrace();
			} finally {
				try {
					if (stmt != null) { stmt.close(); }
				} catch (SQLException e) {e.printStackTrace();}
			}
		}
		
	}
	public static void getResults(Connection conn, String indexColumn, ArrayList<Integer> ids, String[] columns, String table, ResultHandler rh) {
		String baseSqlStr = "select " + columns[0];
		for (int j=1; j<columns.length; j++) {
			baseSqlStr += "," + columns[j];
		}
		baseSqlStr += " from " + table;
		for (int i=0; i<ids.size(); i+=BATCH_SELECT_RANGE) {
			int end = Math.min(ids.size(), i+BATCH_SELECT_RANGE-1);
			String sqlStr = baseSqlStr + " where " + indexColumn + " IN " + 
					StringUtil.hashSetToSqlList(new HashSet<Integer>(ids.subList(i, end)));
			getResultsBatch(conn, sqlStr, rh);
		}
		
	}
	private static void getResultsBatch(Connection conn, String sqlStr, ResultHandler rh) {
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				rh.handleResult(rs);
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
	}


}
