import React, { useId, useRef, useState } from "react";
import { cn } from "../utils/cn";

export interface CyberCodeProps {
  label?: string;
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  groupSeparatorAt?: number;
  id?: string;
  name?: string;
  className?: string;
}

/**
 * Campo táctico estilo 2FA/OTP para códigos numéricos de verificación (ej. PIN de 6 dígitos).
 * Solo acepta dígitos (0-9) con navegación automática, pegado inteligente y bordes biselados Akatsuki.
 */
export const CyberCode: React.FC<CyberCodeProps> = ({
  label,
  length = 6,
  value,
  onChange,
  onComplete,
  required = false,
  disabled = false,
  error = false,
  autoFocus = false,
  groupSeparatorAt = length === 6 ? 3 : 0,
  id,
  name,
  className,
}) => {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const normalizedValue = value.replace(/\D/g, "").slice(0, length);
  const digits = Array.from({ length }, (_, idx) => normalizedValue[idx] ?? "");
  const isComplete = normalizedValue.length === length;

  const focusSlot = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    const target = inputRefs.current[clamped];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const commitValue = (nextDigits: string[], nextFocusIndex?: number) => {
    const nextValue = nextDigits.join("").replace(/\D/g, "").slice(0, length);
    if (nextValue !== normalizedValue) {
      onChange(nextValue);
      if (nextValue.length === length) {
        onComplete?.(nextValue);
      }
    }
    if (typeof nextFocusIndex === "number") {
      requestAnimationFrame(() => focusSlot(nextFocusIndex));
    }
  };

  const handleChange = (index: number, rawInput: string) => {
    if (disabled) return;
    let cleanDigits = rawInput.replace(/\D/g, "");
    if (!cleanDigits) return;

    const currentDigit = normalizedValue[index] ?? "";
    if (currentDigit && cleanDigits.length === 2) {
      if (cleanDigits[0] === currentDigit) {
        cleanDigits = cleanDigits[1];
      } else if (cleanDigits[1] === currentDigit) {
        cleanDigits = cleanDigits[0];
      }
    }

    const current = normalizedValue.split("");

    if (cleanDigits.length === 1) {
      const targetIndex = Math.min(index, current.length);
      if (targetIndex < current.length) {
        current[targetIndex] = cleanDigits;
      } else {
        current.push(cleanDigits);
      }
      const nextValue = current.slice(0, length);
      const nextFocus = Math.min(targetIndex + 1, length - 1);
      commitValue(nextValue, nextFocus);
      return;
    }

    // Múltiples dígitos (autocompletado de sistema / teclado virtual)
    const startIndex = Math.min(index, current.length);
    const merged = [
      ...current.slice(0, startIndex),
      ...cleanDigits.split(""),
      ...current.slice(startIndex + cleanDigits.length),
    ].slice(0, length);

    const nextFocus = Math.min(startIndex + cleanDigits.length, length - 1);
    commitValue(merged, nextFocus);
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (disabled) return;

    const isMetaShortcut = e.ctrlKey || e.metaKey || e.altKey;
    if (isMetaShortcut) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusSlot(index - 1);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusSlot(index + 1);
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      focusSlot(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      focusSlot(Math.min(normalizedValue.length, length - 1));
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const current = normalizedValue.split("");
      if (index < current.length) {
        current.splice(index, 1);
        commitValue(current, index);
      } else if (index > 0 && current.length > 0) {
        const removeIdx = Math.min(index - 1, current.length - 1);
        current.splice(removeIdx, 1);
        commitValue(current, removeIdx);
      }
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      const current = normalizedValue.split("");
      if (index < current.length) {
        current.splice(index, 1);
        commitValue(current, index);
      }
      return;
    }

    // Permitir teclas de control estándar (Tab, Enter, Escape)
    if (e.key.length > 1) return;

    // Bloquear estrictamente cualquier carácter que no sea un dígito 0-9
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    if (disabled) return;

    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;

    const current = normalizedValue.split("");

    // Si se pega el código completo o está vacío, rellenar desde el inicio
    if (pasted.length >= length || current.length === 0) {
      const next = pasted.slice(0, length).split("");
      commitValue(next, Math.min(next.length, length - 1));
      return;
    }

    const startIndex = Math.min(index, current.length);
    const merged = [
      ...current.slice(0, startIndex),
      ...pasted.split(""),
      ...current.slice(startIndex + pasted.length),
    ].slice(0, length);

    const nextFocus = Math.min(startIndex + pasted.length, length - 1);
    commitValue(merged, nextFocus);
  };

  const handleFocus = (index: number, e: React.FocusEvent<HTMLInputElement>) => {
    if (index > normalizedValue.length) {
      const targetIndex = normalizedValue.length;
      setFocusedIndex(targetIndex);
      requestAnimationFrame(() => focusSlot(targetIndex));
      return;
    }
    setFocusedIndex(index);
    e.currentTarget.select();
  };

  return (
    <div className={cn("flex flex-col gap-1.5 w-full relative", className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`${baseId}-0`}
            className="font-display text-list-header uppercase text-akatsuki-muted tracking-wider"
          >
            {label}
          </label>
          <span
            className={cn(
              "font-mono text-telemetry-xs tabular-nums transition-colors",
              error
                ? "text-akatsuki-accent"
                : isComplete
                  ? "text-akatsuki-cyan"
                  : "text-akatsuki-muted/70"
            )}
          >
            {normalizedValue.length}/{length}
          </span>
        </div>
      )}

      {/* Input oculto para validación nativa HTML5 (required / pattern) en formularios */}
      {required && (
        <input
          type="text"
          name={name}
          tabIndex={-1}
          aria-hidden="true"
          required
          pattern={`[0-9]{${length}}`}
          title={`Ingresa los ${length} dígitos numéricos`}
          value={normalizedValue}
          onChange={() => {}}
          className="opacity-0 pointer-events-none absolute inset-x-0 bottom-0 h-px w-full"
        />
      )}

      <div
        role="group"
        aria-label={label ?? `Código de verificación de ${length} dígitos`}
        className={cn(
          "flex items-center gap-1.5 w-full",
          disabled && "opacity-45 pointer-events-none"
        )}
      >
        {digits.map((digit, index) => {
          const isFocused = focusedIndex === index;
          const isFilled = digit !== "";
          const showSeparator =
            groupSeparatorAt > 0 &&
            groupSeparatorAt < length &&
            index === groupSeparatorAt;

          return (
            <React.Fragment key={index}>
              {showSeparator && (
                <div
                  aria-hidden="true"
                  className="flex items-center justify-center shrink-0 w-2"
                >
                  <span
                    className={cn(
                      "w-1.5 h-[2px] transition-colors",
                      isComplete
                        ? "bg-akatsuki-cyan/70"
                        : "bg-akatsuki-muted/50"
                    )}
                  />
                </div>
              )}

              <div
                className={cn(
                  "relative flex-1 min-w-0 h-11 cyber-chamfer-xs transition-colors duration-150",
                  error
                    ? isFocused
                      ? "bg-akatsuki-primary-muted/60 cyber-border-crimson-glow"
                      : "bg-akatsuki-primary-muted/35 cyber-border-crimson"
                    : isFocused
                      ? "bg-akatsuki-elevated cyber-border-crimson-glow"
                      : isFilled
                        ? "bg-akatsuki-panel cyber-border-cyan"
                        : "bg-akatsuki-void/75 cyber-border-subtle hover-cyber-border-subtle"
                )}
              >
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  id={`${baseId}-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Dígito ${index + 1} de ${length}`}
                  value={digit}
                  placeholder="•"
                  disabled={disabled}
                  autoFocus={autoFocus && index === 0}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handlePaste(index, e)}
                  onFocus={(e) => handleFocus(index, e)}
                  onClick={(e) => e.currentTarget.select()}
                  onBlur={() =>
                    setFocusedIndex((prev) => (prev === index ? null : prev))
                  }
                  className={cn(
                    "w-full h-full bg-transparent text-center font-mono text-lg font-bold leading-none tabular-nums focus:outline-none placeholder:text-akatsuki-muted/35 caret-akatsuki-primary-glow selection:bg-akatsuki-primary/30 selection:text-akatsuki-heading",
                    error
                      ? "text-akatsuki-accent"
                      : isFilled
                        ? "text-akatsuki-telemetry"
                        : "text-akatsuki-heading"
                  )}
                />

                {/* Indicador táctico inferior de estado activo / completado */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] transition-all duration-150",
                    isFocused
                      ? "w-4 bg-akatsuki-primary-glow shadow-crimson-subtle"
                      : isFilled
                        ? "w-3 bg-akatsuki-cyan/70"
                        : "w-0 bg-transparent"
                  )}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
