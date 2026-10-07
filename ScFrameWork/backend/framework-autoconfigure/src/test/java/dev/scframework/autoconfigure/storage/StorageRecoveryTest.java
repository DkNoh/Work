package dev.scframework.autoconfigure.storage;

import static org.assertj.core.api.Assertions.*;
import dev.scframework.core.storage.StoredBlob;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class StorageRecoveryTest {
    @TempDir Path directory;
    @Test void currentWritesBecomeRecoverableOnlyAfterRestartAndCommittedMarkerIsRemoved()throws Exception{
        Path root=directory.resolve("uploads");StoredBlob pending,retained;
        try(LocalFileStorage first=new LocalFileStorage(root,100,true)){
            pending=first.write(new ByteArrayInputStream(new byte[]{1,2,3}),100);retained=first.write(new ByteArrayInputStream(new byte[]{4}),100);first.markRetained(retained.key());
            assertThat(first.pendingWrites()).hasSize(1);assertThat(first.pendingWrites().getFirst().currentRun()).isTrue();
        }
        try(LocalFileStorage second=new LocalFileStorage(root,100,true)){
            assertThat(second.pendingWrites()).hasSize(1);assertThat(second.pendingWrites().getFirst().currentRun()).isFalse();
            second.delete(pending.key());second.delete(pending.key());assertThat(second.pendingWrites()).isEmpty();assertThat(second.exists(retained.key())).isTrue();
        }
    }
    @Test void oversizeAndSourceFailureRemovePartialAndJournal()throws Exception{
        Path root=directory.resolve("uploads");try(LocalFileStorage storage=new LocalFileStorage(root,2,true)){
            assertThatThrownBy(()->storage.write(new ByteArrayInputStream(new byte[]{1,2,3}),2)).isInstanceOf(dev.scframework.core.storage.FileSizeLimitException.class);
            assertThat(storage.pendingWrites()).isEmpty();
            assertThatThrownBy(()->storage.write(new java.io.InputStream(){int reads;public int read()throws java.io.IOException{if(++reads>2)throw new java.io.IOException("synthetic");return 1;}},2)).isInstanceOf(java.io.IOException.class);
            assertThat(storage.pendingWrites()).isEmpty();
            try(var files=Files.list(root.resolve(".part"))){assertThat(files.count()).isZero();}
        }
    }
    @Test void anotherStorageInstanceAndJournalSymlinksAreRejected()throws Exception{
        Path root=directory.resolve("uploads");try(LocalFileStorage first=new LocalFileStorage(root,100,true);LocalFileStorage second=new LocalFileStorage(root,100,true)){
            StoredBlob blob=first.write(new ByteArrayInputStream(new byte[]{1}),100);
            assertThatThrownBy(()->second.exists(blob.key())).hasMessage("SC_STORAGE_IN_USE");
            Files.delete(root.resolve(".pending").resolve(blob.key()));Files.createSymbolicLink(root.resolve(".pending").resolve(blob.key()),directory.resolve("outside"));
            assertThatThrownBy(first::pendingWrites).hasMessage("SC_STORAGE_JOURNAL_INVALID");
        }
    }
}
