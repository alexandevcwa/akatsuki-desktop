import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  mono?: boolean;
}

/**
 * Campo de entrada táctico para direcciones IP, puertos, PIN de emparejamiento y filtrado de archivos.
 */
export const CyberInput: React.FC<CyberInputProps> = ({
  label,
  leftIcon,
  mono = false,
  className,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="font-display text-list-header uppercase text-akatsuki-muted tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-akatsuki-muted pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          className={twMerge(
            clsx(
              "w-full bg-akatsuki-mantle border border-white/15 px-3 py-2 text-akatsuki-heading placeholder:text-akatsuki-muted/60 focus:outline-none focus:border-akatsuki-primary focus:bg-akatsuki-elevated/60 transition-colors",
              leftIcon && "pl-9",
              mono ? "font-mono text-mono-data text-akatsuki-telemetry" : "font-sans text-body-md",
              className
            )
          )}
          {...props}
        />
      </div>
    </div>
  );
};
