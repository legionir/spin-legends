import React from 'react';
import { X, CheckCircle2, Gift, Target } from 'lucide-react';
import { MISSIONS_CATALOG } from '../domain/catalog';
import { PlayerSaveData } from '../domain/types';

interface MissionsModalProps {
  save: PlayerSaveData;
  onClose: () => void;
  onClaimMission: (missionId: string) => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  save,
  onClose,
  onClaimMission,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 sl-safe-inset backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.68)' }}
    >
      <div
        role="dialog"
        aria-label="Missions and Achievements"
        className="sl-panel-modal w-full max-w-2xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden"
      >
        <div className="sl-ls-modal-header px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2 uppercase tracking-wider">
              <Target className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="sl-title-metal">Missions & Achievements</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono-tech">
              Daily Reset ({save.dailyMissionResetKey}) · Earn Legendary Fragments & Energy Crystals
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close missions"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sl-hairline" />

        <div className="flex-1 overflow-y-auto sl-scroll p-5 space-y-3">
          {MISSIONS_CATALOG.map((mission) => {
            const entry = save.missionProgress[mission.id] ?? { progress: 0, claimed: false };
            const progress = Math.min(mission.target, entry.progress);
            const complete = progress >= mission.target;
            const pct = Math.round((progress / Math.max(1, mission.target)) * 100);

            return (
              <div
                key={mission.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  entry.claimed
                    ? 'border-slate-800 bg-slate-900/40 opacity-75'
                    : complete
                      ? 'border-amber-400/70 bg-amber-950/20'
                      : 'border-slate-800 bg-slate-900/70'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono-tech font-bold">
                      {mission.cadence}
                    </span>
                    <span className="text-sm font-extrabold text-white">{mission.title}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{mission.description}</p>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="sl-bar-track flex-1 h-2 rounded-full overflow-hidden">
                      <div
                        className="sl-bar-fill h-full bg-amber-400 transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-200 font-mono-tech tabular-nums">
                      {progress} / {mission.target}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold tabular-nums">
                    {mission.rewards.gold && <span className="text-amber-400">+{mission.rewards.gold} Gold</span>}
                    {mission.rewards.energyCrystals && (
                      <span className="text-emerald-300">+{mission.rewards.energyCrystals} Crystals</span>
                    )}
                    {mission.rewards.legendaryFragments && (
                      <span className="text-purple-300">+{mission.rewards.legendaryFragments} Fragments</span>
                    )}
                    {mission.rewards.elementalEssence && (
                      <span className="text-cyan-300">+{mission.rewards.elementalEssence} Essence</span>
                    )}
                    {mission.rewards.evolutionTokens && (
                      <span className="text-pink-300">+{mission.rewards.evolutionTokens} Evo</span>
                    )}
                    {mission.rewards.score && <span className="text-sky-300">+{mission.rewards.score} PTS</span>}
                  </div>
                </div>

                {entry.claimed ? (
                  <span className="px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!complete}
                    onClick={() => onClaimMission(mission.id)}
                    className={`sl-btn-3d sl-btn-3d-sm px-4 py-2 text-xs font-display font-bold flex items-center gap-1.5 shrink-0 ${
                      complete
                        ? 'sl-btn-3d-amber cursor-pointer'
                        : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    {complete ? 'Claim Reward' : 'In Progress'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
