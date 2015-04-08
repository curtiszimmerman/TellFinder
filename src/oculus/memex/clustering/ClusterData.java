package oculus.memex.clustering;

import java.util.Date;
import java.util.HashMap;

public class ClusterData {
	public int adcount = 0;
	public HashMap<String,Integer> phonelist = new HashMap<String,Integer>();
	public HashMap<String,Integer> emaillist = new HashMap<String,Integer>();
	public HashMap<String,Integer> weblist = new HashMap<String,Integer>();
	public HashMap<String,Integer> namelist = new HashMap<String,Integer>();
	public HashMap<String,Integer> ethnicitylist = new HashMap<String,Integer>();
	public HashMap<String,Integer> locationlist = new HashMap<String,Integer>();
	public HashMap<String,Integer> sourcelist = new HashMap<String,Integer>();
	public HashMap<String,HashMap<String,Integer>> keywordlist = new HashMap<String,HashMap<String,Integer>>();
	public HashMap<Long,Integer> timeseries= new HashMap<Long,Integer>();
	public Date latestAd = new Date(0);
}
