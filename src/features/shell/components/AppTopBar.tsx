import React from "react";
import { AkatsukiCloudIcon, Heading1 } from "@/design-system";
import { ConnectionStatusHUD } from "@/features/connection/components/ConnectionStatusHUD";
import { useTauriWindowControls } from "../hooks/useTauriWindowControls";
import { WindowControls } from "./WindowControls";

/**
 * Topbar táctico HUD y barra de ventana personalizada arrastrable.
 */
export const AppTopBar: React.FC = () => {
  const {
    isMaximized,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    handleDragRegionMouseDown,
  } = useTauriWindowControls();

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleDragRegionMouseDown}
      className="h-16 px-5 bg-akatsuki-mantle/95 border-b border-white/10 flex items-center justify-between gap-4 shrink-0 cursor-default"
    >
      {/* Identidad Visual Akatsuki */}
      <div data-tauri-drag-region className="flex items-center gap-4">
        <div className="flex items-center justify-center py-1 pointer-events-none">
          <AkatsukiCloudIcon className="h-11 w-auto" />
        </div>
        <Heading1
          data-tauri-drag-region
          className="tracking-widest pointer-events-none"
        >
          Akatsuki // Shinobi Cyberlink
        </Heading1>
      </div>

      {/* Panel Derecho: Estado de Enlace + Acción de Conexión + Controles de Ventana */}
      <div className="flex items-center gap-3">
        <ConnectionStatusHUD />
        <div className="h-6 w-[1px] bg-white/15 mx-1" />
        <WindowControls
          isMaximized={isMaximized}
          onMinimize={minimizeWindow}
          onToggleMaximize={toggleMaximizeWindow}
          onClose={closeWindow}
        />
      </div>
    </header>
  );
};
