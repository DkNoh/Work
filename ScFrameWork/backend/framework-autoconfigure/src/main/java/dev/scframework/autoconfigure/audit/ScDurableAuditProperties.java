package dev.scframework.autoconfigure.audit;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties("sc.framework.audit")
public class ScDurableAuditProperties {
    private boolean durableEnabled;
    public boolean isDurableEnabled(){return durableEnabled;}public void setDurableEnabled(boolean value){durableEnabled=value;}
}
