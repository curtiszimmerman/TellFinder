---
section: Community
subtitle: Developer Docs
chapter: Manual Installation
permalink: community/development/install/index.html
rootpath: ../../../
layout: submenu
---

Manual Installation
============

The following instructions describe how to manually build and deploy TellFinder from the project source code. Before you begin, ensure that you have obtained all of the necessary [data](../data).

## <a name="prereqs"></a> Prerequisites ##

The TellFinder build and deployment processes depend on the following third-party tools. Ensure that each tool is installed and properly configured on your machine:

- [Java Development Kit (JDK)](http://www.oracle.com/technetwork/java/) version 1.7
- [MySQL](http://www.mysql.com/)
- [Apache Ant](http://ant.apache.org/)
- [Apache Tomcat](http://tomcat.apache.org/) version 1.7

## <a name="databases"></a> Configuring MySQL Connection Details ##

The first step in building TellFinder is to provide the connection details for the [databases](../data/#databases) that contain the ad data. TellFinder is configured to look for your databases using the default MySQL setup:

```
database_host = localhost
database_port = 3306
database_user = root
database_password = <password>
database_name = xdataht
```

If your configuration differs, simply edit any of the affected parameters in the **xdataht.properties** file in the project's *war\* directory:

```
database_type = mysql
database_host = localhost
database_port = 3306
database_user = root
database_password = <password>
database_ht_schema = ist_db
database_oculus_schema = tellfinder_db
```

## <a name="build"></a> Building the Project ##

Once you have configured the TellFinder database connection, you can build the project as a WAR file that can be deployed to your server:

1. Ensure your JDK_HOME and JAVA_HOME environment variables are set to the correct path (e.g., *C:\Program Files\Java\jdk1.7.0_55*).
2. Edit the **build.properties** file in the root project folder to specify the destination for the WAR file, typically the *webapps/* folder of your Tomcat installation.
3. Use Apache Ant to build the default target **build.xml** file in the root project folder. Note that you can specify the WAR destination at build time using the following command:

```bash
ant -Dbuild.path=<your_webapps_directory>
```

## <a name="deploy"></a> Deploying TellFinder ##

Deploying the TellFinder web application consists of the following Tomcat configuration procedures:

- Allocating Memory
- Configuring Tomcat Users
    - Enabling MySQL Authentication (Optional)
- Deploying the Map Set
- Starting the Server

### Allocating Memory ###

Create an environment variable to allocate 6144m memory (or at least 2048m) to the TellFinder web application. You may find it useful to save this parameter to a **setenv.bat** file in your Tomcat server's *bin* directory. 

```bash
set JAVA_OPTS="-Xmx6144m"
```

### Configuring Tomcat Users ###

Edit the **tomcat_users.xml** file in your Tomcat server's *conf* directory to list unique usernames and passwords for each user who will require access to the application:

```xml
<role rolename="ocweb"/>
<user username="jsmith" password="ocweb" roles="ocweb"/>
```

#### <a name="mysql-auth"></a> Enabling MySQL Authentication (Optional) ####

Alternatively, you can configure MySQL to handle TellFinder user authentication. Note that this configuration setup requires you to add `user` and `user_roles` tables to your `tellfinder_db` table; see [TellFinder Data](../data/#mysql-auth) for more information.

Once you have configured your MySQL database:

1. Ensure the [MySQL driver](http://dev.mysql.com/downloads/connector/j/) (*mysql-connector-java-5.X.XX.jar*) is in the *lib/* directory of your Tomcat installation.
2. Change the security realm by editing the **server.xml** file in your Tomcat server's *conf/* directory. Find:

	```xml
	<Realm className="org.apache.catalina.realm.UserDatabaseRealm" 
		resourceName="UserDatabase"/>
	```
			
	And replace it with:

	```xml
	<Realm className="org.apache.catalina.realm.JDBCRealm"
		driverName="com.mysql.jdbc.Driver"
		connectionURL="${user.jdbc.url}"
		userTable="users" userNameCol="user_name" userCredCol="user_pass"
		userRoleTable="user_roles" roleNameCol="role_name"/>
	```
	
3. Run the Tomcat server with an additional define:

	```bash
	-Duser.jdbc.url="jdbc:mysql://localhost:3306/tellfinder_db?user=dbuser&password=dbpass"
	```
	
4. Alternatively, set the environment variable `JAVA_OPTS`, or edit your **setenv** script:

	```bash
	set JAVA_OPTS=-Xmx6144m -Duser.jdbc.url="jdbc:mysql://localhost:3306/tellfinder_db?user=dbuser&password=dbpass"
	```

### Map Deployment ###

Unzip the contents of your [maps](../data/#maps) file to your Tomcat server's *webapps* directory.

### Starting the Server ###

Start your Tomcat server using the **startup** script file in the *bin* directory.

## Using TellFinder ##

Once your Tomcat server has been initialized, you can use TellFinder by simply opening a web browser and navigating to `http://localhost:8080/tellfinder`.