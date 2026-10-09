package dev.scframework.reference.example;

import dev.scframework.core.ApiException;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 단순 조회/등록/수정은 JPA, 별도 집계 예제는 MyBatis로 수행한다.
 * 수정은 요청 revision 사전 비교와 DB @Version 경쟁 검사를 함께 사용하고 둘 다 409 계약으로 정리한다.
 */

@Service
public class ExampleService {
    private final ExampleRepository repository;
    private final ExampleReadMapper readMapper;

    public ExampleService(ExampleRepository repository, ExampleReadMapper readMapper) {
        this.repository = repository;
        this.readMapper = readMapper;
    }

    @Transactional(readOnly = true)
    public ExamplePage list(int page, int size) {
        // 정렬 SQL을 입력 문자열로 구성하지 않고 허용된 고정 정렬을 사용한다.
        var result = repository.findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
        return new ExamplePage(result.getContent().stream().map(ExampleDto::from).toList(), result.getTotalElements(), page, size);
    }

    @Transactional
    // 제목 정규화 후 saveAndFlush로 INSERT를 실행하고 생성 ID/초기 revision을 응답한다. flush 후에도 트랜잭션 commit은 메서드 정상 종료 시점이다.
    public ExampleDto create(String title) {
        ExampleEntry entry = repository.saveAndFlush(new ExampleEntry(title.strip()));
        return ExampleDto.from(entry);
    }

    @Transactional
    // 편집 기준과 현재 revision을 먼저 비교한다. 통과 후 다른 요청이 먼저 commit한 경쟁은 flush의 @Version 실패로 다시 잡는다.
    public ExampleDto update(long id, String title, int expectedRevision) {
        ExampleEntry entry = repository.findById(id).orElseThrow(() -> new ApiException(404, "NOT_FOUND", "예제를 찾을 수 없습니다."));
        if (entry.getRevision() != expectedRevision) throw conflict();
        entry.rename(title.strip());
        try {
            repository.flush();
        } catch (ObjectOptimisticLockingFailureException exception) {
            throw conflict();
        }
        return ExampleDto.from(entry);
    }

    @Transactional(readOnly = true)
    // 읽기 전용 MyBatis 집계다. JPA 영속 모델을 불필요하게 모두 로드하지 않고 count SQL의 결과만 DTO로 감싼다.
    public ExampleSummary summary() { return new ExampleSummary(readMapper.countEntries()); }

    private ApiException conflict() {
        return new ApiException(409, "REVISION_CONFLICT", "다른 요청이 예제를 변경했습니다. 최신 내용을 조회해 주세요.");
    }

    public record ExampleSummary(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total) {}
}
