-- Migration 002: Synthesized Tools tables
-- Stores Kimi-generated connectors, their metadata, guides, and usage stats

CREATE TABLE IF NOT EXISTS synthesized_tools (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name          VARCHAR(100) UNIQUE NOT NULL,
    connector_class_name  VARCHAR(200) NOT NULL,
    file_path             TEXT NOT NULL,
    tools                 JSONB NOT NULL DEFAULT '[]',
    required_credentials  JSONB NOT NULL DEFAULT '[]',
    guide_md_path         TEXT,
    guide_json_path       TEXT,
    synthesis_prompt      TEXT,
    raw_kimi_response     TEXT,
    safety_scan_result    JSONB,
    validation_passed     BOOLEAN DEFAULT FALSE,
    times_used            INTEGER DEFAULT 0,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    last_used_at          TIMESTAMPTZ,
    created_by_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS synthesized_tool_usage (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id           UUID REFERENCES synthesized_tools(id) ON DELETE CASCADE,
    workflow_id       UUID REFERENCES workflows(id) ON DELETE SET NULL,
    step_id           VARCHAR(100),
    executed_at       TIMESTAMPTZ DEFAULT NOW(),
    success           BOOLEAN,
    execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_synthesized_tools_service
    ON synthesized_tools(service_name);

CREATE INDEX IF NOT EXISTS idx_synthesized_tool_usage_tool_id
    ON synthesized_tool_usage(tool_id);

CREATE INDEX IF NOT EXISTS idx_synthesized_tool_usage_workflow
    ON synthesized_tool_usage(workflow_id);
