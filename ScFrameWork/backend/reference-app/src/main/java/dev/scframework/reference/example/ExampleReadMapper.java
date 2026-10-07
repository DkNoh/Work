package dev.scframework.reference.example;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** 001은 동일 트랜잭션의 조회 연결을 검증한다. 실제 복잡 조회는 후속 단계에서 추가한다. */
@Mapper
public interface ExampleReadMapper {
    @Select("SELECT title FROM example_entry WHERE id = #{id}")
    String findTitle(@Param("id") long id);

    @Select("SELECT COUNT(*) FROM example_entry")
    long countEntries();
}
