import { invoke } from "@tauri-apps/api/core";
import { ActiveSession, AndroidDeviceNode } from "@/shared/types/protocol";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Escanea la red local vía mDNS (_akatsuki._tcp.local.) desde el backend Rust.
 */
export async function scanLanAndroidDevices(): Promise<AndroidDeviceNode[]> {
  if (isTauriRuntime()) {
    return invoke<AndroidDeviceNode[]>("scan_lan_devices");
  }
  // Fallback de demostración cuando se previsualiza sólo en navegador Vite
  return [
    {
      deviceId: "ak-node-itachi-01",
      deviceName: "NOTHING PHONE (2) // ITACHI",
      model: "Android 15 • Akatsuki WebService v2.1",
      ipAddress: "192.168.1.88",
      port: 8443,
      tlsCertFingerprintSha256:
        "9F:86:D0:81:88:4C:7D:65:9A:2F:EA:A0:C5:5A:D0:15:A3:BF:4F:1B:2B:0B:82:2C:D1:5D:6C:15:B0:F0:0A:08",
      discoveredVia: "mdns",
      paired: true,
    },
  ];
}

/**
 * Empareja y verifica la huella TLS (TOFU) con el Web Service del celular Android.
 */
export async function pairWithAndroidService(params: {
  ipAddress: string;
  port: number;
  pinCode: string;
  expectedFingerprint?: string;
}): Promise<ActiveSession> {
  if (isTauriRuntime()) {
    return invoke<ActiveSession>("pair_android_device", {
      ipAddress: params.ipAddress,
      port: params.port,
      pinCode: params.pinCode,
      expectedFingerprint: params.expectedFingerprint ?? null,
    });
  }
  return {
    device: {
      deviceId: "ak-node-itachi-01",
      deviceName: "ANDROID // SHARINGAN NODE",
      model: "Android 15 • WebService HTTPS",
      ipAddress: params.ipAddress,
      port: params.port,
      tlsCertFingerprintSha256:
        params.expectedFingerprint ||
        "9F:86:D0:81:88:4C:7D:65:9A:2F:EA:A0:C5:5A:D0:15:A3:BF:4F:1B:2B:0B:82:2C:D1:5D:6C:15:B0:F0:0A:08",
      discoveredVia: "manual",
      paired: true,
    },
    bearerToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.akatsuki_session",
    connectedAt: new Date().toISOString(),
    androidStorageTotalBytes: 256 * 1024 * 1024 * 1024,
    androidStorageFreeBytes: 142 * 1024 * 1024 * 1024,
  };
}
