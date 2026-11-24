import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  ArrowLeft,
  ArrowUpCircle,
  Check,
  Lock,
  Save,
  RotateCcw,
  GitCompare,
  Palette,
  Flame,
  Zap,
  Sparkles,
  Play,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ABILITIES,
  COMPONENT_CATEGORIES,
  COMPONENTS,
  ELEMENTS,
  VICTORY_EMOTES,
  getAbilityDefinition,
  getComponentDefinition,
  getTopDefinition,
} from '../domain/catalog';
import { COSMETIC_PALETTE_SWATCHES, COSMETIC_PATTERNS } from '../domain/expansionCatalog';
import {
  MAX_CAPACITOR_LEVEL,
  MAX_COMPONENT_UPGRADE_LEVEL,
  calculateAttributes,
  calculatePhysicalProfile,
  compareComponents,
  getCapacitorUpgradeCost,
  getComponentUpgradeCost,
} from '../domain/rules';
import {
  ComponentCategory,
  CosmeticCustomization,
  ElementType,
  LoadoutPreset,
  OwnedTopState,
  PlayerSaveData,
  VictoryEmoteId,
} from '../domain/types';

interface WorkshopModalProps {
  save: PlayerSaveData;
  activeTop: OwnedTopState;
  exploded?: boolean;
  selectedCategory?: ComponentCategory;
  partFocusSignal?: number;
  onSelectCategory?: (category: ComponentCategory) => void;
  onToggleExplode?: () => void;
  onClose: () => void;
  onEquipComponent: (category: ComponentCategory, componentId: string) => void;
  onUnlockComponent: (componentId: string) => void;
  onForgeMythicComponent: (componentId: string) => void;
  onUpgradeComponent: (componentId: string) => void;
  onUpgradeCapacitor: () => void;
  onUpdateAbility: (slotIdx: number, abilityId: string) => void;
  onSetSecondaryElement: (element: ElementType | null) => void;
  onUpdateCosmetics: (cosmetics: CosmeticCustomization) => void;
  onPreviewVictoryEmote?: (emote: VictoryEmoteId) => void;
  onSavePreset: (name: string) => void;
  onApplyPreset: (preset: LoadoutPreset) => void;
}

const EXPLODED_STACK_ORDER: ComponentCategory[] = [
  'SpiritCore',
  'EnergyModule',
  'AttackBlade',
  'ArmorRing',
  'WeightDisc',
  'PerformanceDriver',
];

export const WorkshopModal: React.FC<WorkshopModalProps> = ({
  save,
  activeTop,
  exploded = false,
  selectedCategory,
  partFocusSignal = 0,
  onSelectCategory,
  onToggleExplode,
  onClose,
  onEquipComponent,
  onUnlockComponent,
  onForgeMythicComponent,
  onUpgradeComponent,
  onUpgradeCapacitor,
  onUpdateAbility,
  onSetSecondaryElement,
  onUpdateCosmetics,
  onPreviewVictoryEmote,
  onSavePreset,
  onApplyPreset,
}) => {
  const [localCategory, setLocalCategory] = useState<ComponentCategory>('AttackBlade');
  const activeCategory = selectedCategory ?? localCategory;
  const [tab, setTab] = useState<'parts' | 'abilities' | 'cosmetics' | 'forge' | 'presets'>('parts');
  const [quickPaintOpen, setQuickPaintOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [compareId, setCompareId] = useState<string | null>(null);

  const selectCategory = (catId: ComponentCategory) => {
    setLocalCategory(catId);
    onSelectCategory?.(catId);
    setCompareId(null);
  };

  useEffect(() => {
    if (partFocusSignal > 0) {
      setTab('parts');
      setCompareId(null);
    }
  }, [partFocusSignal]);

  const topDef = getTopDefinition(activeTop.definitionId);
  const elemDef = ELEMENTS[topDef.element];
  const attrs = calculateAttributes(
    activeTop.definitionId,
    activeTop.equippedComponents,
    save.componentUpgradeLevels,
    activeTop.level,
    activeTop.evolutionPathId,
    save.character.stats,
    activeTop.secondaryElement
  );
  const phys = calculatePhysicalProfile(
    activeTop.definitionId,
    activeTop.equippedComponents,
    save.componentUpgradeLevels,
    activeTop.level,
    activeTop.evolutionPathId,
    save.character.stats,
    activeTop.secondaryElement,
    save.capacitorLevel
  );

  const categoryParts = COMPONENTS.filter((c) => c.category === activeCategory);
  const equippedInCat = activeTop.equippedComponents[activeCategory];
  const equippedDef = getComponentDefinition(equippedInCat);
  const currentUpgLvl = save.componentUpgradeLevels[equippedInCat] ?? 0;
  const upgCost = getComponentUpgradeCost(currentUpgLvl);
  const canAffordUpgrade =
    currentUpgLvl < MAX_COMPONENT_UPGRADE_LEVEL &&
    save.currencies.gold >= upgCost.gold &&
    save.currencies.metalShards >= upgCost.metalShards;

  const capCost = getCapacitorUpgradeCost(save.capacitorLevel);
  const canUpgradeCap =
    save.capacitorLevel < MAX_CAPACITOR_LEVEL &&
    save.currencies.energyCrystals >= capCost.energyCrystals &&
    save.currencies.gold >= capCost.gold;

  const mythicParts = COMPONENTS.filter((c) => Boolean(c.forgeCost));

  const compareCandidate = compareId
    ? COMPONENTS.find((c) => c.id === compareId && c.category === activeCategory)
    : null;
  const comparison = compareCandidate ? compareComponents(equippedDef, compareCandidate) : null;

  const statRows: { label: string; val: number; color: string }[] = [
    { label: 'ATK', val: attrs.attack, color: '#f43f5e' },
    { label: 'DEF', val: attrs.defense, color: '#38bdf8' },
    { label: 'STA', val: attrs.stamina, color: '#34d399' },
    { label: 'SPD', val: attrs.speed, color: '#facc15' },
    { label: 'STB', val: attrs.stability, color: '#818cf8' },
    { label: 'CTL', val: attrs.control, color: '#a78bfa' },
    { label: 'ENG', val: attrs.energy, color: '#22d3ee' },
    { label: 'CRT', val: attrs.critical, color: '#fb923c' },
  ];

  const allElements = Object.keys(ELEMENTS) as ElementType[];

  const cycleLayerPart = (catId: ComponentCategory, dir: -1 | 1) => {
    const unlockedInCat = COMPONENTS.filter(
      (c) => c.category === catId && save.unlockedComponentIds.includes(c.id)
    );
    if (unlockedInCat.length < 2) return;
    const currentId = activeTop.equippedComponents[catId];
    const idx = unlockedInCat.findIndex((c) => c.id === currentId);
    const nextIdx =
      idx < 0 ? 0 : (idx + dir + unlockedInCat.length) % unlockedInCat.length;
    selectCategory(catId);
    onEquipComponent(catId, unlockedInCat[nextIdx].id);
  };

  const activeCategoryMeta =
    COMPONENT_CATEGORIES.find((c) => c.id === activeCategory) ?? COMPONENT_CATEGORIES[0];
  const activeUnlockedCount = COMPONENTS.filter(
    (c) => c.category === activeCategory && save.unlockedComponentIds.includes(c.id)
  ).length;
  const cycleSelectedCategory = (dir: -1 | 1) => {
    const idx = EXPLODED_STACK_ORDER.indexOf(activeCategory);
    const nextIdx =
      idx < 0 ? 0 : (idx + dir + EXPLODED_STACK_ORDER.length) % EXPLODED_STACK_ORDER.length;
    selectCategory(EXPLODED_STACK_ORDER[nextIdx]);
    setTab('parts');
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-3 sm:p-5 sl-safe-inset">
      {/* Top 3D Hangar Bar */}
      <div className="pointer-events-auto sl-panel-chassis sl-ls-workshop-header rounded-xl px-3 sm:px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to command deck"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-2.5 py-1.5 min-h-[34px] text-xs font-display font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-300" />
            <span>Back</span>
          </button>

          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 font-bold font-display truncate">
              3D Hangar · {elemDef.displayName}
            </div>
            <div className="font-display text-sm sm:text-base font-bold text-white truncate">
              {topDef.displayName}
            </div>
          </div>

          {onToggleExplode && (
            <button
              type="button"
              onClick={onToggleExplode}
              aria-pressed={exploded}
              className={`sl-btn-3d sl-btn-3d-sm px-2.5 sm:px-3 py-1.5 min-h-[34px] text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                exploded ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-sky-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>{exploded ? 'Explode ON' : 'Explode View'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:flex items-center gap-2.5 text-xs font-mono-tech tabular-nums mr-1">
            <span className="text-amber-400 font-bold">{save.currencies.gold} G</span>
            <span className="text-slate-300 font-bold">{save.currencies.metalShards} Shards</span>
            <span className="text-emerald-300 font-bold">{save.currencies.energyCrystals} Crys</span>
            <span className="text-purple-300 font-bold">{save.currencies.legendaryFragments} Frag</span>
          </div>
          <button
            type="button"
            onClick={() => setQuickPaintOpen((prev) => !prev)}
            aria-pressed={quickPaintOpen}
            className={`sl-btn-3d sl-btn-3d-sm px-2.5 py-1.5 min-h-[34px] text-xs font-display font-bold flex items-center gap-1 cursor-pointer shrink-0 ${
              quickPaintOpen ? 'sl-btn-3d-amber' : 'sl-btn-3d-slate text-sky-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Paint</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workshop"
            className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate min-h-[36px] min-w-[36px] shrink-0 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Hangar Split: Left 6-Layer Vertical Stack + Open Center 3D Stage + Right Studio Drawer */}
      <div className="sl-ls-workshop-main flex-1 min-h-0 flex flex-col md:flex-row items-stretch justify-between gap-2.5 md:gap-3 pt-2.5">
        {/* Mobile Portrait 3D Pedestal Stage Window + Compact Layer Strip */}
        <div className="sl-ls-workshop-mobile-stage md:hidden h-[30dvh] min-h-[168px] max-h-[240px] shrink-0 pointer-events-none flex flex-col justify-end items-center pb-1">
          <div className="pointer-events-auto sl-panel-chassis rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 max-w-full">
            <button
              type="button"
              onClick={() => cycleSelectedCategory(-1)}
              aria-label="Previous layer"
              className="w-7 h-7 rounded border border-slate-700/80 bg-slate-950/90 flex items-center justify-center text-slate-200 hover:border-sky-400 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="min-w-0 text-center px-1">
              <div className="text-[9px] font-display font-bold uppercase tracking-wider text-sky-300">
                {activeCategoryMeta.shortLabel}
              </div>
              <div className="text-xs font-bold text-white truncate max-w-[165px]">
                {equippedDef.displayName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => cycleSelectedCategory(1)}
              aria-label="Next layer"
              className="w-7 h-7 rounded border border-slate-700/80 bg-slate-950/90 flex items-center justify-center text-slate-200 hover:border-sky-400 cursor-pointer shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-6 bg-slate-700/70 mx-0.5" />
            <button
              type="button"
              disabled={activeUnlockedCount < 2}
              onClick={() => cycleLayerPart(activeCategory, 1)}
              aria-label="Swap unlocked part"
              className={`px-2 py-1 rounded text-[10px] font-display font-bold uppercase border shrink-0 ${
                activeUnlockedCount >= 2
                  ? 'border-sky-400/70 bg-sky-950/70 text-sky-200 cursor-pointer'
                  : 'border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed'
              }`}
            >
              Swap Part
            </button>
          </div>
        </div>

        {/* Left Vertical 6-Layer Interactive Stack */}
        <div className="hidden md:flex pointer-events-auto sl-panel-modal sl-ls-workshop-left w-[240px] lg:w-[266px] rounded-2xl p-2.5 flex-col gap-1.5 overflow-y-auto sl-scroll">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800/90">
            <span className="text-[10px] font-display font-bold uppercase tracking-widest text-sky-300">
              Chassis Layer Stack
            </span>
            <span className="text-[9px] font-mono-tech uppercase text-slate-400">
              {exploded ? 'Separated' : 'Assembled'}
            </span>
          </div>

          {EXPLODED_STACK_ORDER.map((catId) => {
            const catMeta = COMPONENT_CATEGORIES.find((c) => c.id === catId)!;
            const eqId = activeTop.equippedComponents[catId];
            const eqDef = getComponentDefinition(eqId);
            const upgLvl = save.componentUpgradeLevels[eqId] ?? 0;
            const unlockedCount = COMPONENTS.filter(
              (c) => c.category === catId && save.unlockedComponentIds.includes(c.id)
            ).length;
            const selected = activeCategory === catId && tab === 'parts';

            return (
              <div
                key={catId}
                className={`rounded-xl border px-2.5 py-2 transition-colors ${
                  selected
                    ? 'border-sky-400/85 bg-sky-950/35 shadow-[0_0_16px_rgba(56,189,248,0.16)]'
                    : 'border-slate-800/90 bg-slate-900/65 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      selectCategory(catId);
                      setTab('parts');
                    }}
                    className="text-left text-[10px] font-display font-bold uppercase tracking-wider text-slate-400 hover:text-sky-300 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{catMeta.shortLabel}</span>
                    {upgLvl > 0 && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono-tech">
                        +{upgLvl}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickPaintOpen((prev) => !prev)}
                    title="Quick Chassis Paint"
                    aria-label={`Paint studio from ${catMeta.shortLabel}`}
                    className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 cursor-pointer"
                  >
                    <Palette className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={unlockedCount < 2}
                    onClick={() => cycleLayerPart(catId, -1)}
                    aria-label={`Previous ${catMeta.shortLabel}`}
                    className={`w-6 h-6 rounded border border-slate-700/80 bg-slate-950/80 flex items-center justify-center shrink-0 ${
                      unlockedCount >= 2
                        ? 'text-slate-200 hover:border-sky-400 cursor-pointer'
                        : 'text-slate-600 opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      selectCategory(catId);
                      setTab('parts');
                    }}
                    className="flex-1 min-w-0 text-center px-1 py-0.5 rounded hover:bg-slate-800/60 cursor-pointer"
                  >
                    <div className="text-xs font-bold text-white truncate">{eqDef.displayName}</div>
                  </button>

                  <button
                    type="button"
                    disabled={unlockedCount < 2}
                    onClick={() => cycleLayerPart(catId, 1)}
                    aria-label={`Next ${catMeta.shortLabel}`}
                    className={`w-6 h-6 rounded border border-slate-700/80 bg-slate-950/80 flex items-center justify-center shrink-0 ${
                      unlockedCount >= 2
                        ? 'text-slate-200 hover:border-sky-400 cursor-pointer'
                        : 'text-slate-600 opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Unobstructed 3D Pedestal Viewport */}
        <div className="hidden md:flex flex-1 min-w-0 pointer-events-none flex-col justify-end items-center pb-1">
          <div className="px-3 py-1 rounded-full bg-slate-950/90 border border-slate-700/80 text-[10px] font-mono-tech text-slate-300 flex items-center gap-2">
            <span className="text-amber-300 font-bold uppercase">{activeCategoryMeta.shortLabel}</span>
            <span className="text-slate-600">·</span>
            <span>Drag 3D Top · Click Layer to Select · Scroll to Zoom</span>
            {exploded && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-cyan-300 font-bold uppercase">Exploded Stack Active</span>
              </>
            )}
          </div>
        </div>

        {/* Right Studio Drawer: Stats, Inline Paint Strip, Section Tabs & Inspectors */}
        <div className="sl-panel-modal sl-ls-workshop-drawer pointer-events-auto w-full md:max-w-[440px] ml-auto md:ml-0 flex-1 min-h-0 md:flex-none md:h-full rounded-2xl flex flex-col overflow-hidden">
          {/* Mobile Resources Strip (when top bar resources hidden on <sm) */}
          <div className="sm:hidden shrink-0 px-3 py-1.5 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] font-mono-tech tabular-nums bg-slate-950/50">
            <span className="text-amber-400 font-bold">{save.currencies.gold} G</span>
            <span className="text-slate-300 font-bold">{save.currencies.metalShards} Shards</span>
            <span className="text-emerald-300 font-bold">{save.currencies.energyCrystals} Crys</span>
            <span className="text-purple-300 font-bold">{save.currencies.legendaryFragments} Frag</span>
          </div>

          {/* Live Attributes + Physical Profile */}
          <div className="sl-ls-workshop-stats shrink-0 px-3.5 py-2 border-b border-slate-800/80 bg-slate-950/35">
            <div className="sl-ls-workshop-stats-grid grid grid-cols-4 gap-1.5 mb-1.5">
              {statRows.map((s) => (
                <div
                  key={s.label}
                  className="sl-ls-workshop-stat-cell bg-slate-950/75 px-2 py-1 rounded border border-slate-800/90"
                >
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400">{s.label}</span>
                    <span className="text-white font-mono-tech tabular-nums">{s.val}</span>
                  </div>
                  <div className="sl-bar-track h-1.5 mt-0.5 rounded-full overflow-hidden">
                    <div
                      className="sl-bar-fill h-full"
                      style={{ width: `${s.val}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300 font-mono-tech tabular-nums">
              <span>
                Mass: <strong>{(phys.totalMassKg * 1000).toFixed(0)}g</strong>
              </span>
              <span>
                Friction: <strong>{phys.groundFriction.toFixed(2)}</strong>
              </span>
              <span>
                Max EN: <strong>{Math.round(phys.maxEnergy)}</strong>
              </span>
              <span>
                RPM: <strong>{Math.round(phys.initialAngularVelocity * 9.55)}</strong>
              </span>
            </div>
          </div>

          {/* Inline Live Paint & Finish Studio Strip */}
          {quickPaintOpen && (
            <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-800/90 bg-slate-950/85 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  Live Paint &amp; Finish
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('cosmetics');
                      setQuickPaintOpen(false);
                    }}
                    className="text-[10px] font-bold text-sky-300 hover:underline cursor-pointer"
                  >
                    Emotes &amp; Full Studio →
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickPaintOpen(false)}
                    aria-label="Close live paint strip"
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    { label: 'Blade', key: 'primaryColor' as const },
                    { label: 'Trim', key: 'trimColor' as const },
                    { label: 'Trail', key: 'trailColor' as const },
                  ] as const
                ).map(({ label, key }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-10 text-[10px] font-bold text-slate-400 uppercase shrink-0">
                      {label}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {COSMETIC_PALETTE_SWATCHES.map((hex) => {
                        const active = activeTop.cosmetics[key] === hex;
                        return (
                          <button
                            key={hex}
                            type="button"
                            onClick={() =>
                              onUpdateCosmetics({ ...activeTop.cosmetics, [key]: hex })
                            }
                            aria-label={`Quick ${label} ${hex}`}
                            className={`w-5 h-5 rounded cursor-pointer border ${
                              active ? 'border-white scale-110' : 'border-slate-700'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {COSMETIC_PATTERNS.map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() =>
                      onUpdateCosmetics({ ...activeTop.cosmetics, pattern: pat.id })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      activeTop.cosmetics.pattern === pat.id
                        ? 'bg-sky-400 text-slate-950 border-sky-300'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {pat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section Tabs */}
          <div className="sl-ls-workshop-tabs shrink-0 px-3.5 pt-2 flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-2.5">
            {(['parts', 'abilities', 'cosmetics', 'forge', 'presets'] as const).map((t) => {
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`sl-btn-3d sl-btn-3d-sm min-h-[32px] px-3 py-1 text-xs font-display font-bold capitalize cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive ? 'sl-btn-3d-cyan' : 'sl-btn-3d-slate text-slate-300'
                  }`}
                >
                  <span>{t}</span>
                  {isActive && (
                    <motion.span
                      layoutId="workshop-section-tab-rail"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="pointer-events-none absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-white/85"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="sl-ls-workshop-body flex-1 min-h-0 overflow-y-auto sl-scroll p-3.5 space-y-3">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              {tab === 'parts' && (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    {COMPONENT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => selectCategory(cat.id)}
                        className={`sl-btn-3d sl-btn-3d-sm px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                          activeCategory === cat.id
                            ? 'sl-btn-3d-amber'
                            : 'sl-btn-3d-slate text-slate-300'
                        }`}
                      >
                        {cat.shortLabel}
                      </button>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-700/80 bg-slate-900/80 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Equipped · Lv.{currentUpgLvl}/{MAX_COMPONENT_UPGRADE_LEVEL}
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        {equippedDef.displayName}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canAffordUpgrade}
                      onClick={() => onUpgradeComponent(equippedInCat)}
                      className={`sl-btn-3d sl-btn-3d-sm px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 shrink-0 ${
                        canAffordUpgrade
                          ? 'sl-btn-3d-emerald cursor-pointer'
                          : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      {currentUpgLvl >= MAX_COMPONENT_UPGRADE_LEVEL
                        ? 'MAXED'
                        : `Upgrade (${upgCost.gold}G/${upgCost.metalShards}S)`}
                    </button>
                  </div>

                  {/* Side-by-Side Comparison Card */}
                  {comparison && compareCandidate && (
                    <div className="p-2.5 rounded-lg border border-sky-400/60 bg-sky-950/25 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-extrabold text-sky-300">
                        <span className="flex items-center gap-1.5 truncate">
                          <GitCompare className="w-3.5 h-3.5 shrink-0" />
                          {equippedDef.displayName} vs {compareCandidate.displayName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCompareId(null)}
                          className="text-slate-400 hover:text-white cursor-pointer text-[11px] shrink-0"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-bold tabular-nums">
                        <span className={comparison.massDeltaGrams > 0 ? 'text-amber-300' : 'text-sky-300'}>
                          Mass {comparison.massDeltaGrams > 0 ? '+' : ''}
                          {comparison.massDeltaGrams}g
                        </span>
                        <span
                          className={comparison.durabilityDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                        >
                          Durability {comparison.durabilityDelta >= 0 ? '+' : ''}
                          {comparison.durabilityDelta}
                        </span>
                        {Object.entries(comparison.attributeDeltas).map(([k, d]) => (
                          <span
                            key={k}
                            className={Number(d) >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                          >
                            {k.toUpperCase()} {Number(d) > 0 ? `+${d}` : d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {categoryParts.map((comp) => {
                      const isEquipped = equippedInCat === comp.id;
                      const isUnlocked = save.unlockedComponentIds.includes(comp.id);
                      const canBuy = !comp.forgeCost && save.currencies.gold >= comp.unlockCostGold;
                      const upg = save.componentUpgradeLevels[comp.id] ?? 0;

                      return (
                        <div
                          key={comp.id}
                          className={`p-2.5 rounded-lg border transition-colors ${
                            isEquipped
                              ? 'border-sky-400 bg-sky-950/30'
                              : 'border-slate-800 bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-white">{comp.displayName}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                                  {comp.rarity}
                                </span>
                                {upg > 0 && (
                                  <span className="text-[10px] text-emerald-400 font-bold">+{upg}</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{comp.description}</p>
                              <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-slate-300 tabular-nums">
                                <span>Mass {(comp.massKg * 1000).toFixed(0)}g</span>
                                {Object.entries(comp.modifiers).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className={Number(v) >= 0 ? 'text-sky-300' : 'text-rose-400'}
                                  >
                                    {k.toUpperCase()} {Number(v) > 0 ? `+${v}` : v}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {isEquipped ? (
                                <span className="px-2.5 py-1 rounded bg-sky-400/20 text-sky-300 text-xs font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> Equipped
                                </span>
                              ) : (
                                <>
                                  {isUnlocked ? (
                                    <button
                                      type="button"
                                      onClick={() => onEquipComponent(activeCategory, comp.id)}
                                      className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan px-3 py-1 text-xs font-bold cursor-pointer"
                                    >
                                      Equip
                                    </button>
                                  ) : comp.forgeCost ? (
                                    <button
                                      type="button"
                                      onClick={() => setTab('forge')}
                                      className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-violet px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                                    >
                                      Mythic Forge
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!canBuy}
                                      onClick={() => onUnlockComponent(comp.id)}
                                      className={`sl-btn-3d sl-btn-3d-sm px-3 py-1 text-xs font-bold flex items-center gap-1 ${
                                        canBuy
                                          ? 'sl-btn-3d-amber cursor-pointer'
                                          : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                                      }`}
                                    >
                                      <Lock className="w-3 h-3" /> {comp.unlockCostGold} G
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCompareId(compareId === comp.id ? null : comp.id)
                                    }
                                    className="text-[10px] font-bold text-sky-400 hover:underline cursor-pointer"
                                  >
                                    {compareId === comp.id ? 'Hide Diff' : 'Compare'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {tab === 'abilities' && (
                <div className="space-y-3">
                  {/* Dual-Element Tuning Box */}
                  <div className="p-3 rounded-lg border border-purple-500/40 bg-purple-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-purple-300">
                        Dual-Element Resonance Tuning
                      </span>
                      <span className="text-[10px] text-slate-400">+6 CRT · +4 CTL · -10% Max EN</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSetSecondaryElement(null)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer border ${
                          !activeTop.secondaryElement
                            ? 'bg-slate-100 text-slate-950 border-white'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        Mono ({topDef.element})
                      </button>
                      {allElements
                        .filter((e) => e !== topDef.element)
                        .map((el) => {
                          const active = activeTop.secondaryElement === el;
                          return (
                            <button
                              key={el}
                              type="button"
                              onClick={() => onSetSecondaryElement(el)}
                              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer border ${
                                active
                                  ? 'text-slate-950 border-white'
                                  : 'bg-slate-900 text-slate-300 border-slate-700'
                              }`}
                              style={active ? { backgroundColor: ELEMENTS[el].primaryColor } : undefined}
                            >
                              +{el}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Equipped Item Slots (Live battle controls:{' '}
                    {save.settings.keyBindings.ability1.toUpperCase()} /{' '}
                    {save.settings.keyBindings.ability2.toUpperCase()} /{' '}
                    {save.settings.keyBindings.ability3.toUpperCase()} /{' '}
                    {save.settings.keyBindings.ability4.toUpperCase()}).
                  </p>

                  {(['Elemental', 'Defensive', 'Tactical', 'Ultimate'] as const).map(
                    (slotType, idx) => {
                      const currentId = activeTop.equippedAbilities[idx];
                      const currentDef = getAbilityDefinition(currentId);
                      const matchingAbilities = ABILITIES.filter((a) => a.type === slotType);
                      const keys = [
                        save.settings.keyBindings.ability1.toUpperCase(),
                        save.settings.keyBindings.ability2.toUpperCase(),
                        save.settings.keyBindings.ability3.toUpperCase(),
                        save.settings.keyBindings.ability4.toUpperCase(),
                      ];

                      return (
                        <div
                          key={slotType}
                          className="p-3 rounded-lg border border-slate-800 bg-slate-900/70 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                              Slot [{keys[idx]}] · {slotType}
                            </span>
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              {currentDef.energyCost} EN · {currentDef.cooldownSec}s CD
                            </span>
                          </div>
                          <select
                            aria-label={`Ability slot ${keys[idx]}`}
                            value={currentId}
                            onChange={(e) => onUpdateAbility(idx, e.target.value)}
                            className="w-full px-2.5 py-2 rounded bg-slate-950 border border-slate-700 text-sm text-white font-semibold"
                          >
                            {matchingAbilities.map((ab) => (
                              <option key={ab.id} value={ab.id}>
                                {ab.displayName} {ab.element ? `(${ab.element})` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="text-xs text-slate-400">{currentDef.description}</div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              {tab === 'cosmetics' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                    <Palette className="w-4 h-4" />
                    Live 3D Chassis Paint &amp; Trail Studio
                  </div>

                  {(
                    [
                      { label: 'Primary Blade Finish', key: 'primaryColor' as const },
                      { label: 'Trim & Armor Accent', key: 'trimColor' as const },
                      { label: 'Spin Trail Aura', key: 'trailColor' as const },
                    ] as const
                  ).map(({ label, key }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-300">{label}</div>
                      <div className="flex flex-wrap gap-2">
                        {COSMETIC_PALETTE_SWATCHES.map((hex) => {
                          const active = activeTop.cosmetics[key] === hex;
                          return (
                            <button
                              key={hex}
                              type="button"
                              onClick={() =>
                                onUpdateCosmetics({ ...activeTop.cosmetics, [key]: hex })
                              }
                              aria-label={`${label} ${hex}`}
                              className={`w-7 h-7 rounded-lg cursor-pointer border-2 ${
                                active ? 'border-white scale-110' : 'border-slate-700'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-300">Chassis Pattern</div>
                    <div className="grid grid-cols-2 gap-2">
                      {COSMETIC_PATTERNS.map((pat) => (
                        <button
                          key={pat.id}
                          type="button"
                          onClick={() =>
                            onUpdateCosmetics({ ...activeTop.cosmetics, pattern: pat.id })
                          }
                          className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                            activeTop.cosmetics.pattern === pat.id
                              ? 'bg-sky-400 text-slate-950 border-sky-300'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          {pat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <Sparkles className="w-3.5 h-3.5" />
                        Victory Celebration Emote
                      </div>
                      {onPreviewVictoryEmote && (
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewVictoryEmote(activeTop.cosmetics.victoryEmote ?? 'apex_flare')
                          }
                          className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[10px] font-extrabold text-amber-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          Preview 3D
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {VICTORY_EMOTES.map((emote) => {
                        const selected =
                          (activeTop.cosmetics.victoryEmote ?? 'apex_flare') === emote.id;
                        return (
                          <button
                            key={emote.id}
                            type="button"
                            onClick={() => {
                              onUpdateCosmetics({ ...activeTop.cosmetics, victoryEmote: emote.id });
                              onPreviewVictoryEmote?.(emote.id);
                            }}
                            className={`w-full p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                              selected
                                ? 'bg-slate-800/95 text-white'
                                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                            }`}
                            style={selected ? { borderColor: emote.accentHex } : undefined}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: emote.accentHex }}
                                />
                                {emote.label}
                              </span>
                              {selected && (
                                <span className="text-[10px] font-mono-tech uppercase text-amber-300">
                                  Equipped
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {emote.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'forge' && (
                <div className="space-y-3">
                  {/* Arena Energy Capacitor Upgrade */}
                  <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                        <Zap className="w-4 h-4" />
                        Arena Energy Capacitor · Lv.{save.capacitorLevel}/{MAX_CAPACITOR_LEVEL}
                      </div>
                      <span className="text-xs font-bold text-slate-300">
                        +{save.capacitorLevel * 6} Max EN
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Infuse Energy Crystals to permanently expand Max Energy and Regen across all spinning tops.
                    </p>
                    <button
                      type="button"
                      disabled={!canUpgradeCap}
                      onClick={onUpgradeCapacitor}
                      className={`sl-btn-3d sl-btn-3d-sm w-full py-2 text-xs font-display font-bold ${
                        canUpgradeCap
                          ? 'sl-btn-3d-emerald cursor-pointer'
                          : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                      }`}
                    >
                      {save.capacitorLevel >= MAX_CAPACITOR_LEVEL
                        ? 'CAPACITOR MAXED'
                        : `UPGRADE CAPACITOR (${capCost.energyCrystals} Crystals · ${capCost.gold} Gold)`}
                    </button>
                  </div>

                  {/* Mythic Component Forging */}
                  <div className="text-xs font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5 pt-1">
                    <Flame className="w-4 h-4" />
                    Mythic Component Forge
                  </div>
                  {mythicParts.map((part) => {
                    const owned = save.unlockedComponentIds.includes(part.id);
                    const fc = part.forgeCost!;
                    const canForge =
                      !owned &&
                      save.currencies.legendaryFragments >= fc.legendaryFragments &&
                      save.currencies.energyCrystals >= fc.energyCrystals &&
                      save.currencies.gold >= fc.gold;
                    return (
                      <div
                        key={part.id}
                        className="p-3 rounded-lg border border-purple-500/40 bg-slate-900/75 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-extrabold text-white">{part.displayName}</div>
                          <div className="text-[11px] text-purple-300 font-semibold">
                            {part.category} · Mythic
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{part.description}</p>
                        </div>
                        {owned ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold shrink-0">
                            Forged
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!canForge}
                            onClick={() => onForgeMythicComponent(part.id)}
                            className={`sl-btn-3d sl-btn-3d-sm px-3 py-1.5 text-[11px] font-bold shrink-0 ${
                              canForge
                                ? 'sl-btn-3d-violet cursor-pointer'
                                : 'sl-btn-3d-slate opacity-45 cursor-not-allowed'
                            }`}
                          >
                            {fc.legendaryFragments} Frag · {fc.energyCrystals} Crys · {fc.gold}G
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'presets' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="New preset name..."
                      className="flex-1 px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (presetName.trim()) {
                          onSavePreset(presetName.trim());
                          setPresetName('');
                        }
                      }}
                      className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-cyan px-3.5 py-2 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>

                  <div className="space-y-2">
                    {save.presets.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-lg border border-slate-800 bg-slate-900/70 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{p.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {p.secondaryElement ? `Dual +${p.secondaryElement} · ` : ''}
                            {p.cosmetics?.pattern ?? 'solid'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApplyPreset(p)}
                          className="sl-btn-3d sl-btn-3d-sm sl-btn-3d-slate px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
