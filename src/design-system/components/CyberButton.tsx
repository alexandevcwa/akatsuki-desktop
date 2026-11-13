import React from "react";
import { cn } from "../utils/cn";

export type CyberButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type CyberButtonSize = "md" | "sm" | "xs";

export interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CyberButtonVariant;
  size?: CyberButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  chamfer?: boolean;
}

/**
 * Botón oficial del Sistema de Diseño Akatsuki Cyberpunk optimizado para 60/144 FPS.
 * Soporta variantes `md` (formularios/header), `sm` (toolbars) y `xs` (acciones compactas en tablas).
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
      "bg-akatsuki-primary text-akatsuki-heading cyber-border-crimson-glow hover:bg-akatsuki-primary-glow hover-cyber-border-crimson",
    secondary:
      "bg-akatsuki-panel text-akatsuki-cyan cyber-border-cyan hover:bg-akatsuki-cyan/15 hover-cyber-border-cyan",
    ghost:
      "bg-transparent text-akatsuki-body cyber-border-transparent hover:bg-akatsuki-elevated hover:text-akatsuki-heading hover-cyber-border-subtle",
    danger:
      "bg-akatsuki-primary-muted text-akatsuki-accent cyber-border-crimson hover:bg-akatsuki-danger hover:text-akatsuki-heading hover-cyber-border-crimson",
  };

  const sizeClasses: Record<CyberButtonSize, string> = {
    md: "px-4 py-2 text-button-md gap-2",
    sm: "px-2.5 py-1 text-button-sm gap-1.5",
    xs: "px-2.5 py-1 text-button-xs gap-1",
  };

  const chamferClass = chamfer
    ? size === "xs"
      ? "cyber-chamfer-xs"
      : "cyber-chamfer-sm"
    : "rounded-sm border";

  return (
    <button
      disabled={disabled}
      className={cn(
        "cyber-btn-sheen shrink-0 inline-flex items-center justify-center font-display uppercase whitespace-nowrap transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] select-none cursor-pointer",
        chamferClass,
        variantClasses[variant],
        sizeClasses[size],
        disabled && "opacity-45 pointer-events-none cursor-not-allowed",
        className
      )}
      {...props}
    >
      {leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
    </button>
  );
};
