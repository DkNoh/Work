package dev.scframework.autoconfigure.storage;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * 파일 저장 활성 여부, 명시적 root, 기본 10MiB 상한을 전달하는 설정 bean이다.
 * root가 없는 상태에서 임의 작업 디렉터리에 저장하지 않으며 실제 유효성 검사는 저장소 생성자가 수행한다.
 */

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
