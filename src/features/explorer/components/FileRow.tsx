import React from "react";
import {
  Folder,
  FileText,
  Film,
  Image as ImageIcon,
  Archive,
  ArrowRight,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { FileEntry } from "@/shared/types/protocol";
import { ListItemText, ListMetaText, CyberButton } from "@/design-system";
import { formatBytes } from "@/shared/utils/formatters";

interface FileRowProps {
  entry: FileEntry;
  index: number;
  side: "pc" | "android";
  selected: boolean;
  onSelect: () => void;
  onOpenDir: () => void;
  onTransfer: () => void;
  onDelete: () => void;
  canTransfer: boolean;
}

/**
 * Fila compacta de alta densidad (h-8 / 32px) basada estrictamente en los tokens del Sistema de Diseño:
 * - `ListItemText` (12px) para el nombre en 1 sola línea truncada.
 * - `ListMetaText` (11px tabular-nums whitespace-nowrap) para Fecha/Hora y Tamaño en 1 sola línea.
 * - `CyberButton size="xs"` (11px) para acciones tácticas sin saturar la vista.
 */
export const FileRow: React.FC<FileRowProps> = React.memo(
  ({
    entry,
    index,
    side,
    selected,
    onSelect,
    onOpenDir,
    onTransfer,
    onDelete,
    canTransfer,
  }) => {
    const renderFileIcon = () => {
      if (entry.isDir) {
        return (
          <Folder className="w-3.5 h-3.5 text-akatsuki-primary-glow fill-akatsuki-primary/20 shrink-0" />
        );
      }
      const ext = entry.extension?.toLowerCase() || "";
      if (["mp4", "mkv", "mov", "webm"].includes(ext)) {
        return <Film className="w-3.5 h-3.5 text-akatsuki-cyan shrink-0" />;
      }
      if (["png", "jpg", "jpeg", "webp", "raw", "dng", "svg"].includes(ext)) {
        return <ImageIcon className="w-3.5 h-3.5 text-akatsuki-purple shrink-0" />;
      }
      if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
        return <Archive className="w-3.5 h-3.5 text-akatsuki-warning shrink-0" />;
      }
      return <FileText className="w-3.5 h-3.5 text-akatsuki-body shrink-0" />;
    };

    const shouldAnimateEntry = index < 16;

    return (
      <div
        style={
          shouldAnimateEntry ? { animationDelay: `${index * 10}ms` } : undefined
        }
        onClick={onSelect}
        onDoubleClick={() => {
          if (entry.isDir) onOpenDir();
        }}
        className={`cyber-file-row relative group h-8 px-3 border-b border-white/5 flex items-center justify-between gap-3 whitespace-nowrap transition-colors duration-100 cursor-pointer ${
          shouldAnimateEntry ? "animate-cyber-row" : ""
        } ${
          selected
            ? "bg-akatsuki-primary-muted/75"
            : "hover:bg-akatsuki-elevated/75"
        }`}
      >
        {/* Indicador lateral GPU sin alterar el layout */}
        <span
          className={`absolute left-0 inset-y-0 w-[2px] bg-akatsuki-primary-glow transition-transform duration-150 origin-center ${
            selected ? "scale-y-100" : "scale-y-0 group-hover:scale-y-75"
          }`}
        />

        {/* Columna 1: Icono + Nombre del Recurso (Truncado en 1 línea) */}
        <div className="flex items-center gap-2 min-w-0 flex-1 transition-transform duration-150 ease-out group-hover:translate-x-1">
          {renderFileIcon()}
          <ListItemText
            title={entry.name}
            className={`truncate ${
              entry.isDir
                ? "font-semibold text-akatsuki-heading group-hover:text-akatsuki-accent"
                : "text-akatsuki-body group-hover:text-akatsuki-heading"
            }`}
          >
            {entry.name}
          </ListItemText>
        </div>

        {/* Columnas Derechas: Fecha/Hora (1 línea), Tamaño y Acciones Compactas */}
        <div className="flex items-center gap-3.5 shrink-0">
          <ListMetaText className="hidden sm:block w-32 text-right shrink-0 overflow-hidden text-ellipsis">
            {entry.modifiedAt}
          </ListMetaText>

          <ListMetaText
            className={`block w-20 text-right shrink-0 overflow-hidden text-ellipsis ${
              entry.isDir ? "text-akatsuki-muted" : "text-akatsuki-telemetry"
            }`}
          >
            {entry.isDir ? "CARPETA" : formatBytes(entry.sizeBytes, 1)}
          </ListMetaText>

          <div className="w-28 flex items-center justify-end gap-1.5 shrink-0">
            {!entry.isDir ? (
              <CyberButton
                variant={side === "pc" ? "primary" : "secondary"}
                size="xs"
                disabled={!canTransfer}
                onClick={(e) => {
                  e.stopPropagation();
                  onTransfer();
                }}
                leftIcon={
                  side === "pc" ? undefined : <ArrowLeft className="w-2.5 h-2.5" />
                }
                rightIcon={
                  side === "pc" ? <ArrowRight className="w-2.5 h-2.5" /> : undefined
                }
              >
                {side === "pc" ? "Enviar" : "Recibir"}
              </CyberButton>
            ) : (
              <CyberButton
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDir();
                }}
              >
                Abrir
              </CyberButton>
            )}

            <button
              type="button"
              title={`Eliminar ${entry.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="shrink-0 p-1 text-akatsuki-muted hover:text-akatsuki-danger transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);
