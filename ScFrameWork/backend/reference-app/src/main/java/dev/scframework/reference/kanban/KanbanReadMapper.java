package dev.scframework.reference.kanban;

import java.time.Instant;
import java.util.List;
import org.mapstruct.*;

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
