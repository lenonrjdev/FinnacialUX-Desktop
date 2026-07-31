-- FinnacialUX Desktop 0.16.0
-- Schema 13: diagnostico local, auditoria sanitizada, ensaio de recuperacao e suporte tecnico.

CREATE TABLE IF NOT EXISTS diagnostic_preferences (
  workspace_id TEXT PRIMARY KEY,
  include_sanitized_logs INTEGER NOT NULL DEFAULT 1 CHECK (include_sanitized_logs IN (0, 1)),
  run_restore_drill INTEGER NOT NULL DEFAULT 1 CHECK (run_restore_drill IN (0, 1)),
  history_retention INTEGER NOT NULL DEFAULT 25 CHECK (history_retention BETWEEN 5 AND 100),
  last_full_run_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diagnostic_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  run_kind TEXT NOT NULL CHECK (run_kind IN ('preview', 'full', 'integrity', 'restore_drill', 'support_export', 'repair')),
  status TEXT NOT NULL CHECK (status IN ('running', 'healthy', 'attention', 'failed', 'cancelled')),
  app_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  checks_total INTEGER NOT NULL DEFAULT 0,
  checks_passed INTEGER NOT NULL DEFAULT 0,
  checks_attention INTEGER NOT NULL DEFAULT 0,
  checks_failed INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_workspace_started
  ON diagnostic_runs(workspace_id, started_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_checks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  check_code TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('database', 'security', 'files', 'backups', 'continuity', 'scheduler', 'updates', 'privacy')),
  status TEXT NOT NULL CHECK (status IN ('passed', 'attention', 'failed', 'skipped')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  repair_action TEXT CHECK (repair_action IS NULL OR repair_action IN ('optimize_database', 'release_stale_tasks', 'refresh_file_health', 'clear_old_logs')),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES diagnostic_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_checks_run_category
  ON diagnostic_checks(run_id, category, status);

CREATE TABLE IF NOT EXISTS diagnostic_repairs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  run_id TEXT,
  action_kind TEXT NOT NULL CHECK (action_kind IN ('optimize_database', 'release_stale_tasks', 'refresh_file_health', 'clear_old_logs')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  result_summary TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES diagnostic_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_repairs_workspace_started
  ON diagnostic_repairs(workspace_id, started_at DESC);

CREATE TABLE IF NOT EXISTS support_package_exports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  destination_file_name TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  package_size_bytes INTEGER NOT NULL DEFAULT 0,
  checks_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_package_exports_workspace_created
  ON support_package_exports(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_probe (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  probe_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (13, 'Diagnostico local, auditoria sanitizada e suporte tecnico seguro', datetime('now'));

PRAGMA user_version = 13;
