package dev.scframework.reference.reports;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;

/**
 * 복잡 집계를 실행하는 실제 MyBatis Mapper다. XML SQL에서 행 목록과 상태 통계를 조회하며 Entity 쓰기는 수행하지 않는다.
 * 같은 DataSource/JpaTransactionManager를 사용하지만 MyBatis가 JPA 영속성 컨텍스트를 자동 flush해 주는 것은 아니다.
 */

/** 같은 DataSource/JpaTransactionManager를 소비하는 복잡 조회 전용 Mapper. */
@Mapper
public interface RequirementReportSqlMapper {
    // SQL 정의는 앱 resources의 Mapper XML을 따른다. Service가 같은 criteria로 stats와 page를 호출해 공개 조건의 차이를 막는다.
    List<RequirementReportRows.ItemRow> selectPage(RequirementReportRows.Criteria criteria);
    RequirementReportRows.StatsRow selectStats(RequirementReportRows.Criteria criteria);
}
