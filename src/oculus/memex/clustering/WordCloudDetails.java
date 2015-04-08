package oculus.memex.clustering;


import java.util.ArrayList;
import java.util.HashMap;
import java.util.Set;
import java.util.regex.Pattern;

import oculus.memex.init.PropertyManager;

public class WordCloudDetails {

    private static class ColumnDescriptor {
        public String key;
        public boolean sanitize;
        public String delimiter;
        public ColumnDescriptor(String _key, boolean _sanitize, String _delimiter) {
            key = _key;
            sanitize = _sanitize;
            delimiter = _delimiter;
        }
        public ColumnDescriptor(String _key, boolean _sanitize) {
            key = _key;
            sanitize = _sanitize;
        }
    }

    private static Set<String> STOP_WORDS = PropertyManager.getInstance().getPropertySet("wordcloud.stopWords");

    private static Pattern[] STRIP_PATTERNS = {
        Pattern.compile("<(?:.|\n)*?>",Pattern.MULTILINE),      // Strip HTML
        Pattern.compile("&(?:[a-z\\d]+|#\\d+|#x[a-f\\d]+);")    // Strip character entities ('&nbsp', etc.)
    };
    private static Pattern[] REPLACE_PATTERNS = {
        Pattern.compile("ad number: \\d+"),                     // Replace "ad number: 532032"
        Pattern.compile("\\n"),                                 // Replace newlines
        Pattern.compile("[_\\W]"),                              // Replace all non-alphanumeric chars
        Pattern.compile("\\s{2,}")                              // ??
    };

    private static ColumnDescriptor[] WHOLE_WORD_COLUMNS = new ColumnDescriptor[] {
            new ColumnDescriptor("region",false),
            new ColumnDescriptor("name",false),
            new ColumnDescriptor("age",false),
            new ColumnDescriptor("bust",false),
            new ColumnDescriptor("incall",false),
            new ColumnDescriptor("city",true)               // Lots of junk in this column
    };

    private static ColumnDescriptor[] SPLITTABLE_WORD_CLOUD_COLUMNS = new ColumnDescriptor[] {
            new ColumnDescriptor("title",true," "),
            new ColumnDescriptor("text_field",true," "),
            new ColumnDescriptor("outcall",true,";"),
            new ColumnDescriptor("ethnicity",false,",")
    };

    private static String sanitize(String inStr) {
        String result = inStr.toLowerCase();

        for (Pattern p : STRIP_PATTERNS) {
            result = p.matcher(result).replaceAll("");
        }

        for (Pattern p : REPLACE_PATTERNS) {
            result = p.matcher(result).replaceAll(" ");
        }

        return result.trim();
    }




    /**
     * Computes word histograms for a list of ad details
     * @param adDetails
     * @return adId -> (word -> count)
     */
    public static HashMap<String,HashMap<String,Integer>> getWordCountsForAdIds(ArrayList<HashMap<String,String>> adDetails) {
        HashMap<String, HashMap<String,Integer>> result = new HashMap<String, HashMap<String, Integer>>();

        for (HashMap<String,String> details : adDetails) {

            HashMap<String,Integer> wordMap = new HashMap<String,Integer>();

            // Handle columns that are treated as whole strings
            for (ColumnDescriptor col : WHOLE_WORD_COLUMNS) {
                String colName = col.key;
                boolean doSanitize = col.sanitize;
                String columnValue = details.get(colName);

                if (columnValue != null) {

                    columnValue = columnValue.toLowerCase();

                    if (doSanitize) {
                        columnValue = sanitize(columnValue);
                    }

                    if (STOP_WORDS.contains(columnValue)) {
                        continue;
                    }

                    Integer count = wordMap.get(columnValue);
                    if (count != null) {
                        wordMap.put(columnValue, count + 1);
                    } else {
                        wordMap.put(columnValue, 1);
                    }
                }
            }

            // Handle columns that need to be split into words
            for (ColumnDescriptor col : SPLITTABLE_WORD_CLOUD_COLUMNS) {
                String colName = col.key;
                Boolean doSanitize = col.sanitize;
                String delim = col.delimiter;
                Boolean sanitizePostSplit = (delim != " ");

                String columnValue = details.get(colName);
                if (columnValue != null) {
                    if (doSanitize && !sanitizePostSplit) {
                        columnValue = sanitize(columnValue);
                    }

                    String []wordPieces = columnValue.split(delim);
                    for (String w : wordPieces) {
                        if (w.equals(" ") || w.equals("") || w.equals(null)) {
                            continue;
                        }
                        String wordPiece = w.trim().toLowerCase();
                        if (doSanitize && sanitizePostSplit) {
                            wordPiece = sanitize(wordPiece);
                        }

                        if (STOP_WORDS.contains(wordPiece)) {
                            continue;
                        }

                        Integer count = wordMap.get(wordPiece);
                        if (count != null) {
                            wordMap.put(wordPiece,count+1);
                        } else {
                            wordMap.put(wordPiece,1);
                        }
                    }
                }
            }

            String adId = details.get("id");
            result.put(adId,wordMap);
        }

        return result;
    }
}
