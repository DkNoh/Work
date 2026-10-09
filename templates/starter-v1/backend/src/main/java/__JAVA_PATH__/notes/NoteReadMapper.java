package __JAVA_PACKAGE__.notes;
import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;
@Mapper(componentModel="spring",unmappedTargetPolicy=ReportingPolicy.ERROR)
public interface NoteReadMapper { NoteDtos.Response read(NoteEntity note); }
