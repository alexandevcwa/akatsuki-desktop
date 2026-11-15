use crate::domain::discovery::{is_scannable_ipv4, MdnsEndpointEntry, MdnsTxtMetadata};
use mdns_sd::{ResolvedService, ServiceEvent};
use std::collections::HashMap;

fn clean_txt_prop(info: &ResolvedService, key: &str) -> Option<String> {
    info.get_property_val_str(key)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
}

/// Extrae metadatos TXT relevantes (`id`, `fp`, `name`) desde un servicio mDNS resuelto.
pub fn extract_txt_metadata(info: &ResolvedService) -> MdnsTxtMetadata {
    MdnsTxtMetadata {
        device_id: clean_txt_prop(info, "id"),
        fingerprint_sha256: clean_txt_prop(info, "fp"),
        device_name: clean_txt_prop(info, "name"),
    }
}

/// Procesa un evento de `mdns-sd` actualizando el mapa de servicios resueltos por `fullname`.
pub fn process_mdns_event(
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
            handle_service_resolved(&info, resolved_by_fullname);
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

fn handle_service_resolved(
    info: &ResolvedService,
    resolved_by_fullname: &mut HashMap<String, Vec<MdnsEndpointEntry>>,
) {
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
    let meta = extract_txt_metadata(info);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::discovery::AKATSUKI_MDNS_SERVICE_TYPE;
    use mdns_sd::ServiceInfo;
    use std::net::Ipv4Addr;

    #[test]
    fn processes_mdns_resolved_and_removed_events_filtering_ipv6_and_loopback() {
        let mut cache: HashMap<String, Vec<MdnsEndpointEntry>> = HashMap::new();
        let fullname = "AkatsukiNode._akatsuki._tcp.local.";

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
