use crate::domain::device::{
    ActiveSession, HealthResponse, RevokeSessionResponse, StorageInfoResponse,
};
use crate::domain::file_entry::{
    DeleteEntryResponse, DirectoryListing, MkdirResponse, UploadVerifiedResponse,
};
use crate::domain::transfer::TransferProgressPayload;
use crate::error::{AkatsukiError, AkatsukiResult};
use crate::infrastructure::crypto_hash::compute_file_sha256;
use crate::infrastructure::tls_verifier::verify_tls_certificate_pin;
use futures_util::StreamExt;
use reqwest::{Body, Client, Response};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;

/// Timeout total y de conexión para el sondeo rápido `GET /api/v1/health` en red local (LAN).
const HEALTH_PROBE_TIMEOUT: Duration = Duration::from_millis(2000);
const HEALTH_PROBE_CONNECT_TIMEOUT: Duration = Duration::from_millis(1500);

/// Construye el cliente HTTPS de Reqwest con timeouts explícitos para red local (LAN).
fn build_android_https_client_with_timeouts(
    request_timeout: Duration,
    connect_timeout: Duration,
) -> AkatsukiResult<Client> {
    let client = Client::builder()
        .timeout(request_timeout)
        .connect_timeout(connect_timeout)
        // En red local (IP privada) el certificado X.509 del Android es autofirmado
        // y se verifica criptográficamente mediante Certificate Pinning SHA-256 (TOFU).
        .danger_accept_invalid_certs(true)
        .build()?;
    Ok(client)
}

/// Construye el cliente HTTPS de Reqwest para conectarse al Web Service en red local (LAN).
pub fn build_android_https_client(timeout_secs: u64) -> AkatsukiResult<Client> {
    build_android_https_client_with_timeouts(
        Duration::from_secs(timeout_secs),
        Duration::from_secs(4),
    )
}

/// Valida que la respuesta tenga un estado exitoso; de lo contrario devuelve un mensaje claro para el usuario.
async fn ensure_success_status(resp: Response) -> AkatsukiResult<Response> {
    let status = resp.status();
    if status.is_success() {
        return Ok(resp);
    }

    let friendly_message = match status.as_u16() {
        400 => "Los datos enviados al dispositivo Android no son válidos. Revisa la dirección y el PIN.",
        401 => "Código PIN incorrecto o sesión expirada. Verifica el PIN mostrado en tu celular Android.",
        403 => "Acceso denegado por el dispositivo Android. Concede los permisos en la aplicación móvil.",
        404 => "El recurso o carpeta solicitada no existe en el dispositivo Android.",
        409 => "Ya existe un archivo o carpeta con ese mismo nombre en el dispositivo Android.",
        422 => "El archivo no pudo verificarse correctamente en el dispositivo Android.",
        429 => "Demasiados intentos de vinculación fallidos. Espera unos segundos antes de intentar de nuevo.",
        500..=599 => "Ocurrió un problema interno en la aplicación del dispositivo Android.",
        _ => "No se pudo completar la operación con el dispositivo Android. Intenta nuevamente.",
    };

    Err(AkatsukiError::HttpStatusFriendly(
        friendly_message.to_string(),
    ))
}

/// `GET /api/v1/health` — Verifica estado del servidor Android y obtiene su huella TLS.
pub async fn check_android_health(ip_address: &str, port: u16) -> AkatsukiResult<HealthResponse> {
    let endpoint = format!("https://{}:{}/api/v1/health", ip_address, port);
    let client = build_android_https_client_with_timeouts(
        HEALTH_PROBE_TIMEOUT,
        HEALTH_PROBE_CONNECT_TIMEOUT,
    )?;
    let resp = client.get(&endpoint).send().await?;
    let resp = ensure_success_status(resp).await?;
    Ok(resp.json::<HealthResponse>().await?)
}

/// `POST /api/v1/auth/pair` — Realiza el handshake de emparejamiento con PIN y verificación TOFU.
pub async fn pair_with_android_webservice(
    ip_address: &str,
    port: u16,
    pin_code: &str,
    client_name: &str,
    expected_fingerprint: Option<&str>,
) -> AkatsukiResult<ActiveSession> {
    let endpoint = format!("https://{}:{}/api/v1/auth/pair", ip_address, port);
    let client = build_android_https_client(10)?;

    let resp = client
        .post(&endpoint)
        .json(&serde_json::json!({
            "clientName": client_name,
            "pinCode": pin_code
        }))
        .send()
        .await?;

    let resp = ensure_success_status(resp).await?;
    let mut session = resp.json::<ActiveSession>().await?;

    // Verificación obligatoria de Certificate Pinning (TOFU)
    let verified_fp = verify_tls_certificate_pin(
        &session.device.tls_cert_fingerprint_sha256,
        expected_fingerprint,
    )?;
    session.device.tls_cert_fingerprint_sha256 = verified_fp;

    Ok(session)
}

/// `POST /api/v1/auth/revoke` — Cierra la sesión y revoca el Bearer Token activo en el Android.
pub async fn revoke_android_session(
    ip_address: &str,
    port: u16,
    bearer_token: &str,
) -> AkatsukiResult<RevokeSessionResponse> {
    let endpoint = format!("https://{}:{}/api/v1/auth/revoke", ip_address, port);
    let client = build_android_https_client(6)?;

    let resp = client
        .post(&endpoint)
        .bearer_auth(bearer_token)
        .send()
        .await?;

    let resp = ensure_success_status(resp).await?;
    Ok(resp.json::<RevokeSessionResponse>().await?)
}

/// `GET /api/v1/device/storage` — Consulta el espacio total y libre actualizado del Android.
pub async fn fetch_android_storage(
    ip_address: &str,
    port: u16,
    bearer_token: &str,
) -> AkatsukiResult<StorageInfoResponse> {
    let endpoint = format!("https://{}:{}/api/v1/device/storage", ip_address, port);
    eprintln!("[INFO][RemoteClient] Iniciando consulta de almacenamiento en {}", endpoint);

    let client = match build_android_https_client(8) {
        Ok(c) => c,
        Err(err) => {
            eprintln!(
                "[ERROR][RemoteClient] Error al instanciar cliente HTTPS para {}: {:?}",
                endpoint, err
            );
            return Err(err);
        }
    };

    let resp = match client.get(&endpoint).bearer_auth(bearer_token).send().await {
        Ok(r) => r,
        Err(err) => {
            eprintln!(
                "[ERROR][RemoteClient] Fallo de conectividad/red hacia {}: {:?}",
                endpoint, err
            );
            return Err(err.into());
        }
    };

    let status = resp.status();
    let resp = match ensure_success_status(resp).await {
        Ok(r) => r,
        Err(err) => {
            eprintln!(
                "[WARN][RemoteClient] El dispositivo respondió con estado HTTP {} ({}) en {}",
                status.as_u16(),
                status.canonical_reason().unwrap_or("Unknown"),
                endpoint
            );
            return Err(err);
        }
    };

    match resp.json::<StorageInfoResponse>().await {
        Ok(storage_info) => {
            let total_gb = storage_info.android_storage_total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
            let free_gb = storage_info.android_storage_free_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
            eprintln!(
                "[INFO][RemoteClient] Almacenamiento obtenido exitosamente de {}: Total = {:.2} GB ({} bytes), Libre = {:.2} GB ({} bytes)",
                endpoint,
                total_gb,
                storage_info.android_storage_total_bytes,
                free_gb,
                storage_info.android_storage_free_bytes
            );
            Ok(storage_info)
        }
        Err(err) => {
            eprintln!(
                "[ERROR][RemoteClient] Fallo al deserializar JSON de respuesta de {}: {:?}",
                endpoint, err
            );
            Err(err.into())
        }
    }
}

/// `GET /api/v1/files/list` — Obtiene el listado real de archivos y carpetas del dispositivo Android.
pub async fn fetch_android_directory(
    ip_address: &str,
    port: u16,
    bearer_token: &str,
    path: &str,
) -> AkatsukiResult<DirectoryListing> {
    let endpoint = format!("https://{}:{}/api/v1/files/list", ip_address, port);
    let clean_path = if path.trim().is_empty() {
        ""
    } else {
        path.trim()
    };

    eprintln!(
        "[INFO][RemoteClient] Solicitando listado de directorio en {}: path=\"{}\"",
        endpoint, clean_path
    );

    let client = match build_android_https_client(12) {
        Ok(c) => c,
        Err(err) => {
            eprintln!(
                "[ERROR][RemoteClient] Error al instanciar cliente HTTPS para listado en {}: {:?}",
                endpoint, err
            );
            return Err(err);
        }
    };

    let resp = match client
        .get(&endpoint)
        .bearer_auth(bearer_token)
        .query(&[("path", clean_path)])
        .send()
        .await
    {
        Ok(r) => r,
        Err(err) => {
            eprintln!(
                "[ERROR][RemoteClient] Fallo de conectividad al listar directorio en {} (path: \"{}\"): {:?}",
                endpoint, clean_path, err
            );
            return Err(err.into());
        }
    };

    let status = resp.status();
    let resp = match ensure_success_status(resp).await {
        Ok(r) => r,
        Err(err) => {
            eprintln!(
                "[WARN][RemoteClient] El dispositivo respondió con estado HTTP {} ({}) al listar path \"{}\" en {}",
                status.as_u16(),
                status.canonical_reason().unwrap_or("Unknown"),
                clean_path,
                endpoint
            );
            return Err(err);
        }
    };

    match resp.json::<DirectoryListing>().await {
        Ok(listing) => {
            let dirs_count = listing.entries.iter().filter(|e| e.is_dir).count();
            let files_count = listing.entries.len() - dirs_count;
            eprintln!(
                "[INFO][RemoteClient] Listado recibido con éxito de {} (current_path=\"{}\"): {} elementos ({} carpetas, {} archivos)",
                endpoint,
                listing.current_path,
                listing.entries.len(),
                dirs_count,
                files_count
            );
            Ok(listing)
        }
        Err(err) => {
            eprintln!(
                "[ERROR][RemoteClient] Fallo al deserializar DirectoryListing de {} (path: \"{}\"): {:?}",
                endpoint, clean_path, err
            );
            Err(err.into())
        }
    }
}

/// `POST /api/v1/files/mkdir` — Crea una nueva carpeta en el almacenamiento del dispositivo Android.
pub async fn create_android_directory(
    ip_address: &str,
    port: u16,
    bearer_token: &str,
    path: &str,
) -> AkatsukiResult<MkdirResponse> {
    let endpoint = format!("https://{}:{}/api/v1/files/mkdir", ip_address, port);
    let client = build_android_https_client(10)?;

    let resp = client
        .post(&endpoint)
        .bearer_auth(bearer_token)
        .json(&serde_json::json!({ "path": path }))
        .send()
        .await?;

    let resp = ensure_success_status(resp).await?;
    Ok(resp.json::<MkdirResponse>().await?)
}

/// `DELETE /api/v1/files/delete` — Elimina un archivo o directorio en el dispositivo Android.
pub async fn delete_android_entry(
    ip_address: &str,
    port: u16,
    bearer_token: &str,
    path: &str,
) -> AkatsukiResult<DeleteEntryResponse> {
    let endpoint = format!("https://{}:{}/api/v1/files/delete", ip_address, port);
    let client = build_android_https_client(10)?;

    let resp = client
        .delete(&endpoint)
        .bearer_auth(bearer_token)
        .json(&serde_json::json!({ "path": path }))
        .send()
        .await?;

    let resp = ensure_success_status(resp).await?;
    Ok(resp.json::<DeleteEntryResponse>().await?)
}

/// `POST /api/v1/files/upload` — Transfiere un archivo de PC → Android por streaming asíncrono
/// verificando la integridad SHA-256 de extremo a extremo.
#[allow(clippy::too_many_arguments)]
pub async fn upload_file_to_android_stream(
    task_id: &str,
    source_path: &str,
    destination_path: &str,
    ip_address: &str,
    port: u16,
    bearer_token: &str,
    on_event: &Channel<TransferProgressPayload>,
) -> AkatsukiResult<String> {
    let src = Path::new(source_path);
    let metadata = tokio::fs::metadata(src).await?;
    let total_bytes = metadata.len();

    // Fase 1: Calcular SHA-256 del archivo local antes de enviar
    let _ = on_event.send(TransferProgressPayload {
        task_id: task_id.to_string(),
        transferred_bytes: 0,
        total_bytes,
        speed_bytes_per_sec: 0,
        sha256_checksum: None,
        status: "hashing_local".to_string(),
    });

    let expected_sha256 = compute_file_sha256(src).await?;

    // Fase 2: Streaming del archivo por bloques con telemetría en vivo
    let file = File::open(src).await?;
    let reader_stream = ReaderStream::with_capacity(file, 64 * 1024);

    let task_id_owned = task_id.to_string();
    let channel_clone = on_event.clone();
    let expected_sha_clone = expected_sha256.clone();
    let start_instant = Instant::now();
    let mut transferred: u64 = 0;
    let mut last_emit = Instant::now();

    let progress_stream = reader_stream.map(move |chunk_res| {
        if let Ok(ref bytes) = chunk_res {
            transferred += bytes.len() as u64;
            let now = Instant::now();
            if now.duration_since(last_emit) >= Duration::from_millis(80)
                || transferred >= total_bytes
            {
                last_emit = now;
                let elapsed = start_instant.elapsed().as_secs_f64().max(0.001);
                let speed = (transferred as f64 / elapsed) as u64;
                let _ = channel_clone.send(TransferProgressPayload {
                    task_id: task_id_owned.clone(),
                    transferred_bytes: transferred,
                    total_bytes,
                    speed_bytes_per_sec: speed,
                    sha256_checksum: Some(expected_sha_clone.clone()),
                    status: "streaming".to_string(),
                });
            }
        }
        chunk_res
    });

    let endpoint = format!("https://{}:{}/api/v1/files/upload", ip_address, port);
    let client = build_android_https_client(3600)?;

    let resp = client
        .post(&endpoint)
        .bearer_auth(bearer_token)
        .header("Content-Type", "application/octet-stream")
        .header("X-Destination-Path", destination_path)
        .header("X-Expected-SHA256", &expected_sha256)
        .header("Content-Length", total_bytes)
        .body(Body::wrap_stream(progress_stream))
        .send()
        .await?;

    let resp = ensure_success_status(resp).await?;
    let verified_resp = resp.json::<UploadVerifiedResponse>().await?;

    if !verified_resp.verified
        || !verified_resp
            .sha256
            .eq_ignore_ascii_case(&expected_sha256)
    {
        return Err(AkatsukiError::IntegrityMismatch {
            expected: expected_sha256,
            actual: verified_resp.sha256,
        });
    }

    let _ = on_event.send(TransferProgressPayload {
        task_id: task_id.to_string(),
        transferred_bytes: total_bytes,
        total_bytes,
        speed_bytes_per_sec: 0,
        sha256_checksum: Some(expected_sha256.clone()),
        status: "completed".to_string(),
    });

    Ok(expected_sha256)
}

/// `GET /api/v1/files/download` — Descarga un archivo de Android → PC por streaming binario
/// escribiendo en un archivo `.part` y verificando su hash SHA-256 al vuelo.
#[allow(clippy::too_many_arguments)]
pub async fn download_file_from_android_stream(
    task_id: &str,
    source_path: &str,
    destination_path: &str,
    fallback_total_bytes: u64,
    ip_address: &str,
    port: u16,
    bearer_token: &str,
    on_event: &Channel<TransferProgressPayload>,
) -> AkatsukiResult<String> {
    let endpoint = format!("https://{}:{}/api/v1/files/download", ip_address, port);
    let client = build_android_https_client(3600)?;

    let resp = client
        .get(&endpoint)
        .bearer_auth(bearer_token)
        .query(&[("path", source_path)])
        .send()
        .await?;

    let mut resp = ensure_success_status(resp).await?;

    let total_bytes = resp.content_length().unwrap_or(fallback_total_bytes);
    let expected_sha256 = resp
        .headers()
        .get("X-File-SHA256")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_lowercase());

    let temp_dest = format!("{}.part", destination_path);
    let mut out_file = File::create(&temp_dest).await?;
    let mut hasher = Sha256::new();

    let start_instant = Instant::now();
    let mut transferred: u64 = 0;
    let mut last_emit = Instant::now();

    while let Some(chunk) = resp.chunk().await? {
        out_file.write_all(&chunk).await?;
        hasher.update(&chunk);
        transferred += chunk.len() as u64;

        let now = Instant::now();
        if now.duration_since(last_emit) >= Duration::from_millis(80) || transferred >= total_bytes
        {
            last_emit = now;
            let elapsed = start_instant.elapsed().as_secs_f64().max(0.001);
            let speed = (transferred as f64 / elapsed) as u64;

            let _ = on_event.send(TransferProgressPayload {
                task_id: task_id.to_string(),
                transferred_bytes: transferred,
                total_bytes,
                speed_bytes_per_sec: speed,
                sha256_checksum: expected_sha256.clone(),
                status: "streaming".to_string(),
            });
        }
    }

    out_file.flush().await?;
    drop(out_file);

    let calculated_sha256 = hex::encode(hasher.finalize());

    if let Some(ref expected) = expected_sha256 {
        if !expected.is_empty() && !expected.eq_ignore_ascii_case(&calculated_sha256) {
            let _ = tokio::fs::remove_file(&temp_dest).await;
            return Err(AkatsukiError::IntegrityMismatch {
                expected: expected.clone(),
                actual: calculated_sha256,
            });
        }
    }

    tokio::fs::rename(&temp_dest, destination_path).await?;

    let _ = on_event.send(TransferProgressPayload {
        task_id: task_id.to_string(),
        transferred_bytes: transferred,
        total_bytes: total_bytes.max(transferred),
        speed_bytes_per_sec: 0,
        sha256_checksum: Some(calculated_sha256.clone()),
        status: "completed".to_string(),
    });

    Ok(calculated_sha256)
}
