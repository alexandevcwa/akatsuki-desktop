import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useAnimatedPresence } from "@/shared/utils/useAnimatedPresence";
import { cn } from "../utils/cn";

export interface CyberModalProps {
  open: boolean;
  onClose?: () => void;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  maxWidthClassName?: string;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Contenedor base para diálogos y mensajes modales mediante Portal a `document.body`.
 * Aplica un scrim oscuro compositado en GPU (sin `backdrop-filter`) para máximo rendimiento
 * en Tauri v2 tanto en Linux (WebKitGTK) como en Windows (WebView2).
 */
export const CyberModal: React.FC<CyberModalProps> = ({
  open,
  onClose,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  maxWidthClassName = "max-w-lg",
  ariaLabel,
  className,
  children,
}) => {
  const { shouldRender, isClosing } = useAnimatedPresence(open, 140);

  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 isolate"
    >
      {/* Capa independiente de oscurecimiento (animación 100% compositor GPU por opacidad) */}
      <div
        aria-hidden="true"
        onClick={() => {
          if (closeOnBackdropClick) {
            onClose?.();
          }
        }}
        className={cn(
          "cyber-modal-backdrop fixed inset-0",
          isClosing ? "animate-cyber-backdrop-out" : "animate-cyber-backdrop-in"
        )}
      />

      {/* Contenedor del diálogo (animación transform3d + opacity independiente del scrim) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full",
          maxWidthClassName,
          isClosing ? "animate-cyber-modal-out" : "animate-cyber-modal-in",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
