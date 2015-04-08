---
section: Community
subtitle: Developer Docs
chapter: Data
permalink: community/development/data/index.html
rootpath: ../../../
layout: submenu
---

TellFinder Data
===============

Before you begin installing TellFinder, retrieve the data described in the following sections. The TellFinder source code is freely available for download on [GitHub](https://github.com/). The databases and map set must be obtained from Uncharted.

## <a name="source-code"></a> Source Code ##

For access to the TellFinder source code repository on GitHub, contact Uncharted. We recommend that you watch the project to receive email notifications each time a new release becomes available.

## <a name="databases"></a> Databases ##

TellFinder connects to the following MySQL databases via [JDBC](http://docs.oracle.com/javase/tutorial/jdbc/):
  
- **ist_db**: Contains ads with some feature extraction. Produced by [IST Research](http://istresearch.com/).
- **tellfinder_db**: Contains cleaned and normalized features.

Because of their size, the TellFinder databases are not included with the source code. To receive sample versions of the databases, please [contact](../../../contact/) Uncharted. A set of SQL scripts will be provided for you to execute and build the databases.

### Restoring the Databases ###

Run each of the SQL scripts provided to you by Uncharted. This will create the **ist\_db** and **tellfinder\_db** schemas in your database. Note that due to the size of these databases, the operations may cause significant wait times.

### <a name="mysql-auth"></a> Using MySQL for Tomcat Authorization (Optional) ###

To use MySQL to store TellFinder user authentication data:

1. Execute the **create\_user\_tables.sql** script in the *deploy/* directory of the source code. This will add `users` and `user_roles` tables to your `tellfinder_db` database.
2. Hash the passwords of your users using sha-256. To hash a password using Tomcat's digest utility:

	```
	$TOMCAT_HOME/bin/digest -a sha-256 mypassword
	```
	
	This will output the plain-text password followed by the hashed password, which you should capture for each user:

	```
	mypassword:<hashed_password>
	```

3. Populate the `users` table in **tellfinder_db** with your users and their hashed passwords:

	```sql
	insert into users (user_name, user_pass) values ('roxy',
	'<hashed_password>');
	```
	
4. Assign the role `ocweb` to users in to the `user_roles` table:

	```sql
	insert into user_roles (user_name, role_name) values ('roxy', 'ocweb');
	```

In addition to passing the users and user roles to your MySQL database, you will also need to configure your Tomcat server. See the [Manual Installation](../install/#mysql-auth) or [Docker](../docker/#mysql-auth) topics for more information.

## <a name="maps"></a> Map Set ##

As with the databases, the TellFinder map set is not included in the source code due to its size. To receive the map files, please [contact](../../../contact/) Uncharted.