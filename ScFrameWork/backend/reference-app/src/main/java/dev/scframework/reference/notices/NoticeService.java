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
@Service @Transactional(readOnly=true)
public class NoticeService {
 private final KanbanAccessService access; private final NoticeRepository notices; private final UserRepository users; private final EntityManager em; private final Clock clock; private final SecurityAuditPublisher audit;
 public NoticeService(KanbanAccessService access,NoticeRepository notices,UserRepository users,EntityManager em,Clock clock,SecurityAuditPublisher audit) {this.access=access;this.notices=notices;this.users=users;this.em=em;this.clock=clock;this.audit=audit;}
 public List<NoticeResponse> list(String q,Authentication authentication) {
  access.authorized(authentication);if(q==null||q.length()>200) throw invalid("검색어는 200자 이하입니다.");
  String literal=q.strip().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_");
  List<NoticeEntity> rows=notices.findAll((root,query,cb)->literal.isEmpty()?cb.conjunction():cb.or(cb.like(cb.lower(root.get("title")),"%"+literal+"%",'\\'),cb.like(cb.lower(root.get("content")),"%"+literal+"%",'\\')),Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id")));
  return responses(rows);
 }
 public NoticeResponse get(long id,Authentication authentication) {access.authorized(authentication);return responses(List.of(require(id))).getFirst();}
 @Transactional public NoticeResponse create(NoticeInput input,Authentication authentication) {UserEntity actor=access.authorized(authentication);NoticeEntity row=new NoticeEntity(input.title().strip(),input.content(),actor.getId(),now());notices.save(row);em.flush();publish(actor,"NOTICE_CREATE",row.id);return responses(List.of(row)).getFirst();}
 @Transactional public NoticeResponse update(long id,NoticeUpdateInput input,Authentication authentication) {UserEntity actor=access.authorized(authentication);NoticeEntity row=require(id);own(row,actor);revision(row,input.revision());row.update(input.title().strip(),input.content(),now());em.flush();publish(actor,"NOTICE_UPDATE",id);return responses(List.of(row)).getFirst();}
 @Transactional public void delete(long id,int revision,Authentication authentication) {UserEntity actor=access.authorized(authentication);NoticeEntity row=require(id);own(row,actor);revision(row,revision);notices.delete(row);em.flush();publish(actor,"NOTICE_DELETE",id);}
 private NoticeEntity require(long id){return notices.findById(id).orElseThrow(()->new ApiException(404,"NOT_FOUND","공지를 찾을 수 없습니다."));}
 private static void own(NoticeEntity row,UserEntity actor){if(!row.authorId.equals(actor.getId()))throw new ApiException(403,"FORBIDDEN","작성자만 공지를 변경할 수 있습니다.");}
 private static void revision(NoticeEntity row,Integer revision){if(revision==null||revision<=0)throw invalid("공지 버전이 필요합니다.");if(row.revision!=revision)throw new ApiException(409,"REVISION_CONFLICT","다른 변경이 먼저 저장되었습니다. 새로 조회하세요.");}
 private List<NoticeResponse> responses(List<NoticeEntity> rows){Map<Long,UserEntity> names=new HashMap<>();users.findAllById(rows.stream().map(row->row.authorId).distinct().toList()).forEach(user->names.put(user.getId(),user));return rows.stream().map(row->{UserEntity author=names.get(row.authorId);return new NoticeResponse(row.id,row.title,row.content,row.authorId,author.getDisplayName(),author.getUsername(),row.revision,row.createdAt.toString(),row.updatedAt.toString());}).toList();}
 private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MICROS);}
 private void publish(UserEntity actor,String action,long id){audit.publish(new SecurityAuditEvent(actor.getUsername(),actor.getId(),now(),action,"SUCCESS","NOTICE",Long.toString(id),null,null));}
 private static ApiException invalid(String message){return new ApiException(400,"INVALID_INPUT",message);}
}
