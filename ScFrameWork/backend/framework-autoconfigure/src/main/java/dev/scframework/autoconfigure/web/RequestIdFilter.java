package dev.scframework.autoconfigure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

public final class RequestIdFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Request-ID";
    public static final String MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String candidate = request.getHeader(HEADER);
        String requestId = candidate != null && candidate.matches("[A-Za-z0-9_-]{1,64}")
                ? candidate : UUID.randomUUID().toString();
        String previous = MDC.get(MDC_KEY);
        MDC.put(MDC_KEY, requestId);
        response.setHeader(HEADER, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            // 서블릿 스레드가 재사용될 때 이전 요청의 ID를 남기지 않는다.
            if (previous == null) MDC.remove(MDC_KEY); else MDC.put(MDC_KEY, previous);
        }
    }
}
