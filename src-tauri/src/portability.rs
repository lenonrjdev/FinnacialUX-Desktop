use crate::{command_worker::run_local_async_worker, encrypted_database::{connect_app_database, EncryptedDatabaseState}};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{Connection, Row};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortabilityOperationInput {
    pub id: Option<String>,
    pub direction: String,
    pub format: String,
    pub dataset: String,
    pub file_name: String,
    pub checksum_sha256: Option<String>,
    pub records_total: Option<i64>,
    pub records_applied: Option<i64>,
    pub records_rejected: Option<i64>,
    pub affected_modules: Option<Vec<String>>,
    pub status: Option<String>,
    pub reversible: Option<bool>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPortabilityRequest {
    pub workspace_id: String,
    pub documents: Map<String, Value>,
    pub mode: String,
    pub operation: PortabilityOperationInput,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortabilityOperation {
    pub id: String,
    pub workspace_id: String,
    pub direction: String,
    pub format: String,
    pub dataset: String,
    pub file_name: String,
    pub checksum_sha256: Option<String>,
    pub records_total: i64,
    pub records_applied: i64,
    pub records_rejected: i64,
    pub affected_modules: Vec<String>,
    pub status: String,
    pub reversible: bool,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
}

fn count_records(documents: &Map<String, Value>) -> i64 {
    documents.values().map(|value| match value {
        Value::Array(items) => items.len() as i64,
        Value::Null => 0,
        _ => 1,
    }).sum()
}

fn normalize_operation(
    workspace_id: &str,
    input: PortabilityOperationInput,
    modules: Vec<String>,
    default_records: i64,
    force_reversible: Option<bool>,
) -> PortabilityOperation {
    let now = Utc::now().to_rfc3339();
    PortabilityOperation {
        id: input.id.unwrap_or_else(|| format!("port-{}", Uuid::new_v4())),
        workspace_id: workspace_id.to_string(),
        direction: input.direction,
        format: input.format,
        dataset: input.dataset,
        file_name: input.file_name,
        checksum_sha256: input.checksum_sha256,
        records_total: input.records_total.unwrap_or(default_records),
        records_applied: input.records_applied.unwrap_or(default_records),
        records_rejected: input.records_rejected.unwrap_or(0),
        affected_modules: input.affected_modules.unwrap_or(modules),
        status: input.status.unwrap_or_else(|| "completed".to_string()),
        reversible: force_reversible.unwrap_or_else(|| input.reversible.unwrap_or(false)),
        created_at: now.clone(),
        completed_at: Some(now),
        error_message: input.error_message,
    }
}

async fn insert_operation(
    connection: &mut sqlx::SqliteConnection,
    operation: &PortabilityOperation,
    undo_snapshot: Option<&Map<String, Value>>,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO portability_operations (
             id, workspace_id, direction, format, dataset, file_name, checksum_sha256,
             records_total, records_applied, records_rejected, affected_modules_json,
             undo_snapshot_json, status, reversible, created_at, completed_at, error_message
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)"#,
    )
    .bind(&operation.id)
    .bind(&operation.workspace_id)
    .bind(&operation.direction)
    .bind(&operation.format)
    .bind(&operation.dataset)
    .bind(&operation.file_name)
    .bind(&operation.checksum_sha256)
    .bind(operation.records_total)
    .bind(operation.records_applied)
    .bind(operation.records_rejected)
    .bind(serde_json::to_string(&operation.affected_modules).map_err(|error| error.to_string())?)
    .bind(match undo_snapshot {
        Some(snapshot) => Some(serde_json::to_string(snapshot).map_err(|error| error.to_string())?),
        None => None,
    })
    .bind(&operation.status)
    .bind(if operation.reversible { 1 } else { 0 })
    .bind(&operation.created_at)
    .bind(&operation.completed_at)
    .bind(&operation.error_message)
    .execute(connection)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

async fn read_documents(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<Map<String, Value>, String> {
    let rows = sqlx::query(
        "SELECT module, data_json FROM finance_documents WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_all(&mut *connection)
    .await
    .map_err(|error| error.to_string())?;
    let mut documents = Map::new();
    for row in rows {
        let module: String = row.try_get("module").map_err(|error| error.to_string())?;
        let data_json: String = row.try_get("data_json").map_err(|error| error.to_string())?;
        let value = serde_json::from_str::<Value>(&data_json).map_err(|error| error.to_string())?;
        documents.insert(module, value);
    }
    Ok(documents)
}

async fn get_workspace_documents_internal(
    app: &AppHandle,
    workspace_id: String,
) -> Result<Map<String, Value>, String> {
    let state = app.state::<EncryptedDatabaseState>();
    let mut connection = connect_app_database(app, &state).await?;
    let documents = read_documents(&mut connection, &workspace_id).await?;
    connection.close().await.map_err(|error| error.to_string())?;
    Ok(documents)
}

#[tauri::command(async)]
pub fn portability_get_workspace_documents(
    app: AppHandle,
    workspace_id: String,
) -> Result<Map<String, Value>, String> {
    run_local_async_worker("finnacialux-portability-read", move || async move {
        get_workspace_documents_internal(&app, workspace_id).await
    })
}

async fn apply_documents_internal(
    app: &AppHandle,
    request: ApplyPortabilityRequest,
) -> Result<PortabilityOperation, String> {
    let state = app.state::<EncryptedDatabaseState>();
    let mut connection = connect_app_database(app, &state).await?;
    let snapshot = read_documents(&mut connection, &request.workspace_id).await?;
    let modules = request.documents.keys().cloned().collect::<Vec<_>>();
    let records = count_records(&request.documents);
    let operation = normalize_operation(
        &request.workspace_id,
        request.operation,
        modules,
        records,
        Some(true),
    );
    let mut transaction = connection.begin().await.map_err(|error| error.to_string())?;
    if request.mode == "replace" {
        sqlx::query("DELETE FROM finance_documents WHERE workspace_id = $1")
            .bind(&request.workspace_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
    }
    for (module, data) in request.documents {
        sqlx::query(
            r#"INSERT INTO finance_documents (workspace_id, module, data_json, updated_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(workspace_id, module)
               DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"#,
        )
        .bind(&request.workspace_id)
        .bind(module)
        .bind(serde_json::to_string(&data).map_err(|error| error.to_string())?)
        .bind(&operation.created_at)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    }
    sqlx::query("UPDATE workspaces SET last_activity_at = $1 WHERE id = $2")
        .bind(&operation.created_at)
        .bind(&request.workspace_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    insert_operation(&mut *transaction, &operation, Some(&snapshot)).await?;
    transaction.commit().await.map_err(|error| error.to_string())?;
    connection.close().await.map_err(|error| error.to_string())?;
    Ok(operation)
}

#[tauri::command(async)]
pub fn portability_apply_documents(
    app: AppHandle,
    request: ApplyPortabilityRequest,
) -> Result<PortabilityOperation, String> {
    run_local_async_worker("finnacialux-portability-apply", move || async move {
        apply_documents_internal(&app, request).await
    })
}

async fn record_operation_internal(
    app: &AppHandle,
    workspace_id: String,
    input: PortabilityOperationInput,
) -> Result<PortabilityOperation, String> {
    let state = app.state::<EncryptedDatabaseState>();
    let mut connection = connect_app_database(app, &state).await?;
    let modules = input.affected_modules.clone().unwrap_or_default();
    let operation = normalize_operation(&workspace_id, input, modules, 0, Some(false));
    insert_operation(&mut connection, &operation, None).await?;
    connection.close().await.map_err(|error| error.to_string())?;
    Ok(operation)
}

#[tauri::command(async)]
pub fn portability_record_operation(
    app: AppHandle,
    workspace_id: String,
    operation: PortabilityOperationInput,
) -> Result<PortabilityOperation, String> {
    run_local_async_worker("finnacialux-portability-record", move || async move {
        record_operation_internal(&app, workspace_id, operation).await
    })
}

async fn list_operations_internal(
    app: &AppHandle,
    workspace_id: String,
) -> Result<Vec<PortabilityOperation>, String> {
    let state = app.state::<EncryptedDatabaseState>();
    let mut connection = connect_app_database(app, &state).await?;
    let rows = sqlx::query(
        r#"SELECT id, workspace_id, direction, format, dataset, file_name, checksum_sha256,
                  records_total, records_applied, records_rejected, affected_modules_json,
                  status, reversible, created_at, completed_at, error_message
             FROM portability_operations
            WHERE workspace_id = $1
            ORDER BY created_at DESC
            LIMIT 100"#,
    )
    .bind(&workspace_id)
    .fetch_all(&mut connection)
    .await
    .map_err(|error| error.to_string())?;
    let mut operations = Vec::with_capacity(rows.len());
    for row in rows {
        let affected_modules_json: String = row.try_get("affected_modules_json").map_err(|error| error.to_string())?;
        operations.push(PortabilityOperation {
            id: row.try_get("id").map_err(|error| error.to_string())?,
            workspace_id: row.try_get("workspace_id").map_err(|error| error.to_string())?,
            direction: row.try_get("direction").map_err(|error| error.to_string())?,
            format: row.try_get("format").map_err(|error| error.to_string())?,
            dataset: row.try_get("dataset").map_err(|error| error.to_string())?,
            file_name: row.try_get("file_name").map_err(|error| error.to_string())?,
            checksum_sha256: row.try_get("checksum_sha256").map_err(|error| error.to_string())?,
            records_total: row.try_get("records_total").map_err(|error| error.to_string())?,
            records_applied: row.try_get("records_applied").map_err(|error| error.to_string())?,
            records_rejected: row.try_get("records_rejected").map_err(|error| error.to_string())?,
            affected_modules: serde_json::from_str(&affected_modules_json).map_err(|error| error.to_string())?,
            status: row.try_get("status").map_err(|error| error.to_string())?,
            reversible: row.try_get::<i64, _>("reversible").map_err(|error| error.to_string())? == 1,
            created_at: row.try_get("created_at").map_err(|error| error.to_string())?,
            completed_at: row.try_get("completed_at").map_err(|error| error.to_string())?,
            error_message: row.try_get("error_message").map_err(|error| error.to_string())?,
        });
    }
    connection.close().await.map_err(|error| error.to_string())?;
    Ok(operations)
}

#[tauri::command(async)]
pub fn portability_list_operations(
    app: AppHandle,
    workspace_id: String,
) -> Result<Vec<PortabilityOperation>, String> {
    run_local_async_worker("finnacialux-portability-list", move || async move {
        list_operations_internal(&app, workspace_id).await
    })
}

async fn undo_operation_internal(
    app: &AppHandle,
    workspace_id: String,
    operation_id: String,
) -> Result<(), String> {
    let state = app.state::<EncryptedDatabaseState>();
    let mut connection = connect_app_database(app, &state).await?;
    let row = sqlx::query(
        r#"SELECT undo_snapshot_json, reversible, status
             FROM portability_operations
            WHERE id = $1 AND workspace_id = $2
            LIMIT 1"#,
    )
    .bind(&operation_id)
    .bind(&workspace_id)
    .fetch_optional(&mut connection)
    .await
    .map_err(|error| error.to_string())?
    .ok_or_else(|| "Operação de portabilidade não encontrada.".to_string())?;
    let reversible: i64 = row.try_get("reversible").map_err(|error| error.to_string())?;
    let status: String = row.try_get("status").map_err(|error| error.to_string())?;
    let snapshot_json: Option<String> = row.try_get("undo_snapshot_json").map_err(|error| error.to_string())?;
    if reversible != 1 || status == "undone" {
        return Err("Esta operação não pode mais ser desfeita.".to_string());
    }
    let snapshot = serde_json::from_str::<Map<String, Value>>(
        snapshot_json.as_deref().ok_or_else(|| "Snapshot de recuperação ausente.".to_string())?,
    ).map_err(|error| error.to_string())?;
    let now = Utc::now().to_rfc3339();
    let mut transaction = connection.begin().await.map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM finance_documents WHERE workspace_id = $1")
        .bind(&workspace_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    for (module, data) in snapshot {
        sqlx::query("INSERT INTO finance_documents (workspace_id, module, data_json, updated_at) VALUES ($1, $2, $3, $4)")
            .bind(&workspace_id)
            .bind(module)
            .bind(serde_json::to_string(&data).map_err(|error| error.to_string())?)
            .bind(&now)
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
    }
    sqlx::query("UPDATE portability_operations SET status = 'undone', reversible = 0, completed_at = $1 WHERE id = $2")
        .bind(&now)
        .bind(&operation_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    let undo_operation = PortabilityOperation {
        id: format!("port-{}", Uuid::new_v4()),
        workspace_id: workspace_id.clone(),
        direction: "undo".to_string(),
        format: "internal".to_string(),
        dataset: "workspace".to_string(),
        file_name: format!("Desfazer {operation_id}"),
        checksum_sha256: None,
        records_total: 0,
        records_applied: 0,
        records_rejected: 0,
        affected_modules: Vec::new(),
        status: "completed".to_string(),
        reversible: false,
        created_at: now.clone(),
        completed_at: Some(now.clone()),
        error_message: None,
    };
    insert_operation(&mut *transaction, &undo_operation, None).await?;
    sqlx::query("UPDATE workspaces SET last_activity_at = $1 WHERE id = $2")
        .bind(&now)
        .bind(&workspace_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    transaction.commit().await.map_err(|error| error.to_string())?;
    connection.close().await.map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command(async)]
pub fn portability_undo_operation(
    app: AppHandle,
    workspace_id: String,
    operation_id: String,
) -> Result<(), String> {
    run_local_async_worker("finnacialux-portability-undo", move || async move {
        undo_operation_internal(&app, workspace_id, operation_id).await
    })
}
