-- 앱 소유 sqlserver 새 스키마 DDL. 기존 H2 migration은 별도 경로에서 checksum을 보존한다.
CREATE TABLE kanban_member (
    user_id BIGINT PRIMARY KEY REFERENCES reference_user(id)
);
CREATE TABLE kanban_board (
    id BIGINT IDENTITY(2,1) PRIMARY KEY,
    title NVARCHAR(100) NOT NULL CHECK (LEN(title) BETWEEN 1 AND 100),
    author_id BIGINT REFERENCES reference_user(id),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    command_sequence BIGINT NOT NULL DEFAULT 0,
    created_at DATETIMEOFFSET(6) NOT NULL,
    updated_at DATETIMEOFFSET(6) NOT NULL,
    CHECK (id = 1 OR author_id IS NOT NULL)
);
SET IDENTITY_INSERT kanban_board ON;
INSERT INTO kanban_board(id,title,author_id,revision,created_at,updated_at)
VALUES (1,N'기본 업무',NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME());
SET IDENTITY_INSERT kanban_board OFF;
CREATE TABLE kanban_task (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    board_id BIGINT NOT NULL REFERENCES kanban_board(id),
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL DEFAULT '',
    status NVARCHAR(16) NOT NULL CHECK (status IN ('TODO','IN_PROGRESS','DONE','REJECTED')),
    priority NVARCHAR(6) NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH')),
    assignee_id BIGINT REFERENCES reference_user(id),
    author_id BIGINT NOT NULL REFERENCES reference_user(id),
    due_date NVARCHAR(10),
    tags_json NVARCHAR(2000) NOT NULL DEFAULT '[]',
    position FLOAT(53) NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    command_sequence BIGINT NOT NULL DEFAULT 0,
    created_at DATETIMEOFFSET(6) NOT NULL,
    updated_at DATETIMEOFFSET(6) NOT NULL,
    completed_at DATETIMEOFFSET(6),
    UNIQUE (board_id,status,position)
);
CREATE INDEX kanban_task_author ON kanban_task(board_id,author_id,status,position);
CREATE INDEX kanban_task_assignee ON kanban_task(board_id,assignee_id,status,position);
CREATE INDEX kanban_task_priority ON kanban_task(board_id,priority,status,position);
CREATE TABLE kanban_notice (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL CHECK (LEN(title) BETWEEN 1 AND 200),
    content NVARCHAR(MAX) NOT NULL CHECK (LEN(content) BETWEEN 1 AND 50000),
    author_id BIGINT NOT NULL REFERENCES reference_user(id),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    command_sequence BIGINT NOT NULL DEFAULT 0,
    created_at DATETIMEOFFSET(6) NOT NULL,
    updated_at DATETIMEOFFSET(6) NOT NULL
);
CREATE INDEX kanban_notice_created ON kanban_notice(created_at DESC,id DESC);
CREATE TABLE reference_document (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    document_json NVARCHAR(MAX) NOT NULL,
    author_id BIGINT NOT NULL REFERENCES reference_user(id),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    command_sequence BIGINT NOT NULL DEFAULT 0,
    created_at DATETIMEOFFSET(6) NOT NULL,
    updated_at DATETIMEOFFSET(6) NOT NULL
);
CREATE INDEX reference_document_author ON reference_document(author_id,updated_at DESC,id DESC);
