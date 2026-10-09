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

/*
 * 파일 SPI만 독립적으로 소비하는 최소 예제다. 현재 프로세스의 ConcurrentHashMap이 허용 metadata 목록이다.
 * ADMIN만 업로드/다운로드/삭제할 수 있고 임의 저장 키를 알더라도 현재 목록에 없으면 다운로드하지 못한다.
 * 영속 업무 metadata 예제가 아니므로 재기동 시 목록은 복원되지 않고 종료 hook에서 현재 실행 자료를 정리한다.
 */

/** 자체 schema 없는 최소 소비 예제. 현재 기동의 metadata만 인정하며 종료 시 자료를 정리한다. */
@Profile({"file-storage","operations"}) @RestController @RequestMapping("/api/storage-demo")
public class StorageDemoController {
    private final FileStorage storage;
    private final FileStorageTransactions lifecycle;
    private final ConcurrentHashMap<String,StoredBlob> currentRun=new ConcurrentHashMap<>();
    public StorageDemoController(FileStorage storage,FileStorageTransactions lifecycle) { this.storage=storage;this.lifecycle=lifecycle; }
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    // 업로드 스트림은 try-with-resources로 닫는다. 실제 바이트 제한은 storage.write가 확인하고 성공 blob만 currentRun에 등록한다.
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
    // 허용 metadata를 먼저 확인한 뒤 스트림 응답을 만든다. no-store와 attachment로 브라우저 캐시/인라인 렌더링을 제어한다.
    public ResponseEntity<Resource> download(@PathVariable String key,Authentication authentication) {
        admin(authentication);StoredBlob blob=require(key);
        try {
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).contentLength(blob.size()).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename("demo.bin").build().toString()).body(new InputStreamResource(storage.open(key)));
        } catch (IOException exception) { throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다."); }
    }
    @DeleteMapping("/{key}") @ResponseStatus(HttpStatus.NO_CONTENT)
    // metadata 목록에서 먼저 참조를 제거한 뒤 공통 정리 경계로 실제 삭제를 요청한다. durable 모드에서는 삭제가 후속 처리될 수 있다.
    public void delete(@PathVariable String key,Authentication authentication) { admin(authentication);require(key);currentRun.remove(key);lifecycle.cleanup(key); }
    private StoredBlob require(String key) { StoredBlob value=currentRun.get(key);if (value==null) throw new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다.");return value; }
    public boolean isReferenced(String key){return currentRun.containsKey(key);}
    private void admin(Authentication authentication) {
        if (authentication==null || authentication.getAuthorities().stream().noneMatch(role->role.getAuthority().equals("ROLE_ADMIN"))) throw new ApiException(403,"FORBIDDEN","이 작업을 수행할 권한이 없습니다.");
    }
    // 애플리케이션 종료 시 Spring이 호출한다. 현재 실행의 모든 키에 정리를 요청하고 메모리 목록을 비운다.
    @PreDestroy public void cleanup() { currentRun.keySet().forEach(lifecycle::cleanup);currentRun.clear(); }
}
