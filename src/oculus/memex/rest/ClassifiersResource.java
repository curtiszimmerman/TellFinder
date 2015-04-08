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

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import oculus.memex.concepts.AdKeywords;
import oculus.memex.concepts.Keywords;
import oculus.xdataht.model.ClassifiersResult;
import oculus.xdataht.model.UpdateKeywordsRequest;

@Path("/classifiers")
public class ClassifiersResource {
	
	@GET @Path("fetch")
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	public static ClassifiersResult getKewords() {
		ClassifiersResult classifiers = new ClassifiersResult(Keywords.getKeywords());
		return classifiers;
	}
	
	@POST @Path("update")
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public static void addKeywords(UpdateKeywordsRequest keywordsRequest) {
		if (!keywordsRequest.getKeywords().isEmpty()) {
			Keywords.updateKeywords(keywordsRequest.getKeywords(), true);
		}
	}
	
	@DELETE @Path("update")
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public static void removeKeywords(UpdateKeywordsRequest keywordsRequest) {
		if (!keywordsRequest.getKeywords().isEmpty()) {
			Keywords.updateKeywords(keywordsRequest.getKeywords(), false);
		}
	}
	
	@GET @Path("classify")
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	/** Trigger re-classification of ads based on the current set of classifiers and keywords. */
	public static void classify() {
		AdKeywords.extractKeywords(true);		
	}
	
	@GET @Path("progress")
	@Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public static String getProgress() {
		String result = "{ \"percentComplete\" : " + AdKeywords.getPercentComplete() + "}";
		return result;
	}
}
