PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS automation_preferences (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  simulation_required INTEGER NOT NULL DEFAULT 1 CHECK (simulation_required IN (0, 1)),
  startup_scan_enabled INTEGER NOT NULL DEFAULT 1 CHECK (startup_scan_enabled IN (0, 1)),
  due_window_days INTEGER NOT NULL DEFAULT 7 CHECK (due_window_days BETWEEN 1 AND 60),
  alert_overdue INTEGER NOT NULL DEFAULT 1 CHECK (alert_overdue IN (0, 1)),
  alert_upcoming INTEGER NOT NULL DEFAULT 1 CHECK (alert_upcoming IN (0, 1)),
  last_run_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO automation_preferences (
  workspace_id,
  simulation_required,
  startup_scan_enabled,
  due_window_days,
  alert_overdue,
  alert_upcoming,
  last_run_at,
  updated_at
)
SELECT id, 1, 1, 7, 1, 1, NULL, CURRENT_TIMESTAMP
FROM workspaces;

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'undone', 'failed')),
  reference_date TEXT NOT NULL,
  candidates_total INTEGER NOT NULL DEFAULT 0,
  changes_applied INTEGER NOT NULL DEFAULT 0,
  skipped_total INTEGER NOT NULL DEFAULT 0,
  affected_modules_json TEXT NOT NULL DEFAULT '[]',
  before_snapshot_json TEXT,
  after_snapshot_checksum TEXT,
  reversible INTEGER NOT NULL DEFAULT 0 CHECK (reversible IN (0, 1)),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  undone_at TEXT,
  error_message TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS automation_runs_workspace_created_idx
  ON automation_runs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS automation_runs_status_idx
  ON automation_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS automation_alert_states (
  workspace_id TEXT NOT NULL,
  alert_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'read', 'dismissed')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, alert_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS automation_alert_states_status_idx
  ON automation_alert_states(workspace_id, status, updated_at DESC);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (7, 'Motor local de automações, recorrências, alertas e execuções reversíveis', datetime('now'));
