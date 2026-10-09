package __JAVA_PACKAGE__.notes;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

/*
 * MapStruct가 빌드 시 구현을 생성하는 엔티티→응답 DTO 매퍼다. DB 조회용 MyBatis Mapper와 다른 역할이다.
 * componentModel=spring으로 주입 가능하며 unmappedTargetPolicy=ERROR는 응답 필드가 빠지면 컴파일을 실패시킨다.
 */
@Mapper(componentModel="spring",unmappedTargetPolicy=ReportingPolicy.ERROR)
public interface NoteReadMapper { NoteDtos.Response read(NoteEntity note); }
