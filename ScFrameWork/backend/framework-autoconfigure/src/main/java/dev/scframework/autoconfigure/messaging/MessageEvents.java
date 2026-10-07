package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;

public final class MessageEvents {
    private final ObjectProvider<OperationalEventSink> sinks;
    public MessageEvents(ObjectProvider<OperationalEventSink> sinks){this.sinks=sinks;}
    public void record(OperationalEvent.Kind kind,OperationalEvent.Outcome outcome,UUID id){
        try { OperationalEventSink sink=sinks.getIfAvailable();if(sink!=null)sink.record(new OperationalEvent(kind,outcome,id)); }
        catch(RuntimeException ignored){/* 관측 장애는 이미 확정된 결과를 바꾸지 않는다. */}
    }
}
