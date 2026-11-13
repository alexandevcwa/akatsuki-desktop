#!/usr/bin/env bash
# ==============================================================================
# AKATSUKI DESKTOP // SCRIPT DE COMPILACIÓN E INSTALACIÓN PARA MANJARO LINUX
# ==============================================================================
# Uso:
#   ./scripts/install-manjaro.sh              -> Compila el binario de producción e instala en Manjaro
#   ./scripts/install-manjaro.sh --icon-only  -> Registra inmediatamente el icono de la nube Akatsuki en Wayland/Lanzador
#   ./scripts/install-manjaro.sh --uninstall  -> Desinstala el ejecutable, iconos y acceso directo del sistema
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

APP_NAME="Akatsuki Desktop"
BIN_NAME="akatsuki-desktop"
APP_ID="com.akatsuki.cyberlink.desktop"

LOCAL_BIN_DIR="$HOME/.local/bin"
LOCAL_APPS_DIR="$HOME/.local/share/applications"
LOCAL_ICONS_BASE="$HOME/.local/share/icons/hicolor"
DIST_LINUX_DIR="$PROJECT_ROOT/dist-linux"

# Colores ANSI Akatsuki
RED='\033[1;31m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
MUTED='\033[0;37m'
NC='\033[0m'

echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}  AKATSUKI // SHINOBI SECURE FILE TRANSFER — INSTALADOR MANJARO LINUX (WAYLAND)${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ------------------------------------------------------------------------------
# 1. Función para desinstalar si se pasa --uninstall
# ------------------------------------------------------------------------------
if [[ "${1:-}" == "--uninstall" ]]; then
  echo -e "${CYAN}[1/2] Eliminando ejecutable y lanzadores de usuario...${NC}"
  rm -f "$LOCAL_BIN_DIR/$BIN_NAME"
  rm -f "$LOCAL_APPS_DIR/$BIN_NAME.desktop"
  rm -f "$LOCAL_APPS_DIR/$APP_ID.desktop"
  for size in 32x32 64x64 128x128 256x256 512x512; do
    rm -f "$LOCAL_ICONS_BASE/$size/apps/$BIN_NAME.png"
    rm -f "$LOCAL_ICONS_BASE/$size/apps/$APP_ID.png"
  done
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$LOCAL_APPS_DIR" || true
  echo -e "${GREEN}✔ Akatsuki Desktop ha sido desinstalado correctamente.${NC}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 2. Función para instalar iconos de la nube Akatsuki y lanzador Wayland/X11
# ------------------------------------------------------------------------------
install_icons_and_desktop_entry() {
  local target_exec="$1"

  echo -e "${CYAN}➤ Instalando iconos de la nube Akatsuki para Wayland y el lanzador de aplicaciones...${NC}"
  for size in 32x32 64x64 128x128 256x256 512x512; do
    mkdir -p "$LOCAL_ICONS_BASE/$size/apps"
    cp "$PROJECT_ROOT/src-tauri/icons/$size.png" "$LOCAL_ICONS_BASE/$size/apps/$BIN_NAME.png"
    cp "$PROJECT_ROOT/src-tauri/icons/$size.png" "$LOCAL_ICONS_BASE/$size/apps/$APP_ID.png"
  done

  mkdir -p "$LOCAL_APPS_DIR"
  local icon_path="$LOCAL_ICONS_BASE/512x512/apps/$BIN_NAME.png"

  # Lanzador principal visible en el menú de aplicaciones de Manjaro (KDE Plasma / GNOME / XFCE)
  cat > "$LOCAL_APPS_DIR/$BIN_NAME.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=$APP_NAME
GenericName=Shinobi Secure File Transfer
Comment=Cliente Cyberpunk de transferencia segura de archivos PC <-> Android (HTTPS TLS + SHA-256)
Exec="$target_exec"
Icon=$icon_path
Terminal=false
Categories=Utility;FileTools;Network;FileTransfer;
Keywords=Android;Transfer;Akatsuki;LAN;HTTPS;Archivos;
StartupNotify=true
StartupWMClass=$BIN_NAME
EOF

  # Alias de ID de aplicación para compositores Wayland que consultan el reverse-DNS identifier
  cat > "$LOCAL_APPS_DIR/$APP_ID.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=$APP_NAME
Exec="$target_exec"
Icon=$icon_path
Terminal=false
NoDisplay=true
StartupNotify=true
StartupWMClass=$APP_ID
EOF

  chmod +x "$LOCAL_APPS_DIR/$BIN_NAME.desktop" "$LOCAL_APPS_DIR/$APP_ID.desktop"

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$LOCAL_APPS_DIR" >/dev/null 2>&1 || true
  fi
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$LOCAL_ICONS_BASE" >/dev/null 2>&1 || true
  fi
  if command -v kbuildsycoca6 >/dev/null 2>&1; then
    kbuildsycoca6 >/dev/null 2>&1 || true
  elif command -v kbuildsycoca5 >/dev/null 2>&1; then
    kbuildsycoca5 >/dev/null 2>&1 || true
  fi
}

if [[ "${1:-}" == "--icon-only" ]]; then
  EXEC_TARGET="$LOCAL_BIN_DIR/$BIN_NAME"
  if [[ ! -f "$EXEC_TARGET" ]]; then
    EXEC_TARGET="$PROJECT_ROOT/src-tauri/target/debug/$BIN_NAME"
  fi
  install_icons_and_desktop_entry "$EXEC_TARGET"
  echo -e "${GREEN}✔ Icono de la nube Akatsuki registrado en Wayland y en el lanzador de Manjaro.${NC}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 3. Cargar entorno Node.js (fnm / nvm / sistema) y Rust (cargo)
# ------------------------------------------------------------------------------
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
elif [[ -d "$HOME/.local/share/fnm" ]]; then
  export PATH="$HOME/.local/share/fnm:$PATH"
  eval "$(fnm env)"
fi

if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}✖ Error: No se encontró 'npm' en el PATH. Activa Node.js e inténtalo de nuevo.${NC}"
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo -e "${RED}✖ Error: No se encontró 'cargo' (Rust) en el PATH.${NC}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 4. Compilar ejecutable nativo de producción (Frontend + Rust Release)
# ------------------------------------------------------------------------------
echo -e "${CYAN}[1/3] Compilando ejecutable nativo optimizado para Manjaro Linux (Tauri v2 Release)...${NC}"
npm run tauri build -- --no-bundle

RELEASE_BIN="$PROJECT_ROOT/src-tauri/target/release/$BIN_NAME"
if [[ ! -f "$RELEASE_BIN" ]]; then
  echo -e "${RED}✖ Error: No se encontró el binario compilado en $RELEASE_BIN${NC}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 5. Copiar ejecutable a dist-linux/ y a ~/.local/bin/
# ------------------------------------------------------------------------------
echo -e "${CYAN}[2/3] Instalando ejecutable nativo en el sistema de usuario...${NC}"
mkdir -p "$DIST_LINUX_DIR"
mkdir -p "$LOCAL_BIN_DIR"

cp "$RELEASE_BIN" "$DIST_LINUX_DIR/$BIN_NAME"
chmod +x "$DIST_LINUX_DIR/$BIN_NAME"

cp "$RELEASE_BIN" "$LOCAL_BIN_DIR/$BIN_NAME"
chmod +x "$LOCAL_BIN_DIR/$BIN_NAME"

# ------------------------------------------------------------------------------
# 6. Registrar icono oficial Akatsuki Cloud y lanzador .desktop para Wayland
# ------------------------------------------------------------------------------
echo -e "${CYAN}[3/3] Configurando lanzador de aplicaciones e icono de la nube Akatsuki en Wayland...${NC}"
install_icons_and_desktop_entry "$LOCAL_BIN_DIR/$BIN_NAME"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} COMPILACIÓN E INSTALACIÓN COMPLETADAS CON ÉXITO EN MANJARO LINUX${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MUTED}• Ejecutable en proyecto :${NC} ${CYAN}$DIST_LINUX_DIR/$BIN_NAME${NC}"
echo -e "${MUTED}• Ejecutable instalado   :${NC} ${CYAN}$LOCAL_BIN_DIR/$BIN_NAME${NC}"
echo -e "${MUTED}• Lanzador de sistema    :${NC} ${CYAN}$LOCAL_APPS_DIR/$BIN_NAME.desktop${NC}"
echo -e "${MUTED}• Icono Wayland/Dock     :${NC} ${CYAN}$LOCAL_ICONS_BASE/512x512/apps/$BIN_NAME.png${NC}"
echo ""
echo -e "Ya puedes abrir ${RED}Akatsuki Desktop${NC} desde el lanzador de aplicaciones de Manjaro"
echo -e "o ejecutando directamente: ${CYAN}$DIST_LINUX_DIR/$BIN_NAME${NC}"
