PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_schema_history (
  version INTEGER PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES
  (1, 'Fundação local do FinnacialUX Desktop', '2026-07-27T00:00:00.000Z'),
  (2, 'Proteção de dados, backups e diagnóstico', CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS backup_preferences (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  automatic_enabled INTEGER NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  retention_count INTEGER NOT NULL DEFAULT 6 CHECK (retention_count BETWEEN 1 AND 60),
  include_attachments INTEGER NOT NULL DEFAULT 0,
  last_automatic_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO backup_preferences (
  id,
  automatic_enabled,
  frequency,
  retention_count,
  include_attachments,
  last_automatic_at,
  updated_at
)
VALUES (1, 0, 'weekly', 6, 0, NULL, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS backup_history (
  id TEXT PRIMARY KEY NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  modules_count INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'automatic', 'pre_restore')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'missing', 'failed')),
  integrity_status TEXT NOT NULL DEFAULT 'ok' CHECK (integrity_status IN ('ok', 'warning', 'failed')),
  checksum_sha256 TEXT,
  app_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS backup_history_created_idx
  ON backup_history(created_at DESC);

CREATE INDEX IF NOT EXISTS backup_history_kind_idx
  ON backup_history(kind, created_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  app_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS diagnostic_events_created_idx
  ON diagnostic_events(created_at DESC);
