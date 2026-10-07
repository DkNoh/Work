package dev.scframework.autoconfigure;

import org.springframework.boot.context.properties.ConfigurationProperties;

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
