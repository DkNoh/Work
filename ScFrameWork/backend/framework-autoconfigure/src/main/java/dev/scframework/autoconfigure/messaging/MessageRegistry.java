package dev.scframework.autoconfigure.messaging;

import dev.scframework.core.messaging.MessageHandler;
import dev.scframework.core.messaging.ScMessage;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

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
    public MessageHandler require(ScMessage message) {
        MessageHandler handler = handlers.get(message.type());
        if (handler == null || message.payload().getBytes(StandardCharsets.UTF_8).length > maxPayloadBytes)
            throw new IllegalArgumentException("SC_MESSAGE_NOT_REGISTERED");
        handler.validate(message.payload()); return handler;
    }
}
