/// 切换窗口外观(macOS NSAppearance),让原生毛玻璃随主题变为
/// 亮=白色磨砂 / 暗=灰色磨砂。
#[tauri::command]
fn set_theme(window: tauri::WebviewWindow, dark: bool) {
    let _ = window.set_theme(Some(if dark {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    }));
    // Windows：随主题重设 Acrylic 磨砂 tint（亮=乳白，暗=深灰），高不透明度避免透亮
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::apply_acrylic;
        let tint = if dark {
            (24, 27, 33, 225)
        } else {
            (249, 251, 249, 225)
        };
        let _ = apply_acrylic(&window, Some(tint));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            // Windows：去原生标题栏 + Acrylic 磨砂（默认乳白，前端按主题再调）
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                use window_vibrancy::apply_acrylic;
                if let Some(window) = _app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                    let _ = apply_acrylic(&window, Some((249, 251, 249, 225)));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
