import React from "react";
import akatsukiLogo from "@/assets/akatsuki-logo.png";

interface AkatsukiCloudIconProps {
  className?: string;
  glow?: boolean;
}

/**
 * Renderiza el logo oficial original de Akatsuki (PNG transparente) con tratamiento
 * multicapa de profundidad, halo radial atmosférico y sombreado de contorno.
 */
export const AkatsukiCloudIcon: React.FC<AkatsukiCloudIconProps> = ({
  className = "h-11 w-auto",
  glow = true,
}) => {
  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Halo atmosférico radial detrás de la silueta transparente para integrarlo al fondo oscuro */}
      {glow && (
        <span
          aria-hidden="true"
          className="absolute -inset-2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(225,29,72,0.32)_0%,rgba(255,30,77,0.12)_45%,transparent_75%)] blur-sm pointer-events-none"
        />
      )}
      <img
        src={akatsukiLogo}
        alt="Akatsuki Logo"
        draggable={false}
        className={`relative z-10 object-contain select-none transition-transform duration-200 ${className} ${
          glow
            ? "[filter:drop-shadow(0_2px_3px_rgba(0,0,0,0.95))_drop-shadow(0_0_6px_rgba(255,30,77,0.6))_drop-shadow(0_0_14px_rgba(225,29,72,0.35))]"
            : ""
        }`}
      />
    </div>
  );
};
