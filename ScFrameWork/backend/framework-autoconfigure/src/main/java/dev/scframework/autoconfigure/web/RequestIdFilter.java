package dev.scframework.autoconfigure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/*
 * 요청 추적 ID를 허용 형식의 수신 헤더 또는 새 UUID로 정하고 응답/MDC에 연결한다.
 * MDC는 서블릿 스레드에 묶이므로 finally에서 이전 값을 복원/제거해야 재사용 스레드에 이전 요청 정보가 남지 않는다.
 */

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
