package oculus.memex.casebuilder;

import java.sql.Connection;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;

public class CaseBuilder {
	
	public static final String CASE_TABLE = "cases";
	public static final String CASE_CONTENTS_TABLE = "case_contents";
	
	public CaseBuilder(){}
	
	public static void initTable(MemexOculusDB db) {
		Connection conn = db.open();
		System.out.println("CASE BUILDER INITIALIZATION");
		if(db.tableExists(conn, CASE_TABLE)){
			System.out.println("\t" + CASE_TABLE + " table exists.");
		} else {
			createCasesTable(db, conn);
			System.out.println("\t" + CASE_TABLE + " table initialized.");
		}
		if(db.tableExists(conn, CASE_CONTENTS_TABLE)){
			System.out.println("\t" + CASE_CONTENTS_TABLE + " table exists.");
		} else {
			createCaseContentsTable(db, conn);
			System.out.println("\t" + CASE_CONTENTS_TABLE + " table initialized.");
		}
		db.close(conn);
	}
	
	private static void createCasesTable (MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `" + CASE_TABLE + "` (" +
						  "id INT(11) NOT NULL AUTO_INCREMENT," +
						  "case_name VARCHAR(128) NOT NULL," +
						  "user_name VARCHAR(32) NOT NULL," +
						  "public BOOLEAN DEFAULT FALSE," +
						  "PRIMARY KEY(id) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
	private static void createCaseContentsTable(MemexOculusDB db, Connection conn) {
		try {
			String sqlCreate = 
					"CREATE TABLE `" + CASE_CONTENTS_TABLE + "` (" +
						  "case_id INT(11) NOT NULL," +
						  "cluster_id INT(11) NOT NULL," +
						  "is_attribute BOOLEAN NOT NULL," +
						  "PRIMARY KEY(case_id, cluster_id, is_attribute)," + 
						  "FOREIGN KEY (case_id) REFERENCES " + 
						  CASE_TABLE + "(id) ON DELETE CASCADE)";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public static void main(String[] args) {
		ScriptDBInit.readArgs(args);
		MemexOculusDB db = MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		initTable(db);
	}
}
