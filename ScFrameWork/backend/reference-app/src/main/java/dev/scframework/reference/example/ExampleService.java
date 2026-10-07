package dev.scframework.reference.example;

import dev.scframework.core.ApiException;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    public ExampleDto create(String title) {
        ExampleEntry entry = repository.saveAndFlush(new ExampleEntry(title.strip()));
        return ExampleDto.from(entry);
    }

    @Transactional
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
    public ExampleSummary summary() { return new ExampleSummary(readMapper.countEntries()); }

    private ApiException conflict() {
        return new ApiException(409, "REVISION_CONFLICT", "다른 요청이 예제를 변경했습니다. 최신 내용을 조회해 주세요.");
    }

    public record ExampleSummary(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total) {}
}
