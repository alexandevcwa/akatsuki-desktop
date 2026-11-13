import React, { useCallback, useEffect, useState } from "react";
import {
  Radio,
  ShieldCheck,
  Unplug,
  Cpu,
} from "lucide-react";
import {
  AkatsukiCloudIcon,
  CyberBadge,
  CyberButton,
  Heading1,
  MonoHash,
  MonoTelemetry,
} from "@/design-system";
import { useConnectionStore } from "@/features/connection/store/useConnectionStore";
import { ConnectionRadarModal } from "@/features/connection/components/ConnectionRadarModal";
import { FilePane } from "@/features/explorer/components/FilePane";
import {
  listAndroidDirectory,
  listLocalDirectory,
} from "@/features/explorer/services/explorerIpc";
import { TransferQueueDrawer } from "@/features/transfer/components/TransferQueueDrawer";
import { useTransferStore } from "@/features/transfer/store/useTransferStore";
import { FileEntry } from "@/shared/types/protocol";
import { formatBytes, formatShortSha256 } from "@/shared/utils/formatters";

export const App: React.FC = () => {
  const {
    status,
    activeSession,
    setRadarModalOpen,
    disconnect,
  } = useConnectionStore();

  const { enqueueTransfer } = useTransferStore();

  // Estado del explorador local (PC - Manjaro Linux)
  const [localPath, setLocalPath] = useState<string>("");
  const [localEntries, setLocalEntries] = useState<FileEntry[]>([]);
  const [loadingLocal, setLoadingLocal] = useState<boolean>(false);

  // Estado del explorador remoto (Android Web Service)
  const [androidPath, setAndroidPath] = useState<string>("/storage/emulated/0");
  const [androidEntries, setAndroidEntries] = useState<FileEntry[]>([]);
  const [loadingAndroid, setLoadingAndroid] = useState<boolean>(false);

  const fetchLocalDir = useCallback(async (targetPath?: string) => {
    setLoadingLocal(true);
    try {
      const res = await listLocalDirectory(targetPath);
      setLocalPath(res.currentPath);
      setLocalEntries(res.entries);
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  const fetchAndroidDir = useCallback(
    async (targetPath: string) => {
      if (!activeSession) return;
      setLoadingAndroid(true);
      try {
        const res = await listAndroidDirectory({
          ipAddress: activeSession.device.ipAddress,
          port: activeSession.device.port,
          bearerToken: activeSession.bearerToken,
          path: targetPath,
        });
        setAndroidPath(res.currentPath);
        setAndroidEntries(res.entries);
      } finally {
        setLoadingAndroid(false);
      }
    },
    [activeSession]
  );

  useEffect(() => {
    fetchLocalDir();
  }, [fetchLocalDir]);

  useEffect(() => {
    if (activeSession) {
      fetchAndroidDir(androidPath);
    } else {
      setAndroidEntries([]);
    }
  }, [activeSession, androidPath, fetchAndroidDir]);

  const navigateUp = (current: string): string => {
    const clean = current.replace(/\/+$/, "");
    const idx = clean.lastIndexOf("/");
    if (idx <= 0) return "/";
    return clean.slice(0, idx);
  };

  const handleSendToAndroid = (file: FileEntry) => {
    if (!activeSession) {
      setRadarModalOpen(true);
      return;
    }
    enqueueTransfer({
      file,
      destinationDir: androidPath,
      direction: "pc_to_android",
      ipAddress: activeSession.device.ipAddress,
      port: activeSession.device.port,
      bearerToken: activeSession.bearerToken,
    });
  };

  const handleReceiveFromAndroid = (file: FileEntry) => {
    if (!activeSession) return;
    enqueueTransfer({
      file,
      destinationDir: localPath || "/tmp",
      direction: "android_to_pc",
      ipAddress: activeSession.device.ipAddress,
      port: activeSession.device.port,
      bearerToken: activeSession.bearerToken,
    });
  };

  const isConnected = status === "connected" && activeSession !== null;

  return (
    <div className="h-screen w-screen bg-akatsuki-void cyber-grid-bg flex flex-col overflow-hidden select-none">
      {/* ===================================================================
       * TOPBAR TÁCTICO HUD (AKATSUKI CYBERPUNK)
       * =================================================================== */}
      <header className="h-16 px-5 bg-akatsuki-mantle/95 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
        {/* Identidad Visual Akatsuki */}
        <div className="flex items-center gap-3.5">
          <div className="p-2 bg-akatsuki-panel cyber-chamfer-sm cyber-border-crimson flex items-center justify-center">
            <AkatsukiCloudIcon className="w-8 h-5" />
          </div>
          <Heading1 className="tracking-widest">
            Akatsuki // Shinobi Secure File Transfer
          </Heading1>
        </div>

        {/* Telemetría Central de Enlace Android */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-akatsuki-panel/90 border border-b-0 border-white/10 rounded-t-sm">
          {isConnected && activeSession ? (
            <>
              <CyberBadge tone="success" pulse>
                {activeSession.device.deviceName}
              </CyberBadge>
              <MonoTelemetry>
                https://{activeSession.device.ipAddress}:{activeSession.device.port}
              </MonoTelemetry>
              <div className="h-3 w-[1px] bg-white/15" />
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-akatsuki-purple" />
                <MonoHash>
                  PINNED: {formatShortSha256(activeSession.device.tlsCertFingerprintSha256)}
                </MonoHash>
              </div>
              <div className="h-3 w-[1px] bg-white/15" />
              <MonoHash>
                LIBRE: {formatBytes(activeSession.androidStorageFreeBytes)}
              </MonoHash>
            </>
          ) : (
            <>
              <CyberBadge tone="warning" pulse>
                SIN CONEXIÓN ANDROID
              </CyberBadge>
              <MonoHash>
                ESPERANDO HANDSHAKE HTTPS TLS 1.3 CON SERVICIO WEB ANDROID
              </MonoHash>
            </>
          )}
        </div>

        {/* Acción de Conexión / Desconexión */}
        <div className="flex items-center gap-2.5">
          {isConnected ? (
            <CyberButton
              variant="danger"
              size="sm"
              onClick={disconnect}
              leftIcon={<Unplug className="w-4 h-4" />}
            >
              Desconectar
            </CyberButton>
          ) : (
            <CyberButton
              variant="primary"
              size="sm"
              onClick={() => setRadarModalOpen(true)}
              leftIcon={<Radio className="w-4 h-4" />}
            >
              Conectar Android
            </CyberButton>
          )}
        </div>
      </header>

      {/* ===================================================================
       * ÁREA PRINCIPAL DE TRABAJO (DUAL-PANE WORKSPACE)
       * =================================================================== */}
      <main className="flex-1 min-h-0 p-4 flex flex-col gap-4 overflow-hidden">
        {/* Dual-Pane Explorer: PC Local (Izquierda) ⇄ Android Web Service (Derecha) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FilePane
            side="pc"
            title="NODO LOCAL // COMPUTADORA (LINUX)"
            currentPath={localPath || "/home/rmachicm"}
            entries={localEntries}
            loading={loadingLocal}
            connected={isConnected}
            onNavigate={(newPath) => fetchLocalDir(newPath)}
            onNavigateUp={() => fetchLocalDir(navigateUp(localPath))}
            onRefresh={() => fetchLocalDir(localPath)}
            onTransferFile={handleSendToAndroid}
          />

          <FilePane
            side="android"
            title="NODO REMOTO // ANDROID WEB SERVICE"
            currentPath={androidPath}
            entries={androidEntries}
            loading={loadingAndroid}
            connected={isConnected}
            onNavigate={(newPath) => setAndroidPath(newPath)}
            onNavigateUp={() => setAndroidPath(navigateUp(androidPath))}
            onRefresh={() => fetchAndroidDir(androidPath)}
            onTransferFile={handleReceiveFromAndroid}
            onOpenConnectModal={() => setRadarModalOpen(true)}
          />
        </div>

        {/* Drawer Inferior: Cola de Transferencias & Verificación SHA-256 */}
        <TransferQueueDrawer />
      </main>

      {/* ===================================================================
       * BARRA DE ESTADO INFERIOR (FOOTER TELEMETRY)
       * =================================================================== */}
      <footer className="h-7 px-4 bg-akatsuki-mantle border-t border-white/10 flex items-center justify-between text-mono-hash shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-akatsuki-accent font-mono">
            <Cpu className="w-3 h-3" />
            RUST CORE 1.96 // REQWEST + RUSTLS + TOKIO STREAM
          </span>
          <span className="text-white/20">|</span>
          <MonoHash>THEME: AKATSUKI CYBERPUNK v1.0</MonoHash>
        </div>
        <div className="flex items-center gap-3">
          <MonoHash>INTEGRIDAD DE ARCHIVOS: SHA-256 END-TO-END</MonoHash>
        </div>
      </footer>

      {/* Modal de Radar LAN mDNS y Emparejamiento HTTPS */}
      <ConnectionRadarModal />
    </div>
  );
};

export default App;
