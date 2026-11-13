import { invoke, Channel } from "@tauri-apps/api/core";
import { TransferDirection, TransferTask } from "@/shared/types/protocol";

export interface TransferProgressPayload {
  taskId: string;
  transferredBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  sha256Checksum?: string;
  status: TransferTask["status"];
}

/**
 * Ejecuta la transferencia de un archivo entre PC y el Web Service Android
 * utilizando canales de streaming en tiempo real de Tauri v2 (Rust Tokio + Reqwest).
 */
export async function executeFileTransfer(params: {
  taskId: string;
  fileName: string;
  sourcePath: string;
  destinationPath: string;
  totalBytes: number;
  direction: TransferDirection;
  ipAddress: string;
  port: number;
  bearerToken: string;
  onProgress: (payload: TransferProgressPayload) => void;
}): Promise<string> {
  const onEvent = new Channel<TransferProgressPayload>();
  onEvent.onmessage = (message) => {
    params.onProgress(message);
  };

  return invoke<string>("transfer_file_stream", {
    taskId: params.taskId,
    fileName: params.fileName,
    sourcePath: params.sourcePath,
    destinationPath: params.destinationPath,
    totalBytes: params.totalBytes,
    direction: params.direction,
    ipAddress: params.ipAddress,
    port: params.port,
    bearerToken: params.bearerToken,
    onEvent,
  });
}
