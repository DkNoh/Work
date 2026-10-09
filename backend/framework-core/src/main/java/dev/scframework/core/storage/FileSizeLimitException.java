package dev.scframework.core.storage;

import java.io.IOException;

/*
 * 스트림을 실제 읽는 도중 허용 바이트 수를 넘었음을 나타내는 IOException이다.
 * 업로드의 선언 크기와 실제 수신 크기는 다를 수 있어 저장 구현이 읽은 바이트를 기준으로 던진다.
 */

public final class FileSizeLimitException extends IOException {
    public FileSizeLimitException() { super("File exceeds the allowed byte limit"); }
}
