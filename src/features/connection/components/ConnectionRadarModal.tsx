import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Radio,
  ShieldCheck,
  Smartphone,
  Lock,
  X,
  RefreshCw,
  Link2,
  Activity,
  AlertCircle,
} from "lucide-react";
import {
  CyberPanel,
  CyberButton,
  CyberBadge,
  CyberInput,
  Heading3,
  BodyText,
  MonoTelemetry,
  MonoHash,
} from "@/design-system";
import { useAnimatedPresence } from "@/shared/utils/useAnimatedPresence";
import { useConnectionStore } from "../store/useConnectionStore";

/**
 * Sanitiza cualquier mensaje de error para asegurar que nunca se muestre JSON crudo
 * ni trazas técnicas al usuario final.
 */
function formatUserFriendlyError(rawError: string | null): string | null {
  if (!rawError) return null;
  const trimmed = rawError.trim();

  if (
    trimmed.includes("401") ||
    /unauthorized|invalid.*pin|pin.*incorrect/i.test(trimmed)
  ) {
    return "Código PIN incorrecto o sesión expirada. Verifica el PIN mostrado en tu celular Android.";
  }
  if (trimmed.includes("403") || /forbidden/i.test(trimmed)) {
    return "El dispositivo Android rechazó el acceso. Acepta los permisos en tu celular.";
  }
  if (trimmed.includes("429") || /too many/i.test(trimmed)) {
    return "Demasiados intentos fallidos. Espera un momento antes de volver a intentarlo.";
  }
  if (
    trimmed.startsWith("{") ||
    trimmed.includes('{"') ||
    trimmed.includes("HTTP ")
  ) {
    return "No se pudo vincular con el dispositivo Android. Verifica que el PIN y la dirección IP sean correctos.";
  }
  return trimmed;
}

export const ConnectionRadarModal: React.FC = () => {
  const {
    isRadarModalOpen,
    setRadarModalOpen,
    status,
    scanRemainingSeconds,
    discoveredDevices,
    scanNetwork,
    probeNodeHealth,
    connectToDevice,
    errorMessage,
  } = useConnectionStore();

  const { shouldRender, isClosing } = useAnimatedPresence(
    isRadarModalOpen,
    140,
  );

  const [ipAddress, setIpAddress] = useState("192.168.1.88");
  const [port, setPort] = useState("8443");
  const [pinCode, setPinCode] = useState("");
  const [selectedFingerprint, setSelectedFingerprint] = useState<
    string | undefined
  >(undefined);
  const [probingHealth, setProbingHealth] = useState(false);

  // Diferir el escaneo de red 180ms hasta que la animación de apertura del modal haya terminado
  useEffect(() => {
    if (isRadarModalOpen) {
      const timer = setTimeout(() => {
        scanNetwork();
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isRadarModalOpen, scanNetwork]);

  useEffect(() => {
    if (!isRadarModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRadarModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRadarModalOpen, setRadarModalOpen]);

  if (!shouldRender) return null;

  const handleProbeHealth = async () => {
    setProbingHealth(true);
    try {
      const node = await probeNodeHealth(
        ipAddress.trim(),
        Number(port) || 8443,
      );
      if (node) {
        setSelectedFingerprint(node.tlsCertFingerprintSha256);
      }
    } finally {
      setProbingHealth(false);
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    connectToDevice(
      ipAddress.trim(),
      Number(port) || 8443,
      pinCode.trim(),
      selectedFingerprint,
    );
  };

  const qrPayload = JSON.stringify({
    client: "akatsuki-desktop",
    protocol: "https-tofu-v1",
    targetEndpoint: `https://${ipAddress}:${port}`,
    pin: pinCode,
  });

  const cleanError = formatUserFriendlyError(errorMessage);

  return (
    <div
      onClick={() => setRadarModalOpen(false)}
      className={`fixed inset-0 z-50 bg-[#05050A]/88 flex items-center justify-center p-4 ${
        isClosing ? "animate-cyber-backdrop-out" : "animate-cyber-backdrop-in"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl ${
          isClosing ? "animate-cyber-modal-out" : "animate-cyber-modal-in"
        }`}
      >
        <CyberPanel
          title="RADAR DE CONEXIÓN // DISPOSITIVO ANDROID"
          subtitle="Vinculación segura en red local mediante detección automática, código PIN o QR"
          accentColor="crimson"
          className="w-full"
          headerRight={
            <CyberButton
              variant="ghost"
              size="sm"
              onClick={() => setRadarModalOpen(false)}
              leftIcon={<X className="w-4 h-4" />}
            >
              Cerrar
            </CyberButton>
          }
        >
          <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Columna Izquierda: Escáner LAN + Nodos Detectados */}
            <div className="md:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <Heading3 className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-akatsuki-cyan animate-pulse" />
                  Dispositivos Android en Red Local
                </Heading3>
                <CyberButton
                  variant="secondary"
                  size="sm"
                  onClick={scanNetwork}
                  className={`tabular-nums min-w-[146px] ${
                    status === "scanning"
                      ? "pointer-events-none bg-akatsuki-cyan/15 cyber-border-cyan"
                      : ""
                  }`}
                  leftIcon={
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${status === "scanning" ? "animate-spin" : ""}`}
                    />
                  }
                >
                  {status === "scanning"
                    ? `Buscando (${scanRemainingSeconds || 10}s)...`
                    : "Buscar en Red"}
                </CyberButton>
              </div>

              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {discoveredDevices.length === 0 ? (
                  <div className="p-5 bg-akatsuki-mantle cyber-chamfer-sm cyber-border-subtle text-center space-y-1.5">
                    <MonoHash className="block text-akatsuki-heading tabular-nums">
                      {status === "scanning"
                        ? `BUSCANDO DISPOSITIVOS EN TU RED WI-FI (${scanRemainingSeconds || 10}S)...`
                        : "NO SE DETECTARON DISPOSITIVOS AUTOMÁTICAMENTE"}
                    </MonoHash>
                    <BodyText className="text-xs text-akatsuki-muted">
                      Asegúrate de que la aplicación en tu celular Android esté
                      activa en la misma red Wi-Fi o ingresa su dirección IP y
                      puerto en el panel derecho.
                    </BodyText>
                  </div>
                ) : (
                  discoveredDevices.map((dev) => {
                    const isSelected =
                      ipAddress === dev.ipAddress && String(dev.port) === port;
                    return (
                      <div
                        key={dev.deviceId}
                        onClick={() => {
                          setIpAddress(dev.ipAddress);
                          setPort(String(dev.port));
                          setSelectedFingerprint(dev.tlsCertFingerprintSha256);
                        }}
                        className={`p-3 bg-akatsuki-mantle cursor-pointer transition-[transform,background-color] duration-150 hover:translate-x-1 cyber-chamfer-sm hover-cyber-border-crimson flex flex-col gap-1.5 ${
                          isSelected
                            ? "cyber-border-crimson"
                            : "cyber-border-subtle"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-akatsuki-primary-glow" />
                            <span className="font-display text-button-sm text-akatsuki-heading">
                              {dev.deviceName}
                            </span>
                          </div>
                          <CyberBadge tone="cyan">DETECTADO</CyberBadge>
                        </div>

                        <div className="flex items-center justify-between">
                          <MonoTelemetry>
                            {dev.ipAddress}:{dev.port}
                          </MonoTelemetry>
                          <span className="text-mono-hash text-akatsuki-muted">
                            {dev.model}
                          </span>
                        </div>

                        <div className="pt-1 border-t border-white/5 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-akatsuki-purple shrink-0" />
                          <MonoHash className="truncate">
                            Huella de Seguridad: {dev.tlsCertFingerprintSha256}
                          </MonoHash>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bloque Informativo de Seguridad */}
              <div className="p-3 bg-akatsuki-mantle/80 border border-akatsuki-purple/30 space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-akatsuki-purple" />
                  <span className="font-display text-list-header uppercase text-purple-300">
                    Enlace Cifrado y Verificado
                  </span>
                </div>
                <BodyText className="text-xs text-akatsuki-muted">
                  La transferencia entre tu computadora y tu celular Android
                  está protegida con cifrado de extremo a extremo y validación
                  automática de integridad en cada archivo.
                </BodyText>
              </div>
            </div>

            {/* Columna Derecha: Formulario de Conexión Manual + QR */}
            <form
              onSubmit={handleConnect}
              className="md:col-span-5 flex flex-col justify-between space-y-4 bg-akatsuki-mantle p-4 border border-white/10"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Heading3>Datos de Conexión</Heading3>
                  <CyberButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleProbeHealth}
                    disabled={probingHealth}
                    leftIcon={
                      <Activity className="w-3.5 h-3.5 text-akatsuki-cyan" />
                    }
                  >
                    {probingHealth ? "Verificando..." : "Verificar IP"}
                  </CyberButton>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <CyberInput
                      label="IP Dispositivo"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      mono
                      required
                    />
                  </div>
                  <div>
                    <CyberInput
                      label="Puerto"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      mono
                      required
                    />
                  </div>
                </div>

                <CyberInput
                  label="Código PIN de Vinculación"
                  placeholder="Ingresa el PIN de 6 dígitos"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  mono
                  required
                />

                {/* QR para escaneo desde la app Android */}
                <div className="pt-2 flex items-center gap-3 bg-akatsuki-panel p-2.5 border border-white/10">
                  <div className="bg-white p-1.5 rounded-sm shrink-0">
                    <QRCodeSVG value={qrPayload} size={68} level="M" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-display text-list-header uppercase text-akatsuki-heading block">
                      Sincronización Rápida QR
                    </span>
                    <p className="text-[11px] text-akatsuki-muted leading-tight">
                      Escanea este código desde la aplicación de tu celular
                      Android o ingresa el código PIN para vincular ambos
                      equipos.
                    </p>
                  </div>
                </div>

                {cleanError && (
                  <div className="animate-cyber-slide-down p-2.5 bg-akatsuki-primary-muted/90 cyber-chamfer-sm cyber-border-crimson flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-akatsuki-primary-glow shrink-0 mt-0.5" />
                    <span className="text-xs font-sans text-akatsuki-heading leading-snug">
                      {cleanError}
                    </span>
                  </div>
                )}
              </div>

              <CyberButton
                type="submit"
                variant="primary"
                className="w-full"
                leftIcon={<Link2 className="w-4 h-4" />}
                disabled={status === "pairing"}
              >
                {status === "pairing"
                  ? "Conectando con Android..."
                  : "Conectar Dispositivo"}
              </CyberButton>
            </form>
          </div>
        </CyberPanel>
      </div>
    </div>
  );
};
