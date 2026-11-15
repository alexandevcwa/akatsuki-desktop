use crate::application::discovery_use_cases::DiscoveryService;
use crate::commands::explorer_cmd::get_system_hostname;
use crate::domain::device::{
    ActiveSession, AndroidDeviceNode, HealthResponse, RevokeSessionResponse, StorageInfoResponse,
};
use crate::domain::discovery::LocalSubnetInfo;
use crate::error::AkatsukiResult;
use crate::infrastructure::android_client::{
    check_android_health, fetch_android_storage, pair_with_android_webservice,
    revoke_android_session,
};
use std::sync::Arc;

#[tauri::command]
pub async fn scan_lan_devices(
    discovery: tauri::State<'_, Arc<DiscoveryService>>,
) -> AkatsukiResult<Vec<AndroidDeviceNode>> {
    Ok(discovery.discover_android_nodes().await)
}

#[tauri::command]
pub async fn get_local_network_subnets(
    discovery: tauri::State<'_, Arc<DiscoveryService>>,
) -> AkatsukiResult<Vec<LocalSubnetInfo>> {
    Ok(discovery.list_local_subnets())
}

#[tauri::command]
pub async fn check_android_node_health(
    ip_address: String,
    port: u16,
) -> AkatsukiResult<HealthResponse> {
    check_android_health(&ip_address, port).await
}

#[tauri::command]
pub async fn pair_android_device(
    ip_address: String,
    port: u16,
    pin_code: String,
    expected_fingerprint: Option<String>,
) -> AkatsukiResult<ActiveSession> {
    let client_name = format!("Akatsuki Desktop ({})", get_system_hostname());
    pair_with_android_webservice(
        &ip_address,
        port,
        &pin_code,
        &client_name,
        expected_fingerprint.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn revoke_android_device_session(
    ip_address: String,
    port: u16,
    bearer_token: String,
) -> AkatsukiResult<RevokeSessionResponse> {
    revoke_android_session(&ip_address, port, &bearer_token).await
}

#[tauri::command]
pub async fn get_android_device_storage(
    ip_address: String,
    port: u16,
    bearer_token: String,
) -> AkatsukiResult<StorageInfoResponse> {
    fetch_android_storage(&ip_address, port, &bearer_token).await
}
