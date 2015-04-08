package oculus.xdataht.model;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.json.JSONException;
import org.json.JSONObject;

public class AdvancedSearchRequest {
    public List<AdvancedSearchField> fields = new ArrayList<AdvancedSearchField>();
    
    public AdvancedSearchRequest() {}
    
    public AdvancedSearchRequest(JSONObject request) throws JSONException {
        Iterator keys = request.keys();
        while (keys.hasNext()) {
            String key = (String)(keys.next());
            String value = request.getString(key);
            fields.add(new AdvancedSearchField(key, value));
        }
    }
}
