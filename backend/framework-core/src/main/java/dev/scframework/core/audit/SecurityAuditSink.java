package dev.scframework.core.audit;

/*
 * 감사 한 건을 실제 저장하는 교체 지점이다. 기본 구현은 JDBC지만 core는 Spring/DataSource를 알지 못한다.
 * publish 시점/트랜잭션 조율은 Publisher가 맡고 이 인터페이스는 전달된 이벤트 저장만 맡는다.
 */

/** 소비 앱이 교체할 수 있는 저장 SPI. core에는 Spring/JPA/앱 의존성이 없다. */
@FunctionalInterface
public interface SecurityAuditSink {
    void save(SecurityAuditEvent event);
}
