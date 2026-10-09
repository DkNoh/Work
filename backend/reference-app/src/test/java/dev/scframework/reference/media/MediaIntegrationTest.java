package dev.scframework.reference.media;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static dev.scframework.reference.requirements.RequirementDtos.*;

import com.fasterxml.jackson.databind.*;
import dev.scframework.autoconfigure.storage.*;
import dev.scframework.core.ApiException;
import dev.scframework.core.storage.*;
import dev.scframework.reference.identity.*;
import dev.scframework.reference.requirements.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest @AutoConfigureMockMvc(print=MockMvcPrint.NONE) @ActiveProfiles("dev")
@Import(MediaIntegrationTest.StorageFixture.class)
class MediaIntegrationTest {
    private static final String PASSWORD="synthetic-media-password-only";
    private static final Path TEMP=temporary();
    @DynamicPropertySource static void settings(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE",()->TEMP.resolve("bootstrap.secret").toString());registry.add("SC_BOOTSTRAP_USERNAME",()->"media-admin");
        registry.add("spring.datasource.url",()->"jdbc:h2:mem:media-"+TEMP.getFileName()+";DB_CLOSE_DELAY=-1");
        registry.add("sc.framework.file-storage.root",()->TEMP.resolve("uploads").toString());registry.add("sc.framework.file-storage.enabled",()->true);
        registry.add("logging.file.name",()->TEMP.resolve("test.log").toString());
    }
    @TestConfiguration(proxyBeanMethods=false) static class StorageFixture { @Bean FileStorage storage(){return new FailingStorage();} }
    static class FailingStorage implements FileStorage {
        final LocalFileStorage delegate=new LocalFileStorage(TEMP.resolve("uploads"),MediaService.MAX_BYTES);final AtomicBoolean failDelete=new AtomicBoolean();
        public StoredBlob write(InputStream source,long limit)throws IOException{return delegate.write(source,limit);}
        public InputStream open(String key)throws IOException{return delegate.open(key);}public boolean exists(String key)throws IOException{return delegate.exists(key);}
        public void delete(String key)throws IOException{if(failDelete.get())throw new IOException("synthetic-private-storage-canary");delegate.delete(key);}
    }
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired MediaService media;
    @Autowired RequirementService requirements;@Autowired UserRepository users;@Autowired FileStorage storage;
    @Autowired FileStorageTransactions lifecycle;@Autowired PlatformTransactionManager manager;
    private Session admin,alice,bob,other;private long menu,aliceId,bobId;
    @BeforeEach void fixtures() throws Exception {
        ((FailingStorage)storage).failDelete.set(false);
        for(String table:List.of("requirement_attachment","requirement_annotation","requirement_ado","requirement_history","requirement_comment","requirement_review","requirement_entry","screen_version","screen_entry","stored_file","menu_entry")) jdbc.update("DELETE FROM "+table);
        jdbc.update("DELETE FROM security_audit_event");
        jdbc.update("DELETE FROM reference_user WHERE username<>'media-admin'");
        if(Files.isDirectory(TEMP.resolve("uploads")))try(var paths=Files.list(TEMP.resolve("uploads"))){for(Path path:paths.toList())Files.delete(path);}
        admin=login("media-admin");aliceId=user("media-alice","REQUESTER");bobId=user("media-bob","REVIEWER");user("media-other","REVIEWER");
        alice=login("media-alice");bob=login("media-bob");other=login("media-other");
        menu=body(write(post("/api/menus"),admin,Map.of("name","이미지 메뉴","sortOrder",0)).andExpect(status().isOk())).get("id").asLong();
    }
    @Test void actualPngJpegExifDimensionsBytesAndSafeAuthenticatedHeadersArePreserved() throws Exception {
        long screen=screen();byte[] png=image("png",4,3);JsonNode version=upload(screen,alice,png,"../../원본.png","text/plain");
        assertThat(version.get("width").asInt()).isEqualTo(4);assertThat(version.get("height").asInt()).isEqualTo(3);assertThat(version.get("version").asInt()).isEqualTo(1);
        long file=version.get("fileId").asLong();mvc.perform(get("/api/files/"+file)).andExpect(status().isUnauthorized());
        var response=mvc.perform(get("/api/files/"+file).session(alice.session())).andExpect(status().isOk()).andExpect(content().contentType("image/png")).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse();
        assertThat(response.getContentAsByteArray()).isEqualTo(png);assertThat(response.getHeader("Content-Disposition")).startsWith("inline;");
        byte[] jpeg=orientedJpeg(6);JsonNode rotated=upload(screen,alice,jpeg,"rotated.jpg","image/jpeg");
        assertThat(rotated.get("width").asInt()).isEqualTo(3);assertThat(rotated.get("height").asInt()).isEqualTo(4);
        assertThat(mvc.perform(get("/api/files/"+rotated.get("fileId").asLong()).session(alice.session())).andReturn().getResponse().getContentAsByteArray()).isEqualTo(jpeg);
        mvc.perform(get("/api/screens/"+screen+"/versions").session(bob.session())).andExpect(status().isOk()).andExpect(jsonPath("$[0].version").value(2));
        assertThat(jdbc.queryForList("SELECT storage_key FROM stored_file",String.class)).allMatch(value->value.matches("[0-9a-f-]{36}"));
        assertThat(rotated.toString().contains(TEMP.toString())).isFalse();
    }
    @Test void invalidEmptyOversizedAndOrientedPngUploadsLeaveNoMetadataOrBlob() throws Exception {
        long screen=screen();
        for(byte[] invalid:new byte[][]{new byte[0],"not-an-image".getBytes(),"%PDF-synthetic".getBytes(),orientedPng(6)}) {
            mvc.perform(multipart("/api/screens/"+screen+"/versions").file(new MockMultipartFile("file","fake.png","image/png",invalid)).session(alice.session()).header(alice.header(),alice.token())).andExpect(status().isBadRequest());
        }
        mvc.perform(multipart("/api/screens/"+screen+"/versions").file(new MockMultipartFile("file","large.png","image/png",new byte[(int)MediaService.MAX_BYTES+1])).session(alice.session()).header(alice.header(),alice.token())).andExpect(status().isPayloadTooLarge());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM stored_file",Integer.class)).isZero();assertThat(blobCount()).isZero();
        write(post("/api/screens"),alice,Map.of("menuId",menu,"name","거절")).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/screens/"+screen+"/versions").file(new MockMultipartFile("file",image("png",4,3))).session(alice.session())).andExpect(status().isForbidden());
    }
    @Test void closingInputAfterSuccessfulWriteDoesNotLeakPreparedBlobOrPrivateFailure()throws Exception {
        byte[] bytes=image("png",4,3);MockMultipartFile closeFailure=new MockMultipartFile("file","close.png","image/png",bytes) {
            @Override public InputStream getInputStream(){return new ByteArrayInputStream(bytes){@Override public void close()throws IOException{throw new IOException("synthetic-input-close-canary");}};}
        };
        assertThatThrownBy(()->media.prepare(closeFailure,true)).isInstanceOf(ApiException.class).satisfies(error->assertThat(((ApiException)error).status()).isEqualTo(500));
        assertThat(blobCount()).isZero();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM stored_file",Integer.class)).isZero();
        String log=Files.exists(TEMP.resolve("test.log"))?Files.readString(TEMP.resolve("test.log")):"";assertThat(log.contains("synthetic-input-close-canary")).isFalse();
    }
    @Test void archivedVersionAllowsExistingBodyAndBoxEditsButRejectsNewAndRelinkedRequirements() throws Exception {
        long screen=screen();JsonNode version=upload(screen,alice,image("png",4,3),"source.png","image/png");long versionId=version.get("id").asLong();
        JsonNode request=create(versionId);long id=request.get("id").asLong();
        assertThat(request.get("annotation").get("number").asInt()).isEqualTo(1);
        mvc.perform(get("/api/versions/"+versionId+"/annotations").session(other.session())).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        write(post("/api/versions/"+versionId+"/archive"),alice,Map.of()).andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(1));
        write(post("/api/requirements"),alice,input(versionId,1)).andExpect(status().isBadRequest());
        Map<String,Object> edited=input(versionId,1);edited.put("title","보관한 원본 유지 편집");
        request=body(write(put("/api/requirements/"+id),alice,edited).andExpect(status().isOk()));assertThat(request.get("annotation").get("number").asInt()).isEqualTo(1);
        JsonNode second=upload(screen,bob,image("png",4,3),"new.png","image/png");edited=input(second.get("id").asLong(),2);
        write(put("/api/requirements/"+id),alice,edited).andExpect(status().isBadRequest());
        write(put("/api/requirements/"+id+"/annotation"),admin,Map.of("revision",2,"box",box())).andExpect(status().isForbidden());
        write(delete("/api/requirements/"+id+"/annotation").param("revision","0"),alice,null).andExpect(status().isBadRequest());
        request=body(write(delete("/api/requirements/"+id+"/annotation").param("revision","2"),alice,null).andExpect(status().isOk()));assertThat(request.get("annotation").isNull()).isTrue();
        write(post("/api/requirements/"+id+"/submit"),alice,Map.of("revision",3)).andExpect(status().isBadRequest());
        request=body(write(put("/api/requirements/"+id+"/annotation"),alice,Map.of("revision",3,"box",box())).andExpect(status().isOk()));
        assertThat(request.get("annotation").get("number").asInt()).isEqualTo(2);
        write(put("/api/requirements/"+id+"/annotation"),alice,Map.of("revision",3,"box",box())).andExpect(status().isConflict());
        write(put("/api/requirements/"+id+"/annotation"),alice,Map.of("revision",4,"box",Map.of("x",0.9,"y",0,"width",0.5,"height",0.5))).andExpect(status().isBadRequest());
        write(post("/api/requirements/"+id+"/submit"),alice,Map.of("revision",4)).andExpect(status().isOk());
        mvc.perform(get("/api/versions/"+versionId+"/annotations").session(other.session())).andExpect(status().isOk()).andExpect(jsonPath("$[0].number").value(2));
    }
    @Test void attachmentsCheckDraftAndAuthorRevisionAndDeleteOnlyAfterSuccessfulCommit() throws Exception {
        JsonNode request=create(null);long id=request.get("id").asLong();byte[] pdf="%PDF-1.7\nsynthetic-only".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        request=body(mvc.perform(multipart("/api/requirements/"+id+"/attachments").file(new MockMultipartFile("file","../보고서.pdf","application/x-fake",pdf)).param("revision","1").session(alice.session()).header(alice.header(),alice.token())).andExpect(status().isOk()));
        JsonNode attachment=request.get("attachments").get(0);long attachmentId=attachment.get("id").asLong(),fileId=attachment.get("fileId").asLong();
        assertThat(attachment.get("originalName").asText()).isEqualTo("보고서.pdf");assertThat(attachment.get("mime").asText()).isEqualTo("application/pdf");
        mvc.perform(get("/api/files/"+fileId).session(other.session())).andExpect(status().isForbidden());
        mvc.perform(get("/api/files/"+fileId).session(alice.session())).andExpect(status().isOk()).andExpect(content().bytes(pdf)).andExpect(header().string("Cache-Control","no-store"));
        write(delete("/api/requirements/"+id+"/attachments/"+attachmentId).param("revision","2"),admin,null).andExpect(status().isForbidden());
        write(delete("/api/requirements/"+id+"/attachments/"+attachmentId).param("revision","1"),alice,null).andExpect(status().isConflict());assertThat(blobCount()).isEqualTo(1);
        request=body(write(delete("/api/requirements/"+id+"/attachments/"+attachmentId).param("revision","2"),alice,null).andExpect(status().isOk()));
        assertThat(request.get("attachments").isEmpty()).isTrue();assertThat(blobCount()).isZero();mvc.perform(get("/api/files/"+fileId).session(alice.session())).andExpect(status().isNotFound());
        assertThat(request.get("history").get(0).get("action").asText()).isEqualTo("ATTACHMENT_DELETE");
        JsonNode before=json.readTree(request.get("history").get(0).get("beforeJson").asText());assertThat(before.get("attachments").size()).isEqualTo(1);
    }
    @Test void rolledBackUploadRemovesNewBlobRowsHistoryAndNeverPublishesFalseSuccess() throws Exception {
        long screen=screen();var prepared=media.prepare(new MockMultipartFile("file","rollback.png","image/png",image("png",4,3)),true);
        var actor=users.findByUsername("media-alice").orElseThrow();long before=jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='SCREEN_VERSION_CREATE' AND outcome='SUCCESS'",Long.class);
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{media.uploadVersion(screen,prepared,actor);throw new IllegalStateException("synthetic-rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(storage.exists(prepared.blob().key())).isFalse();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM screen_version",Integer.class)).isZero();assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM stored_file",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='SCREEN_VERSION_CREATE' AND outcome='SUCCESS'",Long.class)).isEqualTo(before);
        JsonNode created=create(null);long id=created.get("id").asLong();var attachment=media.prepare(new MockMultipartFile("file","rollback.pdf","application/pdf","%PDF-1.7 synthetic".getBytes()),false);
        int history=jdbc.queryForObject("SELECT COUNT(*) FROM requirement_history WHERE requirement_id=?",Integer.class,id);
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{requirements.attachment(id,1,attachment,actor);throw new IllegalStateException("synthetic-rollback");})).isInstanceOf(IllegalStateException.class);
        assertThat(storage.exists(attachment.blob().key())).isFalse();assertThat(jdbc.queryForObject("SELECT revision FROM requirement_entry WHERE id=?",Integer.class,id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM requirement_history WHERE requirement_id=?",Integer.class,id)).isEqualTo(history);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM security_audit_event WHERE action='REQUIREMENT_ATTACHMENT_ADD' AND outcome='SUCCESS'",Integer.class)).isZero();
    }
    @Test void committedAttachmentDeletionRetainsHttpResultWhenPhysicalCleanupFails() throws Exception {
        long id=create(null).get("id").asLong();JsonNode result=body(mvc.perform(multipart("/api/requirements/"+id+"/attachments").file(new MockMultipartFile("file","a.pdf","application/pdf","%PDF-1.7 synthetic".getBytes())).param("revision","1").session(alice.session()).header(alice.header(),alice.token())).andExpect(status().isOk()));
        long attachment=result.get("attachments").get(0).get("id").asLong();long failures=lifecycle.cleanupFailures();((FailingStorage)storage).failDelete.set(true);
        try { write(delete("/api/requirements/"+id+"/attachments/"+attachment).param("revision","2"),alice,null).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(3)).andExpect(jsonPath("$.attachments").isEmpty()); }
        finally { ((FailingStorage)storage).failDelete.set(false); }
        assertThat(lifecycle.cleanupFailures()).isEqualTo(failures+1);assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM stored_file",Integer.class)).isZero();assertThat(blobCount()).isEqualTo(1);
        String log=Files.exists(TEMP.resolve("test.log"))?Files.readString(TEMP.resolve("test.log")):"";assertThat(log.contains("synthetic-private-storage-canary")).isFalse();
    }
    @Test void adoIsManualAndRestrictedToAuthorOrAssignedReviewerAfterAgreement() throws Exception {
        JsonNode request=create(null);long id=request.get("id").asLong();Map<String,Object> link=new HashMap<>(Map.of("revision",1,"ticket","SYN-10","url","https://example.invalid/tickets/SYN-10"));
        write(put("/api/requirements/"+id+"/ado"),alice,link).andExpect(status().isBadRequest());
        write(put("/api/requirements/"+id+"/assignee"),alice,Map.of("revision",1,"reviewerId",bobId)).andExpect(status().isOk());
        write(post("/api/requirements/"+id+"/submit"),alice,Map.of("revision",2)).andExpect(status().isOk());
        write(put("/api/requirements/"+id+"/review"),bob,Map.of("revision",3,"decision","POSSIBLE","rationale","합성 근거","conditions","","scope","반영","exclusions","없음","acceptance","확인","estimate","SMALL","needsInfo",false)).andExpect(status().isOk());
        write(post("/api/requirements/"+id+"/agree"),alice,Map.of("revision",4)).andExpect(status().isOk());link.put("revision",5);
        write(put("/api/requirements/"+id+"/ado"),admin,link).andExpect(status().isForbidden());write(put("/api/requirements/"+id+"/ado"),other,link).andExpect(status().isForbidden());
        link.put("url","javascript:alert(1)");write(put("/api/requirements/"+id+"/ado"),alice,link).andExpect(status().isBadRequest());link.put("url","https://example.invalid/tickets/SYN-10");
        request=body(write(put("/api/requirements/"+id+"/ado"),bob,link).andExpect(status().isOk()));assertThat(request.get("status").asText()).isEqualTo("ADO_LINKED");assertThat(request.get("ado").get("linkedBy").asLong()).isEqualTo(bobId);
        assertThat(body(mvc.perform(get("/api/requirements/"+id+"/export").session(alice.session())).andExpect(status().isOk())).get("text").asText()).contains("판단 근거\n합성 근거","검토 가능 판단","revision 6");
        write(put("/api/requirements/"+id+"/ado"),bob,link).andExpect(status().isConflict());
    }
    @Test void concurrentVersionAndAnnotationAllocationUsesParentLockAndUniqueMonotonicNumbers() throws Exception {
        long screen=screen();var actor=users.findByUsername("media-alice").orElseThrow();ExecutorService executor=Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);List<Future<ScreenVersionResponse>> tasks=new ArrayList<>();
            for(int index=0;index<2;index++) {var prepared=media.prepare(new MockMultipartFile("file","a.png","image/png",image("png",4,3)),true);tasks.add(executor.submit(()->{ready.countDown();if(!start.await(5,TimeUnit.SECONDS))throw new IllegalStateException("allocation barrier timed out");return media.uploadVersion(screen,prepared,actor);}));}
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue();start.countDown();Set<Integer> allocated=new HashSet<>();long version=0;for(var task:tasks){var result=task.get(10,TimeUnit.SECONDS);allocated.add(result.version());version=result.id();}assertThat(allocated).containsExactlyInAnyOrder(1,2);
            long versionId=version;CountDownLatch annotationReady=new CountDownLatch(2),annotationStart=new CountDownLatch(1);List<Future<RequirementDetail>> requests=new ArrayList<>();
            for(int index=0;index<2;index++) requests.add(executor.submit(()->{annotationReady.countDown();if(!annotationStart.await(5,TimeUnit.SECONDS))throw new IllegalStateException("annotation barrier timed out");return requirements.create(new RequirementInput("병렬 박스",menu,"내용","이유","",false,"",versionId,new BoxInput(.1,.1,.3,.3),1),actor);}));
            assertThat(annotationReady.await(5,TimeUnit.SECONDS)).isTrue();annotationStart.countDown();Set<Integer> numbers=new HashSet<>();for(var task:requests)numbers.add(task.get(10,TimeUnit.SECONDS).annotation().number());assertThat(numbers).containsExactlyInAnyOrder(1,2);
        } finally {executor.shutdownNow();assertThat(executor.awaitTermination(5,TimeUnit.SECONDS)).isTrue();}
    }
    @Test void liveSwaggerDeclaresRequiredNumericFlagsNullableDetailsAndMultipartContracts()throws Exception {
        JsonNode document=body(mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()));JsonNode schemas=document.path("components").path("schemas");
        JsonNode version=schemas.path("RequirementScreenVersionResponse");JsonNode archived=version.path("properties").path("archived");
        assertThat(archived.path("type").asText()).isEqualTo("integer");assertThat(archived.path("format").asText()).isEqualTo("int32");
        assertThat(archived.path("enum").get(0).isIntegralNumber()).isTrue();assertThat(archived.path("enum").get(1).asInt()).isEqualTo(1);
        Set<String> required=new HashSet<>();version.path("required").forEach(value->required.add(value.asText()));assertThat(required).containsExactlyInAnyOrder("id","screenId","version","fileId","width","height","createdBy","createdAt","archived","createdByName");
        assertThat(version.path("properties").path("createdAt").path("format").asText()).isEqualTo("date-time");
        assertThat(schemas.path("RequirementDetail").path("properties").path("annotation").path("anyOf").toString()).contains("null","RequirementAnnotationResponse");
        JsonNode upload=document.path("paths").path("/api/screens/{id}/versions").path("post").path("requestBody").path("content").path("multipart/form-data").path("schema");
        if(upload.has("$ref"))upload=schemas.path(upload.get("$ref").asText().substring("#/components/schemas/".length()));
        assertThat(upload.path("properties").path("file").path("format").asText()).isEqualTo("binary");
    }
    private long user(String username,String role)throws Exception {return body(write(post("/api/users"),admin,Map.of("username",username,"displayName",username,"password",PASSWORD,"role",role)).andExpect(status().isOk())).get("id").asLong();}
    private long screen()throws Exception{return body(write(post("/api/screens"),bob,Map.of("menuId",menu,"name","원본 화면")).andExpect(status().isOk())).get("id").asLong();}
    private JsonNode create(Long version)throws Exception{return body(write(post("/api/requirements"),alice,input(version,1)).andExpect(status().isOk()));}
    private Map<String,Object> input(Long version,int revision){Map<String,Object> value=new HashMap<>(Map.of("title","이미지 요청","menuId",menu,"desired","내용","reason","이유","referenceText","","similar",false,"followParts","","revision",revision));value.put("screenVersionId",version);value.put("annotation",version==null?null:box());return value;}
    private Map<String,Double> box(){return Map.of("x",.1,"y",.1,"width",.3,"height",.3);}
    private JsonNode upload(long screen,Session session,byte[] bytes,String name,String mime)throws Exception{return body(mvc.perform(multipart("/api/screens/"+screen+"/versions").file(new MockMultipartFile("file",name,mime,bytes)).session(session.session()).header(session.header(),session.token())).andExpect(status().isOk()));}
    private ResultActions write(MockHttpServletRequestBuilder request,Session session,Object body)throws Exception {request.session(session.session()).header(session.header(),session.token());if(body!=null)request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body));return mvc.perform(request);}
    private JsonNode body(ResultActions result)throws Exception{return json.readTree(result.andReturn().getResponse().getContentAsByteArray());}
    private Session login(String username)throws Exception {Session initial=csrf(null);mvc.perform(post("/api/auth/login").session(initial.session()).header(initial.header(),initial.token()).param("username",username).param("password",PASSWORD)).andExpect(status().isNoContent());return csrf(initial.session());}
    private Session csrf(MockHttpSession session)throws Exception {var request=get("/api/auth/csrf");if(session!=null)request.session(session);var result=mvc.perform(request).andExpect(status().isOk()).andReturn();JsonNode body=json.readTree(result.getResponse().getContentAsByteArray());return new Session((MockHttpSession)result.getRequest().getSession(false),body.get("headerName").asText(),body.get("token").asText());}
    private record Session(MockHttpSession session,String header,String token){}
    private long blobCount()throws IOException {if(!Files.isDirectory(TEMP.resolve("uploads")))return 0;try(var paths=Files.list(TEMP.resolve("uploads"))){return paths.count();}}
    private static byte[] image(String format,int width,int height)throws IOException {var image=new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);var bytes=new ByteArrayOutputStream();if(!ImageIO.write(image,format,bytes))throw new IOException("Synthetic image writer unavailable");return bytes.toByteArray();}
    private static byte[] orientedJpeg(int orientation)throws IOException {byte[] raw=image("jpeg",4,3),metadata=ImageOrientationTest.jpeg(ImageOrientationTest.exif(orientation,true));ByteArrayOutputStream output=new ByteArrayOutputStream();output.write(raw,0,2);output.write(metadata,2,metadata.length-4);output.write(raw,2,raw.length-2);return output.toByteArray();}
    private static byte[] orientedPng(int orientation)throws IOException {byte[] raw=image("png",4,3),tiff=ImageOrientationTest.exif(orientation,true);ByteArrayOutputStream out=new ByteArrayOutputStream();out.write(raw,0,raw.length-12);DataOutputStream data=new DataOutputStream(out);data.writeInt(tiff.length);data.writeInt(0x65584966);data.write(tiff);java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(new byte[]{101,88,73,102});crc.update(tiff);data.writeInt((int)crc.getValue());out.write(raw,raw.length-12,12);return out.toByteArray();}
    private static Path temporary(){try{Path directory=Files.createTempDirectory("sc-media-tests-");Path secret=Files.writeString(directory.resolve("bootstrap.secret"),PASSWORD);if(Files.getFileStore(secret).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(secret,PosixFilePermissions.fromString("rw-------"));return directory;}catch(IOException exception){throw new IllegalStateException("Cannot create isolated media fixture");}}
    @AfterAll static void cleanup()throws IOException {try(var paths=Files.walk(TEMP)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
}
