package dev.scframework.autoconfigure.operations;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("sc.framework.operations")
public class ScOperationsProperties {
    private boolean enabled;private Path runtimeRoot;
    public boolean isEnabled(){return enabled;}public void setEnabled(boolean value){enabled=value;}
    public Path getRuntimeRoot(){return runtimeRoot;}public void setRuntimeRoot(Path value){runtimeRoot=value;}
}
