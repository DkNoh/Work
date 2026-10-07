package dev.scframework.core.messaging;

/** 등록 type만 허용한다. validate는 side effect가 없고 handle은 inbox와 같은 DB TX다. */
public interface MessageHandler {
    String type();
    void validate(String payload);
    void handle(ScMessage message) throws Exception;
}
