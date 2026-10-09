package dev.scframework.core.storage;

import java.io.IOException;
import java.io.InputStream;

/*
 * 업무 권한/metadata와 바이너리 저장을 분리하는 SPI다. write는 입력 스트림을 opaque 키와 크기로 바꾼다.
 * open이 반환한 스트림의 close는 호출자 책임이며, delete/exists는 업무 소유권을 대신 검사하지 않는다.
 */

/** 바이너리 저장 경계. 업무 metadata·권한과 실제 경로는 소비 앱이 소유한다. */
public interface FileStorage {
    StoredBlob write(InputStream source, long maxBytes) throws IOException;
    InputStream open(String key) throws IOException;
    boolean exists(String key) throws IOException;
    void delete(String key) throws IOException;
}
