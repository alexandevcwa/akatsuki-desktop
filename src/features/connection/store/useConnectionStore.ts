import { create } from "zustand";
import { ActiveSession, AndroidDeviceNode, ConnectionState } from "@/shared/types/protocol";
import {
  checkAndroidNodeHealth,
  getAndroidStorageInfo,
  pairWithAndroidService,
  revokeAndroidSession,
  scanLanAndroidDevices,
} from "../services/connectionIpc";

const SCAN_DURATION_SECONDS = 10;

let activeScanToken = 0;
let countdownIntervalId: ReturnType<typeof setInterval> | null = null;

function clearActiveScanCountdown() {
  if (countdownIntervalId !== null) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
}

function mergeDiscoveredNodes(
  existing: AndroidDeviceNode[],
  incoming: AndroidDeviceNode[]
): AndroidDeviceNode[] {
  const map = new Map<string, AndroidDeviceNode>();
  for (const item of existing) {
    map.set(item.ipAddress, item);
  }
  for (const item of incoming) {
    map.set(item.ipAddress, item);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.ipAddress.localeCompare(b.ipAddress)
  );
}

interface ConnectionStore {
  status: ConnectionState;
  scanRemainingSeconds: number;
  discoveredDevices: AndroidDeviceNode[];
  activeSession: ActiveSession | null;
  errorMessage: string | null;
  isRadarModalOpen: boolean;

  setRadarModalOpen: (open: boolean) => void;
  scanNetwork: () => Promise<void>;
  probeNodeHealth: (ipAddress: string, port: number) => Promise<AndroidDeviceNode | null>;
  connectToDevice: (
    ipAddress: string,
    port: number,
    pinCode: string,
    fingerprint?: string
  ) => Promise<void>;
  refreshStorageInfo: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  status: "disconnected",
  scanRemainingSeconds: 0,
  discoveredDevices: [],
  activeSession: null,
  errorMessage: null,
  isRadarModalOpen: false,

  setRadarModalOpen: (open) => {
    if (!open) {
      activeScanToken += 1;
      clearActiveScanCountdown();
      set((state) => ({
        isRadarModalOpen: false,
        errorMessage: null,
        scanRemainingSeconds: 0,
        status: state.activeSession ? "connected" : "disconnected",
      }));
      return;
    }
    set({ isRadarModalOpen: true, errorMessage: null });
  },

  scanNetwork: async () => {
    // Evitar múltiples conteos solapados si ya está buscando activamente
    if (get().status === "scanning" && get().scanRemainingSeconds > 0) {
      return;
    }

    const currentToken = ++activeScanToken;
    clearActiveScanCountdown();

    set({
      status: "scanning",
      scanRemainingSeconds: SCAN_DURATION_SECONDS,
      errorMessage: null,
    });

    const endTime = Date.now() + SCAN_DURATION_SECONDS * 1000;

    countdownIntervalId = setInterval(() => {
      if (currentToken !== activeScanToken) {
        clearActiveScanCountdown();
        return;
      }
      const remainingMs = endTime - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      if (remainingSec <= 0) {
        clearActiveScanCountdown();
        set((state) => ({
          scanRemainingSeconds: 0,
          status:
            state.status === "pairing"
              ? "pairing"
              : state.activeSession
              ? "connected"
              : "disconnected",
        }));
      } else {
        set({ scanRemainingSeconds: remainingSec });
      }
    }, 250);

    try {
      while (Date.now() < endTime && currentToken === activeScanToken) {
        try {
          const devices = await scanLanAndroidDevices();
          if (currentToken !== activeScanToken) break;

          if (devices.length > 0) {
            set((state) => ({
              discoveredDevices: mergeDiscoveredNodes(
                state.discoveredDevices,
                devices
              ),
            }));
          }
        } catch (err) {
          if (currentToken !== activeScanToken) break;
          // Continúa intentando durante la ventana de 10 segundos
          console.debug("Intento de escaneo LAN:", err);
        }

        const timeLeft = endTime - Date.now();
        if (timeLeft <= 0 || currentToken !== activeScanToken) {
          break;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(400, timeLeft))
        );
      }
    } finally {
      if (currentToken === activeScanToken) {
        clearActiveScanCountdown();
        set((state) => ({
          scanRemainingSeconds: 0,
          status:
            state.status === "pairing"
              ? "pairing"
              : state.activeSession
              ? "connected"
              : "disconnected",
        }));
      }
    }
  },

  probeNodeHealth: async (ipAddress, port) => {
    set({ errorMessage: null });
    try {
      const health = await checkAndroidNodeHealth(ipAddress, port);
      const node: AndroidDeviceNode = {
        deviceId: health.deviceId,
        deviceName: health.deviceName,
        model: health.model,
        ipAddress,
        port: health.port,
        tlsCertFingerprintSha256: health.tlsCertFingerprintSha256,
        discoveredVia: "health-probe",
        paired: false,
      };
      set((state) => {
        const exists = state.discoveredDevices.some((d) => d.ipAddress === ipAddress);
        return {
          discoveredDevices: exists
            ? state.discoveredDevices.map((d) => (d.ipAddress === ipAddress ? node : d))
            : [node, ...state.discoveredDevices],
        };
      });
      return node;
    } catch (err) {
      set({
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  },

  connectToDevice: async (ipAddress, port, pinCode, fingerprint) => {
    activeScanToken += 1;
    clearActiveScanCountdown();
    set({ status: "pairing", scanRemainingSeconds: 0, errorMessage: null });
    try {
      const session = await pairWithAndroidService({
        ipAddress,
        port,
        pinCode,
        expectedFingerprint: fingerprint,
      });
      set({
        activeSession: session,
        status: "connected",
        isRadarModalOpen: false,
      });
    } catch (err) {
      set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },

  refreshStorageInfo: async () => {
    const current = get().activeSession;
    if (!current) return;
    try {
      const storage = await getAndroidStorageInfo({
        ipAddress: current.device.ipAddress,
        port: current.device.port,
        bearerToken: current.bearerToken,
      });
      set({
        activeSession: {
          ...current,
          androidStorageTotalBytes: storage.androidStorageTotalBytes,
          androidStorageFreeBytes: storage.androidStorageFreeBytes,
        },
      });
    } catch {
      // Mantiene el último estado de almacenamiento conocido si la consulta falla
    }
  },

  disconnect: async () => {
    const current = get().activeSession;
    set({
      activeSession: null,
      status: "disconnected",
      errorMessage: null,
    });
    if (current) {
      try {
        await revokeAndroidSession({
          ipAddress: current.device.ipAddress,
          port: current.device.port,
          bearerToken: current.bearerToken,
        });
      } catch {
        // Si el dispositivo Android ya se desconectó de la red, ignoramos el fallo de red al revocar
      }
    }
  },
}));
