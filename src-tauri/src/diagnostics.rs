use crate::{
    command_worker::run_local_async_worker,
    encrypted_database::{
        connect_app_database, connect_plaintext_path, export_plaintext_snapshot,
        EncryptedDatabaseState,
    },
};
use chrono::{DateTime, NaiveDateTime, Utc};
use fs2::available_space;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{Connection, Row, SqliteConnection};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration as StdDuration, Instant, SystemTime},
};
use tauri::{AppHandle, Manager};
use tempfile::TempDir;
use uuid::Uuid;

const CURRENT_SCHEMA_VERSION: i64 = 14;
const SUPPORT_EXTENSION: &str = "fuxsupport";
const MIN_FREE_DISK_BYTES: u64 = 100 * 1024 * 1024;
const HEALTHY_FREE_DISK_BYTES: u64 = 500 * 1024 * 1024;

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn ensure_database_writable(state: &EncryptedDatabaseState) -> Result<(), String> {
    let access = state.access_status();
    if access.read_only {
        return Err(access.reason.unwrap_or_else(|| {
            "O banco está em modo somente leitura. A ação de reparo foi bloqueada.".to_string()
        }));
    }
    Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn ensure_extension(mut path: PathBuf, extension: &str) -> PathBuf {
    if path.extension().and_then(|value| value.to_str()) != Some(extension) {
        path.set_extension(extension);
    }
    path
}

fn parse_date(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&Utc))
        .ok()
        .or_else(|| {
            NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|date| date.and_utc())
        })
}

fn days_since(value: Option<&str>) -> Option<i64> {
    value
        .and_then(parse_date)
        .map(|date| Utc::now().signed_duration_since(date).num_days().max(0))
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClientDiagnosticContext {
    pub stronghold_ready: bool,
    pub backup_key_available: bool,
    pub database_key_available: bool,
    pub updater_configured: bool,
    pub updater_endpoint_host: String,
    pub development_build: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticCheck {
    pub code: String,
    pub category: String,
    pub status: String,
    pub title: String,
    pub detail: String,
    pub repair_action: Option<String>,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSuiteResult {
    pub id: String,
    pub status: String,
    pub score: i64,
    pub checks_total: i64,
    pub checks_passed: i64,
    pub checks_attention: i64,
    pub checks_failed: i64,
    pub checks: Vec<DiagnosticCheck>,
    pub available_repairs: Vec<String>,
    pub read_only: bool,
    pub persisted: bool,
    pub started_at: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRunSummary {
    pub id: String,
    pub run_kind: String,
    pub status: String,
    pub score: i64,
    pub checks_total: i64,
    pub checks_passed: i64,
    pub checks_attention: i64,
    pub checks_failed: i64,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRepairRecord {
    pub id: String,
    pub action_kind: String,
    pub status: String,
    pub result_summary: String,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportPackageResult {
    pub file_path: String,
    pub file_name: String,
    pub payload_sha256: String,
    pub package_size_bytes: u64,
    pub checks_count: usize,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportPackageValidation {
    pub valid: bool,
    pub format: String,
    pub format_version: i64,
    pub payload_sha256: String,
    pub checks_count: usize,
    pub generated_at: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunDiagnosticSuiteRequest {
    pub workspace_id: String,
    #[serde(default = "default_true")]
    pub include_read_write_test: bool,
    #[serde(default = "default_true")]
    pub include_restore_drill: bool,
    #[serde(default)]
    pub client_context: ClientDiagnosticContext,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyDiagnosticRepairRequest {
    pub workspace_id: String,
    pub action_kind: String,
    pub run_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSupportPackageRequest {
    pub workspace_id: String,
    pub destination: String,
    #[serde(default)]
    pub safe_mode: bool,
    #[serde(default)]
    pub include_sanitized_logs: bool,
    #[serde(default)]
    pub client_context: ClientDiagnosticContext,
}

fn default_true() -> bool {
    true
}

fn make_check(
    code: &str,
    category: &str,
    status: &str,
    title: &str,
    detail: impl Into<String>,
    repair_action: Option<&str>,
    started: Instant,
) -> DiagnosticCheck {
    DiagnosticCheck {
        code: code.to_string(),
        category: category.to_string(),
        status: status.to_string(),
        title: title.to_string(),
        detail: detail.into(),
        repair_action: repair_action.map(str::to_string),
        duration_ms: started.elapsed().as_millis().min(i64::MAX as u128) as i64,
    }
}

fn suite_status(failed: i64, attention: i64) -> String {
    if failed > 0 {
        "failed".to_string()
    } else if attention > 0 {
        "attention".to_string()
    } else {
        "healthy".to_string()
    }
}

fn calculate_score(checks: &[DiagnosticCheck]) -> i64 {
    let penalty = checks.iter().fold(0_i64, |total, check| {
        total
            + match check.status.as_str() {
                "failed" => 25,
                "attention" => 7,
                "skipped" => 2,
                _ => 0,
            }
    });
    (100 - penalty).clamp(0, 100)
}

fn unique_repairs(checks: &[DiagnosticCheck]) -> Vec<String> {
    let mut values = Vec::new();
    for action in checks.iter().filter_map(|check| check.repair_action.clone()) {
        if !values.contains(&action) {
            values.push(action);
        }
    }
    values
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

async fn collect_database_checks(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    checks: &mut Vec<DiagnosticCheck>,
) -> Result<(), String> {
    let status = state.status();
    let started = Instant::now();
    checks.push(match status.as_ref() {
        Some(status) if status.opened => make_check(
            "database.opened",
            "database",
            "passed",
            "Banco SQLCipher aberto",
            "A sessão criptografada está disponível para consultas locais.",
            None,
            started,
        ),
        _ => make_check(
            "database.opened",
            "database",
            "failed",
            "Banco SQLCipher indisponível",
            "O banco criptografado não está aberto nesta sessão.",
            None,
            started,
        ),
    });

    let started = Instant::now();
    checks.push(match status.as_ref() {
        Some(status) if status.encrypted && !status.cipher_version.trim().is_empty() => make_check(
            "database.encryption",
            "database",
            "passed",
            "Criptografia confirmada",
            format!("SQLCipher {} ativo.", status.cipher_version),
            None,
            started,
        ),
        _ => make_check(
            "database.encryption",
            "database",
            "failed",
            "Criptografia não confirmada",
            "A sessão não confirmou uma biblioteca SQLCipher válida.",
            None,
            started,
        ),
    });

    let access = state.access_status();
    let started = Instant::now();
    checks.push(if access.read_only {
        make_check(
            "database.access",
            "database",
            "attention",
            "Modo somente leitura ativo",
            access
                .reason
                .unwrap_or_else(|| "O banco está protegido contra alterações.".to_string()),
            None,
            started,
        )
    } else {
        make_check(
            "database.access",
            "database",
            "passed",
            "Banco liberado para escrita",
            "Nenhum bloqueio de integridade está ativo.",
            None,
            started,
        )
    });

    let mut connection = connect_app_database(app, state).await?;
    let started = Instant::now();
    let schema = sqlx::query_scalar::<_, i64>("PRAGMA user_version")
        .fetch_one(&mut connection)
        .await
        .map_err(to_error)?;
    checks.push(if schema == CURRENT_SCHEMA_VERSION {
        make_check(
            "database.schema",
            "database",
            "passed",
            "Schema atualizado",
            format!("Schema {schema} reconhecido pela versão atual."),
            None,
            started,
        )
    } else {
        make_check(
            "database.schema",
            "database",
            "failed",
            "Schema incompatível",
            format!("O banco está no schema {schema}; o aplicativo exige {CURRENT_SCHEMA_VERSION}."),
            None,
            started,
        )
    });

    let started = Instant::now();
    let quick_check = sqlx::query_scalar::<_, String>("PRAGMA quick_check")
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
    let foreign_keys = sqlx::query("PRAGMA foreign_key_check")
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
    let integrity_ok = quick_check.iter().all(|value| value.eq_ignore_ascii_case("ok"))
        && foreign_keys.is_empty();
    checks.push(if integrity_ok {
        make_check(
            "database.integrity",
            "database",
            "passed",
            "Integridade estrutural aprovada",
            "Quick check e chaves estrangeiras não encontraram inconsistências.",
            None,
            started,
        )
    } else {
        make_check(
            "database.integrity",
            "database",
            "failed",
            "Integridade estrutural comprometida",
            format!(
                "Quick check retornou {} mensagem(ns) e {} violação(ões) de chave estrangeira.",
                quick_check.len(),
                foreign_keys.len()
            ),
            None,
            started,
        )
    });

    let started = Instant::now();
    let required = [
        "users",
        "workspaces",
        "finance_documents",
        "backup_history",
        "continuity_recovery_points",
        "background_task_queue",
        "diagnostic_runs",
        "diagnostic_checks",
        "diagnostic_repairs",
        "support_package_exports",
    ];
    let mut missing = Vec::new();
    for table in required {
        if !table_exists(&mut connection, table).await? {
            missing.push(table);
        }
    }
    checks.push(if missing.is_empty() {
        make_check(
            "database.required_tables",
            "database",
            "passed",
            "Tabelas essenciais presentes",
            "Os módulos críticos e as tabelas de diagnóstico foram localizados.",
            None,
            started,
        )
    } else {
        make_check(
            "database.required_tables",
            "database",
            "failed",
            "Tabelas essenciais ausentes",
            format!("Ausentes: {}.", missing.join(", ")),
            None,
            started,
        )
    });

    connection.close().await.map_err(to_error)?;
    Ok(())
}

fn probe_directory(path: &Path, write_probe: bool) -> Result<(), String> {
    fs::create_dir_all(path).map_err(to_error)?;
    if !path.is_dir() {
        return Err("O caminho não é um diretório.".to_string());
    }
    if write_probe {
        let probe = path.join(format!(".fux-diagnostic-{}.tmp", Uuid::new_v4()));
        fs::write(&probe, b"diagnostic-probe").map_err(to_error)?;
        fs::remove_file(probe).map_err(to_error)?;
    }
    Ok(())
}

fn collect_file_checks(app: &AppHandle, checks: &mut Vec<DiagnosticCheck>) -> Result<(), String> {
    let config = app.path().app_config_dir().map_err(to_error)?;
    let local = app.path().app_local_data_dir().map_err(to_error)?;
    let logs = app.path().app_log_dir().map_err(to_error)?;
    let backups = config.join("backups");

    for (code, title, path) in [
        ("files.config", "Pasta de configuração", config.as_path()),
        ("files.local", "Pasta de dados locais", local.as_path()),
        ("files.backups", "Pasta de backups", backups.as_path()),
        ("files.logs", "Pasta de logs", logs.as_path()),
    ] {
        let started = Instant::now();
        checks.push(match probe_directory(path, true) {
            Ok(()) => make_check(
                code,
                "files",
                "passed",
                title,
                "Diretório acessível para leitura e escrita técnica.",
                None,
                started,
            ),
            Err(error) => make_check(
                code,
                "files",
                "failed",
                title,
                format!("O diretório não passou no teste reversível: {error}"),
                None,
                started,
            ),
        });
    }

    let started = Instant::now();
    let free = available_space(&config).unwrap_or(0);
    let (status, detail) = if free >= HEALTHY_FREE_DISK_BYTES {
        ("passed", format!("{} MB livres na unidade de dados.", free / 1024 / 1024))
    } else if free >= MIN_FREE_DISK_BYTES {
        ("attention", format!("Apenas {} MB livres; libere espaço antes de grandes importações.", free / 1024 / 1024))
    } else {
        ("failed", format!("Apenas {} MB livres; backups e atualizações podem falhar.", free / 1024 / 1024))
    };
    checks.push(make_check(
        "files.free_space",
        "files",
        status,
        "Espaço disponível",
        detail,
        None,
        started,
    ));

    let started = Instant::now();
    let mut log_files = 0_u64;
    let mut log_bytes = 0_u64;
    if let Ok(entries) = fs::read_dir(&logs) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    log_files += 1;
                    log_bytes = log_bytes.saturating_add(metadata.len());
                }
            }
        }
    }
    let large = log_bytes > 25 * 1024 * 1024;
    checks.push(make_check(
        "privacy.log_retention",
        "privacy",
        if large { "attention" } else { "passed" },
        "Retenção de logs técnicos",
        format!("{log_files} arquivo(s), {} MB no total.", log_bytes / 1024 / 1024),
        if large { Some("clear_old_logs") } else { None },
        started,
    ));

    Ok(())
}

async fn collect_security_checks(
    app: &AppHandle,
    context: &ClientDiagnosticContext,
    checks: &mut Vec<DiagnosticCheck>,
) -> Result<(), String> {
    let local = app.path().app_local_data_dir().map_err(to_error)?;
    let salt = local.join("stronghold-salt.bin");
    let vault = local.join("finnacialux-security.hold");

    let started = Instant::now();
    let files_ready = salt.exists() && vault.exists();
    let keys_ready = context.stronghold_ready
        && context.backup_key_available
        && context.database_key_available;
    checks.push(if files_ready && keys_ready {
        make_check(
            "security.stronghold",
            "security",
            "passed",
            "Stronghold disponível",
            "Cofre, salt e chaves técnicas foram reconhecidos sem exportar qualquer segredo.",
            None,
            started,
        )
    } else if files_ready || context.stronghold_ready {
        make_check(
            "security.stronghold",
            "security",
            "attention",
            "Stronghold parcialmente disponível",
            "O cofre existe, mas uma das chaves técnicas ainda não foi confirmada nesta sessão.",
            None,
            started,
        )
    } else {
        make_check(
            "security.stronghold",
            "security",
            "failed",
            "Stronghold indisponível",
            "O cofre local ou seu arquivo de salt não pôde ser confirmado.",
            None,
            started,
        )
    });
    Ok(())
}

async fn collect_backup_checks(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    checks: &mut Vec<DiagnosticCheck>,
) -> Result<(), String> {
    let mut connection = connect_app_database(app, state).await?;
    let rows = sqlx::query(
        "SELECT file_path, created_at, status, integrity_status FROM backup_history WHERE kind != 'recovery_point' ORDER BY created_at DESC",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    let started = Instant::now();
    let mut missing = 0_usize;
    let mut failed = 0_usize;
    let latest = rows
        .first()
        .and_then(|row| row.try_get::<String, _>("created_at").ok());
    for row in &rows {
        let path = row.try_get::<String, _>("file_path").unwrap_or_default();
        let status = row.try_get::<String, _>("status").unwrap_or_default();
        let integrity = row.try_get::<String, _>("integrity_status").unwrap_or_default();
        if !Path::new(&path).exists() || status == "missing" {
            missing += 1;
        }
        if status == "failed" || integrity == "failed" {
            failed += 1;
        }
    }
    let age = days_since(latest.as_deref());
    let (status, detail, repair) = if failed > 0 {
        (
            "failed",
            format!("{failed} backup(s) falharam e {missing} arquivo(s) estão ausentes."),
            Some("refresh_file_health"),
        )
    } else if rows.is_empty() {
        (
            "attention",
            "Nenhum backup manual ou automático foi registrado.".to_string(),
            None,
        )
    } else if missing > 0 || age.unwrap_or(999) > 14 {
        (
            "attention",
            format!("{} backup(s) registrados, {missing} ausente(s), último há {} dia(s).", rows.len(), age.unwrap_or(0)),
            Some("refresh_file_health"),
        )
    } else {
        (
            "passed",
            format!("{} backup(s) registrados; último há {} dia(s).", rows.len(), age.unwrap_or(0)),
            None,
        )
    };
    checks.push(make_check(
        "backups.history",
        "backups",
        status,
        "Saúde dos backups",
        detail,
        repair,
        started,
    ));

    let rows = sqlx::query(
        "SELECT file_path, created_at, status, verified_at FROM continuity_recovery_points ORDER BY created_at DESC",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    let started = Instant::now();
    let mut missing = 0_usize;
    let mut verified = 0_usize;
    let latest = rows
        .first()
        .and_then(|row| row.try_get::<String, _>("created_at").ok());
    for row in &rows {
        let path = row.try_get::<String, _>("file_path").unwrap_or_default();
        let status = row.try_get::<String, _>("status").unwrap_or_default();
        let verified_at = row.try_get::<Option<String>, _>("verified_at").unwrap_or(None);
        if !Path::new(&path).exists() || status == "missing" {
            missing += 1;
        }
        if verified_at.is_some() {
            verified += 1;
        }
    }
    let age = days_since(latest.as_deref());
    let (status, detail, repair) = if rows.is_empty() {
        (
            "attention",
            "Nenhum ponto de recuperação foi criado ainda.".to_string(),
            None,
        )
    } else if missing > 0 || verified == 0 || age.unwrap_or(999) > 14 {
        (
            "attention",
            format!("{} ponto(s), {verified} verificado(s), {missing} ausente(s).", rows.len()),
            Some("refresh_file_health"),
        )
    } else {
        (
            "passed",
            format!("{} ponto(s) disponíveis e {verified} verificado(s).", rows.len()),
            None,
        )
    };
    checks.push(make_check(
        "continuity.recovery_points",
        "continuity",
        status,
        "Pontos de recuperação",
        detail,
        repair,
        started,
    ));

    connection.close().await.map_err(to_error)?;
    Ok(())
}

async fn collect_scheduler_checks(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    checks: &mut Vec<DiagnosticCheck>,
) -> Result<(), String> {
    let mut connection = connect_app_database(app, state).await?;
    let started = Instant::now();
    let stale_tasks = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM background_task_queue WHERE status = 'running' AND datetime(updated_at) < datetime('now', '-30 minutes')",
    )
    .fetch_one(&mut connection)
    .await
    .unwrap_or(0);
    let expired_leases = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM background_scheduler_leases WHERE datetime(expires_at) < datetime('now')",
    )
    .fetch_one(&mut connection)
    .await
    .unwrap_or(0);
    checks.push(if stale_tasks == 0 && expired_leases == 0 {
        make_check(
            "scheduler.leases",
            "scheduler",
            "passed",
            "Fila e leases saudáveis",
            "Nenhuma rotina travada ou lease expirado foi encontrado.",
            None,
            started,
        )
    } else {
        make_check(
            "scheduler.leases",
            "scheduler",
            "attention",
            "Rotinas locais pendentes de liberação",
            format!("{stale_tasks} tarefa(s) travada(s) e {expired_leases} lease(s) expirado(s)."),
            Some("release_stale_tasks"),
            started,
        )
    });
    connection.close().await.map_err(to_error)?;
    Ok(())
}

fn collect_update_checks(context: &ClientDiagnosticContext, checks: &mut Vec<DiagnosticCheck>) {
    let started = Instant::now();
    checks.push(if context.updater_configured && !context.development_build {
        make_check(
            "updates.channel",
            "updates",
            "passed",
            "Canal de atualizações configurado",
            format!("Endpoint assinado em {}.", context.updater_endpoint_host),
            None,
            started,
        )
    } else if context.updater_configured {
        make_check(
            "updates.channel",
            "updates",
            "attention",
            "Atualizador em modo de desenvolvimento",
            "O canal existe, mas a verificação real ocorre somente no aplicativo instalado.",
            None,
            started,
        )
    } else {
        make_check(
            "updates.channel",
            "updates",
            "attention",
            "Canal de atualizações não configurado",
            "Configure a chave pública e o endpoint antes da distribuição estável.",
            None,
            started,
        )
    });
}

async fn collect_read_write_check(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    checks: &mut Vec<DiagnosticCheck>,
) -> Result<(), String> {
    let started = Instant::now();
    if state.access_status().read_only {
        checks.push(make_check(
            "database.read_write_probe",
            "database",
            "skipped",
            "Teste reversível de escrita ignorado",
            "O modo somente leitura está ativo; nenhuma gravação de diagnóstico foi tentada.",
            None,
            started,
        ));
        return Ok(());
    }

    let mut connection = connect_app_database(app, state).await?;
    let mut transaction = connection.begin().await.map_err(to_error)?;
    let probe = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO diagnostic_probe (id, probe_value, updated_at) VALUES (1, $1, $2) ON CONFLICT(id) DO UPDATE SET probe_value = excluded.probe_value, updated_at = excluded.updated_at",
    )
    .bind(&probe)
    .bind(Utc::now().to_rfc3339())
    .execute(&mut *transaction)
    .await
    .map_err(to_error)?;
    let read_back = sqlx::query_scalar::<_, String>(
        "SELECT probe_value FROM diagnostic_probe WHERE id = 1",
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(to_error)?;
    transaction.rollback().await.map_err(to_error)?;
    connection.close().await.map_err(to_error)?;

    checks.push(if read_back == probe {
        make_check(
            "database.read_write_probe",
            "database",
            "passed",
            "Leitura e escrita reversíveis",
            "A transação técnica foi lida e revertida sem alterar dados financeiros.",
            None,
            started,
        )
    } else {
        make_check(
            "database.read_write_probe",
            "database",
            "failed",
            "Teste reversível inconsistente",
            "O valor lido não correspondeu ao probe técnico.",
            None,
            started,
        )
    });
    Ok(())
}

async fn collect_restore_drill_check(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    checks: &mut Vec<DiagnosticCheck>,
) -> Result<(), String> {
    let started = Instant::now();
    if state.access_status().read_only {
        checks.push(make_check(
            "continuity.restore_drill",
            "continuity",
            "skipped",
            "Ensaio de restauração ignorado",
            "O modo somente leitura está ativo; nenhum checkpoint ou snapshot técnico foi criado.",
            None,
            started,
        ));
        return Ok(());
    }
    let temporary = TempDir::new().map_err(to_error)?;
    let snapshot = temporary.path().join("diagnostic-restore-drill.sqlite");
    let result = async {
        export_plaintext_snapshot(app, state, &snapshot).await?;
        let mut connection = connect_plaintext_path(&snapshot, false).await?;
        let schema = sqlx::query_scalar::<_, i64>("PRAGMA user_version")
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let quick = sqlx::query_scalar::<_, String>("PRAGMA quick_check")
            .fetch_all(&mut connection)
            .await
            .map_err(to_error)?;
        let documents = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM finance_documents")
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        if schema != CURRENT_SCHEMA_VERSION || !quick.iter().all(|value| value == "ok") {
            return Err("O snapshot temporário não preservou schema e integridade.".to_string());
        }
        Ok(documents)
    }
    .await;

    checks.push(match result {
        Ok(documents) => make_check(
            "continuity.restore_drill",
            "continuity",
            "passed",
            "Ensaio de restauração aprovado",
            format!("Snapshot temporário íntegro com {documents} módulo(s); nenhum dado real foi substituído."),
            None,
            started,
        ),
        Err(error) => make_check(
            "continuity.restore_drill",
            "continuity",
            "failed",
            "Ensaio de restauração falhou",
            format!("O snapshot temporário não pôde ser validado: {error}"),
            None,
            started,
        ),
    });
    Ok(())
}

async fn collect_checks(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    context: &ClientDiagnosticContext,
    include_read_write: bool,
    include_restore_drill: bool,
) -> Result<Vec<DiagnosticCheck>, String> {
    let mut checks = Vec::new();
    collect_database_checks(app, state, &mut checks).await?;
    collect_file_checks(app, &mut checks)?;
    collect_security_checks(app, context, &mut checks).await?;
    collect_backup_checks(app, state, &mut checks).await?;
    collect_scheduler_checks(app, state, &mut checks).await?;
    collect_update_checks(context, &mut checks);
    if include_read_write {
        collect_read_write_check(app, state, &mut checks).await?;
    }
    if include_restore_drill {
        collect_restore_drill_check(app, state, &mut checks).await?;
    }
    Ok(checks)
}

fn build_suite(
    id: String,
    checks: Vec<DiagnosticCheck>,
    read_only: bool,
    persisted: bool,
    started_at: String,
    completed_at: String,
) -> DiagnosticSuiteResult {
    let passed = checks.iter().filter(|check| check.status == "passed").count() as i64;
    let attention = checks.iter().filter(|check| check.status == "attention").count() as i64;
    let failed = checks.iter().filter(|check| check.status == "failed").count() as i64;
    DiagnosticSuiteResult {
        id,
        status: suite_status(failed, attention),
        score: calculate_score(&checks),
        checks_total: checks.len() as i64,
        checks_passed: passed,
        checks_attention: attention,
        checks_failed: failed,
        available_repairs: unique_repairs(&checks),
        checks,
        read_only,
        persisted,
        started_at,
        completed_at,
    }
}

async fn persist_suite(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    workspace_id: &str,
    run_kind: &str,
    suite: &DiagnosticSuiteResult,
) -> Result<(), String> {
    let mut connection = connect_app_database(app, state).await?;
    let mut transaction = connection.begin().await.map_err(to_error)?;
    sqlx::query(
        r#"INSERT INTO diagnostic_runs (
             id, workspace_id, run_kind, status, app_version, schema_version, score,
             checks_total, checks_passed, checks_attention, checks_failed, summary_json,
             started_at, completed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)"#,
    )
    .bind(&suite.id)
    .bind(workspace_id)
    .bind(run_kind)
    .bind(&suite.status)
    .bind(app.package_info().version.to_string())
    .bind(CURRENT_SCHEMA_VERSION)
    .bind(suite.score)
    .bind(suite.checks_total)
    .bind(suite.checks_passed)
    .bind(suite.checks_attention)
    .bind(suite.checks_failed)
    .bind(
        json!({
            "availableRepairs": &suite.available_repairs,
            "readOnly": suite.read_only
        })
        .to_string(),
    )
    .bind(&suite.started_at)
    .bind(&suite.completed_at)
    .execute(&mut *transaction)
    .await
    .map_err(to_error)?;

    for check in &suite.checks {
        sqlx::query(
            r#"INSERT INTO diagnostic_checks (
                 id, run_id, check_code, category, status, title, detail,
                 repair_action, duration_ms, created_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&suite.id)
        .bind(&check.code)
        .bind(&check.category)
        .bind(&check.status)
        .bind(&check.title)
        .bind(&check.detail)
        .bind(&check.repair_action)
        .bind(check.duration_ms)
        .bind(&suite.completed_at)
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
    }

    sqlx::query(
        r#"INSERT INTO diagnostic_preferences (
             workspace_id, include_sanitized_logs, run_restore_drill, history_retention,
             last_full_run_at, updated_at
           ) VALUES ($1, 1, 1, 25, $2, $2)
           ON CONFLICT(workspace_id) DO UPDATE SET
             last_full_run_at = excluded.last_full_run_at,
             updated_at = excluded.updated_at"#,
    )
    .bind(workspace_id)
    .bind(&suite.completed_at)
    .execute(&mut *transaction)
    .await
    .map_err(to_error)?;

    let retention = sqlx::query_scalar::<_, i64>(
        "SELECT history_retention FROM diagnostic_preferences WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(&mut *transaction)
    .await
    .unwrap_or(25)
    .clamp(5, 100);
    sqlx::query(
        r#"DELETE FROM diagnostic_runs
            WHERE workspace_id = $1
              AND id NOT IN (
                SELECT id FROM diagnostic_runs
                 WHERE workspace_id = $1
                 ORDER BY started_at DESC
                 LIMIT $2
              )"#,
    )
    .bind(workspace_id)
    .bind(retention)
    .execute(&mut *transaction)
    .await
    .map_err(to_error)?;

    transaction.commit().await.map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(())
}

async fn run_suite_internal(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    request: RunDiagnosticSuiteRequest,
    persist: bool,
) -> Result<DiagnosticSuiteResult, String> {
    let started_at = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let checks = collect_checks(
        app,
        state,
        &request.client_context,
        request.include_read_write_test,
        request.include_restore_drill,
    )
    .await?;
    let completed_at = Utc::now().to_rfc3339();
    let read_only = state.access_status().read_only;
    let should_persist = persist && !read_only;
    let suite = build_suite(
        id,
        checks,
        read_only,
        should_persist,
        started_at,
        completed_at,
    );
    if should_persist {
        persist_suite(app, state, &request.workspace_id, "full", &suite).await?;
    }
    Ok(suite)
}

#[tauri::command(async)]
pub fn diagnostics_preview(
    app: AppHandle,
    request: RunDiagnosticSuiteRequest,
) -> Result<DiagnosticSuiteResult, String> {
    run_local_async_worker("finnacialux-diagnostics-preview", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        run_suite_internal(&app, &state, request, false).await
    })
}

#[tauri::command(async)]
pub fn diagnostics_run_suite(
    app: AppHandle,
    request: RunDiagnosticSuiteRequest,
) -> Result<DiagnosticSuiteResult, String> {
    run_local_async_worker("finnacialux-diagnostics-suite", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        run_suite_internal(&app, &state, request, true).await
    })
}

#[tauri::command(async)]
pub fn diagnostics_list_runs(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<DiagnosticRunSummary>, String> {
    run_local_async_worker("finnacialux-diagnostics-list-runs", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query(
            r#"SELECT id, run_kind, status, score, checks_total, checks_passed,
                      checks_attention, checks_failed, started_at, completed_at
                 FROM diagnostic_runs
                WHERE workspace_id = $1
             ORDER BY started_at DESC
                LIMIT $2"#,
        )
        .bind(workspace_id)
        .bind(limit.unwrap_or(25).clamp(1, 100))
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        let values = rows
            .into_iter()
            .map(|row| DiagnosticRunSummary {
                id: row.try_get("id").unwrap_or_default(),
                run_kind: row.try_get("run_kind").unwrap_or_default(),
                status: row.try_get("status").unwrap_or_default(),
                score: row.try_get("score").unwrap_or_default(),
                checks_total: row.try_get("checks_total").unwrap_or_default(),
                checks_passed: row.try_get("checks_passed").unwrap_or_default(),
                checks_attention: row.try_get("checks_attention").unwrap_or_default(),
                checks_failed: row.try_get("checks_failed").unwrap_or_default(),
                started_at: row.try_get("started_at").unwrap_or_default(),
                completed_at: row.try_get("completed_at").unwrap_or(None),
            })
            .collect();
        connection.close().await.map_err(to_error)?;
        Ok(values)
    })
}

#[tauri::command(async)]
pub fn diagnostics_list_repairs(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<DiagnosticRepairRecord>, String> {
    run_local_async_worker("finnacialux-diagnostics-list-repairs", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query(
            r#"SELECT id, action_kind, status, result_summary, started_at, completed_at
                 FROM diagnostic_repairs
                WHERE workspace_id = $1
             ORDER BY started_at DESC
                LIMIT $2"#,
        )
        .bind(workspace_id)
        .bind(limit.unwrap_or(25).clamp(1, 100))
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        let values = rows
            .into_iter()
            .map(|row| DiagnosticRepairRecord {
                id: row.try_get("id").unwrap_or_default(),
                action_kind: row.try_get("action_kind").unwrap_or_default(),
                status: row.try_get("status").unwrap_or_default(),
                result_summary: row.try_get("result_summary").unwrap_or_default(),
                started_at: row.try_get("started_at").unwrap_or_default(),
                completed_at: row.try_get("completed_at").unwrap_or(None),
            })
            .collect();
        connection.close().await.map_err(to_error)?;
        Ok(values)
    })
}

async fn optimize_database(connection: &mut SqliteConnection) -> Result<String, String> {
    sqlx::raw_sql("PRAGMA wal_checkpoint(PASSIVE);")
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    sqlx::raw_sql("ANALYZE;")
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    sqlx::raw_sql("PRAGMA optimize;")
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    Ok("Checkpoint, ANALYZE e optimize concluídos.".to_string())
}

async fn release_stale_tasks(connection: &mut SqliteConnection) -> Result<String, String> {
    let now = Utc::now().to_rfc3339();
    let tasks = sqlx::query(
        r#"UPDATE background_task_queue
              SET status = 'failed',
                  error_code = 'diagnostic_stale_release',
                  error_message = 'Tarefa liberada pelo diagnóstico após exceder o lease.',
                  completed_at = $1,
                  updated_at = $1
            WHERE status = 'running'
              AND datetime(updated_at) < datetime('now', '-30 minutes')"#,
    )
    .bind(&now)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?
    .rows_affected();
    let leases = sqlx::query(
        "DELETE FROM background_scheduler_leases WHERE datetime(expires_at) < datetime('now')",
    )
    .execute(&mut *connection)
    .await
    .map_err(to_error)?
    .rows_affected();
    Ok(format!("{tasks} tarefa(s) e {leases} lease(s) expirado(s) foram liberados."))
}

async fn refresh_file_health(connection: &mut SqliteConnection) -> Result<String, String> {
    let backup_rows = sqlx::query("SELECT id, file_path FROM backup_history")
        .fetch_all(&mut *connection)
        .await
        .map_err(to_error)?;
    let recovery_rows = sqlx::query("SELECT id, file_path FROM continuity_recovery_points")
        .fetch_all(&mut *connection)
        .await
        .map_err(to_error)?;
    let mut updated = 0_u64;
    for row in backup_rows {
        let id: String = row.try_get("id").map_err(to_error)?;
        let path: String = row.try_get("file_path").map_err(to_error)?;
        let status = if Path::new(&path).exists() { "available" } else { "missing" };
        updated += sqlx::query("UPDATE backup_history SET status = $1 WHERE id = $2 AND status IN ('available', 'missing') AND status != $1")
            .bind(status)
            .bind(id)
            .execute(&mut *connection)
            .await
            .map_err(to_error)?
            .rows_affected();
    }
    for row in recovery_rows {
        let id: String = row.try_get("id").map_err(to_error)?;
        let path: String = row.try_get("file_path").map_err(to_error)?;
        let status = if Path::new(&path).exists() { "available" } else { "missing" };
        updated += sqlx::query(
            "UPDATE continuity_recovery_points SET status = $1 WHERE id = $2 AND status IN ('available', 'missing') AND status != $1",
        )
        .bind(status)
        .bind(id)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?
        .rows_affected();
    }
    Ok(format!("{updated} registro(s) de arquivo tiveram o estado atualizado."))
}

fn clear_old_logs(app: &AppHandle) -> Result<String, String> {
    let logs = app.path().app_log_dir().map_err(to_error)?;
    let threshold = SystemTime::now()
        .checked_sub(StdDuration::from_secs(30 * 24 * 60 * 60))
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let mut removed = 0_u64;
    let mut bytes = 0_u64;
    for entry in fs::read_dir(logs).map_err(to_error)?.flatten() {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(value) if value.is_file() => value,
            _ => continue,
        };
        if metadata.modified().unwrap_or(SystemTime::now()) < threshold {
            bytes = bytes.saturating_add(metadata.len());
            if fs::remove_file(path).is_ok() {
                removed += 1;
            }
        }
    }
    Ok(format!("{removed} log(s) antigos removidos; {} KB liberados.", bytes / 1024))
}

#[tauri::command(async)]
pub fn diagnostics_apply_repair(
    app: AppHandle,
    request: ApplyDiagnosticRepairRequest,
) -> Result<DiagnosticRepairRecord, String> {
    run_local_async_worker("finnacialux-diagnostics-repair", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let action = request.action_kind.as_str();
        if ![
            "optimize_database",
            "release_stale_tasks",
            "refresh_file_health",
            "clear_old_logs",
        ]
        .contains(&action)
        {
            return Err("Ação de reparo não reconhecida.".to_string());
        }
        let id = Uuid::new_v4().to_string();
        let started_at = Utc::now().to_rfc3339();
        let mut connection = connect_app_database(&app, &state).await?;
        sqlx::query(
            r#"INSERT INTO diagnostic_repairs (
                 id, workspace_id, run_id, action_kind, status, result_summary, started_at
               ) VALUES ($1, $2, $3, $4, 'running', 'Reparo iniciado.', $5)"#,
        )
        .bind(&id)
        .bind(&request.workspace_id)
        .bind(request.run_id.as_deref())
        .bind(action)
        .bind(&started_at)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;

        let result = match action {
            "optimize_database" => optimize_database(&mut connection).await,
            "release_stale_tasks" => release_stale_tasks(&mut connection).await,
            "refresh_file_health" => refresh_file_health(&mut connection).await,
            "clear_old_logs" => clear_old_logs(&app),
            _ => unreachable!(),
        };
        let completed_at = Utc::now().to_rfc3339();
        let (status, summary) = match result {
            Ok(summary) => ("succeeded", summary),
            Err(error) => ("failed", format!("O reparo não foi concluído: {error}")),
        };
        sqlx::query(
            "UPDATE diagnostic_repairs SET status = $1, result_summary = $2, completed_at = $3 WHERE id = $4",
        )
        .bind(status)
        .bind(&summary)
        .bind(&completed_at)
        .bind(&id)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        if status == "failed" {
            return Err(summary);
        }
        Ok(DiagnosticRepairRecord {
            id,
            action_kind: action.to_string(),
            status: status.to_string(),
            result_summary: summary,
            started_at,
            completed_at: Some(completed_at),
        })
    })
}

fn looks_like_path(token: &str) -> bool {
    let normalized = token.trim_matches(|character: char| {
        matches!(character, '"' | '\'' | '(' | ')' | '[' | ']' | ',' | ';')
    });
    normalized.contains(":\\")
        || normalized.starts_with("/home/")
        || normalized.starts_with("/Users/")
        || normalized.starts_with("/mnt/")
        || normalized.starts_with("\\\\")
}

fn looks_like_email(token: &str) -> bool {
    let trimmed = token.trim_matches(|character: char| !character.is_ascii_alphanumeric() && character != '@' && character != '.' && character != '_' && character != '-');
    let mut parts = trimmed.split('@');
    matches!((parts.next(), parts.next(), parts.next()), (Some(left), Some(right), None) if !left.is_empty() && right.contains('.'))
}

fn looks_like_secret(token: &str) -> bool {
    let trimmed = token.trim_matches(|character: char| !character.is_ascii_alphanumeric());
    trimmed.len() >= 40 && trimmed.chars().all(|character| character.is_ascii_hexdigit())
}

pub(crate) fn sanitize_log_line(line: &str) -> String {
    line.split_whitespace()
        .map(|token| {
            if looks_like_path(token) {
                "<path>".to_string()
            } else if looks_like_email(token) {
                "<email>".to_string()
            } else if looks_like_secret(token) {
                "<token>".to_string()
            } else {
                token.chars().take(240).collect::<String>()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(500)
        .collect()
}

fn read_sanitized_logs(directory: &Path) -> Vec<String> {
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
            lines.extend(
                content
                    .lines()
                    .rev()
                    .take(120)
                    .map(sanitize_log_line),
            );
        }
        if lines.len() >= 250 {
            break;
        }
    }
    lines.truncate(250);
    lines.reverse();
    lines
}

async fn migration_summary(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
) -> Result<Vec<Value>, String> {
    let mut connection = connect_app_database(app, state).await?;
    let rows = sqlx::query(
        "SELECT version, description, applied_at FROM app_schema_history ORDER BY version DESC",
    )
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    let values = rows
        .into_iter()
        .map(|row| {
            json!({
                "version": row.try_get::<i64, _>("version").unwrap_or_default(),
                "description": row.try_get::<String, _>("description").unwrap_or_default(),
                "appliedAt": row.try_get::<String, _>("applied_at").unwrap_or_default(),
            })
        })
        .collect();
    connection.close().await.map_err(to_error)?;
    Ok(values)
}

async fn recent_runs_json(
    app: &AppHandle,
    state: &EncryptedDatabaseState,
    workspace_id: &str,
) -> Result<Vec<Value>, String> {
    let mut connection = connect_app_database(app, state).await?;
    let rows = sqlx::query(
        r#"SELECT run_kind, status, score, checks_total, checks_failed, started_at, completed_at
             FROM diagnostic_runs
            WHERE workspace_id = $1
         ORDER BY started_at DESC
            LIMIT 10"#,
    )
    .bind(workspace_id)
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    let values = rows
        .into_iter()
        .map(|row| {
            json!({
                "runKind": row.try_get::<String, _>("run_kind").unwrap_or_default(),
                "status": row.try_get::<String, _>("status").unwrap_or_default(),
                "score": row.try_get::<i64, _>("score").unwrap_or_default(),
                "checksTotal": row.try_get::<i64, _>("checks_total").unwrap_or_default(),
                "checksFailed": row.try_get::<i64, _>("checks_failed").unwrap_or_default(),
                "startedAt": row.try_get::<String, _>("started_at").unwrap_or_default(),
                "completedAt": row.try_get::<Option<String>, _>("completed_at").unwrap_or(None),
            })
        })
        .collect();
    connection.close().await.map_err(to_error)?;
    Ok(values)
}

#[tauri::command(async)]
pub fn diagnostics_export_support_package(
    app: AppHandle,
    request: ExportSupportPackageRequest,
) -> Result<SupportPackageResult, String> {
    run_local_async_worker("finnacialux-diagnostics-export-support", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let destination = ensure_extension(PathBuf::from(&request.destination), SUPPORT_EXTENSION);
        let suite_request = RunDiagnosticSuiteRequest {
            workspace_id: request.workspace_id.clone(),
            include_read_write_test: false,
            include_restore_drill: false,
            client_context: request.client_context.clone(),
        };
        let suite = run_suite_internal(&app, &state, suite_request, false).await?;
        let logs_directory = app.path().app_log_dir().map_err(to_error)?;
        let checks_count = suite.checks.len();
        let payload = json!({
            "privacy": "Sem senhas, chaves, saldos, descrições financeiras ou conteúdo dos documentos.",
            "generatedAt": Utc::now().to_rfc3339(),
            "application": {
                "name": app.package_info().name.clone(),
                "version": app.package_info().version.to_string(),
                "identifier": "com.ateliux.finnacialux.desktop",
                "operatingSystem": os_info::get().to_string(),
                "architecture": std::env::consts::ARCH,
                "schemaVersion": CURRENT_SCHEMA_VERSION,
                "safeMode": request.safe_mode,
                "readOnly": state.access_status().read_only,
            },
            "clientContext": {
                "strongholdReady": request.client_context.stronghold_ready,
                "backupKeyAvailable": request.client_context.backup_key_available,
                "databaseKeyAvailable": request.client_context.database_key_available,
                "updaterConfigured": request.client_context.updater_configured,
                "updaterEndpointHost": request.client_context.updater_endpoint_host.clone(),
                "developmentBuild": request.client_context.development_build,
            },
            "diagnostic": suite,
            "recentRuns": recent_runs_json(&app, &state, &request.workspace_id).await?,
            "migrations": migration_summary(&app, &state).await?,
            "recentSanitizedLogs": if request.include_sanitized_logs {
                read_sanitized_logs(&logs_directory)
            } else {
                Vec::<String>::new()
            },
        });
        let payload_bytes = serde_json::to_vec(&payload).map_err(to_error)?;
        let payload_sha256 = sha256_hex(&payload_bytes);
        let envelope = json!({
            "format": "finnacialux-support-package",
            "formatVersion": 2,
            "payloadSha256": payload_sha256.clone(),
            "payload": payload,
        });
        fs::write(
            &destination,
            serde_json::to_vec_pretty(&envelope).map_err(to_error)?,
        )
        .map_err(to_error)?;
        let package_size_bytes = fs::metadata(&destination).map_err(to_error)?.len();
        let created_at = Utc::now().to_rfc3339();
        if !state.access_status().read_only {
            let mut connection = connect_app_database(&app, &state).await?;
            sqlx::query(
                r#"INSERT INTO support_package_exports (
                     id, workspace_id, destination_file_name, payload_sha256,
                     package_size_bytes, checks_count, created_at
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&request.workspace_id)
            .bind(
                destination
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("FinnacialUX-suporte.fuxsupport"),
            )
            .bind(&payload_sha256)
            .bind(package_size_bytes as i64)
            .bind(checks_count as i64)
            .bind(&created_at)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
            connection.close().await.map_err(to_error)?;
        }
        log::info!(
            "support_package_exported checks={} size_bytes={}",
            checks_count,
            package_size_bytes
        );
        Ok(SupportPackageResult {
            file_path: destination.to_string_lossy().to_string(),
            file_name: destination
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("FinnacialUX-suporte.fuxsupport")
                .to_string(),
            payload_sha256,
            package_size_bytes,
            checks_count,
            created_at,
        })
    })
}

#[tauri::command(async)]
pub fn diagnostics_validate_support_package(
    source: String,
) -> Result<SupportPackageValidation, String> {
    run_local_async_worker("finnacialux-diagnostics-validate-support", move || async move {
        let bytes = fs::read(source).map_err(to_error)?;
        let envelope: Value = serde_json::from_slice(&bytes).map_err(to_error)?;
        let format = envelope
            .get("format")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let format_version = envelope
            .get("formatVersion")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        let stored = envelope
            .get("payloadSha256")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let payload = envelope
            .get("payload")
            .ok_or_else(|| "O pacote não contém payload técnico.".to_string())?;
        let calculated = sha256_hex(&serde_json::to_vec(payload).map_err(to_error)?);
        let checks_count = payload
            .get("diagnostic")
            .and_then(|value| value.get("checks"))
            .and_then(Value::as_array)
            .map(Vec::len)
            .unwrap_or(0);
        let generated_at = payload
            .get("generatedAt")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let valid = format == "finnacialux-support-package"
            && format_version == 2
            && !stored.is_empty()
            && stored == calculated;
        Ok(SupportPackageValidation {
            valid,
            format,
            format_version,
            payload_sha256: stored,
            checks_count,
            generated_at,
            message: if valid {
                "Pacote íntegro e compatível com o formato de suporte 2.".to_string()
            } else {
                "O pacote foi alterado, está incompleto ou usa um formato incompatível.".to_string()
            },
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostic_score_penalizes_failures_and_attention() {
        let now = Instant::now();
        let checks = vec![
            make_check("a", "database", "passed", "A", "ok", None, now),
            make_check("b", "files", "attention", "B", "attention", Some("clear_old_logs"), now),
            make_check("c", "security", "failed", "C", "failed", None, now),
        ];
        assert_eq!(calculate_score(&checks), 68);
        assert_eq!(unique_repairs(&checks), vec!["clear_old_logs".to_string()]);
        assert_eq!(suite_status(1, 1), "failed");
    }

    #[test]
    fn support_logs_remove_paths_emails_and_long_tokens() {
        let line = "error C:\\Users\\Lenon\\secret.db contato@empresa.com aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let sanitized = sanitize_log_line(line);
        assert!(sanitized.contains("<path>"));
        assert!(sanitized.contains("<email>"));
        assert!(sanitized.contains("<token>"));
        assert!(!sanitized.contains("secret.db"));
        assert!(!sanitized.contains("contato@empresa.com"));
    }
}
