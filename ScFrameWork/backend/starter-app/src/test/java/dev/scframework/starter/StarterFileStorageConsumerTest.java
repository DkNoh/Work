package dev.scframework.starter;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import dev.scframework.core.storage.FileStorage;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;

/** 소비 앱은 현재 실행의 whitelist만 가지며 Reference 도메인/DDL을 가져오지 않는다. */
@SpringBootTest @AutoConfigureMockMvc(print=MockMvcPrint.NONE) @ActiveProfiles("file-storage")
@Import(StarterFileStorageConsumerTest.Users.class)
class StarterFileStorageConsumerTest {
    private static final String PASSWORD="synthetic-storage-demo-password";private static final Path TEMP=temporary();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("SC_BOOTSTRAP_SECRET_FILE",()->TEMP.resolve("bootstrap.secret").toString());registry.add("SC_BOOTSTRAP_USERNAME",()->"storage-admin");
        registry.add("spring.datasource.url",()->"jdbc:h2:mem:starter-files-"+TEMP.getFileName()+";DB_CLOSE_DELAY=-1");
        registry.add("sc.framework.file-storage.enabled",()->true);registry.add("sc.framework.file-storage.root",()->TEMP.resolve("uploads").toString());registry.add("logging.file.name",()->TEMP.resolve("test.log").toString());
    }
    @TestConfiguration(proxyBeanMethods=false) static class Users {
        @Bean @Primary UserDetailsService syntheticUsers(){String hash=new BCryptPasswordEncoder().encode(PASSWORD);return new InMemoryUserDetailsManager(User.withUsername("storage-admin").password(hash).roles("ADMIN").build(),User.withUsername("storage-reader").password(hash).roles("REQUESTER").build());}
        @Bean org.springframework.security.authentication.AuthenticationProvider syntheticAuthenticationProvider(@org.springframework.beans.factory.annotation.Qualifier("syntheticUsers")UserDetailsService users) {
            var provider=new org.springframework.security.authentication.dao.DaoAuthenticationProvider(users);provider.setPasswordEncoder(new BCryptPasswordEncoder());return provider;
        }
    }
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired FileStorage storage;@Autowired DataSource dataSource;
    @Test void optionalStarterConsumesSpiWithSessionCsrfRoundTripAndNoReferenceDdl()throws Exception {
        Session admin=login("storage-admin");byte[] bytes="synthetic-neutral-file".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var result=mvc.perform(multipart("/api/storage-demo").file(new MockMultipartFile("file","private-name.bin","application/octet-stream",bytes)).session(admin.session()).header(admin.header(),admin.token())).andExpect(status().isOk()).andReturn();
        JsonNode payload=json.readTree(result.getResponse().getContentAsByteArray());assertThat(payload.size()).isEqualTo(2);String key=payload.get("key").asText();assertThat(key).matches("[0-9a-f-]{36}");assertThat(payload.get("size").asInt()).isEqualTo(bytes.length);assertThat(payload.toString().contains(TEMP.toString())).isFalse();
        mvc.perform(get("/api/storage-demo/"+key).session(admin.session())).andExpect(status().isOk()).andExpect(content().bytes(bytes)).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(delete("/api/storage-demo/"+key).session(admin.session()).header(admin.header(),admin.token())).andExpect(status().isNoContent());assertThat(storage.exists(key)).isFalse();
        mvc.perform(get("/api/storage-demo/"+key).session(admin.session())).andExpect(status().isNotFound());
        assertThat(new JdbcTemplate(dataSource).queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN('REFERENCE_USER','STORED_FILE','SCREEN_VERSION')",Integer.class)).isZero();
    }
    @Test void whitelistAdminCsrfAndLimitRejectUnauthorizedUnknownAndPartialWrites()throws Exception {
        Session admin=login("storage-admin"),reader=login("storage-reader");
        mvc.perform(multipart("/api/storage-demo").file(new MockMultipartFile("file",new byte[]{1})).session(admin.session())).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/storage-demo").file(new MockMultipartFile("file",new byte[]{1})).session(reader.session()).header(reader.header(),reader.token())).andExpect(status().isForbidden());
        mvc.perform(get("/api/storage-demo/"+UUID.randomUUID()).session(admin.session())).andExpect(status().isNotFound());
        mvc.perform(multipart("/api/storage-demo").file(new MockMultipartFile("file",new byte[10*1024*1024+1])).session(admin.session()).header(admin.header(),admin.token())).andExpect(status().isPayloadTooLarge());
        mvc.perform(multipart("/api/storage-demo").file(new MockMultipartFile("file",new byte[0])).session(admin.session()).header(admin.header(),admin.token())).andExpect(status().isBadRequest());
        MockMultipartFile closeFailure=new MockMultipartFile("file","close.bin","application/octet-stream",new byte[]{1,2}) {
            @Override public java.io.InputStream getInputStream(){return new java.io.ByteArrayInputStream(new byte[]{1,2}){@Override public void close()throws IOException{throw new IOException("synthetic-input-close-canary");}};}
        };
        mvc.perform(multipart("/api/storage-demo").file(closeFailure).session(admin.session()).header(admin.header(),admin.token())).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("FILE_STORAGE_FAILURE"));
        if(Files.isDirectory(TEMP.resolve("uploads")))try(var files=Files.list(TEMP.resolve("uploads"))){assertThat(files.count()).isZero();}
    }
    private Session login(String username)throws Exception {Session initial=csrf(null);mvc.perform(post("/api/auth/login").session(initial.session()).header(initial.header(),initial.token()).param("username",username).param("password",PASSWORD)).andExpect(status().isNoContent());return csrf(initial.session());}
    private Session csrf(MockHttpSession session)throws Exception {var request=get("/api/auth/csrf");if(session!=null)request.session(session);var result=mvc.perform(request).andExpect(status().isOk()).andReturn();var body=json.readTree(result.getResponse().getContentAsByteArray());return new Session((MockHttpSession)result.getRequest().getSession(false),body.get("headerName").asText(),body.get("token").asText());}
    private record Session(MockHttpSession session,String header,String token){}
    private static Path temporary(){try{Path directory=Files.createTempDirectory("sc-starter-files-");Path secret=Files.writeString(directory.resolve("bootstrap.secret"),PASSWORD);if(Files.getFileStore(secret).supportsFileAttributeView("posix"))Files.setPosixFilePermissions(secret,PosixFilePermissions.fromString("rw-------"));return directory;}catch(IOException exception){throw new IllegalStateException("Cannot create isolated storage fixture");}}
    @AfterAll static void cleanup()throws IOException {try(var files=Files.walk(TEMP)){for(var path:files.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}}
}
