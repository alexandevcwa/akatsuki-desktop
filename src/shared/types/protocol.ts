/**
 * Contratos de Dominio compartidos entre el Frontend (TypeScript) y el Core de Rust (Tauri v2).
 */

export type ConnectionState = "disconnected" | "scanning" | "pairing" | "connected" | "error";

export interface AndroidDeviceNode {
  deviceId: string;
  deviceName: string;
  model: string;
  ipAddress: string;
  port: number;
  tlsCertFingerprintSha256: string;
  discoveredVia: "mdns" | "manual";
  paired: boolean;
}

export interface ActiveSession {
  device: AndroidDeviceNode;
  bearerToken: string;
  connectedAt: string;
  androidStorageTotalBytes: number;
  androidStorageFreeBytes: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number;
  modifiedAt: string;
  extension?: string;
}

export type TransferDirection = "pc_to_android" | "android_to_pc";

export type TransferStatus =
  | "queued"
  | "hashing_local"
  | "streaming"
  | "verifying_sha256"
  | "completed"
  | "failed";

export interface TransferTask {
  id: string;
  fileName: string;
  sourcePath: string;
  destinationPath: string;
  direction: TransferDirection;
  totalBytes: number;
  transferredBytes: number;
  speedBytesPerSec: number;
  sha256Checksum?: string;
  status: TransferStatus;
  errorMessage?: string;
}
