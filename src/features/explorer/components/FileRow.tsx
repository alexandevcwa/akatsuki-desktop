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
  side: "pc" | "android";
  selected: boolean;
  onSelect: () => void;
  onOpenDir: () => void;
  onTransfer: () => void;
  onDelete: () => void;
  canTransfer: boolean;
}

export const FileRow: React.FC<FileRowProps> = ({
  entry,
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

  return (
    <div
      onClick={onSelect}
      onDoubleClick={() => {
        if (entry.isDir) onOpenDir();
      }}
      className={`group px-3.5 py-2 border-b border-white/5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
        selected
          ? "bg-akatsuki-primary-muted/75 border-l-2 border-l-akatsuki-primary-glow"
          : "hover:bg-akatsuki-elevated/70"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {renderFileIcon()}
        <ListItemText
          className={`truncate ${
            entry.isDir ? "font-semibold text-akatsuki-heading" : "text-akatsuki-body"
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
              className="opacity-85 group-hover:opacity-100"
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
            className="p-1.5 text-akatsuki-muted hover:text-akatsuki-danger transition-colors opacity-60 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
