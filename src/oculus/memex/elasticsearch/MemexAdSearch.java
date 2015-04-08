/**
 * Copyright (c) 2014-2015 Uncharted Software Inc.
 *
 * Property of Uncharted(TM), formerly Oculus Info Inc.
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
package oculus.memex.elasticsearch;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.X509Certificate;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import oculus.memex.init.PropertyManager;
import oculus.memex.util.TimeLog;
import oculus.xdataht.model.AdvancedSearchField;
import oculus.xdataht.model.AdvancedSearchRequest;

import org.codehaus.jettison.json.JSONArray;
import org.codehaus.jettison.json.JSONObject;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.FilterBuilders;
import org.elasticsearch.index.query.FilteredQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.elasticsearch.index.query.RangeFilterBuilder;
import org.elasticsearch.search.builder.SearchSourceBuilder;

public class MemexAdSearch {
    private static boolean SSL_DISABLED = false;
    private static void disableSslVerification() {
        if (SSL_DISABLED) return;
        SSL_DISABLED = true;
        try  {
            TrustManager[] trustAllCerts = new TrustManager[] {new X509TrustManager() {
                public java.security.cert.X509Certificate[] getAcceptedIssuers() {return null;}
                public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                public void checkServerTrusted(X509Certificate[] certs, String authType) {}
            }};

            // Install the all-trusting trust manager
            SSLContext sc = SSLContext.getInstance("SSL");
            sc.init(null, trustAllCerts, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());

            HostnameVerifier allHostsValid = new HostnameVerifier() {
                public boolean verify(String hostname, SSLSession session) {return true;}
            };

            // Install the all-trusting host verifier
            HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        } catch (KeyManagementException e) {
            e.printStackTrace();
        }
    }
    
    public static String getPostResult(String urlToRead, String postData) {
        URL url;
        HttpURLConnection conn;
        try {
            url = new URL(urlToRead);
            conn = (HttpURLConnection) url.openConnection();

            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type","application/x-www-form-urlencoded");

            String userPassword= url.getUserInfo();
            if (userPassword!=null && userPassword.length()>0) {
                String encoding = new String(org.apache.commons.codec.binary.Base64.encodeBase64(org.apache.commons.codec.binary.StringUtils.getBytesUtf8(userPassword)));
                conn.setRequestProperty("Authorization","Basic "+encoding);
            }

            DataOutputStream wr = new DataOutputStream(conn.getOutputStream());
            wr.writeBytes(postData);
            wr.flush();
            wr.close();

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            int nRead;
            byte[] data = new byte[16384];
            InputStream is = conn.getInputStream();
            while ((nRead = is.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            buffer.flush();
            return buffer.toString();
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("Failed to read URL: " + urlToRead + " <" + e.getMessage() + ">");
        }
        return null;
    }

    /** Get the IDs of ads whose text contains the search string. Ads will be ordered by the 'relevance'
     *  ranking computed by elastic search.
     *  @param elasticURL	The URL of the elastic search end point for ad search.
     *  @param searchStr	The search text.
     *  @param maxResults	The maximum number of results to return. Set to 0 to get all results.
     *  @return				The set of ad IDs.
     */
    public static HashSet<Integer> getAdIds(String elasticURL, String searchStr, int maxResults) {

        String wcPrefix = PropertyManager.getInstance().getProperty(PropertyManager.ELASTICSEARCH_WILDCARD_PREFIX);
        if (!"false".equalsIgnoreCase(wcPrefix)) {
            searchStr = "*" + searchStr;
        }

    	QueryStringQueryBuilder queryStrBuilder = QueryBuilders.queryString(searchStr);
    	queryStrBuilder.field("email").field("title").field("phone").field("website").field("text");
 
    	SearchSourceBuilder searchBuilder = SearchSourceBuilder.searchSource().query(queryStrBuilder);
        return runQuery(elasticURL, searchBuilder.toString(), maxResults);
    }

    /** Get the IDs of ads containing matches for all of the fields specified in the request.
     *  @param elasticURL	The URL of the elastic search end point for ad search.
     *  @param request		The fields and values to match
     *  @param maxResults	The maximum number of results to return. Set to 0 to get all results.
     *  @return				The set of ad IDs. If no valid search fields are specified in the request,
     *  					an empty set is returned. */

    public static HashSet<Integer> getAdIds(String elasticURL, AdvancedSearchRequest request, int maxResults) {
        List<String> validFields = Arrays.asList("text", "title", "email", "website", "phone" /*, "location" */);  // location disabled till we update the index to include it.
        boolean validQuery = false;

    	BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery();
        for (AdvancedSearchField field : request.fields) {
            if (!validFields.contains(field.name.toLowerCase())) { continue; }
            validQuery = true;
            
            if (field.name.equalsIgnoreCase("email")) {
            	queryBuilder.must(QueryBuilders.termQuery(field.name.toLowerCase(), field.value));
            } else {
            	queryBuilder.must(QueryBuilders.matchQuery(field.name.toLowerCase(), field.value));
            }
        }
        
        if (!validQuery) { return new HashSet<Integer>(); } 
        
        RangeFilterBuilder filterBuilder = FilterBuilders.rangeFilter("posttime");

        for (AdvancedSearchField field : request.fields) {
        	try {
	        	if (field.name.equalsIgnoreCase("startdate")) 	{ filterBuilder.gte(Long.parseLong(field.value)); }
	        	if (field.name.equalsIgnoreCase("enddate")) 	{ filterBuilder.lte(Long.parseLong(field.value)); }
        	} catch (NumberFormatException e) {
        		System.out.println("Unable to parse date value : " + field.value + ", expected long value specifying ms.");
        	}
        }
        
        FilteredQueryBuilder fqBuilder = QueryBuilders.filteredQuery(queryBuilder, filterBuilder);
           
        SearchSourceBuilder searchBuilder = SearchSourceBuilder.searchSource().query(fqBuilder);
        
        return runQuery(elasticURL, searchBuilder.toString(), maxResults);
    }

    /** Executes the specified query (and handles retrieval of pages of results for large result sets).
     *  @param elasticURL	The URL of the elastic search end point for ad search.
     *  @param queryStr		The elastic search query DSL (JSON) of the desired search.
     *  @param maxResults	The maximum number of results to return. Set to 0 to get all results.
     *  @return				The set of ad IDs.
     */
    protected static HashSet<Integer> runQuery(String elasticURL, String queryStr, int maxResults) {
        disableSslVerification();

        maxResults = maxResults > 0 ? maxResults : Integer.MAX_VALUE;
        int hits = -1;
        int startIdx = 0;
        int batchSize = 200;	// Elastic search docs recommend small batch sizes for better performance

        HashSet<Integer> result = new HashSet<Integer>();

        while (hits < 0 || startIdx < maxResults) {

            batchSize = Math.min(batchSize, maxResults - startIdx);
            
            String pagingClause = ", \"size\" : " + batchSize + ", \"from\" : " + startIdx + "}";
            String postData = queryStr.replaceAll("}$", pagingClause);
            
            String searchResult = getPostResult(elasticURL, postData);
            
            if (searchResult == null) {
            	System.out.println("Error encountered - unable to retrieve search results from Elastic Search.");
            	break;
            }

            try {
                JSONObject jsobj = new JSONObject(searchResult);
                JSONObject hitsObj = jsobj.getJSONObject("hits");
                JSONArray hitsArray = hitsObj.getJSONArray("hits");

                if ( hits < 0 ) {
                    hits = hitsObj.getInt("total");
                    maxResults = Math.min(maxResults, hits);
                }

                for (int i=0; i<hitsArray.length(); i++) {
                    JSONObject hitObj = hitsArray.getJSONObject(i);
                    result.add(hitObj.getInt("_id"));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }

            startIdx += batchSize;
        }
        return result;
    }

    /** Get the set of IDs of ads that contain the exact text specified by the keyword param.
     *  @param elasticBaseURL	  The base URL of the elastic search service
     * 	@param elasticAdSearchURL The elastic search URL for searching ad text.
     * 	@param keyword			  The word or phrase to be matched.
     *  @param startId			  Get keywords from all ads with ID >= this value. Use 0 to search all ads.
     * 	@return
     */
    public static HashSet<Integer> getKeyWordMatches(String elasticBaseURL, String elasticAdSearchURL, String keyword, int startId) {
        System.out.print("Matching Keyword " + keyword);
        disableSslVerification();

        int hits = -1;
        int batchSize = 400; // actual # returned in each 'page' will be this value * the # of shards in the index

        HashSet<Integer> result = new HashSet<Integer>();

        String searchUrl = elasticAdSearchURL + "?scroll=1m&search_type=scan";
        String searchPostData =
                "{ 'query' : {" +
                        "'filtered' : {" +
                        "'query' : { " +
                        "'match_phrase' : {" +
                        "'text' : '" + keyword + "'" +
                        "}" +
                        "}," +
                        "'filter': {" +
                        "'range' : { " +
                        "'id' : { 'gte' : " + startId + "}" +
                        "}" +
                        "}" +
                        "}" +
                        "}, " +
                        "'fields' : []" + "," +
                        "'size' : " + batchSize	+
                        "}";
        searchPostData = searchPostData.replaceAll("'", "\"");

        try {
            String searchResult = getPostResult(searchUrl, searchPostData);
            JSONObject searchJSON = new JSONObject(searchResult);

            hits = searchJSON.getJSONObject("hits").getInt("total");
            System.out.print(", Hits = " + hits + "\n");
            String scrollID = searchJSON.getString("_scroll_id");

            while (hits > 0) {
                String scrollUrl = elasticBaseURL + "/_search/scroll?scroll=1m&scroll_id=" + scrollID;
                String scrollResult = getPostResult(scrollUrl, "");

                JSONObject scrollJSON = new JSONObject(scrollResult);
                JSONObject hitsObj = scrollJSON.getJSONObject("hits");
                JSONArray hitsArray = hitsObj.getJSONArray("hits");
                hits = hitsArray.length();
                for (int i = 0; i < hits; i++) {
                    JSONObject hitObj = hitsArray.getJSONObject(i);
                    result.add(hitObj.getInt("_id"));
                }
                scrollID = scrollJSON.getString("_scroll_id");
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return result;
    }

    /** Find the maximum ID amongst all the ads in the elastic search index.
     * 	@param elasticAdSearchURL 	The elastic search URL for searching ad text.
     *  @return						The maximum ID, or -1 if unable to determine.
     */
    public static int getMaxAdId(String elasticAdSearchURL) {
        int maxID = -1;
        String postData =
                "{" +
                        "\"fields\" : [ \"id\" ], " +
                        "\"filter\" : { " +
                        "\"match_all\" : { } " +
                        "}, " +
                        "\"sort\": [ " +
                        "{ " +
                        "\"id\": { " +
                        "\"order\": \"desc\"" +
                        "}" +
                        "}" +
                        "], " +
                        "\"size\": 1 " +
                        "} ";

        try {
            String searchResult = getPostResult(elasticAdSearchURL, postData);
            JSONObject searchJSON = new JSONObject(searchResult);
            JSONObject hitsObject = searchJSON.getJSONObject("hits");
            JSONArray hitsArray = hitsObject.getJSONArray("hits");
            maxID = hitsArray.getJSONObject(0).getInt("_id");

        } catch (Exception e) {
            e.printStackTrace();
        }

        return maxID;
    }

    public static void main(String[] args) {
        TimeLog tl = new TimeLog();
        tl.pushTime("Search ads");
        HashSet<Integer> result = getAdIds("","cherry11", 2000);
        System.out.println(result);
        System.out.println("# results = " + result.size());
        tl.popTime();
       }
}
