import {
  AbilityDefinition,
  ArenaDefinition,
  ArenaId,
  BattleMode,
  ComponentCategory,
  ComponentDefinition,
  ElementDefinition,
  ElementType,
  EndingDefinition,
  EvolutionPath,
  HairStyleId,
  LeaderboardEntry,
  OpponentDefinition,
  SecretDefinition,
  StoryDecisionNode,
  TacticalCommand,
  TopDefinition,
  VictoryEmoteDefinition,
  VictoryEmoteId,
  WeatherDefinition,
  WeatherType,
} from './types';
import {
  ARENAS,
  EXPANSION_ABILITIES,
  EXPANSION_COMPONENTS,
  EXPANSION_OPPONENTS,
  EXPANSION_TOP_DEFINITIONS,
  MISSIONS_CATALOG,
  SECONDARY_ELEMENTS,
} from './expansionCatalog';

export { ARENAS, MISSIONS_CATALOG };

export const COMPONENT_CATEGORIES: { id: ComponentCategory; label: string; shortLabel: string }[] = [
  { id: 'SpiritCore', label: 'Spirit Core', shortLabel: 'Core' },
  { id: 'AttackBlade', label: 'Attack Blade', shortLabel: 'Blade' },
  { id: 'ArmorRing', label: 'Armor Ring', shortLabel: 'Armor' },
  { id: 'WeightDisc', label: 'Weight Disc', shortLabel: 'Weight' },
  { id: 'PerformanceDriver', label: 'Performance Driver', shortLabel: 'Driver' },
  { id: 'EnergyModule', label: 'Energy Module', shortLabel: 'Energy' },
];

export const ELEMENTS: Record<ElementType, ElementDefinition> = {
  Fire: {
    id: 'Fire',
    displayName: 'Pyro Core',
    primaryColor: '#ff5a2f',
    secondaryColor: '#ffb347',
    emissiveHex: 0xff4d1a,
    primaryHex: 0xff5a2f,
    secondaryHex: 0xffb347,
    strongAgainst: ['Ice', 'Wind'],
    weakAgainst: ['Water', 'Earth'],
    passiveLabel: '+8% Clash Burn Impulse',
  },
  Water: {
    id: 'Water',
    displayName: 'Hydro Core',
    primaryColor: '#22b8ff',
    secondaryColor: '#7ce8ff',
    emissiveHex: 0x0ea5e9,
    primaryHex: 0x22b8ff,
    secondaryHex: 0x7ce8ff,
    strongAgainst: ['Fire', 'Earth'],
    weakAgainst: ['Lightning', 'Wind'],
    passiveLabel: '+12% Energy Flow Regen',
  },
  Ice: {
    id: 'Ice',
    displayName: 'Cryo Core',
    primaryColor: '#7dd3fc',
    secondaryColor: '#e0f2fe',
    emissiveHex: 0x38bdf8,
    primaryHex: 0x7dd3fc,
    secondaryHex: 0xe0f2fe,
    strongAgainst: ['Lightning', 'Wind'],
    weakAgainst: ['Fire', 'Light'],
    passiveLabel: '+10% Gyro Stability',
  },
  Lightning: {
    id: 'Lightning',
    displayName: 'Volt Core',
    primaryColor: '#facc15',
    secondaryColor: '#a855f7',
    emissiveHex: 0xeab308,
    primaryHex: 0xfacc15,
    secondaryHex: 0xa855f7,
    strongAgainst: ['Water', 'Wind'],
    weakAgainst: ['Ice', 'Earth'],
    passiveLabel: '+10% Thrust Acceleration',
  },
  ...SECONDARY_ELEMENTS,
};

// Modular Mechanical Components across all 6 categories (including Mythic & secondary-element gear)
export const COMPONENTS: ComponentDefinition[] = [
  // === SPIRIT CORES (6) ===
  {
    id: 'core.ignis',
    displayName: 'Ignis Reactor',
    description: 'High-output thermal core built for relentless strike momentum.',
    category: 'SpiritCore',
    rarity: 'Common',
    elementAffinity: 'Fire',
    massKg: 0.014,
    radiusContribution: 0.002,
    rotationalDrag: 0.003,
    groundFriction: 0,
    restitution: 0.05,
    durability: 18,
    modifiers: { attack: 16, critical: 12, energy: 8 },
    visual: { primaryColor: 0xff5a2f, accentColor: 0xffc857, metalness: 0.45, roughness: 0.2 },
    unlockCostGold: 0,
  },
  {
    id: 'core.aegis',
    displayName: 'Aegis Tide',
    description: 'Pressurized hydro-gyro core that stabilizes heavy impacts.',
    category: 'SpiritCore',
    rarity: 'Common',
    elementAffinity: 'Water',
    massKg: 0.016,
    radiusContribution: 0.002,
    rotationalDrag: 0.002,
    groundFriction: 0,
    restitution: 0.02,
    durability: 24,
    modifiers: { defense: 16, stability: 12, energy: 10 },
    visual: { primaryColor: 0x0ea5e9, accentColor: 0x7ce8ff, metalness: 0.4, roughness: 0.2 },
    unlockCostGold: 0,
  },
  {
    id: 'core.volt',
    displayName: 'Volt Capacitor',
    description: 'Arc-charged rotor core enhancing maneuverability and resonance.',
    category: 'SpiritCore',
    rarity: 'Uncommon',
    elementAffinity: 'Lightning',
    massKg: 0.013,
    radiusContribution: 0.002,
    rotationalDrag: 0.0025,
    groundFriction: 0,
    restitution: 0.06,
    durability: 18,
    modifiers: { speed: 14, control: 14, energy: 12 },
    visual: { primaryColor: 0xfacc15, accentColor: 0xc084fc, metalness: 0.55, roughness: 0.18 },
    unlockCostGold: 120,
  },
  {
    id: 'core.glacier',
    displayName: 'Cryo Heart',
    description: 'Low-friction cryogenic spindle tuned for marathon spin endurance.',
    category: 'SpiritCore',
    rarity: 'Uncommon',
    elementAffinity: 'Ice',
    massKg: 0.015,
    radiusContribution: 0.002,
    rotationalDrag: 0.0014,
    groundFriction: 0,
    restitution: 0.03,
    durability: 20,
    modifiers: { stamina: 18, stability: 14, defense: 8 },
    visual: { primaryColor: 0x7dd3fc, accentColor: 0xffffff, metalness: 0.35, roughness: 0.15 },
    unlockCostGold: 140,
  },
  {
    id: 'core.crimson',
    displayName: 'Crimson Singularity',
    description: 'Aggressive overdrive core with volatile critical strike output.',
    category: 'SpiritCore',
    rarity: 'Rare',
    elementAffinity: 'Fire',
    massKg: 0.015,
    radiusContribution: 0.003,
    rotationalDrag: 0.0034,
    groundFriction: 0,
    restitution: 0.08,
    durability: 17,
    modifiers: { attack: 20, speed: 10, critical: 16 },
    visual: { primaryColor: 0xef4444, accentColor: 0xf97316, metalness: 0.65, roughness: 0.16 },
    unlockCostGold: 260,
  },
  {
    id: 'core.sovereign',
    displayName: 'Sovereign Apex',
    description: 'Champion-grade balanced plasma core with superior energy density.',
    category: 'SpiritCore',
    rarity: 'Legendary',
    elementAffinity: 'Lightning',
    massKg: 0.016,
    radiusContribution: 0.003,
    rotationalDrag: 0.0018,
    groundFriction: 0,
    restitution: 0.06,
    durability: 24,
    modifiers: { attack: 14, defense: 14, stamina: 14, energy: 16, critical: 12 },
    visual: { primaryColor: 0xf59e0b, accentColor: 0x38bdf8, metalness: 0.85, roughness: 0.14 },
    unlockCostGold: 520,
  },

  // === ATTACK BLADES (6) ===
  {
    id: 'blade.fang',
    displayName: 'Twin-Fang Edge',
    description: 'Sharp 3-point contact blade focused on concentrated knockback strikes.',
    category: 'AttackBlade',
    rarity: 'Common',
    massKg: 0.022,
    radiusContribution: 0.016,
    rotationalDrag: 0.0042,
    groundFriction: 0,
    restitution: 0.16,
    durability: 22,
    modifiers: { attack: 18, critical: 12, speed: 6 },
    visual: { primaryColor: 0xe11d48, accentColor: 0xfda4af, metalness: 0.78, roughness: 0.24, bladeShape: 'sharp', bladeCount: 3 },
    unlockCostGold: 0,
  },
  {
    id: 'blade.bastion',
    displayName: 'Wide Bastion Rim',
    description: 'Broad perimeter profile that absorbs and deflects incoming shocks.',
    category: 'AttackBlade',
    rarity: 'Common',
    massKg: 0.028,
    radiusContribution: 0.017,
    rotationalDrag: 0.0032,
    groundFriction: 0,
    restitution: 0.06,
    durability: 32,
    modifiers: { defense: 18, stability: 10, attack: 6 },
    visual: { primaryColor: 0x0284c7, accentColor: 0xbae6fd, metalness: 0.65, roughness: 0.32, bladeShape: 'wide', bladeCount: 4 },
    unlockCostGold: 0,
  },
  {
    id: 'blade.sawtooth',
    displayName: 'Multi-Point Saw',
    description: '6-tooth serrated alloy wheel delivering rapid multi-hit spin clashes.',
    category: 'AttackBlade',
    rarity: 'Uncommon',
    massKg: 0.024,
    radiusContribution: 0.0165,
    rotationalDrag: 0.0048,
    groundFriction: 0,
    restitution: 0.14,
    durability: 24,
    modifiers: { attack: 15, critical: 18, control: 5 },
    visual: { primaryColor: 0xd97706, accentColor: 0xfef08a, metalness: 0.85, roughness: 0.22, bladeShape: 'multipoint', bladeCount: 6 },
    unlockCostGold: 130,
  },
  {
    id: 'blade.glider',
    displayName: 'Curved Aero Wing',
    description: 'Swept aerodynamic fins minimizing drag while slicing glancing impacts.',
    category: 'AttackBlade',
    rarity: 'Uncommon',
    massKg: 0.021,
    radiusContribution: 0.016,
    rotationalDrag: 0.0022,
    groundFriction: 0,
    restitution: 0.1,
    durability: 25,
    modifiers: { stamina: 14, speed: 12, control: 10 },
    visual: { primaryColor: 0x38bdf8, accentColor: 0xe0f2fe, metalness: 0.72, roughness: 0.2, bladeShape: 'curved', bladeCount: 4 },
    unlockCostGold: 150,
  },
  {
    id: 'blade.titan',
    displayName: 'Heavy Impact Crusher',
    description: 'Thick forged war-ring engineered for devastating momentum transfer.',
    category: 'AttackBlade',
    rarity: 'Rare',
    massKg: 0.032,
    radiusContribution: 0.018,
    rotationalDrag: 0.0045,
    groundFriction: 0,
    restitution: 0.18,
    durability: 34,
    modifiers: { attack: 22, defense: 10, speed: -4 },
    visual: { primaryColor: 0x475569, accentColor: 0xf97316, metalness: 0.9, roughness: 0.28, bladeShape: 'heavy', bladeCount: 4 },
    unlockCostGold: 270,
  },
  {
    id: 'blade.vortex',
    displayName: 'Vortex Turbine',
    description: 'Spiral-slotted high-velocity rotor generating inward air stability.',
    category: 'AttackBlade',
    rarity: 'Epic',
    massKg: 0.025,
    radiusContribution: 0.0175,
    rotationalDrag: 0.0026,
    groundFriction: 0,
    restitution: 0.13,
    durability: 28,
    modifiers: { attack: 16, stamina: 12, speed: 14, critical: 12 },
    visual: { primaryColor: 0x7c3aed, accentColor: 0xfde047, metalness: 0.85, roughness: 0.18, bladeShape: 'vortex', bladeCount: 5 },
    unlockCostGold: 420,
  },

  // === ARMOR RINGS (4) ===
  {
    id: 'armor.composite',
    displayName: 'Composite Shroud',
    description: 'Balanced polymer-alloy collar protecting the core chassis.',
    category: 'ArmorRing',
    rarity: 'Common',
    massKg: 0.015,
    radiusContribution: 0.006,
    rotationalDrag: 0.0012,
    groundFriction: 0,
    restitution: 0.04,
    durability: 24,
    modifiers: { defense: 10, stability: 8 },
    visual: { primaryColor: 0x334155, accentColor: 0x94a3b8, metalness: 0.4, roughness: 0.55 },
    unlockCostGold: 0,
  },
  {
    id: 'armor.fortress',
    displayName: 'Titanium Bulwark',
    description: 'Reinforced thick-wall shield ring resisting Burst Finish shocks.',
    category: 'ArmorRing',
    rarity: 'Uncommon',
    massKg: 0.022,
    radiusContribution: 0.008,
    rotationalDrag: 0.0018,
    groundFriction: 0,
    restitution: 0.01,
    durability: 42,
    modifiers: { defense: 22, stability: 12, speed: -5 },
    visual: { primaryColor: 0x1e3a5f, accentColor: 0x38bdf8, metalness: 0.85, roughness: 0.3 },
    unlockCostGold: 140,
  },
  {
    id: 'armor.feather',
    displayName: 'Carbon Feather Ring',
    description: 'Ultra-light slotted guard maximizing acceleration and agility.',
    category: 'ArmorRing',
    rarity: 'Uncommon',
    massKg: 0.01,
    radiusContribution: 0.005,
    rotationalDrag: 0.0008,
    groundFriction: 0,
    restitution: 0.07,
    durability: 18,
    modifiers: { speed: 15, control: 10, defense: 4 },
    visual: { primaryColor: 0x18181b, accentColor: 0xf43f5e, metalness: 0.3, roughness: 0.65 },
    unlockCostGold: 130,
  },
  {
    id: 'armor.reactive',
    displayName: 'Reactive Shock Frame',
    description: 'Spring-damped perimeter frame converting impacts into recoil.',
    category: 'ArmorRing',
    rarity: 'Rare',
    massKg: 0.018,
    radiusContribution: 0.007,
    rotationalDrag: 0.0014,
    groundFriction: 0,
    restitution: 0.16,
    durability: 34,
    modifiers: { defense: 16, attack: 8, critical: 8 },
    visual: { primaryColor: 0x3f3f46, accentColor: 0xfacc15, metalness: 0.78, roughness: 0.25 },
    unlockCostGold: 260,
  },

  // === WEIGHT DISCS (4) ===
  {
    id: 'weight.light',
    displayName: 'Core Alloy Disc',
    description: 'Lightweight central disc tuned for quick directional bursts.',
    category: 'WeightDisc',
    rarity: 'Common',
    massKg: 0.024,
    radiusContribution: 0.008,
    rotationalDrag: 0.001,
    groundFriction: 0,
    restitution: 0.02,
    durability: 14,
    modifiers: { speed: 14, control: 8 },
    visual: { primaryColor: 0x94a3b8, accentColor: 0xe2e8f0, metalness: 0.92, roughness: 0.2 },
    unlockCostGold: 0,
  },
  {
    id: 'weight.outer',
    displayName: 'Outer-Rim Flywheel',
    description: 'Perimeter-weighted steel ring boosting rotational inertia I = ½mr².',
    category: 'WeightDisc',
    rarity: 'Uncommon',
    massKg: 0.032,
    radiusContribution: 0.014,
    rotationalDrag: 0.0009,
    groundFriction: 0,
    restitution: 0.03,
    durability: 18,
    modifiers: { stamina: 16, stability: 14, speed: -4 },
    visual: { primaryColor: 0xcbd5e1, accentColor: 0x38bdf8, metalness: 0.95, roughness: 0.16 },
    unlockCostGold: 150,
  },
  {
    id: 'weight.tungsten',
    displayName: 'Tungsten Hammer Disc',
    description: 'Ultra-dense flywheel delivering massive collision momentum.',
    category: 'WeightDisc',
    rarity: 'Rare',
    massKg: 0.042,
    radiusContribution: 0.013,
    rotationalDrag: 0.0015,
    groundFriction: 0,
    restitution: 0.02,
    durability: 22,
    modifiers: { attack: 14, defense: 14, stability: 10, speed: -8 },
    visual: { primaryColor: 0x64748b, accentColor: 0xf59e0b, metalness: 0.95, roughness: 0.25 },
    unlockCostGold: 280,
  },
  {
    id: 'weight.gyro',
    displayName: 'Balanced Gyro Core',
    description: 'Precision-machined brass flywheel keeping wobble near zero.',
    category: 'WeightDisc',
    rarity: 'Rare',
    massKg: 0.03,
    radiusContribution: 0.012,
    rotationalDrag: 0.0008,
    groundFriction: 0,
    restitution: 0.03,
    durability: 18,
    modifiers: { stability: 18, stamina: 12, control: 10 },
    visual: { primaryColor: 0xd97706, accentColor: 0xfef3c7, metalness: 0.9, roughness: 0.18 },
    unlockCostGold: 250,
  },

  // === PERFORMANCE DRIVERS (4) ===
  {
    id: 'driver.flat',
    displayName: 'Flat Rush Tip',
    description: 'Wide flat contact face producing aggressive arena-sweeping speed.',
    category: 'PerformanceDriver',
    rarity: 'Common',
    massKg: 0.008,
    radiusContribution: 0.002,
    rotationalDrag: 0.0046,
    groundFriction: 0.38,
    restitution: 0.06,
    durability: 8,
    modifiers: { speed: 20, attack: 8, stamina: -6 },
    visual: { primaryColor: 0xef4444, accentColor: 0xfecaca, metalness: 0.35, roughness: 0.45, driverType: 'flat' },
    unlockCostGold: 0,
  },
  {
    id: 'driver.sharp',
    displayName: 'Needle Point Tip',
    description: 'Pinpoint hardened steel spindle minimizing friction for pure stamina.',
    category: 'PerformanceDriver',
    rarity: 'Common',
    massKg: 0.008,
    radiusContribution: 0.001,
    rotationalDrag: 0.0012,
    groundFriction: 0.09,
    restitution: 0.01,
    durability: 8,
    modifiers: { stamina: 22, stability: 10, speed: -6 },
    visual: { primaryColor: 0x38bdf8, accentColor: 0xe0f2fe, metalness: 0.9, roughness: 0.14, driverType: 'sharp' },
    unlockCostGold: 0,
  },
  {
    id: 'driver.rubber',
    displayName: 'Grip Elastomer Tip',
    description: 'High-traction rubberized cone resisting Ring Out knockback.',
    category: 'PerformanceDriver',
    rarity: 'Uncommon',
    massKg: 0.009,
    radiusContribution: 0.002,
    rotationalDrag: 0.0052,
    groundFriction: 0.56,
    restitution: 0.11,
    durability: 10,
    modifiers: { control: 20, defense: 10, speed: 8, stamina: -8 },
    visual: { primaryColor: 0x1e293b, accentColor: 0xfacc15, metalness: 0.1, roughness: 0.85, driverType: 'rubber' },
    unlockCostGold: 120,
  },
  {
    id: 'driver.ball',
    displayName: 'Orbital Bearing Tip',
    description: 'Free-spinning ceramic ball tip balancing mobility and endurance.',
    category: 'PerformanceDriver',
    rarity: 'Rare',
    massKg: 0.009,
    radiusContribution: 0.002,
    rotationalDrag: 0.0021,
    groundFriction: 0.20,
    restitution: 0.04,
    durability: 12,
    modifiers: { stamina: 12, stability: 14, speed: 8, control: 10 },
    visual: { primaryColor: 0x6366f1, accentColor: 0xe0e7ff, metalness: 0.7, roughness: 0.2, driverType: 'ball' },
    unlockCostGold: 220,
  },

  // === ENERGY MODULES (3) ===
  {
    id: 'energy.cell',
    displayName: 'Pulse Capacitor',
    description: 'Standard induction coil providing steady ability energy flow.',
    category: 'EnergyModule',
    rarity: 'Common',
    massKg: 0.006,
    radiusContribution: 0.002,
    rotationalDrag: 0.0005,
    groundFriction: 0,
    restitution: 0.01,
    durability: 10,
    modifiers: { energy: 12, control: 6 },
    visual: { primaryColor: 0x22d3ee, accentColor: 0xa5f3fc, metalness: 0.5, roughness: 0.25 },
    unlockCostGold: 0,
  },
  {
    id: 'energy.resonance',
    displayName: 'Resonance Amplifier',
    description: 'Tuned harmonic stator accelerating Ultimate Resonance buildup.',
    category: 'EnergyModule',
    rarity: 'Uncommon',
    massKg: 0.007,
    radiusContribution: 0.002,
    rotationalDrag: 0.0007,
    groundFriction: 0,
    restitution: 0.01,
    durability: 10,
    modifiers: { energy: 18, critical: 10 },
    visual: { primaryColor: 0xa855f7, accentColor: 0xf3e8ff, metalness: 0.65, roughness: 0.2 },
    unlockCostGold: 160,
  },
  {
    id: 'energy.overclock',
    displayName: 'Hyper-Flux Dynamo',
    description: 'High-efficiency brushless coil harvesting energy from high RPM.',
    category: 'EnergyModule',
    rarity: 'Rare',
    massKg: 0.007,
    radiusContribution: 0.003,
    rotationalDrag: 0.0009,
    groundFriction: 0,
    restitution: 0.02,
    durability: 12,
    modifiers: { energy: 24, speed: 6, attack: 6 },
    visual: { primaryColor: 0xf59e0b, accentColor: 0xfef08a, metalness: 0.75, roughness: 0.18 },
    unlockCostGold: 300,
  },
  ...EXPANSION_COMPONENTS,
];

// Active Abilities across 4 categories (8 elements + Defensive/Tactical/Ultimate)
export const ABILITIES: AbilityDefinition[] = [
  // Elemental (4)
  {
    id: 'ability.fire.flame_burst',
    displayName: 'Flame Burst',
    description: 'Ignites radial thrusters for a high-impulse strike and Burn drain.',
    type: 'Elemental',
    element: 'Fire',
    energyCost: 30,
    resonanceCost: 0,
    cooldownSec: 7,
    durationSec: 2.5,
    power: 1.45,
    effectKind: 'DashStrike',
    statusApplied: 'Burn',
    colorHex: '#ff5a2f',
  },
  {
    id: 'ability.water.aqua_pulse',
    displayName: 'Aqua Pulse',
    description: 'Projects a hydro shockwave that pushes rivals and cools friction.',
    type: 'Elemental',
    element: 'Water',
    energyCost: 28,
    resonanceCost: 0,
    cooldownSec: 7,
    durationSec: 3,
    power: 1.25,
    effectKind: 'ElementalBurst',
    statusApplied: 'Slow',
    colorHex: '#22b8ff',
  },
  {
    id: 'ability.ice.frost_impact',
    displayName: 'Frost Impact',
    description: 'Flash-chills nearby space, slowing opponent steering and speed.',
    type: 'Elemental',
    element: 'Ice',
    energyCost: 30,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3.5,
    power: 1.3,
    effectKind: 'ElementalBurst',
    statusApplied: 'Freeze',
    colorHex: '#7dd3fc',
  },
  {
    id: 'ability.lightning.thunder_dash',
    displayName: 'Thunder Dash',
    description: 'Electro-magnetic lunge toward rival inflicting Shock control loss.',
    type: 'Elemental',
    element: 'Lightning',
    energyCost: 28,
    resonanceCost: 0,
    cooldownSec: 6.5,
    durationSec: 2,
    power: 1.4,
    effectKind: 'DashStrike',
    statusApplied: 'Shock',
    colorHex: '#facc15',
  },

  // Defensive (3)
  {
    id: 'ability.def.aegis_barrier',
    displayName: 'Aegis Barrier',
    description: 'Projects a magnetic shield reducing incoming structural & spin damage by 55%.',
    type: 'Defensive',
    energyCost: 25,
    resonanceCost: 0,
    cooldownSec: 9,
    durationSec: 4,
    power: 0.55,
    effectKind: 'BarrierShield',
    statusApplied: 'Shield',
    colorHex: '#38bdf8',
  },
  {
    id: 'ability.def.gyro_anchor',
    displayName: 'Gyro Anchor',
    description: 'Stabilizes precession wobble and recovers +28% rotational stability.',
    type: 'Defensive',
    energyCost: 24,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3,
    power: 28,
    effectKind: 'SpinStabilize',
    colorHex: '#60a5fa',
  },
  {
    id: 'ability.def.cryo_shell',
    displayName: 'Cryo Shell',
    description: 'Hardens outer armor ring against Burst impacts and rebounds attackers.',
    type: 'Defensive',
    element: 'Ice',
    energyCost: 30,
    resonanceCost: 0,
    cooldownSec: 10,
    durationSec: 4,
    power: 0.65,
    effectKind: 'BarrierShield',
    statusApplied: 'Shield',
    colorHex: '#a5f3fc',
  },

  // Tactical (3)
  {
    id: 'ability.tac.overdrive_surge',
    displayName: 'Overdrive Surge',
    description: 'Boosts thrust acceleration and spin torque for aggressive pursuit.',
    type: 'Tactical',
    energyCost: 25,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3.5,
    power: 1.5,
    effectKind: 'TacticalSurge',
    statusApplied: 'Overdrive',
    colorHex: '#f97316',
  },
  {
    id: 'ability.tac.vortex_pull',
    displayName: 'Vortex Pull',
    description: 'Draws the opponent inward toward the arena center to deny Ring Out.',
    type: 'Tactical',
    energyCost: 26,
    resonanceCost: 0,
    cooldownSec: 9,
    durationSec: 2.5,
    power: 1.35,
    effectKind: 'VortexPull',
    colorHex: '#c084fc',
  },
  {
    id: 'ability.tac.slipstream_evade',
    displayName: 'Slipstream Evade',
    description: 'Side-steps incoming momentum and restores 10% rotational energy.',
    type: 'Tactical',
    energyCost: 22,
    resonanceCost: 0,
    cooldownSec: 7.5,
    durationSec: 2.5,
    power: 1.25,
    effectKind: 'SpinStabilize',
    colorHex: '#34d399',
  },

  // Ultimate (2+ — 4 total? Wait: 4+3+3+2 = 12 exact!)
  {
    id: 'ability.ult.inferno_nova',
    displayName: 'Inferno Nova',
    description: 'Requires 100% Resonance. Unleashes a blazing supersonic collision strike.',
    type: 'Ultimate',
    element: 'Fire',
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3,
    power: 2.35,
    effectKind: 'UltimateStrike',
    statusApplied: 'Burn',
    colorHex: '#ff3b1f',
  },
  {
    id: 'ability.ult.tempest_cataclysm',
    displayName: 'Tempest Cataclysm',
    description: 'Requires 100% Resonance. Summons an arc-vortex shockwave & high RPM surge.',
    type: 'Ultimate',
    element: 'Lightning',
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3.5,
    power: 2.25,
    effectKind: 'UltimateStrike',
    statusApplied: 'Shock',
    colorHex: '#fde047',
  },
  ...EXPANSION_ABILITIES,
];

// Playable Spinning Top Designs across 4 Archetypes & 8 Elements
export const TOP_DEFINITIONS: TopDefinition[] = [
  {
    id: 'top.ignis.drake',
    displayName: 'Ignis Drake',
    title: 'Crimson Striker',
    description: 'Aggressive Fire attacker built to shatter rivals with high-speed impacts.',
    archetype: 'Attacker',
    element: 'Fire',
    rarity: 'Common',
    baseAttributes: {
      attack: 54,
      defense: 28,
      stamina: 32,
      speed: 56,
      stability: 34,
      control: 40,
      energy: 36,
      critical: 50,
    },
    defaultComponents: {
      SpiritCore: 'core.ignis',
      AttackBlade: 'blade.fang',
      ArmorRing: 'armor.composite',
      WeightDisc: 'weight.light',
      PerformanceDriver: 'driver.flat',
      EnergyModule: 'energy.cell',
    },
    defaultAbilities: [
      'ability.fire.flame_burst',
      'ability.def.aegis_barrier',
      'ability.tac.overdrive_surge',
      'ability.ult.inferno_nova',
    ],
    unlockCostGold: 0,
  },
  {
    id: 'top.aegis.titan',
    displayName: 'Aegis Titan',
    title: 'Hydro Bastion',
    description: 'Steadfast Water defender engineered to absorb brutal clashes and hold center.',
    archetype: 'Defender',
    element: 'Water',
    rarity: 'Common',
    baseAttributes: {
      attack: 30,
      defense: 58,
      stamina: 46,
      speed: 26,
      stability: 58,
      control: 44,
      energy: 42,
      critical: 28,
    },
    defaultComponents: {
      SpiritCore: 'core.aegis',
      AttackBlade: 'blade.bastion',
      ArmorRing: 'armor.fortress',
      WeightDisc: 'weight.outer',
      PerformanceDriver: 'driver.rubber',
      EnergyModule: 'energy.cell',
    },
    defaultAbilities: [
      'ability.water.aqua_pulse',
      'ability.def.gyro_anchor',
      'ability.tac.vortex_pull',
      'ability.ult.abyssal_maelstrom',
    ],
    unlockCostGold: 0,
  },
  {
    id: 'top.volt.tempest',
    displayName: 'Volt Tempest',
    title: 'Arc Tactician',
    description: 'Versatile Lightning balance top excelling at orbital pursuit and rapid surges.',
    archetype: 'Balance',
    element: 'Lightning',
    rarity: 'Uncommon',
    baseAttributes: {
      attack: 44,
      defense: 40,
      stamina: 42,
      speed: 48,
      stability: 44,
      control: 52,
      energy: 50,
      critical: 44,
    },
    defaultComponents: {
      SpiritCore: 'core.volt',
      AttackBlade: 'blade.sawtooth',
      ArmorRing: 'armor.feather',
      WeightDisc: 'weight.light',
      PerformanceDriver: 'driver.ball',
      EnergyModule: 'energy.resonance',
    },
    defaultAbilities: [
      'ability.lightning.thunder_dash',
      'ability.def.aegis_barrier',
      'ability.tac.slipstream_evade',
      'ability.ult.tempest_cataclysm',
    ],
    unlockCostGold: 220,
  },
  {
    id: 'top.glacier.sentinel',
    displayName: 'Glacier Sentinel',
    title: 'Cryo Marathoner',
    description: 'Endurance-tuned Ice stamina unit designed to outspin every challenger.',
    archetype: 'Stamina',
    element: 'Ice',
    rarity: 'Uncommon',
    baseAttributes: {
      attack: 28,
      defense: 42,
      stamina: 62,
      speed: 34,
      stability: 56,
      control: 44,
      energy: 40,
      critical: 30,
    },
    defaultComponents: {
      SpiritCore: 'core.glacier',
      AttackBlade: 'blade.glider',
      ArmorRing: 'armor.composite',
      WeightDisc: 'weight.gyro',
      PerformanceDriver: 'driver.sharp',
      EnergyModule: 'energy.cell',
    },
    defaultAbilities: [
      'ability.ice.frost_impact',
      'ability.def.cryo_shell',
      'ability.tac.slipstream_evade',
      'ability.ult.absolute_zero',
    ],
    unlockCostGold: 240,
  },
  {
    id: 'top.crimson.fang',
    displayName: 'Crimson Fang',
    title: 'Apex Crusher',
    description: 'Heavy-impact Fire destroyer pairing tungsten mass with serrated blades.',
    archetype: 'Attacker',
    element: 'Fire',
    rarity: 'Rare',
    baseAttributes: {
      attack: 58,
      defense: 36,
      stamina: 34,
      speed: 46,
      stability: 38,
      control: 38,
      energy: 38,
      critical: 56,
    },
    defaultComponents: {
      SpiritCore: 'core.crimson',
      AttackBlade: 'blade.titan',
      ArmorRing: 'armor.reactive',
      WeightDisc: 'weight.tungsten',
      PerformanceDriver: 'driver.flat',
      EnergyModule: 'energy.overclock',
    },
    defaultAbilities: [
      'ability.fire.flame_burst',
      'ability.def.aegis_barrier',
      'ability.tac.overdrive_surge',
      'ability.ult.inferno_nova',
    ],
    unlockCostGold: 420,
  },
  {
    id: 'top.storm.sovereign',
    displayName: 'Storm Sovereign',
    title: 'Champion Prototype',
    description: 'Apex tournament champion chassis with Vortex Turbine blades and Dynamo coil.',
    archetype: 'Balance',
    element: 'Lightning',
    rarity: 'Legendary',
    baseAttributes: {
      attack: 52,
      defense: 50,
      stamina: 50,
      speed: 52,
      stability: 50,
      control: 52,
      energy: 54,
      critical: 52,
    },
    defaultComponents: {
      SpiritCore: 'core.sovereign',
      AttackBlade: 'blade.vortex',
      ArmorRing: 'armor.reactive',
      WeightDisc: 'weight.gyro',
      PerformanceDriver: 'driver.ball',
      EnergyModule: 'energy.overclock',
    },
    defaultAbilities: [
      'ability.lightning.thunder_dash',
      'ability.def.gyro_anchor',
      'ability.tac.vortex_pull',
      'ability.ult.tempest_cataclysm',
    ],
    unlockCostGold: 750,
  },
  ...EXPANSION_TOP_DEFINITIONS,
];

// AI Opponents + Multi-Phase Bosses
export const OPPONENTS: OpponentDefinition[] = [
  {
    id: 'opponent.rookie.spark',
    displayName: 'Kai "Spark"',
    title: 'Quarterfinalist',
    topId: 'top.volt.tempest',
    personality: 'Evasive',
    difficulty: 'Easy',
    level: 1,
    isBoss: false,
    components: {
      SpiritCore: 'core.volt',
      AttackBlade: 'blade.glider',
      ArmorRing: 'armor.feather',
      WeightDisc: 'weight.light',
      PerformanceDriver: 'driver.ball',
      EnergyModule: 'energy.cell',
    },
    abilities: [
      'ability.lightning.thunder_dash',
      'ability.def.aegis_barrier',
      'ability.tac.slipstream_evade',
      'ability.ult.tempest_cataclysm',
    ],
    rewardGold: 110,
    rewardXp: 60,
    description: 'Nimble challenger relying on orbital movement and evasive maneuvers.',
  },
  {
    id: 'opponent.iron.bastion',
    displayName: 'Sora Vance',
    title: 'Iron Guardian',
    topId: 'top.aegis.titan',
    personality: 'Defensive',
    difficulty: 'Normal',
    level: 3,
    isBoss: false,
    components: {
      SpiritCore: 'core.aegis',
      AttackBlade: 'blade.bastion',
      ArmorRing: 'armor.fortress',
      WeightDisc: 'weight.outer',
      PerformanceDriver: 'driver.rubber',
      EnergyModule: 'energy.cell',
    },
    abilities: [
      'ability.water.aqua_pulse',
      'ability.def.gyro_anchor',
      'ability.tac.vortex_pull',
      'ability.ult.abyssal_maelstrom',
    ],
    rewardGold: 160,
    rewardXp: 90,
    description: 'High-traction defender that anchors the dish center and counters reckless rushes.',
  },
  {
    id: 'opponent.frost.weaver',
    displayName: 'Elena Frost',
    title: 'Cryo Strategist',
    topId: 'top.glacier.sentinel',
    personality: 'Tactical',
    difficulty: 'Normal',
    level: 4,
    isBoss: false,
    components: {
      SpiritCore: 'core.glacier',
      AttackBlade: 'blade.glider',
      ArmorRing: 'armor.composite',
      WeightDisc: 'weight.gyro',
      PerformanceDriver: 'driver.sharp',
      EnergyModule: 'energy.resonance',
    },
    abilities: [
      'ability.ice.frost_impact',
      'ability.def.cryo_shell',
      'ability.tac.slipstream_evade',
      'ability.ult.absolute_zero',
    ],
    rewardGold: 200,
    rewardXp: 120,
    description: 'Calculates stamina efficiency to outlast aggressive rivals into Critical phase.',
  },
  {
    id: 'opponent.inferno.raider',
    displayName: 'Dante Blaze',
    title: 'Semifinalist',
    topId: 'top.crimson.fang',
    personality: 'Aggressive',
    difficulty: 'Hard',
    level: 6,
    isBoss: false,
    components: {
      SpiritCore: 'core.crimson',
      AttackBlade: 'blade.sawtooth',
      ArmorRing: 'armor.reactive',
      WeightDisc: 'weight.tungsten',
      PerformanceDriver: 'driver.flat',
      EnergyModule: 'energy.overclock',
    },
    abilities: [
      'ability.fire.flame_burst',
      'ability.def.aegis_barrier',
      'ability.tac.overdrive_surge',
      'ability.ult.inferno_nova',
    ],
    rewardGold: 260,
    rewardXp: 160,
    description: 'Relentless brawler seeking Ring Outs and Burst Finishes early in the match.',
  },
  {
    id: 'opponent.volt.tactician',
    displayName: 'Riku Kurosawa',
    title: 'Finalist',
    topId: 'top.volt.tempest',
    personality: 'HeavyAssault',
    difficulty: 'Hard',
    level: 8,
    isBoss: false,
    components: {
      SpiritCore: 'core.volt',
      AttackBlade: 'blade.titan',
      ArmorRing: 'armor.reactive',
      WeightDisc: 'weight.tungsten',
      PerformanceDriver: 'driver.ball',
      EnergyModule: 'energy.resonance',
    },
    abilities: [
      'ability.lightning.thunder_dash',
      'ability.def.gyro_anchor',
      'ability.tac.overdrive_surge',
      'ability.ult.tempest_cataclysm',
    ],
    rewardGold: 340,
    rewardXp: 210,
    description: 'Pairs heavy tungsten momentum with high-speed Thunder Dash intercepts.',
  },
  {
    id: 'opponent.boss.sovereign',
    displayName: 'Valkyrie Sovereign',
    title: 'Grand Champion Boss',
    topId: 'top.storm.sovereign',
    personality: 'Tactical',
    difficulty: 'Expert',
    level: 10,
    isBoss: true,
    components: {
      SpiritCore: 'core.sovereign',
      AttackBlade: 'blade.vortex',
      ArmorRing: 'armor.reactive',
      WeightDisc: 'weight.gyro',
      PerformanceDriver: 'driver.ball',
      EnergyModule: 'energy.overclock',
    },
    abilities: [
      'ability.lightning.thunder_dash',
      'ability.def.gyro_anchor',
      'ability.tac.vortex_pull',
      'ability.ult.tempest_cataclysm',
    ],
    rewardGold: 600,
    rewardXp: 400,
    description: 'Reigning Neon Stadium Grand Champion. Dynamically adapts modes and chains Ultimates.',
  },
  ...EXPANSION_OPPONENTS,
];

// 3 Evolution Paths
export const EVOLUTION_PATHS: EvolutionPath[] = [
  {
    id: 'evo.offensive',
    displayName: 'Apex Striker Evolution',
    focus: 'Offensive',
    description: 'Amplifies blade impact velocity, critical resonance, and attack pressure.',
    requiredLevel: 3,
    goldCost: 250,
    evolutionTokensCost: 2,
    essenceCost: 15,
    attributeBonuses: { attack: 14, speed: 10, critical: 14 },
    scaleMultiplier: 1.07,
    emissiveBoost: 1.45,
  },
  {
    id: 'evo.defensive',
    displayName: 'Bastion Fortress Evolution',
    focus: 'Defensive',
    description: 'Reinforces chassis durability, impact damping, and gyroscopic balance.',
    requiredLevel: 3,
    goldCost: 250,
    evolutionTokensCost: 2,
    essenceCost: 15,
    attributeBonuses: { defense: 14, stability: 14, stamina: 10 },
    scaleMultiplier: 1.09,
    emissiveBoost: 1.35,
  },
  {
    id: 'evo.hybrid',
    displayName: 'Resonant Hybrid Evolution',
    focus: 'Hybrid',
    description: 'Balances rotational endurance with rapid ability energy & control.',
    requiredLevel: 3,
    goldCost: 280,
    evolutionTokensCost: 2,
    essenceCost: 15,
    attributeBonuses: { stamina: 10, control: 12, energy: 14, attack: 6, defense: 6 },
    scaleMultiplier: 1.06,
    emissiveBoost: 1.5,
  },
];

export const BATTLE_MODES: {
  id: BattleMode;
  label: string;
  tagline: string;
  color: string;
}[] = [
  { id: 'Attack', label: 'Attack', tagline: '+22% Impulse · +18% Drain', color: '#f43f5e' },
  { id: 'Defense', label: 'Defense', tagline: '-25% Damage · +18% Stability', color: '#38bdf8' },
  { id: 'Speed', label: 'Speed', tagline: '+28% Thrust · +15% Friction', color: '#facc15' },
  { id: 'Stamina', label: 'Stamina', tagline: '-28% Spin Drag · Calm Orbit', color: '#34d399' },
  { id: 'Berserk', label: 'Berserk', tagline: '+40% Clash · High Risk Drain', color: '#fb923c' },
  { id: 'Counter', label: 'Counter', tagline: 'Absorb Impact & Reflect +35% Impulse', color: '#c084fc' },
];

export const TACTICAL_COMMANDS: {
  id: TacticalCommand;
  keyHint: string;
  label: string;
  shortDesc: string;
}[] = [
  { id: 'Aggressive', keyHint: '1', label: 'Aggressive', shortDesc: 'Direct rush & clash' },
  { id: 'Defensive', keyHint: '2', label: 'Defensive', shortDesc: 'Guard center dish' },
  { id: 'Chase', keyHint: '3', label: 'Chase', shortDesc: 'Intercept rival path' },
  { id: 'Circle', keyHint: '4', label: 'Circle', shortDesc: 'Orbital flank sweep' },
  { id: 'Evade', keyHint: '5', label: 'Evade', shortDesc: 'Dodge high speed' },
  { id: 'ConserveEnergy', keyHint: '6', label: 'Conserve', shortDesc: 'Preserve high RPM' },
  { id: 'HoldPosition', keyHint: '7', label: 'Hold Pos', shortDesc: 'Anchor spot & brace' },
  { id: 'Counter', keyHint: '8', label: 'Counter', shortDesc: 'Bait & counter-rebound' },
];

export function getTopDefinition(id: string): TopDefinition {
  return TOP_DEFINITIONS.find((t) => t.id === id) ?? TOP_DEFINITIONS[0];
}

export function getComponentDefinition(id: string): ComponentDefinition {
  return COMPONENTS.find((c) => c.id === id) ?? COMPONENTS[0];
}

export function getAbilityDefinition(id: string): AbilityDefinition {
  return ABILITIES.find((a) => a.id === id) ?? ABILITIES[0];
}

export function isShieldAbility(abilityOrId: string | AbilityDefinition): boolean {
  const def = typeof abilityOrId === 'string' ? getAbilityDefinition(abilityOrId) : abilityOrId;
  return (
    def.effectKind === 'BarrierShield' ||
    def.statusApplied === 'Shield' ||
    (def.effectKind === 'PurifyCleanse' && def.type === 'Defensive')
  );
}

export function isFireAbility(abilityOrId: string | AbilityDefinition): boolean {
  const def = typeof abilityOrId === 'string' ? getAbilityDefinition(abilityOrId) : abilityOrId;
  return def.element === 'Fire' || def.statusApplied === 'Burn';
}

export function getOpponentDefinition(id: string): OpponentDefinition {
  return OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[0];
}

export function getEvolutionPath(id: string): EvolutionPath | undefined {
  return EVOLUTION_PATHS.find((e) => e.id === id);
}

export function getArenaDefinition(id: ArenaId): ArenaDefinition {
  return ARENAS[id] ?? ARENAS.standard;
}

// ============================================================================
// Character Creation Options
// ============================================================================

export const HAIR_STYLES: { id: HairStyleId; label: string }[] = [
  { id: 'spiky', label: 'Blitz Spikes' },
  { id: 'sleek', label: 'Aero Sweep' },
  { id: 'braided', label: 'Twin Crest' },
  { id: 'visor', label: 'Cyber Visor' },
];

export const HAIR_COLORS: { label: string; hex: string }[] = [
  { label: 'Obsidian', hex: '#1e293b' },
  { label: 'Solar Amber', hex: '#f59e0b' },
  { label: 'Crimson', hex: '#ef4444' },
  { label: 'Glacier Cyan', hex: '#38bdf8' },
  { label: 'Silver Frost', hex: '#e2e8f0' },
  { label: 'Plasma Violet', hex: '#a855f7' },
];

export const OUTFIT_COLORS: { label: string; hex: string }[] = [
  { label: 'Midnight Navy', hex: '#0f172a' },
  { label: 'Crimson Jacket', hex: '#991b1b' },
  { label: 'Cobalt Armor', hex: '#1d4ed8' },
  { label: 'Emerald Vest', hex: '#065f46' },
  { label: 'Graphite Gold', hex: '#334155' },
];

export const ACCENT_COLORS: { label: string; hex: string }[] = [
  { label: 'Neon Sky', hex: '#38bdf8' },
  { label: 'Inferno Orange', hex: '#f97316' },
  { label: 'Volt Gold', hex: '#facc15' },
  { label: 'Emerald Pulse', hex: '#34d399' },
  { label: 'Rose Nova', hex: '#fb7185' },
];

// ============================================================================
// Arena Secrets Catalog (5 Discoverable Secrets)
// ============================================================================

export const SECRETS_CATALOG: SecretDefinition[] = [
  {
    id: 'secret.perfect_ripcord',
    title: 'Golden Ripcord Resonance',
    hint: 'Strike inside the golden peak (>= 92%) during Launch Calibration.',
    lore: 'Precision harmonic launch synchronizes the Stadium Core bearing at peak RPM.',
    points: 300,
  },
  {
    id: 'secret.ring_out_gate',
    title: 'Gatebreaker Trajectory',
    hint: 'Win a match by ejecting a rival through a Neon Stadium Ring-Out Gate.',
    lore: 'Using tangential blade deflection near the three exit gates turns defense into instant ejection.',
    points: 350,
  },
  {
    id: 'secret.elemental_apex',
    title: 'Apex Elemental Awakening',
    hint: 'Evolve any Spinning Top along an Apex Evolution path in Collection & Evolution.',
    lore: 'True resonance crowns the Spirit Core with a stabilized high-output magnetic halo.',
    points: 400,
  },
  {
    id: 'secret.critical_comeback',
    title: 'Edge of Collapse',
    hint: 'Win an arena clash while your Spin Stamina or Armor drops below 35%.',
    lore: 'Veterans convert near-zero gyroscopic stability into a final decisive counter-impulse.',
    points: 450,
  },
  {
    id: 'secret.stadium_cipher',
    title: 'Neon Core Vault Cipher',
    hint: 'Decode the hidden 3-node Stadium Harmonic lock inside the Score & Secrets Vault.',
    lore: 'Beneath the parabolic dish lies the original Architect tuning matrix of Spin Legends.',
    points: 500,
  },
];

// ============================================================================
// Key Narrative & Strategic Decisions (Drive Multiple Endings)
// ============================================================================

export const STORY_DECISIONS: StoryDecisionNode[] = [
  {
    id: 'decision.syndicate_core',
    stageNumber: 1,
    title: 'The Black-Market Reactor',
    prompt:
      'After your first arena triumph, an underground broker slides a forbidden Overclock Core onto your workbench. It promises raw power at the cost of stadium safety regulations.',
    unlockHint: 'Unlocks after 1 Arena Victory (or Quarterfinal).',
    choices: [
      {
        id: 'choice.report_guild',
        label: 'Surrender Core to Guild Stewards',
        alignment: 'good',
        description: 'Uphold fair competition and expose the smuggling ring to the Neon Stadium Council.',
        rewardSummary: '+150 Score · +1 Evo Token · +Honor',
        scoreDelta: 150,
        evoTokenDelta: 1,
      },
      {
        id: 'choice.install_core',
        label: 'Harness the Forbidden Core',
        alignment: 'bad',
        description: 'Pocket the syndicate payoff and tune your chassis for ruthless burst dominance.',
        rewardSummary: '+220 Gold · +80 Score · +Ambition',
        goldDelta: 220,
        scoreDelta: 80,
      },
      {
        id: 'choice.seal_vault',
        label: 'Dismantle & Archive Specs',
        alignment: 'neutral',
        description: 'Strip the volatile catalyst safely without taking sides in Guild politics.',
        rewardSummary: '+18 Essence · +110 Score · +Prudence',
        essenceDelta: 18,
        scoreDelta: 110,
      },
    ],
  },
  {
    id: 'decision.rival_chassis',
    stageNumber: 2,
    title: 'Fractured Rival Chassis',
    prompt:
      'Before the high-tier bracket, telemetry reveals Sora Vance’s Aegis Titan carries a hairline armor fracture from an earlier clash.',
    unlockHint: 'Unlocks after 2 Arena Victories (or Semifinal).',
    choices: [
      {
        id: 'choice.share_alloy',
        label: 'Share Spare Alloy for a Fair Duel',
        alignment: 'good',
        description: 'Send reinforcement plates so both bladers meet at peak mechanical integrity.',
        rewardSummary: '+200 Score · +12 Essence · +Honor',
        scoreDelta: 200,
        essenceDelta: 12,
      },
      {
        id: 'choice.target_fracture',
        label: 'Exploit the Structural Weakness',
        alignment: 'bad',
        description: 'Calibrate impact angle to shatter the weakened seam on first contact.',
        rewardSummary: '+200 Gold · +100 Score · +Ambition',
        goldDelta: 200,
        scoreDelta: 100,
      },
      {
        id: 'choice.request_inspection',
        label: 'File Standard Inspection Delay',
        alignment: 'neutral',
        description: 'Let tournament officials adjudicate according to standard arena protocol.',
        rewardSummary: '+100 Gold · +130 Score · +Prudence',
        goldDelta: 100,
        scoreDelta: 130,
      },
    ],
  },
  {
    id: 'decision.stadium_throne',
    stageNumber: 3,
    title: 'Fate of the Neon Core',
    prompt:
      'Standing at the pinnacle of Neon Stadium, the Sovereign Reactor awaits its new custodian. How will your legacy reshape the arena?',
    unlockHint: 'Unlocks upon 3+ Victories or Championship Finale.',
    choices: [
      {
        id: 'choice.open_academy',
        label: 'Open the Stadium Academy to All',
        alignment: 'good',
        description: 'Share Sovereign engineering blueprints with every rookie blader across the city.',
        rewardSummary: '+350 Score · +Honor',
        scoreDelta: 350,
      },
      {
        id: 'choice.claim_monopoly',
        label: 'Seize Absolute Arena Monopoly',
        alignment: 'bad',
        description: 'Lock down the Sovereign Core and rule the underground circuit with iron authority.',
        rewardSummary: '+350 Gold · +200 Score · +Ambition',
        goldDelta: 350,
        scoreDelta: 200,
      },
      {
        id: 'choice.seal_and_wander',
        label: 'Seal the Reactor & Depart Unbound',
        alignment: 'neutral',
        description: 'Leave the throne vacant and travel to test unproven arenas beyond the city.',
        rewardSummary: '+260 Score · +1 Evo Token · +Prudence',
        scoreDelta: 260,
        evoTokenDelta: 1,
      },
    ],
  },
];

// ============================================================================
// Multiple Endings Catalog (Good, Bad, Neutral, Secret Legend)
// ============================================================================

export const ENDINGS_CATALOG: EndingDefinition[] = [
  {
    id: 'ending.good',
    type: 'good',
    badgeLabel: 'GOOD ENDING',
    title: 'Guardian of the Neon Guild',
    subtitle: 'Honor & Integrity Illuminated the Stadium',
    epilogue:
      'By rejecting black-market shortcuts, honoring your rivals in battle, and opening the Sovereign blueprints to the next generation, you transformed Neon Stadium into a beacon of fair mechanical mastery.',
    accentHex: '#34d399',
  },
  {
    id: 'ending.bad',
    type: 'bad',
    badgeLabel: 'BAD ENDING',
    title: 'Tyrant of the Shattered Ring',
    subtitle: 'Unchecked Ambition Consumed the Arena',
    epilogue:
      'Empowered by illicit cores and ruthless exploits, no challenger could withstand your velocity—yet the cheers faded. Under your iron monopoly, Neon Stadium became a feared shadow circuit ruled by fear.',
    accentHex: '#f43f5e',
  },
  {
    id: 'ending.neutral',
    type: 'neutral',
    badgeLabel: 'NEUTRAL ENDING',
    title: 'The Unbound Tactician',
    subtitle: 'Balanced Prudence Beyond Faction Ties',
    epilogue:
      'Neither corrupted by syndicate gold nor bound to Guild bureaucracy, you proved your engineering skill on your own terms, sealed the Sovereign Core, and vanished into the horizon seeking greater arenas.',
    accentHex: '#38bdf8',
  },
  {
    id: 'ending.legend',
    type: 'legend',
    badgeLabel: 'TRUE LEGEND ENDING',
    title: 'Mythic Spin Sovereign',
    subtitle: 'Honor + High Mastery + Hidden Vault Secrets',
    epilogue:
      'Achieving honorable decisions while uncovering the hidden mysteries of Neon Stadium and amassing legendary score mastery, your name and customized chassis became eternal legend.',
    accentHex: '#facc15',
  },
];

// ============================================================================
// Seeded High-Score Leaderboard Rivals
// ============================================================================

export const SEEDED_LEADERBOARD_ENTRIES: LeaderboardEntry[] = [
  {
    id: 'lb.sovereign',
    name: 'Valkyrie Sovereign',
    title: 'Grand Champion',
    score: 2850,
    wins: 18,
    secretsFound: 4,
    endingBadge: 'Legend',
    isPlayer: false,
  },
  {
    id: 'lb.riku',
    name: 'Riku Kurosawa',
    title: 'Arc Tactician',
    score: 2140,
    wins: 12,
    secretsFound: 3,
    endingBadge: 'Neutral',
    isPlayer: false,
  },
  {
    id: 'lb.dante',
    name: 'Dante Blaze',
    title: 'Inferno Raider',
    score: 1620,
    wins: 9,
    secretsFound: 2,
    endingBadge: 'Bad',
    isPlayer: false,
  },
  {
    id: 'lb.sora',
    name: 'Sora Vance',
    title: 'Iron Guardian',
    score: 1180,
    wins: 6,
    secretsFound: 2,
    endingBadge: 'Good',
    isPlayer: false,
  },
  {
    id: 'lb.kai',
    name: 'Kai "Spark"',
    title: 'Circuit Rookie',
    score: 640,
    wins: 3,
    secretsFound: 1,
    endingBadge: 'Challenger',
    isPlayer: false,
  },
];

export function getSecretDefinition(id: string): SecretDefinition | undefined {
  return SECRETS_CATALOG.find((s) => s.id === id);
}

export function getEndingDefinition(id: string): EndingDefinition {
  return ENDINGS_CATALOG.find((e) => e.id === id) ?? ENDINGS_CATALOG[2];
}

// ============================================================================
// Dynamic Arena Weather Conditions
// ============================================================================

export const WEATHERS: Record<WeatherType, WeatherDefinition> = {
  Clear: {
    id: 'Clear',
    label: 'Clear Arena',
    shortLabel: 'Clear',
    description: 'Baseline stadium conditions with zero atmospheric drift or surface moisture.',
    accentHex: '#38bdf8',
    fogHex: 0x070b14,
    fogDensityBoost: 0,
    particleHex: 0x38bdf8,
    gripFrictionMult: 1.0,
    rotDragMult: 1.0,
    stabilityRecoveryMult: 1.0,
    stabilityDrainPerSec: 0,
    gustAccel: 0,
    gustFreq: 0,
  },
  LightRain: {
    id: 'LightRain',
    label: 'Light Rain',
    shortLabel: 'Rain',
    description: 'Slick dish moisture lowers surface grip (-14% friction) and lightly eases spin drag.',
    accentHex: '#60a5fa',
    fogHex: 0x0b1628,
    fogDensityBoost: 0.008,
    particleHex: 0x7dd3fc,
    gripFrictionMult: 0.86,
    rotDragMult: 0.96,
    stabilityRecoveryMult: 0.94,
    stabilityDrainPerSec: 0.25,
    gustAccel: 0,
    gustFreq: 0,
  },
  DustStorm: {
    id: 'DustStorm',
    label: 'Dust Storm',
    shortLabel: 'Dust',
    description: 'Abrasive grit increases floor traction (+16% grip) while slightly taxing spin RPM.',
    accentHex: '#f59e0b',
    fogHex: 0x1f140a,
    fogDensityBoost: 0.015,
    particleHex: 0xfbbf24,
    gripFrictionMult: 1.16,
    rotDragMult: 1.07,
    stabilityRecoveryMult: 0.90,
    stabilityDrainPerSec: 0.45,
    gustAccel: 0,
    gustFreq: 0,
  },
  GaleWind: {
    id: 'GaleWind',
    label: 'Gale Crosswind',
    shortLabel: 'Gale',
    description: 'Sweeping arena crosswinds subtly shift trajectories and test gyroscopic balance.',
    accentHex: '#2dd4bf',
    fogHex: 0x071b21,
    fogDensityBoost: 0.006,
    particleHex: 0x5eead4,
    gripFrictionMult: 0.95,
    rotDragMult: 1.02,
    stabilityRecoveryMult: 0.86,
    stabilityDrainPerSec: 0.35,
    gustAccel: 0.55,
    gustFreq: 1.45,
  },
};

export const WEATHER_LIST: WeatherDefinition[] = [
  WEATHERS.Clear,
  WEATHERS.LightRain,
  WEATHERS.DustStorm,
  WEATHERS.GaleWind,
];

export function getWeatherDefinition(weather?: WeatherType): WeatherDefinition {
  if (!weather) return WEATHERS.Clear;
  return WEATHERS[weather] ?? WEATHERS.Clear;
}

export function resolveArenaDefaultWeather(arenaId: ArenaId): WeatherType {
  switch (arenaId) {
    case 'volcanic':
    case 'shadow':
      return 'DustStorm';
    case 'thunder':
      return 'LightRain';
    case 'frozen':
    case 'temple':
      return 'GaleWind';
    case 'standard':
    default:
      return 'Clear';
  }
}

// ============================================================================
// Champion Victory Emotes
// ============================================================================

export const VICTORY_EMOTES: VictoryEmoteDefinition[] = [
  {
    id: 'apex_flare',
    label: 'Apex Flare',
    description: 'Triumphant upward flare hop with golden stadium shockwave bursts.',
    accentHex: '#facc15',
  },
  {
    id: 'cyclone_salute',
    label: 'Cyclone Salute',
    description: 'High-speed victory orbit dash around the impact spot with cyan sparks.',
    accentHex: '#38bdf8',
  },
  {
    id: 'titan_hover',
    label: 'Titan Hover',
    description: 'Anti-gravity magnetic levitation with slow imposing gyroscopic tilt.',
    accentHex: '#a855f7',
  },
  {
    id: 'eclipse_spin',
    label: 'Eclipse Pulse',
    description: 'Crisp figure-eight victory weave paired with crimson cadence waves.',
    accentHex: '#f43f5e',
  },
  {
    id: 'solar_crown',
    label: 'Solar Crown',
    description: 'Elevated double-hop crown ascent emitting a radiant ember fountain.',
    accentHex: '#f97316',
  },
];

export function getVictoryEmoteDefinition(id?: VictoryEmoteId): VictoryEmoteDefinition {
  return VICTORY_EMOTES.find((v) => v.id === id) ?? VICTORY_EMOTES[0];
}


