package oculus.xdataht.model;

import java.util.ArrayList;
import java.util.Iterator;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class StringList implements Iterable<String> {
	private ArrayList<String> list;
	
	public StringList() { }
	public StringList(ArrayList<String> list) {
		setList(list);
	}
	
	public void setList(ArrayList<String> list) { this.list = list; }
	public ArrayList<String> getList() { return list; }
	
	@Override
	public Iterator<String> iterator() {
		return list.iterator();
	}

}
