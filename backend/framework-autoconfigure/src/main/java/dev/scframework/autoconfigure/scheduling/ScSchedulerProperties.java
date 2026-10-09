package dev.scframework.autoconfigure.scheduling;

import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * 예약 기능 활성, 기본 예약 생성 선택, 완료 이력 보존 일수/회차 크기를 바인딩한다.
 * validate는 보존 범위를 제한한다. bootstrapDefaults는 재기동마다 사용자 설정을 덮어쓰라는 뜻이 아니다.
 */

@ConfigurationProperties("sc.framework.scheduler")
public class ScSchedulerProperties {
    private boolean enabled;
    private boolean bootstrapDefaults;
    private int runRetentionDays = 30;
    private int retentionBatchSize = 500;
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public boolean isBootstrapDefaults() { return bootstrapDefaults; }
    public void setBootstrapDefaults(boolean value) { bootstrapDefaults = value; }
    public int getRunRetentionDays() { return runRetentionDays; }
    public void setRunRetentionDays(int value) { runRetentionDays = value; }
    public int getRetentionBatchSize() { return retentionBatchSize; }
    public void setRetentionBatchSize(int value) { retentionBatchSize = value; }
    public void validate() {
        if (runRetentionDays < 7 || runRetentionDays > 365 || retentionBatchSize < 1 || retentionBatchSize > 1000)
            throw new IllegalStateException("Invalid scheduler retention configuration");
    }
}
