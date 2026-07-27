use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{Duration, Utc};
use keyring::{Entry, Error as KeyringError};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::{Connection, Row, SqliteConnection};
use subtle::ConstantTimeEq;
use tauri::{AppHandle, State};
use crate::encrypted_database::{connect_app_database, EncryptedDatabaseState};
use uuid::Uuid;

const KEYRING_SERVICE: &str = "com.ateliux.finnacialux";
const KEYRING_ACCOUNT: &str = "stronghold-bootstrap";
const PBKDF2_ITERATIONS: u32 = 210_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Argon2Credential {
    hash: String,
    algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSecuritySettings {
    pin_enabled: bool,
    auto_lock_minutes: i64,
    lock_on_minimize: bool,
    require_password_for_exports: bool,
    require_password_for_restore: bool,
    encrypted_backups_default: bool,
    failed_pin_attempts: i64,
    pin_locked_until: Option<String>,
    last_locked_at: Option<String>,
    vault_initialized: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PinVerificationResult {
    valid: bool,
    locked: bool,
    remaining_attempts: i64,
    locked_until: Option<String>,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityEventRecord {
    id: String,
    event_type: String,
    severity: String,
    message: String,
    created_at: String,
}

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

async fn connect_database(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
) -> Result<SqliteConnection, String> {
    connect_app_database(app, database).await
}

fn create_argon2_credential_internal(secret: &str) -> Result<Argon2Credential, String> {
    if secret.is_empty() {
        return Err("O segredo não pode ficar vazio.".to_string());
    }
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(secret.as_bytes(), &salt)
        .map_err(to_error)?
        .to_string();
    Ok(Argon2Credential {
        hash,
        algorithm: "argon2id".to_string(),
    })
}

fn verify_argon2(secret: &str, encoded_hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(encoded_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(secret.as_bytes(), &parsed)
        .is_ok()
}

fn verify_pbkdf2(secret: &str, salt_hex: &str, expected_hex: &str) -> bool {
    let Ok(salt) = hex::decode(salt_hex) else {
        return false;
    };
    let Ok(expected) = hex::decode(expected_hex) else {
        return false;
    };
    let mut output = vec![0_u8; expected.len()];
    pbkdf2_hmac::<Sha256>(
        secret.as_bytes(),
        &salt,
        PBKDF2_ITERATIONS,
        &mut output,
    );
    output.as_slice().ct_eq(expected.as_slice()).into()
}

async fn record_event(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    user_id: Option<&str>,
    event_type: &str,
    severity: &str,
    message: &str,
) -> Result<(), String> {
    let mut connection = connect_database(app, database).await?;
    sqlx::query(
        r#"INSERT INTO security_events (
          id, user_id, event_type, severity, message, created_at, app_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(user_id)
    .bind(event_type.chars().take(80).collect::<String>())
    .bind(severity)
    .bind(message.replace('\r', " ").replace('\n', " ").replace('\t', " ").chars().take(240).collect::<String>())
    .bind(Utc::now().to_rfc3339())
    .bind(app.package_info().version.to_string())
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(())
}

async fn ensure_security_row(app: &AppHandle, database: &EncryptedDatabaseState, user_id: &str) -> Result<(), String> {
    let mut connection = connect_database(app, database).await?;
    sqlx::query(
        r#"INSERT OR IGNORE INTO local_security_preferences (
          user_id, pin_enabled, auto_lock_minutes, lock_on_minimize,
          require_password_for_exports, require_password_for_restore,
          encrypted_backups_default, failed_pin_attempts, vault_initialized, updated_at
        ) VALUES ($1, 0, 15, 1, 1, 1, 1, 0, 0, $2)"#,
    )
    .bind(user_id)
    .bind(Utc::now().to_rfc3339())
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(())
}

async fn verify_user_password_internal(
    app: &AppHandle,
    database: &EncryptedDatabaseState,
    user_id: &str,
    password: &str,
    upgrade_legacy: bool,
) -> Result<bool, String> {
    let mut connection = connect_database(app, database).await?;
    let row = sqlx::query(
        "SELECT password_hash, password_salt, password_algorithm FROM users WHERE id = $1 LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&mut connection)
    .await
    .map_err(to_error)?;

    let Some(row) = row else {
        connection.close().await.map_err(to_error)?;
        return Ok(false);
    };
    let hash: String = row.try_get("password_hash").map_err(to_error)?;
    let salt: String = row.try_get("password_salt").unwrap_or_default();
    let algorithm: String = row.try_get("password_algorithm").unwrap_or_else(|_| "pbkdf2-sha256".to_string());
    let valid = if algorithm == "argon2id" {
        verify_argon2(password, &hash)
    } else {
        verify_pbkdf2(password, &salt, &hash)
    };

    if valid && upgrade_legacy && algorithm != "argon2id" {
        let credential = create_argon2_credential_internal(password)?;
        sqlx::query(
            "UPDATE users SET password_hash = $1, password_salt = '', password_algorithm = 'argon2id', updated_at = $2 WHERE id = $3",
        )
        .bind(credential.hash)
        .bind(Utc::now().to_rfc3339())
        .bind(user_id)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
    }
    connection.close().await.map_err(to_error)?;
    Ok(valid)
}

#[tauri::command]
pub fn create_argon2_credential(secret: String) -> Result<Argon2Credential, String> {
    create_argon2_credential_internal(&secret)
}

#[tauri::command]
pub async fn verify_user_password(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
    password: String,
    upgrade_legacy: bool,
) -> Result<bool, String> {
    let valid = verify_user_password_internal(&app, &database, &user_id, &password, upgrade_legacy).await?;
    if valid {
        let _ = record_event(&app, &database, Some(&user_id), "password_verified", "info", "Credencial local validada.").await;
    } else {
        let _ = record_event(&app, &database, Some(&user_id), "password_rejected", "warning", "Tentativa de senha local rejeitada.").await;
    }
    Ok(valid)
}

#[tauri::command]
pub async fn change_account_password(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 8
        || !new_password.chars().any(char::is_alphabetic)
        || !new_password.chars().any(|value| value.is_ascii_digit())
    {
        return Err("A nova senha precisa ter ao menos 8 caracteres, incluindo letra e número.".to_string());
    }
    if !verify_user_password_internal(&app, &database, &user_id, &current_password, false).await? {
        return Err("A senha atual não confere.".to_string());
    }
    let credential = create_argon2_credential_internal(&new_password)?;
    let mut connection = connect_database(&app, &database).await?;
    sqlx::query(
        "UPDATE users SET password_hash = $1, password_salt = '', password_algorithm = 'argon2id', updated_at = $2 WHERE id = $3",
    )
    .bind(credential.hash)
    .bind(Utc::now().to_rfc3339())
    .bind(&user_id)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(&app, &database, Some(&user_id), "password_changed", "warning", "Senha local alterada.").await?;
    Ok(())
}

#[tauri::command]
pub async fn get_security_settings(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
) -> Result<LocalSecuritySettings, String> {
    ensure_security_row(&app, &database, &user_id).await?;
    let mut connection = connect_database(&app, &database).await?;
    let row = sqlx::query(
        r#"SELECT pin_enabled, auto_lock_minutes, lock_on_minimize,
                  require_password_for_exports, require_password_for_restore,
                  encrypted_backups_default, failed_pin_attempts, pin_locked_until,
                  last_locked_at, vault_initialized
             FROM local_security_preferences
            WHERE user_id = $1 LIMIT 1"#,
    )
    .bind(&user_id)
    .fetch_one(&mut connection)
    .await
    .map_err(to_error)?;
    let result = LocalSecuritySettings {
        pin_enabled: row.try_get::<i64, _>("pin_enabled").unwrap_or(0) != 0,
        auto_lock_minutes: row.try_get("auto_lock_minutes").unwrap_or(15),
        lock_on_minimize: row.try_get::<i64, _>("lock_on_minimize").unwrap_or(1) != 0,
        require_password_for_exports: row.try_get::<i64, _>("require_password_for_exports").unwrap_or(1) != 0,
        require_password_for_restore: row.try_get::<i64, _>("require_password_for_restore").unwrap_or(1) != 0,
        encrypted_backups_default: row.try_get::<i64, _>("encrypted_backups_default").unwrap_or(1) != 0,
        failed_pin_attempts: row.try_get("failed_pin_attempts").unwrap_or(0),
        pin_locked_until: row.try_get::<Option<String>, _>("pin_locked_until").unwrap_or(None),
        last_locked_at: row.try_get::<Option<String>, _>("last_locked_at").unwrap_or(None),
        vault_initialized: row.try_get::<i64, _>("vault_initialized").unwrap_or(0) != 0,
    };
    connection.close().await.map_err(to_error)?;
    Ok(result)
}

#[tauri::command]
pub async fn save_security_settings(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
    settings: LocalSecuritySettings,
) -> Result<LocalSecuritySettings, String> {
    if !matches!(settings.auto_lock_minutes, 0 | 5 | 15 | 30 | 60 | 120) {
        return Err("Tempo de bloqueio automático inválido.".to_string());
    }
    ensure_security_row(&app, &database, &user_id).await?;
    let mut connection = connect_database(&app, &database).await?;
    sqlx::query(
        r#"UPDATE local_security_preferences
              SET auto_lock_minutes = $1,
                  lock_on_minimize = $2,
                  require_password_for_exports = $3,
                  require_password_for_restore = $4,
                  encrypted_backups_default = $5,
                  updated_at = $6
            WHERE user_id = $7"#,
    )
    .bind(settings.auto_lock_minutes)
    .bind(if settings.lock_on_minimize { 1 } else { 0 })
    .bind(if settings.require_password_for_exports { 1 } else { 0 })
    .bind(if settings.require_password_for_restore { 1 } else { 0 })
    .bind(if settings.encrypted_backups_default { 1 } else { 0 })
    .bind(Utc::now().to_rfc3339())
    .bind(&user_id)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(&app, &database, Some(&user_id), "security_preferences_changed", "info", "Preferências locais de segurança atualizadas.").await?;
    get_security_settings(app, database, user_id).await
}

#[tauri::command]
pub async fn set_local_pin(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
    current_password: String,
    pin: String,
) -> Result<LocalSecuritySettings, String> {
    if pin.len() < 4 || pin.len() > 8 || !pin.chars().all(|value| value.is_ascii_digit()) {
        return Err("O PIN deve ter entre 4 e 8 números.".to_string());
    }
    if !verify_user_password_internal(&app, &database, &user_id, &current_password, true).await? {
        return Err("A senha atual não confere.".to_string());
    }
    let credential = create_argon2_credential_internal(&pin)?;
    ensure_security_row(&app, &database, &user_id).await?;
    let mut connection = connect_database(&app, &database).await?;
    sqlx::query(
        r#"UPDATE local_security_preferences
              SET pin_enabled = 1,
                  pin_hash = $1,
                  failed_pin_attempts = 0,
                  pin_locked_until = NULL,
                  updated_at = $2
            WHERE user_id = $3"#,
    )
    .bind(credential.hash)
    .bind(Utc::now().to_rfc3339())
    .bind(&user_id)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(&app, &database, Some(&user_id), "pin_enabled", "warning", "PIN local ativado.").await?;
    get_security_settings(app, database, user_id).await
}

#[tauri::command]
pub async fn disable_local_pin(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
    current_password: String,
) -> Result<LocalSecuritySettings, String> {
    if !verify_user_password_internal(&app, &database, &user_id, &current_password, false).await? {
        return Err("A senha atual não confere.".to_string());
    }
    ensure_security_row(&app, &database, &user_id).await?;
    let mut connection = connect_database(&app, &database).await?;
    sqlx::query(
        r#"UPDATE local_security_preferences
              SET pin_enabled = 0,
                  pin_hash = NULL,
                  failed_pin_attempts = 0,
                  pin_locked_until = NULL,
                  updated_at = $1
            WHERE user_id = $2"#,
    )
    .bind(Utc::now().to_rfc3339())
    .bind(&user_id)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(&app, &database, Some(&user_id), "pin_disabled", "warning", "PIN local desativado.").await?;
    get_security_settings(app, database, user_id).await
}

#[tauri::command]
pub async fn verify_local_pin(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
    pin: String,
) -> Result<PinVerificationResult, String> {
    ensure_security_row(&app, &database, &user_id).await?;
    let mut connection = connect_database(&app, &database).await?;
    let row = sqlx::query(
        "SELECT pin_enabled, pin_hash, failed_pin_attempts, pin_locked_until FROM local_security_preferences WHERE user_id = $1",
    )
    .bind(&user_id)
    .fetch_one(&mut connection)
    .await
    .map_err(to_error)?;
    let enabled = row.try_get::<i64, _>("pin_enabled").unwrap_or(0) != 0;
    let hash: Option<String> = row.try_get::<Option<String>, _>("pin_hash").unwrap_or(None);
    let attempts: i64 = row.try_get("failed_pin_attempts").unwrap_or(0);
    let locked_until: Option<String> = row.try_get::<Option<String>, _>("pin_locked_until").unwrap_or(None);

    if !enabled || hash.is_none() {
        connection.close().await.map_err(to_error)?;
        return Err("O PIN local não está configurado.".to_string());
    }

    if let Some(until) = locked_until.as_deref() {
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(until) {
            if parsed.with_timezone(&Utc) > Utc::now() {
                connection.close().await.map_err(to_error)?;
                return Ok(PinVerificationResult {
                    valid: false,
                    locked: true,
                    remaining_attempts: 0,
                    locked_until,
                    message: "Muitas tentativas. Aguarde antes de tentar novamente.".to_string(),
                });
            }
        }
    }

    let valid = verify_argon2(&pin, hash.as_deref().unwrap_or_default());
    if valid {
        sqlx::query(
            "UPDATE local_security_preferences SET failed_pin_attempts = 0, pin_locked_until = NULL, updated_at = $1 WHERE user_id = $2",
        )
        .bind(Utc::now().to_rfc3339())
        .bind(&user_id)
        .execute(&mut connection)
        .await
        .map_err(to_error)?;
        connection.close().await.map_err(to_error)?;
        record_event(&app, &database, Some(&user_id), "pin_unlocked", "info", "Aplicativo desbloqueado por PIN.").await?;
        return Ok(PinVerificationResult {
            valid: true,
            locked: false,
            remaining_attempts: 5,
            locked_until: None,
            message: "Aplicativo desbloqueado.".to_string(),
        });
    }

    let next_attempts = attempts + 1;
    let should_lock = next_attempts % 5 == 0;
    let lock_duration = if next_attempts >= 10 { 300 } else { 30 };
    let next_locked_until = should_lock
        .then(|| (Utc::now() + Duration::seconds(lock_duration)).to_rfc3339());
    sqlx::query(
        "UPDATE local_security_preferences SET failed_pin_attempts = $1, pin_locked_until = $2, updated_at = $3 WHERE user_id = $4",
    )
    .bind(next_attempts)
    .bind(&next_locked_until)
    .bind(Utc::now().to_rfc3339())
    .bind(&user_id)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(&app, &database, Some(&user_id), "pin_rejected", "warning", "Tentativa de PIN rejeitada.").await?;

    Ok(PinVerificationResult {
        valid: false,
        locked: should_lock,
        remaining_attempts: if should_lock { 0 } else { 5 - (next_attempts % 5) },
        locked_until: next_locked_until,
        message: if should_lock {
            format!("Muitas tentativas. Bloqueado por {lock_duration} segundos.")
        } else {
            "PIN incorreto.".to_string()
        },
    })
}

#[tauri::command]
pub async fn record_local_lock(app: AppHandle, database: State<'_, EncryptedDatabaseState>, user_id: String, reason: String) -> Result<(), String> {
    ensure_security_row(&app, &database, &user_id).await?;
    let mut connection = connect_database(&app, &database).await?;
    sqlx::query(
        "UPDATE local_security_preferences SET last_locked_at = $1, updated_at = $1 WHERE user_id = $2",
    )
    .bind(Utc::now().to_rfc3339())
    .bind(&user_id)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    record_event(&app, &database, Some(&user_id), "application_locked", "info", &format!("Aplicativo bloqueado: {}.", reason.chars().take(60).collect::<String>())).await
}

#[tauri::command]
pub async fn mark_vault_initialized(app: AppHandle, database: State<'_, EncryptedDatabaseState>, user_id: String) -> Result<(), String> {
    ensure_security_row(&app, &database, &user_id).await?;
    let mut connection = connect_database(&app, &database).await?;
    sqlx::query(
        "UPDATE local_security_preferences SET vault_initialized = 1, updated_at = $1 WHERE user_id = $2",
    )
    .bind(Utc::now().to_rfc3339())
    .bind(&user_id)
    .execute(&mut connection)
    .await
    .map_err(to_error)?;
    connection.close().await.map_err(to_error)?;
    Ok(())
}

#[tauri::command]
pub fn get_vault_bootstrap_secret() -> Result<String, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(to_error)?;
    match entry.get_password() {
        Ok(secret) if !secret.is_empty() => Ok(secret),
        Ok(_) | Err(KeyringError::NoEntry) => {
            let mut bytes = [0_u8; 32];
            rand::rngs::OsRng.fill_bytes(&mut bytes);
            let secret = BASE64.encode(bytes);
            entry.set_password(&secret).map_err(to_error)?;
            Ok(secret)
        }
        Err(error) => Err(format!(
            "Não foi possível acessar o Gerenciador de Credenciais do Windows: {error}"
        )),
    }
}

#[tauri::command]
pub async fn list_security_events(
    app: AppHandle,
    database: State<'_, EncryptedDatabaseState>,
    user_id: String,
    limit: i64,
) -> Result<Vec<SecurityEventRecord>, String> {
    let safe_limit = limit.clamp(1, 100);
    let mut connection = connect_database(&app, &database).await?;
    let rows = sqlx::query(
        "SELECT id, event_type, severity, message, created_at FROM security_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    )
    .bind(&user_id)
    .bind(safe_limit)
    .fetch_all(&mut connection)
    .await
    .map_err(to_error)?;
    let result = rows
        .into_iter()
        .map(|row| SecurityEventRecord {
            id: row.try_get("id").unwrap_or_default(),
            event_type: row.try_get("event_type").unwrap_or_default(),
            severity: row.try_get("severity").unwrap_or_else(|_| "info".to_string()),
            message: row.try_get("message").unwrap_or_default(),
            created_at: row.try_get("created_at").unwrap_or_default(),
        })
        .collect();
    connection.close().await.map_err(to_error)?;
    Ok(result)
}
