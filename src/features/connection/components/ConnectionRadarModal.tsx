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
import { useConnectionStore } from "../store/useConnectionStore";

export const ConnectionRadarModal: React.FC = () => {
  const {
    isRadarModalOpen,
    setRadarModalOpen,
    status,
    discoveredDevices,
    scanNetwork,
    probeNodeHealth,
    connectToDevice,
    errorMessage,
  } = useConnectionStore();

  const [ipAddress, setIpAddress] = useState("192.168.1.88");
  const [port, setPort] = useState("8443");
  const [pinCode, setPinCode] = useState("");
  const [selectedFingerprint, setSelectedFingerprint] = useState<string | undefined>(undefined);
  const [probingHealth, setProbingHealth] = useState(false);

  useEffect(() => {
    if (isRadarModalOpen) {
      scanNetwork();
    }
  }, [isRadarModalOpen, scanNetwork]);

  if (!isRadarModalOpen) return null;

  const handleProbeHealth = async () => {
    setProbingHealth(true);
    try {
      const node = await probeNodeHealth(ipAddress.trim(), Number(port) || 8443);
      if (node) {
        setSelectedFingerprint(node.tlsCertFingerprintSha256);
      }
    } finally {
      setProbingHealth(false);
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    connectToDevice(ipAddress.trim(), Number(port) || 8443, pinCode.trim(), selectedFingerprint);
  };

  const qrPayload = JSON.stringify({
    client: "akatsuki-desktop",
    protocol: "https-tofu-v1",
    targetEndpoint: `https://${ipAddress}:${port}`,
    pin: pinCode,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <CyberPanel
        title="RADAR DE CONEXIÓN // ANDROID WEB SERVICE"
        subtitle="Descubrimiento LAN (/api/v1/health) + Emparejamiento HTTPS TLS 1.3 TOFU (/api/v1/auth/pair)"
        accentColor="crimson"
        className="w-full max-w-3xl shadow-crimson-glow"
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
                leftIcon={
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${status === "scanning" ? "animate-spin" : ""}`}
                  />
                }
              >
                {status === "scanning" ? "Escaneando..." : "Escanear LAN"}
              </CyberButton>
            </div>

            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {discoveredDevices.length === 0 ? (
                <div className="p-5 bg-akatsuki-mantle cyber-chamfer-sm cyber-border-subtle text-center space-y-1.5">
                  <MonoHash className="block text-akatsuki-heading">
                    {status === "scanning"
                      ? "ESCANEANDO SUBRED LOCAL EN PUERTO 8443..."
                      : "NINGÚN SERVIDOR ANDROID DETECTADO AUTOMÁTICAMENTE"}
                  </MonoHash>
                  <BodyText className="text-xs text-akatsuki-muted">
                    Asegúrate de que el servicio web en tu celular Android esté activo en la misma
                    red Wi-Fi o ingresa su IP:Puerto manualmente a la derecha.
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
                      className={`p-3 bg-akatsuki-mantle cursor-pointer transition-all cyber-chamfer-sm hover-cyber-border-crimson flex flex-col gap-1.5 ${
                        isSelected ? "cyber-border-crimson" : "cyber-border-subtle"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-akatsuki-primary-glow" />
                          <span className="font-display text-button-sm text-akatsuki-heading">
                            {dev.deviceName}
                          </span>
                        </div>
                        <CyberBadge tone="cyan">{dev.discoveredVia.toUpperCase()}</CyberBadge>
                      </div>

                      <div className="flex items-center justify-between">
                        <MonoTelemetry>
                          https://{dev.ipAddress}:{dev.port}
                        </MonoTelemetry>
                        <span className="text-mono-hash text-akatsuki-muted">{dev.model}</span>
                      </div>

                      <div className="pt-1 border-t border-white/5 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-akatsuki-purple shrink-0" />
                        <MonoHash className="truncate">
                          TLS SHA-256: {dev.tlsCertFingerprintSha256}
                        </MonoHash>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bloque Informativo de Seguridad TOFU */}
            <div className="p-3 bg-akatsuki-mantle/80 border border-akatsuki-purple/30 space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-akatsuki-purple" />
                <span className="font-display text-list-header uppercase text-purple-300">
                  Arquitectura de Seguridad: Certificate Pinning (TOFU)
                </span>
              </div>
              <BodyText className="text-xs text-akatsuki-muted">
                El Core de Rust valida criptográficamente la huella SHA-256 del certificado TLS
                autofirmado del servidor Android y firma cada petición con tu Token Bearer de sesión.
              </BodyText>
            </div>
          </div>

          {/* Columna Derecha: Formulario de Conexión Manual + Health Check + QR */}
          <form
            onSubmit={handleConnect}
            className="md:col-span-5 flex flex-col justify-between space-y-4 bg-akatsuki-mantle p-4 border border-white/10"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Heading3>Parámetros del Web Service</Heading3>
                <CyberButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleProbeHealth}
                  disabled={probingHealth}
                  leftIcon={<Activity className="w-3.5 h-3.5 text-akatsuki-cyan" />}
                >
                  {probingHealth ? "Probando..." : "Ping /health"}
                </CyberButton>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <CyberInput
                    label="IP del Celular Android"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    mono
                    required
                  />
                </div>
                <div>
                  <CyberInput
                    label="Puerto HTTPS"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    mono
                    required
                  />
                </div>
              </div>

              <CyberInput
                label="PIN de Emparejamiento (6 dígitos)"
                placeholder="Ej. 749201"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                mono
                required
              />

              {/* QR para escaneo inverso desde la app Android */}
              <div className="pt-2 flex items-center gap-3 bg-akatsuki-panel p-2.5 border border-white/10">
                <div className="bg-white p-1.5 rounded-sm shrink-0">
                  <QRCodeSVG value={qrPayload} size={68} level="M" />
                </div>
                <div className="space-y-1">
                  <span className="font-display text-list-header uppercase text-akatsuki-heading block">
                    Sincronización Rápida QR
                  </span>
                  <p className="text-[11px] text-akatsuki-muted leading-tight">
                    Escanea desde tu app Android o pulsa Conectar para ejecutar{" "}
                    <code className="text-akatsuki-telemetry">POST /api/v1/auth/pair</code>.
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2 bg-akatsuki-primary-muted border border-akatsuki-danger text-xs text-akatsuki-accent font-mono break-words">
                  {errorMessage}
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
              {status === "pairing" ? "Verificando TLS & PIN..." : "Conectar al Servicio Android"}
            </CyberButton>
          </form>
        </div>
      </CyberPanel>
    </div>
  );
};
