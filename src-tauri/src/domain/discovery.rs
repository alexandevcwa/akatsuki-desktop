use crate::domain::device::{AndroidDeviceNode, HealthResponse};
use crate::error::AkatsukiResult;
use serde::Serialize;
use std::collections::BTreeMap;
use std::future::Future;
use std::net::Ipv4Addr;
use std::pin::Pin;
use std::time::Duration;

/// Futuro en caja `Send` usado por los puertos asíncronos del dominio sin dependencias externas.
pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Tipo de servicio mDNS / DNS-SD anunciado por los nodos Android en LAN.
pub const AKATSUKI_MDNS_SERVICE_TYPE: &str = "_akatsuki._tcp.local.";

/// Prefijos de interfaces virtuales o de contenedores excluidas cuando existe LAN física.
const IGNORED_VIRTUAL_IFACE_PREFIXES: &[&str] = &[
    "docker", "veth", "br-", "virbr", "vmnet", "vboxnet", "lxc", "cni", "flannel", "podman",
    "tailscale", "tun", "tap", "wg",
];

/// Información resumida de una subred local activa para exponerla al frontend.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalSubnetInfo {
    pub interface_name: String,
    pub local_ip: String,
    pub netmask: String,
    pub prefix_len: u8,
    pub cidr: String,
}

/// Representación interna de una subred IPv4 activa detectada en la PC.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSubnet {
    pub interface_name: String,
    pub local_ip: Ipv4Addr,
    pub netmask: Ipv4Addr,
    pub prefix_len: u8,
    pub network_u32: u32,
}

impl LocalSubnet {
    /// Convierte esta subred al DTO serializable esperado por la UI.
    pub fn to_info(&self) -> LocalSubnetInfo {
        LocalSubnetInfo {
            interface_name: self.interface_name.clone(),
            local_ip: self.local_ip.to_string(),
            netmask: self.netmask.to_string(),
            prefix_len: self.prefix_len,
            cidr: format!("{}/{}", Ipv4Addr::from(self.network_u32), self.prefix_len),
        }
    }
}

/// Metadatos extraídos de los registros TXT del anuncio mDNS de Android (`fp`, `id`, `name`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MdnsTxtMetadata {
    pub device_id: Option<String>,
    pub fingerprint_sha256: Option<String>,
    pub device_name: Option<String>,
}

/// Endpoint IPv4 resuelto vía mDNS/DNS-SD pendiente de validación con el dispositivo.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MdnsEndpointEntry {
    pub ip: Ipv4Addr,
    pub port: u16,
    pub fullname: String,
    pub meta: MdnsTxtMetadata,
}

/// Puerto de salida para enumerar las subredes IPv4 activas de la máquina local.
pub trait NetworkInterfaceProvider: Send + Sync {
    fn active_subnets(&self) -> Vec<LocalSubnet>;
}

/// Puerto de salida para descubrir nodos mediante mDNS y solicitar reconfirmación de caché.
pub trait MdnsDiscoveryGateway: Send + Sync {
    fn browse_endpoints<'a>(
        &'a self,
        subnets: &'a [LocalSubnet],
        window: Duration,
    ) -> BoxFuture<'a, Vec<MdnsEndpointEntry>>;

    fn verify_stale_entry(&self, fullname: &str, timeout: Duration);
}

/// Puerto de salida para verificar la salud HTTPS (`GET /api/v1/health`) de un candidato.
pub trait NodeHealthGateway: Send + Sync {
    fn check_health<'a>(
        &'a self,
        ip: &'a str,
        port: u16,
    ) -> BoxFuture<'a, AkatsukiResult<HealthResponse>>;
}

/// Determina si una interfaz de red corresponde a un adaptador virtual o túnel secundario.
pub fn is_virtual_interface(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    IGNORED_VIRTUAL_IFACE_PREFIXES
        .iter()
        .any(|prefix| lower.starts_with(prefix))
}

/// Verifica que una IPv4 sea válida para descubrimiento en red local (excluye loopback, link-local, etc.).
pub fn is_scannable_ipv4(ip: Ipv4Addr) -> bool {
    !ip.is_loopback()
        && !ip.is_link_local()
        && !ip.is_unspecified()
        && !ip.is_multicast()
        && !ip.is_broadcast()
}

/// Construye un `AndroidDeviceNode` de respaldo desde TXT (`id`, `fp`, `name`) si falla `/api/v1/health`.
pub fn build_fallback_node_from_mdns_txt(
    ip_str: String,
    port: u16,
    meta: MdnsTxtMetadata,
) -> Option<AndroidDeviceNode> {
    let device_id = meta.device_id?;
    let fingerprint = meta.fingerprint_sha256?;
    let device_name = meta
        .device_name
        .unwrap_or_else(|| format!("AkatsukiNode ({})", ip_str));

    Some(AndroidDeviceNode {
        device_id,
        device_name,
        model: "Android mDNS Node".to_string(),
        ip_address: ip_str,
        port,
        tls_cert_fingerprint_sha256: fingerprint,
        discovered_via: "mdns".to_string(),
        paired: false,
    })
}

/// Deduplica nodos por `device_id` y los ordena de forma determinista por IP y puerto.
pub fn deduplicate_and_sort_nodes(nodes: Vec<AndroidDeviceNode>) -> Vec<AndroidDeviceNode> {
    let mut by_device_id: BTreeMap<String, AndroidDeviceNode> = BTreeMap::new();
    for node in nodes {
        by_device_id.entry(node.device_id.clone()).or_insert(node);
    }

    let mut unique: Vec<AndroidDeviceNode> = by_device_id.into_values().collect();
    unique.sort_by(|a, b| {
        a.ip_address
            .cmp(&b.ip_address)
            .then_with(|| a.port.cmp(&b.port))
    });
    unique
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_virtual_interfaces_correctly() {
        assert!(is_virtual_interface("docker0"));
        assert!(is_virtual_interface("veth1a2b3c"));
        assert!(is_virtual_interface("virbr0"));
        assert!(is_virtual_interface("wg0"));
        assert!(is_virtual_interface("tailscale0"));
        assert!(!is_virtual_interface("wlp2s0"));
        assert!(!is_virtual_interface("enp3s0"));
        assert!(!is_virtual_interface("Wi-Fi"));
    }

    #[test]
    fn builds_fallback_node_when_mdns_txt_has_id_and_fp() {
        let node = build_fallback_node_from_mdns_txt(
            "192.168.1.44".to_string(),
            8443,
            MdnsTxtMetadata {
                device_id: Some("ak-node-01".to_string()),
                fingerprint_sha256: Some("AA:BB:CC".to_string()),
                device_name: Some("Pixel 9 Pro".to_string()),
            },
        )
        .expect("should build fallback node");

        assert_eq!(node.device_id, "ak-node-01");
        assert_eq!(node.device_name, "Pixel 9 Pro");
        assert_eq!(node.ip_address, "192.168.1.44");
        assert_eq!(node.port, 8443);
        assert_eq!(node.tls_cert_fingerprint_sha256, "AA:BB:CC");
        assert_eq!(node.discovered_via, "mdns");
        assert!(!node.paired);

        let unnamed = build_fallback_node_from_mdns_txt(
            "192.168.1.45".to_string(),
            9443,
            MdnsTxtMetadata {
                device_id: Some("ak-node-02".to_string()),
                fingerprint_sha256: Some("DD:EE:FF".to_string()),
                device_name: None,
            },
        )
        .expect("should fall back to default name");
        assert_eq!(unnamed.device_name, "AkatsukiNode (192.168.1.45)");

        let missing_fp = build_fallback_node_from_mdns_txt(
            "192.168.1.46".to_string(),
            8443,
            MdnsTxtMetadata {
                device_id: Some("ak-node-03".to_string()),
                fingerprint_sha256: None,
                device_name: None,
            },
        );
        assert!(missing_fp.is_none());
    }

    #[test]
    fn deduplicates_by_device_id_and_sorts_by_ip_and_port() {
        let node = |id: &str, ip: &str, port: u16| AndroidDeviceNode {
            device_id: id.to_string(),
            device_name: id.to_string(),
            model: "Pixel".to_string(),
            ip_address: ip.to_string(),
            port,
            tls_cert_fingerprint_sha256: "FP".to_string(),
            discovered_via: "mdns".to_string(),
            paired: false,
        };

        let result = deduplicate_and_sort_nodes(vec![
            node("id-b", "192.168.1.20", 9000),
            node("id-a", "192.168.1.10", 9443),
            node("id-a", "192.168.1.99", 8443),
            node("id-c", "192.168.1.10", 8443),
        ]);

        assert_eq!(result.len(), 3);
        assert_eq!(result[0].device_id, "id-c");
        assert_eq!(result[1].device_id, "id-a");
        assert_eq!(result[1].ip_address, "192.168.1.10");
        assert_eq!(result[2].device_id, "id-b");
    }
}
