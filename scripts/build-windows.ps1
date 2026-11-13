<#
.SYNOPSIS
    Script oficial de compilacion y generacion de instaladores para Windows (x64) de Akatsuki Desktop.

.DESCRIPTION
    Ejecuta el flujo de compilacion de produccion de Tauri v2 en Windows 10/11 siguiendo
    las mejores practicas:
    - Verificacion de dependencias (Node.js, npm, Rust MSVC toolchain).
    - Compilacion optimizada (LTO, strip, opt-level="s") para arquitectura x86_64-pc-windows-msvc.
    - Generacion de instalador NSIS (.exe), paquete empresarial WiX (.msi) y ejecutable portable (.exe).
    - Recoleccion de artefactos en el directorio .\dist-windows\ y generacion de hashes SHA256SUMS.txt.

.PARAMETER Target
    Tipo de paquete a generar: 'all' (por defecto: NSIS + MSI + Portable), 'nsis', 'msi' o 'portable'.

.PARAMETER Clean
    Limpia las carpetas de compilacion previas (dist y dist-windows) antes de iniciar.

.EXAMPLE
    .\scripts\build-windows.ps1
    .\scripts\build-windows.ps1 -Target nsis
    .\scripts\build-windows.ps1 -Target all -Clean
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [ValidateSet("all", "nsis", "msi", "portable")]
    [string]$Target = "all",

    [Parameter(Mandatory = $false)]
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$DistWindowsDir = Join-Path $ProjectRoot "dist-windows"
$ReleaseDir = Join-Path $ProjectRoot "src-tauri\target\x86_64-pc-windows-msvc\release"
$FallbackReleaseDir = Join-Path $ProjectRoot "src-tauri\target\release"

Write-Host "==============================================================================" -ForegroundColor Red
Write-Host "  AKATSUKI DESKTOP // COMPILADOR Y GENERADOR DE INSTALADORES WINDOWS (x64)    " -ForegroundColor Red
Write-Host "==============================================================================" -ForegroundColor Red

# ------------------------------------------------------------------------------
# 1. Verificacion de herramientas requeridas en Windows
# ------------------------------------------------------------------------------
Write-Host "[1/5] Verificando entorno de compilacion en Windows..." -ForegroundColor Cyan

foreach ($cmd in @("node", "npm", "cargo", "rustc")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "No se encontro '$cmd' en el PATH del sistema. Instala Node.js LTS y Rust (rustup) antes de continuar."
        exit 1
    }
}

if (Get-Command "rustup" -ErrorAction SilentlyContinue) {
    $installedTargets = rustup target list --installed
    if ($installedTargets -notcontains "x86_64-pc-windows-msvc") {
        Write-Host "Instalando target Rust x86_64-pc-windows-msvc..." -ForegroundColor Yellow
        rustup target add x86_64-pc-windows-msvc
    }
}

# ------------------------------------------------------------------------------
# 2. Limpieza opcional y preparacion de dependencias
# ------------------------------------------------------------------------------
if ($Clean) {
    Write-Host "[2/5] Limpiando artefactos previos..." -ForegroundColor Cyan
    if (Test-Path $DistWindowsDir) { Remove-Item -Recurse -Force $DistWindowsDir }
    if (Test-Path (Join-Path $ProjectRoot "dist")) { Remove-Item -Recurse -Force (Join-Path $ProjectRoot "dist") }
} else {
    Write-Host "[2/5] Preparando directorios de salida..." -ForegroundColor Cyan
}

New-Item -ItemType Directory -Force -Path $DistWindowsDir | Out-Null

if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    Write-Host "Instalando dependencias de Node.js (npm ci)..." -ForegroundColor Cyan
    npm ci
}

# ------------------------------------------------------------------------------
# 3. Ejecucion de Tauri Build segun el Target seleccionado
# ------------------------------------------------------------------------------
Write-Host "[3/5] Compilando Akatsuki Desktop para Windows x64 (Target: $Target)..." -ForegroundColor Cyan

switch ($Target) {
    "all" {
        npm run tauri build -- --target x86_64-pc-windows-msvc --bundles nsis,msi
    }
    "nsis" {
        npm run tauri build -- --target x86_64-pc-windows-msvc --bundles nsis
    }
    "msi" {
        npm run tauri build -- --target x86_64-pc-windows-msvc --bundles msi
    }
    "portable" {
        npm run tauri build -- --target x86_64-pc-windows-msvc --no-bundle
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "El proceso de compilacion de Tauri finalizo con errores."
    exit $LASTEXITCODE
}

# ------------------------------------------------------------------------------
# 4. Recoleccion de instaladores y ejecutable en .\dist-windows\
# ------------------------------------------------------------------------------
Write-Host "[4/5] Recolectando instaladores y binarios en dist-windows..." -ForegroundColor Cyan

$ActiveReleaseDir = if (Test-Path $ReleaseDir) { $ReleaseDir } else { $FallbackReleaseDir }

# Copiar ejecutable portable
$PortableExe = Join-Path $ActiveReleaseDir "akatsuki-desktop.exe"
if (Test-Path $PortableExe) {
    Copy-Item $PortableExe (Join-Path $DistWindowsDir "akatsuki-desktop-portable-x64.exe") -Force
}

# Copiar instalador NSIS (*-setup.exe)
$NsisDir = Join-Path $ActiveReleaseDir "bundle\nsis"
if (Test-Path $NsisDir) {
    Get-ChildItem -Path $NsisDir -Filter "*.exe" | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $DistWindowsDir $_.Name) -Force
    }
}

# Copiar instalador WiX (*.msi)
$MsiDir = Join-Path $ActiveReleaseDir "bundle\msi"
if (Test-Path $MsiDir) {
    Get-ChildItem -Path $MsiDir -Filter "*.msi" | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $DistWindowsDir $_.Name) -Force
    }
}

# ------------------------------------------------------------------------------
# 5. Generacion de archivo de verificacion criptografica SHA256SUMS.txt
# ------------------------------------------------------------------------------
Write-Host "[5/5] Generando resumenes criptograficos SHA-256..." -ForegroundColor Cyan

$ChecksumFile = Join-Path $DistWindowsDir "SHA256SUMS.txt"
if (Test-Path $ChecksumFile) { Remove-Item $ChecksumFile -Force }

$Artifacts = Get-ChildItem -Path $DistWindowsDir -File | Where-Object { $_.Name -ne "SHA256SUMS.txt" }
$Lines = @()
foreach ($file in $Artifacts) {
    $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash.ToLower()
    $Lines += "$hash  $($file.Name)"
}
$Lines | Set-Content -Path $ChecksumFile -Encoding UTF8

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  COMPILACION DE WINDOWS COMPLETADA EXITOSAMENTE                              " -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "Artefactos generados en: $DistWindowsDir" -ForegroundColor Cyan
Get-ChildItem -Path $DistWindowsDir | Select-Object Name, @{Name="Tamano(MB)";Expression={[math]::Round($_.Length / 1MB, 2)}} | Format-Table -AutoSize
