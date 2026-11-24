import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Film, Pause, Play, RotateCcw } from 'lucide-react';
import { MatchHighlightClip } from '../domain/types';
import { sampleReplayFrame } from '../domain/replay';
import { ARENA_DISH_RADIUS } from '../domain/rules';

const GATES = [Math.PI / 3, Math.PI, -Math.PI / 3];

function drawTopDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusPx: number,
  spinAngle: number,
  color: string,
  trimColor: string,
  isWinner: boolean,
  isBrokenOut: boolean,
  hasShield = false,
  hasFire = false
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (isBrokenOut) {
    ctx.globalAlpha = 0.42;
  }

  // Active Flame / Fire Power Aura
  if (hasFire) {
    ctx.beginPath();
    ctx.arc(0, 0, radiusPx * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 69, 0, 0.32)';
    ctx.fill();
    ctx.strokeStyle = '#ff5a2f';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Active Shield Bubble Ring
  if (hasShield) {
    ctx.beginPath();
    ctx.arc(0, 0, radiusPx * 1.75, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Outer spin glow
  ctx.beginPath();
  ctx.arc(0, 0, radiusPx * 1.35, 0, Math.PI * 2);
  ctx.fillStyle = `${color}28`;
  ctx.fill();

  // Rotating blades
  ctx.save();
  ctx.rotate(spinAngle);
  ctx.fillStyle = color;
  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 1.5;
  for (let b = 0; b < 4; b++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -radiusPx * 0.3);
    ctx.lineTo(radiusPx * 1.05, -radiusPx * 0.16);
    ctx.lineTo(radiusPx * 0.78, radiusPx * 0.25);
    ctx.lineTo(0, radiusPx * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Inner core hub
  ctx.beginPath();
  ctx.arc(0, 0, radiusPx * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = isWinner ? '#facc15' : '#0f172a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = trimColor;
  ctx.stroke();

  ctx.restore();
}

export const MatchHighlightsPlayer: React.FC<{
  clip: MatchHighlightClip;
}> = ({ clip }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<0.25 | 0.35 | 0.5 | 1>(0.35);
  const [progressRatio, setProgressRatio] = useState(0);

  const duration = useMemo(() => {
    if (clip.frames.length < 2) return 1;
    return Math.max(0.25, clip.frames[clip.frames.length - 1].t - clip.frames[0].t);
  }, [clip.frames]);

  const timeOffsetRef = useRef(0);
  const endHoldRef = useRef(0);

  useEffect(() => {
    timeOffsetRef.current = 0;
    endHoldRef.current = 0;
    setProgressRatio(0);
    setPlaying(true);
  }, [clip]);

  const { frame: activeFrame, rawIdx } = useMemo(
    () => sampleReplayFrame(clip.frames, progressRatio * duration),
    [clip.frames, duration, progressRatio]
  );

  // Playback loop (smooth 60fps slow-motion animation with brief climax hold on winning blow)
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let lastMs = performance.now();

    const tick = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;

      if (endHoldRef.current > 0) {
        endHoldRef.current -= dt;
        if (endHoldRef.current <= 0) {
          timeOffsetRef.current = 0;
          setProgressRatio(0);
        }
      } else {
        timeOffsetRef.current += dt * speed;
        if (timeOffsetRef.current >= duration) {
          timeOffsetRef.current = duration;
          endHoldRef.current = 2.4; // hold 2.4s after final blow / burst before looping
          setProgressRatio(1);
        } else {
          setProgressRatio(timeOffsetRef.current / duration);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, speed, duration]);

  // Draw stadium & interpolated tops + impacts onto Canvas2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 360;
    const height = 224;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#060a16';
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.52;
    const dishPx = 94;
    const scale = dishPx / ARENA_DISH_RADIUS;

    // Dish floor radial gradient
    const [cIn, cMid, cOut] = clip.floorPalette;
    const floorGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, dishPx);
    floorGrad.addColorStop(0, cIn);
    floorGrad.addColorStop(0.55, cMid);
    floorGrad.addColorStop(1, cOut);
    ctx.beginPath();
    ctx.arc(cx, cy, dishPx, 0, Math.PI * 2);
    ctx.fillStyle = floorGrad;
    ctx.fill();

    // Stadium rings
    for (const rFrac of [0.22, 0.45, 0.72, 0.96]) {
      ctx.beginPath();
      ctx.arc(cx, cy, dishPx * rFrac, 0, Math.PI * 2);
      ctx.strokeStyle = rFrac === 0.45 ? `${clip.arenaPrimaryColor}66` : 'rgba(226,232,240,0.14)';
      ctx.lineWidth = rFrac === 0.45 ? 1.5 : 1;
      ctx.stroke();
    }

    // Perimeter solid wall arcs (respecting 3 Ring-Out Exit Gates)
    const orderedGates = [Math.PI / 3, Math.PI, (5 * Math.PI) / 3];
    ctx.lineWidth = 4;
    ctx.strokeStyle = clip.arenaPrimaryColor;
    for (let g = 0; g < 3; g++) {
      const startA = orderedGates[g] + 0.24;
      const endA = (g === 2 ? orderedGates[0] + Math.PI * 2 : orderedGates[g + 1]) - 0.24;
      ctx.beginPath();
      ctx.arc(cx, cy, dishPx + 2, startA, endA);
      ctx.stroke();
    }
    // Open Exit Gate thresholds (dashed markers so empty gates clearly read as open gaps)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
    ctx.lineWidth = 1.5;
    for (const ga of GATES) {
      ctx.beginPath();
      ctx.arc(cx, cy, dishPx + 2, ga - 0.22, ga + 0.22);
      ctx.stroke();
    }
    ctx.restore();

    // Obstacles & Dynamic Trap Zones from recorded frame
    if (activeFrame.obstacles) {
      for (const obs of activeFrame.obstacles) {
        const ox = cx + obs.x * scale;
        const oy = cy + obs.z * scale;
        const or = Math.max(4, obs.radius * scale);
        if (obs.kind === 'pillar') {
          ctx.beginPath();
          ctx.arc(ox, oy, or, 0, Math.PI * 2);
          ctx.fillStyle = '#475569';
          ctx.fill();
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else {
          const hzCol =
            obs.kind === 'heat'
              ? '#ff5a2f'
              : obs.kind === 'shock'
                ? '#facc15'
                : obs.kind === 'sand'
                  ? '#d97706'
                  : '#a855f7';
          ctx.beginPath();
          ctx.arc(ox, oy, or, 0, Math.PI * 2);
          ctx.fillStyle = `${hzCol}28`;
          ctx.fill();
          ctx.strokeStyle = `${hzCol}99`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    // Recent motion trails (last ~14 recorded frames up to rawIdx)
    const trailStart = Math.max(0, rawIdx - 14);
    const drawTrail = (isPlayer: boolean, col: string) => {
      if (rawIdx - trailStart < 1) return;
      ctx.beginPath();
      for (let i = trailStart; i <= rawIdx; i++) {
        const f = clip.frames[i];
        const tx = cx + (isPlayer ? f.px : f.ox) * scale;
        const ty = cy + (isPlayer ? f.pz : f.oz) * scale;
        if (i === trailStart) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.strokeStyle = `${col}88`;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    };
    drawTrail(true, clip.playerColor);
    drawTrail(false, clip.opponentColor);

    // Draw Spinning Tops
    const px = cx + activeFrame.px * scale;
    const py = cy + activeFrame.pz * scale;
    const ox = cx + activeFrame.ox * scale;
    const oy = cy + activeFrame.oz * scale;

    drawTopDisc(
      ctx,
      px,
      py,
      10,
      activeFrame.pSpinAngle,
      clip.playerColor,
      '#e0f2fe',
      clip.winnerSide === 'player' && progressRatio > 0.88,
      clip.winnerSide === 'opponent' && progressRatio > 0.96,
      Boolean(activeFrame.pShield),
      Boolean(activeFrame.pFire)
    );
    drawTopDisc(
      ctx,
      ox,
      oy,
      10,
      activeFrame.oSpinAngle,
      clip.opponentColor,
      '#ffe4e6',
      clip.winnerSide === 'opponent' && progressRatio > 0.88,
      clip.winnerSide === 'player' && progressRatio > 0.96,
      Boolean(activeFrame.oShield),
      Boolean(activeFrame.oFire)
    );

    // Render fiery clash sparks & shockwave ring on impact/winning blow keyframes
    for (let i = Math.max(0, rawIdx - 6); i <= rawIdx; i++) {
      const f = clip.frames[i];
      if (f.clashX === undefined || f.clashZ === undefined) continue;
      const age = rawIdx - i;
      const alpha = Math.max(0, 1 - age / 7);
      const sx = cx + f.clashX * scale;
      const sy = cy + f.clashZ * scale;

      // Shockwave ring
      ctx.beginPath();
      ctx.arc(sx, sy, (6 + age * 4.5) * (f.isCritical ? 1.45 : 1), 0, Math.PI * 2);
      ctx.strokeStyle = f.isCritical
        ? `rgba(250, 204, 21, ${alpha})`
        : `rgba(255, 107, 43, ${alpha})`;
      ctx.lineWidth = f.isCritical ? 2.5 : 1.6;
      ctx.stroke();

      // Radial fire sparks
      const sparkCount = f.isCritical ? 12 : 7;
      for (let s = 0; s < sparkCount; s++) {
        const ang = (s / sparkCount) * Math.PI * 2 + i * 0.7;
        const r1 = 4 + age * 2.5;
        const r2 = r1 + (f.isCritical ? 12 : 7);
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(ang) * r1, sy + Math.sin(ang) * r1);
        ctx.lineTo(sx + Math.cos(ang) * r2, sy + Math.sin(ang) * r2);
        ctx.strokeStyle = s % 2 === 0 ? `rgba(254, 240, 138, ${alpha})` : `rgba(255, 90, 47, ${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // Timestamp badge inside canvas
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(8, 8, 56, 20);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, 56, 20);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`${activeFrame.t.toFixed(1)}s`, 14, 21);

    if (progressRatio >= 0.86) {
      const label = activeFrame.eventLabel || 'FINAL BLOW!';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(cx - 88, 10, 176, 22);
      ctx.strokeStyle = '#facc15';
      ctx.strokeRect(cx - 88, 10, 176, 22);
      ctx.fillStyle = '#facc15';
      ctx.font = '900 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, 25);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }, [activeFrame, clip, progressRatio, rawIdx, speed]);

  const handleScrub = (val: number) => {
    setPlaying(false);
    endHoldRef.current = 0;
    timeOffsetRef.current = val * duration;
    setProgressRatio(val);
  };

  return (
    <div
      className="sl-panel-chassis p-3 rounded-xl border-amber-400/40 space-y-2.5"
      aria-label="Match Highlights Replay"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider text-amber-300">
          <Film className="w-3.5 h-3.5" />
          Match Highlights · Final Blow
        </div>
        <div className="flex items-center gap-1">
          {([0.25, 0.35, 0.5, 1] as const).map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSpeed(sp)}
              className={`sl-btn-3d sl-btn-3d-sm px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                speed === sp ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              {sp}x
            </button>
          ))}
        </div>
      </div>

      {/* Synced Canvas Playback */}
      <div className="relative rounded-md overflow-hidden border border-slate-800 bg-slate-950">
        <canvas
          ref={canvasRef}
          className="w-full h-[200px] block object-contain mx-auto"
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* Live Highlight Frame Telemetry Strip */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
          <div className="flex justify-between font-bold">
            <span style={{ color: clip.playerColor }} className="truncate">
              {clip.playerName}
            </span>
            <span className="text-sky-300 tabular-nums">{activeFrame.pRpm} RPM</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-slate-400 flex-wrap">
            <span>Spin {activeFrame.pStaminaPct}%</span>
            <span>·</span>
            <span>Arm {activeFrame.pDurabilityPct}%</span>
            {activeFrame.pShield && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-sky-500/30 text-sky-300 border border-sky-400/60 shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                🛡️ SHIELD
              </span>
            )}
            {activeFrame.pFire && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-orange-500/30 text-orange-300 border border-orange-400/60 shadow-[0_0_8px_rgba(249,115,22,0.5)]">
                🔥 FIRE
              </span>
            )}
          </div>
        </div>
        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
          <div className="flex justify-between font-bold">
            <span style={{ color: clip.opponentColor }} className="truncate">
              {clip.opponentName}
            </span>
            <span className="text-rose-300 tabular-nums">{activeFrame.oRpm} RPM</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-slate-400 flex-wrap">
            <span>Spin {activeFrame.oStaminaPct}%</span>
            <span>·</span>
            <span>Arm {activeFrame.oDurabilityPct}%</span>
            {activeFrame.oShield && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-sky-500/30 text-sky-300 border border-sky-400/60 shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                🛡️ SHIELD
              </span>
            )}
            {activeFrame.oFire && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-orange-500/30 text-orange-300 border border-orange-400/60 shadow-[0_0_8px_rgba(249,115,22,0.5)]">
                🔥 FIRE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transport & Scrubber Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause highlight' : 'Play highlight'}
          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate w-8 h-8 flex items-center justify-center cursor-pointer"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            timeOffsetRef.current = 0;
            endHoldRef.current = 0;
            setProgressRatio(0);
            setPlaying(true);
          }}
          aria-label="Replay highlight"
          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate w-8 h-8 text-amber-300 flex items-center justify-center cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progressRatio}
          onChange={(e) => handleScrub(Number(e.target.value))}
          aria-label="Highlight timeline"
          className="flex-1 accent-amber-400 cursor-pointer"
        />
        <span className="text-[10px] text-slate-400 tabular-nums font-bold w-10 text-right">
          {clip.frames.length}f
        </span>
      </div>
    </div>
  );
};
