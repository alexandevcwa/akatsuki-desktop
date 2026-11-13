import { useCallback, useEffect, useState } from "react";
import {
  createLocalDirectory,
  deleteLocalEntry,
  listLocalDirectory,
} from "@/features/explorer/services/explorerIpc";
import { FileEntry } from "@/shared/types/protocol";
import { joinPath, navigateUpPath } from "@/shared/utils/path";

/**
 * Gestiona el estado y las operaciones CRUD/navegación del explorador de archivos local (PC).
 */
export function useLocalExplorer() {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [hostname, setHostname] = useState<string>("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectory = useCallback(async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLocalDirectory(targetPath);
      setCurrentPath(res.currentPath);
      if (res.hostname) {
        setHostname(res.hostname);
      }
      setEntries(res.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  const navigateTo = useCallback(
    (newPath: string) => {
      void fetchDirectory(newPath);
    },
    [fetchDirectory],
  );

  const navigateUp = useCallback(() => {
    void fetchDirectory(navigateUpPath(currentPath));
  }, [currentPath, fetchDirectory]);

  const refresh = useCallback(async () => {
    await fetchDirectory(currentPath);
  }, [currentPath, fetchDirectory]);

  const createFolder = useCallback(
    async (folderName: string) => {
      const fullPath = joinPath(currentPath, folderName);
      try {
        await createLocalDirectory(fullPath);
        await fetchDirectory(currentPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentPath, fetchDirectory],
  );

  const deleteEntry = useCallback(
    async (entry: FileEntry) => {
      try {
        await deleteLocalEntry(entry.path);
        await fetchDirectory(currentPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [currentPath, fetchDirectory],
  );

  return {
    currentPath,
    hostname,
    entries,
    loading,
    error,
    navigateTo,
    navigateUp,
    refresh,
    createFolder,
    deleteEntry,
  };
}
