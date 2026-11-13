/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        akatsuki: {
          void: "var(--ak-bg-void)",
          mantle: "var(--ak-bg-mantle)",
          panel: "var(--ak-bg-panel)",
          elevated: "var(--ak-bg-elevated)",
          glass: "var(--ak-bg-glass)",
          primary: "var(--ak-primary)",
          "primary-glow": "var(--ak-primary-glow)",
          "primary-muted": "var(--ak-primary-muted)",
          cyan: "var(--ak-cyber-cyan)",
          purple: "var(--ak-cyber-purple)",
          success: "var(--ak-status-success)",
          warning: "var(--ak-status-warning)",
          danger: "var(--ak-status-danger)",
          heading: "var(--ak-text-heading)",
          body: "var(--ak-text-body)",
          muted: "var(--ak-text-muted)",
          accent: "var(--ak-text-accent)",
          telemetry: "var(--ak-text-cyber)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": [
          "2.0rem",
          { lineHeight: "1.15", letterSpacing: "0.08em", fontWeight: "700" },
        ],
        "heading-1": [
          "1.375rem",
          { lineHeight: "1.25", letterSpacing: "0.06em", fontWeight: "700" },
        ],
        "heading-2": [
          "1.125rem",
          { lineHeight: "1.30", letterSpacing: "0.05em", fontWeight: "600" },
        ],
        "heading-3": [
          "0.9375rem",
          { lineHeight: "1.40", letterSpacing: "0.04em", fontWeight: "600" },
        ],
        "body-md": [
          "0.875rem",
          { lineHeight: "1.50", letterSpacing: "0em", fontWeight: "400" },
        ],
        "list-item": [
          "0.8125rem",
          { lineHeight: "1.40", letterSpacing: "0.01em", fontWeight: "500" },
        ],
        "list-header": [
          "0.75rem",
          { lineHeight: "1.20", letterSpacing: "0.08em", fontWeight: "700" },
        ],
        "button-md": [
          "0.875rem",
          { lineHeight: "1.00", letterSpacing: "0.06em", fontWeight: "700" },
        ],
        "button-sm": [
          "0.75rem",
          { lineHeight: "1.00", letterSpacing: "0.05em", fontWeight: "600" },
        ],
        "mono-data": [
          "0.75rem",
          { lineHeight: "1.40", letterSpacing: "-0.01em", fontWeight: "500" },
        ],
        "mono-hash": [
          "0.6875rem",
          { lineHeight: "1.35", letterSpacing: "0em", fontWeight: "400" },
        ],
      },
      boxShadow: {
        "crimson-glow": "0 0 18px rgba(255, 30, 77, 0.42)",
        "crimson-subtle": "0 0 10px rgba(225, 29, 72, 0.22)",
        "cyan-glow": "0 0 16px rgba(0, 240, 255, 0.35)",
        "purple-glow": "0 0 16px rgba(168, 85, 247, 0.35)",
      },
    },
  },
  plugins: [],
};
