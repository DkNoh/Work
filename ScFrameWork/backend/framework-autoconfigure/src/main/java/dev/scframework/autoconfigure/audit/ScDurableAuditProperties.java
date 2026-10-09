package dev.scframework.autoconfigure.audit;
import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * sc.framework.audit.durable-enabled 설정을 바인딩한다. 기본 false이며 outbox 감사 구현 선택에 사용한다.
 * 단순 enabled와 별도 선택지이므로 durable 사용에는 메시징/앱 migration 준비가 함께 필요하다.
 */
@ConfigurationProperties("sc.framework.audit")
public class ScDurableAuditProperties {
    private boolean durableEnabled;
    public boolean isDurableEnabled(){return durableEnabled;}public void setDurableEnabled(boolean value){durableEnabled=value;}
}
