/**
 * Utilidades de formateo para tamaños de archivos, velocidades de red y huellas criptográficas.
 */

export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0.0 MB/s";
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

export function formatShortSha256(hash?: string): string {
  if (!hash) return "PENDIENTE";
  if (hash.length <= 20) return hash.toUpperCase();
  return `${hash.slice(0, 10).toUpperCase()}...${hash.slice(-8).toUpperCase()}`;
}
