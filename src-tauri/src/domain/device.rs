use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AndroidDeviceNode {
    pub device_id: String,
    pub device_name: String,
    pub model: String,
    pub ip_address: String,
    pub port: u16,
    pub tls_cert_fingerprint_sha256: String,
    pub discovered_via: String,
    pub paired: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSession {
    pub device: AndroidDeviceNode,
    pub bearer_token: String,
    pub connected_at: String,
    pub android_storage_total_bytes: u64,
    pub android_storage_free_bytes: u64,
}

/// Respuesta del endpoint `GET /api/v1/health`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: String,
    pub device_id: String,
    pub device_name: String,
    pub model: String,
    pub port: u16,
    pub tls_cert_fingerprint_sha256: String,
}

/// Respuesta del endpoint `GET /api/v1/device/storage`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfoResponse {
    pub android_storage_total_bytes: u64,
    pub android_storage_free_bytes: u64,
}

/// Respuesta del endpoint `POST /api/v1/auth/revoke`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeSessionResponse {
    pub revoked: bool,
}
