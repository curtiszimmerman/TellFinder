package oculus.memex.clustering;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

import oculus.memex.db.DBManager;
import oculus.memex.db.MemexHTDB;
import oculus.memex.util.StringUtil;

public class MemexAd {
	private static final int WHERE_IN_SELECT_SIZE = 2000;
	public int id;
	public HashMap<String,HashSet<String>> attributes = new HashMap<String,HashSet<String>>();

	public MemexAd(int id) {
		this.id = id;
	}

	public void addAttribute(String attribute, String value) {
		HashSet<String> values = attributes.get(attribute);
		if (values==null) {
			values = new HashSet<String>();
			attributes.put(attribute, values);
		}
		values.add(value);
	}
	
	public static HashMap<Integer,MemexAd> fetchAdsHT(Connection htconn, String whereClause) {
		HashMap<Integer,MemexAd> result = new HashMap<Integer,MemexAd>();
		String sqlStr = "SELECT ads_id,attribute,value from ads_attributes WHERE " + whereClause + " and (attribute='website' or attribute='email' or attribute='phone')";
		Statement stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int id = rs.getInt("ads_id");
				String attribute = rs.getString("attribute");
				String value = rs.getString("value");
				if (value!=null && value.trim().length()>1) {
					MemexAd ad = result.get(id);
					if (ad==null) {
						ad = new MemexAd(id);
						result.put(id, ad);
					}
					ad.addAttribute(attribute, value);
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

		sqlStr = "SELECT id,website,phone,email from ads WHERE " + whereClause.replace("ads_id","id");
		stmt = null;
		try {
			stmt = htconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int id = rs.getInt("id");
				String website = rs.getString("website");
				String phone = rs.getString("phone");
				String email = rs.getString("email");
				MemexAd ad = result.get(id);
				if (ad==null) {
					ad = new MemexAd(id);
					result.put(id, ad);
				}
				if (website!=null && website.trim().length()>1) {
					ad.addAttribute("website", website.trim());
				}
				if (email!=null && email.trim().length()>1) {
					ad.addAttribute("email", email.trim());
				}
				if (phone!=null && phone.trim().length()>1) {
					phone = StringUtil.stripNonNumeric(phone);
					if (phone!=null && phone.length()<16) ad.addAttribute("phone", phone);
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
		return result;
	}
	
	public static HashMap<Integer,MemexAd> fetchAdsOculus(Connection htconn, Connection oculusconn, int minID, int maxID) {
		return fetchAdsOculus(htconn, oculusconn, "ads_id>=" + minID + " and ads_id<=" + maxID, false);
	}
	public static HashMap<Integer,MemexAd> fetchAdsOculus(Connection htconn, Connection oculusconn, int minID, int maxID, boolean includeFirstId) {
		return fetchAdsOculus(htconn, oculusconn, "ads_id>=" + minID + " and ads_id<=" + maxID, includeFirstId);
	}	
	public static HashMap<Integer,MemexAd> fetchAdsOculus(Connection htconn, Connection oculusconn, HashSet<Integer> ids) {
		String whereClause = "ads_id IN " + StringUtil.hashSetToSqlList(ids);
		return fetchAdsOculus(htconn, oculusconn, whereClause, false);
	}


    public static HashMap<String,Integer> fetchAdCountsForAttributes(Connection oculusconn, String tableName, String valueColumnName, HashSet<String> attributeValues) {
        String sqlStr = "SELECT " + valueColumnName + " as attrval, count(ads_id) as count from " + tableName + " WHERE " + valueColumnName + " IN " + StringUtil.hashSetToQuotedSqlList(attributeValues) + " group by " + valueColumnName;
        Statement stmt = null;
        HashMap<String,Integer> result = new HashMap<String, Integer>();
        try {
            stmt = oculusconn.createStatement();
            ResultSet rs = stmt.executeQuery(sqlStr);
            while (rs.next()) {
                int count = rs.getInt("count");
                String val = rs.getString("attrval");
                result.put(val,count);
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
        return result;
    }


    public static void fetchAdsOculusAttribute(Connection oculusconn, String tableName, String attributeName, String columnName, String whereClause, HashMap<Integer, MemexAd> result) {
		String sqlStr = "SELECT ads_id," + columnName + " from " + tableName + " WHERE " + whereClause;
		Statement stmt = null;
		try {
			stmt = oculusconn.createStatement();
			ResultSet rs = stmt.executeQuery(sqlStr);
			while (rs.next()) {
				int id = rs.getInt("ads_id");
				String value = rs.getString(columnName);
				if (value!=null && value.trim().length()>1) {
					MemexAd ad = result.get(id);
					if (ad==null) {
						ad = new MemexAd(id);
						result.put(id, ad);
					}
					ad.addAttribute(attributeName, value);
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
	}

	public static void fetchAdsOculusAttribute(Connection oculusconn, String tableName, String attributeName, String whereClause, HashMap<Integer, MemexAd> result) {
		fetchAdsOculusAttribute(oculusconn,tableName,attributeName,"value",whereClause,result);
	}


	public static HashSet<Integer> getAdIdsWithValue(Connection oculuconn, String tableName, String columnName, String attributeName, String attributeValue) {

		String sql = "SELECT DISTINCT ads_id as id FROM " + tableName + " WHERE " + columnName + "='" + attributeValue + "'";

		HashSet<Integer> result = new HashSet<Integer>();

		Statement stmt = null;
		try {
			stmt = oculuconn.createStatement();
			ResultSet rs = stmt.executeQuery(sql);
			while (rs.next()) {
				int id = rs.getInt("id");
				result.add(id);
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
		return result;
	}

	public static HashMap<Integer,MemexAd> fetchAdsOculus(Connection htconn, Connection oculusconn, String whereClause, boolean includeFirstId) {
		HashMap<Integer,MemexAd> result = new HashMap<Integer,MemexAd>();
		fetchAdsOculusAttribute(oculusconn,"ads_emails","email",whereClause,result);
		fetchAdsOculusAttribute(oculusconn,"ads_websites","website",whereClause,result);
		fetchAdsOculusAttribute(oculusconn,"ads_phones","phone",whereClause,result);


		if (includeFirstId) {
			String sqlStr = "SELECT id,first_id from ads WHERE " + whereClause.replace("ads_id","id");
			Statement stmt = null;
			try {
				stmt = htconn.createStatement();
				ResultSet rs = stmt.executeQuery(sqlStr);
				while (rs.next()) {
					int id = rs.getInt("id");
					Integer first_id = rs.getInt("first_id");
					if (first_id!=null && first_id>0) {
						MemexAd ad = result.get(id);
						if (ad==null) {
							ad = new MemexAd(id);
							result.put(id, ad);
						}
						ad.addAttribute("first_id", Integer.toString(first_id));
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
		}

		return result;
	}

	private static String WHERE_IN_PSTMT_QUESTIONS = null;
	public static String commasAndQuestions(int count) {
		if (count==WHERE_IN_SELECT_SIZE) {
			if (WHERE_IN_PSTMT_QUESTIONS!=null) {
				return WHERE_IN_PSTMT_QUESTIONS;
			}
		}
		String result = StringUtil.commasAndQuestions(count);
		if (count==WHERE_IN_SELECT_SIZE) {
			WHERE_IN_PSTMT_QUESTIONS = result;
			return WHERE_IN_PSTMT_QUESTIONS;
		}
		return result;
	}	

	public static HashMap<String,HashSet<Integer>> getAdsForValues(Connection oculusconn, String table, Set<String> set) {
		HashMap<String,HashSet<Integer>> result = new HashMap<String,HashSet<Integer>>();
		String baseSqlStr = "SELECT ads_id,value FROM " + table + " where value in (";
		ArrayList<String> values = new ArrayList<String>(set);
		int idx = 0;
		while (idx<values.size()) {
			int numValues = Math.min(values.size()-idx, WHERE_IN_SELECT_SIZE);
			String sqlStr = baseSqlStr + commasAndQuestions(numValues) + ")";
			PreparedStatement stmt = null;
			try {
				stmt = oculusconn.prepareStatement(sqlStr);
				for (int i=0; i<numValues; i++) {
					stmt.setString(i+1, values.get(idx+i));
				}
				idx += numValues;

				ResultSet rs = stmt.executeQuery();
				while (rs.next()) {
					Integer adid = rs.getInt("ads_id");
					String value = rs.getString("value");
					HashSet<Integer> ads = result.get(value);
					if (ads==null) {
						ads = new HashSet<Integer>();
						result.put(value, ads);
					}
					ads.add(adid);
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
		}
		
		return result;
	}	
	
	public static int getMaxID() {
		MemexHTDB db = MemexHTDB.getInstance();
		Connection conn = db.open();
		int result = DBManager.getInt(conn, "SELECT max(id) from " + MemexHTDB.MEMEX_ADS_TABLE, "Get max ad id");
		db.close(conn);
		return result;
	}
}
