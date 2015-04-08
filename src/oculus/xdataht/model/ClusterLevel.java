package oculus.xdataht.model;

public class ClusterLevel {
	private String id;
	private int level;
	
	public ClusterLevel() { }

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public int getLevel() {
		return level;
	}

	public void setLevel(int level) {
		this.level = level;
	}

	public ClusterLevel(String id, int level) {
		super();
		this.id = id;
		this.level = level;
	} 
}
