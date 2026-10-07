package dev.scframework.core.storage;

import java.io.IOException;

public final class FileSizeLimitException extends IOException {
    public FileSizeLimitException() { super("File exceeds the allowed byte limit"); }
}
