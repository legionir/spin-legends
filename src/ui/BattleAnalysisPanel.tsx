import React from 'react';
import { Activity, AlertOctagon, Flame, Gauge, ShieldAlert, Zap } from 'lucide-react';
import type { BattleAnalysisReport, BattleDamageBreakdown, PartDurabilityKey } from '../domain/types';

interface BattleAnalysisPanelProps {
  analysis: BattleAnalysisReport;
  playerLabel?: string;
  opponentLabel?: string;
  perfectLaunch?: boolean;
  compact?: boolean;
}

const PART_DISPLAY_NAMES: Record<PartDurabilityKey, string> = {
  SpiritCore: 'Spirit Core',
  AttackBlade: 'Attack Blade',
  ArmorRing: 'Armor Ring',
  WeightDisc: 'Weight Disc',
  PerformanceDriver: 'Performance Tip',
  EnergyModule: 'Energy Module',
};

const SOURCE_META: Array<{
  key: keyof BattleDamageBreakdown;
  label: string;
  color: string;
}> = [
  { key: 'clash', label: 'Direct Clashes', color: '#38bdf8' },
  { key: 'ability', label: 'Abilities', color: '#a855f7' },
  { key: 'hazard', label: 'Arena Traps', color: '#f59e0b' },
  { key: 'pillar', label: 'Pillars / Walls', color: '#fb7185' },
  { key: 'status', label: 'Elemental Status', color: '#34d399' },
];

export const BattleAnalysisPanel: React.FC<BattleAnalysisPanelProps> = ({
  analysis,
  playerLabel = 'Your Top',
  opponentLabel = 'Rival',
  perfectLaunch,
  compact = false,
}) => {
  const totalTaken = Math.max(
    1,
    Object.values(analysis.damageTakenByPlayer).reduce((sum: number, v: number) => sum + v, 0)
  );
  const totalDealt = Math.max(
    1,
    Object.values(analysis.damageDealtByPlayer).reduce((sum: number, v: number) => sum + v, 0)
  );

  const timeline = analysis.timeline.length > 0
    ? analysis.timeline
    : [
        { timeSec: 0, playerStaminaPct: 100, opponentStaminaPct: 100, playerArmorPct: 100, opponentArmorPct: 100 },
        { timeSec: 30, playerStaminaPct: 50, opponentStaminaPct: 50, playerArmorPct: 80, opponentArmorPct: 80 },
      ];

  const maxT = Math.max(0.5, timeline[timeline.length - 1]?.timeSec ?? 30);
  const svgW = 360;
  const svgH = 96;
  const padX = 8;
  const padY = 8;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;

  const toPolyline = (pick: (pt: (typeof timeline)[number]) => number) =>
    timeline
      .map((pt) => {
        const x = padX + (Math.min(maxT, Math.max(0, pt.timeSec)) / maxT) * plotW;
        const y = padY + (1 - Math.min(100, Math.max(0, pick(pt))) / 100) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const playerStaminaPoints = toPolyline((pt) => pt.playerStaminaPct);
  const opponentStaminaPoints = toPolyline((pt) => pt.opponentStaminaPct);
  const playerArmorPoints = toPolyline((pt) => pt.playerArmorPct);

  return (
    <div
      data-testid="battle-analysis-panel"
      className={`sl-panel-chassis rounded-xl ${compact ? 'p-3 space-y-2.5' : 'p-3.5 space-y-3'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-sky-300 font-display font-bold flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Combat Telemetry & Battle Analysis
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold font-mono-tech tabular-nums">
          {perfectLaunch && (
            <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-300 flex items-center gap-1">
              <Zap className="w-3 h-3" /> PERFECT LAUNCH (+8% RPM)
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
            {analysis.durationSec.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Key Insights Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded border border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
            Peak Spin RPM
          </span>
          <span className="font-black font-mono-tech tabular-nums text-[11px]">
            <span className="text-sky-300">{analysis.peakPlayerRpm}</span>
            <span className="text-slate-500 mx-1">vs</span>
            <span className="text-rose-400">{analysis.peakOpponentRpm}</span>
          </span>
        </div>

        <div className="p-2 rounded border border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            {analysis.firstBrokenPart ? (
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            )}
            First Part Break
          </span>
          <span className="font-bold text-[11px] font-mono-tech tabular-nums">
            {analysis.firstBrokenPart ? (
              <span className={analysis.firstBrokenSide === 'player' ? 'text-rose-300' : 'text-emerald-300'}>
                {analysis.firstBrokenSide === 'player' ? playerLabel : opponentLabel} ·{' '}
                {PART_DISPLAY_NAMES[analysis.firstBrokenPart]} ({analysis.firstBrokenTimeSec?.toFixed(1)}s)
              </span>
            ) : (
              <span className="text-slate-400">No Parts Broken</span>
            )}
          </span>
        </div>
      </div>

      {/* Stamina & Armor Decay Chart */}
      <div className="p-2.5 rounded border border-slate-800 bg-slate-950/70 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold">
          <span className="text-slate-400 uppercase tracking-wider">Stamina & Armor Decay Curve</span>
          <div className="flex items-center gap-2.5">
            <span className="text-sky-300 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-sky-400 inline-block" /> {playerLabel} Spin
            </span>
            <span className="text-emerald-300 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> Armor
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> {opponentLabel} Spin
            </span>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-24 overflow-visible"
          role="img"
          aria-label="Spin stamina and structural armor over match duration"
        >
          <line x1={padX} y1={padY} x2={svgW - padX} y2={padY} stroke="#1e293b" strokeWidth="1" />
          <line x1={padX} y1={padY + plotH * 0.5} x2={svgW - padX} y2={padY + plotH * 0.5} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
          <line x1={padX} y1={svgH - padY} x2={svgW - padX} y2={svgH - padY} stroke="#334155" strokeWidth="1" />
          <polyline
            fill="none"
            stroke="#34d399"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            points={playerArmorPoints}
          />
          <polyline
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2"
            points={opponentStaminaPoints}
          />
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.2"
            points={playerStaminaPoints}
          />
        </svg>
        <div className="flex justify-between text-[9px] text-slate-500 font-semibold tabular-nums">
          <span>0.0s</span>
          <span>{(maxT * 0.5).toFixed(1)}s</span>
          <span>{maxT.toFixed(1)}s</span>
        </div>
      </div>

      {/* Damage Source Attribution */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 font-bold">
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-400" />
            Damage Source Breakdown
          </span>
          <span className="tabular-nums">Dealt vs Taken</span>
        </div>
        <div className="space-y-1.5">
          {SOURCE_META.map((src) => {
            const dealtVal = analysis.damageDealtByPlayer[src.key] ?? 0;
            const takenVal = analysis.damageTakenByPlayer[src.key] ?? 0;
            const dealtPct = Math.round((dealtVal / totalDealt) * 100);
            const takenPct = Math.round((takenVal / totalTaken) * 100);
            if (dealtVal === 0 && takenVal === 0 && src.key !== 'clash') return null;

            return (
              <div key={src.key} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] font-semibold">
                  <span className="text-slate-300">{src.label}</span>
                  <span className="tabular-nums text-slate-400">
                    Dealt <strong className="text-emerald-300">{dealtPct}%</strong> · Taken{' '}
                    <strong className="text-rose-300">{takenPct}%</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 h-2">
                  <div className="sl-bar-track rounded-sm overflow-hidden flex justify-end">
                    <div
                      className="sl-bar-fill h-full rounded-sm"
                      style={{ width: `${dealtPct}%`, backgroundColor: src.color }}
                    />
                  </div>
                  <div className="sl-bar-track rounded-sm overflow-hidden">
                    <div
                      className="sl-bar-fill h-full rounded-sm bg-rose-500/85"
                      style={{ width: `${takenPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
