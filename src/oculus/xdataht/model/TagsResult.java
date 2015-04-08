package oculus.xdataht.model;

import java.util.HashMap;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class TagsResult {
	private HashMap<String, StringList> adIdToTags;
	
	public TagsResult() { }

	public TagsResult(HashMap<String, StringList> adIdToTags) {
		super();
		this.adIdToTags = adIdToTags;
	}

	public HashMap<String, StringList> getAdIdToTags() {
		return adIdToTags;
	}

	public void setAdIdToTags(HashMap<String, StringList> adIdToTags) {
		this.adIdToTags = adIdToTags;
	}	
}
