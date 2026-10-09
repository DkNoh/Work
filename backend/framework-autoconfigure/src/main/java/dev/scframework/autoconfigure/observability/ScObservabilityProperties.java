package dev.scframework.autoconfigure.observability;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * 관측 기능의 OTLP 주소·별도 정제 로그 경로/크기·observer 인증 파일 경로를 바인딩한다.
 * 원문 application.log 수집 설정이 아니며 주소와 파일의 실제 검사는 자동설정/sink가 수행한다.
 */

@ConfigurationProperties("sc.framework.observability")
public class ScObservabilityProperties {
    private boolean enabled;
    private String otlpEndpoint = "http://127.0.0.1:4318/v1/traces";
    private Path eventLog;
    private Path observerSecretFile;
    private long maxLogBytes = 10 * 1024 * 1024;
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public String getOtlpEndpoint() { return otlpEndpoint; }
    public void setOtlpEndpoint(String value) { otlpEndpoint = value; }
    public Path getEventLog() { return eventLog; }
    public void setEventLog(Path value) { eventLog = value; }
    public Path getObserverSecretFile() { return observerSecretFile; }
    public void setObserverSecretFile(Path value) { observerSecretFile = value; }
    public long getMaxLogBytes() { return maxLogBytes; }
    public void setMaxLogBytes(long value) { maxLogBytes = value; }
}
