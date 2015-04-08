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
import java.util.Map;

import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import oculus.xdataht.data.WordCloud;
import oculus.xdataht.model.WordCloudRequest;
import oculus.xdataht.model.WordCloudResult;
import oculus.xdataht.model.WordCount;

import org.restlet.resource.ResourceException;

@Path("/wordCloud")
public class WordCloudResource {
	
	@POST
	@Produces({MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON})
	@Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	public WordCloudResult handlePost(WordCloudRequest wcr) throws ResourceException {
		WordCloudResult result = new WordCloudResult();
		
		int imageWidth = wcr.getWidth();
		int imageHeight = wcr.getHeight();
		ArrayList<WordCount> wordCounts = wcr.getWordCounts();
		if (imageWidth==0||imageHeight==0||wordCounts.size()==0) {
			result.setId("blank");
			return result;
		}
		
		Map<String,Integer> wordMap = new HashMap<String,Integer>();
		for (WordCount wc : wordCounts) {
			String word = wc.getWord();
			int count = wc.getCount();
			wordMap.put(word, count);
		}
		

		if (wordMap.size() == 0) {
			wordMap.put("No Text", 1);
		}
		
		// If we don't have the image, generate it
		StringBuffer bigStr = new StringBuffer("");
		for (String word:wordMap.keySet()) {
			for (int i = 0; i < wordMap.get(word); i++) {
				bigStr.append(word);
			}
		}
		String imgID = "" + bigStr.toString().hashCode();
		String resizedID = imgID + "_" + imageWidth + "x" + imageHeight;
		
		byte[] imgBytes = ImageResource.getImage(resizedID);
		if (imgBytes == null) {
			try {
				imgBytes = WordCloud.generateWordCloud(wordMap, imageWidth, imageHeight);

				// Store the image on the server
				ImageResource.addImage(imgBytes, resizedID);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}

		// Return a link to the image servers
		result.setId(resizedID);
		return result;
	}
}
