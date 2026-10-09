package __JAVA_PACKAGE__;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryPermission;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.EnumSet;
import java.util.List;

/**
 * 생성 앱 테스트의 합성 비밀번호 파일 작성기다. 실제 사용자 secret을 읽거나 출력하지 않는다.
 * POSIX 파일 시스템은 생성 순간 600을 부여하고, Windows는 임시 부모/파일을 소유자 ACL로 제한한다.
 * 지원되지 않는 POSIX API를 무조건 호출하지 않으며 권한 설정 실패는 테스트 실패로 전달한다.
 */
final class SyntheticSecretFiles {
    private SyntheticSecretFiles() {}

    static Path write(Path file, String value) throws IOException {
        if (Files.getFileAttributeView(file.getParent(), PosixFileAttributeView.class) != null) {
            Files.createFile(file, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
        } else {
            restrictOwner(file.getParent());
            Files.createFile(file);
            restrictOwner(file);
        }
        return Files.writeString(file, value);
    }

    private static void restrictOwner(Path path) throws IOException {
        var acl = Files.getFileAttributeView(path, AclFileAttributeView.class);
        if (acl == null) throw new IOException("Synthetic secret requires POSIX or ACL permissions");
        acl.setAcl(List.of(AclEntry.newBuilder().setType(AclEntryType.ALLOW)
                .setPrincipal(Files.getOwner(path)).setPermissions(EnumSet.allOf(AclEntryPermission.class)).build()));
    }
}
