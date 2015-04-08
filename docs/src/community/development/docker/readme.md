---
section: Community
subtitle: Developer Docs
chapter: Docker
permalink: community/development/docker/index.html
rootpath: ../../../
layout: submenu
---

Docker
======

[Docker](https://www.docker.com/) is an operating system-level virtualization tool that uses the Linux kernel to create multi-container applications that can run on any system. TellFinder supports an optional Docker deployment method, which is described below.

## <a name="prereqs"></a> Prerequisites ##

The TellFinder build and deployment processes with Docker depend on the following third-party tools. Ensure that each tool is installed and running from the command line. Note that because Docker does not yet support Windows and Mac operating systems, you will need to to create a virtual machine to use Docker on these systems.

- For Linux systems:
	- [Docker](http://www.docker.com)
	- [Apache Ant](http://ant.apache.org/)
- For Windows and Mac systems:
	- [Vagrant](https://www.vagrantup.com/)
	- [Oracle VM VirtualBox](https://www.virtualbox.org/)

## <a name="deploy-maps"></a> Deploying the Map Set ##

Copy the [maps](../data/#maps) file you received into the *deploy/* directory of the TellFinder source code.

## <a name="virtual-machine"></a> Creating a VM to Run Docker on Windows/Mac ##

Windows and Mac do not currently support Docker, which relies on a certain Linux kernel. To work around this, you can create a virtual machine (VM) that does support Docker:

1. To bring up the VM, run the following command in the project's *deploy/* directory. Note that the first time you run this command, you must wait while it downloads and prepares images:

	```
	vagrant up
	```

2. Log in to the VM:
	
	```
	vagrant ssh
	```

	Note that you may need to install an SSH client to perform this step. [Git](http://git-scm.com/) includes an SSH client that you can use on the command line. If you are using Git, make sure your PATH environment variable is correctly configured:

	```
	set PATH=%PATH%;C:\Program Files (x86)\Git\bin
	```

3. Once you are logged in to the VM, navigate to the TellFinder folder:

	```
	cd /tellfinder
	```
	
Alternatively, you can use the VirtualBox user interface, as Vagrant is just a scripting wrapper around standard virtualization software.

## <a name="docker-container"></a> Building the Docker Container ##

Once your VM is running, you can build the TellFinder WAR and the Docker container in which to deploy it.

1. Build the WAR:

	```
	ant -Dbuild.path=deploy
	```
	
2. Build the Docker container:

	```
	docker build -t="[docker_account]/[docker_repository]:[tagname]" .
	```
	
	Where:
	- `[tagname]` is a useful tag such as the current date (e.g., *20141215*)
	- `[docker_account]` is the name of your account or organization on Docker
	- `[docker_repository]` is the name of your Docker repository

Repeat these steps each time the WAR changes. Because interim stages are cached, `docker build` will run faster after the first time you execute it.

## <a name="tellfinder-container"></a> Running the TellFinder Container as a Daemon ##

To run TellFinder as a daemon, execute the following Docker command, replacing any variables in [brackets] with your [MySQL database](../data/#databases) connection details:
	
```
docker run -p 8080:8080 -d --name tellfinder \
	-e DATABASE_HOST=[dbhost] \
	-e DATABASE_PORT=3306 \
	-e DATABASE_USER=[dbuser] \
	-e DATABASE_PASSWORD=[dbpassword] \
	-e DATABASE_HT_SCHEMA=ist_db \
	-e DATABASE_OCULUS_SCHEMA=tellfinder_db \
	-e ELASTICSEARCH_URL=https://els.istresearch.com:9200/ist_db/ad/_search \
	[docker_account]/[docker_repository]:[tagname]
```

NOTE: Make sure that the MySQL database user has DBA access to the host that you specify.

## Using TellFinder ##

Once your Tomcat server has been initialized, you can use TellFinder by simply opening a web browser and navigating to `http://localhost:8080/tellfinder`.

## Managing Your Docker Container ##

To check the console of a running container:
	
```
docker logs tellfinder
```
	
To stop the running container:

```
docker stop tellfinder
```

Because the container is named, you must remove it from your local repository before starting a new one:

```
docker rm tellfinder
```

## <a name="mysql"></a> Editing the MySQL Connection ##

To get a shell inside the container:

```
docker run -it [docker_account]/[docker_repository]:[tagname] /bin/bash
```
	
Edit the **xdataht.properties** file in the *conf* directory, and then exit the container and commit the changes:

```
docker commit <container_id>  [docker_account]/[docker_repository]:[tagname]
```

### <a name="mysql-auth"></a> Enabling MySQL Authentication (Optional) ###

You can configure MySQL to handle TellFinder user authentication. Note that this configuration setup requires you to add `user` and `user_roles` tables to your `tellfinder_db` table; see [TellFinder Data](../data/#mysql-auth) for more information.

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