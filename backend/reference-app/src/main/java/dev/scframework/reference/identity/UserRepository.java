package dev.scframework.reference.identity;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

/**
 * 사용자명 인증 조회·표시 이름 순 lookup과 비밀번호 변경 잠금을 제공한다.
 * findForPasswordChange의 쓰기 잠금은 현재 비밀번호 확인과 새 해시 변경 사이의 경쟁을 직렬화한다.
 */

public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
    List<UserEntity> findAllByOrderByDisplayNameAsc();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserEntity u where u.id = :id")
    Optional<UserEntity> findForPasswordChange(@Param("id") long id);
}
