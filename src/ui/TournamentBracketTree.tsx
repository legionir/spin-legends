import React from 'react';
import { CheckCircle2, Crown, Lock, MapPin, ShieldAlert, Swords, Trophy } from 'lucide-react';
import { ARENAS, ELEMENTS, getOpponentDefinition, getTopDefinition } from '../domain/catalog';
import { ArenaId, TournamentState } from '../domain/types';

interface TournamentBracketTreeProps {
  tournament: TournamentState;
  playerName: string;
  playerTopName: string;
  onStartCurrentMatch: () => void;
}

interface BracketColumn {
  id: string;
  title: string;
  stageIndices: number[];
}

const CARD_W = 166;
const CARD_H = 104;
const ROW_GAP = 18;
const COL_GAP = 28;
const TROPHY_W = 148;
const TROPHY_H = 132;
const PAD_X = 8;
const PAD_Y = 8;

function buildColumns(bracketSize: 4 | 8 | 16): BracketColumn[] {
  if (bracketSize === 4) {
    return [
      { id: 'c0', title: 'Opening', stageIndices: [0] },
      { id: 'c1', title: 'Semifinal', stageIndices: [1] },
      { id: 'c2', title: 'Final', stageIndices: [2] },
      { id: 'c3', title: 'Grand Boss', stageIndices: [3] },
    ];
  }
  if (bracketSize === 8) {
    return [
      { id: 'c0', title: 'Qualifiers', stageIndices: [0, 1] },
      { id: 'c1', title: 'Quarterfinals', stageIndices: [2, 3] },
      { id: 'c2', title: 'Semifinals', stageIndices: [4, 5] },
      { id: 'c3', title: 'Championship', stageIndices: [6, 7] },
    ];
  }
  return [
    { id: 'c0', title: 'Qualifiers', stageIndices: [0, 1, 2, 3] },
    { id: 'c1', title: 'Round of 12', stageIndices: [4, 5, 6, 7] },
    { id: 'c2', title: 'Quarterfinals', stageIndices: [8, 9, 10, 11] },
    { id: 'c3', title: 'Semifinals', stageIndices: [12, 13] },
    { id: 'c4', title: 'Championship', stageIndices: [14, 15] },
  ];
}

function getStageTitle(idx: number, bracketSize: number): string {
  if (idx === bracketSize - 1) return 'Grand Boss Final';
  if (idx === bracketSize - 2) return 'Final';
  if (idx >= bracketSize - 4) return 'Semifinal';
  return `Round ${idx + 1}`;
}

export const TournamentBracketTree: React.FC<TournamentBracketTreeProps> = ({
  tournament,
  playerName,
  playerTopName,
  onStartCurrentMatch,
}) => {
  const bracketSize = tournament.bracketSize || 4;
  const completedRounds = tournament.completedRounds;
  const currentRound = tournament.currentRound;
  const isBracketComplete = completedRounds >= bracketSize;
  const columns = buildColumns(bracketSize);

  const maxRows = Math.max(...columns.map((c) => c.stageIndices.length));
  const innerHeight = Math.max(TROPHY_H + 16, maxRows * CARD_H + (maxRows - 1) * ROW_GAP);
  const totalHeight = innerHeight + PAD_Y * 2;
  const totalWidth =
    PAD_X * 2 + columns.length * (CARD_W + COL_GAP) + TROPHY_W;

  const getColX = (colIdx: number) => PAD_X + colIdx * (CARD_W + COL_GAP);
  const getCardTop = (rowIdx: number, rowCount: number) => {
    const colH = rowCount * CARD_H + (rowCount - 1) * ROW_GAP;
    return PAD_Y + (innerHeight - colH) / 2 + rowIdx * (CARD_H + ROW_GAP);
  };

  // Build exact coordinate lookup for each stage so SVG winner-path lines align pixel-perfectly
  const stageCoords = new Map<
    number,
    { x: number; y: number; cx: number; cy: number; right: number; bottom: number }
  >();
  columns.forEach((col, colIdx) => {
    const x = getColX(colIdx);
    col.stageIndices.forEach((stageIdx, rowIdx) => {
      const y = getCardTop(rowIdx, col.stageIndices.length);
      stageCoords.set(stageIdx, {
        x,
        y,
        cx: x + CARD_W / 2,
        cy: y + CARD_H / 2,
        right: x + CARD_W,
        bottom: y + CARD_H,
      });
    });
  });

  const trophyX = PAD_X + columns.length * (CARD_W + COL_GAP);
  const trophyY = PAD_Y + (innerHeight - TROPHY_H) / 2;
  const trophyCy = trophyY + TROPHY_H / 2;

  const progressPct = Math.round((Math.min(completedRounds, bracketSize) / bracketSize) * 100);
  const nextOppId = tournament.bracketOpponentIds[currentRound];
  const nextOpp = nextOppId ? getOpponentDefinition(nextOppId) : null;
  const nextArenaId: ArenaId = tournament.arenaIds[currentRound] ?? 'standard';
  const nextArena = ARENAS[nextArenaId];

  return (
    <div className="space-y-3">
      {/* Progress & Next Matchup Banner */}
      <div className="p-3 rounded-xl border border-slate-800/90 bg-slate-950/70 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold uppercase tracking-wider text-amber-300">
              {isBracketComplete
                ? 'Bracket Complete · Champion Crowned'
                : `Stage ${currentRound + 1} of ${bracketSize} · ${getStageTitle(currentRound, bracketSize)}`}
            </span>
            {!isBracketComplete && nextOpp && (
              <span className="text-slate-400">
                vs <strong className="text-white">{nextOpp.displayName}</strong> @{' '}
                <span style={{ color: nextArena.primaryColor }} className="font-semibold">
                  {nextArena.displayName}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Cleared ({completedRounds}/{bracketSize})
            </span>
            <span className="flex items-center gap-1 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Next Match
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              Upcoming
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Scrollable Tree Viewport */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 overflow-x-auto sl-scroll">
        {/* Column Headers */}
        <div
          className="relative mb-2 flex items-center"
          style={{ width: `${totalWidth}px`, height: '20px' }}
        >
          {columns.map((col, colIdx) => (
            <div
              key={col.id}
              className="absolute text-[10px] font-extrabold uppercase tracking-widest text-slate-400 text-center"
              style={{ left: `${getColX(colIdx)}px`, width: `${CARD_W}px` }}
            >
              {col.title}
            </div>
          ))}
          <div
            className="absolute text-[10px] font-extrabold uppercase tracking-widest text-amber-300 text-center"
            style={{ left: `${trophyX}px`, width: `${TROPHY_W}px` }}
          >
            Champion Path
          </div>
        </div>

        {/* Bracket Nodes + SVG Connector Layer */}
        <div
          className="relative"
          style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
        >
          <svg
            width={totalWidth}
            height={totalHeight}
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            {Array.from({ length: bracketSize }).map((_, idx) => {
              const from = stageCoords.get(idx);
              if (!from) return null;

              const cleared = idx < completedRounds;
              const isCurrentPath = idx === currentRound - 1 && !isBracketComplete;
              const stroke = cleared ? '#34d399' : isCurrentPath ? '#fbbf24' : '#334155';
              const strokeWidth = cleared || isCurrentPath ? 2.5 : 1.75;
              const dash = cleared ? undefined : '5 4';

              if (idx === bracketSize - 1) {
                const midX = (from.right + trophyX) / 2;
                const d = `M ${from.right} ${from.cy} H ${midX} V ${trophyCy} H ${trophyX}`;
                return (
                  <g key={`path-${idx}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dash}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx={trophyX}
                      cy={trophyCy}
                      r={3.5}
                      fill={isBracketComplete ? '#fbbf24' : '#475569'}
                    />
                  </g>
                );
              }

              const to = stageCoords.get(idx + 1);
              if (!to) return null;

              // Same column vertical progression vs cross-column orthogonal elbow
              const sameColumn = Math.abs(from.x - to.x) < 2;
              if (sameColumn) {
                const d = `M ${from.cx} ${from.bottom} V ${to.y}`;
                return (
                  <g key={`path-${idx}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dash}
                      strokeLinecap="round"
                    />
                    <polygon
                      points={`${to.cx - 4},${to.y - 5} ${to.cx + 4},${to.y - 5} ${to.cx},${to.y}`}
                      fill={stroke}
                    />
                  </g>
                );
              }

              const midX = (from.right + to.x) / 2;
              const d = `M ${from.right} ${from.cy} H ${midX} V ${to.cy} H ${to.x}`;
              return (
                <g key={`path-${idx}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx={to.x} cy={to.cy} r={3} fill={stroke} />
                </g>
              );
            })}
          </svg>

          {/* Matchup Stage Cards */}
          {columns.map((col, colIdx) => {
            const x = getColX(colIdx);
            return col.stageIndices.map((stageIdx, rowIdx) => {
              const y = getCardTop(rowIdx, col.stageIndices.length);
              const oppId = tournament.bracketOpponentIds[stageIdx];
              const opp = getOpponentDefinition(oppId);
              const top = getTopDefinition(opp.topId);
              const elem = ELEMENTS[top.element];
              const stageArenaId: ArenaId = tournament.arenaIds[stageIdx] ?? 'standard';
              const stageArena = ARENAS[stageArenaId];

              const cleared = stageIdx < completedRounds;
              const isCurrent = stageIdx === currentRound && !isBracketComplete;
              const isLocked = !cleared && !isCurrent;
              const playerSlotLabel =
                cleared || isCurrent ? playerName || 'You' : `Stage ${stageIdx} Winner`;

              return (
                <div
                  key={`stage-${stageIdx}`}
                  onClick={isCurrent ? onStartCurrentMatch : undefined}
                  role={isCurrent ? 'button' : undefined}
                  tabIndex={isCurrent ? 0 : undefined}
                  onKeyDown={
                    isCurrent
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onStartCurrentMatch();
                          }
                        }
                      : undefined
                  }
                  className={`absolute rounded-xl border p-2 flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_18px_rgba(251,191,36,0.22)] cursor-pointer hover:bg-amber-950/55'
                      : cleared
                        ? 'border-emerald-500/60 bg-emerald-950/25'
                        : 'border-slate-800 bg-slate-900/75 opacity-80'
                  }`}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${CARD_W}px`,
                    height: `${CARD_H}px`,
                  }}
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-300 truncate flex items-center gap-1">
                      {opp.isBoss && <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />}
                      {getStageTitle(stageIdx, bracketSize)}
                    </span>
                    {cleared ? (
                      <span className="text-[9px] font-black text-emerald-300 flex items-center gap-0.5 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> WIN
                      </span>
                    ) : isCurrent ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black shrink-0 flex items-center gap-0.5">
                        <Swords className="w-2.5 h-2.5" /> NEXT
                      </span>
                    ) : (
                      <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                    )}
                  </div>

                  {/* Bracket Competitors */}
                  <div className="space-y-1 my-0.5">
                    {/* Player / Advancing Winner Seed */}
                    <div
                      className={`px-1.5 py-0.5 rounded border text-[10px] flex items-center justify-between gap-1 ${
                        cleared
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 font-bold'
                          : isCurrent
                            ? 'border-sky-400/50 bg-sky-500/15 text-white font-bold'
                            : 'border-slate-800 bg-slate-950/60 text-slate-400'
                      }`}
                    >
                      <span className="truncate">{playerSlotLabel}</span>
                      <span className="text-[8px] uppercase text-sky-300/90 shrink-0 truncate max-w-[54px]">
                        {cleared || isCurrent ? playerTopName.split(' ')[0] : 'TBD'}
                      </span>
                    </div>

                    {/* Opponent Seed */}
                    <div
                      className={`px-1.5 py-0.5 rounded border text-[10px] flex items-center justify-between gap-1 ${
                        cleared
                          ? 'border-slate-800/80 bg-slate-950/40 text-slate-500 line-through'
                          : isCurrent
                            ? 'border-rose-400/45 bg-rose-950/35 text-white font-bold'
                            : 'border-slate-800 bg-slate-950/60 text-slate-300'
                      }`}
                    >
                      <span className="truncate">{opp.displayName}</span>
                      <span
                        className="text-[8px] font-bold shrink-0"
                        style={{ color: isLocked ? '#94a3b8' : elem.primaryColor }}
                      >
                        {opp.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Arena Footer */}
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: stageArena.primaryColor }} />
                      <span className="truncate">
                        {stageArena.displayName.replace(' Arena', '').replace(' Stadium', '')}
                      </span>
                    </span>
                    <span className="text-[8px] text-slate-500 shrink-0">#{stageIdx + 1}</span>
                  </div>
                </div>
              );
            });
          })}

          {/* Champion Crown Node */}
          <div
            className={`absolute rounded-xl border p-3 flex flex-col items-center justify-center text-center transition-all ${
              isBracketComplete
                ? 'border-amber-300 bg-gradient-to-b from-amber-500/25 to-amber-950/50 shadow-[0_0_24px_rgba(251,191,36,0.28)]'
                : 'border-slate-800 bg-slate-900/60'
            }`}
            style={{
              left: `${trophyX}px`,
              top: `${trophyY}px`,
              width: `${TROPHY_W}px`,
              height: `${TROPHY_H}px`,
            }}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border ${
                isBracketComplete
                  ? 'bg-amber-400/20 border-amber-300 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-500'
              }`}
            >
              {isBracketComplete ? (
                <Crown className="w-5 h-5" />
              ) : (
                <Trophy className="w-5 h-5" />
              )}
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
              {isBracketComplete ? 'Grand Champion' : `${bracketSize}-Top Crown`}
            </div>
            <div className="text-xs font-black text-white mt-0.5 truncate max-w-full">
              {isBracketComplete ? playerName || 'Commander' : 'Awaiting Victor'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Titles: <strong className="text-amber-200">{tournament.championshipsWon}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
