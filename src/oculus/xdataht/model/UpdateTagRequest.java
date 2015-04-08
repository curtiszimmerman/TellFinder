package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class UpdateTagRequest {
	private ArrayList<String> adIds;
	private ArrayList<String> tags;
	private boolean add;
	
	public UpdateTagRequest() { }

	public UpdateTagRequest(ArrayList<String> adIds, ArrayList<String> tags,
			boolean add) {
		super();
		this.adIds = adIds;
		this.tags = tags;
		this.add = add;
	}

	public ArrayList<String> getAdIds() {
		return adIds;
	}

	public void setAdIds(ArrayList<String> adIds) {
		this.adIds = adIds;
	}

	public ArrayList<String> getTags() {
		return tags;
	}

	public void setTags(ArrayList<String> tags) {
		this.tags = tags;
	}

	public boolean getAdd() {
		return add;
	}

	public void setAdd(boolean add) {
		this.add = add;
	}
	
}
