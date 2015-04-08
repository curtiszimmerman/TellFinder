package oculus.memex.image;

import java.io.BufferedReader;
import java.io.FileReader;
import java.util.List;

import oculus.memex.util.CsvParser;

public class BinCSVHistograms {
	
	public static void main(String[] args) {
		String infile = args[0];
		long starttime = System.currentTimeMillis();
		try {
			BufferedReader br = new BufferedReader(new FileReader(infile));
			String line = null;
			int processCount = 1;
			ImageHistogramHash.initBins();
			while ((line = br.readLine()) != null) {
				List<String> strs = CsvParser.fsmParse(line);
				String sha1 = strs.get(0);
				String histogram = strs.get(1);
				String width = strs.get(2);
				String height = strs.get(3);
				int bin = ImageHistogramHash.readHistogramIntoBin(processCount++, sha1, histogram);

				System.out.println(sha1 + "," + histogram + "," + width + "," + height + "," + bin);
				if (processCount%10000==0) {
					long endtime = System.currentTimeMillis();
					System.err.println("Processed: " + processCount + " Last 10000: " + (endtime-starttime) + "ms");
					starttime = endtime;
				}
			}
			br.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
}
