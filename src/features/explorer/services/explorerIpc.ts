import { invoke } from "@tauri-apps/api/core";
import { DeleteEntryResponse, FileEntry, MkdirResponse } from "@/shared/types/protocol";

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
 * Crea un directorio en el sistema de archivos local de la computadora.
 */
export async function createLocalDirectory(path: string): Promise<MkdirResponse> {
  return invoke<MkdirResponse>("create_local_dir", { path });
}

/**
 * Elimina un archivo o directorio en el sistema de archivos local de la computadora.
 */
export async function deleteLocalEntry(path: string): Promise<DeleteEntryResponse> {
  return invoke<DeleteEntryResponse>("delete_local_entry", { path });
}

/**
 * 5. `GET /api/v1/files/list` — Solicita el listado de archivos al Web Service del celular Android vía HTTPS.
 */
export async function listAndroidDirectory(params: {
  ipAddress: string;
  port: number;
  bearerToken: string;
  path: string;
}): Promise<DirectoryListingResponse> {
  return invoke<DirectoryListingResponse>("list_android_dir", params);
}

/**
 * 6. `POST /api/v1/files/mkdir` — Crea una nueva carpeta en el almacenamiento del dispositivo Android.
 */
export async function createAndroidDirectory(params: {
  ipAddress: string;
  port: number;
  bearerToken: string;
  path: string;
}): Promise<MkdirResponse> {
  return invoke<MkdirResponse>("create_android_dir", params);
}

/**
 * 7. `DELETE /api/v1/files/delete` — Elimina un archivo o directorio en el dispositivo Android.
 */
export async function deleteAndroidEntry(params: {
  ipAddress: string;
  port: number;
  bearerToken: string;
  path: string;
}): Promise<DeleteEntryResponse> {
  return invoke<DeleteEntryResponse>("delete_android_file_entry", params);
}
