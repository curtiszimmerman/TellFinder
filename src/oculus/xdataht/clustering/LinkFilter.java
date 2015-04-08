/**
 * Copyright (c) 2013-2015 Uncharted Software Inc.
 * http://uncharted.software/
 *
 * Released under the MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package oculus.xdataht.clustering;

import java.util.Set;

import javax.xml.bind.annotation.XmlRootElement;

import oculus.xdataht.data.DataRow;
import oculus.xdataht.data.DataTable;
import oculus.xdataht.model.RestFilter;

@XmlRootElement
public class LinkFilter {
	
	public enum Condition {
		LT("less than"),
		LTE("less than or equal to"),
		GT("greater than"),
		GTE("greater than or equal to"),
		EQ("equals"),
		NEQ("not equals"),
		CONTAINS("contains");
		
		private String conditionString;
		Condition(String s) {
			conditionString = s;
		}
		public String getConditionString() { return conditionString; } 
	}
	
	public String filterAttribute;
	public Condition condition;
	public String value;
	public double numValue;
	
	public LinkFilter(String attribute, Condition condition, String value) {
		this.filterAttribute = attribute;
		this.condition = condition;
		this.value = value;
		if (attribute.equals("Cluster Size")) {
			numValue = Double.parseDouble(value);
		}
	}
	
	public LinkFilter(RestFilter rf) {
		this.filterAttribute = rf.getFilterAttribute();
		String condition = rf.getComparator();
		for (Condition c : Condition.values()) {
			if (condition.equals(c.getConditionString())) {
				this.condition = c;
				break;
			}
		}
		this.value = rf.getValue();
		if (this.filterAttribute.equals("Cluster Size")) {
			numValue = Double.parseDouble(value);
		}
	}
	
	public static boolean testNumber(double a, double b, Condition c) {
		switch (c) {
		case LT:
			return a < b;
		case LTE:
			return a <= b;
		case GT:
			return a > b;
		case GTE:
			return a >= b;
		case EQ:
			return a == b;
		case NEQ:
			return a != b;
		default:
				return false;
		}
	}
	
	public static boolean testString(String a, String b, Condition c) {
		String aStr = a != null ? a : "";
		String bStr = b != null ? b : "";
		
		switch(c) {
		case LT:
			return aStr.toLowerCase().compareTo(bStr.toLowerCase()) < 0;
		case LTE:
			return aStr.toLowerCase().compareTo(bStr.toLowerCase()) <= 0;
		case GT:
			return aStr.toLowerCase().compareTo(bStr.toLowerCase()) > 0;
		case GTE:
			return aStr.toLowerCase().compareTo(bStr.toLowerCase()) >= 0;
		case EQ:
			return aStr.toLowerCase().equals(bStr.toLowerCase());
		case NEQ:
			return !aStr.toLowerCase().equals(bStr.toLowerCase());
		case CONTAINS:
			return aStr.toLowerCase().contains(bStr.toLowerCase());
		default:
				return false;
		}
	}
	
	public boolean testCluster(DataTable table, Set<String> memberIds, String datasetName) throws NumberFormatException {
		if (filterAttribute.equals("Cluster Size")) {
			int size = memberIds.size();
			return testNumber(size, Double.parseDouble(value), condition);
		} else {
			if (table != null) {
				boolean bPasses = false;
				for (String id : memberIds ) {
					DataRow originalRow = table.getRowById(id);
					if (originalRow != null) {
						String testValue = originalRow.get(filterAttribute);
						if (value.startsWith("NULL")) value = "NULL";
						bPasses |= testString(testValue, value, condition);
						if (bPasses) {
							return true;
						}
					}
				}
			}
		}
		return false;
	}

	public String getWhereClause() {
		switch(condition) {
		case LT:
			return filterAttribute + "<'" + value + "'";
		case LTE:
			return filterAttribute + "<='" + value + "'";
		case GT:
			return filterAttribute + ">'" + value + "'";
		case GTE:
			return filterAttribute + ">='" + value + "'";
		case EQ:
			return filterAttribute + "='" + value + "'";
		case NEQ:
			return filterAttribute + "!='" + value + "'";
		case CONTAINS:
			return filterAttribute + " like '%" + value + "%'";
		default:
			return "true";
		}
	}
}
