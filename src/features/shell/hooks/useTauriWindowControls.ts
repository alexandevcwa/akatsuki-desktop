import React, { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Hook que encapsula los controles nativos de ventana sin decoración OS en Tauri v2.
 */
export function useTauriWindowControls() {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const syncMaximizedState = useCallback(async () => {
    try {
      const maximized = await getCurrentWindow().isMaximized();
      setIsMaximized(maximized);
    } catch {
      // Ignorar si se ejecuta fuera de contexto de ventana nativa
    }
  }, []);

  useEffect(() => {
    syncMaximizedState();
  }, [syncMaximizedState]);

  const minimizeWindow = useCallback(async () => {
    await getCurrentWindow().minimize();
  }, []);

  const toggleMaximizeWindow = useCallback(async () => {
    const win = getCurrentWindow();
    await win.toggleMaximize();
    const maximized = await win.isMaximized();
    setIsMaximized(maximized);
  }, []);

  const closeWindow = useCallback(async () => {
    await getCurrentWindow().close();
  }, []);

  const handleDragRegionMouseDown = useCallback(
    async (e: React.MouseEvent<HTMLElement>) => {
      // Evitar arrastrar si el clic ocurrió dentro de un botón o elemento interactivo
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("[data-no-drag]")) {
        return;
      }
      if (e.buttons === 1) {
        if (e.detail === 2) {
          await toggleMaximizeWindow();
        } else {
          await getCurrentWindow().startDragging();
        }
      }
    },
    [toggleMaximizeWindow],
  );

  return {
    isMaximized,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    handleDragRegionMouseDown,
  };
}
