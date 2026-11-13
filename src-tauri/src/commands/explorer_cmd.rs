use crate::domain::file_entry::{DirectoryListing, FileEntry};
use crate::error::AkatsukiResult;
use crate::infrastructure::android_client::fetch_android_directory;
use chrono::{DateTime, Local};
use std::path::PathBuf;
use tokio::fs;

#[tauri::command]
pub async fn list_local_dir(path: Option<String>) -> AkatsukiResult<DirectoryListing> {
    let target_dir: PathBuf = match path {
        Some(ref p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => dirs::download_dir()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("/")),
    };

    let mut read_dir = fs::read_dir(&target_dir).await?;
    let mut entries = Vec::new();

    while let Some(entry) = read_dir.next_entry().await? {
        let file_name = entry.file_name().to_string_lossy().to_string();
        // Ignoramos archivos ocultos para mantener el explorador táctico limpio
        if file_name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();
        if let Ok(metadata) = entry.metadata().await {
            let is_dir = metadata.is_dir();
            let size_bytes = if is_dir { 0 } else { metadata.len() };
            let modified_at = metadata
                .modified()
                .ok()
                .map(|m| {
                    let dt: DateTime<Local> = m.into();
                    dt.format("%Y-%m-%d %H:%M").to_string()
                })
                .unwrap_or_else(|| "-".to_string());

            let extension = if is_dir {
                None
            } else {
                entry_path
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_string())
            };

            entries.push(FileEntry {
                name: file_name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir,
                size_bytes,
                modified_at,
                extension,
            });
        }
    }

    // Ordenar: Carpetas primero, luego alfabéticamente
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(DirectoryListing {
        current_path: target_dir.to_string_lossy().to_string(),
        entries,
    })
}

#[tauri::command]
pub async fn list_android_dir(
    ip_address: String,
    port: u16,
    bearer_token: String,
    path: String,
) -> AkatsukiResult<DirectoryListing> {
    fetch_android_directory(&ip_address, port, &bearer_token, &path).await
}
