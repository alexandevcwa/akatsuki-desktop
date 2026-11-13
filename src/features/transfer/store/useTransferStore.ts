import { create } from "zustand";
import { FileEntry, TransferDirection, TransferTask } from "@/shared/types/protocol";
import { executeFileTransfer } from "../services/transferIpc";

interface TransferStore {
  tasks: TransferTask[];
  enqueueTransfer: (params: {
    file: FileEntry;
    destinationDir: string;
    direction: TransferDirection;
    ipAddress: string;
    port: number;
    bearerToken: string;
  }) => Promise<void>;
  clearCompleted: () => void;
}

export const useTransferStore = create<TransferStore>((set) => ({
  tasks: [],

  enqueueTransfer: async ({
    file,
    destinationDir,
    direction,
    ipAddress,
    port,
    bearerToken,
  }) => {
    const taskId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const destPath = `${destinationDir.replace(/\/$/, "")}/${file.name}`;

    const newTask: TransferTask = {
      id: taskId,
      fileName: file.name,
      sourcePath: file.path,
      destinationPath: destPath,
      direction,
      totalBytes: file.sizeBytes || 1024 * 1024,
      transferredBytes: 0,
      speedBytesPerSec: 0,
      status: "queued",
    };

    set((state) => ({ tasks: [newTask, ...state.tasks] }));

    try {
      await executeFileTransfer({
        taskId,
        fileName: file.name,
        sourcePath: file.path,
        destinationPath: destPath,
        totalBytes: newTask.totalBytes,
        direction,
        ipAddress,
        port,
        bearerToken,
        onProgress: (progress) => {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    transferredBytes: progress.transferredBytes,
                    totalBytes: progress.totalBytes,
                    speedBytesPerSec: progress.speedBytesPerSec,
                    sha256Checksum: progress.sha256Checksum ?? t.sha256Checksum,
                    status: progress.status,
                  }
                : t
            ),
          }));
        },
      });
    } catch (err) {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "failed",
                errorMessage: err instanceof Error ? err.message : String(err),
              }
            : t
        ),
      }));
    }
  },

  clearCompleted: () =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status !== "completed"),
    })),
}));
