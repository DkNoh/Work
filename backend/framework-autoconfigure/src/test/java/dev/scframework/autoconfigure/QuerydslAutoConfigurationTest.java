package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class QuerydslAutoConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ScQuerydslAutoConfiguration.class));

    @Test void noPersistenceOrOptionalLibraryDoesNotCreateAFactory() {
        runner.run(context -> assertThat(context).hasNotFailed().doesNotHaveBean(JPAQueryFactory.class));
        runner.withClassLoader(new FilteredClassLoader("com.querydsl"))
                .withBean(EntityManagerFactory.class, () -> mock(EntityManagerFactory.class))
                .run(context -> assertThat(context).hasNotFailed().doesNotHaveBean("scJpaQueryFactory"));
    }

    @Test void singlePersistenceFactoryEnablesTheSharedConsumerBean() {
        runner.withBean(EntityManagerFactory.class, () -> mock(EntityManagerFactory.class))
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(JPAQueryFactory.class)
                        .hasBean("scJpaQueryFactory"));
    }

    @Test void multipleDatabasesRequireAnExplicitPrimaryOrConsumerFactory() {
        runner.withBean("first", EntityManagerFactory.class, () -> mock(EntityManagerFactory.class))
                .withBean("second", EntityManagerFactory.class, () -> mock(EntityManagerFactory.class))
                .run(context -> assertThat(context).hasNotFailed().doesNotHaveBean(JPAQueryFactory.class));
        runner.withBean("first", EntityManagerFactory.class, () -> mock(EntityManagerFactory.class),
                        definition -> definition.setPrimary(true))
                .withBean("second", EntityManagerFactory.class, () -> mock(EntityManagerFactory.class))
                .run(context -> assertThat(context).hasNotFailed().hasSingleBean(JPAQueryFactory.class));
    }

    @Test void consumersCanReplaceTheFactoryWithoutBeanOverride() {
        JPAQueryFactory custom = new JPAQueryFactory(mock(EntityManager.class));
        runner.withBean(EntityManagerFactory.class, () -> mock(EntityManagerFactory.class))
                .withBean(JPAQueryFactory.class, () -> custom).run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(JPAQueryFactory.class)
                            .doesNotHaveBean("scJpaQueryFactory");
                    assertThat(context.getBean(JPAQueryFactory.class)).isSameAs(custom);
                });
    }
}
