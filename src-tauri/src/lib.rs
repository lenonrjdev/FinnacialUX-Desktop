mod protection;

use protection::{clear_session_marker, initialize_session_marker, RecoveryState};
use tauri::{Manager, RunEvent};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_finnacialux_desktop_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_data_protection_backups_and_diagnostics",
            sql: include_str!("../migrations/0002_data_protection.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let recovery_state = RecoveryState::default();
    let builder = tauri::Builder::default().manage(recovery_state);

    // Precisa ser o primeiro plugin funcional registrado. Uma segunda abertura
    // encerra a nova instância e traz a janela existente para frente.
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
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:finnacialux.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            protection::create_manual_backup,
            protection::run_automatic_backup,
            protection::list_backups,
            protection::remove_backup_record,
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
        ])
        .setup(|app| {
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
