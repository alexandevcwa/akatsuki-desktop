import React from "react";
import { Copy, Minus, Square, X } from "lucide-react";

interface WindowControlsProps {
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}

/**
 * Botones nativos personalizados de la barra de título (Minimizar, Maximizar/Restaurar, Cerrar).
 */
export const WindowControls: React.FC<WindowControlsProps> = ({
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose,
}) => {
  return (
    <div data-no-drag className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onMinimize}
        title="Minimizar ventana"
        className="w-8 h-8 bg-akatsuki-panel cyber-chamfer-sm cyber-border-subtle hover:bg-akatsuki-elevated hover-cyber-border-cyan flex items-center justify-center text-akatsuki-body hover:text-akatsuki-cyan transition-colors cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={onToggleMaximize}
        title={isMaximized ? "Restaurar ventana" : "Maximizar ventana"}
        className="w-8 h-8 bg-akatsuki-panel cyber-chamfer-sm cyber-border-subtle hover:bg-akatsuki-elevated hover-cyber-border-cyan flex items-center justify-center text-akatsuki-body hover:text-akatsuki-cyan transition-colors cursor-pointer"
      >
        {isMaximized ? (
          <Copy className="w-3.5 h-3.5 rotate-180" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={onClose}
        title="Cerrar aplicación"
        className="w-8 h-8 bg-akatsuki-primary-muted/70 cyber-chamfer-sm cyber-border-crimson hover:bg-akatsuki-danger hover-cyber-border-crimson flex items-center justify-center text-akatsuki-accent hover:text-akatsuki-heading transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
