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
package oculus.memex.rest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;

import oculus.memex.image.AdImages;
import oculus.memex.util.DataUtil;
import oculus.memex.util.TimeLog;
import oculus.xdataht.data.DataRow;
import oculus.xdataht.model.ClusterDetailsResult;
import oculus.xdataht.model.StringMap;

@Path("/tipAdDetails")
public class TipAdDetailsResource  {
	@Context
	UriInfo _uri;
	
	@GET
	@Path("{type}/{tip}")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public ClusterDetailsResult handleGet(@PathParam("type") String type, @PathParam("tip") String tip, @Context HttpServletRequest request) {
		TimeLog log = new TimeLog();
		String user_name = request.getRemoteUser();
		log.pushTime("Ad Search tip: " + tip + " for user: " + user_name);
		HashSet<Integer> matchingAds;
		if (type.equals("tip")) {
			matchingAds = GraphResource.fetchMatchingAds(tip, log);
		} else {
			matchingAds = AdImages.getMatchingAds(Integer.parseInt(tip));
		}
		if (matchingAds==null||matchingAds.size()==0) {
			log.popTime();
			return new ClusterDetailsResult(new ArrayList<StringMap>());
		}		
		HashSet<Integer> matches = new HashSet<Integer>();
		for(Integer ad_id: matchingAds) {
			matches.add(ad_id);
		}
		List<DataRow> results = new ArrayList<DataRow>();
		PreclusterDetailsResource.getDetails(log, matches, results, user_name);
		ArrayList<HashMap<String,String>> details = DataUtil.sanitizeHtml(results);

		ArrayList<StringMap> serializableDetails = new ArrayList<StringMap>();
		for (HashMap<String,String> map : details) {
			serializableDetails.add( new StringMap(map));
		}
		log.popTime();
		return new ClusterDetailsResult(serializableDetails);
	}
}