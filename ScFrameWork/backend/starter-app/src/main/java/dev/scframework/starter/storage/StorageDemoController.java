package dev.scframework.starter.storage;

import dev.scframework.autoconfigure.storage.FileStorageTransactions;
import dev.scframework.core.ApiException;
import dev.scframework.core.storage.*;
import jakarta.annotation.PreDestroy;
import java.io.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** 자체 schema 없는 최소 소비 예제. 현재 기동의 metadata만 인정하며 종료 시 자료를 정리한다. */
@Profile({"file-storage","operations"}) @RestController @RequestMapping("/api/storage-demo")
public class StorageDemoController {
    private final FileStorage storage;
    private final FileStorageTransactions lifecycle;
    private final ConcurrentHashMap<String,StoredBlob> currentRun=new ConcurrentHashMap<>();
    public StorageDemoController(FileStorage storage,FileStorageTransactions lifecycle) { this.storage=storage;this.lifecycle=lifecycle; }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public StoredBlob upload(@RequestParam MultipartFile file,Authentication authentication) {
        admin(authentication);if (file.isEmpty()) throw new ApiException(400,"INVALID_INPUT","파일을 선택하세요.");
        StoredBlob blob=null;
        try (InputStream source=file.getInputStream()) {
            blob=storage.write(source,10L*1024*1024);currentRun.put(blob.key(),blob);return blob;
        } catch (FileSizeLimitException exception) { throw new ApiException(413,"FILE_TOO_LARGE","파일 크기 제한을 확인하세요."); }
        catch (IOException | RuntimeException exception) {
            if(blob!=null) {currentRun.remove(blob.key());lifecycle.cleanup(blob.key());}
            throw new ApiException(500,"FILE_STORAGE_FAILURE","파일을 처리할 수 없습니다.");
        }
    }
    @GetMapping("/{key}")
    public ResponseEntity<Resource> download(@PathVariable String key,Authentication authentication) {
        admin(authentication);StoredBlob blob=require(key);
        try {
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).contentLength(blob.size()).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename("demo.bin").build().toString()).body(new InputStreamResource(storage.open(key)));
        } catch (IOException exception) { throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다."); }
    }
    @DeleteMapping("/{key}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String key,Authentication authentication) { admin(authentication);require(key);currentRun.remove(key);lifecycle.cleanup(key); }
    private StoredBlob require(String key) { StoredBlob value=currentRun.get(key);if (value==null) throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다.");return value; }
    public boolean isReferenced(String key){return currentRun.containsKey(key);}
    private void admin(Authentication authentication) {
        if (authentication==null || authentication.getAuthorities().stream().noneMatch(role->role.getAuthority().equals("ROLE_ADMIN"))) throw new ApiException(403,"FORBIDDEN","이 작업을 수행할 권한이 없습니다.");
    }
    @PreDestroy public void cleanup() { currentRun.keySet().forEach(lifecycle::cleanup);currentRun.clear(); }
}
