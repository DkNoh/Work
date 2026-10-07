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
@Service @Transactional(readOnly=true)
public class DocumentService {
 private final ActorResolver actors;private final DocumentRepository documents;private final DocumentGrammar grammar;private final EntityManager em;private final Clock clock;private final SecurityAuditPublisher audit;
 public DocumentService(ActorResolver actors,DocumentRepository documents,DocumentGrammar grammar,EntityManager em,Clock clock,SecurityAuditPublisher audit){this.actors=actors;this.documents=documents;this.grammar=grammar;this.em=em;this.clock=clock;this.audit=audit;}
 public List<DocumentSummary> list(Authentication authentication){UserEntity actor=actors.require(authentication);return documents.findByAuthorIdOrderByUpdatedAtDescIdDesc(actor.getId()).stream().map(row->new DocumentSummary(row.id,row.title,row.revision,row.authorId,actor.getDisplayName(),row.createdAt.toString(),row.updatedAt.toString())).toList();}
 public DocumentResponse get(long id,Authentication authentication){UserEntity actor=actors.require(authentication);DocumentEntity row=require(id);own(row,actor);return response(row,actor);}
 @Transactional public DocumentResponse create(DocumentInput input,Authentication authentication){UserEntity actor=actors.require(authentication);String document=grammar.validate(input.documentJson());DocumentEntity row=new DocumentEntity(input.title().strip(),document,actor.getId(),now());documents.save(row);em.flush();publish(actor,"DOCUMENT_CREATE",row.id);return response(row,actor);}
 @Transactional public DocumentResponse update(long id,DocumentUpdateInput input,Authentication authentication){UserEntity actor=actors.require(authentication);DocumentEntity row=require(id);own(row,actor);revision(row,input.revision());String document=grammar.validate(input.documentJson());row.update(input.title().strip(),document,now());em.flush();publish(actor,"DOCUMENT_UPDATE",id);return response(row,actor);}
 @Transactional public void delete(long id,int revision,Authentication authentication){UserEntity actor=actors.require(authentication);DocumentEntity row=require(id);own(row,actor);revision(row,revision);documents.delete(row);em.flush();publish(actor,"DOCUMENT_DELETE",id);}
 private DocumentEntity require(long id){return documents.findById(id).orElseThrow(()->new ApiException(404,"NOT_FOUND","문서를 찾을 수 없습니다."));}
 private static void own(DocumentEntity row,UserEntity actor){if(!row.authorId.equals(actor.getId()))throw new ApiException(403,"FORBIDDEN","작성자만 문서에 접근할 수 있습니다.");}
 private static void revision(DocumentEntity row,Integer revision){if(revision==null||revision<=0)throw new ApiException(400,"INVALID_INPUT","문서 버전이 필요합니다.");if(row.revision!=revision)throw new ApiException(409,"REVISION_CONFLICT","다른 변경이 먼저 저장되었습니다. 새로 조회하세요.");}
 private static DocumentResponse response(DocumentEntity row,UserEntity actor){return new DocumentResponse(row.id,row.title,row.documentJson,row.revision,row.authorId,actor.getDisplayName(),row.createdAt.toString(),row.updatedAt.toString());}
 private Instant now(){return clock.instant().truncatedTo(ChronoUnit.MICROS);}
 private void publish(UserEntity actor,String action,long id){audit.publish(new SecurityAuditEvent(actor.getUsername(),actor.getId(),now(),action,"SUCCESS","DOCUMENT",Long.toString(id),null,null));}
}
