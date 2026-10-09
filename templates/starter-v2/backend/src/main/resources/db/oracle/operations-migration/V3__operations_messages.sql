-- 앱 소유 oracle 새 스키마 DDL. 기존 H2 migration은 별도 경로에서 checksum을 보존한다.
CREATE TABLE sc_message_outbox (
    event_id VARCHAR2(36 CHAR) PRIMARY KEY,
    type VARCHAR2(64 CHAR) NOT NULL,
    schema_version NUMBER(10) NOT NULL CHECK(schema_version=1),
    payload CLOB NOT NULL,
    payload_sha256 VARCHAR2(64 CHAR) NOT NULL,
    state VARCHAR2(16 CHAR) NOT NULL CHECK(state IN('PENDING','CLAIMED','PUBLISHED','COMPLETED','DEAD')),
    dispatch_attempts NUMBER(10) DEFAULT 0 NOT NULL CHECK(dispatch_attempts BETWEEN 0 AND 5),
    handler_attempts NUMBER(10) DEFAULT 0 NOT NULL CHECK(handler_attempts BETWEEN 0 AND 5),
    next_attempt_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP(6) WITH TIME ZONE,
    completed_at TIMESTAMP(6) WITH TIME ZONE,
    lease_token VARCHAR2(36 CHAR),
    lease_until TIMESTAMP(6) WITH TIME ZONE,
    last_failure_code VARCHAR2(32 CHAR)
);
CREATE INDEX sc_message_due_idx ON sc_message_outbox(state,next_attempt_at,lease_until);
CREATE TABLE sc_message_inbox (
    consumer_id VARCHAR2(48 CHAR) NOT NULL,
    event_id VARCHAR2(36 CHAR) NOT NULL,
    processed_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    payload_sha256 VARCHAR2(64 CHAR) NOT NULL,
    PRIMARY KEY(consumer_id,event_id),
    FOREIGN KEY(event_id) REFERENCES sc_message_outbox(event_id)
);
CREATE TABLE sc_message_demo_effect (
    event_id VARCHAR2(36 CHAR) PRIMARY KEY,
    occurred_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    FOREIGN KEY(event_id) REFERENCES sc_message_outbox(event_id) ON DELETE CASCADE
);
