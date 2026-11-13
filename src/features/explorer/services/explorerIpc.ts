import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "@/shared/types/protocol";

export interface DirectoryListingResponse {
  currentPath: string;
  hostname?: string;
  entries: FileEntry[];
}

/**
 * Obtiene el listado real de archivos locales de la computadora a través del Core de Rust (Tauri v2).
 */
export async function listLocalDirectory(path?: string): Promise<DirectoryListingResponse> {
  return invoke<DirectoryListingResponse>("list_local_dir", {
    path: path ?? null,
  });
}

/**
 * Solicita el listado de archivos al Web Service del celular Android vía HTTPS a través del Core de Rust.
 */
export async function listAndroidDirectory(params: {
  ipAddress: string;
  port: number;
  bearerToken: string;
  path: string;
}): Promise<DirectoryListingResponse> {
  return invoke<DirectoryListingResponse>("list_android_dir", params);
}
