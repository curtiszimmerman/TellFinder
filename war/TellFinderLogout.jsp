<%@ page session="true" %>
<!doctype html>
<html>
  <head>
    <meta http-equiv="content-type" content="text/html; charset=UTF-8">
    <META http-equiv="Cache-Control" Content="no-cache">
	<meta http-equiv="Expires" content="0">

    <title>TellFinder Logout Page</title>

	<style>
		.standaloneToolstrip {
			height: 31px;
			margin-bottom:23px;
			padding-left:10px;
			padding-top:5px;
			background-repeat: repeat-x;
			background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAA8CAIAAADDpPyuAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAACxJREFUeNpi/P//PwMDA8vz58+BFBMDGOCjWBgZGUnioVJY5YgwbCRTAAEGAN9cBl7Tr+qqAAAAAElFTkSuQmCC);
			overflow: hidden;
			white-space:nowrap;
			font-family: Arial,Verdana,tahoma,serif;
			color: #454545;
			font-size: 18px;
			border: 1px solid #A7ABB4;
			background-color: #FFFFFF;
		}
		
		.standaloneBody {
			margin:0px;
			font-family: Arial,Verdana,tahoma,serif;
			font-size: 15px;
		}
	</style>

  </head>
  <body class="standaloneBody">
	<div class="standaloneToolstrip" >TellFinder Counter Human Trafficking Logout</div>
  	<hr>
  	User '<%=request.getRemoteUser()%>' has been logged out.
  	<% request.getSession().invalidate();
  		System.out.println("Logout: " + request.getRemoteUser());
		response.addCookie(new Cookie("JSESSIONID", "path=/openads/;expires=Thu, 01 Jan 1970 00:00:01 GMT"));
  	%>
  	<BR>
  	<a href="overview.html">Click to login</a>
  </body>
</html>
