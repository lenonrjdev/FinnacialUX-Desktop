CREATE TABLE IF NOT EXISTS database_security_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  encryption_version INTEGER NOT NULL DEFAULT 1,
  cipher_name TEXT NOT NULL DEFAULT 'SQLCipher 4',
  key_fingerprint TEXT NOT NULL,
  encrypted_at TEXT NOT NULL,
  last_key_rotation_at TEXT,
  migrated_from_plaintext INTEGER NOT NULL DEFAULT 0 CHECK (migrated_from_plaintext IN (0, 1)),
  migration_backup_path TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_schema_history (version, description, applied_at)
VALUES (4, 'Criptografia integral do banco com SQLCipher e rotação de chave', datetime('now'));
