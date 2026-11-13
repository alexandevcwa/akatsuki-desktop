import React from "react";
import { cn } from "../utils/cn";

export type CyberBadgeTone = "crimson" | "cyan" | "purple" | "success" | "warning" | "muted";

interface CyberBadgeProps {
  tone?: CyberBadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

/**
 * Insignia de telemetría y estado para seguridad TLS, conexión Android y protocolos.
 */
export const CyberBadge: React.FC<CyberBadgeProps> = ({
  tone = "crimson",
  icon,
  children,
  className,
  pulse = false,
}) => {
  const toneClasses: Record<CyberBadgeTone, string> = {
    crimson: "bg-akatsuki-primary-muted/90 text-akatsuki-accent border-akatsuki-primary/60",
    cyan: "bg-akatsuki-cyan/10 text-akatsuki-telemetry border-akatsuki-cyan/40",
    purple: "bg-akatsuki-purple/15 text-purple-300 border-akatsuki-purple/50",
    success: "bg-akatsuki-success/15 text-emerald-300 border-akatsuki-success/50",
    warning: "bg-akatsuki-warning/15 text-amber-300 border-akatsuki-warning/50",
    muted: "bg-akatsuki-elevated text-akatsuki-muted border-white/10",
  };

  const dotClasses: Record<CyberBadgeTone, string> = {
    crimson: "bg-akatsuki-primary-glow",
    cyan: "bg-akatsuki-cyan",
    purple: "bg-akatsuki-purple",
    success: "bg-akatsuki-success",
    warning: "bg-akatsuki-warning",
    muted: "bg-akatsuki-muted",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 border font-mono text-mono-hash uppercase tracking-wider",
        toneClasses[tone],
        className
      )}
    >
      {pulse && (
        <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dotClasses[tone])} />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
