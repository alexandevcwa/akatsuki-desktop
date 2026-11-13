use crate::domain::device::{ActiveSession, AndroidDeviceNode};
use crate::error::AkatsukiResult;
use crate::infrastructure::android_client::pair_with_android_webservice;
use crate::infrastructure::mdns_discovery::discover_android_nodes_on_lan;

#[tauri::command]
pub async fn scan_lan_devices() -> AkatsukiResult<Vec<AndroidDeviceNode>> {
    Ok(discover_android_nodes_on_lan().await)
}

#[tauri::command]
pub async fn pair_android_device(
    ip_address: String,
    port: u16,
    pin_code: String,
    expected_fingerprint: Option<String>,
) -> AkatsukiResult<ActiveSession> {
    pair_with_android_webservice(
        &ip_address,
        port,
        &pin_code,
        expected_fingerprint.as_deref(),
    )
    .await
}
