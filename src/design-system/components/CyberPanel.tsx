import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Heading2 } from "./Typography";

export interface CyberPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  accentColor?: "crimson" | "cyan" | "purple" | "none";
  chamfer?: boolean;
}

/**
 * Panel táctico HUD con bordes biselados de 6 lados y barra superior de acento Akatsuki Cyberpunk.
 */
export const CyberPanel: React.FC<CyberPanelProps> = ({
  title,
  subtitle,
  headerRight,
  accentColor = "crimson",
  chamfer = true,
  className,
  children,
  ...props
}) => {
  const accentBarMap = {
    crimson: "bg-akatsuki-primary",
    cyan: "bg-akatsuki-cyan",
    purple: "bg-akatsuki-purple",
    none: "bg-transparent",
  };

  return (
    <div
      className={twMerge(
        clsx(
          "bg-akatsuki-panel cyber-border-subtle flex flex-col overflow-hidden relative",
          chamfer ? "cyber-chamfer-md" : "rounded-sm border border-white/10",
          className
        )
      )}
      {...props}
    >
      {/* Línea superior de acento táctico */}
      {accentColor !== "none" && (
        <div className={clsx("h-[2px] w-full shrink-0", accentBarMap[accentColor])} />
      )}

      {(title || headerRight) && (
        <div className="px-4 py-2.5 bg-akatsuki-mantle/90 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={clsx(
                "w-2 h-2 rotate-45 shrink-0",
                accentColor === "crimson" && "bg-akatsuki-primary shadow-crimson-subtle",
                accentColor === "cyan" && "bg-akatsuki-cyan shadow-cyan-glow",
                accentColor === "purple" && "bg-akatsuki-purple shadow-purple-glow",
                accentColor === "none" && "bg-akatsuki-muted"
              )}
            />
            <div className="truncate">
              {title && <Heading2 className="truncate">{title}</Heading2>}
              {subtitle && (
                <p className="font-mono text-mono-hash text-akatsuki-muted truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerRight && <div className="shrink-0 flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
};
