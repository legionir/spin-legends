import React, { useEffect } from 'react';
import {
  BookOpen,
  Crosshair,
  Gamepad2,
  MousePointer,
  ShieldAlert,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 sl-safe-inset backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.70)' }}
    >
      <button
        type="button"
        aria-label="Close How to Play modal"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 w-full h-full bg-transparent cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to Play Spin Legends"
        className="relative z-10 sl-panel-modal w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="sl-ls-modal-header px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h2 className="font-display sl-title-metal text-base sm:text-lg font-bold uppercase tracking-wider">
                How to Play Spin Legends
              </h2>
              <p className="text-xs text-slate-400">
                Physics combat rules, touch & desktop controls, and arena hazards
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close How to Play"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sl-hairline" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto sl-scroll p-4 sm:p-5 space-y-4">
          {/* Core 5s Launch */}
          <div className="p-3.5 rounded-xl border border-sky-500/40 bg-sky-950/20 space-y-1.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <Crosshair className="w-4 h-4" />
              1. 5-Second Simultaneous Launch
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              Before each match starts, aim inside the arena dish across your 0°–90° orbital arc, watch the oscillating Launch Power bar peak in the golden zone, and press{' '}
              <strong className="text-amber-300">LET IT SPIN!</strong> (or{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px]">
                SPACE
              </kbd>
              ). Once launched, pure orbital physics takes over!
            </p>
          </div>

          {/* Desktop vs Touch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <MousePointer className="w-4 h-4" />
                Desktop Controls
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">Aim & Launch:</strong> Click or drag inside the 3D arena dish; press{' '}
                  <kbd className="px-1 rounded bg-slate-950 border border-slate-700 text-[10px]">SPACE</kbd> to drop.
                </li>
                <li>
                  <strong className="text-white">Camera:</strong> Drag outside/right-drag to orbit, scroll wheel to zoom.
                </li>
                <li>
                  <strong className="text-white">Abilities:</strong>{' '}
                  <kbd className="px-1 rounded bg-slate-950 border border-slate-700 text-[10px]">Q</kbd>{' '}
                  <kbd className="px-1 rounded bg-slate-950 border border-slate-700 text-[10px]">E</kbd>{' '}
                  <kbd className="px-1 rounded bg-slate-950 border border-slate-700 text-[10px]">R</kbd>{' '}
                  <kbd className="px-1 rounded bg-slate-950 border border-slate-700 text-[10px]">F</kbd> triggers items & bursts.
                </li>
                <li>
                  <strong className="text-white">Tag Team / Pause:</strong>{' '}
                  <kbd className="px-1 rounded bg-slate-950 border border-slate-700 text-[10px]">TAB</kbd> swaps team top;{' '}
                  <kbd className="px-1 rounded bg-slate-950 border border-slate-700 text-[10px]">ESC</kbd> pauses.
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                Touch & Mobile Controls
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">Launch Aim:</strong> Slide one finger directly across the arena dish during Launch without orbiting the camera.
                </li>
                <li>
                  <strong className="text-white">Camera Orbit & Zoom:</strong> Drag during combat to orbit; pinch with two fingers anytime to zoom.
                </li>
                <li>
                  <strong className="text-white">Skills & Burst:</strong> Tap any of the 4 bottom item cards when glowing and funded by Energy / 100% Resonance.
                </li>
              </ul>
            </div>
          </div>

          {/* Win Conditions & Hazards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Victory Conditions
              </div>
              <ul className="text-xs text-slate-300 space-y-1 leading-relaxed">
                <li>
                  <strong className="text-sky-300">Spin Finish:</strong> Outlast rival RPM until their top stalls.
                </li>
                <li>
                  <strong className="text-amber-300">Ring Out:</strong> Knock rival through a stadium perimeter gate.
                </li>
                <li>
                  <strong className="text-rose-300">Burst / Knockout:</strong> Shatter all 5 rival parts or drain Armor to 0%.
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Hazards, Modes & Training Debug
              </div>
              <ul className="text-xs text-slate-300 space-y-1 leading-relaxed">
                <li>
                  <strong className="text-white">Dynamic Arenas:</strong> Watch for sweeping pillars and hazard traps (Cryo, Voltage, Magma, Gravity) that apply temporary stat debuffs.
                </li>
                <li>
                  <strong className="text-white">Training Telemetry:</strong> Optional battle mode overrides & 1–8 tactical debug commands are available strictly in <strong>Training</strong> mode.
                </li>
              </ul>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center gap-2 text-xs text-slate-400">
            <Gamepad2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Gamepads are supported when enabled in Settings: A/B/X/Y map to abilities (and A launches during countdown), LB/RB swaps Tag Team tops.
            </span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-800/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan min-h-[44px] px-6 py-2 font-display font-bold text-xs cursor-pointer whitespace-nowrap"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
