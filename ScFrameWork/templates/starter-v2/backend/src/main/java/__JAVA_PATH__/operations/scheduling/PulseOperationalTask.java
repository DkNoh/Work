package __JAVA_PACKAGE__.operations.scheduling;

import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/*
 * 공통 RegisteredOperationalTask SPI를 구현하는 앱 소유의 중립 예약 예제다.
 * PULSE 코드를 등록할 뿐 예약 자체는 자동 생성하지 않는다. 관리 API에서 등록 코드로 예약한다.
 * 기본 TRANSACTIONAL 모드이며 runKey 기반 MERGE로 같은 실행 효과의 중복을 제어한다.
 */

@Component @ConditionalOnProperty(prefix="sc.framework.scheduler",name="enabled",havingValue="true")
public class PulseOperationalTask implements RegisteredOperationalTask {
    private final JdbcTemplate jdbc;
    public PulseOperationalTask(DataSource source){jdbc=new JdbcTemplate(source);}
    @Override public String jobCode(){return "PULSE";}
    @Override public void execute(ScheduledRunContext context){jdbc.update("MERGE INTO operation_pulse_effect(run_key,occurred_at) KEY(run_key) VALUES(?,?)",context.runKey(),context.scheduledAt().atOffset(java.time.ZoneOffset.UTC));}
}
