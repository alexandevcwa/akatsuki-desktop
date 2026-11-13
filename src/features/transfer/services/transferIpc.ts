import { invoke, Channel } from "@tauri-apps/api/core";
import { TransferDirection, TransferTask } from "@/shared/types/protocol";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

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
  if (isTauriRuntime()) {
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

  // Simulación si se ejecuta fuera de Tauri
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await new Promise((r) => setTimeout(r, 120));
    params.onProgress({
      taskId: params.taskId,
      transferredBytes: Math.floor((params.totalBytes * i) / steps),
      totalBytes: params.totalBytes,
      speedBytesPerSec: 54_525_952,
      status: i === steps ? "completed" : "streaming",
      sha256Checksum:
        i === steps
          ? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
          : undefined,
    });
  }
  return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
}
