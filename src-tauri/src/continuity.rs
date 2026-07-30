use crate::command_worker::run_local_async_worker;
use crate::encrypted_database::{
    connect_app_database, replace_from_encrypted_snapshot, verify_encrypted_snapshot,
    DatabaseAccessStatus, EncryptedDatabaseState,
};
use crate::protection::{
    backups_dir, create_backup_internal, extract_and_validate_backup, restore_backup_internal,
    validate_current_database, IntegrityReport,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{Connection, Row};
use std::{fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuityPreferences {
    pub startup_integrity_check: bool,
    pub create_daily_recovery_point: bool,
    pub recovery_point_retention: i64,
    pub maximum_age_days: i64,
    pub enter_read_only_on_failure: bool,
    pub last_startup_check_at: Option<String>,
    pub last_healthy_recovery_point_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryPoint {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub reason: String,
    pub format: String,
    pub status: String,
    pub schema_version: i64,
    pub size_bytes: i64,
    pub checksum_sha256: Option<String>,
    pub created_at: String,
    pub verified_at: Option<String>,
    pub app_version: String,
    pub protected: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuityEvent {
    pub id: String,
    pub event_type: String,
    pub severity: String,
    pub message: String,
    pub recovery_point_id: Option<String>,
    pub details_json: Option<String>,
    pub created_at: String,
    pub app_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuityStatus {
    pub access: DatabaseAccessStatus,
    pub integrity: IntegrityReport,
    pub preferences: ContinuityPreferences,
    pub recovery_points_count: usize,
    pub last_recovery_point_at: Option<String>,
    pub latest_event: Option<ContinuityEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuityCheckResult {
    pub healthy: bool,
    pub read_only_activated: bool,
    pub recovery_point_created: bool,
    pub integrity: IntegrityReport,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryOperationResult {
    pub restored: bool,
    pub recovery_point_id: String,
    pub safety_backup_path: String,
    pub message: String,
}

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(to_error)?;
    Ok(hex::encode(Sha256::digest(bytes)))
}

async fn load_preferences(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
) -> Result<ContinuityPreferences, String> {
    let mut connection = connect_app_database(app, database).await?;
    let row = sqlx::query(
        "SELECT startup_integrity_check, create_daily_recovery_point, recovery_point_retention, maximum_age_days, enter_read_only_on_failure, last_startup_check_at, last_healthy_recovery_point_at FROM continuity_preferences WHERE id = 1",
    )
    .fetch_one(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(ContinuityPreferences {
        startup_integrity_check: row.try_get::<i64, _>("startup_integrity_check").map_err(to_error)? != 0,
        create_daily_recovery_point: row.try_get::<i64, _>("create_daily_recovery_point").map_err(to_error)? != 0,
        recovery_point_retention: row.try_get("recovery_point_retention").map_err(to_error)?,
        maximum_age_days: row.try_get("maximum_age_days").map_err(to_error)?,
        enter_read_only_on_failure: row.try_get::<i64, _>("enter_read_only_on_failure").map_err(to_error)? != 0,
        last_startup_check_at: row.try_get("last_startup_check_at").map_err(to_error)?,
        last_healthy_recovery_point_at: row.try_get("last_healthy_recovery_point_at").map_err(to_error)?,
    })
}

async fn record_event(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    event_type: &str,
    severity: &str,
    message: &str,
    recovery_point_id: Option<&str>,
    details: Option<serde_json::Value>,
) -> Result<(), String> {
    let mut connection = connect_app_database(app, database).await?;
    sqlx::query(
        "INSERT INTO continuity_events (id, event_type, severity, message, recovery_point_id, details_json, created_at, app_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(event_type)
    .bind(severity)
    .bind(message)
    .bind(recovery_point_id)
    .bind(details.map(|value| value.to_string()))
    .bind(Utc::now().to_rfc3339())
    .bind(app.package_info().version.to_string())
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(())
}

async fn register_fuxbackup_recovery_point(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    reason: &str,
    credential: Option<&str>,
    protected: bool,
) -> Result<RecoveryPoint, String> {
    let directory = backups_dir(app)?.join("recovery-points");
    fs::create_dir_all(&directory).map_err(to_error)?;
    let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S");
    let destination = directory.join(format!("FinnacialUX-ponto-{reason}-{stamp}.fuxbackup"));
    let encryption_mode = if credential.is_some() { "device" } else { "none" };
    let record = create_backup_internal(
        app,
        database,
        destination,
        "recovery_point",
        encryption_mode,
        credential,
    )
    .await?;

    let checksum_sha256 = Some(sha256_file(Path::new(&record.file_path))?);

    let point = RecoveryPoint {
        id: Uuid::new_v4().to_string(),
        file_name: record.file_name,
        file_path: record.file_path,
        reason: reason.to_string(),
        format: "fuxbackup".to_string(),
        status: record.status,
        schema_version: record.schema_version,
        size_bytes: record.size_bytes,
        checksum_sha256,
        created_at: record.created_at,
        verified_at: Some(Utc::now().to_rfc3339()),
        app_version: record.app_version,
        protected,
        error_message: record.error_message,
    };

    let mut connection = connect_app_database(app, database).await?;
    sqlx::query(
        "INSERT INTO continuity_recovery_points (id, file_name, file_path, reason, format, status, schema_version, size_bytes, checksum_sha256, created_at, verified_at, app_version, protected, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
    )
    .bind(&point.id)
    .bind(&point.file_name)
    .bind(&point.file_path)
    .bind(&point.reason)
    .bind(&point.format)
    .bind(&point.status)
    .bind(point.schema_version)
    .bind(point.size_bytes)
    .bind(&point.checksum_sha256)
    .bind(&point.created_at)
    .bind(&point.verified_at)
    .bind(&point.app_version)
    .bind(if point.protected { 1 } else { 0 })
    .bind(&point.error_message)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    sqlx::query(
        "UPDATE continuity_preferences SET last_healthy_recovery_point_at = $1, updated_at = $1 WHERE id = 1",
    )
    .bind(&point.created_at)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(
        app,
        database,
        "recovery_point_created",
        "info",
        "Ponto de recuperação criado e verificado.",
        Some(&point.id),
        Some(json!({ "reason": reason, "format": &point.format })),
    )
    .await?;
    Ok(point)
}

async fn list_recovery_points_internal(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
) -> Result<Vec<RecoveryPoint>, String> {
    let mut connection = connect_app_database(app, database).await?;
    let rows = sqlx::query(
        "SELECT id, file_name, file_path, reason, format, status, schema_version, size_bytes, checksum_sha256, created_at, verified_at, app_version, protected, error_message FROM continuity_recovery_points ORDER BY created_at DESC",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let file_path: String = row.try_get("file_path").unwrap_or_default();
            let stored_status: String = row.try_get("status").unwrap_or_else(|_| "available".to_string());
            RecoveryPoint {
                id: row.try_get("id").unwrap_or_default(),
                file_name: row.try_get("file_name").unwrap_or_default(),
                file_path: file_path.clone(),
                reason: row.try_get("reason").unwrap_or_default(),
                format: row.try_get("format").unwrap_or_default(),
                status: if Path::new(&file_path).exists() { stored_status } else { "missing".to_string() },
                schema_version: row.try_get("schema_version").unwrap_or_default(),
                size_bytes: row.try_get("size_bytes").unwrap_or_default(),
                checksum_sha256: row.try_get("checksum_sha256").ok(),
                created_at: row.try_get("created_at").unwrap_or_default(),
                verified_at: row.try_get("verified_at").ok(),
                app_version: row.try_get("app_version").unwrap_or_default(),
                protected: row.try_get::<i64, _>("protected").unwrap_or_default() != 0,
                error_message: row.try_get("error_message").ok(),
            }
        })
        .collect())
}

fn point_is_expired(point: &RecoveryPoint, maximum_age_days: i64, now: DateTime<Utc>) -> bool {
    if point.protected || maximum_age_days <= 0 {
        return false;
    }
    DateTime::parse_from_rfc3339(&point.created_at)
        .map(|created| now.signed_duration_since(created.with_timezone(&Utc)) > Duration::days(maximum_age_days))
        .unwrap_or(false)
}

fn recovery_point_ids_to_prune(
    points: &[RecoveryPoint],
    retention: i64,
    maximum_age_days: i64,
    now: DateTime<Utc>,
) -> Vec<String> {
    let keep = retention.max(1) as usize;
    let mut unprotected_seen = 0_usize;
    let mut ids = Vec::new();
    for point in points {
        if point.protected {
            continue;
        }
        let exceeds_retention = unprotected_seen >= keep;
        unprotected_seen += 1;
        if exceeds_retention || point_is_expired(point, maximum_age_days, now) {
            ids.push(point.id.clone());
        }
    }
    ids
}

async fn prune_recovery_points(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    preferences: &ContinuityPreferences,
) -> Result<usize, String> {
    let points = list_recovery_points_internal(app, database).await?;
    let ids = recovery_point_ids_to_prune(
        &points,
        preferences.recovery_point_retention,
        preferences.maximum_age_days,
        Utc::now(),
    );
    if ids.is_empty() {
        return Ok(0);
    }
    let allowed = backups_dir(app)?;
    let mut connection = connect_app_database(app, database).await?;
    for id in &ids {
        if let Some(point) = points.iter().find(|point| &point.id == id) {
            let candidate = PathBuf::from(&point.file_path);
            if candidate.starts_with(&allowed) && candidate.exists() {
                let _ = fs::remove_file(&candidate);
            }
            sqlx::query("DELETE FROM backup_history WHERE kind = 'recovery_point' AND file_path = $1")
                .bind(&point.file_path)
                .execute(&mut connection)
                .await
                .map_err(to_error)?;
        }
        sqlx::query("DELETE FROM continuity_recovery_points WHERE id = $1")
            .bind(id)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
    }
    connection.close().await.map_err(to_error)?;
    Ok(ids.len())
}

fn daily_point_due(preferences: &ContinuityPreferences) -> bool {
    if !preferences.create_daily_recovery_point {
        return false;
    }
    preferences
        .last_healthy_recovery_point_at
        .as_deref()
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|last| Utc::now().signed_duration_since(last.with_timezone(&Utc)) >= Duration::days(1))
        .unwrap_or(true)
}

#[tauri::command]
pub async fn continuity_get_preferences(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
) -> Result<ContinuityPreferences, String> {
    load_preferences(&app, &database).await
}

#[tauri::command]
pub async fn continuity_save_preferences(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    preferences: ContinuityPreferences,
) -> Result<ContinuityPreferences, String> {
    if !(3..=50).contains(&preferences.recovery_point_retention) {
        return Err("A retenção precisa ficar entre 3 e 50 pontos de recuperação.".to_string());
    }
    if !(7..=365).contains(&preferences.maximum_age_days) {
        return Err("A idade máxima precisa ficar entre 7 e 365 dias.".to_string());
    }
    let mut connection = connect_app_database(&app, &database).await?;
    sqlx::query(
        "UPDATE continuity_preferences SET startup_integrity_check = $1, create_daily_recovery_point = $2, recovery_point_retention = $3, maximum_age_days = $4, enter_read_only_on_failure = $5, updated_at = $6 WHERE id = 1",
    )
    .bind(if preferences.startup_integrity_check { 1 } else { 0 })
    .bind(if preferences.create_daily_recovery_point { 1 } else { 0 })
    .bind(preferences.recovery_point_retention)
    .bind(preferences.maximum_age_days)
    .bind(if preferences.enter_read_only_on_failure { 1 } else { 0 })
    .bind(Utc::now().to_rfc3339())
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    let stored = load_preferences(&app, &database).await?;
    let _ = prune_recovery_points(&app, &database, &stored).await?;
    Ok(stored)
}

#[tauri::command]
pub async fn continuity_list_recovery_points(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
) -> Result<Vec<RecoveryPoint>, String> {
    list_recovery_points_internal(&app, &database).await
}

#[tauri::command(async)]
pub fn continuity_create_recovery_point(
    app: AppHandle,
    credential: Option<String>,
    protected: bool,
) -> Result<RecoveryPoint, String> {
    run_local_async_worker("finnacialux-create-recovery-point", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let credential = credential.ok_or_else(|| {
            "A chave do dispositivo é obrigatória para criar um ponto de recuperação criptografado.".to_string()
        })?;
        let point = register_fuxbackup_recovery_point(
            &app,
            &database,
            "manual",
            Some(&credential),
            protected,
        )
        .await?;
        let preferences = load_preferences(&app, &database).await?;
        let _ = prune_recovery_points(&app, &database, &preferences).await?;
        Ok(point)
    })
}

#[tauri::command]
pub async fn continuity_verify_recovery_point(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    recovery_point_id: String,
    credential: Option<String>,
) -> Result<RecoveryPoint, String> {
    let points = list_recovery_points_internal(&app, &database).await?;
    let point = points
        .into_iter()
        .find(|point| point.id == recovery_point_id)
        .ok_or_else(|| "O ponto de recuperação não foi encontrado.".to_string())?;
    let path = PathBuf::from(&point.file_path);
    let current_checksum = sha256_file(&path)?;
    if let Some(expected) = point.checksum_sha256.as_deref() {
        if !expected.eq_ignore_ascii_case(&current_checksum) {
            return Err("A assinatura do ponto de recuperação não corresponde ao arquivo registrado.".to_string());
        }
    }
    if point.format == "sqlcipher" {
        verify_encrypted_snapshot(&path, &database).await?;
    } else {
        let (_, _, report) = extract_and_validate_backup(&path, credential.as_deref()).await?;
        if !report.ok {
            return Err("O ponto de recuperação não passou na verificação de integridade.".to_string());
        }
    }
    let checksum = current_checksum;
    let verified_at = Utc::now().to_rfc3339();
    let mut connection = connect_app_database(&app, &database).await?;
    sqlx::query("UPDATE continuity_recovery_points SET status = 'available', checksum_sha256 = $1, verified_at = $2, error_message = NULL WHERE id = $3")
        .bind(checksum)
        .bind(&verified_at)
        .bind(&point.id)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(&app, &database, "recovery_point_verified", "info", "Ponto de recuperação verificado.", Some(&point.id), None).await?;
    list_recovery_points_internal(&app, &database)
        .await?
        .into_iter()
        .find(|candidate| candidate.id == point.id)
        .ok_or_else(|| "O ponto verificado não pôde ser recarregado.".to_string())
}

#[tauri::command(async)]
pub fn continuity_restore_recovery_point(
    app: AppHandle,
    recovery_point_id: String,
    credential: Option<String>,
    safety_credential: Option<String>,
) -> Result<RecoveryOperationResult, String> {
    run_local_async_worker("finnacialux-restore-recovery-point", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let safety_credential = safety_credential.ok_or_else(|| {
            "A chave do dispositivo é obrigatória para criar o backup de segurança anterior à restauração.".to_string()
        })?;
        let points = list_recovery_points_internal(&app, &database).await?;
        let point = points
            .into_iter()
            .find(|point| point.id == recovery_point_id)
            .ok_or_else(|| "O ponto de recuperação não foi encontrado.".to_string())?;
        let point_path = PathBuf::from(&point.file_path);
        if let Some(expected) = point.checksum_sha256.as_deref() {
            let current = sha256_file(&point_path)?;
            if !expected.eq_ignore_ascii_case(&current) {
                return Err("A restauração foi bloqueada porque o checksum do ponto mudou.".to_string());
            }
        }
        let safety_backup_path = if point.format == "sqlcipher" {
            let safety = register_fuxbackup_recovery_point(
                &app,
                &database,
                "pre_recovery",
                Some(&safety_credential),
                true,
            )
            .await?;
            replace_from_encrypted_snapshot(&app, &database, &point_path).await?;
            safety.file_path
        } else {
            restore_backup_internal(
                &app,
                &database,
                point.file_path.clone(),
                credential,
                Some(safety_credential),
            )
            .await?
            .safety_backup_path
        };
        database.set_read_only(false, None);
        record_event(
            &app,
            &database,
            "recovery_point_restored",
            "warning",
            "Ponto de recuperação restaurado com validação atômica.",
            None,
            Some(json!({ "recoveryPointId": &point.id })),
        )
        .await?;
        Ok(RecoveryOperationResult {
            restored: true,
            recovery_point_id: point.id,
            safety_backup_path,
            message: "Ponto de recuperação restaurado. Entre novamente para continuar.".to_string(),
        })
    })
}

#[tauri::command(async)]
pub fn continuity_run_startup_check(
    app: AppHandle,
    credential: Option<String>,
) -> Result<ContinuityCheckResult, String> {
    run_local_async_worker("finnacialux-continuity-startup", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let preferences = load_preferences(&app, &database).await?;
        let integrity = validate_current_database(&app, &database).await?;
        let now = Utc::now().to_rfc3339();
        let mut connection = connect_app_database(&app, &database).await?;
        sqlx::query("UPDATE continuity_preferences SET last_startup_check_at = $1, updated_at = $1 WHERE id = 1")
            .bind(&now)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;

        if !integrity.ok {
            let message = "A integridade do banco falhou. O modo somente leitura foi ativado para impedir novas alterações financeiras.";
            if preferences.enter_read_only_on_failure {
                database.set_read_only(true, Some(message.to_string()));
            }
            record_event(
                &app,
                &database,
                "integrity_failure",
                "critical",
                message,
                None,
                Some(json!({
                    "foreignKeyViolations": integrity.foreign_key_violations,
                    "messages": &integrity.integrity_messages,
                })),
            )
            .await?;
            return Ok(ContinuityCheckResult {
                healthy: false,
                read_only_activated: preferences.enter_read_only_on_failure,
                recovery_point_created: false,
                integrity,
                message: message.to_string(),
            });
        }

        database.set_read_only(false, None);
        record_event(
            &app,
            &database,
            "integrity_check_ok",
            "info",
            "Banco local íntegro e liberado para gravações financeiras.",
            None,
            None,
        )
        .await?;
        let mut recovery_point_created = false;
        if daily_point_due(&preferences) {
            if let Some(credential) = credential.as_deref() {
                register_fuxbackup_recovery_point(
                    &app,
                    &database,
                    "daily_healthy",
                    Some(credential),
                    false,
                )
                .await?;
                recovery_point_created = true;
            } else {
                record_event(
                    &app,
                    &database,
                    "daily_recovery_point_skipped",
                    "warning",
                    "O ponto diário não foi criado porque a chave segura do dispositivo não estava disponível.",
                    None,
                    None,
                )
                .await?;
            }
        }
        let stored = load_preferences(&app, &database).await?;
        let _ = prune_recovery_points(&app, &database, &stored).await?;
        Ok(ContinuityCheckResult {
            healthy: true,
            read_only_activated: false,
            recovery_point_created,
            integrity,
            message: if recovery_point_created {
                "Banco íntegro e novo ponto de recuperação diário criado.".to_string()
            } else {
                "Banco íntegro e pronto para uso.".to_string()
            },
        })
    })
}

#[tauri::command]
pub async fn continuity_exit_read_only(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
) -> Result<DatabaseAccessStatus, String> {
    let integrity = validate_current_database(&app, &database).await?;
    if !integrity.ok {
        return Err("O modo somente leitura não pode ser encerrado enquanto a integridade estiver comprometida.".to_string());
    }
    database.set_read_only(false, None);
    record_event(&app, &database, "read_only_disabled", "warning", "Modo somente leitura encerrado após nova validação de integridade.", None, None).await?;
    Ok(database.access_status())
}

#[tauri::command]
pub async fn continuity_get_status(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
) -> Result<ContinuityStatus, String> {
    let integrity = validate_current_database(&app, &database).await?;
    let preferences = load_preferences(&app, &database).await?;
    if !integrity.ok && preferences.enter_read_only_on_failure {
        database.set_read_only(
            true,
            Some("A integridade do banco está comprometida. As gravações financeiras permanecerão bloqueadas até uma recuperação válida.".to_string()),
        );
    }
    let points = list_recovery_points_internal(&app, &database).await?;
    let mut connection = connect_app_database(&app, &database).await?;
    let latest = sqlx::query("SELECT id, event_type, severity, message, recovery_point_id, details_json, created_at, app_version FROM continuity_events ORDER BY created_at DESC LIMIT 1")
        .fetch_optional(&mut connection)
        .await
        .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    let latest_event = latest.map(|row| ContinuityEvent {
        id: row.try_get("id").unwrap_or_default(),
        event_type: row.try_get("event_type").unwrap_or_default(),
        severity: row.try_get("severity").unwrap_or_default(),
        message: row.try_get("message").unwrap_or_default(),
        recovery_point_id: row.try_get("recovery_point_id").ok(),
        details_json: row.try_get("details_json").ok(),
        created_at: row.try_get("created_at").unwrap_or_default(),
        app_version: row.try_get("app_version").unwrap_or_default(),
    });
    Ok(ContinuityStatus {
        access: database.access_status(),
        integrity,
        preferences,
        recovery_points_count: points.len(),
        last_recovery_point_at: points.first().map(|point| point.created_at.clone()),
        latest_event,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(id: &str, days_ago: i64, protected: bool) -> RecoveryPoint {
        RecoveryPoint {
            id: id.to_string(),
            file_name: format!("{id}.fuxbackup"),
            file_path: format!("C:/backups/{id}.fuxbackup"),
            reason: "daily_healthy".to_string(),
            format: "fuxbackup".to_string(),
            status: "available".to_string(),
            schema_version: 7,
            size_bytes: 100,
            checksum_sha256: None,
            created_at: (Utc::now() - Duration::days(days_ago)).to_rfc3339(),
            verified_at: None,
            app_version: "0.10.0".to_string(),
            protected,
            error_message: None,
        }
    }

    #[test]
    fn retention_keeps_protected_points_and_recent_limit() {
        let now = Utc::now();
        let points = vec![
            point("new", 0, false),
            point("protected", 120, true),
            point("old-1", 91, false),
            point("old-2", 92, false),
        ];
        let pruned = recovery_point_ids_to_prune(&points, 2, 90, now);
        assert!(pruned.contains(&"old-1".to_string()));
        assert!(pruned.contains(&"old-2".to_string()));
        assert!(!pruned.contains(&"protected".to_string()));
        assert!(!pruned.contains(&"new".to_string()));
    }
}
