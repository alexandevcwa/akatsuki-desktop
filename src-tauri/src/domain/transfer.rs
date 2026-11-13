use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgressPayload {
    pub task_id: String,
    pub transferred_bytes: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub sha256_checksum: Option<String>,
    pub status: String,
}
