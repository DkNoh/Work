-- 앱 소유 sqlserver 새 스키마 DDL. 기존 H2 migration은 별도 경로에서 checksum을 보존한다.
CREATE TABLE sc_message_outbox (
    event_id NVARCHAR(36) PRIMARY KEY,
    type NVARCHAR(64) NOT NULL,
    schema_version INTEGER NOT NULL CHECK(schema_version=1),
    payload NVARCHAR(MAX) NOT NULL,
    payload_sha256 NVARCHAR(64) NOT NULL,
    state NVARCHAR(16) NOT NULL CHECK(state IN('PENDING','CLAIMED','PUBLISHED','COMPLETED','DEAD')),
    dispatch_attempts INTEGER NOT NULL DEFAULT 0 CHECK(dispatch_attempts BETWEEN 0 AND 5),
    handler_attempts INTEGER NOT NULL DEFAULT 0 CHECK(handler_attempts BETWEEN 0 AND 5),
    next_attempt_at DATETIMEOFFSET(6) NOT NULL,
    created_at DATETIMEOFFSET(6) NOT NULL,
    published_at DATETIMEOFFSET(6),
    completed_at DATETIMEOFFSET(6),
    lease_token NVARCHAR(36),
    lease_until DATETIMEOFFSET(6),
    last_failure_code NVARCHAR(32)
);
CREATE INDEX sc_message_due_idx ON sc_message_outbox(state,next_attempt_at,lease_until);
CREATE TABLE sc_message_inbox (
    consumer_id NVARCHAR(48) NOT NULL,
    event_id NVARCHAR(36) NOT NULL,
    processed_at DATETIMEOFFSET(6) NOT NULL,
    payload_sha256 NVARCHAR(64) NOT NULL,
    PRIMARY KEY(consumer_id,event_id),
    FOREIGN KEY(event_id) REFERENCES sc_message_outbox(event_id)
);
CREATE TABLE sc_message_demo_effect (
    event_id NVARCHAR(36) PRIMARY KEY,
    occurred_at DATETIMEOFFSET(6) NOT NULL,
    FOREIGN KEY(event_id) REFERENCES sc_message_outbox(event_id) ON DELETE CASCADE
);
