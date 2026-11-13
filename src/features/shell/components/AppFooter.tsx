import React from "react";
import { Cpu } from "lucide-react";
import { MonoHash } from "@/design-system";

/**
 * Barra de estado inferior con telemetría del núcleo Rust y verificación criptográfica.
 */
export const AppFooter: React.FC = () => {
  return (
    <footer className="h-7 px-4 bg-akatsuki-mantle border-t border-white/10 flex items-center justify-between text-mono-hash shrink-0">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-akatsuki-accent font-mono">
          <Cpu className="w-3 h-3" />
          RUST CORE 1.96 // REQWEST + RUSTLS + TOKIO STREAM
        </span>
        <span className="text-white/20">|</span>
        <MonoHash>THEME: AKATSUKI CYBERPUNK v1.0</MonoHash>
      </div>
      <div className="flex items-center gap-3">
        <MonoHash>INTEGRIDAD DE ARCHIVOS: SHA-256 END-TO-END</MonoHash>
      </div>
    </footer>
  );
};
