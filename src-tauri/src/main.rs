// Impede a abertura de uma janela de console no Windows em builds de produção.
// Em `tauri dev`, o terminal continua visível de propósito para exibir logs.
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    finnacialux_desktop_lib::run();
}
