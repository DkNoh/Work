-- 앱 소유 sqlserver 새 스키마 DDL. 기존 H2 migration은 별도 경로에서 checksum을 보존한다.
CREATE TABLE example_entry (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT example_title_nonblank CHECK (LEN(TRIM(title)) > 0),
    CONSTRAINT example_revision_positive CHECK (revision >= 1)
);
