package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.messaging.MessageHandler;
import dev.scframework.core.messaging.ScMessage;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/*
 * 앱이 bean으로 등록한 MessageHandler를 type별 불변 Map으로 보관한다. 중복 type은 시작 단계에서 실패한다.
 * require는 등록 여부/본문 크기와 업무별 validate를 통과한 handler만 반환한다. 임의 type으로 실행하지 않는다.
 */

public final class MessageRegistry {
    private final Map<String, MessageHandler> handlers;
    private final int maxPayloadBytes;
    public MessageRegistry(List<MessageHandler> handlers, int maxPayloadBytes) {
        this.handlers = handlers.stream().collect(Collectors.toUnmodifiableMap(MessageHandler::type, Function.identity()));
        this.maxPayloadBytes = maxPayloadBytes;
        if (this.handlers.isEmpty() || this.handlers.keySet().stream().anyMatch(type -> !type.matches("[A-Z][A-Z0-9_]{0,63}")))
            throw new IllegalArgumentException("SC_MESSAGE_REGISTRY_INVALID");
    }
    public boolean contains(String type) { return handlers.containsKey(type); }
    public List<String> types() { return handlers.keySet().stream().sorted().toList(); }
    // handler 선택과 payload 유효성 검사를 묶는다. validate를 통과해야 저장/발행/수신 실행 단계로 갈 수 있다.
    public MessageHandler require(ScMessage message) {
        MessageHandler handler = handlers.get(message.type());
        if (handler == null || message.payload().getBytes(StandardCharsets.UTF_8).length > maxPayloadBytes)
            throw new IllegalArgumentException("SC_MESSAGE_NOT_REGISTERED");
        handler.validate(message.payload()); return handler;
    }
}
