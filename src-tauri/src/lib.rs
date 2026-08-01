mod command_worker;
mod encrypted_database;
mod protection;
mod security;
mod portability;
mod continuity;
mod automations;
mod intelligence;
mod planning;
mod reconciliation;
mod performance;
mod background_tasks;
mod diagnostics;
mod onboarding;
mod external_backup;

use background_tasks::BackgroundSchedulerState;
use encrypted_database::EncryptedDatabaseState;
use protection::{clear_session_marker, initialize_session_marker, RecoveryState};
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_log::{Target, TargetKind};

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn setup_system_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Abrir FinnacialUX", true, None::<&str>)?;
    let lock_item = MenuItem::with_id(app, "lock", "Bloquear aplicativo", true, None::<&str>)?;
    let routines_item = MenuItem::with_id(app, "routines", "Executar rotinas locais", true, None::<&str>)?;
    let backup_item = MenuItem::with_id(app, "backup", "Criar backup", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Encerrar FinnacialUX", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open_item, &lock_item, &routines_item, &backup_item, &separator, &quit_item],
    )?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("FinnacialUX Desktop")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "lock" => {
                show_main_window(app);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("finnacialux-lock-requested-native", ());
                }
            }
            "routines" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("finnacialux-background-run-requested-native", ());
                }
            }
            "backup" => {
                show_main_window(app);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("finnacialux-backup-requested-native", ());
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let recovery_state = RecoveryState::default();
    let database_state = EncryptedDatabaseState::default();
    let builder = tauri::Builder::default()
        .manage(recovery_state)
        .manage(database_state)
        .manage(BackgroundSchedulerState::default());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _working_directory| {
                show_main_window(app);
            },
        ))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            encrypted_database::encrypted_database_open,
            encrypted_database::encrypted_database_execute,
            encrypted_database::encrypted_database_select,
            encrypted_database::encrypted_database_status,
            encrypted_database::encrypted_database_close,
            encrypted_database::encrypted_database_rekey,
            encrypted_database::database_access_status,
            protection::create_manual_backup,
            protection::run_automatic_backup,
            protection::create_pre_update_backup,
            protection::prepare_for_update_exit,
            protection::resume_after_update_failure,
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
            external_backup::external_backup_get_preferences,
            external_backup::external_backup_save_preferences,
            external_backup::external_backup_get_destination_status,
            external_backup::external_backup_mirror,
            external_backup::external_backup_verify,
            external_backup::external_backup_open_destination,
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
            portability::portability_get_workspace_documents,
            portability::portability_apply_documents,
            portability::portability_record_operation,
            portability::portability_list_operations,
            portability::portability_undo_operation,
            continuity::continuity_get_preferences,
            continuity::continuity_save_preferences,
            continuity::continuity_list_recovery_points,
            continuity::continuity_create_recovery_point,
            continuity::continuity_verify_recovery_point,
            continuity::continuity_restore_recovery_point,
            continuity::continuity_run_startup_check,
            continuity::continuity_exit_read_only,
            continuity::continuity_get_status,
            automations::automation_get_preferences,
            automations::automation_save_preferences,
            automations::automation_simulate,
            automations::automation_apply,
            automations::automation_list_runs,
            automations::automation_undo_run,
            automations::automation_mark_alert,
            intelligence::intelligence_get_preferences,
            intelligence::intelligence_save_preferences,
            intelligence::intelligence_list_scenarios,
            intelligence::intelligence_save_scenario,
            intelligence::intelligence_delete_scenario,
            intelligence::intelligence_record_snapshot,
            intelligence::intelligence_list_snapshots,
            planning::planning_get_preferences,
            planning::planning_save_preferences,
            planning::planning_list_plans,
            planning::planning_save_plan,
            planning::planning_activate_plan,
            planning::planning_archive_plan,
            planning::planning_record_review,
            planning::planning_list_reviews,
            planning::planning_list_decisions,
            planning::planning_save_decision,
            planning::planning_update_decision_status,
            planning::planning_delete_decision,
            reconciliation::reconciliation_get_preferences,
            reconciliation::reconciliation_save_preferences,
            reconciliation::reconciliation_preview_import,
            reconciliation::reconciliation_apply_import,
            reconciliation::reconciliation_list_imports,
            reconciliation::reconciliation_undo_import,
            reconciliation::reconciliation_preview_closure,
            reconciliation::reconciliation_close_month,
            reconciliation::reconciliation_list_closures,
            reconciliation::reconciliation_reopen_month,
            reconciliation::reconciliation_list_events,
            reconciliation::reconciliation_save_evidence,
            reconciliation::reconciliation_list_evidence,
            reconciliation::reconciliation_read_evidence,
            reconciliation::reconciliation_delete_evidence,
            performance::performance_get_preferences,
            performance::performance_save_preferences,
            performance::performance_list_transactions_page,
            performance::performance_rebuild_transaction_index,
            performance::performance_cancel_operation,
            performance::performance_list_operations,
            performance::performance_list_metrics,
            performance::performance_get_database_health,
            performance::performance_run_database_maintenance,
            performance::performance_benchmark_transactions,
            background_tasks::background_get_preferences,
            background_tasks::background_save_preferences,
            background_tasks::background_start_scheduler,
            background_tasks::background_stop_scheduler,
            background_tasks::background_run_due_tasks,
            background_tasks::background_get_status,
            background_tasks::background_list_tasks,
            background_tasks::background_list_runs,
            background_tasks::background_cancel_task,
            background_tasks::background_retry_task,
            background_tasks::background_list_notifications,
            background_tasks::background_flush_notifications,
            background_tasks::background_ack_notification,
            diagnostics::diagnostics_preview,
            diagnostics::diagnostics_run_suite,
            diagnostics::diagnostics_list_runs,
            diagnostics::diagnostics_list_repairs,
            diagnostics::diagnostics_apply_repair,
            diagnostics::diagnostics_export_support_package,
            diagnostics::diagnostics_validate_support_package,
            onboarding::onboarding_get_state,
            onboarding::onboarding_sync_progress,
            onboarding::onboarding_complete_step,
            onboarding::onboarding_skip_guide,
            onboarding::onboarding_reset_guide,
            onboarding::onboarding_save_preferences,
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
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                setup_system_tray(app)?;
            }

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
