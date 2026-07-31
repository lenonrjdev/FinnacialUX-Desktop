-- FinnacialUX Desktop 0.15.0
-- Schema 12: rotinas locais, fila persistente, tentativas controladas e notificacoes nativas.

CREATE TABLE IF NOT EXISTS background_task_preferences (
  workspace_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0, 1)),
  run_on_startup INTEGER NOT NULL DEFAULT 1 CHECK (run_on_startup IN (0, 1)),
  interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (interval_minutes BETWEEN 15 AND 240),
  native_notifications INTEGER NOT NULL DEFAULT 1 CHECK (native_notifications IN (0, 1)),
  quiet_hours_enabled INTEGER NOT NULL DEFAULT 1 CHECK (quiet_hours_enabled IN (0, 1)),
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  automation_scan_enabled INTEGER NOT NULL DEFAULT 1 CHECK (automation_scan_enabled IN (0, 1)),
  due_alerts_enabled INTEGER NOT NULL DEFAULT 1 CHECK (due_alerts_enabled IN (0, 1)),
  financial_risk_enabled INTEGER NOT NULL DEFAULT 1 CHECK (financial_risk_enabled IN (0, 1)),
  goals_budget_enabled INTEGER NOT NULL DEFAULT 1 CHECK (goals_budget_enabled IN (0, 1)),
  monthly_closing_enabled INTEGER NOT NULL DEFAULT 1 CHECK (monthly_closing_enabled IN (0, 1)),
  backup_reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK (backup_reminder_enabled IN (0, 1)),
  weekly_summary_enabled INTEGER NOT NULL DEFAULT 1 CHECK (weekly_summary_enabled IN (0, 1)),
  retry_limit INTEGER NOT NULL DEFAULT 3 CHECK (retry_limit BETWEEN 0 AND 5),
  last_scheduler_tick_at TEXT,
  last_successful_run_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS background_task_queue (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_kind TEXT NOT NULL CHECK (task_kind IN (
    'automation_scan',
    'due_alerts',
    'financial_risk',
    'goals_budget',
    'monthly_closing',
    'backup_reminder',
    'weekly_summary'
  )),
  dedup_key TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  scheduled_for TEXT NOT NULL,
  next_attempt_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'skipped')),
  priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  result_summary TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_background_queue_due
  ON background_task_queue(workspace_id, status, next_attempt_at, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_background_queue_history
  ON background_task_queue(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS background_task_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_kind TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'cancelled', 'skipped')),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  result_summary TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES background_task_queue(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_background_runs_workspace_created
  ON background_task_runs(workspace_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS background_notification_outbox (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_id TEXT,
  kind TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'dispatched', 'sent', 'failed', 'dismissed')),
  scheduled_for TEXT NOT NULL,
  dispatched_at TEXT,
  sent_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES background_task_queue(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_background_outbox_pending
  ON background_notification_outbox(workspace_id, status, scheduled_for, created_at);

CREATE TABLE IF NOT EXISTS background_scheduler_leases (
  workspace_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

PRAGMA user_version = 12;
