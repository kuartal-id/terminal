// Kuartal Terminal desktop: a native window around terminal.kuartalsystems.com.
// The web app is the single source of truth, so the desktop app is always
// up to date without reinstalling. Prevents an extra console window on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Kuartal Terminal");
}
