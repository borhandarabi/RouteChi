-- Migration 118: provider_session_mappings
-- Maps (connectionId + agentChatId + provider) → providerConversationId
-- Used by providerSessionRegistry.ts for multi-turn conversation continuity.

CREATE TABLE IF NOT EXISTS provider_session_mappings (
  connection_id TEXT NOT NULL,
  agent_chat_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_conversation_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (connection_id, agent_chat_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_session_mappings_conn
  ON provider_session_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_provider_session_mappings_last_used
  ON provider_session_mappings(last_used_at);
