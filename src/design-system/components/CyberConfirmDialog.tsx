import React, { useEffect } from "react";
import { AlertTriangle, ArrowRightLeft, Trash2, X } from "lucide-react";
import { useAnimatedPresence } from "@/shared/utils/useAnimatedPresence";
import { CyberPanel } from "./CyberPanel";
import { CyberButton } from "./CyberButton";
import { CyberBadge } from "./CyberBadge";
import { BodyText, Heading3, MonoHash, MonoTelemetry } from "./Typography";

export interface CyberConfirmDialogProps {
  open: boolean;
  mode: "transfer" | "delete";
  title: string;
  subtitle?: string;
  description: string;
  resourceName: string;
  resourcePath: string;
  resourceTypeLabel: string;
  resourceSizeLabel: string;
  targetLocationLabel?: string;
  confirmText: string;
  cancelText?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal táctico de confirmación Akatsuki Cyberpunk con animación fluida de entrada y salida.
 */
export const CyberConfirmDialog: React.FC<CyberConfirmDialogProps> = ({
  open,
  mode,
  title,
  subtitle,
  description,
  resourceName,
  resourcePath,
  resourceTypeLabel,
  resourceSizeLabel,
  targetLocationLabel,
  confirmText,
  cancelText = "Cancelar Operación",
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  const { shouldRender, isClosing } = useAnimatedPresence(open, 200);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isProcessing, onCancel]);

  if (!shouldRender) return null;

  const isDelete = mode === "delete";

  return (
    <div
      onClick={() => {
        if (!isProcessing) onCancel();
      }}
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 ${
        isClosing ? "animate-cyber-backdrop-out" : "animate-cyber-backdrop-in"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg ${
          isClosing ? "animate-cyber-modal-out" : "animate-cyber-modal-in"
        }`}
      >
        <CyberPanel
          title={title}
          subtitle={subtitle}
          accentColor={isDelete ? "crimson" : "cyan"}
          className="shadow-crimson-glow"
          headerRight={
            <CyberButton
              variant="ghost"
              size="sm"
              disabled={isProcessing}
              onClick={onCancel}
              leftIcon={<X className="w-4 h-4" />}
            >
              Cerrar
            </CyberButton>
          }
        >
          <div className="p-5 space-y-4">
            {/* Cabecera de Alerta / Confirmación */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 shrink-0 cyber-chamfer-sm flex items-center justify-center ${
                  isDelete
                    ? "bg-akatsuki-primary-muted cyber-border-crimson text-akatsuki-primary-glow"
                    : "bg-akatsuki-panel cyber-border-cyan text-akatsuki-cyan"
                }`}
              >
                {isDelete ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ArrowRightLeft className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Heading3 className={isDelete ? "text-akatsuki-accent" : "text-akatsuki-telemetry"}>
                    {isDelete
                      ? "ADVERTENCIA DE SEGURIDAD // ACCIÓN IRREVERSIBLE"
                      : "CONTROL DE FLUJO DE TRANSFERENCIA"}
                  </Heading3>
                </div>
                <BodyText className="text-xs text-akatsuki-body leading-relaxed">
                  {description}
                </BodyText>
              </div>
            </div>

            {/* Tarjeta de Telemetría del Recurso */}
            <div
              className={`p-3.5 bg-akatsuki-mantle cyber-chamfer-sm space-y-2 ${
                isDelete ? "cyber-border-crimson" : "cyber-border-subtle"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-button-sm text-akatsuki-heading truncate">
                  {resourceName}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CyberBadge tone={isDelete ? "crimson" : "cyan"}>
                    {resourceTypeLabel}
                  </CyberBadge>
                  <MonoTelemetry>{resourceSizeLabel}</MonoTelemetry>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <MonoHash className="uppercase text-akatsuki-muted">Ruta Origen:</MonoHash>
                  <MonoHash className="text-akatsuki-body truncate max-w-[320px]">
                    {resourcePath}
                  </MonoHash>
                </div>

                {targetLocationLabel && (
                  <div className="flex items-center justify-between gap-2">
                    <MonoHash className="uppercase text-akatsuki-muted">Destino:</MonoHash>
                    <MonoTelemetry className="truncate max-w-[320px]">
                      {targetLocationLabel}
                    </MonoTelemetry>
                  </div>
                )}
              </div>
            </div>

            {/* Botonera de Decisión */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <CyberButton
                type="button"
                variant="ghost"
                size="md"
                disabled={isProcessing}
                onClick={onCancel}
              >
                {cancelText}
              </CyberButton>

              <CyberButton
                type="button"
                variant={isDelete ? "danger" : "primary"}
                size="md"
                disabled={isProcessing}
                onClick={onConfirm}
                leftIcon={
                  isDelete ? (
                    <Trash2 className="w-4 h-4" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4" />
                  )
                }
              >
                {isProcessing ? "Procesando..." : confirmText}
              </CyberButton>
            </div>
          </div>
        </CyberPanel>
      </div>
    </div>
  );
};
