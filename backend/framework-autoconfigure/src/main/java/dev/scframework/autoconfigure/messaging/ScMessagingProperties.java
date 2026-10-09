package dev.scframework.autoconfigure.messaging;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * 메시징 활성/앱 ID/본문 크기/배치/confirm/lease/재시도/보존 기간을 설정한다.
 * validate에서 각 범위와 lease > confirm timeout 관계를 검사해 아직 전송 중인 claim을 너무 일찍 회수하지 않게 한다.
 * getter/setter는 Spring 바인딩을 위한 코드이고 실제 외부 연결은 자동설정이 수행한다.
 */

@ConfigurationProperties("sc.framework.messaging")
public class ScMessagingProperties {
    private boolean enabled;
    private String applicationId;
    private int maxPayloadBytes = 16384;
    private int publishMaxAttempts = 5;
    private Duration confirmTimeout = Duration.ofSeconds(5);
    private Duration lease = Duration.ofSeconds(30);
    private Duration pollInterval = Duration.ofSeconds(1);
    private int batchSize = 20;
    private int deliveryLimit = 4;
    private int prefetch = 10;
    private Duration retryMin = Duration.ofSeconds(1);
    private Duration retryMax = Duration.ofSeconds(30);
    private int retentionDays = 30;
    public void validate() {
        if (applicationId == null || !applicationId.matches("[a-z][a-z0-9-]{2,47}")
                || maxPayloadBytes < 1 || maxPayloadBytes > 16384 || publishMaxAttempts < 1 || publishMaxAttempts > 5
                || batchSize < 1 || batchSize > 100 || deliveryLimit != 4 || prefetch < 1 || prefetch > 100
                || retentionDays < 7 || retentionDays > 365) throw new IllegalArgumentException("SC_MESSAGING_CONFIGURATION_INVALID");
        duration(confirmTimeout, 100, 30000); duration(lease, 1000, 120000); duration(pollInterval, 100, 60000);
        duration(retryMin, 100, 30000); duration(retryMax, retryMin.toMillis(), 300000);
        if (lease.compareTo(confirmTimeout) <= 0) throw new IllegalArgumentException("SC_MESSAGING_LEASE_INVALID");
    }
    private static void duration(Duration value, long min, long max) {
        if (value == null || value.toMillis() < min || value.toMillis() > max) throw new IllegalArgumentException("SC_MESSAGING_DURATION_INVALID");
    }
    public boolean isEnabled() { return enabled; } public void setEnabled(boolean value) { enabled = value; }
    public String getApplicationId() { return applicationId; } public void setApplicationId(String value) { applicationId = value; }
    public int getMaxPayloadBytes() { return maxPayloadBytes; } public void setMaxPayloadBytes(int value) { maxPayloadBytes = value; }
    public int getPublishMaxAttempts() { return publishMaxAttempts; } public void setPublishMaxAttempts(int value) { publishMaxAttempts = value; }
    public Duration getConfirmTimeout() { return confirmTimeout; } public void setConfirmTimeout(Duration value) { confirmTimeout = value; }
    public Duration getLease() { return lease; } public void setLease(Duration value) { lease = value; }
    public Duration getPollInterval() { return pollInterval; } public void setPollInterval(Duration value) { pollInterval = value; }
    public int getBatchSize() { return batchSize; } public void setBatchSize(int value) { batchSize = value; }
    public int getDeliveryLimit() { return deliveryLimit; } public void setDeliveryLimit(int value) { deliveryLimit = value; }
    public int getPrefetch() { return prefetch; } public void setPrefetch(int value) { prefetch = value; }
    public Duration getRetryMin() { return retryMin; } public void setRetryMin(Duration value) { retryMin = value; }
    public Duration getRetryMax() { return retryMax; } public void setRetryMax(Duration value) { retryMax = value; }
    public int getRetentionDays() { return retentionDays; } public void setRetentionDays(int value) { retentionDays = value; }
}
