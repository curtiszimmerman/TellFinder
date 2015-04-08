package oculus.xdataht.model;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Distribution {
	private int size;
	private int clusters;
	
	public Distribution() { }
	public Distribution(int size, int clusters) {
		setSize(size);
		setClusters(clusters);
	}
	
	public void setSize(int size) { this.size = size; }
	public int getSize() { return size; }
	
	public void setClusters(int clusters) { this.clusters = clusters; }
	public int getClusters() { return clusters; } 
}
