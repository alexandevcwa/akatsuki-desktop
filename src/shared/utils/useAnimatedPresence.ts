import { useEffect, useState } from "react";

/**
 * Controla el ciclo de vida de montaje y desmontaje animado para modales y paneles desplegables.
 * Permite reproducir la animación de salida (`exiting`) antes de desmontar el nodo del DOM.
 */
export function useAnimatedPresence(isOpen: boolean, durationMs = 220) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [stage, setStage] = useState<"entering" | "entered" | "exiting">(
    isOpen ? "entered" : "exiting"
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const raf = requestAnimationFrame(() => {
        setStage("entering");
        const enterTimer = setTimeout(() => setStage("entered"), durationMs);
        return () => clearTimeout(enterTimer);
      });
      return () => cancelAnimationFrame(raf);
    } else if (shouldRender) {
      setStage("exiting");
      const exitTimer = setTimeout(() => {
        setShouldRender(false);
      }, durationMs);
      return () => clearTimeout(exitTimer);
    }
  }, [isOpen, durationMs, shouldRender]);

  return {
    shouldRender,
    isClosing: stage === "exiting",
    stage,
  };
}
