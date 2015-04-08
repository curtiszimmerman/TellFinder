package oculus.memex.shiro;

import com.mysql.jdbc.jdbc2.optional.MysqlDataSource;

public class EnvMysqlDataSource extends MysqlDataSource {
	
	private static final long serialVersionUID = 1180035204072942804L;

	@Override
	public void setServerName(String serverName) {
		super.setServerName(System.getenv(serverName));
	}
	
	@Override
	public void setUser(String userID) {
		super.setUser(System.getenv(userID));
	}
	
	@Override
	public void setPassword(String pass) {
		super.setPassword(System.getenv(pass));
	}
	
	@Override
	public void setDatabaseName(String dbName) {
		super.setDatabaseName(System.getenv(dbName));
	}

}
