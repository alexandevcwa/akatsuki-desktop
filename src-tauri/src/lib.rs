pub mod commands;
pub mod domain;
pub mod error;
pub mod infrastructure;

use commands::{
    connection_cmd::{
        check_android_node_health, get_android_device_storage, pair_android_device,
        revoke_android_device_session, scan_lan_devices,
    },
    explorer_cmd::{
        create_android_dir, create_local_dir, delete_android_file_entry, delete_local_entry,
        list_android_dir, list_local_dir,
    },
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
