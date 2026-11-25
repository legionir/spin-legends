import React, { useEffect, useState } from 'react';
import { DEBUG_TOOLS_ALLOWED } from '../infrastructure/buildFlags';
import { motion } from 'motion/react';
import {
  Play,
  RotateCcw,
  Home,
  Trophy,
  Wrench,
  X,
  Sparkles,
  Download,
  Upload,
  Maximize2,
  Bug,
  Music,
  Gamepad2,
  Camera,
  Keyboard,
  EyeOff,
  Zap,
  Eye,
  Layers,
  Lock,
  Activity,
  Flame,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  ARENAS,
  ELEMENTS,
  getSecretDefinition,
  getVictoryEmoteDefinition,
  getWeatherDefinition,
} from '../domain/catalog';
import { getActiveMutatorLabels, getDurabilityBand } from '../domain/rules';
import {
  BattleResultSummary,
  CameraPreset,
  GraphicsQuality,
  KeyBindings,
  LoadoutPreset,
  MatchMode,
  PartDurabilityKey,
  PlayerSaveData,
} from '../domain/types';
import { exportSaveToJson, importSaveFromJson } from '../infrastructure/persistence';
import { MatchHighlightsPlayer } from './MatchHighlightsPlayer';
import { BattleAnalysisPanel } from './BattleAnalysisPanel';

export const PauseModal: React.FC<{
  canQuickSwap?: boolean;
  matchMode?: MatchMode;
  presets?: LoadoutPreset[];
  activeTopInstanceId?: string;
  initialShowQuickSwap?: boolean;
  onQuickSwapPreset?: (preset: LoadoutPreset) => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
}> = ({
  canQuickSwap = false,
  matchMode = 'Training',
  presets = [],
  activeTopInstanceId,
  initialShowQuickSwap = false,
  onQuickSwapPreset,
  onResume,
  onRestart,
  onExitToTitle,
}) => {
  const [quickSwapOpen, setQuickSwapOpen] = useState(
    Boolean(initialShowQuickSwap && canQuickSwap)
  );

  useEffect(() => {
    if (initialShowQuickSwap && canQuickSwap) {
      setQuickSwapOpen(true);
    }
  }, [initialShowQuickSwap, canQuickSwap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onResume();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onResume]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 sl-safe-inset backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.66)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Battle Paused"
        className="sl-panel-modal w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-2xl text-center"
      >
        <div className="flex-1 min-h-0 overflow-y-auto sl-scroll p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-sky-400 font-bold font-mono-tech">
              Simulation Paused
            </div>
            <h2 className="font-display sl-title-metal text-3xl font-bold uppercase tracking-wider">PAUSED</h2>
            <div className="sl-hairline mt-2" />
          </div>

          {/* Saved Loadout Quick Swap Section */}
          {canQuickSwap ? (
            <div className="rounded-xl border border-amber-400/35 bg-slate-900/75 p-3 text-left space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  <Layers className="w-3.5 h-3.5" />
                  Quick Swap Loadout
                </div>
                <button
                  type="button"
                  onClick={() => setQuickSwapOpen((prev) => !prev)}
                  className="text-[11px] font-bold text-sky-300 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 cursor-pointer"
                >
                  {quickSwapOpen ? 'Hide' : `Show (${presets.length})`}
                </button>
              </div>

              {quickSwapOpen && (
                <div className="space-y-2 max-h-52 overflow-y-auto sl-scroll pr-0.5" data-testid="pause-quick-swap-list">
                  {presets.length === 0 ? (
                    <div className="text-xs text-slate-400 py-2 text-center">
                      No saved loadouts yet. Save presets in the Workshop.
                    </div>
                  ) : (
                    presets.map((preset) => {
                      const secColor = preset.secondaryElement
                        ? ELEMENTS[preset.secondaryElement].primaryColor
                        : preset.cosmetics?.primaryColor ?? '#38bdf8';
                      const isCurrentTop = activeTopInstanceId === preset.topInstanceId;
                      return (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg border border-slate-700/80 bg-slate-950/85 hover:border-amber-400/50 transition-colors"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                              style={{ backgroundColor: secColor }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-white truncate">
                                {preset.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {preset.preferredMode} · {preset.preferredCommand}
                                {isCurrentTop ? ' · Active Chassis' : ''}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onQuickSwapPreset?.(preset)}
                            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-amber px-3 py-1.5 text-[11px] font-display font-bold shrink-0 cursor-pointer"
                          >
                            Swap
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Quick Swap locked during {matchMode} matches.</span>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="sl-btn-3d sl-btn-3d-cyan w-full min-h-[46px] px-4 py-3 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Resume Battle
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="sl-btn-3d sl-btn-3d-slate w-full min-h-[44px] px-4 py-2.5 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-sky-400" />
              Restart Match
            </button>
            <button
              type="button"
              onClick={onExitToTitle}
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate w-full min-h-[44px] px-4 py-2.5 text-slate-300 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PART_NAMES: { key: PartDurabilityKey; label: string }[] = [
  { key: 'SpiritCore', label: 'Core' },
  { key: 'AttackBlade', label: 'Blade' },
  { key: 'ArmorRing', label: 'Armor' },
  { key: 'WeightDisc', label: 'Weight' },
  { key: 'PerformanceDriver', label: 'Driver' },
  { key: 'EnergyModule', label: 'Energy' },
];

const RECAP_PART_LABELS: Record<PartDurabilityKey, string> = {
  SpiritCore: 'Spirit Core',
  AttackBlade: 'Attack Blade',
  ArmorRing: 'Armor Ring',
  WeightDisc: 'Weight Disc',
  PerformanceDriver: 'Performance Tip',
  EnergyModule: 'Energy Module',
};

const SOURCE_LABELS: Record<string, string> = {
  clash: 'Direct Clash',
  ability: 'Special Ability',
  hazard: 'Arena Hazard',
  pillar: 'Pillar / Perimeter',
  status: 'Elemental Status',
};

export const BattleResultsModal: React.FC<{
  result: BattleResultSummary;
  canNextTournamentMatch: boolean;
  hasBackgroundReplay?: boolean;
  onPlayAgain: () => void;
  onNextTournamentMatch: () => void;
  onNextSurvivalWave?: () => void;
  onOpenWorkshop: () => void;
  onExitToTitle: () => void;
}> = ({
  result,
  canNextTournamentMatch,
  hasBackgroundReplay = false,
  onPlayAgain,
  onNextTournamentMatch,
  onNextSurvivalWave,
  onOpenWorkshop,
  onExitToTitle,
}) => {
  const [peekReplay, setPeekReplay] = useState(false);
  const [resultsTab, setResultsTab] = useState<'overview' | 'recap'>('overview');

  const finishLabels: Record<BattleResultSummary['finishReason'], string> = {
    SpinFinish: 'SPIN FINISH',
    RingOut: 'RING OUT',
    BurstFinish: 'BURST FINISH',
    Knockout: 'KNOCKOUT FINISH',
    Survival: 'SURVIVAL DECISION',
  };

  const arena = ARENAS[result.arenaId];
  const isSurvivalAdvance = result.mode === 'Survival' && result.won && Boolean(onNextSurvivalWave);
  const activeMutators = result.mutators ? getActiveMutatorLabels(result.mutators) : [];
  const analysis = result.analysis;
  const oppName = result.opponentName ?? 'Rival';
  const playerName = result.isSpectating ? 'Top 1' : 'Your Top';

  // Derive safe fallback breaches from timeline if an older saved match lacks explicit breach events
  const derivedBreaches = React.useMemo(() => {
    if (!analysis) return [];
    if (analysis.criticalThresholdBreaches && analysis.criticalThresholdBreaches.length > 0) {
      return analysis.criticalThresholdBreaches;
    }
    const list: NonNullable<typeof analysis.criticalThresholdBreaches> = [];
    const seen = new Set<string>();
    for (const pt of analysis.timeline) {
      const checks: Array<{
        side: 'player' | 'opponent';
        metric: 'stamina' | 'durability';
        val: number;
      }> = [
        { side: 'player', metric: 'stamina', val: pt.playerStaminaPct },
        { side: 'player', metric: 'durability', val: pt.playerArmorPct },
        { side: 'opponent', metric: 'stamina', val: pt.opponentStaminaPct },
        { side: 'opponent', metric: 'durability', val: pt.opponentArmorPct },
      ];
      for (const c of checks) {
        const key = `${c.side}:${c.metric}`;
        if (!seen.has(key) && c.val < 20) {
          seen.add(key);
          list.push({
            side: c.side,
            metric: c.metric,
            timeSec: pt.timeSec,
            remainingPct: Math.round(c.val),
          });
        }
      }
    }
    return list;
  }, [analysis]);

  const derivedMomentumSwing = React.useMemo(() => {
    if (!analysis) return null;
    if (analysis.peakMomentumSwing) return analysis.peakMomentumSwing;
    if (analysis.timeline.length < 2) return null;
    let bestDelta = 0;
    let bestTime = 0;
    let bestLeader: 'player' | 'opponent' = 'player';
    let prevDiff = analysis.timeline[0].playerStaminaPct - analysis.timeline[0].opponentStaminaPct;
    for (let i = 1; i < analysis.timeline.length; i++) {
      const pt = analysis.timeline[i];
      const diff = pt.playerStaminaPct - pt.opponentStaminaPct;
      const delta = Math.abs(diff - prevDiff);
      if (delta > bestDelta) {
        bestDelta = delta;
        bestTime = pt.timeSec;
        bestLeader = diff >= 0 ? 'player' : 'opponent';
      }
      prevDiff = diff;
    }
    if (bestDelta <= 0.1) return null;
    return {
      timeSec: bestTime,
      swingDeltaPct: Math.round(bestDelta),
      leaderAfter: bestLeader,
    };
  }, [analysis]);

  if (peekReplay && hasBackgroundReplay) {
    return (
      <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-end sm:justify-start p-3 sm:p-6 sl-safe-inset">
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={() => setPeekReplay(false)}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan pointer-events-auto px-3.5 py-2 font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            Back to Results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 sl-safe-inset ${
        hasBackgroundReplay ? '' : 'backdrop-blur-[6px]'
      }`}
      style={{
        backgroundColor: hasBackgroundReplay ? 'rgba(2, 6, 23, 0.34)' : 'rgba(2, 6, 23, 0.72)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Battle Results"
        className="sl-panel-modal w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden rounded-2xl"
      >
        {hasBackgroundReplay && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-6 py-2 bg-slate-950/85 border-b border-slate-800/90">
            <span className="text-[11px] font-display font-bold uppercase tracking-wider text-slate-300">
              Battle Replay
            </span>
            <button
              type="button"
              onClick={() => setPeekReplay(true)}
              className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              Watch Fullscreen
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto sl-scroll p-4 sm:p-6 space-y-4">
        <div className="text-center">
          {result.isSpectating ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-extrabold tracking-widest uppercase mb-2 bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <Eye className="w-3.5 h-3.5" />
                SPECTATOR BROADCAST
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white">
                {result.won ? 'VICTORY' : 'MATCH CONCLUDED'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Friendly Match ·{' '}
                <span style={{ color: arena.primaryColor }}>{arena.displayName}</span> ·{' '}
                {Math.round(result.durationSec)}s
              </p>
            </>
          ) : (
            <>
              <div
                className={`inline-block px-3 py-1 rounded text-xs font-extrabold tracking-widest uppercase mb-2 ${
                  result.won
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {finishLabels[result.finishReason]}
              </div>
              <h2
                className={`font-display text-3xl sm:text-4xl font-bold tracking-tight ${
                  result.won ? 'text-white' : 'text-rose-400'
                }`}
              >
                {result.won ? 'VICTORY' : 'DEFEAT'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {result.mode} Match{result.survivalWave ? ` · Wave ${result.survivalWave}` : ''} ·{' '}
                <span style={{ color: arena.primaryColor }}>{arena.displayName}</span>
                {result.weather && result.weather !== 'Clear'
                  ? ` · ${getWeatherDefinition(result.weather).label}`
                  : ''}
                {' · '}
                {Math.round(result.durationSec)}s
              </p>
              {result.victoryEmote && result.won && (
                <p className="text-[11px] text-amber-300/90 font-semibold mt-1">
                  Victory Emote: {getVictoryEmoteDefinition(result.victoryEmote).label}
                </p>
              )}
            </>
          )}

          {result.perfectLaunch && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-400/20 text-amber-300 border border-amber-400/50 text-xs font-black tracking-wider uppercase mt-2">
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              Perfect Launch (+8% RPM)
            </div>
          )}

          {activeMutators.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
              {activeMutators.map((lbl) => (
                <span
                  key={lbl}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300"
                >
                  {lbl}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Overview vs Battle Recap Segmented Tab Bar */}
        {analysis && (
          <div className="px-4 sm:px-6 pt-1 pb-2 shrink-0">
            <div
              role="tablist"
              aria-label="Battle results view"
              className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border border-slate-800 bg-slate-950/90"
            >
              <button
                type="button"
                role="tab"
                aria-selected={resultsTab === 'overview'}
                onClick={() => setResultsTab('overview')}
                className={`sl-btn-3d sl-btn-3d-sm py-2 px-3 text-xs font-display font-bold cursor-pointer whitespace-nowrap ${
                  resultsTab === 'overview' ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-slate-300'
                }`}
              >
                <span>Overview</span>
                {resultsTab === 'overview' && (
                  <motion.span
                    layoutId="results-tab-rail"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="pointer-events-none absolute inset-x-3 bottom-0.5 h-[2px] rounded-full bg-white/85"
                  />
                )}
              </button>
              <button
                type="button"
                role="tab"
                data-testid="tab-battle-recap"
                aria-selected={resultsTab === 'recap'}
                onClick={() => setResultsTab('recap')}
                className={`sl-btn-3d sl-btn-3d-sm py-2 px-3 text-xs font-display font-bold cursor-pointer whitespace-nowrap ${
                  resultsTab === 'recap' ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-slate-300'
                }`}
              >
                <span>Battle Recap</span>
                {resultsTab === 'recap' && (
                  <motion.span
                    layoutId="results-tab-rail"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="pointer-events-none absolute inset-x-3 bottom-0.5 h-[2px] rounded-full bg-white/85"
                  />
                )}
              </button>
            </div>
          </div>
        )}

        {resultsTab === 'overview' || !analysis ? (
          <>
            {/* 3 Telemetry Stat Tiles */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/80">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Clashes</div>
                <div className="text-lg font-black text-white tabular-nums font-mono-tech">
                  {result.collisionCount}
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/80">
                <div className="text-[10px] uppercase text-slate-400 font-bold">
                  {result.isSpectating ? 'Top Spin' : 'Your Spin'}
                </div>
                <div className="text-lg font-black text-sky-300 tabular-nums font-mono-tech">
                  {Math.round(result.playerRemainingStamina)}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/80">
                <div className="text-[10px] uppercase text-slate-400 font-bold">
                  {result.isSpectating ? 'Top Armor' : 'Your Armor'}
                </div>
                <div className="text-lg font-black text-emerald-300 tabular-nums font-mono-tech">
                  {Math.round(result.playerRemainingDurability)}%
                </div>
              </div>
            </div>

            {/* Match Highlights Slow-Motion Final Blow Player */}
            {result.highlights && <MatchHighlightsPlayer clip={result.highlights} />}

            {/* Battle Analysis Telemetry Report */}
            {analysis && (
              <BattleAnalysisPanel
                analysis={analysis}
                opponentLabel={oppName}
                perfectLaunch={result.perfectLaunch}
              />
            )}

            {/* 6-Part Component Integrity (only for participating player) */}
            {!result.isSpectating && (
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
                  6-Part Component Condition
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                  {PART_NAMES.map(({ key, label }) => {
                    const pct = Math.round(result.partDurability[key] ?? 100);
                    const band = getDurabilityBand(pct);
                    const col =
                      band === 'Normal'
                        ? 'text-emerald-300 border-emerald-500/30'
                        : band === 'Minor'
                          ? 'text-sky-300 border-sky-500/30'
                          : band === 'Reduced'
                            ? 'text-amber-300 border-amber-500/30'
                            : 'text-rose-400 border-rose-500/40';
                    return (
                      <div key={key} className={`p-1.5 rounded border bg-slate-950/70 ${col}`}>
                        <div className="text-[9px] text-slate-400 font-bold">{label}</div>
                        <div className="text-xs font-black tabular-nums font-mono-tech">{pct}%</div>
                        <div className="text-[8px] uppercase font-bold">{band}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Score & Rewards Breakdown (only if participating player) */}
            {!result.isSpectating && (
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-amber-300 font-bold">
                    Score & Rewards Earned
                  </span>
                  <span className="text-sm font-black text-amber-300 tabular-nums font-mono-tech">
                    +{result.scoreBreakdown.totalPointsEarned} PTS
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-bold tabular-nums">
                  <span className="text-amber-400">+{result.rewards.gold} Gold</span>
                  <span className="text-sky-300">+{result.rewards.xp} XP</span>
                  <span className="text-slate-300">+{result.rewards.metalShards} Shards</span>
                  <span className="text-emerald-300">+{result.rewards.energyCrystals} Crystals</span>
                  <span className="text-cyan-300">+{result.rewards.elementalEssence} Essence</span>
                  {result.rewards.evolutionTokens > 0 && (
                    <span className="text-purple-300">+{result.rewards.evolutionTokens} Evo Token</span>
                  )}
                  {result.rewards.legendaryFragments > 0 && (
                    <span className="text-pink-300">+{result.rewards.legendaryFragments} Fragments</span>
                  )}
                </div>
                {result.scoreBreakdown.perfectLaunchPoints > 0 && (
                  <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-amber-300">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Perfect Launch Bonus
                    </span>
                    <span className="tabular-nums font-mono-tech">+{result.scoreBreakdown.perfectLaunchPoints} PTS</span>
                  </div>
                )}
                {result.scoreBreakdown.newlyDiscoveredSecrets.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    {result.scoreBreakdown.newlyDiscoveredSecrets.map((secId) => {
                      const sec = getSecretDefinition(secId);
                      if (!sec) return null;
                      return (
                        <div
                          key={secId}
                          className="flex items-center justify-between text-xs font-bold text-emerald-300"
                        >
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" /> Secret: {sec.title}
                          </span>
                          <span className="tabular-nums font-mono-tech">+{sec.points} PTS</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div data-testid="battle-recap-tab" className="space-y-3">
            {/* Recap Card 1: Highest Single-Hit Damage */}
            <div className="p-3.5 rounded-xl border border-amber-500/35 bg-slate-900/80 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-display font-bold text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Peak Single-Hit Impact
                </span>
                {analysis.highestDamageMoment && (
                  <span className="font-mono-tech text-[11px] font-bold text-slate-300 tabular-nums">
                    @ {analysis.highestDamageMoment.timeSec.toFixed(1)}s
                  </span>
                )}
              </div>
              {analysis.highestDamageMoment ? (
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      {analysis.highestDamageMoment.actorSide === 'player' ? playerName : oppName}{' '}
                      <span className="text-slate-400 font-semibold">→</span>{' '}
                      {analysis.highestDamageMoment.victimSide === 'player' ? playerName : oppName}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      {SOURCE_LABELS[analysis.highestDamageMoment.source] ?? analysis.highestDamageMoment.source}
                      {analysis.highestDamageMoment.isCritical ? ' · Critical Strike' : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black text-amber-300 tabular-nums font-mono-tech">
                      {analysis.highestDamageMoment.amount.toFixed(1)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      DMG
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  No direct damage spikes recorded. Peak Spin RPM: {analysis.peakPlayerRpm} vs {analysis.peakOpponentRpm}.
                </div>
              )}
            </div>

            {/* Recap Card 2: Longest Clash Exchange */}
            <div className="p-3.5 rounded-xl border border-sky-500/35 bg-slate-900/80 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-display font-bold text-sky-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  Longest Clash Exchange
                </span>
                {analysis.longestClashStreak && (
                  <span className="font-mono-tech text-[11px] font-bold text-slate-300 tabular-nums">
                    {analysis.longestClashStreak.startTimeSec.toFixed(1)}s–{analysis.longestClashStreak.endTimeSec.toFixed(1)}s
                  </span>
                )}
              </div>
              {analysis.longestClashStreak ? (
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div>
                    <div className="text-sm font-extrabold text-white tabular-nums">
                      {analysis.longestClashStreak.hitCount}{' '}
                      {analysis.longestClashStreak.hitCount === 1 ? 'Collision' : 'Consecutive Clashes'}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5 tabular-nums">
                      Peak Impulse: {analysis.longestClashStreak.peakImpulse.toFixed(1)} N·s
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black text-sky-300 tabular-nums font-mono-tech">
                      {analysis.longestClashStreak.durationSec.toFixed(2)}s
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      DURATION
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  No sustained clash sequence occurred ({result.collisionCount} total arena contacts).
                </div>
              )}
            </div>

            {/* Recap Card 3: Critical Health (<20%) Threshold Breaches */}
            <div className="p-3.5 rounded-xl border border-rose-500/35 bg-slate-900/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-display font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Critical Threshold Breaches (&lt;20%)
                </span>
                <span className="font-mono-tech text-[11px] font-bold text-slate-400 tabular-nums">
                  {derivedBreaches.length} Event{derivedBreaches.length === 1 ? '' : 's'}
                </span>
              </div>
              {derivedBreaches.length > 0 ? (
                <div className="space-y-1.5">
                  {derivedBreaches.map((b, idx) => (
                    <div
                      key={`${b.side}-${b.metric}-${idx}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-950/75 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            b.side === 'player' ? 'bg-sky-400' : 'bg-rose-400'
                          }`}
                        />
                        <span className="font-bold text-white truncate">
                          {b.side === 'player' ? playerName : oppName}
                        </span>
                        <span className="text-slate-400">
                          {b.metric === 'stamina' ? 'Spin Stamina' : 'Structural Armor'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 font-mono-tech tabular-nums">
                        <span className="text-rose-300 font-bold">{b.remainingPct}% left</span>
                        <span className="text-slate-400">@ {b.timeSec.toFixed(1)}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Neither top dropped below the 20% critical spin or armor threshold before match end.
                </div>
              )}
            </div>

            {/* Recap Card 4: First Part Break & Peak Momentum Swing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                  First Structural Break
                </div>
                {analysis.firstBrokenPart ? (
                  <>
                    <div className="text-sm font-extrabold text-white">
                      {RECAP_PART_LABELS[analysis.firstBrokenPart]}
                    </div>
                    <div className="text-xs text-slate-300 font-mono-tech tabular-nums">
                      {analysis.firstBrokenSide === 'player' ? playerName : oppName} · @{' '}
                      {(analysis.firstBrokenTimeSec ?? 0).toFixed(1)}s
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400 pt-0.5">All chassis parts intact</div>
                )}
              </div>

              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  Peak Momentum Swing
                </div>
                {derivedMomentumSwing ? (
                  <>
                    <div className="text-sm font-extrabold text-cyan-300 font-mono-tech tabular-nums">
                      {Math.round(derivedMomentumSwing.swingDeltaPct)}% Shift
                    </div>
                    <div className="text-xs text-slate-300 font-mono-tech tabular-nums">
                      {derivedMomentumSwing.leaderAfter === 'player' ? playerName : oppName} took lead @{' '}
                      {derivedMomentumSwing.timeSec.toFixed(1)}s
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400 pt-0.5">Balanced spin progression</div>
                )}
              </div>
            </div>

            <div className="px-3 py-2 rounded-lg border border-slate-800/90 bg-slate-950/75 flex items-center justify-between text-[11px] text-slate-400 font-mono-tech tabular-nums">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Total Duration
              </span>
              <span className="text-slate-200 font-bold">
                {analysis.durationSec.toFixed(1)}s · Peak {analysis.peakPlayerRpm} vs {analysis.peakOpponentRpm} RPM
              </span>
            </div>
          </div>
        )}

        </div>

        {/* Fixed Bottom Actions */}
        <div className="shrink-0 border-t border-slate-800/90 bg-slate-950/95 px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col gap-2.5">
          {result.isSpectating ? (
            <button
              type="button"
              onClick={onExitToTitle}
              className="sl-btn-3d sl-btn-3d-violet w-full px-4 py-2.5 sm:py-3 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Exit Spectator Broadcast
            </button>
          ) : (
            <>
              {isSurvivalAdvance && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onNextSurvivalWave}
                  className="sl-btn-3d sl-btn-3d-emerald w-full px-4 py-2.5 sm:py-3 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Advance to Wave {(result.survivalWave ?? 1) + 1}
                </button>
              )}
              {canNextTournamentMatch && result.won && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onNextTournamentMatch}
                  className="sl-btn-3d sl-btn-3d-amber w-full px-4 py-2.5 sm:py-3 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-4 h-4" />
                  Next Tournament Match
                </button>
              )}
              <button
                type="button"
                data-start={!(canNextTournamentMatch && result.won) && !isSurvivalAdvance ? 'true' : undefined}
                onClick={onPlayAgain}
                className="sl-btn-3d sl-btn-3d-cyan w-full px-4 py-2.5 sm:py-3 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                {result.mode === 'Survival' ? 'Restart Wave 1' : result.won ? 'Rematch Arena' : 'Try Again'}
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenWorkshop}
                  className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3.5 py-2.5 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5 text-orange-400" />
                  Workshop
                </button>
                <button
                  type="button"
                  onClick={onExitToTitle}
                  className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3.5 py-2.5 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  Main Menu
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const BINDING_LABELS: { action: keyof KeyBindings; label: string; group: 'core' | 'tactical' }[] = [
  { action: 'ability1', label: 'Slot 1', group: 'core' },
  { action: 'ability2', label: 'Slot 2', group: 'core' },
  { action: 'ability3', label: 'Slot 3', group: 'core' },
  { action: 'ability4', label: 'Slot 4', group: 'core' },
  { action: 'launch', label: 'Launch', group: 'core' },
  { action: 'teamSwitch', label: 'Tag Switch', group: 'core' },
  { action: 'cameraCycle', label: 'Camera Cycle', group: 'core' },
  { action: 'pause', label: 'Pause', group: 'core' },
  { action: 'tactical1', label: 'Cmd 1: Aggressive', group: 'tactical' },
  { action: 'tactical2', label: 'Cmd 2: Defensive', group: 'tactical' },
  { action: 'tactical3', label: 'Cmd 3: Chase', group: 'tactical' },
  { action: 'tactical4', label: 'Cmd 4: Circle', group: 'tactical' },
  { action: 'tactical5', label: 'Cmd 5: Evade', group: 'tactical' },
  { action: 'tactical6', label: 'Cmd 6: Conserve', group: 'tactical' },
  { action: 'tactical7', label: 'Cmd 7: Hold', group: 'tactical' },
  { action: 'tactical8', label: 'Cmd 8: Counter', group: 'tactical' },
];

export const SettingsModal: React.FC<{
  save: PlayerSaveData;
  urlDebugForced: boolean;
  bindingNotice?: string | null;
  onClose: () => void;
  onChangeQuality: (q: GraphicsQuality) => void;
  onChangeVolume: (v: number) => void;
  onChangeSensitivity: (s: number) => void;
  onToggleDebugMode: () => void;
  onToggleDiagnostics: () => void;
  onChangeCameraPreset: (preset: CameraPreset) => void;
  onChangeUiScale: (scale: number) => void;
  onToggleDynamicMusic: () => void;
  onToggleDynamicClashCamera: () => void;
  onToggleGamepad: () => void;
  onToggleReducedMotion: () => void;
  onUpdateKeyBinding: (action: keyof KeyBindings, key: string) => void;
  onImportSave: (save: PlayerSaveData) => void;
  onResetSave: () => void;
}> = ({
  save,
  urlDebugForced,
  bindingNotice,
  onClose,
  onChangeQuality,
  onChangeVolume,
  onChangeSensitivity,
  onToggleDebugMode,
  onToggleDiagnostics,
  onChangeCameraPreset,
  onChangeUiScale,
  onToggleDynamicMusic,
  onToggleDynamicClashCamera,
  onToggleGamepad,
  onToggleReducedMotion,
  onUpdateKeyBinding,
  onImportSave,
  onResetSave,
}) => {
  const [capturingAction, setCapturingAction] = useState<keyof KeyBindings | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (capturingAction) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape' && capturingAction !== 'pause') {
          setCapturingAction(null);
          return;
        }
        const nextKey = e.key === ' ' ? ' ' : e.key === 'Escape' ? 'Escape' : e.key.toLowerCase();
        onUpdateKeyBinding(capturingAction, nextKey);
        setCapturingAction(null);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturingAction, onClose, onUpdateKeyBinding]);

  const handleExport = () => {
    const json = exportSaveToJson(save);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spin-legends-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportStatus('Exported save JSON backup.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = importSaveFromJson(text);
      if (res.save) {
        onImportSave(res.save);
        setImportStatus('Save file imported & verified.');
      } else {
        setImportStatus(res.error ?? 'Failed to import save.');
      }
    } catch {
      setImportStatus('Unable to read selected file.');
    }
    e.target.value = '';
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.68)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="sl-panel-modal w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
      >
        <div className="sl-ls-modal-header px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="font-display sl-title-metal text-base sm:text-lg font-bold uppercase tracking-wider">
            Platform, Controls & Audio Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto sl-scroll p-5 space-y-4">
          {/* Graphics Quality */}
          <div>
            <span id="settings-graphics-quality-label" className="block text-xs font-bold text-slate-300 mb-1.5">
              Graphics Quality Profile
            </span>
            <div
              role="group"
              aria-labelledby="settings-graphics-quality-label"
              className="grid grid-cols-3 gap-2"
            >
              {(['Low', 'Medium', 'High'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onChangeQuality(q)}
                  className={`sl-btn-3d sl-btn-3d-sm py-2 text-xs font-bold cursor-pointer ${
                    save.settings.graphicsQuality === q
                      ? 'sl-btn-3d-cyan'
                      : 'sl-btn-3d-slate text-slate-300'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Preset */}
          <div>
            <span id="settings-camera-preset-label" className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-1.5">
              <Camera className="w-3.5 h-3.5 text-sky-400" />
              Camera Angle Preset
            </span>
            <div
              role="group"
              aria-labelledby="settings-camera-preset-label"
              className="grid grid-cols-4 gap-1.5"
            >
              {(['Broadcast', 'LowAction', 'TopDown', 'Orbit'] as CameraPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChangeCameraPreset(p)}
                  className={`sl-btn-3d sl-btn-3d-sm py-1.5 text-[11px] font-bold cursor-pointer ${
                    save.settings.cameraPreset === p
                      ? 'sl-btn-3d-cyan'
                      : 'sl-btn-3d-slate text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>Master Volume</span>
                <span className="tabular-nums">{Math.round(save.settings.masterVolume * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={save.settings.masterVolume}
                onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>

            <div>
              <label className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>Camera Sensitivity</span>
                <span className="tabular-nums">{save.settings.cameraSensitivity.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.1}
                value={save.settings.cameraSensitivity}
                onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="flex justify-between text-xs font-bold text-slate-300 mb-1">
              <span>HUD / UI Scale</span>
              <span className="tabular-nums">{Math.round(save.settings.uiScale * 100)}%</span>
            </label>
            <input
              type="range"
              min={0.85}
              max={1.2}
              step={0.05}
              value={save.settings.uiScale}
              onChange={(e) => onChangeUiScale(parseFloat(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>

          {/* Feature Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleDynamicMusic}
              className={`sl-btn-3d sl-btn-3d-sm p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
                save.settings.dynamicMusic ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" /> Dynamic Synth Music
              </span>
              <span>{save.settings.dynamicMusic ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleGamepad}
              className={`sl-btn-3d sl-btn-3d-sm p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
                save.settings.gamepadEnabled ? 'sl-btn-3d-emerald' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5" /> Gamepad Polling
              </span>
              <span>{save.settings.gamepadEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {DEBUG_TOOLS_ALLOWED && (
              <>
            <button
              type="button"
              onClick={onToggleDebugMode}
              className={`sl-btn-3d sl-btn-3d-sm min-h-[44px] p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer ${
                save.settings.debugMode || urlDebugForced
                  ? 'sl-btn-3d-amber'
                  : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Bug className="w-3.5 h-3.5" /> Training Debug Drawer
              </span>
              <span>{urlDebugForced ? '?debug=1' : save.settings.debugMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleDiagnostics}
              data-testid="settings-toggle-diagnostics"
              className={`sl-btn-3d sl-btn-3d-sm min-h-[44px] p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer whitespace-nowrap ${
                save.settings.showDiagnostics || urlDebugForced
                  ? 'sl-btn-3d-emerald'
                  : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Arena Diagnostics & Heatmap
              </span>
              <span>{save.settings.showDiagnostics || urlDebugForced ? 'ON' : 'OFF'}</span>
            </button>
              </>
            )}

            <button
              type="button"
              onClick={onToggleReducedMotion}
              className={`sl-btn-3d sl-btn-3d-sm min-h-[44px] p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer whitespace-nowrap ${
                save.settings.reducedMotion ? 'sl-btn-3d-violet' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5" /> Reduced Motion
              </span>
              <span>{save.settings.reducedMotion ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleDynamicClashCamera}
              className={`sl-btn-3d sl-btn-3d-sm min-h-[44px] p-2.5 text-xs font-bold flex items-center justify-between cursor-pointer whitespace-nowrap ${
                save.settings.dynamicClashCamera !== false
                  ? 'sl-btn-3d-cyan'
                  : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Dynamic Clash Cam
              </span>
              <span>{save.settings.dynamicClashCamera !== false ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[44px] p-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" /> Toggle Fullscreen
            </button>
          </div>

          {/* Key Remapping */}
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-sky-400" />
                Key Remapping (Click a slot then press any key · M reserved for Mute)
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {BINDING_LABELS.filter((b) => b.group === 'core').map(({ action, label }) => {
                const isCap = capturingAction === action;
                const val = save.settings.keyBindings[action] ?? '';
                const display = val === ' ' ? 'SPACE' : val === 'Escape' ? 'ESC' : val.toUpperCase();
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setCapturingAction(isCap ? null : action)}
                    className={`sl-btn-3d sl-btn-3d-sm p-2 text-left cursor-pointer ${
                      isCap ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate'
                    }`}
                  >
                    <div className={`text-[10px] font-semibold truncate ${isCap ? 'text-slate-900' : 'text-slate-400'}`}>
                      {label}
                    </div>
                    <div className="text-xs font-black mt-0.5 tabular-nums">
                      {isCap ? 'Press key...' : display}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="pt-1 border-t border-slate-800/80">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                Training Tactical Commands
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {BINDING_LABELS.filter((b) => b.group === 'tactical').map(({ action, label }) => {
                  const isCap = capturingAction === action;
                  const val = save.settings.keyBindings[action] ?? '';
                  const display = val === ' ' ? 'SPACE' : val === 'Escape' ? 'ESC' : val.toUpperCase();
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setCapturingAction(isCap ? null : action)}
                      className={`sl-btn-3d sl-btn-3d-sm p-1.5 text-left cursor-pointer ${
                        isCap ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate'
                      }`}
                    >
                      <div className={`text-[9px] font-semibold truncate ${isCap ? 'text-slate-900' : 'text-slate-400'}`}>
                        {label}
                      </div>
                      <div className="text-[11px] font-black mt-0.5 tabular-nums">
                        {isCap ? 'Press...' : display}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {bindingNotice && (
              <div className="text-[11px] text-amber-300 font-semibold">{bindingNotice}</div>
            )}
          </div>

          {/* Save Export / Import */}
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2">
            <div className="text-xs font-bold text-slate-200">Save Backup (JSON)</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate py-2 px-3 text-xs font-bold text-sky-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
              <label className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate py-2 px-3 text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
            {importStatus && <div className="text-[11px] text-amber-300 font-semibold">{importStatus}</div>}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-800/90 flex justify-between items-center">
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetSave();
                  setConfirmReset(false);
                }}
                className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-crimson px-3 py-1.5 text-xs font-bold cursor-pointer"
              >
                Confirm Wipe Save
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3 py-1.5 text-rose-300 text-xs font-bold cursor-pointer"
            >
              Reset Save Data
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan px-5 py-2 text-xs font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
