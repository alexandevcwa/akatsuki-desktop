use crate::domain::device::AndroidDeviceNode;
use crate::infrastructure::android_client::check_android_health;
use if_addrs::{get_if_addrs, IfAddr};
use mdns_sd::{
    IfKind, IfPredicate, Receiver as MdnsReceiver, ResolvedService, ServiceDaemon, ServiceEvent,
    TryRecvError,
};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::net::{IpAddr, Ipv4Addr};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex as AsyncMutex;
use tokio::task::JoinSet;
use tokio::time::timeout;

/// Tipo de servicio mDNS / DNS-SD anunciado por los nodos Android en LAN.
const AKATSUKI_MDNS_SERVICE_TYPE: &str = "_akatsuki._tcp.local.";

/// Ventana de escucha mDNS por ciclo de descubrimiento (tolerante a latencia PTR -> SRV -> A en Wi-Fi/Android).
const MDNS_BROWSE_WINDOW: Duration = Duration::from_millis(2200);

/// Intervalo mínimo tras el cual se reinicia el backoff exponencial de `browse` si no hay servicios resueltos.
const MDNS_BROWSE_REFRESH_INTERVAL: Duration = Duration::from_secs(15);

/// Tiempo de espera RFC 6762 §10.4 para verificar si una entrada mDNS en caché sigue viva tras un fallo de health.
const MDNS_VERIFY_STALE_TIMEOUT: Duration = Duration::from_secs(3);

/// Prefijos de interfaces virtuales o de contenedores que deben excluirse si hay LAN física.
const IGNORED_VIRTUAL_IFACE_PREFIXES: &[&str] = &[
    "docker", "veth", "br-", "virbr", "vmnet", "vboxnet", "lxc", "cni", "flannel", "podman",
    "tailscale", "tun", "tap", "wg",
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
}

/// Metadatos extraídos de los registros TXT del anuncio mDNS de Android (`fp`, `id`, `name`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct MdnsTxtMetadata {
    device_id: Option<String>,
    fingerprint_sha256: Option<String>,
    device_name: Option<String>,
}

#[derive(Debug, Clone)]
struct MdnsEndpointEntry {
    ip: Ipv4Addr,
    port: u16,
    fullname: String,
    meta: MdnsTxtMetadata,
}

/// Determina si una interfaz de red corresponde a un adaptador virtual/túnel secundario.
fn is_virtual_interface(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    IGNORED_VIRTUAL_IFACE_PREFIXES
        .iter()
        .any(|prefix| lower.starts_with(prefix))
}

/// Verifica que una IPv4 sea válida para descubrimiento en red local (excluye loopback, link-local, etc.).
fn is_scannable_ipv4(ip: Ipv4Addr) -> bool {
    !ip.is_loopback()
        && !ip.is_link_local()
        && !ip.is_unspecified()
        && !ip.is_multicast()
        && !ip.is_broadcast()
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
        let prefix_len = mask_u32.count_ones() as u8;

        if !seen_networks.insert((network_u32, mask_u32)) {
            continue;
        }

        eprintln!(
            "[INFO][NetworkDiscovery] Interfaz activa en {}: IP local = {}, máscara = {} (/{})",
            interface_name, local_ip, netmask, prefix_len
        );

        subnets.push(LocalSubnet {
            interface_name,
            local_ip,
            netmask,
            prefix_len,
            network_u32,
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

struct PersistentMdnsBrowser {
    daemon: ServiceDaemon,
    receiver: MdnsReceiver<ServiceEvent>,
    /// Mapa `fullname` -> entradas IPv4 resueltas para mantener vivos los anuncios entre rondas.
    resolved_by_fullname: HashMap<String, Vec<MdnsEndpointEntry>>,
    /// IPs virtuales habilitadas temporalmente cuando no hay interfaces físicas disponibles.
    enabled_fallback_ips: HashSet<Ipv4Addr>,
    /// Marca temporal del último `daemon.browse()` para reiniciar el backoff tras inactividad.
    last_browse_refresh: Instant,
}

static MDNS_BROWSER_STORE: OnceLock<AsyncMutex<Option<PersistentMdnsBrowser>>> = OnceLock::new();

/// Sincroniza solo las interfaces de respaldo virtuales para evitar crecer `if_selections` en `mdns-sd`.
fn sync_fallback_daemon_interfaces(browser: &mut PersistentMdnsBrowser, subnets: &[LocalSubnet]) {
    let desired_fallback_ips: HashSet<Ipv4Addr> = subnets
        .iter()
        .filter(|s| is_virtual_interface(&s.interface_name))
        .map(|s| s.local_ip)
        .collect();

    for &old_ip in browser
        .enabled_fallback_ips
        .difference(&desired_fallback_ips)
    {
        let _ = browser.daemon.disable_interface(IpAddr::V4(old_ip));
    }

    for &new_ip in desired_fallback_ips.difference(&browser.enabled_fallback_ips) {
        let _ = browser.daemon.enable_interface(IpAddr::V4(new_ip));
    }

    browser.enabled_fallback_ips = desired_fallback_ips;
}

/// Inicializa el navegador mDNS persistente conservando vivo su `Receiver<ServiceEvent>`.
fn init_persistent_mdns_browser(subnets: &[LocalSubnet]) -> Option<PersistentMdnsBrowser> {
    let daemon = match ServiceDaemon::new() {
        Ok(d) => d,
        Err(err) => {
            eprintln!(
                "[WARN][NetworkDiscovery] No se pudo iniciar el daemon mDNS: {:?}",
                err
            );
            return None;
        }
    };

    let _ = daemon.accept_unsolicited(true);
    let _ = daemon.disable_interface(IfKind::IPv6);
    let _ = daemon.disable_interface(IfKind::Predicate(IfPredicate::new(|intf| {
        is_virtual_interface(&intf.name)
    })));

    let receiver = match daemon.browse(AKATSUKI_MDNS_SERVICE_TYPE) {
        Ok(rx) => rx,
        Err(err) => {
            eprintln!(
                "[WARN][NetworkDiscovery] Fallo al suscribir browse({}): {:?}",
                AKATSUKI_MDNS_SERVICE_TYPE, err
            );
            let _ = daemon.shutdown();
            return None;
        }
    };

    let mut browser = PersistentMdnsBrowser {
        daemon,
        receiver,
        resolved_by_fullname: HashMap::new(),
        enabled_fallback_ips: HashSet::new(),
        last_browse_refresh: Instant::now(),
    };
    sync_fallback_daemon_interfaces(&mut browser, subnets);

    eprintln!(
        "[INFO][NetworkDiscovery] Navegador mDNS persistente inicializado ({})",
        AKATSUKI_MDNS_SERVICE_TYPE
    );

    Some(browser)
}

fn clean_txt_prop(info: &ResolvedService, key: &str) -> Option<String> {
    info.get_property_val_str(key)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
}

fn extract_txt_metadata(info: &ResolvedService) -> MdnsTxtMetadata {
    MdnsTxtMetadata {
        device_id: clean_txt_prop(info, "id"),
        fingerprint_sha256: clean_txt_prop(info, "fp"),
        device_name: clean_txt_prop(info, "name"),
    }
}

/// Construye un `AndroidDeviceNode` de respaldo desde TXT (`id`, `fp`, `name`) si falla `/api/v1/health`.
fn build_fallback_node_from_mdns_txt(
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

fn process_mdns_event(
    event: ServiceEvent,
    resolved_by_fullname: &mut HashMap<String, Vec<MdnsEndpointEntry>>,
) {
    match event {
        ServiceEvent::SearchStarted(msg) => {
            eprintln!("[INFO][NetworkDiscovery] mDNS SearchStarted: {}", msg);
        }
        ServiceEvent::ServiceFound(ty, fullname) => {
            eprintln!(
                "[INFO][NetworkDiscovery] mDNS ServiceFound: {} ({}) — esperando resolución SRV/A...",
                fullname, ty
            );
        }
        ServiceEvent::ServiceResolved(info) => {
            let port = info.get_port();
            if port == 0 {
                eprintln!(
                    "[WARN][NetworkDiscovery] mDNS ServiceResolved con puerto 0 ignorado ({})",
                    info.get_fullname()
                );
                return;
            }

            let v4_addrs = info.get_addresses_v4();
            if v4_addrs.is_empty() {
                eprintln!(
                    "[WARN][NetworkDiscovery] Servicio mDNS {} resuelto sin IPv4 aún; direcciones={:?}",
                    info.get_fullname(),
                    info.get_addresses()
                );
                return;
            }

            let fullname = info.get_fullname().to_string();
            let meta = extract_txt_metadata(&info);
            let mut entries = Vec::new();

            for ipv4 in v4_addrs {
                if is_scannable_ipv4(ipv4) {
                    eprintln!(
                        "[INFO][NetworkDiscovery] Servicio mDNS resuelto ({}): {}:{} (id={:?}, fp={:?})",
                        fullname, ipv4, port, meta.device_id, meta.fingerprint_sha256
                    );
                    entries.push(MdnsEndpointEntry {
                        ip: ipv4,
                        port,
                        fullname: fullname.clone(),
                        meta: meta.clone(),
                    });
                } else {
                    eprintln!(
                        "[WARN][NetworkDiscovery] IP mDNS descartada por no ser válida en LAN: {}:{} ({})",
                        ipv4, port, fullname
                    );
                }
            }

            if !entries.is_empty() {
                resolved_by_fullname.insert(fullname, entries);
            }
        }
        ServiceEvent::ServiceRemoved(ty, fullname) => {
            eprintln!(
                "[INFO][NetworkDiscovery] mDNS ServiceRemoved: {} ({})",
                fullname, ty
            );
            resolved_by_fullname.remove(&fullname);
        }
        _ => {}
    }
}

/// Drena los eventos mDNS hasta `deadline`. Devuelve `false` si el canal se cerró inesperadamente.
async fn drain_mdns_events_until(
    browser: &mut PersistentMdnsBrowser,
    deadline: Instant,
) -> bool {
    loop {
        match browser.receiver.try_recv() {
            Ok(event) => process_mdns_event(event, &mut browser.resolved_by_fullname),
            Err(TryRecvError::Empty) => break,
            Err(TryRecvError::Disconnected) => {
                eprintln!("[WARN][NetworkDiscovery] Canal mDNS cerrado en buffer; se reiniciará");
                return false;
            }
        }
    }

    while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
        match timeout(remaining, browser.receiver.recv_async()).await {
            Ok(Ok(event)) => process_mdns_event(event, &mut browser.resolved_by_fullname),
            Ok(Err(err)) => {
                eprintln!(
                    "[WARN][NetworkDiscovery] Canal mDNS cerrado inesperadamente ({:?}); se reiniciará",
                    err
                );
                return false;
            }
            Err(_) => break,
        }
    }

    true
}

/// Descubre nodos Android anunciados mediante mDNS / DNS-SD manteniendo viva la suscripción y la caché.
async fn discover_via_mdns(
    subnets: &[LocalSubnet],
    window: Duration,
) -> (Vec<MdnsEndpointEntry>, Option<ServiceDaemon>) {
    let store = MDNS_BROWSER_STORE.get_or_init(|| AsyncMutex::new(None));
    let mut guard = store.lock().await;

    if guard.is_none() {
        *guard = init_persistent_mdns_browser(subnets);
    }

    let deadline = Instant::now() + window;
    let mut needs_reset = false;

    if let Some(browser) = guard.as_mut() {
        sync_fallback_daemon_interfaces(browser, subnets);

        // Si el navegador lleva tiempo inactivo sin nodos en caché, refrescamos la consulta PTR
        // para reiniciar el backoff exponencial interno de `mdns-sd`.
        if browser.resolved_by_fullname.is_empty()
            && browser.last_browse_refresh.elapsed() >= MDNS_BROWSE_REFRESH_INTERVAL
        {
            match browser.daemon.browse(AKATSUKI_MDNS_SERVICE_TYPE) {
                Ok(rx) => {
                    eprintln!(
                        "[INFO][NetworkDiscovery] Refrescando suscripción mDNS ({}) tras inactividad",
                        AKATSUKI_MDNS_SERVICE_TYPE
                    );
                    browser.receiver = rx;
                    browser.last_browse_refresh = Instant::now();
                }
                Err(err) => {
                    eprintln!(
                        "[WARN][NetworkDiscovery] Fallo al refrescar browse({}): {:?}; se reiniciará",
                        AKATSUKI_MDNS_SERVICE_TYPE, err
                    );
                    needs_reset = true;
                }
            }
        }

        if !needs_reset {
            needs_reset = !drain_mdns_events_until(browser, deadline).await;
        }
    }

    if needs_reset {
        if let Some(old) = guard.take() {
            let _ = old.daemon.shutdown();
        }
        *guard = init_persistent_mdns_browser(subnets);

        if let Some(fresh) = guard.as_mut() {
            if Instant::now() < deadline && !drain_mdns_events_until(fresh, deadline).await {
                if let Some(old) = guard.take() {
                    let _ = old.daemon.shutdown();
                }
                return (Vec::new(), None);
            }
        }
    }

    let Some(browser) = guard.as_ref() else {
        return (Vec::new(), None);
    };

    let entries = browser
        .resolved_by_fullname
        .values()
        .flatten()
        .cloned()
        .collect();
    (entries, Some(browser.daemon.clone()))
}

/// Consulta `GET /api/v1/health` en paralelo para validar cada endpoint mDNS `(ip, port)` descubierto,
/// utilizando los atributos TXT de mDNS como respaldo si la consulta HTTP falla.
async fn verify_mdns_endpoints(
    entries: Vec<MdnsEndpointEntry>,
    mdns_daemon: Option<ServiceDaemon>,
) -> Vec<AndroidDeviceNode> {
    let mut unique_endpoints: BTreeMap<(Ipv4Addr, u16), MdnsEndpointEntry> = BTreeMap::new();
    for entry in entries {
        unique_endpoints.insert((entry.ip, entry.port), entry);
    }

    let mut set = JoinSet::new();

    for ((ip, port), entry) in unique_endpoints {
        let daemon_handle = mdns_daemon.clone();
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
                        discovered_via: "mdns".to_string(),
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
                Err(err) => {
                    eprintln!(
                        "[WARN][NetworkDiscovery] Fallo verificando GET /api/v1/health en {}:{} (vía mdns): {:?}",
                        ip_str, port, err
                    );
                    // Solicitamos reconfirmación mDNS (RFC 6762 §10.4) para purgar instancias obsoletas
                    // si la app Android cerró sin enviar paquete Goodbye.
                    if let Some(daemon) = daemon_handle {
                        let _ = daemon.verify(entry.fullname, MDNS_VERIFY_STALE_TIMEOUT);
                    }

                    if let Some(node) =
                        build_fallback_node_from_mdns_txt(ip_str.clone(), port, entry.meta)
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
        });
    }

    let mut by_device_id: BTreeMap<String, AndroidDeviceNode> = BTreeMap::new();
    while let Some(res) = set.join_next().await {
        if let Ok(Some(node)) = res {
            by_device_id.entry(node.device_id.clone()).or_insert(node);
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

/// Descubre dispositivos Android activos en la red local exclusivamente mediante mDNS / DNS-SD.
pub async fn discover_android_nodes_on_lan() -> Vec<AndroidDeviceNode> {
    let started_at = Instant::now();
    let subnets = detect_active_subnets();

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

    let (mdns_endpoints, mdns_daemon) = discover_via_mdns(&subnets, MDNS_BROWSE_WINDOW).await;

    if mdns_endpoints.is_empty() {
        eprintln!(
            "[INFO][NetworkDiscovery] Descubrimiento mDNS finalizado en {:?}: 0 servicios resueltos",
            started_at.elapsed()
        );
        return Vec::new();
    }

    let candidate_count = mdns_endpoints.len();
    let nodes = verify_mdns_endpoints(mdns_endpoints, mdns_daemon).await;

    eprintln!(
        "[INFO][NetworkDiscovery] Descubrimiento mDNS finalizado en {:?}: {} candidato(s) resueltos, {} nodo(s) Akatsuki verificados",
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
    fn processes_mdns_resolved_and_removed_events_filtering_ipv6_and_loopback() {
        use mdns_sd::ServiceInfo;

        let mut cache: HashMap<String, Vec<MdnsEndpointEntry>> = HashMap::new();
        let fullname = "AkatsukiNode._akatsuki._tcp.local.";

        // Evento solo IPv6 debe ignorarse sin registrar entrada
        let v6_only = ServiceInfo::new(
            AKATSUKI_MDNS_SERVICE_TYPE,
            "AkatsukiNode",
            "android.local.",
            "fe80::1",
            8443,
            [("id", "ak-1"), ("fp", "AA:BB")].as_slice(),
        )
        .unwrap()
        .as_resolved_service();
        process_mdns_event(ServiceEvent::ServiceResolved(Box::new(v6_only)), &mut cache);
        assert!(cache.is_empty());

        // Evento mixto (loopback + LAN IPv4) conserva solo la IPv4 válida y los TXT limpios
        let mixed = ServiceInfo::new(
            AKATSUKI_MDNS_SERVICE_TYPE,
            "AkatsukiNode",
            "android.local.",
            "127.0.0.1,192.168.1.77",
            9443,
            [("id", " ak-1 "), ("fp", "AA:BB"), ("name", "   ")].as_slice(),
        )
        .unwrap()
        .as_resolved_service();
        process_mdns_event(ServiceEvent::ServiceResolved(Box::new(mixed)), &mut cache);

        let entries = cache.get(fullname).expect("should store IPv4 entry");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].ip, Ipv4Addr::new(192, 168, 1, 77));
        assert_eq!(entries[0].port, 9443);
        assert_eq!(entries[0].meta.device_id.as_deref(), Some("ak-1"));
        assert_eq!(entries[0].meta.fingerprint_sha256.as_deref(), Some("AA:BB"));
        assert_eq!(entries[0].meta.device_name, None);

        // Evento ServiceRemoved debe purgar la entrada
        process_mdns_event(
            ServiceEvent::ServiceRemoved(
                AKATSUKI_MDNS_SERVICE_TYPE.to_string(),
                fullname.to_string(),
            ),
            &mut cache,
        );
        assert!(!cache.contains_key(fullname));
    }
}
