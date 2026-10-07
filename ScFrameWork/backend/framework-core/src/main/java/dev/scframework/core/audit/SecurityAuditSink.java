package dev.scframework.core.audit;

/** 소비 앱이 교체할 수 있는 저장 SPI. core에는 Spring/JPA/앱 의존성이 없다. */
@FunctionalInterface
public interface SecurityAuditSink {
    void save(SecurityAuditEvent event);
}
