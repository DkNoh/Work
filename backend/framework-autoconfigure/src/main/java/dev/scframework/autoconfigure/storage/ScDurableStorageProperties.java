package dev.scframework.autoconfigure.storage;
import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * file-storage.durable-cleanup-enabled를 바인딩한다. 기본 OFF이며 outbox 기반 삭제/복구 연결을 선택한다.
 * 파일 저장 활성 여부와 별개로 영속 정리 경계를 명시하는 옵션이다.
 */
@ConfigurationProperties("sc.framework.file-storage")
public class ScDurableStorageProperties {
    private boolean durableCleanupEnabled;
    public boolean isDurableCleanupEnabled(){return durableCleanupEnabled;}public void setDurableCleanupEnabled(boolean value){durableCleanupEnabled=value;}
}
