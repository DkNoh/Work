package dev.scframework.reference.identity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "reference_user")
public class UserEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 64) private String username;
    @Column(nullable = false, length = 80) private String displayName;
    @Column(nullable = false, length = 100) private String passwordHash;
    @Column(nullable = false, length = 16) private String role;
    @Column(nullable = false) private Instant createdAt;
    protected UserEntity() {}
    public UserEntity(String username, String displayName, String passwordHash, String role, Instant createdAt) {
        this.username = username; this.displayName = displayName; this.passwordHash = passwordHash;
        this.role = role; this.createdAt = createdAt;
    }
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getDisplayName() { return displayName; }
    public String getPasswordHash() { return passwordHash; }
    void changePasswordHash(String encodedPassword) { this.passwordHash = encodedPassword; }
    public String getRole() { return role; }
    public boolean isAdmin() { return "ADMIN".equals(role); }
    public boolean isReviewer() { return isAdmin() || "REVIEWER".equals(role); }
}
