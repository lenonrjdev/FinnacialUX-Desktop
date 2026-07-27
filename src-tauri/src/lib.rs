use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_finnacialux_desktop_schema",
        sql: include_str!("../migrations/0001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    let builder = tauri::Builder::default();

    // Precisa ser o primeiro plugin registrado. Quando o usuário tenta abrir
    // o aplicativo novamente, a nova instância é encerrada e a janela já
    // existente é restaurada, exibida e trazida para frente.
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

    builder
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:finnacialux.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o FinnacialUX Desktop");
}
