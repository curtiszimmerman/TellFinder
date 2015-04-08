
# Setting up the build environment
September 19, 2014

How to set up the OpenAds build environment.

## What additional files you need
memex_small_with_raw.sql.gz
memex_small_openads.zip
openads-maps-9-19-2014.zip

## What software you need
JDK 7
git
Apache Tomcat 7
Mysql
Apache Ant
Eclipse (optional)
NodeJS (optional)
npm (optional)
requireJS (optional)

## Import data into Mysql
Import `memex_small_with_raw.sql`. This should create the following tables in a schema `memex_ht`:

	ads
	ads_attributes
	sources
	
Import `memex_small_openads.sql`. This should create the following tables in a schema `memex_oculus`:

	ads_bad_phones
	ads_clusters
	ads_emails
	ads_keywords
	ads_locations
	ads_numbers
	ads_phones
	ads_price_phones
	ads_websites
	attributes
	attributes_details
	attributes_links
	attributes_location
	bad_phones
	case_contents
	cases
	clusters_attributes
	clusters_details
	clusters_links
	clusters_location
	keywords
	locations
	locationtime
	processing_progress
	states_provinces
	tags
	temporal
	world_cities
 
## MySql Setup
If you are using this default mysql setup, then you don't need to do anything:

	database_host = localhost
	database_port = 3306
	database_user = root
	database_password = admin
	database_name = xdataht
	
To change these, either edit `war\xdata-ht.properties` and rebuild the war, or copy the file into the `tomcat/conf`.

## Java Setup
Ensure JDK_HOME and JAVA_HOME environment variables are set and correct.

## Building the WAR into the Tomcat directory
Edit `build.properties` to point to your `<tomcat>/webapps` directory.

Alternatively, specify the destination for the WAR file at command-line:

	ant -Dbuild.path=<webapps_directory>
	
Build the default target of `build.xml` with Ant. This will put a new war file in `webapps` directory.

## Tomcat Setup
Create a file called `<tomcat>/bin/setenv.bat` (or `setenv.sh`) containing:

	set JAVA_OPTS="-Xmx6144m"
	
Open `<tomcat>\conf\tomcat-users.xml` and add the lines:

	<role rolename="ocweb"/>
	<user username="xxxx" password="yyyy" roles="ocweb"/>

`xxx` and `yyy` will be the username and password you use to log in later.

Unzip `openads-maps-9-19-2014.zip` to `<tomcat>/webapps/maps`.

## Starting Tomcat
Start tomcat by launching `tomcat/bin/startup.bat`

Open a browser (recommended: Google Chrome) to http://localhost:8080/openads/

## Optimizing Javascript Code (Optional)
In order run the optimizer on our Javascript code, we must install the requireJS command-line tools from npm.

1)  [Install NodeJS](https://nodejs.org/)

2)  [Install npm](https://www.npmjs.com/)

3)  Install requireJS:

    `npm install -g requirejs`

To create a production WAR file, run ant with the production target:

    `ant production`

This will combine all Javascript files into a single, obfuscated file for each app/page in Tellfinder.

