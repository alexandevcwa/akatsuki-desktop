# Akatsuki Desktop — Cliente Multiplataforma de Transferencia Segura de Archivos

`akatsuki-desktop` es una aplicación de escritorio multiplataforma de alto rendimiento construida sobre **Tauri v2 (Rust + React + TypeScript + Tailwind CSS)**. Su objetivo es actuar como cliente seguro de administración y transferencia bidireccional de archivos frente a un servidor web HTTPS ejecutándose en un dispositivo Android dentro de la misma red de área local (LAN).

El sistema ha sido diseñado para eliminar intermediarios en la nube y cables físicos, ofreciendo transferencias directas por flujo continuo (*streaming*) sobre TLS, verificación criptográfica de integridad `SHA-256` de extremo a extremo y una interfaz gráfica de alta densidad regida por un sistema de diseño estricto.

---

## Tabla de Contenidos

1. [Descripción General y Propósito](#1-descripción-general-y-propósito)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Funcionamiento y Flujos Operativos](#4-funcionamiento-y-flujos-operativos)
5. [Contrato de Comunicación API (Android Web Service)](#5-contrato-de-comunicación-api-android-web-service)
6. [Sistema de Diseño](#6-sistema-de-diseño)
7. [Requisitos Previos](#7-requisitos-previos)
8. [Ejecución, Compilación e Instalación](#8-ejecución-compilación-e-instalación)

---

## 1. Descripción General y Propósito

En el ecosistema del proyecto, el dispositivo móvil Android opera como un **Servidor Web HTTPS autónomo** (por defecto en el puerto `8443`), mientras que la computadora de escritorio ejecuta `akatsuki-desktop` como **Cliente de Control y Transferencia**.

Las capacidades principales del sistema comprenden:

- **Descubrimiento automático en red local**: Detección activa de dispositivos Android disponibles en la subred local mediante barrido TCP asíncrono y verificación de salud del servicio.
- **Seguridad de transporte y emparejamiento TOFU (*Trust On First Use*)**: Autenticación mediante código PIN temporal de 6 dígitos o lectura de código QR, emitiendo un token de sesión (`Bearer Token`) y fijando la huella `SHA-256` del certificado TLS del dispositivo.
- **Explorador de archivos de doble panel (*Dual-Pane*)**: Navegación simultánea del sistema de archivos local (PC) y del almacenamiento del dispositivo Android, con soporte para filtrado instantáneo, creación de directorios, eliminación controlada y transferencia directa.
- **Transferencia por flujo continuo (*Zero-RAM Buffering*)**: Lectura y escritura asíncrona por bloques de 64 KB que permite transferir archivos de varios gigabytes manteniendo un consumo mínimo y constante de memoria RAM.
- **Verificación de integridad extremo a extremo**: Cálculo incremental del resumen criptográfico `SHA-256` durante la transmisión para garantizar que el archivo escrito en el destino sea idéntico al archivo de origen.
- **Ventana nativa personalizada multiplataforma**: Ejecución sin barra de título del sistema operativo (`decorations: false`), incorporando controles de ventana propios compatibles con Linux (Wayland y X11), Windows y macOS.

---

## 2. Stack Tecnológico

### Backend Nativo (`src-tauri/`)
- **Lenguaje**: Rust (Edición 2021, compatible con toolchain 1.96+).
- **Framework de aplicación**: Tauri v2 (`tauri`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-store`).
- **Runtime asíncrono**: Tokio (`tokio`, `tokio-util`, `futures-util`) con ejecución multihilo y manejo de flujos de E/S asíncronos (`ReaderStream`).
- **Cliente HTTP y TLS**: Reqwest (`0.12`) con backend criptográfico `rustls-tls`, soporte para flujos multiparte (`multipart`) y lectura por bloques (`bytes_stream`).
- **Criptografía y serialización**: `sha2` (`SHA-256`), `hex`, `serde`, `serde_json`, `chrono`, `thiserror`.

### Frontend (`src/`)
- **Librería de interfaz**: React 18 con TypeScript 5.6.
- **Empaquetador y entorno de desarrollo**: Vite 6.
- **Gestión de estado**: Zustand 5 (tiendas desacopladas para sesión de red y cola de transferencias).
- **Sistema de estilos**: Tailwind CSS 3.4 extendido con tokens CSS nativos y resolución determinista de clases mediante `clsx` y `tailwind-merge` (`extendTailwindMerge`).
- **Iconografía y utilidades**: Lucide React y `qrcode.react` para generación de payloads de sincronización.

---

## 3. Arquitectura del Sistema

El código fuente sigue una separación estricta entre el núcleo de infraestructura en Rust y la capa de presentación en React:

- **Backend (Arquitectura Hexagonal / Limpia)**: Divide la lógica en modelos de dominio (`domain`), adaptadores de red y criptografía (`infrastructure`), controladores de intercomunicación de procesos (`commands`) y gestión centralizada de errores (`error`).
- **Frontend (Feature-Sliced Design)**: Organiza los módulos por dominio funcional (`connection`, `explorer`, `transfer`), apoyados sobre una capa transversal de sistema de diseño (`design-system`) y contratos compartidos (`shared`).

### Estructura de Directorios

```text
akatsuki-desktop/
├── docs/
│   └── AKATSUKI_DESIGN_AND_ANDROID_API_SPEC.md  # Especificación técnica del protocolo y diseño
├── public/
│   └── fonts/                                   # Fuentes locales WOFF2 (Orbitron, Rajdhani, Plus Jakarta Sans, JetBrains Mono)
├── scripts/
│   ├── build-windows.ps1                        # Script nativo de compilación e instaladores para Windows
│   ├── build-windows-from-linux.sh              # Script de compilación cruzada Linux -> Windows
│   └── install-manjaro.sh                       # Script de compilación e instalación para Manjaro Linux
├── src/                                         # Capa de Presentación (React + TypeScript)
│   ├── assets/
│   │   └── akatsuki-logo.png                    # Activo gráfico de identidad visual
│   ├── styles/
│   │   ├── fonts.css                            # Declaraciones @font-face locales (100% offline)
│   │   ├── tokens.css                           # Variables CSS de paleta de colores y tipografía
│   │   └── globals.css                          # Geometría poligonal, animaciones GPU y utilidades
│   ├── design-system/
│   │   ├── utils/
│   │   │   └── cn.ts                            # Configuración extendida de tailwind-merge
│   │   └── components/                          # Componentes atómicos del sistema de diseño
│   │       ├── AkatsukiCloudIcon.tsx
│   │       ├── CyberBadge.tsx
│   │       ├── CyberButton.tsx
│   │       ├── CyberConfirmDialog.tsx
│   │       ├── CyberInput.tsx
│   │       ├── CyberPanel.tsx
│   │       └── Typography.tsx
│   ├── features/
│   │   ├── connection/                          # Descubrimiento LAN, emparejamiento y sesión
│   │   │   ├── components/ConnectionRadarModal.tsx
│   │   │   ├── services/connectionIpc.ts
│   │   │   └── store/useConnectionStore.ts
│   │   ├── explorer/                            # Navegador de archivos de doble panel
│   │   │   ├── components/FilePane.tsx
│   │   │   ├── components/FileRow.tsx
│   │   │   └── services/explorerIpc.ts
│   │   └── transfer/                            # Motor y telemetría de transferencia de archivos
│   │       ├── components/TransferQueueDrawer.tsx
│   │       ├── services/transferIpc.ts
│   │       └── store/useTransferStore.ts
│   ├── shared/
│   │   ├── types/protocol.ts                    # Contratos de datos equivalentes a los modelos Rust
│   │   └── utils/                               # Formateadores de bytes, hashes y hooks de animación
│   ├── App.tsx                                  # Composición principal y barra de título nativa
│   └── main.tsx                                 # Punto de entrada de la aplicación React
└── src-tauri/                                   # Núcleo Nativo (Rust - Tauri v2)
    ├── icons/                                   # Iconos multi-resolución para Linux, Windows y macOS
    ├── src/
    │   ├── commands/                            # Comandos IPC expuestos al frontend
    │   │   ├── connection_cmd.rs
    │   │   ├── explorer_cmd.rs
    │   │   └── transfer_cmd.rs
    │   ├── domain/                              # Entidades y estructuras de datos del dominio
    │   │   ├── device.rs
    │   │   ├── file_entry.rs
    │   │   └── transfer.rs
    │   ├── infrastructure/                      # Implementación de red, criptografía y descubrimiento
    │   │   ├── android_client.rs                # Cliente HTTPS de los 9 endpoints del servidor Android
    │   │   ├── hash_verifier.rs                 # Cálculo asíncrono de SHA-256 por streaming
    │   │   ├── mdns_discovery.rs                # Escáner de subred LAN asíncrono
    │   │   └── tls_pinning.rs                   # Normalización y verificación constante de huellas TLS
    │   ├── error.rs                             # Mapeo de errores técnicos a mensajes de usuario
    │   ├── lib.rs                               # Inicialización de Tauri e integración con Wayland
    │   └── main.rs                              # Punto de entrada del binario nativo
    ├── Cargo.toml
    └── tauri.conf.json
```

---

## 4. Funcionamiento y Flujos Operativos

### 4.1 Descubrimiento de Dispositivos en Red Local
Al abrir el modal de conexión o accionar la búsqueda en red, el sistema ejecuta un ciclo activo de exploración durante **10 segundos** con cuenta regresiva en tiempo real:
1. El módulo `mdns_discovery.rs` determina la interfaz IPv4 activa del equipo local abriendo un socket UDP sin emitir tráfico externo.
2. Mediante un `JoinSet` de Tokio, lanza sondas TCP concurrentes hacia los 254 hosts de la subred local en el puerto `8443` con un tiempo límite de 500 ms por sonda.
3. Para cada host que acepta la conexión TCP, el cliente consulta `GET /api/v1/health`. Si el servicio responde con estado `online`, el nodo se incorpora de inmediato a la lista de dispositivos detectados en la interfaz junto con su modelo y huella TLS.

### 4.2 Emparejamiento y Seguridad (TOFU + Bearer Token)
1. El usuario selecciona un dispositivo detectado (o introduce manualmente su dirección IP y puerto) e ingresa el código PIN de 6 dígitos generado en la aplicación Android.
2. El comando `pair_android_device` envía una petición `POST /api/v1/auth/pair` incluyendo el nombre del equipo local (`hostname`), el código PIN y el protocolo solicitado.
3. Si el servidor Android valida las credenciales, devuelve un `Bearer Token` de sesión, la huella `SHA-256` de su certificado TLS y las métricas de almacenamiento del dispositivo.
4. El módulo `tls_pinning.rs` verifica en tiempo constante la huella del certificado frente a la huella esperada antes de establecer la sesión activa.
5. Al desconectar, el cliente invoca `POST /api/v1/auth/revoke` para invalidar inmediatamente el token en el dispositivo móvil.

### 4.3 Exploración de Archivos y Control de Acciones
La vista principal presenta dos paneles simétricos (`NODO LOCAL` y `NODO REMOTO`):
- **Nodo Local**: Opera directamente sobre el sistema de archivos del sistema operativo anfitrión mediante `tokio::fs`, ordenando directorios en primer lugar y archivos alfabéticamente.
- **Nodo Remoto**: Consulta `GET /api/v1/fs/list`, crea carpetas mediante `POST /api/v1/fs/mkdir` y elimina recursos mediante `DELETE /api/v1/fs/delete`.
- **Confirmación de operaciones**: Toda acción de envío, recepción o eliminación de recursos despliega un diálogo de confirmación (`CyberConfirmDialog`) que detalla el nombre, ruta completa, tipo, peso y destino antes de ejecutar la operación.

### 4.4 Transferencia por Streaming y Verificación SHA-256
El motor de transferencia en `android_client.rs` y `transfer_cmd.rs` opera en dos direcciones:
- **Envío (PC hacia Android — `POST /api/v1/transfer/upload`)**:
  1. Calcula el hash `SHA-256` del archivo local mediante lectura por bloques de 64 KB (`hash_verifier.rs`).
  2. Abre un flujo asíncrono (`ReaderStream`) que envuelve cada bloque leído y emite eventos de telemetría (`transfer://progress`) hacia la interfaz con los bytes transferidos y la velocidad instantánea en MB/s.
  3. Envía el flujo como cuerpo `multipart/form-data` junto con las cabeceras `X-Destination-Path` y `X-Expected-Sha256`.
  4. Verifica que el hash `SHA-256` devuelto por el servidor Android coincida exactamente con el calculado en origen.
- **Recepción (Android hacia PC — `GET /api/v1/transfer/download`)**:
  1. Solicita el flujo binario del archivo remoto y extrae la cabecera opcional `X-File-Sha256`.
  2. Consume el flujo de red (`bytes_stream`), escribiendo cada bloque directamente en disco y actualizando en paralelo el calculador `SHA-256` y la telemetría de progreso.
  3. Al finalizar la escritura, contrasta el hash calculado localmente con el hash reportado por el dispositivo Android. Si existe discrepancia, elimina el archivo incompleto o corrupto y reporta el incidente.

---

## 5. Contrato de Comunicación API (Android Web Service)

El cliente de escritorio implementa la totalidad de los 9 endpoints que conforman el contrato con el servidor Android:

| # | Método | Ruta | Autenticación | Propósito |
| :- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/v1/health` | Pública | Verificación de disponibilidad, metadatos del nodo y huella TLS. |
| 2 | `POST` | `/api/v1/auth/pair` | PIN (6 dígitos) | Emparejamiento inicial y emisión de `Bearer Token`. |
| 3 | `POST` | `/api/v1/auth/revoke` | Bearer Token | Cierre de sesión e invalidación inmediata del token activo. |
| 4 | `GET` | `/api/v1/device/storage` | Bearer Token | Consulta de capacidad total y espacio libre en el dispositivo. |
| 5 | `GET` | `/api/v1/fs/list` | Bearer Token | Listado de archivos y directorios de una ruta en Android. |
| 6 | `POST` | `/api/v1/fs/mkdir` | Bearer Token | Creación de un nuevo directorio en el almacenamiento remoto. |
| 7 | `DELETE` | `/api/v1/fs/delete` | Bearer Token | Eliminación de un archivo o directorio en el dispositivo Android. |
| 8 | `POST` | `/api/v1/transfer/upload` | Bearer Token | Subida de archivo por streaming multiparte con validación `SHA-256`. |
| 9 | `GET` | `/api/v1/transfer/download`| Bearer Token | Descarga de archivo por streaming binario con validación `SHA-256`. |

La especificación exhaustiva de cabeceras, estructuras JSON y códigos de estado HTTP se encuentra documentada en [`docs/AKATSUKI_DESIGN_AND_ANDROID_API_SPEC.md`](docs/AKATSUKI_DESIGN_AND_ANDROID_API_SPEC.md).

---

## 6. Sistema de Diseño

La interfaz de usuario se rige por un sistema de diseño centralizado en [`src/styles/tokens.css`](src/styles/tokens.css), [`tailwind.config.js`](tailwind.config.js) y [`src/design-system/`](src/design-system/index.ts). No se permite el uso de colores ni tamaños de fuente arbitrarios fuera de los tokens registrados.

### 6.1 Tokens de Color
- **Superficies**:
  - `--ak-bg-void` (`#07070c`): Lienzo raíz de la aplicación.
  - `--ak-bg-mantle` (`#0d0e17`): Barra superior, cabeceras de tabla y barras de estado.
  - `--ak-bg-panel` (`#141624`): Superficie principal de contenedores y paneles.
  - `--ak-bg-elevated` (`#1d2033`): Estado activo o hover en filas de tabla y controles.
- **Acentos funcionales**:
  - `--ak-primary` (`#e11d48`) y `--ak-primary-glow` (`#ff1e4d`): Acción primaria e identidad visual.
  - `--ak-cyber-cyan` (`#00f0ff`): Telemetría de red, direcciones IP y tasas de transferencia.
  - `--ak-cyber-purple` (`#a855f7`): Indicadores de seguridad TLS y verificación `SHA-256`.
  - `--ak-status-success` (`#10b981`), `--ak-status-warning` (`#f59e0b`), `--ak-status-danger` (`#ff003c`).

### 6.2 Escala Tipográfica Oficial
- **Familias tipográficas**:
  - `--font-display`: `Orbitron`, `Rajdhani`, `sans-serif` (encabezados, botones y etiquetas tácticas).
  - `--font-sans`: `Plus Jakarta Sans`, `sans-serif` (cuerpo de texto y nombres de recursos en listas).
  - `--font-mono`: `JetBrains Mono`, `monospace` (metadatos tabulares, fechas, pesos, direcciones IP y hashes).
- **Tokens de tamaño registrados**:
  - Encabezados: `text-display-xl` (`32px`), `text-heading-1` (`22px`), `text-heading-2` (`16px`), `text-heading-3` (`14px`).
  - Contenido y tablas de alta densidad: `text-body-md` (`13px`), `text-list-item` (`12px`), `text-list-meta` (`11px` tabular en una línea), `text-list-header` (`11px`).
  - Botones: `text-button-md` (`13px`), `text-button-sm` (`11px`), `text-button-xs` (`10px`).
  - Telemetría: `text-mono-data` (`12px`), `text-mono-hash` (`11px`), `text-telemetry-xs` (`10px`).

### 6.3 Optimización Gráfica y Geometría Poligonal
- **Bordes biselados de 6 lados (`.cyber-chamfer-xs`, `.cyber-chamfer-sm`, `.cyber-chamfer-md`)**: Implementados mediante `clip-path: polygon(...)` con pseudo-elementos `::after` que trazan el perímetro completo incluyendo las esquinas diagonales a 45 grados.
- **Animaciones aceleradas por GPU**: Todas las transiciones de modales y listas operan exclusivamente sobre propiedades compuestas (`transform: translate3d`, `scale3d` y `opacity`) con aislamiento de layout (`contain: layout style`), garantizando fluidez constante en motores WebKit2GTK sobre Linux/Wayland, WebView2 en Windows y WebKit en macOS.

---

## 7. Requisitos Previos

- **Node.js**: Versión `20.x` o `22.x` LTS (junto con `npm` o `pnpm`).
- **Rust**: Toolchain estable (`rustc` y `cargo` `1.80+`, probado en `1.96.0`).
- **Dependencias del sistema operativo (Linux / Manjaro / Arch Linux)**:
  ```bash
  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg
  ```

---

## 8. Ejecución, Compilación e Instalación

### 8.1 Modo de Desarrollo
Instala las dependencias del frontend y levanta el entorno de desarrollo con recarga en caliente (Vite + Tauri):

```bash
npm install
npm run tauri dev
```

### 8.2 Verificación y Pruebas del Backend en Rust
Para comprobar la compilación estática y ejecutar las pruebas del núcleo nativo:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

### 8.3 Compilación e Instalación Nativa en Manjaro Linux (Wayland / X11)
El repositorio incluye el script automatizado [`scripts/install-manjaro.sh`](scripts/install-manjaro.sh), el cual compila el binario nativo de producción optimizado (`release`), lo instala en el entorno del usuario y registra los iconos multi-resolución y el archivo `.desktop` (`StartupWMClass=akatsuki-desktop`) para que el compositor Wayland y el lanzador de aplicaciones muestren el logotipo oficial del proyecto:

```bash
# Compilar versión de producción e instalar en el sistema del usuario
./scripts/install-manjaro.sh

# Alternativa mediante npm
npm run install:manjaro
```

Opciones adicionales del script de instalación:

```bash
# Registrar únicamente los iconos y el acceso directo en Wayland sin recompilar
./scripts/install-manjaro.sh --icon-only

# Desinstalar el ejecutable, iconos y lanzadores del sistema del usuario
./scripts/install-manjaro.sh --uninstall
```

Una vez completada la instalación, el ejecutable nativo queda disponible tanto en el lanzador de aplicaciones del sistema como en:
- `~/.local/bin/akatsuki-desktop`
- `./dist-linux/akatsuki-desktop`

### 8.4 Compilación y Generación de Instaladores para Windows (NSIS y MSI)

El proyecto cuenta con soporte completo para la generación de paquetes de instalación en Windows 10/11 (`x86_64-pc-windows-msvc`), incluyendo:
- **Instalador NSIS (`*-setup.exe`)**: Comprimido mediante algoritmo `LZMA`, con soporte multilenguaje (Español e Inglés), gráficos personalizados de cabecera/lateral, instalación silenciosa automática del runtime **Microsoft Edge WebView2** (`downloadBootstrapper`) y modalidad dual (`both`: por usuario actual sin requerir privilegios de administrador o para todos los usuarios del equipo).
- **Instalador Empresarial WiX (`*.msi`)**: Paquete estándar de Windows Installer configurado en español (`es-ES`).
- **Ejecutable Portable (`akatsuki-desktop-portable-x64.exe`)**: Binario autónomo optimizado con `LTO` (*Link-Time Optimization*), eliminación de símbolos (`strip = true`) y subsistema gráfico nativo (`windows_subsystem = "windows"`).

#### Opción A: Compilación Nativa desde Windows 10/11 (PowerShell)
Requiere tener instalado Node.js LTS, Rust (`rustup` con toolchain MSVC) y Visual Studio C++ Build Tools:

```powershell
# Generar todos los paquetes (Instalador NSIS .exe + Instalador WiX .msi + Ejecutable Portable .exe)
.\scripts\build-windows.ps1

# Generar únicamente el instalador NSIS (.exe)
.\scripts\build-windows.ps1 -Target nsis

# Generar únicamente el instalador MSI (.msi)
.\scripts\build-windows.ps1 -Target msi

# Limpiar compilaciones previas y reconstruir todo
.\scripts\build-windows.ps1 -Target all -Clean
```

*(También disponible mediante npm en Windows: `npm run build:windows`, `npm run build:windows:nsis`, `npm run build:windows:msi`).*

#### Opción B: Compilación Cruzada hacia Windows desde Manjaro / Arch Linux
Es posible generar tanto el ejecutable `.exe` como el instalador de Windows `*-setup.exe` directamente desde Manjaro Linux utilizando `cargo-xwin` y `nsis`:

```bash
# 1. Instalar dependencias de compilación cruzada en Manjaro Linux (solo la primera vez)
sudo pacman -S --needed clang llvm lld nsis
cargo install --locked cargo-xwin

# 2. Compilar instalador NSIS (.exe) y binario portable (.exe) para Windows
./scripts/build-windows-from-linux.sh
```

*(O mediante npm: `npm run build:windows:cross`).*

#### Opción C: Integración Continua Automatizada (GitHub Actions)
El flujo de trabajo [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml) compila automáticamente en un entorno `windows-latest` los instaladores `.exe` (NSIS), `.msi` (WiX), el binario portable y el archivo de verificación `SHA256SUMS.txt` al publicar una etiqueta de versión (`v*`) o al ejecutarlo manualmente desde la pestaña *Actions*.

Todos los instaladores generados y sus firmas de integridad se almacenan en el directorio `./dist-windows/`.

