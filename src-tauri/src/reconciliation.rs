use crate::{
    command_worker::run_local_async_worker,
    encrypted_database::{connect_app_database, EncryptedDatabaseState},
};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use sqlx::{Connection, Row, SqliteConnection};
use std::collections::{BTreeMap, HashMap, HashSet};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn ensure_database_writable(state: &EncryptedDatabaseState) -> Result<(), String> {
    let access = state.access_status();
    if access.read_only {
        return Err(access.reason.unwrap_or_else(|| {
            "O banco está em modo somente leitura. Conciliações e fechamentos não podem alterar dados enquanto a integridade estiver protegida.".to_string()
        }));
    }
    Ok(())
}

fn money_to_cents(value: f64) -> Result<i64, String> {
    if !value.is_finite() {
        return Err("O valor financeiro informado é inválido.".to_string());
    }
    let cents = (value * 100.0).round();
    if cents < i64::MIN as f64 || cents > i64::MAX as f64 {
        return Err("O valor financeiro ultrapassa o limite permitido.".to_string());
    }
    Ok(cents as i64)
}

fn cents_to_money(value: i64) -> f64 {
    value as f64 / 100.0
}

fn validate_date(value: &str) -> Result<(), String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| "A data precisa usar o formato AAAA-MM-DD.".to_string())
}

fn validate_month(value: &str) -> Result<(), String> {
    NaiveDate::parse_from_str(&format!("{value}-01"), "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| "O mês precisa usar o formato AAAA-MM.".to_string())
}

fn normalize_text(value: &str) -> String {
    let lowered = value.to_lowercase();
    let replacements = [
        ("á", "a"), ("à", "a"), ("â", "a"), ("ã", "a"), ("ä", "a"),
        ("é", "e"), ("è", "e"), ("ê", "e"), ("ë", "e"),
        ("í", "i"), ("ì", "i"), ("î", "i"), ("ï", "i"),
        ("ó", "o"), ("ò", "o"), ("ô", "o"), ("õ", "o"), ("ö", "o"),
        ("ú", "u"), ("ù", "u"), ("û", "u"), ("ü", "u"),
        ("ç", "c"),
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

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string()),
        Value::Array(items) => format!(
            "[{}]",
            items.iter().map(canonical_json).collect::<Vec<_>>().join(",")
        ),
        Value::Object(object) => {
            let mut keys = object.keys().collect::<Vec<_>>();
            keys.sort();
            format!(
                "{{{}}}",
                keys.iter()
                    .map(|key| format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap_or_else(|_| "\"\"".to_string()),
                        canonical_json(object.get(*key).unwrap_or(&Value::Null))
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
    }
}

fn sha256_text(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}

fn value_string(object: &Map<String, Value>, key: &str) -> String {
    object.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn value_f64(object: &Map<String, Value>, key: &str) -> f64 {
    object.get(key).and_then(Value::as_f64).unwrap_or(0.0)
}

fn transaction_id(value: &Value) -> String {
    value.as_object().map(|object| value_string(object, "id")).unwrap_or_default()
}

fn transaction_month(value: &Value) -> Option<String> {
    value.as_object()
        .and_then(|object| object.get("date"))
        .and_then(Value::as_str)
        .filter(|date| date.len() >= 7)
        .map(|date| date[..7].to_string())
}

fn sorted_transactions(value: &Value) -> Vec<Value> {
    let mut transactions = value.as_array().cloned().unwrap_or_default();
    transactions.sort_by(|left, right| transaction_id(left).cmp(&transaction_id(right)));
    transactions
}

async fn read_transactions(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<Value, String> {
    let row = sqlx::query(
        "SELECT data_json FROM finance_documents WHERE workspace_id = $1 AND module = 'transactions' LIMIT 1",
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    match row {
        Some(row) => {
            let data_json: String = row.try_get("data_json").map_err(to_error)?;
            serde_json::from_str(&data_json).map_err(to_error)
        }
        None => Ok(Value::Array(Vec::new())),
    }
}

async fn upsert_transactions(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    workspace_id: &str,
    transactions: &Value,
    updated_at: &str,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO finance_documents (workspace_id, module, data_json, updated_at)
           VALUES ($1, 'transactions', $2, $3)
           ON CONFLICT(workspace_id, module)
           DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"#,
    )
    .bind(workspace_id)
    .bind(serde_json::to_string(transactions).map_err(to_error)?)
    .bind(updated_at)
    .execute(&mut **transaction)
    .await
    .map_err(to_error)?;
    Ok(())
}

#[derive(Debug, Clone)]
struct ClosedAccount {
    id: String,
    name: String,
}

async fn closed_periods(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<HashMap<String, Vec<ClosedAccount>>, String> {
    let rows = match sqlx::query(
        "SELECT month, account_id, account_name FROM monthly_financial_closures WHERE workspace_id = $1 AND status = 'closed'",
    )
    .bind(workspace_id)
    .fetch_all(&mut *connection)
    .await
    {
        Ok(rows) => rows,
        Err(error) if error.to_string().contains("no such table") => return Ok(HashMap::new()),
        Err(error) => return Err(to_error(error)),
    };
    let mut periods = HashMap::<String, Vec<ClosedAccount>>::new();
    for row in rows {
        let month: String = row.try_get("month").map_err(to_error)?;
        periods.entry(month).or_default().push(ClosedAccount {
            id: row.try_get("account_id").map_err(to_error)?,
            name: row.try_get("account_name").map_err(to_error)?,
        });
    }
    Ok(periods)
}

fn value_matches_account(value: &Value, account: &ClosedAccount) -> bool {
    let Some(object) = value.as_object() else { return false };
    ["account", "accountId", "destinationAccount", "destinationAccountId"]
        .iter()
        .filter_map(|key| object.get(*key).and_then(Value::as_str))
        .any(|candidate| {
            let normalized = normalize_text(candidate);
            normalized == normalize_text(&account.id) || normalized == normalize_text(&account.name)
        })
}

fn closed_transaction_map(
    transactions: &Value,
    periods: &HashMap<String, Vec<ClosedAccount>>,
) -> BTreeMap<String, String> {
    let mut result = BTreeMap::new();
    for value in transactions.as_array().into_iter().flatten() {
        let Some(month) = transaction_month(value) else { continue };
        let Some(accounts) = periods.get(&month) else { continue };
        for account in accounts {
            if value_matches_account(value, account) {
                result.insert(
                    format!("{month}|{}|{}", account.id, transaction_id(value)),
                    canonical_json(value),
                );
            }
        }
    }
    result
}

pub async fn ensure_transaction_dates_open(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    account_id: &str,
    account_name: &str,
    dates: &[String],
) -> Result<(), String> {
    let periods = closed_periods(connection, workspace_id).await?;
    let selected = ClosedAccount { id: account_id.to_string(), name: account_name.to_string() };
    if let Some(month) = dates
        .iter()
        .filter(|date| date.len() >= 7)
        .map(|date| date[..7].to_string())
        .find(|month| {
            periods.get(month).is_some_and(|accounts| {
                accounts.iter().any(|account| {
                    normalize_text(&account.id) == normalize_text(&selected.id)
                        || normalize_text(&account.name) == normalize_text(&selected.name)
                })
            })
        })
    {
        return Err(format!(
            "O mês {month} está fechado para esta conta. Reabra o período na central de conciliação antes de alterar lançamentos."
        ));
    }
    Ok(())
}

async fn ensure_transaction_value_open(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    transaction: &Value,
) -> Result<(), String> {
    let periods = closed_periods(connection, workspace_id).await?;
    let Some(month) = transaction_month(transaction) else { return Ok(()) };
    if periods
        .get(&month)
        .is_some_and(|accounts| accounts.iter().any(|account| value_matches_account(transaction, account)))
    {
        return Err(format!(
            "O mês {month} está fechado para a conta deste lançamento. Reabra o período antes de alterar comprovantes."
        ));
    }
    Ok(())
}

pub async fn ensure_transaction_document_change_allowed(
    connection: &mut SqliteConnection,
    workspace_id: &str,
    next_transactions: &Value,
) -> Result<(), String> {
    let periods = closed_periods(connection, workspace_id).await?;
    if periods.is_empty() {
        return Ok(());
    }
    let current = read_transactions(connection, workspace_id).await?;
    let current_map = closed_transaction_map(&current, &periods);
    let next_map = closed_transaction_map(next_transactions, &periods);
    if current_map != next_map {
        let mut months = periods.keys().cloned().collect::<Vec<_>>();
        months.sort();
        return Err(format!(
            "A alteração foi bloqueada porque modifica lançamentos de período fechado ({}). Reabra a conta e o mês antes de continuar.",
            months.join(", ")
        ));
    }
    Ok(())
}

pub async fn guard_finance_document_sql_write(
    connection: &mut SqliteConnection,
    sql: &str,
    values: &[Value],
) -> Result<(), String> {
    let normalized = sql.trim_start().to_ascii_lowercase();
    if !normalized.contains("finance_documents") {
        return Ok(());
    }
    if normalized.starts_with("insert") || normalized.starts_with("update") {
        let workspace_id = values.first().and_then(Value::as_str).unwrap_or_default();
        let module = values.get(1).and_then(Value::as_str).unwrap_or_default();
        if module == "transactions" {
            let next = values
                .get(2)
                .and_then(Value::as_str)
                .ok_or_else(|| "O documento de lançamentos está em formato inválido.".to_string())?;
            let parsed = serde_json::from_str::<Value>(next).map_err(to_error)?;
            ensure_transaction_document_change_allowed(connection, workspace_id, &parsed).await?;
        }
    } else if normalized.starts_with("delete") {
        let workspace_id = values.first().and_then(Value::as_str).unwrap_or_default();
        let module = values.get(1).and_then(Value::as_str);
        if module.is_none() || module == Some("transactions") {
            ensure_transaction_document_change_allowed(
                connection,
                workspace_id,
                &Value::Array(Vec::new()),
            )
            .await?;
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationPreferences {
    pub workspace_id: String,
    pub date_tolerance_days: i64,
    pub amount_tolerance_cents: i64,
    pub auto_match_threshold: i64,
    pub closing_tolerance_cents: i64,
    pub require_preview_before_apply: bool,
    pub require_complete_checklist: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveReconciliationPreferencesRequest {
    pub workspace_id: String,
    pub date_tolerance_days: i64,
    pub amount_tolerance_cents: i64,
    pub auto_match_threshold: i64,
    pub closing_tolerance_cents: i64,
    pub require_preview_before_apply: bool,
    pub require_complete_checklist: bool,
}

async fn load_preferences(
    connection: &mut SqliteConnection,
    workspace_id: &str,
) -> Result<ReconciliationPreferences, String> {
    let row = sqlx::query(
        r#"SELECT workspace_id, date_tolerance_days, amount_tolerance_cents,
                  auto_match_threshold, closing_tolerance_cents,
                  require_preview_before_apply, require_complete_checklist, updated_at
             FROM reconciliation_preferences
            WHERE workspace_id = $1 LIMIT 1"#,
    )
    .bind(workspace_id)
    .fetch_optional(&mut *connection)
    .await
    .map_err(to_error)?;
    if let Some(row) = row {
        return Ok(ReconciliationPreferences {
            workspace_id: row.try_get("workspace_id").map_err(to_error)?,
            date_tolerance_days: row.try_get("date_tolerance_days").unwrap_or(2),
            amount_tolerance_cents: row.try_get("amount_tolerance_cents").unwrap_or(1),
            auto_match_threshold: row.try_get("auto_match_threshold").unwrap_or(85),
            closing_tolerance_cents: row.try_get("closing_tolerance_cents").unwrap_or(1),
            require_preview_before_apply: row
                .try_get::<i64, _>("require_preview_before_apply")
                .unwrap_or(1)
                != 0,
            require_complete_checklist: row
                .try_get::<i64, _>("require_complete_checklist")
                .unwrap_or(1)
                != 0,
            updated_at: row.try_get("updated_at").unwrap_or_else(|_| Utc::now().to_rfc3339()),
        });
    }
    Ok(ReconciliationPreferences {
        workspace_id: workspace_id.to_string(),
        date_tolerance_days: 2,
        amount_tolerance_cents: 1,
        auto_match_threshold: 85,
        closing_tolerance_cents: 1,
        require_preview_before_apply: true,
        require_complete_checklist: true,
        updated_at: Utc::now().to_rfc3339(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatementEntryInput {
    pub id: String,
    pub external_id: Option<String>,
    pub posted_at: String,
    pub description: String,
    pub amount: f64,
    pub direction: String,
    pub memo: Option<String>,
    pub fingerprint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchReason {
    pub amount: String,
    pub date: String,
    pub description: String,
    pub account: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchOption {
    pub transaction_id: String,
    pub transaction_description: String,
    pub transaction_date: String,
    pub transaction_amount: f64,
    pub score: i64,
    pub reasons: MatchReason,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryPreview {
    pub entry: StatementEntryInput,
    pub status: String,
    pub suggested_action: String,
    pub suggested_transaction_id: Option<String>,
    pub options: Vec<MatchOption>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationPreviewSummary {
    pub entries: usize,
    pub suggested_matches: usize,
    pub new_transactions: usize,
    pub duplicates: usize,
    pub needs_review: usize,
    pub total_income: f64,
    pub total_expenses: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationPreview {
    pub source_checksum: String,
    pub preview_checksum: String,
    pub account_id: String,
    pub account_name: String,
    pub file_name: String,
    pub source_type: String,
    pub period_start: String,
    pub period_end: String,
    pub entries: Vec<EntryPreview>,
    pub summary: ReconciliationPreviewSummary,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewImportRequest {
    pub workspace_id: String,
    pub account_id: String,
    pub account_name: String,
    pub file_name: String,
    pub source_type: String,
    pub entries: Vec<StatementEntryInput>,
}

fn validate_preview_request(request: &PreviewImportRequest) -> Result<(), String> {
    if request.account_id.trim().is_empty() || request.account_name.trim().is_empty() {
        return Err("Selecione a conta financeira do extrato.".to_string());
    }
    if request.file_name.trim().is_empty() || request.entries.is_empty() {
        return Err("O extrato não contém itens conciliáveis.".to_string());
    }
    if !matches!(request.source_type.as_str(), "csv" | "ofx") {
        return Err("O formato do extrato não é suportado.".to_string());
    }
    for entry in &request.entries {
        validate_date(&entry.posted_at)?;
        if entry.description.trim().is_empty() || entry.amount <= 0.0 || !entry.amount.is_finite() {
            return Err("O extrato contém data, descrição ou valor inválido.".to_string());
        }
        if !matches!(entry.direction.as_str(), "income" | "expense") {
            return Err("A natureza de um item do extrato é inválida.".to_string());
        }
    }
    Ok(())
}

fn date_distance(left: &str, right: &str) -> i64 {
    let left = NaiveDate::parse_from_str(left, "%Y-%m-%d");
    let right = NaiveDate::parse_from_str(right, "%Y-%m-%d");
    match (left, right) {
        (Ok(left), Ok(right)) => (left - right).num_days().abs(),
        _ => 999,
    }
}

fn token_similarity(left: &str, right: &str) -> f64 {
    let left_tokens = normalize_text(left)
        .split_whitespace()
        .filter(|token| token.len() > 1)
        .map(ToString::to_string)
        .collect::<HashSet<_>>();
    let right_tokens = normalize_text(right)
        .split_whitespace()
        .filter(|token| token.len() > 1)
        .map(ToString::to_string)
        .collect::<HashSet<_>>();
    if left_tokens.is_empty() || right_tokens.is_empty() {
        return 0.0;
    }
    let intersection = left_tokens.intersection(&right_tokens).count() as f64;
    intersection / left_tokens.len().max(right_tokens.len()) as f64
}

fn score_match(
    entry: &StatementEntryInput,
    transaction: &Value,
    account_id: &str,
    account_name: &str,
    preferences: &ReconciliationPreferences,
) -> Result<Option<MatchOption>, String> {
    let Some(object) = transaction.as_object() else {
        return Ok(None);
    };
    let candidate_id = value_string(object, "id");
    if candidate_id.is_empty()
        || matches!(value_string(object, "reconciliationStatus").as_str(), "matched" | "created")
    {
        return Ok(None);
    }
    let expected_type = if entry.direction == "income" { "income" } else { "expense" };
    if value_string(object, "type") != expected_type {
        return Ok(None);
    }
    let transaction_amount = value_f64(object, "amount");
    let amount_difference = (money_to_cents(transaction_amount)? - money_to_cents(entry.amount)?).abs();
    if amount_difference > preferences.amount_tolerance_cents {
        return Ok(None);
    }
    let transaction_date = value_string(object, "date");
    let days = date_distance(&entry.posted_at, &transaction_date);
    if days > preferences.date_tolerance_days {
        return Ok(None);
    }
    let transaction_description = value_string(object, "description");
    let similarity = token_similarity(&entry.description, &transaction_description);
    let account_is_match = [value_string(object, "accountId"), value_string(object, "account")]
        .iter()
        .any(|value| account_matches(value, account_id, account_name));
    let amount_score = if amount_difference == 0 { 55 } else { 48 };
    let date_score = if days == 0 { 25 } else if days == 1 { 18 } else { 12 };
    let description_score = (similarity * 15.0).round() as i64;
    let account_score = if account_is_match { 5 } else { 0 };
    let score = (amount_score + date_score + description_score + account_score).min(100);
    Ok(Some(MatchOption {
        transaction_id: candidate_id,
        transaction_description,
        transaction_date,
        transaction_amount,
        score,
        reasons: MatchReason {
            amount: if amount_difference == 0 {
                "Valor exato".to_string()
            } else {
                format!("Diferença de {amount_difference} centavo(s)")
            },
            date: if days == 0 {
                "Mesma data".to_string()
            } else {
                format!("{days} dia(s) de diferença")
            },
            description: if similarity >= 0.7 {
                "Descrição muito semelhante".to_string()
            } else if similarity > 0.0 {
                "Descrição parcialmente semelhante".to_string()
            } else {
                "Descrição diferente".to_string()
            },
            account: if account_is_match {
                "Mesma conta".to_string()
            } else {
                "Conta não identificada no lançamento".to_string()
            },
        },
    }))
}

fn source_checksum(
    account_id: &str,
    entries: &[StatementEntryInput],
) -> Result<String, String> {
    let mut entries = entries.to_vec();
    entries.sort_by(|left, right| left.id.cmp(&right.id));
    let payload = json!({
        "accountId": account_id,
        "entries": entries,
    });
    Ok(sha256_text(&canonical_json(&payload)))
}

fn preview_checksum(source_checksum: &str, previews: &[EntryPreview]) -> Result<String, String> {
    let payload = json!({ "sourceChecksum": source_checksum, "previews": previews });
    Ok(sha256_text(&canonical_json(&payload)))
}

async fn build_preview(
    connection: &mut SqliteConnection,
    preferences: &ReconciliationPreferences,
    request: &PreviewImportRequest,
) -> Result<ReconciliationPreview, String> {
    validate_preview_request(request)?;
    let transactions = read_transactions(connection, &request.workspace_id).await?;
    let transaction_values = transactions.as_array().cloned().unwrap_or_default();
    let known_external = transaction_values
        .iter()
        .filter_map(|value| value.as_object())
        .filter_map(|object| object.get("sourceId").and_then(Value::as_str))
        .map(ToString::to_string)
        .collect::<HashSet<_>>();
    let known_fingerprints = sqlx::query_scalar::<_, String>(
        "SELECT fingerprint FROM bank_statement_entries WHERE workspace_id = $1 AND status != 'undone'",
    )
    .bind(&request.workspace_id)
    .fetch_all(&mut *connection)
    .await
    .map_err(to_error)?
    .into_iter()
    .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    let mut previews = Vec::with_capacity(request.entries.len());
    for entry in &request.entries {
        let duplicate = !seen.insert(entry.fingerprint.clone())
            || known_fingerprints.contains(&entry.fingerprint)
            || entry.external_id.as_ref().is_some_and(|id| known_external.contains(id));
        let mut options = Vec::new();
        for transaction in &transaction_values {
            if let Some(option) = score_match(
                entry,
                transaction,
                &request.account_id,
                &request.account_name,
                preferences,
            )? {
                options.push(option);
            }
        }
        options.sort_by(|left, right| right.score.cmp(&left.score));
        options.truncate(3);
        let best = options.first();
        let runner_up = options.get(1);
        let confident = best.is_some_and(|best| {
            best.score >= preferences.auto_match_threshold
                && runner_up.map_or(true, |runner_up| best.score - runner_up.score >= 8)
        });
        let (status, action, suggested, issues) = if duplicate {
            (
                "duplicate".to_string(),
                "ignore".to_string(),
                None,
                vec!["Possível duplicidade no extrato ou em uma importação anterior.".to_string()],
            )
        } else if confident {
            (
                "ready".to_string(),
                "match".to_string(),
                best.map(|item| item.transaction_id.clone()),
                Vec::new(),
            )
        } else if options.is_empty() {
            ("ready".to_string(), "create".to_string(), None, Vec::new())
        } else {
            (
                "review".to_string(),
                "create".to_string(),
                None,
                vec!["Há mais de uma correspondência possível; revise antes de aplicar.".to_string()],
            )
        };
        previews.push(EntryPreview {
            entry: entry.clone(),
            status,
            suggested_action: action,
            suggested_transaction_id: suggested,
            options,
            issues,
        });
    }
    let dates = request.entries.iter().map(|entry| entry.posted_at.clone()).collect::<Vec<_>>();
    let period_start = dates.iter().min().cloned().unwrap_or_default();
    let period_end = dates.iter().max().cloned().unwrap_or_default();
    let source_checksum = source_checksum(&request.account_id, &request.entries)?;
    let preview_checksum = preview_checksum(&source_checksum, &previews)?;
    Ok(ReconciliationPreview {
        source_checksum,
        preview_checksum,
        account_id: request.account_id.clone(),
        account_name: request.account_name.clone(),
        file_name: request.file_name.clone(),
        source_type: request.source_type.clone(),
        period_start,
        period_end,
        summary: ReconciliationPreviewSummary {
            entries: previews.len(),
            suggested_matches: previews.iter().filter(|item| item.suggested_action == "match").count(),
            new_transactions: previews.iter().filter(|item| item.suggested_action == "create").count(),
            duplicates: previews.iter().filter(|item| item.status == "duplicate").count(),
            needs_review: previews.iter().filter(|item| item.status == "review").count(),
            total_income: request.entries.iter().filter(|item| item.direction == "income").map(|item| item.amount).sum(),
            total_expenses: request.entries.iter().filter(|item| item.direction == "expense").map(|item| item.amount).sum(),
        },
        entries: previews,
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconciliationDecision {
    pub entry_id: String,
    pub action: String,
    pub transaction_id: Option<String>,
    pub category: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyImportRequest {
    pub workspace_id: String,
    pub account_id: String,
    pub account_name: String,
    pub file_name: String,
    pub source_type: String,
    pub entries: Vec<StatementEntryInput>,
    pub opening_balance: f64,
    pub closing_balance: f64,
    pub source_checksum: String,
    pub preview_checksum: String,
    pub decisions: Vec<ReconciliationDecision>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRecord {
    pub id: String,
    pub workspace_id: String,
    pub account_id: String,
    pub account_name: String,
    pub file_name: String,
    pub source_type: String,
    pub checksum_sha256: String,
    pub preview_checksum: String,
    pub period_start: String,
    pub period_end: String,
    pub opening_balance: f64,
    pub closing_balance: f64,
    pub entries_count: i64,
    pub matched_count: i64,
    pub created_count: i64,
    pub ignored_count: i64,
    pub duplicate_count: i64,
    pub status: String,
    pub reversible: bool,
    pub imported_at: String,
    pub applied_at: Option<String>,
    pub undone_at: Option<String>,
}

fn import_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<ImportRecord, String> {
    Ok(ImportRecord {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        account_id: row.try_get("account_id").map_err(to_error)?,
        account_name: row.try_get("account_name").map_err(to_error)?,
        file_name: row.try_get("file_name").map_err(to_error)?,
        source_type: row.try_get("source_type").map_err(to_error)?,
        checksum_sha256: row.try_get("checksum_sha256").map_err(to_error)?,
        preview_checksum: row.try_get("preview_checksum").map_err(to_error)?,
        period_start: row.try_get("period_start").map_err(to_error)?,
        period_end: row.try_get("period_end").map_err(to_error)?,
        opening_balance: cents_to_money(row.try_get("opening_balance_cents").unwrap_or(0)),
        closing_balance: cents_to_money(row.try_get("closing_balance_cents").unwrap_or(0)),
        entries_count: row.try_get("entries_count").unwrap_or(0),
        matched_count: row.try_get("matched_count").unwrap_or(0),
        created_count: row.try_get("created_count").unwrap_or(0),
        ignored_count: row.try_get("ignored_count").unwrap_or(0),
        duplicate_count: row.try_get("duplicate_count").unwrap_or(0),
        status: row.try_get("status").map_err(to_error)?,
        reversible: row.try_get::<i64, _>("reversible").unwrap_or(0) != 0,
        imported_at: row.try_get("imported_at").map_err(to_error)?,
        applied_at: row.try_get("applied_at").ok(),
        undone_at: row.try_get("undone_at").ok(),
    })
}

fn create_transaction(
    entry: &StatementEntryInput,
    decision: &ReconciliationDecision,
    request: &ApplyImportRequest,
    import_id: &str,
    now: &str,
) -> Value {
    json!({
        "id": format!("reconciled-{}", Uuid::new_v4()),
        "description": entry.description,
        "category": decision.category.clone().unwrap_or_else(|| "Sem categoria".to_string()),
        "account": request.account_name,
        "accountId": request.account_id,
        "paymentMethod": "Extrato bancário",
        "date": entry.posted_at,
        "amount": entry.amount,
        "type": entry.direction,
        "status": "completed",
        "note": decision.note.clone().or_else(|| entry.memo.clone()).unwrap_or_else(|| format!("Importado de {}", request.file_name)),
        "sourceType": "bank-statement",
        "sourceId": entry.external_id.clone().unwrap_or_else(|| entry.id.clone()),
        "reconciliationImportId": import_id,
        "reconciliationEntryId": entry.id,
        "reconciliationStatus": "created",
        "reconciledAt": now,
    })
}

#[tauri::command(async)]
pub fn reconciliation_get_preferences(
    app: AppHandle,
    workspace_id: String,
) -> Result<ReconciliationPreferences, String> {
    run_local_async_worker("finnacialux-reconciliation-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let result = load_preferences(&mut connection, &workspace_id).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_save_preferences(
    app: AppHandle,
    request: SaveReconciliationPreferencesRequest,
) -> Result<ReconciliationPreferences, String> {
    run_local_async_worker("finnacialux-reconciliation-save-preferences", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        if !(0..=7).contains(&request.date_tolerance_days)
            || !(0..=1000).contains(&request.amount_tolerance_cents)
            || !(50..=100).contains(&request.auto_match_threshold)
            || !(0..=10000).contains(&request.closing_tolerance_cents)
            || !request.require_preview_before_apply
        {
            return Err("As preferências de conciliação estão fora dos limites permitidos.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            r#"INSERT INTO reconciliation_preferences (
                 workspace_id, date_tolerance_days, amount_tolerance_cents,
                 auto_match_threshold, closing_tolerance_cents,
                 require_preview_before_apply, require_complete_checklist, updated_at
               ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
               ON CONFLICT(workspace_id) DO UPDATE SET
                 date_tolerance_days = excluded.date_tolerance_days,
                 amount_tolerance_cents = excluded.amount_tolerance_cents,
                 auto_match_threshold = excluded.auto_match_threshold,
                 closing_tolerance_cents = excluded.closing_tolerance_cents,
                 require_preview_before_apply = 1,
                 require_complete_checklist = excluded.require_complete_checklist,
                 updated_at = excluded.updated_at"#,
        )
        .bind(&request.workspace_id)
        .bind(request.date_tolerance_days)
        .bind(request.amount_tolerance_cents)
        .bind(request.auto_match_threshold)
        .bind(request.closing_tolerance_cents)
        .bind(if request.require_complete_checklist { 1 } else { 0 })
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
pub fn reconciliation_preview_import(
    app: AppHandle,
    request: PreviewImportRequest,
) -> Result<ReconciliationPreview, String> {
    run_local_async_worker("finnacialux-reconciliation-preview", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
        let result = build_preview(&mut connection, &preferences, &request).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_apply_import(
    app: AppHandle,
    request: ApplyImportRequest,
) -> Result<ImportRecord, String> {
    run_local_async_worker("finnacialux-reconciliation-apply", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let preview_request = PreviewImportRequest {
            workspace_id: request.workspace_id.clone(),
            account_id: request.account_id.clone(),
            account_name: request.account_name.clone(),
            file_name: request.file_name.clone(),
            source_type: request.source_type.clone(),
            entries: request.entries.clone(),
        };
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
        if !preferences.require_preview_before_apply {
            connection.close().await.map_err(to_error)?;
            return Err("A prévia obrigatória da conciliação não pode ser desativada.".to_string());
        }
        ensure_transaction_dates_open(
            &mut connection,
            &request.workspace_id,
            &request.account_id,
            &request.account_name,
            &request.entries.iter().map(|entry| entry.posted_at.clone()).collect::<Vec<_>>(),
        )
        .await?;
        let preview = build_preview(&mut connection, &preferences, &preview_request).await?;
        if preview.source_checksum != request.source_checksum
            || preview.preview_checksum != request.preview_checksum
        {
            connection.close().await.map_err(to_error)?;
            return Err("Os dados ou as sugestões mudaram depois da prévia. Gere uma nova simulação antes de aplicar.".to_string());
        }
        let existing_duplicate = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM bank_statement_imports WHERE workspace_id = $1 AND account_id = $2 AND checksum_sha256 = $3 AND status != 'undone'",
        )
        .bind(&request.workspace_id)
        .bind(&request.account_id)
        .bind(&request.source_checksum)
        .fetch_one(&mut connection)
        .await
        .map_err(to_error)?;
        if existing_duplicate > 0 {
            connection.close().await.map_err(to_error)?;
            return Err("Este extrato já foi aplicado para a conta selecionada.".to_string());
        }
        let decisions = request
            .decisions
            .iter()
            .map(|decision| (decision.entry_id.clone(), decision.clone()))
            .collect::<HashMap<_, _>>();
        if request.entries.iter().any(|entry| !decisions.contains_key(&entry.id)) {
            connection.close().await.map_err(to_error)?;
            return Err("Defina uma decisão para cada item do extrato.".to_string());
        }

        let import_id = format!("statement-import-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let before_transactions = read_transactions(&mut connection, &request.workspace_id).await?;
        let mut transactions = before_transactions.as_array().cloned().unwrap_or_default();
        let previews = preview
            .entries
            .iter()
            .map(|item| (item.entry.id.clone(), item))
            .collect::<HashMap<_, _>>();
        let mut matched_count = 0i64;
        let mut selected_existing_transactions = HashSet::<String>::new();
        let mut created_count = 0i64;
        let mut ignored_count = 0i64;
        let mut duplicate_count = 0i64;
        let mut entry_rows = Vec::<(String, StatementEntryInput, String, Option<String>, Option<i64>, String)>::new();
        let mut match_rows = Vec::<(String, String, Option<String>, String, Option<i64>, Value)>::new();

        for entry in &request.entries {
            let decision = decisions.get(&entry.id).ok_or_else(|| "Decisão de conciliação ausente.".to_string())?;
            let preview_entry = previews.get(&entry.id).ok_or_else(|| "Item não pertence mais à prévia atual.".to_string())?;
            let entry_row_id = format!("statement-entry-{}", Uuid::new_v4());
            let mut matched_transaction_id = None;
            let mut match_score = None;
            let status;
            if preview_entry.status == "duplicate" {
                if decision.action != "ignore" {
                    connection.close().await.map_err(to_error)?;
                    return Err("Itens duplicados só podem ser ignorados.".to_string());
                }
                status = "duplicate".to_string();
                duplicate_count += 1;
            } else if decision.action == "match" {
                let selected_transaction_id = decision.transaction_id.clone().ok_or_else(|| "Selecione o lançamento correspondente.".to_string())?;
                let option = preview_entry
                    .options
                    .iter()
                    .find(|option| option.transaction_id == selected_transaction_id)
                    .ok_or_else(|| "A correspondência selecionada não pertence à prévia atual.".to_string())?;
                if !selected_existing_transactions.insert(selected_transaction_id.clone()) {
                    connection.close().await.map_err(to_error)?;
                    return Err("Um mesmo lançamento não pode ser vinculado a dois itens do extrato.".to_string());
                }
                if option.score < 50 {
                    connection.close().await.map_err(to_error)?;
                    return Err("A correspondência escolhida não possui evidência suficiente.".to_string());
                }
                let transaction = transactions
                    .iter_mut()
                    .find(|value| transaction_id(value) == selected_transaction_id)
                    .and_then(Value::as_object_mut)
                    .ok_or_else(|| "O lançamento correspondente não existe mais.".to_string())?;
                transaction.insert("reconciliationImportId".to_string(), Value::String(import_id.clone()));
                transaction.insert("reconciliationEntryId".to_string(), Value::String(entry.id.clone()));
                transaction.insert("reconciliationStatus".to_string(), Value::String("matched".to_string()));
                transaction.insert("reconciledAt".to_string(), Value::String(now.clone()));
                if !transaction.contains_key("sourceType") {
                    transaction.insert("sourceType".to_string(), Value::String("reconciliation".to_string()));
                }
                if !transaction.contains_key("sourceId") {
                    transaction.insert(
                        "sourceId".to_string(),
                        Value::String(entry.external_id.clone().unwrap_or_else(|| entry.id.clone())),
                    );
                }
                matched_transaction_id = Some(selected_transaction_id.clone());
                match_score = Some(option.score);
                matched_count += 1;
                status = "matched".to_string();
                match_rows.push((
                    format!("reconciliation-match-{}", Uuid::new_v4()),
                    entry_row_id.clone(),
                    Some(selected_transaction_id),
                    "match".to_string(),
                    Some(option.score),
                    serde_json::to_value(&option.reasons).map_err(to_error)?,
                ));
            } else if decision.action == "create" {
                let created = create_transaction(entry, decision, &request, &import_id, &now);
                let created_id = transaction_id(&created);
                transactions.push(created);
                matched_transaction_id = Some(created_id.clone());
                created_count += 1;
                status = "created".to_string();
                match_rows.push((
                    format!("reconciliation-match-{}", Uuid::new_v4()),
                    entry_row_id.clone(),
                    Some(created_id),
                    "create".to_string(),
                    None,
                    json!({ "reason": "Novo lançamento criado a partir do extrato." }),
                ));
            } else if decision.action == "ignore" {
                ignored_count += 1;
                status = "ignored".to_string();
                match_rows.push((
                    format!("reconciliation-match-{}", Uuid::new_v4()),
                    entry_row_id.clone(),
                    None,
                    "ignore".to_string(),
                    None,
                    json!({ "reason": decision.note.clone().unwrap_or_else(|| "Item ignorado manualmente.".to_string()) }),
                ));
            } else {
                connection.close().await.map_err(to_error)?;
                return Err("A ação de conciliação é inválida.".to_string());
            }
            entry_rows.push((
                entry_row_id,
                entry.clone(),
                status,
                matched_transaction_id,
                match_score,
                decision.note.clone().unwrap_or_default(),
            ));
        }

        let next_transactions = Value::Array(transactions);
        ensure_transaction_document_change_allowed(
            &mut connection,
            &request.workspace_id,
            &next_transactions,
        )
        .await?;
        let after_checksum = sha256_text(&canonical_json(&next_transactions));
        let status = if ignored_count + duplicate_count > 0 { "partial" } else { "applied" };
        let mut transaction = connection.begin().await.map_err(to_error)?;
        upsert_transactions(&mut transaction, &request.workspace_id, &next_transactions, &now).await?;
        sqlx::query(
            r#"INSERT INTO bank_statement_imports (
                 id, workspace_id, account_id, account_name, file_name, source_type,
                 checksum_sha256, preview_checksum, period_start, period_end,
                 opening_balance_cents, closing_balance_cents, entries_count,
                 matched_count, created_count, ignored_count, duplicate_count,
                 status, before_transactions_json, after_transactions_checksum,
                 reversible, imported_at, applied_at, undone_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 1, $21, $21, NULL)"#,
        )
        .bind(&import_id)
        .bind(&request.workspace_id)
        .bind(&request.account_id)
        .bind(&request.account_name)
        .bind(&request.file_name)
        .bind(&request.source_type)
        .bind(&request.source_checksum)
        .bind(&request.preview_checksum)
        .bind(&preview.period_start)
        .bind(&preview.period_end)
        .bind(money_to_cents(request.opening_balance)?)
        .bind(money_to_cents(request.closing_balance)?)
        .bind(request.entries.len() as i64)
        .bind(matched_count)
        .bind(created_count)
        .bind(ignored_count)
        .bind(duplicate_count)
        .bind(status)
        .bind(serde_json::to_string(&before_transactions).map_err(to_error)?)
        .bind(&after_checksum)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
        for (entry_row_id, entry, entry_status, matched_transaction_id, match_score, note) in entry_rows {
            sqlx::query(
                r#"INSERT INTO bank_statement_entries (
                     id, import_id, workspace_id, source_entry_id, external_id, posted_at,
                     description, memo, amount_cents, direction, fingerprint, status,
                     matched_transaction_id, match_score, decision_note, created_at
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)"#,
            )
            .bind(&entry_row_id)
            .bind(&import_id)
            .bind(&request.workspace_id)
            .bind(&entry.id)
            .bind(&entry.external_id)
            .bind(&entry.posted_at)
            .bind(&entry.description)
            .bind(&entry.memo)
            .bind(money_to_cents(entry.amount)?)
            .bind(&entry.direction)
            .bind(&entry.fingerprint)
            .bind(entry_status)
            .bind(matched_transaction_id)
            .bind(match_score)
            .bind(note)
            .bind(&now)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        }
        for (id, entry_id, transaction_id, action, score, reasons) in match_rows {
            sqlx::query(
                r#"INSERT INTO reconciliation_matches (
                     id, workspace_id, import_id, entry_id, transaction_id, action,
                     status, score, reasons_json, matched_at
                   ) VALUES ($1, $2, $3, $4, $5, $6, 'applied', $7, $8, $9)"#,
            )
            .bind(id)
            .bind(&request.workspace_id)
            .bind(&import_id)
            .bind(entry_id)
            .bind(transaction_id)
            .bind(action)
            .bind(score)
            .bind(serde_json::to_string(&reasons).map_err(to_error)?)
            .bind(&now)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        }
        sqlx::query("UPDATE workspaces SET last_activity_at = $1 WHERE id = $2")
            .bind(&now)
            .bind(&request.workspace_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM bank_statement_imports WHERE id = $1")
            .bind(&import_id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = import_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_list_imports(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<ImportRecord>, String> {
    run_local_async_worker("finnacialux-reconciliation-list-imports", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query(
            "SELECT * FROM bank_statement_imports WHERE workspace_id = $1 ORDER BY imported_at DESC LIMIT $2",
        )
        .bind(&workspace_id)
        .bind(limit.unwrap_or(100).clamp(1, 500))
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        let result = rows.iter().map(import_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_undo_import(
    app: AppHandle,
    workspace_id: String,
    import_id: String,
) -> Result<(), String> {
    run_local_async_worker("finnacialux-reconciliation-undo-import", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let row = sqlx::query(
            r#"SELECT before_transactions_json, after_transactions_checksum, reversible, status,
                      period_start, period_end, account_id, account_name
                 FROM bank_statement_imports
                WHERE id = $1 AND workspace_id = $2 LIMIT 1"#,
        )
        .bind(&import_id)
        .bind(&workspace_id)
        .fetch_optional(&mut connection)
        .await
        .map_err(to_error)?
        .ok_or_else(|| "A importação não foi encontrada.".to_string())?;
        let reversible = row.try_get::<i64, _>("reversible").unwrap_or(0) != 0;
        let status: String = row.try_get("status").map_err(to_error)?;
        if !reversible || status == "undone" {
            connection.close().await.map_err(to_error)?;
            return Err("Esta importação não pode mais ser desfeita.".to_string());
        }
        let period_start: String = row.try_get("period_start").map_err(to_error)?;
        let period_end: String = row.try_get("period_end").map_err(to_error)?;
        let account_id: String = row.try_get("account_id").map_err(to_error)?;
        let account_name: String = row.try_get("account_name").map_err(to_error)?;
        ensure_transaction_dates_open(
            &mut connection,
            &workspace_id,
            &account_id,
            &account_name,
            &[period_start, period_end],
        )
        .await?;
        let current = read_transactions(&mut connection, &workspace_id).await?;
        let expected: String = row.try_get("after_transactions_checksum").map_err(to_error)?;
        if sha256_text(&canonical_json(&current)) != expected {
            connection.close().await.map_err(to_error)?;
            return Err("Os lançamentos mudaram depois da importação. O snapshot não pode ser restaurado com segurança.".to_string());
        }
        let before_json: String = row.try_get("before_transactions_json").map_err(to_error)?;
        let before = serde_json::from_str::<Value>(&before_json).map_err(to_error)?;
        ensure_transaction_document_change_allowed(&mut connection, &workspace_id, &before).await?;
        let now = Utc::now().to_rfc3339();
        let mut transaction = connection.begin().await.map_err(to_error)?;
        upsert_transactions(&mut transaction, &workspace_id, &before, &now).await?;
        sqlx::query("UPDATE bank_statement_imports SET status = 'undone', reversible = 0, undone_at = $1 WHERE id = $2")
            .bind(&now)
            .bind(&import_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        sqlx::query("UPDATE bank_statement_entries SET status = 'undone' WHERE import_id = $1")
            .bind(&import_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        sqlx::query("UPDATE reconciliation_matches SET status = 'undone' WHERE import_id = $1")
            .bind(&import_id)
            .execute(&mut *transaction)
            .await
            .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        Ok(())
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosureChecklist {
    pub statement_imported: bool,
    pub all_entries_resolved: bool,
    pub balance_reviewed: bool,
    pub pending_commitments_reviewed: bool,
    pub evidence_reviewed: bool,
}

impl ClosureChecklist {
    fn complete(&self) -> bool {
        self.statement_imported
            && self.all_entries_resolved
            && self.balance_reviewed
            && self.pending_commitments_reviewed
            && self.evidence_reviewed
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosurePreviewRequest {
    pub workspace_id: String,
    pub account_id: String,
    pub account_name: String,
    pub month: String,
    pub opening_balance: f64,
    pub statement_balance: f64,
    pub checklist: ClosureChecklist,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosureMovementSummary {
    pub income: f64,
    pub expenses: f64,
    pub transfers_in: f64,
    pub transfers_out: f64,
    pub net: f64,
    pub transactions: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyClosurePreview {
    pub account_id: String,
    pub account_name: String,
    pub month: String,
    pub opening_balance: f64,
    pub movements: ClosureMovementSummary,
    pub calculated_balance: f64,
    pub statement_balance: f64,
    pub difference: f64,
    pub unresolved_entries: i64,
    pub checklist: ClosureChecklist,
    pub source_checksum: String,
    pub can_close: bool,
    pub blockers: Vec<String>,
}

fn account_matches(value: &str, account_id: &str, account_name: &str) -> bool {
    let normalized = normalize_text(value);
    normalized == normalize_text(account_id) || normalized == normalize_text(account_name)
}

fn closure_movements(
    transactions: &Value,
    account_id: &str,
    account_name: &str,
    month: &str,
) -> ClosureMovementSummary {
    let mut income = 0.0;
    let mut expenses = 0.0;
    let mut transfers_in = 0.0;
    let mut transfers_out = 0.0;
    let mut count = 0i64;
    for value in transactions.as_array().into_iter().flatten() {
        let Some(object) = value.as_object() else { continue };
        let date = value_string(object, "date");
        if !date.starts_with(month) { continue; }
        let amount = value_f64(object, "amount").abs();
        let kind = value_string(object, "type");
        let source = account_matches(&value_string(object, "account"), account_id, account_name)
            || account_matches(&value_string(object, "accountId"), account_id, account_name);
        let destination = account_matches(&value_string(object, "destinationAccount"), account_id, account_name)
            || account_matches(&value_string(object, "destinationAccountId"), account_id, account_name);
        if kind == "income" && source {
            income += amount;
            count += 1;
        } else if kind == "expense" && source {
            expenses += amount;
            count += 1;
        } else if kind == "transfer" {
            if source {
                transfers_out += amount;
                count += 1;
            }
            if destination {
                transfers_in += amount;
                count += 1;
            }
        }
    }
    ClosureMovementSummary {
        income,
        expenses,
        transfers_in,
        transfers_out,
        net: income + transfers_in - expenses - transfers_out,
        transactions: count,
    }
}

async fn build_closure_preview(
    connection: &mut SqliteConnection,
    preferences: &ReconciliationPreferences,
    request: &ClosurePreviewRequest,
) -> Result<MonthlyClosurePreview, String> {
    validate_month(&request.month)?;
    if request.account_id.trim().is_empty() || request.account_name.trim().is_empty() {
        return Err("Selecione a conta do fechamento.".to_string());
    }
    money_to_cents(request.opening_balance)?;
    money_to_cents(request.statement_balance)?;
    let transactions = read_transactions(connection, &request.workspace_id).await?;
    let movements = closure_movements(&transactions, &request.account_id, &request.account_name, &request.month);
    let calculated_balance = request.opening_balance + movements.net;
    let difference = request.statement_balance - calculated_balance;
    let unresolved_entries = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*)
             FROM bank_statement_entries entry
             JOIN bank_statement_imports import ON import.id = entry.import_id
            WHERE entry.workspace_id = $1
              AND import.account_id = $2
              AND substr(entry.posted_at, 1, 7) = $3
              AND entry.status NOT IN ('matched', 'created', 'ignored', 'duplicate', 'undone')"#,
    )
    .bind(&request.workspace_id)
    .bind(&request.account_id)
    .bind(&request.month)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    let imports = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM bank_statement_imports
            WHERE workspace_id = $1 AND account_id = $2
              AND status IN ('applied', 'partial')
              AND substr(period_start, 1, 7) <= $3
              AND substr(period_end, 1, 7) >= $3"#,
    )
    .bind(&request.workspace_id)
    .bind(&request.account_id)
    .bind(&request.month)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    let existing_closed = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM monthly_financial_closures WHERE workspace_id = $1 AND account_id = $2 AND month = $3 AND status = 'closed'",
    )
    .bind(&request.workspace_id)
    .bind(&request.account_id)
    .bind(&request.month)
    .fetch_one(&mut *connection)
    .await
    .map_err(to_error)?;
    let relevant_transactions = Value::Array(
        transactions
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|value| transaction_month(value).as_deref() == Some(request.month.as_str()))
            .filter(|value| {
                value.as_object().is_some_and(|object| {
                    account_matches(&value_string(object, "account"), &request.account_id, &request.account_name)
                        || account_matches(&value_string(object, "accountId"), &request.account_id, &request.account_name)
                        || account_matches(&value_string(object, "destinationAccount"), &request.account_id, &request.account_name)
                        || account_matches(&value_string(object, "destinationAccountId"), &request.account_id, &request.account_name)
                })
            })
            .collect(),
    );
    let checksum_payload = json!({
        "accountId": request.account_id,
        "month": request.month,
        "openingBalance": request.opening_balance,
        "statementBalance": request.statement_balance,
        "checklist": request.checklist,
        "transactions": sorted_transactions(&relevant_transactions),
        "imports": imports,
    });
    let source_checksum = sha256_text(&canonical_json(&checksum_payload));
    let mut blockers = Vec::new();
    if existing_closed > 0 {
        blockers.push("Este mês já está fechado.".to_string());
    }
    if imports == 0 || !request.checklist.statement_imported {
        blockers.push("Importe e confirme o extrato do período.".to_string());
    }
    if unresolved_entries > 0 || !request.checklist.all_entries_resolved {
        blockers.push("Resolva todos os itens do extrato.".to_string());
    }
    if money_to_cents(difference)?.abs() > preferences.closing_tolerance_cents {
        blockers.push("O saldo do extrato ainda diverge do saldo calculado.".to_string());
    }
    if preferences.require_complete_checklist && !request.checklist.complete() {
        blockers.push("Conclua todos os itens do checklist de fechamento.".to_string());
    }
    Ok(MonthlyClosurePreview {
        account_id: request.account_id.clone(),
        account_name: request.account_name.clone(),
        month: request.month.clone(),
        opening_balance: request.opening_balance,
        movements,
        calculated_balance,
        statement_balance: request.statement_balance,
        difference,
        unresolved_entries,
        checklist: request.checklist.clone(),
        source_checksum,
        can_close: blockers.is_empty(),
        blockers,
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseMonthRequest {
    pub workspace_id: String,
    pub account_id: String,
    pub account_name: String,
    pub month: String,
    pub opening_balance: f64,
    pub statement_balance: f64,
    pub checklist: ClosureChecklist,
    pub source_checksum: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyClosure {
    pub id: String,
    pub workspace_id: String,
    pub account_id: String,
    pub account_name: String,
    pub month: String,
    pub status: String,
    pub opening_balance: f64,
    pub movements: f64,
    pub calculated_balance: f64,
    pub statement_balance: f64,
    pub difference: f64,
    pub checklist: ClosureChecklist,
    pub source_checksum: String,
    pub notes: String,
    pub closed_at: Option<String>,
    pub reopened_at: Option<String>,
    pub reopening_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn closure_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<MonthlyClosure, String> {
    let checklist_json: String = row.try_get("checklist_json").map_err(to_error)?;
    Ok(MonthlyClosure {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        account_id: row.try_get("account_id").map_err(to_error)?,
        account_name: row.try_get("account_name").map_err(to_error)?,
        month: row.try_get("month").map_err(to_error)?,
        status: row.try_get("status").map_err(to_error)?,
        opening_balance: cents_to_money(row.try_get("opening_balance_cents").unwrap_or(0)),
        movements: cents_to_money(row.try_get("movements_cents").unwrap_or(0)),
        calculated_balance: cents_to_money(row.try_get("calculated_balance_cents").unwrap_or(0)),
        statement_balance: cents_to_money(row.try_get("statement_balance_cents").unwrap_or(0)),
        difference: cents_to_money(row.try_get("difference_cents").unwrap_or(0)),
        checklist: serde_json::from_str(&checklist_json).map_err(to_error)?,
        source_checksum: row.try_get("source_checksum").map_err(to_error)?,
        notes: row.try_get("notes").unwrap_or_default(),
        closed_at: row.try_get("closed_at").ok(),
        reopened_at: row.try_get("reopened_at").ok(),
        reopening_reason: row.try_get("reopening_reason").ok(),
        created_at: row.try_get("created_at").map_err(to_error)?,
        updated_at: row.try_get("updated_at").map_err(to_error)?,
    })
}

#[tauri::command(async)]
pub fn reconciliation_preview_closure(
    app: AppHandle,
    request: ClosurePreviewRequest,
) -> Result<MonthlyClosurePreview, String> {
    run_local_async_worker("finnacialux-reconciliation-preview-closure", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
        let result = build_closure_preview(&mut connection, &preferences, &request).await?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_close_month(
    app: AppHandle,
    request: CloseMonthRequest,
) -> Result<MonthlyClosure, String> {
    run_local_async_worker("finnacialux-reconciliation-close-month", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let preview_request = ClosurePreviewRequest {
            workspace_id: request.workspace_id.clone(),
            account_id: request.account_id.clone(),
            account_name: request.account_name.clone(),
            month: request.month.clone(),
            opening_balance: request.opening_balance,
            statement_balance: request.statement_balance,
            checklist: request.checklist.clone(),
        };
        let mut connection = connect_app_database(&app, &state).await?;
        let preferences = load_preferences(&mut connection, &request.workspace_id).await?;
        let preview = build_closure_preview(&mut connection, &preferences, &preview_request).await?;
        if preview.source_checksum != request.source_checksum {
            connection.close().await.map_err(to_error)?;
            return Err("Os lançamentos ou o extrato mudaram depois da prévia. Recalcule o fechamento.".to_string());
        }
        if !preview.can_close {
            connection.close().await.map_err(to_error)?;
            return Err(preview.blockers.join(" "));
        }
        let now = Utc::now().to_rfc3339();
        let existing = sqlx::query(
            "SELECT id, status, created_at FROM monthly_financial_closures WHERE workspace_id = $1 AND account_id = $2 AND month = $3 LIMIT 1",
        )
        .bind(&request.workspace_id)
        .bind(&request.account_id)
        .bind(&request.month)
        .fetch_optional(&mut connection)
        .await
        .map_err(to_error)?;
        let closure_id = existing
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("id").ok())
            .unwrap_or_else(|| format!("monthly-closure-{}", Uuid::new_v4()));
        if existing
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("status").ok())
            .as_deref()
            == Some("closed")
        {
            connection.close().await.map_err(to_error)?;
            return Err("Este mês já está fechado.".to_string());
        }
        let created_at = existing
            .as_ref()
            .and_then(|row| row.try_get::<String, _>("created_at").ok())
            .unwrap_or_else(|| now.clone());
        let mut transaction = connection.begin().await.map_err(to_error)?;
        sqlx::query(
            r#"INSERT INTO monthly_financial_closures (
                 id, workspace_id, account_id, account_name, month, status,
                 opening_balance_cents, movements_cents, calculated_balance_cents,
                 statement_balance_cents, difference_cents, checklist_json,
                 source_checksum, notes, closed_at, reopened_at, reopening_reason,
                 created_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, 'closed', $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, NULL, $15, $14)
               ON CONFLICT(workspace_id, account_id, month) DO UPDATE SET
                 account_name = excluded.account_name,
                 status = 'closed',
                 opening_balance_cents = excluded.opening_balance_cents,
                 movements_cents = excluded.movements_cents,
                 calculated_balance_cents = excluded.calculated_balance_cents,
                 statement_balance_cents = excluded.statement_balance_cents,
                 difference_cents = excluded.difference_cents,
                 checklist_json = excluded.checklist_json,
                 source_checksum = excluded.source_checksum,
                 notes = excluded.notes,
                 closed_at = excluded.closed_at,
                 reopened_at = NULL,
                 reopening_reason = NULL,
                 updated_at = excluded.updated_at"#,
        )
        .bind(&closure_id)
        .bind(&request.workspace_id)
        .bind(&request.account_id)
        .bind(&request.account_name)
        .bind(&request.month)
        .bind(money_to_cents(preview.opening_balance)?)
        .bind(money_to_cents(preview.movements.net)?)
        .bind(money_to_cents(preview.calculated_balance)?)
        .bind(money_to_cents(preview.statement_balance)?)
        .bind(money_to_cents(preview.difference)?)
        .bind(serde_json::to_string(&preview.checklist).map_err(to_error)?)
        .bind(&preview.source_checksum)
        .bind(request.notes.unwrap_or_default())
        .bind(&now)
        .bind(&created_at)
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
        sqlx::query(
            "INSERT INTO monthly_closure_events (id, workspace_id, closure_id, action, details_json, created_at) VALUES ($1, $2, $3, 'closed', $4, $5)",
        )
        .bind(format!("closure-event-{}", Uuid::new_v4()))
        .bind(&request.workspace_id)
        .bind(&closure_id)
        .bind(serde_json::to_string(&json!({
            "month": request.month,
            "difference": preview.difference,
            "transactions": preview.movements.transactions,
        })).map_err(to_error)?)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM monthly_financial_closures WHERE id = $1")
            .bind(&closure_id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = closure_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_list_closures(
    app: AppHandle,
    workspace_id: String,
    limit: Option<i64>,
) -> Result<Vec<MonthlyClosure>, String> {
    run_local_async_worker("finnacialux-reconciliation-list-closures", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = sqlx::query(
            "SELECT * FROM monthly_financial_closures WHERE workspace_id = $1 ORDER BY month DESC, updated_at DESC LIMIT $2",
        )
        .bind(&workspace_id)
        .bind(limit.unwrap_or(100).clamp(1, 500))
        .fetch_all(&mut connection)
        .await
        .map_err(to_error)?;
        let result = rows.iter().map(closure_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReopenMonthRequest {
    pub workspace_id: String,
    pub closure_id: String,
    pub reason: String,
}

#[tauri::command(async)]
pub fn reconciliation_reopen_month(
    app: AppHandle,
    request: ReopenMonthRequest,
) -> Result<MonthlyClosure, String> {
    run_local_async_worker("finnacialux-reconciliation-reopen-month", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        if request.reason.trim().chars().count() < 10 {
            return Err("Informe um motivo de reabertura com pelo menos 10 caracteres.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM monthly_financial_closures WHERE id = $1 AND workspace_id = $2 AND status = 'closed'",
        )
        .bind(&request.closure_id)
        .bind(&request.workspace_id)
        .fetch_one(&mut connection)
        .await
        .map_err(to_error)?;
        if exists == 0 {
            connection.close().await.map_err(to_error)?;
            return Err("O fechamento não foi encontrado ou já está reaberto.".to_string());
        }
        let now = Utc::now().to_rfc3339();
        let mut transaction = connection.begin().await.map_err(to_error)?;
        sqlx::query(
            "UPDATE monthly_financial_closures SET status = 'reopened', reopened_at = $1, reopening_reason = $2, updated_at = $1 WHERE id = $3 AND workspace_id = $4",
        )
        .bind(&now)
        .bind(request.reason.trim())
        .bind(&request.closure_id)
        .bind(&request.workspace_id)
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
        sqlx::query(
            "INSERT INTO monthly_closure_events (id, workspace_id, closure_id, action, details_json, created_at) VALUES ($1, $2, $3, 'reopened', $4, $5)",
        )
        .bind(format!("closure-event-{}", Uuid::new_v4()))
        .bind(&request.workspace_id)
        .bind(&request.closure_id)
        .bind(serde_json::to_string(&json!({ "reason": request.reason.trim() })).map_err(to_error)?)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(to_error)?;
        transaction.commit().await.map_err(to_error)?;
        let row = sqlx::query("SELECT * FROM monthly_financial_closures WHERE id = $1")
            .bind(&request.closure_id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = closure_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosureEvent {
    pub id: String,
    pub workspace_id: String,
    pub closure_id: String,
    pub action: String,
    pub details: Value,
    pub created_at: String,
}

#[tauri::command(async)]
pub fn reconciliation_list_events(
    app: AppHandle,
    workspace_id: String,
    closure_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<ClosureEvent>, String> {
    run_local_async_worker("finnacialux-reconciliation-list-events", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = if let Some(closure_id) = closure_id {
            sqlx::query(
                "SELECT id, workspace_id, closure_id, action, details_json, created_at FROM monthly_closure_events WHERE workspace_id = $1 AND closure_id = $2 ORDER BY created_at DESC LIMIT $3",
            )
            .bind(&workspace_id)
            .bind(closure_id)
            .bind(limit.unwrap_or(100).clamp(1, 500))
            .fetch_all(&mut connection)
            .await
            .map_err(to_error)?
        } else {
            sqlx::query(
                "SELECT id, workspace_id, closure_id, action, details_json, created_at FROM monthly_closure_events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2",
            )
            .bind(&workspace_id)
            .bind(limit.unwrap_or(100).clamp(1, 500))
            .fetch_all(&mut connection)
            .await
            .map_err(to_error)?
        };
        let result = rows
            .into_iter()
            .map(|row| {
                let details_json: String = row.try_get("details_json").map_err(to_error)?;
                Ok(ClosureEvent {
                    id: row.try_get("id").map_err(to_error)?,
                    workspace_id: row.try_get("workspace_id").map_err(to_error)?,
                    closure_id: row.try_get("closure_id").map_err(to_error)?,
                    action: row.try_get("action").map_err(to_error)?,
                    details: serde_json::from_str(&details_json).unwrap_or(Value::Null),
                    created_at: row.try_get("created_at").map_err(to_error)?,
                })
            })
            .collect::<Result<Vec<_>, String>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveEvidenceRequest {
    pub workspace_id: String,
    pub transaction_id: String,
    pub note: String,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub bytes: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub id: String,
    pub workspace_id: String,
    pub transaction_id: String,
    pub note: String,
    pub file_name: Option<String>,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub checksum_sha256: Option<String>,
    pub created_at: String,
}

fn evidence_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<Evidence, String> {
    Ok(Evidence {
        id: row.try_get("id").map_err(to_error)?,
        workspace_id: row.try_get("workspace_id").map_err(to_error)?,
        transaction_id: row.try_get("transaction_id").map_err(to_error)?,
        note: row.try_get("note").unwrap_or_default(),
        file_name: row.try_get("file_name").ok(),
        mime_type: row.try_get("mime_type").ok(),
        size_bytes: row.try_get("size_bytes").unwrap_or(0),
        checksum_sha256: row.try_get("checksum_sha256").ok(),
        created_at: row.try_get("created_at").map_err(to_error)?,
    })
}

#[tauri::command(async)]
pub fn reconciliation_save_evidence(
    app: AppHandle,
    request: SaveEvidenceRequest,
) -> Result<Evidence, String> {
    run_local_async_worker("finnacialux-reconciliation-save-evidence", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        if request.note.trim().is_empty() && request.bytes.as_ref().map_or(true, |bytes| bytes.is_empty()) {
            return Err("Inclua uma observação ou um arquivo de comprovante.".to_string());
        }
        let bytes = request.bytes.unwrap_or_default();
        if bytes.len() > 5_000_000 {
            return Err("O comprovante deve possuir no máximo 5 MB.".to_string());
        }
        let mut connection = connect_app_database(&app, &state).await?;
        let transactions = read_transactions(&mut connection, &request.workspace_id).await?;
        let selected_transaction = transactions
            .as_array()
            .into_iter()
            .flatten()
            .find(|value| transaction_id(value) == request.transaction_id)
            .cloned()
            .ok_or_else(|| "O lançamento escolhido não existe mais.".to_string())?;
        ensure_transaction_value_open(
            &mut connection,
            &request.workspace_id,
            &selected_transaction,
        )
        .await?;
        let id = format!("reconciliation-evidence-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let checksum = if bytes.is_empty() {
            None
        } else {
            Some(hex::encode(Sha256::digest(&bytes)))
        };
        sqlx::query(
            r#"INSERT INTO reconciliation_evidence (
                 id, workspace_id, transaction_id, note, file_name, mime_type,
                 content_blob, size_bytes, checksum_sha256, created_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
        )
        .bind(&id)
        .bind(&request.workspace_id)
        .bind(&request.transaction_id)
        .bind(request.note.trim())
        .bind(&request.file_name)
        .bind(&request.mime_type)
        .bind(if bytes.is_empty() { None } else { Some(bytes.clone()) })
        .bind(bytes.len() as i64)
        .bind(&checksum)
        .bind(&now)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        let row = sqlx::query("SELECT id, workspace_id, transaction_id, note, file_name, mime_type, size_bytes, checksum_sha256, created_at FROM reconciliation_evidence WHERE id = $1")
            .bind(&id)
            .fetch_one(&mut connection)
            .await
            .map_err(to_error)?;
        let result = evidence_from_row(&row)?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_list_evidence(
    app: AppHandle,
    workspace_id: String,
    transaction_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<Evidence>, String> {
    run_local_async_worker("finnacialux-reconciliation-list-evidence", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let rows = if let Some(transaction_id) = transaction_id {
            sqlx::query("SELECT id, workspace_id, transaction_id, note, file_name, mime_type, size_bytes, checksum_sha256, created_at FROM reconciliation_evidence WHERE workspace_id = $1 AND transaction_id = $2 ORDER BY created_at DESC LIMIT $3")
                .bind(&workspace_id)
                .bind(transaction_id)
                .bind(limit.unwrap_or(100).clamp(1, 500))
                .fetch_all(&mut connection)
                .await
                .map_err(to_error)?
        } else {
            sqlx::query("SELECT id, workspace_id, transaction_id, note, file_name, mime_type, size_bytes, checksum_sha256, created_at FROM reconciliation_evidence WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2")
                .bind(&workspace_id)
                .bind(limit.unwrap_or(100).clamp(1, 500))
                .fetch_all(&mut connection)
                .await
                .map_err(to_error)?
        };
        let result = rows.iter().map(evidence_from_row).collect::<Result<Vec<_>, _>>()?;
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceFile {
    pub file_name: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
    pub checksum_sha256: String,
}

#[tauri::command(async)]
pub fn reconciliation_read_evidence(
    app: AppHandle,
    workspace_id: String,
    evidence_id: String,
) -> Result<EvidenceFile, String> {
    run_local_async_worker("finnacialux-reconciliation-read-evidence", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        let mut connection = connect_app_database(&app, &state).await?;
        let row = sqlx::query(
            "SELECT file_name, mime_type, content_blob, checksum_sha256 FROM reconciliation_evidence WHERE id = $1 AND workspace_id = $2 LIMIT 1",
        )
        .bind(&evidence_id)
        .bind(&workspace_id)
        .fetch_optional(&mut connection)
        .await
        .map_err(to_error)?
        .ok_or_else(|| "O comprovante não foi encontrado.".to_string())?;
        let bytes = row
            .try_get::<Option<Vec<u8>>, _>("content_blob")
            .map_err(to_error)?
            .ok_or_else(|| "Este registro possui apenas uma observação, sem arquivo anexado.".to_string())?;
        let calculated = hex::encode(Sha256::digest(&bytes));
        let stored = row
            .try_get::<Option<String>, _>("checksum_sha256")
            .map_err(to_error)?
            .unwrap_or_default();
        if stored.is_empty() || stored != calculated {
            connection.close().await.map_err(to_error)?;
            return Err("O checksum do comprovante não confere. A exportação foi bloqueada.".to_string());
        }
        let result = EvidenceFile {
            file_name: row
                .try_get::<Option<String>, _>("file_name")
                .map_err(to_error)?
                .unwrap_or_else(|| "comprovante.bin".to_string()),
            mime_type: row
                .try_get::<Option<String>, _>("mime_type")
                .map_err(to_error)?
                .unwrap_or_else(|| "application/octet-stream".to_string()),
            bytes,
            checksum_sha256: calculated,
        };
        connection.close().await.map_err(to_error)?;
        Ok(result)
    })
}

#[tauri::command(async)]
pub fn reconciliation_delete_evidence(
    app: AppHandle,
    workspace_id: String,
    evidence_id: String,
) -> Result<(), String> {
    run_local_async_worker("finnacialux-reconciliation-delete-evidence", move || async move {
        let state = app.state::<EncryptedDatabaseState>();
        ensure_database_writable(&state)?;
        let mut connection = connect_app_database(&app, &state).await?;
        let transaction_id_value = sqlx::query_scalar::<_, String>(
            "SELECT transaction_id FROM reconciliation_evidence WHERE id = $1 AND workspace_id = $2 LIMIT 1",
        )
        .bind(&evidence_id)
        .bind(&workspace_id)
        .fetch_optional(&mut connection)
        .await
        .map_err(to_error)?
        .ok_or_else(|| "O comprovante não foi encontrado.".to_string())?;
        let transactions = read_transactions(&mut connection, &workspace_id).await?;
        if let Some(selected_transaction) = transactions
            .as_array()
            .into_iter()
            .flatten()
            .find(|value| transaction_id(value) == transaction_id_value)
            .cloned()
        {
            ensure_transaction_value_open(
                &mut connection,
                &workspace_id,
                &selected_transaction,
            )
            .await?;
        }
        let result = sqlx::query("DELETE FROM reconciliation_evidence WHERE id = $1 AND workspace_id = $2")
            .bind(&evidence_id)
            .bind(&workspace_id)
            .execute(&mut connection)
            .await
            .map_err(to_error)?;
        if result.rows_affected() == 0 {
            connection.close().await.map_err(to_error)?;
            return Err("O comprovante não foi encontrado.".to_string());
        }
        connection.close().await.map_err(to_error)?;
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Connection;

    fn preferences() -> ReconciliationPreferences {
        ReconciliationPreferences {
            workspace_id: "workspace-1".to_string(),
            date_tolerance_days: 2,
            amount_tolerance_cents: 1,
            auto_match_threshold: 85,
            closing_tolerance_cents: 1,
            require_preview_before_apply: true,
            require_complete_checklist: true,
            updated_at: "2026-07-30".to_string(),
        }
    }

    #[test]
    fn exact_statement_match_receives_high_score() {
        let entry = StatementEntryInput {
            id: "entry-1".to_string(),
            external_id: None,
            posted_at: "2026-07-10".to_string(),
            description: "Mercado Central".to_string(),
            amount: 120.50,
            direction: "expense".to_string(),
            memo: None,
            fingerprint: "entry".to_string(),
        };
        let transaction = json!({
            "id": "transaction-1",
            "date": "2026-07-10",
            "description": "Mercado Central",
            "amount": 120.50,
            "type": "expense",
            "account": "Conta principal"
        });
        let scored = score_match(&entry, &transaction, "account-1", "Conta principal", &preferences())
            .expect("calcula score")
            .expect("encontra correspondência");
        assert!(scored.score >= 95);
    }

    #[tokio::test]
    async fn closed_month_rejects_transaction_mutation() {
        let mut connection = SqliteConnection::connect(":memory:").await.expect("abre banco");
        sqlx::raw_sql(
            r#"
            CREATE TABLE finance_documents (
              workspace_id TEXT NOT NULL,
              module TEXT NOT NULL,
              data_json TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (workspace_id, module)
            );
            CREATE TABLE monthly_financial_closures (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              account_id TEXT NOT NULL,
              account_name TEXT NOT NULL,
              month TEXT NOT NULL,
              status TEXT NOT NULL
            );
            INSERT INTO finance_documents VALUES (
              'workspace-1', 'transactions',
              '[{"id":"transaction-1","date":"2026-07-10","amount":10,"type":"expense","accountId":"account-1","account":"Conta"}]',
              '2026-07-30'
            );
            INSERT INTO monthly_financial_closures VALUES (
              'closure-1', 'workspace-1', 'account-1', 'Conta', '2026-07', 'closed'
            );
            "#,
        )
        .execute(&mut connection)
        .await
        .expect("cria dados");
        let changed = json!([{"id":"transaction-1","date":"2026-07-10","amount":11,"type":"expense","accountId":"account-1","account":"Conta"}]);
        let result = ensure_transaction_document_change_allowed(&mut connection, "workspace-1", &changed).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn closed_month_keeps_other_accounts_editable() {
        let mut connection = SqliteConnection::connect(":memory:").await.expect("abre banco");
        sqlx::raw_sql(
            r#"
            CREATE TABLE finance_documents (
              workspace_id TEXT NOT NULL,
              module TEXT NOT NULL,
              data_json TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (workspace_id, module)
            );
            CREATE TABLE monthly_financial_closures (
              id TEXT PRIMARY KEY,
              workspace_id TEXT NOT NULL,
              account_id TEXT NOT NULL,
              account_name TEXT NOT NULL,
              month TEXT NOT NULL,
              status TEXT NOT NULL
            );
            INSERT INTO finance_documents VALUES (
              'workspace-1', 'transactions',
              '[{"id":"transaction-2","date":"2026-07-12","amount":20,"type":"expense","accountId":"account-2","account":"Reserva"}]',
              '2026-07-30'
            );
            INSERT INTO monthly_financial_closures VALUES (
              'closure-1', 'workspace-1', 'account-1', 'Conta', '2026-07', 'closed'
            );
            "#,
        )
        .execute(&mut connection)
        .await
        .expect("cria dados");
        let changed = json!([{"id":"transaction-2","date":"2026-07-12","amount":21,"type":"expense","accountId":"account-2","account":"Reserva"}]);
        let result = ensure_transaction_document_change_allowed(&mut connection, "workspace-1", &changed).await;
        assert!(result.is_ok());
    }
}

