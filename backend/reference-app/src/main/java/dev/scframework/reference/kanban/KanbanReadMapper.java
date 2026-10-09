package dev.scframework.reference.kanban;

import java.time.Instant;
import java.util.List;
import org.mapstruct.*;

/**
 * MapStruct 변환기이며 SQL을 실행하는 MyBatis Mapper가 아니다.
 * Service가 조회한 사용자 이름·태그·canRename을 받아 공개 응답을 구성하고 시각만 UTC 문자열로 바꾼다.
 */

/** 읽기만 변환한다. 작성자·권한·순서·변경은 Service의 책임이다. */
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface KanbanReadMapper {
    @Mapping(target = "authorName", source = "authorName") @Mapping(target = "authorUsername", source = "authorUsername")
    @Mapping(target = "assigneeName", source = "assigneeName") @Mapping(target = "assigneeUsername", source = "assigneeUsername")
    @Mapping(target = "tags", source = "tags")
    @Mapping(target = "createdAt", source = "task.createdAt", qualifiedByName = "utc")
    @Mapping(target = "updatedAt", source = "task.updatedAt", qualifiedByName = "utc")
    @Mapping(target = "completedAt", source = "task.completedAt", qualifiedByName = "utc")
    KanbanDtos.TaskResponse task(KanbanTaskEntity task, String authorName, String authorUsername, String assigneeName, String assigneeUsername, List<String> tags);
    @Mapping(target = "authorName", source = "authorName") @Mapping(target = "authorUsername", source = "authorUsername")
    @Mapping(target = "canRename", source = "canRename")
    @Mapping(target = "createdAt", source = "board.createdAt", qualifiedByName = "utc")
    @Mapping(target = "updatedAt", source = "board.updatedAt", qualifiedByName = "utc")
    KanbanDtos.BoardResponse board(KanbanBoardEntity board, String authorName, String authorUsername, boolean canRename);
    @Named("utc") default String utc(Instant value) { return value == null ? null : value.toString(); }
}
