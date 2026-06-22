-- Migration 003: Multi-Tenant Columns
-- Adds user_id to workflows and synthesized_tools tables to isolate user data.

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

ALTER TABLE synthesized_tools ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_synthesized_tools_user_id ON synthesized_tools(user_id);
