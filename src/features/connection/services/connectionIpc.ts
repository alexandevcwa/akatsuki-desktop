import { invoke } from "@tauri-apps/api/core";
import {
  ActiveSession,
  AndroidDeviceNode,
  HealthResponse,
  RevokeSessionResponse,
  StorageInfoResponse,
} from "@/shared/types/protocol";

/**
 * Escanea la subred local buscando dispositivos Android activos en el puerto 8443 (`GET /api/v1/health`).
 */
export async function scanLanAndroidDevices(): Promise<AndroidDeviceNode[]> {
  return invoke<AndroidDeviceNode[]>("scan_lan_devices");
}

/**
 * 1. `GET /api/v1/health` — Verifica directamente el estado y huella TLS de un nodo Android por IP y puerto.
 */
export async function checkAndroidNodeHealth(
  ipAddress: string,
  port: number
): Promise<HealthResponse> {
  return invoke<HealthResponse>("check_android_node_health", {
    ipAddress,
    port,
  });
}

/**
 * 2. `POST /api/v1/auth/pair` — Empareja y verifica la huella TLS (TOFU) con el Web Service Android.
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

/**
 * 3. `POST /api/v1/auth/revoke` — Revoca el Bearer Token activo en el servidor Android al desconectar.
 */
export async function revokeAndroidSession(params: {
  ipAddress: string;
  port: number;
  bearerToken: string;
}): Promise<RevokeSessionResponse> {
  return invoke<RevokeSessionResponse>("revoke_android_device_session", params);
}

/**
 * 4. `GET /api/v1/device/storage` — Obtiene el espacio total y libre actualizado del dispositivo Android.
 */
export async function getAndroidStorageInfo(params: {
  ipAddress: string;
  port: number;
  bearerToken: string;
}): Promise<StorageInfoResponse> {
  return invoke<StorageInfoResponse>("get_android_device_storage", params);
}
