package dev.scframework.reference.notices;
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
class NoticeIntegrationTest extends KanbanTestSupport {
 @Autowired NoticeService service;
 @Test void nineFieldPlainContentContractKeepsWhitespaceAndLiteralSearch()throws Exception{
  JsonNode created=body(write(post("/api/kanban/notices"),alice,Map.of("title"," 공지 %_\\ ","content"," 본문\n <p>문자열</p> ")).andExpect(status().isOk()));assertThat(keys(created)).containsExactlyInAnyOrder("id","title","content","authorId","authorName","authorUsername","revision","createdAt","updatedAt");assertThat(created.get("content").asText()).isEqualTo(" 본문\n <p>문자열</p> ");assertThat(created.get("title").asText()).isEqualTo("공지 %_\\");assertThat(created.get("revision").asInt()).isEqualTo(1);assertThat(created.get("createdAt").asText()).isEqualTo("2026-10-07T12:34:56.123456Z");
  write(post("/api/kanban/notices"),bob,Map.of("title","다른 공지","content","보존")).andExpect(status().isOk());for(String q:List.of("%","_","\\")){JsonNode found=body(mvc.perform(get("/api/kanban/notices").session(bob.session()).param("q",q)).andExpect(status().isOk()));assertThat(found.size()).isEqualTo(1);assertThat(found.get(0)).isEqualTo(created);}
  JsonNode list=body(read("/api/kanban/notices",alice).andExpect(status().isOk()));assertThat(list.get(0).get("id").asLong()).isGreaterThan(created.get("id").asLong());assertThat(body(read("/api/kanban/notices/"+created.get("id").asLong(),bob).andExpect(status().isOk()))).isEqualTo(created);
 }
 @Test void authorOnlyAndRevocationAreCheckedAgainstCurrentDbEvenForAdmin()throws Exception{
  long id=body(write(post("/api/kanban/notices"),alice,Map.of("title","전용","content","평문")).andExpect(status().isOk())).get("id").asLong();for(Session other:List.of(admin,bob)){write(put("/api/kanban/notices/"+id),other,Map.of("title","거절","content","평문","revision",1)).andExpect(status().isForbidden());write(delete("/api/kanban/notices/"+id).param("revision","1"),other,Map.of()).andExpect(status().isForbidden());}
  jdbc.update("DELETE FROM kanban_member WHERE user_id=?",aliceId);read("/api/kanban/notices/"+id,alice).andExpect(status().isForbidden());write(put("/api/kanban/notices/"+id),alice,Map.of("title","거절","content","평문","revision",1)).andExpect(status().isForbidden());assertThat(successes("NOTICE_UPDATE")).isZero();
 }
 @Test void validationStaleRevisionSameClockAcceptedUpdateAndDelete()throws Exception{
  for(var fields:List.of(Map.of("title"," ","content","ok"),Map.of("title","ok","content"," "),Map.of("title","ok","content","x".repeat(50001))))write(post("/api/kanban/notices"),alice,fields).andExpect(status().isBadRequest());
  long id=body(write(post("/api/kanban/notices"),alice,Map.of("title","동일","content"," 본문 ")).andExpect(status().isOk())).get("id").asLong();write(put("/api/kanban/notices/"+id),alice,Map.of("title","동일","content"," 본문 ","revision",1)).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2));write(put("/api/kanban/notices/"+id),alice,Map.of("title","다른","content","보존","revision",1)).andExpect(status().isConflict());write(delete("/api/kanban/notices/"+id).param("revision","2"),alice,Map.of()).andExpect(status().isNoContent());read("/api/kanban/notices/"+id,alice).andExpect(status().isNotFound());
 }
 @Test void concurrentRevisionCasHasOneSuccessAndNoFalseAudit()throws Exception{
  long id=body(write(post("/api/kanban/notices"),alice,Map.of("title","경쟁","content","본문")).andExpect(status().isOk())).get("id").asLong();ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);try{List<Future<Integer>> futures=new ArrayList<>();for(int i=0;i<2;i++){int index=i;futures.add(pool.submit(()->{start.await();return write(put("/api/kanban/notices/"+id),alice,Map.of("title","경쟁"+index,"content","본문","revision",1)).andReturn().getResponse().getStatus();}));}start.countDown();assertThat(List.of(futures.get(0).get(),futures.get(1).get())).containsExactlyInAnyOrder(200,409);assertThat(successes("NOTICE_UPDATE")).isEqualTo(1);}finally{pool.shutdownNow();}
 }
 @Test void rolledBackNoticeHasNoPersistedRowOrSuccessEvent(){new TransactionTemplate(transactions).executeWithoutResult(tx->{service.create(new NoticeDtos.NoticeInput("rollback","보존"),new UsernamePasswordAuthenticationToken("kanban-alice","unused",List.of()));tx.setRollbackOnly();});assertThat(count("kanban_notice")).isZero();assertThat(successes("NOTICE_CREATE")).isZero();}
}
