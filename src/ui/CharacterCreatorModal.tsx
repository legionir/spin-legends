import React, { useState } from 'react';
import { X, Check, UserPlus, Sparkles, Plus, Minus } from 'lucide-react';
import {
  ACCENT_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
} from '../domain/catalog';
import {
  CHARACTER_BASE_STAT,
  CHARACTER_BONUS_POINTS,
  CHARACTER_MAX_STAT,
  CHARACTER_TOTAL_BUDGET,
  validateCharacterProfile,
} from '../domain/rules';
import { CharacterProfile, CharacterStats } from '../domain/types';
import { CommanderAvatar } from './CommanderAvatar';

interface CharacterCreatorModalProps {
  initialProfile: CharacterProfile;
  onClose: () => void;
  onSave: (profile: CharacterProfile) => void;
}

const STAT_META: {
  key: keyof CharacterStats;
  label: string;
  bonusText: string;
  color: string;
}[] = [
  { key: 'strength', label: 'Strength', bonusText: '+2 Attack per pt', color: '#f43f5e' },
  { key: 'agility', label: 'Agility', bonusText: '+2 Speed · +1 Control', color: '#38bdf8' },
  { key: 'focus', label: 'Focus', bonusText: '+2 Energy · +1 Stability', color: '#34d399' },
  { key: 'luck', label: 'Luck', bonusText: '+2 Critical per pt', color: '#facc15' },
];

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({
  initialProfile,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialProfile.name);
  const [title, setTitle] = useState(initialProfile.title);
  const [hairStyle, setHairStyle] = useState(initialProfile.appearance.hairStyle);
  const [hairColor, setHairColor] = useState(initialProfile.appearance.hairColor);
  const [outfitColor, setOutfitColor] = useState(initialProfile.appearance.outfitColor);
  const [accentColor, setAccentColor] = useState(initialProfile.appearance.accentColor);
  const [stats, setStats] = useState<CharacterStats>({ ...initialProfile.stats });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const usedTotal = stats.strength + stats.agility + stats.focus + stats.luck;
  const remainingPoints = CHARACTER_TOTAL_BUDGET - usedTotal;

  const adjustStat = (key: keyof CharacterStats, delta: number) => {
    setStats((prev) => {
      const nextVal = prev[key] + delta;
      if (nextVal < CHARACTER_BASE_STAT || nextVal > CHARACTER_MAX_STAT) return prev;
      if (delta > 0 && remainingPoints <= 0) return prev;
      return { ...prev, [key]: nextVal };
    });
    setErrorMsg(null);
  };

  const handleSave = () => {
    const candidate: CharacterProfile = {
      created: true,
      name: name.trim(),
      title: title.trim() || 'Arena Challenger',
      appearance: {
        hairStyle,
        hairColor,
        outfitColor,
        accentColor,
      },
      stats,
      createdAtMs: initialProfile.created ? initialProfile.createdAtMs : Date.now(),
    };

    const check = validateCharacterProfile(candidate);
    if (!check.valid) {
      setErrorMsg(check.error ?? 'Invalid character configuration.');
      return;
    }
    onSave(candidate);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.70)' }}
    >
      <div
        role="dialog"
        aria-label="Character Forge"
        className="sl-panel-modal w-full max-w-3xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="sl-ls-modal-header px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2 uppercase tracking-wider">
              <UserPlus className="w-5 h-5 text-sky-400 shrink-0" />
              <span className="sl-title-metal">Commander Character Forge</span>
            </h2>
            <p className="text-xs text-slate-400">
              Customize your Blader identity, appearance, and initial combat attributes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close character creator"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sl-hairline" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto sl-scroll p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Preview + Identity */}
          <div className="md:col-span-5 space-y-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex flex-col items-center text-center">
              <CommanderAvatar
                appearance={{ hairStyle, hairColor, outfitColor, accentColor }}
                size={112}
                className="mb-3"
              />
              <div className="text-base font-black text-white">{name.trim() || 'Unnamed Blader'}</div>
              <div className="text-xs font-semibold text-sky-300">{title.trim() || 'Arena Challenger'}</div>
              <div className="mt-3 w-full grid grid-cols-2 gap-1.5 text-[11px]">
                {STAT_META.map((s) => (
                  <div
                    key={s.key}
                    className="px-2 py-1 rounded bg-slate-950/80 border border-slate-800 flex justify-between"
                  >
                    <span className="text-slate-400">{s.label.slice(0, 3).toUpperCase()}</span>
                    <span className="font-mono-tech font-extrabold tabular-nums" style={{ color: s.color }}>
                      {stats[s.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="char-name-input" className="block text-xs font-bold text-slate-300 mb-1">
                  Commander Name
                </label>
                <input
                  id="char-name-input"
                  type="text"
                  maxLength={24}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Enter your name..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label htmlFor="char-title-input" className="block text-xs font-bold text-slate-300 mb-1">
                  Arena Callsign / Title
                </label>
                <input
                  id="char-title-input"
                  type="text"
                  maxLength={28}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Neon Striker"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Right Appearance + Initial Stats */}
          <div className="md:col-span-7 space-y-4">
            {/* Hair Style */}
            <div>
              <div className="text-xs font-bold text-slate-300 mb-1.5">Hair / Headgear Style</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {HAIR_STYLES.map((hs) => (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={() => setHairStyle(hs.id)}
                    className={`sl-btn-3d sl-btn-3d-sm py-2 px-2.5 text-xs font-bold cursor-pointer ${
                      hairStyle === hs.id ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-slate-300'
                    }`}
                  >
                    {hs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Swatches */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">Hair Color</div>
                <div className="flex flex-wrap gap-1.5">
                  {HAIR_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      aria-label={`Hair color ${c.label}`}
                      onClick={() => setHairColor(c.hex)}
                      className={`w-7 h-7 rounded-md border-2 cursor-pointer ${
                        hairColor === c.hex ? 'border-white scale-110' : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">Outfit Color</div>
                <div className="flex flex-wrap gap-1.5">
                  {OUTFIT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      aria-label={`Outfit color ${c.label}`}
                      onClick={() => setOutfitColor(c.hex)}
                      className={`w-7 h-7 rounded-md border-2 cursor-pointer ${
                        outfitColor === c.hex ? 'border-white scale-110' : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-300 mb-1.5">Accent Trim</div>
                <div className="flex flex-wrap gap-1.5">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      aria-label={`Accent color ${c.label}`}
                      onClick={() => setAccentColor(c.hex)}
                      className={`w-7 h-7 rounded-md border-2 cursor-pointer ${
                        accentColor === c.hex ? 'border-white scale-110' : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Attribute Point Allocator */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Initial Attributes
                </div>
                <div className="font-mono-tech text-xs font-bold text-amber-300 tabular-nums">
                  {remainingPoints} / {CHARACTER_BONUS_POINTS} Bonus Pts Left
                </div>
              </div>

              <div className="space-y-2">
                {STAT_META.map((s) => {
                  const val = stats[s.key];
                  return (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white">{s.label}</div>
                        <div className="text-[11px] text-slate-400">{s.bonusText}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Decrease ${s.label}`}
                          disabled={val <= CHARACTER_BASE_STAT}
                          onClick={() => adjustStat(s.key, -1)}
                          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate w-8 h-8 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className="font-mono-tech w-7 text-center text-sm font-black tabular-nums"
                          style={{ color: s.color }}
                        >
                          {val}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${s.label}`}
                          disabled={val >= CHARACTER_MAX_STAT || remainingPoints <= 0}
                          onClick={() => adjustStat(s.key, 1)}
                          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate w-8 h-8 disabled:opacity-35 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg border border-rose-500/60 bg-rose-950/40 text-xs font-bold text-rose-300">
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800/90 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="sl-btn-3d sl-btn-3d-cyan sl-chamfer px-5 py-2.5 text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            Save Commander
          </button>
        </div>
      </div>
    </div>
  );
};
