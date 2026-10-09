package dev.scframework.starter.operations.scheduling;

import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import javax.sql.DataSource;
import dev.scframework.core.database.DatabaseDialect;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/*
 * 공통 RegisteredOperationalTask SPI를 구현하는 앱 소유의 중립 예약 예제다.
 * PULSE 코드를 등록할 뿐 예약 자체는 자동 생성하지 않는다. 관리 API에서 등록 코드로 예약한다.
 * 기본 TRANSACTIONAL 모드이며 runKey 기반 조회와 INSERT로 같은 실행 효과의 중복을 제어한다.
 */

@Component @ConditionalOnProperty(prefix="sc.framework.scheduler",name="enabled",havingValue="true")
public class PulseOperationalTask implements RegisteredOperationalTask {
    private final JdbcTemplate jdbc;
    private final DatabaseDialect dialect;
    public PulseOperationalTask(DataSource source, DatabaseDialect dialect){jdbc=new JdbcTemplate(source);this.dialect=dialect;}
    @Override public String jobCode(){return "PULSE";}
    // 스케줄러는 run_key UNIQUE와 실행 token으로 같은 실행을 하나의 담당자에게 할당한다.
    // 이 효과와 SUCCESS 기록은 같은 트랜잭션이다. 이미 완료한 runKey는 건너뛰며,
    // INSERT 실패는 삼키지 않아 PostgreSQL의 실패한 트랜잭션에서 후속 SQL을 실행하지 않는다.
    // 외부 HTTP 부작용이나 여러 서버의 owner 회수까지 exactly-once로 보장하는 예제가 아니다.
    @Override public void execute(ScheduledRunContext context) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM operation_pulse_effect WHERE run_key=?", Integer.class, context.runKey());
        if (count != null && count > 0) return;
        jdbc.update("INSERT INTO operation_pulse_effect(run_key,occurred_at) VALUES(?,?)",
                context.runKey(), dialect.timestamp(context.scheduledAt()));
    }
}
