import React from 'react';
import { GitBranch, Award, RotateCcw, ArrowRight } from 'lucide-react';
import {
  CharacterProfile,
  EndingDefinition,
  StoryDecisionNode,
} from '../domain/types';
import { CommanderAvatar } from './CommanderAvatar';

export const StoryDecisionModal: React.FC<{
  decision: StoryDecisionNode;
  onChoose: (choiceId: string) => void;
}> = ({ decision, onChoose }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 sl-safe-inset backdrop-blur-[8px]"
    style={{ backgroundColor: 'rgba(2, 6, 23, 0.74)' }}
  >
    <div
      role="dialog"
      aria-label="Key Decision"
      className="sl-panel-modal w-full max-w-2xl max-h-[90vh] rounded-2xl border-amber-400/50 flex flex-col overflow-hidden"
    >
      <div className="sl-ls-modal-header shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 space-y-1">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-amber-300">
          <GitBranch className="w-4 h-4 shrink-0" />
          Key Decision · Milestone {decision.stageNumber}
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-wide">
          {decision.title}
        </h2>
      </div>
      <div className="sl-hairline shrink-0" />

      <div className="flex-1 min-h-0 overflow-y-auto sl-scroll px-4 sm:px-6 py-3.5 sm:py-5 space-y-3">
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{decision.prompt}</p>

        <div className="space-y-2.5 pt-1">
          {decision.choices.map((ch) => {
            const badgeColor =
              ch.alignment === 'good'
                ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15'
                : ch.alignment === 'bad'
                  ? 'text-rose-300 border-rose-500/40 bg-rose-500/15'
                  : 'text-sky-300 border-sky-500/40 bg-sky-500/15';

            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onChoose(ch.id)}
                className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate w-full p-3 sm:p-3.5 text-left cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-white">{ch.label}</span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}
                  >
                    {ch.alignment === 'good'
                      ? 'Honorable'
                      : ch.alignment === 'bad'
                        ? 'Ruthless'
                        : 'Pragmatic'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{ch.description}</p>
                <div className="text-xs font-bold text-amber-300 mt-1.5">{ch.rewardSummary}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

export const EndingCeremonyModal: React.FC<{
  ending: EndingDefinition;
  character: CharacterProfile;
  finalScore: number;
  secretsFound: number;
  onContinueFreePlay: () => void;
  onStartNewLegacyRun: () => void;
}> = ({
  ending,
  character,
  finalScore,
  secretsFound,
  onContinueFreePlay,
  onStartNewLegacyRun,
}) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 sl-safe-inset backdrop-blur-[8px]"
    style={{ backgroundColor: 'rgba(2, 6, 23, 0.80)' }}
  >
    <div
      role="dialog"
      aria-label="Campaign Ending"
      className="sl-panel-modal w-full max-w-lg max-h-[90vh] overflow-y-auto sl-scroll p-4 sm:p-6 rounded-2xl space-y-4 sm:space-y-5 text-center"
      style={{
        borderColor: ending.accentHex,
      }}
    >
      <div className="flex flex-col items-center">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black tracking-widest uppercase mb-3"
          style={{
            backgroundColor: `${ending.accentHex}24`,
            color: ending.accentHex,
            border: `1px solid ${ending.accentHex}66`,
          }}
        >
          <Award className="w-3.5 h-3.5" />
          {ending.badgeLabel}
        </div>

        <CommanderAvatar appearance={character.appearance} size={84} className="mb-3" />

        <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-wide">
          {ending.title}
        </h2>
        <div className="text-xs font-bold mt-0.5" style={{ color: ending.accentHex }}>
          {ending.subtitle}
        </div>
        <div className="sl-hairline w-full mt-3" />
      </div>

      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-900/70 p-3.5 sm:p-4 rounded-xl border border-slate-800">
        {ending.epilogue}
      </p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/70">
          <div className="text-[10px] uppercase text-slate-400 font-bold">Commander</div>
          <div className="text-xs font-extrabold text-white truncate">{character.name}</div>
        </div>
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/70">
          <div className="text-[10px] uppercase text-slate-400 font-bold">Final Score</div>
          <div className="font-mono-tech text-sm font-black text-amber-300 tabular-nums">{finalScore}</div>
        </div>
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/70">
          <div className="text-[10px] uppercase text-slate-400 font-bold">Secrets</div>
          <div className="font-mono-tech text-sm font-black text-sky-300 tabular-nums">{secretsFound}/5</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={onContinueFreePlay}
          className="sl-btn-3d sl-btn-3d-cyan sl-chamfer flex-1 py-2.5 px-4 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <ArrowRight className="w-4 h-4" />
          Continue Arena Career
        </button>
        <button
          type="button"
          onClick={onStartNewLegacyRun}
          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate flex-1 py-2.5 px-4 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" />
          Archive Score & New Run
        </button>
      </div>
    </div>
  </div>
);
