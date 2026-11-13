/**
 * Utilidades multiplataforma para navegación y construcción de rutas (POSIX/Android y Windows).
 */

export function navigateUpPath(current: string): string {
  const trimmed = current.trim();
  if (!trimmed) return "/";

  // Soporte multiplataforma para rutas de unidades Windows (ej. C:\Users\...)
  if (/^[a-zA-Z]:/.test(trimmed)) {
    const sep = trimmed.includes("\\") ? "\\" : "/";
    const clean = trimmed.replace(/[\\/]+$/, "");
    if (/^[a-zA-Z]:$/.test(clean)) {
      return `${clean}${sep}`;
    }
    const lastSep = Math.max(clean.lastIndexOf("\\"), clean.lastIndexOf("/"));
    if (lastSep <= 2) {
      return `${clean.slice(0, 2)}${sep}`;
    }
    return clean.slice(0, lastSep);
  }

  // Rutas POSIX (Linux, macOS y Android)
  const clean = trimmed.replace(/\/+$/, "");
  const idx = clean.lastIndexOf("/");
  if (idx <= 0) return "/";
  return clean.slice(0, idx);
}

export function joinPath(baseDir: string, entryName: string): string {
  const sep = baseDir.includes("\\") ? "\\" : "/";
  const normalizedBase = baseDir.replace(/[\\/]+$/, "");
  return `${normalizedBase}${sep}${entryName}`;
}
