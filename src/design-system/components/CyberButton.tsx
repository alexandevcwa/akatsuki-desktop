import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type CyberButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type CyberButtonSize = "md" | "sm";

export interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CyberButtonVariant;
  size?: CyberButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  chamfer?: boolean;
}

/**
 * Botón oficial del Sistema de Diseño Akatsuki Cyberpunk.
 * Incluye bordes poligonales de 6 lados, barrido de luz (sheen) en hover y física táctil al presionar.
 */
export const CyberButton: React.FC<CyberButtonProps> = ({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  chamfer = true,
  className,
  disabled,
  children,
  ...props
}) => {
  const variantClasses: Record<CyberButtonVariant, string> = {
    primary:
      "bg-akatsuki-primary text-akatsuki-heading cyber-border-crimson-glow hover:bg-akatsuki-primary-glow hover-cyber-border-crimson hover:shadow-crimson-subtle",
    secondary:
      "bg-akatsuki-panel text-akatsuki-cyan cyber-border-cyan hover:bg-akatsuki-cyan/15 hover-cyber-border-cyan hover:shadow-cyan-glow",
    ghost:
      "bg-transparent text-akatsuki-body cyber-border-transparent hover:bg-akatsuki-elevated hover:text-akatsuki-heading hover-cyber-border-subtle",
    danger:
      "bg-akatsuki-primary-muted text-akatsuki-accent cyber-border-crimson hover:bg-akatsuki-danger hover:text-akatsuki-heading hover-cyber-border-crimson hover:shadow-crimson-subtle",
  };

  const sizeClasses: Record<CyberButtonSize, string> = {
    md: "px-4 py-2.5 text-button-md gap-2",
    sm: "px-3 py-1.5 text-button-sm gap-1.5",
  };

  return (
    <button
      disabled={disabled}
      className={twMerge(
        clsx(
          "cyber-btn-sheen inline-flex items-center justify-center font-display uppercase transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.97] select-none cursor-pointer",
          chamfer ? "cyber-chamfer-sm" : "rounded-sm border",
          variantClasses[variant],
          sizeClasses[size],
          disabled && "opacity-45 pointer-events-none cursor-not-allowed",
          className
        )
      )}
      {...props}
    >
      {leftIcon && (
        <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
          {leftIcon}
        </span>
      )}
      <span>{children}</span>
      {rightIcon && (
        <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
          {rightIcon}
        </span>
      )}
    </button>
  );
};
