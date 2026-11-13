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
import { ListItemText, MonoTelemetry, MonoHash, CyberButton } from "@/design-system";
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
 * Fila de archivo optimizada a 60/144 FPS:
 * - Cero cambios de `padding` o `margin` en hover (evita Layout Reflow).
 * - El desplazamiento táctico usa exclusivamente `transform: translate3d` (GPU Composite).
 * - La cascada de entrada se aplica únicamente a las primeras 14 filas visibles del viewport.
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
          <Folder className="w-4 h-4 text-akatsuki-primary-glow fill-akatsuki-primary/20 shrink-0" />
        );
      }
      const ext = entry.extension?.toLowerCase() || "";
      if (["mp4", "mkv", "mov", "webm"].includes(ext)) {
        return <Film className="w-4 h-4 text-akatsuki-cyan shrink-0" />;
      }
      if (["png", "jpg", "jpeg", "webp", "raw", "dng", "svg"].includes(ext)) {
        return <ImageIcon className="w-4 h-4 text-akatsuki-purple shrink-0" />;
      }
      if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
        return <Archive className="w-4 h-4 text-akatsuki-warning shrink-0" />;
      }
      return <FileText className="w-4 h-4 text-akatsuki-body shrink-0" />;
    };

    const shouldAnimateEntry = index < 14;

    return (
      <div
        style={
          shouldAnimateEntry ? { animationDelay: `${index * 12}ms` } : undefined
        }
        onClick={onSelect}
        onDoubleClick={() => {
          if (entry.isDir) onOpenDir();
        }}
        className={`cyber-file-row relative group px-3.5 py-2 border-b border-white/5 flex items-center justify-between gap-3 transition-colors duration-100 cursor-pointer ${
          shouldAnimateEntry ? "animate-cyber-row" : ""
        } ${
          selected
            ? "bg-akatsuki-primary-muted/75"
            : "hover:bg-akatsuki-elevated/75"
        }`}
      >
        {/* Indicador lateral GPU sin alterar el layout (sustituye border-l/padding) */}
        <span
          className={`absolute left-0 inset-y-0 w-[2.5px] bg-akatsuki-primary-glow transition-transform duration-150 origin-center ${
            selected ? "scale-y-100" : "scale-y-0 group-hover:scale-y-75"
          }`}
        />

        <div className="flex items-center gap-2.5 min-w-0 flex-1 transition-transform duration-150 ease-out group-hover:translate-x-1">
          {renderFileIcon()}
          <ListItemText
            className={`truncate ${
              entry.isDir
                ? "font-semibold text-akatsuki-heading group-hover:text-akatsuki-accent"
                : "text-akatsuki-body group-hover:text-akatsuki-heading"
            }`}
          >
            {entry.name}
          </ListItemText>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <MonoHash className="hidden sm:inline-block w-28 text-right">
            {entry.modifiedAt}
          </MonoHash>

          <MonoTelemetry className="w-20 text-right">
            {entry.isDir ? "DIR" : formatBytes(entry.sizeBytes)}
          </MonoTelemetry>

          <div className="w-32 flex items-center justify-end gap-1.5">
            {!entry.isDir ? (
              <CyberButton
                variant={side === "pc" ? "primary" : "secondary"}
                size="sm"
                disabled={!canTransfer}
                onClick={(e) => {
                  e.stopPropagation();
                  onTransfer();
                }}
                leftIcon={
                  side === "pc" ? undefined : <ArrowLeft className="w-3 h-3" />
                }
                rightIcon={
                  side === "pc" ? <ArrowRight className="w-3 h-3" /> : undefined
                }
              >
                {side === "pc" ? "Enviar" : "Recibir"}
              </CyberButton>
            ) : (
              <CyberButton
                variant="ghost"
                size="sm"
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
              className="p-1.5 text-akatsuki-muted hover:text-akatsuki-danger transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);
