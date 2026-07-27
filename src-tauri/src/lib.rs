mod encrypted_database;
mod protection;
mod security;

use encrypted_database::EncryptedDatabaseState;
use protection::{clear_session_marker, initialize_session_marker, RecoveryState};
use tauri::{Manager, RunEvent};
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let recovery_state = RecoveryState::default();
    let database_state = EncryptedDatabaseState::default();
    let builder = tauri::Builder::default()
        .manage(recovery_state)
        .manage(database_state);

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(
        |app, _arguments, _working_directory| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        },
    ));

    let log_plugin = tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::LogDir {
            file_name: Some("finnacialux".to_string()),
        }))
        .max_file_size(5_000_000)
        .build();

    let application = builder
        .plugin(log_plugin)
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            encrypted_database::encrypted_database_open,
            encrypted_database::encrypted_database_execute,
            encrypted_database::encrypted_database_select,
            encrypted_database::encrypted_database_status,
            encrypted_database::encrypted_database_close,
            encrypted_database::encrypted_database_rekey,
            protection::create_manual_backup,
            protection::run_automatic_backup,
            protection::list_backups,
            protection::remove_backup_record,
            protection::inspect_backup_header,
            protection::preview_backup,
            protection::restore_backup,
            protection::run_integrity_check,
            protection::get_diagnostics,
            protection::export_diagnostic_package,
            protection::get_backup_preferences,
            protection::save_backup_preferences,
            protection::open_app_folder,
            protection::get_recovery_status,
            protection::acknowledge_recovery,
            security::create_argon2_credential,
            security::verify_user_password,
            security::change_account_password,
            security::get_security_settings,
            security::save_security_settings,
            security::set_local_pin,
            security::disable_local_pin,
            security::verify_local_pin,
            security::record_local_lock,
            security::mark_vault_initialized,
            security::get_vault_bootstrap_secret,
            security::list_security_events,
        ])
        .setup(|app| {
            let local_data_dir = app
                .path()
                .app_local_data_dir()
                .map_err(std::io::Error::other)?;
            std::fs::create_dir_all(&local_data_dir)?;
            let stronghold_salt = local_data_dir.join("stronghold-salt.bin");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&stronghold_salt).build(),
            )?;

            let state = app.state::<RecoveryState>();
            initialize_session_marker(app.handle(), &state)
                .map_err(std::io::Error::other)?;
            log::info!("application_started version={}", app.package_info().version);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao preparar o FinnacialUX Desktop");

    application.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            clear_session_marker(app_handle);
        }
    });
}
