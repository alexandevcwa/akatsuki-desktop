import { invoke } from "@tauri-apps/api/core";
import { ActiveSession, AndroidDeviceNode } from "@/shared/types/protocol";

/**
 * Escanea la red local vía mDNS (_akatsuki._tcp.local.) desde el backend de Rust.
 */
export async function scanLanAndroidDevices(): Promise<AndroidDeviceNode[]> {
  return invoke<AndroidDeviceNode[]>("scan_lan_devices");
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
  return invoke<ActiveSession>("pair_android_device", {
    ipAddress: params.ipAddress,
    port: params.port,
    pinCode: params.pinCode,
    expectedFingerprint: params.expectedFingerprint ?? null,
  });
}
