pub mod application;
pub mod commands;
pub mod domain;
pub mod error;
pub mod infrastructure;

use application::discovery_use_cases::DiscoveryService;
use commands::{
    connection_cmd::{
        check_android_node_health, get_android_device_storage, get_local_network_subnets,
        pair_android_device, revoke_android_device_session, scan_lan_devices,
    },
    explorer_cmd::{
        create_android_dir, create_local_dir, delete_android_file_entry, delete_local_entry,
        list_android_dir, list_local_dir,
    },
    transfer_cmd::transfer_file_stream,
};
use infrastructure::discovery::{
    IfAddrsNetworkProvider, MdnsSdGateway, ReqwestHealthGateway,
};
use std::sync::Arc;
use tauri::Manager;

/// En Linux (especialmente en Wayland sobre Manjaro/KDE/GNOME), el compositor obtiene el icono
/// del lanzador/barra de tareas asociando el `app_id` de la ventana con el archivo `.desktop`
/// e icono en `~/.local/share/icons/hicolor/`. Esta función garantiza que el icono de la nube
/// Akatsuki esté registrado automáticamente al iniciar la aplicación.
#[cfg(target_os = "linux")]
fn ensure_linux_wayland_desktop_icon() {
    let Some(data_dir) = dirs::data_local_dir() else {
        return;
    };

    let icon_512_dir = data_dir.join("icons/hicolor/512x512/apps");
    let icon_128_dir = data_dir.join("icons/hicolor/128x128/apps");
    let apps_dir = data_dir.join("applications");

    let _ = std::fs::create_dir_all(&icon_512_dir);
    let _ = std::fs::create_dir_all(&icon_128_dir);
    let _ = std::fs::create_dir_all(&apps_dir);

    let icon_512_bytes = include_bytes!("../icons/512x512.png");
    let icon_128_bytes = include_bytes!("../icons/128x128.png");

    let icon_512_path = icon_512_dir.join("akatsuki-desktop.png");
    let _ = std::fs::write(&icon_512_path, icon_512_bytes);
    let _ = std::fs::write(
        icon_512_dir.join("com.akatsuki.cyberlink.desktop.png"),
        icon_512_bytes,
    );
    let _ = std::fs::write(icon_128_dir.join("akatsuki-desktop.png"), icon_128_bytes);
    let _ = std::fs::write(
        icon_128_dir.join("com.akatsuki.cyberlink.desktop.png"),
        icon_128_bytes,
    );

    // Determinar ejecutable instalado o actual
    let home_bin = dirs::home_dir()
        .map(|h| h.join(".local/bin/akatsuki-desktop"))
        .filter(|p| p.exists());
    let exec_path = home_bin
        .or_else(|| std::env::current_exe().ok())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "akatsuki-desktop".to_string());

    let icon_abs = icon_512_path.to_string_lossy();

    let primary_desktop = format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Version=1.0\n\
         Name=Akatsuki Desktop\n\
         GenericName=Shinobi Secure File Transfer\n\
         Comment=Cliente Cyberpunk de transferencia segura de archivos PC <-> Android (HTTPS TLS + SHA-256)\n\
         Exec=\"{exec_path}\"\n\
         Icon={icon_abs}\n\
         Terminal=false\n\
         Categories=Utility;FileTools;Network;FileTransfer;\n\
         StartupNotify=true\n\
         StartupWMClass=akatsuki-desktop\n"
    );

    let alias_desktop = format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Version=1.0\n\
         Name=Akatsuki Desktop\n\
         Exec=\"{exec_path}\"\n\
         Icon={icon_abs}\n\
         Terminal=false\n\
         NoDisplay=true\n\
         StartupWMClass=com.akatsuki.cyberlink.desktop\n"
    );

    let _ = std::fs::write(apps_dir.join("akatsuki-desktop.desktop"), primary_desktop);
    let _ = std::fs::write(
        apps_dir.join("com.akatsuki.cyberlink.desktop.desktop"),
        alias_desktop,
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    ensure_linux_wayland_desktop_icon();

    let discovery_service = Arc::new(DiscoveryService::new(
        Arc::new(IfAddrsNetworkProvider),
        Arc::new(MdnsSdGateway::new()),
        Arc::new(ReqwestHealthGateway),
    ));

    tauri::Builder::default()
        .manage(discovery_service)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if let Some(icon) = app.default_window_icon().cloned() {
                for window in app.webview_windows().values() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_lan_devices,
            get_local_network_subnets,
            check_android_node_health,
            pair_android_device,
            revoke_android_device_session,
            get_android_device_storage,
            list_local_dir,
            create_local_dir,
            delete_local_entry,
            list_android_dir,
            create_android_dir,
            delete_android_file_entry,
            transfer_file_stream
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar Akatsuki Desktop (Tauri v2)");
}
