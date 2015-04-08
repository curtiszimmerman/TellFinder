package oculus.memex.clustering;

public class AttributeValue {
	public String attribute;
	public String value;
	public AttributeValue(String attribute, String value) {
		this.attribute = attribute;
		this.value = value;
	}
	public int hashCode() {
		return attribute.hashCode()+value.hashCode();
	}
	public boolean equals(Object obj) {
		return ((AttributeValue)obj).attribute.equals(attribute) && ((AttributeValue)obj).value.equals(value);
	}

}
