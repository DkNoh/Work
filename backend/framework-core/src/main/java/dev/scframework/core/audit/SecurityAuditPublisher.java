package dev.scframework.core.audit;

/*
 * 업무/인증 계층이 감사 이벤트를 발행하는 SPI다. 구현 선택에 따라 커밋 후 저장 또는 outbox 기록이 된다.
 * 호출자는 저장소 구현을 몰라도 되며, 성공 이벤트가 rollback 시 어떻게 처리되는지는 선택한 publisher 계약을 따른다.
 */

/** 활성 여부와 실제 커밋 경계는 구현이 소유하며 업무 Entity를 받지 않는다. */
@FunctionalInterface
public interface SecurityAuditPublisher {
    void publish(SecurityAuditEvent event);
}
