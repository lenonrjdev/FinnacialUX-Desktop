use crate::command_worker::run_local_async_worker;
use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use rand::{rngs::OsRng, RngCore};
use serde::Serialize;
use serde_json::{Map, Number, Value};
use sha2::{Digest, Sha256};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteRow, SqliteSynchronous},
    Column, Connection, ConnectOptions, Row, SqliteConnection, TypeInfo, ValueRef,
};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::RwLock,
    time::Duration,
};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;
use zeroize::Zeroizing;

const DATABASE_FILE_NAME: &str = "finnacialux.db";
const LEGACY_BACKUP_MAGIC: &[u8] = b"FUXLEGACY1\n";
const CURRENT_SCHEMA_VERSION: i64 = 4;

const MIGRATIONS: &[(i64, &str, &str)] = &[
    (1, "create_finnacialux_desktop_schema", include_str!("../migrations/0001_initial.sql")),
    (2, "add_data_protection_backups_and_diagnostics", include_str!("../migrations/0002_data_protection.sql")),
    (3, "add_stronghold_argon2_pin_lock_and_encrypted_backups", include_str!("../migrations/0003_local_security.sql")),
    (4, "encrypt_database_with_sqlcipher_and_key_rotation", include_str!("../migrations/0004_database_encryption.sql")),
];

#[derive(Default)]
pub struct EncryptedDatabaseState {
    key: RwLock<Option<Zeroizing<Vec<u8>>>>,
    status: RwLock<Option<DatabaseEncryptionStatus>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseEncryptionStatus {
    pub opened: bool,
    pub encrypted: bool,
    pub cipher_version: String,
    pub schema_version: i64,
    pub key_fingerprint: String,
    pub database_path: String,
    pub database_size_bytes: u64,
    pub encrypted_at: Option<String>,
    pub last_key_rotation_at: Option<String>,
    pub migrated_from_plaintext: bool,
    pub migration_backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseExecuteResult {
    pub rows_affected: u64,
    pub last_insert_id: i64,
}

impl EncryptedDatabaseState {
    fn set_key(&self, key: Vec<u8>) -> Result<(), String> {
        let mut current = self.key.write().map_err(|_| "O estado da chave local está indisponível.".to_string())?;
        *current = Some(Zeroizing::new(key));
        Ok(())
    }

    fn key_copy(&self) -> Result<Zeroizing<Vec<u8>>, String> {
        let current = self.key.read().map_err(|_| "O estado da chave local está indisponível.".to_string())?;
        current
            .as_ref()
            .map(|key| Zeroizing::new(key.to_vec()))
            .ok_or_else(|| "O banco criptografado ainda não foi desbloqueado.".to_string())
    }

    fn clear(&self) {
        if let Ok(mut key) = self.key.write() {
            *key = None;
        }
        if let Ok(mut status) = self.status.write() {
            *status = None;
        }
    }

    fn set_status(&self, value: DatabaseEncryptionStatus) {
        if let Ok(mut status) = self.status.write() {
            *status = Some(value);
        }
    }

    pub(crate) fn status(&self) -> Option<DatabaseEncryptionStatus> {
        self.status.read().ok().and_then(|value| value.clone())
    }
}

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(to_error)?;
    fs::create_dir_all(&directory).map_err(to_error)?;
    Ok(directory)
}

pub fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app)?.join(DATABASE_FILE_NAME))
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app_config_dir(app)?.join("backups");
    fs::create_dir_all(&directory).map_err(to_error)?;
    Ok(directory)
}

fn decode_key(value: &str) -> Result<Zeroizing<Vec<u8>>, String> {
    let key = BASE64
        .decode(value)
        .map_err(|_| "A chave do banco está em formato inválido.".to_string())?;
    if key.len() != 32 {
        return Err("A chave do banco precisa ter 256 bits.".to_string());
    }
    Ok(Zeroizing::new(key))
}

fn key_fingerprint(key: &[u8]) -> String {
    let digest = Sha256::digest(key);
    hex::encode(&digest[..8]).to_uppercase()
}

fn raw_key_pragma(key: &[u8]) -> String {
    format!("\"x'{}'\"", hex::encode(key))
}

fn encrypted_options(path: &Path, key: &[u8], create: bool) -> SqliteConnectOptions {
    SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(create)
        .pragma("key", raw_key_pragma(key))
        .pragma("cipher_memory_security", "ON")
        .pragma("cipher_page_size", "4096")
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(10))
        .serialized(true)
        .optimize_on_close(true, Some(400))
}

fn plaintext_options(path: &Path, create: bool) -> SqliteConnectOptions {
    SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(create)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(10))
        .serialized(true)
}

pub async fn connect_app_database(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
) -> Result<SqliteConnection, String> {
    let key = state.key_copy()?;
    encrypted_options(&database_path(app)?, &key, false)
        .connect()
        .await
        .map_err(|error| format!("Não foi possível abrir o banco criptografado: {error}"))
}

pub async fn connect_encrypted_path(
    path: &Path,
    state: &EncryptedDatabaseState,
    create: bool,
) -> Result<SqliteConnection, String> {
    let key = state.key_copy()?;
    encrypted_options(path, &key, create)
        .connect()
        .await
        .map_err(to_error)
}

pub async fn connect_plaintext_path(path: &Path, create: bool) -> Result<SqliteConnection, String> {
    plaintext_options(path, create).connect().await.map_err(to_error)
}

fn looks_like_plaintext_sqlite(path: &Path) -> Result<bool, String> {
    if !path.exists() || fs::metadata(path).map_err(to_error)?.len() < 16 {
        return Ok(false);
    }
    let bytes = fs::read(path).map_err(to_error)?;
    Ok(bytes.starts_with(b"SQLite format 3\0"))
}

async fn cipher_version(connection: &mut SqliteConnection) -> Result<String, String> {
    sqlx::query_scalar::<_, String>("PRAGMA cipher_version")
        .fetch_one(&mut *connection)
        .await
        .map_err(|_| "O executável não está usando uma biblioteca SQLCipher válida.".to_string())
}

async fn verify_encrypted_database(path: &Path, key: &[u8]) -> Result<String, String> {
    let mut connection = encrypted_options(path, key, false)
        .connect()
        .await
        .map_err(|_| "A chave local não conseguiu abrir o banco criptografado.".to_string())?;
    let version = cipher_version(&mut connection).await?;
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM sqlite_master")
        .fetch_one(&mut connection)
        .await
        .map_err(|_| "O banco criptografado não passou na validação de leitura.".to_string())?;
    connection.close().await.map_err(to_error)?;
    Ok(version)
}

fn encrypt_legacy_backup(key: &[u8], plaintext: &[u8], destination: &Path) -> Result<(), String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(to_error)?;
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|_| "Não foi possível proteger a cópia anterior do banco.".to_string())?;
    let mut package = Vec::with_capacity(LEGACY_BACKUP_MAGIC.len() + nonce.len() + encrypted.len());
    package.extend_from_slice(LEGACY_BACKUP_MAGIC);
    package.extend_from_slice(&nonce);
    package.extend_from_slice(&encrypted);
    fs::write(destination, package).map_err(to_error)
}

fn escape_sql_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/").replace('\'', "''")
}

fn remove_sqlite_file_set(path: &Path) -> Result<(), String> {
    for candidate in [
        path.to_path_buf(),
        PathBuf::from(format!("{}-wal", path.to_string_lossy())),
        PathBuf::from(format!("{}-shm", path.to_string_lossy())),
        PathBuf::from(format!("{}-journal", path.to_string_lossy())),
    ] {
        if candidate.exists() {
            fs::remove_file(&candidate).map_err(|error| {
                format!(
                    "Não foi possível remover o arquivo temporário '{}': {error}",
                    candidate.to_string_lossy()
                )
            })?;
        }
    }
    Ok(())
}

fn prepare_attach_destination(path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "O caminho temporário do banco não possui uma pasta válida.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "Não foi possível preparar a pasta local do banco '{}': {error}",
            parent.to_string_lossy()
        )
    })?;

    remove_sqlite_file_set(path)?;

    let file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            format!(
                "Não foi possível criar o banco temporário '{}': {error}",
                path.to_string_lossy()
            )
        })?;
    file.sync_all().map_err(|error| {
        format!(
            "Não foi possível confirmar o banco temporário '{}': {error}",
            path.to_string_lossy()
        )
    })?;
    drop(file);
    Ok(())
}

fn cleanup_stale_migration_files(database: &Path) {
    let Some(parent) = database.parent() else {
        return;
    };
    let Some(file_name) = database.file_name().and_then(|value| value.to_str()) else {
        return;
    };
    let prefixes = [
        format!("{file_name}.encrypted-"),
        format!("{file_name}.restore-"),
    ];

    let Ok(entries) = fs::read_dir(parent) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if prefixes.iter().any(|prefix| name.starts_with(prefix))
            && (name.ends_with(".tmp")
                || name.ends_with(".tmp-wal")
                || name.ends_with(".tmp-shm")
                || name.ends_with(".tmp-journal"))
        {
            let _ = fs::remove_file(path);
        }
    }
}

async fn migrate_plaintext_database(
    app: &AppHandle,
    path: &Path,
    key: &[u8],
) -> Result<Option<String>, String> {
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let encrypted_staging = path.with_extension(format!("db.encrypted-{timestamp}.tmp"));
    let previous_staging = path.with_extension(format!("db.plaintext-{timestamp}.tmp"));
    let legacy_backup = backups_dir(app)?.join(format!("pre-encryption-{timestamp}.fuxlegacy"));

    cleanup_stale_migration_files(path);
    prepare_attach_destination(&encrypted_staging)?;

    let mut source = plaintext_options(path, false)
        .connect()
        .await
        .map_err(|error| format!("O banco existente não pôde ser preparado para criptografia: {error}"))?;
    sqlx::raw_sql("PRAGMA wal_checkpoint(FULL);")
        .execute(&mut source)
        .await
        .map_err(to_error)?;
    let source_user_version = sqlx::query_scalar::<_, i64>("PRAGMA user_version")
        .fetch_one(&mut source)
        .await
        .unwrap_or(0);

    let plaintext_bytes = fs::read(path).map_err(to_error)?;
    encrypt_legacy_backup(key, &plaintext_bytes, &legacy_backup)?;

    let attach = format!(
        "ATTACH DATABASE '{}' AS encrypted KEY {};",
        escape_sql_path(&encrypted_staging),
        raw_key_pragma(key),
    );
    if let Err(error) = sqlx::raw_sql(&attach).execute(&mut source).await {
        let _ = source.close().await;
        let _ = remove_sqlite_file_set(&encrypted_staging);
        return Err(format!(
            "Não foi possível abrir o banco criptografado temporário '{}': {error}",
            encrypted_staging.to_string_lossy()
        ));
    }
    if let Err(error) = sqlx::query("SELECT sqlcipher_export('encrypted')")
        .execute(&mut source)
        .await
    {
        let _ = sqlx::raw_sql("DETACH DATABASE encrypted;").execute(&mut source).await;
        let _ = source.close().await;
        let _ = remove_sqlite_file_set(&encrypted_staging);
        return Err(format!("A conversão do banco para SQLCipher falhou: {error}"));
    }
    sqlx::raw_sql(&format!("PRAGMA encrypted.user_version = {source_user_version};"))
        .execute(&mut source)
        .await
        .map_err(to_error)?;
    sqlx::raw_sql("DETACH DATABASE encrypted;")
        .execute(&mut source)
        .await
        .map_err(to_error)?;
    source.close().await.map_err(to_error)?;
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{}{}", path.to_string_lossy(), suffix));
        if sidecar.exists() {
            let _ = fs::remove_file(sidecar);
        }
    }

    verify_encrypted_database(&encrypted_staging, key).await?;
    let mut staged_connection = encrypted_options(&encrypted_staging, key, false)
        .connect()
        .await
        .map_err(to_error)?;
    let staged_schema = apply_migrations(&mut staged_connection).await?;
    if staged_schema != CURRENT_SCHEMA_VERSION {
        let _ = staged_connection.close().await;
        let _ = fs::remove_file(&encrypted_staging);
        return Err(format!(
            "A conversão foi interrompida porque o schema ficou em {staged_schema}, mas a versão exigida é {CURRENT_SCHEMA_VERSION}."
        ));
    }
    let legacy_backup_text = legacy_backup.to_string_lossy().to_string();
    persist_security_state(
        &mut staged_connection,
        key,
        true,
        Some(&legacy_backup_text),
    )
    .await?;
    staged_connection.close().await.map_err(to_error)?;
    verify_encrypted_database(&encrypted_staging, key).await?;

    if previous_staging.exists() {
        fs::remove_file(&previous_staging).map_err(to_error)?;
    }
    fs::rename(path, &previous_staging).map_err(to_error)?;
    if let Err(error) = fs::rename(&encrypted_staging, path) {
        let _ = fs::rename(&previous_staging, path);
        return Err(format!("A ativação do banco criptografado falhou e foi revertida: {error}"));
    }

    if let Err(error) = verify_encrypted_database(path, key).await {
        let _ = fs::remove_file(path);
        let _ = fs::rename(&previous_staging, path);
        return Err(format!("A validação final da criptografia falhou e o banco anterior foi recuperado: {error}"));
    }

    let _ = fs::remove_file(&previous_staging);
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{}{}", path.to_string_lossy(), suffix));
        if sidecar.exists() {
            let _ = fs::remove_file(sidecar);
        }
    }
    Ok(Some(legacy_backup.to_string_lossy().to_string()))
}

async fn table_exists(connection: &mut SqliteConnection, table: &str) -> Result<bool, String> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $1",
    )
    .bind(table)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(count > 0)
}

async fn column_exists(
    connection: &mut SqliteConnection,
    table: &str,
    column: &str,
) -> Result<bool, String> {
    let statement = format!("PRAGMA table_info('{}')", table.replace('\'', "''"));
    let rows = sqlx::query(&statement)
        .fetch_all(&mut *connection)
        .await
        .map_err(to_error)?;
    Ok(rows.iter().any(|row| row.try_get::<String, _>("name").ok().as_deref() == Some(column)))
}

async fn bootstrap_migration_history(connection: &mut SqliteConnection) -> Result<(), String> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS fux_schema_migrations (\n            version INTEGER PRIMARY KEY,\n            description TEXT NOT NULL,\n            applied_at TEXT NOT NULL\n        );",
    )
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;

    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM fux_schema_migrations")
        .fetch_one(&mut *connection)
        .await
        .map_err(to_error)?;
    if count > 0 || !table_exists(connection, "users").await? {
        return Ok(());
    }

    let detected = if table_exists(connection, "local_security_preferences").await?
        && column_exists(connection, "users", "password_algorithm").await?
    {
        3
    } else if table_exists(connection, "backup_history").await? {
        2
    } else {
        1
    };

    for (version, description, _) in MIGRATIONS.iter().filter(|(version, _, _)| *version <= detected) {
        sqlx::query(
            "INSERT OR IGNORE INTO fux_schema_migrations (version, description, applied_at) VALUES ($1, $2, $3)",
        )
        .bind(version)
        .bind(description)
        .bind(Utc::now().to_rfc3339())
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    }
    Ok(())
}

async fn apply_migrations(connection: &mut SqliteConnection) -> Result<i64, String> {
    bootstrap_migration_history(connection).await?;
    let current = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(version), 0) FROM fux_schema_migrations",
    )
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;

    for (version, description, sql) in MIGRATIONS.iter().filter(|(version, _, _)| *version > current) {
        let mut transaction = connection.begin().await.map_err(to_error)?;
        sqlx::raw_sql(sql)
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("A migration {version} falhou: {error}"))?;
        sqlx::query(
            "INSERT INTO fux_schema_migrations (version, description, applied_at) VALUES ($1, $2, $3)",
        )
        .bind(version)
        .bind(description)
        .bind(Utc::now().to_rfc3339())
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
        sqlx::raw_sql(&format!("PRAGMA user_version = {version};"))
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
    }

    sqlx::query_scalar::<_, i64>("SELECT COALESCE(MAX(version), 0) FROM fux_schema_migrations")
        .fetch_one(&mut *connection)
        .await
        .map_err(to_error)
}

async fn read_status(
    app: &AppHandle,
    connection: &mut SqliteConnection,
    key: &[u8],
    cipher: String,
) -> Result<DatabaseEncryptionStatus, String> {
    let schema_version = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(version), 0) FROM fux_schema_migrations",
    )
    .fetch_one(&mut *connection)
    .await
    .unwrap_or(CURRENT_SCHEMA_VERSION);

    let metadata = sqlx::query(
        "SELECT encrypted_at, last_key_rotation_at, migrated_from_plaintext, migration_backup_path\n           FROM database_security_state WHERE id = 1 LIMIT 1",
    )
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    let path = database_path(app)?;
    Ok(DatabaseEncryptionStatus {
        opened: true,
        encrypted: true,
        cipher_version: cipher,
        schema_version,
        key_fingerprint: key_fingerprint(key),
        database_path: path.to_string_lossy().to_string(),
        database_size_bytes: fs::metadata(&path).map(|metadata| metadata.len()).unwrap_or(0),
        encrypted_at: metadata.as_ref().and_then(|row| row.try_get("encrypted_at").ok()),
        last_key_rotation_at: metadata.as_ref().and_then(|row| row.try_get("last_key_rotation_at").ok()),
        migrated_from_plaintext: metadata
            .as_ref()
            .and_then(|row| row.try_get::<i64, _>("migrated_from_plaintext").ok())
            .unwrap_or(0)
            != 0,
        migration_backup_path: metadata
            .as_ref()
            .and_then(|row| row.try_get::<Option<String>, _>("migration_backup_path").ok())
            .flatten(),
    })
}

async fn persist_security_state(
    connection: &mut SqliteConnection,
    key: &[u8],
    migrated: bool,
    migration_backup_path: Option<&str>,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO database_security_state (
             id, encryption_version, cipher_name, key_fingerprint, encrypted_at,
             last_key_rotation_at, migrated_from_plaintext, migration_backup_path, updated_at
           ) VALUES (1, 1, 'SQLCipher 4', $1, $2, NULL, $3, $4, $2)
           ON CONFLICT(id) DO UPDATE SET
             encryption_version = 1,
             cipher_name = 'SQLCipher 4',
             key_fingerprint = excluded.key_fingerprint,
             encrypted_at = COALESCE(database_security_state.encrypted_at, excluded.encrypted_at),
             migrated_from_plaintext = CASE WHEN excluded.migrated_from_plaintext = 1 THEN 1 ELSE database_security_state.migrated_from_plaintext END,
             migration_backup_path = COALESCE(excluded.migration_backup_path, database_security_state.migration_backup_path),
             updated_at = excluded.updated_at"#,
    )
    .bind(key_fingerprint(key))
    .bind(Utc::now().to_rfc3339())
    .bind(if migrated { 1 } else { 0 })
    .bind(migration_backup_path)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

async fn encrypted_database_open_internal(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    key_b64: String,
) -> Result<DatabaseEncryptionStatus, String> {
    if let Some(status) = state.status() {
        return Ok(status);
    }

    let key = decode_key(&key_b64)?;
    let path = database_path(app)?;
    let migrated_from_plaintext = looks_like_plaintext_sqlite(&path)?;
    let migration_backup = if migrated_from_plaintext {
        migrate_plaintext_database(app, &path, &key).await?
    } else {
        None
    };

    let mut connection = encrypted_options(&path, &key, true)
        .connect()
        .await
        .map_err(|_| "A chave do Stronghold não conseguiu abrir o banco. Restaure um backup portátil ou recupere o cofre deste dispositivo.".to_string())?;
    let cipher = cipher_version(&mut connection).await?;
    let schema_version = apply_migrations(&mut connection).await?;
    if schema_version != CURRENT_SCHEMA_VERSION {
        return Err(format!("O banco ficou na versão {schema_version}, mas o aplicativo exige a versão {CURRENT_SCHEMA_VERSION}."));
    }
    persist_security_state(
        &mut connection,
        &key,
        migrated_from_plaintext,
        migration_backup.as_deref(),
    )
    .await?;
    if migrated_from_plaintext {
        sqlx::query(
            "INSERT INTO security_events (id, user_id, event_type, severity, message, created_at, app_version) VALUES ($1, NULL, 'database_encrypted', 'warning', 'Banco local convertido para SQLCipher.', $2, $3)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(Utc::now().to_rfc3339())
        .bind(app.package_info().version.to_string())
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    }
    let status = read_status(app, &mut connection, &key, cipher).await?;
    connection.close().await.map_err(to_error)?;
    state.set_key(key.to_vec())?;
    state.set_status(status.clone());
    log::info!(
        "encrypted_database_opened schema={} migrated={} fingerprint={}",
        status.schema_version,
        status.migrated_from_plaintext,
        status.key_fingerprint
    );
    Ok(status)
}

#[tauri::command(async)]
pub fn encrypted_database_open(
    app: AppHandle,
    key_b64: String,
) -> Result<DatabaseEncryptionStatus, String> {
    run_local_async_worker("finnacialux-database-open", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        encrypted_database_open_internal(&app, &state, key_b64).await
    })
}

fn validate_sql(sql: &str) -> Result<(), String> {
    let normalized = sql.to_ascii_lowercase();
    let forbidden = [
        "pragma key",
        "pragma rekey",
        "attach database",
        "detach database",
        "load_extension",
        "cipher_salt",
    ];
    if forbidden.iter().any(|value| normalized.contains(value)) {
        return Err("A instrução SQL solicitou uma operação protegida.".to_string());
    }
    Ok(())
}

fn bind_json<'q>(
    mut query: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    values: Vec<Value>,
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
    for value in values {
        query = match value {
            Value::Null => query.bind(Option::<String>::None),
            Value::Bool(value) => query.bind(value),
            Value::Number(value) if value.is_i64() => query.bind(value.as_i64().unwrap_or_default()),
            Value::Number(value) if value.is_u64() => {
                let number = value.as_u64().unwrap_or_default();
                if number <= i64::MAX as u64 {
                    query.bind(number as i64)
                } else {
                    query.bind(number as f64)
                }
            }
            Value::Number(value) => query.bind(value.as_f64().unwrap_or_default()),
            Value::String(value) => query.bind(value),
            Value::Array(value) => {
                let bytes = value
                    .into_iter()
                    .filter_map(|item| item.as_u64().and_then(|number| u8::try_from(number).ok()))
                    .collect::<Vec<_>>();
                query.bind(bytes)
            }
            Value::Object(value) => query.bind(Value::Object(value).to_string()),
        };
    }
    query
}

fn row_to_json(row: &SqliteRow) -> Result<Value, String> {
    let mut object = Map::new();
    for (index, column) in row.columns().iter().enumerate() {
        let raw = row.try_get_raw(index).map_err(to_error)?;
        let value = if raw.is_null() {
            Value::Null
        } else {
            match column.type_info().name().to_ascii_uppercase().as_str() {
                "INTEGER" | "INT" | "BOOLEAN" => Value::Number(Number::from(
                    row.try_get::<i64, _>(index).map_err(to_error)?,
                )),
                "REAL" | "FLOAT" | "DOUBLE" | "NUMERIC" => Number::from_f64(
                    row.try_get::<f64, _>(index).map_err(to_error)?,
                )
                .map(Value::Number)
                .unwrap_or(Value::Null),
                "BLOB" => Value::Array(
                    row.try_get::<Vec<u8>, _>(index)
                        .map_err(to_error)?
                        .into_iter()
                        .map(|byte| Value::Number(Number::from(byte)))
                        .collect(),
                ),
                _ => Value::String(row.try_get::<String, _>(index).map_err(to_error)?),
            }
        };
        object.insert(column.name().to_string(), value);
    }
    Ok(Value::Object(object))
}

#[tauri::command]
pub async fn encrypted_database_execute(
    app: AppHandle,
    state: State<'_, EncryptedDatabaseState>,
    sql: String,
    values: Vec<Value>,
) -> Result<DatabaseExecuteResult, String> {
    validate_sql(&sql)?;
    let mut connection = connect_app_database(&app, &state).await?;
    let result = bind_json(sqlx::query(&sql), values)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(DatabaseExecuteResult {
        rows_affected: result.rows_affected(),
        last_insert_id: result.last_insert_rowid(),
    })
}

#[tauri::command]
pub async fn encrypted_database_select(
    app: AppHandle,
    state: State<'_, EncryptedDatabaseState>,
    sql: String,
    values: Vec<Value>,
) -> Result<Vec<Value>, String> {
    validate_sql(&sql)?;
    let mut connection = connect_app_database(&app, &state).await?;
    let rows = bind_json(sqlx::query(&sql), values)
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    rows.iter().map(row_to_json).collect()
}

#[tauri::command]
pub fn encrypted_database_status(
    state: State<'_, EncryptedDatabaseState>,
) -> DatabaseEncryptionStatus {
    state.status().unwrap_or(DatabaseEncryptionStatus {
        opened: false,
        encrypted: false,
        cipher_version: String::new(),
        schema_version: 0,
        key_fingerprint: String::new(),
        database_path: String::new(),
        database_size_bytes: 0,
        encrypted_at: None,
        last_key_rotation_at: None,
        migrated_from_plaintext: false,
        migration_backup_path: None,
    })
}

#[tauri::command]
pub fn encrypted_database_close(state: State<'_, EncryptedDatabaseState>) {
    state.clear();
}

async fn encrypted_database_rekey_internal(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    new_key_b64: String,
) -> Result<DatabaseEncryptionStatus, String> {
    let old_key = state.key_copy()?;
    let new_key = decode_key(&new_key_b64)?;
    if old_key.as_slice() == new_key.as_slice() {
        return Err("A nova chave precisa ser diferente da chave atual.".to_string());
    }

    let path = database_path(app)?;
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let safety_copy = backups_dir(app)?.join(format!("pre-key-rotation-{timestamp}.sqlcipher"));
    let mut connection = encrypted_options(&path, &old_key, false)
        .connect()
        .await
        .map_err(to_error)?;
    sqlx::raw_sql("PRAGMA wal_checkpoint(FULL);")
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    fs::copy(&path, &safety_copy).map_err(to_error)?;

    let rekey_statement = format!("PRAGMA rekey = {};", raw_key_pragma(&new_key));
    if let Err(error) = sqlx::raw_sql(&rekey_statement).execute(&mut connection).await {
        let _ = fs::remove_file(&safety_copy);
        return Err(format!("A rotação da chave não foi aplicada: {error}"));
    }
    connection.close().await.map_err(to_error)?;

    let mut verification = match encrypted_options(&path, &new_key, false).connect().await {
        Ok(connection) => connection,
        Err(error) => {
            fs::copy(&safety_copy, &path).map_err(to_error)?;
            let _ = fs::remove_file(&safety_copy);
            return Err(format!("A nova chave não abriu o banco e a cópia anterior foi restaurada: {error}"));
        }
    };
    let cipher = cipher_version(&mut verification).await?;
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&mut verification)
        .await
        .map_err(to_error)?;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE database_security_state SET key_fingerprint = $1, last_key_rotation_at = $2, updated_at = $2 WHERE id = 1",
    )
    .bind(key_fingerprint(&new_key))
    .bind(&now)
    .execute(&mut verification)
    .await
    .map_err(to_error)?;
    sqlx::query(
        "INSERT INTO security_events (id, user_id, event_type, severity, message, created_at, app_version) VALUES ($1, NULL, 'database_key_rotated', 'warning', 'Chave do banco SQLCipher rotacionada.', $2, $3)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&now)
    .bind(app.package_info().version.to_string())
    .execute(&mut verification)
    .await
    .map_err(to_error)?;
    let status = read_status(app, &mut verification, &new_key, cipher).await?;
    verification.close().await.map_err(to_error)?;
    state.set_key(new_key.to_vec())?;
    state.set_status(status.clone());
    log::warn!(
        "database_key_rotated fingerprint={} safety_copy={}",
        status.key_fingerprint,
        safety_copy.to_string_lossy()
    );
    Ok(status)
}

#[tauri::command(async)]
pub fn encrypted_database_rekey(
    app: AppHandle,
    new_key_b64: String,
) -> Result<DatabaseEncryptionStatus, String> {
    run_local_async_worker("finnacialux-database-rekey", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        encrypted_database_rekey_internal(&app, &state, new_key_b64).await
    })
}

pub async fn export_plaintext_snapshot(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    destination: &Path,
) -> Result<(), String> {
    prepare_attach_destination(destination)?;
    let mut connection = connect_app_database(app, state).await?;
    sqlx::raw_sql("PRAGMA wal_checkpoint(FULL);")
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    let attach = format!(
        "ATTACH DATABASE '{}' AS plaintext KEY '';",
        escape_sql_path(destination),
    );
    sqlx::raw_sql(&attach).execute(&mut connection).await.map_err(to_error)?;
    sqlx::query("SELECT sqlcipher_export('plaintext')")
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    let user_version = sqlx::query_scalar::<_, i64>("PRAGMA user_version")
        .fetch_one(&mut connection)
        .await
        .unwrap_or(CURRENT_SCHEMA_VERSION);
    sqlx::raw_sql(&format!("PRAGMA plaintext.user_version = {user_version};"))
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    sqlx::raw_sql("DETACH DATABASE plaintext;")
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    connection.close().await.map_err(to_error)
}

pub async fn replace_from_plaintext_snapshot(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    source: &Path,
) -> Result<(), String> {
    let key = state.key_copy()?;
    let database = database_path(app)?;
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let staged = database.with_extension(format!("db.restore-{timestamp}.tmp"));
    let previous = database.with_extension(format!("db.previous-{timestamp}.tmp"));
    cleanup_stale_migration_files(&database);
    prepare_attach_destination(&staged)?;

    let mut plaintext = plaintext_options(source, false).connect().await.map_err(to_error)?;
    let attach = format!(
        "ATTACH DATABASE '{}' AS encrypted KEY {};",
        escape_sql_path(&staged),
        raw_key_pragma(&key),
    );
    sqlx::raw_sql(&attach).execute(&mut plaintext).await.map_err(to_error)?;
    sqlx::query("SELECT sqlcipher_export('encrypted')")
        .execute(&mut plaintext)
        .await
        .map_err(to_error)?;
    let user_version = sqlx::query_scalar::<_, i64>("PRAGMA user_version")
        .fetch_one(&mut plaintext)
        .await
        .unwrap_or(CURRENT_SCHEMA_VERSION);
    sqlx::raw_sql(&format!("PRAGMA encrypted.user_version = {user_version};"))
        .execute(&mut plaintext)
        .await
        .map_err(to_error)?;
    sqlx::raw_sql("DETACH DATABASE encrypted;")
        .execute(&mut plaintext)
        .await
        .map_err(to_error)?;
    plaintext.close().await.map_err(to_error)?;
    verify_encrypted_database(&staged, &key).await?;
    let mut staged_connection = encrypted_options(&staged, &key, false)
        .connect()
        .await
        .map_err(to_error)?;
    let staged_schema = match apply_migrations(&mut staged_connection).await {
        Ok(version) => version,
        Err(error) => {
            let _ = staged_connection.close().await;
            let _ = fs::remove_file(&staged);
            return Err(format!("O backup não pôde ser atualizado antes da restauração: {error}"));
        }
    };
    if staged_schema != CURRENT_SCHEMA_VERSION {
        let _ = staged_connection.close().await;
        let _ = fs::remove_file(&staged);
        return Err(format!(
            "O backup ficou no schema {staged_schema}, mas o aplicativo exige {CURRENT_SCHEMA_VERSION}."
        ));
    }
    if let Err(error) = persist_security_state(&mut staged_connection, &key, false, None).await {
        let _ = staged_connection.close().await;
        let _ = fs::remove_file(&staged);
        return Err(format!("O estado de criptografia do backup não pôde ser preparado: {error}"));
    }
    staged_connection.close().await.map_err(to_error)?;
    verify_encrypted_database(&staged, &key).await?;

    if previous.exists() {
        fs::remove_file(&previous).map_err(to_error)?;
    }
    if database.exists() {
        fs::rename(&database, &previous).map_err(to_error)?;
    }
    for suffix in ["-wal", "-shm"] {
        let sidecar = PathBuf::from(format!("{}{}", database.to_string_lossy(), suffix));
        if sidecar.exists() {
            let _ = fs::remove_file(sidecar);
        }
    }
    if let Err(error) = fs::rename(&staged, &database) {
        if previous.exists() {
            let _ = fs::rename(&previous, &database);
        }
        return Err(format!("A restauração criptografada falhou e foi revertida: {error}"));
    }
    if let Err(error) = verify_encrypted_database(&database, &key).await {
        let _ = fs::remove_file(&database);
        if previous.exists() {
            let _ = fs::rename(&previous, &database);
        }
        return Err(format!("O banco restaurado falhou na validação final: {error}"));
    }

    let mut restored = encrypted_options(&database, &key, false)
        .connect()
        .await
        .map_err(to_error)?;
    let cipher = cipher_version(&mut restored).await?;
    let status = read_status(app, &mut restored, &key, cipher).await?;
    restored.close().await.map_err(to_error)?;
    state.set_status(status);
    if previous.exists() {
        let _ = fs::remove_file(previous);
    }
    Ok(())
}
