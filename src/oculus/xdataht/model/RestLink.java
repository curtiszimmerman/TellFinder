package oculus.xdataht.model;

public class RestLink {
	private String id;
	private String sourceId;
	private String targetId;
	private double weight;
	private String type;
	
	public RestLink() { }

	public RestLink(String id, String sourceId, String targetId, double weight, String type) {
		super();
		this.id = id;
		this.sourceId = sourceId;
		this.targetId = targetId;
		this.weight = weight;
		this.setType(type);
	}
	
	public RestLink(String sourceId, String targetId, double weight, String type) {
		this.id = sourceId + "_" + targetId;
		this.sourceId = sourceId;
		this.targetId = targetId;
		this.weight = weight;
		this.setType(type);
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getSourceId() {
		return sourceId;
	}

	public void setSourceId(String sourceId) {
		this.sourceId = sourceId;
	}

	public String getTargetId() {
		return targetId;
	}

	public void setTargetId(String targetId) {
		this.targetId = targetId;
	}

	public double getWeight() {
		return weight;
	}

	public void setWeight(double weight) {
		this.weight = weight;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}
	
	
}
