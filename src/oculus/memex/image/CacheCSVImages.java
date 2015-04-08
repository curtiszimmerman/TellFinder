package oculus.memex.image;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.List;

import oculus.memex.util.CsvParser;
import oculus.memex.util.StringUtil;

public class CacheCSVImages {
	private static int NEXT_FILE_ID = 1;
	private static HashMap<String,Integer> HASH_TO_FILE_ID = new HashMap<String,Integer>();
	private static long TOTAL_FETCH_TIME = 0;
	private static long TOTAL_ERROR_TIME = 0;
	private static long TOTAL_PROCESSING_TIME = 0;
	
	
	public static byte[] getImage(String urlToRead) {
		URL url;
		HttpURLConnection conn;
		if (urlToRead==null || urlToRead.compareToIgnoreCase("null")==0 || urlToRead.compareToIgnoreCase("\\N")==0) {
			System.err.println("Failed. Invalid image URL: " + urlToRead);
			return null;
		}
		long start = System.currentTimeMillis();
		try {
			url = new URL(urlToRead);
			conn = (HttpURLConnection) url.openConnection();
			conn.setRequestMethod("GET");
			ByteArrayOutputStream buffer = new ByteArrayOutputStream();
			int nRead;
			byte[] data = new byte[16384];
			InputStream is = conn.getInputStream();
			while ((nRead = is.read(data, 0, data.length)) != -1) {
			  buffer.write(data, 0, nRead);
			}
			buffer.flush();
			byte[] byteArray = buffer.toByteArray();
			long end = System.currentTimeMillis();
			TOTAL_FETCH_TIME += end-start;
			return byteArray;
		} catch (Exception e) {
			long end = System.currentTimeMillis();
			TOTAL_ERROR_TIME += end-start;
			System.err.println("Failed to read URL: " + urlToRead + " <" + e.getMessage() + ">");
		}
		return null;
	}

	private static String hashImage(String imageurl, String outdir) {
		byte[] image = getImage(imageurl);
		if (image==null) return null;
		String sha1 = null;
		long start = System.currentTimeMillis();
		try {
			MessageDigest md = MessageDigest.getInstance("SHA");
			byte[] sha1b = md.digest(image);
			sha1 = StringUtil.bytesToHex(sha1b);
			Integer fileid = HASH_TO_FILE_ID.get(sha1);
			if (fileid==null) {
				File outfile = new File(outdir + "/" + sha1 + ".jpg");
				HASH_TO_FILE_ID.put(sha1, NEXT_FILE_ID);
				NEXT_FILE_ID++;
				FileOutputStream fout = new FileOutputStream(outfile);
				fout.write(image);
				fout.close();
			}
			return sha1;
		} catch (NoSuchAlgorithmException e) {
			System.err.println("**** SHA Hashing not available! ****");
			System.exit(0);
		} catch (IOException e) {
			System.err.println("Failed to read/write: <" + imageurl + "> <" + sha1 + "> <" + e.getMessage() + ">");
		}
		long end = System.currentTimeMillis();
		TOTAL_PROCESSING_TIME += end-start;

		return sha1;
	}
	
	public static void main(String[] args) {
		String infile = args[0];
		String outdir = args[1];
		int firstID = 0;
		long starttime = System.currentTimeMillis();
		if (args.length>2) firstID = Integer.parseInt(args[2]);
		try {
			BufferedReader br = new BufferedReader(new FileReader(infile));
			String line = null;
			while ((line = br.readLine()) != null) {
				List<String> strs = CsvParser.fsmParse(line);
				String imageid = strs.get(0);
				try {
					int id = Integer.parseInt(imageid);
					if (id<firstID) continue;
				} catch (Exception e) { System.out.println("Invalid imageid: <" + imageid + ">"); }
				String url = strs.get(1);
				String sha1 = hashImage(url, outdir);
				Integer processCount = HASH_TO_FILE_ID.get(sha1);
				System.out.println(imageid + "," + sha1 + "," + processCount);
				if (processCount!=null && processCount%10000==0) {
					long endtime = System.currentTimeMillis();
					System.err.println("Processed: " + processCount + " Last 10000: " + (endtime-starttime) + "ms");
					starttime = endtime;
					System.err.println("Reading: " + TOTAL_FETCH_TIME+ " Errors: " + TOTAL_ERROR_TIME + " Hashing: " + TOTAL_PROCESSING_TIME);
				}
			}
			br.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
}
