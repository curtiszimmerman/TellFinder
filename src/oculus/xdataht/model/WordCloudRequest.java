package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class WordCloudRequest {
	private int width;
	private int height;
	ArrayList<WordCount> wordCounts;
	
	public WordCloudRequest() { }

	public WordCloudRequest(int width, int height,
			ArrayList<WordCount> wordCounts) {
		super();
		this.width = width;
		this.height = height;
		this.wordCounts = wordCounts;
	}

	public int getWidth() {
		return width;
	}

	public void setWidth(int width) {
		this.width = width;
	}

	public int getHeight() {
		return height;
	}

	public void setHeight(int height) {
		this.height = height;
	}

	public ArrayList<WordCount> getWordCounts() {
		return wordCounts;
	}

	public void setWordCounts(ArrayList<WordCount> wordCounts) {
		this.wordCounts = wordCounts;
	}
}
