import React, { useState } from "react";
import {
  HardDrive,
  Smartphone,
  CornerLeftUp,
  RefreshCw,
  Search,
  ShieldAlert,
  Radio,
} from "lucide-react";
import { FileEntry } from "@/shared/types/protocol";
import {
  CyberPanel,
  CyberButton,
  CyberBadge,
  CyberInput,
  MonoHash,
  BodyText,
} from "@/design-system";
import { FileRow } from "./FileRow";

interface FilePaneProps {
  side: "pc" | "android";
  title: string;
  badgeLabel?: string;
  currentPath: string;
  entries: FileEntry[];
  loading: boolean;
  connected: boolean;
  onNavigate: (newPath: string) => void;
  onNavigateUp: () => void;
  onRefresh: () => void;
  onTransferFile: (file: FileEntry) => void;
  onOpenConnectModal?: () => void;
}

export const FilePane: React.FC<FilePaneProps> = ({
  side,
  title,
  badgeLabel,
  currentPath,
  entries,
  loading,
  connected,
  onNavigate,
  onNavigateUp,
  onRefresh,
  onTransferFile,
  onOpenConnectModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const filteredEntries = entries.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <CyberPanel
      title={title}
      subtitle={currentPath}
      accentColor={side === "pc" ? "crimson" : "cyan"}
      className="flex-1 h-full min-h-0"
      headerRight={
        <div className="flex items-center gap-2">
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
      {/* Barra de Filtro y Ruta Actual */}
      <div className="p-2.5 bg-akatsuki-mantle/60 border-b border-white/10 flex items-center gap-2 shrink-0">
        <CyberInput
          placeholder={`Filtrar en ${side === "pc" ? "PC Local" : "Android Web Service"}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Cabecera de Tabla (List Header) */}
      <div className="px-3.5 py-1.5 bg-akatsuki-mantle border-b border-white/10 flex items-center justify-between font-display text-list-header uppercase text-akatsuki-muted shrink-0">
        <span>Nombre del Recurso ({filteredEntries.length})</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-block w-28 text-right">Modificado</span>
          <span className="w-20 text-right">Tamaño</span>
          <span className="w-24 text-right">Acción</span>
        </div>
      </div>

      {/* Cuerpo de Lista o Estado Desconectado */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {side === "android" && !connected ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-akatsuki-primary-muted/60 border border-akatsuki-primary flex items-center justify-center shadow-crimson-subtle">
              <ShieldAlert className="w-7 h-7 text-akatsuki-primary-glow" />
            </div>
            <div className="max-w-sm space-y-1.5">
              <p className="font-display text-heading-3 uppercase text-akatsuki-heading">
                Sin Enlace al Web Service Android
              </p>
              <BodyText className="text-xs text-akatsuki-muted">
                Inicia el servidor web en tu celular Android y vincúlalo mediante Radar mDNS o
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
          <div className="h-44 flex items-center justify-center">
            <MonoHash>NO SE ENCONTRARON ARCHIVOS EN ESTE DIRECTORIO</MonoHash>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <FileRow
              key={entry.path}
              entry={entry}
              side={side}
              selected={selectedPath === entry.path}
              onSelect={() => setSelectedPath(entry.path)}
              onOpenDir={() => onNavigate(entry.path)}
              onTransfer={() => onTransferFile(entry)}
              canTransfer={ connected}
            />
          ))
        )}
      </div>
    </CyberPanel>
  );
};
