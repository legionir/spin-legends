import React from 'react';
import type { ReplayHudTelemetry } from '../scene/arenaScene';

interface ReplayOverlayProps {
  telemetry?: ReplayHudTelemetry | null;
  onSkip: () => void;
}

/**
 * Minimal full-screen cinematic overlay shown during the post-match replay.
 * Deliberately renders no battle HUD (cards, abilities, quick swap, banner):
 * only letterbox bars, a REPLAY tag, a progress bar and a Skip button.
 */
export const ReplayOverlay: React.FC<ReplayOverlayProps> = ({ telemetry, onSkip }) => {
  const progress = Math.max(0, Math.min(1, telemetry?.progress ?? 0));
  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none" data-testid="replay-overlay">
      {/* Letterbox bars */}
      <div className="absolute top-0 left-0 right-0 h-[7vh] bg-black/85" />
      <div className="absolute bottom-0 left-0 right-0 h-[7vh] bg-black/85" />

      {/* REPLAY tag */}
      <div
        className="absolute flex items-center gap-2 text-rose-400 font-black text-xs tracking-widest"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 1.6vh)',
          left: 'calc(env(safe-area-inset-left, 0px) + 16px)',
        }}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.95)] animate-pulse" />
        REPLAY
      </div>

      {/* Skip */}
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.blur();
          onSkip();
        }}
        aria-label="Skip Replay"
        className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-rose pointer-events-auto absolute min-h-[44px] min-w-[72px] px-4 text-xs font-bold cursor-pointer"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 0.6vh)',
          right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
        }}
      >
        Skip ›
      </button>

      {/* Progress bar */}
      <div
        className="absolute left-0 right-0 h-1 bg-white/15"
        style={{ bottom: '7vh' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="h-full bg-rose-500" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
};

export default ReplayOverlay;
