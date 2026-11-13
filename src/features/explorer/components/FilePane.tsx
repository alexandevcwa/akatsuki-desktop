import React, { useState } from "react";
import {
  HardDrive,
  Smartphone,
  CornerLeftUp,
  RefreshCw,
  Search,
  ShieldAlert,
  Radio,
  FolderPlus,
  Check,
  X,
} from "lucide-react";
import { FileEntry } from "@/shared/types/protocol";
import {
  CyberPanel,
  CyberButton,
  CyberBadge,
  CyberInput,
  CyberConfirmDialog,
  MonoHash,
  BodyText,
} from "@/design-system";
import { formatBytes } from "@/shared/utils/formatters";
import { FileRow } from "./FileRow";

interface FilePaneProps {
  side: "pc" | "android";
  title: string;
  badgeLabel?: string;
  currentPath: string;
  entries: FileEntry[];
  loading: boolean;
  connected: boolean;
  errorMessage?: string | null;
  onNavigate: (newPath: string) => void;
  onNavigateUp: () => void;
  onRefresh: () => void;
  onTransferFile: (file: FileEntry) => void | Promise<void>;
  onCreateFolder: (folderName: string) => Promise<void>;
  onDeleteEntry: (entry: FileEntry) => Promise<void>;
  onOpenConnectModal?: () => void;
}

interface PendingActionState {
  mode: "transfer" | "delete";
  entry: FileEntry;
}

export const FilePane: React.FC<FilePaneProps> = ({
  side,
  title,
  badgeLabel,
  currentPath,
  entries,
  loading,
  connected,
  errorMessage,
  onNavigate,
  onNavigateUp,
  onRefresh,
  onTransferFile,
  onCreateFolder,
  onDeleteEntry,
  onOpenConnectModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Estado de sombras dinámicas durante el scroll en la lista
  const [scrollShadowTop, setScrollShadowTop] = useState(false);
  const [scrollShadowBottom, setScrollShadowBottom] = useState(false);

  const filteredEntries = entries.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrollShadowTop(el.scrollTop > 6);
    setScrollShadowBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
  };

  const handleConfirmNewFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    await onCreateFolder(trimmed);
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleExecuteConfirmedAction = async () => {
    if (!pendingAction) return;
    setIsProcessingAction(true);
    try {
      if (pendingAction.mode === "delete") {
        await onDeleteEntry(pendingAction.entry);
      } else {
        await onTransferFile(pendingAction.entry);
      }
    } finally {
      setIsProcessingAction(false);
      setPendingAction(null);
    }
  };

  return (
    <>
      <CyberPanel
        title={title}
        subtitle={currentPath}
        accentColor={side === "pc" ? "crimson" : "cyan"}
        className="flex-1 h-full min-h-0"
        headerRight={
          <div className="flex items-center gap-1.5">
            <CyberBadge
              tone={side === "pc" ? "crimson" : connected ? "success" : "warning"}
              pulse={side === "pc" || connected}
              icon={
                side === "pc" ? (
                  <HardDrive className="w-3 h-3" />
                ) : (
                  <Smartphone className="w-3 h-3" />
                )
              }
            >
              {side === "pc"
                ? badgeLabel || "LOCAL HOST"
                : connected
                ? "HTTPS STREAM READY"
                : "DESCONECTADO"}
            </CyberBadge>
            {(side === "pc" || connected) && (
              <CyberButton
                variant="ghost"
                size="sm"
                onClick={() => setIsCreatingFolder((v) => !v)}
                title="Nueva Carpeta"
                leftIcon={<FolderPlus className="w-3.5 h-3.5" />}
              >
                Carpeta
              </CyberButton>
            )}
            <CyberButton
              variant="ghost"
              size="sm"
              onClick={onNavigateUp}
              title="Subir directorio"
              leftIcon={<CornerLeftUp className="w-3.5 h-3.5" />}
            >
              Subir
            </CyberButton>
            <CyberButton
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              title="Refrescar lista"
              leftIcon={
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              }
            >
              Sync
            </CyberButton>
          </div>
        }
      >
        {/* Barra de Filtro y Creación de Carpeta */}
        <div className="p-2.5 bg-akatsuki-mantle/60 border-b border-white/10 flex flex-col gap-2 shrink-0">
          <CyberInput
            placeholder={`Filtrar en ${side === "pc" ? "PC Local" : "Android Web Service"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />

          {isCreatingFolder && (
            <form
              onSubmit={handleConfirmNewFolder}
              className="animate-cyber-slide-down flex items-center gap-2"
            >
              <CyberInput
                placeholder="Nombre de la nueva carpeta..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
              <CyberButton
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Crear
              </CyberButton>
              <CyberButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName("");
                }}
                leftIcon={<X className="w-3.5 h-3.5" />}
              >
                Cancelar
              </CyberButton>
            </form>
          )}

          {errorMessage && (
            <div className="animate-cyber-slide-down px-2.5 py-1.5 bg-akatsuki-primary-muted border border-akatsuki-danger text-[11px] font-mono text-akatsuki-accent">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Cabecera de Tabla (List Header) */}
        <div className="px-3.5 py-1.5 bg-akatsuki-mantle border-b border-white/10 flex items-center justify-between font-display text-list-header uppercase text-akatsuki-muted shrink-0">
          <span>Nombre del Recurso ({filteredEntries.length})</span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block w-28 text-right">Modificado</span>
            <span className="w-20 text-right">Tamaño</span>
            <span className="w-32 text-right">Acciones</span>
          </div>
        </div>

        {/* Cuerpo de Lista con Sombras de Profundidad al Hacer Scroll */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          {/* Sombra superior dinámica al hacer scroll hacia abajo */}
          <div
            className={`pointer-events-none absolute top-0 inset-x-0 h-4 z-10 bg-gradient-to-b from-black/65 to-transparent transition-opacity duration-200 ${
              scrollShadowTop ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            onScroll={handleListScroll}
            className="flex-1 overflow-y-auto scroll-smooth divide-y divide-white/5"
          >
            {side === "android" && !connected ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 animate-cyber-row">
                <div className="w-14 h-14 rounded-full bg-akatsuki-primary-muted/60 border border-akatsuki-primary flex items-center justify-center shadow-crimson-subtle">
                  <ShieldAlert className="w-7 h-7 text-akatsuki-primary-glow" />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <p className="font-display text-heading-3 uppercase text-akatsuki-heading">
                    Sin Enlace al Web Service Android
                  </p>
                  <BodyText className="text-xs text-akatsuki-muted">
                    Inicia el servidor web en tu celular Android y vincúlalo mediante Radar LAN o
                    dirección IP:Puerto con verificación TLS.
                  </BodyText>
                </div>
                {onOpenConnectModal && (
                  <CyberButton
                    variant="primary"
                    onClick={onOpenConnectModal}
                    leftIcon={<Radio className="w-4 h-4" />}
                  >
                    Vincular Dispositivo Android
                  </CyberButton>
                )}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="h-44 flex items-center justify-center animate-cyber-row">
                <MonoHash>NO SE ENCONTRARON ARCHIVOS EN ESTE DIRECTORIO</MonoHash>
              </div>
            ) : (
              filteredEntries.map((entry, idx) => (
                <FileRow
                  key={entry.path}
                  index={idx}
                  entry={entry}
                  side={side}
                  selected={selectedPath === entry.path}
                  onSelect={() => setSelectedPath(entry.path)}
                  onOpenDir={() => onNavigate(entry.path)}
                  onTransfer={() => setPendingAction({ mode: "transfer", entry })}
                  onDelete={() => setPendingAction({ mode: "delete", entry })}
                  canTransfer={connected}
                />
              ))
            )}
          </div>

          {/* Sombra inferior dinámica mientras haya más elementos abajo */}
          <div
            className={`pointer-events-none absolute bottom-0 inset-x-0 h-5 z-10 bg-gradient-to-t from-black/65 to-transparent transition-opacity duration-200 ${
              scrollShadowBottom ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      </CyberPanel>

      {/* Diálogo Táctico de Confirmación para Enviar/Recibir o Eliminar */}
      <CyberConfirmDialog
        open={pendingAction !== null}
        mode={pendingAction?.mode || "transfer"}
        title={
          pendingAction?.mode === "delete"
            ? "CONFIRMAR ELIMINACIÓN DE RECURSO"
            : side === "pc"
            ? "CONFIRMAR ENVÍO A ANDROID"
            : "CONFIRMAR RECEPCIÓN EN COMPUTADORA"
        }
        subtitle={
          pendingAction?.mode === "delete"
            ? `NODO: ${side === "pc" ? badgeLabel || "COMPUTADORA LOCAL" : "ANDROID WEB SERVICE"}`
            : "TRANSFERENCIA VERIFICADA CON HASH SHA-256 END-TO-END"
        }
        description={
          pendingAction?.mode === "delete"
            ? pendingAction.entry.isDir
              ? "¿Estás seguro de que deseas eliminar permanentemente este directorio y todo su contenido? Esta operación no se puede deshacer."
              : "¿Estás seguro de que deseas eliminar permanentemente este archivo del almacenamiento? Esta operación no se puede deshacer."
            : side === "pc"
            ? "El archivo seleccionado será enviado por streaming cifrado HTTPS hacia el directorio activo de tu dispositivo Android."
            : "El archivo seleccionado será descargado desde tu dispositivo Android hacia el directorio activo de tu computadora."
        }
        resourceName={pendingAction?.entry.name || ""}
        resourcePath={pendingAction?.entry.path || ""}
        resourceTypeLabel={pendingAction?.entry.isDir ? "DIRECTORIO" : "ARCHIVO"}
        resourceSizeLabel={
          pendingAction?.entry.isDir
            ? "CARPETA"
            : formatBytes(pendingAction?.entry.sizeBytes || 0)
        }
        targetLocationLabel={
          pendingAction?.mode === "transfer"
            ? side === "pc"
              ? "Dispositivo Android (Directorio Activo)"
              : `Computadora (${badgeLabel || "Local"})`
            : undefined
        }
        confirmText={
          pendingAction?.mode === "delete"
            ? "Sí, Eliminar"
            : side === "pc"
            ? "Confirmar Envío"
            : "Confirmar Recepción"
        }
        isProcessing={isProcessingAction}
        onConfirm={handleExecuteConfirmedAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
};
