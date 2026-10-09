package dev.scframework.reference.documents;
import static dev.scframework.reference.documents.DocumentDtos.*;
import dev.scframework.core.ApiException;
import dev.scframework.core.audit.*;
import dev.scframework.reference.identity.*;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 개인 문서 작성자 경계를 읽기와 쓰기 모두에 적용한다. 등록/수정 때는 서버 DocumentGrammar 검증 결과만 저장한다.
 * 프런트 편집기 검증을 통과했더라도 서버에서 다시 검사하고 revision 충돌 시 기존 문서와 입력을 강제로 병합하지 않는다.
 */
@Service @Transactional(readOnly=true)
public class DocumentService {
 private final ActorResolver actors;private final DocumentRepository documents;private final DocumentGrammar grammar;private final EntityManager em;private final Clock clock;private final SecurityAuditPublisher audit;
 public DocumentService(ActorResolver actors,DocumentRepository documents,DocumentGrammar grammar,EntityManager em,Clock clock,SecurityAuditPublisher audit){this.actors=actors;this.documents=documents;this.grammar=grammar;this.em=em;this.clock=clock;this.audit=audit;}
 // actor ID 조건으로 처음부터 본인 문서만 조회한다. 전체 목록을 가져와 프런트에서 숨기는 방식으로 비공개 문서를 보호하지 않는다.
 public List<DocumentSummary> list(Authentication authentication){UserEntity actor=actors.require(authentication);return documents.findByAuthorIdOrderByUpdatedAtDescIdDesc(actor.getId()).stream().map(row->new DocumentSummary(row.id,row.title,row.revision,row.authorId,actor.getDisplayName(),row.createdAt.toString(),row.updatedAt.toString())).toList();}
 // 단건 ID 요청도 작성자 확인을 거친다. ADMIN 우회 허용을 두지 않는 개인 문서 계약이다.
 public DocumentResponse get(long id,Authentication authentication){UserEntity actor=actors.require(authentication);DocumentEntity row=require(id);own(row,actor);return response(row,actor);}
 // 허용 문법을 검사/정규화한 JSON만 저장한다. 입력의 authorId를 받지 않고 인증 actor로 작성자를 지정한다.
 @Transactional public DocumentResponse create(DocumentInput input,Authentication authentication){UserEntity actor=actors.require(authentication);String document=grammar.validate(input.documentJson());DocumentEntity row=new DocumentEntity(input.title().strip(),document,actor.getId(),now());documents.save(row);em.flush();publish(actor,"DOCUMENT_CREATE",row.id);return response(row,actor);}
 // 작성자와 revision 확인 후 문법 검증·변경·flush를 수행한다. 실패하면 트랜잭션 rollback되고 기존 문서가 보존된다.
 @Transactional public DocumentResponse update(long id,DocumentUpdateInput input,Authentication authentication){UserEntity actor=actors.require(authentication);DocumentEntity row=require(id);own(row,actor);revision(row,input.revision());String document=grammar.validate(input.documentJson());row.update(input.title().strip(),document,now());em.flush();publish(actor,"DOCUMENT_UPDATE",id);return response(row,actor);}
 // 작성자/기준 revision 확인 후 삭제를 flush하고 감사 발행한다. flush 뒤에도 최종 commit 전 실패하면 삭제는 rollback된다.
 @Transactional public void delete(long id,int revision,Authentication authentication){UserEntity actor=actors.require(authentication);DocumentEntity row=require(id);own(row,actor);revision(row,revision);documents.delete(row);em.flush();publish(actor,"DOCUMENT_DELETE",id);}
 private DocumentEntity require(long id){return documents.findById(id).orElseThrow(()->new ApiException(404,"NOT_FOUND","문서를 찾을 수 없습니다."));}
 private static void own(DocumentEntity row,UserEntity actor){if(!row.authorId.equals(actor.getId()))throw new ApiException(403,"FORBIDDEN","작성자만 문서에 접근할 수 있습니다.");}
 // 버전이 없는 요청은 400, 이미 바뀐 버전은 409다. 프런트의 오래된 입력을 최신 revision으로 자동 덮어쓰지 않는다.
 private static void revision(DocumentEntity row,Integer revision){if(revision==null||revision<=0)throw new ApiException(400,"INVALID_INPUT","문서 버전이 필요합니다.");if(row.revision!=revision)throw new ApiException(409,"REVISION_CONFLICT","다른 변경이 먼저 저장되었습니다. 새로 조회하세요.");}
 private static DocumentResponse response(DocumentEntity row,UserEntity actor){return new DocumentResponse(row.id,row.title,row.documentJson,row.revision,row.authorId,actor.getDisplayName(),row.createdAt.toString(),row.updatedAt.toString());}
 private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MICROS);}
 // 문서 본문/JSON을 감사 이벤트에 복사하지 않고 actor와 DOCUMENT ID/행동 코드만 기록한다.
 private void publish(UserEntity actor,String action,long id){audit.publish(new SecurityAuditEvent(actor.getUsername(),actor.getId(),now(),action,"SUCCESS","DOCUMENT",Long.toString(id),null,null));}
}
