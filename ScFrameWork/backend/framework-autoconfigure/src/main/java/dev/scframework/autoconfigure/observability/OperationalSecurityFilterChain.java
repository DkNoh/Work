package dev.scframework.autoconfigure.observability;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.security.web.SecurityFilterChain;

/** 일반 앱 security의 backoff를 유발하지 않는 별도 관측 chain 타입이다. */
public final class OperationalSecurityFilterChain implements SecurityFilterChain {
    private final SecurityFilterChain delegate;
    public OperationalSecurityFilterChain(SecurityFilterChain delegate) { this.delegate = delegate; }
    @Override public boolean matches(HttpServletRequest request) { return delegate.matches(request); }
    @Override public List<Filter> getFilters() { return delegate.getFilters(); }
}
