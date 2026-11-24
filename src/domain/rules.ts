import {
  ABILITIES,
  ARENAS,
  COMPONENT_CATEGORIES,
  COMPONENTS,
  ELEMENTS,
  ENDINGS_CATALOG,
  EVOLUTION_PATHS,
  MISSIONS_CATALOG,
  OPPONENTS,
  SECRETS_CATALOG,
  SEEDED_LEADERBOARD_ENTRIES,
  STORY_DECISIONS,
  TOP_DEFINITIONS,
  getComponentDefinition,
  getEndingDefinition,
  getEvolutionPath,
  getSecretDefinition,
  getTopDefinition,
} from './catalog';
import {
  AIPersonality,
  ArenaId,
  AttributeSet,
  BattleMutators,
  BattleScoreBreakdown,
  CharacterAppearance,
  CharacterProfile,
  CharacterStats,
  ComponentDefinition,
  CosmeticCustomization,
  Currencies,
  DifficultyLevel,
  DurabilityBand,
  ElementType,
  EndingDefinition,
  EquippedComponents,
  FinishReason,
  KeyBindings,
  LeaderboardEntry,
  MatchHistoryEntry,
  MatchMode,
  MutatorDefinition,
  OwnedTopState,
  PhysicalProfile,
  PlayerSaveData,
  RankTierDefinition,
  RankTierId,
  Rarity,
  RivalRecord,
  ShadowOpponentProfile,
  TopCareerStats,
} from './types';

export const CHARACTER_BASE_STAT = 5;
export const CHARACTER_MAX_STAT = 12;
export const CHARACTER_BONUS_POINTS = 12;
export const CHARACTER_TOTAL_BUDGET = CHARACTER_BASE_STAT * 4 + CHARACTER_BONUS_POINTS; // 32

export const SAVE_SCHEMA_VERSION = 2;
export const MAX_COMPONENT_UPGRADE_LEVEL = 5;
export const MAX_CAPACITOR_LEVEL = 5;

export const PERFECT_LAUNCH_MIN = 0.80;
export const PERFECT_LAUNCH_MAX = 0.94;
export const PERFECT_LAUNCH_RPM_BONUS = 1.08;

export const ARENA_DISH_RADIUS = 4.25;
export const MAX_BATTLE_DURATION = 90; // seconds
export const LAUNCH_WINDOW_SECONDS = 5.0;
export const TEAM_SWITCH_ENERGY_COST = 20;

export const DEFAULT_BATTLE_MUTATORS: BattleMutators = {
  noAbilities: false,
  doubleGravity: false,
  turboSpin: false,
  ringOutOnly: false,
  doubleHazards: false,
};

export const MUTATOR_DEFINITIONS: MutatorDefinition[] = [
  {
    id: 'noAbilities',
    label: 'Pure Mechanical (No Abilities)',
    shortLabel: 'No Abilities',
    description: 'Disables all elemental & ultimate abilities for pure physics combat.',
    accentHex: '#94a3b8',
  },
  {
    id: 'doubleGravity',
    label: '2x Bowl Gravity',
    shortLabel: '2x Gravity',
    description: 'Doubles parabolic pull toward the center for relentless high-frequency clashes.',
    accentHex: '#38bdf8',
  },
  {
    id: 'turboSpin',
    label: 'Turbo Spin (2x RPM)',
    shortLabel: 'Turbo Spin 2x',
    description: 'Doubles initial spin RPM (2x) and boosts launch velocity by 30% for explosive impacts.',
    accentHex: '#facc15',
  },
  {
    id: 'ringOutOnly',
    label: 'Ring-Out Only',
    shortLabel: 'Ring-Out Only',
    description: 'Knockout & Spin-Finish floor disabled; victory is claimed only via Ring-Out.',
    accentHex: '#f97316',
  },
  {
    id: 'doubleHazards',
    label: '2x Arena Hazards',
    shortLabel: '2x Hazards',
    description: 'Doubles arena trap & hazard intensity, debuff duration, and elemental drain.',
    accentHex: '#f43f5e',
  },
];

export function isQuickSwapAllowedForMode(
  mode: MatchMode,
  isSpectating?: boolean
): boolean {
  if (isSpectating) return false;
  return mode === 'Training' || mode === 'Boss' || mode === 'TeamBattle';
}

export const RANK_TIERS: RankTierDefinition[] = [
  {
    id: 'Bronze',
    name: 'Bronze Striker',
    minMmr: 0,
    colorHex: '#cd7f32',
    rewardGold: 150,
    rewardCrystals: 8,
    rewardFragments: 0,
  },
  {
    id: 'Silver',
    name: 'Silver Vanguard',
    minMmr: 1050,
    colorHex: '#cbd5e1',
    rewardGold: 280,
    rewardCrystals: 14,
    rewardFragments: 1,
  },
  {
    id: 'Gold',
    name: 'Gold Sovereign',
    minMmr: 1200,
    colorHex: '#facc15',
    rewardGold: 450,
    rewardCrystals: 22,
    rewardFragments: 2,
  },
  {
    id: 'Platinum',
    name: 'Platinum Tactician',
    minMmr: 1400,
    colorHex: '#38bdf8',
    rewardGold: 700,
    rewardCrystals: 34,
    rewardFragments: 3,
  },
  {
    id: 'Diamond',
    name: 'Diamond Apex',
    minMmr: 1650,
    colorHex: '#a855f7',
    rewardGold: 1050,
    rewardCrystals: 50,
    rewardFragments: 5,
  },
  {
    id: 'Legend',
    name: 'Stadium Legend',
    minMmr: 1950,
    colorHex: '#f43f5e',
    rewardGold: 1600,
    rewardCrystals: 80,
    rewardFragments: 8,
  },
];

function clampAttr(val: number): number {
  return Math.max(1, Math.min(100, Math.round(val)));
}

export function getXpForNextLevel(level: number): number {
  // XP_required(L) = B * L^p (B=80, p=1.45)
  return Math.round(80 * Math.pow(Math.max(1, level), 1.45));
}

export function addExperienceToTop(
  top: OwnedTopState,
  gainedXp: number
): { updated: OwnedTopState; levelsGained: number } {
  let level = top.level;
  let xp = top.experience + Math.max(0, Math.round(gainedXp));
  let levelsGained = 0;

  while (xp >= getXpForNextLevel(level) && level < 50) {
    xp -= getXpForNextLevel(level);
    level += 1;
    levelsGained += 1;
  }

  return {
    updated: {
      ...top,
      level,
      experience: xp,
    },
    levelsGained,
  };
}

export function getElementalMultiplier(attacker: ElementType, defender: ElementType): number {
  const def = ELEMENTS[attacker];
  if (def.strongAgainst.includes(defender)) return 1.15;
  if (def.weakAgainst.includes(defender)) return 0.9;
  return 1.0;
}

export function getDualElementalMultiplier(
  attackerPrimary: ElementType,
  attackerSecondary: ElementType | null | undefined,
  defenderPrimary: ElementType,
  defenderSecondary?: ElementType | null
): number {
  const pVsP = getElementalMultiplier(attackerPrimary, defenderPrimary);
  const pVsS = defenderSecondary ? getElementalMultiplier(attackerPrimary, defenderSecondary) : pVsP;
  const primaryAvg = (pVsP + pVsS) * 0.5;
  if (!attackerSecondary || attackerSecondary === attackerPrimary) {
    return primaryAvg;
  }
  const sVsP = getElementalMultiplier(attackerSecondary, defenderPrimary);
  const sVsS = defenderSecondary ? getElementalMultiplier(attackerSecondary, defenderSecondary) : sVsP;
  const secondaryAvg = (sVsP + sVsS) * 0.5;
  // Dual-element blends 68% primary + 32% secondary resonance
  return Number((primaryAvg * 0.68 + secondaryAvg * 0.32).toFixed(3));
}

export function getDurabilityBand(percent: number): DurabilityBand {
  if (percent <= 0) return 'Failed';
  if (percent <= 24) return 'Critical';
  if (percent <= 49) return 'Reduced';
  if (percent <= 74) return 'Minor';
  return 'Normal';
}

export function validateTopConfiguration(equipped: EquippedComponents): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  for (const cat of COMPONENT_CATEGORIES) {
    const id = equipped[cat.id];
    if (!id) {
      errors.push(`Missing component for ${cat.label}`);
      continue;
    }
    const comp = COMPONENTS.find((c) => c.id === id);
    if (!comp) {
      errors.push(`Unknown component ID: ${id}`);
      continue;
    }
    if (comp.category !== cat.id) {
      errors.push(`Component ${comp.displayName} does not match slot ${cat.label}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function calculateAttributes(
  topDefId: string,
  equipped: EquippedComponents,
  upgradeLevels: Record<string, number> = {},
  topLevel = 1,
  evolutionPathId: string | null = null,
  characterStats?: CharacterStats,
  secondaryElement?: ElementType | null
): AttributeSet {
  const topDef = getTopDefinition(topDefId);
  const acc: AttributeSet = { ...topDef.baseAttributes };

  // Level bonus (+1.2 per level above 1 across core stats)
  const lvlBonus = Math.max(0, topLevel - 1) * 1.2;
  acc.attack += lvlBonus;
  acc.defense += lvlBonus;
  acc.stamina += lvlBonus;
  acc.stability += lvlBonus * 0.8;

  // Commander character stat bonuses above baseline (5)
  if (characterStats) {
    const strBonus = Math.max(0, characterStats.strength - CHARACTER_BASE_STAT);
    const agiBonus = Math.max(0, characterStats.agility - CHARACTER_BASE_STAT);
    const focBonus = Math.max(0, characterStats.focus - CHARACTER_BASE_STAT);
    const lckBonus = Math.max(0, characterStats.luck - CHARACTER_BASE_STAT);
    acc.attack += strBonus * 2;
    acc.speed += agiBonus * 2;
    acc.control += agiBonus;
    acc.energy += focBonus * 2;
    acc.stability += focBonus;
    acc.critical += lckBonus * 2;
  }

  // Component modifiers + upgrade levels (+8% per upgrade level)
  for (const cat of COMPONENT_CATEGORIES) {
    const compId = equipped[cat.id];
    const comp = getComponentDefinition(compId);
    const upgLvl = upgradeLevels[compId] ?? 0;
    const upgMult = 1 + upgLvl * 0.08;
    const m = comp.modifiers;
    if (m.attack) acc.attack += m.attack * (m.attack > 0 ? upgMult : 1);
    if (m.defense) acc.defense += m.defense * (m.defense > 0 ? upgMult : 1);
    if (m.stamina) acc.stamina += m.stamina * (m.stamina > 0 ? upgMult : 1);
    if (m.speed) acc.speed += m.speed * (m.speed > 0 ? upgMult : 1);
    if (m.stability) acc.stability += m.stability * (m.stability > 0 ? upgMult : 1);
    if (m.control) acc.control += m.control * (m.control > 0 ? upgMult : 1);
    if (m.energy) acc.energy += m.energy * (m.energy > 0 ? upgMult : 1);
    if (m.critical) acc.critical += m.critical * (m.critical > 0 ? upgMult : 1);
  }

  // Evolution path bonuses
  if (evolutionPathId) {
    const evo = getEvolutionPath(evolutionPathId);
    if (evo) {
      const b = evo.attributeBonuses;
      if (b.attack) acc.attack += b.attack;
      if (b.defense) acc.defense += b.defense;
      if (b.stamina) acc.stamina += b.stamina;
      if (b.speed) acc.speed += b.speed;
      if (b.stability) acc.stability += b.stability;
      if (b.control) acc.control += b.control;
      if (b.energy) acc.energy += b.energy;
      if (b.critical) acc.critical += b.critical;
    }
  }

  // Dual-Element Synergy & Balanced Trade-Off:
  // Gains critical/control affinity (+6 CRT, +4 CTL) at the cost of -6 Energy stability load
  if (secondaryElement && secondaryElement !== topDef.element) {
    acc.critical += 6;
    acc.control += 4;
    acc.energy -= 6;
  }

  return {
    attack: clampAttr(acc.attack),
    defense: clampAttr(acc.defense),
    stamina: clampAttr(acc.stamina),
    speed: clampAttr(acc.speed),
    stability: clampAttr(acc.stability),
    control: clampAttr(acc.control),
    energy: clampAttr(acc.energy),
    critical: clampAttr(acc.critical),
  };
}

export function calculatePhysicalProfile(
  topDefId: string,
  equipped: EquippedComponents,
  upgradeLevels: Record<string, number> = {},
  topLevel = 1,
  evolutionPathId: string | null = null,
  characterStats?: CharacterStats,
  secondaryElement?: ElementType | null,
  capacitorLevel = 0
): PhysicalProfile {
  const attrs = calculateAttributes(
    topDefId,
    equipped,
    upgradeLevels,
    topLevel,
    evolutionPathId,
    characterStats,
    secondaryElement
  );
  const topDef = getTopDefinition(topDefId);
  const blade = getComponentDefinition(equipped.AttackBlade);
  const driver = getComponentDefinition(equipped.PerformanceDriver);
  const weight = getComponentDefinition(equipped.WeightDisc);
  const armor = getComponentDefinition(equipped.ArmorRing);
  const core = getComponentDefinition(equipped.SpiritCore);
  const energyMod = getComponentDefinition(equipped.EnergyModule);

  const totalMassKg =
    core.massKg +
    blade.massKg +
    armor.massKg +
    weight.massKg +
    driver.massKg +
    energyMod.massKg;

  const effectiveRadiusM =
    0.34 +
    (blade.radiusContribution + weight.radiusContribution + armor.radiusContribution) * 2.4;

  const inertiaMultiplier = weight.id === 'weight.outer' ? 1.18 : 1.0;
  const momentOfInertia = 0.5 * totalMassKg * effectiveRadiusM * effectiveRadiusM * inertiaMultiplier;

  const baseRotDrag =
    core.rotationalDrag +
    blade.rotationalDrag +
    armor.rotationalDrag +
    weight.rotationalDrag +
    driver.rotationalDrag +
    energyMod.rotationalDrag;

  const rotationalDrag = baseRotDrag * (1.18 - (attrs.stamina / 100) * 0.32);

  const groundFriction = driver.groundFriction;
  const restitution = Math.min(
    0.92,
    0.46 + blade.restitution + armor.restitution + core.restitution + driver.restitution
  );

  const maxDurability =
    core.durability +
    blade.durability +
    armor.durability +
    weight.durability +
    driver.durability +
    energyMod.durability +
    attrs.defense * 0.4;

  const initialAngularVelocity = 96 + attrs.stamina * 0.16 + attrs.speed * 0.1;
  const accelerationForce = 3.2 + (attrs.speed / 100) * 3.4 + (attrs.control / 100) * 1.1;

  const hasDual = Boolean(secondaryElement && secondaryElement !== topDef.element);
  const dualEnergyMult = hasDual ? 0.9 : 1.0;
  const capBonus = Math.max(0, capacitorLevel) * 6;
  const capRegenBonus = Math.max(0, capacitorLevel) * 0.55;

  const maxEnergy = (85 + attrs.energy * 0.45 + capBonus) * dualEnergyMult;
  const energyRegenPerSec = (5.5 + (attrs.energy / 100) * 4.5 + capRegenBonus) * (hasDual ? 0.92 : 1.0);
  const resonanceRate = (energyMod.id === 'energy.resonance' ? 1.28 : 1.0) * (hasDual ? 1.08 : 1.0);

  return {
    totalMassKg,
    effectiveRadiusM,
    momentOfInertia,
    rotationalDrag,
    groundFriction,
    restitution,
    maxDurability,
    initialAngularVelocity,
    accelerationForce,
    energyRegenPerSec,
    maxEnergy,
    resonanceRate,
    bladeShape: blade.visual.bladeShape ?? 'sharp',
    driverType: driver.visual.driverType ?? 'flat',
  };
}

export function getComponentUpgradeCost(currentLevel: number): {
  gold: number;
  metalShards: number;
} {
  return {
    gold: 60 + currentLevel * 55,
    metalShards: 12 + currentLevel * 10,
  };
}

export function canEvolveTop(
  top: OwnedTopState,
  pathId: string,
  currencies: Currencies
): { eligible: boolean; reason?: string } {
  if (top.evolutionStage >= 1) {
    return { eligible: false, reason: 'Already evolved to Apex Stage' };
  }
  const path = getEvolutionPath(pathId);
  if (!path) return { eligible: false, reason: 'Invalid evolution path' };
  if (top.level < path.requiredLevel) {
    return { eligible: false, reason: `Requires Top Level ${path.requiredLevel}` };
  }
  if (currencies.gold < path.goldCost) {
    return { eligible: false, reason: `Requires ${path.goldCost} Gold` };
  }
  if (currencies.evolutionTokens < path.evolutionTokensCost) {
    return { eligible: false, reason: `Requires ${path.evolutionTokensCost} Evolution Tokens` };
  }
  if (currencies.elementalEssence < path.essenceCost) {
    return { eligible: false, reason: `Requires ${path.essenceCost} Elemental Essence` };
  }
  return { eligible: true };
}

export function calculateBattleRewards(params: {
  battleId: string;
  won: boolean;
  finishReason: FinishReason;
  difficulty: DifficultyLevel;
  isBoss: boolean;
  isTournament: boolean;
  isSurvival?: boolean;
  survivalWave?: number;
  isShadowPvP?: boolean;
  isRevengeMatch?: boolean;
  durationSec: number;
  processedBattleIds: string[];
}): {
  gold: number;
  metalShards: number;
  energyCrystals: number;
  elementalEssence: number;
  evolutionTokens: number;
  legendaryFragments: number;
  xp: number;
  alreadyClaimed: boolean;
} {
  if (params.processedBattleIds.includes(params.battleId)) {
    return {
      gold: 0,
      metalShards: 0,
      energyCrystals: 0,
      elementalEssence: 0,
      evolutionTokens: 0,
      legendaryFragments: 0,
      xp: 0,
      alreadyClaimed: true,
    };
  }

  const diffMult: Record<DifficultyLevel, number> = {
    Easy: 1.0,
    Normal: 1.35,
    Hard: 1.75,
    Expert: 2.3,
  };

  const waveBonus = params.isSurvival && params.survivalWave ? 1 + params.survivalWave * 0.12 : 1.0;
  const shadowBonus = params.isShadowPvP ? 1.18 : 1.0;
  const revengeBonus = params.isRevengeMatch ? 1.35 : 1.0;
  const mult =
    diffMult[params.difficulty] *
    (params.isTournament ? 1.3 : 1.0) *
    (params.isBoss ? 1.5 : 1.0) *
    waveBonus *
    shadowBonus *
    revengeBonus;
  const finishBonus =
    params.finishReason === 'BurstFinish' || params.finishReason === 'Knockout'
      ? 1.25
      : params.finishReason === 'RingOut'
        ? 1.15
        : 1.0;

  if (!params.won) {
    return {
      gold: Math.round(35 * mult),
      metalShards: Math.round(6 * mult),
      energyCrystals: 2,
      elementalEssence: 3,
      evolutionTokens: 0,
      legendaryFragments: 0,
      xp: Math.round(30 * mult),
      alreadyClaimed: false,
    };
  }

  const waveFragments =
    params.isSurvival && params.survivalWave && params.survivalWave % 3 === 0 ? 1 : 0;
  const revengeFragments = params.isRevengeMatch ? 1 : 0;

  return {
    gold: Math.round(115 * mult * finishBonus),
    metalShards: Math.round(18 * mult),
    energyCrystals: Math.round(8 * mult),
    elementalEssence: Math.round(10 * mult),
    evolutionTokens:
      params.isTournament || params.isBoss
        ? 1
        : params.difficulty === 'Hard' || params.difficulty === 'Expert'
          ? 1
          : 0,
    legendaryFragments: (params.isBoss ? 2 : 0) + waveFragments + revengeFragments,
    xp: Math.round(75 * mult * finishBonus),
    alreadyClaimed: false,
  };
}

export function createDefaultCharacterProfile(): CharacterProfile {
  return {
    created: false,
    name: 'Commander Zero',
    title: 'Arena Challenger',
    appearance: {
      hairStyle: 'spiky',
      hairColor: '#38bdf8',
      outfitColor: '#1d4ed8',
      accentColor: '#f97316',
    },
    stats: {
      strength: CHARACTER_BASE_STAT,
      agility: CHARACTER_BASE_STAT,
      focus: CHARACTER_BASE_STAT,
      luck: CHARACTER_BASE_STAT,
    },
    createdAtMs: Date.now(),
  };
}

export function validateCharacterProfile(profile: CharacterProfile): {
  valid: boolean;
  error?: string;
} {
  const trimmed = profile.name.trim();
  if (trimmed.length < 2 || trimmed.length > 24) {
    return { valid: false, error: 'Name must be between 2 and 24 characters.' };
  }
  const { strength, agility, focus, luck } = profile.stats;
  for (const val of [strength, agility, focus, luck]) {
    if (!Number.isInteger(val) || val < CHARACTER_BASE_STAT || val > CHARACTER_MAX_STAT) {
      return {
        valid: false,
        error: `Each attribute must be between ${CHARACTER_BASE_STAT} and ${CHARACTER_MAX_STAT}.`,
      };
    }
  }
  const sum = strength + agility + focus + luck;
  if (sum > CHARACTER_TOTAL_BUDGET) {
    return {
      valid: false,
      error: `Total attribute points cannot exceed ${CHARACTER_TOTAL_BUDGET}.`,
    };
  }
  return { valid: true };
}

export function evaluateBattleScoreBreakdown(params: {
  won: boolean;
  finishReason: FinishReason;
  difficulty: DifficultyLevel;
  isBoss: boolean;
  isTournament: boolean;
  collisionCount: number;
  abilitiesUsed: number;
  launchQuality: number;
  perfectLaunch?: boolean;
  playerRemainingStamina: number;
  playerRemainingDurability: number;
  discoveredSecrets: string[];
  alreadyClaimed: boolean;
}): BattleScoreBreakdown {
  if (params.alreadyClaimed) {
    return {
      basePoints: 0,
      finishBonusPoints: 0,
      tacticalClashPoints: 0,
      abilityMasteryPoints: 0,
      perfectLaunchPoints: 0,
      secretBonusPoints: 0,
      totalPointsEarned: 0,
      newlyDiscoveredSecrets: [],
    };
  }

  const diffMult: Record<DifficultyLevel, number> = {
    Easy: 1.0,
    Normal: 1.35,
    Hard: 1.75,
    Expert: 2.25,
  };
  const mult = diffMult[params.difficulty] * (params.isTournament ? 1.25 : 1.0) * (params.isBoss ? 1.4 : 1.0);

  const basePoints = params.won ? Math.round(140 * mult) : Math.round(35 * diffMult[params.difficulty]);
  const finishBonusPoints = !params.won
    ? 0
    : params.finishReason === 'BurstFinish' || params.finishReason === 'Knockout'
      ? 160
      : params.finishReason === 'RingOut'
        ? 140
        : params.finishReason === 'SpinFinish'
          ? 100
          : 75;

  const tacticalClashPoints = Math.min(180, Math.max(0, params.collisionCount) * 14);
  const abilityMasteryPoints = Math.min(160, Math.max(0, params.abilitiesUsed) * 35);
  const perfectLaunchPoints =
    params.perfectLaunch || params.launchQuality >= 1.13
      ? 120
      : params.launchQuality >= 1.05
        ? 60
        : 0;

  // Detect battle-triggered hidden secrets
  const newlyDiscoveredSecrets: string[] = [];
  if (
    params.launchQuality >= 1.15 &&
    !params.discoveredSecrets.includes('secret.perfect_ripcord')
  ) {
    newlyDiscoveredSecrets.push('secret.perfect_ripcord');
  }
  if (
    params.won &&
    params.finishReason === 'RingOut' &&
    !params.discoveredSecrets.includes('secret.ring_out_gate')
  ) {
    newlyDiscoveredSecrets.push('secret.ring_out_gate');
  }
  if (
    params.won &&
    (params.playerRemainingStamina < 35 || params.playerRemainingDurability < 35) &&
    !params.discoveredSecrets.includes('secret.critical_comeback')
  ) {
    newlyDiscoveredSecrets.push('secret.critical_comeback');
  }

  const secretBonusPoints = newlyDiscoveredSecrets.reduce((sum, id) => {
    const def = getSecretDefinition(id);
    return sum + (def?.points ?? 0);
  }, 0);

  const totalPointsEarned =
    basePoints +
    finishBonusPoints +
    tacticalClashPoints +
    abilityMasteryPoints +
    perfectLaunchPoints +
    secretBonusPoints;

  return {
    basePoints,
    finishBonusPoints,
    tacticalClashPoints,
    abilityMasteryPoints,
    perfectLaunchPoints,
    secretBonusPoints,
    totalPointsEarned,
    newlyDiscoveredSecrets,
  };
}

export function getDecisionAlignmentTotals(decisionHistory: Record<string, string>): {
  good: number;
  bad: number;
  neutral: number;
  answeredCount: number;
} {
  let good = 0;
  let bad = 0;
  let neutral = 0;
  let answeredCount = 0;

  for (const node of STORY_DECISIONS) {
    const pickedId = decisionHistory[node.id];
    if (!pickedId) continue;
    const choice = node.choices.find((c) => c.id === pickedId);
    if (!choice) continue;
    answeredCount += 1;
    if (choice.alignment === 'good') good += 1;
    else if (choice.alignment === 'bad') bad += 1;
    else neutral += 1;
  }

  return { good, bad, neutral, answeredCount };
}

export function resolveStoryEnding(save: Pick<PlayerSaveData, 'decisionHistory' | 'playerScore' | 'discoveredSecrets'>): EndingDefinition {
  const { good, bad } = getDecisionAlignmentTotals(save.decisionHistory);

  if (good >= 2 && good > bad) {
    if (save.playerScore >= 2200 && save.discoveredSecrets.length >= 3) {
      return getEndingDefinition('ending.legend');
    }
    return getEndingDefinition('ending.good');
  }

  if (bad >= 2 && bad >= good) {
    return getEndingDefinition('ending.bad');
  }

  return getEndingDefinition('ending.neutral');
}

export function buildSortedLeaderboard(save: PlayerSaveData): LeaderboardEntry[] {
  const totalWins = save.ownedTops.reduce((acc, t) => acc + t.wins, 0);
  const activeEnding = save.activeEndingId
    ? ENDINGS_CATALOG.find((e) => e.id === save.activeEndingId)?.type.toUpperCase() ?? 'ACTIVE'
    : save.character.created
      ? 'ACTIVE'
      : 'ROOKIE';

  const currentPlayerEntry: LeaderboardEntry = {
    id: 'player-current',
    name: save.character.name || 'Commander Zero',
    title: save.character.title || 'Arena Challenger',
    score: save.playerScore,
    wins: totalWins,
    secretsFound: save.discoveredSecrets.length,
    endingBadge: activeEnding,
    isPlayer: true,
    appearance: save.character.appearance,
  };

  const merged = [
    ...SEEDED_LEADERBOARD_ENTRIES,
    ...save.leaderboardEntries.filter((e) => e.id !== 'player-current'),
    currentPlayerEntry,
  ];

  return merged.sort((a, b) => b.score - a.score || b.wins - a.wins);
}

export function createDefaultKeyBindings(): KeyBindings {
  return {
    ability1: 'q',
    ability2: 'e',
    ability3: 'r',
    ability4: 'f',
    launch: ' ',
    teamSwitch: 'tab',
    pause: 'Escape',
    cameraCycle: 'c',
    tactical1: '1',
    tactical2: '2',
    tactical3: '3',
    tactical4: '4',
    tactical5: '5',
    tactical6: '6',
    tactical7: '7',
    tactical8: '8',
  };
}

export function validateContentCatalog(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const checkUniqueIds = (label: string, items: { id: string }[]) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id || item.id.trim().length === 0) {
        errors.push(`${label}: empty id`);
      } else if (seen.has(item.id)) {
        errors.push(`${label}: duplicate id '${item.id}'`);
      }
      seen.add(item.id);
    }
    return seen;
  };

  const topIds = checkUniqueIds('TOP_DEFINITIONS', TOP_DEFINITIONS);
  const compIds = checkUniqueIds('COMPONENTS', COMPONENTS);
  const abilityIds = checkUniqueIds('ABILITIES', ABILITIES);
  checkUniqueIds('OPPONENTS', OPPONENTS);
  checkUniqueIds('EVOLUTION_PATHS', EVOLUTION_PATHS);
  checkUniqueIds('MISSIONS_CATALOG', MISSIONS_CATALOG);
  checkUniqueIds('SECRETS_CATALOG', SECRETS_CATALOG);
  checkUniqueIds('STORY_DECISIONS', STORY_DECISIONS);
  checkUniqueIds('ENDINGS_CATALOG', ENDINGS_CATALOG);

  for (const comp of COMPONENTS) {
    if (!Number.isFinite(comp.massKg) || comp.massKg <= 0) {
      errors.push(`Component '${comp.id}' has invalid massKg (${comp.massKg})`);
    }
    if (!Number.isFinite(comp.durability) || comp.durability <= 0) {
      errors.push(`Component '${comp.id}' has invalid durability (${comp.durability})`);
    }
    if (!Number.isFinite(comp.rotationalDrag) || comp.rotationalDrag < 0) {
      errors.push(`Component '${comp.id}' has invalid rotationalDrag`);
    }
    if (!Number.isFinite(comp.groundFriction) || comp.groundFriction < 0) {
      errors.push(`Component '${comp.id}' has invalid groundFriction`);
    }
    if (!Number.isFinite(comp.restitution) || comp.restitution < 0) {
      errors.push(`Component '${comp.id}' has invalid restitution`);
    }
    if (!Number.isFinite(comp.unlockCostGold) || comp.unlockCostGold < 0) {
      errors.push(`Component '${comp.id}' has negative unlockCostGold`);
    }
  }

  for (const ab of ABILITIES) {
    if (!Number.isFinite(ab.energyCost) || ab.energyCost < 0) {
      errors.push(`Ability '${ab.id}' has invalid energyCost`);
    }
    if (!Number.isFinite(ab.resonanceCost) || ab.resonanceCost < 0) {
      errors.push(`Ability '${ab.id}' has invalid resonanceCost`);
    }
    if (!Number.isFinite(ab.cooldownSec) || ab.cooldownSec <= 0) {
      errors.push(`Ability '${ab.id}' has invalid cooldownSec`);
    }
    if (!Number.isFinite(ab.durationSec) || ab.durationSec < 0) {
      errors.push(`Ability '${ab.id}' has invalid durationSec`);
    }
    if (!Number.isFinite(ab.power) || ab.power <= 0) {
      errors.push(`Ability '${ab.id}' has invalid power`);
    }
  }

  for (const top of TOP_DEFINITIONS) {
    if (!Number.isFinite(top.unlockCostGold) || top.unlockCostGold < 0) {
      errors.push(`Top '${top.id}' has invalid unlockCostGold`);
    }
    const compCheck = validateTopConfiguration(top.defaultComponents);
    if (!compCheck.valid) {
      errors.push(`Top '${top.id}' invalid defaultComponents: ${compCheck.errors.join(', ')}`);
    }
    if (top.defaultAbilities.length !== 4 || new Set(top.defaultAbilities).size !== 4) {
      errors.push(`Top '${top.id}' must have 4 unique defaultAbilities`);
    }
    for (const abId of top.defaultAbilities) {
      if (!abilityIds.has(abId)) {
        errors.push(`Top '${top.id}' references unknown ability '${abId}'`);
      }
    }
    for (const [k, v] of Object.entries(top.baseAttributes)) {
      if (!Number.isFinite(v) || v <= 0) {
        errors.push(`Top '${top.id}' has invalid baseAttribute '${k}' (${v})`);
      }
    }
  }

  for (const arena of Object.values(ARENAS)) {
    if (!Number.isFinite(arena.surfaceFrictionMult) || arena.surfaceFrictionMult <= 0) {
      errors.push(`Arena '${arena.id}' has invalid surfaceFrictionMult`);
    }
    if (!Number.isFinite(arena.wallRestitution) || arena.wallRestitution < 0 || arena.wallRestitution > 1) {
      errors.push(`Arena '${arena.id}' has invalid wallRestitution`);
    }
  }

  const arenaIds = new Set(Object.keys(ARENAS));
  for (const opp of OPPONENTS) {
    if (!topIds.has(opp.topId)) {
      errors.push(`Opponent '${opp.id}' references unknown topId '${opp.topId}'`);
    }
    if (opp.preferredArenaId && !arenaIds.has(opp.preferredArenaId)) {
      errors.push(`Opponent '${opp.id}' references unknown preferredArenaId '${opp.preferredArenaId}'`);
    }
    const compCheck = validateTopConfiguration(opp.components);
    if (!compCheck.valid) {
      errors.push(`Opponent '${opp.id}' invalid components: ${compCheck.errors.join(', ')}`);
    }
    for (const cid of Object.values(opp.components)) {
      if (!compIds.has(cid)) {
        errors.push(`Opponent '${opp.id}' missing component '${cid}'`);
      }
    }
    for (const abId of opp.abilities) {
      if (!abilityIds.has(abId)) {
        errors.push(`Opponent '${opp.id}' references unknown ability '${abId}'`);
      }
    }
  }

  for (const m of MISSIONS_CATALOG) {
    if (!Number.isFinite(m.target) || m.target <= 0) {
      errors.push(`Mission '${m.id}' has invalid target`);
    }
  }

  for (const el of Object.keys(ELEMENTS) as ElementType[]) {
    if (!TOP_DEFINITIONS.some((t) => t.element === el)) {
      errors.push(`Element '${el}' has no matching TopDefinition`);
    }
    if (!ABILITIES.some((a) => a.type === 'Ultimate' && a.element === el)) {
      errors.push(`Element '${el}' has no matching signature Ultimate ability`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function createDefaultCosmetics(primaryColor: string, trimColor: string): CosmeticCustomization {
  return {
    primaryColor,
    trimColor,
    trailColor: primaryColor,
    pattern: 'solid',
    victoryEmote: 'apex_flare',
  };
}

export function createEmptyCareerStats(): TopCareerStats {
  return {
    matches: 0,
    wins: 0,
    losses: 0,
    totalClashes: 0,
    peakImpulse: 0,
    burstFinishes: 0,
    ringOutFinishes: 0,
    spinFinishes: 0,
    knockoutFinishes: 0,
  };
}

export function getCurrentDailyResetKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
    now.getUTCDate()
  ).padStart(2, '0')}`;
}

export function getCapacitorUpgradeCost(currentLevel: number): {
  energyCrystals: number;
  gold: number;
} {
  return {
    energyCrystals: 10 + currentLevel * 8,
    gold: 120 + currentLevel * 90,
  };
}

export function buildTournamentBracket(bracketSize: 4 | 8 | 16): {
  opponentIds: string[];
  arenaIds: ArenaId[];
} {
  const allArenaIds = Object.keys(ARENAS) as ArenaId[];
  const nonBoss = OPPONENTS.filter((o) => !o.isBoss);
  const bosses = OPPONENTS.filter((o) => o.isBoss);
  const opponentIds: string[] = [];
  const arenaIds: ArenaId[] = [];

  for (let i = 0; i < bracketSize; i++) {
    if (i === bracketSize - 1) {
      opponentIds.push(bosses[0]?.id ?? OPPONENTS[OPPONENTS.length - 1].id);
    } else {
      const idx = Math.floor((i / Math.max(1, bracketSize - 1)) * nonBoss.length);
      opponentIds.push(nonBoss[Math.min(nonBoss.length - 1, idx)].id);
    }
    arenaIds.push(allArenaIds[i % allArenaIds.length]);
  }
  return { opponentIds, arenaIds };
}

export interface ComponentComparisonResult {
  massDeltaGrams: number;
  durabilityDelta: number;
  frictionDelta: number;
  restitutionDelta: number;
  attributeDeltas: Partial<AttributeSet>;
}

export function compareComponents(
  equipped: ComponentDefinition,
  candidate: ComponentDefinition
): ComponentComparisonResult {
  const keys: (keyof AttributeSet)[] = [
    'attack',
    'defense',
    'stamina',
    'speed',
    'stability',
    'control',
    'energy',
    'critical',
  ];
  const attributeDeltas: Partial<AttributeSet> = {};
  for (const k of keys) {
    const d = (candidate.modifiers[k] ?? 0) - (equipped.modifiers[k] ?? 0);
    if (d !== 0) attributeDeltas[k] = d;
  }
  return {
    massDeltaGrams: Math.round((candidate.massKg - equipped.massKg) * 1000),
    durabilityDelta: Math.round(candidate.durability - equipped.durability),
    frictionDelta: Number((candidate.groundFriction - equipped.groundFriction).toFixed(2)),
    restitutionDelta: Number((candidate.restitution - equipped.restitution).toFixed(2)),
    attributeDeltas,
  };
}

export function filterAndSortComponents(
  list: ComponentDefinition[],
  filters: {
    search?: string;
    rarity?: Rarity | 'All';
    element?: ElementType | 'All';
    sortBy?: 'rarity' | 'cost' | 'durability' | 'name';
  }
): ComponentDefinition[] {
  const rarityRank: Record<Rarity, number> = {
    Common: 1,
    Uncommon: 2,
    Rare: 3,
    Epic: 4,
    Legendary: 5,
    Mythic: 6,
  };
  const q = (filters.search ?? '').trim().toLowerCase();
  const filtered = list.filter((c) => {
    if (filters.rarity && filters.rarity !== 'All' && c.rarity !== filters.rarity) return false;
    if (filters.element && filters.element !== 'All' && c.elementAffinity !== filters.element) {
      return false;
    }
    if (q && !c.displayName.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sortBy) {
      case 'cost':
        return a.unlockCostGold - b.unlockCostGold;
      case 'durability':
        return b.durability - a.durability;
      case 'name':
        return a.displayName.localeCompare(b.displayName);
      case 'rarity':
      default:
        return rarityRank[b.rarity] - rarityRank[a.rarity];
    }
  });
}

export function createDefaultSaveData(): PlayerSaveData {
  const starterTop = TOP_DEFINITIONS[0];
  const secondaryTop = TOP_DEFINITIONS[1];
  const thirdTop = TOP_DEFINITIONS[2];

  const starterElem = ELEMENTS[starterTop.element];
  const secondaryElem = ELEMENTS[secondaryTop.element];
  const thirdElem = ELEMENTS[thirdTop.element];

  const starterOwned: OwnedTopState = {
    instanceId: 'owned-top-ignis',
    definitionId: starterTop.id,
    level: 2,
    experience: 40,
    evolutionStage: 0,
    evolutionPathId: null,
    secondaryElement: null,
    equippedComponents: { ...starterTop.defaultComponents },
    equippedAbilities: [...starterTop.defaultAbilities],
    cosmetics: createDefaultCosmetics(starterElem.primaryColor, starterElem.secondaryColor),
    wins: 0,
    losses: 0,
    careerStats: createEmptyCareerStats(),
  };

  const secondaryOwned: OwnedTopState = {
    instanceId: 'owned-top-aegis',
    definitionId: secondaryTop.id,
    level: 1,
    experience: 0,
    evolutionStage: 0,
    evolutionPathId: null,
    secondaryElement: null,
    equippedComponents: { ...secondaryTop.defaultComponents },
    equippedAbilities: [...secondaryTop.defaultAbilities],
    cosmetics: createDefaultCosmetics(secondaryElem.primaryColor, secondaryElem.secondaryColor),
    wins: 0,
    losses: 0,
    careerStats: createEmptyCareerStats(),
  };

  const thirdOwned: OwnedTopState = {
    instanceId: 'owned-top-volt',
    definitionId: thirdTop.id,
    level: 1,
    experience: 0,
    evolutionStage: 0,
    evolutionPathId: null,
    secondaryElement: null,
    equippedComponents: { ...thirdTop.defaultComponents },
    equippedAbilities: [...thirdTop.defaultAbilities],
    cosmetics: createDefaultCosmetics(thirdElem.primaryColor, thirdElem.secondaryColor),
    wins: 0,
    losses: 0,
    careerStats: createEmptyCareerStats(),
  };

  const starterUnlockedComponents = COMPONENTS.filter(
    (c) => c.unlockCostGold === 0 || c.rarity === 'Uncommon'
  ).map((c) => c.id);

  const bracket = buildTournamentBracket(4);
  const initialMissions: Record<string, { progress: number; claimed: boolean }> = {};
  for (const m of MISSIONS_CATALOG) {
    initialMissions[m.id] = { progress: 0, claimed: false };
  }

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    playerId: 'local-commander',
    updatedAtMs: Date.now(),
    playerLevel: 1,
    playerExperience: 0,
    playerScore: 0,
    scoreLog: [],
    discoveredSecrets: [],
    character: createDefaultCharacterProfile(),
    decisionHistory: {},
    unlockedEndingIds: [],
    activeEndingId: null,
    leaderboardEntries: [],
    currencies: {
      gold: 420,
      metalShards: 60,
      energyCrystals: 24,
      elementalEssence: 20,
      evolutionTokens: 2,
      legendaryFragments: 0,
    },
    ownedTops: [starterOwned, secondaryOwned, thirdOwned],
    unlockedTopIds: [starterTop.id, secondaryTop.id, thirdTop.id],
    unlockedComponentIds: starterUnlockedComponents,
    componentUpgradeLevels: {},
    selectedTopInstanceId: starterOwned.instanceId,
    teamTopInstanceIds: [starterOwned.instanceId, secondaryOwned.instanceId, thirdOwned.instanceId],
    selectedArenaId: 'standard',
    presets: [
      {
        id: 'preset-rush',
        name: 'Crimson Striker',
        topInstanceId: starterOwned.instanceId,
        components: { ...starterTop.defaultComponents },
        abilities: [...starterTop.defaultAbilities],
        secondaryElement: null,
        cosmetics: createDefaultCosmetics(starterElem.primaryColor, starterElem.secondaryColor),
        preferredMode: 'Attack',
        preferredCommand: 'Aggressive',
      },
      {
        id: 'preset-bastion',
        name: 'Hydro Bastion',
        topInstanceId: secondaryOwned.instanceId,
        components: { ...secondaryTop.defaultComponents },
        abilities: [...secondaryTop.defaultAbilities],
        secondaryElement: null,
        cosmetics: createDefaultCosmetics(secondaryElem.primaryColor, secondaryElem.secondaryColor),
        preferredMode: 'Defense',
        preferredCommand: 'Defensive',
      },
    ],
    processedBattleIds: [],
    tournament: {
      active: false,
      bracketSize: 4,
      currentRound: 0,
      completedRounds: 0,
      bracketOpponentIds: bracket.opponentIds,
      arenaIds: bracket.arenaIds,
      championshipsWon: 0,
    },
    survivalBestWave: 0,
    bossDefeatedIds: [],
    capacitorLevel: 0,
    visitedArenaIds: ['standard'],
    missionProgress: initialMissions,
    dailyMissionResetKey: getCurrentDailyResetKey(),
    settings: {
      graphicsQuality: 'High',
      masterVolume: 0.7,
      muted: false,
      cameraSensitivity: 1.0,
      debugMode: false,
      cameraPreset: 'Broadcast',
      uiScale: 1.0,
      dynamicMusic: true,
      gamepadEnabled: true,
      showDiagnostics: false,
      reducedMotion: false,
      dynamicClashCamera: true,
      keyBindings: createDefaultKeyBindings(),
    },
    matchHistory: [],
    rivals: [],
    claimedSeasonRewardTiers: [],
    preferredMutators: { ...DEFAULT_BATTLE_MUTATORS },
    preferredWeather: 'Clear',
    pvpMmr: 1000,
  };
}

export function sanitizeBattleMutators(raw: unknown): BattleMutators {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BATTLE_MUTATORS };
  const obj = raw as Partial<Record<keyof BattleMutators, unknown>>;
  return {
    noAbilities: Boolean(obj.noAbilities),
    doubleGravity: Boolean(obj.doubleGravity),
    turboSpin: Boolean(obj.turboSpin),
    ringOutOnly: Boolean(obj.ringOutOnly),
    doubleHazards: Boolean(obj.doubleHazards),
  };
}

export function hasActiveMutators(mutators?: Partial<BattleMutators> | null): boolean {
  if (!mutators) return false;
  return Boolean(
    mutators.noAbilities ||
      mutators.doubleGravity ||
      mutators.turboSpin ||
      mutators.ringOutOnly ||
      mutators.doubleHazards
  );
}

export function getActiveMutatorLabels(mutators?: Partial<BattleMutators> | null): string[] {
  if (!mutators) return [];
  return MUTATOR_DEFINITIONS.filter((m) => Boolean(mutators[m.id])).map((m) => m.shortLabel);
}

export function isPowerInPerfectWindow(powerRatio: number): boolean {
  return Number.isFinite(powerRatio) && powerRatio >= PERFECT_LAUNCH_MIN && powerRatio <= PERFECT_LAUNCH_MAX;
}

export function getRankTierForMmr(mmr: number): RankTierDefinition {
  const safeMmr = Number.isFinite(mmr) ? mmr : 1000;
  let matched = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (safeMmr >= tier.minMmr) matched = tier;
  }
  return matched;
}

export const getRankTier = getRankTierForMmr;

export function getNextRankTier(mmr: number): RankTierDefinition | null {
  const safeMmr = Number.isFinite(mmr) ? mmr : 1000;
  for (const tier of RANK_TIERS) {
    if (safeMmr < tier.minMmr) return tier;
  }
  return null;
}

export function getTierProgressPct(mmr: number): number {
  const current = getRankTierForMmr(mmr);
  const next = getNextRankTier(mmr);
  if (!next) return 100;
  const span = Math.max(1, next.minMmr - current.minMmr);
  return Math.max(0, Math.min(100, Math.round(((mmr - current.minMmr) / span) * 100)));
}

export function applySeasonSoftReset(mmr: number): number {
  const safeMmr = Number.isFinite(mmr) ? mmr : 1000;
  return Math.max(850, Math.round(1000 + (safeMmr - 1000) * 0.5));
}

export function getSeasonTierClaimKey(seasonNumber: number, tierId: RankTierId): string {
  return `S${seasonNumber}:${tierId}`;
}

export function getCounterElementFor(element: ElementType): ElementType {
  const entry = (Object.keys(ELEMENTS) as ElementType[]).find((el) =>
    ELEMENTS[el].strongAgainst.includes(element)
  );
  return entry ?? 'Light';
}

export const getCounterElement = getCounterElementFor;

export function inferAiPersonalityFromBuild(
  components: EquippedComponents,
  topDefId: string
): AIPersonality {
  const blade = getComponentDefinition(components.AttackBlade);
  const armor = getComponentDefinition(components.ArmorRing);
  const driver = getComponentDefinition(components.PerformanceDriver);
  const topDef = getTopDefinition(topDefId);

  const driverType = driver.visual.driverType;
  if (driverType === 'flat' && blade.modifiers.attack && blade.modifiers.attack >= 4) {
    return 'Aggressive';
  }
  if (armor.modifiers.defense && armor.modifiers.defense >= 4) {
    return 'Defensive';
  }
  if (driverType === 'rubber' || topDef.archetype === 'Defender') {
    return 'Adaptive';
  }
  if ((blade.modifiers.speed ?? 0) >= 4 || driverType === 'ball') {
    return 'Evasive';
  }
  if (blade.massKg >= 0.032) {
    return 'HeavyAssault';
  }
  return 'Tactical';
}

export function buildSeededShadowOpponents(): ShadowOpponentProfile[] {
  return OPPONENTS.slice(0, 6).map((opp, idx) => {
    const topDef = getTopDefinition(opp.topId);
    const seedLb = SEEDED_LEADERBOARD_ENTRIES[idx % SEEDED_LEADERBOARD_ENTRIES.length];
    const mmr = 1120 + idx * 145;
    const elem = ELEMENTS[topDef.element];
    return {
      id: `shadow-seed-${opp.id}`,
      playerId: `shadow-${opp.id}`,
      handle: seedLb?.name ?? opp.displayName,
      title: opp.title,
      element: topDef.element,
      secondaryElement: opp.secondaryElement ?? null,
      mmr,
      wins: 12 + idx * 7,
      losses: 3 + idx * 2,
      rankTier: getRankTierForMmr(mmr).id,
      topDefinitionId: topDef.id,
      topDisplayName: topDef.displayName,
      level: opp.level,
      evolutionStage: opp.isBoss ? 1 : 0,
      evolutionPathId: opp.isBoss ? 'evo.hybrid' : null,
      equippedComponents: { ...opp.components },
      equippedAbilities: [...opp.abilities],
      cosmetics: createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
      aiPersonality: opp.personality,
      aiDifficulty: opp.difficulty,
      source: 'seed',
      appearance: seedLb?.appearance ?? createDefaultCharacterProfile().appearance,
    };
  });
}

export function recordMatchInHistory(
  history: MatchHistoryEntry[],
  entry: MatchHistoryEntry
): MatchHistoryEntry[] {
  const deduped = history.filter((m) => m.battleId !== entry.battleId);
  return [entry, ...deduped].slice(0, 10);
}

export function upsertRivalOnLoss(
  rivals: RivalRecord[],
  params: {
    playerId: string;
    handle: string;
    sourceMode: 'ShadowPvP' | 'OnlineFriendly' | 'OnlineRanked';
    topDefinitionId: string;
    element: ElementType;
    secondaryElement?: ElementType | null;
    level?: number;
    evolutionStage?: number;
    evolutionPathId?: string | null;
    equippedComponents?: EquippedComponents;
    equippedAbilities?: [string, string, string, string];
    cosmetics?: CosmeticCustomization;
    appearance?: CharacterAppearance;
    mmr?: number;
  }
): RivalRecord[] {
  const topDef = getTopDefinition(params.topDefinitionId);
  const existing = rivals.find((r) => r.playerId === params.playerId || r.handle === params.handle);
  const nextRecord: RivalRecord = {
    id: existing?.id ?? `rival-${params.playerId}`,
    playerId: params.playerId,
    handle: params.handle.slice(0, 24),
    sourceMode: params.sourceMode,
    topDefinitionId: topDef.id,
    topDisplayName: topDef.displayName,
    element: params.element,
    secondaryElement: params.secondaryElement ?? null,
    level: Math.max(1, params.level ?? 1),
    evolutionStage: params.evolutionStage === 1 ? 1 : 0,
    evolutionPathId: params.evolutionPathId ?? null,
    equippedComponents: params.equippedComponents
      ? { ...params.equippedComponents }
      : { ...topDef.defaultComponents },
    equippedAbilities: params.equippedAbilities
      ? [...params.equippedAbilities]
      : [...topDef.defaultAbilities],
    cosmetics: params.cosmetics,
    appearance: params.appearance,
    mmr: params.mmr ?? existing?.mmr ?? 1050,
    lossesToRival: (existing?.lossesToRival ?? 0) + 1,
    winsAgainstRival: existing?.winsAgainstRival ?? 0,
    status: 'unavenged',
    lastEncounterMs: Date.now(),
    recommendedCounterElement: getCounterElementFor(params.element),
  };
  return [nextRecord, ...rivals.filter((r) => r.id !== nextRecord.id)].slice(0, 12);
}

export function markRivalAvenged(rivals: RivalRecord[], rivalPlayerIdOrHandle: string): RivalRecord[] {
  return rivals.map((r) =>
    r.playerId === rivalPlayerIdOrHandle || r.handle === rivalPlayerIdOrHandle
      ? {
          ...r,
          winsAgainstRival: r.winsAgainstRival + 1,
          status: 'avenged' as const,
          lastEncounterMs: Date.now(),
        }
      : r
  );
}
