import { useEffect, useState } from "react";

/**
 * Controla el ciclo de vida de montaje y desmontaje animado a 60/144 FPS sin bloqueos de doble render.
 */
export function useAnimatedPresence(isOpen: boolean, exitDurationMs = 150) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }
    if (shouldRender) {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, exitDurationMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, exitDurationMs, shouldRender]);

  return {
    shouldRender: isOpen || shouldRender,
    isClosing: !isOpen && shouldRender,
  };
}
