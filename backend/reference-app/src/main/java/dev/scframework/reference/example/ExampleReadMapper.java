package dev.scframework.reference.example;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 동일 DataSource/트랜잭션에서 MyBatis 조회가 연결되는지 확인하는 최소 Mapper다.
 * 실제 SQL을 실행하므로 JPA 변경 직후 호출할 때는 호출자가 먼저 flush해야 아직 메모리에만 있는 변경을 놓치지 않는다.
 */

/** 001은 동일 트랜잭션의 조회 연결을 검증한다. 실제 복잡 조회는 후속 단계에서 추가한다. */
@Mapper
public interface ExampleReadMapper {
    @Select("SELECT title FROM example_entry WHERE id = #{id}")
    String findTitle(@Param("id") long id);

    @Select("SELECT COUNT(*) FROM example_entry")
    long countEntries();
}
