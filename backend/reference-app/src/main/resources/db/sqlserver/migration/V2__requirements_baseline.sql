-- 앱 소유 sqlserver 새 스키마 DDL. 기존 H2 migration은 별도 경로에서 checksum을 보존한다.
CREATE TABLE reference_user (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(64) NOT NULL UNIQUE,
    display_name NVARCHAR(80) NOT NULL,
    password_hash NVARCHAR(100) NOT NULL,
    role NVARCHAR(16) NOT NULL CHECK (role IN ('REQUESTER', 'REVIEWER', 'ADMIN')),
    created_at DATETIMEOFFSET(6) NOT NULL
);
CREATE TABLE menu_entry (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    parent_id BIGINT REFERENCES menu_entry(id),
    name NVARCHAR(120) NOT NULL,
    sort_order INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE TABLE requirement_entry (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    menu_id BIGINT NOT NULL REFERENCES menu_entry(id),
    title NVARCHAR(200) NOT NULL,
    desired NVARCHAR(MAX) NOT NULL,
    reason NVARCHAR(MAX) NOT NULL,
    reference_text NVARCHAR(MAX) NOT NULL,
    similar INTEGER NOT NULL CHECK (similar IN (0, 1)),
    follow_parts NVARCHAR(MAX) NOT NULL,
    screen_version_id BIGINT CONSTRAINT requirement_screen_unbound CHECK (screen_version_id IS NULL),
    status NVARCHAR(16) NOT NULL CHECK (status IN ('DRAFT','REQUESTED','NEEDS_INFO','REVIEWING','AGREED','ADO_LINKED')),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    command_sequence BIGINT NOT NULL DEFAULT 0,
    author_id BIGINT NOT NULL REFERENCES reference_user(id),
    assigned_reviewer_id BIGINT REFERENCES reference_user(id),
    created_at DATETIMEOFFSET(6) NOT NULL,
    updated_at DATETIMEOFFSET(6) NOT NULL
);
CREATE INDEX requirement_visibility ON requirement_entry(status, author_id);
CREATE INDEX requirement_updated ON requirement_entry(updated_at DESC, id DESC);
CREATE INDEX requirement_menu ON requirement_entry(menu_id);
CREATE TABLE requirement_review (
    requirement_id BIGINT PRIMARY KEY REFERENCES requirement_entry(id),
    decision NVARCHAR(16) NOT NULL CHECK (decision IN ('UNREVIEWED','POSSIBLE','CONDITIONAL','MORE_INFO','IMPOSSIBLE')),
    rationale NVARCHAR(MAX) NOT NULL,
    conditions NVARCHAR(MAX) NOT NULL,
    scope NVARCHAR(MAX) NOT NULL,
    exclusions NVARCHAR(MAX) NOT NULL,
    acceptance NVARCHAR(MAX) NOT NULL,
    estimate NVARCHAR(16) NOT NULL CHECK (estimate IN ('UNKNOWN','SMALL','MEDIUM','LARGE')),
    reviewer_id BIGINT NOT NULL REFERENCES reference_user(id),
    updated_at DATETIMEOFFSET(6) NOT NULL
);
CREATE TABLE requirement_comment (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    requirement_id BIGINT NOT NULL REFERENCES requirement_entry(id),
    body NVARCHAR(MAX) NOT NULL,
    author_id BIGINT NOT NULL REFERENCES reference_user(id),
    created_at DATETIMEOFFSET(6) NOT NULL
);
CREATE INDEX requirement_comment_order ON requirement_comment(requirement_id, id);
CREATE TABLE requirement_history (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    requirement_id BIGINT NOT NULL REFERENCES requirement_entry(id),
    action NVARCHAR(32) NOT NULL,
    before_json NVARCHAR(MAX),
    after_json NVARCHAR(MAX) NOT NULL,
    actor_id BIGINT NOT NULL REFERENCES reference_user(id),
    created_at DATETIMEOFFSET(6) NOT NULL
);
CREATE INDEX requirement_history_order ON requirement_history(requirement_id, id DESC);
