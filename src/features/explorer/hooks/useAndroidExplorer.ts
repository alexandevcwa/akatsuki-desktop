import { useCallback, useEffect, useState } from "react";
import {
  createAndroidDirectory,
  deleteAndroidEntry,
  listAndroidDirectory,
} from "@/features/explorer/services/explorerIpc";
import { ActiveSession, FileEntry } from "@/shared/types/protocol";
import { joinPath, navigateUpPath } from "@/shared/utils/path";

const DEFAULT_ANDROID_ROOT = "/storage/emulated/0";

interface UseAndroidExplorerOptions {
  activeSession: ActiveSession | null;
  onStorageMutation?: () => Promise<void>;
}

/**
 * Gestiona el estado y las operaciones CRUD/navegación del explorador remoto en Android.
 */
export function useAndroidExplorer({
  activeSession,
  onStorageMutation,
}: UseAndroidExplorerOptions) {
  const [currentPath, setCurrentPath] = useState<string>(DEFAULT_ANDROID_ROOT);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const ipAddress = activeSession?.device.ipAddress;
  const port = activeSession?.device.port;
  const bearerToken = activeSession?.bearerToken;

  const fetchDirectory = useCallback(
    async (targetPath: string) => {
      if (!ipAddress || port === undefined || !bearerToken) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listAndroidDirectory({
          ipAddress,
          port,
          bearerToken,
          path: targetPath,
        });
        setCurrentPath(res.currentPath);
        setEntries(res.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [ipAddress, port, bearerToken],
  );

  useEffect(() => {
    if (ipAddress && port !== undefined && bearerToken) {
      void fetchDirectory(currentPath);
    } else {
      setEntries([]);
      setError(null);
    }
  }, [ipAddress, port, bearerToken, currentPath, fetchDirectory]);

  const navigateTo = useCallback((newPath: string) => {
    setCurrentPath(newPath);
  }, []);

  const navigateUp = useCallback(() => {
    setCurrentPath((prev) => navigateUpPath(prev));
  }, []);

  const refresh = useCallback(async () => {
    await fetchDirectory(currentPath);
    await onStorageMutation?.();
  }, [currentPath, fetchDirectory, onStorageMutation]);

  const createFolder = useCallback(
    async (folderName: string) => {
      if (!ipAddress || port === undefined || !bearerToken) return;
      const fullPath = joinPath(currentPath, folderName);
      try {
        await createAndroidDirectory({
          ipAddress,
          port,
          bearerToken,
          path: fullPath,
        });
        await fetchDirectory(currentPath);
        await onStorageMutation?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [ipAddress, port, bearerToken, currentPath, fetchDirectory, onStorageMutation],
  );

  const deleteEntry = useCallback(
    async (entry: FileEntry) => {
      if (!ipAddress || port === undefined || !bearerToken) return;
      try {
        await deleteAndroidEntry({
          ipAddress,
          port,
          bearerToken,
          path: entry.path,
        });
        await fetchDirectory(currentPath);
        await onStorageMutation?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [ipAddress, port, bearerToken, currentPath, fetchDirectory, onStorageMutation],
  );

  return {
    currentPath,
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
