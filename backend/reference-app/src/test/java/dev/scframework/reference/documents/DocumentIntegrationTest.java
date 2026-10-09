package dev.scframework.reference.documents;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import dev.scframework.reference.kanban.KanbanTestSupport;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;
class DocumentIntegrationTest extends KanbanTestSupport {
 private static final String DOC="{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\" 글자 \"}]}]}";
 @Autowired DocumentService service;
 @Test void jsonIsPublicStringAndStorageClobWithOwnerOnlySummary()throws Exception{
  JsonNode created=create();assertThat(keys(created)).containsExactlyInAnyOrder("id","title","documentJson","revision","authorId","authorName","createdAt","updatedAt");assertThat(created.get("documentJson").isTextual()).isTrue();assertThat(json.readTree(created.get("documentJson").asText())).isEqualTo(json.readTree(DOC));assertThat(created.get("title").asText()).isEqualTo("문서");assertThat(created.get("revision").asInt()).isEqualTo(1);assertThat(created.get("createdAt").asText()).isEqualTo("2026-10-07T12:34:56.123456Z");
  JsonNode summary=body(read("/api/documents",alice).andExpect(status().isOk())).get(0);assertThat(keys(summary)).containsExactlyInAnyOrder("id","title","revision","authorId","authorName","createdAt","updatedAt");assertThat(summary.has("documentJson")).isFalse();assertThat(jdbc.queryForObject("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='REFERENCE_DOCUMENT' AND COLUMN_NAME='DOCUMENT_JSON'",String.class)).isEqualTo("CHARACTER LARGE OBJECT");
  assertThat(body(read("/api/documents/"+created.get("id").asLong(),alice).andExpect(status().isOk()))).isEqualTo(created);
 }
 @Test void otherActorIncludingAdminCannotReadChangeDeleteOwnerDocuments()throws Exception{
  long id=create().get("id").asLong();for(Session other:List.of(admin,bob)){assertThat(body(read("/api/documents",other).andExpect(status().isOk())).size()).isZero();read("/api/documents/"+id,other).andExpect(status().isForbidden());write(put("/api/documents/"+id),other,Map.of("title","거절","documentJson",DOC,"revision",1)).andExpect(status().isForbidden());write(delete("/api/documents/"+id).param("revision","1"),other,Map.of()).andExpect(status().isForbidden());}assertThat(successes("DOCUMENT_UPDATE")).isZero();assertThat(successes("DOCUMENT_DELETE")).isZero();
 }
 @Test void malformedGrammarNeverAllocatesOrLeaksAndPlainNoticeContentRemainsPlain()throws Exception{
  for(String invalid:List.of("<p>bad</p>","{\"type\":\"doc\",\"content\":[]}","{\"type\":\"doc\",\"content\":[{\"type\":\"image\"}]}"))write(post("/api/documents"),alice,Map.of("title","잘못된","documentJson",invalid)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("documentJson"));assertThat(count("reference_document")).isZero();assertThat(successes("DOCUMENT_CREATE")).isZero();
  write(post("/api/documents"),alice,Map.of("title","업무객체 아님","documentJson",Map.of("type","doc"))).andExpect(status().isBadRequest());write(post("/api/documents"),alice,Map.of("title","알 수 없음","documentJson",DOC,"html","x")).andExpect(status().isBadRequest());
  write(post("/api/kanban/notices"),alice,Map.of("title","평문","content",DOC)).andExpect(status().isOk()).andExpect(jsonPath("$.content").value(DOC));
 }
 @Test void acceptedSameInputIncrementsExactlyOnceAndStaleSaveKeepsCommittedValue()throws Exception{
  long id=create().get("id").asLong();write(put("/api/documents/"+id),alice,Map.of("title","문서","documentJson",DOC,"revision",1)).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2));write(put("/api/documents/"+id),alice,Map.of("title","충돌 입력","documentJson",DOC,"revision",1)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REVISION_CONFLICT"));read("/api/documents/"+id,alice).andExpect(jsonPath("$.title").value("문서")).andExpect(jsonPath("$.revision").value(2));write(delete("/api/documents/"+id).param("revision","2"),alice,Map.of()).andExpect(status().isNoContent());read("/api/documents/"+id,alice).andExpect(status().isNotFound());
 }
 @Test void concurrentCasAndRollbackPublishOnlyActualCommits()throws Exception{
  long id=create().get("id").asLong();ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);try{List<Future<Integer>> results=new ArrayList<>();for(int i=0;i<2;i++){int index=i;results.add(pool.submit(()->{start.await();return write(put("/api/documents/"+id),alice,Map.of("title","경쟁"+index,"documentJson",DOC,"revision",1)).andReturn().getResponse().getStatus();}));}start.countDown();assertThat(List.of(results.get(0).get(),results.get(1).get())).containsExactlyInAnyOrder(200,409);assertThat(successes("DOCUMENT_UPDATE")).isEqualTo(1);}finally{pool.shutdownNow();}
  long before=count("reference_document"),auditBefore=successes("DOCUMENT_CREATE");new TransactionTemplate(transactions).executeWithoutResult(tx->{service.create(new DocumentDtos.DocumentInput("rollback",DOC),new UsernamePasswordAuthenticationToken("kanban-alice","unused",List.of()));tx.setRollbackOnly();});assertThat(count("reference_document")).isEqualTo(before);assertThat(successes("DOCUMENT_CREATE")).isEqualTo(auditBefore);
 }
 private JsonNode create()throws Exception{return body(write(post("/api/documents"),alice,Map.of("title"," 문서 ","documentJson",DOC)).andExpect(status().isOk()));}
}
