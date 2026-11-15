use crate::domain::discovery::{
    is_scannable_ipv4, is_virtual_interface, LocalSubnet, NetworkInterfaceProvider,
};
use if_addrs::{get_if_addrs, IfAddr};
use std::collections::HashSet;
use std::net::Ipv4Addr;

/// Proveedor de interfaces de red basado en `if-addrs` del sistema operativo.
#[derive(Debug, Default)]
pub struct IfAddrsNetworkProvider;

impl NetworkInterfaceProvider for IfAddrsNetworkProvider {
    fn active_subnets(&self) -> Vec<LocalSubnet> {
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
}
