PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN password_algorithm TEXT NOT NULL DEFAULT 'pbkdf2-sha256';
ALTER TABLE backup_history ADD COLUMN encryption_mode TEXT NOT NULL DEFAULT 'none';
ALTER TABLE backup_preferences ADD COLUMN encryption_mode TEXT NOT NULL DEFAULT 'device';

CREATE TABLE IF NOT EXISTS local_security_preferences (
  user_id TEXT PRIMARY KEY NOT NULL,
  pin_enabled INTEGER NOT NULL DEFAULT 0,
  pin_hash TEXT,
  auto_lock_minutes INTEGER NOT NULL DEFAULT 15,
  lock_on_minimize INTEGER NOT NULL DEFAULT 1,
  require_password_for_exports INTEGER NOT NULL DEFAULT 1,
  require_password_for_restore INTEGER NOT NULL DEFAULT 1,
  encrypted_backups_default INTEGER NOT NULL DEFAULT 1,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TEXT,
  last_locked_at TEXT,
  vault_initialized INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO local_security_preferences (
  user_id,
  pin_enabled,
  auto_lock_minutes,
  lock_on_minimize,
  require_password_for_exports,
  require_password_for_restore,
  encrypted_backups_default,
  failed_pin_attempts,
  vault_initialized,
  updated_at
)
SELECT
  id,
  0,
  15,
  1,
  1,
  1,
  1,
  0,
  0,
  CURRENT_TIMESTAMP
FROM users;

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  app_version TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS security_events_user_created_idx
  ON security_events(user_id, created_at DESC);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (3, 'Stronghold, Argon2id, PIN, bloqueio e backups criptografados', CURRENT_TIMESTAMP);
