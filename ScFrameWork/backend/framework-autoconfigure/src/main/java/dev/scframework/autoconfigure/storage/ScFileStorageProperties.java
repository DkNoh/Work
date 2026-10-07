package dev.scframework.autoconfigure.storage;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("sc.framework.file-storage")
public class ScFileStorageProperties {
    private boolean enabled;
    private Path root;
    private long maxBytes = 10L * 1024 * 1024;
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Path getRoot() { return root; }
    public void setRoot(Path root) { this.root = root; }
    public long getMaxBytes() { return maxBytes; }
    public void setMaxBytes(long maxBytes) { this.maxBytes = maxBytes; }
}
