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
package oculus.memex.init;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

import org.apache.log4j.Logger;

public class PropertyManager {
	private static final Logger logger = Logger.getLogger(PropertyManager.class.getName());

	private static PropertyManager instance;
	private static String filename = "xdataht.properties";
	private static String bestfilename = "openads.properties";
	private final Map<String, String> pMap;

	public static final String DATABASE_TYPE = "database_type";
	public static final String DATABASE_HOSTNAME = "database_host";
	public static final String DATABASE_PORT = "database_port";
	public static final String DATABASE_USER = "database_user";
	public static final String DATABASE_PASSWORD = "database_password";
	public static final String DATABASE_NAME = "database_name";
	public static final String DATABASE_CLEAR = "clear_db";
	public static final String DATA_DIRECTORY = "data_dir";
	public static final String DATABASE_HTSCHEMA = "database_ht_schema";
	public static final String DATABASE_OCULUSSCHEMA = "database_oculus_schema";
	public static final String ELASTICSEARCH_BASE_URL = "elasticsearch_base_url";
	public static final String ELASTICSEARCH_URL = "elasticsearch_url";
    public static final String ELASTICSEARCH_PROPERTIES = "elasticsearch_properties";
	public static final String ELASTICSEARCH_WILDCARD_PREFIX = "elasticsearch_wildcard_prefix";

	public static final String LOUVAIN_EXECUTABLE = "louvain.executable";

	public static final String HASH_IMAGES = "hash_images";
	
	//Hadoop / Spark properties
	public static final String SPARK_MASTER = "spark_master";
	public static final String SPARK_USER = "spark_user";
	public static final String HDFS_PATH_HT = "hdfs_path_ht";
	public static final String HDFS_PATH_OCULUS = "hdfs_path_oculus";
	public static final String HDFS_CLUSTER_ADDRESS = "hdfs_cluster_address";
	public static final String OVERWRITE_EXISTING_TABLES = "overwrite_existing_tables";
	
	@SuppressWarnings("unchecked")
	private PropertyManager() {
		pMap = new HashMap<String, String>();

		// read properties from file
		Properties props = ReadProperties(filename);
		for (Enumeration<String> e = (Enumeration<String>) props.propertyNames(); e.hasMoreElements(); ) {
			String key = e.nextElement();
			pMap.put(key, props.getProperty(key));
		}
		
		// read properties from env 
		Map<String, String> env = System.getenv();
        for (String envName : env.keySet()) {
        	// store env variable in properties, over-writing file properties
        	// convert envName to lower case, to match file property style
        	pMap.put(envName.toLowerCase(), env.get(envName));
        }
	}

	public static PropertyManager getInstance() {
		if (instance == null)
			instance = new PropertyManager();
		return instance;
	}

	public String getProperty(String key) {
		return instance.pMap.get(key);
	}

	public String getProperty(String key, String defaultVal) {
		String val = instance.pMap.get(key);
		return val == null ? defaultVal : val;
	}

	public List<String> getPropertyArray(String key) {
		String joined = getProperty(key);
		String[] split = joined.split(",");
		List<String> list = new ArrayList<String>();
		for (String s : split) {
			list.add(s);
		}
		return list;
	}

	public Set<String> getPropertySet(String key) {
		Set<String> set = new HashSet<String>();
		String joined = getProperty(key);
		if (joined!=null) {
			String[] split = joined.split(",");
			for (String s : split) {
				set.add(s);
			}
		}
		return set;		
	}

	private Properties ReadProperties(String filename) {		
		String resourceLocation = this.getClass().getResource("").getFile();
		logger.info("Properties file resource location:" + resourceLocation);
		if (resourceLocation.startsWith("file:/")) {
			resourceLocation = resourceLocation.substring("file:/".length());
			if (resourceLocation.startsWith("var")) resourceLocation = "/" + resourceLocation;
		}
		int idx = resourceLocation.indexOf("WEB-INF");
		if (idx>0) {
			resourceLocation = resourceLocation.substring(0,idx);
		} else {
			idx = resourceLocation.indexOf("classes");
			if (idx>0) {
				resourceLocation = resourceLocation.substring(0,idx+7);
			}
		}
		if (resourceLocation.endsWith("/")) resourceLocation = resourceLocation.substring(0,resourceLocation.length()-1);
		String defaultPath = resourceLocation + "/" + filename;
		String persistentPath = System.getProperty("catalina.base") + "/conf/" + filename;
		String bestPath = System.getProperty("catalina.base") + "/conf/" + bestfilename;
		logger.info("Properties file default: <" + defaultPath + "> persistent:<" + persistentPath + "> best: <" + bestPath + ">");
		
		File bestFile = new File(bestPath);
		File defaultFile = new File(defaultPath);
		File persistentFile = new File(persistentPath);
		File linuxFile = new File("/srv/"+filename);

		// If there is no persistent file in configuration directory, look at the default file
		Properties props = new Properties();
		try {
			if ( bestFile.exists() ) {
				props.load(new FileInputStream(bestFile));
			} else if ( linuxFile.exists() ) {
				props.load(new FileInputStream(linuxFile));
			} else if (persistentFile.exists()) {
				props.load(new FileInputStream(persistentFile));
				logger.info("Properties file loaded: <" + persistentPath + ">");
			} else {
				props.load(new FileInputStream(defaultFile));
				logger.info("Properties file loaded: <" + defaultPath + ">");
			}
		} catch (IOException e) {}
		return props;
	}
}