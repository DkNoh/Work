package dev.scframework.autoconfigure.operations;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * sc.framework.operations의 활성 여부와 runtime root를 받는 설정 bean이다.
 * 경로의 실제 검사/잠금은 RuntimeMaintenanceLock이 맡으며 이 클래스는 설정 값을 전달한다.
 */

@ConfigurationProperties("sc.framework.operations")
public class ScOperationsProperties {
    private boolean enabled;private Path runtimeRoot;
    public boolean isEnabled(){return enabled;}public void setEnabled(boolean value){enabled=value;}
    public Path getRuntimeRoot(){return runtimeRoot;}public void setRuntimeRoot(Path value){runtimeRoot=value;}
}
