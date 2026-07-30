use crate::{
    command_worker::run_local_async_worker,
    encrypted_database::{connect_app_database, EncryptedDatabaseState},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Connection, Row};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn ensure_database_writable(state: &EncryptedDatabaseState) -> Result<(), String> {
    let access = state.access_status();
    if access.read_only {
        return Err(access.reason.unwrap_or_else(|| {
            "O banco está em modo somente leitura. Cenários e preferências não podem ser alterados enquanto a integridade estiver protegida.".to_string()
        }));
    }
    Ok(())
}

fn validate_horizon(value: i64) -> Result<i64, String> {
    match value {
        30 | 60 | 90 | 365 => Ok(value),
        _ => Err("O horizonte deve ser 30, 60, 90 ou 365 dias.".to_string()),
    }
}

fn validate_scenario(value: &str) -> Result<(), String> {
    match value {
        "conservative" | "expected" | "optimistic" => Ok(()),
        _ => Err("O cenário financeiro informado é inválido.".to_string()),
    }
}

fn validate_sensitivity(value: &str) -> Result<(), String> {
    match value {
        "low" | "balanced" | "high" => Ok(()),
        _ => Err("A sensibilidade de anomalias informada é inválida.".to_string()),
    }
}

fn money_to_cents(value: f64) -> Result<i64, String> {
    if !value.is_finite() || !(-1_000_000_000.0..=1_000_000_000.0).contains(&value) {
        return Err("O limite de saldo informado está fora do intervalo permitido.".to_string());
    }
    Ok((value * 100.0).round() as i64)
}

fn cents_to_money(value: i64) -> f64 {
    value as f64 / 100.0
}

fn validate_assumptions(value: &Value) -> Result<String, String> {
    if !value.is_object() {
        return Err("As hipóteses do cenário precisam formar um objeto JSON.".to_string());
    }
    let serialized = serde_json::to_string(value).map_err(to_error)?;
    if serialized.len() > 32_768 {
        return Err("As hipóteses do cenário ultrapassam o limite local de 32 KB.".to_string());
    }
    Ok(serialized)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligencePreferences {
    pub workspace_id: String,
    pub default_horizon_days: i64,
    pub default_scenario: String,
    pub anomaly_sensitivity: String,
    pub negative_balance_threshold: f64,
    pub include_goal_contributions: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveIntelligencePreferencesRequest {
    pub workspace_id: String,
    pub default_horizon_days: i64,
    pub default_scenario: String,
    pub anomaly_sensitivity: String,
    pub negative_balance_threshold: f64,
    pub include_goal_contributions: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedIntelligenceScenario {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub scenario_type: String,
    pub horizon_days: i64,
    pub assumptions: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveIntelligenceScenarioRequest {
    pub id: Option<String>,
    pub workspace_id: String,
    pub name: String,
    pub scenario_type: String,
    pub horizon_days: i64,
    pub assumptions: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordIntelligenceSnapshotRequest {
    pub workspace_id: String,
    pub reference_date: String,
    pub horizon_days: i64,
    pub scenario_type: String,
    pub source_checksum: String,
    pub summary: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceSnapshotSummary {
    pub id: String,
    pub workspace_id: String,
    pub reference_date: String,
    pub horizon_days: i64,
    pub scenario_type: String,
    pub source_checksum: String,
    pub ending_balance: f64,
    pub lowest_balance: f64,
    pub first_negative_date: Option<String>,
    pub created_at: String,
}

async fn ensure_preferences_row(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"INSERT OR IGNORE INTO financial_intelligence_preferences (
             workspace_id, default_horizon_days, default_scenario, anomaly_sensitivity,
             negative_balance_threshold_cents, include_goal_contributions, updated_at
           ) SELECT id, 90, 'expected', 'balanced', 0, 1, $2 FROM workspaces WHERE id = $1"#,
    )
    .bind(workspace_id)
    .bind(now)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;

    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM workspaces WHERE id = $1",
    )
    .bind(workspace_id)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    if exists == 0 {
        return Err("O espaço financeiro não foi encontrado para carregar a inteligência local.".to_string());
    }
    Ok(())
}

async fn load_preferences(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<IntelligencePreferences, String> {
    let row = sqlx::query(
        r#"SELECT workspace_id, default_horizon_days, default_scenario,
                  anomaly_sensitivity, negative_balance_threshold_cents,
                  include_goal_contributions, updated_at
             FROM financial_intelligence_preferences
            WHERE workspace_id = $1
            LIMIT 1"#,
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;

    if let Some(row) = row {
        return Ok(IntelligencePreferences {
            workspace_id: row.try_get("workspace_id").map_err(to_error)?,
            default_horizon_days: row.try_get("default_horizon_days").unwrap_or(90),
            default_scenario: row.try_get("default_scenario").unwrap_or_else(|_| "expected".to_string()),
            anomaly_sensitivity: row.try_get("anomaly_sensitivity").unwrap_or_else(|_| "balanced".to_string()),
            negative_balance_threshold: cents_to_money(row.try_get("negative_balance_threshold_cents").unwrap_or(0)),
            include_goal_contributions: row.try_get::<i64, _>("include_goal_contributions").unwrap_or(1) != 0,
            updated_at: row.try_get("updated_at").unwrap_or_default(),
        });
    }

    let workspace_exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM workspaces WHERE id = $1",
    )
    .bind(workspace_id)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    if workspace_exists == 0 {
        return Err("O espaço financeiro não foi encontrado para carregar a inteligência local.".to_string());
    }

    Ok(IntelligencePreferences {
        workspace_id: workspace_id.to_string(),
        default_horizon_days: 90,
        default_scenario: "expected".to_string(),
        anomaly_sensitivity: "balanced".to_string(),
        negative_balance_threshold: 0.0,
        include_goal_contributions: true,
        updated_at: Utc::now().to_rfc3339(),
    })
}

fn scenario_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<SavedIntelligenceScenario, String> {
    let assumptions_json: String = row.try_get("assumptions_json").map_err(to_error)?;
    Ok(SavedIntelligenceScenario {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        name: row.try_get("name").map_err(to_error)?,
        scenario_type: row.try_get("scenario_type").map_err(to_error)?,
        horizon_days: row.try_get("horizon_days").map_err(to_error)?,
        assumptions: serde_json::from_str(&assumptions_json).map_err(to_error)?,
        created_at: row.try_get("created_at").map_err(to_error)?,
        updated_at: row.try_get("updated_at").map_err(to_error)?,
    })
}

fn snapshot_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<IntelligenceSnapshotSummary, String> {
    Ok(IntelligenceSnapshotSummary {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        reference_date: row.try_get("reference_date").map_err(to_error)?,
        horizon_days: row.try_get("horizon_days").map_err(to_error)?,
        scenario_type: row.try_get("scenario_type").map_err(to_error)?,
        source_checksum: row.try_get("source_checksum").map_err(to_error)?,
        ending_balance: cents_to_money(row.try_get("ending_balance_cents").map_err(to_error)?),
        lowest_balance: cents_to_money(row.try_get("lowest_balance_cents").map_err(to_error)?),
        first_negative_date: row
            .try_get::<Option<String>, _>("first_negative_date")
            .map_err(to_error)?,
        created_at: row.try_get("created_at").map_err(to_error)?,
    })
}

#[tauri::command(async)]
pub fn intelligence_get_preferences(
    app: AppHandle,
    workspace_id: String,
) -> Result<IntelligencePreferences, String> {
    run_local_async_worker("finnacialux-intelligence-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(preferences)
    })
}

#[tauri::command(async)]
pub fn intelligence_save_preferences(
    app: AppHandle,
    request: SaveIntelligencePreferencesRequest,
) -> Result<IntelligencePreferences, String> {
    run_local_async_worker("finnacialux-intelligence-save-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_horizon(request.default_horizon_days)?;
        validate_scenario(&request.default_scenario)?;
        validate_sensitivity(&request.anomaly_sensitivity)?;
        let threshold_cents = money_to_cents(request.negative_balance_threshold)?;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        sqlx::query(
            r#"UPDATE financial_intelligence_preferences
                  SET default_horizon_days = $1,
                      default_scenario = $2,
                      anomaly_sensitivity = $3,
                      negative_balance_threshold_cents = $4,
                      include_goal_contributions = $5,
                      updated_at = $6
                WHERE workspace_id = $7"#,
        )
        .bind(request.default_horizon_days)
        .bind(&request.default_scenario)
        .bind(&request.anomaly_sensitivity)
        .bind(threshold_cents)
        .bind(if request.include_goal_contributions { 1 } else { 0 })
        .bind(Utc::now().to_rfc3339())
        .bind(&request.workspace_id)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(preferences)
    })
}

#[tauri::command(async)]
pub fn intelligence_list_scenarios(
    app: AppHandle,
    workspace_id: String,
) -> Result<Vec<SavedIntelligenceScenario>, String> {
    run_local_async_worker("finnacialux-intelligence-list-scenarios", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query(
            r#"SELECT id, workspace_id, name, scenario_type, horizon_days,
                      assumptions_json, created_at, updated_at
                 FROM financial_intelligence_scenarios
                WHERE workspace_id = $1
                ORDER BY updated_at DESC, name ASC"#,
        )
        .bind(&workspace_id)
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        rows.iter().map(scenario_from_row).collect()
    })
}

#[tauri::command(async)]
pub fn intelligence_save_scenario(
    app: AppHandle,
    request: SaveIntelligenceScenarioRequest,
) -> Result<SavedIntelligenceScenario, String> {
    run_local_async_worker("finnacialux-intelligence-save-scenario", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_horizon(request.horizon_days)?;
        validate_scenario(&request.scenario_type)?;
        let name = request.name.trim();
        if !(2..=80).contains(&name.chars().count()) {
            return Err("O nome do cenário deve ter entre 2 e 80 caracteres.".to_string());
        }
        let assumptions_json = validate_assumptions(&request.assumptions)?;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        let id = request.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        sqlx::query(
            r#"INSERT INTO financial_intelligence_scenarios (
                 id, workspace_id, name, scenario_type, horizon_days,
                 assumptions_json, created_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
               ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name,
                 scenario_type = excluded.scenario_type,
                 horizon_days = excluded.horizon_days,
                 assumptions_json = excluded.assumptions_json,
                 updated_at = excluded.updated_at
               WHERE financial_intelligence_scenarios.workspace_id = excluded.workspace_id"#,
        )
        .bind(&id)
        .bind(&request.workspace_id)
        .bind(name)
        .bind(&request.scenario_type)
        .bind(request.horizon_days)
        .bind(assumptions_json)
        .bind(now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let row = sqlx::query(
            r#"SELECT id, workspace_id, name, scenario_type, horizon_days,
                      assumptions_json, created_at, updated_at
                 FROM financial_intelligence_scenarios
                WHERE workspace_id = $1 AND id = $2 LIMIT 1"#,
        )
        .bind(&request.workspace_id)
        .bind(&id)
        .fetch_one(&mut connection)
        .await
        .map_err(to_error)?;
        let scenario = scenario_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(scenario)
    })
}

#[tauri::command(async)]
pub fn intelligence_delete_scenario(
    app: AppHandle,
    workspace_id: String,
    scenario_id: String,
) -> Result<(), String> {
    run_local_async_worker("finnacialux-intelligence-delete-scenario", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let affected = sqlx::query(
            "DELETE FROM financial_intelligence_scenarios WHERE workspace_id = $1 AND id = $2",
        )
        .bind(&workspace_id)
        .bind(&scenario_id)
        .execute(&mut connection)
        .await
        .map_err(to_error)?
        .rows_affected();
        connection.close().await.map_err(to_error)?;
        if affected == 0 {
            return Err("O cenário salvo não foi encontrado.".to_string());
        }
        Ok(())
    })
}

#[tauri::command(async)]
pub fn intelligence_record_snapshot(
    app: AppHandle,
    request: RecordIntelligenceSnapshotRequest,
) -> Result<IntelligenceSnapshotSummary, String> {
    run_local_async_worker("finnacialux-intelligence-record-snapshot", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_horizon(request.horizon_days)?;
        validate_scenario(&request.scenario_type)?;
        if request.source_checksum.len() < 8 || request.source_checksum.len() > 160 {
            return Err("O checksum da projeção é inválido.".to_string());
        }
        let summary_object = request.summary.as_object().ok_or_else(|| {
            "O resumo da projeção precisa formar um objeto JSON.".to_string()
        })?;
        let ending_balance = summary_object.get("endingBalance").and_then(Value::as_f64)
            .ok_or_else(|| "O saldo final da projeção é inválido.".to_string())?;
        let lowest_balance = summary_object.get("lowestBalance").and_then(Value::as_f64)
            .ok_or_else(|| "O menor saldo da projeção é inválido.".to_string())?;
        let first_negative_date = summary_object.get("firstNegativeDate")
            .and_then(Value::as_str)
            .map(str::to_string);
        let summary_json = serde_json::to_string(&request.summary).map_err(to_error)?;
        if summary_json.len() > 65_536 {
            return Err("O resumo da projeção ultrapassa o limite local de 64 KB.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"INSERT OR IGNORE INTO financial_intelligence_snapshots (
                 id, workspace_id, reference_date, horizon_days, scenario_type,
                 source_checksum, result_summary_json, ending_balance_cents,
                 lowest_balance_cents, first_negative_date, created_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"#,
        )
        .bind(&id)
        .bind(&request.workspace_id)
        .bind(&request.reference_date)
        .bind(request.horizon_days)
        .bind(&request.scenario_type)
        .bind(&request.source_checksum)
        .bind(summary_json)
        .bind(money_to_cents(ending_balance)?)
        .bind(money_to_cents(lowest_balance)?)
        .bind(&first_negative_date)
        .bind(now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let row = sqlx::query(
            r#"SELECT id, workspace_id, reference_date, horizon_days, scenario_type,
                      source_checksum, ending_balance_cents, lowest_balance_cents,
                      first_negative_date, created_at
                 FROM financial_intelligence_snapshots
                WHERE workspace_id = $1 AND reference_date = $2 AND horizon_days = $3
                  AND scenario_type = $4 AND source_checksum = $5
                ORDER BY created_at DESC LIMIT 1"#,
        )
        .bind(&request.workspace_id)
        .bind(&request.reference_date)
        .bind(request.horizon_days)
        .bind(&request.scenario_type)
        .bind(&request.source_checksum)
        .fetch_one(&mut connection)
        .await
        .map_err(to_error)?;
        let snapshot = snapshot_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(snapshot)
    })
}

#[tauri::command(async)]
pub fn intelligence_list_snapshots(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<IntelligenceSnapshotSummary>, String> {
    run_local_async_worker("finnacialux-intelligence-list-snapshots", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query(
            r#"SELECT id, workspace_id, reference_date, horizon_days, scenario_type,
                      source_checksum, ending_balance_cents, lowest_balance_cents,
                      first_negative_date, created_at
                 FROM financial_intelligence_snapshots
                WHERE workspace_id = $1
                ORDER BY created_at DESC
                LIMIT $2"#,
        )
        .bind(&workspace_id)
        .bind(limit.unwrap_or(12).clamp(1, 100))
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        rows.iter().map(snapshot_from_row).collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_supported_horizons_and_scenarios() {
        assert_eq!(validate_horizon(90).expect("horizonte"), 90);
        assert!(validate_horizon(45).is_err());
        assert!(validate_scenario("expected").is_ok());
        assert!(validate_scenario("automatic").is_err());
    }

    #[test]
    fn stores_money_as_integer_cents_without_float_drift() {
        assert_eq!(money_to_cents(123.45).expect("centavos"), 12_345);
        assert_eq!(cents_to_money(-7_050), -70.5);
    }

    #[test]
    fn limits_scenario_assumptions_to_local_json_objects() {
        assert!(validate_assumptions(&json!({"oneTimeExpense": 450.0})).is_ok());
        assert!(validate_assumptions(&json!([1, 2, 3])).is_err());
    }
}
