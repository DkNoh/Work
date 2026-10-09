package dev.scframework.autoconfigure.audit;

import dev.scframework.autoconfigure.web.RequestIdFilter;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import org.slf4j.MDC;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;

/*
 * 보안 필터/Advice에서 요청당 감사 한 건을 만드는 어댑터다. request attribute로 중복 기록을 막는다.
 * 인증 이름 또는 시도한 이름을 허용 형식으로 제한하고 requestId/reasonCode도 정제해 publisher에 전달한다.
 * publisher 실패는 진단만 남기며 인증/업무 응답을 뒤집지 않는다.
 */

/** 필터/Advice의 요청당 오류 수집 경계. body/query/cookie/token·예외 message를 읽지 않는다. */
public final class RequestAuditRecorder {
    private static final String CAPTURED = RequestAuditRecorder.class.getName() + ".captured";
    private final SecurityAuditPublisher publisher;
    private final Clock clock;
    private final AuditWriteDiagnostics diagnostics;

    public RequestAuditRecorder(SecurityAuditPublisher publisher, Clock clock, AuditWriteDiagnostics diagnostics) {
        this.publisher = publisher;
        this.clock = clock;
        this.diagnostics = diagnostics;
    }

    // 요청 attribute를 먼저 표시해 필터와 Advice가 같은 실패를 이중 감사하지 않게 한다. 행위자와 추적 ID는 형식 검사 후 사용한다.
    public void record(HttpServletRequest request, Authentication authentication,
            String attemptedSubject, String action, String outcome, String reasonCode) {
        if (Boolean.TRUE.equals(request.getAttribute(CAPTURED))) return;
        request.setAttribute(CAPTURED, true);
        String subject = attemptedSubject;
        if (subject == null && authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)) subject = authentication.getName();
        if (subject == null || !subject.matches("[A-Za-z0-9._@-]{1,64}")) subject = "ANONYMOUS";
        String requestId = MDC.get(RequestIdFilter.MDC_KEY);
        if (requestId != null && !requestId.matches("[A-Za-z0-9_-]{1,64}")) requestId = null;
        if (reasonCode == null || !reasonCode.matches("[A-Z][A-Z0-9_]{0,63}")) reasonCode = "REQUEST_FAILED";
        try {
            publisher.publish(new SecurityAuditEvent(subject, null, clock.instant(), action,
                    outcome, "HTTP", null, requestId, reasonCode));
        } catch (RuntimeException exception) {
            // 소비 publisher의 실패도 이미 정해진 로그인/업무 HTTP 결과를 바꾸지 않는다.
            diagnostics.failed();
        }
    }
}
