package dev.scframework.reference.reports;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;

/** 같은 DataSource/JpaTransactionManager를 소비하는 복잡 조회 전용 Mapper. */
@Mapper
public interface RequirementReportSqlMapper {
    List<RequirementReportRows.ItemRow> selectPage(RequirementReportRows.Criteria criteria);
    RequirementReportRows.StatsRow selectStats(RequirementReportRows.Criteria criteria);
}
