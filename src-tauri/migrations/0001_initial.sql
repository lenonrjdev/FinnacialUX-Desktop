PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  phone TEXT,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal', 'shared')),
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS workspaces_owner_idx ON workspaces(owner_user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY NOT NULL,
  appearance TEXT NOT NULL DEFAULT 'system' CHECK (appearance IN ('system', 'light', 'dark')),
  default_workspace_id TEXT,
  default_account_id TEXT,
  hide_balances_on_open INTEGER NOT NULL DEFAULT 0,
  compact_large_values INTEGER NOT NULL DEFAULT 0,
  notify_upcoming_bills INTEGER NOT NULL DEFAULT 1,
  notify_expected_income INTEGER NOT NULL DEFAULT 1,
  notify_budget_alerts INTEGER NOT NULL DEFAULT 1,
  notify_low_balance INTEGER NOT NULL DEFAULT 1,
  notify_weekly_summary INTEGER NOT NULL DEFAULT 1,
  notify_monthly_closing INTEGER NOT NULL DEFAULT 1,
  notify_security_alerts INTEGER NOT NULL DEFAULT 1,
  bill_reminder_days INTEGER NOT NULL DEFAULT 3,
  low_balance_threshold REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS finance_documents (
  workspace_id TEXT NOT NULL,
  module TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, module),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS finance_documents_workspace_idx
  ON finance_documents(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id);
