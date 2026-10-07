package dev.scframework.reference.media;

import dev.scframework.autoconfigure.storage.FileStorageTransactions;
import dev.scframework.core.ApiException;
import dev.scframework.core.audit.*;
import dev.scframework.core.storage.*;
import dev.scframework.reference.identity.*;
import dev.scframework.reference.menu.MenuService;
import dev.scframework.reference.requirements.*;
import jakarta.persistence.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import static dev.scframework.reference.media.MediaDtos.*;
import static dev.scframework.reference.requirements.RequirementDtos.*;

@Service
public class MediaService {
    public static final long MAX_BYTES = 10L*1024*1024;
    public record PreparedMedia(StoredBlob blob, String name, String mime, int width, int height) {}
    private final FileStorage storage;
    private final FileStorageTransactions lifecycle;
    private final StoredFileRepository files;
    private final ScreenRepository screens;
    private final ScreenVersionRepository versions;
    private final AnnotationRepository annotations;
    private final AttachmentRepository attachments;
    private final AdoRepository ado;
    private final RequirementRepository requirements;
    private final UserRepository users;
    private final MenuService menus;
    private final EntityManager em;
    private final Clock clock;
    private final SecurityAuditPublisher audit;
    public MediaService(FileStorage storage, FileStorageTransactions lifecycle, StoredFileRepository files,
            ScreenRepository screens, ScreenVersionRepository versions, AnnotationRepository annotations,
            AttachmentRepository attachments, AdoRepository ado, RequirementRepository requirements,
            UserRepository users, MenuService menus, EntityManager em, Clock clock, SecurityAuditPublisher audit) {
        this.storage=storage;this.lifecycle=lifecycle;this.files=files;this.screens=screens;this.versions=versions;
        this.annotations=annotations;this.attachments=attachments;this.ado=ado;this.requirements=requirements;
        this.users=users;this.menus=menus;this.em=em;this.clock=clock;this.audit=audit;
    }
    /** 원본 파일 준비는 DB transaction 전에 수행하고 실패 시 새 key를 정리한다. */
    public PreparedMedia prepare(MultipartFile file, boolean imageOnly) {
        if (file.isEmpty()) throw invalid("파일을 선택하세요.");
        if (file.getSize()>MAX_BYTES) throw tooLarge();
        StoredBlob blob=null;
        try (InputStream source=file.getInputStream()) { blob=storage.write(source,MAX_BYTES); }
        catch (FileSizeLimitException exception) { if(blob!=null)lifecycle.cleanup(blob.key());throw tooLarge(); }
        catch (IOException | RuntimeException exception) { if(blob!=null)lifecycle.cleanup(blob.key());throw storageFailure(); }
        try {
            if (blob.size()==0) throw invalid("파일을 선택하세요.");
            String mime=null;int width=0,height=0;
            try (InputStream source=storage.open(blob.key()); MemoryCacheImageInputStream input=new MemoryCacheImageInputStream(source)) {
                Iterator<ImageReader> readers=ImageIO.getImageReaders(input);
                if (readers.hasNext()) {
                    ImageReader reader=readers.next();
                    try {
                        String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                        if (Set.of("png","jpeg","jpg").contains(format)) {
                            reader.setInput(input,true,true);width=reader.getWidth(0);height=reader.getHeight(0);
                            if (width<1 || height<1 || width>12000 || height>12000 || (long)width*height>40_000_000) throw invalid("이미지 크기 제한을 확인하세요.");
                            if (reader.read(0)==null) throw invalid("유효한 PNG 또는 JPEG 파일을 선택하세요.");
                            mime=format.equals("png")?"image/png":"image/jpeg";
                        }
                    } finally { reader.dispose(); }
                }
            }
            if (mime!=null) {
                try (InputStream source=storage.open(blob.key())) {
                    int orientation=ImageOrientation.read(source,mime.equals("image/png"));
                    if (mime.equals("image/png") && orientation!=1) throw invalid("방향 메타데이터가 적용된 PNG는 지원하지 않습니다. 기본 방향으로 저장한 PNG 또는 JPEG를 선택하세요.");
                    // 브라우저 naturalWidth/Height와 같은, EXIF 적용 후 원본 좌표축을 공개한다.
                    if (orientation>=5) { int previous=width;width=height;height=previous; }
                }
            }
            if (mime==null && !imageOnly) {
                try (InputStream source=storage.open(blob.key())) {
                    if (Arrays.equals(source.readNBytes(5),"%PDF-".getBytes(StandardCharsets.US_ASCII))) mime="application/pdf";
                }
            }
            if (mime==null) throw invalid(imageOnly?"PNG 또는 JPEG 이미지를 선택하세요.":"PNG, JPEG 또는 PDF 파일을 선택하세요.");
            return new PreparedMedia(blob,displayName(file.getOriginalFilename()),mime,width,height);
        } catch (ApiException exception) { lifecycle.cleanup(blob.key());throw exception; }
        catch (IOException | RuntimeException exception) { lifecycle.cleanup(blob.key());throw invalid("유효한 PNG, JPEG 또는 PDF 파일을 선택하세요."); }
    }
    private String displayName(String name) {
        String value=Objects.toString(name,"").replace('\\','/');value=value.substring(value.lastIndexOf('/')+1);
        StringBuilder safe=new StringBuilder();
        for (int point:value.codePoints().toArray()) {
            int rendered=Character.isISOControl(point)?'_':point;
            if (safe.length()+Character.charCount(rendered)>180) break;safe.appendCodePoint(rendered);
        }
        return safe.toString().isBlank()?"첨부파일":safe.toString();
    }
    public void discard(PreparedMedia prepared) { lifecycle.cleanup(prepared.blob().key()); }
    public void trackRollback(PreparedMedia prepared) { lifecycle.onRollback(prepared.blob().key()); }
    private StoredFileEntity saveFile(PreparedMedia prepared, UserEntity actor) {
        StoredFileEntity entry=new StoredFileEntity();entry.storageKey=prepared.blob().key();entry.originalName=prepared.name();
        entry.mime=prepared.mime();entry.size=prepared.blob().size();entry.createdBy=actor.getId();entry.createdAt=now();return files.saveAndFlush(entry);
    }
    @Transactional(readOnly=true)
    public List<ScreenResponse> screens() { return screens.findAllByOrderByIdAsc().stream().map(this::screen).toList(); }
    @Transactional
    public ScreenResponse createScreen(ScreenInput input,UserEntity actor) {
        if (!actor.isReviewer()) throw forbidden();menus.requireActive(input.menuId());
        ScreenEntity screen=new ScreenEntity();screen.menuId=input.menuId();screen.name=input.name();screens.saveAndFlush(screen);
        publish(actor,"SCREEN_CREATE","SCREEN",screen.id);return screen(screen);
    }
    private ScreenResponse screen(ScreenEntity screen) { return new ScreenResponse(screen.id,screen.menuId,screen.name); }
    @Transactional(readOnly=true)
    public void requireScreen(long id) { if (!screens.existsById(id)) throw missing(); }
    @Transactional(readOnly=true)
    public List<ScreenVersionResponse> versions(long id) { requireScreen(id);return versions.findByScreenIdOrderByVersionDesc(id).stream().map(this::versionResponse).toList(); }
    @Transactional
    public ScreenVersionResponse uploadVersion(long screenId,PreparedMedia prepared,UserEntity actor) {
        trackRollback(prepared);
        ScreenEntity screen=em.find(ScreenEntity.class,screenId,LockModeType.PESSIMISTIC_WRITE);if (screen==null) throw missing();
        menus.requireActive(screen.menuId);
        StoredFileEntity file=saveFile(prepared,actor);ScreenVersionEntity version=new ScreenVersionEntity();
        version.screenId=screenId;version.version=screen.nextVersion++;version.fileId=file.id;version.width=prepared.width();version.height=prepared.height();
        version.createdBy=actor.getId();version.createdAt=now();versions.saveAndFlush(version);
        publish(actor,"SCREEN_VERSION_CREATE","SCREEN_VERSION",version.id);return versionResponse(version);
    }
    @Transactional
    public ScreenVersionResponse archive(long id,UserEntity actor) {
        ScreenVersionEntity version=lockedVersion(id);
        if (!actor.isReviewer() && !Objects.equals(version.createdBy,actor.getId())) throw forbidden();
        version.archived=1;versions.flush();publish(actor,"SCREEN_VERSION_ARCHIVE","SCREEN_VERSION",id);return versionResponse(version);
    }
    public ScreenVersionEntity lockedVersion(long id) { ScreenVersionEntity value=em.find(ScreenVersionEntity.class,id,LockModeType.PESSIMISTIC_WRITE);if (value==null) throw missing();return value; }
    public void validateVersion(long versionId,long menuId,boolean newRequest) {
        ScreenVersionEntity version=newRequest?lockedVersion(versionId):versions.findById(versionId).orElseThrow(MediaService::missing);ScreenEntity screen=screens.findById(version.screenId).orElseThrow(MediaService::missing);
        if (screen.menuId!=menuId) throw invalid("선택한 이미지와 메뉴가 일치하지 않습니다.");
        if (newRequest && version.archived==1) throw invalid("보관한 버전에는 새 요청을 추가할 수 없습니다.");
    }
    private ScreenVersionResponse versionResponse(ScreenVersionEntity value) {
        return new ScreenVersionResponse(value.id,value.screenId,value.version,value.fileId,value.width,value.height,value.createdBy,value.createdAt.toString(),value.archived,name(value.createdBy));
    }
    public ScreenVersionResponse versionFor(Long id) { return id==null?null:versionResponse(versions.findById(id).orElseThrow(MediaService::missing)); }
    public String screenNameFor(long versionId) { ScreenVersionEntity version=versions.findById(versionId).orElseThrow(MediaService::missing);return screens.findById(version.screenId).orElseThrow(MediaService::missing).name; }
    public AnnotationResponse annotationFor(long id) { return annotations.findByRequirementId(id).map(this::annotationResponse).orElse(null); }
    private AnnotationResponse annotationResponse(AnnotationEntity value) { return new AnnotationResponse(value.id,value.requirementId,value.screenVersionId,value.number,value.x,value.y,value.width,value.height); }
    public void saveAnnotation(long requirementId,long versionId,BoxInput box) {
        box.validate();ScreenVersionEntity version=lockedVersion(versionId);
        AnnotationEntity value=annotations.findByRequirementId(requirementId).orElse(null);
        if (value==null) { value=new AnnotationEntity();value.requirementId=requirementId;value.screenVersionId=versionId;value.number=version.nextAnnotation++; }
        value.x=box.x();value.y=box.y();value.width=box.width();value.height=box.height();annotations.saveAndFlush(value);
    }
    public void deleteAnnotation(long id) { annotations.findByRequirementId(id).ifPresent(annotations::delete);annotations.flush(); }
    @Transactional(readOnly=true)
    public List<VersionAnnotationResponse> annotations(long versionId,UserEntity actor) {
        if (!versions.existsById(versionId)) throw missing();List<VersionAnnotationResponse> result=new ArrayList<>();
        for (AnnotationEntity value:annotations.findByScreenVersionIdOrderByNumberAsc(versionId)) {
            RequirementEntity request=requirements.findById(value.requirementId).orElseThrow(MediaService::missing);
            if ("DRAFT".equals(request.getStatus()) && !actor.isAdmin() && !Objects.equals(request.getAuthorId(),actor.getId())) continue;
            result.add(new VersionAnnotationResponse(value.id,value.requirementId,value.screenVersionId,value.number,value.x,value.y,value.width,value.height,request.getTitle(),request.getRevision(),request.getAuthorId()));
        }
        return List.copyOf(result);
    }
    public List<AttachmentResponse> attachmentsFor(long id) {
        return attachments.findByRequirementIdOrderByIdAsc(id).stream().map(value->{StoredFileEntity file=files.findById(value.fileId).orElseThrow(MediaService::missing);return new AttachmentResponse(value.id,file.id,file.originalName,file.mime,file.size,value.createdAt.toString());}).toList();
    }
    public void addAttachment(long id,PreparedMedia prepared,UserEntity actor) {
        StoredFileEntity file=saveFile(prepared,actor);AttachmentEntity value=new AttachmentEntity();value.requirementId=id;value.fileId=file.id;value.createdAt=now();attachments.saveAndFlush(value);
    }
    public void removeAttachment(long id,long attachmentId) {
        AttachmentEntity value=attachments.findById(attachmentId).orElseThrow(MediaService::missing);
        if (value.requirementId!=id) throw missing();StoredFileEntity file=files.findById(value.fileId).orElseThrow(MediaService::missing);
        attachments.delete(value);attachments.flush();files.delete(file);files.flush();lifecycle.afterCommitDelete(file.storageKey);
    }
    public AdoResponse adoFor(long id) { return ado.findById(id).map(value->new AdoResponse(value.ticket,value.url,value.linkedBy,name(value.linkedBy),value.linkedAt.toString())).orElse(null); }
    public void saveAdo(long id,AdoInput input,UserEntity actor) {
        AdoEntity value=ado.findById(id).orElse(null);if (value==null) {value=new AdoEntity();value.requirementId=id;}
        value.ticket=input.ticket();value.url=input.url();value.linkedBy=actor.getId();value.linkedAt=now();ado.saveAndFlush(value);
    }
    @Transactional(readOnly=true)
    public StoredFileEntity readableFile(long id,UserEntity actor) {
        StoredFileEntity file=files.findById(id).orElseThrow(MediaService::missing);
        AttachmentEntity attachment=attachments.findByFileId(id).orElse(null);
        if (attachment!=null) {
            RequirementEntity request=requirements.findById(attachment.requirementId).orElseThrow(MediaService::missing);
            if ("DRAFT".equals(request.getStatus()) && !actor.isAdmin() && !Objects.equals(request.getAuthorId(),actor.getId())) throw forbidden();
        } else if (versions.findByFileId(id).isEmpty()) throw missing();
        return file;
    }
    public InputStream open(StoredFileEntity file) {
        try { if (!storage.exists(file.storageKey)) throw missing();return storage.open(file.storageKey); }
        catch (IOException exception) { throw storageFailure(); }
    }
    @Transactional(readOnly=true)
    public boolean isScreenFile(long fileId) { return versions.findByFileId(fileId).isPresent(); }
    private String name(long id) { return users.findById(id).orElseThrow(MediaService::missing).getDisplayName(); }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
    private void publish(UserEntity actor,String action,String resource,long id) { audit.publish(new SecurityAuditEvent(actor.getUsername(),actor.getId(),now(),action,"SUCCESS",resource,Long.toString(id),null,null)); }
    private static ApiException invalid(String message) { return new ApiException(400,"INVALID_INPUT",message); }
    private static ApiException missing() { return new ApiException(404,"NOT_FOUND","대상을 찾을 수 없습니다."); }
    private static ApiException forbidden() { return new ApiException(403,"FORBIDDEN","이 작업을 수행할 권한이 없습니다."); }
    private static ApiException tooLarge() { return new ApiException(413,"FILE_TOO_LARGE","파일 크기 제한을 확인하세요."); }
    private static ApiException storageFailure() { return new ApiException(500,"FILE_STORAGE_FAILURE","파일을 처리할 수 없습니다."); }
}
