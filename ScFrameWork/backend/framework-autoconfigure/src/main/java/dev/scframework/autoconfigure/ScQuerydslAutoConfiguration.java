package dev.scframework.autoconfigure;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManagerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnSingleCandidate;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.orm.jpa.SharedEntityManagerCreator;

/** 앱의 JPA 트랜잭션에 참여하는 공유 proxy를 사용한다. 업무 predicate는 앱이 소유한다. */
@AutoConfiguration(after = HibernateJpaAutoConfiguration.class)
@ConditionalOnClass({JPAQueryFactory.class, EntityManagerFactory.class})
@ConditionalOnSingleCandidate(EntityManagerFactory.class)
public class ScQuerydslAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean(JPAQueryFactory.class)
    JPAQueryFactory scJpaQueryFactory(EntityManagerFactory factory) {
        return new JPAQueryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory));
    }
}
