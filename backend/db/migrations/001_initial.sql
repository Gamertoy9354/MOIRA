-- Initial database schema for MCP Gateway

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workflows table: stores each workflow's state and full DAG
CREATE TABLE IF NOT EXISTS workflows (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_request TEXT NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending',
    dag         JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Audit log: immutable record of every SafeGuard decision and tool call
CREATE TABLE IF NOT EXISTS audit_log (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id       UUID REFERENCES workflows(id) ON DELETE CASCADE,
    step_id           VARCHAR(50),
    connector         VARCHAR(50),
    tool              VARCHAR(100),
    params_hash       VARCHAR(64),       -- SHA256 of params
    safeguard_result  VARCHAR(50),
    safeguard_layer   INT,
    safeguard_reason  TEXT,
    executed          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recovery log: tracks every Kimi recovery attempt
CREATE TABLE IF NOT EXISTS recovery_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID REFERENCES workflows(id) ON DELETE CASCADE,
    step_id         VARCHAR(50),
    attempt_number  INT NOT NULL DEFAULT 1,
    error_message   TEXT,
    kimi_reasoning  TEXT,
    action_taken    VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approval log: records human-in-the-loop approval decisions
CREATE TABLE IF NOT EXISTS approval_log (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id  UUID REFERENCES workflows(id) ON DELETE CASCADE,
    step_id      VARCHAR(50),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMPTZ,
    approved     BOOLEAN,
    approver     VARCHAR(100),
    reason       TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_log_workflow_id ON audit_log (workflow_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_recovery_log_workflow  ON recovery_log (workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_log_workflow  ON approval_log (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status       ON workflows (status);
