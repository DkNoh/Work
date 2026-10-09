package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.*;
import dev.scframework.autoconfigure.scheduling.RegisteredTaskRegistry;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import dev.scframework.core.scheduling.ScheduledRunContext;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RegisteredTaskRegistryTest {
    private RegisteredOperationalTask task(String code){return new RegisteredOperationalTask(){public String jobCode(){return code;}public void execute(ScheduledRunContext context){}};}
    @Test void duplicateOrUnregisteredTaskCodesNeverResolveArbitraryClasses(){
        assertThatThrownBy(()->new RegisteredTaskRegistry(List.of(task("PULSE"),task("PULSE")))).hasMessage("Invalid or duplicate operational task registration");
        assertThatThrownBy(()->new RegisteredTaskRegistry(List.of(task("example.JavaClass")))).hasMessage("Invalid or duplicate operational task registration");
        var registry=new RegisteredTaskRegistry(List.of(task("PULSE")));assertThat(registry.require("PULSE").jobCode()).isEqualTo("PULSE");
        assertThatThrownBy(()->registry.require("unknown.Class")).isInstanceOf(dev.scframework.core.ApiException.class);
    }
    @Test void publicRunContextAllowsOnlyOpaqueKeyRegisteredCodeAndBoundedCounters(){
        var context=new ScheduledRunContext(UUID.randomUUID().toString(),"PULSE",100,Instant.parse("2026-10-07T00:00:00.123456789Z"),1);
        assertThat(context.scheduledAt()).isEqualTo(Instant.parse("2026-10-07T00:00:00.123456Z"));
        assertThatThrownBy(()->new ScheduledRunContext(UUID.randomUUID().toString(),"PULSE",0,Instant.now(),1)).isInstanceOf(IllegalArgumentException.class);
    }
}
