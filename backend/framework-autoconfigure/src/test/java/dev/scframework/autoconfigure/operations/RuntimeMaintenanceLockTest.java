package dev.scframework.autoconfigure.operations;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RuntimeMaintenanceLockTest {
    @TempDir Path directory;
    @Test void pythonLockfAndJavaFileLockExcludeEachOtherAndRelease()throws Exception{
        String code="import fcntl,sys; f=open(sys.argv[1],'a+b');\ntry: fcntl.lockf(f,fcntl.LOCK_EX|fcntl.LOCK_NB,1,0);sys.exit(0)\nexcept BlockingIOError: sys.exit(7)\n";
        try(RuntimeMaintenanceLock lock=new RuntimeMaintenanceLock(directory)){
            Process child=new ProcessBuilder("python3","-c",code,directory.resolve(".sc-runtime.lock").toString()).redirectError(ProcessBuilder.Redirect.DISCARD).redirectOutput(ProcessBuilder.Redirect.DISCARD).start();assertThat(child.waitFor()).isEqualTo(7);
            assertThatThrownBy(()->new RuntimeMaintenanceLock(directory)).hasMessage("SC_RUNTIME_IN_USE");
        }
        Process released=new ProcessBuilder("python3","-c",code,directory.resolve(".sc-runtime.lock").toString()).redirectError(ProcessBuilder.Redirect.DISCARD).redirectOutput(ProcessBuilder.Redirect.DISCARD).start();assertThat(released.waitFor()).isZero();
    }
}
