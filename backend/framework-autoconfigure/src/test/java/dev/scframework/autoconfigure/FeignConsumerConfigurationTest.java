package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;

import dev.scframework.autoconfigure.integration.FeignCallBoundary;
import feign.RequestInterceptor;
import feign.Retryer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class FeignConsumerConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ScFeignAutoConfiguration.class));

    @Test void feignCanBeAbsentInAMinimalConsumer() {
        runner.withClassLoader(new FilteredClassLoader("feign"))
                .run(context -> assertThat(context).hasNotFailed().doesNotHaveBean("scFeignRetryer")
                        .doesNotHaveBean("scFeignCallBoundary").doesNotHaveBean("scFeignRequestIdInterceptor"));
    }

    @Test void explicitConsumerRetryAndFailureAndHeaderPoliciesBackOffDefaults() {
        Retryer retry = new Retryer.Default();
        FeignCallBoundary boundary = new FeignCallBoundary();
        RequestInterceptor interceptor = template -> template.header("X-Consumer", "explicit");
        runner.withBean(Retryer.class, () -> retry).withBean(FeignCallBoundary.class, () -> boundary)
                .withBean("scFeignRequestIdInterceptor", RequestInterceptor.class, () -> interceptor)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(Retryer.class)
                            .hasSingleBean(FeignCallBoundary.class).hasSingleBean(RequestInterceptor.class)
                            .doesNotHaveBean("scFeignRetryer").doesNotHaveBean("scFeignCallBoundary");
                    assertThat(context.getBean(Retryer.class)).isSameAs(retry);
                    assertThat(context.getBean(FeignCallBoundary.class)).isSameAs(boundary);
                    assertThat(context.getBean(RequestInterceptor.class)).isSameAs(interceptor);
                });
    }
}
