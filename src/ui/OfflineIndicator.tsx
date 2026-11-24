import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    const onSwUpdate = () => setSwUpdateAvailable(true);

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('sl-sw-update', onSwUpdate);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('sl-sw-update', onSwUpdate);
    };
  }, []);

  if (!offline && !swUpdateAvailable) return null;

  return (
    <div
      className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex flex-wrap items-center gap-2 pointer-events-auto"
      style={{
        marginBottom: 'env(safe-area-inset-bottom, 0px)',
        marginLeft: 'env(safe-area-inset-left, 0px)',
      }}
    >
      {offline && (
        <div
          role="status"
          className="sl-panel-chassis px-3 py-1.5 rounded-lg border-amber-400/50 text-amber-300 text-[11px] font-bold flex items-center gap-1.5"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Offline · Local Save</span>
        </div>
      )}
      {swUpdateAvailable && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan min-h-[38px] px-3.5 py-1.5 text-[11px] font-display font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span>Update Ready · Reload</span>
        </button>
      )}
    </div>
  );
};
