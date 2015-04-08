package oculus.memex.db;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.*;

import oculus.memex.init.PropertyManager;

public class ScriptDBInit {
	public static String _datasetName = "ads";
	public static String _name = "xdataht";
	public static String _type = "mysql";
	public static String _hostname = "localhost";
	public static String _port = "3306"; 
	public static String _user = "root";
	public static String _pass = "admin";
	public static String _htSchema = "memex_ht";
	public static String _oculusSchema = "memex_oculus";
	public static boolean _clearDB = false;

	public static String _hdfsClusterAddress = "";	
	public static String _hdfsPath_HT = "";		// default HDFS path for Memex_HT tables
	public static String _hdfsPath_Oculus = "";// default HDFS path for Memex_Oculus tables
	public static String _sparkMaster = "";	//"local";			// default spark-master setting
	public static String _sparkUser = "root";					// default spark username (should be changed to one's own memex1 login when running spark-based jobs)
	public static boolean _overwriteExistingTables = true;		// boolean whether or not to overwrite existing Oculus tables
																//  (only used for Spark-based preprocessing)
																								
	private static HashMap<String, String> cacheProperties = new HashMap<String, String>();
		
	private static void handlePropertyFileLine(String line) {
		
		int hashIndx = line.indexOf("#");	// exclude '#' annotated comments
		String thisLine = line;
		if (hashIndx > -1) {
			thisLine = line.substring(0, hashIndx);
		}
		
		String[] pieces = thisLine.split("=");
		if (pieces.length == 2) {
			
			pieces[0] = pieces[0].trim();	// exclude whitespace from property fields
			pieces[1] = pieces[1].trim();
			
			cacheProperties.put(pieces[0] , pieces[1]);
			
			if (pieces[0].equals(PropertyManager.DATABASE_TYPE)) {
				_type = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_HOSTNAME)) {
				_hostname = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_PORT)) {
				_port = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_USER)) {
				_user = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_PASSWORD)) {
				_pass = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_NAME)) {
				_name = pieces[1];
			} else if (pieces[0].equals("dataset")) {
				System.out.println("Using dataset: " + pieces[1]);
				_datasetName = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_HTSCHEMA)) {
				_htSchema = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_OCULUSSCHEMA)) {
				_oculusSchema = pieces[1];
			} else if (pieces[0].equals(PropertyManager.DATABASE_CLEAR)) {
				_clearDB = (pieces[1].compareTo("true")==0);
				
			} else if (pieces[0].equals(PropertyManager.SPARK_MASTER)) {	// Hadoop / Spark parameters...
				_sparkMaster = pieces[1];
			} else if (pieces[0].equals(PropertyManager.SPARK_USER)) {
				_sparkUser = pieces[1];
			} else if (pieces[0].equals(PropertyManager.HDFS_CLUSTER_ADDRESS)) {
				_hdfsClusterAddress = pieces[1];	
			} else if (pieces[0].equals(PropertyManager.HDFS_PATH_HT)) {
				_hdfsPath_HT = pieces[1];
			} else if (pieces[0].equals(PropertyManager.HDFS_PATH_OCULUS)) {
				_hdfsPath_Oculus = pieces[1];
			} else if (pieces[0].equals(PropertyManager.OVERWRITE_EXISTING_TABLES)) {
				_overwriteExistingTables = (pieces[1].equals("true"));
				
			} else  {
				System.out.println("Unknown property: " + pieces[0]);
			}
		}
	}

	/**
	 * Get a property by key. Specify a default value if the property is not explicitly set in the file. 
	 * @param key	Key of the property
	 * @param defaultValue	default value for the property 
	 * @return	Value of the property
	 */
	public static String getPropertyByKey(String key, String defaultValue){
		String value = cacheProperties.get(key);
		if (value == null)
			return defaultValue;
		
		return value;
	}

	/**
	 * Get a property by key. 
	 * @param key	Key of the property
	 * @return	Value of the property
	 */
	public static String getPropertyByKey(String key){
		String value = cacheProperties.get(key);
		return value;
	}
	
	public static void readArgs(String[] args) {
		if (args.length > 0) {
			BufferedReader br = null;
			try {
				br = new BufferedReader(new FileReader(args[0]));
				String line;
				
				while ((line = br.readLine()) != null) {
					handlePropertyFileLine(line);
				}
				br.close();
				
			} catch (FileNotFoundException e) {
				System.out.println("File: " + args[0] + " not found.");
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}

}
