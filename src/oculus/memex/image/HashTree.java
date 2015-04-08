package oculus.memex.image;

import java.util.ArrayList;

public class HashTree {
	private static final int COMPARE_THRESHOLD = 10;

	private int size = 0;
	private double total_insert_sizes = 0;
	private double total_compare_sizes = 0;
	
	public class TreeNode {
		int depth;
		TreeNode[] children = new TreeNode[4];
		ArrayList<byte[]> hashes = null;
		public TreeNode(int depth) {
			this.depth = depth;
		}
		public byte[] addHash(byte[] hash, int cumulativeDifference) {
			byte[] result = null;
			if (cumulativeDifference>=COMPARE_THRESHOLD) return null;
			if (depth==64) {
				// Check for a similar hash
				if (hashes!=null) {
					for (byte[] comphash:hashes) {
						total_compare_sizes++;
						if (compareHashes(hash,comphash)) {
							result = comphash;
							break;
						}
					}
				}
				
				// Insert this hash
				if (cumulativeDifference==0) {
					if (hashes==null) hashes = new ArrayList<byte[]>();
					total_insert_sizes += hashes.size();
					size++;
					if (size%100000==0) {
						System.err.println("HashTree size: " + size + " average bin: " + (total_insert_sizes/size) + " average compare: " + (total_compare_sizes/size));
						total_insert_sizes = 0;
						total_compare_sizes = 0;
					}
					hashes.add(hash);
				}
			} else {
				byte curByte = hash[depth];
				if (curByte<0x40) {
					if (children[0]==null && cumulativeDifference==0) children[0] = new TreeNode(depth+1);
					if (children[0]!=null) result = children[0].addHash(hash, cumulativeDifference);
					if (result!=null) return result;
					if ((curByte>0x35) && (children[1]!=null)) {
						result = children[1].addHash(hash, 0x40-curByte);
						if (result!=null) return result;
					}
				} else if (curByte<0x80) {
					if (children[1]==null && cumulativeDifference==0) children[1] = new TreeNode(depth+1);
					if (children[1]!=null) result = children[1].addHash(hash, cumulativeDifference);
					if (result!=null) return result;
					if ((curByte<0x4A) && (children[0]!=null)) {
						result = children[0].addHash(hash, curByte-0x40);
						if (result!=null) return result;
					}
					if ((curByte>0x75) && (children[2]!=null)) {
						result = children[2].addHash(hash, 0x80-curByte);
						if (result!=null) return result;
					}
				} else if (curByte<0xC0) {
					if (children[2]==null && cumulativeDifference==0) children[2] = new TreeNode(depth+1);
					if (children[2]!=null) result = children[2].addHash(hash, cumulativeDifference);
					if (result!=null) return result;
					if ((curByte<0x8A) && (children[1]!=null)) {
						result = children[1].addHash(hash, curByte-0x80);
						if (result!=null) return result;
					}
					if ((curByte>0xB5) && (children[3]!=null)) {
						result = children[3].addHash(hash, 0xC0-curByte);
						if (result!=null) return result;
					}
				} else {
					if (children[3]==null && cumulativeDifference==0) children[2] = new TreeNode(depth+1);
					if (children[3]!=null) result = children[3].addHash(hash, cumulativeDifference);
					if (result!=null) return result;
					if ((curByte<0xCA) && (children[2]!=null)) {
						result = children[2].addHash(hash, curByte-0xC0);
						if (result!=null) return result;
					}
				}
			}
			
			return result;
		}
	}

	private static boolean compareHashes(byte[] cbytes, byte[] bytes) {
		if (cbytes==null || bytes==null) return false;
		if (cbytes.length!=bytes.length) return false;
		int dif = 0;
		for (int i=0; i<cbytes.length; i++) {
			dif += Math.abs(cbytes[i]-bytes[i]);
			if (dif>=COMPARE_THRESHOLD) return false;
		}
		return dif<COMPARE_THRESHOLD;
	}

	TreeNode root = new TreeNode(0);
	
	public byte[] addHash(byte[] hash) {
		return root.addHash(hash, 0);
	}
	
}
