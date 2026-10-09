package dev.scframework.reference.notices;
import static dev.scframework.reference.notices.NoticeDtos.*;
import dev.scframework.core.*;
import dev.scframework.core.audit.*;
import dev.scframework.reference.identity.*;
import dev.scframework.reference.kanban.KanbanAccessService;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 칸반 접근자에게 공지를 공개하고 작성자만 수정/삭제하도록 하는 업무 트랜잭션 경계다.
 * 목록은 검색 조건으로 JPA 조회하고 작성자 이름은 일괄 조회해 행마다 추가 질의하는 방식을 피한다.
 */
@Service @Transactional(readOnly=true)
public class NoticeService {
 private final KanbanAccessService access; private final NoticeRepository notices; private final UserRepository users; private final EntityManager em; private final Clock clock; private final SecurityAuditPublisher audit;
 public NoticeService(KanbanAccessService access,NoticeRepository notices,UserRepository users,EntityManager em,Clock clock,SecurityAuditPublisher audit) {this.access=access;this.notices=notices;this.users=users;this.em=em;this.clock=clock;this.audit=audit;}
 // 현재 칸반 접근을 확인하고 제목/본문에서 대소문자를 통일한 literal 부분 검색을 수행한다. %, _는 wildcard로 해석하지 않는다.
 public List<NoticeResponse> list(String q,Authentication authentication) {
  access.authorized(authentication);if(q==null||q.length()>200) throw invalid("검색어는 200자 이하입니다.");
  String literal=q.strip().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_");
  List<NoticeEntity> rows=notices.findAll((root,query,cb)->literal.isEmpty()?cb.conjunction():cb.or(cb.like(cb.lower(root.get("title")),"%"+literal+"%",'\\'),cb.like(cb.lower(root.get("content")),"%"+literal+"%",'\\')),Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id")));
  return responses(rows);
 }
 public NoticeResponse get(long id,Authentication authentication) {access.authorized(authentication);return responses(List.of(require(id))).getFirst();}
 // 작성자는 요청 body가 아니라 현재 인증 actor다. 본문은 보존하고 제목만 strip한 뒤 flush/감사 발행/DTO 변환을 수행한다.
 @Transactional public NoticeResponse create(NoticeInput input,Authentication authentication) {UserEntity actor=access.authorized(authentication);NoticeEntity row=new NoticeEntity(input.title().strip(),input.content(),actor.getId(),now());notices.save(row);em.flush();publish(actor,"NOTICE_CREATE",row.id);return responses(List.of(row)).getFirst();}
 // 접근 허용 → 작성자 확인 → revision 비교 → 변경/flush → 감사 순서다. 접근권한이 있어도 다른 작성자의 공지를 바꾸지는 못한다.
 @Transactional public NoticeResponse update(long id,NoticeUpdateInput input,Authentication authentication) {UserEntity actor=access.authorized(authentication);NoticeEntity row=require(id);own(row,actor);revision(row,input.revision());row.update(input.title().strip(),input.content(),now());em.flush();publish(actor,"NOTICE_UPDATE",id);return responses(List.of(row)).getFirst();}
 // 삭제에도 작성자 및 편집 기준 revision을 확인한다. delete+flush의 낙관적 경쟁 검사는 같은 트랜잭션에 참여한다.
 @Transactional public void delete(long id,int revision,Authentication authentication) {UserEntity actor=access.authorized(authentication);NoticeEntity row=require(id);own(row,actor);revision(row,revision);notices.delete(row);em.flush();publish(actor,"NOTICE_DELETE",id);}
 private NoticeEntity require(long id){return notices.findById(id).orElseThrow(()->new ApiException(404,"NOT_FOUND","공지를 찾을 수 없습니다."));}
 private static void own(NoticeEntity row,UserEntity actor){if(!row.authorId.equals(actor.getId()))throw new ApiException(403,"FORBIDDEN","작성자만 공지를 변경할 수 있습니다.");}
 // 버전 누락/비양수는 400 입력 오류, 현재 버전과 다르면 409 충돌로 구별한다. 프런트는 충돌 시 기존 폼 입력을 보존한다.
 private static void revision(NoticeEntity row,Integer revision){if(revision==null||revision<=0)throw invalid("공지 버전이 필요합니다.");if(row.revision!=revision)throw new ApiException(409,"REVISION_CONFLICT","다른 변경이 먼저 저장되었습니다. 새로 조회하세요.");}
 // 작성자 ID를 모아 한 번에 조회한 후 DTO를 만든다. 목록 행 수만큼 사용자 조회를 반복하지 않는다.
 private List<NoticeResponse> responses(List<NoticeEntity> rows){Map<Long,UserEntity> names=new HashMap<>();users.findAllById(rows.stream().map(row->row.authorId).distinct().toList()).forEach(user->names.put(user.getId(),user));return rows.stream().map(row->{UserEntity author=names.get(row.authorId);return new NoticeResponse(row.id,row.title,row.content,row.authorId,author.getDisplayName(),author.getUsername(),row.revision,row.createdAt.toString(),row.updatedAt.toString());}).toList();}
 private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MICROS);}
 private void publish(UserEntity actor,String action,long id){audit.publish(new SecurityAuditEvent(actor.getUsername(),actor.getId(),now(),action,"SUCCESS","NOTICE",Long.toString(id),null,null));}
 private static ApiException invalid(String message){return new ApiException(400,"INVALID_INPUT",message);}
}
