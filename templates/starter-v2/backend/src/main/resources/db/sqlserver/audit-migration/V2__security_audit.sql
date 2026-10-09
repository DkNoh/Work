-- 앱 소유 sqlserver 새 스키마 DDL. 기존 H2 migration은 별도 경로에서 checksum을 보존한다.
CREATE TABLE security_audit_event (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    actor_subject NVARCHAR(64) NOT NULL,
    actor_id BIGINT,
    occurred_at DATETIMEOFFSET(6) NOT NULL,
    action NVARCHAR(64) NOT NULL,
    outcome NVARCHAR(7) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED')),
    resource_type NVARCHAR(32) NOT NULL,
    resource_id NVARCHAR(128),
    request_id NVARCHAR(64),
    reason_code NVARCHAR(64),
    CHECK (actor_id IS NULL OR actor_id > 0),
    CHECK ((actor_subject COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Za-z0-9._@-]%' AND LEN(actor_subject) BETWEEN 1 AND 64)),
    CHECK ((action COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Z0-9_]%' AND LEFT(action,1) COLLATE Latin1_General_100_BIN2 LIKE N'[A-Z]' AND LEN(action) BETWEEN 1 AND 64)),
    CHECK ((resource_type COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Z0-9_]%' AND LEFT(resource_type,1) COLLATE Latin1_General_100_BIN2 LIKE N'[A-Z]' AND LEN(resource_type) BETWEEN 1 AND 32)),
    CHECK (resource_id IS NULL OR (resource_id COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Za-z0-9._:-]%' AND LEN(resource_id) BETWEEN 1 AND 128)),
    CHECK (request_id IS NULL OR (request_id COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Za-z0-9_-]%' AND LEN(request_id) BETWEEN 1 AND 64)),
    CHECK (reason_code IS NULL OR (reason_code COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Z0-9_]%' AND LEFT(reason_code,1) COLLATE Latin1_General_100_BIN2 LIKE N'[A-Z]' AND LEN(reason_code) BETWEEN 1 AND 64))
);
CREATE INDEX idx_security_audit_latest ON security_audit_event(occurred_at DESC, id DESC);
CREATE INDEX idx_security_audit_filter ON security_audit_event(action, outcome, occurred_at DESC);
