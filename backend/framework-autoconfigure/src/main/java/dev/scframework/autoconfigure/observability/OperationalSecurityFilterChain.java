package dev.scframework.autoconfigure.observability;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.security.web.SecurityFilterChain;

/*
 * observer 전용 SecurityFilterChain을 감싸 일반 앱 security 자동설정의 backoff와 구분하는 표식 타입이다.
 * matches/getFilters는 delegate에 그대로 위임하며 이 클래스 자체는 새 인증/인가 규칙을 만들지 않는다.
 */

/** 일반 앱 security의 backoff를 유발하지 않는 별도 관측 chain 타입이다. */
public final class OperationalSecurityFilterChain implements SecurityFilterChain {
    private final SecurityFilterChain delegate;
    public OperationalSecurityFilterChain(SecurityFilterChain delegate) { this.delegate = delegate; }
    @Override public boolean matches(HttpServletRequest request) { return delegate.matches(request); }
    @Override public List<Filter> getFilters() { return delegate.getFilters(); }
}
