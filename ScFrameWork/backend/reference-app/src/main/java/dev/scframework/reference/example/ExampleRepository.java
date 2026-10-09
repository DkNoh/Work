package dev.scframework.reference.example;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 단순 목록/단건/쓰기의 JPA 진입점이다. 업무 트랜잭션은 ExampleService가 열며 DB 스키마는 앱 migration이 소유한다.
 */

public interface ExampleRepository extends JpaRepository<ExampleEntry, Long> {}
