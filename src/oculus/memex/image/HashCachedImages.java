package oculus.memex.image;

import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.util.HashSet;
import java.util.List;
import java.util.Vector;

import javax.imageio.ImageIO;

import oculus.memex.util.CsvParser;

public class HashCachedImages {
	private static final int POOL_SIZE = 50;

	private static int imagecount = 0;
	private static int poolsizesum = 0;
	private static long hashtimesum = 0;

	public static class OutputThread extends Thread {
		public Vector<String> outputQueue = new Vector<String>();
		public boolean stop = false;
		
		public void run() {
			while(!stop) {
				while (outputQueue.size()>0) {
					String output = outputQueue.remove(outputQueue.size()-1);
					System.out.println(output);
				}
				Thread.yield();
			}
			while (outputQueue.size()>0) {
				String output = outputQueue.remove(outputQueue.size()-1);
				System.out.println(output);
			}
		}
		public void terminate() {
			stop = true;
		}
		public void addOutput(String sha1, String histogramHash, int w, int h) {
			outputQueue.add(sha1 + "," + histogramHash + "," + w + "," + h);
		}
	}

	public static class HasherThread extends Thread {
		BufferedImage image;
		String sha1;
		OutputThread output;
		HasherPool pool;
		public HasherThread(String sha1, BufferedImage image, OutputThread output, HasherPool pool) {
			this.sha1 = sha1;
			this.image = image;
			this.output = output;
			this.pool = pool;
		}
		public void run() {
			long start = System.currentTimeMillis();
			if (image!=null) {
				try {
					String histogramHash = ImageHistogramHash.histogramHash(image);
					output.addOutput(sha1,histogramHash,image.getWidth(),image.getHeight());
				} catch (Exception e) {
					System.err.println("Failed to hash image: " + sha1);
					output.addOutput(sha1,"null",0,0);
				}
			} else {
				output.addOutput(sha1,"null",0,0);
			}
			pool.remove(this);
			hashtimesum += System.currentTimeMillis()-start;
		}
	}
	
	public static class HasherPool {
		Vector<HasherThread> pool = new Vector<HasherThread>();
		public void addThread(String sha1, BufferedImage image, OutputThread output) {
			while (pool.size()>=POOL_SIZE) {
				Thread.yield();
			}
			HasherThread hasher = new HasherThread(sha1, image, output, this);
			pool.add(hasher);
			if (imagecount==10000) {
				System.err.println("Average pool size: " + (poolsizesum/10000) + " hash time: " + (hashtimesum/10000));
				imagecount = 0;
				poolsizesum = 0;
				hashtimesum = 0;
			}
			imagecount++;
			poolsizesum+= pool.size();
			hasher.start();
		}
		public void remove(HasherThread hasher) {
			pool.remove(hasher);
		}
		public void nomore() {
			while (pool.size()>0) {
				Thread.yield();
			}
		}
	}
	
	public static BufferedImage getImage(String filename) {
		try {
			FileInputStream fis = new FileInputStream(filename);
			BufferedImage image = ImageIO.read(fis);
			fis.close();
			return image;
		} catch (Exception e) {
			System.err.println("Failed to read file: " + filename + " <" + e.getMessage() + ">");
		}
		return null;
	}

	public static void main(String[] args) {
		String infile = args[0];
		String cachedir = args[1];
		String outfile = args[2];
		long starttime = System.currentTimeMillis();
		int processCount = 0;
		HashSet<String> processedSha1 = new HashSet<String>();
		try {
			BufferedReader br = new BufferedReader(new FileReader(outfile));
			String line = null;
			while ((line = br.readLine()) != null) {
				List<String> strs = CsvParser.fsmParse(line);
				String sha1 = strs.get(0);
				processedSha1.add(sha1);
			}
			br.close();
			
			FileWriter writer = new FileWriter(outfile, true);
			
			br = new BufferedReader(new FileReader(infile));
			line = null;
			while ((line = br.readLine()) != null) {
				List<String> strs = CsvParser.fsmParse(line);
				String imageid = strs.get(0);
				processCount++;
				if ( processCount%10000==0) {
					long endtime = System.currentTimeMillis();
					System.err.println("Processed: " + processCount + " Last 10000: " + (endtime-starttime) + "ms");
					starttime = endtime;
				}
				String sha1 = strs.get(1);
				if (sha1==null || sha1.compareTo("null")==0 || processedSha1.contains(sha1)) continue;
				processedSha1.add(sha1);
				try {
					BufferedImage image = getImage(cachedir+"/"+sha1+".jpg");
					if (image!=null) {
						try {
							String histogramHash = ImageHistogramHash.histogramHash(image);
							writer.write(sha1 + "," + histogramHash + "," + image.getWidth()+ "," + image.getHeight() + "\n");
						} catch (Exception e) {
							System.err.println("Failed to hash image: " + sha1);
							writer.write(sha1 + ",null,0,0\n");
						}
					} else {
						writer.write(sha1 + ",null,0,0\n");
					}

				
				} catch (Exception e) {
					System.err.println("Image processing failed on: " + imageid + "," + sha1);
				}
			}
			writer.close();
			br.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
	
}
