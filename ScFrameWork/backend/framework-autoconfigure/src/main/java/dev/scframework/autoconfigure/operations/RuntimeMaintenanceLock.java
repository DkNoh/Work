package dev.scframework.autoconfigure.operations;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;

/*
 * 앱 실행과 오프라인 유지보수 도구가 같은 runtime을 동시에 열지 못하도록 파일 잠금을 소유한다.
 * root/잠금 파일의 symlink를 거절하고 0번 위치 1바이트 배타 잠금으로 Python lockf와 맞춘다.
 * 생성 중 실패하면 channel을 닫고 정상 종료에서는 lock과 channel을 함께 해제한다.
 */

/** POSIX byte-range lock: Python lockf(offset=0,length=1)와 동일하다. DB보다 먼저 잡고 DB 종료 뒤 해제한다. */
public final class RuntimeMaintenanceLock implements AutoCloseable {
    private final FileChannel channel;private final FileLock lock;
    public RuntimeMaintenanceLock(Path root)throws IOException{
        if(root==null)throw new IllegalArgumentException("SC_RUNTIME_ROOT_REQUIRED");
        Path normalized=root.toAbsolutePath().normalize();
        if(Files.isSymbolicLink(normalized))throw new IOException("SC_RUNTIME_ROOT_INVALID");
        Files.createDirectories(normalized);
        if(!Files.isDirectory(normalized,LinkOption.NOFOLLOW_LINKS))throw new IOException("SC_RUNTIME_ROOT_INVALID");
        Path file=normalized.toRealPath().resolve(".sc-runtime.lock");
        if(Files.isSymbolicLink(file))throw new IOException("SC_RUNTIME_LOCK_INVALID");
        FileChannel candidate=FileChannel.open(file,StandardOpenOption.CREATE,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);
        try{
            try{Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-------"));}catch(UnsupportedOperationException ignored){}
            FileLock acquired=candidate.tryLock(0,1,false);
            if(acquired==null)throw new IOException("SC_RUNTIME_IN_USE");
            channel=candidate;lock=acquired;
        }catch(IOException|RuntimeException failure){candidate.close();if(failure instanceof OverlappingFileLockException)throw new IOException("SC_RUNTIME_IN_USE");throw failure;}
    }
    @Override public void close()throws IOException{try{lock.release();}finally{channel.close();}}
}
