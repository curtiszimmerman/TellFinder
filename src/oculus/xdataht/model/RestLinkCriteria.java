package oculus.xdataht.model;

import java.util.ArrayList;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class RestLinkCriteria {
	private String name;
	private ArrayList<String> attributes;
	private Double weight;
	
	public RestLinkCriteria() { }

	public RestLinkCriteria(String name, ArrayList<String> attributes,
			Double weight) {
		super();
		this.name = name;
		this.attributes = attributes;
		this.weight = weight;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public ArrayList<String> getAttributes() {
		return attributes;
	}

	public void setAttributes(ArrayList<String> attributes) {
		this.attributes = attributes;
	}

	public Double getWeight() {
		return weight;
	}

	public void setWeight(Double weight) {
		this.weight = weight;
	}
}
