package dev.scframework.reference.menu;

import jakarta.persistence.*;

/**
 * 업무 대상 메뉴의 영속 모델이다. parentId는 숫자 참조이며 active는 기존 DB/API 계약의 0/1이다.
 * 현재 메뉴 편집에는 요구사항처럼 revision 계약을 추가하지 않는다.
 */

@Entity
@Table(name = "menu_entry")
public class MenuEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long parentId;
    @Column(nullable = false, length = 120) private String name;
    @Column(nullable = false) private int sortOrder;
    @Column(nullable = false) private int active = 1;
    protected MenuEntity() {}
    public MenuEntity(Long parentId, String name, int sortOrder) { this.parentId = parentId; this.name = name; this.sortOrder = sortOrder; }
    public Long getId() { return id; }
    public Long getParentId() { return parentId; }
    public String getName() { return name; }
    public int getSortOrder() { return sortOrder; }
    public int getActive() { return active; }
    public void edit(String name, int sortOrder, boolean active) { this.name = name; this.sortOrder = sortOrder; this.active = active ? 1 : 0; }
}
