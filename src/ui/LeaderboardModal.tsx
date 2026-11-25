import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Trophy,
  Sparkles,
  Lock,
  CheckCircle2,
  GitBranch,
  KeyRound,
  Award,
  History,
  ChevronDown,
  ChevronUp,
  Film,
  Zap,
} from 'lucide-react';
import {
  ARENAS,
  ENDINGS_CATALOG,
  SECRETS_CATALOG,
  STORY_DECISIONS,
} from '../domain/catalog';
import {
  buildSortedLeaderboard,
  getActiveMutatorLabels,
  getDecisionAlignmentTotals,
  resolveStoryEnding,
} from '../domain/rules';
import { PlayerSaveData } from '../domain/types';
import { CommanderAvatar } from './CommanderAvatar';
import { BattleAnalysisPanel } from './BattleAnalysisPanel';
import { MatchHighlightsPlayer } from './MatchHighlightsPlayer';

interface LeaderboardModalProps {
  save: PlayerSaveData;
  initialTab?: 'leaderboard' | 'secrets' | 'chronicle' | 'history';
  onClose: () => void;
  onUnlockCipherSecret: () => void;
  onMakeDecision: (decisionId: string, choiceId: string) => void;
  onTriggerEndingPreview: () => void;
}

const CIPHER_TARGET: [number, number, number] = [3, 7, 2];

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  save,
  initialTab = 'leaderboard',
  onClose,
  onUnlockCipherSecret,
  onMakeDecision,
  onTriggerEndingPreview,
}) => {
  const [tab, setTab] = useState<'leaderboard' | 'secrets' | 'chronicle' | 'history'>(initialTab);
  const [dials, setDials] = useState<[number, number, number]>([0, 0, 0]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  const ranked = buildSortedLeaderboard(save);
  const playerRank = ranked.findIndex((e) => e.isPlayer) + 1;
  const totalWins = save.ownedTops.reduce((sum, t) => sum + t.wins, 0);
  const alignment = getDecisionAlignmentTotals(save.decisionHistory);
  const projectedEnding = resolveStoryEnding(save);
  const cipherAlreadyFound = save.discoveredSecrets.includes('secret.stadium_cipher');
  const matchHistory = save.matchHistory ?? [];

  const cycleDial = (index: 0 | 1 | 2) => {
    if (cipherAlreadyFound) return;
    const next: [number, number, number] = [...dials] as [number, number, number];
    next[index] = (next[index] + 1) % 10;
    setDials(next);
    if (
      next[0] === CIPHER_TARGET[0] &&
      next[1] === CIPHER_TARGET[1] &&
      next[2] === CIPHER_TARGET[2]
    ) {
      onUnlockCipherSecret();
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 sl-safe-inset backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.68)' }}
    >
      <div
        role="dialog"
        aria-label="Scoreboard and Chronicle"
        className="sl-panel-modal w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="sl-ls-modal-header shrink-0 px-5 py-3.5 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display sl-title-metal text-lg font-bold uppercase tracking-wider">
              Scoreboard, Secrets & Campaign Chronicle
            </h2>
            <p className="text-xs text-slate-400 font-mono-tech tabular-nums">
              Current Score: <strong className="text-amber-300">{save.playerScore} PTS</strong> ·
              Rank #{playerRank} · Secrets {save.discoveredSecrets.length}/{SECRETS_CATALOG.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scoreboard"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[42px] min-w-[42px] shrink-0 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sl-hairline shrink-0" />

        {/* Tabs */}
        <div className="sl-ls-modal-tabs shrink-0 px-5 py-2.5 border-b border-slate-800/80 bg-slate-950/35 flex flex-nowrap items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('leaderboard')}
            className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'leaderboard' ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-slate-300'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 shrink-0" />
            <span>High Scores</span>
            {tab === 'leaderboard' && (
              <motion.span
                layoutId="leaderboard-tab-rail"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'history' ? 'sl-btn-3d-violet' : 'sl-btn-3d-slate text-slate-300'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>Match History & Replays ({matchHistory.length})</span>
            {tab === 'history' && (
              <motion.span
                layoutId="leaderboard-tab-rail"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('secrets')}
            className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'secrets' ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Secrets ({save.discoveredSecrets.length}/{SECRETS_CATALOG.length})</span>
            {tab === 'secrets' && (
              <motion.span
                layoutId="leaderboard-tab-rail"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('chronicle')}
            className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              tab === 'chronicle' ? 'sl-btn-3d-emerald' : 'sl-btn-3d-slate text-slate-300'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span>Decisions & Endings ({alignment.answeredCount}/{STORY_DECISIONS.length})</span>
            {tab === 'chronicle' && (
              <motion.span
                layoutId="leaderboard-tab-rail"
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
              />
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto sl-scroll p-5">
          {tab === 'leaderboard' && (
            <div className="space-y-2.5">
              {ranked.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 ${
                    entry.isPlayer
                      ? 'border-sky-400 bg-sky-950/35'
                      : 'border-slate-800 bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black tabular-nums shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                              ? 'bg-orange-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    {entry.appearance && (
                      <CommanderAvatar appearance={entry.appearance} size={36} />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-white flex items-center gap-2 truncate">
                        {entry.name}
                        {entry.isPlayer && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300 border border-sky-400/40">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {entry.title} · {entry.wins}W · {entry.secretsFound} Secrets
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-amber-300 tabular-nums">
                      {entry.score} <span className="text-[11px] font-semibold">PTS</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      {entry.endingBadge}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {matchHistory.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/40">
                  <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <div className="text-sm font-bold text-slate-300">No match records yet</div>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Complete matches in Skirmish, Tournaments, Survival, Shadow Arena, or Online PvP to capture full damage breakdowns, peak RPM telemetry, and final-blow replay clips!
                  </p>
                </div>
              ) : (
                matchHistory.map((item) => {
                  const isExpanded = expandedHistoryId === item.battleId;
                  const isPlayingClip = playingClipId === item.battleId;
                  const arenaDef = ARENAS[item.arenaId];
                  const activeMutators = item.mutators ? getActiveMutatorLabels(item.mutators) : [];
                  const peakRpm = item.analysis
                    ? Math.max(item.analysis.peakPlayerRpm, item.analysis.peakOpponentRpm)
                    : 0;

                  return (
                    <div
                      key={item.battleId}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-3 transition-colors hover:border-slate-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
                              item.won
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {item.won ? 'VICTORY' : 'DEFEAT'}
                          </span>
                          <span className="text-xs font-bold text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                            {item.mode}
                          </span>
                          <span className="text-sm font-extrabold text-white truncate">
                            vs {item.opponentName}
                          </span>
                          {item.perfectLaunch && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 rounded">
                              <Zap className="w-3 h-3 text-amber-400" /> Perfect Launch
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs shrink-0">
                          <span className="text-slate-400 font-medium">
                            {new Date(item.timestampMs).toLocaleDateString()} ·{' '}
                            {Math.round(item.durationSec)}s
                          </span>
                          <span className="font-black text-amber-300 tabular-nums">
                            {typeof item.scoreEarned === 'number'
                              ? `+${item.scoreEarned} PTS`
                              : `${item.maxImpactImpulse.toFixed(1)} IMP`}
                          </span>
                        </div>
                      </div>

                      {/* Arena & Details row */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 border-t border-slate-800/80 pt-2">
                        <div className="flex items-center gap-3">
                          <span>
                            Arena:{' '}
                            <strong style={{ color: arenaDef?.primaryColor ?? '#38bdf8' }}>
                              {arenaDef?.displayName ?? item.arenaId}
                            </strong>
                          </span>
                          <span>
                            Finish: <strong className="text-slate-200">{item.finishReason}</strong>
                          </span>
                          <span>
                            Clashes: <strong className="text-slate-200">{item.collisionCount}</strong>
                          </span>
                          {item.analysis && (
                            <span>
                              Peak RPM: <strong className="text-sky-300">{Math.round(peakRpm)}</strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.highlights && (
                            <button
                              type="button"
                              onClick={() => setPlayingClipId(isPlayingClip ? null : item.battleId)}
                              className={`sl-btn-3d sl-btn-3d-sm px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                isPlayingClip ? 'sl-btn-3d-crimson' : 'sl-btn-3d-amber'
                              }`}
                            >
                              <Film className="w-3 h-3" />
                              {isPlayingClip ? 'Hide Replay' : 'Watch Replay'}
                            </button>
                          )}
                          {item.analysis && (
                            <button
                              type="button"
                              onClick={() => setExpandedHistoryId(isExpanded ? null : item.battleId)}
                              className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3" /> Hide Analysis
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" /> Battle Analysis
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Active Mutators if any */}
                      {activeMutators.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {activeMutators.map((lbl) => (
                            <span
                              key={lbl}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400"
                            >
                              {lbl}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Replay Player if opened */}
                      {isPlayingClip && item.highlights && (
                        <div className="pt-2">
                          <MatchHighlightsPlayer clip={item.highlights} />
                        </div>
                      )}

                      {/* Telemetry Analysis Panel if expanded */}
                      {isExpanded && item.analysis && (
                        <div className="pt-2">
                          <BattleAnalysisPanel
                            analysis={item.analysis}
                            opponentLabel={item.opponentName}
                            perfectLaunch={item.perfectLaunch}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'secrets' && (
            <div className="space-y-4">
              {/* Interactive Stadium Cipher Secret */}
              <div className="p-4 rounded-xl border border-purple-500/40 bg-purple-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-purple-300 font-extrabold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Hidden Stadium Harmonic Lock (+500 PTS)
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {cipherAlreadyFound
                      ? 'Harmonic Frequency [3 · 7 · 2] decoded! Architect Vault unlocked.'
                      : 'Align the 3 Stadium Core harmonic frequencies to [ 3 · 7 · 2 ] to uncover the Architect Secret.'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {([0, 1, 2] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={cipherAlreadyFound}
                      onClick={() => cycleDial(i)}
                      aria-label={`Cipher dial ${i + 1}`}
                      className={`sl-btn-3d sl-btn-3d-sm w-11 h-11 font-display text-lg font-bold tabular-nums cursor-pointer ${
                        cipherAlreadyFound ? 'sl-btn-3d-emerald' : 'sl-btn-3d-violet'
                      }`}
                    >
                      {cipherAlreadyFound ? CIPHER_TARGET[i] : dials[i]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5 Discoverable Secrets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SECRETS_CATALOG.map((sec) => {
                  const found = save.discoveredSecrets.includes(sec.id);
                  return (
                    <div
                      key={sec.id}
                      className={`p-3.5 rounded-xl border ${
                        found
                          ? 'border-emerald-500/50 bg-emerald-950/20'
                          : 'border-slate-800 bg-slate-900/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-white flex items-center gap-1.5">
                          {found ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-500" />
                          )}
                          {sec.title}
                        </span>
                        <span className="text-xs font-black text-amber-300 tabular-nums">
                          +{sec.points} PTS
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5">
                        {found ? sec.lore : sec.hint}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Recent Score Log */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Recent Score Events
                </div>
                {save.scoreLog.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    0 points so far. Enter the Arena, upgrade parts, or uncover secrets to score points!
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {save.scoreLog.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-slate-200">{item.label}</span>
                        <span className="font-bold text-amber-300 tabular-nums">
                          +{item.points} PTS
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'chronicle' && (
            <div className="space-y-4">
              {/* Alignment Summary */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="text-emerald-300">Honor (Good): {alignment.good}</span>
                  <span className="text-rose-400">Ambition (Bad): {alignment.bad}</span>
                  <span className="text-sky-300">Prudence (Neutral): {alignment.neutral}</span>
                </div>
                <div className="text-xs text-slate-300">
                  Projected Path:{' '}
                  <strong style={{ color: projectedEnding.accentHex }}>
                    {projectedEnding.badgeLabel}
                  </strong>
                </div>
              </div>

              {/* 3 Key Decision Nodes */}
              <div className="space-y-3">
                {STORY_DECISIONS.map((node) => {
                  const unlocked = totalWins >= node.stageNumber || Boolean(save.decisionHistory[node.id]);
                  const chosenId = save.decisionHistory[node.id];

                  return (
                    <div
                      key={node.id}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-extrabold text-white">
                          Milestone {node.stageNumber}: {node.title}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          {chosenId ? 'Resolved' : unlocked ? 'Decision Ready' : node.unlockHint}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{node.prompt}</p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {node.choices.map((ch) => {
                          const picked = chosenId === ch.id;
                          return (
                            <button
                              key={ch.id}
                              type="button"
                              disabled={!unlocked || Boolean(chosenId)}
                              onClick={() => onMakeDecision(node.id, ch.id)}
                              className={`p-2.5 rounded-lg border text-left transition-colors ${
                                picked
                                  ? 'border-sky-400 bg-sky-950/40'
                                  : unlocked && !chosenId
                                    ? 'border-slate-700 bg-slate-950/70 hover:border-amber-400 cursor-pointer'
                                    : 'border-slate-800 bg-slate-950/40 opacity-50 cursor-not-allowed'
                              }`}
                            >
                              <div className="text-xs font-extrabold text-white">{ch.label}</div>
                              <div className="text-[11px] text-amber-300 font-semibold mt-1">
                                {ch.rewardSummary}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Endings Gallery */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Story Endings ({save.unlockedEndingIds.length}/{ENDINGS_CATALOG.length} Unlocked)
                  </div>
                  {alignment.answeredCount >= STORY_DECISIONS.length && (
                    <button
                      type="button"
                      onClick={onTriggerEndingPreview}
                      className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-amber px-3.5 py-1.5 text-xs font-display font-bold cursor-pointer"
                    >
                      View Ending Ceremony
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ENDINGS_CATALOG.map((end) => {
                    const unlocked = save.unlockedEndingIds.includes(end.id);
                    return (
                      <div
                        key={end.id}
                        className={`p-3 rounded-xl border ${
                          unlocked
                            ? 'border-slate-600 bg-slate-900/90'
                            : 'border-slate-800/80 bg-slate-950/60 opacity-60'
                        }`}
                      >
                        <div
                          className="text-[10px] font-black tracking-widest uppercase"
                          style={{ color: end.accentHex }}
                        >
                          {end.badgeLabel}
                        </div>
                        <div className="text-sm font-extrabold text-white mt-0.5">
                          {unlocked ? end.title : '??? (Locked Ending)'}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {unlocked ? end.epilogue : end.subtitle}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
