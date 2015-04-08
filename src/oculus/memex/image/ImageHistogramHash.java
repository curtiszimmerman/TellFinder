package oculus.memex.image;

import java.awt.image.BufferedImage;
import java.awt.image.Raster;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;

import javax.imageio.ImageIO;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.db.ScriptDBInit;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

public class ImageHistogramHash {

	private static final int HASH_COMPARE_BATCH_SIZE = 1000000;
	private static final int COLOR_DEPTH = 4;
	private static final int COLOR_DIVISOR = 256/COLOR_DEPTH;
	private static final int DISTINCT_COLORS = (int)Math.pow(COLOR_DEPTH,3);
	private static final int RATIO_MULTIPLIER = 0xFF;

	public static final String IMAGE_HASH_TABLE = "images_hash";
	public static final String IMAGE_HISTOGRAM_TABLE = "imagehash_details";
	private static HashMap<Integer,String> IMAGE_HASH_CACHE = new HashMap<Integer,String>();

	private static HashMap<byte[],Integer> HISTOGRAM_TO_BIN = null;
	private static HashMap<String,Integer> HASH_TO_BIN = null;
	private static HashBinaryTree HASH_TREE = null;
	private static int MAX_BIN = 0;


	public static void initTable(MemexOculusDB oculusdb) {
		Connection conn = oculusdb.open();
		System.out.println("IMAGE HASH INITIALIZATION");
		if (!oculusdb.tableExists(conn, IMAGE_HASH_TABLE)) {
			String sqlCreate = "CREATE TABLE `" + IMAGE_HASH_TABLE + "` ("
				+ "`id` int(11) NOT NULL AUTO_INCREMENT,"
				+ "`images_id` INT(11) UNSIGNED NOT NULL, "
				+ "`hash` varchar(128) DEFAULT NULL, "
				+ "PRIMARY KEY (`id`), "
				+ "KEY `sha1` (`hash`), "
				+ "KEY `images_id` (`images_id`))";
			if (DBManager.tryStatement(conn, sqlCreate)) {
				System.out.println("\t" + IMAGE_HASH_TABLE + " table initialized.");
			} else {
				System.out.println("\tError creating " + IMAGE_HASH_TABLE + " table.");
			}
		} else {
			System.out.println("\t" + IMAGE_HASH_TABLE + " table exists.");
		}

		if (!oculusdb.tableExists(conn, IMAGE_HISTOGRAM_TABLE)) {
			String sqlCreate = "CREATE TABLE `" + IMAGE_HISTOGRAM_TABLE + "` ("
				+ "`id` int(11) NOT NULL AUTO_INCREMENT,"
				+ "`hash` varchar(128) NOT NULL DEFAULT '',"
				+ "`histogram` varchar(128) DEFAULT NULL,"
				+ "`bin` int(11) DEFAULT NULL,"
				+ "`width` int(11) DEFAULT NULL,"
				+ "`height` int(11) DEFAULT NULL,"
				+ "PRIMARY KEY (`id`),"
				+ "KEY `sha1` (`hash`),"
				+ "KEY `bin` (`bin`))";
			if (DBManager.tryStatement(conn, sqlCreate)) {
				System.out.println("\t" + IMAGE_HISTOGRAM_TABLE + " table initialized.");
			} else {
				System.out.println("\tError creating " + IMAGE_HISTOGRAM_TABLE + " table.");
			}
		} else {
			System.out.println("\t" + IMAGE_HISTOGRAM_TABLE + " table exists.");
		}
		
		oculusdb.close(conn);
	}	
	
	private static void readSQLRangeIntoBins(Connection oculusconn, int startID, int endID) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Reading image hash cache " + startID);
		Statement stmt = null;
		try {
			IMAGE_HASH_CACHE = new HashMap<Integer,String>();
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT id,hash,histogram FROM " + IMAGE_HISTOGRAM_TABLE + " where id>=" + startID + " and id<=" + endID);
			while(rs.next()) {
				Integer id = rs.getInt("id");
				String hash = rs.getString("hash");
				String histogram = rs.getString("histogram");
				readHistogramIntoBin(id, hash, histogram);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		tl.popTime();
	}

	private static HashMap<String,Integer> readHashToBin(Connection oculusconn, int startID, int endID) {
		HashMap<String,Integer> result = new HashMap<String,Integer>();
		TimeLog tl = new TimeLog();
		tl.pushTime("Reading image hash cache " + startID);
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT histogram,bin FROM " + IMAGE_HISTOGRAM_TABLE + " where id>=" + startID + " and id<=" + endID);
			while(rs.next()) {
				String histogram = rs.getString("histogram");
				Integer bin = rs.getInt("bin");
				result.put(histogram, bin);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		tl.popTime();
		return result;
	}

	public static int readHistogramIntoBin(Integer id, String hashStr, String histogramStr) {
		IMAGE_HASH_CACHE.put(id, hashStr);
		if (histogramStr==null || histogramStr.length()!=128) {
			MAX_BIN++;
			int cbin = MAX_BIN;
			HASH_TO_BIN.put(hashStr, cbin);
			return cbin;
		}
		byte[] histogram = StringUtil.hexToBytes(histogramStr);
		
		// Find the best bin
		byte[] histogramMatch = HASH_TREE.addHash(histogram);

		if (histogramMatch!=null) {
			Integer bin = HISTOGRAM_TO_BIN.get(histogramMatch);
			HISTOGRAM_TO_BIN.put(histogram, bin);
			HASH_TO_BIN.put(hashStr, bin);
			return bin;
		}

		MAX_BIN++;
		int cbin = MAX_BIN;
		HISTOGRAM_TO_BIN.put(histogram, cbin);
		HASH_TO_BIN.put(hashStr, cbin);
		return cbin;
	}
	
	private static final int IMAGE_REBIN_BATCH_SIZE = 100000;
	
	public static void rebinHashesSQL() {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection oculusconn = db.open();
		initBins();
		
		int maxid = DBManager.getInt(oculusconn, "select max(id) from imagehash_details", "Fetch max image hash details id");
		for (int curid=0; curid<maxid; curid+=IMAGE_REBIN_BATCH_SIZE) {
			readSQLRangeIntoBins(oculusconn, curid, curid+IMAGE_REBIN_BATCH_SIZE-1);
			outputSQLBins(oculusconn);
		}
		db.close(oculusconn);
	}

	public static void initBins() {
		HASH_TO_BIN = new HashMap<String,Integer>();
		HASH_TREE = new HashBinaryTree();
		HISTOGRAM_TO_BIN = new HashMap<byte[], Integer>();
		MAX_BIN = 0;
	}

	private static BufferedImage getImage(String urlToRead) {
		URL url;
		HttpURLConnection conn;
		try {
			url = new URL(urlToRead);
			conn = (HttpURLConnection) url.openConnection();
			conn.setRequestMethod("GET");
			return ImageIO.read(conn.getInputStream());
		} catch (Exception e) {
			e.printStackTrace();
		}
		return null;
	}
	
	public static byte[] histogramByteHash(BufferedImage img) {
		Raster raster = img.getData();
		int h = raster.getHeight();
		int w = raster.getWidth();
		int pixels = w*h;
		int[] colors = new int[pixels*3];
		raster.getPixels(0, 0, w, h, colors);
		int[] counts = new int[DISTINCT_COLORS];
		int grayScaleCount = 0;
		for (int i=0; i<DISTINCT_COLORS; i++) counts[i] = 0;
		for (int i=0; i<w*h; i++) {
			int r = colors[i*3]/COLOR_DIVISOR;
			r = Math.min(r, COLOR_DEPTH-1);
			int g = (colors[i*3+1])/COLOR_DIVISOR;
			g = Math.min(g, COLOR_DEPTH-1);
			int b = (colors[i*3+2])/COLOR_DIVISOR;
			b = Math.min(b, COLOR_DEPTH-1);
			int truncColor = (r*COLOR_DEPTH+g)*COLOR_DEPTH+b;
			counts[truncColor]++;
			if (r==g&&r==b) grayScaleCount++;
		}
		byte[] result = new byte[DISTINCT_COLORS];
		if (grayScaleCount>pixels*0.95) {
			result[0] = (byte)0xFF;
			result[DISTINCT_COLORS-1] = (byte)0xFF;
			for (int i=1; i<DISTINCT_COLORS-1; i++) {
				counts[i]=0;
			}
			for (int i=0; i<w*h; i++) {
				int idx = colors[i*3]*(DISTINCT_COLORS-2)/255;
				counts[idx]++;
			}
			for (int i=1; i<DISTINCT_COLORS-1; i++) {
				int count = (int)Math.ceil((counts[i]*RATIO_MULTIPLIER)/pixels);
				result[i] = (byte)(count&0xFF);
			}
		} else {
			for (int i=0; i<DISTINCT_COLORS; i++) {
				int count = (int)Math.ceil((counts[i]*RATIO_MULTIPLIER)/pixels);
				result[i] = (byte)(count&0xFF);
			}
		}
		return result;
	}
	
	public static String histogramHash(BufferedImage img) {
		
		byte[] result = histogramByteHash(img);
	
		return StringUtil.bytesToHex(result);
	}
	
	private static void outputSQLBins(Connection oculusconn) {
		PreparedStatement pstmt = null;
		try {
			oculusconn.setAutoCommit(false);
			pstmt = oculusconn.prepareStatement("update " + IMAGE_HISTOGRAM_TABLE + " set bin=? where id=?");
			for (Map.Entry<Integer,String> entry:IMAGE_HASH_CACHE.entrySet()) {
				Integer id = entry.getKey();
				String hash = entry.getValue();
				pstmt.setInt(1, HASH_TO_BIN.get(hash));
				pstmt.setInt(2,id);
				pstmt.addBatch();
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

	public static HashMap<String,String> getHashes(HashSet<String> imageids) {
		HashMap<String,String> result = new HashMap<String,String>();
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashSet<String> hashes = new HashSet<String>();
		HashMap<String,HashSet<String>> hashToId = new HashMap<String,HashSet<String>>();
		Statement stmt = null;
		if (imageids.size()>0) {
			String imageidsql = StringUtil.hashSetStringToSqlList(imageids);
			try {
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery("SELECT images_id,hash FROM " + IMAGE_HASH_TABLE + " where images_id in " + imageidsql);
				while(rs.next()) {
					String id = rs.getString("images_id");
					String hash = rs.getString("hash");
					hashes.add(hash);
					HashSet<String> hashids = hashToId.get(hash);
					if (hashids==null) {
						hashids = new HashSet<String>();
						hashToId.put(hash, hashids);
					}
					hashids.add(id);
					result.put(id, hash);
				}
			} catch (SQLException e) {
				e.printStackTrace();
			} finally {
				try { if (stmt != null) stmt.close();
				} catch (SQLException e) { e.printStackTrace();	}
			}
		}
		if (hashes.size()>0) {
			stmt = null;
			try {
				String hashsql = StringUtil.hashSetToQuotedSqlList(hashes);
				stmt = conn.createStatement();
				ResultSet rs = stmt.executeQuery("SELECT hash,bin FROM " + IMAGE_HISTOGRAM_TABLE + " where hash in " + hashsql);
				while(rs.next()) {
					String hash = rs.getString("hash");
					String bin = rs.getString("bin");
					HashSet<String> hashids = hashToId.get(hash);
					for (String id:hashids) {
						result.put(id, bin);
					}
				}
			} catch (SQLException e) {
				e.printStackTrace();
			} finally {
				try { if (stmt != null) stmt.close();
				} catch (SQLException e) { e.printStackTrace();	}
			}
		}
		db.close(conn);
		return result;
	}
	
	public static HashSet<Integer> getIdsForSha1(Connection conn, String search) {
		HashSet<Integer> result = new HashSet<Integer>();
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT images_id FROM " + IMAGE_HASH_TABLE + " where hash='" + search + "'");
			while(rs.next()) {
				Integer id = rs.getInt("images_id");
				result.add(id);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
		return result;
	}

	public static void getIdsForSha1s(Connection conn, HashSet<String> search, HashSet<Integer> result) {
		Statement stmt = null;
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT images_id FROM " + IMAGE_HASH_TABLE + " where hash IN " + StringUtil.hashSetToQuotedSqlList(search));
			while(rs.next()) {
				Integer id = rs.getInt("images_id");
				result.add(id);
			}
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
	}

	public static void getIdsForBin(Connection conn, String search, HashSet<Integer> result) {
		Statement stmt = null;
		HashSet<String> hashes = new HashSet<String>();
		try {
			stmt = conn.createStatement();
			ResultSet rs = stmt.executeQuery("SELECT hash FROM " + IMAGE_HISTOGRAM_TABLE + " where bin='" + search + "'");
			while(rs.next()) {
				String hash = rs.getString("hash");
				hashes.add(hash);
			}
			getIdsForSha1s(conn, hashes, result);
		} catch (SQLException e) {
			e.printStackTrace();
		} finally {
			try { if (stmt != null) stmt.close();
			} catch (SQLException e) { e.printStackTrace();	}
		}
	}

	public static void getIdsForHistogram(Connection oculusconn, String search, HashSet<Integer> result) {
		int bin = -1;
		byte[] searchBytes = StringUtil.hexToBytes(search);
		int maxid = DBManager.getInt(oculusconn, "select max(id) from imagehash_details", "Fetch max image hash details id");
        int minDiff = Integer.MAX_VALUE;
        int minDiffBin = -1;

		for (int curid=0; curid<maxid; curid+=HASH_COMPARE_BATCH_SIZE) {
			HashMap<String, Integer> hashToBin = readHashToBin(oculusconn, curid, curid+HASH_COMPARE_BATCH_SIZE-1);
			for (Map.Entry<String,Integer> e:hashToBin.entrySet()) {
				byte[] cbytes = StringUtil.hexToBytes(e.getKey());
				int diff = diffHashes(cbytes, searchBytes);
                if (diff != -1) {

                    if (diff < minDiff) {
                        minDiff = diff;
                        minDiffBin = bin;
                    }

                    if (diff < 10) {
                        bin = e.getValue();
                        break;
                    }
                }
			}
			if (bin>-1) break;
		}
		if (bin>-1)  {
            getIdsForBin(oculusconn, ""+bin, result);
        } else if (minDiffBin>-1) {
            getIdsForBin(oculusconn, ""+minDiffBin, result);
        }
	}
	
	public static HashSet<Integer> getIdsSql(String search) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		HashSet<Integer> result = new HashSet<Integer>();
		getIdsForBin(conn, search, result);
		db.close(conn);
		return result;
	}
	
	public static void test() {
		String url = "http://memex1:8081/images/cache/A86EF8D743DFA2FF4D328D38A8730A84F1B616FE.jpg";
		BufferedImage img = getImage(url);
		String hash = histogramHash(img);
		System.out.println(hash);
		url = "http://memex1:8081/images/cache/FD9BBB31ED8678A14C0CFD62440C2EFF6BF2B9BF.jpg";
		img = getImage(url);
		hash = histogramHash(img);
		System.out.println(hash);
	}
	
	private static int diffHashes(byte[] cbytes, byte[] bytes) {
		if (cbytes==null || bytes==null) return -1;
		if (cbytes.length!=bytes.length) return -1;
		int dif = 0;
		for (int i=0; i<cbytes.length; i++) {
			dif += Math.abs(cbytes[i]-bytes[i]);
		}
		return dif;
	}
	public static void compareTest() {
		byte[] h1 = StringUtil.hexToBytes("080100000000000000000000000000000301000000100200000000000000000000000000000E0000000C1101000000000000000000000000000537000000115E");
		byte[] h2 = StringUtil.hexToBytes("0A0100000000000000000000000000000401000001120200000001000000000000000000011A0000001210000000000000000000000000000002370000000B4F");
		System.out.println(diffHashes(h1,h2));
	}

	public static void main(String[] args) {
		TimeLog tl = new TimeLog();
		tl.pushTime("Image caching");
		ScriptDBInit.readArgs(args);
		MemexOculusDB.getInstance(ScriptDBInit._oculusSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		MemexHTDB.getInstance(ScriptDBInit._htSchema, ScriptDBInit._type, ScriptDBInit._hostname, ScriptDBInit._port, ScriptDBInit._user, ScriptDBInit._pass);
		rebinHashesSQL();
//		test();
//		compareTest();
				
		tl.popTime();
	}


}
