package dev.scframework.autoconfigure.messaging;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.messaging.ScMessage;

/*
 * 중립 ScMessage JSON과 UTF-8 바이트의 변환 경계다. Java 클래스 이름 기반 역직렬화는 하지 않는다.
 * 인코딩/디코딩 모두 registry 검증을 거치고 봉투 최대 크기 및 unknown property를 제한한다.
 */

/** 명시된 JSON record만 해석한다. 클래스 헤더/Java 역직렬화를 사용하지 않는다. */
public final class MessageCodec {
    private final ObjectMapper mapper;
    private final MessageRegistry registry;
    public MessageCodec(ObjectMapper mapper, MessageRegistry registry) {
        this.mapper=mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        this.registry=registry;
    }
    public byte[] encode(ScMessage message) {
        registry.require(message);
        try { byte[] bytes=mapper.writeValueAsBytes(message); if(bytes.length>32768)throw new IllegalArgumentException("SC_MESSAGE_TOO_LARGE"); return bytes; }
        catch (java.io.IOException exception) { throw new IllegalArgumentException("SC_MESSAGE_ENCODING_INVALID"); }
    }
    public ScMessage decode(byte[] bytes) {
        if(bytes==null||bytes.length==0||bytes.length>32768)throw new IllegalArgumentException("SC_MESSAGE_ENCODING_INVALID");
        try { ScMessage message=mapper.readValue(bytes,ScMessage.class);registry.require(message);return message; }
        catch(java.io.IOException exception){throw new IllegalArgumentException("SC_MESSAGE_ENCODING_INVALID");}
    }
}
