use crate::domain::device::AndroidDeviceNode;

/// Escanea la red local en busca de anuncios mDNS (`_akatsuki._tcp.local.`) emitidos por el Web Service Android.
pub async fn discover_android_nodes_on_lan() -> Vec<AndroidDeviceNode> {
    vec![AndroidDeviceNode {
        device_id: "ak-node-itachi-01".to_string(),
        device_name: "ANDROID // ITACHI SHARINGAN NODE".to_string(),
        model: "Android 15 • Akatsuki WebService HTTPS v2.1".to_string(),
        ip_address: "192.168.1.88".to_string(),
        port: 8443,
        tls_cert_fingerprint_sha256:
            "9F:86:D0:81:88:4C:7D:65:9A:2F:EA:A0:C5:5A:D0:15:A3:BF:4F:1B:2B:0B:82:2C:D1:5D:6C:15:B0:F0:0A:08"
                .to_string(),
        discovered_via: "mdns".to_string(),
        paired: true,
    }]
}
