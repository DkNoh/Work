package __JAVA_PACKAGE__.notes;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
@Mapper
public interface NoteSqlMapper { NoteDtos.Stats stats(@Param("owner") String owner); }
