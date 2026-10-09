package __JAVA_PACKAGE__.notes;
import com.querydsl.jpa.impl.JPAQueryFactory;
import dev.scframework.core.ApiException;
import dev.scframework.core.audit.SecurityAuditEvent;
import dev.scframework.core.audit.SecurityAuditPublisher;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class NoteService {
    private final NoteRepository repository;private final JPAQueryFactory query;private final NoteReadMapper mapper;
    private final NoteSqlMapper sql;private final SecurityAuditPublisher audit;private final Clock clock;
    public NoteService(NoteRepository repository,JPAQueryFactory query,NoteReadMapper mapper,NoteSqlMapper sql,SecurityAuditPublisher audit,Clock clock) {
        this.repository=repository;this.query=query;this.mapper=mapper;this.sql=sql;this.audit=audit;this.clock=clock;
    }
    private String actor(Authentication authentication) {
        if (authentication==null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) throw new ApiException(401,"AUTH_REQUIRED","로그인이 필요합니다.");
        return authentication.getName();
    }
    @Transactional(readOnly=true)
    public NoteDtos.Page list(Authentication authentication,String q,int page,int size) {
        String owner=actor(authentication);QNoteEntity note=QNoteEntity.noteEntity;
        var predicate=note.owner.eq(owner);
        if (q!=null && !q.isBlank()) {
            String literal=q.toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_");
            predicate=predicate.and(note.title.lower().like("%"+literal+"%",'!'));
        }
        var items=query.selectFrom(note).where(predicate).orderBy(note.updatedAt.desc(),note.id.desc()).offset((long)page*size).limit(size).fetch().stream().map(mapper::read).toList();
        Long count=query.select(note.count()).from(note).where(predicate).fetchOne();
        return new NoteDtos.Page(items,count==null?0:count,page,size);
    }
    @Transactional(readOnly=true) public NoteDtos.Response detail(Authentication authentication,long id) { return mapper.read(require(id,actor(authentication))); }
    @Transactional(readOnly=true) public NoteDtos.Stats stats(Authentication authentication) { return sql.stats(actor(authentication)); }
    @Transactional
    public NoteDtos.Command create(Authentication authentication,NoteDtos.Create input) {
        String owner=actor(authentication);NoteEntity note=new NoteEntity(input.title().trim(),owner,clock.instant().truncatedTo(ChronoUnit.MICROS));
        repository.saveAndFlush(note);
        // JPA flush 뒤 같은 DataSource/JpaTM의 MyBatis 읽기를 실제 응답에 사용한다.
        NoteDtos.Stats stats=sql.stats(owner);publish(owner,"NOTE_CREATE",note);return new NoteDtos.Command(mapper.read(note),stats);
    }
    @Transactional
    public NoteDtos.Command update(Authentication authentication,long id,NoteDtos.Update input) {
        String owner=actor(authentication);NoteEntity note=require(id,owner);
        if(note.getRevision()!=input.revision()) throw new ApiException(409,"REVISION_CONFLICT","다른 변경이 있습니다. 입력을 보존하고 다시 조회하세요.");
        note.rename(input.title().trim(),clock.instant().truncatedTo(ChronoUnit.MICROS));repository.flush();
        NoteDtos.Stats stats=sql.stats(owner);publish(owner,"NOTE_UPDATE",note);return new NoteDtos.Command(mapper.read(note),stats);
    }
    private NoteEntity require(long id,String owner) {
        NoteEntity note=repository.findById(id).orElseThrow(()->new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다."));
        if(!owner.equals(note.getOwner())) throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다.");return note;
    }
    private void publish(String owner,String action,NoteEntity note) { audit.publish(new SecurityAuditEvent(owner,null,clock.instant(),action,"SUCCESS","NOTE",Long.toString(note.getId()),null,null)); }
}
