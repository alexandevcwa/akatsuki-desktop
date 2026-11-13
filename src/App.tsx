import React, { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Radio,
  ShieldCheck,
  Smartphone,
  Unplug,
  Cpu,
  Minus,
  Square,
  Copy,
  X,
} from "lucide-react";
import {
  AkatsukiCloudIcon,
  CyberButton,
  Heading1,
  MonoHash,
  MonoTelemetry,
} from "@/design-system";
import { useConnectionStore } from "@/features/connection/store/useConnectionStore";
import { ConnectionRadarModal } from "@/features/connection/components/ConnectionRadarModal";
import { FilePane } from "@/features/explorer/components/FilePane";
import {
  createAndroidDirectory,
  createLocalDirectory,
  deleteAndroidEntry,
  deleteLocalEntry,
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
    refreshStorageInfo,
    disconnect,
  } = useConnectionStore();

  const { enqueueTransfer } = useTransferStore();

  // Estado del explorador local (PC)
  const [localPath, setLocalPath] = useState<string>("");
  const [localHostname, setLocalHostname] = useState<string>("");
  const [localEntries, setLocalEntries] = useState<FileEntry[]>([]);
  const [loadingLocal, setLoadingLocal] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Estado del explorador remoto (Android Web Service)
  const [androidPath, setAndroidPath] = useState<string>("/storage/emulated/0");
  const [androidEntries, setAndroidEntries] = useState<FileEntry[]>([]);
  const [loadingAndroid, setLoadingAndroid] = useState<boolean>(false);
  const [androidError, setAndroidError] = useState<string | null>(null);

  const fetchLocalDir = useCallback(async (targetPath?: string) => {
    setLoadingLocal(true);
    setLocalError(null);
    try {
      const res = await listLocalDirectory(targetPath);
      setLocalPath(res.currentPath);
      if (res.hostname) {
        setLocalHostname(res.hostname);
      }
      setLocalEntries(res.entries);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  const fetchAndroidDir = useCallback(
    async (targetPath: string) => {
      if (!activeSession) return;
      setLoadingAndroid(true);
      setAndroidError(null);
      try {
        const res = await listAndroidDirectory({
          ipAddress: activeSession.device.ipAddress,
          port: activeSession.device.port,
          bearerToken: activeSession.bearerToken,
          path: targetPath,
        });
        setAndroidPath(res.currentPath);
        setAndroidEntries(res.entries);
      } catch (err) {
        setAndroidError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingAndroid(false);
      }
    },
    [activeSession],
  );

  useEffect(() => {
    fetchLocalDir();
  }, [fetchLocalDir]);

  useEffect(() => {
    if (activeSession) {
      fetchAndroidDir(androidPath);
    } else {
      setAndroidEntries([]);
      setAndroidError(null);
    }
  }, [activeSession, androidPath, fetchAndroidDir]);

  const navigateUp = (current: string): string => {
    const clean = current.replace(/\/+$/, "");
    const idx = clean.lastIndexOf("/");
    if (idx <= 0) return "/";
    return clean.slice(0, idx);
  };

  const handleSendToAndroid = async (file: FileEntry) => {
    if (!activeSession) {
      setRadarModalOpen(true);
      return;
    }
    await enqueueTransfer({
      file,
      destinationDir: androidPath,
      direction: "pc_to_android",
      ipAddress: activeSession.device.ipAddress,
      port: activeSession.device.port,
      bearerToken: activeSession.bearerToken,
    });
    await fetchAndroidDir(androidPath);
    await refreshStorageInfo();
  };

  const handleReceiveFromAndroid = async (file: FileEntry) => {
    if (!activeSession) return;
    await enqueueTransfer({
      file,
      destinationDir: localPath || "/tmp",
      direction: "android_to_pc",
      ipAddress: activeSession.device.ipAddress,
      port: activeSession.device.port,
      bearerToken: activeSession.bearerToken,
    });
    await fetchLocalDir(localPath);
  };

  const handleCreateLocalFolder = async (folderName: string) => {
    const fullPath = `${localPath.replace(/\/$/, "")}/${folderName}`;
    try {
      await createLocalDirectory(fullPath);
      await fetchLocalDir(localPath);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteLocalEntry = async (entry: FileEntry) => {
    try {
      await deleteLocalEntry(entry.path);
      await fetchLocalDir(localPath);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateAndroidFolder = async (folderName: string) => {
    if (!activeSession) return;
    const fullPath = `${androidPath.replace(/\/$/, "")}/${folderName}`;
    try {
      await createAndroidDirectory({
        ipAddress: activeSession.device.ipAddress,
        port: activeSession.device.port,
        bearerToken: activeSession.bearerToken,
        path: fullPath,
      });
      await fetchAndroidDir(androidPath);
      await refreshStorageInfo();
    } catch (err) {
      setAndroidError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteAndroidEntry = async (entry: FileEntry) => {
    if (!activeSession) return;
    try {
      await deleteAndroidEntry({
        ipAddress: activeSession.device.ipAddress,
        port: activeSession.device.port,
        bearerToken: activeSession.bearerToken,
        path: entry.path,
      });
      await fetchAndroidDir(androidPath);
      await refreshStorageInfo();
    } catch (err) {
      setAndroidError(err instanceof Error ? err.message : String(err));
    }
  };

  // Estado de ventana maximizada (Linux Wayland/X11, Windows, macOS)
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const syncMaximizedState = useCallback(async () => {
    try {
      const maximized = await getCurrentWindow().isMaximized();
      setIsMaximized(maximized);
    } catch {
      // Ignorar si se ejecuta fuera de contexto de ventana nativa
    }
  }, []);

  const handleWindowMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const handleWindowToggleMaximize = async () => {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    const maximized = await win.isMaximized();
    setIsMaximized(maximized);
  };

  const handleWindowClose = async () => {
    await getCurrentWindow().close();
  };

  const handleHeaderMouseDown = async (e: React.MouseEvent<HTMLElement>) => {
    // Evitar arrastrar si el clic ocurrió dentro de un botón o elemento interactivo
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-no-drag]")) {
      return;
    }
    if (e.buttons === 1) {
      if (e.detail === 2) {
        await handleWindowToggleMaximize();
      } else {
        await getCurrentWindow().startDragging();
      }
    }
  };

  useEffect(() => {
    syncMaximizedState();
  }, [syncMaximizedState]);

  const isConnected = status === "connected" && activeSession !== null;

  return (
    <div className="h-screen w-screen bg-akatsuki-void cyber-grid-bg border border-white/10 flex flex-col overflow-hidden select-none">
      {/* ===================================================================
       * TOPBAR TÁCTICO HUD + BARRA DE VENTANA PERSONALIZADA (SIN DECORACIÓN OS)
       * =================================================================== */}
      <header
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
        className="h-16 px-5 bg-akatsuki-mantle/95 border-b border-white/10 flex items-center justify-between gap-4 shrink-0 cursor-default"
      >
        {/* Identidad Visual Akatsuki */}
        <div data-tauri-drag-region className="flex items-center gap-4">
          <div className="flex items-center justify-center py-1 pointer-events-none">
            <AkatsukiCloudIcon className="h-11 w-auto" />
          </div>
          <Heading1
            data-tauri-drag-region
            className="tracking-widest pointer-events-none"
          >
            Akatsuki // Shinobi Secure File Transfer
          </Heading1>
        </div>

        {/* Panel Derecho: Indicador Táctico de Estado + Acción de Conexión + Controles de Ventana */}
        <div className="flex items-center gap-3">
          {/* Indicador Táctico HUD de Estado con el Dispositivo Móvil */}
          {isConnected && activeSession ? (
            <div
              data-no-drag
              className="flex items-center gap-3 px-3.5 py-1.5 bg-gradient-to-r from-akatsuki-panel via-akatsuki-mantle to-emerald-950/40 cyber-chamfer-sm cyber-border-success"
            >
              {/* Faro / Beacon de Enlace Activo */}
              <div className="relative flex items-center justify-center w-6 h-6 bg-akatsuki-success/15 border border-akatsuki-success/40 rounded-sm">
                <span className="absolute inset-0 rounded-sm bg-akatsuki-success/25 animate-ping" />
                <Smartphone className="w-3.5 h-3.5 text-akatsuki-success relative z-10" />
              </div>

              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-akatsuki-success shadow-[0_0_8px_#10b981]" />
                  <span className="font-display text-[10px] tracking-[0.14em] uppercase text-emerald-300 font-bold">
                    ENLACE ACTIVO // {activeSession.device.deviceName}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MonoTelemetry className="text-[11px] leading-none">
                    https://{activeSession.device.ipAddress}:
                    {activeSession.device.port}
                  </MonoTelemetry>
                  <span className="text-white/20 text-[10px]">•</span>
                  <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-mono text-purple-300">
                    <ShieldCheck className="w-3 h-3 text-akatsuki-purple" />
                    {formatShortSha256(
                      activeSession.device.tlsCertFingerprintSha256,
                    )}
                  </span>
                  <span className="hidden sm:inline text-white/20 text-[10px]">
                    •
                  </span>
                  <MonoHash className="hidden sm:inline text-[10px] leading-none">
                    LIBRE: {formatBytes(activeSession.androidStorageFreeBytes)}
                  </MonoHash>
                </div>
              </div>
            </div>
          ) : (
            <div
              data-no-drag
              onClick={() => setRadarModalOpen(true)}
              title="Haz clic para vincular tu dispositivo Android"
              className="group flex items-center gap-3 px-3.5 py-1.5 bg-gradient-to-r from-akatsuki-panel via-akatsuki-mantle to-amber-950/30 cyber-chamfer-sm cyber-border-warning hover-cyber-border-crimson cursor-pointer transition-all"
            >
              {/* Faro / Beacon Desconectado */}
              <div className="relative flex items-center justify-center w-6 h-6 bg-akatsuki-warning/15 border border-akatsuki-warning/40 rounded-sm">
                <span className="w-2 h-2 rounded-full bg-akatsuki-warning animate-pulse shadow-[0_0_8px_#f59e0b]" />
              </div>

              <div className="flex flex-col leading-none pr-1">
                <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-akatsuki-muted group-hover:text-akatsuki-accent transition-colors">
                  ESTADO DEL NODO MÓVIL
                </span>
                <span className="font-display text-xs tracking-wider uppercase font-bold text-amber-300 group-hover:text-akatsuki-heading transition-colors mt-0.5">
                  SIN CONEXIÓN ANDROID
                </span>
              </div>
            </div>
          )}

          {/* Botón de Acción Principal (Conectar / Desconectar) */}
          {isConnected ? (
            <CyberButton
              variant="danger"
              size="md"
              onClick={disconnect}
              leftIcon={<Unplug className="w-4 h-4" />}
            >
              Desconectar
            </CyberButton>
          ) : (
            <CyberButton
              variant="primary"
              size="md"
              onClick={() => setRadarModalOpen(true)}
              leftIcon={<Radio className="w-4 h-4" />}
            >
              Conectar Android
            </CyberButton>
          )}

          {/* Separador Vertical */}
          <div className="h-6 w-[1px] bg-white/15 mx-1" />

          {/* Controles Nativos de Ventana (Minimizar, Maximizar/Restaurar, Cerrar) */}
          <div data-no-drag className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleWindowMinimize}
              title="Minimizar ventana"
              className="w-8 h-8 bg-akatsuki-panel cyber-chamfer-sm cyber-border-subtle hover:bg-akatsuki-elevated hover-cyber-border-cyan flex items-center justify-center text-akatsuki-body hover:text-akatsuki-cyan transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleWindowToggleMaximize}
              title={isMaximized ? "Restaurar ventana" : "Maximizar ventana"}
              className="w-8 h-8 bg-akatsuki-panel cyber-chamfer-sm cyber-border-subtle hover:bg-akatsuki-elevated hover-cyber-border-cyan flex items-center justify-center text-akatsuki-body hover:text-akatsuki-cyan transition-colors cursor-pointer"
            >
              {isMaximized ? (
                <Copy className="w-3.5 h-3.5 rotate-180" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleWindowClose}
              title="Cerrar aplicación"
              className="w-8 h-8 bg-akatsuki-primary-muted/70 cyber-chamfer-sm cyber-border-crimson hover:bg-akatsuki-danger hover-cyber-border-crimson flex items-center justify-center text-akatsuki-accent hover:text-akatsuki-heading transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
            title="NODO LOCAL"
            badgeLabel={localHostname}
            currentPath={localPath || "~"}
            entries={localEntries}
            loading={loadingLocal}
            connected={isConnected}
            errorMessage={localError}
            onNavigate={(newPath) => fetchLocalDir(newPath)}
            onNavigateUp={() => fetchLocalDir(navigateUp(localPath))}
            onRefresh={() => fetchLocalDir(localPath)}
            onTransferFile={handleSendToAndroid}
            onCreateFolder={handleCreateLocalFolder}
            onDeleteEntry={handleDeleteLocalEntry}
          />

          <FilePane
            side="android"
            title="NODO REMOTO"
            currentPath={androidPath}
            entries={androidEntries}
            loading={loadingAndroid}
            connected={isConnected}
            errorMessage={androidError}
            onNavigate={(newPath) => setAndroidPath(newPath)}
            onNavigateUp={() => setAndroidPath(navigateUp(androidPath))}
            onRefresh={() => {
              fetchAndroidDir(androidPath);
              refreshStorageInfo();
            }}
            onTransferFile={handleReceiveFromAndroid}
            onCreateFolder={handleCreateAndroidFolder}
            onDeleteEntry={handleDeleteAndroidEntry}
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
