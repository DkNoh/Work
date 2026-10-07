package dev.scframework.autoconfigure.audit;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditSink;
import dev.scframework.core.messaging.MessageHandler;
import dev.scframework.core.messaging.ScMessage;
import org.springframework.beans.factory.ObjectProvider;

public final class SecurityAuditMessageHandler implements MessageHandler {
    private final ObjectMapper mapper;private final ObjectProvider<SecurityAuditSink> sink;
    public SecurityAuditMessageHandler(ObjectMapper mapper,ObjectProvider<SecurityAuditSink> sink){this.mapper=mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);this.sink=sink;}
    @Override public String type(){return "SECURITY_AUDIT";}
    private SecurityAuditEvent read(String payload){try{return mapper.readValue(payload,SecurityAuditEvent.class);}catch(java.io.IOException exception){throw new IllegalArgumentException("SC_AUDIT_PAYLOAD_INVALID");}}
    @Override public void validate(String payload){read(payload);}
    @Override public void handle(ScMessage message){sink.getObject().save(read(message.payload()));}
}
