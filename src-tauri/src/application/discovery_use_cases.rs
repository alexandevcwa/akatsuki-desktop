use crate::domain::device::AndroidDeviceNode;
use crate::domain::discovery::{
    build_fallback_node_from_mdns_txt, deduplicate_and_sort_nodes, LocalSubnetInfo,
    MdnsDiscoveryGateway, MdnsEndpointEntry, NetworkInterfaceProvider, NodeHealthGateway,
    AKATSUKI_MDNS_SERVICE_TYPE,
};
use std::collections::BTreeMap;
use std::net::Ipv4Addr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::task::JoinSet;

/// Ventana de escucha mDNS por ciclo de descubrimiento (tolerante a latencia PTR -> SRV -> A).
const MDNS_BROWSE_WINDOW: Duration = Duration::from_millis(2200);

/// Tiempo de espera RFC 6762 §10.4 para verificar si una entrada en caché sigue viva tras un fallo.
const MDNS_VERIFY_STALE_TIMEOUT: Duration = Duration::from_secs(3);

/// Servicio de aplicación que orquesta el descubrimiento mDNS y la validación de nodos Android.
pub struct DiscoveryService {
    interfaces: Arc<dyn NetworkInterfaceProvider>,
    mdns: Arc<dyn MdnsDiscoveryGateway>,
    health: Arc<dyn NodeHealthGateway>,
}

impl DiscoveryService {
    /// Crea una nueva instancia del caso de uso inyectando sus puertos de salida.
    pub fn new(
        interfaces: Arc<dyn NetworkInterfaceProvider>,
        mdns: Arc<dyn MdnsDiscoveryGateway>,
        health: Arc<dyn NodeHealthGateway>,
    ) -> Self {
        Self {
            interfaces,
            mdns,
            health,
        }
    }

    /// Devuelve la lista de subredes IPv4 locales activas detectadas en el equipo.
    pub fn list_local_subnets(&self) -> Vec<LocalSubnetInfo> {
        self.interfaces
            .active_subnets()
            .into_iter()
            .map(|subnet| subnet.to_info())
            .collect()
    }

    /// Descubre y valida nodos Android activos en la red local mediante mDNS/DNS-SD.
    pub async fn discover_android_nodes(&self) -> Vec<AndroidDeviceNode> {
        let started_at = Instant::now();
        let subnets = self.interfaces.active_subnets();

        eprintln!(
            "[INFO][NetworkDiscovery] Iniciando descubrimiento mDNS ({}): {} interfaz(ces) activa(s)",
            AKATSUKI_MDNS_SERVICE_TYPE,
            subnets.len()
        );

        if subnets.is_empty() {
            eprintln!(
                "[WARN][NetworkDiscovery] No se detectaron interfaces IPv4 LAN activas; escuchando mDNS en interfaces por defecto"
            );
        }

        let entries = self.mdns.browse_endpoints(&subnets, MDNS_BROWSE_WINDOW).await;
        if entries.is_empty() {
            eprintln!(
                "[INFO][NetworkDiscovery] Descubrimiento mDNS finalizado en {:?}: 0 servicios resueltos",
                started_at.elapsed()
            );
            return Vec::new();
        }

        let candidate_count = entries.len();
        let nodes = self.verify_endpoints(entries).await;

        eprintln!(
            "[INFO][NetworkDiscovery] Descubrimiento mDNS finalizado en {:?}: {} candidato(s) resueltos, {} nodo(s) Akatsuki verificados",
            started_at.elapsed(),
            candidate_count,
            nodes.len()
        );

        nodes
    }

    async fn verify_endpoints(&self, entries: Vec<MdnsEndpointEntry>) -> Vec<AndroidDeviceNode> {
        let mut unique_endpoints: BTreeMap<(Ipv4Addr, u16), MdnsEndpointEntry> = BTreeMap::new();
        for entry in entries {
            unique_endpoints.insert((entry.ip, entry.port), entry);
        }

        let mut set = JoinSet::new();
        for ((ip, port), entry) in unique_endpoints {
            let health_gw = Arc::clone(&self.health);
            let mdns_gw = Arc::clone(&self.mdns);
            set.spawn(async move {
                verify_single_endpoint(ip, port, entry, health_gw.as_ref(), mdns_gw.as_ref()).await
            });
        }

        let mut verified = Vec::new();
        while let Some(res) = set.join_next().await {
            if let Ok(Some(node)) = res {
                verified.push(node);
            }
        }

        deduplicate_and_sort_nodes(verified)
    }
}

async fn verify_single_endpoint(
    ip: Ipv4Addr,
    port: u16,
    entry: MdnsEndpointEntry,
    health: &dyn NodeHealthGateway,
    mdns: &dyn MdnsDiscoveryGateway,
) -> Option<AndroidDeviceNode> {
    let ip_str = ip.to_string();
    match health.check_health(&ip_str, port).await {
        Ok(resp) if resp.status.eq_ignore_ascii_case("online") => Some(AndroidDeviceNode {
            device_id: resp.device_id,
            device_name: resp.device_name,
            model: resp.model,
            ip_address: ip_str,
            port: resp.port,
            tls_cert_fingerprint_sha256: resp.tls_cert_fingerprint_sha256,
            discovered_via: "mdns".to_string(),
            paired: false,
        }),
        Ok(resp) => {
            eprintln!(
                "[WARN][NetworkDiscovery] Nodo {}:{} respondió estado no operativo: '{}'",
                ip_str, port, resp.status
            );
            None
        }
        Err(err) => {
            eprintln!(
                "[WARN][NetworkDiscovery] Fallo verificando GET /api/v1/health en {}:{} (vía mdns): {:?}",
                ip_str, port, err
            );
            // Solicitamos reconfirmación mDNS (RFC 6762 §10.4) para purgar instancias obsoletas
            // si la app Android cerró sin enviar paquete Goodbye.
            mdns.verify_stale_entry(&entry.fullname, MDNS_VERIFY_STALE_TIMEOUT);

            if let Some(node) = build_fallback_node_from_mdns_txt(ip_str.clone(), port, entry.meta)
            {
                eprintln!(
                    "[INFO][NetworkDiscovery] Usando metadatos TXT mDNS de respaldo para {}:{} (id={})",
                    ip_str, port, node.device_id
                );
                return Some(node);
            }
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::device::HealthResponse;
    use crate::domain::discovery::{BoxFuture, LocalSubnet, MdnsTxtMetadata};
    use crate::error::{AkatsukiError, AkatsukiResult};
    use std::collections::HashMap;
    use std::sync::Mutex;

    struct StubNetworkProvider(Vec<LocalSubnet>);
    impl NetworkInterfaceProvider for StubNetworkProvider {
        fn active_subnets(&self) -> Vec<LocalSubnet> {
            self.0.clone()
        }
    }

    struct StubMdnsGateway {
        entries: Vec<MdnsEndpointEntry>,
        verified_stale: Mutex<Vec<String>>,
    }
    impl MdnsDiscoveryGateway for StubMdnsGateway {
        fn browse_endpoints<'a>(
            &'a self,
            _subnets: &'a [LocalSubnet],
            _window: Duration,
        ) -> BoxFuture<'a, Vec<MdnsEndpointEntry>> {
            let entries = self.entries.clone();
            Box::pin(async move { entries })
        }

        fn verify_stale_entry(&self, fullname: &str, _timeout: Duration) {
            self.verified_stale
                .lock()
                .unwrap()
                .push(fullname.to_string());
        }
    }

    struct StubHealthGateway {
        responses: HashMap<(String, u16), Result<HealthResponse, String>>,
    }
    impl NodeHealthGateway for StubHealthGateway {
        fn check_health<'a>(
            &'a self,
            ip: &'a str,
            port: u16,
        ) -> BoxFuture<'a, AkatsukiResult<HealthResponse>> {
            let outcome = self.responses.get(&(ip.to_string(), port)).cloned();
            Box::pin(async move {
                match outcome {
                    Some(Ok(resp)) => Ok(resp),
                    Some(Err(msg)) => Err(AkatsukiError::NetworkFriendly(msg)),
                    None => Err(AkatsukiError::NetworkFriendly("unreachable".to_string())),
                }
            })
        }
    }

    #[tokio::test]
    async fn discovers_online_nodes_ignores_offline_and_uses_txt_fallback_on_error() {
        let subnets = vec![LocalSubnet {
            interface_name: "wlan0".to_string(),
            local_ip: Ipv4Addr::new(192, 168, 1, 10),
            netmask: Ipv4Addr::new(255, 255, 255, 0),
            prefix_len: 24,
            network_u32: u32::from(Ipv4Addr::new(192, 168, 1, 0)),
        }];

        let entries = vec![
            MdnsEndpointEntry {
                ip: Ipv4Addr::new(192, 168, 1, 20),
                port: 9443,
                fullname: "Pixel._akatsuki._tcp.local.".to_string(),
                meta: MdnsTxtMetadata::default(),
            },
            MdnsEndpointEntry {
                ip: Ipv4Addr::new(192, 168, 1, 30),
                port: 8443,
                fullname: "Offline._akatsuki._tcp.local.".to_string(),
                meta: MdnsTxtMetadata::default(),
            },
            MdnsEndpointEntry {
                ip: Ipv4Addr::new(192, 168, 1, 40),
                port: 9001,
                fullname: "Fallback._akatsuki._tcp.local.".to_string(),
                meta: MdnsTxtMetadata {
                    device_id: Some("dev-fallback".to_string()),
                    fingerprint_sha256: Some("FF:EE:DD".to_string()),
                    device_name: Some("Galaxy S24".to_string()),
                },
            },
        ];

        let mut health_map = HashMap::new();
        health_map.insert(
            ("192.168.1.20".to_string(), 9443),
            Ok(HealthResponse {
                status: "online".to_string(),
                device_id: "dev-online".to_string(),
                device_name: "Pixel 9".to_string(),
                model: "Pixel 9".to_string(),
                port: 9443,
                tls_cert_fingerprint_sha256: "AA:BB:CC".to_string(),
            }),
        );
        health_map.insert(
            ("192.168.1.30".to_string(), 8443),
            Ok(HealthResponse {
                status: "paused".to_string(),
                device_id: "dev-offline".to_string(),
                device_name: "Paused".to_string(),
                model: "Phone".to_string(),
                port: 8443,
                tls_cert_fingerprint_sha256: "00:11".to_string(),
            }),
        );
        health_map.insert(
            ("192.168.1.40".to_string(), 9001),
            Err("timeout".to_string()),
        );

        let mdns_stub = Arc::new(StubMdnsGateway {
            entries,
            verified_stale: Mutex::new(Vec::new()),
        });
        let service = DiscoveryService::new(
            Arc::new(StubNetworkProvider(subnets)),
            mdns_stub.clone(),
            Arc::new(StubHealthGateway {
                responses: health_map,
            }),
        );

        assert_eq!(service.list_local_subnets()[0].cidr, "192.168.1.0/24");

        let nodes = service.discover_android_nodes().await;
        assert_eq!(nodes.len(), 2);
        assert_eq!(nodes[0].device_id, "dev-online");
        assert_eq!(nodes[0].port, 9443);
        assert_eq!(nodes[1].device_id, "dev-fallback");
        assert_eq!(nodes[1].device_name, "Galaxy S24");

        let stale = mdns_stub.verified_stale.lock().unwrap();
        assert_eq!(stale.as_slice(), &["Fallback._akatsuki._tcp.local."]);
    }
}
