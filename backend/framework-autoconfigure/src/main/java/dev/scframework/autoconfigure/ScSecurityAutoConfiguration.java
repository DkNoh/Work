package dev.scframework.autoconfigure;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.ApiError;
import dev.scframework.autoconfigure.audit.RequestAuditRecorder;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import dev.scframework.autoconfigure.observability.OperationalSecurityFilterChain;

/*
 * Servlet 앱의 기본 세션 인증과 CSRF 필터 체인을 구성한다. 앱의 명시적 인증 어댑터를 요구한다.
 * 로그인/로그아웃은 HTML redirect 대신 204를, 거부는 code/message/errors JSON을 반환한다.
 * 업무 API의 인증은 여기서, 자원 소유자/상태 전이 같은 업무 권한은 각 앱 Service에서 검사한다.
 */

@AutoConfiguration(before = {SecurityAutoConfiguration.class, UserDetailsServiceAutoConfiguration.class})
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class ScSecurityAutoConfiguration {
    @Bean @ConditionalOnMissingBean
    PasswordEncoder scPasswordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean @ConditionalOnMissingBean(value = {UserDetailsService.class, SecurityFilterChain.class}, ignored = OperationalSecurityFilterChain.class)
    UserDetailsService scRequiredUserDetailsService() {
        // Boot의 임의 사용자/비밀번호 로그 대신 소비 앱의 명시적 인증 어댑터를 요구한다.
        throw new IllegalStateException("Supply a UserDetailsService; generated/default passwords are disabled");
    }

    @Bean @ConditionalOnMissingBean(value = SecurityFilterChain.class, ignored = OperationalSecurityFilterChain.class)
    // HttpSession 기반 CSRF를 유지하고 API는 인증을 요구한다. dev 문서 공개와 운영 문서 차단도 이 체인에서 결정한다.
    SecurityFilterChain scSecurityFilterChain(HttpSecurity http, ObjectMapper mapper,
            Environment environment, UserDetailsService users,
            ObjectProvider<RequestAuditRecorder> audit) throws Exception {
        boolean dev = environment.acceptsProfiles(Profiles.of("dev"));
        http.csrf(csrf -> csrf.csrfTokenRepository(new HttpSessionCsrfTokenRepository())
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(authorize -> {
                    authorize.requestMatchers("/api/health", "/api/auth/csrf", "/api/auth/login", "/error", "/actuator/health", "/actuator/health/**").permitAll();
                    if (dev) authorize.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/swagger-csrf.js").permitAll();
                    else authorize.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/swagger-csrf.js").denyAll();
                    authorize.requestMatchers("/api/**").authenticated()
                            .requestMatchers("/actuator/**").hasRole("ADMIN").anyRequest().permitAll();
                })
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> {
                            audit.ifAvailable(recorder -> recorder.record(request, null, null, "HTTP_ACCESS", "DENIED", "AUTH_REQUIRED"));
                            writeError(mapper, response, 401, "AUTH_REQUIRED", "로그인이 필요합니다.");
                        })
                        .accessDeniedHandler((request, response, error) -> {
                            String code = error instanceof CsrfException ? "CSRF" : "FORBIDDEN";
                            audit.ifAvailable(recorder -> recorder.record(request,
                                    org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication(),
                                    null, "HTTP_ACCESS", "DENIED", code));
                            writeError(mapper, response, 403, code,
                                    error instanceof CsrfException ? "CSRF 토큰을 갱신해 주세요." : "요청 권한이 없습니다.");
                        }))
                .formLogin(login -> login.loginProcessingUrl("/api/auth/login")
                        .successHandler((request, response, authentication) -> {
                            audit.ifAvailable(recorder -> recorder.record(request, authentication, null, "AUTH_LOGIN", "SUCCESS", "OK"));
                            response.setStatus(204);
                        })
                        .failureHandler((request, response, error) -> {
                            audit.ifAvailable(recorder -> recorder.record(request, null, request.getParameter("username"), "AUTH_LOGIN", "FAILURE", "AUTH_FAILED"));
                            writeError(mapper, response, 401, "AUTH_FAILED", "아이디 또는 비밀번호를 확인해 주세요.");
                        }))
                .logout(logout -> logout.logoutUrl("/api/auth/logout").invalidateHttpSession(true)
                        .deleteCookies("JSESSIONID").logoutSuccessHandler((request, response, authentication) -> {
                            audit.ifAvailable(recorder -> recorder.record(request, authentication, null, "AUTH_LOGOUT", "SUCCESS", "OK"));
                            response.setStatus(204);
                        }));
        return http.build();
    }

    // 보안 필터의 실패는 MVC Advice 이전에 발생하므로 같은 ApiError JSON을 이 위치에서 직접 쓴다.
    private static void writeError(ObjectMapper mapper, HttpServletResponse response, int status,
            String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getOutputStream(), ApiError.of(code, message));
    }
}
