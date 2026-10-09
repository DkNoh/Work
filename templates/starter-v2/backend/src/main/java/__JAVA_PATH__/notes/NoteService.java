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

/*
 * Notes의 인증·소유자 범위·동시 변경·트랜잭션을 소유하는 앱 Service다. UI 표시 여부에 권한 검사를 맡기지 않는다.
 * Querydsl은 owner+검색 동적 목록, JPA는 쓰기, MyBatis는 집계를 맡고 같은 앱 DS/JpaTM을 사용한다.
 * 쓰기 후 flush해 SQL을 DB에 반영한 다음 Mapper 집계를 읽는다. flush는 commit이 아니므로 뒤 실패 시 TX rollback 대상이다.
 */
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
    // 소유자 predicate는 검색 유무와 무관하게 항상 적용한다. %, _, !를 escape해 검색 문자열을 LIKE 와일드카드로 해석하지 않는다.
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
    // JPA saveAndFlush는 INSERT를 먼저 실행해 ID/행을 같은 DB 연결의 MyBatis 통계에 보이게 한다. 아직 업무 commit 전이다.
    public NoteDtos.Command create(Authentication authentication,NoteDtos.Create input) {
        String owner=actor(authentication);NoteEntity note=new NoteEntity(input.title().trim(),owner,clock.instant().truncatedTo(ChronoUnit.MICROS));
        repository.saveAndFlush(note);
        // JPA flush 뒤 같은 DataSource/JpaTM의 MyBatis 읽기를 실제 응답에 사용한다.
        NoteDtos.Stats stats=sql.stats(owner);publish(owner,"NOTE_CREATE",note);return new NoteDtos.Command(mapper.read(note),stats);
    }
    @Transactional
    // 입력 revision 확인 뒤 관리 엔티티를 변경하고 flush한다. 실제 DB 경쟁 갱신은 @Version이 한 번 더 검출한다.
    public NoteDtos.Command update(Authentication authentication,long id,NoteDtos.Update input) {
        String owner=actor(authentication);NoteEntity note=require(id,owner);
        if(note.getRevision()!=input.revision()) throw new ApiException(409,"REVISION_CONFLICT","다른 변경이 있습니다. 입력을 보존하고 다시 조회하세요.");
        note.rename(input.title().trim(),clock.instant().truncatedTo(ChronoUnit.MICROS));repository.flush();
        NoteDtos.Stats stats=sql.stats(owner);publish(owner,"NOTE_UPDATE",note);return new NoteDtos.Command(mapper.read(note),stats);
    }
    // 존재하지 않거나 다른 사용자의 자료이면 동일 404를 반환해 ID만으로 타인 자료 존재를 노출하지 않는다.
    private NoteEntity require(long id,String owner) {
        NoteEntity note=repository.findById(id).orElseThrow(()->new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다."));
        if(!owner.equals(note.getOwner())) throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다.");return note;
    }
    // 고정 action과 note ID만 감사에 전달한다. 제목 원문이나 전체 엔티티를 감사 payload로 보내지 않는다.
    private void publish(String owner,String action,NoteEntity note) { audit.publish(new SecurityAuditEvent(owner,null,clock.instant(),action,"SUCCESS","NOTE",Long.toString(note.getId()),null,null)); }
}
