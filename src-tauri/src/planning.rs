use crate::{
    command_worker::run_local_async_worker,
    encrypted_database::{connect_app_database, EncryptedDatabaseState},
};
use chrono::{NaiveDate, Utc};
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
            "O banco está em modo somente leitura. Planos e decisões não podem ser alterados enquanto a integridade estiver protegida.".to_string()
        }));
    }
    Ok(())
}

fn validate_period(value: &str) -> Result<(), String> {
    match value {
        "monthly" | "annual" => Ok(()),
        _ => Err("O período do plano é inválido.".to_string()),
    }
}

fn validate_debt_strategy(value: &str) -> Result<(), String> {
    match value {
        "avalanche" | "snowball" | "priority" => Ok(()),
        _ => Err("A estratégia de dívidas é inválida.".to_string()),
    }
}

fn validate_status(value: &str) -> Result<(), String> {
    match value {
        "pending" | "completed" | "dismissed" => Ok(()),
        _ => Err("O status da decisão é inválido.".to_string()),
    }
}

fn validate_kind(value: &str) -> Result<(), String> {
    match value {
        "review" | "debt" | "goal" | "budget" | "reserve" | "commitment" => Ok(()),
        _ => Err("O tipo da decisão financeira é inválido.".to_string()),
    }
}

fn validate_month(value: &str) -> Result<(), String> {
    let first_day = format!("{value}-01");
    NaiveDate::parse_from_str(&first_day, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| "O mês informado precisa usar o formato AAAA-MM.".to_string())
}

fn validate_date(value: &str) -> Result<(), String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| "A data informada precisa usar o formato AAAA-MM-DD.".to_string())
}

fn validate_checksum(value: &str) -> Result<(), String> {
    if value.len() >= 4 && value.len() <= 128 && value.chars().all(|character| character.is_ascii_alphanumeric() || character == '-') {
        return Ok(());
    }
    Err("O checksum do plano é inválido.".to_string())
}

fn validate_json(value: &Value, label: &str, maximum: usize) -> Result<String, String> {
    if !value.is_object() && !value.is_array() {
        return Err(format!("{label} precisa formar um objeto ou lista JSON."));
    }
    let serialized = serde_json::to_string(value).map_err(to_error)?;
    if serialized.len() > maximum {
        return Err(format!("{label} ultrapassa o limite local permitido."));
    }
    Ok(serialized)
}

fn money_to_cents(value: f64) -> Result<i64, String> {
    if !value.is_finite() || !(-1_000_000_000.0..=1_000_000_000.0).contains(&value) {
        return Err("O valor financeiro está fora do intervalo permitido.".to_string());
    }
    Ok((value * 100.0).round() as i64)
}

fn cents_to_money(value: i64) -> f64 {
    value as f64 / 100.0
}

async fn ensure_workspace(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<(), String> {
    let exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM workspaces WHERE id = $1")
        .bind(workspace_id)
        .fetch_one(&mut *connection)
        .await
        .map_err(to_error)?;
    if exists == 0 {
        return Err("O espaço financeiro não foi encontrado para o planejamento local.".to_string());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningPreferences {
    pub workspace_id: String,
    pub default_period: String,
    pub default_debt_strategy: String,
    pub default_reserve_target_months: f64,
    pub monthly_review_day: i64,
    pub require_simulation_before_activation: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePlanningPreferencesRequest {
    pub workspace_id: String,
    pub default_period: String,
    pub default_debt_strategy: String,
    pub default_reserve_target_months: f64,
    pub monthly_review_day: i64,
    pub require_simulation_before_activation: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedFinancialPlan {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub status: String,
    pub period: String,
    pub start_month: String,
    pub end_month: String,
    pub draft: Value,
    pub simulation_summary: Value,
    pub source_checksum: String,
    pub projection_checksum: String,
    pub created_at: String,
    pub updated_at: String,
    pub activated_at: Option<String>,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFinancialPlanRequest {
    pub id: Option<String>,
    pub workspace_id: String,
    pub draft: Value,
    pub simulation: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateFinancialPlanRequest {
    pub workspace_id: String,
    pub plan_id: String,
    pub source_checksum: String,
    pub projection_checksum: String,
    pub decisions: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialPlanReview {
    pub id: String,
    pub workspace_id: String,
    pub plan_id: String,
    pub review_month: String,
    pub source_checksum: String,
    pub summary: Value,
    pub deviations: Value,
    pub accepted_adjustments: Value,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordFinancialPlanReviewRequest {
    pub workspace_id: String,
    pub plan_id: String,
    pub review_month: String,
    pub source_checksum: String,
    pub summary: Value,
    pub deviations: Value,
    pub accepted_adjustments: Value,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningDecision {
    pub id: String,
    pub workspace_id: String,
    pub plan_id: Option<String>,
    pub title: String,
    pub kind: String,
    pub decision_date: String,
    pub amount: Option<f64>,
    pub status: String,
    pub notes: String,
    pub generated: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePlanningDecisionRequest {
    pub id: Option<String>,
    pub workspace_id: String,
    pub plan_id: Option<String>,
    pub title: String,
    pub kind: String,
    pub decision_date: String,
    pub amount: Option<f64>,
    pub status: Option<String>,
    pub notes: Option<String>,
    pub generated: Option<bool>,
}

fn plan_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<SavedFinancialPlan, String> {
    let draft_json: String = row.try_get("draft_json").map_err(to_error)?;
    let summary_json: String = row.try_get("simulation_summary_json").map_err(to_error)?;
    Ok(SavedFinancialPlan {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        name: row.try_get("name").map_err(to_error)?,
        status: row.try_get("status").map_err(to_error)?,
        period: row.try_get("period").map_err(to_error)?,
        start_month: row.try_get("start_month").map_err(to_error)?,
        end_month: row.try_get("end_month").map_err(to_error)?,
        draft: serde_json::from_str(&draft_json).map_err(to_error)?,
        simulation_summary: serde_json::from_str(&summary_json).map_err(to_error)?,
        source_checksum: row.try_get("source_checksum").map_err(to_error)?,
        projection_checksum: row.try_get("projection_checksum").map_err(to_error)?,
        created_at: row.try_get("created_at").map_err(to_error)?,
        updated_at: row.try_get("updated_at").map_err(to_error)?,
        activated_at: row.try_get("activated_at").map_err(to_error)?,
        archived_at: row.try_get("archived_at").map_err(to_error)?,
    })
}

fn review_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<FinancialPlanReview, String> {
    Ok(FinancialPlanReview {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        plan_id: row.try_get("plan_id").map_err(to_error)?,
        review_month: row.try_get("review_month").map_err(to_error)?,
        source_checksum: row.try_get("source_checksum").map_err(to_error)?,
        summary: serde_json::from_str(&row.try_get::<String, _>("summary_json").map_err(to_error)?).map_err(to_error)?,
        deviations: serde_json::from_str(&row.try_get::<String, _>("deviations_json").map_err(to_error)?).map_err(to_error)?,
        accepted_adjustments: serde_json::from_str(&row.try_get::<String, _>("accepted_adjustments_json").map_err(to_error)?).map_err(to_error)?,
        notes: row.try_get("notes").unwrap_or_default(),
        created_at: row.try_get("created_at").map_err(to_error)?,
    })
}

fn decision_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<PlanningDecision, String> {
    Ok(PlanningDecision {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        plan_id: row.try_get("plan_id").map_err(to_error)?,
        title: row.try_get("title").map_err(to_error)?,
        kind: row.try_get("kind").map_err(to_error)?,
        decision_date: row.try_get("decision_date").map_err(to_error)?,
        amount: row.try_get::<Option<i64>, _>("amount_cents").map_err(to_error)?.map(cents_to_money),
        status: row.try_get("status").map_err(to_error)?,
        notes: row.try_get("notes").unwrap_or_default(),
        generated: row.try_get::<i64, _>("generated").unwrap_or(0) != 0,
        created_at: row.try_get("created_at").map_err(to_error)?,
        updated_at: row.try_get("updated_at").map_err(to_error)?,
    })
}

async fn load_preferences(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<PlanningPreferences, String> {
    ensure_workspace(connection, workspace_id).await?;
    let row = sqlx::query(
        "SELECT workspace_id, default_period, default_debt_strategy, default_reserve_target_months, monthly_review_day, require_simulation_before_activation, updated_at FROM financial_planning_preferences WHERE workspace_id = $1 LIMIT 1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;

    if let Some(row) = row {
        return Ok(PlanningPreferences {
            workspace_id: row.try_get("workspace_id").map_err(to_error)?,
            default_period: row.try_get("default_period").unwrap_or_else(|_| "monthly".to_string()),
            default_debt_strategy: row.try_get("default_debt_strategy").unwrap_or_else(|_| "avalanche".to_string()),
            default_reserve_target_months: row.try_get("default_reserve_target_months").unwrap_or(6.0),
            monthly_review_day: row.try_get("monthly_review_day").unwrap_or(25),
            require_simulation_before_activation: row.try_get::<i64, _>("require_simulation_before_activation").unwrap_or(1) != 0,
            updated_at: row.try_get("updated_at").unwrap_or_else(|_| Utc::now().to_rfc3339()),
        });
    }

    Ok(PlanningPreferences {
        workspace_id: workspace_id.to_string(),
        default_period: "monthly".to_string(),
        default_debt_strategy: "avalanche".to_string(),
        default_reserve_target_months: 6.0,
        monthly_review_day: 25,
        require_simulation_before_activation: true,
        updated_at: Utc::now().to_rfc3339(),
    })
}

#[tauri::command(async)]
pub fn planning_get_preferences(app: AppHandle, workspace_id: String) -> Result<PlanningPreferences, String> {
    run_local_async_worker("finnacialux-planning-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let result = load_preferences(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_save_preferences(app: AppHandle, request: SavePlanningPreferencesRequest) -> Result<PlanningPreferences, String> {
    run_local_async_worker("finnacialux-planning-save-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_period(&request.default_period)?;
        validate_debt_strategy(&request.default_debt_strategy)?;
        if !(1.0..=24.0).contains(&request.default_reserve_target_months) || !(1..=28).contains(&request.monthly_review_day) {
            return Err("As preferências do planejamento estão fora dos limites permitidos.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO financial_planning_preferences (workspace_id, default_period, default_debt_strategy, default_reserve_target_months, monthly_review_day, require_simulation_before_activation, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(workspace_id) DO UPDATE SET default_period = excluded.default_period, default_debt_strategy = excluded.default_debt_strategy, default_reserve_target_months = excluded.default_reserve_target_months, monthly_review_day = excluded.monthly_review_day, require_simulation_before_activation = excluded.require_simulation_before_activation, updated_at = excluded.updated_at",
        )
        .bind(&request.workspace_id)
        .bind(&request.default_period)
        .bind(&request.default_debt_strategy)
        .bind(request.default_reserve_target_months)
        .bind(request.monthly_review_day)
        .bind(if request.require_simulation_before_activation { 1 } else { 0 })
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let result = load_preferences(&mut connection, &request.workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_list_plans(app: AppHandle, workspace_id: String) -> Result<Vec<SavedFinancialPlan>, String> {
    run_local_async_worker("finnacialux-planning-list-plans", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &workspace_id).await?;
        let rows = sqlx::query("SELECT * FROM financial_plans WHERE workspace_id = $1 ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, updated_at DESC")
            .bind(&workspace_id)
            .fetch_all(&mut connection)
            .await
            .map_err(to_error)?;
        let result = rows.iter().map(plan_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_save_plan(app: AppHandle, request: SaveFinancialPlanRequest) -> Result<SavedFinancialPlan, String> {
    run_local_async_worker("finnacialux-planning-save-plan", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let draft = request.draft.as_object().ok_or_else(|| "O rascunho do plano é inválido.".to_string())?;
        let simulation = request.simulation.as_object().ok_or_else(|| "A simulação do plano é inválida.".to_string())?;
        let name = draft.get("name").and_then(Value::as_str).unwrap_or("").trim().to_string();
        let period = draft.get("period").and_then(Value::as_str).unwrap_or("").to_string();
        let start_month = draft.get("startMonth").and_then(Value::as_str).unwrap_or("").to_string();
        let duration = draft.get("durationMonths").and_then(Value::as_i64).unwrap_or(0);
        let source_checksum = simulation.get("sourceChecksum").and_then(Value::as_str).unwrap_or("").to_string();
        let projection_checksum = simulation.get("projectionChecksum").and_then(Value::as_str).unwrap_or("").to_string();
        let summary = simulation.get("summary").cloned().unwrap_or(Value::Null);
        if name.len() < 2 || name.len() > 80 || !(1..=36).contains(&duration) {
            return Err("Nome ou duração do plano inválidos.".to_string());
        }
        validate_period(&period)?;
        validate_month(&start_month)?;
        validate_checksum(&source_checksum)?;
        validate_checksum(&projection_checksum)?;
        let draft_json = validate_json(&request.draft, "O rascunho", 131_072)?;
        let summary_json = validate_json(&summary, "O resumo da simulação", 32_768)?;
        let end_month = add_months(&start_month, duration - 1)?;
        let now = Utc::now().to_rfc3339();
        let id = request.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        sqlx::query(
            "INSERT INTO financial_plans (id, workspace_id, name, status, period, start_month, end_month, draft_json, simulation_summary_json, source_checksum, projection_checksum, created_at, updated_at, activated_at, archived_at) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $11, NULL, NULL) ON CONFLICT(id) DO UPDATE SET name = excluded.name, period = excluded.period, start_month = excluded.start_month, end_month = excluded.end_month, draft_json = excluded.draft_json, simulation_summary_json = excluded.simulation_summary_json, source_checksum = excluded.source_checksum, projection_checksum = excluded.projection_checksum, updated_at = excluded.updated_at, status = 'draft', activated_at = NULL, archived_at = NULL WHERE financial_plans.workspace_id = excluded.workspace_id",
        )
        .bind(&id)
        .bind(&request.workspace_id)
        .bind(&name)
        .bind(&period)
        .bind(&start_month)
        .bind(&end_month)
        .bind(&draft_json)
        .bind(&summary_json)
        .bind(&source_checksum)
        .bind(&projection_checksum)
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM financial_plans WHERE id = $1 AND workspace_id = $2")
            .bind(&id)
            .bind(&request.workspace_id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = plan_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_activate_plan(app: AppHandle, request: ActivateFinancialPlanRequest) -> Result<SavedFinancialPlan, String> {
    run_local_async_worker("finnacialux-planning-activate-plan", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_checksum(&request.source_checksum)?;
        validate_checksum(&request.projection_checksum)?;
        let decisions = request.decisions.as_array().ok_or_else(|| "O calendário de decisões da simulação é inválido.".to_string())?;
        if decisions.len() > 100 {
            return Err("O plano ultrapassa o limite de 100 decisões geradas.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        let stored = sqlx::query("SELECT source_checksum, projection_checksum FROM financial_plans WHERE id = $1 AND workspace_id = $2")
            .bind(&request.plan_id)
            .bind(&request.workspace_id)
            .fetch_optional(&mut connection)
            .await
            .map_err(to_error)?
            .ok_or_else(|| "O plano não foi encontrado para ativação.".to_string())?;
        let stored_source: String = stored.try_get("source_checksum").map_err(to_error)?;
        let stored_projection: String = stored.try_get("projection_checksum").map_err(to_error)?;
        if stored_source != request.source_checksum || stored_projection != request.projection_checksum {
            connection.close().await.map_err(to_error)?;
            return Err("A simulação mudou depois que o plano foi salvo. Gere e salve uma nova simulação antes de ativar.".to_string());
        }
        let now = Utc::now().to_rfc3339();
        let mut transaction = connection.begin().await.map_err(to_error)?;
        sqlx::query("UPDATE financial_plans SET status = 'draft', activated_at = NULL, updated_at = $2 WHERE workspace_id = $1 AND status = 'active' AND id <> $3")
            .bind(&request.workspace_id)
            .bind(&now)
            .bind(&request.plan_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        sqlx::query("UPDATE financial_plans SET status = 'active', activated_at = $3, archived_at = NULL, updated_at = $3 WHERE id = $1 AND workspace_id = $2")
            .bind(&request.plan_id)
            .bind(&request.workspace_id)
            .bind(&now)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        sqlx::query("DELETE FROM financial_planning_decisions WHERE workspace_id = $1 AND plan_id = $2 AND generated = 1 AND status = 'pending'")
            .bind(&request.workspace_id)
            .bind(&request.plan_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        for decision in decisions {
            let object = decision.as_object().ok_or_else(|| "Uma decisão gerada está inválida.".to_string())?;
            let title = object.get("title").and_then(Value::as_str).unwrap_or("").trim();
            let kind = object.get("kind").and_then(Value::as_str).unwrap_or("");
            let date = object.get("decisionDate").and_then(Value::as_str).unwrap_or("");
            validate_kind(kind)?;
            validate_date(date)?;
            if title.len() < 2 || title.len() > 120 {
                return Err("O título de uma decisão gerada é inválido.".to_string());
            }
            let amount = object.get("amount").and_then(Value::as_f64).map(money_to_cents).transpose()?;
            let notes = object.get("notes").and_then(Value::as_str).unwrap_or("").chars().take(1000).collect::<String>();
            sqlx::query("INSERT INTO financial_planning_decisions (id, workspace_id, plan_id, title, kind, decision_date, amount_cents, status, notes, generated, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, 1, $9, $9)")
                .bind(Uuid::new_v4().to_string())
                .bind(&request.workspace_id)
                .bind(&request.plan_id)
                .bind(title)
                .bind(kind)
                .bind(date)
                .bind(amount)
                .bind(notes)
                .bind(&now)
                .execute(&mut *transaction)
                .await
                .map_err(to_error)?;
        }
        transaction.commit().await.map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM financial_plans WHERE id = $1 AND workspace_id = $2")
            .bind(&request.plan_id)
            .bind(&request.workspace_id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = plan_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_archive_plan(app: AppHandle, workspace_id: String, plan_id: String) -> Result<(), String> {
    run_local_async_worker("finnacialux-planning-archive-plan", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let now = Utc::now().to_rfc3339();
        let affected = sqlx::query("UPDATE financial_plans SET status = 'archived', archived_at = $3, activated_at = NULL, updated_at = $3 WHERE id = $1 AND workspace_id = $2")
            .bind(&plan_id)
            .bind(&workspace_id)
            .bind(&now)
            .execute(&mut connection)
            .await
            .map_err(to_error)?
            .rows_affected();
        if affected > 0 {
            sqlx::query("UPDATE financial_planning_decisions SET status = 'dismissed', updated_at = $3 WHERE workspace_id = $1 AND plan_id = $2 AND generated = 1 AND status = 'pending'")
                .bind(&workspace_id)
                .bind(&plan_id)
                .bind(&now)
                .execute(&mut connection)
                .await
                .map_err(to_error)?;
        }
        connection.close().await.map_err(to_error)?;
        if affected == 0 { return Err("O plano não foi encontrado para arquivamento.".to_string()); }
        Ok(())
    })
}

#[tauri::command(async)]
pub fn planning_record_review(app: AppHandle, request: RecordFinancialPlanReviewRequest) -> Result<FinancialPlanReview, String> {
    run_local_async_worker("finnacialux-planning-record-review", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_month(&request.review_month)?;
        validate_checksum(&request.source_checksum)?;
        let summary_json = validate_json(&request.summary, "O resumo da revisão", 32_768)?;
        let deviations_json = validate_json(&request.deviations, "Os desvios da revisão", 131_072)?;
        let adjustments_json = validate_json(&request.accepted_adjustments, "Os ajustes aceitos", 32_768)?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let notes = request.notes.chars().take(4000).collect::<String>();
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        let active = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM financial_plans WHERE id = $1 AND workspace_id = $2 AND status = 'active'")
            .bind(&request.plan_id)
            .bind(&request.workspace_id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        if active == 0 {
            connection.close().await.map_err(to_error)?;
            return Err("A revisão mensal exige um plano ativo.".to_string());
        }
        sqlx::query("INSERT INTO financial_plan_reviews (id, workspace_id, plan_id, review_month, source_checksum, summary_json, deviations_json, accepted_adjustments_json, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT(plan_id, review_month) DO UPDATE SET source_checksum = excluded.source_checksum, summary_json = excluded.summary_json, deviations_json = excluded.deviations_json, accepted_adjustments_json = excluded.accepted_adjustments_json, notes = excluded.notes, created_at = excluded.created_at")
            .bind(&id)
            .bind(&request.workspace_id)
            .bind(&request.plan_id)
            .bind(&request.review_month)
            .bind(&request.source_checksum)
            .bind(&summary_json)
            .bind(&deviations_json)
            .bind(&adjustments_json)
            .bind(&notes)
            .bind(&now)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM financial_plan_reviews WHERE plan_id = $1 AND review_month = $2")
            .bind(&request.plan_id)
            .bind(&request.review_month)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = review_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_list_reviews(app: AppHandle, workspace_id: String, plan_id: Option<String>, limit: i64) -> Result<Vec<FinancialPlanReview>, String> {
    run_local_async_worker("finnacialux-planning-list-reviews", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &workspace_id).await?;
        let safe_limit = limit.clamp(1, 60);
        let rows = if let Some(plan_id) = plan_id {
            sqlx::query("SELECT * FROM financial_plan_reviews WHERE workspace_id = $1 AND plan_id = $2 ORDER BY review_month DESC LIMIT $3")
                .bind(&workspace_id).bind(plan_id).bind(safe_limit).fetch_all(&mut connection).await.map_err(to_error)?
        } else {
            sqlx::query("SELECT * FROM financial_plan_reviews WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2")
                .bind(&workspace_id).bind(safe_limit).fetch_all(&mut connection).await.map_err(to_error)?
        };
        let result = rows.iter().map(review_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_list_decisions(app: AppHandle, workspace_id: String, status: Option<String>, limit: i64) -> Result<Vec<PlanningDecision>, String> {
    run_local_async_worker("finnacialux-planning-list-decisions", move || async move {
        if let Some(value) = status.as_deref() { validate_status(value)?; }
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &workspace_id).await?;
        let safe_limit = limit.clamp(1, 200);
        let rows = if let Some(status) = status {
            sqlx::query("SELECT * FROM financial_planning_decisions WHERE workspace_id = $1 AND status = $2 ORDER BY decision_date ASC LIMIT $3")
                .bind(&workspace_id).bind(status).bind(safe_limit).fetch_all(&mut connection).await.map_err(to_error)?
        } else {
            sqlx::query("SELECT * FROM financial_planning_decisions WHERE workspace_id = $1 ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, decision_date ASC LIMIT $2")
                .bind(&workspace_id).bind(safe_limit).fetch_all(&mut connection).await.map_err(to_error)?
        };
        let result = rows.iter().map(decision_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_save_decision(app: AppHandle, request: SavePlanningDecisionRequest) -> Result<PlanningDecision, String> {
    run_local_async_worker("finnacialux-planning-save-decision", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_kind(&request.kind)?;
        validate_date(&request.decision_date)?;
        let status = request.status.unwrap_or_else(|| "pending".to_string());
        validate_status(&status)?;
        let title = request.title.trim().chars().take(120).collect::<String>();
        if title.len() < 2 { return Err("Informe um título válido para a decisão.".to_string()); }
        let amount = request.amount.map(money_to_cents).transpose()?;
        let notes = request.notes.unwrap_or_default().chars().take(1000).collect::<String>();
        let id = request.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339();
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        sqlx::query("INSERT INTO financial_planning_decisions (id, workspace_id, plan_id, title, kind, decision_date, amount_cents, status, notes, generated, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) ON CONFLICT(id) DO UPDATE SET plan_id = excluded.plan_id, title = excluded.title, kind = excluded.kind, decision_date = excluded.decision_date, amount_cents = excluded.amount_cents, status = excluded.status, notes = excluded.notes, updated_at = excluded.updated_at WHERE financial_planning_decisions.workspace_id = excluded.workspace_id")
            .bind(&id).bind(&request.workspace_id).bind(&request.plan_id).bind(&title).bind(&request.kind).bind(&request.decision_date).bind(amount).bind(&status).bind(&notes).bind(if request.generated.unwrap_or(false) { 1 } else { 0 }).bind(&now)
            .execute(&mut connection).await.map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM financial_planning_decisions WHERE id = $1 AND workspace_id = $2")
            .bind(&id).bind(&request.workspace_id).fetch_one(&mut connection).await.map_err(to_error)?;
        let result = decision_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_update_decision_status(app: AppHandle, workspace_id: String, decision_id: String, status: String) -> Result<PlanningDecision, String> {
    run_local_async_worker("finnacialux-planning-update-decision", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_status(&status)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let now = Utc::now().to_rfc3339();
        let affected = sqlx::query("UPDATE financial_planning_decisions SET status = $3, updated_at = $4 WHERE id = $1 AND workspace_id = $2")
            .bind(&decision_id).bind(&workspace_id).bind(&status).bind(&now).execute(&mut connection).await.map_err(to_error)?.rows_affected();
        if affected == 0 { connection.close().await.map_err(to_error)?; return Err("A decisão não foi encontrada.".to_string()); }
        let row = sqlx::query("SELECT * FROM financial_planning_decisions WHERE id = $1 AND workspace_id = $2")
            .bind(&decision_id).bind(&workspace_id).fetch_one(&mut connection).await.map_err(to_error)?;
        let result = decision_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn planning_delete_decision(app: AppHandle, workspace_id: String, decision_id: String) -> Result<(), String> {
    run_local_async_worker("finnacialux-planning-delete-decision", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let affected = sqlx::query("DELETE FROM financial_planning_decisions WHERE id = $1 AND workspace_id = $2 AND generated = 0")
            .bind(&decision_id).bind(&workspace_id).execute(&mut connection).await.map_err(to_error)?.rows_affected();
        connection.close().await.map_err(to_error)?;
        if affected == 0 { return Err("A decisão não foi encontrada ou foi gerada por um plano ativo.".to_string()); }
        Ok(())
    })
}

fn add_months(value: &str, amount: i64) -> Result<String, String> {
    validate_month(value)?;
    let year = value[..4].parse::<i64>().map_err(to_error)?;
    let month = value[5..].parse::<i64>().map_err(to_error)?;
    let total = year * 12 + (month - 1) + amount;
    let next_year = total.div_euclid(12);
    let next_month = total.rem_euclid(12) + 1;
    Ok(format!("{next_year:04}-{next_month:02}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn month_math_and_checksums_are_restricted() {
        assert_eq!(add_months("2026-01", 1).unwrap(), "2026-02");
        assert_eq!(add_months("2026-12", 1).unwrap(), "2027-01");
        assert!(validate_checksum("plan-1234abcd").is_ok());
        assert!(validate_checksum("x").is_err());
    }

    #[test]
    fn planning_writes_respect_read_only_state() {
        let state = EncryptedDatabaseState::default();
        assert!(ensure_database_writable(&state).is_ok());
        state.set_read_only(true, Some("integridade protegida".to_string()));
        assert!(ensure_database_writable(&state).is_err());
    }
}
