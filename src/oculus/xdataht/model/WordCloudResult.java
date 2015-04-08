package oculus.xdataht.model;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class WordCloudResult {
	private String id;
	public WordCloudResult() { }
	public WordCloudResult(String id) {
		this.id = id;
	}
	public String getId() { return id; }
	public void setId(String id) { this.id = id; }
}
