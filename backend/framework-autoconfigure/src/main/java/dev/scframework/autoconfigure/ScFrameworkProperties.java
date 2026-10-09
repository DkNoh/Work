package dev.scframework.autoconfigure;

import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * sc.framework 설정을 바인딩하는 bean이다. 중첩 SessionEndpoint/Audit는 각각의 하위 설정 묶음이다.
 * 기본 me endpoint는 ON, 감사는 OFF이며 getter/setter는 Spring 설정 바인딩을 위한 접근자다.
 */

@ConfigurationProperties("sc.framework")
public class ScFrameworkProperties {
    private String applicationName = "sc-application";
    private final SessionEndpoint sessionEndpoint = new SessionEndpoint();
    private final Audit audit = new Audit();

    public String getApplicationName() { return applicationName; }
    public void setApplicationName(String applicationName) { this.applicationName = applicationName; }
    public SessionEndpoint getSessionEndpoint() { return sessionEndpoint; }
    public Audit getAudit() { return audit; }

    public static class SessionEndpoint {
        private boolean enabled = true;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }

    public static class Audit {
        private boolean enabled;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }
}
