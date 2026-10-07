package dev.scframework.autoconfigure.scheduling;

import org.springframework.boot.context.properties.ConfigurationProperties;

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
