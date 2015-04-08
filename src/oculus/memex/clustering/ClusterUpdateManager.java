package oculus.memex.clustering;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;

import oculus.memex.db.MemexOculusDB;
import oculus.memex.graph.ClusterImageBinLinks;
import oculus.memex.graph.ClusterLinks;
import oculus.memex.util.Pair;
import oculus.memex.util.TimeLog;

public class ClusterUpdateManager {
	private static int BATCH_INSERT_SIZE = 10000;
	private static int CLUSTER_FIX_SIZE = 1000;

	ArrayList<Pair<Integer,Integer>> clustersToInsert = new ArrayList<Pair<Integer,Integer>>();
	HashSet<Integer> alteredClusters = new HashSet<Integer>();
	
	/**
	 * Add the ad to the cluster table and any new cluster attributes to cluster_attributes.
	 */
	void addToCluster(MemexOculusDB db, Connection conn, int clusterid, MemexAd ad, ArrayList<String> clusterAttributes, ClusterAttributes attributeToClusters) {
		clustersToInsert.add(new Pair<Integer,Integer>(ad.id,clusterid));
		if (clustersToInsert.size()>BATCH_INSERT_SIZE) {
			batchInsert(conn);
		}
		for (String attribute:clusterAttributes) {
			HashSet<String> newValues = ad.attributes.get(attribute);
			if (newValues!=null) {
				for (String value:newValues) {
					attributeToClusters.addValue(clusterid, attribute, value, 1);
				}
			}
		}
	}

	/**
	 * Insert the (ads_id,clusterid) into the cluster table and the attributes into the cluster_attributes table.
	 */
	void createCluster(MemexOculusDB db, Connection conn, int clusterid, MemexAd ad, ArrayList<String> clusterAttributes, ClusterAttributes attributeToClusters) {
		clustersToInsert.add(new Pair<Integer,Integer>(ad.id,clusterid));
		if (clustersToInsert.size()>BATCH_INSERT_SIZE) {
			batchInsert(conn);
		}
		attributeToClusters.insertValues(clusterid, ad.attributes, clusterAttributes);
	}

	void batchInsert(Connection conn) {
		if (Cluster.DEBUG_MODE) return;
		if (clustersToInsert.size()>0) {
			PreparedStatement pstmt = null;
			try {
				conn.setAutoCommit(false);
				pstmt = conn.prepareStatement("insert into " + Cluster.CLUSTER_TABLE + "(ads_id,clusterid) values (?,?)");
				for (Pair<Integer,Integer> entry:clustersToInsert) {
					Integer adid = entry.getFirst();
					Integer clusterid = entry.getSecond();
					alteredClusters.add(clusterid);
					pstmt.setInt(1,adid);
					pstmt.setInt(2,clusterid);
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
					conn.setAutoCommit(true);
				} catch (SQLException e) {e.printStackTrace();}
			}
			
			
		}
		clustersToInsert.clear();
	}

	void updateDetails(TimeLog tl, ClusterAttributes attributeToClusters) {
		// Compute locations and links for clusters in this.alteredClusters
		tl.pushTime("Updating Cluster Details: " + alteredClusters.size());
		ArrayList<Integer> allClustersToFix = new ArrayList<Integer>(alteredClusters);
		Collections.sort(allClustersToFix);
		HashSet<Integer> fixClusters = new HashSet<Integer>();
		int count = 0;
		for (Integer clusterid:allClustersToFix) {
			fixClusters.add(clusterid);
			count++;
			if (fixClusters.size()==CLUSTER_FIX_SIZE) {
				tl.popTime();
				tl.pushTime("Updating details for: " + count + " of " + alteredClusters.size() + " current id : " + clusterid);
				ClusterDetails.updateDetails(tl, fixClusters);
				ClusterLinks.computeLinks(fixClusters, attributeToClusters);
				fixClusters.clear();
			}
		}
		tl.popTime();
		tl.pushTime("Updating details for: " + count + " of " + alteredClusters.size());
		ClusterDetails.updateDetails(tl, fixClusters);
		ClusterLinks.computeLinks(fixClusters, attributeToClusters);
		tl.popTime();

		tl.pushTime("Update cluster image bin links");
		ClusterImageBinLinks.computeLinks(tl, alteredClusters);
		tl.popTime();
	}
	
}
