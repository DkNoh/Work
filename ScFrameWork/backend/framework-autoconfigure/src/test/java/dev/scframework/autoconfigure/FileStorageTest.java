package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.*;
import dev.scframework.autoconfigure.storage.*;
import dev.scframework.core.storage.*;
import java.io.*;
import java.nio.file.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;

class FileStorageTest {
    @TempDir Path temporary;
    @Test void opaqueRoundTripIsLazyAndCallerStreamRemainsOwnedByCaller() throws Exception {
        Path root=temporary.resolve("uploads");var storage=new LocalFileStorage(root,10);
        assertThat(Files.exists(root)).isFalse();
        class Source extends ByteArrayInputStream { boolean closed;Source(){super(new byte[]{1,2,3});}@Override public void close(){closed=true;} }
        var source=new Source();var blob=storage.write(source,10);
        assertThat(source.closed).isFalse();assertThat(blob.key()).matches("[0-9a-f-]{36}");assertThat(blob.size()).isEqualTo(3);
        try(var input=storage.open(blob.key())) { assertThat(input.readAllBytes()).isEqualTo(new byte[]{1,2,3}); }
        assertThat(storage.exists(blob.key())).isTrue();storage.delete(blob.key());storage.delete(blob.key());assertThat(storage.exists(blob.key())).isFalse();
    }
    @Test void bothConsumerLimitAndGlobalLimitRemovePartialWrites() throws Exception {
        Path root=temporary.resolve("limited");var storage=new LocalFileStorage(root,3);
        assertThatThrownBy(()->storage.write(new ByteArrayInputStream(new byte[4]),100)).isInstanceOf(FileSizeLimitException.class);
        assertThatThrownBy(()->storage.write(new ByteArrayInputStream(new byte[3]),2)).isInstanceOf(FileSizeLimitException.class);
        try(var files=Files.list(root)){assertThat(files.count()).isZero();}
        var blob=storage.write(new ByteArrayInputStream(new byte[3]),3);assertThat(blob.size()).isEqualTo(3);
    }
    @Test void interruptedInputDoesNotLeavePartialFile() throws Exception {
        Path root=temporary.resolve("interrupted");var storage=new LocalFileStorage(root,100);
        InputStream failure=new InputStream(){int count;@Override public int read()throws IOException{if(count++<2)return 1;throw new IOException("synthetic-input-failure");}};
        assertThatThrownBy(()->storage.write(failure,100)).isInstanceOf(IOException.class);
        try(var files=Files.list(root)){assertThat(files.count()).isZero();}
    }
    @Test void traversalRootSymlinkAndEntrySymlinkCannotExposeExternalFiles() throws Exception {
        Path root=temporary.resolve("valid");Files.createDirectories(root);var storage=new LocalFileStorage(root,100);
        Path external=Files.writeString(temporary.resolve("external"),"synthetic-external");String key=UUID.randomUUID().toString();
        Files.createSymbolicLink(root.resolve(key),external);
        assertThatThrownBy(()->storage.open(key)).isInstanceOf(IOException.class);assertThatThrownBy(()->storage.delete(key)).isInstanceOf(IOException.class);
        assertThat(Files.exists(external)).isTrue();
        for(String invalid:new String[]{"../external","/etc/passwd",key+"/child",""}) assertThatThrownBy(()->storage.open(invalid)).isInstanceOf(IOException.class);
        Path alias=temporary.resolve("alias");Files.createSymbolicLink(alias,root);
        assertThatThrownBy(()->new LocalFileStorage(alias,100).write(new ByteArrayInputStream(new byte[]{1}),100)).isInstanceOf(IOException.class);
    }
    @Test void optionalAutoConfigurationBacksOffForConsumerSpiWithoutCreatingRoot() {
        var runner=new ApplicationContextRunner().withConfiguration(AutoConfigurations.of(ScFileStorageAutoConfiguration.class));
        runner.run(context->{assertThat(context).doesNotHaveBean(FileStorage.class);assertThat(context).doesNotHaveBean(FileStorageTransactions.class);});
        Path root=temporary.resolve("not-created");
        runner.withPropertyValues("sc.framework.file-storage.enabled=true","sc.framework.file-storage.root="+root).run(context->{
            assertThat(context).hasSingleBean(FileStorage.class).hasSingleBean(FileStorageTransactions.class);assertThat(Files.exists(root)).isFalse();
        });
        runner.withPropertyValues("sc.framework.file-storage.enabled=true").withUserConfiguration(CustomStorage.class).run(context->{
            assertThat(context).hasSingleBean(FileStorage.class);assertThat(context.getBean(FileStorage.class)).isSameAs(CustomStorage.STORAGE);
        });
    }
    @Configuration(proxyBeanMethods=false) static class CustomStorage {
        static final FileStorage STORAGE=new FileStorage(){public StoredBlob write(InputStream source,long limit){return new StoredBlob("custom",0);}public InputStream open(String key){return InputStream.nullInputStream();}public boolean exists(String key){return false;}public void delete(String key){}};
        @Bean FileStorage customStorage(){return STORAGE;}
    }
    @Test void rollbackDeletesNewBlobAndAfterCommitDeletionPreservesRollbackData() throws Exception {
        var storage=new LocalFileStorage(temporary.resolve("transactional"),100);var lifecycle=new FileStorageTransactions(storage);
        var dataSource=new DriverManagerDataSource("jdbc:h2:mem:files-"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1","sa","");
        var jdbc=new JdbcTemplate(dataSource);jdbc.execute("CREATE TABLE file_fixture(id INTEGER PRIMARY KEY)");var transaction=new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        var newBlob=storage.write(new ByteArrayInputStream(new byte[]{1}),100);
        transaction.executeWithoutResult(status->{jdbc.update("INSERT INTO file_fixture VALUES(1)");lifecycle.onRollback(newBlob.key());status.setRollbackOnly();});
        assertThat(storage.exists(newBlob.key())).isFalse();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM file_fixture",Integer.class)).isZero();
        var existing=storage.write(new ByteArrayInputStream(new byte[]{2}),100);
        transaction.executeWithoutResult(status->{lifecycle.afterCommitDelete(existing.key());status.setRollbackOnly();});assertThat(storage.exists(existing.key())).isTrue();
        transaction.executeWithoutResult(status->{jdbc.update("INSERT INTO file_fixture VALUES(2)");lifecycle.afterCommitDelete(existing.key());});
        assertThat(storage.exists(existing.key())).isFalse();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM file_fixture",Integer.class)).isEqualTo(1);
        assertThatThrownBy(()->lifecycle.onRollback("untracked")).isInstanceOf(IllegalStateException.class);
    }
    @Test void postCommitIoFailureDoesNotFailCommittedCommandOrLeakException() {
        FileStorage broken=new FileStorage(){public StoredBlob write(InputStream source,long limit){return null;}public InputStream open(String key){return null;}public boolean exists(String key){return false;}public void delete(String key)throws IOException{throw new IOException("synthetic-private-path-secret");}};
        var lifecycle=new FileStorageTransactions(broken);var source=new DriverManagerDataSource("jdbc:h2:mem:file-io-"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1","sa","");
        var jdbc=new JdbcTemplate(source);jdbc.execute("CREATE TABLE committed_fixture(id INTEGER PRIMARY KEY)");
        String result=new TransactionTemplate(new DataSourceTransactionManager(source)).execute(status->{jdbc.update("INSERT INTO committed_fixture VALUES(1)");lifecycle.afterCommitDelete("opaque-key");return "committed";});
        assertThat(result).isEqualTo("committed");assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM committed_fixture",Integer.class)).isEqualTo(1);assertThat(lifecycle.cleanupFailures()).isEqualTo(1);
    }
}
