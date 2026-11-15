use crate::domain::discovery::{
    is_virtual_interface, BoxFuture, LocalSubnet, MdnsDiscoveryGateway, MdnsEndpointEntry,
    AKATSUKI_MDNS_SERVICE_TYPE,
};
use crate::infrastructure::discovery::mdns_event_parser::process_mdns_event;
use mdns_sd::{
    IfKind, IfPredicate, Receiver as MdnsReceiver, ServiceDaemon, ServiceEvent, TryRecvError,
};
use std::collections::{HashMap, HashSet};
use std::net::{IpAddr, Ipv4Addr};
use std::sync::Mutex as StdMutex;
use std::time::{Duration, Instant};
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::timeout;

/// Intervalo mínimo tras el cual se reinicia el backoff exponencial de `browse` si no hay servicios resueltos.
const MDNS_BROWSE_REFRESH_INTERVAL: Duration = Duration::from_secs(15);

struct PersistentMdnsBrowser {
    daemon: ServiceDaemon,
    receiver: MdnsReceiver<ServiceEvent>,
    resolved_by_fullname: HashMap<String, Vec<MdnsEndpointEntry>>,
    enabled_fallback_ips: HashSet<Ipv4Addr>,
    last_browse_refresh: Instant,
}

impl Drop for PersistentMdnsBrowser {
    fn drop(&mut self) {
        let _ = self.daemon.shutdown();
    }
}

/// Adaptador de descubrimiento mDNS/DNS-SD respaldado por un `ServiceDaemon` persistente inyectado.
pub struct MdnsSdGateway {
    browser: AsyncMutex<Option<PersistentMdnsBrowser>>,
    /// Referencia ligera sincronizada para enviar paquetes `verify` fuera del lock asíncrono de browse.
    daemon_handle: StdMutex<Option<ServiceDaemon>>,
}

impl Default for MdnsSdGateway {
    fn default() -> Self {
        Self::new()
    }
}

impl MdnsSdGateway {
    pub fn new() -> Self {
        Self {
            browser: AsyncMutex::new(None),
            daemon_handle: StdMutex::new(None),
        }
    }

    fn set_daemon_handle(&self, daemon: Option<ServiceDaemon>) {
        if let Ok(mut guard) = self.daemon_handle.lock() {
            *guard = daemon;
        }
    }

    async fn ensure_or_refresh_browser(
        &self,
        guard: &mut Option<PersistentMdnsBrowser>,
        subnets: &[LocalSubnet],
    ) -> bool {
        if guard.is_none() {
            *guard = init_persistent_mdns_browser(subnets);
            self.set_daemon_handle(guard.as_ref().map(|b| b.daemon.clone()));
            return false;
        }

        let Some(browser) = guard.as_mut() else {
            return false;
        };
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
                    return true;
                }
            }
        }
        false
    }
}

impl MdnsDiscoveryGateway for MdnsSdGateway {
    fn browse_endpoints<'a>(
        &'a self,
        subnets: &'a [LocalSubnet],
        window: Duration,
    ) -> BoxFuture<'a, Vec<MdnsEndpointEntry>> {
        Box::pin(async move {
            let mut guard = self.browser.lock().await;
            let deadline = Instant::now() + window;
            let mut needs_reset = self.ensure_or_refresh_browser(&mut guard, subnets).await;

            if !needs_reset {
                if let Some(browser) = guard.as_mut() {
                    needs_reset = !drain_mdns_events_until(browser, deadline).await;
                }
            }

            if needs_reset {
                if let Some(old) = guard.take() {
                    let _ = old.daemon.shutdown();
                }
                *guard = init_persistent_mdns_browser(subnets);
                self.set_daemon_handle(guard.as_ref().map(|b| b.daemon.clone()));

                if let Some(fresh) = guard.as_mut() {
                    if Instant::now() < deadline && !drain_mdns_events_until(fresh, deadline).await
                    {
                        if let Some(old) = guard.take() {
                            let _ = old.daemon.shutdown();
                        }
                        self.set_daemon_handle(None);
                        return Vec::new();
                    }
                }
            }

            let Some(browser) = guard.as_ref() else {
                return Vec::new();
            };

            browser
                .resolved_by_fullname
                .values()
                .flatten()
                .cloned()
                .collect()
        })
    }

    fn verify_stale_entry(&self, fullname: &str, timeout_duration: Duration) {
        if let Ok(guard) = self.daemon_handle.lock() {
            if let Some(ref daemon) = *guard {
                let _ = daemon.verify(fullname.to_string(), timeout_duration);
            }
        }
    }
}

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
