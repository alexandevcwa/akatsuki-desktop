import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * DisplayXL (2.0rem / 32px - Orbitron Bold Uppercase)
 * Uso: Títulos Hero / Splash Screen
 */
export const DisplayXL: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <h1
    className={cn("font-display text-display-xl uppercase text-akatsuki-heading tracking-wider", className)}
    {...props}
  >
    {children}
  </h1>
);

/**
 * Heading1 (1.375rem / 22px - Orbitron Bold Uppercase)
 * Uso: Título Principal de Vista (Header)
 */
export const Heading1: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <h1
    className={cn("font-display text-heading-1 uppercase text-akatsuki-heading", className)}
    {...props}
  >
    {children}
  </h1>
);

/**
 * Heading2 (1.125rem / 18px - Orbitron/Rajdhani SemiBold Uppercase)
 * Uso: Encabezado de Panel (PC / Android) o Modal
 */
export const Heading2: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <h2
    className={cn("font-display text-heading-2 uppercase text-akatsuki-heading", className)}
    {...props}
  >
    {children}
  </h2>
);

/**
 * Heading3 (0.9375rem / 15px - Rajdhani SemiBold)
 * Uso: Subtítulo de Sección / Card Header
 */
export const Heading3: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <h3
    className={cn("font-display text-heading-3 uppercase text-akatsuki-accent", className)}
    {...props}
  >
    {children}
  </h3>
);

/**
 * BodyText (0.875rem / 14px - Plus Jakarta Sans Regular/Medium)
 * Uso: Texto general, descripciones y diálogos
 */
export const BodyText: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <p className={cn("font-sans text-body-md text-akatsuki-body", className)} {...props}>
    {children}
  </p>
);

/**
 * ListItemText (0.8125rem / 13px - Plus Jakarta Sans Medium)
 * Uso: Nombres de archivos y carpetas en listas del explorador
 */
export const ListItemText: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <span className={cn("font-sans text-list-item text-akatsuki-body", className)} {...props}>
    {children}
  </span>
);

/**
 * MonoTelemetry (0.75rem / 12px - JetBrains Mono Medium)
 * Uso: Telemetría, IP:Puerto, velocidades MB/s, tamaños de archivo
 */
export const MonoTelemetry: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <span className={cn("font-mono text-mono-data text-akatsuki-telemetry", className)} {...props}>
    {children}
  </span>
);

/**
 * MonoHash (0.6875rem / 11px - JetBrains Mono Regular)
 * Uso: Huellas SHA-256, certificados TLS, rutas técnicas
 */
export const MonoHash: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <code className={cn("font-mono text-mono-hash text-akatsuki-muted", className)} {...props}>
    {children}
  </code>
);
