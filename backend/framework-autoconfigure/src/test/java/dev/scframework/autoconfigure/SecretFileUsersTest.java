package dev.scframework.autoconfigure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.scframework.autoconfigure.security.SecretFileUsers;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class SecretFileUsersTest {
    @TempDir Path directory;

    @Test
    void missingFileFailsClosedWithoutPasswordFallback() {
        assertThatThrownBy(() -> SecretFileUsers.load(null, "admin", new BCryptPasswordEncoder()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("SC_BOOTSTRAP_SECRET_FILE");
        assertThatThrownBy(() -> SecretFileUsers.load(directory.resolve("missing").toString(), "admin", new BCryptPasswordEncoder()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("missing");
    }

    @Test
    void privateSyntheticSecretCreatesOnlyAHash() throws Exception {
        Path path = Files.writeString(directory.resolve("test.secret"), "synthetic-secret-for-test-only\n");
        if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rw-------"));
        }
        var encoder = new BCryptPasswordEncoder();
        var user = SecretFileUsers.load(path.toString(), "test-admin", encoder).loadUserByUsername("test-admin");
        assertThat(user.getPassword()).startsWith("$2");
        assertThat(encoder.matches("synthetic-secret-for-test-only", user.getPassword())).isTrue();
        if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rw-r--r--"));
            assertThatThrownBy(() -> SecretFileUsers.load(path.toString(), "test-admin", encoder))
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining("600");
        }
    }
}
