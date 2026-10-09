package __JAVA_PACKAGE__.notes;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/*
 * MyBatis XML의 owner별 Notes 집계 SQL을 호출하는 인터페이스다. @Param은 XML의 파라미터 이름을 고정한다.
 * MapStruct NoteReadMapper와 구분한다. JPA 쓰기 뒤 이 조회를 사용할 때는 Service에서 먼저 flush한다.
 */
@Mapper
public interface NoteSqlMapper { NoteDtos.Stats stats(@Param("owner") String owner); }
