<!doctype html>
<%@ page
	language="java"
	pageEncoding="utf-8"
	contentType="text/html; charset=utf-8"
	import="java.util.Enumeration"
	import="java.util.Map"
	import="java.util.HashMap"
	import="java.util.ArrayList"
%>

<html>
  <head>
    <meta http-equiv="content-type" content="text/html; charset=UTF-8">
    <META http-equiv="Cache-Control" Content="no-cache">
	<meta http-equiv="Expires" content="0">

	<title>Open Ads Test</title>

	<script src="scripts/jquery.js"></script>

  </head>
  <body class="standaloneBody">
    <div id="testContainer" style="top:0px;bottom:0px;left:0px;right:0px;background:white;font-size:small;overflow:hidden;position:absolute"></div>
	<script>
		var outtext = '';
		<% 
			Map<String, String[]> parameters = request.getParameterMap();
			for (Map.Entry<String,String[]> entry:parameters.entrySet()) {
				out.println("outtext += '" + entry.getKey() + ":';");
				for (String value:entry.getValue()) {
					out.println("outtext += '" + value + "<BR/>';");
				}
			}
		%>
		$('#testContainer').html(outtext);
    </script>
  </body>
</html>
