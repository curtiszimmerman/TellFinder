package oculus.memex.concepts;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

import oculus.memex.db.DBManager;
import oculus.memex.db.DBManager.ResultHandler;
import oculus.memex.db.MemexHTDB;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.util.Pair;

public class ConceptAdExtractor {

	public static class AdClassificationSet extends ResultHandler {
		private String classifier;
		HashMap<Integer,Integer> adCounts = new HashMap<Integer,Integer>();
		public AdClassificationSet(String classifier) {
			this.classifier = classifier;
		}
		private void incrementCount(Integer adid) {
			Integer oldCount = adCounts.get(adid);
			if (oldCount==null) oldCount = 0;
			adCounts.put(adid, oldCount+1);
		}
		public void handleResult(ResultSet rs) throws SQLException {
			Integer adid = rs.getInt("ads_id");
			String classifier = rs.getString("classifier");
			if (this.classifier.compareTo(classifier)==0) {
				incrementCount(adid);
			}
		}
		public ArrayList<Integer> getTop100() {
			ArrayList<Pair<Integer,Integer>> adList = new ArrayList<Pair<Integer,Integer>>();
			for (Map.Entry<Integer, Integer> e:adCounts.entrySet()) {
				adList.add(new Pair<Integer,Integer>(e.getKey(),e.getValue()));
			}
			Collections.sort(adList, new Comparator<Pair<Integer,Integer>>() {
				public int compare(Pair<Integer, Integer> a, Pair<Integer, Integer> b) {
					return b.getSecond()-a.getSecond();
				}
			});
			ArrayList<Integer> result = new ArrayList<Integer>();
			for (int i=0; i<100 && i<adList.size(); i++) {
				result.add(adList.get(i).getFirst());
			}
			return result;
		}
		
		public ArrayList<Integer> getMissing100() {
			MemexOculusDB db = MemexOculusDB.getInstance();
			Connection conn = db.open();
			int maxid = DBManager.getInt(conn, "select max(ads_id) from ads_keywords", "Get max keyword adid");
			ArrayList<Integer> missing = new ArrayList<Integer>();
			for (int i=0; i<maxid; i++) {
				if (!adCounts.containsKey(i)) missing.add(i);
			}
			if (missing.size()>100) {
				ArrayList<Integer> shortMissing = new ArrayList<Integer>();
				for (int i=0; i<100; i++) {
					int rid = (int)(Math.random()*missing.size());
					shortMissing.add(missing.remove(rid));
				}
				return shortMissing;
			}
			return missing;
		}
	}
	
	public static class AdOutputSet extends ResultHandler {
		String directory = null;
		public void outputAds(String directory, ArrayList<Integer> adids) {
			this.directory = directory;
			MemexHTDB db = MemexHTDB.getInstance();
			Connection conn = db.open();
			MemexHTDB.getResults(conn, "id", adids, new String[]{"id","title","text"}, "ads", this);
			db.close(conn);
		}
		public void handleResult(ResultSet rs) throws SQLException {
			Integer adid = rs.getInt("id");
			String title = rs.getString("title");
			String text = rs.getString("text");
			writeFile(directory,adid,title,text);
		}
	}
	
	public static void getAds(String classifier) {
		MemexOculusDB db = MemexOculusDB.getInstance();
		Connection conn = db.open();
		AdClassificationSet s = new AdClassificationSet(classifier);
		MemexOculusDB.getResults(conn, new String[]{"ads_id","classifier"}, "ads_keywords", s);
		db.close(conn);
		
		ArrayList<Integer> best = s.getTop100();
		AdOutputSet out = new AdOutputSet();
		out.outputAds("matches", best);

		ArrayList<Integer> non = s.getMissing100();
		out.outputAds("nonmatches", non);
		
	}

	public static void writeFile(String directory, Integer adid, String title, String text) {
		File outfile = new File(directory + "/" + adid + ".txt");
		try {
		    BufferedWriter writer = new BufferedWriter(new FileWriter(outfile));
			writer.write(title);
			writer.write("\n");
			writer.write(text);
			writer.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
		
	}

	public static void main(String[] args) {
		getAds("underage");
	}
}
