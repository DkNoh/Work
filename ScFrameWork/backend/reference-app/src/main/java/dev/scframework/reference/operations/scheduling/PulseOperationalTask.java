package dev.scframework.reference.operations.scheduling;

import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 운영 스케줄러의 실제 실행을 확인하는 등록 PULSE 작업이다.
 * runKey를 DB 효과의 키로 사용하여 같은 예약 실행의 중복 처리에도 같은 효과 행을 갱신한다.
 */

@Component @ConditionalOnProperty(prefix="sc.framework.scheduler",name="enabled",havingValue="true")
public class PulseOperationalTask implements RegisteredOperationalTask {
    private final JdbcTemplate jdbc;
    public PulseOperationalTask(DataSource source){jdbc=new JdbcTemplate(source);}
    @Override public String jobCode(){return "PULSE";}
    // runKey는 스케줄러가 정의한 동일 실행 식별자다. MERGE는 같은 키 재실행의 DB 효과를 한 행으로 유지하지만 외부 부작용 전체의 exactly-once를 주장하지 않는다.
    @Override public void execute(ScheduledRunContext context){jdbc.update("MERGE INTO operation_pulse_effect(run_key,occurred_at) KEY(run_key) VALUES(?,?)",context.runKey(),context.scheduledAt().atOffset(java.time.ZoneOffset.UTC));}
}
