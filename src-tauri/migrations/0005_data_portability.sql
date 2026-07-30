PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portability_operations (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('import', 'export', 'transfer', 'undo')),
  format TEXT NOT NULL,
  dataset TEXT NOT NULL,
  file_name TEXT NOT NULL,
  checksum_sha256 TEXT,
  records_total INTEGER NOT NULL DEFAULT 0,
  records_applied INTEGER NOT NULL DEFAULT 0,
  records_rejected INTEGER NOT NULL DEFAULT 0,
  affected_modules_json TEXT NOT NULL DEFAULT '[]',
  undo_snapshot_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed', 'undone')),
  reversible INTEGER NOT NULL DEFAULT 0 CHECK (reversible IN (0, 1)),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS portability_operations_workspace_created_idx
  ON portability_operations(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS portability_operations_direction_idx
  ON portability_operations(direction, created_at DESC);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (5, 'Importação, exportação, histórico reversível e portabilidade entre computadores', datetime('now'));
