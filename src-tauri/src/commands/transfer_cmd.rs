use crate::domain::transfer::TransferProgressPayload;
use crate::error::{AkatsukiError, AkatsukiResult};
use crate::infrastructure::android_client::{
    download_file_from_android_stream, upload_file_to_android_stream,
};
use tauri::ipc::Channel;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn transfer_file_stream(
    task_id: String,
    _file_name: String,
    source_path: String,
    destination_path: String,
    total_bytes: u64,
    direction: String,
    ip_address: String,
    port: u16,
    bearer_token: String,
    on_event: Channel<TransferProgressPayload>,
) -> AkatsukiResult<String> {
    match direction.as_str() {
        "pc_to_android" => {
            upload_file_to_android_stream(
                &task_id,
                &source_path,
                &destination_path,
                &ip_address,
                port,
                &bearer_token,
                &on_event,
            )
            .await
        }
        "android_to_pc" => {
            download_file_from_android_stream(
                &task_id,
                &source_path,
                &destination_path,
                total_bytes,
                &ip_address,
                port,
                &bearer_token,
                &on_event,
            )
            .await
        }
        other => Err(AkatsukiError::InvalidOperation(format!(
            "Dirección de transferencia no soportada: {}",
            other
        ))),
    }
}
