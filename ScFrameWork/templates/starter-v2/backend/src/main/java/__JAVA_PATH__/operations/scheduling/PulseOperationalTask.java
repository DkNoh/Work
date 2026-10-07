package __JAVA_PACKAGE__.operations.scheduling;

import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component @ConditionalOnProperty(prefix="sc.framework.scheduler",name="enabled",havingValue="true")
public class PulseOperationalTask implements RegisteredOperationalTask {
    private final JdbcTemplate jdbc;
    public PulseOperationalTask(DataSource source){jdbc=new JdbcTemplate(source);}
    @Override public String jobCode(){return "PULSE";}
    @Override public void execute(ScheduledRunContext context){jdbc.update("MERGE INTO operation_pulse_effect(run_key,occurred_at) KEY(run_key) VALUES(?,?)",context.runKey(),context.scheduledAt().atOffset(java.time.ZoneOffset.UTC));}
}
