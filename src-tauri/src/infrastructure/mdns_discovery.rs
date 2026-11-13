use crate::domain::device::AndroidDeviceNode;
use crate::infrastructure::android_client::check_android_health;
use std::net::{IpAddr, UdpSocket};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::task::JoinSet;
use tokio::time::timeout;

const DEFAULT_ANDROID_PORT: u16 = 8443;

/// Obtiene la dirección IPv4 local de la interfaz de red activa del equipo sin enviar tráfico externo.
fn detect_local_ipv4() -> Option<[u8; 4]> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket
        .connect("8.8.8.8:80")
        .or_else(|_| socket.connect("192.168.1.1:80"))
        .ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ipv4) => Some(ipv4.octets()),
        IpAddr::V6(_) => None,
    }
}

/// Escanea la subred local en paralelo buscando nodos Android con el puerto 8443 abierto
/// y consultando su endpoint real `GET /api/v1/health`.
pub async fn discover_android_nodes_on_lan() -> Vec<AndroidDeviceNode> {
    let Some(octets) = detect_local_ipv4() else {
        return Vec::new();
    };

    let prefix = format!("{}.{}.{}", octets[0], octets[1], octets[2]);
    let self_last = octets[3];
    let mut set = JoinSet::new();

    for host in 1..=254u8 {
        if host == self_last {
            continue;
        }
        let candidate_ip = format!("{}.{}", prefix, host);
        set.spawn(async move {
            let addr = format!("{}:{}", candidate_ip, DEFAULT_ANDROID_PORT);
            // Sonda TCP tolerante a latencia Wi-Fi en Android (500ms) antes del handshake HTTPS
            let tcp_ok = timeout(Duration::from_millis(500), TcpStream::connect(&addr))
                .await
                .map(|r| r.is_ok())
                .unwrap_or(false);

            if !tcp_ok {
                return None;
            }

            // Si el puerto 8443 responde, consultamos `GET /api/v1/health`
            if let Ok(health) = check_android_health(&candidate_ip, DEFAULT_ANDROID_PORT).await {
                if health.status.eq_ignore_ascii_case("online") {
                    return Some(AndroidDeviceNode {
                        device_id: health.device_id,
                        device_name: health.device_name,
                        model: health.model,
                        ip_address: candidate_ip,
                        port: health.port,
                        tls_cert_fingerprint_sha256: health.tls_cert_fingerprint_sha256,
                        discovered_via: "lan-scan".to_string(),
                        paired: false,
                    });
                }
            }
            None
        });
    }

    let mut discovered = Vec::new();
    while let Some(res) = set.join_next().await {
        if let Ok(Some(node)) = res {
            discovered.push(node);
        }
    }

    discovered.sort_by(|a, b| a.ip_address.cmp(&b.ip_address));
    discovered
}
