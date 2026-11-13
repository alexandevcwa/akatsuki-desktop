pub mod commands;
pub mod domain;
pub mod error;
pub mod infrastructure;

use commands::{
    connection_cmd::{pair_android_device, scan_lan_devices},
    explorer_cmd::{list_android_dir, list_local_dir},
    transfer_cmd::transfer_file_stream,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            scan_lan_devices,
            pair_android_device,
            list_local_dir,
            list_android_dir,
            transfer_file_stream
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar Akatsuki Desktop (Tauri v2)");
}
