package dev.scframework.autoconfigure.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Set;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

/** 001 개발 계정 어댑터. 운영 사용자 저장소는 소비 앱이 UserDetailsService로 대체한다. */
public final class SecretFileUsers {
    private SecretFileUsers() {}

    public static UserDetailsService load(String filename, String username, PasswordEncoder encoder) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalStateException("SC_BOOTSTRAP_SECRET_FILE must point to a new private secret file");
        }
        if (username == null || !username.matches("[A-Za-z0-9._-]{1,64}")) {
            throw new IllegalStateException("SC_BOOTSTRAP_USERNAME is invalid");
        }
        Path path = Path.of(filename);
        try {
            if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
                throw new IllegalStateException("Bootstrap secret file is missing or unreadable");
            }
            if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
                Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(path);
                Set<PosixFilePermission> required = Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
                if (!permissions.equals(required)) {
                    throw new IllegalStateException("Bootstrap secret file must have mode 600");
                }
            }
            String password = Files.readString(path, StandardCharsets.UTF_8).strip();
            int length = password.getBytes(StandardCharsets.UTF_8).length;
            if (length < 16 || length > 72) {
                throw new IllegalStateException("Bootstrap secret must contain 16 to 72 UTF-8 bytes");
            }
            return new InMemoryUserDetailsManager(User.withUsername(username)
                    .password(encoder.encode(password)).roles("ADMIN").build());
        } catch (IOException exception) {
            // 파일 내용이나 암호를 예외·로그에 포함하지 않는다.
            throw new IllegalStateException("Could not read bootstrap secret file");
        }
    }
}
