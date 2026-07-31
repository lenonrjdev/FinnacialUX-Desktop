use crate::{
    command_worker::run_local_async_worker,
    encrypted_database::{connect_app_database, EncryptedDatabaseState},
    reconciliation::ensure_transaction_document_change_allowed,
};
use chrono::{Duration, Months, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use sqlx::{Connection, Row};
use std::collections::{BTreeMap, HashMap, HashSet};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const AUTOMATION_DOCUMENTS: [&str; 6] = [
    "automation-rules",
    "recurring-templates",
    "transactions",
    "payables",
    "receivables",
    "subscriptions",
];

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn ensure_database_writable(state: &EncryptedDatabaseState) -> Result<(), String> {
    let access = state.access_status();
    if access.read_only {
        return Err(access.reason.unwrap_or_else(|| {
            "O banco está em modo somente leitura. As automações não podem alterar dados enquanto a integridade estiver protegida.".to_string()
        }));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationPreferences {
    pub workspace_id: String,
    pub simulation_required: bool,
    pub startup_scan_enabled: bool,
    pub due_window_days: i64,
    pub alert_overdue: bool,
    pub alert_upcoming: bool,
    pub last_run_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAutomationPreferencesRequest {
    pub workspace_id: String,
    pub simulation_required: bool,
    pub startup_scan_enabled: bool,
    pub due_window_days: i64,
    pub alert_overdue: bool,
    pub alert_upcoming: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationCandidate {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub description: String,
    pub target_module: String,
    pub target_id: String,
    pub rule_id: Option<String>,
    pub template_id: Option<String>,
    pub occurrence_date: Option<String>,
    pub before: Option<Map<String, Value>>,
    pub after: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationAlert {
    pub id: String,
    pub kind: String,
    pub severity: String,
    pub status: String,
    pub title: String,
    pub message: String,
    pub target_module: String,
    pub target_id: String,
    pub due_at: String,
    pub days_until_due: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationPreviewSummary {
    pub rule_changes: usize,
    pub learned_suggestions: usize,
    pub recurring_transactions: usize,
    pub alerts: usize,
    pub total_candidates: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationPreview {
    pub preview_id: String,
    pub source_checksum: String,
    pub reference_date: String,
    pub generated_at: String,
    pub candidates: Vec<AutomationCandidate>,
    pub alerts: Vec<AutomationAlert>,
    pub summary: AutomationPreviewSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRun {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub reference_date: String,
    pub candidates_total: i64,
    pub changes_applied: i64,
    pub skipped_total: i64,
    pub affected_modules: Vec<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub undone_at: Option<String>,
    pub reversible: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyAutomationRequest {
    pub workspace_id: String,
    pub source_checksum: String,
    pub reference_date: String,
    pub selected_candidate_ids: Vec<String>,
}

async fn ensure_preferences_row(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"INSERT OR IGNORE INTO automation_preferences (
             workspace_id, simulation_required, startup_scan_enabled, due_window_days,
             alert_overdue, alert_upcoming, last_run_at, updated_at
           ) SELECT id, 1, 1, 7, 1, 1, NULL, $2 FROM workspaces WHERE id = $1"#,
    )
    .bind(workspace_id)
    .bind(now)
    .execute(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(())
}

async fn load_preferences(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<AutomationPreferences, String> {
    let row = sqlx::query(
        r#"SELECT workspace_id, simulation_required, startup_scan_enabled, due_window_days,
                  alert_overdue, alert_upcoming, last_run_at, updated_at
             FROM automation_preferences
            WHERE workspace_id = $1
            LIMIT 1"#,
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;

    if let Some(row) = row {
        return Ok(AutomationPreferences {
            workspace_id: row.try_get("workspace_id").map_err(to_error)?,
            simulation_required: row.try_get::<i64, _>("simulation_required").unwrap_or(1) != 0,
            startup_scan_enabled: row.try_get::<i64, _>("startup_scan_enabled").unwrap_or(1) != 0,
            due_window_days: row.try_get("due_window_days").unwrap_or(7),
            alert_overdue: row.try_get::<i64, _>("alert_overdue").unwrap_or(1) != 0,
            alert_upcoming: row.try_get::<i64, _>("alert_upcoming").unwrap_or(1) != 0,
            last_run_at: row.try_get("last_run_at").ok(),
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
        return Err("O espaço financeiro não foi encontrado para configurar automações.".to_string());
    }
    Ok(AutomationPreferences {
        workspace_id: workspace_id.to_string(),
        simulation_required: true,
        startup_scan_enabled: true,
        due_window_days: 7,
        alert_overdue: true,
        alert_upcoming: true,
        last_run_at: None,
        updated_at: Utc::now().to_rfc3339(),
    })
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
    .map_err(to_error)?;
    let mut documents = Map::new();
    for row in rows {
        let module: String = row.try_get("module").map_err(to_error)?;
        let data_json: String = row.try_get("data_json").map_err(to_error)?;
        let value = serde_json::from_str::<Value>(&data_json).map_err(to_error)?;
        documents.insert(module, value);
    }
    Ok(documents)
}

fn documents_checksum(documents: &Map<String, Value>) -> Result<String, String> {
    let mut ordered = BTreeMap::<String, Value>::new();
    for module in AUTOMATION_DOCUMENTS {
        ordered.insert(
            module.to_string(),
            documents.get(module).cloned().unwrap_or(Value::Null),
        );
    }
    let bytes = serde_json::to_vec(&ordered).map_err(to_error)?;
    Ok(hex::encode(Sha256::digest(bytes)))
}

fn selected_documents_checksum(
    documents: &Map<String, Value>,
    modules: &[String],
) -> Result<String, String> {
    let mut ordered = BTreeMap::<String, Value>::new();
    for module in modules {
        ordered.insert(
            module.clone(),
            documents.get(module).cloned().unwrap_or(Value::Null),
        );
    }
    let bytes = serde_json::to_vec(&ordered).map_err(to_error)?;
    Ok(hex::encode(Sha256::digest(bytes)))
}

fn document_array(documents: &Map<String, Value>, module: &str) -> Vec<Value> {
    documents
        .get(module)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn object_string(object: &Map<String, Value>, key: &str) -> String {
    object
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn object_bool(object: &Map<String, Value>, key: &str, fallback: bool) -> bool {
    object.get(key).and_then(Value::as_bool).unwrap_or(fallback)
}

fn object_i64(object: &Map<String, Value>, key: &str, fallback: i64) -> i64 {
    object.get(key).and_then(Value::as_i64).unwrap_or(fallback)
}

fn rule_matches(rule: &Map<String, Value>, transaction: &Map<String, Value>) -> bool {
    if !object_bool(rule, "active", true) {
        return false;
    }
    let field = object_string(rule, "field");
    let operator = object_string(rule, "operator");
    let expected = object_string(rule, "value").trim().to_lowercase();
    if expected.is_empty() {
        return false;
    }
    let actual = object_string(transaction, &field).trim().to_lowercase();
    match operator.as_str() {
        "starts-with" => actual.starts_with(&expected),
        "equals" => actual == expected,
        _ => actual.contains(&expected),
    }
}

fn build_rule_candidates(documents: &Map<String, Value>) -> Vec<AutomationCandidate> {
    let mut rules = document_array(documents, "automation-rules");
    rules.sort_by_key(|rule| {
        rule.as_object()
            .map(|object| object_i64(object, "priority", i64::MAX))
            .unwrap_or(i64::MAX)
    });
    let transactions = document_array(documents, "transactions");
    let mut candidates = Vec::new();

    for transaction_value in transactions {
        let Some(transaction) = transaction_value.as_object() else {
            continue;
        };
        for rule_value in &rules {
            let Some(rule) = rule_value.as_object() else {
                continue;
            };
            if !rule_matches(rule, transaction) {
                continue;
            }
            let Some(actions) = rule.get("actions").and_then(Value::as_object) else {
                break;
            };
            let mut after = transaction.clone();
            for field in ["category", "account", "type"] {
                if let Some(value) = actions.get(field) {
                    if !value.is_null() && value.as_str().is_some_and(|text| !text.trim().is_empty()) {
                        after.insert(field.to_string(), value.clone());
                    }
                }
            }
            if after != *transaction {
                let transaction_id = object_string(transaction, "id");
                let rule_id = object_string(rule, "id");
                candidates.push(AutomationCandidate {
                    id: format!("rule:{rule_id}:{transaction_id}"),
                    kind: "rule".to_string(),
                    title: object_string(rule, "name"),
                    description: object_string(transaction, "description"),
                    target_module: "transactions".to_string(),
                    target_id: transaction_id,
                    rule_id: Some(rule_id),
                    template_id: None,
                    occurrence_date: None,
                    before: Some(transaction.clone()),
                    after,
                });
            }
            break;
        }
    }
    candidates
}

fn normalized_description(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| if character.is_alphanumeric() { character } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_generic_category(value: &str) -> bool {
    matches!(
        value.trim().to_lowercase().as_str(),
        "" | "outros" | "sem categoria" | "uncategorized"
    )
}

fn build_history_suggestion_candidates(
    documents: &Map<String, Value>,
    excluded_target_ids: &HashSet<String>,
) -> Vec<AutomationCandidate> {
    let transactions = document_array(documents, "transactions");
    let mut candidates = Vec::new();

    for target_value in &transactions {
        let Some(target) = target_value.as_object() else {
            continue;
        };
        let target_id = object_string(target, "id");
        if target_id.is_empty() || excluded_target_ids.contains(&target_id) {
            continue;
        }
        let current_category = object_string(target, "category");
        if !is_generic_category(&current_category) {
            continue;
        }
        let signature = normalized_description(&object_string(target, "description"));
        if signature.len() < 3 {
            continue;
        }

        let mut category_counts = HashMap::<String, usize>::new();
        let mut eligible_total = 0usize;
        for historical_value in &transactions {
            let Some(historical) = historical_value.as_object() else {
                continue;
            };
            if object_string(historical, "id") == target_id
                || normalized_description(&object_string(historical, "description")) != signature
            {
                continue;
            }
            let category = object_string(historical, "category");
            if is_generic_category(&category) {
                continue;
            }
            eligible_total += 1;
            *category_counts.entry(category).or_insert(0) += 1;
        }

        let Some((suggested_category, matching_count)) = category_counts
            .into_iter()
            .max_by(|left, right| left.1.cmp(&right.1).then_with(|| right.0.cmp(&left.0)))
        else {
            continue;
        };
        if matching_count < 2 || matching_count * 4 < eligible_total * 3 {
            continue;
        }

        let mut after = target.clone();
        after.insert(
            "category".to_string(),
            Value::String(suggested_category.clone()),
        );
        candidates.push(AutomationCandidate {
            id: format!("suggestion:{target_id}"),
            kind: "suggestion".to_string(),
            title: "Sugestão pelo histórico".to_string(),
            description: format!(
                "{} · {} lançamentos semelhantes em {}",
                object_string(target, "description"),
                matching_count,
                suggested_category
            ),
            target_module: "transactions".to_string(),
            target_id,
            rule_id: None,
            template_id: None,
            occurrence_date: None,
            before: Some(target.clone()),
            after,
        });
    }

    candidates
}

fn parse_date(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| format!("Data de automação inválida: {value}"))
}

fn advance_date(value: &str, frequency: &str, interval: i64) -> Result<String, String> {
    let date = parse_date(value)?;
    let safe_interval = interval.clamp(1, 24) as u32;
    let next = match frequency {
        "weekly" => date.checked_add_signed(Duration::days(7 * i64::from(safe_interval))),
        "quarterly" => date.checked_add_months(Months::new(3 * safe_interval)),
        "yearly" => date.checked_add_months(Months::new(12 * safe_interval)),
        _ => date.checked_add_months(Months::new(safe_interval)),
    }
    .ok_or_else(|| "A recorrência ultrapassou o intervalo de datas suportado.".to_string())?;
    Ok(next.format("%Y-%m-%d").to_string())
}

fn stable_transaction_id(template_id: &str, occurrence_date: &str) -> String {
    let digest = Sha256::digest(format!("{template_id}:{occurrence_date}").as_bytes());
    format!("automation-{}", hex::encode(&digest[..12]))
}

fn recurrence_candidate_id(template_id: &str, occurrence_date: &str) -> String {
    format!("recurrence:{template_id}:{occurrence_date}")
}

fn transaction_already_generated(
    transactions: &[Value],
    template_id: &str,
    occurrence_date: &str,
) -> bool {
    transactions.iter().any(|transaction| {
        let Some(object) = transaction.as_object() else {
            return false;
        };
        object_string(object, "sourceType") == "automation-recurrence"
            && object_string(object, "sourceId") == template_id
            && object_string(object, "date") == occurrence_date
    })
}

fn build_recurrence_candidates(
    documents: &Map<String, Value>,
    reference_date: &str,
) -> Result<Vec<AutomationCandidate>, String> {
    let templates = document_array(documents, "recurring-templates");
    let transactions = document_array(documents, "transactions");
    let reference = parse_date(reference_date)?;
    let mut candidates = Vec::new();

    for template_value in templates {
        let Some(template) = template_value.as_object() else {
            continue;
        };
        if !object_bool(template, "active", true) {
            continue;
        }
        let template_id = object_string(template, "id");
        let template_name = object_string(template, "name");
        let frequency = object_string(template, "frequency");
        let interval = object_i64(template, "interval", 1).clamp(1, 24);
        let mut occurrence = object_string(template, "nextRunAt");
        let Some(payload) = template.get("transaction").and_then(Value::as_object) else {
            continue;
        };

        for _ in 0..12 {
            if occurrence.is_empty() || parse_date(&occurrence)? > reference {
                break;
            }
            if !transaction_already_generated(&transactions, &template_id, &occurrence) {
                let mut transaction = payload.clone();
                let target_id = stable_transaction_id(&template_id, &occurrence);
                transaction.insert("id".to_string(), Value::String(target_id.clone()));
                transaction.insert("date".to_string(), Value::String(occurrence.clone()));
                let generated_status = transaction
                    .get("status")
                    .cloned()
                    .unwrap_or_else(|| Value::String("pending".to_string()));
                let generated_payment_method = transaction
                    .get("paymentMethod")
                    .cloned()
                    .unwrap_or_else(|| Value::String("Automação local".to_string()));
                transaction.insert("status".to_string(), generated_status);
                transaction.insert("paymentMethod".to_string(), generated_payment_method);
                transaction.insert(
                    "sourceType".to_string(),
                    Value::String("automation-recurrence".to_string()),
                );
                transaction.insert("sourceId".to_string(), Value::String(template_id.clone()));
                candidates.push(AutomationCandidate {
                    id: recurrence_candidate_id(&template_id, &occurrence),
                    kind: "recurrence".to_string(),
                    title: template_name.clone(),
                    description: object_string(payload, "description"),
                    target_module: "transactions".to_string(),
                    target_id,
                    rule_id: None,
                    template_id: Some(template_id.clone()),
                    occurrence_date: Some(occurrence.clone()),
                    before: None,
                    after: transaction,
                });
            }
            occurrence = advance_date(&occurrence, &frequency, interval)?;
        }
    }
    Ok(candidates)
}

fn alert_severity(days_until_due: i64) -> String {
    if days_until_due < 0 {
        "critical".to_string()
    } else if days_until_due <= 2 {
        "warning".to_string()
    } else {
        "info".to_string()
    }
}

fn push_due_alert(
    alerts: &mut Vec<AutomationAlert>,
    states: &HashMap<String, String>,
    preferences: &AutomationPreferences,
    reference: NaiveDate,
    kind: &str,
    module: &str,
    id: String,
    due_at: String,
    title: String,
    message: String,
) {
    let Ok(due) = parse_date(&due_at) else {
        return;
    };
    let days = due.signed_duration_since(reference).num_days();
    let should_include = if days < 0 {
        preferences.alert_overdue
    } else {
        preferences.alert_upcoming && days <= preferences.due_window_days
    };
    if !should_include {
        return;
    }
    let alert_id = format!("{kind}:{id}:{due_at}");
    let status = states
        .get(&alert_id)
        .cloned()
        .unwrap_or_else(|| "active".to_string());
    if status == "dismissed" {
        return;
    }
    alerts.push(AutomationAlert {
        id: alert_id,
        kind: kind.to_string(),
        severity: alert_severity(days),
        status,
        title,
        message,
        target_module: module.to_string(),
        target_id: id,
        due_at,
        days_until_due: days,
    });
}

fn build_alerts(
    documents: &Map<String, Value>,
    preferences: &AutomationPreferences,
    states: &HashMap<String, String>,
    reference_date: &str,
) -> Result<Vec<AutomationAlert>, String> {
    let reference = parse_date(reference_date)?;
    let mut alerts = Vec::new();

    for value in document_array(documents, "payables") {
        let Some(item) = value.as_object() else { continue };
        let status = object_string(item, "status");
        if status == "paid" { continue; }
        let description = object_string(item, "description");
        push_due_alert(
            &mut alerts,
            states,
            preferences,
            reference,
            "payable",
            "payables",
            object_string(item, "id"),
            object_string(item, "dueDate"),
            if status == "overdue" { format!("Conta vencida: {description}") } else { format!("Conta próxima: {description}") },
            "Revise o vencimento antes de confirmar o pagamento.".to_string(),
        );
    }

    for value in document_array(documents, "receivables") {
        let Some(item) = value.as_object() else { continue };
        let status = object_string(item, "status");
        if status == "received" { continue; }
        let description = object_string(item, "description");
        push_due_alert(
            &mut alerts,
            states,
            preferences,
            reference,
            "receivable",
            "receivables",
            object_string(item, "id"),
            object_string(item, "expectedDate"),
            if status == "overdue" { format!("Recebimento atrasado: {description}") } else { format!("Recebimento esperado: {description}") },
            "Acompanhe a entrada prevista e atualize quando o valor for recebido.".to_string(),
        );
    }

    for value in document_array(documents, "subscriptions") {
        let Some(item) = value.as_object() else { continue };
        let status = object_string(item, "status");
        if status != "active" && status != "trial" { continue; }
        let name = object_string(item, "name");
        push_due_alert(
            &mut alerts,
            states,
            preferences,
            reference,
            "subscription",
            "subscriptions",
            object_string(item, "id"),
            object_string(item, "nextChargeDate"),
            format!("Cobrança de assinatura: {name}"),
            "Confira saldo, uso e renovação antes da próxima cobrança.".to_string(),
        );
    }

    alerts.sort_by_key(|alert| (alert.days_until_due, alert.title.clone()));
    Ok(alerts)
}

async fn load_alert_states(
    connection: &mut sqlx::SqliteConnection,
    workspace_id: &str,
) -> Result<HashMap<String, String>, String> {
    let rows = sqlx::query(
        "SELECT alert_id, status FROM automation_alert_states WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_all(&mut *connection)
    .await
    .map_err(to_error)?;
    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let id: String = row.try_get("alert_id").ok()?;
            let status: String = row.try_get("status").ok()?;
            Some((id, status))
        })
        .collect())
}

fn build_preview(
    documents: &Map<String, Value>,
    preferences: &AutomationPreferences,
    states: &HashMap<String, String>,
    reference_date: &str,
) -> Result<AutomationPreview, String> {
    parse_date(reference_date)?;
    let mut candidates = build_rule_candidates(documents);
    let ruled_targets = candidates
        .iter()
        .map(|candidate| candidate.target_id.clone())
        .collect::<HashSet<_>>();
    candidates.extend(build_history_suggestion_candidates(documents, &ruled_targets));
    candidates.extend(build_recurrence_candidates(documents, reference_date)?);
    let alerts = build_alerts(documents, preferences, states, reference_date)?;
    let rule_changes = candidates.iter().filter(|candidate| candidate.kind == "rule").count();
    let learned_suggestions = candidates
        .iter()
        .filter(|candidate| candidate.kind == "suggestion")
        .count();
    let recurring_transactions = candidates
        .iter()
        .filter(|candidate| candidate.kind == "recurrence")
        .count();
    Ok(AutomationPreview {
        preview_id: format!("preview-{}", Uuid::new_v4()),
        source_checksum: documents_checksum(documents)?,
        reference_date: reference_date.to_string(),
        generated_at: Utc::now().to_rfc3339(),
        summary: AutomationPreviewSummary {
            rule_changes,
            learned_suggestions,
            recurring_transactions,
            alerts: alerts.len(),
            total_candidates: candidates.len(),
        },
        candidates,
        alerts,
    })
}

pub(crate) async fn simulate_automation_preview(
    app: &AppHandle,
    workspace_id: &str,
    reference_date: &str,
) -> Result<AutomationPreview, String> {
    let state = app.state::<EncryptedDatabaseState>();
    let mut connection = connect_app_database(app, &state).await?;
    let preferences = load_preferences(&mut connection, workspace_id).await?;
    let documents = read_documents(&mut connection, workspace_id).await?;
    let alert_states = load_alert_states(&mut connection, workspace_id).await?;
    connection.close().await.map_err(to_error)?;
    build_preview(&documents, &preferences, &alert_states, reference_date)
}

fn run_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<AutomationRun, String> {
    let affected_json: String = row.try_get("affected_modules_json").unwrap_or_else(|_| "[]".to_string());
    Ok(AutomationRun {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        status: row.try_get("status").map_err(to_error)?,
        reference_date: row.try_get("reference_date").map_err(to_error)?,
        candidates_total: row.try_get("candidates_total").unwrap_or(0),
        changes_applied: row.try_get("changes_applied").unwrap_or(0),
        skipped_total: row.try_get("skipped_total").unwrap_or(0),
        affected_modules: serde_json::from_str(&affected_json).unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or_default(),
        completed_at: row.try_get("completed_at").ok(),
        undone_at: row.try_get("undone_at").ok(),
        reversible: row.try_get::<i64, _>("reversible").unwrap_or(0) != 0,
        error_message: row.try_get("error_message").ok(),
    })
}

async fn upsert_document(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    workspace_id: &str,
    module: &str,
    value: &Value,
    updated_at: &str,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO finance_documents (workspace_id, module, data_json, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT(workspace_id, module)
           DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"#,
    )
    .bind(workspace_id)
    .bind(module)
    .bind(serde_json::to_string(value).map_err(to_error)?)
    .bind(updated_at)
    .execute(&mut **transaction)
    .await
    .map_err(to_error)?;
    Ok(())
}

#[tauri::command(async)]
pub fn automation_get_preferences(
    app: AppHandle,
    workspace_id: String,
) -> Result<AutomationPreferences, String> {
    run_local_async_worker("finnacialux-automation-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(preferences)
    })
}

#[tauri::command(async)]
pub fn automation_save_preferences(
    app: AppHandle,
    request: SaveAutomationPreferencesRequest,
) -> Result<AutomationPreferences, String> {
    run_local_async_worker("finnacialux-automation-save-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        if !request.simulation_required {
            return Err("A simulação obrigatória é uma proteção fixa e não pode ser desativada.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"UPDATE automation_preferences
                  SET simulation_required = $1,
                      startup_scan_enabled = $2,
                      due_window_days = $3,
                      alert_overdue = $4,
                      alert_upcoming = $5,
                      updated_at = $6
                WHERE workspace_id = $7"#,
        )
        .bind(if request.simulation_required { 1 } else { 0 })
        .bind(if request.startup_scan_enabled { 1 } else { 0 })
        .bind(request.due_window_days.clamp(1, 60))
        .bind(if request.alert_overdue { 1 } else { 0 })
        .bind(if request.alert_upcoming { 1 } else { 0 })
        .bind(now)
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
pub fn automation_simulate(
    app: AppHandle,
    workspace_id: String,
    reference_date: String,
) -> Result<AutomationPreview, String> {
    run_local_async_worker("finnacialux-automation-simulate", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &workspace_id).await?;
        let documents = read_documents(&mut connection, &workspace_id).await?;
        let alert_states = load_alert_states(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        build_preview(&documents, &preferences, &alert_states, &reference_date)
    })
}

#[tauri::command(async)]
pub fn automation_apply(
    app: AppHandle,
    request: ApplyAutomationRequest,
) -> Result<AutomationRun, String> {
    run_local_async_worker("finnacialux-automation-apply", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        ensure_preferences_row(&mut connection, &request.workspace_id).await?;
        let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
        if !preferences.simulation_required {
            connection.close().await.map_err(to_error)?;
            return Err("A política local exige simulação antes de qualquer aplicação.".to_string());
        }
        let documents = read_documents(&mut connection, &request.workspace_id).await?;
        let alert_states = load_alert_states(&mut connection, &request.workspace_id).await?;
        let preview = build_preview(&documents, &preferences, &alert_states, &request.reference_date)?;
        if preview.source_checksum != request.source_checksum {
            connection.close().await.map_err(to_error)?;
            return Err("Os dados mudaram depois da simulação. Execute uma nova prévia antes de aplicar.".to_string());
        }
        if request.selected_candidate_ids.is_empty() {
            connection.close().await.map_err(to_error)?;
            return Err("Selecione ao menos uma alteração automática.".to_string());
        }

        let selected: HashSet<String> = request.selected_candidate_ids.iter().cloned().collect();
        let available: HashSet<String> = preview.candidates.iter().map(|candidate| candidate.id.clone()).collect();
        if selected.iter().any(|id| !available.contains(id)) {
            connection.close().await.map_err(to_error)?;
            return Err("A seleção contém uma alteração que não pertence mais à simulação atual.".to_string());
        }

        let mut next_documents = documents.clone();
        let mut transactions = document_array(&documents, "transactions");
        let mut templates = document_array(&documents, "recurring-templates");
        let mut changed_modules = HashSet::<String>::new();
        let mut applied_ids = HashSet::<String>::new();

        for candidate in preview.candidates.iter().filter(|candidate| {
            (candidate.kind == "rule" || candidate.kind == "suggestion")
                && selected.contains(&candidate.id)
        }) {
            if let Some(index) = transactions.iter().position(|value| {
                value.as_object().is_some_and(|object| object_string(object, "id") == candidate.target_id)
            }) {
                transactions[index] = Value::Object(candidate.after.clone());
                changed_modules.insert("transactions".to_string());
                applied_ids.insert(candidate.id.clone());
            }
        }

        for template_value in &mut templates {
            let Some(template) = template_value.as_object_mut() else { continue };
            let template_id = object_string(template, "id");
            if template_id.is_empty() || !object_bool(template, "active", true) { continue; }
            let frequency = object_string(template, "frequency");
            let interval = object_i64(template, "interval", 1).clamp(1, 24);
            let mut cursor = object_string(template, "nextRunAt");
            let mut last_applied: Option<String> = None;
            for _ in 0..12 {
                if cursor.is_empty() || parse_date(&cursor)? > parse_date(&request.reference_date)? { break; }
                let candidate_id = recurrence_candidate_id(&template_id, &cursor);
                if !selected.contains(&candidate_id) { break; }
                let Some(candidate) = preview.candidates.iter().find(|candidate| candidate.id == candidate_id) else { break; };
                transactions.push(Value::Object(candidate.after.clone()));
                applied_ids.insert(candidate_id);
                last_applied = Some(cursor.clone());
                cursor = advance_date(&cursor, &frequency, interval)?;
            }
            if let Some(last_run_at) = last_applied {
                template.insert("lastRunAt".to_string(), Value::String(last_run_at));
                template.insert("nextRunAt".to_string(), Value::String(cursor));
                changed_modules.insert("transactions".to_string());
                changed_modules.insert("recurring-templates".to_string());
            }
        }

        if applied_ids.is_empty() {
            connection.close().await.map_err(to_error)?;
            return Err("Nenhuma alteração selecionada pôde ser aplicada. Gere uma nova simulação.".to_string());
        }

        if changed_modules.contains("transactions") {
            next_documents.insert("transactions".to_string(), Value::Array(transactions));
        }
        if changed_modules.contains("recurring-templates") {
            next_documents.insert("recurring-templates".to_string(), Value::Array(templates));
        }

        let mut affected_modules = changed_modules.into_iter().collect::<Vec<_>>();
        affected_modules.sort();
        let mut before_snapshot = Map::new();
        for module in &affected_modules {
            before_snapshot.insert(
                module.clone(),
                documents.get(module).cloned().unwrap_or(Value::Null),
            );
        }
        if let Some(next_transactions) = next_documents.get("transactions") {
            ensure_transaction_document_change_allowed(
                &mut connection,
                &request.workspace_id,
                next_transactions,
            )
            .await?;
        }

        let after_checksum = selected_documents_checksum(&next_documents, &affected_modules)?;
        let now = Utc::now().to_rfc3339();
        let run = AutomationRun {
            id: format!("automation-run-{}", Uuid::new_v4()),
            workspace_id: request.workspace_id.clone(),
            status: "applied".to_string(),
            reference_date: request.reference_date.clone(),
            candidates_total: preview.candidates.len() as i64,
            changes_applied: applied_ids.len() as i64,
            skipped_total: selected.len().saturating_sub(applied_ids.len()) as i64,
            affected_modules: affected_modules.clone(),
            created_at: now.clone(),
            completed_at: Some(now.clone()),
            undone_at: None,
            reversible: true,
            error_message: None,
        };

        let mut transaction = connection.begin().await.map_err(to_error)?;
        for module in &affected_modules {
            let value = next_documents.get(module).cloned().unwrap_or(Value::Null);
            upsert_document(&mut transaction, &request.workspace_id, module, &value, &now).await?;
        }
        sqlx::query(
            r#"INSERT INTO automation_runs (
                 id, workspace_id, status, reference_date, candidates_total, changes_applied,
                 skipped_total, affected_modules_json, before_snapshot_json,
                 after_snapshot_checksum, reversible, created_at, completed_at, undone_at, error_message
               ) VALUES ($1, $2, 'applied', $3, $4, $5, $6, $7, $8, $9, 1, $10, $10, NULL, NULL)"#,
        )
        .bind(&run.id)
        .bind(&run.workspace_id)
        .bind(&run.reference_date)
        .bind(run.candidates_total)
        .bind(run.changes_applied)
        .bind(run.skipped_total)
        .bind(serde_json::to_string(&affected_modules).map_err(to_error)?)
        .bind(serde_json::to_string(&before_snapshot).map_err(to_error)?)
        .bind(after_checksum)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
        sqlx::query("UPDATE automation_preferences SET last_run_at = $1, updated_at = $1 WHERE workspace_id = $2")
            .bind(&now)
            .bind(&request.workspace_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        sqlx::query("UPDATE workspaces SET last_activity_at = $1 WHERE id = $2")
            .bind(&now)
            .bind(&request.workspace_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        Ok(run)
    })
}

#[tauri::command(async)]
pub fn automation_list_runs(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<AutomationRun>, String> {
    run_local_async_worker("finnacialux-automation-list-runs", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query(
            r#"SELECT id, workspace_id, status, reference_date, candidates_total,
                      changes_applied, skipped_total, affected_modules_json,
                      created_at, completed_at, undone_at, reversible, error_message
                 FROM automation_runs
                WHERE workspace_id = $1
                ORDER BY created_at DESC
                LIMIT $2"#,
        )
        .bind(&workspace_id)
        .bind(limit.unwrap_or(20).clamp(1, 100))
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        rows.iter().map(run_from_row).collect()
    })
}

#[tauri::command(async)]
pub fn automation_undo_run(
    app: AppHandle,
    workspace_id: String,
    run_id: String,
) -> Result<AutomationRun, String> {
    run_local_async_worker("finnacialux-automation-undo", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let row = sqlx::query(
            r#"SELECT id, workspace_id, status, reference_date, candidates_total,
                      changes_applied, skipped_total, affected_modules_json,
                      before_snapshot_json, after_snapshot_checksum, created_at,
                      completed_at, undone_at, reversible, error_message
                 FROM automation_runs
                WHERE workspace_id = $1 AND id = $2
                LIMIT 1"#,
        )
        .bind(&workspace_id)
        .bind(&run_id)
        .fetch_optional(&mut connection)
        .await
        .map_err(to_error)?
        .ok_or_else(|| "A execução de automação não foi encontrada.".to_string())?;
        let current_run = run_from_row(&row)?;
        if current_run.status != "applied" || !current_run.reversible || current_run.undone_at.is_some() {
            connection.close().await.map_err(to_error)?;
            return Err("Esta execução não pode mais ser desfeita.".to_string());
        }
        let snapshot_json: String = row.try_get("before_snapshot_json").map_err(to_error)?;
        let expected_checksum: String = row.try_get("after_snapshot_checksum").map_err(to_error)?;
        let before_snapshot: Map<String, Value> = serde_json::from_str(&snapshot_json).map_err(to_error)?;
        let documents = read_documents(&mut connection, &workspace_id).await?;
        let current_checksum = selected_documents_checksum(&documents, &current_run.affected_modules)?;
        if current_checksum != expected_checksum {
            connection.close().await.map_err(to_error)?;
            return Err("Os módulos foram alterados depois desta automação. O desfazer foi bloqueado para não sobrescrever mudanças posteriores.".to_string());
        }
        if current_run.affected_modules.iter().any(|module| module == "transactions") {
            let next_transactions = before_snapshot
                .get("transactions")
                .cloned()
                .unwrap_or_else(|| Value::Array(Vec::new()));
            ensure_transaction_document_change_allowed(
                &mut connection,
                &workspace_id,
                &next_transactions,
            )
            .await?;
        }

        let now = Utc::now().to_rfc3339();
        let mut transaction = connection.begin().await.map_err(to_error)?;
        for module in &current_run.affected_modules {
            match before_snapshot.get(module) {
                Some(Value::Null) | None => {
                    sqlx::query("DELETE FROM finance_documents WHERE workspace_id = $1 AND module = $2")
                        .bind(&workspace_id)
                        .bind(module)
                        .execute(&mut *transaction)
                        .await
                        .map_err(to_error)?;
                }
                Some(value) => {
                    upsert_document(&mut transaction, &workspace_id, module, value, &now).await?;
                }
            }
        }
        sqlx::query("UPDATE automation_runs SET status = 'undone', undone_at = $1, reversible = 0 WHERE id = $2")
            .bind(&now)
            .bind(&run_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        sqlx::query("UPDATE workspaces SET last_activity_at = $1 WHERE id = $2")
            .bind(&now)
            .bind(&workspace_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
        connection.close().await.map_err(to_error)?;

        Ok(AutomationRun {
            status: "undone".to_string(),
            undone_at: Some(now),
            reversible: false,
            ..current_run
        })
    })
}

#[tauri::command(async)]
pub fn automation_mark_alert(
    app: AppHandle,
    workspace_id: String,
    alert_id: String,
    status: String,
) -> Result<(), String> {
    run_local_async_worker("finnacialux-automation-alert", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        if status != "read" && status != "dismissed" {
            return Err("Situação de alerta inválida.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        sqlx::query(
            r#"INSERT INTO automation_alert_states (workspace_id, alert_id, status, updated_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT(workspace_id, alert_id)
               DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at"#,
        )
        .bind(&workspace_id)
        .bind(&alert_id)
        .bind(&status)
        .bind(Utc::now().to_rfc3339())
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn default_preferences() -> AutomationPreferences {
        AutomationPreferences {
            workspace_id: "workspace".to_string(),
            simulation_required: true,
            startup_scan_enabled: true,
            due_window_days: 7,
            alert_overdue: true,
            alert_upcoming: true,
            last_run_at: None,
            updated_at: "2026-07-30T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn preview_combines_rules_recurrences_and_alerts() {
        let documents = json!({
            "automation-rules": [{
                "id": "rule-1", "name": "Mercado", "active": true, "priority": 1,
                "field": "description", "operator": "contains", "value": "mercado",
                "actions": { "category": "Alimentação" }
            }],
            "transactions": [{
                "id": "tx-1", "description": "Mercado Central", "category": "Outros",
                "account": "Principal", "type": "expense", "amount": 50
            }],
            "recurring-templates": [{
                "id": "rec-1", "name": "Aluguel", "active": true, "frequency": "monthly",
                "interval": 1, "nextRunAt": "2026-07-01",
                "transaction": { "description": "Aluguel", "category": "Moradia", "account": "Principal", "amount": 1000, "type": "expense", "status": "pending" }
            }],
            "payables": [{ "id": "pay-1", "description": "Energia", "status": "pending", "dueDate": "2026-07-31" }]
        });
        let preview = build_preview(
            documents.as_object().unwrap(),
            &default_preferences(),
            &HashMap::new(),
            "2026-07-30",
        )
        .unwrap();
        assert_eq!(preview.summary.rule_changes, 1);
        assert_eq!(preview.summary.learned_suggestions, 0);
        assert_eq!(preview.summary.recurring_transactions, 1);
        assert_eq!(preview.summary.alerts, 1);
    }

    #[test]
    fn recurrence_is_bounded_to_twelve_missed_occurrences() {
        let documents = json!({
            "recurring-templates": [{
                "id": "rec-1", "name": "Semanal", "active": true, "frequency": "weekly",
                "interval": 1, "nextRunAt": "2025-01-01",
                "transaction": { "description": "Reserva", "account": "Principal", "amount": 10, "type": "expense" }
            }],
            "transactions": []
        });
        let candidates = build_recurrence_candidates(documents.as_object().unwrap(), "2026-07-30").unwrap();
        assert_eq!(candidates.len(), 12);
    }

    #[test]
    fn history_suggestion_requires_two_consistent_similar_transactions() {
        let documents = json!({
            "transactions": [
                { "id": "target", "description": "Padaria Central", "category": "Outros", "account": "Principal", "type": "expense" },
                { "id": "history-1", "description": "Padaria Central", "category": "Alimentação", "account": "Principal", "type": "expense" },
                { "id": "history-2", "description": "Padaria Central", "category": "Alimentação", "account": "Principal", "type": "expense" }
            ]
        });
        let suggestions = build_history_suggestion_candidates(
            documents.as_object().unwrap(),
            &HashSet::new(),
        );
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].kind, "suggestion");
        assert_eq!(
            suggestions[0].after.get("category").and_then(Value::as_str),
            Some("Alimentação")
        );
    }

    #[test]
    fn checksum_changes_when_an_automation_source_changes() {
        let first = json!({ "transactions": [{ "id": "1", "amount": 10 }] });
        let second = json!({ "transactions": [{ "id": "1", "amount": 11 }] });
        assert_ne!(
            documents_checksum(first.as_object().unwrap()).unwrap(),
            documents_checksum(second.as_object().unwrap()).unwrap()
        );
    }
}
