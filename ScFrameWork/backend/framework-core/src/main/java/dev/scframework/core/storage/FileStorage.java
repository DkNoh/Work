package dev.scframework.core.storage;

import java.io.IOException;
import java.io.InputStream;

/** 바이너리 저장 경계. 업무 metadata·권한과 실제 경로는 소비 앱이 소유한다. */
public interface FileStorage {
    StoredBlob write(InputStream source, long maxBytes) throws IOException;
    InputStream open(String key) throws IOException;
    boolean exists(String key) throws IOException;
    void delete(String key) throws IOException;
}
