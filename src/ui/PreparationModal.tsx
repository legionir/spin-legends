import React from 'react';
import {
  Swords,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  X,
  Layers,
  CloudRain,
  Wind,
  Sun,
  Cloud,
} from 'lucide-react';
import {
  ARENAS,
  ELEMENTS,
  WEATHER_LIST,
  getOpponentDefinition,
  getTopDefinition,
  getWeatherDefinition,
  resolveArenaDefaultWeather,
} from '../domain/catalog';
import { getActiveMutatorLabels, getDualElementalMultiplier } from '../domain/rules';
import {
  ArenaId,
  BattleMutators,
  MatchMode,
  OwnedTopState,
  PlayerSaveData,
  WeatherType,
} from '../domain/types';

interface PreparationModalProps {
  save: PlayerSaveData;
  activeTop: OwnedTopState;
  mode: MatchMode;
  arenaId: ArenaId;
  opponentId: string;
  isTeamBattle: boolean;
  survivalWave?: number;
  mutators?: BattleMutators;
  weather: WeatherType;
  onSelectWeather: (weather: WeatherType) => void;
  onConfirmLaunch: () => void;
  onCancel: () => void;
}

export const PreparationModal: React.FC<PreparationModalProps> = ({
  save,
  activeTop,
  mode,
  arenaId,
  opponentId,
  isTeamBattle,
  survivalWave,
  mutators,
  weather,
  onSelectWeather,
  onConfirmLaunch,
  onCancel,
}) => {
  const arena = ARENAS[arenaId];
  const opp = getOpponentDefinition(opponentId);
  const oppTop = getTopDefinition(opp.topId);
  const pTopDef = getTopDefinition(activeTop.definitionId);

  const pElem = ELEMENTS[pTopDef.element];
  const oElem = ELEMENTS[oppTop.element];

  const matchupMult = getDualElementalMultiplier(
    pTopDef.element,
    activeTop.secondaryElement,
    oppTop.element,
    opp.secondaryElement
  );

  const teamTops = isTeamBattle
    ? save.teamTopInstanceIds
        .map((id) => save.ownedTops.find((t) => t.instanceId === id))
        .filter((t): t is OwnedTopState => Boolean(t))
    : [activeTop];

  const activeMutatorLabels = getActiveMutatorLabels(mutators ?? save.preferredMutators);
  const activeWeather = getWeatherDefinition(weather);
  const arenaForecastWeather = resolveArenaDefaultWeather(arenaId);
  const effectiveFriction = (arena.surfaceFrictionMult * activeWeather.gripFrictionMult).toFixed(2);
  const effectiveDrag = (arena.rotationalDragMult * activeWeather.rotDragMult).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.72)' }}
    >
      <div
        role="dialog"
        aria-label="Preparation Briefing"
        className="sl-panel-modal w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl"
      >
        <div className="sl-ls-modal-header px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-sky-400 font-bold font-mono-tech">
              Pre-Battle Preparation Briefing · {mode}
              {survivalWave ? ` · Wave ${survivalWave}` : ''}
            </div>
            <h2 className="font-display sl-title-metal text-lg font-bold uppercase tracking-wider">
              Arena & Matchup Inspection
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel battle"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sl-hairline" />

        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider font-display" style={{ color: arena.primaryColor }}>
                  {arena.displayName}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">{arena.description}</div>
              </div>
              <div className="text-right text-[11px] text-slate-400 shrink-0 ml-3 font-mono-tech tabular-nums">
                <div>Friction: <strong className="text-white">{effectiveFriction}x</strong></div>
                <div>Spin Drag: <strong className="text-white">{effectiveDrag}x</strong></div>
              </div>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-amber-300">
              Hazards: {arena.hazardSummary}
            </div>
            {activeMutatorLabels.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-purple-300">Active Mutators:</span>
                <span className="text-[11px] font-bold text-purple-200">
                  {activeMutatorLabels.join(' · ')}
                </span>
              </div>
            )}
          </div>

          {/* Dynamic Arena Weather Conditions Selector */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-wider text-sky-300 font-bold font-mono-tech flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5" />
                Dynamic Arena Weather
              </div>
              <button
                type="button"
                onClick={() => onSelectWeather(arenaForecastWeather)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer"
              >
                Use Arena Forecast ({getWeatherDefinition(arenaForecastWeather).shortLabel})
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEATHER_LIST.map((w) => {
                const selected = w.id === weather;
                const Icon =
                  w.id === 'LightRain'
                    ? CloudRain
                    : w.id === 'GaleWind'
                      ? Wind
                      : w.id === 'DustStorm'
                        ? Cloud
                        : Sun;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSelectWeather(w.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-slate-800/95 text-white'
                        : 'bg-slate-950/75 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    style={
                      selected
                        ? { borderColor: w.accentHex, boxShadow: `0 0 0 1px ${w.accentHex}44` }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-1.5 text-xs font-extrabold">
                      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: w.accentHex }} />
                      <span className="truncate">{w.shortLabel}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono-tech text-slate-400 tabular-nums">
                      Grip {Math.round(w.gripFrictionMult * 100)}% · Stab {Math.round(w.stabilityRecoveryMult * 100)}%
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
              <span>{activeWeather.description}</span>
              {activeWeather.gustAccel > 0 && (
                <span className="text-teal-300 font-bold font-mono-tech">Crosswind Active</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-sky-500/40 bg-sky-950/20">
              <div className="text-[10px] uppercase tracking-wider text-sky-300 font-bold font-mono-tech">
                Your Active Build
              </div>
              <div className="font-display text-base font-bold text-white mt-0.5">
                {pTopDef.displayName} <span className="text-xs text-slate-400 font-mono-tech">Lv.{activeTop.level}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs font-bold">
                <span style={{ color: pElem.primaryColor }}>{pTopDef.element}</span>
                {activeTop.secondaryElement && (
                  <span style={{ color: ELEMENTS[activeTop.secondaryElement].primaryColor }}>
                    + {activeTop.secondaryElement}
                  </span>
                )}
                <span className="text-slate-400">· {pTopDef.archetype}</span>
              </div>
              {isTeamBattle && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  3-Top Tag Team:{' '}
                  {teamTops.map((t) => getTopDefinition(t.definitionId).displayName.split(' ')[0]).join(' → ')}
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/20">
              <div className="text-[10px] uppercase tracking-wider text-rose-300 font-bold font-mono-tech flex items-center gap-1">
                {opp.isBoss && <ShieldAlert className="w-3.5 h-3.5" />}
                Challenger Rival
              </div>
              <div className="font-display text-base font-bold text-white mt-0.5">
                {opp.displayName} <span className="text-xs text-slate-400 font-mono-tech">Lv.{opp.level}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs font-bold">
                <span style={{ color: oElem.primaryColor }}>{oppTop.displayName} ({oppTop.element})</span>
                <span className="text-slate-400">· {opp.personality} AI</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">{opp.description}</div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">
                Elemental Clash Ratio:{' '}
                <strong
                  className={`font-mono-tech tabular-nums ${
                    matchupMult > 1.02
                      ? 'text-emerald-400'
                      : matchupMult < 0.98
                        ? 'text-rose-400'
                        : 'text-sky-300'
                  }`}
                >
                  {(matchupMult * 100).toFixed(0)}% Impact
                </strong>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              5s Aim & Power Launch · Simultaneous Drop · Pure Physics Combat
            </span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="sl-btn-3d sl-btn-3d-slate px-5 py-3 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Back
            </button>
            <button
              type="button"
              data-start="true"
              onClick={onConfirmLaunch}
              className="sl-btn-3d sl-btn-3d-cyan sl-chamfer flex-1 py-3 px-6 font-display font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Swords className="w-4 h-4" />
              ENTER STADIUM (5s LAUNCH)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

