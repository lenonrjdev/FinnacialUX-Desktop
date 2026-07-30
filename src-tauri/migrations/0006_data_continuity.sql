DROP INDEX IF EXISTS backup_history_created_idx;
DROP INDEX IF EXISTS backup_history_kind_idx;
ALTER TABLE backup_history RENAME TO backup_history_schema_5;

CREATE TABLE backup_history (
  id TEXT PRIMARY KEY NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  modules_count INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'automatic', 'pre_restore', 'pre_update', 'recovery_point')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'missing', 'failed')),
  integrity_status TEXT NOT NULL DEFAULT 'ok' CHECK (integrity_status IN ('ok', 'warning', 'failed')),
  checksum_sha256 TEXT,
  app_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  encryption_mode TEXT NOT NULL DEFAULT 'none',
  error_message TEXT
);

INSERT INTO backup_history (
  id, file_name, file_path, created_at, size_bytes, modules_count, kind,
  status, integrity_status, checksum_sha256, app_version, schema_version,
  encryption_mode, error_message
)
SELECT
  id, file_name, file_path, created_at, size_bytes, modules_count, kind,
  status, integrity_status, checksum_sha256, app_version, schema_version,
  encryption_mode, error_message
FROM backup_history_schema_5;

DROP TABLE backup_history_schema_5;

CREATE INDEX IF NOT EXISTS backup_history_created_idx
  ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS backup_history_kind_idx
  ON backup_history(kind, created_at DESC);

CREATE TABLE IF NOT EXISTS continuity_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  startup_integrity_check INTEGER NOT NULL DEFAULT 1,
  create_daily_recovery_point INTEGER NOT NULL DEFAULT 1,
  recovery_point_retention INTEGER NOT NULL DEFAULT 12,
  maximum_age_days INTEGER NOT NULL DEFAULT 90,
  enter_read_only_on_failure INTEGER NOT NULL DEFAULT 1,
  last_startup_check_at TEXT,
  last_healthy_recovery_point_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO continuity_preferences (
  id,
  startup_integrity_check,
  create_daily_recovery_point,
  recovery_point_retention,
  maximum_age_days,
  enter_read_only_on_failure,
  last_startup_check_at,
  last_healthy_recovery_point_at,
  updated_at
) VALUES (1, 1, 1, 12, 90, 1, NULL, NULL, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS continuity_recovery_points (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  reason TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'fuxbackup',
  status TEXT NOT NULL DEFAULT 'available',
  schema_version INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum_sha256 TEXT,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  app_version TEXT NOT NULL,
  protected INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_continuity_recovery_points_created_at
  ON continuity_recovery_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_continuity_recovery_points_reason
  ON continuity_recovery_points(reason, created_at DESC);

CREATE TABLE IF NOT EXISTS continuity_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  recovery_point_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  FOREIGN KEY (recovery_point_id) REFERENCES continuity_recovery_points(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_continuity_events_created_at
  ON continuity_events(created_at DESC);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (6, 'Continuidade, pontos de recuperação e modo somente leitura nativo', datetime('now'));
