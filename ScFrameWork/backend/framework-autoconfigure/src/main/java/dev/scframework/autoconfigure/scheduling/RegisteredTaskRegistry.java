package dev.scframework.autoconfigure.scheduling;

import dev.scframework.core.ApiException;
import dev.scframework.core.scheduling.RegisteredOperationalTask;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
