#!/usr/bin/env bash
# ==============================================================================
# AKATSUKI DESKTOP // COMPILACIÓN CRUZADA A WINDOWS (x64) DESDE MANJARO LINUX
# ==============================================================================
# Permite generar el ejecutable nativo de Windows (.exe) y el instalador NSIS
# (*-setup.exe) directamente desde Manjaro / Arch Linux utilizando cargo-xwin y
# makensis (NSIS), siguiendo la documentación oficial de Tauri v2.
#
# Uso:
#   ./scripts/build-windows-from-linux.sh              -> Genera instalador NSIS (.exe) y portable (.exe)
#   ./scripts/build-windows-from-linux.sh --portable   -> Genera únicamente el binario portable (.exe)
# ==============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

DIST_WINDOWS_DIR="$PROJECT_ROOT/dist-windows"
TARGET_TRIPLE="x86_64-pc-windows-msvc"
RELEASE_DIR="$PROJECT_ROOT/src-tauri/target/$TARGET_TRIPLE/release"

RED='\033[1;31m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
MUTED='\033[0;37m'
NC='\033[0m'

echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}  AKATSUKI DESKTOP // CROSS-COMPILACIÓN LINUX -> WINDOWS x64 (NSIS / EXE)     ${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Cargar Node.js (fnm) y Rust (cargo)
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

# 1. Verificar dependencias de compilación cruzada en Manjaro Linux
echo -e "${CYAN}[1/4] Verificando herramientas de compilación cruzada a Windows...${NC}"

MISSING_PKGS=()
command -v clang >/dev/null 2>&1 || MISSING_PKGS+=("clang")
command -v llvm-lib >/dev/null 2>&1 || MISSING_PKGS+=("llvm")
command -v lld-link >/dev/null 2>&1 || MISSING_PKGS+=("lld")

if [[ "${1:-}" != "--portable" ]]; then
  command -v makensis >/dev/null 2>&1 || MISSING_PKGS+=("nsis")
fi

if [[ ${#MISSING_PKGS[@]} -gt 0 ]]; then
  echo -e "${YELLOW}Faltan paquetes del sistema en Manjaro para compilar hacia Windows: ${MISSING_PKGS[*]}${NC}"
  echo -e "Instálalos ejecutando:"
  echo -e "  ${CYAN}sudo pacman -S --needed ${MISSING_PKGS[*]}${NC}"
  exit 1
fi

if ! rustup target list --installed | grep -q "^${TARGET_TRIPLE}$"; then
  echo -e "${CYAN}➤ Agregando target Rust ${TARGET_TRIPLE}...${NC}"
  rustup target add "$TARGET_TRIPLE"
fi

if ! command -v cargo-xwin >/dev/null 2>&1; then
  echo -e "${CYAN}➤ Instalando cargo-xwin para enlazar contra el SDK de Windows MSVC...${NC}"
  cargo install --locked cargo-xwin
fi

# 2. Ejecutar compilación cruzada con Tauri v2 + cargo-xwin
echo -e "${CYAN}[2/4] Compilando frontend y binario Windows x64 (${TARGET_TRIPLE})...${NC}"

if [[ "${1:-}" == "--portable" ]]; then
  npm run tauri build -- --runner cargo-xwin --target "$TARGET_TRIPLE" --no-bundle
else
  npm run tauri build -- --runner cargo-xwin --target "$TARGET_TRIPLE" --bundles nsis
fi

# 3. Recolectar artefactos en dist-windows/
echo -e "${CYAN}[3/4] Recolectando ejecutable e instalador en ${DIST_WINDOWS_DIR}...${NC}"
mkdir -p "$DIST_WINDOWS_DIR"

if [[ -f "$RELEASE_DIR/akatsuki-desktop.exe" ]]; then
  cp "$RELEASE_DIR/akatsuki-desktop.exe" "$DIST_WINDOWS_DIR/akatsuki-desktop-portable-x64.exe"
fi

if [[ -d "$RELEASE_DIR/bundle/nsis" ]]; then
  find "$RELEASE_DIR/bundle/nsis" -maxdepth 1 -name "*.exe" -exec cp {} "$DIST_WINDOWS_DIR/" \;
fi

# 4. Generar hashes SHA-256 de verificación
echo -e "${CYAN}[4/4] Generando archivo SHA256SUMS.txt...${NC}"
(
  cd "$DIST_WINDOWS_DIR"
  rm -f SHA256SUMS.txt
  sha256sum ./*.exe > SHA256SUMS.txt
)

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} ARTEFACTOS DE WINDOWS GENERADOS CON ÉXITO EN: ${DIST_WINDOWS_DIR}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
ls -lh "$DIST_WINDOWS_DIR"
