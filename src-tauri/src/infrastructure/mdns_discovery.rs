use crate::domain::device::AndroidDeviceNode;
use crate::infrastructure::android_client::check_android_health;
use if_addrs::{get_if_addrs, IfAddr};
use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::Serialize;
use std::collections::{BTreeMap, HashSet};
use std::net::Ipv4Addr;
use std::sync::{Arc, Mutex as StdMutex, OnceLock};
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::sync::{Mutex as AsyncMutex, Semaphore};
use tokio::task::JoinSet;
use tokio::time::timeout;

/// Tipo de servicio mDNS / DNS-SD anunciado por los nodos Android en LAN.
const AKATSUKI_MDNS_SERVICE_TYPE: &str = "_akatsuki._tcp.local.";

/// Puerto de respaldo cuando no se indican puertos personalizados ni hay anuncio mDNS.
const DEFAULT_ANDROID_PORT: u16 = 8443;

/// Límite de conexiones TCP simultáneas para no agotar file descriptors del sistema operativo.
const MAX_CONCURRENT_TCP_PROBES: usize = 96;

/// Límite máximo de hosts por subred para sondeo TCP (subredes `/16` o `/8` se acotan al `/24` local).
const MAX_TCP_HOSTS_PER_SUBNET: u32 = 1024;

/// Tiempo de espera por sonda TCP individual en red local.
const TCP_PROBE_TIMEOUT: Duration = Duration::from_millis(350);

/// Ventana de escucha mDNS por ciclo de descubrimiento.
const MDNS_BROWSE_WINDOW: Duration = Duration::from_millis(1200);

/// Prefijos de interfaces virtuales o de contenedores que deben excluirse si hay LAN física.
const IGNORED_VIRTUAL_IFACE_PREFIXES: &[&str] = &[
    "docker", "veth", "br-", "virbr", "vmnet", "vboxnet", "lxc", "cni", "flannel", "podman",
    "tailscale", "tun", "tap",
];

/// Información resumida de una subred local activa para exponerla al frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSubnetInfo {
    pub interface_name: String,
    pub local_ip: String,
    pub netmask: String,
    pub prefix_len: u8,
    pub cidr: String,
}

#[derive(Debug, Clone)]
struct LocalSubnet {
    interface_name: String,
    local_ip: Ipv4Addr,
    netmask: Ipv4Addr,
    prefix_len: u8,
    network_u32: u32,
    hosts: Vec<Ipv4Addr>,
}

/// Determina si una interfaz de red corresponde a un adaptador virtual/túnel secundario.
fn is_virtual_interface(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    IGNORED_VIRTUAL_IFACE_PREFIXES
        .iter()
        .any(|prefix| lower.starts_with(prefix))
}

/// Verifica que una IPv4 sea válida para escaneo en red local (excluye loopback, link-local, etc.).
fn is_scannable_ipv4(ip: Ipv4Addr) -> bool {
    !ip.is_loopback()
        && !ip.is_link_local()
        && !ip.is_unspecified()
        && !ip.is_multicast()
        && !ip.is_broadcast()
}

/// Calcula el prefijo CIDR y la lista de IPs de host válidas dentro de una subred IPv4.
/// Si la subred supera `MAX_TCP_HOSTS_PER_SUBNET`, acota el rango al `/24` inmediato de `local_ip`.
fn compute_subnet_hosts(
    local_ip: Ipv4Addr,
    netmask: Ipv4Addr,
    own_ips: &HashSet<Ipv4Addr>,
) -> (u8, u32, Vec<Ipv4Addr>) {
    let ip_u32 = u32::from(local_ip);
    let mask_u32 = u32::from(netmask);
    let prefix_len = mask_u32.count_ones() as u8;
    let network_u32 = ip_u32 & mask_u32;
    let broadcast_u32 = network_u32 | !mask_u32;

    if broadcast_u32 <= network_u32.saturating_add(1) {
        return (prefix_len, network_u32, Vec::new());
    }

    let first_usable = network_u32 + 1;
    let last_usable = broadcast_u32 - 1;
    let total_hosts = last_usable - first_usable + 1;

    let (scan_start, scan_end) = if total_hosts > MAX_TCP_HOSTS_PER_SUBNET {
        let local_slash24_net = ip_u32 & 0xFFFF_FF00;
        let bounded_start = (local_slash24_net + 1).max(first_usable);
        let bounded_end = (local_slash24_net + 254).min(last_usable);
        eprintln!(
            "[WARN][NetworkDiscovery] Subred {}/{} tiene {} hosts; acotando sondeo TCP al bloque local {}/24 ({}..{})",
            Ipv4Addr::from(network_u32),
            prefix_len,
            total_hosts,
            Ipv4Addr::from(local_slash24_net),
            Ipv4Addr::from(bounded_start),
            Ipv4Addr::from(bounded_end)
        );
        (bounded_start, bounded_end)
    } else {
        (first_usable, last_usable)
    };

    let hosts = (scan_start..=scan_end)
        .map(Ipv4Addr::from)
        .filter(|candidate| !own_ips.contains(candidate))
        .collect();

    (prefix_len, network_u32, hosts)
}

/// Enumera todas las subredes IPv4 activas de la PC usando las interfaces reales del SO.
fn detect_active_subnets() -> Vec<LocalSubnet> {
    let interfaces = match get_if_addrs() {
        Ok(list) => list,
        Err(err) => {
            eprintln!(
                "[ERROR][NetworkDiscovery] No se pudieron enumerar las interfaces de red del sistema: {:?}",
                err
            );
            return Vec::new();
        }
    };

    let mut ipv4_candidates: Vec<(String, Ipv4Addr, Ipv4Addr, bool)> = Vec::new();
    let mut own_ips = HashSet::new();

    for iface in interfaces {
        if iface.is_loopback() {
            continue;
        }
        let IfAddr::V4(v4) = iface.addr else {
            continue;
        };
        if !is_scannable_ipv4(v4.ip) {
            continue;
        }
        own_ips.insert(v4.ip);
        let virtual_iface = is_virtual_interface(&iface.name);
        ipv4_candidates.push((iface.name, v4.ip, v4.netmask, virtual_iface));
    }

    // Preferimos interfaces físicas/LAN cuando existan; solo usamos virtuales si no hay otra opción.
    let has_physical = ipv4_candidates.iter().any(|(_, _, _, is_virt)| !is_virt);
    if has_physical {
        ipv4_candidates.retain(|(name, ip, _, is_virt)| {
            if *is_virt {
                eprintln!(
                    "[INFO][NetworkDiscovery] Omitiendo interfaz virtual secundaria {} ({})",
                    name, ip
                );
                false
            } else {
                true
            }
        });
    }

    // Priorizar redes privadas LAN (RFC 1918) sobre direcciones públicas directas.
    ipv4_candidates.sort_by_key(|(_, ip, _, _)| (!ip.is_private(), *ip));

    let mut seen_networks: HashSet<(u32, u32)> = HashSet::new();
    let mut subnets = Vec::new();

    for (interface_name, local_ip, netmask, _) in ipv4_candidates {
        let mask_u32 = u32::from(netmask);
        let network_u32 = u32::from(local_ip) & mask_u32;

        if !seen_networks.insert((network_u32, mask_u32)) {
            continue;
        }

        let (prefix_len, _, hosts) = compute_subnet_hosts(local_ip, netmask, &own_ips);
        if hosts.is_empty() {
            continue;
        }

        eprintln!(
            "[INFO][NetworkDiscovery] Subred detectada en {}: IP local = {}, máscara = {} (/{}), {} hosts a sondear",
            interface_name,
            local_ip,
            netmask,
            prefix_len,
            hosts.len()
        );

        subnets.push(LocalSubnet {
            interface_name,
            local_ip,
            netmask,
            prefix_len,
            network_u32,
            hosts,
        });
    }

    subnets
}

/// Devuelve información de las subredes activas detectadas en la PC para la interfaz de usuario.
pub fn list_local_network_subnets() -> Vec<LocalSubnetInfo> {
    detect_active_subnets()
        .into_iter()
        .map(|s| LocalSubnetInfo {
            interface_name: s.interface_name,
            local_ip: s.local_ip.to_string(),
            netmask: s.netmask.to_string(),
            prefix_len: s.prefix_len,
            cidr: format!("{}/{}", Ipv4Addr::from(s.network_u32), s.prefix_len),
        })
        .collect()
}

/// Normaliza la lista de puertos candidatos conservando el orden de prioridad y evitando duplicados.
fn normalize_candidate_ports(requested_ports: Option<&[u16]>) -> Vec<u16> {
    let mut seen = HashSet::new();
    let mut ports = Vec::new();

    if let Some(list) = requested_ports {
        for &port in list {
            if port > 0 && seen.insert(port) {
                ports.push(port);
            }
        }
    }

    if seen.insert(DEFAULT_ANDROID_PORT) {
        ports.push(DEFAULT_ANDROID_PORT);
    }

    ports
}

static MDNS_DAEMON_STORE: OnceLock<StdMutex<Option<ServiceDaemon>>> = OnceLock::new();
static MDNS_BROWSE_LOCK: OnceLock<AsyncMutex<()>> = OnceLock::new();

/// Obtiene el daemon mDNS singleton o lo inicializa si aún no existe.
fn get_or_init_mdns_daemon() -> Option<ServiceDaemon> {
    let store = MDNS_DAEMON_STORE.get_or_init(|| StdMutex::new(None));
    let mut guard = store.lock().ok()?;

    if let Some(ref daemon) = *guard {
        return Some(daemon.clone());
    }

    match ServiceDaemon::new() {
        Ok(daemon) => {
            eprintln!(
                "[INFO][NetworkDiscovery] Daemon mDNS persistente inicializado ({})",
                AKATSUKI_MDNS_SERVICE_TYPE
            );
            *guard = Some(daemon.clone());
            Some(daemon)
        }
        Err(err) => {
            eprintln!(
                "[WARN][NetworkDiscovery] No se pudo iniciar el daemon mDNS (se usará sondeo TCP): {:?}",
                err
            );
            None
        }
    }
}

/// Limpia la referencia del daemon mDNS almacenado si el hilo interno se cerró inesperadamente.
fn reset_mdns_daemon() {
    if let Some(store) = MDNS_DAEMON_STORE.get() {
        if let Ok(mut guard) = store.lock() {
            if let Some(daemon) = guard.take() {
                let _ = daemon.shutdown();
            }
        }
    }
}

/// Descubre nodos Android anunciados mediante mDNS / DNS-SD reutilizando un daemon persistente.
async fn discover_via_mdns(window: Duration) -> Vec<(Ipv4Addr, u16)> {
    let browse_lock = MDNS_BROWSE_LOCK.get_or_init(|| AsyncMutex::new(()));
    let _browse_guard = browse_lock.lock().await;

    let Some(mut mdns) = get_or_init_mdns_daemon() else {
        return Vec::new();
    };

    let receiver = match mdns.browse(AKATSUKI_MDNS_SERVICE_TYPE) {
        Ok(rx) => rx,
        Err(mdns_sd::Error::DaemonShutdown) => {
            eprintln!(
                "[WARN][NetworkDiscovery] Daemon mDNS se detuvo; reiniciando instancia persistente"
            );
            reset_mdns_daemon();
            let Some(fresh) = get_or_init_mdns_daemon() else {
                return Vec::new();
            };
            mdns = fresh;
            match mdns.browse(AKATSUKI_MDNS_SERVICE_TYPE) {
                Ok(rx) => rx,
                Err(err) => {
                    eprintln!(
                        "[WARN][NetworkDiscovery] Fallo al re-suscribir a mDNS {}: {:?}",
                        AKATSUKI_MDNS_SERVICE_TYPE, err
                    );
                    return Vec::new();
                }
            }
        }
        Err(err) => {
            eprintln!(
                "[WARN][NetworkDiscovery] No se pudo suscribir a mDNS {}: {:?}",
                AKATSUKI_MDNS_SERVICE_TYPE, err
            );
            return Vec::new();
        }
    };

    let mut discovered = HashSet::new();
    let deadline = Instant::now() + window;

    while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
        match timeout(remaining, receiver.recv_async()).await {
            Ok(Ok(ServiceEvent::ServiceResolved(info))) => {
                let port = info.get_port();
                if port == 0 {
                    continue;
                }
                for ipv4 in info.get_addresses_v4() {
                    if is_scannable_ipv4(ipv4) {
                        eprintln!(
                            "[INFO][NetworkDiscovery] Servicio mDNS resuelto ({}): {}:{}",
                            info.get_fullname(),
                            ipv4,
                            port
                        );
                        discovered.insert((ipv4, port));
                    }
                }
            }
            Ok(Ok(_)) => {}
            Ok(Err(_)) | Err(_) => break,
        }
    }

    // Detenemos la suscripción activa, pero mantenemos el daemon y su caché vivos para rondas futuras.
    let _ = mdns.stop_browse(AKATSUKI_MDNS_SERVICE_TYPE);

    discovered.into_iter().collect()
}

/// Realiza un sondeo TCP concurrente y acotado por semáforo sobre las subredes y puertos dados.
async fn scan_subnets_tcp(subnets: &[LocalSubnet], ports: &[u16]) -> Vec<(Ipv4Addr, u16)> {
    if subnets.is_empty() || ports.is_empty() {
        return Vec::new();
    }

    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_TCP_PROBES));
    let mut set = JoinSet::new();

    for subnet in subnets {
        for &ip in &subnet.hosts {
            for &port in ports {
                let permit_sem = Arc::clone(&semaphore);
                set.spawn(async move {
                    let Ok(_permit) = permit_sem.acquire_owned().await else {
                        return None;
                    };
                    let tcp_ok = timeout(TCP_PROBE_TIMEOUT, TcpStream::connect((ip, port)))
                        .await
                        .map(|res| res.is_ok())
                        .unwrap_or(false);
                    tcp_ok.then_some((ip, port))
                });
            }
        }
    }

    let mut open_endpoints = Vec::new();
    while let Some(res) = set.join_next().await {
        if let Ok(Some(endpoint)) = res {
            open_endpoints.push(endpoint);
        }
    }

    open_endpoints
}

/// Consulta `GET /api/v1/health` en paralelo para validar cada endpoint `(ip, port)` descubierto.
async fn verify_discovered_endpoints(
    endpoints: BTreeMap<(Ipv4Addr, u16), &'static str>,
) -> Vec<AndroidDeviceNode> {
    let mut set = JoinSet::new();

    for ((ip, port), via) in endpoints {
        set.spawn(async move {
            let ip_str = ip.to_string();
            match check_android_health(&ip_str, port).await {
                Ok(health) if health.status.eq_ignore_ascii_case("online") => {
                    Some(AndroidDeviceNode {
                        device_id: health.device_id,
                        device_name: health.device_name,
                        model: health.model,
                        ip_address: ip_str,
                        port: health.port,
                        tls_cert_fingerprint_sha256: health.tls_cert_fingerprint_sha256,
                        discovered_via: via.to_string(),
                        paired: false,
                    })
                }
                Ok(health) => {
                    eprintln!(
                        "[WARN][NetworkDiscovery] Nodo {}:{} respondió estado no operativo: '{}'",
                        ip_str, port, health.status
                    );
                    None
                }
                Err(_) => None,
            }
        });
    }

    let mut by_device_id: BTreeMap<String, AndroidDeviceNode> = BTreeMap::new();
    while let Some(res) = set.join_next().await {
        if let Ok(Some(node)) = res {
            // Si un dispositivo multi-interfaz responde en dos IPs, conservamos preferentemente mDNS o primera respuesta.
            by_device_id
                .entry(node.device_id.clone())
                .and_modify(|existing| {
                    if existing.discovered_via != "mdns" && node.discovered_via == "mdns" {
                        *existing = node.clone();
                    }
                })
                .or_insert(node);
        }
    }

    let mut discovered: Vec<AndroidDeviceNode> = by_device_id.into_values().collect();
    discovered.sort_by(|a, b| {
        a.ip_address
            .cmp(&b.ip_address)
            .then_with(|| a.port.cmp(&b.port))
    });
    discovered
}

/// Descubre dispositivos Android activos combinando mDNS (cualquier puerto) y sondeo TCP
/// multi-subred sobre los segmentos de red reales conectados en la PC.
pub async fn discover_android_nodes_on_lan(
    requested_ports: Option<Vec<u16>>,
) -> Vec<AndroidDeviceNode> {
    let started_at = Instant::now();
    let subnets = detect_active_subnets();
    let candidate_ports = normalize_candidate_ports(requested_ports.as_deref());

    eprintln!(
        "[INFO][NetworkDiscovery] Iniciando descubrimiento LAN: {} subred(es) activa(s), puertos candidatos TCP = {:?}, mDNS = {}",
        subnets.len(),
        candidate_ports,
        AKATSUKI_MDNS_SERVICE_TYPE
    );

    if subnets.is_empty() {
        eprintln!(
            "[WARN][NetworkDiscovery] No se detectaron interfaces IPv4 LAN activas; intentando solo vía mDNS"
        );
    }

    let (mdns_endpoints, tcp_endpoints) = tokio::join!(
        discover_via_mdns(MDNS_BROWSE_WINDOW),
        scan_subnets_tcp(&subnets, &candidate_ports)
    );

    let mut combined: BTreeMap<(Ipv4Addr, u16), &'static str> = BTreeMap::new();
    for endpoint in tcp_endpoints {
        combined.insert(endpoint, "lan-scan");
    }
    for endpoint in mdns_endpoints {
        combined.insert(endpoint, "mdns");
    }

    if combined.is_empty() {
        eprintln!(
            "[INFO][NetworkDiscovery] Descubrimiento finalizado en {:?}: 0 endpoints abiertos encontrados",
            started_at.elapsed()
        );
        return Vec::new();
    }

    let candidate_count = combined.len();
    let nodes = verify_discovered_endpoints(combined).await;

    eprintln!(
        "[INFO][NetworkDiscovery] Descubrimiento finalizado en {:?}: {} candidato(s) sondeados, {} nodo(s) Akatsuki verificados",
        started_at.elapsed(),
        candidate_count,
        nodes.len()
    );

    nodes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_hosts_for_arbitrary_slash_24_subnet() {
        let local_ip = Ipv4Addr::new(10, 42, 0, 15);
        let netmask = Ipv4Addr::new(255, 255, 255, 0);
        let mut own = HashSet::new();
        own.insert(local_ip);

        let (prefix, network, hosts) = compute_subnet_hosts(local_ip, netmask, &own);
        assert_eq!(prefix, 24);
        assert_eq!(Ipv4Addr::from(network), Ipv4Addr::new(10, 42, 0, 0));
        assert_eq!(hosts.len(), 253);
        assert!(!hosts.contains(&local_ip));
        assert!(hosts.contains(&Ipv4Addr::new(10, 42, 0, 1)));
        assert!(hosts.contains(&Ipv4Addr::new(10, 42, 0, 254)));
    }

    #[test]
    fn bounds_large_slash_16_subnet_to_local_slash_24_window() {
        let local_ip = Ipv4Addr::new(172, 20, 10, 5);
        let netmask = Ipv4Addr::new(255, 255, 0, 0);
        let mut own = HashSet::new();
        own.insert(local_ip);

        let (prefix, network, hosts) = compute_subnet_hosts(local_ip, netmask, &own);
        assert_eq!(prefix, 16);
        assert_eq!(Ipv4Addr::from(network), Ipv4Addr::new(172, 20, 0, 0));
        assert_eq!(hosts.len(), 253);
        assert!(hosts.contains(&Ipv4Addr::new(172, 20, 10, 1)));
        assert!(!hosts.contains(&Ipv4Addr::new(172, 20, 11, 1)));
    }

    #[test]
    fn computes_hosts_for_slash_26_subnet() {
        let local_ip = Ipv4Addr::new(192, 168, 50, 70);
        let netmask = Ipv4Addr::new(255, 255, 255, 192);
        let mut own = HashSet::new();
        own.insert(local_ip);

        let (prefix, network, hosts) = compute_subnet_hosts(local_ip, netmask, &own);
        assert_eq!(prefix, 26);
        assert_eq!(Ipv4Addr::from(network), Ipv4Addr::new(192, 168, 50, 64));
        assert_eq!(hosts.len(), 61); // 62 usable hosts minus local_ip
        assert!(hosts.contains(&Ipv4Addr::new(192, 168, 50, 65)));
        assert!(hosts.contains(&Ipv4Addr::new(192, 168, 50, 126)));
        assert!(!hosts.contains(&Ipv4Addr::new(192, 168, 50, 127)));
    }

    #[test]
    fn normalizes_candidate_ports_without_duplicates() {
        let ports = normalize_candidate_ports(Some(&[9000, 0, 8443, 9000, 5001]));
        assert_eq!(ports, vec![9000, 8443, 5001]);

        let default_only = normalize_candidate_ports(None);
        assert_eq!(default_only, vec![DEFAULT_ANDROID_PORT]);
    }

    #[test]
    fn filters_virtual_interfaces_correctly() {
        assert!(is_virtual_interface("docker0"));
        assert!(is_virtual_interface("veth1a2b3c"));
        assert!(is_virtual_interface("virbr0"));
        assert!(!is_virtual_interface("wlp2s0"));
        assert!(!is_virtual_interface("enp3s0"));
        assert!(!is_virtual_interface("Wi-Fi"));
    }
}
