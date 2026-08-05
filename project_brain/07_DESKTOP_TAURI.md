# Desktop Tauri

O Tauri 2 usa `src-tauri/tauri.conf.json`, export estático em `../out`, janela principal `main` e bundle NSIS `currentUser`. O CSP de produção limita fontes a recursos locais e IPC; o CSP de desenvolvimento permite o servidor local.

Plugins confirmados: dialog, fs, log, Stronghold, updater, autostart, notification, window-state e single-instance. O runtime também configura tray icon, marcador de sessão e salt do Stronghold.

Os comandos Rust registrados em `lib.rs` formam a API nativa. Adaptadores em `lib/desktop/` são a fronteira preferida para o frontend; componentes não devem espalhar `invoke` sem contrato. O NSIS usa WebView2 por bootstrapper e não permite downgrade. Arquivos temporários `nst*.tmp` só podem ser assinados quando forem PE válidos; EXE, MSI e DLL permanecem na allowlist de assinatura.
