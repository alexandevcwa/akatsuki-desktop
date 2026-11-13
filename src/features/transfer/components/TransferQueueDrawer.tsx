import React from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  CyberPanel,
  CyberBadge,
  CyberButton,
  MonoHash,
} from "@/design-system";
import { useTransferStore } from "../store/useTransferStore";
import { formatBytes, formatShortSha256, formatSpeed } from "@/shared/utils/formatters";
import { TransferTask } from "@/shared/types/protocol";

function renderStatusLabel(task: TransferTask): React.ReactNode {
  switch (task.status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px] font-semibold">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          COMPLETADO
        </span>
      );
    case "failed":
      return (
        <span
          title={task.errorMessage || "Error en la transferencia"}
          className="inline-flex items-center gap-1 text-akatsuki-danger font-mono text-[11px] font-semibold"
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          ERROR
        </span>
      );
    case "hashing_local":
      return (
        <span className="inline-flex items-center gap-1 text-purple-300 font-mono text-[11px]">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          HASH SHA-256
        </span>
      );
    case "verifying_sha256":
      return (
        <span className="inline-flex items-center gap-1 text-akatsuki-cyan font-mono text-[11px]">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          VERIFICANDO
        </span>
      );
    default:
      return (
        <span className="font-mono text-[11px] text-akatsuki-telemetry tabular-nums">
          {formatSpeed(task.speedBytesPerSec)}
        </span>
      );
  }
}

export const TransferQueueDrawer: React.FC = () => {
  const { tasks, clearCompleted } = useTransferStore();

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const activeCount = tasks.filter(
    (t) => t.status === "streaming" || t.status === "hashing_local" || t.status === "queued"
  ).length;

  return (
    <CyberPanel
      title="REGISTRO DE TRANSFERENCIAS & TELEMETRÍA"
      accentColor="purple"
      className="h-44 shrink-0"
      headerRight={
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <CyberBadge tone="cyan" pulse>
              {activeCount} EN CURSO
            </CyberBadge>
          )}
          <CyberBadge tone="purple" icon={<Activity className="w-3 h-3" />}>
            {tasks.length} REGISTROS
          </CyberBadge>
          {completedCount > 0 && (
            <CyberButton
              variant="ghost"
              size="sm"
              onClick={clearCompleted}
              leftIcon={<Trash2 className="w-3 h-3" />}
            >
              Limpiar ({completedCount})
            </CyberButton>
          )}
        </div>
      }
    >
      {/* Cabecera Compacta de Columnas (1 sola línea alineada) */}
      <div className="px-3.5 py-1 bg-akatsuki-mantle/90 border-b border-white/10 flex items-center gap-3 font-display text-[10px] font-bold uppercase tracking-wider text-akatsuki-muted shrink-0 whitespace-nowrap">
        <span className="w-24 shrink-0">Dirección</span>
        <span className="flex-1 min-w-0">Archivo</span>
        <span className="w-36 shrink-0">Progreso</span>
        <span className="hidden md:inline-block w-32 shrink-0 text-right">Volumen</span>
        <span className="w-28 shrink-0 text-right">Estado / Vel.</span>
        <span className="hidden xl:inline-block w-36 shrink-0 text-right">Integridad SHA-256</span>
      </div>

      {/* Lista de Logs de Transferencia (1 fila compacta por operación) */}
      <div className="cyber-scroll-container flex-1 overflow-y-auto divide-y divide-white/5">
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-between px-3.5 text-akatsuki-muted">
            <MonoHash className="text-[11px]">
              SIN OPERACIONES RECIENTES // SELECCIONA "ENVIAR" O "RECIBIR" EN CUALQUIER ARCHIVO
            </MonoHash>
            <MonoHash className="hidden sm:inline text-[11px] text-akatsuki-telemetry/80">
              CANAL CIFRADO TLS 1.3 • VERIFICACIÓN SHA-256 ACTIVA
            </MonoHash>
          </div>
        ) : (
          tasks.map((task) => {
            const percent =
              task.totalBytes > 0
                ? Math.min(100, Math.round((task.transferredBytes / task.totalBytes) * 100))
                : 0;
            const isUpload = task.direction === "pc_to_android";

            return (
              <div
                key={task.id}
                title={`${task.sourcePath} → ${task.destinationPath}`}
                className="cyber-file-row animate-cyber-slide-down h-7 px-3.5 flex items-center gap-3 hover:bg-akatsuki-elevated/60 transition-colors whitespace-nowrap"
              >
                {/* 1. Dirección Compacta */}
                <div className="w-24 shrink-0 flex items-center">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase border ${
                      isUpload
                        ? "bg-akatsuki-primary-muted/80 text-akatsuki-accent border-akatsuki-primary/50"
                        : "bg-akatsuki-cyan/10 text-akatsuki-telemetry border-akatsuki-cyan/40"
                    }`}
                  >
                    {isUpload ? (
                      <>
                        <ArrowUpRight className="w-3 h-3 text-akatsuki-primary-glow shrink-0" />
                        PC → MOV
                      </>
                    ) : (
                      <>
                        <ArrowDownLeft className="w-3 h-3 text-akatsuki-cyan shrink-0" />
                        MOV → PC
                      </>
                    )}
                  </span>
                </div>

                {/* 2. Nombre del Archivo (Truncado en 1 línea sin desbordar) */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-sans text-[12px] font-medium text-akatsuki-heading truncate">
                    {task.fileName}
                  </span>
                  {task.status === "failed" && task.errorMessage && (
                    <span className="text-[10px] font-mono text-akatsuki-accent truncate">
                      ({task.errorMessage})
                    </span>
                  )}
                </div>

                {/* 3. Barra de Progreso + Porcentaje en la misma línea */}
                <div className="w-36 shrink-0 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-akatsuki-mantle border border-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-150 ${
                        task.status === "completed"
                          ? "bg-akatsuki-success"
                          : task.status === "failed"
                          ? "bg-akatsuki-danger"
                          : isUpload
                          ? "bg-akatsuki-primary"
                          : "bg-akatsuki-cyan"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[11px] text-akatsuki-heading tabular-nums">
                    {percent}%
                  </span>
                </div>

                {/* 4. Volumen Transferido / Total */}
                <div className="hidden md:block w-32 shrink-0 text-right font-mono text-[11px] text-akatsuki-body tabular-nums">
                  {formatBytes(task.transferredBytes, 1)} / {formatBytes(task.totalBytes, 1)}
                </div>

                {/* 5. Estado / Velocidad */}
                <div className="w-28 shrink-0 text-right flex items-center justify-end">
                  {renderStatusLabel(task)}
                </div>

                {/* 6. Hash SHA-256 Compacto */}
                <div className="hidden xl:flex w-36 shrink-0 items-center justify-end gap-1 text-right">
                  <ShieldCheck
                    className={`w-3 h-3 shrink-0 ${
                      task.sha256Checksum ? "text-akatsuki-purple" : "text-akatsuki-muted/50"
                    }`}
                  />
                  <span className="font-mono text-[10px] text-akatsuki-muted truncate tabular-nums">
                    {formatShortSha256(task.sha256Checksum)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </CyberPanel>
  );
};
