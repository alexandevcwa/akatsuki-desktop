# AKATSUKI // SHINOBI CYBER LINK (`akatsuki-desktop`)

Cliente de escritorio multiplataforma desarrollado con **Tauri v2 (Rust + React + TypeScript + Tailwind CSS)** para conectarse de manera segura a un **Web Service ejecutándose en un dispositivo Android** dentro de la red local y transferir archivos bidireccionalmente a alta velocidad.

---

## 1. Arquitectura del Proyecto

El proyecto implementa una **Arquitectura Hexagonal / Modular en Rust (`src-tauri`)** combinada con **Feature-Sliced Design (FSD) en el Frontend (`src/`)**:

```text
akatsuki-desktop/
├── src/                                # ⚡ FRONTEND (React 18 + TypeScript + Tailwind CSS)
│   ├── styles/
│   │   ├── tokens.css                  # Variables CSS oficiales (Paleta Akatsuki Cyberpunk + Fuentes)
│   │   └── globals.css                 # Utilidades HUD (.cyber-chamfer, .cyber-grid-bg)
│   ├── design-system/                  # 🎨 Componentes Base del Sistema de Diseño
│   │   ├── components/
│   │   │   ├── AkatsukiCloudIcon.tsx   # Icono vectorial oficial Nube Akatsuki
│   │   │   ├── Typography.tsx          # Escala tipográfica (DisplayXL, H1-H3, Body, List, Mono)
│   │   │   ├── CyberButton.tsx         # Matriz de botones autorizados (Primary, Secondary, Ghost, Danger)
│   │   │   ├── CyberPanel.tsx          # Contenedores HUD biselados
│   │   │   ├── CyberBadge.tsx          # Insignias de estado y criptografía
│   │   │   └── CyberInput.tsx          # Entradas tácticas de texto y telemetría
│   ├── features/
│   │   ├── connection/                 # Radar LAN mDNS + Emparejamiento HTTPS TOFU + QR
│   │   ├── explorer/                   # Explorador de archivos Dual-Pane (PC Local ⇄ Android Remoto)
│   │   └── transfer/                   # Cola de transferencia por streaming + verificación SHA-256
│   └── shared/                         # Contratos TypeScript y formateadores de telemetría
│
└── src-tauri/                          # 🦀 BACKEND CORE (Rust 1.96 - Tauri v2)
    └── src/
        ├── domain/                     # Entidades de dominio (Device, FileEntry, Transfer)
        ├── infrastructure/             # Clientes HTTPS (Reqwest + Rustls), TOFU Pinning, SHA-256, mDNS
        └── commands/                   # Comandos IPC expuestos al frontend
```

---

## 2. Sistema de Diseño: "Akatsuki Cyberpunk"

### Paleta de Colores Autorizada (`src/styles/tokens.css`)
- **Fondos (`Backgrounds`):**
  - `bg-void` (`#07070C` - *Obsidian Cloak*): Fondo raíz de la ventana.
  - `bg-mantle` (`#0D0E17` - *Shadow Mantle*): Topbar HUD y barras de estado.
  - `bg-panel` (`#141624` - *Tactical Surface*): Paneles de explorador y tarjetas.
  - `bg-elevated` (`#1D2033` - *Uchiha Slate*): Filas activas/hover e inputs.
- **Marca y Acentos Cyberpunk:**
  - `primary` (`#E11D48` - *Akatsuki Crimson*) / `primary-glow` (`#FF1E4D` - *Sharingan Neon*)
  - `cyber-cyan` (`#00F0FF` - *Rinnegan Cyber Cyan*): Telemetría LAN y velocidad de transferencia.
  - `cyber-purple` (`#A855F7` - *Susanoo Violet*): Estado de cifrado TLS 1.3 Pinning y SHA-256.
  - `status-success` (`#10B981`), `status-warning` (`#F59E0B`), `status-danger` (`#FF003C`).

### Tipografía y Tamaños (`tailwind.config.js`)
- **Display / Títulos y Botones (`--font-display`):** `Orbitron` y `Rajdhani` (`32px`, `22px`, `18px`, `15px`).
- **Cuerpo y Listas de Archivos (`--font-sans`):** `Plus Jakarta Sans` (`14px` texto general, `13px` filas de archivo).
- **Telemetría, IPs y Hashes (`--font-mono`):** `JetBrains Mono` (`12px` datos de red, `11px` hashes SHA-256).

---

## 3. Comandos de Desarrollo

```bash
# 1. Instalar dependencias del frontend
pnpm install

# 2. Ejecutar en modo desarrollo con Tauri v2
pnpm tauri dev

# 3. Ejecutar pruebas unitarias del Core en Rust
cargo test --manifest-path src-tauri/Cargo.toml
```
