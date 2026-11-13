import React from "react";
import { Radio, ShieldCheck, Smartphone, Unplug } from "lucide-react";
import { CyberButton, MonoHash, MonoTelemetry } from "@/design-system";
import { useConnectionStore } from "@/features/connection/store/useConnectionStore";
import { formatBytes, formatShortSha256 } from "@/shared/utils/formatters";

/**
 * Indicador táctico HUD del enlace con el dispositivo Android y acción de conexión/desconexión.
 */
export const ConnectionStatusHUD: React.FC = () => {
  const { status, activeSession, setRadarModalOpen, disconnect } =
    useConnectionStore();

  const isConnected = status === "connected" && activeSession !== null;

  return (
    <>
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
            <span className="font-display text-xs tracking-wider uppercase font-bold text-amber-300 group-hover:text-akatsuki-heading transition-colors mt-0.5">
              SIN CONEXIÓN
            </span>
          </div>
        </div>
      )}

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
    </>
  );
};
