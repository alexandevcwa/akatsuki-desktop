import React, { useCallback } from "react";
import { useConnectionStore } from "@/features/connection/store/useConnectionStore";
import { FilePane } from "@/features/explorer/components/FilePane";
import { useAndroidExplorer } from "@/features/explorer/hooks/useAndroidExplorer";
import { useLocalExplorer } from "@/features/explorer/hooks/useLocalExplorer";
import { useTransferStore } from "@/features/transfer/store/useTransferStore";
import { FileEntry } from "@/shared/types/protocol";

/**
 * Espacio de trabajo de doble panel (PC Local ⇄ Android Web Service) con orquestación de transferencias.
 */
export const DualExplorerWorkspace: React.FC = () => {
  const { status, activeSession, setRadarModalOpen, refreshStorageInfo } =
    useConnectionStore();
  const { enqueueTransfer } = useTransferStore();

  const localExplorer = useLocalExplorer();
  const androidExplorer = useAndroidExplorer({
    activeSession,
    onStorageMutation: refreshStorageInfo,
  });

  const isConnected = status === "connected" && activeSession !== null;

  const handleSendToAndroid = useCallback(
    async (file: FileEntry) => {
      if (!activeSession) {
        setRadarModalOpen(true);
        return;
      }
      await enqueueTransfer({
        file,
        destinationDir: androidExplorer.currentPath,
        direction: "pc_to_android",
        ipAddress: activeSession.device.ipAddress,
        port: activeSession.device.port,
        bearerToken: activeSession.bearerToken,
      });
      await androidExplorer.refresh();
    },
    [activeSession, androidExplorer, enqueueTransfer, setRadarModalOpen],
  );

  const handleReceiveFromAndroid = useCallback(
    async (file: FileEntry) => {
      if (!activeSession) return;
      await enqueueTransfer({
        file,
        destinationDir: localExplorer.currentPath || "/tmp",
        direction: "android_to_pc",
        ipAddress: activeSession.device.ipAddress,
        port: activeSession.device.port,
        bearerToken: activeSession.bearerToken,
      });
      await localExplorer.refresh();
    },
    [activeSession, enqueueTransfer, localExplorer],
  );

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FilePane
        side="pc"
        title="NODO LOCAL"
        badgeLabel={localExplorer.hostname}
        currentPath={localExplorer.currentPath || "~"}
        entries={localExplorer.entries}
        loading={localExplorer.loading}
        connected={isConnected}
        errorMessage={localExplorer.error}
        onNavigate={localExplorer.navigateTo}
        onNavigateUp={localExplorer.navigateUp}
        onRefresh={localExplorer.refresh}
        onTransferFile={handleSendToAndroid}
        onCreateFolder={localExplorer.createFolder}
        onDeleteEntry={localExplorer.deleteEntry}
      />

      <FilePane
        side="android"
        title="NODO REMOTO"
        currentPath={androidExplorer.currentPath}
        entries={androidExplorer.entries}
        loading={androidExplorer.loading}
        connected={isConnected}
        errorMessage={androidExplorer.error}
        onNavigate={androidExplorer.navigateTo}
        onNavigateUp={androidExplorer.navigateUp}
        onRefresh={androidExplorer.refresh}
        onTransferFile={handleReceiveFromAndroid}
        onCreateFolder={androidExplorer.createFolder}
        onDeleteEntry={androidExplorer.deleteEntry}
        onOpenConnectModal={() => setRadarModalOpen(true)}
      />
    </div>
  );
};
