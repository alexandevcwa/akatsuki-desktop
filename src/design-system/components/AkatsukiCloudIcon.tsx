import React from "react";

interface AkatsukiCloudIconProps {
  className?: string;
  glow?: boolean;
}

/**
 * Icono vectorial oficial de la Nube Roja de Akatsuki con estética Cyberpunk.
 */
export const AkatsukiCloudIcon: React.FC<AkatsukiCloudIconProps> = ({
  className = "w-7 h-5",
  glow = true,
}) => {
  return (
    <svg
      viewBox="0 0 120 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${glow ? "drop-shadow-[0_0_8px_rgba(255,30,77,0.65)]" : ""}`}
    >
      <path
        d="M35.5 64C20.3 64 8 52.8 8 39C8 27.1 16.9 17.2 28.7 14.7C33.4 6.5 42.6 1 53.2 1C66.8 1 78.2 10.2 80.9 22.6C83.5 21.6 86.4 21 89.5 21C101.9 21 112 30.6 112 42.5C112 54.4 101.9 64 89.5 64H35.5Z"
        fill="#E11D48"
        stroke="#F8FAFC"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Detalles internos de espiral Akatsuki / Trazado Cyber */}
      <path
        d="M36 44C30 44 26 39.5 26 34C26 28.5 31 24 37 24C42 24 46 27.5 46 32"
        stroke="#F8FAFC"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M78 48C84 48 89 43.5 89 37.5C89 31.5 84 27 77.5 27C72 27 68 30.5 68 35"
        stroke="#F8FAFC"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};
