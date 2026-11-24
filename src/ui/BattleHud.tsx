import React from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Zap,
  Shield,
  Flame,
  Sparkles,
  Camera,
  Bug,
  Crosshair,
  Repeat,
  Activity,
  Wifi,
  X,
  Eye,
  Layers,
  CloudRain,
  Wind,
  Sun,
  Cloud,
} from 'lucide-react';
import {
  ARENAS,
  BATTLE_MODES,
  ELEMENTS,
  TACTICAL_COMMANDS,
  getAbilityDefinition,
  getWeatherDefinition,
} from '../domain/catalog';
import { getPlayerActiveStatuses } from '../domain/statusManager';
import {
  LAUNCH_WINDOW_SECONDS,
  MAX_BATTLE_DURATION,
  PERFECT_LAUNCH_MAX,
  PERFECT_LAUNCH_MIN,
  TEAM_SWITCH_ENERGY_COST,
  getActiveMutatorLabels,
  getDurabilityBand,
  isPowerInPerfectWindow,
} from '../domain/rules';
import {
  ArenaId,
  BattleMode,
  BattleMutators,
  BattlePhase,
  CameraPreset,
  CharacterAppearance,
  ElementType,
  KeyBindings,
  PartDurabilityKey,
  PartDurabilityMap,
  SceneTelemetry,
  StatDebuffKind,
  StatusEffectType,
  TacticalCommand,
  WeatherType,
} from '../domain/types';
import { ReplayHudTelemetry } from '../scene/arenaScene';
import { CompactHexTopEmblem, TopWingEmblemBadge } from './TopWingEmblemBadge';

export interface HudTeamSlot {
  name: string;
  element: ElementType;
  staminaPct: number;
  knockedOut: boolean;
  active: boolean;
}

export interface HudSnapshot {
  phase: BattlePhase;
  arenaId: ArenaId;
  elapsedTime: number;
  launchCountdown: number;
  launchAimSet: boolean;
  launchTargetX: number;
  launchTargetZ: number;
  launchHandedness: 'right' | 'left';
  launchAngleDeg: number;
  isTeamBattle: boolean;
  teamSwitchCooldown: number;
  teamSlots: HudTeamSlot[];
  perfectLaunch?: boolean;
  weather?: WeatherType;
  mutators?: BattleMutators;
  isSpectating?: boolean;
  spectatorCount?: number;
  player: {
    name: string;
    element: ElementType;
    secondaryElement: ElementType | null;
    rpm: number;
    staminaPct: number;
    durabilityPct: number;
    stabilityPct: number;
    energy: number;
    maxEnergy: number;
    resonance: number;
    mode: BattleMode;
    command: TacticalCommand;
    partDurability: PartDurabilityMap;
    statuses: StatusEffectType[];
    statDebuffs: { kind: StatDebuffKind; label: string; remainingSec: number; colorHex: string }[];
    slots: {
      abilityId: string;
      cooldown: number;
      active: number;
    }[];
  };
  opponent: {
    name: string;
    element: ElementType;
    secondaryElement: ElementType | null;
    rpm: number;
    staminaPct: number;
    durabilityPct: number;
    stabilityPct: number;
    mode: BattleMode;
    command: TacticalCommand;
    statuses: StatusEffectType[];
    statDebuffs: { kind: StatDebuffKind; label: string; remainingSec: number; colorHex: string }[];
  };
  bannerText: string | null;
}

export interface CombatDamagePopup {
  id: number;
  xPct: number;
  yPct: number;
  text: string;
  subtext?: string;
  variant: 'normal' | 'critical' | 'playerHit' | 'burst';
}

interface BattleHudProps {
  hud: HudSnapshot;
  isReplay?: boolean;
  replayTelemetry?: ReplayHudTelemetry | null;
  combatPopups?: CombatDamagePopup[];
  onSkipReplay?: () => void;
  launchMeterValue: number;
  muted: boolean;
  debugMode: boolean;
  showDiagnostics: boolean;
  telemetry?: SceneTelemetry | null;
  cameraPreset: CameraPreset;
  keyBindings: KeyBindings;
  survivalWave?: number | null;
  onlineRttMs?: number | null;
  reconnectGraceSec?: number | null;
  showFirstMatchHint?: boolean;
  onDismissFirstMatchHint?: () => void;
  onLaunch: () => void;
  onSelectMode: (mode: BattleMode) => void;
  onSelectCommand: (cmd: TacticalCommand) => void;
  onActivateAbility: (slotIdx: number) => void;
  onSwitchTeamTop: (idx: number) => void;
  onCycleCameraPreset: () => void;
  onSelectCameraPreset?: (preset: CameraPreset) => void;
  onExitSpectate?: () => void;
  onToggleDiagnostics: () => void;
  onClearHeatmap?: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  canQuickSwap?: boolean;
  onQuickSwap?: () => void;
  playerAppearance?: CharacterAppearance;
}

const PART_LABELS: { key: PartDurabilityKey; label: string }[] = [
  { key: 'SpiritCore', label: 'Core' },
  { key: 'AttackBlade', label: 'Blade' },
  { key: 'ArmorRing', label: 'Armor' },
  { key: 'WeightDisc', label: 'Weight' },
  { key: 'PerformanceDriver', label: 'Tip' },
  { key: 'EnergyModule', label: 'Energy' },
];

const ANIME_SPEED_RAYS = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2 + (i % 3) * 0.032;
  const halfAngle = i % 4 === 0 ? 0.026 : 0.015;
  const rInner = 82 + ((i * 19) % 34);
  const rOuter = 158;
  const xTip = 160 + Math.cos(angle) * rInner;
  const yTip = 160 + Math.sin(angle) * rInner;
  const xL = 160 + Math.cos(angle - halfAngle) * rOuter;
  const yL = 160 + Math.sin(angle - halfAngle) * rOuter;
  const xR = 160 + Math.cos(angle + halfAngle) * rOuter;
  const yR = 160 + Math.sin(angle + halfAngle) * rOuter;
  return {
    key: i,
    points: `${xTip.toFixed(1)},${yTip.toFixed(1)} ${xL.toFixed(1)},${yL.toFixed(1)} ${xR.toFixed(1)},${yR.toFixed(1)}`,
    isAccent: i % 5 === 0,
  };
});

export const BattleHud: React.FC<BattleHudProps> = ({
  hud,
  isReplay = false,
  replayTelemetry,
  combatPopups = [],
  onSkipReplay,
  launchMeterValue,
  muted,
  debugMode,
  showDiagnostics,
  telemetry,
  cameraPreset,
  keyBindings,
  survivalWave,
  onlineRttMs,
  reconnectGraceSec,
  showFirstMatchHint,
  onDismissFirstMatchHint,
  onLaunch,
  onSelectMode,
  onSelectCommand,
  onActivateAbility,
  onSwitchTeamTop,
  onCycleCameraPreset,
  onSelectCameraPreset,
  onExitSpectate,
  onToggleDiagnostics,
  onClearHeatmap,
  onToggleMute,
  onPause,
  canQuickSwap = false,
  onQuickSwap,
  playerAppearance,
}) => {
  const timeLeft = Math.max(0, Math.ceil(MAX_BATTLE_DURATION - hud.elapsedTime));
  const pElem = ELEMENTS[hud.player.element];
  const oElem = ELEMENTS[hud.opponent.element];
  const arenaDef = ARENAS[hud.arenaId];
  const mutatorLabels = getActiveMutatorLabels(hud.mutators);
  const inPerfectZone = isPowerInPerfectWindow(launchMeterValue);
  const perfectLeftPct = Math.round(PERFECT_LAUNCH_MIN * 100);
  const perfectWidthPct = Math.round((PERFECT_LAUNCH_MAX - PERFECT_LAUNCH_MIN) * 100);
  const abilityKeys = [
    keyBindings.ability1.toUpperCase(),
    keyBindings.ability2.toUpperCase(),
    keyBindings.ability3.toUpperCase(),
    keyBindings.ability4.toUpperCase(),
  ];

  const effectivePlayerRpm =
    isReplay && typeof replayTelemetry?.playerRpm === 'number'
      ? replayTelemetry.playerRpm
      : hud.player.rpm;
  const effectivePlayerStamina =
    isReplay && typeof replayTelemetry?.playerStaminaPct === 'number'
      ? replayTelemetry.playerStaminaPct
      : hud.player.staminaPct;
  const effectivePlayerDurabilityPct =
    isReplay && typeof replayTelemetry?.playerDurabilityPct === 'number'
      ? replayTelemetry.playerDurabilityPct
      : hud.player.durabilityPct;
  const effectivePlayerEnergyPct =
    isReplay && typeof replayTelemetry?.playerEnergyPct === 'number'
      ? replayTelemetry.playerEnergyPct
      : Math.min(100, Math.round((hud.player.energy / Math.max(1, hud.player.maxEnergy)) * 100));
  const effectivePlayerEnergy =
    isReplay && typeof replayTelemetry?.playerEnergyPct === 'number'
      ? Math.round((replayTelemetry.playerEnergyPct / 100) * Math.max(1, hud.player.maxEnergy))
      : hud.player.energy;
  const effectivePlayerResonance =
    isReplay && typeof replayTelemetry?.playerResonance === 'number'
      ? replayTelemetry.playerResonance
      : hud.player.resonance;
  const effectiveOpponentRpm =
    isReplay && typeof replayTelemetry?.opponentRpm === 'number'
      ? replayTelemetry.opponentRpm
      : hud.opponent.rpm;
  const effectiveOpponentStamina =
    isReplay && typeof replayTelemetry?.opponentStaminaPct === 'number'
      ? replayTelemetry.opponentStaminaPct
      : hud.opponent.staminaPct;
  const effectiveOpponentDurabilityPct =
    isReplay && typeof replayTelemetry?.opponentDurabilityPct === 'number'
      ? replayTelemetry.opponentDurabilityPct
      : hud.opponent.durabilityPct;

  const effectivePlayerStatuses = isReplay
    ? Array.from(
        new Set<StatusEffectType>([
          ...(replayTelemetry?.playerShield ? (['Shield'] as StatusEffectType[]) : []),
          ...(replayTelemetry?.playerFire ? (['Burn'] as StatusEffectType[]) : []),
          ...(replayTelemetry?.playerStatuses ?? []),
        ])
      )
    : hud.player.statuses;

  const effectiveOpponentStatuses = isReplay
    ? Array.from(
        new Set<StatusEffectType>([
          ...(replayTelemetry?.opponentShield ? (['Shield'] as StatusEffectType[]) : []),
          ...(replayTelemetry?.opponentFire ? (['Burn'] as StatusEffectType[]) : []),
          ...(replayTelemetry?.opponentStatuses ?? []),
        ])
      )
    : hud.opponent.statuses;

  const effectivePlayerPartDurability =
    isReplay && replayTelemetry?.playerPartDurability
      ? replayTelemetry.playerPartDurability
      : hud.player.partDurability;
  const effectivePlayerStatDebuffs =
    isReplay && replayTelemetry?.playerStatDebuffs
      ? replayTelemetry.playerStatDebuffs
      : hud.player.statDebuffs;
  const effectiveOpponentStatDebuffs =
    isReplay && replayTelemetry?.opponentStatDebuffs
      ? replayTelemetry.opponentStatDebuffs
      : hud.opponent.statDebuffs;

  const hasPerSlotReplayFlags = Array.isArray(replayTelemetry?.playerActiveSlots);
  const playerStatusSummary = getPlayerActiveStatuses(
    isReplay
      ? {
          statuses: effectivePlayerStatuses,
          slots: hud.player.slots.map((slot, idx) => ({
            abilityId: slot.abilityId,
            active: hasPerSlotReplayFlags
              ? replayTelemetry?.playerActiveSlots?.[idx]
                ? 1
                : 0
              : replayTelemetry?.playerActiveSlotIdx !== undefined
                ? replayTelemetry.playerActiveSlotIdx === idx
                  ? 1
                  : 0
                : 0,
          })),
        }
      : hud.player
  );

  const isCombatActive = hud.phase === 'Combat' || hud.phase === 'Critical' || isReplay;
  const isStaminaCritical = isCombatActive && !hud.isSpectating && effectivePlayerStamina < 20;
  const isArmorCritical = isCombatActive && !hud.isSpectating && effectivePlayerDurabilityPct < 20;
  const isPlayerCriticalMode = isStaminaCritical || isArmorCritical;

  const bandColor = (pct: number) => {
    const b = getDurabilityBand(pct);
    if (b === 'Normal') return 'bg-emerald-400';
    if (b === 'Minor') return 'bg-sky-400';
    if (b === 'Reduced') return 'bg-amber-400';
    if (b === 'Critical') return 'bg-rose-500';
    return 'bg-slate-700';
  };

  const renderSegmentedBar = (
    pct: number,
    activeClass: string,
    heightClass = 'h-2',
    critical = false
  ) => {
    const clamped = Math.max(0, Math.min(100, pct));
    const litCount = clamped > 0 ? Math.max(1, Math.ceil((clamped / 100) * 10)) : 0;
    return (
      <div
        className={`sl-seg-grid ${heightClass} w-full ${
          critical ? 'sl-critical-track-pulse' : ''
        }`}
      >
        {Array.from({ length: 10 }, (_, idx) => {
          const lit = idx < litCount;
          return (
            <span
              key={idx}
              className={`sl-seg-cell h-full ${
                lit ? activeClass : 'bg-slate-900/90 border border-slate-700/60 opacity-45'
              }`}
            />
          );
        })}
      </div>
    );
  };

  const latestImpactBurst = (() => {
    for (let i = combatPopups.length - 1; i >= 0; i--) {
      const p = combatPopups[i];
      if (p.variant === 'critical' || p.variant === 'burst') return p;
    }
    return null;
  })();

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-4 md:p-6 sl-safe-inset">
      {/* Phase 1 & Anime Clash FX: Radial Speed-Line Impact Burst + 3D-to-2D Damage Callouts */}
      {(combatPopups.length > 0 || latestImpactBurst) && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-10 pointer-events-none overflow-hidden"
        >
          {latestImpactBurst && (
            <svg
              key={`speedburst-${latestImpactBurst.id}`}
              viewBox="0 0 320 320"
              className="sl-anime-speedburst pointer-events-none absolute w-[min(92vw,720px)] h-[min(92vw,720px)] select-none"
              style={{
                left: `${latestImpactBurst.xPct}%`,
                top: `${latestImpactBurst.yPct}%`,
              }}
            >
              {ANIME_SPEED_RAYS.map((ray) => (
                <polygon
                  key={ray.key}
                  points={ray.points}
                  fill={
                    ray.isAccent
                      ? latestImpactBurst.variant === 'burst'
                        ? '#fde047'
                        : '#7dd3fc'
                      : '#ffffff'
                  }
                  fillOpacity={ray.isAccent ? 0.72 : 0.85}
                />
              ))}
            </svg>
          )}
          {combatPopups.map((popup) => {
            const colorClass =
              popup.variant === 'burst'
                ? 'text-amber-300 drop-shadow-[0_3px_10px_rgba(249,115,22,0.95)]'
                : popup.variant === 'critical'
                  ? 'text-yellow-300 drop-shadow-[0_3px_10px_rgba(234,179,8,0.9)]'
                  : popup.variant === 'playerHit'
                    ? 'text-rose-400 drop-shadow-[0_2px_8px_rgba(244,63,94,0.85)]'
                    : 'text-cyan-200 drop-shadow-[0_2px_8px_rgba(14,165,233,0.85)]';
            return (
              <div
                key={popup.id}
                className="sl-damage-popup absolute flex flex-col items-center leading-none select-none"
                style={{ left: `${popup.xPct}%`, top: `${popup.yPct}%` }}
              >
                {popup.subtext && (
                  <span
                    className={`font-display italic font-black tracking-widest uppercase text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-slate-950/85 border mb-0.5 ${
                      popup.variant === 'burst'
                        ? 'text-orange-300 border-orange-400/70'
                        : 'text-amber-300 border-amber-400/70'
                    }`}
                  >
                    {popup.subtext}
                  </span>
                )}
                <span
                  className={`font-display italic font-black tabular-nums ${
                    popup.variant === 'critical' || popup.variant === 'burst'
                      ? 'text-2xl sm:text-3xl'
                      : 'text-lg sm:text-xl'
                  } ${colorClass}`}
                >
                  {popup.text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Top Broadcast Telemetry Wings */}
      <div className="relative z-20 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start sm:flex sm:items-start sm:justify-between gap-1.5 sm:gap-3.5">
        {/* Player Left Esports Wing */}
        <div
          data-critical-mode={isPlayerCriticalMode ? 'true' : 'false'}
          className={`sl-panel-chassis sl-hud-wing-left sl-ls-hud-card pointer-events-auto min-w-0 sm:w-[328px] md:w-[366px] p-2 sm:pl-2.5 sm:pr-5 sm:py-2.5 rounded-xl sm:rounded-none transition-colors duration-200 ${
            isPlayerCriticalMode ? 'sl-critical-hud-pulse' : ''
          }`}
          style={{ borderTop: `2.5px solid ${isPlayerCriticalMode ? '#fb7185' : pElem.primaryColor}` }}
        >
          <div className="flex items-start gap-2.5">
            <TopWingEmblemBadge
              side="player"
              element={hud.player.element}
              secondaryElement={hud.player.secondaryElement}
              playerAppearance={playerAppearance}
              isCritical={isPlayerCriticalMode}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CompactHexTopEmblem
                    side="player"
                    element={hud.player.element}
                    isCritical={isPlayerCriticalMode}
                  />
                  {hud.player.secondaryElement && (
                    <span
                      className="hidden sm:inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ELEMENTS[hud.player.secondaryElement].primaryColor }}
                    />
                  )}
                  <span className="font-display text-[11px] sm:text-xs md:text-sm font-bold text-white truncate">
                    {hud.player.name}
                  </span>
                  {isPlayerCriticalMode && (
                    <span className="px-1 py-0.5 rounded bg-rose-500/25 border border-rose-400/75 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-rose-200 shrink-0">
                      CRIT
                    </span>
                  )}
                </div>
                <span className="font-display text-[11px] sm:text-sm font-bold text-sky-300 tabular-nums shrink-0">
                  {effectivePlayerRpm}{' '}
                  <span className="text-[8px] sm:text-[10px] text-slate-400 font-semibold">RPM</span>
                </span>
              </div>

          {/* Slim 2-Line Mobile Corner Strip: Segmented Stamina + Armor */}
          <div className="sl-hud-compact-row">
            <div>
              <div
                className={`flex justify-between text-[8px] font-bold leading-none mb-0.5 ${
                  isStaminaCritical ? 'text-rose-200' : 'text-slate-300'
                }`}
              >
                <span>STA</span>
                <span className={`tabular-nums ${isStaminaCritical ? 'text-rose-300' : 'text-white'}`}>
                  {effectivePlayerStamina}%
                </span>
              </div>
              {renderSegmentedBar(
                effectivePlayerStamina,
                isStaminaCritical
                  ? 'bg-gradient-to-t from-rose-600 to-amber-400 sl-critical-bar-pulse'
                  : 'bg-gradient-to-t from-sky-500 to-cyan-300',
                'h-1.5',
                isStaminaCritical
              )}
            </div>
            <div>
              <div
                className={`flex justify-between text-[8px] font-bold leading-none mb-0.5 ${
                  isArmorCritical ? 'text-rose-200' : 'text-slate-300'
                }`}
              >
                <span>ARM</span>
                <span className={`tabular-nums ${isArmorCritical ? 'text-rose-300' : 'text-white'}`}>
                  {effectivePlayerDurabilityPct}%
                </span>
              </div>
              {renderSegmentedBar(
                effectivePlayerDurabilityPct,
                isArmorCritical
                  ? 'bg-gradient-to-t from-rose-600 to-orange-400 sl-critical-bar-pulse'
                  : 'bg-gradient-to-t from-emerald-500 to-emerald-300',
                'h-1.5',
                isArmorCritical
              )}
            </div>
          </div>

          {/* Desktop Detailed Broadcast Telemetry */}
          <div className="sl-hud-desktop-detail">
            {/* Segmented Spin Stamina Bar */}
            <div className="mb-1.5">
              <div
                className={`flex justify-between text-[9px] sm:text-[10px] font-semibold mb-0.5 ${
                  isStaminaCritical ? 'text-rose-200' : 'text-slate-300'
                }`}
              >
                <span>SPIN STAMINA</span>
                <span className={`tabular-nums font-bold ${isStaminaCritical ? 'text-rose-300' : 'text-white'}`}>
                  {effectivePlayerStamina}%
                </span>
              </div>
              {renderSegmentedBar(
                effectivePlayerStamina,
                isStaminaCritical
                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400 sl-critical-bar-pulse'
                  : 'bg-gradient-to-r from-sky-500 to-cyan-300',
                'h-2',
                isStaminaCritical
              )}
            </div>

            {/* Segmented Armor + Energy */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-1.5">
              <div>
                <div
                  className={`flex justify-between text-[9px] sm:text-[10px] font-semibold mb-0.5 ${
                    isArmorCritical ? 'text-rose-200' : 'text-slate-300'
                  }`}
                >
                  <span>ARMOR</span>
                  <span className={`tabular-nums font-bold ${isArmorCritical ? 'text-rose-300' : 'text-white'}`}>
                    {effectivePlayerDurabilityPct}%
                  </span>
                </div>
                {renderSegmentedBar(
                  effectivePlayerDurabilityPct,
                  isArmorCritical
                    ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-orange-400 sl-critical-bar-pulse'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-300',
                  'h-1.5',
                  isArmorCritical
                )}
              </div>
              <div>
                <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-300 font-semibold mb-0.5">
                  <span>EN</span>
                  <span className="tabular-nums font-bold text-amber-300">
                    {Math.round(effectivePlayerEnergy)}
                  </span>
                </div>
                <div className="sl-bar-track h-1.5 w-full rounded-sm overflow-hidden">
                  <div
                    className="sl-bar-fill h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width] duration-150"
                    style={{
                      width: `${effectivePlayerEnergyPct}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 6-Part Component Durability Micro-Indicators */}
            <div className="sl-ls-hud-parts grid grid-cols-6 gap-1 mb-1">
              {PART_LABELS.map(({ key, label }) => {
                const isBroken = isReplay && Boolean(replayTelemetry?.playerBrokenParts?.includes(key));
                const pct = isBroken ? 0 : Math.round(effectivePlayerPartDurability[key] ?? 100);
                return (
                  <div key={key} title={`${label}: ${pct}% (${getDurabilityBand(pct)})`}>
                    <div className="text-[8px] text-slate-400 font-bold text-center truncate">
                      {label}
                    </div>
                    <div className="sl-bar-track h-1 w-full rounded-sm overflow-hidden">
                      <div className={`h-full ${bandColor(pct)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[9px] sm:text-[10px] gap-1">
              <span className="text-purple-300 font-bold tabular-nums shrink-0 font-mono-tech">
                RES {Math.round(effectivePlayerResonance)}%
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-end min-w-0">
                {effectivePlayerStatuses.slice(0, 3).map((st) => (
                  <span
                    key={st}
                    className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[8px] sm:text-[9px] font-bold text-sky-200"
                  >
                    {st}
                  </span>
                ))}
                {effectivePlayerStatDebuffs.slice(0, 2).map((d) => (
                  <span
                    key={d.kind}
                    className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-extrabold border tabular-nums"
                    style={{
                      color: d.colorHex,
                      borderColor: `${d.colorHex}66`,
                      backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    }}
                  >
                    {d.label} {d.remainingSec.toFixed(1)}s
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Live Arena Diagnostics & Collision Heatmap Telemetry Card */}
          {showDiagnostics && telemetry && (
            <div
              data-testid="training-diagnostics-telemetry"
              className="mt-1.5 pt-1.5 border-t border-white/10 font-mono-tech text-[9px] sm:text-[10px] text-emerald-300 space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>FPS {telemetry.fps}</span>
                <span className="text-slate-500">·</span>
                <span>FRAME {telemetry.frameTimeMs.toFixed(1)}ms</span>
                <span className="text-slate-500">·</span>
                <span>SIM {telemetry.simStepTimeMs.toFixed(2)}ms</span>
                <span className="text-slate-500">·</span>
                <span className={telemetry.droppedSteps > 0 ? 'text-amber-300' : 'text-sky-300'}>
                  DROP {telemetry.droppedSteps}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-200">
                  {telemetry.quality}
                  {telemetry.qualityAutoAdjusted ? ' [Auto]' : ''} ({telemetry.particleBudget})
                </span>
              </div>

              <div
                data-testid="collision-heatmap-legend"
                className="pt-1 border-t border-white/10 flex flex-col gap-1 text-[9px] text-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sky-300 font-bold uppercase tracking-wider truncate">
                    Heatmap · {telemetry.heatmapImpacts ?? 0} Hits ·{' '}
                    {telemetry.heatmapPeakZone ?? 'Center Pocket'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-amber-300 font-bold tabular-nums">
                      {Math.min(100, Math.round(((telemetry.heatmapPeakIntensity ?? 0) / 1.5) * 100))}%
                    </span>
                    {onClearHeatmap && (
                      <button
                        type="button"
                        onClick={onClearHeatmap}
                        data-testid="clear-heatmap-btn"
                        className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400 hover:text-white text-[8px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-slate-400 font-semibold">
                  <span>Cool</span>
                  <div
                    className="h-1.5 flex-1 rounded-sm border border-slate-700/80"
                    style={{
                      background:
                        'linear-gradient(90deg, #0ea5e9 0%, #10b981 36%, #facc15 68%, #f43f5e 100%)',
                    }}
                  />
                  <span>Peak</span>
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>

        {/* Center Hexagonal Broadcast Scoreboard Clock + Arena Readout */}
        <div className="flex flex-col items-center shrink-0">
          <div className="sl-panel-chassis sl-hud-clock-hex sl-ls-hud-clock px-5 sm:px-7 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-widest text-slate-300 font-bold flex items-center justify-center gap-1">
              {isReplay ? (
                <span className="text-rose-400 font-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.95)]" />
                  REPLAY
                </span>
              ) : (
                <span>
                  {hud.phase === 'Critical'
                    ? 'CRITICAL'
                    : hud.phase === 'Launch'
                      ? 'LAUNCH'
                      : 'TIME'}
                </span>
              )}
              {survivalWave ? (
                <span className="text-emerald-300">· W{survivalWave}</span>
              ) : null}
              {typeof onlineRttMs === 'number' && (
                <span className="text-sky-300 flex items-center gap-0.5 tabular-nums">
                  · <Wifi className="w-2.5 h-2.5 inline" /> {onlineRttMs}ms
                </span>
              )}
            </div>
            <div className="sl-ls-hud-clock-time font-display text-lg sm:text-2xl font-bold text-white tabular-nums leading-tight">
              {isReplay
                ? `${Math.round((replayTelemetry?.progress ?? 0) * 100)}%`
                : hud.phase === 'Launch'
                  ? `${hud.launchCountdown.toFixed(1)}s`
                  : timeLeft}
            </div>
            <div
              className="sl-ls-hud-clock-sub hidden sm:block text-[9px] font-bold truncate max-w-[140px]"
              style={{ color: arenaDef.primaryColor }}
            >
              {isReplay
                ? `${replayTelemetry?.angleCode ?? 'CAM 01'} · ${replayTelemetry?.angleLabel ?? 'WIDE'}`
                : arenaDef.displayName}
            </div>
            {hud.weather && hud.weather !== 'Clear' && (() => {
              const wDef = getWeatherDefinition(hud.weather);
              const WIcon =
                hud.weather === 'LightRain'
                  ? CloudRain
                  : hud.weather === 'GaleWind'
                    ? Wind
                    : hud.weather === 'DustStorm'
                      ? Cloud
                      : Sun;
              return (
                <div
                  className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border text-[9px] font-bold uppercase tracking-wide"
                  style={{ color: wDef.accentHex, borderColor: `${wDef.accentHex}55` }}
                  title={wDef.description}
                >
                  <WIcon className="w-2.5 h-2.5 shrink-0" />
                  <span>{wDef.shortLabel}</span>
                </div>
              );
            })()}
          </div>

          {mutatorLabels.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1 max-w-[260px]">
              {mutatorLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="px-1.5 py-0.5 rounded border border-purple-400/50 bg-slate-950/90 text-[9px] font-extrabold text-purple-200 uppercase"
                >
                  {lbl}
                </span>
              ))}
            </div>
          )}

          <div aria-live="polite" className="flex flex-col items-center">
            {typeof reconnectGraceSec === 'number' && reconnectGraceSec > 0 && (
              <div className="mt-1.5 px-3 py-1 rounded border border-amber-400 bg-amber-950/95 text-amber-200 text-[11px] font-extrabold tracking-wide shadow-lg text-center tabular-nums">
                RIVAL RECONNECTING · {Math.ceil(reconnectGraceSec)}s
              </div>
            )}
            {hud.bannerText && (
              <div className="sl-panel-chassis mt-1.5 px-3.5 sm:px-4 py-1 rounded-lg border-amber-400/70 text-[11px] sm:text-xs font-display font-bold tracking-wider text-amber-300 uppercase text-center max-w-[270px] sm:max-w-md">
                {hud.bannerText}
              </div>
            )}
          </div>
        </div>

        {/* Opponent Right Esports Wing + Tactile 3D Utility Buttons */}
        <div className="flex flex-col sm:flex-row items-end sm:items-start justify-end gap-1.5 sm:gap-2.5 min-w-0">
          <div
            className="sl-panel-chassis sl-hud-wing-right sl-ls-hud-card pointer-events-auto w-full sm:w-[294px] md:w-[326px] p-2 sm:pl-5 sm:pr-2.5 sm:py-2.5 rounded-xl sm:rounded-none"
            style={{ borderTop: `2.5px solid ${oElem.primaryColor}` }}
          >
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CompactHexTopEmblem
                      side="opponent"
                      element={hud.opponent.element}
                    />
                    <span className="font-display text-[11px] sm:text-xs md:text-sm font-bold text-white truncate">
                      {hud.opponent.name}
                    </span>
                  </div>
                  <span className="font-display text-[11px] sm:text-sm font-bold text-rose-400 tabular-nums shrink-0">
                    {effectiveOpponentRpm}{' '}
                    <span className="text-[8px] sm:text-[10px] text-slate-400">RPM</span>
                  </span>
                </div>

            {/* Slim 2-Line Mobile Corner Strip: Segmented Rival Spin + Armor */}
            <div className="sl-hud-compact-row">
              <div>
                <div className="flex justify-between text-[8px] text-slate-300 font-bold leading-none mb-0.5">
                  <span>STA</span>
                  <span className="tabular-nums text-white">{effectiveOpponentStamina}%</span>
                </div>
                {renderSegmentedBar(
                  effectiveOpponentStamina,
                  'bg-gradient-to-t from-rose-500 to-orange-400',
                  'h-1.5'
                )}
              </div>
              <div>
                <div className="flex justify-between text-[8px] text-slate-300 font-bold leading-none mb-0.5">
                  <span>ARM</span>
                  <span className="tabular-nums text-white">{effectiveOpponentDurabilityPct}%</span>
                </div>
                {renderSegmentedBar(
                  effectiveOpponentDurabilityPct,
                  'bg-gradient-to-t from-orange-500 to-amber-300',
                  'h-1.5'
                )}
              </div>
            </div>

            {/* Desktop Detailed Broadcast Telemetry */}
            <div className="sl-hud-desktop-detail">
              <div className="mb-1.5">
                <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-300 font-semibold mb-0.5">
                  <span>RIVAL SPIN</span>
                  <span className="tabular-nums font-bold text-white">{effectiveOpponentStamina}%</span>
                </div>
                {renderSegmentedBar(
                  effectiveOpponentStamina,
                  'bg-gradient-to-r from-rose-500 to-orange-400',
                  'h-2'
                )}
              </div>

              <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-300 font-semibold mb-0.5">
                <span>RIVAL ARMOR</span>
                <span className="tabular-nums font-bold text-white">{effectiveOpponentDurabilityPct}%</span>
              </div>
              {renderSegmentedBar(
                effectiveOpponentDurabilityPct,
                'bg-gradient-to-r from-orange-500 to-amber-300',
                'h-1.5'
              )}

              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-semibold gap-1">
                <div className="flex gap-1 flex-wrap">
                  {effectiveOpponentStatuses.slice(0, 3).map((st) => (
                    <span key={st} className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[9px] text-rose-300">
                      {st}
                    </span>
                  ))}
                  {effectiveOpponentStatDebuffs.slice(0, 2).map((d) => (
                    <span
                      key={d.kind}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold border tabular-nums"
                      style={{
                        color: d.colorHex,
                        borderColor: `${d.colorHex}66`,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      }}
                    >
                      {d.label} {d.remainingSec.toFixed(1)}s
                    </span>
                  ))}
                </div>
                <span className="shrink-0">
                  {hud.opponent.mode} · {hud.opponent.command}
                </span>
              </div>
            </div>
              </div>
              <TopWingEmblemBadge
                side="opponent"
                element={hud.opponent.element}
                secondaryElement={hud.opponent.secondaryElement}
                opponentMode={hud.opponent.mode}
              />
            </div>
          </div>

          <div className="sl-ls-hud-utils pointer-events-auto flex flex-row sm:flex-col gap-1.5 sm:gap-2 shrink-0">
            {isReplay ? (
              onSkipReplay && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSkipReplay();
                  }}
                  aria-label="Skip Replay"
                  title="Skip Replay"
                  className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-rose sl-ls-hud-util-btn w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer text-[11px] font-bold"
                >
                  Skip
                </button>
              )
            ) : (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                aria-label="Pause battle"
                className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-hud-util-btn w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-hud-util-btn w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-sky-300" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              title={`Camera: ${cameraPreset} [${(keyBindings.cameraCycle || 'c').toUpperCase()}]`}
              onClick={(e) => {
                e.currentTarget.blur();
                onCycleCameraPreset();
              }}
              aria-label="Cycle camera angle"
              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate sl-ls-hud-util-btn w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Dock: Spectator Broadcast Controls OR 5s Launch Deck OR Pure-Physics Item Dock */}
      <div className="flex flex-col items-center gap-2">
        {hud.isSpectating ? (
          <div
            data-testid="spectator-hud-dock"
            className="sl-panel-chassis mx-auto pointer-events-auto w-full max-w-[790px] p-3 rounded-xl flex flex-wrap items-center justify-between gap-2.5"
            style={{ borderColor: 'rgba(34, 211, 238, 0.55)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-1 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Eye className="w-3.5 h-3.5" />
                LIVE SPECTATOR
              </span>
              <span className="font-display text-xs sm:text-sm font-bold text-white truncate">
                {hud.player.name} <span className="text-slate-400">vs</span> {hud.opponent.name}
              </span>
              {typeof hud.spectatorCount === 'number' && (
                <span className="text-[10px] text-slate-300 font-bold tabular-nums shrink-0">
                  ({hud.spectatorCount} watching)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['Broadcast', 'LowAction', 'TopDown', 'Orbit'] as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    onSelectCameraPreset ? onSelectCameraPreset(preset) : onCycleCameraPreset()
                  }
                  className={`sl-btn-3d sl-btn-3d-sm min-h-[42px] px-3.5 py-1.5 text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                    cameraPreset === preset ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => (onExitSpectate ? onExitSpectate() : onPause())}
                className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-crimson min-h-[42px] px-4 py-1.5 text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
              >
                Exit Spectate
              </button>
            </div>
          </div>
        ) : hud.phase === 'Launch' ? (
          <div
            className="sl-panel-chassis sl-ls-launch-deck mx-auto mb-1 pointer-events-auto w-full max-w-sm px-5 py-3.5 rounded-xl text-center"
            style={{ borderColor: inPerfectZone ? 'rgba(251, 191, 36, 0.85)' : 'rgba(56, 189, 248, 0.7)' }}
          >
            {showFirstMatchHint && onDismissFirstMatchHint && (
              <div className="sl-ls-launch-hint mb-2 px-2.5 py-1.5 rounded-lg border border-emerald-400/50 bg-emerald-950/60 text-[11px] text-emerald-200 flex items-center justify-between gap-2 text-left">
                <span>
                  Tip: Slide or click inside the arena dish to aim, then tap{' '}
                  <strong>LET IT SPIN!</strong> inside the golden Perfect Launch window (+8% RPM).
                </span>
                <button
                  type="button"
                  onClick={onDismissFirstMatchHint}
                  aria-label="Dismiss launch tip"
                  className="p-1 text-emerald-300 hover:text-white shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="uppercase tracking-widest text-sky-300 flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  5s Simultaneous Launch
                </span>
                <span className="font-mono-tech text-amber-300 font-bold">
                  {hud.launchCountdown.toFixed(1)}s AUTO
                </span>
              </div>

              {/* Countdown Drain Bar */}
              <div className="sl-bar-track h-1.5 w-full rounded overflow-hidden mb-1.5">
                <div
                  className="sl-bar-fill h-full bg-amber-400 transition-[width] duration-75"
                  style={{
                    width: `${Math.min(100, (hud.launchCountdown / LAUNCH_WINDOW_SECONDS) * 100)}%`,
                  }}
                />
              </div>

              <div className="text-[11px] text-slate-300 mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate">
                  Aim {hud.launchHandedness === 'right' ? 'Right (CCW)' : 'Left (CW)'} ·{' '}
                  <span className="text-amber-300 font-bold tabular-nums">{hud.launchAngleDeg}°</span>{' '}
                  ({hud.launchAimSet ? 'Locked' : 'Default'})
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shrink-0 ${
                    inPerfectZone
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800/90 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  {inPerfectZone ? 'PERFECT +8% RPM!' : 'GOLD ZONE 80–94%'}
                </span>
              </div>

              {/* Oscillating Launch Power Gauge with Golden Perfect Launch Window (80%–94%) */}
              <div className="sl-bar-track relative h-4.5 w-full rounded overflow-hidden mb-2.5 sm:mb-2">
                <div
                  className="absolute top-0 bottom-0 bg-amber-400/45 border-x-2 border-amber-300 z-10 pointer-events-none"
                  style={{ left: `${perfectLeftPct}%`, width: `${perfectWidthPct}%` }}
                  title="Perfect Launch Window (80%–94%): +8% RPM"
                />
                <div
                  className={`sl-bar-fill h-full transition-colors duration-75 ${
                    inPerfectZone
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                      : 'bg-gradient-to-r from-sky-600 to-cyan-300'
                  }`}
                  style={{ width: `${Math.round(launchMeterValue * 100)}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              data-launch="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onLaunch();
              }}
              className={`sl-btn-3d sl-chamfer sl-ls-launch-trigger w-full min-h-[50px] py-2.5 px-6 font-display font-bold text-sm sm:text-base tracking-wider cursor-pointer ${
                inPerfectZone ? 'sl-btn-3d-amber ring-2 ring-amber-200/80' : 'sl-btn-3d-amber'
              }`}
            >
              LET IT SPIN! [{keyBindings.launch === ' ' ? 'SPACE' : keyBindings.launch.toUpperCase()}]
            </button>
          </div>
        ) : (
          <div className="w-full flex items-end justify-between gap-2 pointer-events-none">
            {/* Bottom-Left Anchor: Training Debug Controls + Quick Swap + 3v1 Tag Team */}
            <div className="flex flex-col items-start gap-2 max-w-[min(460px,54vw)]">
              {debugMode && (
                <div
                  data-testid="training-debug-drawer"
                  className="sl-panel-chassis pointer-events-auto w-full p-2 sm:p-2.5 rounded-xl border-amber-400/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    <span className="flex items-center gap-1.5 truncate">
                      <Bug className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Debug Physics</span>
                    </span>
                    <button
                      type="button"
                      onClick={onToggleDiagnostics}
                      className={`sl-btn-3d sl-btn-3d-sm min-h-[30px] px-2 py-0.5 text-[9px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                        showDiagnostics ? 'sl-btn-3d-emerald' : 'sl-btn-3d-slate'
                      }`}
                    >
                      <Activity className="w-3 h-3" />
                      Heatmap {showDiagnostics ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Debug Battle Modes">
                    {BATTLE_MODES.map((m) => {
                      const active = hud.player.mode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          tabIndex={-1}
                          title={m.tagline}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            onSelectMode(m.id);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border transition-colors ${
                            active
                              ? 'text-slate-950 border-transparent shadow-sm'
                              : 'text-slate-300 border-slate-700 bg-slate-900/90 hover:border-slate-500'
                          }`}
                          style={active ? { backgroundColor: m.color } : undefined}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Debug Tactical Commands">
                    {TACTICAL_COMMANDS.map((c, idx) => {
                      const active = hud.player.command === c.id;
                      const tacticalBindKey = (`tactical${idx + 1}` as keyof KeyBindings);
                      const hint = (keyBindings[tacticalBindKey] ?? c.keyHint).toUpperCase();
                      return (
                        <button
                          key={c.id}
                          type="button"
                          tabIndex={-1}
                          title={c.shortDesc}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            onSelectCommand(c.id);
                          }}
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border transition-colors ${
                            active
                              ? 'bg-sky-400 text-slate-950 border-sky-300'
                              : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <span className="opacity-65 mr-0.5">[{hint}]</span>
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(hud.mutators?.noAbilities || (canQuickSwap && onQuickSwap) || hud.isTeamBattle) && (
                <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                  {hud.mutators?.noAbilities && (
                    <span className="px-2.5 py-1 rounded bg-slate-950/90 border border-slate-700 text-sky-300 text-[10px] font-display font-bold tracking-wide">
                      MECHANICAL ONLY
                    </span>
                  )}
                  {canQuickSwap && onQuickSwap && (
                    <button
                      type="button"
                      tabIndex={-1}
                      data-testid="hud-quick-swap"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onQuickSwap();
                      }}
                      title="Pause and switch saved loadout preset"
                      className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-amber min-h-[38px] px-3.5 py-1.5 text-[11px] font-display font-bold flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Quick Swap
                    </button>
                  )}
                  {hud.isTeamBattle &&
                    hud.teamSlots.map((member, idx) => {
                      const ready =
                        !member.active &&
                        !member.knockedOut &&
                        hud.teamSwitchCooldown <= 0 &&
                        hud.player.energy >= TEAM_SWITCH_ENERGY_COST;
                      return (
                        <button
                          key={`${member.name}-${idx}`}
                          type="button"
                          disabled={!ready}
                          onClick={() => onSwitchTeamTop(idx)}
                          title={
                            member.active
                              ? 'Currently active'
                              : member.knockedOut
                                ? 'Knocked Out'
                                : `Tag in ${member.name} (${TEAM_SWITCH_ENERGY_COST} EN)`
                          }
                          className={`sl-btn-3d sl-btn-3d-sm min-h-[38px] px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap ${
                            member.active
                              ? 'sl-btn-3d-cyan'
                              : member.knockedOut
                                ? 'bg-slate-950 border border-slate-800 text-slate-600 line-through cursor-not-allowed'
                                : ready
                                  ? 'sl-btn-3d-emerald cursor-pointer'
                                  : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Repeat className="w-3 h-3" />
                          {member.name.split(' ')[0]} ({member.staminaPct}%)
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Phase 2: Bottom-Right Corner Radial/Arc Skill Cluster (Thumb-Zone Ergonomics) */}
            <div
              className="sl-ls-radial-cluster relative w-[198px] h-[182px] shrink-0 pointer-events-none"
              role="group"
              aria-label="Active Item Slots"
            >
              {hud.player.slots.map((slot, idx) => {
                const def = getAbilityDefinition(slot.abilityId);
                const disabledByMutator = Boolean(hud.mutators?.noAbilities);
                const needsRes =
                  def.resonanceCost > 0 && effectivePlayerResonance < def.resonanceCost;
                const needsEnergy = effectivePlayerEnergy < def.energyCost;
                const onCd = !isReplay && slot.cooldown > 0;
                const ready = !isReplay && !disabledByMutator && !needsRes && !needsEnergy && !onCd;

                const slotEffect = playerStatusSummary.slotEffects[idx];
                const isShieldActive = slotEffect?.isShield ?? false;
                const isFireActive = slotEffect?.isFire ?? false;
                const isActive = slotEffect?.active ?? false;

                let fillPct = 100;
                if (disabledByMutator) {
                  fillPct = 0;
                } else if (isActive) {
                  fillPct = 100;
                } else if (onCd) {
                  fillPct = Math.max(
                    0,
                    Math.min(100, (1 - slot.cooldown / Math.max(0.1, def.cooldownSec)) * 100)
                  );
                } else if (needsRes) {
                  fillPct = Math.max(
                    0,
                    Math.min(100, (effectivePlayerResonance / Math.max(1, def.resonanceCost)) * 100)
                  );
                } else if (needsEnergy) {
                  fillPct = Math.max(
                    0,
                    Math.min(100, (effectivePlayerEnergy / Math.max(1, def.energyCost)) * 100)
                  );
                }

                const Icon =
                  idx === 0 ? Flame : idx === 1 ? Shield : idx === 2 ? Zap : Sparkles;

                const isUltimate = idx === 3;
                const posClass =
                  idx === 3
                    ? 'right-0 bottom-0 sl-ls-radial-ult w-[76px] h-[76px]'
                    : idx === 0
                      ? 'right-[98px] bottom-[6px] sl-ls-radial-sec w-[58px] h-[58px]'
                      : idx === 1
                        ? 'right-[78px] bottom-[76px] sl-ls-radial-sec w-[58px] h-[58px]'
                        : 'right-[10px] bottom-[98px] sl-ls-radial-sec w-[58px] h-[58px]';

                const ringColor = isFireActive
                  ? '#fb923c'
                  : isShieldActive
                    ? '#38bdf8'
                    : isActive
                      ? '#fbbf24'
                      : def.colorHex;

                return (
                  <button
                    key={`${slot.abilityId}-${idx}`}
                    type="button"
                    tabIndex={-1}
                    disabled={isReplay || !ready}
                    data-slot-active={isActive ? 'true' : 'false'}
                    data-slot-effect={
                      isFireActive ? 'fire' : isShieldActive ? 'shield' : isActive ? 'active' : 'idle'
                    }
                    title={
                      disabledByMutator
                        ? 'Disabled by No Abilities mutator'
                        : isActive
                          ? `${def.displayName}: ACTIVE`
                          : `${def.displayName}: ${def.description} (Cost: ${def.energyCost} EN)`
                    }
                    onClick={(e) => {
                      e.currentTarget.blur();
                      if (!isReplay) {
                        onActivateAbility(idx);
                      }
                    }}
                    className={`pointer-events-auto absolute ${posClass} rounded-full flex flex-col items-center justify-center transition-transform duration-100 ${
                      ready ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed'
                    } ${
                      isFireActive
                        ? 'bg-gradient-to-b from-orange-950/90 to-slate-950 ring-2 ring-orange-400 shadow-[0_0_24px_rgba(249,115,22,0.9)]'
                        : isShieldActive
                          ? 'bg-gradient-to-b from-cyan-950/90 to-slate-950 ring-2 ring-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.9)]'
                          : isActive
                            ? 'bg-slate-900/95 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.75)]'
                            : ready
                              ? 'bg-slate-950/90 border border-slate-600/80 shadow-[0_10px_22px_rgba(2,6,23,0.85)]'
                              : 'bg-slate-950/85 border border-slate-800/90 text-slate-400'
                    }`}
                  >
                    {/* Conic Radial Charge Progress Arc */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        background: `conic-gradient(${ringColor} ${Math.round(fillPct * 3.6)}deg, rgba(15, 23, 42, 0.72) 0deg)`,
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
                      }}
                    />

                    {/* Keybind Tag Badge */}
                    <span className="absolute -top-1 -left-1 z-20 px-1.5 py-0.5 rounded-full bg-slate-950 border border-slate-600/90 text-[9px] font-mono-tech font-bold text-sky-300 leading-none pointer-events-none">
                      {abilityKeys[idx]}
                    </span>

                    {/* Active Edge Status Indicator */}
                    {isActive && (
                      <span
                        className={`absolute -top-2 right-0 z-20 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider text-slate-950 ring-1 ring-white/90 pointer-events-none ${
                          isFireActive
                            ? 'bg-orange-400'
                            : isShieldActive
                              ? 'bg-sky-300'
                              : 'bg-amber-300'
                        }`}
                      >
                        {isFireActive ? 'FIRE' : isShieldActive ? 'SHLD' : 'ON'}
                      </span>
                    )}

                    {/* Center Icon + Large Numeric Cooldown / Resource Readout */}
                    <div className="relative z-10 flex flex-col items-center justify-center leading-none px-1">
                      {onCd ? (
                        <span className="font-mono-tech font-black text-white text-sm sm:text-base tabular-nums drop-shadow">
                          {slot.cooldown.toFixed(1)}
                        </span>
                      ) : (
                        <>
                          <Icon
                            className={`${isUltimate ? 'w-6 h-6' : 'w-4 h-4 sm:w-5 sm:h-5'} transition-transform ${
                              isActive ? 'scale-110 text-white' : ''
                            }`}
                            style={!isActive ? { color: ready ? ringColor : '#64748b' } : undefined}
                          />
                          <span className="mt-0.5 text-[8px] sm:text-[9px] font-mono-tech font-bold tabular-nums text-slate-200 truncate max-w-[46px]">
                            {isActive
                              ? 'ACTIVE'
                              : disabledByMutator
                                ? 'LOCK'
                                : def.resonanceCost > 0 && needsRes
                                  ? `${Math.round(effectivePlayerResonance)}%`
                                  : `${def.energyCost}E`}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
