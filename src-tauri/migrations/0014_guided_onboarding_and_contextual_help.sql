-- FinnacialUX Desktop 0.17.0
-- Schema 14: onboarding guiado, progresso dos primeiros passos e preferencias de ajuda contextual.

CREATE TABLE IF NOT EXISTS onboarding_preferences (
  workspace_id TEXT PRIMARY KEY,
  auto_open INTEGER NOT NULL DEFAULT 1 CHECK (auto_open IN (0, 1)),
  show_progress_dock INTEGER NOT NULL DEFAULT 1 CHECK (show_progress_dock IN (0, 1)),
  contextual_help_enabled INTEGER NOT NULL DEFAULT 1 CHECK (contextual_help_enabled IN (0, 1)),
  completed_at TEXT,
  skipped_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  workspace_id TEXT NOT NULL,
  step_code TEXT NOT NULL CHECK (step_code IN ('welcome', 'account', 'first_record', 'planning', 'security', 'backup')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, step_code),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_workspace_status
  ON onboarding_steps(workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS onboarding_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('opened', 'step_completed', 'guide_skipped', 'guide_completed', 'guide_reset', 'preferences_changed')),
  step_code TEXT CHECK (step_code IS NULL OR step_code IN ('welcome', 'account', 'first_record', 'planning', 'security', 'backup')),
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_workspace_created
  ON onboarding_events(workspace_id, created_at DESC);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (14, 'Onboarding guiado, primeiros passos e ajuda contextual', datetime('now'));

PRAGMA user_version = 14;
