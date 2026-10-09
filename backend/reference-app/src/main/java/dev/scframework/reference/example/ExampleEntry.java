package dev.scframework.reference.example;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 // 요청 revision 비교 후에도 동시 UPDATE/DELETE가 생길 수 있다. @Version 조건이 DB의 마지막 경쟁을 감지한다.
 // flush는 SQL/버전 검사를 앞당기지만 commit은 아니므로 뒤 단계 실패 시 같은 트랜잭션의 변경도 rollback된다.
 * 단순 예제의 JPA 영속 모델이다. title 변경은 dirty checking으로 UPDATE되고 revision은 @Version이 관리한다.
 */

@Entity
@Table(name = "example_entry")
public class ExampleEntry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Version @Column(nullable = false)
    private int revision = 1;

    protected ExampleEntry() {}
    public ExampleEntry(String title) { this.title = title; }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public int getRevision() { return revision; }
    public void rename(String title) { this.title = title; }
}
