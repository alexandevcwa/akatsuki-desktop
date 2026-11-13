import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "@/shared/types/protocol";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Obtiene el listado real de archivos locales de la computadora (Linux/Windows/macOS) vía Rust.
 */
export async function listLocalDirectory(path?: string): Promise<{ currentPath: string; entries: FileEntry[] }> {
  if (isTauriRuntime()) {
    return invoke<{ currentPath: string; entries: FileEntry[] }>("list_local_dir", {
      path: path ?? null,
    });
  }
  const currentPath = path || "/home/rmachicm/Downloads";
  return {
    currentPath,
    entries: [
      {
        name: "Proyectos-Personales",
        path: "/home/rmachicm/Projects/Proyectos-Personales",
        isDir: true,
        sizeBytes: 0,
        modifiedAt: "2026-11-12 20:30",
      },
      {
        name: "akatsuki_wallpaper_4k.png",
        path: `${currentPath}/akatsuki_wallpaper_4k.png`,
        isDir: false,
        sizeBytes: 14_820_400,
        modifiedAt: "2026-11-12 19:15",
        extension: "png",
      },
      {
        name: "naruto_ost_flac_collection.zip",
        path: `${currentPath}/naruto_ost_flac_collection.zip`,
        isDir: false,
        sizeBytes: 684_510_200,
        modifiedAt: "2026-11-10 14:22",
        extension: "zip",
      },
    ],
  };
}

/**
 * Solicita el listado de archivos al Web Service del celular Android vía HTTPS.
 */
export async function listAndroidDirectory(params: {
  ipAddress: string;
  port: number;
  bearerToken: string;
  path: string;
}): Promise<{ currentPath: string; entries: FileEntry[] }> {
  if (isTauriRuntime()) {
    return invoke<{ currentPath: string; entries: FileEntry[] }>("list_android_dir", params);
  }
  return {
    currentPath: params.path,
    entries: [
      {
        name: "DCIM",
        path: "/storage/emulated/0/DCIM",
        isDir: true,
        sizeBytes: 0,
        modifiedAt: "2026-11-12 18:40",
      },
      {
        name: "Download",
        path: "/storage/emulated/0/Download",
        isDir: true,
        sizeBytes: 0,
        modifiedAt: "2026-11-12 20:10",
      },
      {
        name: "VID_20261112_SHARINGAN_60FPS.mp4",
        path: `${params.path}/VID_20261112_SHARINGAN_60FPS.mp4`,
        isDir: false,
        sizeBytes: 412_876_800,
        modifiedAt: "2026-11-12 20:02",
        extension: "mp4",
      },
      {
        name: "IMG_20261112_AKATSUKI_CLOUD.raw",
        path: `${params.path}/IMG_20261112_AKATSUKI_CLOUD.raw`,
        isDir: false,
        sizeBytes: 48_234_496,
        modifiedAt: "2026-11-11 22:18",
        extension: "raw",
      },
      {
        name: "shinobi_backup_encrypted.tar.gz",
        path: `${params.path}/shinobi_backup_encrypted.tar.gz`,
        isDir: false,
        sizeBytes: 1_289_748_480,
        modifiedAt: "2026-11-09 11:05",
        extension: "gz",
      },
    ],
  };
}
