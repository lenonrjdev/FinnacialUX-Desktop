use crate::{
    command_worker::run_local_async_worker,
    encrypted_database::{connect_app_database, EncryptedDatabaseState},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use sqlx::{Connection, Row, SqliteConnection};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

const DEFAULT_PAGE_SIZE: i64 = 50;
const DEFAULT_BATCH_SIZE: i64 = 500;
const DEFAULT_QUERY_TARGET_MS: i64 = 250;
const MIN_PAGE_SIZE: i64 = 25;
const MAX_PAGE_SIZE: i64 = 250;
const MIN_BATCH_SIZE: i64 = 100;
const MAX_BATCH_SIZE: i64 = 2_000;

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn ensure_database_writable(state: &EncryptedDatabaseState) -> Result<(), String> {
    let access = state.access_status();
    if access.read_only {
        return Err(access.reason.unwrap_or_else(|| {
            "O banco está em modo somente leitura. Índices e manutenção não podem ser alterados.".to_string()
        }));
    }
    Ok(())
}

fn clamp(value: i64, minimum: i64, maximum: i64) -> i64 {
    value.max(minimum).min(maximum)
}

fn normalize_text(value: &str) -> String {
    let lowered = value.to_lowercase();
    let replacements = [
        ("á", "a"), ("à", "a"), ("â", "a"), ("ã", "a"), ("ä", "a"),
        ("é", "e"), ("è", "e"), ("ê", "e"), ("ë", "e"),
        ("í", "i"), ("ì", "i"), ("î", "i"), ("ï", "i"),
        ("ó", "o"), ("ò", "o"), ("ô", "o"), ("õ", "o"), ("ö", "o"),
        ("ú", "u"), ("ù", "u"), ("û", "u"), ("ü", "u"), ("ç", "c"),
    ];
    let mut normalized = lowered;
    for (from, to) in replacements {
        normalized = normalized.replace(from, to);
    }
    normalized
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() { character } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn value_string(object: &Map<String, Value>, key: &str) -> String {
    object.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn value_money_cents(object: &Map<String, Value>, key: &str) -> i64 {
    let value = object.get(key).and_then(Value::as_f64).unwrap_or_default();
    if value.is_finite() { (value * 100.0).round() as i64 } else { 0 }
}

fn sha256_text(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformancePreferences {
    pub workspace_id: String,
    pub transaction_page_size: i64,
    pub import_batch_size: i64,
    pub query_timeout_ms: i64,
    pub auto_analyze: bool,
    pub last_analyze_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePerformancePreferencesRequest {
    pub workspace_id: String,
    pub transaction_page_size: i64,
    pub import_batch_size: i64,
    pub query_timeout_ms: i64,
    pub auto_analyze: bool,
}

async fn load_preferences(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<PerformancePreferences, String> {
    let row = sqlx::query(
        "SELECT transaction_page_size, import_batch_size, query_timeout_ms, auto_analyze, last_analyze_at, updated_at FROM performance_preferences WHERE workspace_id = $1 LIMIT 1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;

    Ok(match row {
        Some(row) => PerformancePreferences {
            workspace_id: workspace_id.to_string(),
            transaction_page_size: row.try_get("transaction_page_size").map_err(to_error)?,
            import_batch_size: row.try_get("import_batch_size").map_err(to_error)?,
            query_timeout_ms: row.try_get("query_timeout_ms").map_err(to_error)?,
            auto_analyze: row.try_get::<i64, _>("auto_analyze").map_err(to_error)? != 0,
            last_analyze_at: row.try_get("last_analyze_at").map_err(to_error)?,
            updated_at: row.try_get("updated_at").map_err(to_error)?,
        },
        None => PerformancePreferences {
            workspace_id: workspace_id.to_string(),
            transaction_page_size: DEFAULT_PAGE_SIZE,
            import_batch_size: DEFAULT_BATCH_SIZE,
            query_timeout_ms: DEFAULT_QUERY_TARGET_MS,
            auto_analyze: true,
            last_analyze_at: None,
            updated_at: Utc::now().to_rfc3339(),
        },
    })
}

#[tauri::command(async)]
pub fn performance_get_preferences(
    app: AppHandle,
    workspace_id: String,
) -> Result<PerformancePreferences, String> {
    run_local_async_worker("finnacialux-performance-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let result = load_preferences(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn performance_save_preferences(
    app: AppHandle,
    request: SavePerformancePreferencesRequest,
) -> Result<PerformancePreferences, String> {
    run_local_async_worker("finnacialux-performance-save-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let page_size = clamp(request.transaction_page_size, MIN_PAGE_SIZE, MAX_PAGE_SIZE);
        let batch_size = clamp(request.import_batch_size, MIN_BATCH_SIZE, MAX_BATCH_SIZE);
        let timeout = clamp(request.query_timeout_ms, 50, 10_000);
        let now = Utc::now().to_rfc3339();
        let mut connection = connect_app_database(&app, &state).await?;
        sqlx::query(
            r#"INSERT INTO performance_preferences (
                 workspace_id, transaction_page_size, import_batch_size, query_timeout_ms,
                 auto_analyze, last_analyze_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, NULL, $6)
               ON CONFLICT(workspace_id) DO UPDATE SET
                 transaction_page_size = excluded.transaction_page_size,
                 import_batch_size = excluded.import_batch_size,
                 query_timeout_ms = excluded.query_timeout_ms,
                 auto_analyze = excluded.auto_analyze,
                 updated_at = excluded.updated_at"#,
        )
        .bind(&request.workspace_id)
        .bind(page_size)
        .bind(batch_size)
        .bind(timeout)
        .bind(if request.auto_analyze { 1 } else { 0 })
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let result = load_preferences(&mut connection, &request.workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceProgressEvent {
    pub operation_id: String,
    pub kind: String,
    pub status: String,
    pub current: i64,
    pub total: i64,
    pub percent: i64,
    pub message: String,
}

fn emit_progress(
    app: &AppHandle,
    operation_id: &str,
    kind: &str,
    status: &str,
    current: i64,
    total: i64,
    message: impl Into<String>,
) {
    let percent = if total <= 0 { 0 } else { ((current.max(0) * 100) / total).clamp(0, 100) };
    let _ = app.emit(
        "performance://progress",
        PerformanceProgressEvent {
            operation_id: operation_id.to_string(),
            kind: kind.to_string(),
            status: status.to_string(),
            current,
            total,
            percent,
            message: message.into(),
        },
    );
}

pub(crate) async fn begin_operation(
    connection: &mut SqliteConnection,
    operation_id: &str,
    workspace_id: &str,
    kind: &str,
    total: i64,
    details: &Value,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"INSERT INTO performance_operation_jobs (
             id, workspace_id, kind, status, progress_current, progress_total,
             cancellation_requested, details_json, error_message, started_at,
             completed_at, created_at, updated_at
           ) VALUES ($1, $2, $3, 'running', 0, $4, 0, $5, NULL, $6, NULL, $6, $6)
           ON CONFLICT(id) DO UPDATE SET
             status = 'running', progress_current = 0, progress_total = excluded.progress_total,
             cancellation_requested = 0, details_json = excluded.details_json,
             error_message = NULL, started_at = excluded.started_at, completed_at = NULL,
             updated_at = excluded.updated_at"#,
    )
    .bind(operation_id)
    .bind(workspace_id)
    .bind(kind)
    .bind(total.max(0))
    .bind(serde_json::to_string(details).map_err(to_error)?)
    .bind(&now)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

pub(crate) async fn update_operation_progress(
    connection: &mut SqliteConnection,
    operation_id: &str,
    current: i64,
) -> Result<(), String> {
    sqlx::query("UPDATE performance_operation_jobs SET progress_current = $1, updated_at = $2 WHERE id = $3")
        .bind(current.max(0))
        .bind(Utc::now().to_rfc3339())
        .bind(operation_id)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    Ok(())
}

pub(crate) async fn operation_cancelled(
    connection: &mut SqliteConnection,
    operation_id: &str,
) -> Result<bool, String> {
    let value = sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(cancellation_requested, 0) FROM performance_operation_jobs WHERE id = $1 LIMIT 1",
    )
    .bind(operation_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?
    .unwrap_or(0);
    Ok(value != 0)
}

pub(crate) async fn finish_operation(
    connection: &mut SqliteConnection,
    operation_id: &str,
    status: &str,
    current: i64,
    error_message: Option<&str>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE performance_operation_jobs SET status = $1, progress_current = $2, error_message = $3, completed_at = $4, updated_at = $4 WHERE id = $5",
    )
    .bind(status)
    .bind(current.max(0))
    .bind(error_message)
    .bind(&now)
    .bind(operation_id)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

pub(crate) fn emit_operation_progress(
    app: &AppHandle,
    operation_id: &str,
    kind: &str,
    status: &str,
    current: i64,
    total: i64,
    message: impl Into<String>,
) {
    emit_progress(app, operation_id, kind, status, current, total, message);
}

async fn record_metric(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    operation_type: &str,
    item_count: i64,
    duration_ms: i64,
    status: &str,
    cancelled: bool,
    details: &Value,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO performance_operation_metrics (id, workspace_id, operation_type, item_count, duration_ms, status, cancelled, details_json, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(format!("performance-metric-{}", Uuid::new_v4()))
    .bind(workspace_id)
    .bind(operation_type)
    .bind(item_count.max(0))
    .bind(duration_ms.max(0))
    .bind(status)
    .bind(if cancelled { 1 } else { 0 })
    .bind(serde_json::to_string(details).map_err(to_error)?)
    .bind(Utc::now().to_rfc3339())
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

async fn transaction_document_updated_at(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<String, String> {
    Ok(sqlx::query_scalar::<_, String>(
        "SELECT updated_at FROM finance_documents WHERE workspace_id = $1 AND module = 'transactions' LIMIT 1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?
    .unwrap_or_default())
}

async fn transaction_document(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(String, String, String), String> {
    let row = sqlx::query(
        "SELECT data_json, updated_at FROM finance_documents WHERE workspace_id = $1 AND module = 'transactions' LIMIT 1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    match row {
        Some(row) => {
            let data_json: String = row.try_get("data_json").map_err(to_error)?;
            let updated_at: String = row.try_get("updated_at").map_err(to_error)?;
            let checksum = sha256_text(&format!("{updated_at}:{data_json}"));
            Ok((checksum, updated_at, data_json))
        }
        None => {
            let data_json = "[]".to_string();
            Ok((sha256_text(&data_json), String::new(), data_json))
        }
    }
}

fn parse_transaction_items(data_json: &str) -> Result<Vec<Value>, String> {
    Ok(serde_json::from_str::<Value>(data_json)
        .map_err(to_error)?
        .as_array()
        .cloned()
        .unwrap_or_default())
}

fn index_values(value: &Value) -> Option<(String, String, String, String, String, String, Option<String>, i64, String, String, Option<String>, bool, String)> {
    let object = value.as_object()?;
    let id = value_string(object, "id");
    if id.trim().is_empty() { return None; }
    let date = value_string(object, "date");
    let description = value_string(object, "description");
    let category = value_string(object, "category");
    let account_id = value_string(object, "accountId");
    let account_name = value_string(object, "account");
    let destination_account_id = object.get("destinationAccountId").and_then(Value::as_str).map(ToString::to_string);
    let transaction_type = value_string(object, "type");
    let status = value_string(object, "status");
    let source_type = object.get("sourceType").and_then(Value::as_str).map(ToString::to_string);
    let reconciled = matches!(object.get("reconciliationStatus").and_then(Value::as_str), Some("matched") | Some("created"));
    Some((
        id,
        date,
        description.clone(),
        normalize_text(&format!("{description} {category} {account_name}")),
        category,
        account_id,
        destination_account_id,
        value_money_cents(object, "amount"),
        transaction_type,
        status,
        source_type,
        reconciled,
        account_name,
    ))
}

async fn index_state(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<Option<(String, String)>, String> {
    let row = sqlx::query(
        "SELECT source_checksum, source_updated_at FROM performance_index_state WHERE workspace_id = $1 LIMIT 1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    row.map(|row| {
        Ok((
            row.try_get("source_checksum").map_err(to_error)?,
            row.try_get("source_updated_at").map_err(to_error)?,
        ))
    })
    .transpose()
}

async fn rebuild_index_internal(
    app: &AppHandle,
    connection: &mut SqliteConnection,
    workspace_id: &str,
    operation_id: &str,
    items: &[Value],
    checksum: &str,
    source_updated_at: &str,
    batch_size: i64,
    auto_analyze: bool,
) -> Result<bool, String> {
    let total = items.len() as i64;
    begin_operation(
        connection,
        operation_id,
        workspace_id,
        "transaction_index",
        total,
        &json!({ "sourceChecksum": checksum, "sourceUpdatedAt": source_updated_at, "batchSize": batch_size }),
    )
    .await?;
    emit_progress(app, operation_id, "transaction_index", "running", 0, total, "Preparando índice de lançamentos.");

    sqlx::query("DELETE FROM finance_transaction_index WHERE workspace_id = $1")
        .bind(workspace_id)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    sqlx::query("DELETE FROM performance_index_state WHERE workspace_id = $1")
        .bind(workspace_id)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;

    let size = clamp(batch_size, MIN_BATCH_SIZE, MAX_BATCH_SIZE) as usize;
    let indexed_at = Utc::now().to_rfc3339();
    let started = Instant::now();
    let mut processed = 0i64;
    for chunk in items.chunks(size) {
        if operation_cancelled(connection, operation_id).await? {
            finish_operation(connection, operation_id, "cancelled", processed, None).await?;
            record_metric(
                connection,
                workspace_id,
                "transaction_index",
                processed,
                started.elapsed().as_millis() as i64,
                "cancelled",
                true,
                &json!({ "total": total }),
            )
            .await?;
            emit_progress(app, operation_id, "transaction_index", "cancelled", processed, total, "Indexação cancelada com segurança.");
            return Ok(false);
        }
        let mut transaction = connection.begin().await.map_err(to_error)?;
        for value in chunk {
            let Some((id, date, description, normalized, category, account_id, destination_account_id, amount_cents, kind, status, source_type, reconciled, account_name)) = index_values(value) else { continue };
            sqlx::query(
                r#"INSERT INTO finance_transaction_index (
                     workspace_id, transaction_id, transaction_date, description,
                     normalized_description, category, account_id, account_name,
                     destination_account_id, amount_cents, transaction_type,
                     transaction_status, source_type, reconciled, data_json, indexed_at
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)"#,
            )
            .bind(workspace_id)
            .bind(id)
            .bind(date)
            .bind(description)
            .bind(normalized)
            .bind(category)
            .bind(account_id)
            .bind(account_name)
            .bind(destination_account_id)
            .bind(amount_cents)
            .bind(kind)
            .bind(status)
            .bind(source_type)
            .bind(if reconciled { 1 } else { 0 })
            .bind(serde_json::to_string(value).map_err(to_error)?)
            .bind(&indexed_at)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        }
        transaction.commit().await.map_err(to_error)?;
        processed = (processed + chunk.len() as i64).min(total);
        update_operation_progress(connection, operation_id, processed).await?;
        emit_progress(app, operation_id, "transaction_index", "running", processed, total, format!("{processed} de {total} lançamentos indexados."));
    }

    sqlx::query(
        "INSERT INTO performance_index_state (workspace_id, source_checksum, source_updated_at, item_count, indexed_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(workspace_id) DO UPDATE SET source_checksum = excluded.source_checksum, source_updated_at = excluded.source_updated_at, item_count = excluded.item_count, indexed_at = excluded.indexed_at",
    )
    .bind(workspace_id)
    .bind(checksum)
    .bind(source_updated_at)
    .bind(total)
    .bind(&indexed_at)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    if auto_analyze {
        sqlx::query("ANALYZE finance_transaction_index")
            .execute(&mut *connection)
            .await
            .map_err(to_error)?;
        let analyzed_at = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO performance_preferences (workspace_id, transaction_page_size, import_batch_size, query_timeout_ms, auto_analyze, last_analyze_at, updated_at) VALUES ($1, 50, 500, 250, 1, $2, $2) ON CONFLICT(workspace_id) DO UPDATE SET last_analyze_at = excluded.last_analyze_at, updated_at = excluded.updated_at",
        )
        .bind(workspace_id)
        .bind(&analyzed_at)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
    }
    finish_operation(connection, operation_id, "completed", total, None).await?;
    record_metric(
        connection,
        workspace_id,
        "transaction_index",
        total,
        started.elapsed().as_millis() as i64,
        "success",
        false,
        &json!({ "batchSize": size, "sourceChecksum": checksum }),
    )
    .await?;
    emit_progress(app, operation_id, "transaction_index", "completed", total, total, "Índice de lançamentos atualizado.");
    Ok(true)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionPageRequest {
    pub workspace_id: String,
    pub page: i64,
    pub page_size: Option<i64>,
    pub search: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    #[serde(rename = "type")]
    pub transaction_type: Option<String>,
    pub status: Option<String>,
    pub account_id: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionPage {
    pub items: Vec<Value>,
    pub page: i64,
    pub page_size: i64,
    pub total_items: i64,
    pub total_pages: i64,
    pub source_checksum: String,
    pub index_rebuilt: bool,
    pub duration_ms: i64,
}

fn matches_fallback(value: &Value, request: &TransactionPageRequest) -> bool {
    let Some(object) = value.as_object() else { return false };
    let date = value_string(object, "date");
    if request.date_from.as_ref().is_some_and(|from| date.as_str() < from.as_str()) { return false; }
    if request.date_to.as_ref().is_some_and(|to| date.as_str() > to.as_str()) { return false; }
    if request.transaction_type.as_ref().is_some_and(|kind| value_string(object, "type").as_str() != kind.as_str()) { return false; }
    if request.status.as_ref().is_some_and(|status| value_string(object, "status").as_str() != status.as_str()) { return false; }
    if request.category.as_ref().is_some_and(|category| value_string(object, "category").as_str() != category.as_str()) { return false; }
    if request.account_id.as_ref().is_some_and(|account| {
        value_string(object, "accountId").as_str() != account.as_str() && value_string(object, "account").as_str() != account.as_str()
    }) { return false; }
    if let Some(search) = request.search.as_ref().map(|value| normalize_text(value)).filter(|value| !value.is_empty()) {
        let haystack = normalize_text(&format!("{} {} {}", value_string(object, "description"), value_string(object, "category"), value_string(object, "account")));
        if !haystack.contains(&search) { return false; }
    }
    true
}

fn fallback_page(
    mut items: Vec<Value>,
    request: &TransactionPageRequest,
    page_size: i64,
    checksum: String,
    started: Instant,
) -> TransactionPage {
    items.retain(|value| matches_fallback(value, request));
    items.sort_by(|left, right| {
        let left_object = left.as_object();
        let right_object = right.as_object();
        let left_key = left_object.map(|object| format!("{}:{}", value_string(object, "date"), value_string(object, "id"))).unwrap_or_default();
        let right_key = right_object.map(|object| format!("{}:{}", value_string(object, "date"), value_string(object, "id"))).unwrap_or_default();
        right_key.cmp(&left_key)
    });
    let total_items = items.len() as i64;
    let total_pages = ((total_items + page_size - 1) / page_size).max(1);
    let page = clamp(request.page, 1, total_pages);
    let start = ((page - 1) * page_size) as usize;
    let end = (start + page_size as usize).min(items.len());
    TransactionPage {
        items: if start < items.len() { items[start..end].to_vec() } else { Vec::new() },
        page,
        page_size,
        total_items,
        total_pages,
        source_checksum: checksum,
        index_rebuilt: false,
        duration_ms: started.elapsed().as_millis() as i64,
    }
}

#[tauri::command(async)]
pub fn performance_list_transactions_page(
    app: AppHandle,
    request: TransactionPageRequest,
) -> Result<TransactionPage, String> {
    run_local_async_worker("finnacialux-performance-page", move || async move {
        let started = Instant::now();
        let state = app.state::<EncryptedDatabaseState>();
        let access = state.access_status();
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
        let page_size = clamp(request.page_size.unwrap_or(preferences.transaction_page_size), MIN_PAGE_SIZE, MAX_PAGE_SIZE);
        let source_updated_at = transaction_document_updated_at(&mut connection, &request.workspace_id).await?;
        let stored_index = index_state(&mut connection, &request.workspace_id).await?;
        let current = stored_index
            .as_ref()
            .is_some_and(|(_, indexed_updated_at)| indexed_updated_at == &source_updated_at);
        let mut checksum = stored_index
            .as_ref()
            .map(|(stored_checksum, _)| stored_checksum.clone())
            .unwrap_or_default();
        let mut index_rebuilt = false;
        if !current {
            let (fresh_checksum, document_updated_at, source_json) =
                transaction_document(&mut connection, &request.workspace_id).await?;
            checksum = fresh_checksum;
            let source_items = parse_transaction_items(&source_json)?;
            if access.read_only {
                let result = fallback_page(source_items, &request, page_size, checksum, started);
                connection.close().await.map_err(to_error)?;
                return Ok(result);
            }
            let operation_id = format!("transaction-index-{}", Uuid::new_v4());
            index_rebuilt = rebuild_index_internal(
                &app,
                &mut connection,
                &request.workspace_id,
                &operation_id,
                &source_items,
                &checksum,
                &document_updated_at,
                preferences.import_batch_size,
                preferences.auto_analyze,
            )
            .await?;
            if !index_rebuilt {
                connection.close().await.map_err(to_error)?;
                return Err("A atualização do índice foi cancelada.".to_string());
            }
        }

        let search = request.search.as_ref().map(|value| normalize_text(value)).filter(|value| !value.is_empty());
        let page = request.page.max(1);
        let total_items = sqlx::query_scalar::<_, i64>(
            r#"SELECT COUNT(*) FROM finance_transaction_index
               WHERE workspace_id = $1
                 AND ($2 IS NULL OR transaction_date >= $2)
                 AND ($3 IS NULL OR transaction_date <= $3)
                 AND ($4 IS NULL OR transaction_type = $4)
                 AND ($5 IS NULL OR transaction_status = $5)
                 AND ($6 IS NULL OR account_id = $6 OR account_name = $6)
                 AND ($7 IS NULL OR category = $7)
                 AND ($8 IS NULL OR normalized_description LIKE '%' || $8 || '%')"#,
        )
        .bind(&request.workspace_id)
        .bind(&request.date_from)
        .bind(&request.date_to)
        .bind(&request.transaction_type)
        .bind(&request.status)
        .bind(&request.account_id)
        .bind(&request.category)
        .bind(&search)
        .fetch_one(&mut connection)
        .await
        .map_err(to_error)?;
        let total_pages = ((total_items + page_size - 1) / page_size).max(1);
        let normalized_page = clamp(page, 1, total_pages);
        let normalized_offset = (normalized_page - 1) * page_size;
        let rows = sqlx::query(
            r#"SELECT data_json FROM finance_transaction_index
               WHERE workspace_id = $1
                 AND ($2 IS NULL OR transaction_date >= $2)
                 AND ($3 IS NULL OR transaction_date <= $3)
                 AND ($4 IS NULL OR transaction_type = $4)
                 AND ($5 IS NULL OR transaction_status = $5)
                 AND ($6 IS NULL OR account_id = $6 OR account_name = $6)
                 AND ($7 IS NULL OR category = $7)
                 AND ($8 IS NULL OR normalized_description LIKE '%' || $8 || '%')
               ORDER BY transaction_date DESC, transaction_id DESC
               LIMIT $9 OFFSET $10"#,
        )
        .bind(&request.workspace_id)
        .bind(&request.date_from)
        .bind(&request.date_to)
        .bind(&request.transaction_type)
        .bind(&request.status)
        .bind(&request.account_id)
        .bind(&request.category)
        .bind(&search)
        .bind(page_size)
        .bind(normalized_offset)
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        let items = rows
            .into_iter()
            .map(|row| row.try_get::<String, _>("data_json").map_err(to_error))
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .map(|data| serde_json::from_str::<Value>(&data).map_err(to_error))
            .collect::<Result<Vec<_>, _>>()?;
        let duration_ms = started.elapsed().as_millis() as i64;
        if !access.read_only {
            record_metric(
                &mut connection,
                &request.workspace_id,
                "transaction_page",
                items.len() as i64,
                duration_ms,
                "success",
                false,
                &json!({ "page": normalized_page, "pageSize": page_size, "totalItems": total_items }),
            )
            .await?;
        }
        connection.close().await.map_err(to_error)?;
        Ok(TransactionPage {
            items,
            page: normalized_page,
            page_size,
            total_items,
            total_pages,
            source_checksum: checksum,
            index_rebuilt,
            duration_ms,
        })
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceOperation {
    pub id: String,
    pub workspace_id: String,
    pub kind: String,
    pub status: String,
    pub progress_current: i64,
    pub progress_total: i64,
    pub cancellation_requested: bool,
    pub details: Value,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn operation_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<PerformanceOperation, String> {
    let details_json: String = row.try_get("details_json").map_err(to_error)?;
    Ok(PerformanceOperation {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        kind: row.try_get("kind").map_err(to_error)?,
        status: row.try_get("status").map_err(to_error)?,
        progress_current: row.try_get("progress_current").map_err(to_error)?,
        progress_total: row.try_get("progress_total").map_err(to_error)?,
        cancellation_requested: row.try_get::<i64, _>("cancellation_requested").map_err(to_error)? != 0,
        details: serde_json::from_str(&details_json).unwrap_or_else(|_| json!({})),
        error_message: row.try_get("error_message").map_err(to_error)?,
        started_at: row.try_get("started_at").map_err(to_error)?,
        completed_at: row.try_get("completed_at").map_err(to_error)?,
        created_at: row.try_get("created_at").map_err(to_error)?,
        updated_at: row.try_get("updated_at").map_err(to_error)?,
    })
}

#[tauri::command(async)]
pub fn performance_rebuild_transaction_index(
    app: AppHandle,
    workspace_id: String,
    operation_id: String,
) -> Result<PerformanceOperation, String> {
    run_local_async_worker("finnacialux-performance-rebuild", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &workspace_id).await?;
        let (checksum, source_updated_at, source_json) = transaction_document(&mut connection, &workspace_id).await?;
        let items = parse_transaction_items(&source_json)?;
        rebuild_index_internal(
            &app,
            &mut connection,
            &workspace_id,
            &operation_id,
            &items,
            &checksum,
            &source_updated_at,
            preferences.import_batch_size,
            preferences.auto_analyze,
        )
        .await?;
        let row = sqlx::query("SELECT * FROM performance_operation_jobs WHERE id = $1 AND workspace_id = $2")
            .bind(&operation_id)
            .bind(&workspace_id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = operation_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn performance_cancel_operation(
    app: AppHandle,
    workspace_id: String,
    operation_id: String,
) -> Result<(), String> {
    run_local_async_worker("finnacialux-performance-cancel", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        sqlx::query(
            "UPDATE performance_operation_jobs SET cancellation_requested = 1, updated_at = $1 WHERE id = $2 AND workspace_id = $3 AND status IN ('queued', 'running')",
        )
        .bind(Utc::now().to_rfc3339())
        .bind(&operation_id)
        .bind(&workspace_id)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        Ok(())
    })
}

#[tauri::command(async)]
pub fn performance_list_operations(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<PerformanceOperation>, String> {
    run_local_async_worker("finnacialux-performance-operations", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query("SELECT * FROM performance_operation_jobs WHERE workspace_id = $1 ORDER BY updated_at DESC LIMIT $2")
            .bind(&workspace_id)
            .bind(clamp(limit.unwrap_or(50), 1, 200))
            .fetch_all(&mut connection)
            .await
            .map_err(to_error)?;
        let result = rows.iter().map(operation_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceMetric {
    pub id: String,
    pub workspace_id: String,
    pub operation_type: String,
    pub item_count: i64,
    pub duration_ms: i64,
    pub status: String,
    pub cancelled: bool,
    pub details: Value,
    pub created_at: String,
}

#[tauri::command(async)]
pub fn performance_list_metrics(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<PerformanceMetric>, String> {
    run_local_async_worker("finnacialux-performance-metrics", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query("SELECT * FROM performance_operation_metrics WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2")
            .bind(&workspace_id)
            .bind(clamp(limit.unwrap_or(50), 1, 200))
            .fetch_all(&mut connection)
            .await
            .map_err(to_error)?;
        let result = rows.into_iter().map(|row| {
            let details_json: String = row.try_get("details_json").map_err(to_error)?;
            Ok(PerformanceMetric {
                id: row.try_get("id").map_err(to_error)?,
                workspace_id: row.try_get("workspace_id").map_err(to_error)?,
                operation_type: row.try_get("operation_type").map_err(to_error)?,
                item_count: row.try_get("item_count").map_err(to_error)?,
                duration_ms: row.try_get("duration_ms").map_err(to_error)?,
                status: row.try_get("status").map_err(to_error)?,
                cancelled: row.try_get::<i64, _>("cancelled").map_err(to_error)? != 0,
                details: serde_json::from_str(&details_json).unwrap_or_else(|_| json!({})),
                created_at: row.try_get("created_at").map_err(to_error)?,
            })
        }).collect::<Result<Vec<_>, String>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabasePerformanceHealth {
    pub schema_version: i64,
    pub page_count: i64,
    pub free_pages: i64,
    pub page_size_bytes: i64,
    pub database_size_bytes: i64,
    pub reusable_bytes: i64,
    pub reusable_percent: f64,
    pub journal_mode: String,
    pub transaction_index_rows: i64,
    pub indexed_workspaces: i64,
    pub metrics_count: i64,
    pub running_operations: i64,
    pub last_analyze_at: Option<String>,
}

async fn read_health(connection: &mut SqliteConnection, workspace_id: &str) -> Result<DatabasePerformanceHealth, String> {
    let schema_version = sqlx::query_scalar::<_, i64>("PRAGMA user_version").fetch_one(&mut *connection).await.map_err(to_error)?;
    let page_count = sqlx::query_scalar::<_, i64>("PRAGMA page_count").fetch_one(&mut *connection).await.map_err(to_error)?;
    let free_pages = sqlx::query_scalar::<_, i64>("PRAGMA freelist_count").fetch_one(&mut *connection).await.map_err(to_error)?;
    let page_size = sqlx::query_scalar::<_, i64>("PRAGMA page_size").fetch_one(&mut *connection).await.map_err(to_error)?;
    let journal_mode = sqlx::query_scalar::<_, String>("PRAGMA journal_mode").fetch_one(&mut *connection).await.map_err(to_error)?;
    let transaction_index_rows = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM finance_transaction_index WHERE workspace_id = $1")
        .bind(workspace_id).fetch_one(&mut *connection).await.map_err(to_error)?;
    let indexed_workspaces = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM performance_index_state")
        .fetch_one(&mut *connection).await.map_err(to_error)?;
    let metrics_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM performance_operation_metrics WHERE workspace_id = $1")
        .bind(workspace_id).fetch_one(&mut *connection).await.map_err(to_error)?;
    let running_operations = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM performance_operation_jobs WHERE workspace_id = $1 AND status IN ('queued', 'running')")
        .bind(workspace_id).fetch_one(&mut *connection).await.map_err(to_error)?;
    let last_analyze_at = sqlx::query_scalar::<_, Option<String>>("SELECT last_analyze_at FROM performance_preferences WHERE workspace_id = $1")
        .bind(workspace_id).fetch_optional(&mut *connection).await.map_err(to_error)?.flatten();
    let reusable_percent = if page_count <= 0 { 0.0 } else { ((free_pages as f64 / page_count as f64) * 10_000.0).round() / 100.0 };
    Ok(DatabasePerformanceHealth {
        schema_version,
        page_count,
        free_pages,
        page_size_bytes: page_size,
        database_size_bytes: page_count.saturating_mul(page_size),
        reusable_bytes: free_pages.saturating_mul(page_size),
        reusable_percent,
        journal_mode,
        transaction_index_rows,
        indexed_workspaces,
        metrics_count,
        running_operations,
        last_analyze_at,
    })
}

#[tauri::command(async)]
pub fn performance_get_database_health(
    app: AppHandle,
    workspace_id: String,
) -> Result<DatabasePerformanceHealth, String> {
    run_local_async_worker("finnacialux-performance-health", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let result = read_health(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceResult {
    pub analyzed: bool,
    pub optimized: bool,
    pub checkpointed: bool,
    pub duration_ms: i64,
    pub health: DatabasePerformanceHealth,
}

#[tauri::command(async)]
pub fn performance_run_database_maintenance(
    app: AppHandle,
    workspace_id: String,
) -> Result<MaintenanceResult, String> {
    run_local_async_worker("finnacialux-performance-maintenance", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let started = Instant::now();
        let operation_id = format!("database-maintenance-{}", Uuid::new_v4());
        let mut connection = connect_app_database(&app, &state).await?;
        begin_operation(&mut connection, &operation_id, &workspace_id, "database_maintenance", 3, &json!({})).await?;
        emit_progress(&app, &operation_id, "database_maintenance", "running", 0, 3, "Analisando estatísticas locais.");
        sqlx::query("ANALYZE").execute(&mut connection).await.map_err(to_error)?;
        update_operation_progress(&mut connection, &operation_id, 1).await?;
        emit_progress(&app, &operation_id, "database_maintenance", "running", 1, 3, "Otimizando o plano de consultas.");
        sqlx::query("PRAGMA optimize").execute(&mut connection).await.map_err(to_error)?;
        update_operation_progress(&mut connection, &operation_id, 2).await?;
        emit_progress(&app, &operation_id, "database_maintenance", "running", 2, 3, "Consolidando o journal do banco.");
        let checkpointed = sqlx::query("PRAGMA wal_checkpoint(PASSIVE)").fetch_all(&mut connection).await.is_ok();
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO performance_preferences (workspace_id, transaction_page_size, import_batch_size, query_timeout_ms, auto_analyze, last_analyze_at, updated_at) VALUES ($1, 50, 500, 250, 1, $2, $2) ON CONFLICT(workspace_id) DO UPDATE SET last_analyze_at = excluded.last_analyze_at, updated_at = excluded.updated_at",
        )
        .bind(&workspace_id)
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        finish_operation(&mut connection, &operation_id, "completed", 3, None).await?;
        let duration_ms = started.elapsed().as_millis() as i64;
        record_metric(&mut connection, &workspace_id, "database_maintenance", 3, duration_ms, "success", false, &json!({ "checkpointed": checkpointed })).await?;
        let health = read_health(&mut connection, &workspace_id).await?;
        emit_progress(&app, &operation_id, "database_maintenance", "completed", 3, 3, "Manutenção concluída.");
        connection.close().await.map_err(to_error)?;
        Ok(MaintenanceResult { analyzed: true, optimized: true, checkpointed, duration_ms, health })
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionBenchmarkResult {
    pub total_items: i64,
    pub first_page_ms: i64,
    pub last_page_ms: i64,
    pub average_page_ms: f64,
    pub page_size: i64,
    pub target_ms: i64,
    pub within_target: bool,
    pub source_checksum: String,
}

#[tauri::command(async)]
pub fn performance_benchmark_transactions(
    app: AppHandle,
    workspace_id: String,
) -> Result<TransactionBenchmarkResult, String> {
    run_local_async_worker("finnacialux-performance-benchmark", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &workspace_id).await?;
        let source_updated_at = transaction_document_updated_at(&mut connection, &workspace_id).await?;
        let stored_index = index_state(&mut connection, &workspace_id).await?;
        let index_current = stored_index
            .as_ref()
            .is_some_and(|(_, indexed_updated_at)| indexed_updated_at == &source_updated_at);
        let read_only = state.access_status().read_only;
        let (checksum, document_updated_at, source_items) = if index_current {
            (
                stored_index
                    .as_ref()
                    .map(|(stored_checksum, _)| stored_checksum.clone())
                    .unwrap_or_default(),
                source_updated_at,
                None,
            )
        } else {
            let (fresh_checksum, fresh_updated_at, source_json) =
                transaction_document(&mut connection, &workspace_id).await?;
            (
                fresh_checksum,
                fresh_updated_at,
                Some(parse_transaction_items(&source_json)?),
            )
        };
        if !index_current && !read_only {
            let operation_id = format!("transaction-index-{}", Uuid::new_v4());
            let rebuilt = rebuild_index_internal(
                &app,
                &mut connection,
                &workspace_id,
                &operation_id,
                source_items.as_deref().unwrap_or_default(),
                &checksum,
                &document_updated_at,
                preferences.import_batch_size,
                preferences.auto_analyze,
            )
            .await?;
            if !rebuilt {
                connection.close().await.map_err(to_error)?;
                return Err("O benchmark foi cancelado durante a atualização do índice.".to_string());
            }
        }
        if !index_current && read_only {
            let items = source_items.as_deref().unwrap_or_default();
            let page_size = clamp(preferences.transaction_page_size, MIN_PAGE_SIZE, MAX_PAGE_SIZE) as usize;
            let first_started = Instant::now();
            let _first = items.iter().take(page_size).collect::<Vec<_>>();
            let first_page_ms = first_started.elapsed().as_millis() as i64;
            let last_started = Instant::now();
            let _last = items.iter().rev().take(page_size).collect::<Vec<_>>();
            let last_page_ms = last_started.elapsed().as_millis() as i64;
            let average_page_ms = ((first_page_ms + last_page_ms) as f64 / 2.0 * 100.0).round() / 100.0;
            connection.close().await.map_err(to_error)?;
            return Ok(TransactionBenchmarkResult {
                total_items: items.len() as i64,
                first_page_ms,
                last_page_ms,
                average_page_ms,
                page_size: page_size as i64,
                target_ms: preferences.query_timeout_ms,
                within_target: average_page_ms <= preferences.query_timeout_ms as f64,
                source_checksum: checksum,
            });
        }
        let total_items = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM finance_transaction_index WHERE workspace_id = $1")
            .bind(&workspace_id).fetch_one(&mut connection).await.map_err(to_error)?;
        let page_size = clamp(preferences.transaction_page_size, MIN_PAGE_SIZE, MAX_PAGE_SIZE);
        let first_started = Instant::now();
        sqlx::query("SELECT transaction_id FROM finance_transaction_index WHERE workspace_id = $1 ORDER BY transaction_date DESC, transaction_id DESC LIMIT $2")
            .bind(&workspace_id).bind(page_size).fetch_all(&mut connection).await.map_err(to_error)?;
        let first_page_ms = first_started.elapsed().as_millis() as i64;
        let last_offset = (total_items - page_size).max(0);
        let last_started = Instant::now();
        sqlx::query("SELECT transaction_id FROM finance_transaction_index WHERE workspace_id = $1 ORDER BY transaction_date DESC, transaction_id DESC LIMIT $2 OFFSET $3")
            .bind(&workspace_id).bind(page_size).bind(last_offset).fetch_all(&mut connection).await.map_err(to_error)?;
        let last_page_ms = last_started.elapsed().as_millis() as i64;
        let average_page_ms = ((first_page_ms + last_page_ms) as f64 / 2.0 * 100.0).round() / 100.0;
        let result = TransactionBenchmarkResult {
            total_items,
            first_page_ms,
            last_page_ms,
            average_page_ms,
            page_size,
            target_ms: preferences.query_timeout_ms,
            within_target: average_page_ms <= preferences.query_timeout_ms as f64,
            source_checksum: checksum,
        };
        if !read_only {
            record_metric(&mut connection, &workspace_id, "benchmark", total_items, first_page_ms + last_page_ms, "success", false, &serde_json::to_value(&result).map_err(to_error)?).await?;
        }
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamps_page_and_batch_limits() {
        assert_eq!(clamp(1, MIN_PAGE_SIZE, MAX_PAGE_SIZE), 25);
        assert_eq!(clamp(9_000, MIN_BATCH_SIZE, MAX_BATCH_SIZE), 2_000);
    }

    #[test]
    fn normalizes_search_text_without_accents() {
        assert_eq!(normalize_text("Cartão — Alimentação"), "cartao alimentacao");
    }

    #[test]
    fn index_values_preserve_account_and_money() {
        let value = json!({
            "id": "tx-1", "date": "2026-07-31", "description": "Mercado",
            "category": "Alimentação", "accountId": "account-1", "account": "Carteira",
            "amount": 12.34, "type": "expense", "status": "completed"
        });
        let values = index_values(&value).expect("transação válida");
        assert_eq!(values.0, "tx-1");
        assert_eq!(values.7, 1_234);
    }
}
