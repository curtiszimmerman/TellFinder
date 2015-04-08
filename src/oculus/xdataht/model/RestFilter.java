package oculus.xdataht.model;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class RestFilter {
	private String filterAttribute;
	private String comparator;
	private String value;
	
	public RestFilter() { }

	public RestFilter(String filterAttribute, String comparator, String value) {
		super();
		this.filterAttribute = filterAttribute;
		this.comparator = comparator;
		this.value = value;
	}

	public String getFilterAttribute() {
		return filterAttribute;
	}

	public void setFilterAttribute(String filterAttribute) {
		this.filterAttribute = filterAttribute;
	}

	public String getComparator() {
		return comparator;
	}

	public void setComparator(String comparator) {
		this.comparator = comparator;
	}

	public String getValue() {
		return value;
	}

	public void setValue(String value) {
		this.value = value;
	} 	
}
