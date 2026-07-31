use crate::{
    automations::simulate_automation_preview,
    command_worker::run_local_async_worker,
    encrypted_database::{connect_app_database, EncryptedDatabaseState},
};
use chrono::{Datelike, Duration, Local, NaiveDate, Timelike, Utc, Weekday};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Connection, Row, SqliteConnection};
use std::{
    collections::{HashMap, HashSet},
    sync::{Mutex, RwLock},
    time::Instant,
};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

#[cfg(test)]
const TASK_KINDS: [&str; 7] = [
    "automation_scan",
    "due_alerts",
    "financial_risk",
    "goals_budget",
    "monthly_closing",
    "backup_reminder",
    "weekly_summary",
];

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

#[derive(Default)]
pub struct BackgroundSchedulerState {
    active_workspaces: RwLock<HashSet<String>>,
    running_workspaces: Mutex<HashSet<String>>,
}

impl BackgroundSchedulerState {
    fn activate(&self, workspace_id: &str) -> Result<(), String> {
        self.active_workspaces
            .write()
            .map_err(|_| "O estado do agendador local está indisponível.".to_string())?
            .insert(workspace_id.to_string());
        Ok(())
    }

    fn deactivate(&self, workspace_id: &str) -> Result<(), String> {
        self.active_workspaces
            .write()
            .map_err(|_| "O estado do agendador local está indisponível.".to_string())?
            .remove(workspace_id);
        Ok(())
    }

    fn is_active(&self, workspace_id: &str) -> bool {
        self.active_workspaces
            .read()
            .map(|values| values.contains(workspace_id))
            .unwrap_or(false)
    }

    fn claim(&self, workspace_id: &str) -> Result<bool, String> {
        let mut running = self
            .running_workspaces
            .lock()
            .map_err(|_| "O controle de concorrência das rotinas está indisponível.".to_string())?;
        if running.contains(workspace_id) {
            return Ok(false);
        }
        running.insert(workspace_id.to_string());
        Ok(true)
    }

    fn release(&self, workspace_id: &str) {
        if let Ok(mut running) = self.running_workspaces.lock() {
            running.remove(workspace_id);
        }
    }

    fn is_running(&self, workspace_id: &str) -> bool {
        self.running_workspaces
            .lock()
            .map(|values| values.contains(workspace_id))
            .unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundTaskPreferences {
    pub workspace_id: String,
    pub enabled: bool,
    pub paused: bool,
    pub run_on_startup: bool,
    pub interval_minutes: i64,
    pub native_notifications: bool,
    pub quiet_hours_enabled: bool,
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
    pub automation_scan_enabled: bool,
    pub due_alerts_enabled: bool,
    pub financial_risk_enabled: bool,
    pub goals_budget_enabled: bool,
    pub monthly_closing_enabled: bool,
    pub backup_reminder_enabled: bool,
    pub weekly_summary_enabled: bool,
    pub retry_limit: i64,
    pub last_scheduler_tick_at: Option<String>,
    pub last_successful_run_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackgroundTaskPreferencesRequest {
    pub workspace_id: String,
    pub enabled: bool,
    pub paused: bool,
    pub run_on_startup: bool,
    pub interval_minutes: i64,
    pub native_notifications: bool,
    pub quiet_hours_enabled: bool,
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
    pub automation_scan_enabled: bool,
    pub due_alerts_enabled: bool,
    pub financial_risk_enabled: bool,
    pub goals_budget_enabled: bool,
    pub monthly_closing_enabled: bool,
    pub backup_reminder_enabled: bool,
    pub weekly_summary_enabled: bool,
    pub retry_limit: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundTask {
    pub id: String,
    pub workspace_id: String,
    pub task_kind: String,
    pub dedup_key: String,
    pub scheduled_for: String,
    pub next_attempt_at: String,
    pub status: String,
    pub priority: i64,
    pub attempts: i64,
    pub max_attempts: i64,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub result_summary: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundTaskRun {
    pub id: String,
    pub workspace_id: String,
    pub task_id: String,
    pub task_kind: String,
    pub attempt_number: i64,
    pub status: String,
    pub duration_ms: i64,
    pub result_summary: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub started_at: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundNotification {
    pub id: String,
    pub workspace_id: String,
    pub task_id: Option<String>,
    pub kind: String,
    pub fingerprint: String,
    pub title: String,
    pub body: String,
    pub severity: String,
    pub status: String,
    pub scheduled_for: String,
    pub dispatched_at: Option<String>,
    pub sent_at: Option<String>,
    pub failure_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundNotificationEvent {
    pub notification: BackgroundNotification,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundSchedulerStatus {
    pub workspace_id: String,
    pub active: bool,
    pub enabled: bool,
    pub paused: bool,
    pub read_only_blocked: bool,
    pub running: bool,
    pub interval_minutes: i64,
    pub pending_tasks: i64,
    pub failed_tasks: i64,
    pub pending_notifications: i64,
    pub last_scheduler_tick_at: Option<String>,
    pub last_successful_run_at: Option<String>,
    pub next_tick_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundRunResult {
    pub status: BackgroundSchedulerStatus,
    pub queued: i64,
    pub processed: i64,
    pub succeeded: i64,
    pub failed: i64,
    pub skipped: i64,
    pub notifications: Vec<BackgroundNotification>,
}

#[derive(Debug, Clone)]
struct TaskNotificationDraft {
    kind: String,
    fingerprint: String,
    title: String,
    body: String,
    severity: String,
}

fn validate_clock(value: &str) -> Result<String, String> {
    let parts = value.split(':').collect::<Vec<_>>();
    if parts.len() != 2 {
        return Err("Informe um horário no formato HH:mm.".to_string());
    }
    let hours = parts[0].parse::<u32>().map_err(to_error)?;
    let minutes = parts[1].parse::<u32>().map_err(to_error)?;
    if hours > 23 || minutes > 59 {
        return Err("O horário informado está fora do intervalo permitido.".to_string());
    }
    Ok(format!("{hours:02}:{minutes:02}"))
}

fn clock_minutes(value: &str) -> i64 {
    let mut parts = value.split(':');
    let hours = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(0);
    let minutes = parts.next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(0);
    hours * 60 + minutes
}

fn is_quiet_hours(preferences: &BackgroundTaskPreferences) -> bool {
    if !preferences.quiet_hours_enabled {
        return false;
    }
    let now = Local::now();
    let current = i64::from(now.hour()) * 60 + i64::from(now.minute());
    let start = clock_minutes(&preferences.quiet_hours_start);
    let end = clock_minutes(&preferences.quiet_hours_end);
    if start == end {
        return true;
    }
    if start < end {
        current >= start && current < end
    } else {
        current >= start || current < end
    }
}

fn retry_delay_minutes(attempt: i64) -> i64 {
    let exponent = attempt.clamp(1, 6) - 1;
    (5 * 2_i64.pow(exponent as u32)).min(240)
}

fn task_dedup_key(kind: &str, today: NaiveDate) -> String {
    match kind {
        "monthly_closing" => format!("{kind}:{}", today.format("%Y-%m")),
        "weekly_summary" => {
            let days = i64::from(today.weekday().num_days_from_monday());
            let monday = today - Duration::days(days);
            format!("{kind}:{}", monday.format("%Y-%m-%d"))
        }
        _ => format!("{kind}:{}", today.format("%Y-%m-%d")),
    }
}

fn bool_from_i64(value: Result<i64, sqlx::Error>, fallback: bool) -> bool {
    value.map(|value| value != 0).unwrap_or(fallback)
}

fn default_preferences(workspace_id: &str) -> BackgroundTaskPreferences {
    BackgroundTaskPreferences {
        workspace_id: workspace_id.to_string(),
        enabled: true,
        paused: false,
        run_on_startup: true,
        interval_minutes: 30,
        native_notifications: true,
        quiet_hours_enabled: true,
        quiet_hours_start: "22:00".to_string(),
        quiet_hours_end: "08:00".to_string(),
        automation_scan_enabled: true,
        due_alerts_enabled: true,
        financial_risk_enabled: true,
        goals_budget_enabled: true,
        monthly_closing_enabled: true,
        backup_reminder_enabled: true,
        weekly_summary_enabled: true,
        retry_limit: 3,
        last_scheduler_tick_at: None,
        last_successful_run_at: None,
        updated_at: Utc::now().to_rfc3339(),
    }
}

async fn workspace_exists(connection: &mut SqliteConnection, workspace_id: &str) -> Result<bool, String> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM workspaces WHERE id = $1")
        .bind(workspace_id)
        .fetch_one(&mut *connection)
        .await
        .map_err(to_error)?;
    Ok(count > 0)
}

async fn load_preferences(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<BackgroundTaskPreferences, String> {
    let row = sqlx::query("SELECT * FROM background_task_preferences WHERE workspace_id = $1 LIMIT 1")
        .bind(workspace_id)
        .fetch_optional(&mut *connection)
        .await
        .map_err(to_error)?;
    if let Some(row) = row {
        return Ok(BackgroundTaskPreferences {
            workspace_id: row.try_get("workspace_id").map_err(to_error)?,
            enabled: bool_from_i64(row.try_get("enabled"), true),
            paused: bool_from_i64(row.try_get("paused"), false),
            run_on_startup: bool_from_i64(row.try_get("run_on_startup"), true),
            interval_minutes: row.try_get::<i64, _>("interval_minutes").unwrap_or(30).clamp(15, 240),
            native_notifications: bool_from_i64(row.try_get("native_notifications"), true),
            quiet_hours_enabled: bool_from_i64(row.try_get("quiet_hours_enabled"), true),
            quiet_hours_start: row.try_get("quiet_hours_start").unwrap_or_else(|_| "22:00".to_string()),
            quiet_hours_end: row.try_get("quiet_hours_end").unwrap_or_else(|_| "08:00".to_string()),
            automation_scan_enabled: bool_from_i64(row.try_get("automation_scan_enabled"), true),
            due_alerts_enabled: bool_from_i64(row.try_get("due_alerts_enabled"), true),
            financial_risk_enabled: bool_from_i64(row.try_get("financial_risk_enabled"), true),
            goals_budget_enabled: bool_from_i64(row.try_get("goals_budget_enabled"), true),
            monthly_closing_enabled: bool_from_i64(row.try_get("monthly_closing_enabled"), true),
            backup_reminder_enabled: bool_from_i64(row.try_get("backup_reminder_enabled"), true),
            weekly_summary_enabled: bool_from_i64(row.try_get("weekly_summary_enabled"), true),
            retry_limit: row.try_get::<i64, _>("retry_limit").unwrap_or(3).clamp(0, 5),
            last_scheduler_tick_at: row.try_get("last_scheduler_tick_at").ok(),
            last_successful_run_at: row.try_get("last_successful_run_at").ok(),
            updated_at: row.try_get("updated_at").unwrap_or_default(),
        });
    }
    if !workspace_exists(connection, workspace_id).await? {
        return Err("O espaço financeiro não foi encontrado para configurar as rotinas locais.".to_string());
    }
    Ok(default_preferences(workspace_id))
}

async fn ensure_preferences_row(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"INSERT OR IGNORE INTO background_task_preferences (
             workspace_id, enabled, paused, run_on_startup, interval_minutes,
             native_notifications, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
             automation_scan_enabled, due_alerts_enabled, financial_risk_enabled,
             goals_budget_enabled, monthly_closing_enabled, backup_reminder_enabled,
             weekly_summary_enabled, retry_limit, updated_at
           ) SELECT id, 1, 0, 1, 30, 1, 1, '22:00', '08:00', 1, 1, 1, 1, 1, 1, 1, 3, $2
             FROM workspaces WHERE id = $1"#,
    )
    .bind(workspace_id)
    .bind(now)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

fn task_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<BackgroundTask, String> {
    Ok(BackgroundTask {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        task_kind: row.try_get("task_kind").map_err(to_error)?,
        dedup_key: row.try_get("dedup_key").map_err(to_error)?,
        scheduled_for: row.try_get("scheduled_for").map_err(to_error)?,
        next_attempt_at: row.try_get("next_attempt_at").map_err(to_error)?,
        status: row.try_get("status").map_err(to_error)?,
        priority: row.try_get("priority").unwrap_or(100),
        attempts: row.try_get("attempts").unwrap_or(0),
        max_attempts: row.try_get("max_attempts").unwrap_or(3),
        started_at: row.try_get("started_at").ok(),
        completed_at: row.try_get("completed_at").ok(),
        result_summary: row.try_get("result_summary").ok(),
        error_code: row.try_get("error_code").ok(),
        error_message: row.try_get("error_message").ok(),
        created_at: row.try_get("created_at").unwrap_or_default(),
        updated_at: row.try_get("updated_at").unwrap_or_default(),
    })
}

fn run_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<BackgroundTaskRun, String> {
    Ok(BackgroundTaskRun {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        task_id: row.try_get("task_id").map_err(to_error)?,
        task_kind: row.try_get("task_kind").map_err(to_error)?,
        attempt_number: row.try_get("attempt_number").unwrap_or(1),
        status: row.try_get("status").map_err(to_error)?,
        duration_ms: row.try_get("duration_ms").unwrap_or(0),
        result_summary: row.try_get("result_summary").ok(),
        error_code: row.try_get("error_code").ok(),
        error_message: row.try_get("error_message").ok(),
        started_at: row.try_get("started_at").unwrap_or_default(),
        completed_at: row.try_get("completed_at").unwrap_or_default(),
    })
}

fn notification_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<BackgroundNotification, String> {
    Ok(BackgroundNotification {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        task_id: row.try_get("task_id").ok(),
        kind: row.try_get("kind").map_err(to_error)?,
        fingerprint: row.try_get("fingerprint").map_err(to_error)?,
        title: row.try_get("title").map_err(to_error)?,
        body: row.try_get("body").map_err(to_error)?,
        severity: row.try_get("severity").map_err(to_error)?,
        status: row.try_get("status").map_err(to_error)?,
        scheduled_for: row.try_get("scheduled_for").map_err(to_error)?,
        dispatched_at: row.try_get("dispatched_at").ok(),
        sent_at: row.try_get("sent_at").ok(),
        failure_reason: row.try_get("failure_reason").ok(),
        created_at: row.try_get("created_at").unwrap_or_default(),
        updated_at: row.try_get("updated_at").unwrap_or_default(),
    })
}

fn enabled_task_kinds(preferences: &BackgroundTaskPreferences, today: NaiveDate, force: bool) -> Vec<&'static str> {
    let mut kinds = Vec::new();
    if preferences.automation_scan_enabled { kinds.push("automation_scan"); }
    if preferences.due_alerts_enabled { kinds.push("due_alerts"); }
    if preferences.financial_risk_enabled { kinds.push("financial_risk"); }
    if preferences.goals_budget_enabled { kinds.push("goals_budget"); }
    if preferences.monthly_closing_enabled && (force || today.day() <= 7) { kinds.push("monthly_closing"); }
    if preferences.backup_reminder_enabled { kinds.push("backup_reminder"); }
    if preferences.weekly_summary_enabled && (force || today.weekday() == Weekday::Mon) { kinds.push("weekly_summary"); }
    kinds
}

async fn enqueue_due_tasks(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    preferences: &BackgroundTaskPreferences,
    force: bool,
) -> Result<i64, String> {
    let now = Utc::now();
    let today = Local::now().date_naive();
    let mut queued = 0_i64;
    for kind in enabled_task_kinds(preferences, today, force) {
        let dedup = if force {
            format!("manual:{kind}:{}", Uuid::new_v4())
        } else {
            task_dedup_key(kind, today)
        };
        let affected = sqlx::query(
            r#"INSERT OR IGNORE INTO background_task_queue (
                 id, workspace_id, task_kind, dedup_key, payload_json,
                 scheduled_for, next_attempt_at, status, priority, attempts,
                 max_attempts, created_at, updated_at
               ) VALUES ($1, $2, $3, $4, '{}', $5, $5, 'pending', $6, 0, $7, $5, $5)"#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(workspace_id)
        .bind(kind)
        .bind(dedup)
        .bind(now.to_rfc3339())
        .bind(match kind { "due_alerts" | "financial_risk" => 20, "automation_scan" => 40, _ => 80 })
        .bind(preferences.retry_limit)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?
        .rows_affected();
        queued += affected as i64;
    }
    Ok(queued)
}

async fn acquire_lease(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    owner_id: &str,
) -> Result<bool, String> {
    let now = Utc::now();
    sqlx::query("DELETE FROM background_scheduler_leases WHERE workspace_id = $1 AND expires_at <= $2")
        .bind(workspace_id)
        .bind(now.to_rfc3339())
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    sqlx::query(
        "INSERT OR IGNORE INTO background_scheduler_leases (workspace_id, owner_id, acquired_at, expires_at) VALUES ($1, $2, $3, $4)",
    )
    .bind(workspace_id)
    .bind(owner_id)
    .bind(now.to_rfc3339())
    .bind((now + Duration::minutes(5)).to_rfc3339())
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    let current = sqlx::query_scalar::<_, String>(
        "SELECT owner_id FROM background_scheduler_leases WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(current.as_deref() == Some(owner_id))
}

async fn release_lease(connection: &mut SqliteConnection, workspace_id: &str, owner_id: &str) {
    let _ = sqlx::query("DELETE FROM background_scheduler_leases WHERE workspace_id = $1 AND owner_id = $2")
        .bind(workspace_id)
        .bind(owner_id)
        .execute(&mut *connection)
        .await;
}

async fn claim_next_task(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<Option<BackgroundTask>, String> {
    let now = Utc::now().to_rfc3339();
    let row = sqlx::query(
        r#"SELECT * FROM background_task_queue
            WHERE workspace_id = $1
              AND status = 'pending'
              AND next_attempt_at <= $2
              AND attempts <= max_attempts
            ORDER BY priority ASC, scheduled_for ASC, created_at ASC
            LIMIT 1"#,
    )
    .bind(workspace_id)
    .bind(&now)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    let Some(row) = row else { return Ok(None); };
    let task = task_from_row(&row)?;
    let affected = sqlx::query(
        "UPDATE background_task_queue SET status = 'running', attempts = attempts + 1, locked_at = $2, started_at = $2, updated_at = $2 WHERE id = $1 AND status = 'pending'",
    )
    .bind(&task.id)
    .bind(&now)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?
    .rows_affected();
    if affected == 0 {
        return Ok(None);
    }
    let row = sqlx::query("SELECT * FROM background_task_queue WHERE id = $1")
        .bind(&task.id)
        .fetch_one(&mut *connection)
        .await
        .map_err(to_error)?;
    task_from_row(&row).map(Some)
}

async fn read_document(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    module: &str,
) -> Result<Value, String> {
    let value = sqlx::query_scalar::<_, String>(
        "SELECT data_json FROM finance_documents WHERE workspace_id = $1 AND module = $2 LIMIT 1",
    )
    .bind(workspace_id)
    .bind(module)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    value
        .map(|value| serde_json::from_str::<Value>(&value).map_err(to_error))
        .transpose()
        .map(|value| value.unwrap_or_else(|| Value::Array(Vec::new())))
}

fn value_string(value: &Value, key: &str) -> String {
    value.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn value_number(value: &Value, key: &str) -> f64 {
    value.get(key).and_then(Value::as_f64).unwrap_or(0.0)
}

async fn process_automation_scan(app: &AppHandle, workspace_id: &str) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let preview = simulate_automation_preview(app, workspace_id, &today).await?;
    let count = preview.summary.total_candidates;
    let notifications = if count > 0 {
        vec![TaskNotificationDraft {
            kind: "automation_review".to_string(),
            fingerprint: format!("automation-review:{today}"),
            title: "Automações aguardam revisão".to_string(),
            body: format!("Há {count} sugestão(ões) pronta(s) para simulação e confirmação manual."),
            severity: "info".to_string(),
        }]
    } else { Vec::new() };
    Ok((format!("{count} candidatos encontrados; nenhuma alteração foi aplicada automaticamente."), notifications))
}

async fn process_due_alerts(app: &AppHandle, workspace_id: &str) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let preview = simulate_automation_preview(app, workspace_id, &today).await?;
    let active = preview.alerts.iter().filter(|alert| alert.status == "active").count();
    let critical = preview.alerts.iter().filter(|alert| alert.status == "active" && alert.severity == "critical").count();
    let notifications = if active > 0 {
        vec![TaskNotificationDraft {
            kind: "due_alerts".to_string(),
            fingerprint: format!("due-alerts:{today}"),
            title: if critical > 0 { "Compromissos vencidos precisam de atenção" } else { "Compromissos financeiros próximos" }.to_string(),
            body: format!("O FinnacialUX encontrou {active} compromisso(s) ativo(s) na janela configurada."),
            severity: if critical > 0 { "critical" } else { "warning" }.to_string(),
        }]
    } else { Vec::new() };
    Ok((format!("{active} alertas ativos e {critical} críticos."), notifications))
}

async fn process_financial_risk(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    let row = sqlx::query(
        r#"SELECT first_negative_date, lowest_balance_cents, ending_balance_cents, reference_date
             FROM financial_intelligence_snapshots
            WHERE workspace_id = $1
            ORDER BY created_at DESC
            LIMIT 1"#,
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    let Some(row) = row else {
        return Ok(("Nenhuma projeção persistida para avaliar riscos.".to_string(), Vec::new()));
    };
    let first_negative: Option<String> = row.try_get("first_negative_date").ok();
    let lowest = row.try_get::<i64, _>("lowest_balance_cents").unwrap_or(0);
    let ending = row.try_get::<i64, _>("ending_balance_cents").unwrap_or(0);
    let reference: String = row.try_get("reference_date").unwrap_or_default();
    let notification = if first_negative.is_some() || lowest < 0 || ending < 0 {
        Some(TaskNotificationDraft {
            kind: "financial_risk".to_string(),
            fingerprint: format!("financial-risk:{}", Local::now().format("%Y-%m-%d")),
            title: "Risco financeiro identificado".to_string(),
            body: first_negative
                .map(|date| format!("A projeção mais recente indica saldo negativo a partir de {date}."))
                .unwrap_or_else(|| "A projeção mais recente termina ou passa por saldo negativo.".to_string()),
            severity: "critical".to_string(),
        })
    } else { None };
    Ok((format!("Projeção de {reference} avaliada sem enviar dados para serviços externos."), notification.into_iter().collect()))
}

async fn process_goals_budget(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    let goals = read_document(connection, workspace_id, "goals").await?;
    let budgets = read_document(connection, workspace_id, "budgets").await?;
    let categories = read_document(connection, workspace_id, "categories").await?;
    let transactions = read_document(connection, workspace_id, "transactions").await?;
    let today = Local::now().date_naive();
    let month = today.format("%Y-%m").to_string();

    let goals_attention = goals.as_array().map(|items| {
        items.iter().filter(|goal| {
            if value_string(goal, "status") != "active" { return false; }
            let remaining = value_number(goal, "targetAmount") - value_number(goal, "currentAmount");
            let target = NaiveDate::parse_from_str(&value_string(goal, "targetDate"), "%Y-%m-%d").ok();
            remaining > 0.0 && target.is_some_and(|date| date <= today + Duration::days(30))
        }).count()
    }).unwrap_or(0);

    let category_names = categories.as_array().map(|items| {
        items.iter().filter_map(|category| {
            let id = value_string(category, "id");
            let name = value_string(category, "name");
            (!id.is_empty()).then_some((id, name))
        }).collect::<HashMap<_, _>>()
    }).unwrap_or_default();

    let mut spent = HashMap::<String, f64>::new();
    if let Some(items) = transactions.as_array() {
        for transaction in items {
            let date = value_string(transaction, "date");
            if !date.starts_with(&month) || value_string(transaction, "type") != "expense" { continue; }
            let category = value_string(transaction, "category");
            *spent.entry(category).or_default() += value_number(transaction, "amount").abs();
        }
    }
    let budgets_attention = budgets.as_array().map(|items| {
        items.iter().filter(|budget| {
            if value_string(budget, "month") != month { return false; }
            let limit = value_number(budget, "limit");
            if limit <= 0.0 { return false; }
            let threshold = value_number(budget, "alertThreshold").clamp(1.0, 100.0) / 100.0;
            let category_id = value_string(budget, "categoryId");
            let name = category_names.get(&category_id).cloned().unwrap_or(category_id);
            spent.get(&name).copied().unwrap_or(0.0) / limit >= threshold
        }).count()
    }).unwrap_or(0);

    let total = goals_attention + budgets_attention;
    let notifications = if total > 0 {
        vec![TaskNotificationDraft {
            kind: "goals_budget".to_string(),
            fingerprint: format!("goals-budget:{}", today.format("%Y-%m-%d")),
            title: "Metas e orçamentos precisam de revisão".to_string(),
            body: format!("Há {goals_attention} meta(s) próxima(s) do prazo e {budgets_attention} orçamento(s) no limite configurado."),
            severity: "warning".to_string(),
        }]
    } else { Vec::new() };
    Ok((format!("{goals_attention} metas e {budgets_attention} orçamentos em atenção."), notifications))
}

fn previous_month(today: NaiveDate) -> String {
    let (year, month) = if today.month() == 1 { (today.year() - 1, 12) } else { (today.year(), today.month() - 1) };
    format!("{year:04}-{month:02}")
}

async fn process_monthly_closing(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    let month = previous_month(Local::now().date_naive());
    let accounts = read_document(connection, workspace_id, "accounts").await?;
    let account_ids = accounts.as_array().map(|values| {
        values.iter().map(|value| value_string(value, "id")).filter(|id| !id.is_empty()).collect::<Vec<_>>()
    }).unwrap_or_default();
    if account_ids.is_empty() {
        return Ok(("Nenhuma conta cadastrada para fechamento.".to_string(), Vec::new()));
    }
    let rows = sqlx::query("SELECT account_id FROM monthly_financial_closures WHERE workspace_id = $1 AND month = $2 AND status = 'closed'")
        .bind(workspace_id)
        .bind(&month)
        .fetch_all(&mut *connection)
        .await
        .map_err(to_error)?;
    let closed = rows.into_iter().filter_map(|row| row.try_get::<String, _>("account_id").ok()).collect::<HashSet<_>>();
    let pending = account_ids.iter().filter(|id| !closed.contains(*id)).count();
    let notifications = if pending > 0 {
        vec![TaskNotificationDraft {
            kind: "monthly_closing".to_string(),
            fingerprint: format!("monthly-closing:{month}"),
            title: "Fechamento mensal pendente".to_string(),
            body: format!("{pending} conta(s) ainda não foram fechadas para {month}."),
            severity: "warning".to_string(),
        }]
    } else { Vec::new() };
    Ok((format!("{pending} de {} contas aguardam fechamento de {month}.", account_ids.len()), notifications))
}

async fn process_backup_reminder(connection: &mut SqliteConnection) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    let latest = sqlx::query_scalar::<_, String>(
        "SELECT created_at FROM backup_history WHERE status = 'available' ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    let stale = latest.as_deref().and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|date| Utc::now().signed_duration_since(date.with_timezone(&Utc)) >= Duration::days(7))
        .unwrap_or(true);
    let notifications = if stale {
        vec![TaskNotificationDraft {
            kind: "backup_reminder".to_string(),
            fingerprint: format!("backup-reminder:{}", Local::now().format("%G-W%V")),
            title: "Backup recomendado".to_string(),
            body: "Crie uma cópia criptografada atual antes de continuar acumulando alterações.".to_string(),
            severity: "warning".to_string(),
        }]
    } else { Vec::new() };
    Ok((if stale { "O backup mais recente ultrapassou a janela recomendada." } else { "Existe um backup recente disponível." }.to_string(), notifications))
}

async fn process_weekly_summary(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    let today = Local::now().date_naive();
    let start = today - Duration::days(6);
    let rows = sqlx::query(
        r#"SELECT transaction_type, COUNT(*) AS item_count
             FROM finance_transaction_index
            WHERE workspace_id = $1 AND transaction_date BETWEEN $2 AND $3
            GROUP BY transaction_type"#,
    )
    .bind(workspace_id)
    .bind(start.format("%Y-%m-%d").to_string())
    .bind(today.format("%Y-%m-%d").to_string())
    .fetch_all(&mut *connection)
    .await
    .map_err(to_error)?;
    let mut counts = HashMap::<String, i64>::new();
    for row in rows {
        counts.insert(row.try_get("transaction_type").unwrap_or_default(), row.try_get("item_count").unwrap_or(0));
    }
    let income = counts.get("income").copied().unwrap_or(0);
    let expenses = counts.get("expense").copied().unwrap_or(0);
    let transfers = counts.get("transfer").copied().unwrap_or(0);
    let notification = TaskNotificationDraft {
        kind: "weekly_summary".to_string(),
        fingerprint: format!("weekly-summary:{}", task_dedup_key("weekly_summary", today)),
        title: "Resumo financeiro semanal".to_string(),
        body: format!("Foram registrados {income} entrada(s), {expenses} saída(s) e {transfers} transferência(s) nos últimos sete dias."),
        severity: "info".to_string(),
    };
    Ok(("Resumo semanal calculado somente com contagens locais.".to_string(), vec![notification]))
}

async fn process_task(
    app: &AppHandle,
    connection: &mut SqliteConnection,
    task: &BackgroundTask,
) -> Result<(String, Vec<TaskNotificationDraft>), String> {
    match task.task_kind.as_str() {
        "automation_scan" => process_automation_scan(app, &task.workspace_id).await,
        "due_alerts" => process_due_alerts(app, &task.workspace_id).await,
        "financial_risk" => process_financial_risk(connection, &task.workspace_id).await,
        "goals_budget" => process_goals_budget(connection, &task.workspace_id).await,
        "monthly_closing" => process_monthly_closing(connection, &task.workspace_id).await,
        "backup_reminder" => process_backup_reminder(connection).await,
        "weekly_summary" => process_weekly_summary(connection, &task.workspace_id).await,
        _ => Err("A rotina local possui um tipo não suportado.".to_string()),
    }
}

async fn insert_notifications(
    connection: &mut SqliteConnection,
    task: &BackgroundTask,
    drafts: Vec<TaskNotificationDraft>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    for draft in drafts {
        sqlx::query(
            r#"INSERT OR IGNORE INTO background_notification_outbox (
                 id, workspace_id, task_id, kind, fingerprint, title, body, severity,
                 status, scheduled_for, created_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $9, $9)"#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&task.workspace_id)
        .bind(&task.id)
        .bind(draft.kind)
        .bind(draft.fingerprint)
        .bind(draft.title.chars().take(120).collect::<String>())
        .bind(draft.body.chars().take(300).collect::<String>())
        .bind(draft.severity)
        .bind(&now)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    }
    Ok(())
}

async fn record_run(
    connection: &mut SqliteConnection,
    task: &BackgroundTask,
    status: &str,
    duration_ms: i64,
    summary: Option<&str>,
    error_code: Option<&str>,
    error_message: Option<&str>,
    started_at: &str,
    completed_at: &str,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO background_task_runs (
             id, workspace_id, task_id, task_kind, attempt_number, status, duration_ms,
             result_summary, error_code, error_message, started_at, completed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&task.workspace_id)
    .bind(&task.id)
    .bind(&task.task_kind)
    .bind(task.attempts)
    .bind(status)
    .bind(duration_ms)
    .bind(summary)
    .bind(error_code)
    .bind(error_message.map(|value| value.chars().take(500).collect::<String>()))
    .bind(started_at)
    .bind(completed_at)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

async fn finish_task_success(
    connection: &mut SqliteConnection,
    task: &BackgroundTask,
    summary: &str,
    duration_ms: i64,
    started_at: &str,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE background_task_queue SET status = 'succeeded', result_summary = $2, error_code = NULL, error_message = NULL, completed_at = $3, updated_at = $3 WHERE id = $1")
        .bind(&task.id)
        .bind(summary.chars().take(500).collect::<String>())
        .bind(&now)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    record_run(connection, task, "succeeded", duration_ms, Some(summary), None, None, started_at, &now).await
}

async fn finish_task_failure(
    connection: &mut SqliteConnection,
    task: &BackgroundTask,
    error: &str,
    duration_ms: i64,
    started_at: &str,
) -> Result<bool, String> {
    let now = Utc::now();
    let retry = task.attempts <= task.max_attempts;
    let status = if retry { "pending" } else { "failed" };
    let next = if retry { now + Duration::minutes(retry_delay_minutes(task.attempts)) } else { now };
    sqlx::query("UPDATE background_task_queue SET status = $2, next_attempt_at = $3, error_code = 'TASK_FAILED', error_message = $4, completed_at = CASE WHEN $2 = 'failed' THEN $5 ELSE NULL END, updated_at = $5 WHERE id = $1")
        .bind(&task.id)
        .bind(status)
        .bind(next.to_rfc3339())
        .bind(error.chars().take(500).collect::<String>())
        .bind(now.to_rfc3339())
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    record_run(connection, task, "failed", duration_ms, None, Some("TASK_FAILED"), Some(error), started_at, &now.to_rfc3339()).await?;
    Ok(retry)
}

async fn pending_notifications(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    limit: i64,
) -> Result<Vec<BackgroundNotification>, String> {
    let rows = sqlx::query(
        r#"SELECT * FROM background_notification_outbox
            WHERE workspace_id = $1 AND status IN ('pending', 'dispatched') AND scheduled_for <= $2
            ORDER BY created_at ASC LIMIT $3"#,
    )
    .bind(workspace_id)
    .bind(Utc::now().to_rfc3339())
    .bind(limit.clamp(1, 100))
    .fetch_all(&mut *connection)
    .await
    .map_err(to_error)?;
    rows.iter().map(notification_from_row).collect()
}

async fn dispatch_notifications(
    app: &AppHandle,
    connection: &mut SqliteConnection,
    preferences: &BackgroundTaskPreferences,
) -> Result<Vec<BackgroundNotification>, String> {
    if !preferences.native_notifications || is_quiet_hours(preferences) {
        return Ok(Vec::new());
    }
    let notifications = pending_notifications(connection, &preferences.workspace_id, 20).await?;
    let now = Utc::now().to_rfc3339();
    let mut dispatched = Vec::new();
    for mut notification in notifications {
        sqlx::query("UPDATE background_notification_outbox SET status = 'dispatched', dispatched_at = $2, updated_at = $2 WHERE id = $1 AND status IN ('pending', 'dispatched')")
            .bind(&notification.id)
            .bind(&now)
            .execute(&mut *connection)
            .await
            .map_err(to_error)?;
        notification.status = "dispatched".to_string();
        notification.dispatched_at = Some(now.clone());
        notification.updated_at = now.clone();
        let _ = app.emit("finnacialux-background-notification", BackgroundNotificationEvent { notification: notification.clone() });
        dispatched.push(notification);
    }
    Ok(dispatched)
}

async fn status_from_connection(
    connection: &mut SqliteConnection,
    state: &BackgroundSchedulerState,
    database: &EncryptedDatabaseState,
    workspace_id: &str,
) -> Result<BackgroundSchedulerStatus, String> {
    let preferences = load_preferences(connection, workspace_id).await?;
    let counts = sqlx::query(
        r#"SELECT
             SUM(CASE WHEN status IN ('pending', 'running') THEN 1 ELSE 0 END) AS pending_tasks,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_tasks
           FROM background_task_queue WHERE workspace_id = $1"#,
    )
    .bind(workspace_id)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    let pending_notifications = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM background_notification_outbox WHERE workspace_id = $1 AND status IN ('pending', 'dispatched')",
    )
    .bind(workspace_id)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    let next_tick_at = preferences.last_scheduler_tick_at.as_deref()
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|value| (value.with_timezone(&Utc) + Duration::minutes(preferences.interval_minutes)).to_rfc3339());
    Ok(BackgroundSchedulerStatus {
        workspace_id: workspace_id.to_string(),
        active: state.is_active(workspace_id),
        enabled: preferences.enabled,
        paused: preferences.paused,
        read_only_blocked: database.access_status().read_only,
        running: state.is_running(workspace_id),
        interval_minutes: preferences.interval_minutes,
        pending_tasks: counts.try_get::<Option<i64>, _>("pending_tasks").ok().flatten().unwrap_or(0),
        failed_tasks: counts.try_get::<Option<i64>, _>("failed_tasks").ok().flatten().unwrap_or(0),
        pending_notifications,
        last_scheduler_tick_at: preferences.last_scheduler_tick_at,
        last_successful_run_at: preferences.last_successful_run_at,
        next_tick_at,
    })
}

async fn run_due_tasks_internal(
    app: &AppHandle,
    scheduler: &BackgroundSchedulerState,
    database: &EncryptedDatabaseState,
    workspace_id: &str,
    force: bool,
) -> Result<BackgroundRunResult, String> {
    let mut connection = connect_app_database(app, database).await?;
    let preferences = load_preferences(&mut connection, workspace_id).await?;
    if !preferences.enabled || preferences.paused {
        let status = status_from_connection(&mut connection, scheduler, database, workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        return Ok(BackgroundRunResult { status, queued: 0, processed: 0, succeeded: 0, failed: 0, skipped: 1, notifications: Vec::new() });
    }
    if database.access_status().read_only {
        let status = status_from_connection(&mut connection, scheduler, database, workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        return Ok(BackgroundRunResult { status, queued: 0, processed: 0, succeeded: 0, failed: 0, skipped: 1, notifications: Vec::new() });
    }
    ensure_preferences_row(&mut connection, workspace_id).await?;
    let owner_id = Uuid::new_v4().to_string();
    if !acquire_lease(&mut connection, workspace_id, &owner_id).await? {
        let status = status_from_connection(&mut connection, scheduler, database, workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        return Ok(BackgroundRunResult { status, queued: 0, processed: 0, succeeded: 0, failed: 0, skipped: 1, notifications: Vec::new() });
    }

    let queued = enqueue_due_tasks(&mut connection, workspace_id, &preferences, force).await?;
    let mut processed = 0_i64;
    let mut succeeded = 0_i64;
    let mut failed = 0_i64;
    let mut skipped = 0_i64;
    for _ in 0..25 {
        let Some(task) = claim_next_task(&mut connection, workspace_id).await? else { break; };
        processed += 1;
        let started_at = Utc::now().to_rfc3339();
        let timer = Instant::now();
        match process_task(app, &mut connection, &task).await {
            Ok((summary, notifications)) => {
                insert_notifications(&mut connection, &task, notifications).await?;
                finish_task_success(&mut connection, &task, &summary, timer.elapsed().as_millis() as i64, &started_at).await?;
                succeeded += 1;
            }
            Err(error) => {
                let retry = finish_task_failure(&mut connection, &task, &error, timer.elapsed().as_millis() as i64, &started_at).await?;
                if retry { skipped += 1; } else { failed += 1; }
            }
        }
    }

    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE background_task_preferences SET last_scheduler_tick_at = $2, last_successful_run_at = CASE WHEN $3 > 0 THEN $2 ELSE last_successful_run_at END, updated_at = $2 WHERE workspace_id = $1")
        .bind(workspace_id)
        .bind(&now)
        .bind(succeeded)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    let refreshed = load_preferences(&mut connection, workspace_id).await?;
    let notifications = dispatch_notifications(app, &mut connection, &refreshed).await?;
    release_lease(&mut connection, workspace_id, &owner_id).await;
    let status = status_from_connection(&mut connection, scheduler, database, workspace_id).await?;
    connection.close().await.map_err(to_error)?;
    Ok(BackgroundRunResult { status, queued, processed, succeeded, failed, skipped, notifications })
}

#[tauri::command(async)]
pub fn background_get_preferences(app: AppHandle, workspace_id: String) -> Result<BackgroundTaskPreferences, String> {
    run_local_async_worker("finnacialux-background-preferences", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &database).await?;
        let result = load_preferences(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_save_preferences(app: AppHandle, request: SaveBackgroundTaskPreferencesRequest) -> Result<BackgroundTaskPreferences, String> {
    run_local_async_worker("finnacialux-background-save-preferences", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        if database.access_status().read_only {
            return Err("O modo somente leitura está ativo. As rotinas não podem alterar preferências.".to_string());
        }
        let start = validate_clock(&request.quiet_hours_start)?;
        let end = validate_clock(&request.quiet_hours_end)?;
        let mut connection = connect_app_database(&app, &database).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"UPDATE background_task_preferences SET
                 enabled = $2, paused = $3, run_on_startup = $4, interval_minutes = $5,
                 native_notifications = $6, quiet_hours_enabled = $7,
                 quiet_hours_start = $8, quiet_hours_end = $9,
                 automation_scan_enabled = $10, due_alerts_enabled = $11,
                 financial_risk_enabled = $12, goals_budget_enabled = $13,
                 monthly_closing_enabled = $14, backup_reminder_enabled = $15,
                 weekly_summary_enabled = $16, retry_limit = $17, updated_at = $18
               WHERE workspace_id = $1"#,
        )
        .bind(&request.workspace_id)
        .bind(if request.enabled { 1 } else { 0 })
        .bind(if request.paused { 1 } else { 0 })
        .bind(if request.run_on_startup { 1 } else { 0 })
        .bind(request.interval_minutes.clamp(15, 240))
        .bind(if request.native_notifications { 1 } else { 0 })
        .bind(if request.quiet_hours_enabled { 1 } else { 0 })
        .bind(start)
        .bind(end)
        .bind(if request.automation_scan_enabled { 1 } else { 0 })
        .bind(if request.due_alerts_enabled { 1 } else { 0 })
        .bind(if request.financial_risk_enabled { 1 } else { 0 })
        .bind(if request.goals_budget_enabled { 1 } else { 0 })
        .bind(if request.monthly_closing_enabled { 1 } else { 0 })
        .bind(if request.backup_reminder_enabled { 1 } else { 0 })
        .bind(if request.weekly_summary_enabled { 1 } else { 0 })
        .bind(request.retry_limit.clamp(0, 5))
        .bind(now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let result = load_preferences(&mut connection, &request.workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_start_scheduler(app: AppHandle, workspace_id: String, run_startup: bool) -> Result<BackgroundRunResult, String> {
    app.state::<BackgroundSchedulerState>().activate(&workspace_id)?;
    if !app.state::<BackgroundSchedulerState>().claim(&workspace_id)? {
        let app_worker = app.clone();
        let workspace_worker = workspace_id.clone();
        return run_local_async_worker("finnacialux-background-status-active", move || async move {
            let database = app_worker.state::<EncryptedDatabaseState>();
            let scheduler = app_worker.state::<BackgroundSchedulerState>();
            let mut connection = connect_app_database(&app_worker, &database).await?;
            let status = status_from_connection(&mut connection, &scheduler, &database, &workspace_worker).await?;
            connection.close().await.map_err(to_error)?;
            Ok(BackgroundRunResult { status, queued: 0, processed: 0, succeeded: 0, failed: 0, skipped: 1, notifications: Vec::new() })
        });
    }
    let app_worker = app.clone();
    let workspace_worker = workspace_id.clone();
    let result = run_local_async_worker("finnacialux-background-start", move || async move {
        let database = app_worker.state::<EncryptedDatabaseState>();
        let scheduler = app_worker.state::<BackgroundSchedulerState>();
        let preferences = {
            let mut connection = connect_app_database(&app_worker, &database).await?;
            let value = load_preferences(&mut connection, &workspace_worker).await?;
            connection.close().await.map_err(to_error)?;
            value
        };
        if !run_startup || !preferences.run_on_startup {
            let mut connection = connect_app_database(&app_worker, &database).await?;
            let status = status_from_connection(&mut connection, &scheduler, &database, &workspace_worker).await?;
            connection.close().await.map_err(to_error)?;
            return Ok(BackgroundRunResult { status, queued: 0, processed: 0, succeeded: 0, failed: 0, skipped: 1, notifications: Vec::new() });
        }
        run_due_tasks_internal(&app_worker, &scheduler, &database, &workspace_worker, false).await
    });
    app.state::<BackgroundSchedulerState>().release(&workspace_id);
    result
}

#[tauri::command]
pub fn background_stop_scheduler(app: AppHandle, workspace_id: String) -> Result<(), String> {
    app.state::<BackgroundSchedulerState>().deactivate(&workspace_id)
}

#[tauri::command(async)]
pub fn background_run_due_tasks(app: AppHandle, workspace_id: String, force: bool) -> Result<BackgroundRunResult, String> {
    app.state::<BackgroundSchedulerState>().activate(&workspace_id)?;
    if !app.state::<BackgroundSchedulerState>().claim(&workspace_id)? {
        let app_worker = app.clone();
        let workspace_worker = workspace_id.clone();
        return run_local_async_worker("finnacialux-background-status-running", move || async move {
            let database = app_worker.state::<EncryptedDatabaseState>();
            let scheduler = app_worker.state::<BackgroundSchedulerState>();
            let mut connection = connect_app_database(&app_worker, &database).await?;
            let status = status_from_connection(&mut connection, &scheduler, &database, &workspace_worker).await?;
            connection.close().await.map_err(to_error)?;
            Ok(BackgroundRunResult { status, queued: 0, processed: 0, succeeded: 0, failed: 0, skipped: 1, notifications: Vec::new() })
        });
    }
    let app_worker = app.clone();
    let workspace_worker = workspace_id.clone();
    let result = run_local_async_worker("finnacialux-background-run", move || async move {
        let database = app_worker.state::<EncryptedDatabaseState>();
        let scheduler = app_worker.state::<BackgroundSchedulerState>();
        run_due_tasks_internal(&app_worker, &scheduler, &database, &workspace_worker, force).await
    });
    app.state::<BackgroundSchedulerState>().release(&workspace_id);
    result
}

#[tauri::command(async)]
pub fn background_get_status(app: AppHandle, workspace_id: String) -> Result<BackgroundSchedulerStatus, String> {
    run_local_async_worker("finnacialux-background-status", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let scheduler = app.state::<BackgroundSchedulerState>();
        let mut connection = connect_app_database(&app, &database).await?;
        let result = status_from_connection(&mut connection, &scheduler, &database, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_list_tasks(app: AppHandle, workspace_id: String, status: Option<String>, limit: i64) -> Result<Vec<BackgroundTask>, String> {
    run_local_async_worker("finnacialux-background-list-tasks", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &database).await?;
        let rows = if let Some(status) = status {
            sqlx::query("SELECT * FROM background_task_queue WHERE workspace_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3")
                .bind(&workspace_id).bind(status).bind(limit.clamp(1, 200)).fetch_all(&mut connection).await.map_err(to_error)?
        } else {
            sqlx::query("SELECT * FROM background_task_queue WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2")
                .bind(&workspace_id).bind(limit.clamp(1, 200)).fetch_all(&mut connection).await.map_err(to_error)?
        };
        let result = rows.iter().map(task_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_list_runs(app: AppHandle, workspace_id: String, limit: i64) -> Result<Vec<BackgroundTaskRun>, String> {
    run_local_async_worker("finnacialux-background-list-runs", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &database).await?;
        let rows = sqlx::query("SELECT * FROM background_task_runs WHERE workspace_id = $1 ORDER BY completed_at DESC LIMIT $2")
            .bind(&workspace_id).bind(limit.clamp(1, 200)).fetch_all(&mut connection).await.map_err(to_error)?;
        let result = rows.iter().map(run_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_cancel_task(app: AppHandle, workspace_id: String, task_id: String) -> Result<BackgroundTask, String> {
    run_local_async_worker("finnacialux-background-cancel", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        if database.access_status().read_only { return Err("O modo somente leitura está ativo.".to_string()); }
        let mut connection = connect_app_database(&app, &database).await?;
        let now = Utc::now().to_rfc3339();
        let affected = sqlx::query("UPDATE background_task_queue SET status = 'cancelled', completed_at = $3, updated_at = $3 WHERE id = $1 AND workspace_id = $2 AND status = 'pending'")
            .bind(&task_id).bind(&workspace_id).bind(&now).execute(&mut connection).await.map_err(to_error)?.rows_affected();
        if affected == 0 { connection.close().await.map_err(to_error)?; return Err("A tarefa não está pendente ou não foi encontrada.".to_string()); }
        let row = sqlx::query("SELECT * FROM background_task_queue WHERE id = $1").bind(&task_id).fetch_one(&mut connection).await.map_err(to_error)?;
        let result = task_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_retry_task(app: AppHandle, workspace_id: String, task_id: String) -> Result<BackgroundTask, String> {
    run_local_async_worker("finnacialux-background-retry", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        if database.access_status().read_only { return Err("O modo somente leitura está ativo.".to_string()); }
        let mut connection = connect_app_database(&app, &database).await?;
        let now = Utc::now().to_rfc3339();
        let affected = sqlx::query("UPDATE background_task_queue SET status = 'pending', attempts = 0, next_attempt_at = $3, completed_at = NULL, error_code = NULL, error_message = NULL, updated_at = $3 WHERE id = $1 AND workspace_id = $2 AND status IN ('failed', 'cancelled')")
            .bind(&task_id).bind(&workspace_id).bind(&now).execute(&mut connection).await.map_err(to_error)?.rows_affected();
        if affected == 0 { connection.close().await.map_err(to_error)?; return Err("A tarefa não pode ser repetida no estado atual.".to_string()); }
        let row = sqlx::query("SELECT * FROM background_task_queue WHERE id = $1").bind(&task_id).fetch_one(&mut connection).await.map_err(to_error)?;
        let result = task_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_list_notifications(app: AppHandle, workspace_id: String, limit: i64) -> Result<Vec<BackgroundNotification>, String> {
    run_local_async_worker("finnacialux-background-list-notifications", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &database).await?;
        let rows = sqlx::query("SELECT * FROM background_notification_outbox WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2")
            .bind(&workspace_id).bind(limit.clamp(1, 200)).fetch_all(&mut connection).await.map_err(to_error)?;
        let result = rows.iter().map(notification_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_flush_notifications(app: AppHandle, workspace_id: String) -> Result<Vec<BackgroundNotification>, String> {
    run_local_async_worker("finnacialux-background-flush-notifications", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        if database.access_status().read_only { return Ok(Vec::new()); }
        let mut connection = connect_app_database(&app, &database).await?;
        let preferences = load_preferences(&mut connection, &workspace_id).await?;
        let result = dispatch_notifications(&app, &mut connection, &preferences).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn background_ack_notification(app: AppHandle, workspace_id: String, notification_id: String, delivered: bool, failure_reason: Option<String>) -> Result<BackgroundNotification, String> {
    run_local_async_worker("finnacialux-background-ack-notification", move || async move {
        let database = app.state::<EncryptedDatabaseState>();
        if database.access_status().read_only { return Err("O modo somente leitura está ativo.".to_string()); }
        let mut connection = connect_app_database(&app, &database).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE background_notification_outbox SET status = $3, sent_at = CASE WHEN $3 = 'sent' THEN $4 ELSE sent_at END, failure_reason = $5, updated_at = $4 WHERE id = $1 AND workspace_id = $2")
            .bind(&notification_id).bind(&workspace_id).bind(if delivered { "sent" } else { "failed" }).bind(&now).bind(failure_reason.map(|value| value.chars().take(300).collect::<String>())).execute(&mut connection).await.map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM background_notification_outbox WHERE id = $1 AND workspace_id = $2").bind(&notification_id).bind(&workspace_id).fetch_one(&mut connection).await.map_err(to_error)?;
        let result = notification_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_backoff_is_bounded_and_exponential() {
        assert_eq!((1..=6).map(retry_delay_minutes).collect::<Vec<_>>(), vec![5, 10, 20, 40, 80, 160]);
        assert_eq!(retry_delay_minutes(99), 160);
    }

    #[test]
    fn task_keys_prevent_duplicate_daily_weekly_and_monthly_work() {
        let date = NaiveDate::from_ymd_opt(2026, 7, 31).expect("data");
        assert_eq!(task_dedup_key("due_alerts", date), "due_alerts:2026-07-31");
        assert_eq!(task_dedup_key("monthly_closing", date), "monthly_closing:2026-07");
        assert_eq!(task_dedup_key("weekly_summary", date), "weekly_summary:2026-07-27");
    }

    #[test]
    fn every_task_kind_is_explicit_and_sanitized() {
        assert_eq!(TASK_KINDS.len(), 7);
        assert!(TASK_KINDS.contains(&"automation_scan"));
        assert!(TASK_KINDS.contains(&"backup_reminder"));
    }

    #[test]
    fn manual_cycle_includes_weekly_and_monthly_routines_outside_their_schedule() {
        let date = NaiveDate::from_ymd_opt(2026, 7, 15).expect("data");
        let preferences = default_preferences("workspace");
        let automatic = enabled_task_kinds(&preferences, date, false);
        let manual = enabled_task_kinds(&preferences, date, true);
        assert!(!automatic.contains(&"monthly_closing"));
        assert!(!automatic.contains(&"weekly_summary"));
        assert!(manual.contains(&"monthly_closing"));
        assert!(manual.contains(&"weekly_summary"));
    }
}
