-- 앱 소유 sqlserver 새 스키마 DDL. 기존 H2 migration은 별도 경로에서 checksum을 보존한다.
CREATE TABLE starter_note (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    owner NVARCHAR(64) NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>=1),
    updated_at DATETIMEOFFSET(6) NOT NULL
);
CREATE INDEX idx_starter_note_owner_updated ON starter_note(owner,updated_at DESC,id DESC);
