package dev.scframework.autoconfigure.storage;

import dev.scframework.core.storage.*;
import java.io.*;
import java.nio.file.*;
import java.util.UUID;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.List;
import java.util.ArrayList;

/** UUID와 실제 root 안의 일반 파일만 다룬다. root 생성은 첫 쓰기까지 지연한다. */
public final class LocalFileStorage implements RecoverableFileStorage, AutoCloseable {
    private final Path root;
    private final long maxBytes;
    private final boolean recoverable;
    private final String runId=UUID.randomUUID().toString();
    private FileChannel lockChannel;private FileLock storageLock;
    public LocalFileStorage(Path root, long maxBytes) {
        this(root,maxBytes,false);
    }
    public LocalFileStorage(Path root,long maxBytes,boolean recoverable) {
        if (root == null || maxBytes < 1) throw new IllegalArgumentException("Explicit storage root and positive limit are required");
        this.root = root.toAbsolutePath().normalize(); this.maxBytes = maxBytes;
        this.recoverable=recoverable;
    }
    private Path root(boolean create) throws IOException {
        if (Files.isSymbolicLink(root)) throw new IOException("Storage root must not be a symbolic link");
        if (create) Files.createDirectories(root);
        if (!Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS)) throw new NoSuchFileException("Storage root is unavailable");
        Path anchor=root.toRealPath();
        if(recoverable)lock(anchor);
        return anchor;
    }
    private synchronized void lock(Path anchor)throws IOException{
        if(storageLock!=null)return;
        Path file=anchor.resolve(".sc-storage.lock");if(Files.isSymbolicLink(file))throw new IOException("SC_STORAGE_LOCK_INVALID");
        FileChannel candidate=FileChannel.open(file,StandardOpenOption.CREATE,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS);
        try{FileLock acquired=candidate.tryLock(0,1,false);if(acquired==null)throw new IOException("SC_STORAGE_IN_USE");lockChannel=candidate;storageLock=acquired;}
        catch(IOException|RuntimeException failure){candidate.close();throw new IOException("SC_STORAGE_IN_USE");}
    }
    private Path childDirectory(Path anchor,String name)throws IOException{
        Path directory=anchor.resolve(name);if(Files.isSymbolicLink(directory))throw new IOException("SC_STORAGE_JOURNAL_INVALID");
        Files.createDirectories(directory);if(!Files.isDirectory(directory,LinkOption.NOFOLLOW_LINKS))throw new IOException("SC_STORAGE_JOURNAL_INVALID");
        try{Files.setPosixFilePermissions(directory,PosixFilePermissions.fromString("rwx------"));}catch(UnsupportedOperationException ignored){}
        return directory;
    }
    private void journal(Path anchor,String key)throws IOException{
        Path directory=childDirectory(anchor,".pending");Path marker=directory.resolve(key);
        String content="1\n"+runId+"\n"+Instant.now()+"\n";
        try(FileChannel output=FileChannel.open(marker,StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){
            java.nio.ByteBuffer bytes=StandardCharsets.UTF_8.encode(content);while(bytes.hasRemaining())output.write(bytes);output.force(true);
        }
        try{Files.setPosixFilePermissions(marker,PosixFilePermissions.fromString("rw-------"));}catch(UnsupportedOperationException ignored){}
    }
    private Path path(String key) throws IOException {
        if (key == null || !key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw new IOException("Invalid storage key");
        Path anchor = root(false); Path result = anchor.resolve(key).normalize();
        if (!result.getParent().equals(anchor) || Files.isSymbolicLink(result)) throw new IOException("Invalid storage entry");
        return result;
    }
    @Override public StoredBlob write(InputStream source, long requestedMaxBytes) throws IOException {
        if (source == null || requestedMaxBytes < 1) throw new IllegalArgumentException("Positive byte limit and source are required");
        long limit = Math.min(maxBytes, requestedMaxBytes); String key = UUID.randomUUID().toString();
        Path anchor=root(true);Path target=anchor.resolve(key);Path writeTarget=target;long size=0;
        if(recoverable){journal(anchor,key);writeTarget=childDirectory(anchor,".part").resolve(key);}
        try {
            try (OutputStream output = Files.newOutputStream(writeTarget, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS)) {
                byte[] bytes = new byte[8192]; int count;
                while ((count = source.read(bytes)) != -1) {
                    if (count > limit - size) throw new FileSizeLimitException();
                    output.write(bytes, 0, count); size += count;
                }
            }
            if(recoverable){try(FileChannel data=FileChannel.open(writeTarget,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS)){data.force(true);}Files.move(writeTarget,target,StandardCopyOption.ATOMIC_MOVE);}
            return new StoredBlob(key, size);
        } catch (IOException | RuntimeException failure) {
            try { delete(key); } catch (IOException cleanup) { failure.addSuppressed(cleanup); }
            throw failure;
        }
    }
    @Override public InputStream open(String key) throws IOException {
        Path entry = path(key);
        if (!Files.isRegularFile(entry, LinkOption.NOFOLLOW_LINKS)) throw new NoSuchFileException("Storage entry is unavailable");
        return Files.newInputStream(entry, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS);
    }
    @Override public boolean exists(String key) throws IOException {
        if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return false;
        return Files.isRegularFile(path(key), LinkOption.NOFOLLOW_LINKS);
    }
    @Override public void delete(String key) throws IOException {
        if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return;
        Path entry = path(key);
        if (Files.exists(entry, LinkOption.NOFOLLOW_LINKS) && !Files.isRegularFile(entry, LinkOption.NOFOLLOW_LINKS)) throw new IOException("Invalid storage entry");
        Files.deleteIfExists(entry);
        if(recoverable){safeChildDelete(entry.getParent(),".part",key);safeChildDelete(entry.getParent(),".pending",key);}
    }
    private void safeChildDelete(Path anchor,String directory,String key)throws IOException{
        Path child=anchor.resolve(directory);if(Files.isSymbolicLink(child))throw new IOException("SC_STORAGE_JOURNAL_INVALID");
        Path file=child.resolve(key);if(Files.isSymbolicLink(file)||Files.exists(file,LinkOption.NOFOLLOW_LINKS)&&!Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS))throw new IOException("SC_STORAGE_JOURNAL_INVALID");Files.deleteIfExists(file);
    }
    @Override public void markRetained(String key)throws IOException{if(!recoverable||!Files.exists(root,LinkOption.NOFOLLOW_LINKS))return;Path entry=path(key);safeChildDelete(entry.getParent(),".pending",key);}
    @Override public List<PendingWrite> pendingWrites()throws IOException{
        if(!recoverable||!Files.exists(root,LinkOption.NOFOLLOW_LINKS))return List.of();
        Path anchor=root(false),directory=anchor.resolve(".pending");if(!Files.exists(directory,LinkOption.NOFOLLOW_LINKS))return List.of();
        if(Files.isSymbolicLink(directory)||!Files.isDirectory(directory,LinkOption.NOFOLLOW_LINKS))throw new IOException("SC_STORAGE_JOURNAL_INVALID");
        List<PendingWrite> result=new ArrayList<>();
        try(DirectoryStream<Path> files=Files.newDirectoryStream(directory)){
            for(Path file:files){String key=file.getFileName().toString();path(key);
                if(Files.isSymbolicLink(file)||!Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS)||Files.size(file)>256)throw new IOException("SC_STORAGE_JOURNAL_INVALID");
                List<String> lines=Files.readAllLines(file,StandardCharsets.UTF_8);if(lines.size()!=3||!"1".equals(lines.get(0)))throw new IOException("SC_STORAGE_JOURNAL_INVALID");
                try{String owner=UUID.fromString(lines.get(1)).toString();Instant started=Instant.parse(lines.get(2));result.add(new PendingWrite(key,owner,started,runId.equals(owner)));}catch(RuntimeException invalid){throw new IOException("SC_STORAGE_JOURNAL_INVALID");}
                if(result.size()>10000)throw new IOException("SC_STORAGE_JOURNAL_LIMIT");
            }
        }
        return List.copyOf(result);
    }
    @Override public synchronized void close()throws IOException{try{if(storageLock!=null)storageLock.release();}finally{storageLock=null;if(lockChannel!=null)lockChannel.close();lockChannel=null;}}
}
