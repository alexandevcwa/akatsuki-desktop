import { create } from "zustand";
import { ActiveSession, AndroidDeviceNode, ConnectionState } from "@/shared/types/protocol";
import {
  checkAndroidNodeHealth,
  getAndroidStorageInfo,
  pairWithAndroidService,
  revokeAndroidSession,
  scanLanAndroidDevices,
} from "../services/connectionIpc";

interface ConnectionStore {
  status: ConnectionState;
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
  discoveredDevices: [],
  activeSession: null,
  errorMessage: null,
  isRadarModalOpen: false,

  setRadarModalOpen: (open) => set({ isRadarModalOpen: open, errorMessage: null }),

  scanNetwork: async () => {
    set({ status: "scanning", errorMessage: null });
    try {
      const devices = await scanLanAndroidDevices();
      set({
        discoveredDevices: devices,
        status: get().activeSession ? "connected" : "disconnected",
      });
    } catch (err) {
      set({
        status: get().activeSession ? "connected" : "disconnected",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
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
    set({ status: "pairing", errorMessage: null });
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
