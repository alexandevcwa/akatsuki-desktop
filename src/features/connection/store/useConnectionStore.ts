import { create } from "zustand";
import { ActiveSession, AndroidDeviceNode, ConnectionState } from "@/shared/types/protocol";
import { pairWithAndroidService, scanLanAndroidDevices } from "../services/connectionIpc";

interface ConnectionStore {
  status: ConnectionState;
  discoveredDevices: AndroidDeviceNode[];
  activeSession: ActiveSession | null;
  errorMessage: string | null;
  isRadarModalOpen: boolean;

  setRadarModalOpen: (open: boolean) => void;
  scanNetwork: () => Promise<void>;
  connectToDevice: (ipAddress: string, port: number, pinCode: string, fingerprint?: string) => Promise<void>;
  disconnect: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: "disconnected",
  discoveredDevices: [],
  activeSession: null,
  errorMessage: null,
  isRadarModalOpen: false,

  setRadarModalOpen: (open) => set({ isRadarModalOpen: open }),

  scanNetwork: async () => {
    set({ status: "scanning", errorMessage: null });
    try {
      const devices = await scanLanAndroidDevices();
      set({
        discoveredDevices: devices,
        status: "disconnected",
      });
    } catch (err) {
      set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
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

  disconnect: () => {
    set({
      activeSession: null,
      status: "disconnected",
      errorMessage: null,
    });
  },
}));
