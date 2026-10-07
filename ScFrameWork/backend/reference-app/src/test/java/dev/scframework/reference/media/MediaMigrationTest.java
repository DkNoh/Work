package dev.scframework.reference.media;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MediaMigrationTest {
    @TempDir Path temporary;
    @Test void freshV4HasRealForeignKeysAndNormalizedSingleBoxConstraints()throws Exception {
        String url=url("fresh");assertThat(flyway(url,"4").migrate().migrationsExecuted).isEqualTo(4);
        try(Connection connection=DriverManager.getConnection(url,"sa","")) {
            seedOld(connection);seedMedia(connection);
            connection.createStatement().executeUpdate("UPDATE requirement_entry SET screen_version_id=301 WHERE id=100");
            connection.createStatement().executeUpdate("INSERT INTO requirement_annotation(requirement_id,screen_version_id,number,x,y,width,height) VALUES(100,301,1,.1,.2,.3,.4)");
            for(String sql:List.of("UPDATE requirement_annotation SET width=0","UPDATE requirement_annotation SET x=.9,width=.3","UPDATE requirement_annotation SET number=0","UPDATE requirement_annotation SET screen_version_id=999","INSERT INTO requirement_annotation(requirement_id,screen_version_id,number,x,y,width,height) VALUES(100,301,2,0,0,.1,.1)","UPDATE screen_version SET archived=2","UPDATE requirement_entry SET screen_version_id=999"))
                assertThatThrownBy(()->connection.createStatement().executeUpdate(sql)).isInstanceOf(SQLException.class);
            assertThat(queryLong(connection,"SELECT COUNT(*) FROM requirement_annotation")).isEqualTo(1);
        }
        assertThat(flyway(url,"4").validateWithResult().validationSuccessful).isTrue();
    }
    @Test void realV1ThroughV3UpgradePreservesChecksumsRowsAndUtcThenAllowsImageLinkage()throws Exception {
        String url=url("upgrade");assertThat(flyway(url,"3").migrate().migrationsExecuted).isEqualTo(3);Map<String,Integer> before;
        try(Connection connection=DriverManager.getConnection(url,"sa","")) {seedOld(connection);before=checksums(connection);assertThatThrownBy(()->connection.createStatement().executeUpdate("UPDATE requirement_entry SET screen_version_id=301 WHERE id=100")).isInstanceOf(SQLException.class);}
        assertThat(flyway(url,"4").migrate().migrationsExecuted).isEqualTo(1);
        try(Connection connection=DriverManager.getConnection(url,"sa","")) {
            assertThat(checksums(connection)).containsAllEntriesOf(before);seedMedia(connection);
            connection.createStatement().executeUpdate("UPDATE requirement_entry SET screen_version_id=301 WHERE id=100");
            try(ResultSet row=connection.createStatement().executeQuery("SELECT title,revision,screen_version_id,created_at FROM requirement_entry WHERE id=100")) {
                assertThat(row.next()).isTrue();assertThat(row.getString(1)).isEqualTo("V3 retained requirement");assertThat(row.getInt(2)).isEqualTo(7);assertThat(row.getLong(3)).isEqualTo(301);
                assertThat(row.getObject(4,java.time.OffsetDateTime.class).toInstant()).isEqualTo(java.time.Instant.parse("2026-10-06T12:34:56.123456Z"));
            }
        }
        assertThat(flyway(url,"4").migrate().migrationsExecuted).isZero();assertThat(flyway(url,"4").validateWithResult().validationSuccessful).isTrue();
    }
    private String url(String name){return "jdbc:h2:file:"+temporary.resolve(name).toAbsolutePath()+";DB_CLOSE_ON_EXIT=FALSE";}
    private Flyway flyway(String url,String target){return Flyway.configure().dataSource(url,"sa","").locations("classpath:db/migration").target(target).load();}
    private void seedOld(Connection connection)throws SQLException {
        try(Statement statement=connection.createStatement()) {
            statement.executeUpdate("INSERT INTO reference_user(id,username,display_name,password_hash,role,created_at) VALUES(1,'synthetic-sql-user','Synthetic','non-auth-fixture','REQUESTER',CURRENT_TIMESTAMP)");
            statement.executeUpdate("INSERT INTO menu_entry(id,name,sort_order,active) VALUES(10,'Media menu',0,1)");
            statement.executeUpdate("INSERT INTO requirement_entry(id,menu_id,title,desired,reason,reference_text,similar,follow_parts,status,revision,author_id,created_at,updated_at) VALUES(100,10,'V3 retained requirement','content','reason','',0,'','DRAFT',7,1,TIMESTAMP WITH TIME ZONE '2026-10-06 12:34:56.123456+00',TIMESTAMP WITH TIME ZONE '2026-10-06 12:34:56.123456+00')");
        }
    }
    private void seedMedia(Connection connection)throws SQLException {
        try(Statement statement=connection.createStatement()) {
            statement.executeUpdate("INSERT INTO stored_file(id,storage_key,original_name,mime,size,created_by,created_at) VALUES(200,'00000000-0000-0000-0000-000000000001','original.png','image/png',1,1,CURRENT_TIMESTAMP)");
            statement.executeUpdate("INSERT INTO screen_entry(id,menu_id,name) VALUES(300,10,'Original screen')");
            statement.executeUpdate("INSERT INTO screen_version(id,screen_id,version,file_id,width,height,created_by,created_at) VALUES(301,300,1,200,4,3,1,CURRENT_TIMESTAMP)");
        }
    }
    private Map<String,Integer> checksums(Connection connection)throws SQLException {
        Map<String,Integer> values=new HashMap<>();try(ResultSet rows=connection.createStatement().executeQuery("SELECT \"version\",\"checksum\" FROM \"flyway_schema_history\" WHERE \"version\" IN('1','2','3')")){while(rows.next())values.put(rows.getString(1),rows.getInt(2));}assertThat(values).hasSize(3);return values;
    }
    private long queryLong(Connection connection,String sql)throws SQLException{try(ResultSet row=connection.createStatement().executeQuery(sql)){assertThat(row.next()).isTrue();return row.getLong(1);}}
}
