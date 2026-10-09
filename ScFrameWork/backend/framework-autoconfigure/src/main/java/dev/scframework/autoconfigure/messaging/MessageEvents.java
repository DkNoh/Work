package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;

/*
 * 메시징 결과를 선택 관측 sink로 전달한다. ObjectProvider는 sink가 없을 때도 기본 메시징을 허용한다.
 * record는 관측 실패를 삼켜 이미 확정된 발행/소비 결과가 관측 장애로 바뀌지 않게 한다.
 */

public final class MessageEvents {
    private final ObjectProvider<OperationalEventSink> sinks;
    public MessageEvents(ObjectProvider<OperationalEventSink> sinks){this.sinks=sinks;}
    public void record(OperationalEvent.Kind kind,OperationalEvent.Outcome outcome,UUID id){
        try { OperationalEventSink sink=sinks.getIfAvailable();if(sink!=null)sink.record(new OperationalEvent(kind,outcome,id)); }
        catch(RuntimeException ignored){/* 관측 장애는 이미 확정된 결과를 바꾸지 않는다. */}
    }
}
