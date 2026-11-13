import React from "react";
import { ConnectionRadarModal } from "@/features/connection/components/ConnectionRadarModal";
import { DualExplorerWorkspace } from "@/features/explorer/components/DualExplorerWorkspace";
import { AppFooter } from "@/features/shell/components/AppFooter";
import { AppTopBar } from "@/features/shell/components/AppTopBar";
import { TransferQueueDrawer } from "@/features/transfer/components/TransferQueueDrawer";

export const App: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-akatsuki-void cyber-grid-bg border border-white/10 flex flex-col overflow-hidden select-none">
      <AppTopBar />

      <main className="flex-1 min-h-0 p-4 flex flex-col gap-4 overflow-hidden">
        <DualExplorerWorkspace />
        <TransferQueueDrawer />
      </main>

      <AppFooter />

      <ConnectionRadarModal />
    </div>
  );
};

export default App;
