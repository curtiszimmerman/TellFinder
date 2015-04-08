package oculus.memex.image;

import oculus.memex.util.StringUtil;


public class HashBinaryTree {
	private static final int COMPARE_THRESHOLD = 10;

	private static byte[] getDifArray(int idx, byte dif) {
		byte[] result = new byte[64];
		for (int i=0; i<64; i++) {
			result[i] = 0;
		}
		result[idx] = dif;
		return result;
	}
	private static int sumDifArray(byte[] difArray) {
		int result = 0;
		for (int i=0; i<64; i++) {
			result+=difArray[i];
		}
		return result;
	}
	private static byte[] updateDifArray(byte[] difArray, int idx, byte val) {
		byte[] result = new byte[64];
		for (int i=0; i<64; i++) {
			result[i] = difArray[i];
		}
		byte curVal = result[idx];
		if (val>curVal) result[idx] = val;
		return result;
	}
	
	public class TreeNode {
		int depth;
		TreeNode left = null;
		TreeNode right = null;
		byte[] hash = null;

		public TreeNode(byte[] hash, int depth, TreeNode left, TreeNode right) {
			this.hash = hash;
			this.depth = depth;
			this.left = left;
			this.right = right;
		}

		public byte[] findHash(byte[] toInsert, byte[] cumulativeDifference) {
			byte[] result = null;
			if (sumDifArray(cumulativeDifference)>=COMPARE_THRESHOLD) return null;

			// Compare to the current node, find the total difference
			int dif = 0;
			for (int i=0; i<hash.length; i++) {
				int curdif = Math.abs(toInsert[i]-this.hash[i]);
				dif += curdif;
			}

			if (dif<COMPARE_THRESHOLD) return this.hash;

			// Choose where to continue searching
			int compareIdx = this.depth;
			if (compareIdx==-1) return null;

			byte nodeByte = this.hash[this.depth];
			byte insertByte = toInsert[this.depth];
			byte curdif = (byte)Math.abs(insertByte-nodeByte);
			if (nodeByte>insertByte) {
				if (this.left!=null) {
					result = this.left.findHash(toInsert, cumulativeDifference);
					if (result!=null) return result;
				}
				if (this.right!=null) {
					result = this.right.findHash(toInsert, updateDifArray(cumulativeDifference, this.depth, curdif));
					if (result!=null) return result;
				}
			} else {
				if (this.right!=null) {
					result = this.right.findHash(toInsert, cumulativeDifference);
					if (result!=null) return result;
				}
				if (this.left!=null) {
					result = this.left.findHash(toInsert, updateDifArray(cumulativeDifference, this.depth, curdif));
					if (result!=null) return result;
				}
			}

			return result;
		}
		
		public byte[] addHash(byte[] toInsert) {
			byte[] result = null;

			// Compare to the current node, find the total difference and index of largest difference
			int dif = 0;
			int maxdif = 0;
			int maxdifidx = 0;
			for (int i=0; i<hash.length; i++) {
				int curdif = Math.abs(toInsert[i]-this.hash[i]);
				dif += curdif;
				if (curdif>maxdif) {
					maxdif = curdif;
					maxdifidx = i;
				}
			}

			if (dif<COMPARE_THRESHOLD) {
				// This hash is similar
				result = this.hash;
			}

			// Choose where to insert or continue searching
			int compareIdx = this.depth;
			if (compareIdx==-1) {
				compareIdx = maxdifidx;
				this.depth = compareIdx;
			}

			byte nodeByte = this.hash[this.depth];
			byte insertByte = toInsert[this.depth];
			byte curdif = (byte)Math.abs(insertByte-nodeByte);
			if (nodeByte>insertByte) {
				if (this.left==null) {
					this.left = new TreeNode(toInsert, -1, null, null);
				} else {
					byte[] leftresult = this.left.addHash(toInsert);
					if (result==null) result = leftresult;
					if (result!=null) return result;
				}
				if (result==null && this.right!=null) {
					result = this.right.findHash(toInsert, getDifArray(this.depth, curdif));
					if (result!=null) return result;
				}
			} else {
				if (this.right==null) {
					this.right = new TreeNode(toInsert, -1, null, null);
				} else {
					byte[] rightresult = this.right.addHash(toInsert);
					if (result==null) result = rightresult;
					if (result!=null) return result;
				}
				if (result==null && this.left!=null) {
					result = this.left.findHash(toInsert, getDifArray(this.depth, curdif));
					if (result!=null) return result;
				}
			}

			return result;
		}
	}


	TreeNode root = null;
	
	public byte[] addHash(byte[] hash) {
		if (hash==null || hash.length!=64) return null;
		if (root==null) {
			root = new TreeNode(hash, -1, null, null);
			return null;
		}
		return root.addHash(hash);
	}
	
	public static void main(String[] args) {
		String[] strs = { "3500000000000000000000000000000000000000000500000000000000000000030000000000000000000500000000000E010000000000000000000000000B9C", //40
				"130000000000000000000000000000000500000000030000000000000000000004000000000600000000030000000000000000000003000000000700000000C6", //363
				"3500000000000000000000000000000000000000000500000000000000000000030000000000000000000500000000000E010000000000000000000000000A9C", //40
				"340000000000000000000000000000003F0100000C3001000000000000000000010000000F100100000714010000000000000000010000000000010000000004", //361
				"140000000000000000000000000000000500000000030000000000000000000004000000010600000000030000000000000000000002000000000700000000C6", //363
				"33000000000000000000000000000000410100000C3101000000000000000000010000000E100100000714010000000000000000010000000000010000000004", //361
				"3500000000000000000000000000000000000000000500000000000000000000020000000000000000000500000000000E000000000000000000000000000A9C" //40
		};
		HashBinaryTree tree = new HashBinaryTree();
		for (int i=0; i<strs.length; i++) {
			byte[] b = StringUtil.hexToBytes(strs[i]);
			System.out.println(i + ":" + tree.addHash(b));
		}
		
	}
	
	
}
