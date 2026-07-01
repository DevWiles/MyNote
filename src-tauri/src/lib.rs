/// 切换窗口外观(macOS NSAppearance),让原生毛玻璃随主题变为
/// 亮=白色磨砂 / 暗=灰色磨砂。
#[tauri::command]
fn set_theme(window: tauri::WebviewWindow, dark: bool) {
    let _ = window.set_theme(Some(if dark {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![set_theme])
        .setup(|_app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
                let window = _app.get_webview_window("main").expect("main window not found");
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::Sidebar,
                    Some(NSVisualEffectState::Active),
                    Some(14.0),
                )
                .expect("failed to apply window vibrancy (macOS only)");
            }
            // Windows：去原生标题栏 + 毛玻璃（Win11 Mica，退回 Win10 Acrylic）
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                use window_vibrancy::{apply_acrylic, apply_mica};
                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                    if apply_mica(&window, None).is_err() {
                        let _ = apply_acrylic(&window, Some((248, 250, 248, 190)));
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
