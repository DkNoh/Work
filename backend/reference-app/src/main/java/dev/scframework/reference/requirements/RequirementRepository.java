package dev.scframework.reference.requirements;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 단건 조회와 쓰기를 위한 JPA 저장소다. 동적 목록은 RequirementQueryRepository, 복잡 집계는 reports의 MyBatis Mapper로 분리한다.
 */

public interface RequirementRepository extends JpaRepository<RequirementEntity, Long> {}
