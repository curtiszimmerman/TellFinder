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
package oculus.xdataht.data;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.imageio.ImageIO;

import oculus.memex.init.PropertyManager;

public class WordCloud {
	private static int MAX_WORDS_IN_CLOUD;
	private static int MIN_FONT_SIZE;
	private static int MAX_FONT_SIZE;
	private static Set<String> STOP_WORDS;
	private static boolean initialized = false;
	
	private static void initialize() {
		PropertyManager spm = PropertyManager.getInstance();
		
		MAX_WORDS_IN_CLOUD = Integer.parseInt(spm.getProperty("wordcloud.maxWords", "100"));
		MIN_FONT_SIZE = Integer.parseInt(spm.getProperty("wordcloud.minFontSize", "10"));
		MAX_FONT_SIZE = Integer.parseInt(spm.getProperty("wordcloud.maxFontSize", "20"));
		STOP_WORDS = spm.getPropertySet("wordcloud.stopWords");
		
		initialized = true;
	}

	public static byte[] generateWordCloud(Map<String,Integer> words, int width, int height) {
		if (!initialized) {
			initialize();
		}
		
		List<WordCount> wordCounts = createWordList(words);

		// Get max count
        int maxCount = 0;
        for (WordCount word : wordCounts) {
        	if (word._count > maxCount) maxCount = word._count;
        }

        // Set up the image and used space array
        ArrayList<Rectangle> used = new ArrayList<Rectangle>();
        BufferedImage bi = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D gb = bi.createGraphics();
        gb.setBackground(Color.WHITE);
        gb.clearRect(0, 0, width, height);
        gb.setColor(Color.BLACK);
        gb.setFont(new Font("Arial", Font.PLAIN, 12));
    	Font font = gb.getFont();
    	float fontRange = MAX_FONT_SIZE-MIN_FONT_SIZE;
    	float countRange = maxCount-1;
    	if (countRange==0) countRange = 1;

    	// Add each word to the image
    	for (WordCount word:wordCounts) {
        	Font newFont = font.deriveFont((float)(MIN_FONT_SIZE+fontRange*(word._count-1)/countRange));
        	gb.setFont(newFont);
            addText(gb, used, word._word, width, height);
        }
        
    	// Output the image to a byte array
    	ByteArrayOutputStream baos = new ByteArrayOutputStream();
    	try {
	    	ImageIO.write( bi, "png", baos );
	    	baos.flush();
	    	byte[] imageInByte = baos.toByteArray();
	    	baos.close();
	    	return imageInByte;
    	} catch (Exception e) {
    		e.printStackTrace();
		}
    	return null;
	}

    private static void addText(Graphics2D gb, ArrayList<Rectangle> used, String txt, int width, int height) {
        FontMetrics fm = gb.getFontMetrics();
        int wordWidth = fm.stringWidth(txt);
        int wordHeight = fm.getHeight();
        
        int[] yBounds = getMinMaxY(gb.getFont(), txt, fm, width, height);
        
        // Try some random x positions
        for (int attempts=0; attempts<20; attempts++) {

	        // Move along a line until there is a free space
	        double dirX = Math.random()*2-1;
	        double dirY = Math.sqrt(1-dirX*dirX)*(Math.random()>0.5?1:-1);
	        Rectangle rect = new Rectangle(0, 0, wordWidth, yBounds[1]-yBounds[0]);
	        int offset = 0;
	        while(true) {
	        	rect.x = (int)(width/2 +(dirX*offset)-wordWidth/2);
	        	rect.y = (int)(height/2 +(dirY*offset)-wordHeight/2);
	        	if ( (rect.x<0) || (rect.y<0) || (rect.y+rect.height>height) || (rect.x+rect.width>width) ) break;
	        	if (freeSpace(used, rect)) {
	        		gb.drawString(txt, rect.x, rect.y+fm.getAscent()-yBounds[0]);
	        		used.add(rect);
	        		return;
	        	}
	        	offset++;
	        }
        }
	}

    /**
     * Iterate over rendered pixels to determine the actual min/max Y for txt
     */
	private static int[] getMinMaxY(Font font, String txt, FontMetrics fm, int width, int height) {
		BufferedImage tmpImg = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D tmpG = tmpImg.createGraphics();
        tmpG.setFont(font);
        tmpG.drawString(txt, 0, fm.getAscent());
        int yBounds[] = {height,0};
       	for (int j=0; j<height; j++) {
       		for (int i=0; i<width; i++) {
        		if ((tmpImg.getRGB(i,j)&0xFF)>0) {
        			boolean set = false;
        			if (yBounds[0]>j) {
        				yBounds[0] = j;
        				set = true;
        			}
        			if (yBounds[1]<j) {
        				yBounds[1] = j;
        				set = true;
        			}
        			if (set) break;
        		}
        	}
        }
       	// Add a pixel buffer
       	yBounds[0]--;
       	yBounds[1]++;
		return yBounds;
	}

	/**
	 * Check to see if rect intersects any of the used rectangles
	 */
	private static boolean freeSpace(ArrayList<Rectangle> used, Rectangle rect) {
		for (Rectangle comp:used) {
			if (rect.intersects(comp)) return false;
		}
		return true;
	}


	private static boolean isStopWord(String word) {
		if (word==null || STOP_WORDS.contains(word.toLowerCase()) || word.equals('\r') || word.equals('\n') || word.equals("") || word.equals(" ")) {
			return true;
		} else {
			return false;
		}
	}
	
	private static List<WordCount> createWordList(Map<String,Integer> wordHistogram) {
        // Sort based on frequency
        List<WordCount> wordCountList = new ArrayList<WordCount>();
        for (String word : wordHistogram.keySet()) {
        	if (isStopWord(word)) {
        		continue;
        	}
        	WordCount wordCount = new WordCount(word.toLowerCase(), wordHistogram.get(word));
        	wordCountList.add(wordCount);
        }
        Collections.sort(wordCountList);
        
        // Create our subset of the full word counts and compute the max/min 
        // frequency of the subset
        int upperBound = MAX_WORDS_IN_CLOUD < wordCountList.size() ? MAX_WORDS_IN_CLOUD : wordCountList.size();  
        List<WordCount> subset = wordCountList.subList(0, upperBound);
		return subset;
	}

	private static class WordCount implements Comparable<WordCount> {
		private String _word;
		private int _count;
		
		public WordCount(String word, int count) {
			_word = word;
			_count = count;
		}
		
		public int compareTo(WordCount other) {
			if ( other._count == _count ) {
				return 0;
			} else if ( other._count > _count ) {
				return 1;
			} else { 
				return -1;
			}
		}
	}
	
}
