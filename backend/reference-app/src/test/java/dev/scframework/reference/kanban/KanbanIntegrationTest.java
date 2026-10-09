package dev.scframework.reference.kanban;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import dev.scframework.core.ApiException;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;
class KanbanIntegrationTest extends KanbanTestSupport {
 @Autowired KanbanService service;
 @Test void memberChangesAreImmediateAndAdminAccessCannotBeRemoved() throws Exception{
  long outsider=user("outsider","외부","REQUESTER");Session outside=login("outsider");read("/api/kanban/access",outside).andExpect(jsonPath("$.allowed").value(false));read("/api/kanban/tasks",outside).andExpect(status().isForbidden());
  write(put("/api/kanban/members/"+outsider),alice,Map.of("allowed",true)).andExpect(status().isForbidden());
  write(put("/api/kanban/members/"+outsider),admin,Map.of("allowed",true)).andExpect(status().isOk()).andExpect(jsonPath("$.kanbanAccess").value(true));read("/api/kanban/tasks",outside).andExpect(status().isOk());
  write(put("/api/kanban/members/"+outsider),admin,Map.of("allowed",false)).andExpect(status().isOk());read("/api/kanban/tasks",outside).andExpect(status().isForbidden());
  long id=users.findByUsername("testadmin").orElseThrow().getId();write(put("/api/kanban/members/"+id),admin,Map.of("allowed",false)).andExpect(status().isOk()).andExpect(jsonPath("$.kanbanAccess").value(true));
  jdbc.update("UPDATE reference_user SET role='REQUESTER' WHERE id=?",id);try{read("/api/kanban/members",admin).andExpect(status().isForbidden());}finally{jdbc.update("UPDATE reference_user SET role='ADMIN' WHERE id=?",id);}
 }
 @Test void exactJsonWhitespaceNullableDatesAndTagContracts() throws Exception{
  var input=input("  제목  ","TODO");input.put("tags",List.of(" a ","a"," b "));input.put("dueDate","0000-02-29");JsonNode created=body(write(post("/api/kanban/tasks"),alice,input).andExpect(status().isOk()));
  assertThat(keys(created)).containsExactlyInAnyOrder("id","boardId","title","description","status","priority","assigneeId","assigneeName","assigneeUsername","authorId","authorName","authorUsername","dueDate","tags","position","revision","createdAt","updatedAt","completedAt");
  assertThat(created.get("title").asText()).isEqualTo("제목");assertThat(created.get("description").asText()).isEqualTo(" body\n ");assertThat(created.get("tags").toString()).isEqualTo("[\"a\",\"b\"]");assertThat(created.get("revision").asInt()).isEqualTo(1);assertThat(created.get("position").asDouble()).isEqualTo(1024);assertThat(created.get("createdAt").asText()).isEqualTo("2026-10-07T12:34:56.123456Z");assertThat(created.get("completedAt").isNull()).isTrue();assertThat(created.get("assigneeId").isNull()).isTrue();
  input.put("dueDate","0099-01-01");write(post("/api/kanban/tasks"),alice,input).andExpect(status().isOk()).andExpect(jsonPath("$.dueDate").value("0099-01-01"));input.put("dueDate","2025-02-29");write(post("/api/kanban/tasks"),alice,input).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("dueDate"));
  input.put("dueDate",null);input.put("authorId",bobId);write(post("/api/kanban/tasks"),alice,input).andExpect(status().isBadRequest());
 }
 @Test void onlyAuthorCanUpdateMoveDeleteEvenAdminAndAssignee() throws Exception{
  var input=input("작성자 전용","TODO");input.put("assigneeId",bobId);JsonNode task=body(write(post("/api/kanban/tasks"),alice,input).andExpect(status().isOk()));long id=task.get("id").asLong();input.put("revision",1);
  for(Session other:List.of(admin,bob)){write(put("/api/kanban/tasks/"+id),other,input).andExpect(status().isForbidden());write(post("/api/kanban/tasks/"+id+"/move"),other,Map.of("status","DONE","revision",1)).andExpect(status().isForbidden());write(delete("/api/kanban/tasks/"+id).param("revision","1"),other,Map.of()).andExpect(status().isForbidden());}
  write(put("/api/kanban/tasks/"+id),alice,input).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2));write(delete("/api/kanban/tasks/"+id).param("revision","1"),alice,Map.of()).andExpect(status().isConflict());write(delete("/api/kanban/tasks/"+id).param("revision","2"),alice,Map.of()).andExpect(status().isNoContent());
 }
 @Test void boardDefaultAndOwnerRenameNoopKeepExactNineKeys() throws Exception{
  JsonNode initial=body(read("/api/kanban/boards",alice).andExpect(status().isOk())).get(0);assertThat(keys(initial)).containsExactlyInAnyOrder("id","title","authorId","authorName","authorUsername","revision","createdAt","updatedAt","canRename");assertThat(initial.get("authorId").isNull()).isTrue();assertThat(initial.get("canRename").asBoolean()).isFalse();
  write(put("/api/kanban/boards/1"),alice,Map.of("title","기본 업무","revision",initial.get("revision").asInt())).andExpect(status().isForbidden());
  JsonNode board=body(write(post("/api/kanban/boards"),alice,Map.of("title"," 새 보드 ")).andExpect(status().isOk()));long id=board.get("id").asLong();assertThat(id).isGreaterThan(1);assertThat(board.get("title").asText()).isEqualTo("새 보드");
  write(put("/api/kanban/boards/"+id),admin,Map.of("title","관리자 거절","revision",1)).andExpect(status().isForbidden());assertThat(body(write(put("/api/kanban/boards/"+id),alice,Map.of("title"," 새 보드 ","revision",1)).andExpect(status().isOk()))).isEqualTo(board);assertThat(successes("KANBAN_BOARD_UPDATE")).isZero();
 }
 @Test void literalSearchViewsAndBoardFiltersMatchAuthorAssignment() throws Exception{
  var fields=input("literal %_\\ 한글","TODO");fields.put("assigneeId",bobId);JsonNode first=body(write(post("/api/kanban/tasks"),alice,fields).andExpect(status().isOk()));task("ordinary","TODO");
  for(String q:List.of("%","_","\\"," 한글 ")){JsonNode rows=body(mvc.perform(get("/api/kanban/tasks").session(alice.session()).param("q",q)).andExpect(status().isOk()));assertThat(rows.size()).isEqualTo(1);assertThat(rows.get(0).get("id")).isEqualTo(first.get("id"));}
  assertThat(body(read("/api/kanban/tasks?view=CREATED",bob).andExpect(status().isOk())).size()).isZero();assertThat(body(read("/api/kanban/tasks?view=ASSIGNED",bob).andExpect(status().isOk())).size()).isEqualTo(1);
  read("/api/kanban/tasks?view=UNKNOWN",alice).andExpect(status().isBadRequest());read("/api/kanban/tasks?boardId=999999",alice).andExpect(status().isNotFound());read("/api/kanban/tasks?q="+"x".repeat(201),alice).andExpect(status().isBadRequest());
 }
 @Test void midpointMoveOnlyChangesMovedCardAndRealNoopKeepsRevision() throws Exception{
  JsonNode first=task("first","TODO"),second=task("second","TODO"),third=task("third","DONE");long id=third.get("id").asLong();
  JsonNode moved=body(write(post("/api/kanban/tasks/"+id+"/move"),alice,Map.of("status","TODO","beforeId",second.get("id").asLong(),"revision",1)).andExpect(status().isOk()));assertThat(moved.get("position").asDouble()).isBetween(1024d,2048d);assertThat(moved.get("completedAt").isNull()).isTrue();assertThat(moved.get("revision").asInt()).isEqualTo(2);
  assertThat(body(read("/api/kanban/tasks/"+first.get("id").asLong(),alice).andExpect(status().isOk()))).isEqualTo(first);assertThat(body(read("/api/kanban/tasks/"+second.get("id").asLong(),alice).andExpect(status().isOk()))).isEqualTo(second);
  assertThat(body(write(post("/api/kanban/tasks/"+id+"/move"),alice,Map.of("status","TODO","beforeId",id,"revision",2)).andExpect(status().isOk()))).isEqualTo(moved);
  write(post("/api/kanban/tasks/"+id+"/move"),alice,Map.of("status","DONE","beforeId",second.get("id").asLong(),"revision",2)).andExpect(status().isBadRequest());assertThat(successes("KANBAN_TASK_MOVE")).isEqualTo(1);
 }
 @Test void exhaustedGapAndTailRejectWithoutRenumberingOthers() throws Exception{
  JsonNode a=task("a","TODO"),b=task("b","TODO"),moving=task("moving","DONE");double near=Math.nextUp(1d);jdbc.update("UPDATE kanban_task SET position=? WHERE id=?",1d,a.get("id").asLong());jdbc.update("UPDATE kanban_task SET position=? WHERE id=?",near,b.get("id").asLong());
  write(post("/api/kanban/tasks/"+moving.get("id").asLong()+"/move"),alice,Map.of("status","TODO","beforeId",b.get("id").asLong(),"revision",1)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_CONFLICT"));assertThat(jdbc.queryForObject("SELECT position FROM kanban_task WHERE id=?",Double.class,b.get("id").asLong())).isEqualTo(near);
  jdbc.update("UPDATE kanban_task SET position=? WHERE id=?",Double.MAX_VALUE,b.get("id").asLong());write(post("/api/kanban/tasks"),alice,input("overflow","TODO")).andExpect(status().isConflict());assertThat(count("kanban_task")).isEqualTo(3);
 }
 @Test void doneBodyEditsKeepCompletedTimeAndRepeatedAcceptedCommandIncrementsOnce() throws Exception{
  JsonNode row=task("done","DONE");String completed=row.get("completedAt").asText();var fields=input("done","DONE");fields.put("revision",1);long id=row.get("id").asLong();write(put("/api/kanban/tasks/"+id),alice,fields).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(2)).andExpect(jsonPath("$.completedAt").value(completed));fields.put("revision",2);fields.put("status","REJECTED");write(put("/api/kanban/tasks/"+id),alice,fields).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(3)).andExpect(jsonPath("$.completedAt").isEmpty());
 }
 @Test void atomicImportValidatesEveryPhysicalRowAndKeepsDuplicatesAsNewCommands() throws Exception{
  Map<String,Object> a=input("import A","TODO"),b=input("import B","DONE");var payload=Map.of("boardId",1,"rows",List.of(Map.of("rowNumber",2,"input",a),Map.of("rowNumber",8,"input",b)));
  JsonNode result=body(write(post("/api/kanban/tasks/import"),alice,payload).andExpect(status().isOk()));assertThat(result.get("importedCount").asInt()).isEqualTo(2);assertThat(result.get("items").get(0).get("title").asText()).isEqualTo("import A");assertThat(result.get("items").get(1).get("completedAt").isTextual()).isTrue();write(post("/api/kanban/tasks/import"),alice,payload).andExpect(status().isOk());assertThat(count("kanban_task")).isEqualTo(4);
  a.put("dueDate","2025-02-29");b.put("assigneeId",999999);JsonNode failure=body(write(post("/api/kanban/tasks/import"),alice,payload).andExpect(status().isBadRequest()));Set<String> fields=new HashSet<>();failure.get("errors").forEach(error->fields.add(error.get("field").asText()));assertThat(fields).contains("rows[0].input.dueDate","rows[1].input.assigneeId");assertThat(count("kanban_task")).isEqualTo(4);assertThat(successes("KANBAN_TASK_IMPORT")).isEqualTo(2);
 }
 @Test void importBeanErrorsBoundsAndDuplicateSheetRowsAreNotPartialSuccess() throws Exception{
  var invalid=input(" ","TODO");invalid.put("description","x".repeat(10001));JsonNode error=body(write(post("/api/kanban/tasks/import"),alice,Map.of("boardId",1,"rows",List.of(Map.of("rowNumber",2,"input",invalid)))).andExpect(status().isBadRequest()));assertThat(error.get("errors").toString()).contains("rows[0].input.title","rows[0].input.description");
  List<Object> over=new ArrayList<>();for(int i=0;i<201;i++)over.add(Map.of("rowNumber",i+1,"input",input("ok","TODO")));write(post("/api/kanban/tasks/import"),alice,Map.of("boardId",1,"rows",over)).andExpect(status().isBadRequest());
  write(post("/api/kanban/tasks/import"),alice,Map.of("boardId",1,"rows",List.of(Map.of("rowNumber",3,"input",input("ok","TODO")),Map.of("rowNumber",3,"input",input("ok","TODO"))))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("rows[1].rowNumber"));assertThat(count("kanban_task")).isZero();assertThat(successes("KANBAN_TASK_CREATE")).isZero();
 }
 @Test void maximumImportAndLateDatabaseFailureAreAtomicIncludingAudit() throws Exception{
  List<Object> rows=new ArrayList<>();for(int i=0;i<200;i++)rows.add(Map.of("rowNumber",i+2,"input",input("row-"+i,"TODO")));write(post("/api/kanban/tasks/import"),alice,Map.of("boardId",1,"rows",rows)).andExpect(status().isOk()).andExpect(jsonPath("$.importedCount").value(200));assertThat(count("kanban_task")).isEqualTo(200);
  jdbc.update("DELETE FROM kanban_task");jdbc.update("DELETE FROM security_audit_event");jdbc.execute("ALTER TABLE kanban_task ADD CONSTRAINT synthetic_reject CHECK (title <> 'reject-later')");
  try{write(post("/api/kanban/tasks/import"),alice,Map.of("boardId",1,"rows",List.of(Map.of("rowNumber",2,"input",input("first-insert","TODO")),Map.of("rowNumber",3,"input",input("reject-later","TODO"))))).andExpect(status().isConflict());assertThat(count("kanban_task")).isZero();assertThat(successes("KANBAN_TASK_CREATE")).isZero();assertThat(successes("KANBAN_TASK_IMPORT")).isZero();}finally{jdbc.execute("ALTER TABLE kanban_task DROP CONSTRAINT synthetic_reject");}
 }
 @Test void concurrentSameRevisionAllowsExactlyOneMoveAndPositionCreatesStayDistinct() throws Exception{
  long id=task("racing","TODO").get("id").asLong();ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
  try{List<Future<Integer>> results=new ArrayList<>();for(int i=0;i<2;i++)results.add(pool.submit(()->{start.await();return write(post("/api/kanban/tasks/"+id+"/move"),alice,Map.of("status","DONE","revision",1)).andReturn().getResponse().getStatus();}));start.countDown();assertThat(List.of(results.get(0).get(),results.get(1).get())).containsExactlyInAnyOrder(200,409);assertThat(successes("KANBAN_TASK_MOVE")).isEqualTo(1);
   CountDownLatch createStart=new CountDownLatch(1);List<Future<Integer>> creates=new ArrayList<>();for(int i=0;i<2;i++){int index=i;creates.add(pool.submit(()->{createStart.await();return write(post("/api/kanban/tasks"),alice,input("parallel-"+index,"TODO")).andReturn().getResponse().getStatus();}));}createStart.countDown();for(Future<Integer> result:creates)assertThat(result.get()).isEqualTo(200);assertThat(jdbc.queryForObject("SELECT COUNT(DISTINCT position) FROM kanban_task WHERE status='TODO'",Integer.class)).isEqualTo(2);
  }finally{pool.shutdownNow();}
 }
 @Test void outerRollbackDiscardsTaskAndDeferredSuccessAudit(){new TransactionTemplate(transactions).executeWithoutResult(tx->{service.create(new KanbanDtos.TaskInput("rolled back","",KanbanDtos.Status.TODO,KanbanDtos.Priority.LOW,null,null,List.of(),null,1L),new UsernamePasswordAuthenticationToken("kanban-alice","unused",List.of()));tx.setRollbackOnly();});assertThat(count("kanban_task")).isZero();assertThat(successes("KANBAN_TASK_CREATE")).isZero();}
}
