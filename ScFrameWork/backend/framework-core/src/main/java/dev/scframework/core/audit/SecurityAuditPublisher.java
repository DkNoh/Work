package dev.scframework.core.audit;

/** 활성 여부와 실제 커밋 경계는 구현이 소유하며 업무 Entity를 받지 않는다. */
@FunctionalInterface
public interface SecurityAuditPublisher {
    void publish(SecurityAuditEvent event);
}
