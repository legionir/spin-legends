import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, Lock, Sparkles, Search, Layers, Flame } from 'lucide-react';
import {
  ELEMENTS,
  EVOLUTION_PATHS,
  TOP_DEFINITIONS,
  getEvolutionPath,
  getTopDefinition,
} from '../domain/catalog';
import { canEvolveTop, getXpForNextLevel } from '../domain/rules';
import { ElementType, OwnedTopState, PlayerSaveData, Rarity } from '../domain/types';

interface CollectionModalProps {
  save: PlayerSaveData;
  activeTop: OwnedTopState;
  onClose: () => void;
  onSelectTop: (instanceId: string) => void;
  onUnlockTop: (definitionId: string) => void;
  onForgeMythicTop: (definitionId: string) => void;
  onToggleTeamMember: (instanceId: string) => void;
  onEvolveTop: (instanceId: string, pathId: string) => void;
}

export const CollectionModal: React.FC<CollectionModalProps> = ({
  save,
  activeTop,
  onClose,
  onSelectTop,
  onUnlockTop,
  onForgeMythicTop,
  onToggleTeamMember,
  onEvolveTop,
}) => {
  const [tab, setTab] = useState<'roster' | 'evolution' | 'stats'>('roster');
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'All'>('All');
  const [elementFilter, setElementFilter] = useState<ElementType | 'All'>('All');
  const [sortBy, setSortBy] = useState<'rarity' | 'level' | 'wins' | 'name'>('rarity');

  const activeDef = getTopDefinition(activeTop.definitionId);
  const nextXp = getXpForNextLevel(activeTop.level);
  const evolvedPath = activeTop.evolutionPathId ? getEvolutionPath(activeTop.evolutionPathId) : null;

  const filteredTopDefs = useMemo(() => {
    const rarityOrder: Record<Rarity, number> = {
      Common: 1,
      Uncommon: 2,
      Rare: 3,
      Epic: 4,
      Legendary: 5,
      Mythic: 6,
    };
    const q = search.trim().toLowerCase();
    return [...TOP_DEFINITIONS]
      .filter((d) => {
        if (rarityFilter !== 'All' && d.rarity !== rarityFilter) return false;
        if (elementFilter !== 'All' && d.element !== elementFilter) return false;
        if (q && !d.displayName.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ownA = save.ownedTops.find((t) => t.definitionId === a.id);
        const ownB = save.ownedTops.find((t) => t.definitionId === b.id);
        if (sortBy === 'wins') return (ownB?.wins ?? -1) - (ownA?.wins ?? -1);
        if (sortBy === 'level') return (ownB?.level ?? 0) - (ownA?.level ?? 0);
        if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
        return rarityOrder[b.rarity] - rarityOrder[a.rarity];
      });
  }, [elementFilter, rarityFilter, save.ownedTops, search, sortBy]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 sl-safe-inset backdrop-blur-[6px]"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.66)' }}
    >
      <div className="sl-panel-modal w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden">
        <div className="sl-ls-modal-header shrink-0 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="font-display sl-title-metal text-lg font-bold uppercase tracking-wider">
              Collection, Team & Evolution Lab
            </h2>
            <div className="text-xs text-slate-400 flex flex-wrap gap-3 font-mono-tech tabular-nums mt-0.5">
              <span className="text-amber-400 font-bold">{save.currencies.gold} Gold</span>
              <span className="text-purple-300 font-bold">{save.currencies.evolutionTokens} Evo</span>
              <span className="text-cyan-300 font-bold">{save.currencies.elementalEssence} Essence</span>
              <span className="text-emerald-300 font-bold">{save.currencies.energyCrystals} Crystals</span>
              <span className="text-pink-300 font-bold">{save.currencies.legendaryFragments} Fragments</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close collection"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[42px] min-w-[42px] shrink-0 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="sl-hairline shrink-0" />

        <div className="sl-ls-modal-tabs shrink-0 px-5 py-2.5 border-b border-slate-800/80 bg-slate-950/35 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTab('roster')}
              className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold cursor-pointer whitespace-nowrap ${
                tab === 'roster' ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span>Roster ({save.ownedTops.length}/{TOP_DEFINITIONS.length})</span>
              {tab === 'roster' && (
                <motion.span
                  layoutId="collection-tab-rail"
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('evolution')}
              className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold cursor-pointer whitespace-nowrap ${
                tab === 'evolution' ? 'sl-btn-3d-violet' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span>Evolution Lab</span>
              {tab === 'evolution' && (
                <motion.span
                  layoutId="collection-tab-rail"
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('stats')}
              className={`sl-btn-3d sl-btn-3d-sm shrink-0 min-h-[34px] px-3.5 py-1.5 text-xs font-display font-bold cursor-pointer whitespace-nowrap ${
                tab === 'stats' ? 'sl-btn-3d-emerald' : 'sl-btn-3d-slate text-slate-300'
              }`}
            >
              <span>Career Telemetry</span>
              {tab === 'stats' && (
                <motion.span
                  layoutId="collection-tab-rail"
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
                />
              )}
            </button>
          </div>
          <div className="text-[11px] text-emerald-300 font-bold font-mono-tech tabular-nums flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            Tag Team ({save.teamTopInstanceIds.length}/3)
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto sl-scroll p-5 space-y-4">
          {tab === 'roster' && (
            <>
              {/* Search, Rarity, Element, Sort Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tops..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                <select
                  aria-label="Filter by rarity"
                  value={rarityFilter}
                  onChange={(e) => setRarityFilter(e.target.value as Rarity | 'All')}
                  className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="All">All Rarities</option>
                  {(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as Rarity[]).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter by element"
                  value={elementFilter}
                  onChange={(e) => setElementFilter(e.target.value as ElementType | 'All')}
                  className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="All">All 8 Elements</option>
                  {(Object.keys(ELEMENTS) as ElementType[]).map((el) => (
                    <option key={el} value={el}>{el}</option>
                  ))}
                </select>
                <select
                  aria-label="Sort tops"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'rarity' | 'level' | 'wins' | 'name')}
                  className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="rarity">Sort: Rarity</option>
                  <option value="level">Sort: Level</option>
                  <option value="wins">Sort: Wins</option>
                  <option value="name">Sort: Name</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTopDefs.map((def) => {
                  const owned = save.ownedTops.find((t) => t.definitionId === def.id);
                  const isSelected = owned?.instanceId === activeTop.instanceId;
                  const inTeam = owned ? save.teamTopInstanceIds.includes(owned.instanceId) : false;
                  const elem = ELEMENTS[def.element];
                  const canBuy = !def.forgeCost && save.currencies.gold >= def.unlockCostGold;
                  const canForge =
                    Boolean(def.forgeCost) &&
                    save.currencies.legendaryFragments >= (def.forgeCost?.legendaryFragments ?? 99) &&
                    save.currencies.energyCrystals >= (def.forgeCost?.energyCrystals ?? 99);

                  return (
                    <div
                      key={def.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-sky-400 bg-sky-950/30'
                          : 'border-slate-800 bg-slate-900/70'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-extrabold text-white">{def.displayName}</span>
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded shrink-0"
                            style={{
                              color: elem.primaryColor,
                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              border: `1px solid ${elem.primaryColor}55`,
                            }}
                          >
                            {def.rarity} · {def.element}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{def.description}</p>
                        {owned && (
                          <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-300 tabular-nums">
                            <span>Lv.<strong>{owned.level}</strong></span>
                            <span>Record <strong>{owned.wins}W-{owned.losses}L</strong></span>
                            {owned.evolutionStage > 0 && (
                              <span className="text-amber-300 font-bold">APEX</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {owned ? (
                          <button
                            type="button"
                            onClick={() => onToggleTeamMember(owned.instanceId)}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                              inTeam
                                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-300'
                                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                            }`}
                          >
                            {inTeam ? 'In 3-Top Team' : '+ Tag Team'}
                          </button>
                        ) : <span />}

                        {isSelected ? (
                          <span className="px-3 py-1.5 rounded bg-sky-400/20 text-sky-300 text-xs font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Active Unit
                          </span>
                        ) : owned ? (
                          <button
                            type="button"
                            onClick={() => onSelectTop(owned.instanceId)}
                            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan px-4 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            Select Unit
                          </button>
                        ) : def.forgeCost ? (
                          <button
                            type="button"
                            disabled={!canForge}
                            onClick={() => onForgeMythicTop(def.id)}
                            className={`sl-btn-3d sl-btn-3d-sm px-3 py-1.5 text-xs font-bold flex items-center gap-1 ${
                              canForge
                                ? 'sl-btn-3d-violet cursor-pointer'
                                : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5" />
                            Forge ({def.forgeCost.legendaryFragments} Frag · {def.forgeCost.energyCrystals} Crys)
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canBuy}
                            onClick={() => onUnlockTop(def.id)}
                            className={`sl-btn-3d sl-btn-3d-sm px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                              canBuy
                                ? 'sl-btn-3d-amber cursor-pointer'
                                : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Unlock ({def.unlockCostGold} Gold)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'evolution' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                    Selected Top for Evolution
                  </div>
                  <div className="text-lg font-extrabold text-white">
                    {activeDef.displayName} · Lv.{activeTop.level}
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    XP {activeTop.experience} / {nextXp}
                  </div>
                </div>
                {evolvedPath && (
                  <div className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold">
                    Evolved: {evolvedPath.displayName}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {EVOLUTION_PATHS.map((path) => {
                  const check = canEvolveTop(activeTop, path.id, save.currencies);
                  const isCurrent = activeTop.evolutionPathId === path.id;

                  return (
                    <div
                      key={path.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        isCurrent ? 'border-amber-400 bg-amber-950/25' : 'border-slate-800 bg-slate-900/70'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-wider text-purple-300">
                          {path.focus} Branch
                        </div>
                        <div className="text-base font-bold text-white mt-0.5">{path.displayName}</div>
                        <p className="text-xs text-slate-400 mt-1">{path.description}</p>

                        <div className="mt-3 space-y-1 text-xs text-emerald-300 font-semibold">
                          {Object.entries(path.attributeBonuses).map(([k, v]) => (
                            <div key={k}>+{v} {k.toUpperCase()}</div>
                          ))}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-300 tabular-nums space-y-0.5">
                          <div>Required Top Lv.{path.requiredLevel}</div>
                          <div>Cost: {path.goldCost} Gold · {path.evolutionTokensCost} Evo · {path.essenceCost} Essence</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!check.eligible}
                        onClick={() => onEvolveTop(activeTop.instanceId, path.id)}
                        className={`sl-btn-3d sl-btn-3d-sm w-full py-2 px-3 text-xs font-display font-bold flex items-center justify-center gap-1.5 ${
                          check.eligible
                            ? 'sl-btn-3d-violet cursor-pointer'
                            : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isCurrent ? 'EVOLVED' : check.eligible ? 'EVOLVE NOW' : check.reason}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {save.ownedTops.map((top) => {
                const def = getTopDefinition(top.definitionId);
                const cs = top.careerStats;
                const winRate = cs.matches > 0 ? Math.round((cs.wins / cs.matches) * 100) : 0;
                return (
                  <div key={top.instanceId} className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-white">{def.displayName}</span>
                      <span className="text-xs font-bold text-sky-300 tabular-nums">{winRate}% Win Rate</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] tabular-nums">
                      <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                        <div className="text-slate-400">Matches</div>
                        <div className="text-white font-bold">{cs.matches}</div>
                      </div>
                      <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                        <div className="text-slate-400">Clashes</div>
                        <div className="text-amber-300 font-bold">{cs.totalClashes}</div>
                      </div>
                      <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                        <div className="text-slate-400">Peak Impulse</div>
                        <div className="text-rose-300 font-bold">{cs.peakImpulse.toFixed(1)}</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 tabular-nums pt-1">
                      <span>Burst: <strong className="text-white">{cs.burstFinishes}</strong></span>
                      <span>KO: <strong className="text-white">{cs.knockoutFinishes}</strong></span>
                      <span>RingOut: <strong className="text-white">{cs.ringOutFinishes}</strong></span>
                      <span>Spin: <strong className="text-white">{cs.spinFinishes}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
