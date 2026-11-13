import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Instancia extendida de `tailwind-merge` registrada con los tokens oficiales
 * del Sistema de Diseño Akatsuki Cyberpunk.
 *
 * Evita que `tailwind-merge` confunda las clases tipográficas personalizadas
 * (`text-list-meta`, `text-button-xs`, `text-list-item`, etc.) con clases de color
 * (`text-akatsuki-*`) y las elimine por error.
 */
const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-xl",
            "heading-1",
            "heading-2",
            "heading-3",
            "body-md",
            "list-item",
            "list-meta",
            "list-header",
            "button-md",
            "button-sm",
            "button-xs",
            "mono-data",
            "mono-hash",
            "telemetry-xs",
          ],
        },
      ],
      "text-color": [
        {
          text: [
            {
              akatsuki: [
                "void",
                "mantle",
                "panel",
                "elevated",
                "glass",
                "primary",
                "primary-glow",
                "primary-muted",
                "cyan",
                "purple",
                "success",
                "warning",
                "danger",
                "heading",
                "body",
                "muted",
                "accent",
                "telemetry",
              ],
            },
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs));
}
