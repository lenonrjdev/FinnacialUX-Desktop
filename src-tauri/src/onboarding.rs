use crate::{
    command_worker::run_local_async_worker,
    encrypted_database::{connect_app_database, EncryptedDatabaseState},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Connection, Row, SqliteConnection};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const STEP_CODES: [&str; 6] = [
    "welcome",
    "account",
    "first_record",
    "planning",
    "security",
    "backup",
];

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn ensure_database_writable(state: &EncryptedDatabaseState) -> Result<(), String> {
    let access = state.access_status();
    if access.read_only {
        return Err(access.reason.unwrap_or_else(|| {
            "O banco está em modo somente leitura. O progresso do guia não pode ser alterado.".to_string()
        }));
    }
    Ok(())
}

fn validate_step_code(step_code: &str) -> Result<(), String> {
    if STEP_CODES.contains(&step_code) {
        Ok(())
    } else {
        Err("A etapa informada não pertence ao guia do FinnacialUX.".to_string())
    }
}

async fn ensure_workspace(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(), String> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM workspaces WHERE id = $1")
        .bind(workspace_id)
        .fetch_one(&mut *connection)
        .await
        .map_err(to_error)?;
    if count == 0 {
        return Err("O espaço financeiro informado não foi encontrado.".to_string());
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingPreferences {
    pub workspace_id: String,
    pub auto_open: bool,
    pub show_progress_dock: bool,
    pub contextual_help_enabled: bool,
    pub completed_at: Option<String>,
    pub skipped_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingStepState {
    pub code: String,
    pub status: String,
    pub completed_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    pub preferences: OnboardingPreferences,
    pub steps: Vec<OnboardingStepState>,
    pub progress_percent: i64,
    pub completed_steps: i64,
    pub total_steps: i64,
    pub next_step: Option<String>,
    pub completed: bool,
    pub skipped: bool,
    pub persisted: bool,
    pub read_only: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingObservedState {
    pub account_count: i64,
    pub transaction_count: i64,
    pub payable_count: i64,
    pub receivable_count: i64,
    pub budget_count: i64,
    pub goal_count: i64,
    pub backup_count: i64,
    pub security_ready: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSyncRequest {
    pub workspace_id: String,
    pub observed: OnboardingObservedState,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingStepRequest {
    pub workspace_id: String,
    pub step_code: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOnboardingPreferencesRequest {
    pub workspace_id: String,
    pub auto_open: bool,
    pub show_progress_dock: bool,
    pub contextual_help_enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSkipRequest {
    pub workspace_id: String,
    pub reason: Option<String>,
}

fn default_preferences(workspace_id: &str) -> OnboardingPreferences {
    OnboardingPreferences {
        workspace_id: workspace_id.to_string(),
        auto_open: true,
        show_progress_dock: true,
        contextual_help_enabled: true,
        completed_at: None,
        skipped_at: None,
        updated_at: Utc::now().to_rfc3339(),
    }
}

async fn load_preferences(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<OnboardingPreferences, String> {
    let row = sqlx::query(
        "SELECT workspace_id, auto_open, show_progress_dock, contextual_help_enabled, completed_at, skipped_at, updated_at FROM onboarding_preferences WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;

    match row {
        Some(row) => Ok(OnboardingPreferences {
            workspace_id: row.try_get("workspace_id").map_err(to_error)?,
            auto_open: row.try_get::<i64, _>("auto_open").unwrap_or(1) != 0,
            show_progress_dock: row.try_get::<i64, _>("show_progress_dock").unwrap_or(1) != 0,
            contextual_help_enabled: row
                .try_get::<i64, _>("contextual_help_enabled")
                .unwrap_or(1)
                != 0,
            completed_at: row.try_get("completed_at").ok(),
            skipped_at: row.try_get("skipped_at").ok(),
            updated_at: row
                .try_get("updated_at")
                .unwrap_or_else(|_| Utc::now().to_rfc3339()),
        }),
        None => Ok(default_preferences(workspace_id)),
    }
}

async fn load_steps(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<Vec<OnboardingStepState>, String> {
    let rows = sqlx::query(
        "SELECT step_code, status, completed_at, updated_at FROM onboarding_steps WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_all(&mut *connection)
    .await
    .map_err(to_error)?;

    let now = Utc::now().to_rfc3339();
    Ok(STEP_CODES
        .iter()
        .map(|code| {
            rows.iter()
                .find(|row| row.try_get::<String, _>("step_code").ok().as_deref() == Some(*code))
                .map(|row| OnboardingStepState {
                    code: (*code).to_string(),
                    status: row
                        .try_get("status")
                        .unwrap_or_else(|_| "pending".to_string()),
                    completed_at: row.try_get("completed_at").ok(),
                    updated_at: row
                        .try_get("updated_at")
                        .unwrap_or_else(|_| now.clone()),
                })
                .unwrap_or_else(|| OnboardingStepState {
                    code: (*code).to_string(),
                    status: "pending".to_string(),
                    completed_at: None,
                    updated_at: now.clone(),
                })
        })
        .collect())
}

fn summarize_state(
    preferences: OnboardingPreferences,
    steps: Vec<OnboardingStepState>,
    persisted: bool,
    read_only: bool,
) -> OnboardingState {
    let completed_steps = steps
        .iter()
        .filter(|step| step.status == "completed")
        .count() as i64;
    let total_steps = STEP_CODES.len() as i64;
    let completed = completed_steps == total_steps || preferences.completed_at.is_some();
    let next_step = if completed {
        None
    } else {
        STEP_CODES.iter().find_map(|code| {
            steps
                .iter()
                .find(|step| step.code == *code && step.status != "completed")
                .map(|step| step.code.clone())
        })
    };
    OnboardingState {
        skipped: preferences.skipped_at.is_some(),
        preferences,
        steps,
        progress_percent: ((completed_steps * 100) / total_steps).clamp(0, 100),
        completed_steps,
        total_steps,
        next_step,
        completed,
        persisted,
        read_only,
    }
}

fn observed_completion(step_code: &str, observed: &OnboardingObservedState) -> bool {
    match step_code {
        "account" => observed.account_count > 0,
        "first_record" => {
            observed.transaction_count + observed.payable_count + observed.receivable_count > 0
        }
        "planning" => observed.budget_count > 0 || observed.goal_count > 0,
        "security" => observed.security_ready,
        "backup" => observed.backup_count > 0,
        _ => false,
    }
}

async fn insert_event(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    event_kind: &str,
    step_code: Option<&str>,
    detail: &str,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO onboarding_events (id, workspace_id, event_kind, step_code, detail, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(workspace_id)
    .bind(event_kind)
    .bind(step_code)
    .bind(detail.chars().take(240).collect::<String>())
    .bind(Utc::now().to_rfc3339())
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

async fn ensure_preferences_row(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT OR IGNORE INTO onboarding_preferences (workspace_id, auto_open, show_progress_dock, contextual_help_enabled, completed_at, skipped_at, updated_at) VALUES ($1, 1, 1, 1, NULL, NULL, $2)",
    )
    .bind(workspace_id)
    .bind(now)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

async fn update_completion(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<(), String> {
    let completed = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM onboarding_steps WHERE workspace_id = $1 AND status = 'completed'",
    )
    .bind(workspace_id)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    if completed == STEP_CODES.len() as i64 {
        let now = Utc::now().to_rfc3339();
        let result = sqlx::query(
            "UPDATE onboarding_preferences SET completed_at = COALESCE(completed_at, $2), skipped_at = NULL, auto_open = 0, updated_at = $2 WHERE workspace_id = $1 AND completed_at IS NULL",
        )
        .bind(workspace_id)
        .bind(&now)
        .execute(&mut *connection)
        .await
        .map_err(to_error)?;
        if result.rows_affected() > 0 {
            insert_event(connection, workspace_id, "guide_completed", None, "Todas as etapas essenciais foram concluídas.").await?;
        }
    }
    Ok(())
}

async fn load_state(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    persisted: bool,
    read_only: bool,
) -> Result<OnboardingState, String> {
    let preferences = load_preferences(connection, workspace_id).await?;
    let steps = load_steps(connection, workspace_id).await?;
    Ok(summarize_state(preferences, steps, persisted, read_only))
}

#[tauri::command(async)]
pub fn onboarding_get_state(app: AppHandle, workspace_id: String) -> Result<OnboardingState, String> {
    run_local_async_worker("finnacialux-onboarding-state", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let read_only = state.access_status().read_only;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &workspace_id).await?;
        let result = load_state(&mut connection, &workspace_id, true, read_only).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn onboarding_sync_progress(app: AppHandle, request: OnboardingSyncRequest) -> Result<OnboardingState, String> {
    run_local_async_worker("finnacialux-onboarding-sync", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let read_only = state.access_status().read_only;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        if read_only {
            let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
            let mut steps = load_steps(&mut connection, &request.workspace_id).await?;
            let now = Utc::now().to_rfc3339();
            for step in &mut steps {
                if step.status == "pending" && observed_completion(&step.code, &request.observed) {
                    step.status = "completed".to_string();
                    step.completed_at = Some(now.clone());
                    step.updated_at = now.clone();
                }
            }
            connection.close().await.map_err(to_error)?;
            return Ok(summarize_state(preferences, steps, false, true));
        }

        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let stored = load_steps(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        for step in stored {
            if step.status == "pending" && observed_completion(&step.code, &request.observed) {
                sqlx::query(
                    "INSERT INTO onboarding_steps (workspace_id, step_code, status, completed_at, metadata_json, updated_at) VALUES ($1, $2, 'completed', $3, '{}', $3) ON CONFLICT(workspace_id, step_code) DO UPDATE SET status = 'completed', completed_at = excluded.completed_at, updated_at = excluded.updated_at WHERE onboarding_steps.status = 'pending'",
                )
                .bind(&request.workspace_id)
                .bind(&step.code)
                .bind(&now)
                .execute(&mut connection)
                .await
                .map_err(to_error)?;
                insert_event(&mut connection, &request.workspace_id, "step_completed", Some(&step.code), "Etapa confirmada pelos dados locais.").await?;
            }
        }
        update_completion(&mut connection, &request.workspace_id).await?;
        let result = load_state(&mut connection, &request.workspace_id, true, false).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn onboarding_complete_step(app: AppHandle, request: OnboardingStepRequest) -> Result<OnboardingState, String> {
    run_local_async_worker("finnacialux-onboarding-complete-step", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        validate_step_code(&request.step_code)?;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO onboarding_steps (workspace_id, step_code, status, completed_at, metadata_json, updated_at) VALUES ($1, $2, 'completed', $3, '{}', $3) ON CONFLICT(workspace_id, step_code) DO UPDATE SET status = 'completed', completed_at = excluded.completed_at, updated_at = excluded.updated_at",
        )
        .bind(&request.workspace_id)
        .bind(&request.step_code)
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        insert_event(&mut connection, &request.workspace_id, "step_completed", Some(&request.step_code), "Etapa marcada manualmente pelo usuário.").await?;
        update_completion(&mut connection, &request.workspace_id).await?;
        let result = load_state(&mut connection, &request.workspace_id, true, false).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn onboarding_skip_guide(app: AppHandle, request: OnboardingSkipRequest) -> Result<OnboardingState, String> {
    run_local_async_worker("finnacialux-onboarding-skip", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE onboarding_preferences SET skipped_at = $2, auto_open = 0, updated_at = $2 WHERE workspace_id = $1")
            .bind(&request.workspace_id)
            .bind(&now)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
        insert_event(
            &mut connection,
            &request.workspace_id,
            "guide_skipped",
            None,
            request.reason.as_deref().unwrap_or("Guia adiado pelo usuário."),
        )
        .await?;
        let result = load_state(&mut connection, &request.workspace_id, true, false).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn onboarding_reset_guide(app: AppHandle, workspace_id: String) -> Result<OnboardingState, String> {
    run_local_async_worker("finnacialux-onboarding-reset", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &workspace_id).await?;
        ensure_preferences_row(&mut connection, &workspace_id).await?;
        let mut transaction = connection.begin().await.map_err(to_error)?;
        sqlx::query("DELETE FROM onboarding_steps WHERE workspace_id = $1")
            .bind(&workspace_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE onboarding_preferences SET completed_at = NULL, skipped_at = NULL, auto_open = 1, show_progress_dock = 1, updated_at = $2 WHERE workspace_id = $1")
            .bind(&workspace_id)
            .bind(&now)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
        insert_event(&mut connection, &workspace_id, "guide_reset", None, "O guia de primeiros passos foi reiniciado.").await?;
        let result = load_state(&mut connection, &workspace_id, true, false).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn onboarding_save_preferences(app: AppHandle, request: SaveOnboardingPreferencesRequest) -> Result<OnboardingState, String> {
    run_local_async_worker("finnacialux-onboarding-save-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_workspace(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO onboarding_preferences (workspace_id, auto_open, show_progress_dock, contextual_help_enabled, completed_at, skipped_at, updated_at) VALUES ($1, $2, $3, $4, NULL, NULL, $5) ON CONFLICT(workspace_id) DO UPDATE SET auto_open = excluded.auto_open, show_progress_dock = excluded.show_progress_dock, contextual_help_enabled = excluded.contextual_help_enabled, updated_at = excluded.updated_at",
        )
        .bind(&request.workspace_id)
        .bind(if request.auto_open { 1 } else { 0 })
        .bind(if request.show_progress_dock { 1 } else { 0 })
        .bind(if request.contextual_help_enabled { 1 } else { 0 })
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        insert_event(&mut connection, &request.workspace_id, "preferences_changed", None, "Preferências do guia atualizadas.").await?;
        let result = load_state(&mut connection, &request.workspace_id, true, false).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn observed_rules_require_real_local_evidence() {
        let empty = OnboardingObservedState {
            account_count: 0,
            transaction_count: 0,
            payable_count: 0,
            receivable_count: 0,
            budget_count: 0,
            goal_count: 0,
            backup_count: 0,
            security_ready: false,
        };
        assert!(!observed_completion("account", &empty));
        assert!(!observed_completion("first_record", &empty));
        assert!(!observed_completion("planning", &empty));
        assert!(!observed_completion("security", &empty));
        assert!(!observed_completion("backup", &empty));
    }

    #[test]
    fn summary_never_counts_skipped_steps_as_completed() {
        let preferences = default_preferences("workspace-test");
        let steps = STEP_CODES
            .iter()
            .enumerate()
            .map(|(index, code)| OnboardingStepState {
                code: (*code).to_string(),
                status: if index < 2 { "completed" } else if index == 2 { "skipped" } else { "pending" }.to_string(),
                completed_at: None,
                updated_at: Utc::now().to_rfc3339(),
            })
            .collect();
        let state = summarize_state(preferences, steps, true, false);
        assert_eq!(state.completed_steps, 2);
        assert_eq!(state.progress_percent, 33);
        assert!(!state.completed);
    }
}
