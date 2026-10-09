package dev.scframework.autoconfigure.scheduling;

import dev.scframework.core.ApiException;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/*
 * 소비 앱/공통이 bean으로 등록한 작업을 코드별 불변 Map으로 정리한다.
 * 코드 형식/실행 모드/중복을 시작 때 검사하고 require는 없는 코드를 400으로 거절한다.
 * all은 화면과 API가 안정된 순서로 작업 목록을 보여 주도록 코드순으로 반환한다.
 */

public final class RegisteredTaskRegistry {
    private final Map<String, RegisteredOperationalTask> tasks;
    public RegisteredTaskRegistry(Collection<RegisteredOperationalTask> values) {
        Map<String, RegisteredOperationalTask> registered = new LinkedHashMap<>();
        for (var task : values) {
            String code = task.jobCode();
            if (code == null || !code.matches("[A-Z][A-Z0-9_]{0,63}") || task.executionMode() == null
                    || registered.putIfAbsent(code, task) != null)
                throw new IllegalStateException("Invalid or duplicate operational task registration");
        }
        tasks = Map.copyOf(registered);
    }
    public RegisteredOperationalTask require(String code) {
        RegisteredOperationalTask task = tasks.get(code);
        if (task == null) throw new ApiException(400, "INVALID_INPUT", "등록한 운영 작업을 선택해 주세요.");
        return task;
    }
    public List<RegisteredOperationalTask> all() { return tasks.values().stream().sorted(java.util.Comparator.comparing(RegisteredOperationalTask::jobCode)).toList(); }
}
