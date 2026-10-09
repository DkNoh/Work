package dev.scframework.autoconfigure.observability;

import dev.scframework.core.operations.OperationalEvent;
import dev.scframework.core.operations.OperationalEventSink;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/*
 * API 요청 완료 여부와 HTTP 상태를 고정 SUCCESS/FAILURE 관측 이벤트로 변환한다.
 * finally에서 기록해 예외로 끝난 요청도 반영하고, sink 실패는 기존 Servlet 응답/예외 흐름을 보존한다.
 */

/** HTTP trace가 활성인 동안 고정 결과 코드만 기록한다. URI·입력·identity는 기록하지 않는다. */
public final class SafeHttpEventFilter extends OncePerRequestFilter {
    private final OperationalEventSink events;
    public SafeHttpEventFilter(OperationalEventSink events) { this.events = events; }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        boolean completed = false;
        try { chain.doFilter(request, response); completed = true; }
        finally {
            try {
                events.record(new OperationalEvent(OperationalEvent.Kind.HTTP_REQUEST,
                        completed && response.getStatus() < 400 ? OperationalEvent.Outcome.SUCCESS : OperationalEvent.Outcome.FAILURE,
                        null));
            } catch (RuntimeException ignored) { /* 교체한 관측 sink의 실패가 HTTP 결과를 바꾸지 않는다. */ }
        }
    }
}
