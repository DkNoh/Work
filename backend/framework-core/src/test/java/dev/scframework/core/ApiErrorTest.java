package dev.scframework.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ApiErrorTest {
    @Test
    void fieldErrorsCannotBeChangedAfterTheResponseIsCreated() {
        var fields = new ArrayList<>(List.of(new FieldViolation("title", "required")));
        var error = new ApiError("INVALID_INPUT", "invalid", fields);
        fields.clear();
        assertEquals(1, error.errors().size());
        assertThrows(UnsupportedOperationException.class, () -> error.errors().clear());
        assertEquals(List.of(), ApiError.of("AUTH_REQUIRED", "login").errors());
    }
}
