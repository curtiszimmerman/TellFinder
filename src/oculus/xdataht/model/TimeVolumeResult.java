package oculus.xdataht.model;

import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class TimeVolumeResult {
	long day;
	int count;
	
	public TimeVolumeResult() { }

	public TimeVolumeResult(long day, int count) {
		this.day = day;
		this.count = count;
	}

	public long getDay() {
		return day;
	}

	public void setDay(long day) {
		this.day = day;
	}

	public int getCount() {
		return count;
	}

	public void setCount(int count) {
		this.count = count;
	}

}
