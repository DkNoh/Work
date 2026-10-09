package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import dev.scframework.autoconfigure.web.CommonEndpoints;
import org.junit.jupiter.api.Test;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;

class HealthReadinessTest {
    @Test void healthDoesNotReportUpBeforeBootstrapFinishes() {
        var availability = mock(ApplicationAvailability.class);
        var properties = new ScFrameworkProperties();
        properties.setApplicationName("synthetic-consumer");
        var endpoints = new CommonEndpoints(properties, availability);
        when(availability.getReadinessState()).thenReturn(ReadinessState.REFUSING_TRAFFIC);
        assertThat(endpoints.health().getStatusCode().value()).isEqualTo(503);
        assertThat(endpoints.health().getBody().status()).isEqualTo("STARTING");
        when(availability.getReadinessState()).thenReturn(ReadinessState.ACCEPTING_TRAFFIC);
        assertThat(endpoints.health().getStatusCode().value()).isEqualTo(200);
        assertThat(endpoints.health().getBody().application()).isEqualTo("synthetic-consumer");
    }
}
