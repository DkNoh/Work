package dev.scframework.autoconfigure;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.assertThat;

class ScOptionalInfrastructureFilterTest {
    private static final String RABBIT = "org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration";
    private static final String QUARTZ = "org.springframework.boot.autoconfigure.quartz.QuartzAutoConfiguration";
    private static final String OTLP = "org.springframework.boot.actuate.autoconfigure.tracing.otlp.OtlpTracingAutoConfiguration";
    @Test void missingOptionsRejectInfrastructureButKeepUnrelatedAndNullEntries() {
        var filter = new ScOptionalInfrastructureFilter();
        filter.setEnvironment(new MockEnvironment());
        assertThat(filter.match(new String[]{RABBIT, QUARTZ, OTLP, "application.CustomConfiguration", null}, null))
                .containsExactly(false, false, false, true, true);
    }
    @Test void explicitOptionsDelegateToBootButNeverInstallTheUnsanitizedExporter() {
        var filter = new ScOptionalInfrastructureFilter();
        filter.setEnvironment(new MockEnvironment().withProperty("sc.framework.messaging.enabled", "true")
                .withProperty("sc.framework.scheduler.enabled", "true"));
        assertThat(filter.match(new String[]{RABBIT, QUARTZ, OTLP}, null)).containsExactly(true, true, false);
    }
}
