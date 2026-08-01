use crate::command_worker::run_local_async_worker;
use crate::protection::{backup_package_encryption_mode, backups_dir};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const CONFIG_FILE: &str = "external-backup.json";
const MANAGED_DIRECTORY: &str = "FinnacialUX-Backups";
const BACKUP_EXTENSION: &str = "fuxbackup";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalBackupPreferences {
    pub enabled: bool,
    pub destination_directory: Option<String>,
    pub mirror_on_startup: bool,
    pub mirror_on_focus: bool,
    pub mirror_after_backup: bool,
    pub retention_count: i64,
    pub verify_after_copy: bool,
    pub notify_on_success: bool,
    pub notify_on_failure: bool,
    pub last_mirrored_at: Option<String>,
    pub last_verified_at: Option<String>,
}

impl Default for ExternalBackupPreferences {
    fn default() -> Self {
        Self {
            enabled: false,
            destination_directory: None,
            mirror_on_startup: true,
            mirror_on_focus: true,
            mirror_after_backup: true,
            retention_count: 10,
            verify_after_copy: true,
            notify_on_success: false,
            notify_on_failure: true,
            last_mirrored_at: None,
            last_verified_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalBackupDestinationStatus {
    pub configured: bool,
    pub available: bool,
    pub writable: bool,
    pub independent: bool,
    pub destination_directory: Option<String>,
    pub managed_directory: Option<String>,
    pub destination_kind: String,
    pub reason: String,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalBackupCopy {
    pub file_name: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub checksum_sha256: String,
    pub created_at: String,
    pub valid: bool,
    pub verification_reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalBackupVerification {
    pub status: ExternalBackupDestinationStatus,
    pub copies: Vec<ExternalBackupCopy>,
    pub valid_count: usize,
    pub invalid_count: usize,
    pub latest_copy_at: Option<String>,
    pub checked_at: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalBackupMirrorResult {
    pub copied: bool,
    pub reason: String,
    pub source_file_name: String,
    pub copy: Option<ExternalBackupCopy>,
    pub removed_count: usize,
    pub status: ExternalBackupDestinationStatus,
}

fn to_error<T: std::fmt::Display>(error: T) -> String {
    error.to_string()
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(to_error)?;
    fs::create_dir_all(&directory).map_err(to_error)?;
    Ok(directory.join(CONFIG_FILE))
}

fn normalize_preferences(mut value: ExternalBackupPreferences) -> ExternalBackupPreferences {
    if !matches!(value.retention_count, 3 | 5 | 10 | 20) {
        value.retention_count = 10;
    }
    value.destination_directory = value
        .destination_directory
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty());
    value
}

fn load_preferences_internal(app: &AppHandle) -> Result<ExternalBackupPreferences, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(ExternalBackupPreferences::default());
    }
    let bytes = fs::read(&path).map_err(to_error)?;
    let text = String::from_utf8(bytes).map_err(to_error)?;
    let value = serde_json::from_str::<ExternalBackupPreferences>(text.trim_start_matches('\u{feff}'))
        .map_err(to_error)?;
    Ok(normalize_preferences(value))
}

fn save_preferences_internal(
    app: &AppHandle,
    preferences: ExternalBackupPreferences,
) -> Result<ExternalBackupPreferences, String> {
    let normalized = normalize_preferences(preferences);
    if normalized.enabled && normalized.destination_directory.is_none() {
        return Err("Escolha uma pasta externa antes de ativar a redundância.".to_string());
    }
    let bytes = serde_json::to_vec_pretty(&normalized).map_err(to_error)?;
    let path = config_path(app)?;
    let temporary = path.with_extension(format!("tmp-{}", Uuid::new_v4()));
    {
        let mut file = File::create(&temporary).map_err(to_error)?;
        file.write_all(&bytes).map_err(to_error)?;
        file.sync_all().map_err(to_error)?;
    }
    if path.exists() {
        fs::remove_file(&path).map_err(to_error)?;
    }
    fs::rename(&temporary, &path).map_err(to_error)?;
    Ok(normalized)
}

fn managed_directory(preferences: &ExternalBackupPreferences) -> Option<PathBuf> {
    preferences
        .destination_directory
        .as_ref()
        .map(PathBuf::from)
        .map(|root| root.join(MANAGED_DIRECTORY))
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(to_error)?;
    Ok(hex::encode(Sha256::digest(bytes)))
}

fn windows_drive(path: &Path) -> Option<String> {
    let text = path.to_string_lossy();
    let bytes = text.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        Some(text[..2].to_ascii_uppercase())
    } else {
        None
    }
}

fn looks_synchronized(path: &Path) -> bool {
    let text = path.to_string_lossy().to_ascii_lowercase();
    ["onedrive", "dropbox", "google drive", "googledrive", "icloud", "nextcloud", "syncthing"]
        .iter()
        .any(|marker| text.contains(marker))
}

fn destination_status_internal(
    app: &AppHandle,
    preferences: &ExternalBackupPreferences,
) -> Result<ExternalBackupDestinationStatus, String> {
    let checked_at = Utc::now().to_rfc3339();
    let Some(selected) = preferences.destination_directory.as_ref() else {
        return Ok(ExternalBackupDestinationStatus {
            configured: false,
            available: false,
            writable: false,
            independent: false,
            destination_directory: None,
            managed_directory: None,
            destination_kind: "unconfigured".to_string(),
            reason: "Nenhum destino externo foi configurado.".to_string(),
            checked_at,
        });
    };
    let selected_path = PathBuf::from(selected);
    let managed = selected_path.join(MANAGED_DIRECTORY);
    if !selected_path.exists() || !selected_path.is_dir() {
        return Ok(ExternalBackupDestinationStatus {
            configured: true,
            available: false,
            writable: false,
            independent: false,
            destination_directory: Some(selected.clone()),
            managed_directory: Some(managed.to_string_lossy().to_string()),
            destination_kind: "disconnected".to_string(),
            reason: "O destino está desconectado ou não existe neste momento.".to_string(),
            checked_at,
        });
    }
    fs::create_dir_all(&managed).map_err(to_error)?;
    let local_backups = backups_dir(app)?;
    let local_canonical = local_backups.canonicalize().unwrap_or(local_backups);
    let managed_canonical = managed.canonicalize().unwrap_or_else(|_| managed.clone());
    if managed_canonical.starts_with(&local_canonical) || local_canonical.starts_with(&managed_canonical) {
        return Ok(ExternalBackupDestinationStatus {
            configured: true,
            available: true,
            writable: false,
            independent: false,
            destination_directory: Some(selected.clone()),
            managed_directory: Some(managed.to_string_lossy().to_string()),
            destination_kind: "local-backup-directory".to_string(),
            reason: "O destino não pode ser a mesma pasta usada pelos backups locais.".to_string(),
            checked_at,
        });
    }
    let probe = managed.join(format!(".finnacialux-write-test-{}", Uuid::new_v4()));
    let writable = File::create(&probe)
        .and_then(|mut file| {
            file.write_all(b"finnacialux")?;
            file.sync_all()
        })
        .is_ok();
    let _ = fs::remove_file(&probe);
    let synchronized = looks_synchronized(&selected_path);
    let different_volume = match (windows_drive(&selected_path), windows_drive(&local_canonical)) {
        (Some(destination), Some(local)) => destination != local,
        _ => false,
    };
    let independent = synchronized || different_volume;
    let destination_kind = if synchronized {
        "synchronized-folder"
    } else if different_volume {
        "secondary-volume"
    } else {
        "same-volume"
    };
    let reason = if !writable {
        "O destino foi localizado, mas não permite gravação.".to_string()
    } else if independent {
        "O destino está disponível e oferece uma segunda localização para as cópias criptografadas.".to_string()
    } else {
        "O destino funciona, mas está no mesmo volume do banco local; use mídia externa ou pasta sincronizada para redundância real.".to_string()
    };
    Ok(ExternalBackupDestinationStatus {
        configured: true,
        available: true,
        writable,
        independent,
        destination_directory: Some(selected.clone()),
        managed_directory: Some(managed.to_string_lossy().to_string()),
        destination_kind: destination_kind.to_string(),
        reason,
        checked_at,
    })
}

fn sidecar_path(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.sha256", path.to_string_lossy()))
}

fn copy_from_path(path: &Path) -> Result<ExternalBackupCopy, String> {
    let checksum = sha256_file(path)?;
    let sidecar = sidecar_path(path);
    let expected = fs::read_to_string(&sidecar)
        .ok()
        .and_then(|content| content.split_whitespace().next().map(str::to_string));
    let valid = expected.as_deref() == Some(checksum.as_str());
    let metadata = fs::metadata(path).map_err(to_error)?;
    let created_at = metadata
        .modified()
        .ok()
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(Utc::now)
        .to_rfc3339();
    Ok(ExternalBackupCopy {
        file_name: path.file_name().and_then(|name| name.to_str()).unwrap_or_default().to_string(),
        file_path: path.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        checksum_sha256: checksum,
        created_at,
        valid,
        verification_reason: if valid {
            "O arquivo externo corresponde ao checksum registrado após a cópia.".to_string()
        } else if sidecar.exists() {
            "O checksum atual não corresponde ao sidecar registrado.".to_string()
        } else {
            "O sidecar SHA-256 está ausente.".to_string()
        },
    })
}

fn list_external_copies_internal(directory: &Path) -> Result<Vec<ExternalBackupCopy>, String> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut files = fs::read_dir(directory)
        .map_err(to_error)?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some(BACKUP_EXTENSION))
        .filter_map(|path| copy_from_path(&path).ok())
        .collect::<Vec<_>>();
    files.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(files)
}

fn apply_retention(directory: &Path, retention_count: i64) -> Result<usize, String> {
    let copies = list_external_copies_internal(directory)?;
    let mut removed = 0usize;
    for copy in copies.into_iter().skip(retention_count.max(1) as usize) {
        let path = PathBuf::from(copy.file_path);
        if path.starts_with(directory) {
            let _ = fs::remove_file(&path);
            let _ = fs::remove_file(sidecar_path(&path));
            removed += 1;
        }
    }
    Ok(removed)
}

fn mirror_internal(app: &AppHandle, source_file_path: String) -> Result<ExternalBackupMirrorResult, String> {
    let mut preferences = load_preferences_internal(app)?;
    let status = destination_status_internal(app, &preferences)?;
    if !preferences.enabled {
        return Ok(ExternalBackupMirrorResult {
            copied: false,
            reason: "A redundância externa está desativada.".to_string(),
            source_file_name: String::new(),
            copy: None,
            removed_count: 0,
            status,
        });
    }
    if !status.available || !status.writable {
        return Err(status.reason.clone());
    }
    let source = PathBuf::from(&source_file_path);
    if !source.exists() || !source.is_file() {
        return Err("A cópia local selecionada não existe.".to_string());
    }
    let local_root = backups_dir(app)?.canonicalize().map_err(to_error)?;
    let source_canonical = source.canonicalize().map_err(to_error)?;
    if !source_canonical.starts_with(&local_root) {
        return Err("Somente backups criados pelo FinnacialUX podem ser espelhados automaticamente.".to_string());
    }
    if source.extension().and_then(|value| value.to_str()) != Some(BACKUP_EXTENSION) {
        return Err("O arquivo selecionado não é um pacote .fuxbackup.".to_string());
    }
    let encryption_mode = backup_package_encryption_mode(&source)?;
    if encryption_mode == "none" {
        return Err("Backups externos precisam estar criptografados antes da cópia.".to_string());
    }
    let directory = managed_directory(&preferences).ok_or_else(|| "Destino externo ausente.".to_string())?;
    let file_name = source.file_name().and_then(|name| name.to_str()).unwrap_or("FinnacialUX-backup.fuxbackup").to_string();
    let destination = directory.join(&file_name);
    let source_checksum = sha256_file(&source)?;
    if destination.exists() {
        let destination_checksum = sha256_file(&destination)?;
        if destination_checksum == source_checksum {
            let copy = copy_from_path(&destination)?;
            return Ok(ExternalBackupMirrorResult {
                copied: false,
                reason: "A cópia externa já existe e possui o mesmo SHA-256.".to_string(),
                source_file_name: file_name,
                copy: Some(copy),
                removed_count: 0,
                status,
            });
        }
        return Err("Já existe um arquivo externo com o mesmo nome e conteúdo diferente.".to_string());
    }
    let temporary = directory.join(format!(".{}.partial-{}", file_name, Uuid::new_v4()));
    fs::copy(&source, &temporary).map_err(to_error)?;
    let copied_checksum = sha256_file(&temporary)?;
    if copied_checksum != source_checksum {
        let _ = fs::remove_file(&temporary);
        return Err("A cópia externa foi interrompida porque o SHA-256 não confere.".to_string());
    }
    fs::rename(&temporary, &destination).map_err(to_error)?;
    fs::write(
        sidecar_path(&destination),
        format!("{}  {}\n", source_checksum, file_name),
    )
    .map_err(to_error)?;
    let copy = copy_from_path(&destination)?;
    if preferences.verify_after_copy && !copy.valid {
        return Err("A cópia externa foi criada, mas falhou na verificação final.".to_string());
    }
    let removed_count = apply_retention(&directory, preferences.retention_count)?;
    let now = Utc::now().to_rfc3339();
    preferences.last_mirrored_at = Some(now.clone());
    preferences.last_verified_at = if copy.valid { Some(now) } else { preferences.last_verified_at };
    save_preferences_internal(app, preferences)?;
    Ok(ExternalBackupMirrorResult {
        copied: true,
        reason: "Backup criptografado copiado e verificado no destino externo.".to_string(),
        source_file_name: file_name,
        copy: Some(copy),
        removed_count,
        status,
    })
}

fn verify_internal(app: &AppHandle) -> Result<ExternalBackupVerification, String> {
    let mut preferences = load_preferences_internal(app)?;
    let status = destination_status_internal(app, &preferences)?;
    let checked_at = Utc::now().to_rfc3339();
    if !status.available {
        return Ok(ExternalBackupVerification {
            status: status.clone(),
            copies: Vec::new(),
            valid_count: 0,
            invalid_count: 0,
            latest_copy_at: None,
            checked_at,
            reason: status.reason,
        });
    }
    let directory = managed_directory(&preferences).ok_or_else(|| "Destino externo ausente.".to_string())?;
    let copies = list_external_copies_internal(&directory)?;
    let valid_count = copies.iter().filter(|copy| copy.valid).count();
    let invalid_count = copies.len().saturating_sub(valid_count);
    let latest_copy_at = copies.first().map(|copy| copy.created_at.clone());
    preferences.last_verified_at = Some(checked_at.clone());
    save_preferences_internal(app, preferences)?;
    let reason = if copies.is_empty() {
        "O destino está disponível, mas ainda não possui cópias do FinnacialUX.".to_string()
    } else if invalid_count > 0 {
        format!("{} cópia(s) externa(s) não passaram na verificação SHA-256.", invalid_count)
    } else {
        format!("{} cópia(s) externa(s) foram verificadas com sucesso.", valid_count)
    };
    Ok(ExternalBackupVerification {
        status,
        copies,
        valid_count,
        invalid_count,
        latest_copy_at,
        checked_at,
        reason,
    })
}

#[tauri::command]
pub fn external_backup_get_preferences(app: AppHandle) -> Result<ExternalBackupPreferences, String> {
    load_preferences_internal(&app)
}

#[tauri::command]
pub fn external_backup_save_preferences(
    app: AppHandle,
    preferences: ExternalBackupPreferences,
) -> Result<ExternalBackupPreferences, String> {
    save_preferences_internal(&app, preferences)
}

#[tauri::command]
pub fn external_backup_get_destination_status(
    app: AppHandle,
) -> Result<ExternalBackupDestinationStatus, String> {
    let preferences = load_preferences_internal(&app)?;
    destination_status_internal(&app, &preferences)
}

#[tauri::command(async)]
pub fn external_backup_mirror(
    app: AppHandle,
    source_file_path: String,
) -> Result<ExternalBackupMirrorResult, String> {
    run_local_async_worker("finnacialux-external-backup", move || async move {
        mirror_internal(&app, source_file_path)
    })
}

#[tauri::command(async)]
pub fn external_backup_verify(
    app: AppHandle,
) -> Result<ExternalBackupVerification, String> {
    run_local_async_worker("finnacialux-external-backup-verify", move || async move {
        verify_internal(&app)
    })
}

#[tauri::command]
pub fn external_backup_open_destination(app: AppHandle) -> Result<String, String> {
    let preferences = load_preferences_internal(&app)?;
    let directory = managed_directory(&preferences).ok_or_else(|| "Destino externo ausente.".to_string())?;
    if !directory.exists() {
        return Err("O destino externo está desconectado.".to_string());
    }
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(&directory).spawn().map_err(to_error)?;
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&directory).spawn().map_err(to_error)?;
    #[cfg(all(unix, not(target_os = "macos")))]
    Command::new("xdg-open").arg(&directory).spawn().map_err(to_error)?;
    Ok(directory.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retention_is_restricted_to_supported_values() {
        let preferences = normalize_preferences(ExternalBackupPreferences {
            retention_count: 999,
            ..ExternalBackupPreferences::default()
        });
        assert_eq!(preferences.retention_count, 10);
    }

    #[test]
    fn synchronized_destinations_are_recognized_without_network_access() {
        assert!(looks_synchronized(Path::new(r"C:\Users\Pessoa\OneDrive\Financeiro")));
        assert!(looks_synchronized(Path::new(r"D:\Dropbox\Backups")));
        assert!(!looks_synchronized(Path::new(r"C:\Backups")));
    }

    #[test]
    fn windows_volume_prefix_is_normalized() {
        assert_eq!(windows_drive(Path::new(r"e:\Backups")), Some("E:".to_string()));
        assert_eq!(windows_drive(Path::new("/tmp/backups")), None);
    }
}
