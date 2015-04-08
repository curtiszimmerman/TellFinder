package oculus.memex.training;

import java.sql.Connection;
import java.util.HashSet;

import oculus.memex.clustering.Cluster;
import oculus.memex.clustering.ClusterAttributes;
import oculus.memex.clustering.ClusterDetails;
import oculus.memex.db.DBManager;
import oculus.memex.db.MemexOculusDB;
import oculus.memex.graph.AttributeLinks;
import oculus.memex.graph.ClusterLinks;
import oculus.memex.util.StringUtil;
import oculus.memex.util.TimeLog;

import org.restlet.resource.ResourceException;

public class InvalidateAttribute {
	public static final String BAD_WEBSITES = "bad_websites";
	public static final String BAD_PHONES = "bad_phones";
	public static final String BAD_EMAILS = "bad_emails";
	
	public static long invalidateValueStatic(String attribute, String value) throws ResourceException {
		TimeLog tl = new TimeLog();
		tl.pushTime("Invalidate " + attribute + " " + value);
		tl.pushTime("Deletes");
		// Fetch ads with the attribute
		// Delete from ads_phones, ads_email, ads_website
		HashSet<Integer> matchingAds;
		if (attribute.compareToIgnoreCase("website")==0) {
			matchingAds = MemexOculusDB.getValueAds("ads_websites", value, true);
			MemexOculusDB.deleteValueAds("ads_websites", value);
			MemexOculusDB.addBadValue(BAD_WEBSITES, value);
		} else if (attribute.compareToIgnoreCase("email")==0) {
			matchingAds = MemexOculusDB.getValueAds("ads_emails", value, true);
			MemexOculusDB.deleteValueAds("ads_emails", value);
			MemexOculusDB.addBadValue(BAD_EMAILS, value);
		} else {
			matchingAds = MemexOculusDB.getValueAds("ads_phones", value, true);
			MemexOculusDB.deleteValueAds("ads_phones", value);
			MemexOculusDB.addBadValue(BAD_PHONES, value);
		}
		ClusterAttributes.deleteValueAds(attribute,value);
		tl.popTime();

		ClusterAttributes attributeToClusters = new ClusterAttributes();

		// Recluster
		tl.pushTime("Update clusters " + matchingAds.size() + " ads");
		HashSet<Integer> clusterids = Cluster.recalculateClustersForAds(matchingAds, attributeToClusters, tl);
		tl.popTime();
		
		// Calculate cluster details, cluster locations, cluster links for affected clusters
		tl.pushTime("Update details " + clusterids.size() + " clusters " + StringUtil.hashSetToSqlList(clusterids));
		ClusterDetails.updateDetails(tl, clusterids);
		tl.popTime();
		tl.pushTime("Update links");
		ClusterLinks.computeLinks(clusterids, attributeToClusters);
		tl.popTime();

		AttributeLinks.deleteAttribute(tl, attribute,value);
		return tl.popTime();
	}
	
	public static void main(String[] args) {
//		invalidateValueStatic("website", "http://www.cloudflare.com/email-protection");
		invalidateValueStatic("phone", "11021013425101");
	}

	public static void initTable(MemexOculusDB db) {
		Connection conn = db.open();
		System.out.println("INVALID ATTRIBUTE INITIALIZATION");
		if(db.tableExists(conn, BAD_PHONES)){
			System.out.println("\t" + BAD_PHONES + " table exists.");
		} else {
			createTable(db, conn, BAD_PHONES, 16, 16);
			System.out.println("\t" + BAD_PHONES + " table initialized.");
		}
		if(db.tableExists(conn, BAD_WEBSITES)){
			System.out.println("\t" + BAD_WEBSITES + " table exists.");
		} else {
			createTable(db, conn, BAD_WEBSITES, 2048, 128);
			System.out.println("\t" + BAD_WEBSITES + " table initialized.");
		}
		if(db.tableExists(conn, BAD_EMAILS)){
			System.out.println("\t" + BAD_EMAILS + " table exists.");
		} else {
			createTable(db, conn, BAD_EMAILS, 2048, 128);
			System.out.println("\t" + BAD_EMAILS + " table initialized.");
		}
		db.close(conn);		
	}

	private static void createTable(MemexOculusDB db, Connection conn,	String tableName, int varCharLength, int pkLength) {
		try {
			String sqlCreate = 
				"CREATE TABLE `" + tableName + "` (" +
				"`value` VARCHAR(" + varCharLength + ") NOT NULL," +
				"PRIMARY KEY(`value`(" + pkLength + ")) )";
			DBManager.tryStatement(conn, sqlCreate);
		} catch (Exception e) {
			e.printStackTrace();
		}		
	}
}