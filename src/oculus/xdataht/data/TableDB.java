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
package oculus.xdataht.data;

import java.io.File;
import java.io.FilenameFilter;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Properties;
import java.util.Set;

import oculus.xdataht.clustering.ClusterResults;
import oculus.xdataht.model.LocationTimeVolumeResult;
import oculus.xdataht.model.LocationVolumeResult;
import oculus.xdataht.model.StringList;
import oculus.xdataht.model.TimeVolumeResult;

public class TableDB {
	static final public String AD_EXTRACTION_TABLE = "adextracted";
	static final public String AD_KEYWORD_TABLE = "adkeywords";
	static final public String KEYWORD_TABLE = "keywords";
	static final public String LOCATION_TABLE = "locations";
	static final public String LOCATION_TIME_TABLE = "locationtime";
	static final public String LOCATION_CLUSTER_TABLE = "locationcluster";
	static final public String CLUSTER_DETAILS_TABLE = "orgclusterdetails";
	static final public String CLUSTER_LINKS_TABLE = "orgclusterlinks";
	static final public String TIME_TABLE = "temporal";
	private static final String DATA_TABLES_TABLE = "data_tables";
	private static final String CLUSTER_SETS_TABLE = "cluster_sets";
	private static final String CLUSTER_CONTENTS_TABLE = "cluster_contents";
	private static final String TAGS_TABLE = "tags";
	public static final int BATCH_INSERT_SIZE = 2000;
	public static enum DataTableType {
		AD,
		WIDE,
		REFINE;
		public String toString(){
			return super.toString().toLowerCase();
		}
	};
	
	private static String database_type = "mysql";
	private static String database_hostname = "localhost";
	private static String database_port = "3306";
	private static String database_user = "root";
	private static String database_password = "admin";
	private static String database_name = "xdataht";

	private Connection _conn;

	private Object _dbLock = new Object();
	private boolean _locked = false;
	
	private boolean _driverLoaded = false;
	private String _dataDir;
	
	private static TableDB _instance = null;
	
	public static TableDB getInstance() {
		if (_instance==null) {
			try {
				_instance = new TableDB();
			} catch (Exception e) {
				System.out.println("FAILED TO CONNECT TO DATABASE: " + e.getMessage());
			}
		}
		return _instance;
	}
	
	public static TableDB getInstance(String name, String type, String hostname, String port, 
			String user, String pass, String dataDir) {
		if (_instance==null) {
			try {
				_instance = new TableDB(name, type, hostname, port, user, pass, dataDir);
			} catch (Exception e) {
				System.out.println("FAILED TO CONNECT TO DATABASE: " + e.getMessage());
			}
		}
		return _instance;
	}
	
	public TableDB() throws Exception {
		initDriver();
		initDatabase();
	}
	
	public TableDB(String name, String type, String hostname, String port, String user, String pass, String dataDir) throws Exception {
		database_type = type;
		database_hostname = hostname;
		database_port = port;
		database_user = user;
		database_password = pass;
		database_name = name;
		_dataDir = dataDir;
		System.out.println("Logging in to database: (" + name + ", " + type + ", " + hostname + ", " + port + ", " + user + ", " + pass + ")");
		initDriver();
		initDatabase();
	}
	
	public ArrayList<String> getTableNames(DataTableType type) {
		ArrayList<String> names = new ArrayList<String>();
		open();
		Statement stmt = null;
		try {
			// Fetch all tables from DB
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + DATA_TABLES_TABLE + " WHERE type = " + "'" + type + "'");
			while (rs.next()) {
				String tableName = rs.getString("table_name");
				names.add(tableName);
			}			
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
			
		return names;
	}
	
	public HashMap<String, ArrayList<String>> getClusterSetMapping() {
		HashMap<String,ArrayList<String>> mapping = new HashMap<String,ArrayList<String>>();
		
		open();
		Statement stmt = null;
		try {
			// Fetch all tables from DB
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT * FROM " + CLUSTER_SETS_TABLE);
			while (rs.next()) {
				String clusterSetName = rs.getString(1);
				String criteriaString = rs.getString(2);
				String[] criteriaPieces = criteriaString.split("-");		// TODO:   This needs to be fixed.   We're currently storing criteria as an encoded string separated by a dash.   Naming a clusterset with a dash
																			//			will totally break this.   Should make a new column called table name and keep it there instead of worrying about decoding criteria
				String tableName = criteriaPieces[0];
				
				ArrayList<String> clusterSets = mapping.get(tableName);
				if (clusterSets == null) {
					clusterSets = new ArrayList<String>();
				}
				clusterSets.add(clusterSetName);
				mapping.put(tableName, clusterSets);
				
			}			
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
		
		
		return mapping;
	}
	
	public void clearClusterResults(String name) {
		tryStatement(_conn, "DELETE FROM " + CLUSTER_CONTENTS_TABLE + " WHERE set_id='" + name + "'");
	}

	public void putClusterResults(String name, ClusterResults results) throws InterruptedException{	
		PreparedStatement pstmt = null;
		open();
		try {
			// Track this cluster result in CLUSTER_SETS_TABLE
			tryStatement(_conn, "INSERT INTO " + CLUSTER_SETS_TABLE
							+ "(id, criteria) VALUES ('" + name + "', '"
							+ results.getClusterParametersString() + "') "
							+ "ON DUPLICATE KEY UPDATE criteria=VALUES(criteria)");
			
			// If this clusterset id already exists in the table, delete first.
			tryStatement(_conn, "DELETE FROM " + CLUSTER_CONTENTS_TABLE + " WHERE set_id='" + name + "'");
			
			_conn.setAutoCommit(false);
			pstmt = _conn.prepareStatement("INSERT INTO " + CLUSTER_CONTENTS_TABLE + "(set_id, cluster_id, ad_id) VALUES (?, ?, ?)");
			
			int count = 0;
			Map<String, Set<String>> clustersById = results.getClustersById();
			for (Entry<String, Set<String>> entry : clustersById.entrySet()) {
				String clusterId = entry.getKey();
				for (String adId : entry.getValue()) {
					pstmt.setString(1, name);
					pstmt.setString(2, clusterId);
					pstmt.setString(3, adId);
					pstmt.addBatch();
					
					if (Thread.interrupted()) {
						throw new InterruptedException();
					}
					
					++count;
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
				_conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
	}
	
	public void putPreclusterResults(String tableName, Map<String, List<String>> results) throws InterruptedException {	
		PreparedStatement pstmt = null;
		open();
		try {
			_conn.setAutoCommit(false);
			pstmt = _conn.prepareStatement("INSERT INTO " + tableName  + "(ad_id, person_cluster_id, org_cluster_id, location_cluster_id) VALUES (?, ?, ?, ?)");
			
			int count = 0;
			for (String ad_id : results.keySet()) {
				List<String> triple = results.get(ad_id);
				pstmt.setInt(1, Integer.parseInt(ad_id));
				pstmt.setInt(2, Integer.parseInt(triple.get(0)));
				pstmt.setInt(3, Integer.parseInt(triple.get(1)));
				pstmt.setInt(4, Integer.parseInt(triple.get(2)));
				pstmt.addBatch();
				
				if (Thread.interrupted()) {
					throw new InterruptedException();
				}
				
				++count;
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
				_conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
	}
	
	public ClusterResults getClusterResults(String dataset, String name) {
		if (name.equalsIgnoreCase("louvain")) {
			return getLouvainResults(dataset);
		}
		Statement stmt = null;
		ClusterResults cluster = null;
		String clusterParamters = null;
		open();
		try {
			stmt = _conn.createStatement();
			
			// Fetch the cluster criteria string from the CLUSTER_SETS_TABLE
			ResultSet rs = stmt.executeQuery("SELECT criteria FROM "
					+ CLUSTER_SETS_TABLE + " WHERE id='" + name + "'");

			if (rs.next()) {
				clusterParamters = rs.getString(1);
			}
			
			// Fetch the cluster data
			rs = stmt.executeQuery("SELECT cluster_id, ad_id FROM "
					+ CLUSTER_CONTENTS_TABLE + " WHERE set_id='" + name + "'");

			Map<String, Set<String>> clusteringResult = new HashMap<String, Set<String>>();
			while (rs.next()) {
				String clusterId = rs.getString(1);
				String adId = rs.getString(2);

				Set<String> adSet = clusteringResult.get(clusterId);
				if (adSet == null) {
					adSet = new HashSet<String>();
					clusteringResult.put(clusterId, adSet);
				}
				
				adSet.add(adId);
			}
			
			cluster = new ClusterResults(clusterParamters.split("-")[0], clusteringResult, clusterParamters);
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		close();
		return cluster;
	}

	public boolean containsClusterResults(String id, String params) {
		Statement stmt = null;
		boolean result = false;
		open();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT criteria FROM "
					+ CLUSTER_SETS_TABLE + " WHERE id='" + id + "'");

			if (rs.next()) {
				String cachedParams = rs.getString(1);
				result = params.equals(cachedParams);
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
		close();
		return result;
	}
	
	public ClusterResults getLouvainResults(String dataset) {
		Statement stmt = null;
		ClusterResults cluster = null;
		String clusterParamters = dataset + "-[\"phone\",\"email\",\"rb_inbox\",\"website\",\"text_field\"]-[1,1,1,1,1]";
		open();
		try {
			stmt = _conn.createStatement();
			
			// Fetch the cluster data
			ResultSet rs = stmt.executeQuery("SELECT community,id FROM " + dataset + "_louvain");

			Map<String, Set<String>> clusteringResult = new HashMap<String, Set<String>>();
			while (rs.next()) {
				String clusterId = rs.getString(1);
				String adId = rs.getString(2);

				Set<String> adSet = clusteringResult.get(clusterId);
				if (adSet == null) {
					adSet = new HashSet<String>();
					clusteringResult.put(clusterId, adSet);
				}
				
				adSet.add(adId);
			}
			
			cluster = new ClusterResults(dataset, clusteringResult, clusterParamters);
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		close();
		return cluster;
	}

	private void initDriver() {
		if (_driverLoaded) return;
		try {
			if ("postgresql".equals(database_type)) {
				Class.forName("org.postgresql.Driver");
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
	public Connection open(String db) {
		try {
			synchronized (_dbLock) {
				while (_locked) _dbLock.wait();
				_locked = true;
			}
			_conn = getConnection(db);
		} catch (Exception e) {
			e.printStackTrace();
		}
		return _conn;
	}
	public void close() {
		try {
			_conn.close();
			_conn = null;
			synchronized (_dbLock) {
				_locked = false;
				_dbLock.notify();
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
		conn = DriverManager.getConnection("jdbc:" + database_type + "://" + 
				database_hostname +	":" + database_port + "/" + db, connectionProps);
		return conn;
	}

	public Connection getActiveConnection() {
		return _conn;
	}

	public boolean tryStatement(Connection conn, String sqlStr) {
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
		
	private void createAdTable(String tableName) {
		String sqlCreate = 
				"CREATE TABLE `"+tableName+"` (" +
				"`id` INT NOT NULL ," +
				"`provider_id` VARCHAR(45) NULL ," +
				"`org_id` VARCHAR(45) NULL ," +
				"`adid` VARCHAR(45) NULL ," +
				"`orgid` VARCHAR(45) NULL ," +
				"`providerid` VARCHAR(45) NULL ," +
				"`title` VARCHAR(45) NULL ," +
				"`service` VARCHAR(45) NULL ," +
				"`region` VARCHAR(45) NULL ," +
				"`views` VARCHAR(45) NULL ," +
				"`availability` VARCHAR(45) NULL ," +
				"`name` VARCHAR(45) NULL ," +
				"`phone` VARCHAR(45) NULL ," +
				"`rb_inbox` VARCHAR(45) NULL ," +
				"`email` VARCHAR(45) NULL ," +
				"`website` VARCHAR(45) NULL ," +
				"`ethnicity` VARCHAR(45) NULL ," +
				"`age` VARCHAR(45) NULL ," +
				"`eye_color` VARCHAR(45) NULL ," +
				"`hair_color` VARCHAR(45) NULL ," +
				"`build` VARCHAR(45) NULL ," +
				"`height` VARCHAR(45) NULL ," +
				"`bust` VARCHAR(45) NULL ," +
				"`cup` VARCHAR(45) NULL ," +
				"`kitty` VARCHAR(45) NULL ," +
				"`rate` VARCHAR(45) NULL ," +
				"`incall` VARCHAR(45) NULL ," +
				"`outcall` VARCHAR(45) NULL ," +
				"`screening` VARCHAR(45) NULL ," +
				"`text_field` BLOB NULL ," +
				"`city` VARCHAR(45) NULL ," +
				"`premier` VARCHAR(45) NULL ," +
				"`file` VARCHAR(45) NULL ," +
				"`path` VARCHAR(45) NULL ," +
				"`server` VARCHAR(45) NULL ," +
				"`post_time` VARCHAR(45) NULL ," +
				"`first_timestamp` VARCHAR(45) NULL ," +
				"`timestamp` VARCHAR(45) NULL ," +
				"`title_ngram` VARCHAR(45) NULL ," +
				"`title_fingerprint` VARCHAR(45) NULL ," +
				"`name_ngrams` VARCHAR(45) NULL ," +
				"`name_fingerprint` VARCHAR(45) NULL ," +
				"`city_ngrams` VARCHAR(45) NULL ," +
				"`city_fingerprint` VARCHAR(45) NULL ," +
				"PRIMARY KEY (`id`) )";
		tryStatement(_conn, sqlCreate);
		
		// Create entry in ad_tables table to track data tables.
		recordDataTable(tableName, DataTableType.AD);
	}
	
	public void createBackpageTable(String tableName) {
		String sqlCreate = 
				"CREATE TABLE `"+tableName+"` (" +
					  "`id` VARCHAR(16) NOT NULL ," +
					  "`oid` INT(11) NULL ," +
					  "`body` TEXT NULL ," +
					  "`title` TEXT NULL ," +
					  "`keywords` TEXT NULL ," +
					  "`description` TEXT NULL ," +
					  "`images` TEXT NULL ," +
					  "`image_alt` TEXT NULL ," +
					  "`phone_numbers` VARCHAR(200) NULL ," +
					  "`location` VARCHAR(45) NULL ," +
					  "`email` VARCHAR(200) NULL ," +
					  "`timestamp` VARCHAR(45) NULL ," +
					  "PRIMARY KEY (`id`) )";
		tryStatement(_conn, sqlCreate);
		
		// Create entry in ad_tables table to track data tables.
		recordDataTable(tableName, DataTableType.AD);
	}

	public void loadCSVBackpage(File csvFile, String tableName) {
		String sqlStr = "load data local infile '"+ csvFile.getAbsolutePath().replace('\\', '/') +
				"' into table `xdataht`.`"+tableName+"` " +
				"fields terminated by ','" +
				"enclosed by '\"' " +
				"lines terminated by '\\n' " +
				"ignore 1 lines " +
				"(id,oid,body,title,keywords,description,images,image_alt,phone_numbers,location,email,timestamp)";
		tryStatement(_conn, sqlStr);
	}
	
	public static void main(String[] args) {
		TableDB.getInstance().open();
		TableDB.getInstance().createBackpageTable("backpage_ads");
		
		File csv = new File("C:/data/backpage_parsed.csv");
		
		TableDB.getInstance().loadCSVBackpage(csv, "backpage_ads");
		TableDB.getInstance().close();
	}
	
	/**
	 * For use when a table needs recording but wasn't created via TableDB methods.
	 * @param tableName
	 * @param type
	 */
	public void recordDataTable(String tableName, DataTableType type){
		tryStatement(_conn, "INSERT INTO " + DATA_TABLES_TABLE + 
				"(table_name, type) VALUES('" + tableName + "'," + "'" + type + "')");
	}
	
	private void loadCSV(File csvFile, String tableName) {
		String sqlStr = "load data local infile '"+ csvFile.getAbsolutePath().replace('\\', '/') +
				"' into table `xdataht`.`"+tableName+"` " +
				"fields terminated by ','" +
				"enclosed by '\"' " +
				"lines terminated by '\\n' " +
				"ignore 1 lines " +
				"(id,provider_id,org_id,adid,orgid,providerid,title,service,region,views,availability,name,phone,rb_inbox,email,website,ethnicity,age,eye_color,hair_color,build,height,bust,cup,kitty,rate,incall,outcall,screening,text_field,city,premier,file,path,server,post_time,first_timestamp,timestamp,title_ngram,title_fingerprint,name_fingerprint,name_ngrams,city_fingerprint,city_ngrams)";
		tryStatement(_conn, sqlStr);
	}

	public void cache() throws Exception {
		// Ensure we've got a table for each CSV file in the data dir.
		syncDb(_dataDir);
	}
	
	private void initDatabase() throws Exception {
		Properties connectionProps = new Properties();
		connectionProps.put("user", database_user);
		connectionProps.put("password", database_password);
		
		Connection conn = DriverManager.getConnection("jdbc:" + database_type + "://" + 
					database_hostname +	":" + database_port + "/", connectionProps);
		
		boolean dbExists = false;
		ResultSet rs = null;
		try {
			// Iterate our set of catalogs (i.e., databases)
			rs = conn.getMetaData().getCatalogs();
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
			syncDb(_dataDir);
		}	
	}
	
	public boolean tableExists(String table) {
		ResultSet tables = null;
		try {
			DatabaseMetaData dbm = _conn.getMetaData();
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
	
	public void clearTable(String table) {
		tryStatement(_conn, "TRUNCATE TABLE " + table);
	}

	private void syncDb(String dataDir) throws Exception {
		// Look for CSV files in data dir
		File dd = new File(dataDir);
		FilenameFilter filter = new FilenameFilter() {
			
			@Override
			public boolean accept(File dir, String name) {
				return name.endsWith(".csv");
			}
		};
		
		open();
		
		try {
			// TODO: Not sure which length to use for our VARCHAR columns.
			
			// Create a table to track our ad data tables
			if (!tableExists(DATA_TABLES_TABLE)) {
			    String sql = "CREATE TABLE " + DATA_TABLES_TABLE +
		                   " (`table_name` VARCHAR(255) NOT NULL, " +
		                   " `type` VARCHAR(10) NOT NULL, " +   
		                   " PRIMARY KEY (`table_name`))";
				tryStatement(_conn, sql);
			}
			
			// Create a table to cache computed cluster results
			if (!tableExists(CLUSTER_SETS_TABLE)) {
			    String sql = "CREATE TABLE " + CLUSTER_SETS_TABLE +
		                   " (`id` VARCHAR(255) NOT NULL, " +
		                   " `criteria` TEXT NOT NULL, " +
		                   " PRIMARY KEY (`id`))";
				tryStatement(_conn, sql);
			}
			
			// Create a table to cache computed cluster results
			if (!tableExists(CLUSTER_CONTENTS_TABLE)) {
			    String sql = "CREATE TABLE " + CLUSTER_CONTENTS_TABLE +
		                   " (`set_id` VARCHAR(255) NOT NULL, " +
		                   " `cluster_id` VARCHAR(50) NOT NULL, " +
		                   " `ad_id` VARCHAR(50) NOT NULL)";
				tryStatement(_conn, sql);
			}
			
			// Create a table to store tags for ads
			if (!tableExists(TAGS_TABLE)) {
				String sql = "CREATE TABLE " + TAGS_TABLE + 
						"(`ad_id` INT(11) NOT NULL, " +
						"`tag` VARCHAR(250))";
				tryStatement(_conn, sql);
			}
					
			for (File csvFile : dd.listFiles(filter)) {
				String tableName = csvFile.getName().split("\\.")[0];
				if (!tableExists(tableName)) {
					createAdTable(tableName);
					loadCSV(csvFile, tableName);
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		close();
	}
	
	private DataTable getDataTable(String tableName, String sqlStr) {
		Statement stmt = null;
		DataTable dt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			dt = new DataTable();
			ResultSetMetaData rsmd = rs.getMetaData();
			int columnCount = rsmd.getColumnCount();
			dt.columns = new ArrayList<String>(columnCount);
			dt.rows = new ArrayList<DataRow>();
			for (int i=0; i<columnCount; i++) {
				dt.columns.add(rsmd.getColumnName(i+1));
			}
			while (rs.next()) {
				DataRow dr = new DataRow();
				dt.rows.add(dr);
				for (String columnName:dt.columns) {
					dr.put(columnName, rs.getString(columnName));
				}
			}
			dt.updateRowLookup();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		return dt;
	}

	public DataTable getDataTableMembers(String tableName, Set<String> members) {
		open();
		try {
			String refinedTableName = tableName + "_refine";
			String sqlStr = "SELECT * FROM " + tableName;
			if (tableExists(refinedTableName)) {
				sqlStr += " INNER JOIN " + refinedTableName + " ON " + tableName + ".id=" + refinedTableName + ".id";
			}
			String louvainTableName = tableName + "_louvain";
			if (tableExists(louvainTableName)) {
				sqlStr += " INNER JOIN " + louvainTableName + " ON " + tableName + ".id=" + louvainTableName + ".id";
			}
			sqlStr += " WHERE " + tableName + ".id IN (";
			boolean isFirst = true;
			for (String member:members) {
				if (isFirst) isFirst = false;
				else sqlStr += ",";
				sqlStr += member;
			}
			sqlStr += ")";
			DataTable dt = getDataTable(tableName, sqlStr);
			close();
			return dt;
		} catch (Exception e) {
			e.printStackTrace();
		}
		close();
		DataTable dt = new DataTable();
		dt.columns = new ArrayList<String>();
		dt.rows = new ArrayList<DataRow>();
		return dt;
	}

	public DataTable getDataTableColumns(String tableName, ArrayList<String> columns) {
		open();
		DataTable table = getDataTableColumns(tableName, columns, null);
		close();
		return table;
	}
	
	public DataTable getDataTableColumns(String tableName, ArrayList<String> columns, int batchSize) throws InterruptedException {
		open();
		int startId = 1;
		int endId = startId + batchSize;
		DataTable tempTable = null;
		DataTable result = null;
		ArrayList<String> idList = new ArrayList<String>();
		do {
			if (Thread.interrupted()) {
				close();
				throw new InterruptedException();
			}
			
			idList.clear();
			for (int i = startId; i < endId; i++) {
				idList.add(i + "");
			}
			tempTable = getDataTableColumns(tableName, columns, idList);
			if (tempTable.size() == 0) {
				break;
			} else if (result == null) {
				result = tempTable;
			} else {
				result.merge(tempTable);
			}
			startId = endId;
			endId += batchSize;
		} while (tempTable.size()>0);
		close();
		return result;
	}

	public DataTable getDataTableColumns(String tableName, ArrayList<String> columns, ArrayList<String> idList) {
		String refinedTableName = tableName+"_refine";
		String louvainTableName = tableName+"_louvain";
		StringBuffer sqlStr = new StringBuffer("SELECT " + tableName + ".id");
		for (String column:columns) {
			sqlStr.append("," + column);
		}
		sqlStr.append(" FROM " + tableName);
		if (tableExists(refinedTableName)) {
			sqlStr.append(" INNER JOIN " + refinedTableName + " ON " + tableName + ".id=" + refinedTableName + ".id");
		}
		if (tableExists(louvainTableName)) {
			sqlStr.append(" INNER JOIN " + louvainTableName + " ON " + tableName + ".id=" + louvainTableName + ".id");
		}
		if (idList!=null) {
			sqlStr.append(" WHERE " + tableName + ".id IN (");
			boolean isFirst = true;
			for (String id:idList) {
				if (isFirst) isFirst = false;
				else sqlStr.append(",");
				sqlStr.append(id);
			}
			sqlStr.append(")");
		}
		DataTable dt = getDataTable(tableName, sqlStr.toString());
		return dt;
	}
	
	public Set<String> getAllTags() {
		Set<String> tags = new HashSet<String>();
		open();
		String sqlStr = "SELECT DISTINCT tag from " + TAGS_TABLE;
		Statement stmt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				tags.add(rs.getString("tag"));
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
		close();
		return tags;
	}
	
	public ArrayList<String> getTags(String adId) {
		ArrayList<String> tags = new ArrayList<String>();
		open();
		String sqlStr = "SELECT tag from " + TAGS_TABLE + " where ad_id="+ adId;
		Statement stmt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				tags.add(rs.getString("tag"));
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
		close();
		return tags;
	}
	
	public void resetAllTags() {
		open();
		tryStatement(_conn, "TRUNCATE TABLE " + TAGS_TABLE);
		close();
	}
	
	public void addTag(String id, String tag) {
		addTags(Collections.singletonList(id),Collections.singletonList(tag));
	}
	
	public void removeTag(String id, String tag) {
		removeTags(Collections.singletonList(id),Collections.singletonList(tag));
	}
	
	public void removeTags( List<String> adIds, List<String> tagsToRemove) {
		open();
		for (String id : adIds) {
			for (String tag : tagsToRemove) {
				if (tagExists(id, tag)) {
					tryStatement(_conn, "DELETE FROM " + TAGS_TABLE + " WHERE ad_id=" + id + " AND tag='" + tag + "'");
				}
			}
		}
		close();
	}
	
	public boolean tagExists(String id, String tag) {
		String sqlStr = "SELECT ad_id from " + TAGS_TABLE + " where ad_id="+ id + " AND tag='"+tag+"'";
		boolean retVal = true;
		Statement stmt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			retVal = rs.next();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		return retVal;
	}
	
	public void addTags(List<String> ids, List<String> newTags) {
		PreparedStatement pstmt = null;
		open();
		try {
			_conn.setAutoCommit(false);
			pstmt = _conn.prepareStatement("INSERT INTO " + TAGS_TABLE + "(ad_id,tag) VALUES (?, ?)");
			int count = 0;
			for (String id : ids) {
				for (String tag : newTags) {
					pstmt.setString(1, id);
					pstmt.setString(2, tag);
					pstmt.addBatch();
						
					++count;
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
				_conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
	}

	public HashMap<String, StringList> getTags(Collection<String> adIds) {
		HashMap<String, StringList> tagMap =  new HashMap<String, StringList>();
		if (adIds == null || adIds.size() == 0) {
			return tagMap;
		}
		
		for (String id : adIds) {
			tagMap.put(id,new StringList(getTags(id)));
		}
		
		return tagMap;
	}

	public ArrayList<String> getAds(String whereClause) {
		open();
		String sqlStr = "SELECT id from ads where " + whereClause;
		Statement stmt = null;
		ArrayList<String> result = new ArrayList<String>();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result.add(rs.getString("id"));
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
		close();
		return result;
	}	
	
	public List<String> getMatches(String tableName, String where, boolean joinTags) {
		open();
		String sqlStr = "SELECT " + tableName + ".id from " + tableName;
		String refinedTableName = tableName+"_refine";
		String louvainTableName = tableName+"_louvain";
		String tagsTableName = "tags";
		if (tableExists(refinedTableName)) {
			sqlStr += " INNER JOIN " + refinedTableName + " ON " + tableName + ".id=" + refinedTableName + ".id";
		}
		if (tableExists(louvainTableName)) {
			sqlStr += " INNER JOIN " + louvainTableName + " ON " + tableName + ".id=" + louvainTableName + ".id";
		}
		if (joinTags && tableExists(tagsTableName)) {
			sqlStr += " INNER JOIN " + tagsTableName + " ON " + tableName + ".id=" + tagsTableName + ".ad_id";
		}

		sqlStr +=  " " + where;
		Statement stmt = null;
		ArrayList<String> result = new ArrayList<String>();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result.add(rs.getString("id"));
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
		close();
		return result;
	}	
	
	public TableDistribution getValueCounts(String tableName, String columnName) {
		open();
		TableDistribution td = new TableDistribution();
		String refinedTableName = tableName+"_refine";
		String louvainTableName = tableName+"_louvain";
		String sqlStr = "SELECT " + columnName + " FROM " + tableName;
		if (tableExists(refinedTableName)) {
			sqlStr += " INNER JOIN " + refinedTableName + " ON " + tableName + ".id=" + refinedTableName + ".id";
		}
		if (tableExists(louvainTableName)) {
			sqlStr += " INNER JOIN " + louvainTableName + " ON " + tableName + ".id=" + louvainTableName + ".id";
		}

		Statement stmt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String columnValue = rs.getString(columnName);
				if (columnValue != null) {
					td.increment(columnValue);
				}
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
		close();
		return td;
	}

	public ArrayList<String> getColumns(String datasetName) {
		String sqlStr = "select distinct COLUMN_NAME from INFORMATION_SCHEMA.COLUMNS where TABLE_NAME='" + datasetName +
				"' OR TABLE_NAME='" + datasetName + "_refine' OR TABLE_NAME='" + datasetName + "_louvain'";
		ArrayList<String> result = new ArrayList<String>();
		open();
		Statement stmt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result.add(rs.getString("COLUMN_NAME"));
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
		Collections.sort(result);
		close();
		return result;
	}	

	public static ArrayList<String> getValues(String datasetName, String columnName) {
		TableDistribution td = TableDB.getInstance().getValueCounts(datasetName, columnName);

		ArrayList<Map.Entry<String,Integer>> entries = new ArrayList<Map.Entry<String,Integer>>(td.distribution.entrySet());
		Collections.sort(entries, new Comparator<Map.Entry<String,Integer>>() {
			public int compare(Entry<String, Integer> o1, Entry<String, Integer> o2) {
				return o2.getValue()-o1.getValue();
			}
		});
		
		ArrayList<String> result = new ArrayList<String>();
		for (int i=0; i<entries.size() && i<100; i++) {
			Map.Entry<String,Integer> entry = entries.get(i);
			result.add(entry.getKey());
		}
		return result;
	}

	public boolean louvainExists(String tableName) {
		String louvainTableName = tableName + "_louvain";
		open();
		boolean result = tableExists(louvainTableName);
		close();
		return result;
	}

	public void deleteClusterset(String datasetName, String clustersetName) {
		open();
		try {
			// Track this cluster result in CLUSTER_SETS_TABLE
			tryStatement(_conn, "DELETE FROM " + CLUSTER_SETS_TABLE
							+ " where id='" + clustersetName+"'");
			tryStatement(_conn, "DELETE FROM " + CLUSTER_CONTENTS_TABLE + " WHERE set_id='" + clustersetName + "'");
		} catch (Exception e) {
			e.printStackTrace();
		}
		close();
	}

	public void createPreclusterTable(String tableName) {
		try {
			String sqlCreate = 
					"CREATE TABLE `"+tableName+"` (" +
						  "`ad_id` int(11) NOT NULL ," +
						  "`person_cluster_id` INT(11) NULL ," +
						  "`org_cluster_id` INT(11) NULL ," +
						  "`location_cluster_id` INT(11) NULL ," +
						  "PRIMARY KEY (`ad_id`) )";
			tryStatement(_conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public String getCity(String name) {
		Statement stmt = null;
		open();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = null;
			rs = stmt.executeQuery("SELECT * FROM xdataht.world_cities WHERE city like '" + name + "' LIMIT 0,1");
			if (rs.next()) {
				close();
				return name;
			}
			rs = stmt.executeQuery("SELECT * FROM xdataht.states_provinces WHERE name like '" + name + "' LIMIT 0,1");
			if (rs.next()) {
				close();
				return name;
			}
		} catch (Exception e) {
			System.out.println("Failed select on getCity()");
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		close();
		return null;
	}

	public ArrayList<String> getSimpleClusters(ArrayList<String> matchingAds, String cluster) {
		open();
		String sqlStr = "SELECT distinct " + cluster + "_cluster_id from precluster where ad_id IN (";
		boolean isFirst = true;
		for (String adid:matchingAds) {
			if (isFirst) isFirst = false;
			else sqlStr += ",";
			sqlStr += adid;
		}
		sqlStr += ")";
		Statement stmt = null;
		ArrayList<String> result = new ArrayList<String>();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result.add(rs.getString(cluster+"_cluster_id"));
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
		close();
		return result;
	}

	public HashMap<String,Integer> getSimpleClusterCounts(ArrayList<String> matchingAds, String cluster) {
		open();
		String clusterColumn = cluster + "_cluster_id";
		String sqlStr = "SELECT " + clusterColumn + ",count(*) as matching from precluster where ad_id IN (";
		boolean isFirst = true;
		for (String adid:matchingAds) {
			if (isFirst) isFirst = false;
			else sqlStr += ",";
			sqlStr += adid;
		}
		sqlStr += ") group by " + clusterColumn;
		Statement stmt = null;
		HashMap<String,Integer> result = new HashMap<String,Integer>();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				String clusterid = rs.getString(clusterColumn);
				Integer matching = rs.getInt("matching");
				result.put(clusterid, matching);
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
		close();
		return result;
	}

	public ArrayList<String> getSimpleColumn(ArrayList<String> matchingClusters, String cluster, String column) {
		ArrayList<String> result = new ArrayList<String>();
		open();
		String sqlStr = "SELECT distinct ads." + column + 
				" from ads inner join precluster on ads.id=precluster.ad_id where precluster." + cluster + 
				" IN (";
		boolean isFirst = true;
		for (String clusterid:matchingClusters) {
			if (isFirst) isFirst = false;
			else sqlStr += ",";
			sqlStr += clusterid;
		}
		sqlStr += ")";
		Statement stmt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result.add(rs.getString(column));
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
		close();
		return result;
	}

	public HashSet<String> getPreclusterAds(String cluster, String id) {
		HashSet<String> result = new HashSet<String>();
		String sqlStr = "SELECT ad_id from precluster where " + cluster + "_cluster_id = '" + id + "'";
		Statement stmt = null;
		open();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				result.add(rs.getString("ad_id"));
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
		close();
		return result;
	}

	public static DenseDataTable _preclusterCache = null;
	public DenseDataTable getPreclusterColumns() {
		if (_preclusterCache!=null) return _preclusterCache;
		open();

		String sqlStr = "SELECT ads.id,phone_numbers,email,websites,location,"
				+ "precluster.person_cluster_id AS person,"
				+ "precluster.org_cluster_id AS org "
				+ "FROM ads INNER JOIN precluster ON ads.id=precluster.ad_id";
		Statement stmt = null;
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			_preclusterCache = new DenseDataTable();
			ResultSetMetaData rsmd = rs.getMetaData();
			int columnCount = rsmd.getColumnCount();
			_preclusterCache.columns = new ArrayList<String>(columnCount);
			_preclusterCache.rows = new ArrayList<String[]>();
			for (int i=0; i<columnCount; i++) {
				_preclusterCache.columns.add(rsmd.getColumnLabel(i+1));
			}
			while (rs.next()) {
				String[] row = new String[columnCount];
				for (int i=0; i<columnCount; i++) {
					String columnName = _preclusterCache.columns.get(i);
					row[i] = rs.getString(columnName);
				}
				_preclusterCache.rows.add(row);
			}
			_preclusterCache.updateRowLookup();
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (stmt != null) { stmt.close(); }
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		close();
		return _preclusterCache;
	}

	public HashMap<Long, Integer> getTimeSeries() {
		HashMap<Long,Integer> result = new HashMap<Long,Integer>();
		String sqlStr = "SELECT post_timestamp from ads";
		Statement stmt = null;
		open();
		try {
			stmt = _conn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			Calendar c = Calendar.getInstance();
			while (rs.next()) {
				long time = rs.getLong("post_timestamp");
				c.setTimeInMillis(time*1000);
				c.set(Calendar.HOUR_OF_DAY,0);
				c.set(Calendar.MINUTE,0);
				c.set(Calendar.SECOND,0);
				c.set(Calendar.MILLISECOND,0);
				time = c.getTimeInMillis()/1000;
				Integer i = result.get(time);
				if (i==null) result.put(time,1);
				else result.put(time,i+1);
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
		close();
		return result;
	}
	
	public HashMap<String,HashMap<Long, Integer>> getLocationTimeSeries() {
		HashMap<String,HashMap<Long, Integer>> result = new HashMap<String,HashMap<Long, Integer>>();
		String sqlStr = "SELECT location,post_timestamp from ads";
		Statement stmt = null;
		open();
		try {
			stmt = _conn.createStatement();
			Calendar c = Calendar.getInstance();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				long time = rs.getLong("post_timestamp");
				String location = rs.getString("location");
				if (location==null) continue;
				location = location.toLowerCase().trim();
				HashMap<Long,Integer> locationSeries = result.get(location);
				if (locationSeries==null) {
					locationSeries = new HashMap<Long,Integer>();
					result.put(location, locationSeries);
				}
				c.setTimeInMillis(time*1000);
				c.set(Calendar.HOUR_OF_DAY,0);
				c.set(Calendar.MINUTE,0);
				c.set(Calendar.SECOND,0);
				c.set(Calendar.MILLISECOND,0);
				time = c.getTimeInMillis()/1000;
				Integer i = locationSeries.get(time);
				if (i==null) locationSeries.put(time,1);
				else locationSeries.put(time,i+1);
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
		close();
		return result;
	}
	
	public void insertTemporalData(ArrayList<TimeVolumeResult> data) {
		PreparedStatement pstmt = null;
		open();
		try {
			_conn.setAutoCommit(false);
			pstmt = _conn.prepareStatement("INSERT INTO " + TIME_TABLE + "(day,count) VALUES (?, ?)");
			int count = 0;
			for (TimeVolumeResult r:data) {
				pstmt.setLong(1, r.getDay());
				pstmt.setInt(2, r.getCount());
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
				_conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
	}

	public void insertLocationData(ArrayList<LocationVolumeResult> data) {
		PreparedStatement pstmt = null;
		open();
		try {
			_conn.setAutoCommit(false);
			pstmt = _conn.prepareStatement("INSERT INTO " + LOCATION_TABLE + "(location,count,lat,lon) VALUES (?,?,?,?)");
			int count = 0;
			for (LocationVolumeResult r:data) {
				pstmt.setString(1,r.getLocation());
				pstmt.setInt(2, r.getCount());
				pstmt.setFloat(3, r.getLat());
				pstmt.setFloat(4, r.getLon());
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
				_conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
	}

	public void insertLocationClusterData(HashMap<String, HashSet<String>> resultMap) {
		PreparedStatement pstmt = null;
		open();
		try {
			_conn.setAutoCommit(false);
			pstmt = _conn.prepareStatement("INSERT INTO " + LOCATION_CLUSTER_TABLE + "(location,clusterid) VALUES (?,?)");
			int count = 0;
			for (Entry<String,HashSet<String>> e:resultMap.entrySet()) {
				String location = e.getKey();
				for (String clusterId:e.getValue()) {
					pstmt.setString(1,location);
					pstmt.setString(2, clusterId);
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
				_conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
	}



	public void insertLocationTimeData(ArrayList<LocationTimeVolumeResult> data) {
		PreparedStatement pstmt = null;
		open();
		try {
			_conn.setAutoCommit(false);
			pstmt = _conn.prepareStatement("INSERT INTO " + LOCATION_TIME_TABLE + "(location,lat,lon,day,count) VALUES (?,?,?,?,?)");
			int count = 0;
			for (LocationTimeVolumeResult l:data) {
				for (TimeVolumeResult r:l.getTimeseries()) {
					pstmt.setString(1,l.getLocation());
					pstmt.setFloat(2, l.getLat());
					pstmt.setFloat(3, l.getLon());
					pstmt.setFloat(4, r.getDay());
					pstmt.setInt(5, r.getCount());
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
				_conn.setAutoCommit(true);
			} catch (SQLException e) {e.printStackTrace();}
		}
		close();
	}

	

}
