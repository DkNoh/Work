package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.scframework.autoconfigure.web.RequestIdFilter;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestIdFilterTest {
    @Test
    void requestIdIsBoundOnlyForTheCurrentRequestEvenWhenTheChainFails() {
        var request = new MockHttpServletRequest();
        request.addHeader("X-Request-ID", "test-request-001");
        var response = new MockHttpServletResponse();
        assertThatThrownBy(() -> new RequestIdFilter().doFilter(request, response, (req, res) -> {
            assertThat(MDC.get("requestId")).isEqualTo("test-request-001");
            throw new ServletException("synthetic failure");
        })).isInstanceOf(ServletException.class);
        assertThat(response.getHeader("X-Request-ID")).isEqualTo("test-request-001");
        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void invalidUntrustedHeaderIsReplaced() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader("X-Request-ID", "untrusted value with spaces");
        var response = new MockHttpServletResponse();
        new RequestIdFilter().doFilter(request, response, (req, res) -> {});
        assertThat(response.getHeader("X-Request-ID")).matches("[a-f0-9-]{36}");
        assertThat(MDC.get("requestId")).isNull();
    }
}
