package dev.scframework.reference.kanban;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import dev.scframework.reference.identity.*;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
@SpringBootTest @AutoConfigureMockMvc(print=MockMvcPrint.NONE) @Import(KanbanTestSupport.Time.class)
public abstract class KanbanTestSupport {
 private static final String PASSWORD="synthetic-only-010-test-password";
 private static final Path TEMP=secret();
 protected static final Instant FIXED=Instant.parse("2026-10-07T12:34:56.123456789Z");
 @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){registry.add("SC_BOOTSTRAP_SECRET_FILE",()->TEMP.resolve("bootstrap.secret").toString());registry.add("SC_BOOTSTRAP_USERNAME",()->"testadmin");registry.add("spring.datasource.url",()->"jdbc:h2:mem:kanban-"+TEMP.getFileName()+";DB_CLOSE_DELAY=-1");registry.add("logging.file.name",()->TEMP.resolve("synthetic.log").toString());registry.add("sc.framework.file-storage.root",()->TEMP.resolve("uploads").toString());}
 @TestConfiguration public static class Time{@Bean @Primary Clock clock(){return Clock.fixed(FIXED,ZoneOffset.UTC);}}
 @Autowired protected MockMvc mvc;@Autowired protected ObjectMapper json;@Autowired protected JdbcTemplate jdbc;@Autowired protected UserRepository users;@Autowired protected PasswordEncoder encoder;@Autowired protected PlatformTransactionManager transactions;
 protected Session admin,alice,bob;protected long aliceId,bobId;
 @BeforeEach protected void prepare() throws Exception{
  for(String table:List.of("kanban_task","kanban_notice","reference_document","kanban_member"))jdbc.update("DELETE FROM "+table);
  jdbc.update("DELETE FROM kanban_board WHERE id<>1");jdbc.update("DELETE FROM reference_user WHERE username<>?","testadmin");jdbc.update("DELETE FROM security_audit_event");
  aliceId=user("kanban-alice","작성자","REQUESTER");bobId=user("kanban-bob","담당자","REVIEWER");jdbc.update("INSERT INTO kanban_member VALUES (?)",aliceId);jdbc.update("INSERT INTO kanban_member VALUES (?)",bobId);
  admin=login("testadmin");alice=login("kanban-alice");bob=login("kanban-bob");jdbc.update("DELETE FROM security_audit_event");
 }
 protected long user(String username,String name,String role){return users.saveAndFlush(new UserEntity(username,name,encoder.encode(PASSWORD),role,FIXED)).getId();}
 protected Session login(String username) throws Exception{
  var first=mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();JsonNode token=json.readTree(first.getResponse().getContentAsString());
  var logged=mvc.perform(post("/api/auth/login").session((MockHttpSession)first.getRequest().getSession(false)).header(token.get("headerName").asText(),token.get("token").asText()).param("username",username).param("password",PASSWORD)).andExpect(status().isNoContent()).andReturn();
  MockHttpSession session=(MockHttpSession)logged.getRequest().getSession(false);JsonNode csrf=body(mvc.perform(get("/api/auth/csrf").session(session)).andExpect(status().isOk()));return new Session(session,csrf.get("headerName").asText(),csrf.get("token").asText());
 }
 protected ResultActions write(MockHttpServletRequestBuilder request,Session session,Object input) throws Exception{return mvc.perform(request.session(session.session()).header(session.header(),session.token()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input)));}
 protected ResultActions read(String path,Session session) throws Exception{return mvc.perform(get(path).session(session.session()));}
 protected JsonNode body(ResultActions result) throws Exception{return json.readTree(result.andReturn().getResponse().getContentAsString());}
 protected static Set<String> keys(JsonNode node){Set<String> keys=new HashSet<>();node.fieldNames().forEachRemaining(keys::add);return keys;}
 protected Map<String,Object> input(String title,String state){Map<String,Object> input=new LinkedHashMap<>();input.put("title",title);input.put("description"," body\n ");input.put("status",state);input.put("priority","MEDIUM");input.put("assigneeId",null);input.put("dueDate",null);input.put("tags",List.of());return input;}
 protected JsonNode task(String title,String status) throws Exception{return body(write(post("/api/kanban/tasks"),alice,input(title,status)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()));}
 protected long count(String table){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Long.class);}
 protected long successes(String action){return jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action=? AND outcome='SUCCESS'",Long.class,action);}
 protected record Session(MockHttpSession session,String header,String token){}
 private static Path secret(){try{Path temp=Files.createTempDirectory("sc-kanban-010-");Path file=temp.resolve("bootstrap.secret");Files.writeString(file,PASSWORD);if(Files.getFileStore(file).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-------"));return temp;}catch(IOException failure){throw new ExceptionInInitializerError(failure);}}
}
