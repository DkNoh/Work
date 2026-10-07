package dev.scframework.autoconfigure.storage;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties("sc.framework.file-storage")
public class ScDurableStorageProperties {
    private boolean durableCleanupEnabled;
    public boolean isDurableCleanupEnabled(){return durableCleanupEnabled;}public void setDurableCleanupEnabled(boolean value){durableCleanupEnabled=value;}
}
