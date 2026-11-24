import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Trophy,
  Swords,
  ShieldAlert,
  Flame,
  Globe,
  Layers,
  Activity,
  MapPin,
} from 'lucide-react';
import {
  ARENAS,
  ELEMENTS,
  OPPONENTS,
  getOpponentDefinition,
  getTopDefinition,
} from '../domain/catalog';
import { MUTATOR_DEFINITIONS } from '../domain/rules';
import { ArenaId, BattleMutators, PlayerSaveData } from '../domain/types';
import { TournamentBracketTree } from './TournamentBracketTree';

interface TournamentModalProps {
  save: PlayerSaveData;
  initialTab: 'training' | 'tournament' | 'survival' | 'boss' | 'team';
  onClose: () => void;
  onSelectArena: (arenaId: ArenaId) => void;
  onToggleDiagnostics: () => void;
  onStartTraining: (opponentId: string, arenaId: ArenaId) => void;
  onUpdateMutators?: (mutators: BattleMutators) => void;
  onStartTournamentMatch: () => void;
  onResetTournament: (bracketSize: 4 | 8 | 16) => void;
  onStartSurvival: (arenaId: ArenaId) => void;
  onStartBossBattle: (bossId: string, arenaId: ArenaId) => void;
  onStartTeamBattle: (opponentId: string, arenaId: ArenaId) => void;
  onOpenOnlineArena: () => void;
}

export const TournamentModal: React.FC<TournamentModalProps> = ({
  save,
  initialTab,
  onClose,
  onSelectArena,
  onToggleDiagnostics,
  onStartTraining,
  onUpdateMutators,
  onStartTournamentMatch,
  onResetTournament,
  onStartSurvival,
  onStartBossBattle,
  onStartTeamBattle,
  onOpenOnlineArena,
}) => {
  const [tab, setTab] = useState(initialTab);
  const [selectedTrainingOpp, setSelectedTrainingOpp] = useState(OPPONENTS[0].id);

  const arenas = Object.values(ARENAS);
  const bosses = OPPONENTS.filter((o) => o.isBoss);
  const [selectedBossId, setSelectedBossId] = useState(bosses[0]?.id ?? OPPONENTS[0].id);

  const bracketSize = save.tournament.bracketSize || 4;
  const currentRound = save.tournament.currentRound;
  const isBracketComplete = save.tournament.completedRounds >= bracketSize;
  const selectedArena = ARENAS[save.selectedArenaId];
  const activeOwnedTop =
    save.ownedTops.find((t) => t.instanceId === save.selectedTopInstanceId) ?? save.ownedTops[0];
  const playerTopName = activeOwnedTop
    ? getTopDefinition(activeOwnedTop.definitionId).displayName
    : 'Commander Top';

  const getStageLabel = (idx: number) => {
    if (idx === bracketSize - 1) return 'Grand Boss Final';
    if (idx === bracketSize - 2) return 'Final';
    if (idx >= bracketSize - 4) return 'Semifinal';
    return `Round ${idx + 1}`;
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.68)' }}
    >
      <div className="sl-panel-modal w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sl-ls-modal-header shrink-0 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="font-display sl-title-metal text-lg sm:text-xl font-bold uppercase tracking-wider">
              Arena & Game Mode Select
            </h2>
            <p className="text-xs text-slate-400">
              6 Distinct Physics Arenas · Pure Physics Simulation · 5s Aim & Power Launch
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close battle select"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[42px] min-w-[42px] shrink-0 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sl-hairline shrink-0" />

        {/* Mode Tabs */}
        <div className="sl-ls-modal-tabs shrink-0 px-5 py-2.5 border-b border-slate-800/80 bg-slate-950/35 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            {(
              [
                { id: 'training', label: 'Training', icon: Swords, activeClass: 'sl-btn-3d-cyan' },
                { id: 'tournament', label: 'Tournament', icon: Trophy, activeClass: 'sl-btn-3d-amber' },
                { id: 'survival', label: 'Survival', icon: Flame, activeClass: 'sl-btn-3d-emerald' },
                { id: 'boss', label: 'Boss Raid', icon: ShieldAlert, activeClass: 'sl-btn-3d-crimson' },
                { id: 'team', label: '3v1 Tag Team', icon: Layers, activeClass: 'sl-btn-3d-violet' },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3 py-1.5 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive ? t.activeClass : 'sl-btn-3d-slate text-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="tournament-tab-rail"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenOnlineArena}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            Online Arena
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto sl-scroll p-5 space-y-5">
          {/* 6-Arena Selector Strip (Shared across Training / Survival / Team) */}
          {tab !== 'tournament' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  Select 3D Stadium ({selectedArena.displayName})
                </span>
                <span className="text-[11px] text-amber-300 font-semibold">
                  {selectedArena.hazardSummary}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {arenas.map((arena) => {
                  const active = save.selectedArenaId === arena.id;
                  return (
                    <button
                      key={arena.id}
                      type="button"
                      onClick={() => onSelectArena(arena.id)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                        active
                          ? 'bg-slate-800/90 border-white'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div
                        className="w-full h-1.5 rounded-full mb-1.5"
                        style={{ backgroundColor: arena.primaryColor }}
                      />
                      <div className="text-xs font-extrabold text-white truncate">
                        {arena.displayName.replace(' Arena', '').replace(' Stadium', '')}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{arena.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >

          {tab === 'training' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/70">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Arena Diagnostics &amp; Heatmap:</strong> Render live velocity arrows, trajectory arc, and floor impact heatmap across matches.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleDiagnostics}
                  className={`sl-btn-3d sl-btn-3d-sm px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                    save.settings.showDiagnostics
                      ? 'sl-btn-3d-emerald'
                      : 'sl-btn-3d-slate text-slate-300'
                  }`}
                >
                  {save.settings.showDiagnostics ? 'Diagnostics ON' : 'Diagnostics OFF'}
                </button>
              </div>

              {/* Custom Battle Rules / Mutators */}
              <div className="p-3.5 rounded-xl border border-purple-500/35 bg-purple-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-purple-200">
                    Custom Battle Rules & Mutators
                  </span>
                  <span className="text-[10px] text-purple-300 font-semibold">
                    Applies to Training, Skirmish & Friendly Rooms
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {MUTATOR_DEFINITIONS.map((m) => {
                    const active = Boolean(save.preferredMutators?.[m.id]);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (onUpdateMutators) {
                            onUpdateMutators({
                              ...save.preferredMutators,
                              [m.id]: !active,
                            });
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                          active
                            ? 'border-purple-400 bg-purple-950/60 text-purple-100 shadow'
                            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{m.label}</span>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              active ? 'bg-purple-400 text-slate-950' : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {active ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-1 line-clamp-2">
                          {m.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {OPPONENTS.map((opp) => {
                  const top = getTopDefinition(opp.topId);
                  const elem = ELEMENTS[top.element];
                  const selected = selectedTrainingOpp === opp.id;

                  return (
                    <button
                      key={opp.id}
                      type="button"
                      onClick={() => setSelectedTrainingOpp(opp.id)}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-sky-400 bg-sky-950/35'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-white flex items-center gap-1.5">
                          {opp.isBoss && <ShieldAlert className="w-4 h-4 text-rose-400" />}
                          {opp.displayName}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                          {opp.difficulty}
                        </span>
                      </div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: elem.primaryColor }}>
                        {top.displayName} · {opp.personality} AI · Lv.{opp.level}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{opp.description}</p>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onStartTraining(selectedTrainingOpp, save.selectedArenaId)}
                className="sl-btn-3d sl-btn-3d-cyan sl-chamfer w-full min-h-[46px] py-3 px-6 font-display font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <Swords className="w-4 h-4" />
                PREPARE & ENTER {selectedArena.displayName.toUpperCase()}
              </button>
            </div>
          )}

          {tab === 'tournament' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-amber-300 font-bold">
                    World Championship Bracket ({bracketSize} Stages)
                  </div>
                  <div className="text-base font-extrabold text-white">
                    Championships Won: {save.tournament.championshipsWon}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {([4, 8, 16] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onResetTournament(sz)}
                      className={`sl-btn-3d sl-btn-3d-sm px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                        bracketSize === sz ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-slate-300'
                      }`}
                    >
                      {sz}-Top Bracket
                    </button>
                  ))}
                </div>
              </div>

              <TournamentBracketTree
                tournament={save.tournament}
                playerName={save.character.name}
                playerTopName={playerTopName}
                onStartCurrentMatch={onStartTournamentMatch}
              />

              {isBracketComplete ? (
                <button
                  type="button"
                  onClick={() => onResetTournament(bracketSize)}
                  className="sl-btn-3d sl-btn-3d-amber sl-chamfer w-full min-h-[46px] py-3 px-6 font-display font-bold text-sm cursor-pointer"
                >
                  CHAMPION CROWNED! START NEW {bracketSize}-TOP TOURNAMENT
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartTournamentMatch}
                  className="sl-btn-3d sl-btn-3d-amber sl-chamfer w-full min-h-[46px] py-3 px-6 font-display font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  FIGHT {getStageLabel(currentRound).toUpperCase()}
                </button>
              )}
            </div>
          )}

          {tab === 'survival' && (
            <div className="p-5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
                    Endurance Survival Gauntlet
                  </div>
                  <h3 className="text-xl font-black text-white mt-0.5">Endless Wave Carry-Over</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Best Record</div>
                  <div className="text-2xl font-black text-emerald-300 tabular-nums">
                    Wave {save.survivalBestWave}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Face escalating opponents wave after wave. Your Spin Stamina & Structural Armor partially carry forward between waves (+20% pit-stop recovery per victory). Every 3rd wave awards bonus <strong>Legendary Fragments</strong>!
              </p>
              <button
                type="button"
                onClick={() => onStartSurvival(save.selectedArenaId)}
                className="sl-btn-3d sl-btn-3d-emerald sl-chamfer w-full min-h-[46px] py-3 px-6 font-display font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4" />
                START SURVIVAL WAVE 1
              </button>
            </div>
          )}

          {tab === 'boss' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {bosses.map((boss) => {
                  const defeated = save.bossDefeatedIds.includes(boss.id);
                  const selected = selectedBossId === boss.id;
                  const bossArena = ARENAS[boss.preferredArenaId ?? 'standard'];
                  return (
                    <button
                      key={boss.id}
                      type="button"
                      onClick={() => setSelectedBossId(boss.id)}
                      className={`p-4 rounded-xl border text-left cursor-pointer ${
                        selected
                          ? 'border-rose-400 bg-rose-950/30'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-rose-300">
                          {boss.title}
                        </span>
                        {defeated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            CLEARED
                          </span>
                        )}
                      </div>
                      <div className="text-base font-black text-white mt-1">{boss.displayName}</div>
                      <div className="text-[11px] font-bold mt-0.5" style={{ color: bossArena.primaryColor }}>
                        Home: {bossArena.displayName}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">{boss.description}</p>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const b = getOpponentDefinition(selectedBossId);
                  onStartBossBattle(b.id, b.preferredArenaId ?? save.selectedArenaId);
                }}
                className="sl-btn-3d sl-btn-3d-crimson sl-chamfer w-full min-h-[46px] py-3 px-6 font-display font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                CHALLENGE BOSS RAID
              </button>
            </div>
          )}

          {tab === 'team' && (
            <div className="p-5 rounded-xl border border-purple-500/40 bg-purple-950/20 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-purple-300 font-bold">
                  3-Top Squad Tag Battle
                </div>
                <h3 className="text-xl font-black text-white mt-0.5">Mid-Clash Roster Tag Switching</h3>
              </div>
              <p className="text-xs text-slate-300">
                Deploy your 3-Top squad ({save.teamTopInstanceIds.map((id) => {
                  const t = save.ownedTops.find((o) => o.instanceId === id);
                  return t ? getTopDefinition(t.definitionId).displayName : 'Unit';
                }).join(' · ')}). Press <strong>[{save.settings.keyBindings.teamSwitch.toUpperCase()}]</strong> or click a teammate during combat to tag in for 20 Energy!
              </p>
              <button
                type="button"
                onClick={() => onStartTeamBattle(OPPONENTS[3].id, save.selectedArenaId)}
                className="sl-btn-3d sl-btn-3d-violet sl-chamfer w-full min-h-[46px] py-3 px-6 font-display font-bold text-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <Layers className="w-4 h-4" />
                LAUNCH 3-TOP TEAM BATTLE
              </button>
            </div>
          )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
