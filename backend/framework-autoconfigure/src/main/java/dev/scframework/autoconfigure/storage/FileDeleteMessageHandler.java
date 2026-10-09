package dev.scframework.autoconfigure.storage;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.messaging.MessageHandler;
import dev.scframework.core.messaging.ScMessage;
import dev.scframework.core.storage.FileReferenceLookup;
import dev.scframework.core.storage.FileStorage;
import org.springframework.beans.factory.ObjectProvider;

/*
 * FILE_DELETE 메시지를 읽고 현재 앱 metadata 참조가 없을 때만 바이너리를 삭제한다.
 * UUID 키만 허용하며 참조 조회 실패는 무시하지 않아 메시지 TX rollback/재시도로 전달된다.
 * 이미 없는 파일을 지우는 저장소 계약과 inbox가 함께 중복 전달을 처리한다.
 */

public final class FileDeleteMessageHandler implements MessageHandler {
    public record DeleteInput(String key){public DeleteInput{if(key==null||!key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw new IllegalArgumentException("SC_STORAGE_KEY_INVALID");}}
    private final FileStorage storage;private final ObjectProvider<FileReferenceLookup> references;private final ObjectMapper mapper;
    public FileDeleteMessageHandler(FileStorage storage,ObjectProvider<FileReferenceLookup> references,ObjectMapper mapper){this.storage=storage;this.references=references;this.mapper=mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);}
    private DeleteInput read(String payload){try{return mapper.readValue(payload,DeleteInput.class);}catch(java.io.IOException exception){throw new IllegalArgumentException("SC_STORAGE_DELETE_INVALID");}}
    @Override public String type(){return "FILE_DELETE";}
    @Override public void validate(String payload){read(payload);}
    @Override public void handle(ScMessage message)throws java.io.IOException{
        String key=read(message.payload()).key();
        // 현재 DB 연결이 남아 있으면 삭제하지 않는다. 조회 실패는 TX rollback/retry로 전달된다.
        if(!references.getObject().isReferenced(key))storage.delete(key);
    }
}
