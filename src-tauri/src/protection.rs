use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Duration, Utc};
use fs2::available_space;
use serde::{Deserialize, Serialize};
use rand::{rngs::OsRng, RngCore};
use sha2::{Digest, Sha256};
use sqlx::{Connection, Row, SqliteConnection};
use crate::command_worker::run_local_async_worker;
use crate::encrypted_database::{
    connect_app_database, connect_plaintext_path, export_plaintext_snapshot,
    replace_from_plaintext_snapshot, DatabaseEncryptionStatus, EncryptedDatabaseState,
};
use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Manager, State};
use tempfile::TempDir;
use uuid::Uuid;

const DATABASE_FILE_NAME: &str = "finnacialux.db";
const BACKUP_EXTENSION: &str = "fuxbackup";
const DIAGNOSTIC_EXTENSION: &str = "fuxdiag";
const BACKUP_MAGIC_V2: &[u8] = b"FUXBACKUP2\n";
const BACKUP_MAGIC_V3: &[u8] = b"FUXBACKUP3\n";
const CURRENT_SCHEMA_VERSION: i64 = 9;
const SESSION_MARKER_FILE: &str = "session-active.marker";

#[derive(Default)]
pub struct RecoveryState {
    previous_unclean_shutdown: Arc<Mutex<bool>>,
}

impl RecoveryState {
    pub fn set_previous_unclean_shutdown(&self, value: bool) {
        if let Ok(mut current) = self.previous_unclean_shutdown.lock() {
            *current = value;
        }
    }

    pub fn previous_unclean_shutdown(&self) -> bool {
        self.previous_unclean_shutdown
            .lock()
            .map(|current| *current)
            .unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    format: String,
    format_version: u32,
    app_identifier: String,
    app_version: String,
    schema_version: i64,
    created_at: String,
    kind: String,
    database_file_name: String,
    database_size_bytes: u64,
    database_sha256: String,
    modules_count: i64,
    #[serde(default = "default_encryption_mode")]
    encryption_mode: String,
    #[serde(default)]
    encryption_salt_b64: Option<String>,
    #[serde(default)]
    encryption_nonce_b64: Option<String>,
    #[serde(default)]
    payload_size_bytes: u64,
    #[serde(default)]
    payload_sha256: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub(crate) id: String,
    pub(crate) file_name: String,
    pub(crate) file_path: String,
    pub(crate) created_at: String,
    pub(crate) size_bytes: i64,
    pub(crate) modules_count: i64,
    pub(crate) kind: String,
    pub(crate) status: String,
    pub(crate) integrity_status: String,
    pub(crate) checksum_sha256: Option<String>,
    pub(crate) app_version: String,
    pub(crate) schema_version: i64,
    pub(crate) encryption_mode: String,
    pub(crate) error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupHeader {
    file_path: String,
    file_name: String,
    package_size_bytes: u64,
    manifest: BackupManifest,
    requires_credential: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPreview {
    file_path: String,
    file_name: String,
    package_size_bytes: u64,
    manifest: BackupManifest,
    pub(crate) integrity: IntegrityReport,
    pub(crate) compatible: bool,
    pub(crate) compatibility_message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupOperationResult {
    record: BackupRecord,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreOperationResult {
    pub(crate) restored: bool,
    pub(crate) safety_backup_path: String,
    pub(crate) restored_from: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub(crate) ok: bool,
    pub(crate) integrity_messages: Vec<String>,
    pub(crate) foreign_key_violations: usize,
    pub(crate) required_tables_present: bool,
    pub(crate) schema_version: i64,
    pub(crate) checked_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationEntry {
    version: i64,
    description: String,
    applied_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticReport {
    app_name: String,
    app_version: String,
    identifier: String,
    operating_system: String,
    architecture: String,
    database_path: String,
    database_exists: bool,
    database_size_bytes: u64,
    database_encrypted: bool,
    database_cipher_version: String,
    database_key_fingerprint: String,
    database_encrypted_at: Option<String>,
    database_last_key_rotation_at: Option<String>,
    database_migrated_from_plaintext: bool,
    database_migration_backup_path: Option<String>,
    backups_directory: String,
    logs_directory: String,
    available_disk_bytes: u64,
    backup_count: usize,
    last_backup_at: Option<String>,
    previous_unclean_shutdown: bool,
    safe_mode: bool,
    pub(crate) integrity: IntegrityReport,
    migrations: Vec<MigrationEntry>,
    generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPreferences {
    automatic_enabled: bool,
    frequency: String,
    retention_count: i64,
    include_attachments: bool,
    encryption_mode: String,
    last_automatic_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomaticBackupResult {
    created: bool,
    reason: String,
    record: Option<BackupRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryStatus {
    previous_unclean_shutdown: bool,
    marker_path: String,
}

fn default_encryption_mode() -> String {
    "none".to_string()
}

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(to_error)?;
    fs::create_dir_all(&directory).map_err(to_error)?;
    Ok(directory)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app)?.join(DATABASE_FILE_NAME))
}

pub(crate) fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app_config_dir(app)?.join("backups");
    fs::create_dir_all(&directory).map_err(to_error)?;
    Ok(directory)
}

fn logs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_log_dir().map_err(to_error)?;
    fs::create_dir_all(&directory).map_err(to_error)?;
    Ok(directory)
}

fn session_marker_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app)?.join(SESSION_MARKER_FILE))
}

async fn connect_database(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
) -> Result<SqliteConnection, String> {
    connect_app_database(app, database).await
}

async fn connect_snapshot(path: &Path) -> Result<SqliteConnection, String> {
    connect_plaintext_path(path, false).await
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn derive_password_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    if password.len() < 8 {
        return Err("A senha do backup precisa ter pelo menos 8 caracteres.".to_string());
    }
    let mut key = [0_u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(to_error)?;
    Ok(key)
}

fn decode_device_key(value: &str) -> Result<[u8; 32], String> {
    let decoded = BASE64.decode(value).map_err(to_error)?;
    decoded
        .try_into()
        .map_err(|_| "A chave local de backup é inválida.".to_string())
}

fn encrypt_backup_payload(
    mode: &str,
    credential: Option<&str>,
    plaintext: &[u8],
) -> Result<(Vec<u8>, Option<String>, Option<String>), String> {
    if mode == "none" {
        return Ok((plaintext.to_vec(), None, None));
    }

    let mut salt = [0_u8; 16];
    let key = if mode == "password" {
        OsRng.fill_bytes(&mut salt);
        derive_password_key(
            credential.ok_or_else(|| "Informe a senha para criptografar o backup.".to_string())?,
            &salt,
        )?
    } else if mode == "device" {
        decode_device_key(
            credential.ok_or_else(|| "O cofre local precisa estar desbloqueado.".to_string())?,
        )?
    } else {
        return Err("Modo de criptografia de backup inválido.".to_string());
    };

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(to_error)?;
    let mut nonce_bytes = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext)
        .map_err(|_| "Não foi possível criptografar o backup.".to_string())?;
    Ok((
        encrypted,
        (mode == "password").then(|| BASE64.encode(salt)),
        Some(BASE64.encode(nonce_bytes)),
    ))
}

fn decrypt_backup_payload(
    manifest: &BackupManifest,
    credential: Option<&str>,
    payload: &[u8],
) -> Result<Vec<u8>, String> {
    if manifest.encryption_mode == "none" {
        return Ok(payload.to_vec());
    }

    let nonce = manifest
        .encryption_nonce_b64
        .as_deref()
        .ok_or_else(|| "O backup criptografado não possui nonce.".to_string())
        .and_then(|value| BASE64.decode(value).map_err(to_error))?;
    if nonce.len() != 12 {
        return Err("O nonce do backup é inválido.".to_string());
    }

    let key = if manifest.encryption_mode == "password" {
        let salt = manifest
            .encryption_salt_b64
            .as_deref()
            .ok_or_else(|| "O backup não possui salt de criptografia.".to_string())
            .and_then(|value| BASE64.decode(value).map_err(to_error))?;
        derive_password_key(
            credential.ok_or_else(|| "Este backup exige a senha definida na criação.".to_string())?,
            &salt,
        )?
    } else if manifest.encryption_mode == "device" {
        decode_device_key(
            credential.ok_or_else(|| "Este backup está protegido pelo cofre do computador de origem.".to_string())?,
        )?
    } else {
        return Err("O backup usa um modo de criptografia desconhecido.".to_string());
    };

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(to_error)?;
    cipher
        .decrypt(Nonce::from_slice(&nonce), payload)
        .map_err(|_| "A senha ou a chave local não conseguiu abrir este backup.".to_string())
}

fn ensure_extension(mut path: PathBuf, extension: &str) -> PathBuf {
    let has_extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case(extension))
        .unwrap_or(false);
    if !has_extension {
        path.set_extension(extension);
    }
    path
}

async fn modules_count(path: &Path) -> Result<i64, String> {
    let mut connection = connect_snapshot(path).await?;
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM finance_documents")
        .fetch_one(&mut connection)
        .await
        .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(count)
}

async fn create_consistent_database_copy(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    destination: &Path,
) -> Result<(), String> {
    export_plaintext_snapshot(app, database, destination).await
}

async fn validate_connection(connection: &mut SqliteConnection) -> Result<IntegrityReport, String> {
    let integrity_rows = sqlx::query("PRAGMA integrity_check")
        .fetch_all(&mut *connection)
        .await
        .map_err(to_error)?;
    let integrity_messages = integrity_rows
        .iter()
        .filter_map(|row| row.try_get::<String, _>(0).ok())
        .collect::<Vec<_>>();

    let foreign_key_rows = sqlx::query("PRAGMA foreign_key_check")
        .fetch_all(&mut *connection)
        .await
        .map_err(to_error)?;

    let version = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(version), 1) FROM app_schema_history",
    )
    .fetch_one(&mut *connection)
    .await
    .unwrap_or(1);

    let mut required_tables = vec![
        "users",
        "workspaces",
        "user_preferences",
        "finance_documents",
        "app_schema_history",
        "backup_history",
        "backup_preferences",
    ];
    if version >= 3 {
        required_tables.extend(["local_security_preferences", "security_events"]);
    }
    if version >= 4 {
        required_tables.push("database_security_state");
    }
    if version >= 5 {
        required_tables.push("portability_operations");
    }
    if version >= 6 {
        required_tables.extend([
            "continuity_preferences",
            "continuity_recovery_points",
            "continuity_events",
        ]);
    }
    if version >= 7 {
        required_tables.extend([
            "automation_preferences",
            "automation_runs",
            "automation_alert_states",
        ]);
    }

    let mut required_tables_present = true;
    for table in required_tables {
        let found = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $1",
        )
        .bind(table)
        .fetch_one(&mut *connection)
        .await
        .map_err(to_error)?;
        if found == 0 {
            required_tables_present = false;
        }
    }

    let integrity_ok = integrity_messages.len() == 1
        && integrity_messages[0].eq_ignore_ascii_case("ok");
    Ok(IntegrityReport {
        ok: integrity_ok && foreign_key_rows.is_empty() && required_tables_present,
        integrity_messages,
        foreign_key_violations: foreign_key_rows.len(),
        required_tables_present,
        schema_version: version,
        checked_at: Utc::now().to_rfc3339(),
    })
}

async fn validate_database(path: &Path) -> Result<IntegrityReport, String> {
    if !path.exists() {
        return Err("O arquivo de banco não foi encontrado.".to_string());
    }
    let mut connection = connect_snapshot(path).await?;
    let report = validate_connection(&mut connection).await?;
    connection.close().await.map_err(to_error)?;
    Ok(report)
}

pub(crate) async fn validate_current_database(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
) -> Result<IntegrityReport, String> {
    let mut connection = connect_database(app, database).await?;
    let report = validate_connection(&mut connection).await?;
    connection.close().await.map_err(to_error)?;
    Ok(report)
}

fn write_backup_package(
    destination: &Path,
    manifest: &BackupManifest,
    payload: &[u8],
) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }
    let manifest_bytes = serde_json::to_vec(manifest).map_err(to_error)?;
    let manifest_length = manifest_bytes.len() as u64;
    let temporary_path = destination.with_extension("fuxbackup.tmp");
    let mut file = File::create(&temporary_path).map_err(to_error)?;
    file.write_all(BACKUP_MAGIC_V3).map_err(to_error)?;
    file.write_all(&manifest_length.to_le_bytes()).map_err(to_error)?;
    file.write_all(&manifest_bytes).map_err(to_error)?;
    file.write_all(payload).map_err(to_error)?;
    file.sync_all().map_err(to_error)?;
    if destination.exists() {
        fs::remove_file(destination).map_err(to_error)?;
    }
    fs::rename(&temporary_path, destination).map_err(to_error)?;
    Ok(())
}

fn read_backup_header_internal(path: &Path) -> Result<(BackupManifest, Vec<u8>), String> {
    let mut file = File::open(path).map_err(to_error)?;
    let mut magic = vec![0_u8; BACKUP_MAGIC_V3.len()];
    file.read_exact(&mut magic).map_err(to_error)?;
    let is_v2 = magic == BACKUP_MAGIC_V2;
    let is_v3 = magic == BACKUP_MAGIC_V3;
    if !is_v2 && !is_v3 {
        return Err("Este arquivo não é um backup válido do FinnacialUX Desktop.".to_string());
    }

    let mut length_bytes = [0_u8; 8];
    file.read_exact(&mut length_bytes).map_err(to_error)?;
    let manifest_length = u64::from_le_bytes(length_bytes);
    if manifest_length == 0 || manifest_length > 1_048_576 {
        return Err("O manifesto do backup é inválido.".to_string());
    }

    let mut manifest_bytes = vec![0_u8; manifest_length as usize];
    file.read_exact(&mut manifest_bytes).map_err(to_error)?;
    let mut manifest: BackupManifest = serde_json::from_slice(&manifest_bytes).map_err(to_error)?;
    let mut payload = Vec::new();
    file.read_to_end(&mut payload).map_err(to_error)?;

    if manifest.format != "finnacialux-desktop-backup"
        || manifest.app_identifier != "com.ateliux.finnacialux.desktop"
        || (manifest.format_version != 2 && manifest.format_version != 3)
    {
        return Err("O backup pertence a outro aplicativo ou formato.".to_string());
    }
    if is_v2 {
        manifest.encryption_mode = "none".to_string();
        manifest.payload_size_bytes = payload.len() as u64;
        manifest.payload_sha256 = sha256_hex(&payload);
    }
    if manifest.payload_size_bytes != 0 && payload.len() as u64 != manifest.payload_size_bytes {
        return Err("O tamanho do conteúdo protegido não corresponde ao manifesto.".to_string());
    }
    if !manifest.payload_sha256.is_empty() && sha256_hex(&payload) != manifest.payload_sha256 {
        return Err("A assinatura do conteúdo protegido não corresponde ao arquivo.".to_string());
    }
    Ok((manifest, payload))
}

fn read_backup_package(
    path: &Path,
    credential: Option<&str>,
) -> Result<(BackupManifest, Vec<u8>), String> {
    let (manifest, payload) = read_backup_header_internal(path)?;
    let database_bytes = decrypt_backup_payload(&manifest, credential, &payload)?;
    if database_bytes.len() as u64 != manifest.database_size_bytes {
        return Err("O tamanho interno do banco não corresponde ao manifesto.".to_string());
    }
    if sha256_hex(&database_bytes) != manifest.database_sha256 {
        return Err("A assinatura de integridade do banco não corresponde ao conteúdo.".to_string());
    }
    Ok((manifest, database_bytes))
}

async fn insert_backup_history(app: &AppHandle, database: &EncryptedDatabaseState, record: &BackupRecord) -> Result<(), String> {
    let mut connection = connect_database(app, database).await?;
    sqlx::query(
        r#"INSERT INTO backup_history (
          id, file_name, file_path, created_at, size_bytes, modules_count, kind,
          status, integrity_status, checksum_sha256, app_version, schema_version, encryption_mode, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT(id) DO UPDATE SET
          file_name = excluded.file_name,
          file_path = excluded.file_path,
          created_at = excluded.created_at,
          size_bytes = excluded.size_bytes,
          modules_count = excluded.modules_count,
          kind = excluded.kind,
          status = excluded.status,
          integrity_status = excluded.integrity_status,
          checksum_sha256 = excluded.checksum_sha256,
          app_version = excluded.app_version,
          schema_version = excluded.schema_version,
          encryption_mode = excluded.encryption_mode,
          error_message = excluded.error_message"#,
    )
    .bind(&record.id)
    .bind(&record.file_name)
    .bind(&record.file_path)
    .bind(&record.created_at)
    .bind(record.size_bytes)
    .bind(record.modules_count)
    .bind(&record.kind)
    .bind(&record.status)
    .bind(&record.integrity_status)
    .bind(&record.checksum_sha256)
    .bind(&record.app_version)
    .bind(record.schema_version)
    .bind(&record.encryption_mode)
    .bind(&record.error_message)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(())
}

pub(crate) async fn create_backup_internal(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    destination: PathBuf,
    kind: &str,
    encryption_mode: &str,
    credential: Option<&str>,
) -> Result<BackupRecord, String> {
    let source = database_path(app)?;
    if !source.exists() {
        return Err("O banco local ainda não foi criado.".to_string());
    }

    let destination = ensure_extension(destination, BACKUP_EXTENSION);
    let temporary_directory = TempDir::new().map_err(to_error)?;
    let snapshot_path = temporary_directory.path().join(DATABASE_FILE_NAME);
    create_consistent_database_copy(app, database, &snapshot_path).await?;
    let integrity = validate_database(&snapshot_path).await?;
    if !integrity.ok {
        return Err("A cópia foi criada, mas não passou na verificação de integridade.".to_string());
    }

    let database_bytes = fs::read(&snapshot_path).map_err(to_error)?;
    let checksum = sha256_hex(&database_bytes);
    let (payload, encryption_salt_b64, encryption_nonce_b64) =
        encrypt_backup_payload(encryption_mode, credential, &database_bytes)?;
    let payload_checksum = sha256_hex(&payload);
    let created_at = Utc::now().to_rfc3339();
    let app_version = app.package_info().version.to_string();
    let modules = modules_count(&snapshot_path).await?;
    let manifest = BackupManifest {
        format: "finnacialux-desktop-backup".to_string(),
        format_version: 3,
        app_identifier: "com.ateliux.finnacialux.desktop".to_string(),
        app_version: app_version.clone(),
        schema_version: integrity.schema_version,
        created_at: created_at.clone(),
        kind: kind.to_string(),
        database_file_name: DATABASE_FILE_NAME.to_string(),
        database_size_bytes: database_bytes.len() as u64,
        database_sha256: checksum.clone(),
        modules_count: modules,
        encryption_mode: encryption_mode.to_string(),
        encryption_salt_b64,
        encryption_nonce_b64,
        payload_size_bytes: payload.len() as u64,
        payload_sha256: payload_checksum,
    };
    write_backup_package(&destination, &manifest, &payload)?;
    let package_size = fs::metadata(&destination).map_err(to_error)?.len() as i64;
    let record = BackupRecord {
        id: Uuid::new_v4().to_string(),
        file_name: destination
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("finnacialux-backup.fuxbackup")
            .to_string(),
        file_path: destination.to_string_lossy().to_string(),
        created_at,
        size_bytes: package_size,
        modules_count: modules,
        kind: kind.to_string(),
        status: "available".to_string(),
        integrity_status: "ok".to_string(),
        checksum_sha256: Some(checksum),
        app_version,
        schema_version: integrity.schema_version,
        encryption_mode: encryption_mode.to_string(),
        error_message: None,
    };
    insert_backup_history(app, database, &record).await?;
    log::info!("backup_created kind={} id={}", record.kind, record.id);
    Ok(record)
}

async fn remove_old_automatic_backups(app: &AppHandle, database: &EncryptedDatabaseState, retention: i64) -> Result<(), String> {
    let automatic_directory = backups_dir(app)?;
    let mut connection = connect_database(app, database).await?;
    let rows = sqlx::query(
        "SELECT id, file_path FROM backup_history WHERE kind = 'automatic' ORDER BY created_at DESC",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;

    for row in rows.into_iter().skip(retention.max(1) as usize) {
        let id: String = row.try_get("id").map_err(to_error)?;
        let file_path: String = row.try_get("file_path").map_err(to_error)?;
        let candidate = PathBuf::from(&file_path);
        if candidate.starts_with(&automatic_directory) && candidate.exists() {
            let _ = fs::remove_file(&candidate);
        }
        sqlx::query("DELETE FROM backup_history WHERE id = $1")
            .bind(id)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
    }
    connection.close().await.map_err(to_error)?;
    Ok(())
}

async fn load_backup_preferences_internal(app: &AppHandle, database: &EncryptedDatabaseState) -> Result<BackupPreferences, String> {
    let mut connection = connect_database(app, database).await?;
    let row = sqlx::query(
        "SELECT automatic_enabled, frequency, retention_count, include_attachments, encryption_mode, last_automatic_at FROM backup_preferences WHERE id = 1",
    )
    .fetch_one(&mut connection)
    .await
    .map_err(to_error)?;
    let preferences = BackupPreferences {
        automatic_enabled: row.try_get::<i64, _>("automatic_enabled").map_err(to_error)? != 0,
        frequency: row.try_get("frequency").map_err(to_error)?,
        retention_count: row.try_get("retention_count").map_err(to_error)?,
        include_attachments: row.try_get::<i64, _>("include_attachments").map_err(to_error)? != 0,
        encryption_mode: row.try_get("encryption_mode").unwrap_or_else(|_| "device".to_string()),
        last_automatic_at: row.try_get("last_automatic_at").map_err(to_error)?,
    };
    connection.close().await.map_err(to_error)?;
    Ok(preferences)
}

async fn update_last_automatic_at(app: &AppHandle, database: &EncryptedDatabaseState, created_at: &str) -> Result<(), String> {
    let mut connection = connect_database(app, database).await?;
    sqlx::query("UPDATE backup_preferences SET last_automatic_at = $1, updated_at = $1 WHERE id = 1")
        .bind(created_at)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(())
}

fn automatic_backup_due(preferences: &BackupPreferences) -> bool {
    if !preferences.automatic_enabled {
        return false;
    }
    let Some(last) = &preferences.last_automatic_at else {
        return true;
    };
    let Ok(last_date) = DateTime::parse_from_rfc3339(last) else {
        return true;
    };
    let elapsed = Utc::now().signed_duration_since(last_date.with_timezone(&Utc));
    let required = match preferences.frequency.as_str() {
        "daily" => Duration::days(1),
        "monthly" => Duration::days(30),
        _ => Duration::days(7),
    };
    elapsed >= required
}

async fn create_manual_backup_internal(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    destination: String,
    encryption_mode: String,
    credential: Option<String>,
) -> Result<BackupOperationResult, String> {
    let record = create_backup_internal(
        app,
        database,
        PathBuf::from(destination),
        "manual",
        &encryption_mode,
        credential.as_deref(),
    )
    .await?;
    Ok(BackupOperationResult {
        record,
        message: "Backup criado e verificado com sucesso.".to_string(),
    })
}

#[tauri::command(async)]
pub fn create_manual_backup(
    app: AppHandle,
    destination: String,
    encryption_mode: String,
    credential: Option<String>,
) -> Result<BackupOperationResult, String> {
    run_local_async_worker("finnacialux-manual-backup", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        create_manual_backup_internal(
            &app,
            &database,
            destination,
            encryption_mode,
            credential,
        )
        .await
    })
}

async fn run_automatic_backup_internal(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    credential: Option<String>,
) -> Result<AutomaticBackupResult, String> {
    let preferences = load_backup_preferences_internal(app, database).await?;
    if !preferences.automatic_enabled {
        return Ok(AutomaticBackupResult {
            created: false,
            reason: "O backup automático está desativado.".to_string(),
            record: None,
        });
    }
    if !automatic_backup_due(&preferences) {
        return Ok(AutomaticBackupResult {
            created: false,
            reason: "Ainda não chegou o próximo período de backup.".to_string(),
            record: None,
        });
    }

    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let file_name = format!("FinnacialUX-automatico-{timestamp}.{BACKUP_EXTENSION}");
    let destination = backups_dir(app)?.join(file_name);
    if preferences.encryption_mode == "device" && credential.is_none() {
        return Ok(AutomaticBackupResult {
            created: false,
            reason: "O cofre local ainda não está disponível para criptografar o backup.".to_string(),
            record: None,
        });
    }
    let record = create_backup_internal(
        app,
        database,
        destination,
        "automatic",
        &preferences.encryption_mode,
        credential.as_deref(),
    )
    .await?;
    update_last_automatic_at(app, database, &record.created_at).await?;
    remove_old_automatic_backups(app, database, preferences.retention_count).await?;
    Ok(AutomaticBackupResult {
        created: true,
        reason: "Backup automático concluído.".to_string(),
        record: Some(record),
    })
}

#[tauri::command(async)]
pub fn run_automatic_backup(
    app: AppHandle,
    credential: Option<String>,
) -> Result<AutomaticBackupResult, String> {
    run_local_async_worker("finnacialux-automatic-backup", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        run_automatic_backup_internal(&app, &database, credential).await
    })
}

async fn create_pre_update_backup_internal(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    credential: String,
) -> Result<BackupRecord, String> {
    if credential.trim().is_empty() {
        return Err("O cofre local não forneceu a chave necessária para o backup pré-atualização.".to_string());
    }
    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let destination = backups_dir(app)?.join(format!(
        "FinnacialUX-pre-atualizacao-{timestamp}.{BACKUP_EXTENSION}"
    ));
    create_backup_internal(
        app,
        database,
        destination,
        "pre_update",
        "device",
        Some(credential.as_str()),
    )
    .await
}

#[tauri::command(async)]
pub fn create_pre_update_backup(
    app: AppHandle,
    credential: String,
) -> Result<BackupRecord, String> {
    run_local_async_worker("finnacialux-pre-update-backup", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        create_pre_update_backup_internal(&app, &database, credential).await
    })
}

#[tauri::command]
pub fn prepare_for_update_exit(app: AppHandle) {
    clear_session_marker(&app);
    log::info!("update_exit_prepared");
}

#[tauri::command]
pub fn resume_after_update_failure(
    app: AppHandle,
    recovery_state: State<'_, RecoveryState>,
) -> Result<(), String> {
    initialize_session_marker(&app, &recovery_state)?;
    log::warn!("update_exit_cancelled session_marker_restored=true");
    Ok(())
}

async fn list_backups_internal(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
) -> Result<Vec<BackupRecord>, String> {
    let mut connection = connect_database(app, database).await?;
    let rows = sqlx::query(
        r#"SELECT id, file_name, file_path, created_at, size_bytes, modules_count, kind,
                  status, integrity_status, checksum_sha256, app_version, schema_version, encryption_mode, error_message
             FROM backup_history
            WHERE kind != 'recovery_point'
         ORDER BY created_at DESC"#,
    )
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    let mut records = Vec::with_capacity(rows.len());
    for row in rows {
        let file_path: String = row.try_get("file_path").map_err(to_error)?;
        let stored_status: String = row.try_get("status").map_err(to_error)?;
        records.push(BackupRecord {
            id: row.try_get("id").map_err(to_error)?,
            file_name: row.try_get("file_name").map_err(to_error)?,
            file_path: file_path.clone(),
            created_at: row.try_get("created_at").map_err(to_error)?,
            size_bytes: row.try_get("size_bytes").map_err(to_error)?,
            modules_count: row.try_get("modules_count").map_err(to_error)?,
            kind: row.try_get("kind").map_err(to_error)?,
            status: if Path::new(&file_path).exists() {
                stored_status
            } else {
                "missing".to_string()
            },
            integrity_status: row.try_get("integrity_status").map_err(to_error)?,
            checksum_sha256: row.try_get("checksum_sha256").map_err(to_error)?,
            app_version: row.try_get("app_version").map_err(to_error)?,
            schema_version: row.try_get("schema_version").map_err(to_error)?,
            encryption_mode: row.try_get("encryption_mode").unwrap_or_else(|_| "none".to_string()),
            error_message: row.try_get("error_message").map_err(to_error)?,
        });
    }
    connection.close().await.map_err(to_error)?;
    Ok(records)

}

#[tauri::command]
pub async fn list_backups(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
) -> Result<Vec<BackupRecord>, String> {
    list_backups_internal(&app, &database).await
}

#[tauri::command]
pub async fn remove_backup_record(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    backup_id: String,
    delete_file: bool,
) -> Result<(), String> {
    let mut connection = connect_database(&app, &database).await?;
    let row = sqlx::query("SELECT file_path, kind FROM backup_history WHERE id = $1")
        .bind(&backup_id)
        .fetch_optional(&mut connection)
        .await
        .map_err(to_error)?;
    if let Some(row) = row {
        let file_path: String = row.try_get("file_path").map_err(to_error)?;
        let kind: String = row.try_get("kind").map_err(to_error)?;
        if delete_file && (kind == "automatic" || kind == "pre_restore" || kind == "pre_update") {
            let candidate = PathBuf::from(file_path);
            let allowed_directory = backups_dir(&app)?;
            if candidate.starts_with(&allowed_directory) && candidate.exists() {
                fs::remove_file(candidate).map_err(to_error)?;
            }
        }
        sqlx::query("DELETE FROM backup_history WHERE id = $1")
            .bind(&backup_id)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
    }
    connection.close().await.map_err(to_error)?;
    Ok(())
}

pub(crate) async fn extract_and_validate_backup(
    path: &Path,
    credential: Option<&str>,
) -> Result<(BackupManifest, Vec<u8>, IntegrityReport), String> {
    let (manifest, database_bytes) = read_backup_package(path, credential)?;
    let temporary_directory = TempDir::new().map_err(to_error)?;
    let database_file = temporary_directory.path().join(DATABASE_FILE_NAME);
    fs::write(&database_file, &database_bytes).map_err(to_error)?;
    let integrity = validate_database(&database_file).await?;
    Ok((manifest, database_bytes, integrity))
}

#[tauri::command]
pub fn inspect_backup_header(source: String) -> Result<BackupHeader, String> {
    let path = PathBuf::from(source);
    let package_size = fs::metadata(&path).map_err(to_error)?.len();
    let (manifest, _) = read_backup_header_internal(&path)?;
    let requires_credential = manifest.encryption_mode != "none";
    Ok(BackupHeader {
        file_path: path.to_string_lossy().to_string(),
        file_name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("backup.fuxbackup")
            .to_string(),
        package_size_bytes: package_size,
        manifest,
        requires_credential,
    })
}

#[tauri::command]
pub async fn preview_backup(
    _app: AppHandle,
    source: String,
    credential: Option<String>,
) -> Result<BackupPreview, String> {
    let path = PathBuf::from(source);
    let package_size = fs::metadata(&path).map_err(to_error)?.len();
    let (manifest, _, integrity) =
        extract_and_validate_backup(&path, credential.as_deref()).await?;
    let compatible = integrity.ok && (1..=CURRENT_SCHEMA_VERSION).contains(&manifest.schema_version);
    let compatibility_message = if !integrity.ok {
        "O banco interno não passou na verificação de integridade.".to_string()
    } else if manifest.schema_version > CURRENT_SCHEMA_VERSION || manifest.schema_version < 1 {
        format!(
            "Este backup usa o schema {} e esta versão aceita schemas de 1 a {}.",
            manifest.schema_version, CURRENT_SCHEMA_VERSION
        )
    } else if manifest.schema_version < CURRENT_SCHEMA_VERSION {
        format!(
            "Backup íntegro da versão {}. Ele será atualizado com segurança para o schema {} durante a restauração.",
            manifest.schema_version, CURRENT_SCHEMA_VERSION
        )
    } else if manifest.encryption_mode == "password" {
        "Backup criptografado por senha, íntegro e pronto para restauração.".to_string()
    } else if manifest.encryption_mode == "device" {
        "Backup protegido pelo Stronghold deste computador e pronto para restauração.".to_string()
    } else {
        "Backup compatível e pronto para restauração.".to_string()
    };
    Ok(BackupPreview {
        file_path: path.to_string_lossy().to_string(),
        file_name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("backup.fuxbackup")
            .to_string(),
        package_size_bytes: package_size,
        manifest,
        integrity,
        compatible,
        compatibility_message,
    })
}

pub(crate) async fn restore_backup_internal(
    app: &AppHandle,
    database_state: &EncryptedDatabaseState,
    source: String,
    credential: Option<String>,
    safety_credential: Option<String>,
) -> Result<RestoreOperationResult, String> {
    let source_path = PathBuf::from(&source);
    let (manifest, database_bytes, integrity) =
        extract_and_validate_backup(&source_path, credential.as_deref()).await?;
    if !integrity.ok {
        return Err("A restauração foi bloqueada porque o backup está corrompido.".to_string());
    }
    if manifest.schema_version < 1 || manifest.schema_version > CURRENT_SCHEMA_VERSION {
        return Err(format!(
            "A restauração foi bloqueada: schema do backup {}, faixa aceita de 1 a {}.",
            manifest.schema_version, CURRENT_SCHEMA_VERSION
        ));
    }

    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let safety_destination = backups_dir(app)?
        .join(format!("FinnacialUX-antes-da-restauracao-{timestamp}.{BACKUP_EXTENSION}"));
    let safety_mode = if safety_credential.is_some() { "device" } else { "none" };
    let safety_record = create_backup_internal(
        app,
        database_state,
        safety_destination,
        "pre_restore",
        safety_mode,
        safety_credential.as_deref(),
    )
    .await?;

    let temporary_directory = TempDir::new().map_err(to_error)?;
    let snapshot_path = temporary_directory.path().join("finnacialux-restored.sqlite");
    fs::write(&snapshot_path, database_bytes).map_err(to_error)?;
    replace_from_plaintext_snapshot(app, database_state, &snapshot_path).await?;

    let restored_integrity = validate_current_database(app, database_state).await?;
    if !restored_integrity.ok {
        return Err("O banco restaurado não passou na validação final.".to_string());
    }
    if let Err(error) = insert_backup_history(app, database_state, &safety_record).await {
        log::warn!("pre_restore_history_reinsert_failed error={}", error);
    }
    log::warn!("backup_restored schema={} encryption={}", manifest.schema_version, manifest.encryption_mode);
    Ok(RestoreOperationResult {
        restored: true,
        safety_backup_path: safety_record.file_path,
        restored_from: source,
        message: "Dados restaurados. Entre novamente para continuar.".to_string(),
    })
}

#[tauri::command(async)]
pub fn restore_backup(
    app: AppHandle,
    source: String,
    credential: Option<String>,
    safety_credential: Option<String>,
) -> Result<RestoreOperationResult, String> {
    run_local_async_worker("finnacialux-restore-backup", move || async move {
        let database_state = app.state::<EncryptedDatabaseState>();
        restore_backup_internal(
            &app,
            &database_state,
            source,
            credential,
            safety_credential,
        )
        .await
    })
}

#[tauri::command]
pub async fn run_integrity_check(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
) -> Result<IntegrityReport, String> {
    let report = validate_current_database(&app, &database).await?;
    if report.ok {
        log::info!("database_integrity_check status=ok schema={}", report.schema_version);
    } else {
        log::error!(
            "database_integrity_check status=failed foreign_keys={}",
            report.foreign_key_violations
        );
    }
    Ok(report)
}

async fn migration_history(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
) -> Result<Vec<MigrationEntry>, String> {
    let mut connection = connect_database(app, database).await?;
    let rows = sqlx::query(
        "SELECT version, description, applied_at FROM app_schema_history ORDER BY version DESC",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    let entries = rows
        .into_iter()
        .map(|row| MigrationEntry {
            version: row.try_get("version").unwrap_or_default(),
            description: row.try_get("description").unwrap_or_default(),
            applied_at: row.try_get("applied_at").unwrap_or_default(),
        })
        .collect();
    connection.close().await.map_err(to_error)?;
    Ok(entries)
}

async fn get_diagnostics_internal(
    app: &AppHandle,
    database_state: &EncryptedDatabaseState,
    safe_mode: bool,
    recovery_state: &RecoveryState,
) -> Result<DiagnosticReport, String> {
    let database = database_path(app)?;
    let backups = list_backups_internal(app, database_state).await?;
    let integrity = validate_current_database(app, database_state).await?;
    let migrations = migration_history(app, database_state).await?;
    let encryption = database_state.status().unwrap_or(DatabaseEncryptionStatus {
        opened: false,
        encrypted: false,
        cipher_version: String::new(),
        schema_version: 0,
        key_fingerprint: String::new(),
        database_path: database.to_string_lossy().to_string(),
        database_size_bytes: fs::metadata(&database).map(|meta| meta.len()).unwrap_or(0),
        encrypted_at: None,
        last_key_rotation_at: None,
        migrated_from_plaintext: false,
        migration_backup_path: None,
    });
    let config_directory = app_config_dir(app)?;
    Ok(DiagnosticReport {
        app_name: app.package_info().name.clone(),
        app_version: app.package_info().version.to_string(),
        identifier: "com.ateliux.finnacialux.desktop".to_string(),
        operating_system: os_info::get().to_string(),
        architecture: std::env::consts::ARCH.to_string(),
        database_path: database.to_string_lossy().to_string(),
        database_exists: database.exists(),
        database_size_bytes: fs::metadata(&database).map(|meta| meta.len()).unwrap_or(0),
        database_encrypted: encryption.encrypted,
        database_cipher_version: encryption.cipher_version,
        database_key_fingerprint: encryption.key_fingerprint,
        database_encrypted_at: encryption.encrypted_at,
        database_last_key_rotation_at: encryption.last_key_rotation_at,
        database_migrated_from_plaintext: encryption.migrated_from_plaintext,
        database_migration_backup_path: encryption.migration_backup_path,
        backups_directory: backups_dir(app)?.to_string_lossy().to_string(),
        logs_directory: logs_dir(app)?.to_string_lossy().to_string(),
        available_disk_bytes: available_space(&config_directory).unwrap_or(0),
        backup_count: backups.len(),
        last_backup_at: backups.first().map(|record| record.created_at.clone()),
        previous_unclean_shutdown: recovery_state.previous_unclean_shutdown(),
        safe_mode,
        integrity,
        migrations,
        generated_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn get_diagnostics(
    app: AppHandle,
    database_state: State<'_, EncryptedDatabaseState>,
    safe_mode: bool,
    recovery_state: State<'_, RecoveryState>,
) -> Result<DiagnosticReport, String> {
    get_diagnostics_internal(&app, &database_state, safe_mode, &recovery_state).await
}

fn read_recent_logs(directory: &Path) -> Vec<String> {
    let mut files = fs::read_dir(directory)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    files.sort_by_key(|path| fs::metadata(path).and_then(|meta| meta.modified()).ok());
    files.reverse();

    let mut lines = Vec::new();
    for path in files.into_iter().take(3) {
        if let Ok(content) = fs::read_to_string(path) {
            lines.extend(content.lines().rev().take(150).map(str::to_string));
        }
        if lines.len() >= 300 {
            break;
        }
    }
    lines.truncate(300);
    lines.reverse();
    lines
}

#[tauri::command]
pub async fn export_diagnostic_package(
    app: AppHandle,
    database_state: State<'_, EncryptedDatabaseState>,
    destination: String,
    safe_mode: bool,
    recovery_state: State<'_, RecoveryState>,
) -> Result<String, String> {
    let destination = ensure_extension(PathBuf::from(destination), DIAGNOSTIC_EXTENSION);
    let report = get_diagnostics_internal(&app, &database_state, safe_mode, &recovery_state).await?;
    let payload = serde_json::json!({
        "format": "finnacialux-diagnostic",
        "formatVersion": 1,
        "privacy": "Este pacote não contém senhas, lançamentos, saldos ou documentos financeiros.",
        "diagnostics": report,
        "recentSanitizedLogs": read_recent_logs(&logs_dir(&app)?),
    });
    fs::write(
        &destination,
        serde_json::to_vec_pretty(&payload).map_err(to_error)?,
    )
    .map_err(to_error)?;
    log::info!("diagnostic_package_exported");
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_backup_preferences(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
) -> Result<BackupPreferences, String> {
    load_backup_preferences_internal(&app, &database).await
}

#[tauri::command]
pub async fn save_backup_preferences(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    preferences: BackupPreferences,
) -> Result<BackupPreferences, String> {
    if !matches!(preferences.frequency.as_str(), "daily" | "weekly" | "monthly") {
        return Err("Frequência de backup inválida.".to_string());
    }
    if !(1..=60).contains(&preferences.retention_count) {
        return Err("A retenção deve ficar entre 1 e 60 cópias.".to_string());
    }
    if !matches!(preferences.encryption_mode.as_str(), "device" | "none") {
        return Err("O backup automático aceita proteção local ou sem criptografia.".to_string());
    }
    let mut connection = connect_database(&app, &database).await?;
    sqlx::query(
        r#"UPDATE backup_preferences
              SET automatic_enabled = $1,
                  frequency = $2,
                  retention_count = $3,
                  include_attachments = $4,
                  encryption_mode = $5,
                  updated_at = $6
            WHERE id = 1"#,
    )
    .bind(if preferences.automatic_enabled { 1 } else { 0 })
    .bind(&preferences.frequency)
    .bind(preferences.retention_count)
    .bind(if preferences.include_attachments { 1 } else { 0 })
    .bind(&preferences.encryption_mode)
    .bind(Utc::now().to_rfc3339())
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    load_backup_preferences_internal(&app, &database).await
}

#[tauri::command]
pub fn open_app_folder(app: AppHandle, folder: String) -> Result<String, String> {
    let path = match folder.as_str() {
        "data" => app_config_dir(&app)?,
        "backups" => backups_dir(&app)?,
        "logs" => logs_dir(&app)?,
        _ => return Err("Pasta não autorizada.".to_string()),
    };

    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer.exe");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command.arg(&path).spawn().map_err(to_error)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_recovery_status(
    app: AppHandle,
    recovery_state: State<'_, RecoveryState>,
) -> Result<RecoveryStatus, String> {
    Ok(RecoveryStatus {
        previous_unclean_shutdown: recovery_state.previous_unclean_shutdown(),
        marker_path: session_marker_path(&app)?.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn acknowledge_recovery(recovery_state: State<'_, RecoveryState>) {
    recovery_state.set_previous_unclean_shutdown(false);
}

pub fn initialize_session_marker(app: &AppHandle, recovery_state: &RecoveryState) -> Result<(), String> {
    let marker = session_marker_path(app)?;
    recovery_state.set_previous_unclean_shutdown(marker.exists());
    let content = serde_json::json!({
        "pid": std::process::id(),
        "startedAt": Utc::now().to_rfc3339(),
        "appVersion": app.package_info().version.to_string(),
    });
    fs::write(marker, serde_json::to_vec_pretty(&content).map_err(to_error)?)
        .map_err(to_error)?;
    Ok(())
}

pub fn clear_session_marker(app: &AppHandle) {
    if let Ok(marker) = session_marker_path(app) {
        if marker.exists() {
            let _ = fs::remove_file(marker);
        }
    }
}
