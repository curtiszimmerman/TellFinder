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
import java.util.Collection;
import java.util.HashMap;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import oculus.memex.tags.Tags;
import oculus.xdataht.model.StringList;
import oculus.xdataht.model.TagsResult;
import oculus.xdataht.model.UpdateTagRequest;

@Path("/tags")
public class TagsResource {
	
	private HashMap<String, StringList> getTags(Collection<String> adIds, String user_name) {
		HashMap<String, StringList> tagMap =  new HashMap<String, StringList>();
		if (adIds == null || adIds.size() == 0) {
			return tagMap;
		}		
		for (String id : adIds) {
			tagMap.put(id,new StringList(Tags.getTags(id, user_name)));
		}		
		return tagMap;
	}
	
	@POST
	@Path("fetch")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public TagsResult fetch(StringList adIds, @Context HttpServletRequest request) {
		return new TagsResult( getTags(adIds.getList(), request.getRemoteUser()) );
	}
	
	@POST
	@Path("update")
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public void update(UpdateTagRequest tagRequest, @Context HttpServletRequest request) {
		String user_name = request.getRemoteUser();
		ArrayList<String> tags = tagRequest.getTags();
		if (tags != null && tags.size() > 0) {
			if (tagRequest.getAdd() == true) {
				Tags.addTags(tagRequest.getAdIds(), tags, user_name);
			} else {
				Tags.removeTags(tagRequest.getAdIds(), tags, user_name);
			}
		}
	}	
	
	@DELETE
	@Path("resetAllTags")
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public void resetAllTags(@Context HttpServletRequest request) {;
		Tags.resetAllTags(request.getRemoteUser());
	}
}
