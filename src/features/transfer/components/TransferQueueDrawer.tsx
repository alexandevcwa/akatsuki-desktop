import React from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Trash2,
} from "lucide-react";
import {
  CyberPanel,
  CyberBadge,
  CyberButton,
  ListItemText,
  MonoTelemetry,
  MonoHash,
} from "@/design-system";
import { useTransferStore } from "../store/useTransferStore";
import { formatBytes, formatShortSha256, formatSpeed } from "@/shared/utils/formatters";

export const TransferQueueDrawer: React.FC = () => {
  const { tasks, clearCompleted } = useTransferStore();

  return (
    <CyberPanel
      title="COLA DE TELEMETRÍA & STREAMING // VERIFICACIÓN SHA-256"
      accentColor="purple"
      className="h-44 shrink-0"
      headerRight={
        <div className="flex items-center gap-2">
          <CyberBadge tone="purple" icon={<Activity className="w-3 h-3" />}>
            {tasks.length} OPERACIONES
          </CyberBadge>
          {tasks.some((t) => t.status === "completed") && (
            <CyberButton
              variant="ghost"
              size="sm"
              onClick={clearCompleted}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Limpiar Completados
            </CyberButton>
          )}
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto scroll-smooth divide-y divide-white/5 px-3 py-1.5">
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-between px-2 text-akatsuki-muted animate-cyber-row">
            <MonoHash>
              CANAL DE TRANSFERENCIA INACTIVO // SELECCIONA "ENVIAR" O "RECIBIR" EN CUALQUIER ARCHIVO
            </MonoHash>
            <MonoTelemetry>STREAM ENGINE: TOKIO ASYNC + RUSTLS 1.3</MonoTelemetry>
          </div>
        ) : (
          tasks.map((task) => {
            const percent =
              task.totalBytes > 0
                ? Math.min(100, Math.round((task.transferredBytes / task.totalBytes) * 100))
                : 0;

            return (
              <div key={task.id} className="animate-cyber-slide-down py-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {task.direction === "pc_to_android" ? (
                      <ArrowUpRight className="w-4 h-4 text-akatsuki-primary-glow shrink-0" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4 text-akatsuki-cyan shrink-0" />
                    )}
                    <ListItemText className="font-semibold text-akatsuki-heading truncate">
                      {task.fileName}
                    </ListItemText>
                    <CyberBadge
                      tone={task.direction === "pc_to_android" ? "crimson" : "cyan"}
                    >
                      {task.direction === "pc_to_android" ? "PC → ANDROID" : "ANDROID → PC"}
                    </CyberBadge>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden md:flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-akatsuki-purple" />
                      <MonoHash>SHA256: {formatShortSha256(task.sha256Checksum)}</MonoHash>
                    </div>
                    <MonoTelemetry>
                      {task.status === "completed"
                        ? "VERIFICADO"
                        : formatSpeed(task.speedBytesPerSec)}
                    </MonoTelemetry>
                    <MonoTelemetry className="w-28 text-right">
                      {formatBytes(task.transferredBytes)} / {formatBytes(task.totalBytes)} (
                      {percent}%)
                    </MonoTelemetry>
                    {task.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-akatsuki-success" />
                    )}
                  </div>
                </div>

                {/* Barra de progreso Cyberpunk */}
                <div className="w-full h-1.5 bg-akatsuki-mantle overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      task.status === "completed"
                        ? "bg-akatsuki-success"
                        : task.direction === "pc_to_android"
                        ? "bg-akatsuki-primary shadow-crimson-glow"
                        : "bg-akatsuki-cyan shadow-cyan-glow"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </CyberPanel>
  );
};
