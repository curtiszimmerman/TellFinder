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

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;

import javax.imageio.ImageIO;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Response;

@Path("/image")
public class ImageResource {
	static byte[] BLANK_IMG = {};
	static {
        BufferedImage bi = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        Graphics2D gb = bi.createGraphics();
        gb.setBackground(Color.WHITE);
        gb.clearRect(0, 0, 1, 1);
    	// Output the image to a byte array
    	ByteArrayOutputStream baos = new ByteArrayOutputStream();
    	try {
	    	ImageIO.write( bi, "png", baos );
	    	baos.flush();
	    	BLANK_IMG = baos.toByteArray();
	    	baos.close();
    	} catch (Exception e) {
    		System.out.println("**ERROR: Failed to write blank image: " + e.getMessage());
		}
	}
	
	private static Object _lock = new Object();
	
	private static HashMap<String,byte[]> IMAGE_MAP = new HashMap<String,byte[]>();

	
	public static byte[] getImage(String imgID) {
		return IMAGE_MAP.get(imgID);
	}
	
	public static void addImage(byte[] img, String imgID) {		
		synchronized (_lock) {
			IMAGE_MAP.put(imgID, img);
		}
	}
	
	@GET
	@Path("{id}")
	@Produces("image/png")
	public Response get(@PathParam("id") String imageId) { 
		try {
			byte[] rawImage = IMAGE_MAP.get(imageId);
			if (rawImage!=null) {
				return Response.ok(new ByteArrayInputStream(rawImage)).build();
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		return Response.ok(new ByteArrayInputStream(BLANK_IMG)).build();
	}
	
	
}