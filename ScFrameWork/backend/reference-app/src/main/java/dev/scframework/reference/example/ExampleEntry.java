package dev.scframework.reference.example;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

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
