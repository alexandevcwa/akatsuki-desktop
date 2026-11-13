use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub modified_at: String,
    pub extension: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub current_path: String,
    pub hostname: Option<String>,
    pub entries: Vec<FileEntry>,
}

/// Respuesta del endpoint `POST /api/v1/files/mkdir`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MkdirResponse {
    pub created: bool,
    pub path: String,
}

/// Respuesta del endpoint `DELETE /api/v1/files/delete`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntryResponse {
    pub deleted: bool,
    pub path: String,
}

/// Respuesta del endpoint `POST /api/v1/files/upload`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadVerifiedResponse {
    pub verified: bool,
    pub saved_path: String,
    pub size_bytes: u64,
    pub sha256: String,
}
