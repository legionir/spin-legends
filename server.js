// server.ts
import "dotenv/config";
import express from "express";
import http from "node:http";
import fs2 from "node:fs";
import path2 from "node:path";
import { WebSocketServer } from "ws";

// src/domain/expansionCatalog.ts
var ARENAS = {
  standard: {
    id: "standard",
    displayName: "Neon Dish Stadium",
    subtitle: "Balanced Championship Bowl",
    description: "Regulation parabolic alloy dish with balanced traction and three high-risk Ring-Out exit gates.",
    hazardSummary: "Standard friction \xB7 3 Ring-Out Gates \xB7 Balanced energy flow",
    surfaceFrictionMult: 1,
    rotationalDragMult: 1,
    energyModPerSec: 0,
    primaryColor: "#38bdf8",
    accentColor: "#f97316",
    floorPalette: ["#2a4168", "#1d2d4a", "#101829"],
    wallColorHex: 1976635,
    trimColorHex: 3718648,
    skyColorHex: 461588,
    hasMist: false,
    pillars: [],
    hazardZones: []
  },
  volcanic: {
    id: "volcanic",
    displayName: "Volcanic Arena",
    subtitle: "Molten Thermal Caldera",
    description: "Scorched basalt dish ringed with shifting magma vents that drain spin stamina and inflict temporary Overheat (-18% Attack, +35% Spin Drain).",
    hazardSummary: "Shifting Magma Vents: Temporary Overheat debuff (-18% Attack, +35% Spin Drain)",
    surfaceFrictionMult: 1.12,
    rotationalDragMult: 1.16,
    energyModPerSec: -0.6,
    primaryColor: "#ff5a2f",
    accentColor: "#facc15",
    floorPalette: ["#4a1d17", "#2c1211", "#140809"],
    wallColorHex: 2757650,
    trimColorHex: 16734767,
    skyColorHex: 1312518,
    hasMist: false,
    pillars: [],
    hazardZones: [
      {
        id: "lava-n",
        x: 0,
        z: -2.2,
        radius: 0.95,
        kind: "heat",
        label: "Magma Surge",
        motion: { kind: "oscillate", speedRadPerSec: 0.8, ampX: 1.35, ampZ: 0.25 },
        debuffKind: "Overheated",
        debuffDurationSec: 3.2
      },
      {
        id: "lava-se",
        x: 2.05,
        z: 1.45,
        radius: 0.95,
        kind: "heat",
        label: "Magma Vent",
        debuffKind: "Overheated",
        debuffDurationSec: 3
      },
      {
        id: "lava-sw",
        x: -2.05,
        z: 1.45,
        radius: 0.95,
        kind: "heat",
        label: "Magma Vent",
        debuffKind: "Overheated",
        debuffDurationSec: 3
      }
    ]
  },
  frozen: {
    id: "frozen",
    displayName: "Frozen Dome",
    subtitle: "Cryo Low-Friction Glacis",
    description: "Mirror-polished permafrost dish with a patrolling cryo spire that deflects fast trajectories and triggers temporary Frost Drag.",
    hazardSummary: "0.42x Ice Traction \xB7 Orbiting Cryo Spire (-28% Speed debuff on contact)",
    surfaceFrictionMult: 0.42,
    rotationalDragMult: 0.86,
    energyModPerSec: 0.25,
    primaryColor: "#7dd3fc",
    accentColor: "#e0f2fe",
    floorPalette: ["#1e4e68", "#15364d", "#0c1f30"],
    wallColorHex: 1461859,
    trimColorHex: 8246268,
    skyColorHex: 398111,
    hasMist: false,
    pillars: [
      {
        id: "cryo-spire",
        x: 0,
        z: 1.85,
        radius: 0.24,
        height: 0.86,
        motion: { kind: "orbit", orbitRadius: 1.85, speedRadPerSec: -0.62, phaseOffset: Math.PI * 0.5 },
        debuffKind: "DragSnare",
        debuffDurationSec: 2.8
      }
    ],
    hazardZones: []
  },
  thunder: {
    id: "thunder",
    displayName: "Thunder Circuit",
    subtitle: "High-Voltage Induction Grid",
    description: "Orbiting arc traps and an oscillating induction pylon sweep the circuit\u2014charging surges while disrupting rival speed and energy flow.",
    hazardSummary: "Orbiting Arc Traps & Moving Pylon: Temporary Arc Disruption (-15% Spd, -20% Regen)",
    surfaceFrictionMult: 0.95,
    rotationalDragMult: 1.02,
    energyModPerSec: 1.1,
    primaryColor: "#facc15",
    accentColor: "#a855f7",
    floorPalette: ["#312e59", "#1e1b40", "#0e0c24"],
    wallColorHex: 3018853,
    trimColorHex: 16436245,
    skyColorHex: 591639,
    hasMist: false,
    pillars: [
      {
        id: "tesla-pylon",
        x: 0,
        z: 0,
        radius: 0.25,
        height: 0.94,
        motion: { kind: "oscillate", speedRadPerSec: 1.05, ampX: 1.55, ampZ: 0.35 },
        debuffKind: "ArcDisruption",
        debuffDurationSec: 3
      }
    ],
    hazardZones: [
      {
        id: "arc-e",
        x: 2.15,
        z: 0,
        radius: 0.9,
        kind: "shock",
        label: "Orbiting Arc Trap",
        motion: { kind: "orbit", orbitRadius: 2.15, speedRadPerSec: -0.65, phaseOffset: 0 },
        debuffKind: "ArcDisruption",
        debuffDurationSec: 3.2
      },
      {
        id: "arc-w",
        x: -2.15,
        z: 0,
        radius: 0.9,
        kind: "shock",
        label: "Orbiting Arc Trap",
        motion: { kind: "orbit", orbitRadius: 2.15, speedRadPerSec: -0.65, phaseOffset: Math.PI },
        debuffKind: "ArcDisruption",
        debuffDurationSec: 3.2
      }
    ]
  },
  temple: {
    id: "temple",
    displayName: "Ancient Temple",
    subtitle: "Moving Monoliths & Quicksand Trap",
    description: "Orbiting obsidian sentinel pillars patrol dual-surface stone while a shifting quicksand snare saps speed and corrodes armor.",
    hazardSummary: "2 Moving Monoliths (Armor Corrosion) \xB7 Shifting Sand Trap (-28% Spd, -15% Def)",
    surfaceFrictionMult: 1.18,
    rotationalDragMult: 1.06,
    energyModPerSec: 0,
    primaryColor: "#d97706",
    accentColor: "#34d399",
    floorPalette: ["#3f3425", "#292219", "#16120d"],
    wallColorHex: 4472892,
    trimColorHex: 14251782,
    skyColorHex: 1183241,
    hasMist: false,
    pillars: [
      { id: "temple-anchor-se", x: 1.75, z: 1.75, radius: 0.27, height: 0.85 },
      { id: "temple-anchor-nw", x: -1.75, z: -1.75, radius: 0.27, height: 0.85 },
      {
        id: "monolith-orb-1",
        x: 1.95,
        z: 0,
        radius: 0.27,
        height: 0.92,
        motion: { kind: "orbit", orbitRadius: 1.95, speedRadPerSec: 0.56, phaseOffset: Math.PI * 0.25 },
        debuffKind: "ArmorCorrosion",
        debuffDurationSec: 3.5
      },
      {
        id: "monolith-orb-2",
        x: -1.95,
        z: 0,
        radius: 0.27,
        height: 0.92,
        motion: { kind: "orbit", orbitRadius: 1.95, speedRadPerSec: 0.56, phaseOffset: Math.PI * 1.25 },
        debuffKind: "ArmorCorrosion",
        debuffDurationSec: 3.5
      }
    ],
    hazardZones: [
      {
        id: "sand-center",
        x: 0,
        z: 0,
        radius: 0.98,
        kind: "sand",
        label: "Quicksand Snare",
        motion: { kind: "oscillate", speedRadPerSec: 0.85, ampX: 0.85, ampZ: 0.4 },
        debuffKind: "DragSnare",
        debuffDurationSec: 3.5
      }
    ]
  },
  shadow: {
    id: "shadow",
    displayName: "Shadow Dimension",
    subtitle: "Umbral Mist & Orbiting Void Rifts",
    description: "Shrouded void dish where drifting gravity wells siphon energy regeneration and sap clash attack power.",
    hazardSummary: "Visibility Mist \xB7 Orbiting Void Rifts (-25% Energy Regen, -16% Attack)",
    surfaceFrictionMult: 0.92,
    rotationalDragMult: 1.08,
    energyModPerSec: 0.4,
    primaryColor: "#a855f7",
    accentColor: "#e879f9",
    floorPalette: ["#2e1045", "#1b092b", "#0b0314"],
    wallColorHex: 1968435,
    trimColorHex: 11032055,
    skyColorHex: 327946,
    hasMist: true,
    pillars: [],
    hazardZones: [
      {
        id: "void-n",
        x: 0,
        z: 2,
        radius: 0.98,
        kind: "void",
        label: "Void Vortex",
        motion: { kind: "orbit", orbitRadius: 2, speedRadPerSec: 0.48, phaseOffset: Math.PI * 0.5 },
        debuffKind: "VoidSiphon",
        debuffDurationSec: 3.4
      },
      {
        id: "void-s",
        x: 0,
        z: -2,
        radius: 0.98,
        kind: "void",
        label: "Void Vortex",
        motion: { kind: "orbit", orbitRadius: 2, speedRadPerSec: 0.48, phaseOffset: -Math.PI * 0.5 },
        debuffKind: "VoidSiphon",
        debuffDurationSec: 3.4
      }
    ]
  }
};
var SECONDARY_ELEMENTS = {
  Earth: {
    id: "Earth",
    displayName: "Terra Core",
    primaryColor: "#d97706",
    secondaryColor: "#fde68a",
    emissiveHex: 14251782,
    primaryHex: 14251782,
    secondaryHex: 16639626,
    strongAgainst: ["Lightning", "Fire"],
    weakAgainst: ["Wind", "Water"],
    passiveLabel: "+12% Knockback Resistance & Armor"
  },
  Wind: {
    id: "Wind",
    displayName: "Aero Core",
    primaryColor: "#34d399",
    secondaryColor: "#a7f3d0",
    emissiveHex: 1096065,
    primaryHex: 3462041,
    secondaryHex: 11006928,
    strongAgainst: ["Earth", "Water"],
    weakAgainst: ["Ice", "Lightning"],
    passiveLabel: "+12% Launch Velocity Retention"
  },
  Shadow: {
    id: "Shadow",
    displayName: "Umbra Core",
    primaryColor: "#a855f7",
    secondaryColor: "#f472b6",
    emissiveHex: 9647082,
    primaryHex: 11032055,
    secondaryHex: 16020150,
    strongAgainst: ["Light", "Water"],
    weakAgainst: ["Fire", "Light"],
    passiveLabel: "+10% Energy Siphon on Clash"
  },
  Light: {
    id: "Light",
    displayName: "Solaris Core",
    primaryColor: "#fef08a",
    secondaryColor: "#38bdf8",
    emissiveHex: 16638023,
    primaryHex: 16707722,
    secondaryHex: 3718648,
    strongAgainst: ["Shadow", "Ice"],
    weakAgainst: ["Earth", "Shadow"],
    passiveLabel: "+15% Status Resistance & Purify"
  }
};
var EXPANSION_COMPONENTS = [
  // New Elemental Spirit Cores (Earth, Wind, Shadow, Light)
  {
    id: "core.terra",
    displayName: "Terra Bastion Core",
    description: "High-density basalt gyroscope anchoring impact absorption against heavy strikers.",
    category: "SpiritCore",
    rarity: "Uncommon",
    elementAffinity: "Earth",
    massKg: 0.019,
    radiusContribution: 3e-3,
    rotationalDrag: 22e-4,
    groundFriction: 0,
    restitution: 0.02,
    durability: 30,
    modifiers: { defense: 18, stability: 16, speed: -3 },
    visual: { primaryColor: 14251782, accentColor: 16639626, metalness: 0.65, roughness: 0.35 },
    unlockCostGold: 160
  },
  {
    id: "core.zephyr",
    displayName: "Zephyr Turbine Core",
    description: "Featherweight aero bearing minimizing drag while amplifying orbital drift speed.",
    category: "SpiritCore",
    rarity: "Rare",
    elementAffinity: "Wind",
    massKg: 0.011,
    radiusContribution: 2e-3,
    rotationalDrag: 11e-4,
    groundFriction: 0,
    restitution: 0.06,
    durability: 17,
    modifiers: { speed: 18, stamina: 14, control: 12 },
    visual: { primaryColor: 3462041, accentColor: 11006928, metalness: 0.55, roughness: 0.18 },
    unlockCostGold: 240
  },
  {
    id: "core.umbra",
    displayName: "Umbra Rift Core",
    description: "Phase-tuned shadow reactor siphoning rival energy on every blade contact.",
    category: "SpiritCore",
    rarity: "Epic",
    elementAffinity: "Shadow",
    massKg: 0.015,
    radiusContribution: 3e-3,
    rotationalDrag: 26e-4,
    groundFriction: 0,
    restitution: 0.07,
    durability: 21,
    modifiers: { attack: 16, energy: 18, critical: 14 },
    visual: { primaryColor: 9647082, accentColor: 16020150, metalness: 0.72, roughness: 0.2 },
    unlockCostGold: 360
  },
  {
    id: "core.solaris",
    displayName: "Solaris Radiant Core",
    description: "Photonic stabilizer purifying negative effects while surging resonance charge.",
    category: "SpiritCore",
    rarity: "Epic",
    elementAffinity: "Light",
    massKg: 0.015,
    radiusContribution: 3e-3,
    rotationalDrag: 17e-4,
    groundFriction: 0,
    restitution: 0.05,
    durability: 25,
    modifiers: { defense: 14, energy: 18, stability: 14, critical: 10 },
    visual: { primaryColor: 16638023, accentColor: 16777215, metalness: 0.8, roughness: 0.14 },
    unlockCostGold: 380
  },
  // Mythic Forgeable Components (Sink for Legendary Fragments & Energy Crystals!)
  {
    id: "core.chronos_mythic",
    displayName: "Chronos Singularity",
    description: "Mythic dual-stabilized plasma spindle forged from Legendary Fragments & Energy Crystals.",
    category: "SpiritCore",
    rarity: "Mythic",
    elementAffinity: "Light",
    massKg: 0.017,
    radiusContribution: 3e-3,
    rotationalDrag: 12e-4,
    groundFriction: 0,
    restitution: 0.07,
    durability: 32,
    modifiers: { attack: 18, defense: 18, stamina: 18, energy: 22, critical: 16 },
    visual: { primaryColor: 16707722, accentColor: 2282478, metalness: 0.92, roughness: 0.12 },
    unlockCostGold: 1200,
    forgeCost: { legendaryFragments: 3, energyCrystals: 20, gold: 450 }
  },
  {
    id: "blade.celestial_scythe",
    displayName: "Celestial Scythe Ring",
    description: "Mythic 5-wing titanium scythe delivering extreme critical velocity and high durability.",
    category: "AttackBlade",
    rarity: "Mythic",
    massKg: 0.027,
    radiusContribution: 0.0185,
    rotationalDrag: 24e-4,
    groundFriction: 0,
    restitution: 0.18,
    durability: 36,
    modifiers: { attack: 24, critical: 22, speed: 14, stamina: 10 },
    visual: { primaryColor: 2282478, accentColor: 16638023, metalness: 0.92, roughness: 0.15, bladeShape: "vortex", bladeCount: 5 },
    unlockCostGold: 1100,
    forgeCost: { legendaryFragments: 3, energyCrystals: 18, gold: 420 }
  },
  {
    id: "armor.obsidian_aegis",
    displayName: "Obsidian Void Shroud",
    description: "Mythic layered void-alloy armor engineered to survive devastating Boss and Burst clashes.",
    category: "ArmorRing",
    rarity: "Mythic",
    massKg: 0.021,
    radiusContribution: 8e-3,
    rotationalDrag: 12e-4,
    groundFriction: 0,
    restitution: 0.09,
    durability: 48,
    modifiers: { defense: 26, stability: 18, energy: 8 },
    visual: { primaryColor: 3868516, accentColor: 15235577, metalness: 0.88, roughness: 0.22 },
    unlockCostGold: 950,
    forgeCost: { legendaryFragments: 2, energyCrystals: 16, gold: 380 }
  },
  {
    id: "driver.quantum_float",
    displayName: "Quantum Mag-Lev Tip",
    description: "Mythic magnetic bearing tip floating slightly over stadium grit with ultra-low spin decay.",
    category: "PerformanceDriver",
    rarity: "Mythic",
    massKg: 8e-3,
    radiusContribution: 2e-3,
    rotationalDrag: 8e-4,
    groundFriction: 0.18,
    restitution: 0.03,
    durability: 16,
    modifiers: { stamina: 24, stability: 18, speed: 12, control: 16 },
    visual: { primaryColor: 959977, accentColor: 16707722, metalness: 0.9, roughness: 0.12, driverType: "ball" },
    unlockCostGold: 900,
    forgeCost: { legendaryFragments: 2, energyCrystals: 15, gold: 360 }
  }
];
var EXPANSION_ABILITIES = [
  {
    id: "ability.earth.stone_guard",
    displayName: "Stone Guard",
    description: "Hardens chassis with Earth resonance, shielding 60% impact damage and anchoring stability.",
    type: "Defensive",
    element: "Earth",
    energyCost: 26,
    resonanceCost: 0,
    cooldownSec: 8.5,
    durationSec: 4,
    power: 0.6,
    effectKind: "BarrierShield",
    statusApplied: "Shield",
    colorHex: "#d97706"
  },
  {
    id: "ability.wind.cyclone_dash",
    displayName: "Cyclone Dash",
    description: "Rides an aero slipstream for rapid strike velocity while regaining spin stamina.",
    type: "Elemental",
    element: "Wind",
    energyCost: 26,
    resonanceCost: 0,
    cooldownSec: 6.5,
    durationSec: 2.5,
    power: 1.38,
    effectKind: "DashStrike",
    statusApplied: "Overdrive",
    colorHex: "#34d399"
  },
  {
    id: "ability.shadow.shadow_veil",
    displayName: "Shadow Veil",
    description: "Phase-shifts laterally to evade incoming clashes and weakens rival attack output.",
    type: "Tactical",
    element: "Shadow",
    energyCost: 24,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3,
    power: 1.35,
    effectKind: "SpinStabilize",
    statusApplied: "Weaken",
    colorHex: "#a855f7"
  },
  {
    id: "ability.shadow.energy_drain",
    displayName: "Energy Drain",
    description: "Siphons 18 energy from the rival within range and inflicts continuous Drain.",
    type: "Elemental",
    element: "Shadow",
    energyCost: 28,
    resonanceCost: 0,
    cooldownSec: 9,
    durationSec: 3.5,
    power: 1.3,
    effectKind: "EnergyDrain",
    statusApplied: "Drain",
    colorHex: "#e879f9"
  },
  {
    id: "ability.light.radiant_shield",
    displayName: "Radiant Shield",
    description: "Cleanses all negative debuffs and deploys a luminous protective field.",
    type: "Defensive",
    element: "Light",
    energyCost: 26,
    resonanceCost: 0,
    cooldownSec: 9,
    durationSec: 4,
    power: 0.58,
    effectKind: "PurifyCleanse",
    statusApplied: "Purify",
    colorHex: "#fef08a"
  },
  {
    id: "ability.light.purification",
    displayName: "Purification Pulse",
    description: "Purifies negative statuses, boosts gyro stability, and weakens adjacent rivals.",
    type: "Tactical",
    element: "Light",
    energyCost: 24,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3,
    power: 24,
    effectKind: "PurifyCleanse",
    statusApplied: "Purify",
    colorHex: "#fde047"
  },
  {
    id: "ability.ult.solar_burst",
    displayName: "Solar Burst",
    description: "Requires 100% Resonance. Unleashes radiant plasma purifying self & weakening rival.",
    type: "Ultimate",
    element: "Light",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3.5,
    power: 2.3,
    effectKind: "UltimateStrike",
    statusApplied: "Weaken",
    colorHex: "#fef08a"
  },
  {
    id: "ability.ult.terraquake",
    displayName: "Terraquake",
    description: "Requires 100% Resonance. Slams seismic shockwaves cracking rival component armor.",
    type: "Ultimate",
    element: "Earth",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3,
    power: 2.4,
    effectKind: "UltimateStrike",
    statusApplied: "Weaken",
    colorHex: "#f59e0b"
  },
  {
    id: "ability.ult.abyssal_maelstrom",
    displayName: "Abyssal Maelstrom",
    description: "Requires 100% Resonance. Unleashes a crushing hydro vortex pulling rivals inward and slowing spin.",
    type: "Ultimate",
    element: "Water",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3.5,
    power: 2.25,
    effectKind: "UltimateStrike",
    statusApplied: "Slow",
    colorHex: "#22b8ff"
  },
  {
    id: "ability.ult.absolute_zero",
    displayName: "Absolute Zero",
    description: "Requires 100% Resonance. Encases the dish in cryogenic shockwaves freezing rival control.",
    type: "Ultimate",
    element: "Ice",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3.5,
    power: 2.25,
    effectKind: "UltimateStrike",
    statusApplied: "Freeze",
    colorHex: "#7dd3fc"
  },
  {
    id: "ability.ult.cyclone_tempest",
    displayName: "Cyclone Tempest",
    description: "Requires 100% Resonance. Surges on supersonic slipstreams for rapid multi-angle impact.",
    type: "Ultimate",
    element: "Wind",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3,
    power: 2.3,
    effectKind: "UltimateStrike",
    statusApplied: "Overdrive",
    colorHex: "#34d399"
  },
  {
    id: "ability.ult.eclipse_abyss",
    displayName: "Eclipse Abyss",
    description: "Requires 100% Resonance. Tears a shadow singularity siphoning energy while shattering armor.",
    type: "Ultimate",
    element: "Shadow",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3.5,
    power: 2.35,
    effectKind: "UltimateStrike",
    statusApplied: "Drain",
    colorHex: "#a855f7"
  }
];
var EXPANSION_TOP_DEFINITIONS = [
  {
    id: "top.terra.monolith",
    displayName: "Terra Monolith",
    title: "Seismic Bulwark",
    description: "Earth defender forged to outlast heavy impacts and crack rival blades.",
    archetype: "Defender",
    element: "Earth",
    rarity: "Uncommon",
    baseAttributes: { attack: 38, defense: 60, stamina: 48, speed: 28, stability: 60, control: 42, energy: 40, critical: 30 },
    defaultComponents: {
      SpiritCore: "core.terra",
      AttackBlade: "blade.bastion",
      ArmorRing: "armor.fortress",
      WeightDisc: "weight.tungsten",
      PerformanceDriver: "driver.rubber",
      EnergyModule: "energy.cell"
    },
    defaultAbilities: [
      "ability.earth.stone_guard",
      "ability.def.gyro_anchor",
      "ability.tac.vortex_pull",
      "ability.ult.terraquake"
    ],
    unlockCostGold: 280
  },
  {
    id: "top.zephyr.valkyrie",
    displayName: "Zephyr Valkyrie",
    title: "Cyclone Interceptor",
    description: "Wind stamina/speed hybrid exploiting low-drag aero wings and flank orbits.",
    archetype: "Stamina",
    element: "Wind",
    rarity: "Rare",
    baseAttributes: { attack: 40, defense: 34, stamina: 58, speed: 58, stability: 48, control: 54, energy: 46, critical: 42 },
    defaultComponents: {
      SpiritCore: "core.zephyr",
      AttackBlade: "blade.glider",
      ArmorRing: "armor.feather",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.ball",
      EnergyModule: "energy.resonance"
    },
    defaultAbilities: [
      "ability.wind.cyclone_dash",
      "ability.def.aegis_barrier",
      "ability.tac.slipstream_evade",
      "ability.ult.cyclone_tempest"
    ],
    unlockCostGold: 360
  },
  {
    id: "top.umbra.phantom",
    displayName: "Umbra Phantom",
    title: "Void Siphoner",
    description: "Shadow attacker draining rival capacitor charge while striking from blind angles.",
    archetype: "Attacker",
    element: "Shadow",
    rarity: "Epic",
    baseAttributes: { attack: 56, defense: 36, stamina: 38, speed: 52, stability: 40, control: 50, energy: 56, critical: 54 },
    defaultComponents: {
      SpiritCore: "core.umbra",
      AttackBlade: "blade.sawtooth",
      ArmorRing: "armor.reactive",
      WeightDisc: "weight.light",
      PerformanceDriver: "driver.flat",
      EnergyModule: "energy.resonance"
    },
    defaultAbilities: [
      "ability.shadow.energy_drain",
      "ability.def.aegis_barrier",
      "ability.shadow.shadow_veil",
      "ability.ult.eclipse_abyss"
    ],
    unlockCostGold: 540
  },
  {
    id: "top.solaris.chronos",
    displayName: "Solaris Chronos",
    title: "Mythic Custodian",
    description: "Mythic Light sovereign forged with Legendary Fragments and Energy Crystals.",
    archetype: "Balance",
    element: "Light",
    rarity: "Mythic",
    baseAttributes: { attack: 58, defense: 56, stamina: 56, speed: 54, stability: 58, control: 56, energy: 62, critical: 56 },
    defaultComponents: {
      SpiritCore: "core.chronos_mythic",
      AttackBlade: "blade.celestial_scythe",
      ArmorRing: "armor.obsidian_aegis",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.quantum_float",
      EnergyModule: "energy.overclock"
    },
    defaultAbilities: [
      "ability.light.radiant_shield",
      "ability.light.purification",
      "ability.tac.overdrive_surge",
      "ability.ult.solar_burst"
    ],
    unlockCostGold: 1500,
    forgeCost: { legendaryFragments: 4, energyCrystals: 24 }
  }
];
var EXPANSION_OPPONENTS = [
  {
    id: "opponent.adaptive.nexus",
    displayName: "Nexus-9",
    title: "Adaptive Strategist",
    topId: "top.zephyr.valkyrie",
    personality: "Adaptive",
    difficulty: "Hard",
    level: 7,
    isBoss: false,
    preferredArenaId: "thunder",
    secondaryElement: "Lightning",
    components: {
      SpiritCore: "core.zephyr",
      AttackBlade: "blade.vortex",
      ArmorRing: "armor.reactive",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.ball",
      EnergyModule: "energy.resonance"
    },
    abilities: [
      "ability.wind.cyclone_dash",
      "ability.def.aegis_barrier",
      "ability.tac.slipstream_evade",
      "ability.ult.cyclone_tempest"
    ],
    rewardGold: 320,
    rewardXp: 210,
    description: "Adaptive AI that studies your launch vector, item timing, and element tendencies."
  },
  {
    id: "opponent.boss.ignis_overlord",
    displayName: "Caldera Rex",
    title: "Volcanic Boss \xB7 3 Phases",
    topId: "top.crimson.fang",
    personality: "HeavyAssault",
    difficulty: "Expert",
    level: 11,
    isBoss: true,
    preferredArenaId: "volcanic",
    secondaryElement: "Earth",
    components: {
      SpiritCore: "core.crimson",
      AttackBlade: "blade.titan",
      ArmorRing: "armor.fortress",
      WeightDisc: "weight.tungsten",
      PerformanceDriver: "driver.flat",
      EnergyModule: "energy.overclock"
    },
    abilities: [
      "ability.fire.flame_burst",
      "ability.earth.stone_guard",
      "ability.tac.overdrive_surge",
      "ability.ult.inferno_nova"
    ],
    rewardGold: 720,
    rewardXp: 460,
    description: "Standalone Volcanic Boss shifting across Thermal, Siege, and Meltdown phases.",
    bossPhases: [
      {
        thresholdRatio: 0.72,
        phaseName: "Thermal Surge",
        bannerText: "BOSS PHASE 2: THERMAL SURGE!",
        modeShift: "Attack",
        commandShift: "Aggressive",
        energyBurst: 35,
        arenaShock: false
      },
      {
        thresholdRatio: 0.38,
        phaseName: "Caldera Meltdown",
        bannerText: "BOSS FINAL PHASE: CALDERA MELTDOWN!",
        modeShift: "Berserk",
        commandShift: "Chase",
        energyBurst: 60,
        arenaShock: true
      }
    ]
  },
  {
    id: "opponent.boss.umbra_eclipse",
    displayName: "Lady Noctis",
    title: "Shadow Dimension Boss",
    topId: "top.umbra.phantom",
    personality: "Adaptive",
    difficulty: "Expert",
    level: 12,
    isBoss: true,
    preferredArenaId: "shadow",
    secondaryElement: "Ice",
    components: {
      SpiritCore: "core.umbra",
      AttackBlade: "blade.celestial_scythe",
      ArmorRing: "armor.obsidian_aegis",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.quantum_float",
      EnergyModule: "energy.overclock"
    },
    abilities: [
      "ability.shadow.energy_drain",
      "ability.shadow.shadow_veil",
      "ability.tac.vortex_pull",
      "ability.ult.eclipse_abyss"
    ],
    rewardGold: 850,
    rewardXp: 540,
    description: "Dimension Sovereign warping mist visibility, siphoning energy, and adapting mid-clash.",
    bossPhases: [
      {
        thresholdRatio: 0.7,
        phaseName: "Eclipse Veil",
        bannerText: "BOSS PHASE 2: ECLIPSE VEIL!",
        modeShift: "Counter",
        commandShift: "Counter",
        energyBurst: 40,
        arenaShock: true
      },
      {
        thresholdRatio: 0.34,
        phaseName: "Abyssal Resonance",
        bannerText: "BOSS FINAL PHASE: ABYSSAL RESONANCE!",
        modeShift: "Berserk",
        commandShift: "Aggressive",
        energyBurst: 75,
        arenaShock: true
      }
    ]
  }
];
var MISSIONS_CATALOG = [
  {
    id: "daily.win_two",
    cadence: "daily",
    title: "Daily Arena Contender",
    description: "Win 2 matches across any arena or mode today.",
    target: 2,
    metric: "battles_won",
    rewards: { gold: 180, energyCrystals: 8, score: 140 }
  },
  {
    id: "daily.item_tactician",
    cadence: "daily",
    title: "Capacitor Mastery",
    description: "Activate 6 item/ability slots in live physics combat.",
    target: 6,
    metric: "abilities_used",
    rewards: { gold: 140, energyCrystals: 10, score: 120 }
  },
  {
    id: "challenge.knockout_king",
    cadence: "challenge",
    title: "Structural Breaker",
    description: "Score 3 Burst or Knockout finishes against rivals.",
    target: 3,
    metric: "knockouts",
    rewards: { legendaryFragments: 2, energyCrystals: 14, score: 260 }
  },
  {
    id: "challenge.survival_wave_5",
    cadence: "challenge",
    title: "Endurance Gauntlet",
    description: "Reach Wave 5 or higher in Survival Mode.",
    target: 5,
    metric: "survival_wave",
    rewards: { legendaryFragments: 3, evolutionTokens: 1, score: 350 }
  },
  {
    id: "ach.boss_slayer",
    cadence: "achievement",
    title: "Sovereign Boss Slayer",
    description: "Defeat 2 standalone Multi-Phase Boss encounters.",
    target: 2,
    metric: "boss_defeated",
    rewards: { legendaryFragments: 4, energyCrystals: 20, score: 500 }
  },
  {
    id: "ach.world_tour",
    cadence: "achievement",
    title: "World Stadium Explorer",
    description: "Complete battles across all 6 distinct 3D arenas.",
    target: 6,
    metric: "arena_variety",
    rewards: { legendaryFragments: 3, elementalEssence: 30, score: 450 }
  }
];

// src/domain/catalog.ts
var COMPONENT_CATEGORIES = [
  { id: "SpiritCore", label: "Spirit Core", shortLabel: "Core" },
  { id: "AttackBlade", label: "Attack Blade", shortLabel: "Blade" },
  { id: "ArmorRing", label: "Armor Ring", shortLabel: "Armor" },
  { id: "WeightDisc", label: "Weight Disc", shortLabel: "Weight" },
  { id: "PerformanceDriver", label: "Performance Driver", shortLabel: "Driver" },
  { id: "EnergyModule", label: "Energy Module", shortLabel: "Energy" }
];
var ELEMENTS = {
  Fire: {
    id: "Fire",
    displayName: "Pyro Core",
    primaryColor: "#ff5a2f",
    secondaryColor: "#ffb347",
    emissiveHex: 16731418,
    primaryHex: 16734767,
    secondaryHex: 16757575,
    strongAgainst: ["Ice", "Wind"],
    weakAgainst: ["Water", "Earth"],
    passiveLabel: "+8% Clash Burn Impulse"
  },
  Water: {
    id: "Water",
    displayName: "Hydro Core",
    primaryColor: "#22b8ff",
    secondaryColor: "#7ce8ff",
    emissiveHex: 959977,
    primaryHex: 2275583,
    secondaryHex: 8186111,
    strongAgainst: ["Fire", "Earth"],
    weakAgainst: ["Lightning", "Wind"],
    passiveLabel: "+12% Energy Flow Regen"
  },
  Ice: {
    id: "Ice",
    displayName: "Cryo Core",
    primaryColor: "#7dd3fc",
    secondaryColor: "#e0f2fe",
    emissiveHex: 3718648,
    primaryHex: 8246268,
    secondaryHex: 14742270,
    strongAgainst: ["Lightning", "Wind"],
    weakAgainst: ["Fire", "Light"],
    passiveLabel: "+10% Gyro Stability"
  },
  Lightning: {
    id: "Lightning",
    displayName: "Volt Core",
    primaryColor: "#facc15",
    secondaryColor: "#a855f7",
    emissiveHex: 15381256,
    primaryHex: 16436245,
    secondaryHex: 11032055,
    strongAgainst: ["Water", "Wind"],
    weakAgainst: ["Ice", "Earth"],
    passiveLabel: "+10% Thrust Acceleration"
  },
  ...SECONDARY_ELEMENTS
};
var COMPONENTS = [
  // === SPIRIT CORES (6) ===
  {
    id: "core.ignis",
    displayName: "Ignis Reactor",
    description: "High-output thermal core built for relentless strike momentum.",
    category: "SpiritCore",
    rarity: "Common",
    elementAffinity: "Fire",
    massKg: 0.014,
    radiusContribution: 2e-3,
    rotationalDrag: 3e-3,
    groundFriction: 0,
    restitution: 0.05,
    durability: 18,
    modifiers: { attack: 16, critical: 12, energy: 8 },
    visual: { primaryColor: 16734767, accentColor: 16762967, metalness: 0.45, roughness: 0.2 },
    unlockCostGold: 0
  },
  {
    id: "core.aegis",
    displayName: "Aegis Tide",
    description: "Pressurized hydro-gyro core that stabilizes heavy impacts.",
    category: "SpiritCore",
    rarity: "Common",
    elementAffinity: "Water",
    massKg: 0.016,
    radiusContribution: 2e-3,
    rotationalDrag: 2e-3,
    groundFriction: 0,
    restitution: 0.02,
    durability: 24,
    modifiers: { defense: 16, stability: 12, energy: 10 },
    visual: { primaryColor: 959977, accentColor: 8186111, metalness: 0.4, roughness: 0.2 },
    unlockCostGold: 0
  },
  {
    id: "core.volt",
    displayName: "Volt Capacitor",
    description: "Arc-charged rotor core enhancing maneuverability and resonance.",
    category: "SpiritCore",
    rarity: "Uncommon",
    elementAffinity: "Lightning",
    massKg: 0.013,
    radiusContribution: 2e-3,
    rotationalDrag: 25e-4,
    groundFriction: 0,
    restitution: 0.06,
    durability: 18,
    modifiers: { speed: 14, control: 14, energy: 12 },
    visual: { primaryColor: 16436245, accentColor: 12616956, metalness: 0.55, roughness: 0.18 },
    unlockCostGold: 120
  },
  {
    id: "core.glacier",
    displayName: "Cryo Heart",
    description: "Low-friction cryogenic spindle tuned for marathon spin endurance.",
    category: "SpiritCore",
    rarity: "Uncommon",
    elementAffinity: "Ice",
    massKg: 0.015,
    radiusContribution: 2e-3,
    rotationalDrag: 14e-4,
    groundFriction: 0,
    restitution: 0.03,
    durability: 20,
    modifiers: { stamina: 18, stability: 14, defense: 8 },
    visual: { primaryColor: 8246268, accentColor: 16777215, metalness: 0.35, roughness: 0.15 },
    unlockCostGold: 140
  },
  {
    id: "core.crimson",
    displayName: "Crimson Singularity",
    description: "Aggressive overdrive core with volatile critical strike output.",
    category: "SpiritCore",
    rarity: "Rare",
    elementAffinity: "Fire",
    massKg: 0.015,
    radiusContribution: 3e-3,
    rotationalDrag: 34e-4,
    groundFriction: 0,
    restitution: 0.08,
    durability: 17,
    modifiers: { attack: 20, speed: 10, critical: 16 },
    visual: { primaryColor: 15680580, accentColor: 16347926, metalness: 0.65, roughness: 0.16 },
    unlockCostGold: 260
  },
  {
    id: "core.sovereign",
    displayName: "Sovereign Apex",
    description: "Champion-grade balanced plasma core with superior energy density.",
    category: "SpiritCore",
    rarity: "Legendary",
    elementAffinity: "Lightning",
    massKg: 0.016,
    radiusContribution: 3e-3,
    rotationalDrag: 18e-4,
    groundFriction: 0,
    restitution: 0.06,
    durability: 24,
    modifiers: { attack: 14, defense: 14, stamina: 14, energy: 16, critical: 12 },
    visual: { primaryColor: 16096779, accentColor: 3718648, metalness: 0.85, roughness: 0.14 },
    unlockCostGold: 520
  },
  // === ATTACK BLADES (6) ===
  {
    id: "blade.fang",
    displayName: "Twin-Fang Edge",
    description: "Sharp 3-point contact blade focused on concentrated knockback strikes.",
    category: "AttackBlade",
    rarity: "Common",
    massKg: 0.022,
    radiusContribution: 0.016,
    rotationalDrag: 42e-4,
    groundFriction: 0,
    restitution: 0.16,
    durability: 22,
    modifiers: { attack: 18, critical: 12, speed: 6 },
    visual: { primaryColor: 14753096, accentColor: 16622767, metalness: 0.78, roughness: 0.24, bladeShape: "sharp", bladeCount: 3 },
    unlockCostGold: 0
  },
  {
    id: "blade.bastion",
    displayName: "Wide Bastion Rim",
    description: "Broad perimeter profile that absorbs and deflects incoming shocks.",
    category: "AttackBlade",
    rarity: "Common",
    massKg: 0.028,
    radiusContribution: 0.017,
    rotationalDrag: 32e-4,
    groundFriction: 0,
    restitution: 0.06,
    durability: 32,
    modifiers: { defense: 18, stability: 10, attack: 6 },
    visual: { primaryColor: 165063, accentColor: 12248829, metalness: 0.65, roughness: 0.32, bladeShape: "wide", bladeCount: 4 },
    unlockCostGold: 0
  },
  {
    id: "blade.sawtooth",
    displayName: "Multi-Point Saw",
    description: "6-tooth serrated alloy wheel delivering rapid multi-hit spin clashes.",
    category: "AttackBlade",
    rarity: "Uncommon",
    massKg: 0.024,
    radiusContribution: 0.0165,
    rotationalDrag: 48e-4,
    groundFriction: 0,
    restitution: 0.14,
    durability: 24,
    modifiers: { attack: 15, critical: 18, control: 5 },
    visual: { primaryColor: 14251782, accentColor: 16707722, metalness: 0.85, roughness: 0.22, bladeShape: "multipoint", bladeCount: 6 },
    unlockCostGold: 130
  },
  {
    id: "blade.glider",
    displayName: "Curved Aero Wing",
    description: "Swept aerodynamic fins minimizing drag while slicing glancing impacts.",
    category: "AttackBlade",
    rarity: "Uncommon",
    massKg: 0.021,
    radiusContribution: 0.016,
    rotationalDrag: 22e-4,
    groundFriction: 0,
    restitution: 0.1,
    durability: 25,
    modifiers: { stamina: 14, speed: 12, control: 10 },
    visual: { primaryColor: 3718648, accentColor: 14742270, metalness: 0.72, roughness: 0.2, bladeShape: "curved", bladeCount: 4 },
    unlockCostGold: 150
  },
  {
    id: "blade.titan",
    displayName: "Heavy Impact Crusher",
    description: "Thick forged war-ring engineered for devastating momentum transfer.",
    category: "AttackBlade",
    rarity: "Rare",
    massKg: 0.032,
    radiusContribution: 0.018,
    rotationalDrag: 45e-4,
    groundFriction: 0,
    restitution: 0.18,
    durability: 34,
    modifiers: { attack: 22, defense: 10, speed: -4 },
    visual: { primaryColor: 4674921, accentColor: 16347926, metalness: 0.9, roughness: 0.28, bladeShape: "heavy", bladeCount: 4 },
    unlockCostGold: 270
  },
  {
    id: "blade.vortex",
    displayName: "Vortex Turbine",
    description: "Spiral-slotted high-velocity rotor generating inward air stability.",
    category: "AttackBlade",
    rarity: "Epic",
    massKg: 0.025,
    radiusContribution: 0.0175,
    rotationalDrag: 26e-4,
    groundFriction: 0,
    restitution: 0.13,
    durability: 28,
    modifiers: { attack: 16, stamina: 12, speed: 14, critical: 12 },
    visual: { primaryColor: 8141549, accentColor: 16638023, metalness: 0.85, roughness: 0.18, bladeShape: "vortex", bladeCount: 5 },
    unlockCostGold: 420
  },
  // === ARMOR RINGS (4) ===
  {
    id: "armor.composite",
    displayName: "Composite Shroud",
    description: "Balanced polymer-alloy collar protecting the core chassis.",
    category: "ArmorRing",
    rarity: "Common",
    massKg: 0.015,
    radiusContribution: 6e-3,
    rotationalDrag: 12e-4,
    groundFriction: 0,
    restitution: 0.04,
    durability: 24,
    modifiers: { defense: 10, stability: 8 },
    visual: { primaryColor: 3359061, accentColor: 9741240, metalness: 0.4, roughness: 0.55 },
    unlockCostGold: 0
  },
  {
    id: "armor.fortress",
    displayName: "Titanium Bulwark",
    description: "Reinforced thick-wall shield ring resisting Burst Finish shocks.",
    category: "ArmorRing",
    rarity: "Uncommon",
    massKg: 0.022,
    radiusContribution: 8e-3,
    rotationalDrag: 18e-4,
    groundFriction: 0,
    restitution: 0.02,
    durability: 42,
    modifiers: { defense: 22, stability: 12, speed: -5 },
    visual: { primaryColor: 1981023, accentColor: 3718648, metalness: 0.85, roughness: 0.3 },
    unlockCostGold: 140
  },
  {
    id: "armor.feather",
    displayName: "Carbon Feather Ring",
    description: "Ultra-light slotted guard maximizing acceleration and agility.",
    category: "ArmorRing",
    rarity: "Uncommon",
    massKg: 0.01,
    radiusContribution: 5e-3,
    rotationalDrag: 8e-4,
    groundFriction: 0,
    restitution: 0.07,
    durability: 18,
    modifiers: { speed: 15, control: 10, defense: 4 },
    visual: { primaryColor: 1579035, accentColor: 16007006, metalness: 0.3, roughness: 0.65 },
    unlockCostGold: 130
  },
  {
    id: "armor.reactive",
    displayName: "Reactive Shock Frame",
    description: "Spring-damped perimeter frame converting impacts into recoil.",
    category: "ArmorRing",
    rarity: "Rare",
    massKg: 0.018,
    radiusContribution: 7e-3,
    rotationalDrag: 14e-4,
    groundFriction: 0,
    restitution: 0.14,
    durability: 34,
    modifiers: { defense: 16, attack: 8, critical: 8 },
    visual: { primaryColor: 4144966, accentColor: 16436245, metalness: 0.78, roughness: 0.25 },
    unlockCostGold: 260
  },
  // === WEIGHT DISCS (4) ===
  {
    id: "weight.light",
    displayName: "Core Alloy Disc",
    description: "Lightweight central disc tuned for quick directional bursts.",
    category: "WeightDisc",
    rarity: "Common",
    massKg: 0.024,
    radiusContribution: 8e-3,
    rotationalDrag: 1e-3,
    groundFriction: 0,
    restitution: 0.02,
    durability: 14,
    modifiers: { speed: 14, control: 8 },
    visual: { primaryColor: 9741240, accentColor: 14870768, metalness: 0.92, roughness: 0.2 },
    unlockCostGold: 0
  },
  {
    id: "weight.outer",
    displayName: "Outer-Rim Flywheel",
    description: "Perimeter-weighted steel ring boosting rotational inertia I = \xBDmr\xB2.",
    category: "WeightDisc",
    rarity: "Uncommon",
    massKg: 0.032,
    radiusContribution: 0.014,
    rotationalDrag: 9e-4,
    groundFriction: 0,
    restitution: 0.03,
    durability: 18,
    modifiers: { stamina: 16, stability: 14, speed: -4 },
    visual: { primaryColor: 13358561, accentColor: 3718648, metalness: 0.95, roughness: 0.16 },
    unlockCostGold: 150
  },
  {
    id: "weight.tungsten",
    displayName: "Tungsten Hammer Disc",
    description: "Ultra-dense flywheel delivering massive collision momentum.",
    category: "WeightDisc",
    rarity: "Rare",
    massKg: 0.042,
    radiusContribution: 0.013,
    rotationalDrag: 15e-4,
    groundFriction: 0,
    restitution: 0.04,
    durability: 22,
    modifiers: { attack: 14, defense: 14, stability: 10, speed: -8 },
    visual: { primaryColor: 6583435, accentColor: 16096779, metalness: 0.95, roughness: 0.25 },
    unlockCostGold: 280
  },
  {
    id: "weight.gyro",
    displayName: "Balanced Gyro Core",
    description: "Precision-machined brass flywheel keeping wobble near zero.",
    category: "WeightDisc",
    rarity: "Rare",
    massKg: 0.03,
    radiusContribution: 0.012,
    rotationalDrag: 8e-4,
    groundFriction: 0,
    restitution: 0.02,
    durability: 18,
    modifiers: { stability: 18, stamina: 12, control: 10 },
    visual: { primaryColor: 14251782, accentColor: 16708551, metalness: 0.9, roughness: 0.18 },
    unlockCostGold: 250
  },
  // === PERFORMANCE DRIVERS (4) ===
  {
    id: "driver.flat",
    displayName: "Flat Rush Tip",
    description: "Wide flat contact face producing aggressive arena-sweeping speed.",
    category: "PerformanceDriver",
    rarity: "Common",
    massKg: 8e-3,
    radiusContribution: 2e-3,
    rotationalDrag: 46e-4,
    groundFriction: 0.34,
    restitution: 0.02,
    durability: 8,
    modifiers: { speed: 20, attack: 8, stamina: -6 },
    visual: { primaryColor: 15680580, accentColor: 16698058, metalness: 0.35, roughness: 0.45, driverType: "flat" },
    unlockCostGold: 0
  },
  {
    id: "driver.sharp",
    displayName: "Needle Point Tip",
    description: "Pinpoint hardened steel spindle minimizing friction for pure stamina.",
    category: "PerformanceDriver",
    rarity: "Common",
    massKg: 8e-3,
    radiusContribution: 1e-3,
    rotationalDrag: 12e-4,
    groundFriction: 0.12,
    restitution: 0.01,
    durability: 8,
    modifiers: { stamina: 22, stability: 10, speed: -6 },
    visual: { primaryColor: 3718648, accentColor: 14742270, metalness: 0.9, roughness: 0.14, driverType: "sharp" },
    unlockCostGold: 0
  },
  {
    id: "driver.rubber",
    displayName: "Grip Elastomer Tip",
    description: "High-traction rubberized cone resisting Ring Out knockback.",
    category: "PerformanceDriver",
    rarity: "Uncommon",
    massKg: 9e-3,
    radiusContribution: 2e-3,
    rotationalDrag: 52e-4,
    groundFriction: 0.46,
    restitution: 0.02,
    durability: 10,
    modifiers: { control: 20, defense: 10, speed: 8, stamina: -8 },
    visual: { primaryColor: 1976635, accentColor: 16436245, metalness: 0.1, roughness: 0.85, driverType: "rubber" },
    unlockCostGold: 120
  },
  {
    id: "driver.ball",
    displayName: "Orbital Bearing Tip",
    description: "Free-spinning ceramic ball tip balancing mobility and endurance.",
    category: "PerformanceDriver",
    rarity: "Rare",
    massKg: 9e-3,
    radiusContribution: 2e-3,
    rotationalDrag: 21e-4,
    groundFriction: 0.22,
    restitution: 0.02,
    durability: 12,
    modifiers: { stamina: 12, stability: 14, speed: 8, control: 10 },
    visual: { primaryColor: 6514417, accentColor: 14739455, metalness: 0.7, roughness: 0.2, driverType: "ball" },
    unlockCostGold: 220
  },
  // === ENERGY MODULES (3) ===
  {
    id: "energy.cell",
    displayName: "Pulse Capacitor",
    description: "Standard induction coil providing steady ability energy flow.",
    category: "EnergyModule",
    rarity: "Common",
    massKg: 6e-3,
    radiusContribution: 2e-3,
    rotationalDrag: 5e-4,
    groundFriction: 0,
    restitution: 0.01,
    durability: 10,
    modifiers: { energy: 12, control: 6 },
    visual: { primaryColor: 2282478, accentColor: 10875900, metalness: 0.5, roughness: 0.25 },
    unlockCostGold: 0
  },
  {
    id: "energy.resonance",
    displayName: "Resonance Amplifier",
    description: "Tuned harmonic stator accelerating Ultimate Resonance buildup.",
    category: "EnergyModule",
    rarity: "Uncommon",
    massKg: 7e-3,
    radiusContribution: 2e-3,
    rotationalDrag: 7e-4,
    groundFriction: 0,
    restitution: 0.01,
    durability: 10,
    modifiers: { energy: 18, critical: 10 },
    visual: { primaryColor: 11032055, accentColor: 15984895, metalness: 0.65, roughness: 0.2 },
    unlockCostGold: 160
  },
  {
    id: "energy.overclock",
    displayName: "Hyper-Flux Dynamo",
    description: "High-efficiency brushless coil harvesting energy from high RPM.",
    category: "EnergyModule",
    rarity: "Rare",
    massKg: 7e-3,
    radiusContribution: 3e-3,
    rotationalDrag: 9e-4,
    groundFriction: 0,
    restitution: 0.02,
    durability: 12,
    modifiers: { energy: 24, speed: 6, attack: 6 },
    visual: { primaryColor: 16096779, accentColor: 16707722, metalness: 0.75, roughness: 0.18 },
    unlockCostGold: 300
  },
  ...EXPANSION_COMPONENTS
];
var ABILITIES = [
  // Elemental (4)
  {
    id: "ability.fire.flame_burst",
    displayName: "Flame Burst",
    description: "Ignites radial thrusters for a high-impulse strike and Burn drain.",
    type: "Elemental",
    element: "Fire",
    energyCost: 30,
    resonanceCost: 0,
    cooldownSec: 7,
    durationSec: 2.5,
    power: 1.45,
    effectKind: "DashStrike",
    statusApplied: "Burn",
    colorHex: "#ff5a2f"
  },
  {
    id: "ability.water.aqua_pulse",
    displayName: "Aqua Pulse",
    description: "Projects a hydro shockwave that pushes rivals and cools friction.",
    type: "Elemental",
    element: "Water",
    energyCost: 28,
    resonanceCost: 0,
    cooldownSec: 7,
    durationSec: 3,
    power: 1.25,
    effectKind: "ElementalBurst",
    statusApplied: "Slow",
    colorHex: "#22b8ff"
  },
  {
    id: "ability.ice.frost_impact",
    displayName: "Frost Impact",
    description: "Flash-chills nearby space, slowing opponent steering and speed.",
    type: "Elemental",
    element: "Ice",
    energyCost: 30,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3.5,
    power: 1.3,
    effectKind: "ElementalBurst",
    statusApplied: "Freeze",
    colorHex: "#7dd3fc"
  },
  {
    id: "ability.lightning.thunder_dash",
    displayName: "Thunder Dash",
    description: "Electro-magnetic lunge toward rival inflicting Shock control loss.",
    type: "Elemental",
    element: "Lightning",
    energyCost: 28,
    resonanceCost: 0,
    cooldownSec: 6.5,
    durationSec: 2,
    power: 1.4,
    effectKind: "DashStrike",
    statusApplied: "Shock",
    colorHex: "#facc15"
  },
  // Defensive (3)
  {
    id: "ability.def.aegis_barrier",
    displayName: "Aegis Barrier",
    description: "Projects a magnetic shield reducing incoming structural & spin damage by 55%.",
    type: "Defensive",
    energyCost: 25,
    resonanceCost: 0,
    cooldownSec: 9,
    durationSec: 4,
    power: 0.55,
    effectKind: "BarrierShield",
    statusApplied: "Shield",
    colorHex: "#38bdf8"
  },
  {
    id: "ability.def.gyro_anchor",
    displayName: "Gyro Anchor",
    description: "Stabilizes precession wobble and recovers +28% rotational stability.",
    type: "Defensive",
    energyCost: 24,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3,
    power: 28,
    effectKind: "SpinStabilize",
    colorHex: "#60a5fa"
  },
  {
    id: "ability.def.cryo_shell",
    displayName: "Cryo Shell",
    description: "Hardens outer armor ring against Burst impacts and rebounds attackers.",
    type: "Defensive",
    element: "Ice",
    energyCost: 30,
    resonanceCost: 0,
    cooldownSec: 10,
    durationSec: 4,
    power: 0.65,
    effectKind: "BarrierShield",
    statusApplied: "Shield",
    colorHex: "#a5f3fc"
  },
  // Tactical (3)
  {
    id: "ability.tac.overdrive_surge",
    displayName: "Overdrive Surge",
    description: "Boosts thrust acceleration and spin torque for aggressive pursuit.",
    type: "Tactical",
    energyCost: 25,
    resonanceCost: 0,
    cooldownSec: 8,
    durationSec: 3.5,
    power: 1.5,
    effectKind: "TacticalSurge",
    statusApplied: "Overdrive",
    colorHex: "#f97316"
  },
  {
    id: "ability.tac.vortex_pull",
    displayName: "Vortex Pull",
    description: "Draws the opponent inward toward the arena center to deny Ring Out.",
    type: "Tactical",
    energyCost: 26,
    resonanceCost: 0,
    cooldownSec: 9,
    durationSec: 2.5,
    power: 1.35,
    effectKind: "VortexPull",
    colorHex: "#c084fc"
  },
  {
    id: "ability.tac.slipstream_evade",
    displayName: "Slipstream Evade",
    description: "Side-steps incoming momentum and restores 10% rotational energy.",
    type: "Tactical",
    energyCost: 22,
    resonanceCost: 0,
    cooldownSec: 7.5,
    durationSec: 2.5,
    power: 1.25,
    effectKind: "SpinStabilize",
    colorHex: "#34d399"
  },
  // Ultimate (2+ — 4 total? Wait: 4+3+3+2 = 12 exact!)
  {
    id: "ability.ult.inferno_nova",
    displayName: "Inferno Nova",
    description: "Requires 100% Resonance. Unleashes a blazing supersonic collision strike.",
    type: "Ultimate",
    element: "Fire",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3,
    power: 2.35,
    effectKind: "UltimateStrike",
    statusApplied: "Burn",
    colorHex: "#ff3b1f"
  },
  {
    id: "ability.ult.tempest_cataclysm",
    displayName: "Tempest Cataclysm",
    description: "Requires 100% Resonance. Summons an arc-vortex shockwave & high RPM surge.",
    type: "Ultimate",
    element: "Lightning",
    energyCost: 20,
    resonanceCost: 100,
    cooldownSec: 12,
    durationSec: 3.5,
    power: 2.25,
    effectKind: "UltimateStrike",
    statusApplied: "Shock",
    colorHex: "#fde047"
  },
  ...EXPANSION_ABILITIES
];
var TOP_DEFINITIONS = [
  {
    id: "top.ignis.drake",
    displayName: "Ignis Drake",
    title: "Crimson Striker",
    description: "Aggressive Fire attacker built to shatter rivals with high-speed impacts.",
    archetype: "Attacker",
    element: "Fire",
    rarity: "Common",
    baseAttributes: {
      attack: 54,
      defense: 28,
      stamina: 32,
      speed: 56,
      stability: 34,
      control: 40,
      energy: 36,
      critical: 50
    },
    defaultComponents: {
      SpiritCore: "core.ignis",
      AttackBlade: "blade.fang",
      ArmorRing: "armor.composite",
      WeightDisc: "weight.light",
      PerformanceDriver: "driver.flat",
      EnergyModule: "energy.cell"
    },
    defaultAbilities: [
      "ability.fire.flame_burst",
      "ability.def.aegis_barrier",
      "ability.tac.overdrive_surge",
      "ability.ult.inferno_nova"
    ],
    unlockCostGold: 0
  },
  {
    id: "top.aegis.titan",
    displayName: "Aegis Titan",
    title: "Hydro Bastion",
    description: "Steadfast Water defender engineered to absorb brutal clashes and hold center.",
    archetype: "Defender",
    element: "Water",
    rarity: "Common",
    baseAttributes: {
      attack: 30,
      defense: 58,
      stamina: 46,
      speed: 26,
      stability: 58,
      control: 44,
      energy: 42,
      critical: 28
    },
    defaultComponents: {
      SpiritCore: "core.aegis",
      AttackBlade: "blade.bastion",
      ArmorRing: "armor.fortress",
      WeightDisc: "weight.outer",
      PerformanceDriver: "driver.rubber",
      EnergyModule: "energy.cell"
    },
    defaultAbilities: [
      "ability.water.aqua_pulse",
      "ability.def.gyro_anchor",
      "ability.tac.vortex_pull",
      "ability.ult.abyssal_maelstrom"
    ],
    unlockCostGold: 0
  },
  {
    id: "top.volt.tempest",
    displayName: "Volt Tempest",
    title: "Arc Tactician",
    description: "Versatile Lightning balance top excelling at orbital pursuit and rapid surges.",
    archetype: "Balance",
    element: "Lightning",
    rarity: "Uncommon",
    baseAttributes: {
      attack: 44,
      defense: 40,
      stamina: 42,
      speed: 48,
      stability: 44,
      control: 52,
      energy: 50,
      critical: 44
    },
    defaultComponents: {
      SpiritCore: "core.volt",
      AttackBlade: "blade.sawtooth",
      ArmorRing: "armor.feather",
      WeightDisc: "weight.light",
      PerformanceDriver: "driver.ball",
      EnergyModule: "energy.resonance"
    },
    defaultAbilities: [
      "ability.lightning.thunder_dash",
      "ability.def.aegis_barrier",
      "ability.tac.slipstream_evade",
      "ability.ult.tempest_cataclysm"
    ],
    unlockCostGold: 220
  },
  {
    id: "top.glacier.sentinel",
    displayName: "Glacier Sentinel",
    title: "Cryo Marathoner",
    description: "Endurance-tuned Ice stamina unit designed to outspin every challenger.",
    archetype: "Stamina",
    element: "Ice",
    rarity: "Uncommon",
    baseAttributes: {
      attack: 28,
      defense: 42,
      stamina: 62,
      speed: 34,
      stability: 56,
      control: 44,
      energy: 40,
      critical: 30
    },
    defaultComponents: {
      SpiritCore: "core.glacier",
      AttackBlade: "blade.glider",
      ArmorRing: "armor.composite",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.sharp",
      EnergyModule: "energy.cell"
    },
    defaultAbilities: [
      "ability.ice.frost_impact",
      "ability.def.cryo_shell",
      "ability.tac.slipstream_evade",
      "ability.ult.absolute_zero"
    ],
    unlockCostGold: 240
  },
  {
    id: "top.crimson.fang",
    displayName: "Crimson Fang",
    title: "Apex Crusher",
    description: "Heavy-impact Fire destroyer pairing tungsten mass with serrated blades.",
    archetype: "Attacker",
    element: "Fire",
    rarity: "Rare",
    baseAttributes: {
      attack: 58,
      defense: 36,
      stamina: 34,
      speed: 46,
      stability: 38,
      control: 38,
      energy: 38,
      critical: 56
    },
    defaultComponents: {
      SpiritCore: "core.crimson",
      AttackBlade: "blade.titan",
      ArmorRing: "armor.reactive",
      WeightDisc: "weight.tungsten",
      PerformanceDriver: "driver.flat",
      EnergyModule: "energy.overclock"
    },
    defaultAbilities: [
      "ability.fire.flame_burst",
      "ability.def.aegis_barrier",
      "ability.tac.overdrive_surge",
      "ability.ult.inferno_nova"
    ],
    unlockCostGold: 420
  },
  {
    id: "top.storm.sovereign",
    displayName: "Storm Sovereign",
    title: "Champion Prototype",
    description: "Apex tournament champion chassis with Vortex Turbine blades and Dynamo coil.",
    archetype: "Balance",
    element: "Lightning",
    rarity: "Legendary",
    baseAttributes: {
      attack: 52,
      defense: 50,
      stamina: 50,
      speed: 52,
      stability: 50,
      control: 52,
      energy: 54,
      critical: 52
    },
    defaultComponents: {
      SpiritCore: "core.sovereign",
      AttackBlade: "blade.vortex",
      ArmorRing: "armor.reactive",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.ball",
      EnergyModule: "energy.overclock"
    },
    defaultAbilities: [
      "ability.lightning.thunder_dash",
      "ability.def.gyro_anchor",
      "ability.tac.vortex_pull",
      "ability.ult.tempest_cataclysm"
    ],
    unlockCostGold: 750
  },
  ...EXPANSION_TOP_DEFINITIONS
];
var OPPONENTS = [
  {
    id: "opponent.rookie.spark",
    displayName: 'Kai "Spark"',
    title: "Quarterfinalist",
    topId: "top.volt.tempest",
    personality: "Evasive",
    difficulty: "Easy",
    level: 1,
    isBoss: false,
    components: {
      SpiritCore: "core.volt",
      AttackBlade: "blade.glider",
      ArmorRing: "armor.feather",
      WeightDisc: "weight.light",
      PerformanceDriver: "driver.ball",
      EnergyModule: "energy.cell"
    },
    abilities: [
      "ability.lightning.thunder_dash",
      "ability.def.aegis_barrier",
      "ability.tac.slipstream_evade",
      "ability.ult.tempest_cataclysm"
    ],
    rewardGold: 110,
    rewardXp: 60,
    description: "Nimble challenger relying on orbital movement and evasive maneuvers."
  },
  {
    id: "opponent.iron.bastion",
    displayName: "Sora Vance",
    title: "Iron Guardian",
    topId: "top.aegis.titan",
    personality: "Defensive",
    difficulty: "Normal",
    level: 3,
    isBoss: false,
    components: {
      SpiritCore: "core.aegis",
      AttackBlade: "blade.bastion",
      ArmorRing: "armor.fortress",
      WeightDisc: "weight.outer",
      PerformanceDriver: "driver.rubber",
      EnergyModule: "energy.cell"
    },
    abilities: [
      "ability.water.aqua_pulse",
      "ability.def.gyro_anchor",
      "ability.tac.vortex_pull",
      "ability.ult.abyssal_maelstrom"
    ],
    rewardGold: 160,
    rewardXp: 90,
    description: "High-traction defender that anchors the dish center and counters reckless rushes."
  },
  {
    id: "opponent.frost.weaver",
    displayName: "Elena Frost",
    title: "Cryo Strategist",
    topId: "top.glacier.sentinel",
    personality: "Tactical",
    difficulty: "Normal",
    level: 4,
    isBoss: false,
    components: {
      SpiritCore: "core.glacier",
      AttackBlade: "blade.glider",
      ArmorRing: "armor.composite",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.sharp",
      EnergyModule: "energy.resonance"
    },
    abilities: [
      "ability.ice.frost_impact",
      "ability.def.cryo_shell",
      "ability.tac.slipstream_evade",
      "ability.ult.absolute_zero"
    ],
    rewardGold: 200,
    rewardXp: 120,
    description: "Calculates stamina efficiency to outlast aggressive rivals into Critical phase."
  },
  {
    id: "opponent.inferno.raider",
    displayName: "Dante Blaze",
    title: "Semifinalist",
    topId: "top.crimson.fang",
    personality: "Aggressive",
    difficulty: "Hard",
    level: 6,
    isBoss: false,
    components: {
      SpiritCore: "core.crimson",
      AttackBlade: "blade.sawtooth",
      ArmorRing: "armor.reactive",
      WeightDisc: "weight.tungsten",
      PerformanceDriver: "driver.flat",
      EnergyModule: "energy.overclock"
    },
    abilities: [
      "ability.fire.flame_burst",
      "ability.def.aegis_barrier",
      "ability.tac.overdrive_surge",
      "ability.ult.inferno_nova"
    ],
    rewardGold: 260,
    rewardXp: 160,
    description: "Relentless brawler seeking Ring Outs and Burst Finishes early in the match."
  },
  {
    id: "opponent.volt.tactician",
    displayName: "Riku Kurosawa",
    title: "Finalist",
    topId: "top.volt.tempest",
    personality: "HeavyAssault",
    difficulty: "Hard",
    level: 8,
    isBoss: false,
    components: {
      SpiritCore: "core.volt",
      AttackBlade: "blade.titan",
      ArmorRing: "armor.reactive",
      WeightDisc: "weight.tungsten",
      PerformanceDriver: "driver.ball",
      EnergyModule: "energy.resonance"
    },
    abilities: [
      "ability.lightning.thunder_dash",
      "ability.def.gyro_anchor",
      "ability.tac.overdrive_surge",
      "ability.ult.tempest_cataclysm"
    ],
    rewardGold: 340,
    rewardXp: 210,
    description: "Pairs heavy tungsten momentum with high-speed Thunder Dash intercepts."
  },
  {
    id: "opponent.boss.sovereign",
    displayName: "Valkyrie Sovereign",
    title: "Grand Champion Boss",
    topId: "top.storm.sovereign",
    personality: "Tactical",
    difficulty: "Expert",
    level: 10,
    isBoss: true,
    components: {
      SpiritCore: "core.sovereign",
      AttackBlade: "blade.vortex",
      ArmorRing: "armor.reactive",
      WeightDisc: "weight.gyro",
      PerformanceDriver: "driver.ball",
      EnergyModule: "energy.overclock"
    },
    abilities: [
      "ability.lightning.thunder_dash",
      "ability.def.gyro_anchor",
      "ability.tac.vortex_pull",
      "ability.ult.tempest_cataclysm"
    ],
    rewardGold: 600,
    rewardXp: 400,
    description: "Reigning Neon Stadium Grand Champion. Dynamically adapts modes and chains Ultimates."
  },
  ...EXPANSION_OPPONENTS
];
var EVOLUTION_PATHS = [
  {
    id: "evo.offensive",
    displayName: "Apex Striker Evolution",
    focus: "Offensive",
    description: "Amplifies blade impact velocity, critical resonance, and attack pressure.",
    requiredLevel: 3,
    goldCost: 250,
    evolutionTokensCost: 2,
    essenceCost: 15,
    attributeBonuses: { attack: 14, speed: 10, critical: 14 },
    scaleMultiplier: 1.07,
    emissiveBoost: 1.45
  },
  {
    id: "evo.defensive",
    displayName: "Bastion Fortress Evolution",
    focus: "Defensive",
    description: "Reinforces chassis durability, impact damping, and gyroscopic balance.",
    requiredLevel: 3,
    goldCost: 250,
    evolutionTokensCost: 2,
    essenceCost: 15,
    attributeBonuses: { defense: 14, stability: 14, stamina: 10 },
    scaleMultiplier: 1.09,
    emissiveBoost: 1.35
  },
  {
    id: "evo.hybrid",
    displayName: "Resonant Hybrid Evolution",
    focus: "Hybrid",
    description: "Balances rotational endurance with rapid ability energy & control.",
    requiredLevel: 3,
    goldCost: 280,
    evolutionTokensCost: 2,
    essenceCost: 15,
    attributeBonuses: { stamina: 10, control: 12, energy: 14, attack: 6, defense: 6 },
    scaleMultiplier: 1.06,
    emissiveBoost: 1.5
  }
];
function getTopDefinition(id) {
  return TOP_DEFINITIONS.find((t) => t.id === id) ?? TOP_DEFINITIONS[0];
}
function getComponentDefinition(id) {
  return COMPONENTS.find((c) => c.id === id) ?? COMPONENTS[0];
}
function getAbilityDefinition(id) {
  return ABILITIES.find((a) => a.id === id) ?? ABILITIES[0];
}
function isShieldAbility(abilityOrId) {
  const def = typeof abilityOrId === "string" ? getAbilityDefinition(abilityOrId) : abilityOrId;
  return def.effectKind === "BarrierShield" || def.statusApplied === "Shield" || def.effectKind === "PurifyCleanse" && def.type === "Defensive";
}
function isFireAbility(abilityOrId) {
  const def = typeof abilityOrId === "string" ? getAbilityDefinition(abilityOrId) : abilityOrId;
  return def.element === "Fire" || def.statusApplied === "Burn";
}
function getEvolutionPath(id) {
  return EVOLUTION_PATHS.find((e) => e.id === id);
}
function getArenaDefinition(id) {
  return ARENAS[id] ?? ARENAS.standard;
}
var SECRETS_CATALOG = [
  {
    id: "secret.perfect_ripcord",
    title: "Golden Ripcord Resonance",
    hint: "Strike inside the golden peak (>= 92%) during Launch Calibration.",
    lore: "Precision harmonic launch synchronizes the Stadium Core bearing at peak RPM.",
    points: 300
  },
  {
    id: "secret.ring_out_gate",
    title: "Gatebreaker Trajectory",
    hint: "Win a match by ejecting a rival through a Neon Stadium Ring-Out Gate.",
    lore: "Using tangential blade deflection near the three exit gates turns defense into instant ejection.",
    points: 350
  },
  {
    id: "secret.elemental_apex",
    title: "Apex Elemental Awakening",
    hint: "Evolve any Spinning Top along an Apex Evolution path in Collection & Evolution.",
    lore: "True resonance crowns the Spirit Core with a stabilized high-output magnetic halo.",
    points: 400
  },
  {
    id: "secret.critical_comeback",
    title: "Edge of Collapse",
    hint: "Win an arena clash while your Spin Stamina or Armor drops below 35%.",
    lore: "Veterans convert near-zero gyroscopic stability into a final decisive counter-impulse.",
    points: 450
  },
  {
    id: "secret.stadium_cipher",
    title: "Neon Core Vault Cipher",
    hint: "Decode the hidden 3-node Stadium Harmonic lock inside the Score & Secrets Vault.",
    lore: "Beneath the parabolic dish lies the original Architect tuning matrix of Spin Legends.",
    points: 500
  }
];
var ENDINGS_CATALOG = [
  {
    id: "ending.good",
    type: "good",
    badgeLabel: "GOOD ENDING",
    title: "Guardian of the Neon Guild",
    subtitle: "Honor & Integrity Illuminated the Stadium",
    epilogue: "By rejecting black-market shortcuts, honoring your rivals in battle, and opening the Sovereign blueprints to the next generation, you transformed Neon Stadium into a beacon of fair mechanical mastery.",
    accentHex: "#34d399"
  },
  {
    id: "ending.bad",
    type: "bad",
    badgeLabel: "BAD ENDING",
    title: "Tyrant of the Shattered Ring",
    subtitle: "Unchecked Ambition Consumed the Arena",
    epilogue: "Empowered by illicit cores and ruthless exploits, no challenger could withstand your velocity\u2014yet the cheers faded. Under your iron monopoly, Neon Stadium became a feared shadow circuit ruled by fear.",
    accentHex: "#f43f5e"
  },
  {
    id: "ending.neutral",
    type: "neutral",
    badgeLabel: "NEUTRAL ENDING",
    title: "The Unbound Tactician",
    subtitle: "Balanced Prudence Beyond Faction Ties",
    epilogue: "Neither corrupted by syndicate gold nor bound to Guild bureaucracy, you proved your engineering skill on your own terms, sealed the Sovereign Core, and vanished into the horizon seeking greater arenas.",
    accentHex: "#38bdf8"
  },
  {
    id: "ending.legend",
    type: "legend",
    badgeLabel: "TRUE LEGEND ENDING",
    title: "Mythic Spin Sovereign",
    subtitle: "Honor + High Mastery + Hidden Vault Secrets",
    epilogue: "Achieving honorable decisions while uncovering the hidden mysteries of Neon Stadium and amassing legendary score mastery, your name and customized chassis became eternal legend.",
    accentHex: "#facc15"
  }
];
var SEEDED_LEADERBOARD_ENTRIES = [
  {
    id: "lb.sovereign",
    name: "Valkyrie Sovereign",
    title: "Grand Champion",
    score: 2850,
    wins: 18,
    secretsFound: 4,
    endingBadge: "Legend",
    isPlayer: false
  },
  {
    id: "lb.riku",
    name: "Riku Kurosawa",
    title: "Arc Tactician",
    score: 2140,
    wins: 12,
    secretsFound: 3,
    endingBadge: "Neutral",
    isPlayer: false
  },
  {
    id: "lb.dante",
    name: "Dante Blaze",
    title: "Inferno Raider",
    score: 1620,
    wins: 9,
    secretsFound: 2,
    endingBadge: "Bad",
    isPlayer: false
  },
  {
    id: "lb.sora",
    name: "Sora Vance",
    title: "Iron Guardian",
    score: 1180,
    wins: 6,
    secretsFound: 2,
    endingBadge: "Good",
    isPlayer: false
  },
  {
    id: "lb.kai",
    name: 'Kai "Spark"',
    title: "Circuit Rookie",
    score: 640,
    wins: 3,
    secretsFound: 1,
    endingBadge: "Challenger",
    isPlayer: false
  }
];
var WEATHERS = {
  Clear: {
    id: "Clear",
    label: "Clear Arena",
    shortLabel: "Clear",
    description: "Baseline stadium conditions with zero atmospheric drift or surface moisture.",
    accentHex: "#38bdf8",
    fogHex: 461588,
    fogDensityBoost: 0,
    particleHex: 3718648,
    gripFrictionMult: 1,
    rotDragMult: 1,
    stabilityRecoveryMult: 1,
    stabilityDrainPerSec: 0,
    gustAccel: 0,
    gustFreq: 0
  },
  LightRain: {
    id: "LightRain",
    label: "Light Rain",
    shortLabel: "Rain",
    description: "Slick dish moisture lowers surface grip (-14% friction) and lightly eases spin drag.",
    accentHex: "#60a5fa",
    fogHex: 726568,
    fogDensityBoost: 8e-3,
    particleHex: 8246268,
    gripFrictionMult: 0.86,
    rotDragMult: 0.96,
    stabilityRecoveryMult: 0.94,
    stabilityDrainPerSec: 0.25,
    gustAccel: 0,
    gustFreq: 0
  },
  DustStorm: {
    id: "DustStorm",
    label: "Dust Storm",
    shortLabel: "Dust",
    description: "Abrasive grit increases floor traction (+16% grip) while slightly taxing spin RPM.",
    accentHex: "#f59e0b",
    fogHex: 2036746,
    fogDensityBoost: 0.015,
    particleHex: 16498468,
    gripFrictionMult: 1.16,
    rotDragMult: 1.07,
    stabilityRecoveryMult: 0.9,
    stabilityDrainPerSec: 0.45,
    gustAccel: 0,
    gustFreq: 0
  },
  GaleWind: {
    id: "GaleWind",
    label: "Gale Crosswind",
    shortLabel: "Gale",
    description: "Sweeping arena crosswinds subtly shift trajectories and test gyroscopic balance.",
    accentHex: "#2dd4bf",
    fogHex: 465697,
    fogDensityBoost: 6e-3,
    particleHex: 6220500,
    gripFrictionMult: 0.95,
    rotDragMult: 1.02,
    stabilityRecoveryMult: 0.86,
    stabilityDrainPerSec: 0.35,
    gustAccel: 0.55,
    gustFreq: 1.45
  }
};
var WEATHER_LIST = [
  WEATHERS.Clear,
  WEATHERS.LightRain,
  WEATHERS.DustStorm,
  WEATHERS.GaleWind
];
function getWeatherDefinition(weather) {
  if (!weather) return WEATHERS.Clear;
  return WEATHERS[weather] ?? WEATHERS.Clear;
}
var VICTORY_EMOTES = [
  {
    id: "apex_flare",
    label: "Apex Flare",
    description: "Triumphant upward flare hop with golden stadium shockwave bursts.",
    accentHex: "#facc15"
  },
  {
    id: "cyclone_salute",
    label: "Cyclone Salute",
    description: "High-speed victory orbit dash around the impact spot with cyan sparks.",
    accentHex: "#38bdf8"
  },
  {
    id: "titan_hover",
    label: "Titan Hover",
    description: "Anti-gravity magnetic levitation with slow imposing gyroscopic tilt.",
    accentHex: "#a855f7"
  },
  {
    id: "eclipse_spin",
    label: "Eclipse Pulse",
    description: "Crisp figure-eight victory weave paired with crimson cadence waves.",
    accentHex: "#f43f5e"
  },
  {
    id: "solar_crown",
    label: "Solar Crown",
    description: "Elevated double-hop crown ascent emitting a radiant ember fountain.",
    accentHex: "#f97316"
  }
];

// src/domain/rules.ts
var CHARACTER_BASE_STAT = 5;
var CHARACTER_MAX_STAT = 12;
var CHARACTER_BONUS_POINTS = 12;
var CHARACTER_TOTAL_BUDGET = CHARACTER_BASE_STAT * 4 + CHARACTER_BONUS_POINTS;
var SAVE_SCHEMA_VERSION = 2;
var MAX_COMPONENT_UPGRADE_LEVEL = 5;
var MAX_CAPACITOR_LEVEL = 5;
var PERFECT_LAUNCH_MIN = 0.8;
var PERFECT_LAUNCH_MAX = 0.94;
var PERFECT_LAUNCH_RPM_BONUS = 1.08;
var DEFAULT_BATTLE_MUTATORS = {
  noAbilities: false,
  doubleGravity: false,
  turboSpin: false,
  ringOutOnly: false,
  doubleHazards: false
};
var RANK_TIERS = [
  {
    id: "Bronze",
    name: "Bronze Striker",
    minMmr: 0,
    colorHex: "#cd7f32",
    rewardGold: 150,
    rewardCrystals: 8,
    rewardFragments: 0
  },
  {
    id: "Silver",
    name: "Silver Vanguard",
    minMmr: 1050,
    colorHex: "#cbd5e1",
    rewardGold: 280,
    rewardCrystals: 14,
    rewardFragments: 1
  },
  {
    id: "Gold",
    name: "Gold Sovereign",
    minMmr: 1200,
    colorHex: "#facc15",
    rewardGold: 450,
    rewardCrystals: 22,
    rewardFragments: 2
  },
  {
    id: "Platinum",
    name: "Platinum Tactician",
    minMmr: 1400,
    colorHex: "#38bdf8",
    rewardGold: 700,
    rewardCrystals: 34,
    rewardFragments: 3
  },
  {
    id: "Diamond",
    name: "Diamond Apex",
    minMmr: 1650,
    colorHex: "#a855f7",
    rewardGold: 1050,
    rewardCrystals: 50,
    rewardFragments: 5
  },
  {
    id: "Legend",
    name: "Stadium Legend",
    minMmr: 1950,
    colorHex: "#f43f5e",
    rewardGold: 1600,
    rewardCrystals: 80,
    rewardFragments: 8
  }
];
function clampAttr(val) {
  return Math.max(1, Math.min(100, Math.round(val)));
}
function getElementalMultiplier(attacker, defender) {
  const def = ELEMENTS[attacker];
  if (def.strongAgainst.includes(defender)) return 1.15;
  if (def.weakAgainst.includes(defender)) return 0.9;
  return 1;
}
function getDualElementalMultiplier(attackerPrimary, attackerSecondary, defenderPrimary, defenderSecondary) {
  const pVsP = getElementalMultiplier(attackerPrimary, defenderPrimary);
  const pVsS = defenderSecondary ? getElementalMultiplier(attackerPrimary, defenderSecondary) : pVsP;
  const primaryAvg = (pVsP + pVsS) * 0.5;
  if (!attackerSecondary || attackerSecondary === attackerPrimary) {
    return primaryAvg;
  }
  const sVsP = getElementalMultiplier(attackerSecondary, defenderPrimary);
  const sVsS = defenderSecondary ? getElementalMultiplier(attackerSecondary, defenderSecondary) : sVsP;
  const secondaryAvg = (sVsP + sVsS) * 0.5;
  return Number((primaryAvg * 0.68 + secondaryAvg * 0.32).toFixed(3));
}
function validateTopConfiguration(equipped) {
  const errors = [];
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
function calculateAttributes(topDefId, equipped, upgradeLevels = {}, topLevel = 1, evolutionPathId = null, characterStats, secondaryElement) {
  const topDef = getTopDefinition(topDefId);
  const acc = { ...topDef.baseAttributes };
  const lvlBonus = Math.max(0, topLevel - 1) * 1.2;
  acc.attack += lvlBonus;
  acc.defense += lvlBonus;
  acc.stamina += lvlBonus;
  acc.stability += lvlBonus * 0.8;
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
    critical: clampAttr(acc.critical)
  };
}
function calculatePhysicalProfile(topDefId, equipped, upgradeLevels = {}, topLevel = 1, evolutionPathId = null, characterStats, secondaryElement, capacitorLevel = 0) {
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
  const totalMassKg = core.massKg + blade.massKg + armor.massKg + weight.massKg + driver.massKg + energyMod.massKg;
  const effectiveRadiusM = 0.34 + (blade.radiusContribution + weight.radiusContribution + armor.radiusContribution) * 2.4;
  const inertiaMultiplier = weight.id === "weight.outer" ? 1.18 : 1;
  const momentOfInertia = 0.5 * totalMassKg * effectiveRadiusM * effectiveRadiusM * inertiaMultiplier;
  const baseRotDrag = core.rotationalDrag + blade.rotationalDrag + armor.rotationalDrag + weight.rotationalDrag + driver.rotationalDrag + energyMod.rotationalDrag;
  const rotationalDrag = baseRotDrag * (1.18 - attrs.stamina / 100 * 0.32);
  const groundFriction = driver.groundFriction;
  const restitution = Math.min(
    0.92,
    0.48 + blade.restitution + armor.restitution + core.restitution
  );
  const maxDurability = core.durability + blade.durability + armor.durability + weight.durability + driver.durability + energyMod.durability + attrs.defense * 0.4;
  const initialAngularVelocity = 96 + attrs.stamina * 0.16 + attrs.speed * 0.1;
  const accelerationForce = 3.2 + attrs.speed / 100 * 3.4 + attrs.control / 100 * 1.1;
  const hasDual = Boolean(secondaryElement && secondaryElement !== topDef.element);
  const dualEnergyMult = hasDual ? 0.9 : 1;
  const capBonus = Math.max(0, capacitorLevel) * 6;
  const capRegenBonus = Math.max(0, capacitorLevel) * 0.55;
  const maxEnergy = (85 + attrs.energy * 0.45 + capBonus) * dualEnergyMult;
  const energyRegenPerSec = (5.5 + attrs.energy / 100 * 4.5 + capRegenBonus) * (hasDual ? 0.92 : 1);
  const resonanceRate = (energyMod.id === "energy.resonance" ? 1.28 : 1) * (hasDual ? 1.08 : 1);
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
    bladeShape: blade.visual.bladeShape ?? "sharp",
    driverType: driver.visual.driverType ?? "flat"
  };
}
function createDefaultCharacterProfile() {
  return {
    created: false,
    name: "Commander Zero",
    title: "Arena Challenger",
    appearance: {
      hairStyle: "spiky",
      hairColor: "#38bdf8",
      outfitColor: "#1d4ed8",
      accentColor: "#f97316"
    },
    stats: {
      strength: CHARACTER_BASE_STAT,
      agility: CHARACTER_BASE_STAT,
      focus: CHARACTER_BASE_STAT,
      luck: CHARACTER_BASE_STAT
    },
    createdAtMs: Date.now()
  };
}
function createDefaultKeyBindings() {
  return {
    ability1: "q",
    ability2: "e",
    ability3: "r",
    ability4: "f",
    launch: " ",
    teamSwitch: "tab",
    pause: "Escape",
    cameraCycle: "c",
    tactical1: "1",
    tactical2: "2",
    tactical3: "3",
    tactical4: "4",
    tactical5: "5",
    tactical6: "6",
    tactical7: "7",
    tactical8: "8"
  };
}
function createDefaultCosmetics(primaryColor, trimColor) {
  return {
    primaryColor,
    trimColor,
    trailColor: primaryColor,
    pattern: "solid",
    victoryEmote: "apex_flare"
  };
}
function createEmptyCareerStats() {
  return {
    matches: 0,
    wins: 0,
    losses: 0,
    totalClashes: 0,
    peakImpulse: 0,
    burstFinishes: 0,
    ringOutFinishes: 0,
    spinFinishes: 0,
    knockoutFinishes: 0
  };
}
function getCurrentDailyResetKey() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
}
function buildTournamentBracket(bracketSize) {
  const allArenaIds = Object.keys(ARENAS);
  const nonBoss = OPPONENTS.filter((o) => !o.isBoss);
  const bosses = OPPONENTS.filter((o) => o.isBoss);
  const opponentIds = [];
  const arenaIds = [];
  for (let i = 0; i < bracketSize; i++) {
    if (i === bracketSize - 1) {
      opponentIds.push(bosses[0]?.id ?? OPPONENTS[OPPONENTS.length - 1].id);
    } else {
      const idx = Math.floor(i / Math.max(1, bracketSize - 1) * nonBoss.length);
      opponentIds.push(nonBoss[Math.min(nonBoss.length - 1, idx)].id);
    }
    arenaIds.push(allArenaIds[i % allArenaIds.length]);
  }
  return { opponentIds, arenaIds };
}
function createDefaultSaveData() {
  const starterTop = TOP_DEFINITIONS[0];
  const secondaryTop = TOP_DEFINITIONS[1];
  const thirdTop = TOP_DEFINITIONS[2];
  const starterElem = ELEMENTS[starterTop.element];
  const secondaryElem = ELEMENTS[secondaryTop.element];
  const thirdElem = ELEMENTS[thirdTop.element];
  const starterOwned = {
    instanceId: "owned-top-ignis",
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
    careerStats: createEmptyCareerStats()
  };
  const secondaryOwned = {
    instanceId: "owned-top-aegis",
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
    careerStats: createEmptyCareerStats()
  };
  const thirdOwned = {
    instanceId: "owned-top-volt",
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
    careerStats: createEmptyCareerStats()
  };
  const starterUnlockedComponents = COMPONENTS.filter(
    (c) => c.unlockCostGold === 0 || c.rarity === "Uncommon"
  ).map((c) => c.id);
  const bracket = buildTournamentBracket(4);
  const initialMissions = {};
  for (const m of MISSIONS_CATALOG) {
    initialMissions[m.id] = { progress: 0, claimed: false };
  }
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    playerId: "local-commander",
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
      legendaryFragments: 0
    },
    ownedTops: [starterOwned, secondaryOwned, thirdOwned],
    unlockedTopIds: [starterTop.id, secondaryTop.id, thirdTop.id],
    unlockedComponentIds: starterUnlockedComponents,
    componentUpgradeLevels: {},
    selectedTopInstanceId: starterOwned.instanceId,
    teamTopInstanceIds: [starterOwned.instanceId, secondaryOwned.instanceId, thirdOwned.instanceId],
    selectedArenaId: "standard",
    presets: [
      {
        id: "preset-rush",
        name: "Crimson Striker",
        topInstanceId: starterOwned.instanceId,
        components: { ...starterTop.defaultComponents },
        abilities: [...starterTop.defaultAbilities],
        secondaryElement: null,
        cosmetics: createDefaultCosmetics(starterElem.primaryColor, starterElem.secondaryColor),
        preferredMode: "Attack",
        preferredCommand: "Aggressive"
      },
      {
        id: "preset-bastion",
        name: "Hydro Bastion",
        topInstanceId: secondaryOwned.instanceId,
        components: { ...secondaryTop.defaultComponents },
        abilities: [...secondaryTop.defaultAbilities],
        secondaryElement: null,
        cosmetics: createDefaultCosmetics(secondaryElem.primaryColor, secondaryElem.secondaryColor),
        preferredMode: "Defense",
        preferredCommand: "Defensive"
      }
    ],
    processedBattleIds: [],
    tournament: {
      active: false,
      bracketSize: 4,
      currentRound: 0,
      completedRounds: 0,
      bracketOpponentIds: bracket.opponentIds,
      arenaIds: bracket.arenaIds,
      championshipsWon: 0
    },
    survivalBestWave: 0,
    bossDefeatedIds: [],
    capacitorLevel: 0,
    visitedArenaIds: ["standard"],
    missionProgress: initialMissions,
    dailyMissionResetKey: getCurrentDailyResetKey(),
    settings: {
      graphicsQuality: "High",
      masterVolume: 0.7,
      muted: false,
      cameraSensitivity: 1,
      debugMode: false,
      cameraPreset: "Broadcast",
      uiScale: 1,
      dynamicMusic: true,
      gamepadEnabled: true,
      showDiagnostics: false,
      reducedMotion: false,
      keyBindings: createDefaultKeyBindings()
    },
    matchHistory: [],
    rivals: [],
    claimedSeasonRewardTiers: [],
    preferredMutators: { ...DEFAULT_BATTLE_MUTATORS },
    preferredWeather: "Clear",
    pvpMmr: 1e3
  };
}
function sanitizeBattleMutators(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BATTLE_MUTATORS };
  const obj = raw;
  return {
    noAbilities: Boolean(obj.noAbilities),
    doubleGravity: Boolean(obj.doubleGravity),
    turboSpin: Boolean(obj.turboSpin),
    ringOutOnly: Boolean(obj.ringOutOnly),
    doubleHazards: Boolean(obj.doubleHazards)
  };
}
function isPowerInPerfectWindow(powerRatio) {
  return Number.isFinite(powerRatio) && powerRatio >= PERFECT_LAUNCH_MIN && powerRatio <= PERFECT_LAUNCH_MAX;
}
function getRankTierForMmr(mmr) {
  const safeMmr = Number.isFinite(mmr) ? mmr : 1e3;
  let matched = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (safeMmr >= tier.minMmr) matched = tier;
  }
  return matched;
}
function applySeasonSoftReset(mmr) {
  const safeMmr = Number.isFinite(mmr) ? mmr : 1e3;
  return Math.max(850, Math.round(1e3 + (safeMmr - 1e3) * 0.5));
}
function getCounterElementFor(element) {
  const entry = Object.keys(ELEMENTS).find(
    (el) => ELEMENTS[el].strongAgainst.includes(element)
  );
  return entry ?? "Light";
}
function inferAiPersonalityFromBuild(components, topDefId) {
  const blade = getComponentDefinition(components.AttackBlade);
  const armor = getComponentDefinition(components.ArmorRing);
  const driver = getComponentDefinition(components.PerformanceDriver);
  const topDef = getTopDefinition(topDefId);
  const driverType = driver.visual.driverType;
  if (driverType === "flat" && blade.modifiers.attack && blade.modifiers.attack >= 4) {
    return "Aggressive";
  }
  if (armor.modifiers.defense && armor.modifiers.defense >= 4) {
    return "Defensive";
  }
  if (driverType === "rubber" || topDef.archetype === "Defender") {
    return "Adaptive";
  }
  if ((blade.modifiers.speed ?? 0) >= 4 || driverType === "ball") {
    return "Evasive";
  }
  if (blade.massKg >= 0.032) {
    return "HeavyAssault";
  }
  return "Tactical";
}
function buildSeededShadowOpponents() {
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
      evolutionPathId: opp.isBoss ? "evo.hybrid" : null,
      equippedComponents: { ...opp.components },
      equippedAbilities: [...opp.abilities],
      cosmetics: createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
      aiPersonality: opp.personality,
      aiDifficulty: opp.difficulty,
      source: "seed",
      appearance: seedLb?.appearance ?? createDefaultCharacterProfile().appearance
    };
  });
}

// src/server/store.ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// src/domain/saveValidation.ts
function clampFiniteInt(val, min, max, fallback = min) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function sanitizeAndMigrateSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw;
  const defaults = createDefaultSaveData();
  if (typeof data.schemaVersion !== "number" || !Number.isFinite(data.schemaVersion)) return null;
  if (!Array.isArray(data.ownedTops) || data.ownedTops.length === 0) return null;
  const validComponentIds = new Set(COMPONENTS.map((c) => c.id));
  const validTopIds = new Set(TOP_DEFINITIONS.map((t) => t.id));
  const validElementIds = new Set(Object.keys(ELEMENTS));
  const validArenaIds = new Set(Object.keys(ARENAS));
  const cleanedTops = data.ownedTops.filter((t) => t && validTopIds.has(t.definitionId)).slice(0, 64).map((t) => {
    const def = TOP_DEFINITIONS.find((d) => d.id === t.definitionId) ?? TOP_DEFINITIONS[0];
    const elem = ELEMENTS[def.element];
    const check = t.equippedComponents ? validateTopConfiguration(t.equippedComponents) : { valid: false };
    return {
      ...t,
      instanceId: typeof t.instanceId === "string" && t.instanceId.trim().length > 0 ? t.instanceId.trim().slice(0, 64) : `owned-${def.id}`,
      level: clampFiniteInt(t.level, 1, 50, 1),
      experience: clampFiniteInt(t.experience, 0, 5e5, 0),
      evolutionStage: t.evolutionStage === 1 ? 1 : 0,
      secondaryElement: t.secondaryElement && validElementIds.has(t.secondaryElement) ? t.secondaryElement : null,
      equippedComponents: check.valid ? t.equippedComponents : { ...def.defaultComponents },
      equippedAbilities: Array.isArray(t.equippedAbilities) && t.equippedAbilities.length === 4 ? t.equippedAbilities : [...def.defaultAbilities],
      cosmetics: t.cosmetics ? {
        ...createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
        ...t.cosmetics,
        victoryEmote: VICTORY_EMOTES.some((v) => v.id === t.cosmetics?.victoryEmote) ? t.cosmetics.victoryEmote : "apex_flare"
      } : createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
      wins: clampFiniteInt(t.wins, 0, 1e5, 0),
      losses: clampFiniteInt(t.losses, 0, 1e5, 0),
      careerStats: t.careerStats ? {
        ...createEmptyCareerStats(),
        ...t.careerStats,
        matches: clampFiniteInt(t.careerStats.matches, 0, 2e5, 0),
        wins: clampFiniteInt(t.careerStats.wins, 0, 1e5, 0),
        losses: clampFiniteInt(t.careerStats.losses, 0, 1e5, 0),
        totalClashes: clampFiniteInt(t.careerStats.totalClashes, 0, 1e7, 0),
        peakImpulse: Number.isFinite(Number(t.careerStats.peakImpulse)) ? Math.max(0, Math.min(500, Number(t.careerStats.peakImpulse))) : 0
      } : {
        ...createEmptyCareerStats(),
        matches: clampFiniteInt(t.wins, 0, 1e5, 0) + clampFiniteInt(t.losses, 0, 1e5, 0),
        wins: clampFiniteInt(t.wins, 0, 1e5, 0),
        losses: clampFiniteInt(t.losses, 0, 1e5, 0)
      }
    };
  });
  if (cleanedTops.length === 0) return null;
  const selectedExists = cleanedTops.some((t) => t.instanceId === data.selectedTopInstanceId);
  const validSecretIds = new Set(SECRETS_CATALOG.map((s) => s.id));
  const validEndingIds = new Set(ENDINGS_CATALOG.map((e) => e.id));
  const defaultChar = createDefaultCharacterProfile();
  const rawChar = data.character;
  const clampStat = (v) => clampFiniteInt(v, CHARACTER_BASE_STAT, CHARACTER_MAX_STAT, CHARACTER_BASE_STAT);
  const sanitizedChar = rawChar && typeof rawChar === "object" ? {
    created: Boolean(rawChar.created),
    name: typeof rawChar.name === "string" && rawChar.name.trim().length >= 2 ? rawChar.name.trim().slice(0, 24) : defaultChar.name,
    title: typeof rawChar.title === "string" && rawChar.title.trim().length > 0 ? rawChar.title.trim().slice(0, 28) : defaultChar.title,
    appearance: {
      hairStyle: rawChar.appearance?.hairStyle ?? defaultChar.appearance.hairStyle,
      hairColor: rawChar.appearance?.hairColor ?? defaultChar.appearance.hairColor,
      outfitColor: rawChar.appearance?.outfitColor ?? defaultChar.appearance.outfitColor,
      accentColor: rawChar.appearance?.accentColor ?? defaultChar.appearance.accentColor
    },
    stats: {
      strength: clampStat(rawChar.stats?.strength),
      agility: clampStat(rawChar.stats?.agility),
      focus: clampStat(rawChar.stats?.focus),
      luck: clampStat(rawChar.stats?.luck)
    },
    createdAtMs: Number(rawChar.createdAtMs) || defaultChar.createdAtMs
  } : defaultChar;
  const todayKey = getCurrentDailyResetKey();
  const rawMissions = data.missionProgress && typeof data.missionProgress === "object" ? data.missionProgress : defaults.missionProgress;
  const isNewDay = data.dailyMissionResetKey !== todayKey;
  const syncedMissions = {};
  for (const m of MISSIONS_CATALOG) {
    if (isNewDay && m.cadence === "daily") {
      syncedMissions[m.id] = { progress: 0, claimed: false };
    } else {
      const existing = rawMissions[m.id];
      syncedMissions[m.id] = existing ? { progress: clampFiniteInt(existing.progress, 0, 1e5, 0), claimed: Boolean(existing.claimed) } : { progress: 0, claimed: false };
    }
  }
  const rawTeam = Array.isArray(data.teamTopInstanceIds) ? data.teamTopInstanceIds.filter((id) => cleanedTops.some((t) => t.instanceId === id)) : [];
  const teamIds = [...rawTeam];
  for (const t of cleanedTops) {
    if (teamIds.length >= 3) break;
    if (!teamIds.includes(t.instanceId)) teamIds.push(t.instanceId);
  }
  const rawBracketSize = data.tournament?.bracketSize === 8 || data.tournament?.bracketSize === 16 ? data.tournament.bracketSize : 4;
  const fallbackBracket = buildTournamentBracket(rawBracketSize);
  const validOpponentIds = new Set(OPPONENTS.map((o) => o.id));
  const oppIds = Array.isArray(data.tournament?.bracketOpponentIds) && data.tournament.bracketOpponentIds.length >= 4 ? data.tournament.bracketOpponentIds.filter((id) => validOpponentIds.has(id)) : fallbackBracket.opponentIds;
  const rawUpgrades = data.componentUpgradeLevels && typeof data.componentUpgradeLevels === "object" ? data.componentUpgradeLevels : {};
  const clampedUpgrades = {};
  for (const [cid, lvl] of Object.entries(rawUpgrades)) {
    if (validComponentIds.has(cid)) {
      clampedUpgrades[cid] = clampFiniteInt(lvl, 0, MAX_COMPONENT_UPGRADE_LEVEL, 0);
    }
  }
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    playerId: typeof data.playerId === "string" && data.playerId.trim().length > 0 ? data.playerId.trim().slice(0, 64) : defaults.playerId,
    updatedAtMs: typeof data.updatedAtMs === "number" && Number.isFinite(data.updatedAtMs) ? data.updatedAtMs : Date.now(),
    playerLevel: clampFiniteInt(data.playerLevel, 1, 100, 1),
    playerExperience: clampFiniteInt(data.playerExperience, 0, 5e6, 0),
    playerScore: clampFiniteInt(data.playerScore, 0, 1e7, 0),
    scoreLog: Array.isArray(data.scoreLog) ? data.scoreLog.slice(0, 30) : [],
    discoveredSecrets: Array.isArray(data.discoveredSecrets) ? Array.from(new Set(data.discoveredSecrets.filter((id) => validSecretIds.has(id)))) : [],
    character: sanitizedChar,
    decisionHistory: data.decisionHistory && typeof data.decisionHistory === "object" ? { ...data.decisionHistory } : {},
    unlockedEndingIds: Array.isArray(data.unlockedEndingIds) ? Array.from(new Set(data.unlockedEndingIds.filter((id) => validEndingIds.has(id)))) : [],
    activeEndingId: typeof data.activeEndingId === "string" && validEndingIds.has(data.activeEndingId) ? data.activeEndingId : null,
    leaderboardEntries: Array.isArray(data.leaderboardEntries) ? data.leaderboardEntries.slice(0, 10) : [],
    currencies: {
      gold: clampFiniteInt(data.currencies?.gold, 0, 5e6, 0),
      metalShards: clampFiniteInt(data.currencies?.metalShards, 0, 1e6, 0),
      energyCrystals: clampFiniteInt(data.currencies?.energyCrystals, 0, 5e5, 0),
      elementalEssence: clampFiniteInt(data.currencies?.elementalEssence, 0, 5e5, 0),
      evolutionTokens: clampFiniteInt(data.currencies?.evolutionTokens, 0, 5e4, 0),
      legendaryFragments: clampFiniteInt(data.currencies?.legendaryFragments, 0, 5e4, 0)
    },
    ownedTops: cleanedTops,
    unlockedTopIds: Array.isArray(data.unlockedTopIds) ? Array.from(new Set(data.unlockedTopIds.filter((id) => validTopIds.has(id)))) : defaults.unlockedTopIds,
    unlockedComponentIds: Array.isArray(data.unlockedComponentIds) ? Array.from(
      /* @__PURE__ */ new Set([
        ...defaults.unlockedComponentIds,
        ...data.unlockedComponentIds.filter((id) => validComponentIds.has(id))
      ])
    ) : defaults.unlockedComponentIds,
    componentUpgradeLevels: clampedUpgrades,
    selectedTopInstanceId: selectedExists ? data.selectedTopInstanceId : cleanedTops[0].instanceId,
    teamTopInstanceIds: teamIds,
    selectedArenaId: typeof data.selectedArenaId === "string" && validArenaIds.has(data.selectedArenaId) ? data.selectedArenaId : "standard",
    presets: Array.isArray(data.presets) ? data.presets.slice(0, 16) : defaults.presets,
    processedBattleIds: Array.isArray(data.processedBattleIds) ? data.processedBattleIds.slice(-100) : [],
    tournament: {
      ...defaults.tournament,
      ...data.tournament ?? {},
      bracketSize: rawBracketSize,
      bracketOpponentIds: oppIds.length >= 4 ? oppIds : fallbackBracket.opponentIds,
      arenaIds: Array.isArray(data.tournament?.arenaIds) && data.tournament.arenaIds.length >= 4 ? data.tournament.arenaIds : fallbackBracket.arenaIds
    },
    survivalBestWave: clampFiniteInt(data.survivalBestWave, 0, 500, 0),
    bossDefeatedIds: Array.isArray(data.bossDefeatedIds) ? data.bossDefeatedIds.slice(0, 32) : [],
    capacitorLevel: clampFiniteInt(data.capacitorLevel, 0, MAX_CAPACITOR_LEVEL, 0),
    visitedArenaIds: Array.isArray(data.visitedArenaIds) ? Array.from(
      new Set(data.visitedArenaIds.filter((id) => validArenaIds.has(id)))
    ) : ["standard"],
    missionProgress: syncedMissions,
    dailyMissionResetKey: todayKey,
    settings: {
      ...defaults.settings,
      ...data.settings ?? {},
      uiScale: Math.max(0.85, Math.min(1.2, Number(data.settings?.uiScale) || 1)),
      reducedMotion: Boolean(data.settings?.reducedMotion),
      keyBindings: (() => {
        const defaultBinds = createDefaultKeyBindings();
        const rawBinds = data.settings?.keyBindings && typeof data.settings.keyBindings === "object" ? data.settings.keyBindings : {};
        const sanitized = { ...defaultBinds };
        for (const k of Object.keys(defaultBinds)) {
          const val = rawBinds[k];
          if (typeof val === "string" && val.length > 0 && val.length <= 16) {
            sanitized[k] = val;
          }
        }
        return sanitized;
      })()
    },
    matchHistory: Array.isArray(data.matchHistory) ? data.matchHistory.filter(
      (m) => Boolean(m) && typeof m.battleId === "string" && typeof m.opponentName === "string" && Boolean(m.analysis) && Boolean(m.highlights)
    ).slice(0, 10) : [],
    rivals: Array.isArray(data.rivals) ? data.rivals.filter(
      (r) => Boolean(r) && typeof r.playerId === "string" && typeof r.handle === "string" && validTopIds.has(r.topDefinitionId)
    ).slice(0, 12).map((r) => {
      const elem = validElementIds.has(r.element) ? r.element : "Fire";
      const check = r.equippedComponents ? validateTopConfiguration(r.equippedComponents) : { valid: false };
      const def = TOP_DEFINITIONS.find((d) => d.id === r.topDefinitionId) ?? TOP_DEFINITIONS[0];
      return {
        ...r,
        handle: r.handle.trim().slice(0, 24) || "Rival",
        element: elem,
        secondaryElement: r.secondaryElement && validElementIds.has(r.secondaryElement) ? r.secondaryElement : null,
        level: clampFiniteInt(r.level, 1, 50, 1),
        evolutionStage: r.evolutionStage === 1 ? 1 : 0,
        equippedComponents: check.valid ? r.equippedComponents : { ...def.defaultComponents },
        equippedAbilities: Array.isArray(r.equippedAbilities) && r.equippedAbilities.length === 4 ? r.equippedAbilities : [...def.defaultAbilities],
        mmr: clampFiniteInt(r.mmr, 100, 1e4, 1050),
        lossesToRival: clampFiniteInt(r.lossesToRival, 1, 9999, 1),
        winsAgainstRival: clampFiniteInt(r.winsAgainstRival, 0, 9999, 0),
        status: r.status === "avenged" ? "avenged" : "unavenged",
        recommendedCounterElement: getCounterElementFor(elem)
      };
    }) : [],
    claimedSeasonRewardTiers: Array.isArray(data.claimedSeasonRewardTiers) ? Array.from(
      new Set(
        data.claimedSeasonRewardTiers.filter((s) => typeof s === "string" && s.length > 0 && s.length <= 32).slice(0, 32)
      )
    ) : [],
    preferredMutators: sanitizeBattleMutators(data.preferredMutators),
    preferredWeather: typeof data.preferredWeather === "string" && data.preferredWeather in WEATHERS ? data.preferredWeather : "Clear",
    pvpMmr: clampFiniteInt(data.pvpMmr, 400, 1e4, 1e3)
  };
}

// src/server/store.ts
var DEFAULT_DB_PATH = path.resolve(process.cwd(), "data", "spin-legends.db");
var LEGACY_JSON_PATH = path.resolve(process.cwd(), "data", "spin-legends-store.json");
var SEED_RIVALS = [
  {
    playerId: "rival-valkyrie",
    handle: "valkyrie_prime",
    title: "Grand Champion",
    mmr: 1480,
    wins: 42,
    losses: 9,
    bestScore: 5420,
    seasonScore: 5420,
    secretsFound: 4,
    endingBadge: "LEGEND",
    appearance: {
      hairStyle: "sleek",
      hairColor: "#a855f7",
      outfitColor: "#0f172a",
      accentColor: "#38bdf8"
    },
    updatedAtMs: Date.now() - 36e5
  },
  {
    playerId: "rival-kael",
    handle: "kael_vanguard",
    title: "Solaris Duelist",
    mmr: 1340,
    wins: 31,
    losses: 12,
    bestScore: 4180,
    seasonScore: 3920,
    secretsFound: 3,
    endingBadge: "GOOD",
    appearance: {
      hairStyle: "spiky",
      hairColor: "#facc15",
      outfitColor: "#7c2d12",
      accentColor: "#f97316"
    },
    updatedAtMs: Date.now() - 72e5
  },
  {
    playerId: "rival-noctis",
    handle: "lady_noctis",
    title: "Umbra Sovereign",
    mmr: 1265,
    wins: 27,
    losses: 14,
    bestScore: 3690,
    seasonScore: 3690,
    secretsFound: 3,
    endingBadge: "BAD",
    appearance: {
      hairStyle: "visor",
      hairColor: "#e879f9",
      outfitColor: "#3b0764",
      accentColor: "#f43f5e"
    },
    updatedAtMs: Date.now() - 108e5
  }
];
var dbInstance = null;
var cachedSessionSecret = null;
function resolveDbPath() {
  return process.env.SPIN_LEGENDS_DB_PATH?.trim() || DEFAULT_DB_PATH;
}
function openSqliteDb() {
  if (dbInstance) return dbInstance;
  const dbPath = resolveDbPath();
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS server_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commanders (
      player_id TEXT PRIMARY KEY,
      handle TEXT NOT NULL,
      handle_lower TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      passcode_hash TEXT,
      guest_secret_hash TEXT,
      mmr INTEGER NOT NULL DEFAULT 1000,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      best_score INTEGER NOT NULL DEFAULT 0,
      season_score INTEGER NOT NULL DEFAULT 0,
      secrets_found INTEGER NOT NULL DEFAULT 0,
      ending_badge TEXT NOT NULL DEFAULT 'ACTIVE',
      appearance_json TEXT NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_commanders_mmr ON commanders (mmr DESC, season_score DESC);

    CREATE TABLE IF NOT EXISTS cloud_saves (
      commander_id TEXT PRIMARY KEY REFERENCES commanders(player_id) ON DELETE CASCADE,
      save_json TEXT NOT NULL,
      player_score INTEGER NOT NULL DEFAULT 0,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      room_code TEXT,
      mode TEXT NOT NULL,
      arena_id TEXT NOT NULL,
      p1_id TEXT NOT NULL,
      p2_id TEXT NOT NULL,
      winner_id TEXT NOT NULL,
      finish_reason TEXT NOT NULL,
      duration_sec REAL NOT NULL DEFAULT 0,
      mmr_delta INTEGER NOT NULL DEFAULT 0,
      highlight_json TEXT,
      created_at_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_matches_created ON matches (created_at_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_p1 ON matches (p1_id, created_at_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_p2 ON matches (p2_id, created_at_ms DESC);

    CREATE TABLE IF NOT EXISTS season_reward_claims (
      commander_id TEXT NOT NULL REFERENCES commanders(player_id) ON DELETE CASCADE,
      season_number INTEGER NOT NULL,
      tier_id TEXT NOT NULL,
      claimed_at_ms INTEGER NOT NULL,
      PRIMARY KEY (commander_id, season_number, tier_id)
    );
  `);
  dbInstance = db;
  bootstrapAndMigrateIfEmpty(db, dbPath);
  return db;
}
function insertCommanderRow(db, c) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO commanders (
      player_id, handle, handle_lower, title, passcode_hash, guest_secret_hash,
      mmr, wins, losses, best_score, season_score, secrets_found, ending_badge,
      appearance_json, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const baseHandleLower = (c.handle.trim() || c.playerId).toLowerCase();
  const handleExists = db.prepare("SELECT 1 FROM commanders WHERE handle_lower = ?").get(baseHandleLower);
  const safeHandleLower = handleExists ? `${baseHandleLower}_${c.playerId.slice(-6).toLowerCase()}` : baseHandleLower;
  stmt.run(
    c.playerId,
    c.handle,
    safeHandleLower,
    c.title,
    c.passcodeHash ?? null,
    c.guestSecretHash ?? null,
    c.mmr,
    c.wins,
    c.losses,
    c.bestScore,
    c.seasonScore,
    c.secretsFound,
    c.endingBadge,
    JSON.stringify(c.appearance),
    c.updatedAtMs
  );
}
function bootstrapAndMigrateIfEmpty(db, dbPath) {
  const countRow = db.prepare("SELECT COUNT(*) as cnt FROM commanders").get();
  if (countRow.cnt > 0) return;
  if (dbPath === DEFAULT_DB_PATH && fs.existsSync(LEGACY_JSON_PATH)) {
    try {
      const raw = fs.readFileSync(LEGACY_JSON_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.commanders) {
        db.exec("BEGIN IMMEDIATE");
        try {
          for (const c of Object.values(parsed.commanders)) {
            if (c && typeof c.playerId === "string") {
              insertCommanderRow(db, c);
            }
          }
          if (parsed.cloudSaves && typeof parsed.cloudSaves === "object") {
            const saveStmt = db.prepare(`
              INSERT OR REPLACE INTO cloud_saves (commander_id, save_json, player_score, updated_at_ms)
              VALUES (?, ?, ?, ?)
            `);
            for (const [pid, rawSave] of Object.entries(parsed.cloudSaves)) {
              const sanitized = sanitizeAndMigrateSave(rawSave);
              if (sanitized && db.prepare("SELECT 1 FROM commanders WHERE player_id = ?").get(pid)) {
                saveStmt.run(pid, JSON.stringify({ ...sanitized, playerId: pid }), sanitized.playerScore, sanitized.updatedAtMs);
              }
            }
          }
          if (Array.isArray(parsed.matches)) {
            const matchStmt = db.prepare(`
              INSERT OR IGNORE INTO matches (
                id, room_code, mode, arena_id, p1_id, p2_id, winner_id,
                finish_reason, duration_sec, mmr_delta, highlight_json, created_at_ms
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const m of parsed.matches) {
              if (m && typeof m.id === "string") {
                matchStmt.run(
                  m.id,
                  m.roomCode ?? null,
                  m.mode,
                  m.arenaId,
                  m.p1Id,
                  m.p2Id,
                  m.winnerId,
                  m.finishReason,
                  Number(m.durationSec) || 0,
                  Number(m.mmrDelta) || 0,
                  null,
                  Number(m.createdAtMs) || Date.now()
                );
              }
            }
          }
          db.exec("COMMIT");
          try {
            fs.renameSync(LEGACY_JSON_PATH, `${LEGACY_JSON_PATH}.migrated.bak`);
          } catch {
          }
          const postCount = db.prepare("SELECT COUNT(*) as cnt FROM commanders").get();
          if (postCount.cnt > 0) return;
        } catch {
          db.exec("ROLLBACK");
        }
      }
    } catch {
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const c of SEED_RIVALS) {
      insertCommanderRow(db, c);
    }
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
  }
}
function getSessionSecret() {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (cachedSessionSecret) return cachedSessionSecret;
  const db = openSqliteDb();
  const row = db.prepare("SELECT value FROM server_meta WHERE key = 'session_secret'").get();
  if (row?.value && row.value.length >= 32) {
    cachedSessionSecret = row.value;
    return row.value;
  }
  const generated = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT OR REPLACE INTO server_meta (key, value) VALUES ('session_secret', ?)").run(
    generated
  );
  cachedSessionSecret = generated;
  return generated;
}
function rowToCommander(row) {
  if (!row) return null;
  let appearance = {
    hairStyle: "spiky",
    hairColor: "#38bdf8",
    outfitColor: "#0f172a",
    accentColor: "#f59e0b"
  };
  try {
    const parsed = JSON.parse(String(row.appearance_json ?? "{}"));
    appearance = { ...appearance, ...parsed };
  } catch {
  }
  return {
    playerId: String(row.player_id),
    handle: String(row.handle),
    title: String(row.title),
    passcodeHash: row.passcode_hash ? String(row.passcode_hash) : void 0,
    guestSecretHash: row.guest_secret_hash ? String(row.guest_secret_hash) : void 0,
    mmr: Number(row.mmr),
    wins: Number(row.wins),
    losses: Number(row.losses),
    bestScore: Number(row.best_score),
    seasonScore: Number(row.season_score),
    secretsFound: Number(row.secrets_found),
    endingBadge: String(row.ending_badge),
    appearance,
    updatedAtMs: Number(row.updated_at_ms)
  };
}
function closeStore() {
  if (dbInstance) {
    try {
      dbInstance.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {
    }
    dbInstance.close();
    dbInstance = null;
  }
  cachedSessionSecret = null;
}
function hashPasscode(passcode) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(passcode, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPasscode(passcode, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(passcode, salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}
function issueSessionToken(playerId) {
  const payloadObj = {
    pid: playerId,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 3600 * 1e3
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}
function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto.createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
  const a = Buffer.from(sigB64, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!parsed.pid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed.pid;
  } catch {
    return null;
  }
}
function sanitizeCommanderPublic(c) {
  const { passcodeHash: _p, guestSecretHash: _g, ...pub } = c;
  return pub;
}
function getCommanderById(playerId) {
  const db = openSqliteDb();
  const row = db.prepare("SELECT * FROM commanders WHERE player_id = ?").get(playerId);
  return rowToCommander(row);
}
function findCommanderByHandle(handle) {
  const db = openSqliteDb();
  const target = handle.trim().toLowerCase();
  const row = db.prepare("SELECT * FROM commanders WHERE handle_lower = ?").get(target);
  return rowToCommander(row);
}
function registerOrUpdateGuestCommander(params) {
  const db = openSqliteDb();
  const cleanHandle = params.handle.trim().slice(0, 24) || "Commander";
  const cleanTitle = params.title.trim().slice(0, 28) || "Arena Challenger";
  const now = Date.now();
  const existing = params.playerId ? getCommanderById(params.playerId) : null;
  const ownsExistingGuest = existing && !existing.passcodeHash && (params.authenticatedPlayerId === existing.playerId || Boolean(
    params.guestSecret && existing.guestSecretHash && verifyPasscode(params.guestSecret, existing.guestSecretHash)
  ));
  if (existing && ownsExistingGuest) {
    const conflicting = db.prepare("SELECT player_id FROM commanders WHERE handle_lower = ? AND player_id != ?").get(cleanHandle.toLowerCase(), existing.playerId);
    const handleLower = conflicting ? `${cleanHandle.toLowerCase()}_${existing.playerId.slice(-6).toLowerCase()}` : cleanHandle.toLowerCase();
    db.prepare(`
      UPDATE commanders
      SET handle = ?, handle_lower = ?, title = ?, appearance_json = ?, updated_at_ms = ?
      WHERE player_id = ?
    `).run(cleanHandle, handleLower, cleanTitle, JSON.stringify(params.appearance), now, existing.playerId);
    const updated = getCommanderById(existing.playerId);
    return { commander: updated };
  }
  const pid = `cmd-${crypto.randomUUID().slice(0, 8)}`;
  const freshGuestSecret = crypto.randomBytes(24).toString("base64url");
  const guestSecretHash = hashPasscode(freshGuestSecret);
  const handleTaken = db.prepare("SELECT 1 FROM commanders WHERE handle_lower = ?").get(cleanHandle.toLowerCase());
  const safeHandleLower = handleTaken ? `${cleanHandle.toLowerCase()}_${pid.slice(-6).toLowerCase()}` : cleanHandle.toLowerCase();
  db.prepare(`
    INSERT INTO commanders (
      player_id, handle, handle_lower, title, passcode_hash, guest_secret_hash,
      mmr, wins, losses, best_score, season_score, secrets_found, ending_badge,
      appearance_json, updated_at_ms
    ) VALUES (?, ?, ?, ?, NULL, ?, 1000, 0, 0, 0, 0, 0, 'ACTIVE', ?, ?)
  `).run(
    pid,
    cleanHandle,
    safeHandleLower,
    cleanTitle,
    guestSecretHash,
    JSON.stringify(params.appearance),
    now
  );
  return {
    commander: getCommanderById(pid),
    guestSecret: freshGuestSecret
  };
}
function registerAccountCommander(params) {
  const db = openSqliteDb();
  const cleanHandle = params.handle.trim().slice(0, 24);
  if (cleanHandle.length < 3) {
    return { commander: null, error: "Handle must be at least 3 characters." };
  }
  if (params.passcode.length < 4) {
    return { commander: null, error: "Passcode must be at least 4 characters." };
  }
  if (findCommanderByHandle(cleanHandle)) {
    return { commander: null, error: "Commander handle already exists. Switch to Sign In." };
  }
  const pid = `cmd-${crypto.randomUUID().slice(0, 10)}`;
  const now = Date.now();
  db.prepare(`
    INSERT INTO commanders (
      player_id, handle, handle_lower, title, passcode_hash, guest_secret_hash,
      mmr, wins, losses, best_score, season_score, secrets_found, ending_badge,
      appearance_json, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, NULL, 1000, 0, 0, 0, 0, 0, 'ACTIVE', ?, ?)
  `).run(
    pid,
    cleanHandle,
    cleanHandle.toLowerCase(),
    params.title.trim().slice(0, 28) || "Arena Challenger",
    hashPasscode(params.passcode),
    JSON.stringify(params.appearance),
    now
  );
  return { commander: getCommanderById(pid) };
}
function authenticateAccountCommander(handle, passcode) {
  const found = findCommanderByHandle(handle);
  if (!found || !found.passcodeHash) {
    return { commander: null, error: "Commander handle or passcode invalid." };
  }
  if (!verifyPasscode(passcode, found.passcodeHash)) {
    return { commander: null, error: "Commander handle or passcode invalid." };
  }
  return { commander: found };
}
function getCloudSaveForCommander(playerId) {
  const db = openSqliteDb();
  const row = db.prepare("SELECT save_json FROM cloud_saves WHERE commander_id = ?").get(playerId);
  if (!row?.save_json) return null;
  try {
    return sanitizeAndMigrateSave(JSON.parse(row.save_json));
  } catch {
    return null;
  }
}
function saveCloudProfileForCommander(playerId, rawSave) {
  const db = openSqliteDb();
  const cmd = getCommanderById(playerId);
  if (!cmd) return { commander: null, error: "Commander not found." };
  const sanitized = sanitizeAndMigrateSave(rawSave);
  if (!sanitized) {
    return { commander: null, error: "Invalid cloud save schema." };
  }
  const prevSave = getCloudSaveForCommander(playerId);
  if (prevSave) {
    const scoreJump = sanitized.playerScore - prevSave.playerScore;
    const goldJump = sanitized.currencies.gold - prevSave.currencies.gold;
    const evoJump = sanitized.currencies.evolutionTokens - prevSave.currencies.evolutionTokens;
    const fragJump = sanitized.currencies.legendaryFragments - prevSave.currencies.legendaryFragments;
    if (scoreJump > 3e4 || goldJump > 25e3 || evoJump > 25 || fragJump > 50) {
      return {
        commander: null,
        error: "Cloud save rejected: progression delta exceeds security bounds."
      };
    }
  } else {
    if (sanitized.playerScore > 5e4 || sanitized.currencies.gold > 35e3 || sanitized.currencies.evolutionTokens > 40) {
      return {
        commander: null,
        error: "Cloud save rejected: initial progression exceeds security bounds."
      };
    }
  }
  const now = Date.now();
  const pinnedSave = {
    ...sanitized,
    playerId,
    updatedAtMs: now
  };
  const totalWins = pinnedSave.ownedTops.reduce((acc, t) => acc + (Number(t.wins) || 0), 0);
  const totalLosses = pinnedSave.ownedTops.reduce((acc, t) => acc + (Number(t.losses) || 0), 0);
  const nextHandle = pinnedSave.character?.name?.trim().slice(0, 24) || cmd.handle;
  const nextTitle = pinnedSave.character?.title?.trim().slice(0, 28) || cmd.title;
  const nextAppearance = pinnedSave.character?.appearance ?? cmd.appearance;
  const nextBestScore = Math.max(cmd.bestScore, pinnedSave.playerScore);
  const nextSeasonScore = Math.max(cmd.seasonScore, pinnedSave.playerScore);
  const nextWins = Math.max(cmd.wins, totalWins);
  const nextLosses = Math.max(cmd.losses, totalLosses);
  const nextSecrets = Math.max(cmd.secretsFound, pinnedSave.discoveredSecrets.length);
  const nextBadge = pinnedSave.activeEndingId ? pinnedSave.activeEndingId.replace("ending.", "").toUpperCase() : cmd.endingBadge;
  const conflict = db.prepare("SELECT player_id FROM commanders WHERE handle_lower = ? AND player_id != ?").get(nextHandle.toLowerCase(), playerId);
  const safeHandleLower = conflict ? `${nextHandle.toLowerCase()}_${playerId.slice(-6).toLowerCase()}` : nextHandle.toLowerCase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT OR REPLACE INTO cloud_saves (commander_id, save_json, player_score, updated_at_ms)
      VALUES (?, ?, ?, ?)
    `).run(playerId, JSON.stringify(pinnedSave), pinnedSave.playerScore, now);
    db.prepare(`
      UPDATE commanders
      SET handle = ?, handle_lower = ?, title = ?, appearance_json = ?,
          best_score = ?, season_score = ?, wins = ?, losses = ?,
          secrets_found = ?, ending_badge = ?, updated_at_ms = ?
      WHERE player_id = ?
    `).run(
      nextHandle,
      safeHandleLower,
      nextTitle,
      JSON.stringify(nextAppearance),
      nextBestScore,
      nextSeasonScore,
      nextWins,
      nextLosses,
      nextSecrets,
      nextBadge,
      now,
      playerId
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return {
      commander: null,
      error: err instanceof Error ? err.message : "Unable to save cloud profile."
    };
  }
  return { commander: getCommanderById(playerId) };
}
function getLeaderboardList(season) {
  const db = openSqliteDb();
  const orderCol = season === "current" ? "season_score" : "best_score";
  const rows = db.prepare(`SELECT * FROM commanders ORDER BY mmr DESC, ${orderCol} DESC LIMIT 30`).all();
  return rows.map((r) => rowToCommander(r)).filter((c) => c !== null).map(sanitizeCommanderPublic);
}
function recordOnlineMatchResult(params) {
  const db = openSqliteDb();
  const existing = db.prepare("SELECT mmr_delta FROM matches WHERE id = ?").get(params.matchId);
  if (existing && typeof existing.mmr_delta === "number") {
    return { mmrDelta: existing.mmr_delta };
  }
  const p1 = getCommanderById(params.p1Id);
  const p2 = getCommanderById(params.p2Id);
  let mmrDelta = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    if (p1 && p2) {
      const winner = params.winnerId === p1.playerId ? p1 : p2;
      const loser = params.winnerId === p1.playerId ? p2 : p1;
      if (params.mode === "OnlineRanked") {
        const expectedWin = 1 / (1 + Math.pow(10, (loser.mmr - winner.mmr) / 400));
        mmrDelta = Math.max(8, Math.round(32 * (1 - expectedWin)));
        winner.mmr += mmrDelta;
        loser.mmr = Math.max(400, loser.mmr - mmrDelta);
      }
      winner.wins += 1;
      loser.losses += 1;
      winner.seasonScore += params.mode === "OnlineRanked" ? 180 : 90;
      winner.bestScore = Math.max(winner.bestScore, winner.seasonScore);
      const now = Date.now();
      db.prepare(`
        UPDATE commanders
        SET mmr = ?, wins = ?, season_score = ?, best_score = ?, updated_at_ms = ?
        WHERE player_id = ?
      `).run(winner.mmr, winner.wins, winner.seasonScore, winner.bestScore, now, winner.playerId);
      db.prepare(`
        UPDATE commanders
        SET mmr = ?, losses = ?, updated_at_ms = ?
        WHERE player_id = ?
      `).run(loser.mmr, loser.losses, now, loser.playerId);
    }
    db.prepare(`
      INSERT INTO matches (
        id, room_code, mode, arena_id, p1_id, p2_id, winner_id,
        finish_reason, duration_sec, mmr_delta, highlight_json, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.matchId,
      params.roomCode ?? null,
      params.mode,
      params.arenaId,
      params.p1Id,
      params.p2Id,
      params.winnerId,
      params.finishReason,
      Number(params.durationSec) || 0,
      mmrDelta,
      params.highlightSummaryJson ?? null,
      Date.now()
    );
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
  }
  return { mmrDelta };
}
function getStoreMetrics() {
  const db = openSqliteDb();
  const cmdRow = db.prepare("SELECT COUNT(*) as cnt FROM commanders").get();
  const matchRow = db.prepare("SELECT COUNT(*) as cnt FROM matches").get();
  return {
    totalCommanders: cmdRow.cnt,
    totalMatches: matchRow.cnt
  };
}
var SEASON_DURATION_MS = 28 * 24 * 3600 * 1e3;
function readSeasonMeta(db) {
  const rows = db.prepare(
    "SELECT key, value FROM server_meta WHERE key IN ('season_number', 'season_name', 'season_started_at_ms', 'season_ends_at_ms')"
  ).all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const now = Date.now();
  const seasonNumber = Math.max(1, Number(map.get("season_number")) || 1);
  const seasonName = map.get("season_name") || `Season ${seasonNumber}: Genesis Vortex`;
  const startedAtMs = Number(map.get("season_started_at_ms")) || now;
  const endsAtMs = Number(map.get("season_ends_at_ms")) || startedAtMs + SEASON_DURATION_MS;
  if (!map.has("season_number") || !map.has("season_ends_at_ms")) {
    const upsert = db.prepare("INSERT OR REPLACE INTO server_meta (key, value) VALUES (?, ?)");
    upsert.run("season_number", String(seasonNumber));
    upsert.run("season_name", seasonName);
    upsert.run("season_started_at_ms", String(startedAtMs));
    upsert.run("season_ends_at_ms", String(endsAtMs));
  }
  return { seasonNumber, seasonName, startedAtMs, endsAtMs };
}
function rolloverCompetitiveSeason(nowMs = Date.now()) {
  const db = openSqliteDb();
  const prev = readSeasonMeta(db);
  const nextNumber = prev.seasonNumber + 1;
  const nextName = `Season ${nextNumber}: Ascendant Clash`;
  const nextEnd = nowMs + SEASON_DURATION_MS;
  db.exec("BEGIN IMMEDIATE");
  try {
    const upsert = db.prepare("INSERT OR REPLACE INTO server_meta (key, value) VALUES (?, ?)");
    upsert.run("season_number", String(nextNumber));
    upsert.run("season_name", nextName);
    upsert.run("season_started_at_ms", String(nowMs));
    upsert.run("season_ends_at_ms", String(nextEnd));
    const commanders = db.prepare("SELECT player_id, mmr FROM commanders").all();
    const updateCmd = db.prepare(
      "UPDATE commanders SET mmr = ?, season_score = 0, updated_at_ms = ? WHERE player_id = ?"
    );
    for (const c of commanders) {
      updateCmd.run(applySeasonSoftReset(Number(c.mmr)), nowMs, c.player_id);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return {
    seasonNumber: nextNumber,
    seasonName: nextName,
    startsAtMs: nowMs,
    endsAtMs: nextEnd,
    daysRemaining: Math.max(1, Math.ceil(SEASON_DURATION_MS / (24 * 3600 * 1e3)))
  };
}
function getCurrentSeasonInfo() {
  const db = openSqliteDb();
  const now = Date.now();
  let meta = readSeasonMeta(db);
  if (now >= meta.endsAtMs) {
    return rolloverCompetitiveSeason(now);
  }
  const daysRemaining = Math.max(0, Math.ceil((meta.endsAtMs - now) / (24 * 3600 * 1e3)));
  return {
    seasonNumber: meta.seasonNumber,
    seasonName: meta.seasonName,
    startsAtMs: meta.startedAtMs,
    endsAtMs: meta.endsAtMs,
    daysRemaining
  };
}
function getClaimedSeasonTiers(playerId, seasonNumber) {
  const db = openSqliteDb();
  const activeSeason = seasonNumber ?? getCurrentSeasonInfo().seasonNumber;
  const rows = db.prepare(
    "SELECT tier_id FROM season_reward_claims WHERE commander_id = ? AND season_number = ?"
  ).all(playerId, activeSeason);
  const validIds = new Set(RANK_TIERS.map((t) => t.id));
  return rows.map((r) => r.tier_id).filter((id) => validIds.has(id));
}
function claimSeasonTierReward(playerId, tierId) {
  const db = openSqliteDb();
  const season = getCurrentSeasonInfo();
  const tier = RANK_TIERS.find((t) => t.id === tierId);
  if (!tier) {
    return {
      ok: false,
      error: "Unknown rank tier.",
      seasonNumber: season.seasonNumber,
      claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber)
    };
  }
  const commander = getCommanderById(playerId);
  if (!commander) {
    return {
      ok: false,
      error: "Commander not found.",
      seasonNumber: season.seasonNumber,
      claimedTiers: []
    };
  }
  if (commander.mmr < tier.minMmr) {
    return {
      ok: false,
      error: `Requires at least ${tier.minMmr} MMR to claim ${tier.name} rewards.`,
      seasonNumber: season.seasonNumber,
      claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber)
    };
  }
  const existing = db.prepare(
    "SELECT 1 FROM season_reward_claims WHERE commander_id = ? AND season_number = ? AND tier_id = ?"
  ).get(playerId, season.seasonNumber, tierId);
  if (existing) {
    return {
      ok: false,
      error: "Tier reward already claimed for this season.",
      seasonNumber: season.seasonNumber,
      tier,
      claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber)
    };
  }
  db.prepare(
    "INSERT INTO season_reward_claims (commander_id, season_number, tier_id, claimed_at_ms) VALUES (?, ?, ?, ?)"
  ).run(playerId, season.seasonNumber, tierId, Date.now());
  return {
    ok: true,
    seasonNumber: season.seasonNumber,
    tier,
    claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber)
  };
}
var SEED_RIVAL_OPPONENT_MAP = {
  "rival-valkyrie": "opp.zephyr_01",
  "rival-kael": "opp.ignis_01",
  "rival-noctis": "opp.shadow_01"
};
function getShadowOpponents(excludePlayerId) {
  const db = openSqliteDb();
  const rows = db.prepare(
    `
      SELECT c.*, cs.save_json
      FROM commanders c
      LEFT JOIN cloud_saves cs ON cs.commander_id = c.player_id
      ORDER BY c.mmr DESC, c.season_score DESC
      LIMIT 24
    `
  ).all();
  const profiles = [];
  const usedIds = /* @__PURE__ */ new Set();
  for (const row of rows) {
    const cmd = rowToCommander(row);
    if (!cmd || cmd.playerId === excludePlayerId) continue;
    let parsedSave = null;
    if (typeof row.save_json === "string" && row.save_json.length > 0) {
      try {
        parsedSave = sanitizeAndMigrateSave(JSON.parse(row.save_json));
      } catch {
        parsedSave = null;
      }
    }
    if (parsedSave && parsedSave.ownedTops.length > 0) {
      const activeTop = parsedSave.ownedTops.find((t) => t.instanceId === parsedSave.selectedTopInstanceId) ?? parsedSave.ownedTops[0];
      const topDef2 = getTopDefinition(activeTop.definitionId);
      const aiPersonality = inferAiPersonalityFromBuild(
        activeTop.equippedComponents,
        topDef2.id
      );
      const aiDifficulty = cmd.mmr >= 1650 ? "Expert" : cmd.mmr >= 1320 ? "Hard" : cmd.mmr >= 1020 ? "Normal" : "Easy";
      profiles.push({
        id: `shadow-cmd-${cmd.playerId}`,
        playerId: cmd.playerId,
        handle: cmd.handle,
        title: cmd.title,
        element: topDef2.element,
        secondaryElement: activeTop.secondaryElement,
        mmr: cmd.mmr,
        wins: cmd.wins,
        losses: cmd.losses,
        rankTier: getRankTierForMmr(cmd.mmr).id,
        topDefinitionId: topDef2.id,
        topDisplayName: topDef2.displayName,
        level: activeTop.level,
        evolutionStage: activeTop.evolutionStage,
        evolutionPathId: activeTop.evolutionPathId,
        equippedComponents: { ...activeTop.equippedComponents },
        equippedAbilities: [...activeTop.equippedAbilities],
        cosmetics: activeTop.cosmetics,
        aiPersonality,
        aiDifficulty,
        source: "commander",
        appearance: cmd.appearance
      });
      usedIds.add(cmd.playerId);
      continue;
    }
    const mappedOppId = SEED_RIVAL_OPPONENT_MAP[cmd.playerId];
    const templateOpp = OPPONENTS.find((o) => o.id === mappedOppId) ?? OPPONENTS[profiles.length % OPPONENTS.length];
    const topDef = getTopDefinition(templateOpp.topId);
    const elem = ELEMENTS[topDef.element];
    profiles.push({
      id: `shadow-cmd-${cmd.playerId}`,
      playerId: cmd.playerId,
      handle: cmd.handle,
      title: cmd.title,
      element: topDef.element,
      secondaryElement: templateOpp.secondaryElement ?? null,
      mmr: cmd.mmr,
      wins: cmd.wins,
      losses: cmd.losses,
      rankTier: getRankTierForMmr(cmd.mmr).id,
      topDefinitionId: topDef.id,
      topDisplayName: topDef.displayName,
      level: Math.max(templateOpp.level, Math.min(20, Math.floor((cmd.mmr - 800) / 50) + 1)),
      evolutionStage: cmd.mmr >= 1400 ? 1 : 0,
      evolutionPathId: cmd.mmr >= 1400 ? "evo.hybrid" : null,
      equippedComponents: { ...templateOpp.components },
      equippedAbilities: [...templateOpp.abilities],
      cosmetics: createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
      aiPersonality: inferAiPersonalityFromBuild(templateOpp.components, topDef.id),
      aiDifficulty: cmd.mmr >= 1420 ? "Expert" : cmd.mmr >= 1200 ? "Hard" : "Normal",
      source: "seed",
      appearance: cmd.appearance
    });
    usedIds.add(cmd.playerId);
  }
  if (profiles.length < 6) {
    for (const seed of buildSeededShadowOpponents()) {
      if (profiles.length >= 8) break;
      if (!usedIds.has(seed.playerId)) {
        profiles.push(seed);
        usedIds.add(seed.playerId);
      }
    }
  }
  return profiles;
}

// src/server/pvpRooms.ts
import crypto2 from "node:crypto";

// src/simulation/physicsEngine.ts
var FIXED_DT = 0.02;
var ARENA_DISH_RADIUS = 4.25;
var ARENA_RING_OUT_RADIUS = 4.78;
var ARENA_DISH_CURVATURE = 0.045;
var BOWL_SLOPE_ACCEL = 3.85;
var CENTER_FUNNEL_ACCEL = 1.45;
var SPIRAL_BASE_DRAG = 0.14;
var LAUNCH_SPEED_BASE = 2.55;
var LAUNCH_SPEED_RANGE = 0.85;
var LAUNCH_MIN_OFFSET = 0;
var LAUNCH_MAX_OFFSET = Math.PI / 2;
var PLAYER_LAUNCH_SPAWN = { x: -2.45, z: 2.15 };
var OPPONENT_LAUNCH_SPAWN = { x: 2.45, z: -2.15 };
var MAX_BATTLE_DURATION = 90;
var MIN_SPIN_OMEGA = 11;
var LAUNCH_WINDOW_SECONDS = 5;
function arenaFloorHeight(x, z) {
  const rSq = x * x + z * z;
  const clampedRSq = Math.min(rSq, ARENA_RING_OUT_RADIUS * ARENA_RING_OUT_RADIUS);
  return ARENA_DISH_CURVATURE * clampedRSq;
}
function computeBowlRadialAccel(x, z) {
  const r = Math.hypot(x, z);
  if (r < 1e-4) return { ax: 0, az: 0 };
  const bankPull = BOWL_SLOPE_ACCEL * (r / (1.45 + r));
  const pocketPull = CENTER_FUNNEL_ACCEL * (r / (0.85 + r * r));
  const invR = (bankPull + pocketPull) / r;
  return {
    ax: -x * invR,
    az: -z * invR
  };
}
function evaluateDynamicPillarState(pillar, elapsedTime) {
  const m = pillar.motion;
  if (!m) {
    return { x: pillar.x, z: pillar.z, vx: 0, vz: 0 };
  }
  if (m.kind === "orbit") {
    const r = m.orbitRadius ?? (Math.hypot(pillar.x, pillar.z) || 1.8);
    const baseAngle = m.phaseOffset ?? Math.atan2(pillar.z, pillar.x);
    const angle = baseAngle + elapsedTime * m.speedRadPerSec;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    return {
      x,
      z,
      vx: -Math.sin(angle) * r * m.speedRadPerSec,
      vz: Math.cos(angle) * r * m.speedRadPerSec
    };
  }
  const phase = (m.phaseOffset ?? 0) + elapsedTime * m.speedRadPerSec;
  const ampX = m.ampX ?? 0;
  const ampZ = m.ampZ ?? 0;
  return {
    x: pillar.x + Math.sin(phase) * ampX,
    z: pillar.z + Math.cos(phase) * ampZ,
    vx: Math.cos(phase) * ampX * m.speedRadPerSec,
    vz: -Math.sin(phase) * ampZ * m.speedRadPerSec
  };
}
function evaluateDynamicHazardPosition(hz, elapsedTime) {
  const m = hz.motion;
  if (!m) {
    return { x: hz.x, z: hz.z };
  }
  if (m.kind === "orbit") {
    const r = m.orbitRadius ?? (Math.hypot(hz.x, hz.z) || 2);
    const baseAngle = m.phaseOffset ?? Math.atan2(hz.z, hz.x);
    const angle = baseAngle + elapsedTime * m.speedRadPerSec;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r
    };
  }
  const phase = (m.phaseOffset ?? 0) + elapsedTime * m.speedRadPerSec;
  return {
    x: hz.x + Math.sin(phase) * (m.ampX ?? 0),
    z: hz.z + Math.cos(phase) * (m.ampZ ?? 0)
  };
}
function isAtRingOutGate(x, z) {
  const angle = Math.atan2(z, x);
  const gates = [Math.PI / 3, Math.PI, -Math.PI / 3];
  for (const g of gates) {
    let diff = Math.abs(angle - g);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 0.24) return true;
  }
  return false;
}
function createEmptyDamageBreakdown() {
  return { clash: 0, hazard: 0, pillar: 0, ability: 0, status: 0 };
}
function recordAnalysisDamage(sim, victimSide, source, amount, isCritical = false) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (victimSide === "player") {
    sim.analysis.damageTakenByPlayer[source] += amount;
  } else {
    sim.analysis.damageDealtByPlayer[source] += amount;
  }
  const prev = sim.analysis.highestDamageMoment;
  if (!prev || amount > prev.amount) {
    sim.analysis.highestDamageMoment = {
      timeSec: Number(sim.elapsedTime.toFixed(2)),
      amount: Number(amount.toFixed(1)),
      source,
      actorSide: victimSide === "player" ? "opponent" : "player",
      victimSide,
      isCritical
    };
  }
}
function checkCriticalThresholdBreaches(sim) {
  const breaches = sim.analysis.criticalThresholdBreaches ?? (sim.analysis.criticalThresholdBreaches = []);
  const timeSec = Number(sim.elapsedTime.toFixed(2));
  const pDurRatio = sim.player.durability / Math.max(1, sim.player.maxDurability);
  const oDurRatio = sim.opponent.durability / Math.max(1, sim.opponent.maxDurability);
  if (!sim.thresholdBreachedFlags.playerStamina && sim.player.staminaRatio < 0.2) {
    sim.thresholdBreachedFlags.playerStamina = true;
    breaches.push({
      side: "player",
      metric: "stamina",
      timeSec,
      remainingPct: Math.max(0, Math.round(sim.player.staminaRatio * 100))
    });
  }
  if (!sim.thresholdBreachedFlags.playerDurability && pDurRatio < 0.2) {
    sim.thresholdBreachedFlags.playerDurability = true;
    breaches.push({
      side: "player",
      metric: "durability",
      timeSec,
      remainingPct: Math.max(0, Math.round(pDurRatio * 100))
    });
  }
  if (!sim.thresholdBreachedFlags.opponentStamina && sim.opponent.staminaRatio < 0.2) {
    sim.thresholdBreachedFlags.opponentStamina = true;
    breaches.push({
      side: "opponent",
      metric: "stamina",
      timeSec,
      remainingPct: Math.max(0, Math.round(sim.opponent.staminaRatio * 100))
    });
  }
  if (!sim.thresholdBreachedFlags.opponentDurability && oDurRatio < 0.2) {
    sim.thresholdBreachedFlags.opponentDurability = true;
    breaches.push({
      side: "opponent",
      metric: "durability",
      timeSec,
      remainingPct: Math.max(0, Math.round(oDurRatio * 100))
    });
  }
}
function recordAnalysisTimelinePoint(sim) {
  const pArmor = Math.round(sim.player.durability / Math.max(1, sim.player.maxDurability) * 100);
  const oArmor = Math.round(
    sim.opponent.durability / Math.max(1, sim.opponent.maxDurability) * 100
  );
  const pStam = Math.round(sim.player.staminaRatio * 100);
  const oStam = Math.round(sim.opponent.staminaRatio * 100);
  const leadDelta = pStam * 0.55 + pArmor * 0.45 - (oStam * 0.55 + oArmor * 0.45);
  if (sim.analysis.timeline.length > 0) {
    const swing = Math.abs(leadDelta - sim.prevLeadDeltaPct);
    const prevPeak = sim.analysis.peakMomentumSwing;
    if (!prevPeak || swing > prevPeak.swingDeltaPct) {
      sim.analysis.peakMomentumSwing = {
        timeSec: Number(sim.elapsedTime.toFixed(1)),
        leaderAfter: leadDelta >= 0 ? "player" : "opponent",
        swingDeltaPct: Number(swing.toFixed(1))
      };
    }
  }
  sim.prevLeadDeltaPct = leadDelta;
  sim.analysis.timeline.push({
    timeSec: Number(sim.elapsedTime.toFixed(1)),
    playerStaminaPct: pStam,
    opponentStaminaPct: oStam,
    playerArmorPct: pArmor,
    opponentArmorPct: oArmor
  });
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function normalizeAngle(rad) {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function clampLaunchAngleToSide(spawnX, spawnZ, targetX, targetZ, handedness) {
  const inwardAngle = Math.atan2(-spawnZ, -spawnX);
  const dx = targetX - spawnX;
  const dz = targetZ - spawnZ;
  const rawDist = Math.hypot(dx, dz);
  const dist = clamp(rawDist > 0.15 ? rawDist : 2.8, 1.5, 3.6);
  const rawAngle = rawDist > 0.15 ? Math.atan2(dz, dx) : inwardAngle + (handedness === "right" ? 0.85 : -0.85);
  const rawDelta = normalizeAngle(rawAngle - inwardAngle);
  let clampedDelta;
  if (handedness === "right") {
    clampedDelta = rawDelta < -Math.PI * 0.65 ? LAUNCH_MAX_OFFSET : clamp(rawDelta, LAUNCH_MIN_OFFSET, LAUNCH_MAX_OFFSET);
  } else {
    clampedDelta = rawDelta > Math.PI * 0.65 ? -LAUNCH_MAX_OFFSET : clamp(rawDelta, -LAUNCH_MAX_OFFSET, -LAUNCH_MIN_OFFSET);
  }
  const angleRad = inwardAngle + clampedDelta;
  let tx = spawnX + Math.cos(angleRad) * dist;
  let tz = spawnZ + Math.sin(angleRad) * dist;
  const r = Math.hypot(tx, tz);
  const maxTargetR = ARENA_DISH_RADIUS * 0.82;
  if (r > maxTargetR) {
    tx *= maxTargetR / r;
    tz *= maxTargetR / r;
  }
  return { angleRad, targetX: tx, targetZ: tz };
}
function createInitialPartDurability() {
  return {
    SpiritCore: 100,
    AttackBlade: 100,
    ArmorRing: 100,
    WeightDisc: 100,
    PerformanceDriver: 100,
    EnergyModule: 100
  };
}
function createEntity(cfg, spawnX, spawnZ, options) {
  const stamRatio = clamp(options?.initialStaminaRatio ?? 1, 0.25, 1);
  const durRatio = clamp(options?.initialDurabilityRatio ?? 1, 0.25, 1);
  const baseOmega = cfg.physical.initialAngularVelocity;
  const initEnergy = 0.5 * cfg.physical.momentOfInertia * baseOmega * baseOmega;
  const startOmega = baseOmega * Math.sqrt(stamRatio);
  return {
    entityId: cfg.entityId,
    name: cfg.name,
    element: cfg.element,
    secondaryElement: cfg.secondaryElement ?? null,
    attributes: cfg.attributes,
    physical: cfg.physical,
    evolutionStage: cfg.evolutionStage,
    x: spawnX,
    y: arenaFloorHeight(spawnX, spawnZ),
    z: spawnZ,
    vx: 0,
    vy: 0,
    vz: 0,
    omega: startOmega,
    spinAngle: 0,
    initialRotationalEnergy: initEnergy,
    rotationalEnergy: initEnergy * stamRatio,
    staminaRatio: stamRatio,
    stability: 100,
    wobbleTilt: 0,
    wobblePhase: cfg.entityId === "player" ? 0 : Math.PI,
    lowSpinTimer: 0,
    durability: cfg.physical.maxDurability * durRatio,
    maxDurability: cfg.physical.maxDurability,
    partDurability: createInitialPartDurability(),
    brokenParts: [],
    energy: cfg.physical.maxEnergy * 0.45,
    maxEnergy: cfg.physical.maxEnergy,
    resonance: 0,
    battleMode: cfg.initialMode,
    modeCooldown: 0,
    tacticalCommand: cfg.initialCommand,
    commandTimer: 0,
    commandCooldown: 0,
    debugSteeringEnabled: Boolean(options?.debugSteeringEnabled),
    abilitySlots: cfg.abilities.map((id) => ({
      abilityId: id,
      cooldownRemaining: 0,
      activeRemaining: 0
    })),
    statuses: [],
    statDebuffs: [],
    trapDebuffCooldown: 0,
    hitFlashTimer: 0,
    ringedOut: false,
    burstOut: false,
    knockedOut: false
  };
}
function createBattleSimulation(params) {
  const handedness = params.launchHandedness ?? "right";
  const pSpawn = params.playerSpawn ?? PLAYER_LAUNCH_SPAWN;
  const oSpawn = params.opponentSpawn ?? OPPONENT_LAUNCH_SPAWN;
  const player = createEntity(params.playerConfig, pSpawn.x, pSpawn.z, {
    initialStaminaRatio: params.initialPlayerStaminaRatio,
    initialDurabilityRatio: params.initialPlayerDurabilityRatio,
    debugSteeringEnabled: Boolean(params.debugMode)
  });
  const opponent = createEntity(params.opponentConfig, oSpawn.x, oSpawn.z, {
    // Both tops obey authentic Pure Physics bowl & spiral mechanics unless Debug mode overrides!
    debugSteeringEnabled: Boolean(params.debugMode)
  });
  const teamConfigs = params.playerTeamConfigs && params.playerTeamConfigs.length > 1 ? params.playerTeamConfigs : [params.playerConfig];
  const teamSnapshots = teamConfigs.map((cfg) => {
    const baseOmega = cfg.physical.initialAngularVelocity;
    return {
      config: cfg,
      staminaRatio: 1,
      omega: baseOmega,
      durability: cfg.physical.maxDurability,
      maxDurability: cfg.physical.maxDurability,
      stability: 100,
      energy: cfg.physical.maxEnergy * 0.45,
      resonance: 0,
      partDurability: createInitialPartDurability(),
      knockedOut: false
    };
  });
  const inwardP = Math.atan2(-pSpawn.z, -pSpawn.x);
  const defaultOffset = handedness === "right" ? 0.85 : -0.85;
  const defaultAngle = inwardP + defaultOffset;
  const defaultTargetX = pSpawn.x + Math.cos(defaultAngle) * 2.8;
  const defaultTargetZ = pSpawn.z + Math.sin(defaultAngle) * 2.8;
  const sim = {
    battleId: params.battleId,
    arenaId: params.arenaId ?? "standard",
    phase: params.startInPhase ?? "Launch",
    elapsedTime: 0,
    launchCountdown: LAUNCH_WINDOW_SECONDS,
    launchSelection: {
      angleRad: defaultAngle,
      powerRatio: 0.74,
      targetX: defaultTargetX,
      targetZ: defaultTargetZ,
      aimSetByPlayer: false,
      powerLockedByPlayer: false
    },
    launchQuality: 1,
    perfectLaunch: false,
    opponentPerfectLaunch: false,
    weather: params.weather ?? "Clear",
    mutators: sanitizeBattleMutators(params.mutators ?? DEFAULT_BATTLE_MUTATORS),
    analysis: {
      damageTakenByPlayer: createEmptyDamageBreakdown(),
      damageDealtByPlayer: createEmptyDamageBreakdown(),
      firstBrokenSide: null,
      firstBrokenPart: null,
      firstBrokenTimeSec: null,
      peakPlayerRpm: Math.round(player.omega * 9.55),
      peakOpponentRpm: Math.round(opponent.omega * 9.55),
      durationSec: 0,
      timeline: [],
      highestDamageMoment: null,
      longestClashStreak: null,
      criticalThresholdBreaches: [],
      peakMomentumSwing: null
    },
    analysisTimelineAccum: 0,
    activeClashStreak: null,
    thresholdBreachedFlags: {
      playerStamina: false,
      playerDurability: false,
      opponentStamina: false,
      opponentDurability: false
    },
    prevLeadDeltaPct: 0,
    slowMotionTimer: 0,
    hitstopTimer: 0,
    cameraTrauma: 0,
    collisionCount: 0,
    maxImpactImpulse: 0,
    abilitiesUsedByPlayer: 0,
    finishTimer: 0,
    winnerSide: null,
    finishReason: null,
    player,
    opponent,
    aiPersonality: params.aiPersonality,
    aiDifficulty: params.aiDifficulty,
    aiDecisionTimer: 0.4,
    adaptiveMemory: {
      playerAbilitiesObserved: 0,
      highSpeedClashes: 0,
      playerOffensiveBias: 0,
      lastAdaptedAt: 0
    },
    bossPhases: params.bossPhases ?? [],
    triggeredBossPhaseIndices: [],
    isTeamBattle: teamSnapshots.length > 1,
    playerTeam: teamSnapshots,
    activeTeamIndex: 0,
    teamSwitchCooldown: 0,
    isOnlineRemote: Boolean(params.isOnlineRemote),
    isSpectating: Boolean(params.isSpectating),
    spectatorCount: params.spectatorCount ?? 0,
    disableAi: Boolean(params.disableAi),
    launchHandedness: handedness,
    highlightFrames: [],
    highlightSampleAccum: 0,
    pendingHighlightMarker: null,
    events: []
  };
  if (sim.phase === "Combat") {
    applyLaunchVelocities(sim, 0.85, sim.launchSelection.angleRad, void 0, {
      allowPerfect: false
    });
  }
  return sim;
}
function applyLaunchVelocities(sim, powerRatio, angleRad, opponentLaunch, options) {
  const clampedPower = clamp(powerRatio, 0.15, 1);
  const rawAngle = angleRad ?? sim.launchSelection.angleRad;
  const enforced = clampLaunchAngleToSide(
    sim.player.x,
    sim.player.z,
    sim.player.x + Math.cos(rawAngle) * 2.8,
    sim.player.z + Math.sin(rawAngle) * 2.8,
    sim.launchHandedness
  );
  const chosenAngle = enforced.angleRad;
  sim.launchSelection.powerRatio = clampedPower;
  sim.launchSelection.angleRad = chosenAngle;
  sim.launchSelection.targetX = enforced.targetX;
  sim.launchSelection.targetZ = enforced.targetZ;
  sim.launchSelection.powerLockedByPlayer = true;
  const isPerfectPlayer = options?.allowPerfect !== false && isPowerInPerfectWindow(clampedPower);
  sim.perfectLaunch = isPerfectPlayer;
  const perfectRpmMultP = isPerfectPlayer ? PERFECT_LAUNCH_RPM_BONUS : 1;
  const perfectSpeedMultP = isPerfectPlayer ? 1.05 : 1;
  const turboRpmMult = sim.mutators.turboSpin ? 2 : 1;
  const turboSpeedMult = sim.mutators.turboSpin ? 1.3 : 1;
  const q = 0.85 + clampedPower * 0.33;
  sim.launchQuality = q;
  const pCarryRatio = sim.player.staminaRatio;
  const windBonusP = sim.player.element === "Wind" ? 1.08 : 1;
  const targetPlayerBaseOmega = sim.player.physical.initialAngularVelocity * q * perfectRpmMultP * turboRpmMult;
  sim.player.omega = targetPlayerBaseOmega * Math.sqrt(pCarryRatio);
  sim.player.initialRotationalEnergy = 0.5 * sim.player.physical.momentOfInertia * targetPlayerBaseOmega * targetPlayerBaseOmega;
  sim.player.rotationalEnergy = 0.5 * sim.player.physical.momentOfInertia * sim.player.omega * sim.player.omega;
  sim.player.staminaRatio = pCarryRatio;
  const launchSpeedP = (LAUNCH_SPEED_BASE + clampedPower * LAUNCH_SPEED_RANGE) * windBonusP * perfectSpeedMultP * turboSpeedMult;
  sim.player.vx = Math.cos(chosenAngle) * launchSpeedP;
  sim.player.vz = Math.sin(chosenAngle) * launchSpeedP;
  if (isPerfectPlayer) {
    sim.events.push({
      type: "perfectLaunch",
      x: sim.player.x,
      y: sim.player.y + 0.28,
      z: sim.player.z,
      intensity: 1.35,
      isCritical: true,
      actorId: "player",
      label: "PERFECT LAUNCH! +8% RPM",
      colorHex: "#facc15"
    });
  }
  const windBonusO = sim.opponent.element === "Wind" ? 1.08 : 1;
  if (opponentLaunch) {
    const oPower = clamp(opponentLaunch.powerRatio, 0.15, 1);
    const oppHandedness = sim.launchHandedness === "right" ? "left" : "right";
    const oppEnforced = clampLaunchAngleToSide(
      sim.opponent.x,
      sim.opponent.z,
      sim.opponent.x + Math.cos(opponentLaunch.angleRad) * 2.8,
      sim.opponent.z + Math.sin(opponentLaunch.angleRad) * 2.8,
      oppHandedness
    );
    const oQ = 0.85 + oPower * 0.33;
    const oppPerfect = Boolean(options?.opponentPerfect);
    sim.opponentPerfectLaunch = oppPerfect;
    const oppRpmMult = (oppPerfect ? PERFECT_LAUNCH_RPM_BONUS : 1) * turboRpmMult;
    const oppSpdMult = (oppPerfect ? 1.05 : 1) * turboSpeedMult;
    sim.opponent.omega = sim.opponent.physical.initialAngularVelocity * oQ * oppRpmMult;
    sim.opponent.initialRotationalEnergy = 0.5 * sim.opponent.physical.momentOfInertia * sim.opponent.omega * sim.opponent.omega;
    sim.opponent.rotationalEnergy = sim.opponent.initialRotationalEnergy;
    sim.opponent.staminaRatio = 1;
    const launchSpeedO = (LAUNCH_SPEED_BASE + oPower * LAUNCH_SPEED_RANGE) * windBonusO * oppSpdMult;
    sim.opponent.vx = Math.cos(oppEnforced.angleRad) * launchSpeedO;
    sim.opponent.vz = Math.sin(oppEnforced.angleRad) * launchSpeedO;
  } else {
    const aiLaunchQ = sim.aiDifficulty === "Easy" ? 0.92 : sim.aiDifficulty === "Normal" ? 1 : sim.aiDifficulty === "Hard" ? 1.08 : 1.14;
    sim.opponent.omega = sim.opponent.physical.initialAngularVelocity * aiLaunchQ * turboRpmMult;
    sim.opponent.initialRotationalEnergy = 0.5 * sim.opponent.physical.momentOfInertia * sim.opponent.omega * sim.opponent.omega;
    sim.opponent.rotationalEnergy = sim.opponent.initialRotationalEnergy;
    sim.opponent.staminaRatio = 1;
    const oppSign = sim.launchHandedness === "right" ? -1 : 1;
    const inwardAngle = Math.atan2(-sim.opponent.z, -sim.opponent.x);
    const chordMag = sim.aiPersonality === "Evasive" ? 1.18 : sim.aiPersonality === "Defensive" ? 0.58 : sim.aiPersonality === "Aggressive" ? 0.72 : 0.92;
    const oAngle = inwardAngle + oppSign * clamp(chordMag, 0.35, LAUNCH_MAX_OFFSET - 0.12);
    const launchSpeedO = (LAUNCH_SPEED_BASE + 0.72 * LAUNCH_SPEED_RANGE) * aiLaunchQ * windBonusO;
    sim.opponent.vx = Math.cos(oAngle) * launchSpeedO;
    sim.opponent.vz = Math.sin(oAngle) * launchSpeedO;
  }
  sim.phase = "Combat";
}
function setTacticalCommand(sim, side, command, options) {
  if (sim.phase !== "Combat" && sim.phase !== "Critical") return false;
  if (side === "player" && !options?.debugOverride) return false;
  const entity = side === "player" ? sim.player : sim.opponent;
  if (side === "player" && options?.debugOverride) {
    entity.debugSteeringEnabled = true;
  }
  if (entity.tacticalCommand === command) return false;
  if (entity.commandCooldown > 0) return false;
  entity.tacticalCommand = command;
  entity.commandTimer = 0;
  entity.commandCooldown = 0.6;
  sim.events.push({
    type: "commandChange",
    x: entity.x,
    y: entity.y,
    z: entity.z,
    intensity: 0.3,
    actorId: side,
    label: command
  });
  return true;
}
function setBattleMode(sim, side, mode, options) {
  if (sim.phase !== "Combat" && sim.phase !== "Critical") return false;
  if (side === "player" && !options?.debugOverride) return false;
  const entity = side === "player" ? sim.player : sim.opponent;
  if (entity.battleMode === mode) return false;
  if (entity.modeCooldown > 0) return false;
  if (mode === "Berserk" && entity.energy < 15) return false;
  if (mode === "Berserk") {
    entity.energy = Math.max(0, entity.energy - 15);
  }
  entity.battleMode = mode;
  entity.modeCooldown = 1.4;
  sim.events.push({
    type: "modeChange",
    x: entity.x,
    y: entity.y,
    z: entity.z,
    intensity: 0.45,
    actorId: side,
    label: `${mode} Mode`
  });
  return true;
}
function activateAbility(sim, side, slotIndex) {
  if (sim.mutators.noAbilities) return false;
  if (sim.phase !== "Combat" && sim.phase !== "Critical") return false;
  const actor = side === "player" ? sim.player : sim.opponent;
  const target = side === "player" ? sim.opponent : sim.player;
  const slot = actor.abilitySlots[slotIndex];
  if (!slot) return false;
  if (slot.cooldownRemaining > 0) return false;
  const def = getAbilityDefinition(slot.abilityId);
  if (actor.energy < def.energyCost) return false;
  if (def.resonanceCost > 0 && actor.resonance < def.resonanceCost) return false;
  actor.energy -= def.energyCost;
  if (def.resonanceCost > 0) {
    actor.resonance = Math.max(0, actor.resonance - def.resonanceCost);
  }
  slot.cooldownRemaining = def.cooldownSec;
  slot.activeRemaining = def.durationSec;
  if (side === "player") {
    sim.abilitiesUsedByPlayer += 1;
    sim.adaptiveMemory.playerAbilitiesObserved += 1;
  }
  const dx = target.x - actor.x;
  const dz = target.z - actor.z;
  const dist = Math.hypot(dx, dz) || 1;
  const nx = dx / dist;
  const nz = dz / dist;
  switch (def.effectKind) {
    case "DashStrike": {
      const dashSpeed = 4.6 * def.power;
      actor.vx += nx * dashSpeed;
      actor.vz += nz * dashSpeed;
      actor.omega = Math.min(actor.physical.initialAngularVelocity * 1.15, actor.omega + 6);
      if (def.statusApplied === "Overdrive") {
        applyStatus(actor, "Overdrive", def.durationSec, def.power);
      } else if (def.statusApplied === "Burn" || def.element === "Fire") {
        if (dist < 3.2) {
          applyStatus(target, "Burn", def.durationSec, def.power);
        }
      }
      break;
    }
    case "ElementalBurst": {
      if (dist < 3) {
        const push = 3.8 * def.power;
        target.vx += nx * push;
        target.vz += nz * push;
        const dmg = 9 * def.power;
        target.durability = Math.max(0, target.durability - dmg);
        recordAnalysisDamage(sim, target.entityId, "ability", dmg);
        applyPartWear(sim, target, 7 * def.power);
        target.omega = Math.max(0, target.omega - 7 * def.power);
        if (def.statusApplied) {
          applyStatus(target, def.statusApplied, def.durationSec, def.power);
        }
      }
      break;
    }
    case "EnergyDrain": {
      if (dist < 3.2) {
        const stolen = Math.min(target.energy, 18 * def.power);
        target.energy = Math.max(0, target.energy - stolen);
        actor.energy = Math.min(actor.maxEnergy, actor.energy + stolen);
        applyStatus(target, "Drain", def.durationSec, def.power);
      }
      break;
    }
    case "PurifyCleanse": {
      cleanseNegativeStatuses(actor);
      applyStatus(actor, "Purify", def.durationSec, 1);
      if (def.type === "Defensive") {
        applyStatus(actor, "Shield", def.durationSec, def.power);
      }
      actor.stability = Math.min(100, actor.stability + 18);
      if (dist < 2.7) {
        applyStatus(target, "Weaken", def.durationSec, 1);
      }
      break;
    }
    case "BarrierShield": {
      applyStatus(actor, "Shield", def.durationSec, def.power);
      actor.stability = Math.min(100, actor.stability + 14);
      break;
    }
    case "SpinStabilize": {
      actor.stability = Math.min(100, actor.stability + (def.power > 5 ? def.power : 20));
      actor.omega = Math.min(actor.physical.initialAngularVelocity * 1.1, actor.omega + 9);
      actor.vx += -nz * 2.2;
      actor.vz += nx * 2.2;
      if (def.statusApplied === "Weaken" && dist < 2.8) {
        applyStatus(target, "Weaken", def.durationSec, 1);
      }
      break;
    }
    case "TacticalSurge": {
      applyStatus(actor, "Overdrive", def.durationSec, def.power);
      actor.vx += nx * 2.4;
      actor.vz += nz * 2.4;
      break;
    }
    case "VortexPull": {
      const toCenterLen = Math.hypot(target.x, target.z) || 1;
      target.vx += -target.x / toCenterLen * 3.8;
      target.vz += -target.z / toCenterLen * 3.8;
      break;
    }
    case "UltimateStrike": {
      if (actor.element === "Light") {
        cleanseNegativeStatuses(actor);
        applyStatus(actor, "Purify", def.durationSec, 1);
      } else if (def.element === "Wind") {
        applyStatus(actor, "Overdrive", def.durationSec, 1.35);
        actor.vx += nx * 1.8;
        actor.vz += nz * 1.8;
      }
      actor.vx += nx * 6.8;
      actor.vz += nz * 6.8;
      actor.omega = Math.min(actor.physical.initialAngularVelocity * 1.25, actor.omega + 14);
      if (dist < 3.6) {
        if (def.element === "Water") {
          const toCLen = Math.hypot(target.x, target.z) || 1;
          target.vx += -target.x / toCLen * 4.2 + nx * 2.2;
          target.vz += -target.z / toCLen * 4.2 + nz * 2.2;
        } else {
          target.vx += nx * 5.2;
          target.vz += nz * 5.2;
        }
        if (def.element === "Shadow") {
          const siphon = Math.min(16, target.energy);
          target.energy -= siphon;
          actor.energy = Math.min(actor.maxEnergy, actor.energy + siphon);
        }
        const ultDmg = 16 * def.power;
        target.durability = Math.max(0, target.durability - ultDmg);
        recordAnalysisDamage(sim, target.entityId, "ability", ultDmg, true);
        applyPartWear(sim, target, 14 * def.power);
        target.omega = Math.max(0, target.omega - 11);
        if (def.statusApplied) {
          applyStatus(target, def.statusApplied, def.durationSec, def.power);
        }
      }
      sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.65);
      sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.055);
      sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.55);
      break;
    }
  }
  const resBrokenPenalty = actor.brokenParts.includes("EnergyModule") ? 0.7 : 1;
  actor.resonance = Math.min(
    100,
    actor.resonance + (def.type === "Ultimate" ? 0 : 12 * actor.physical.resonanceRate * resBrokenPenalty)
  );
  sim.events.push({
    type: "ability",
    x: actor.x,
    y: actor.y + 0.25,
    z: actor.z,
    intensity: def.type === "Ultimate" ? 1.4 : 0.85,
    isCritical: def.type === "Ultimate",
    actorId: side,
    label: def.displayName,
    colorHex: def.colorHex
  });
  recordHighlightFrame(sim, `${def.displayName.toUpperCase()} ACTIVATED`, def.type === "Ultimate");
  return true;
}
var NEGATIVE_STATUSES = ["Burn", "Slow", "Freeze", "Shock", "Weaken", "Drain"];
function cleanseNegativeStatuses(target) {
  target.statuses = target.statuses.filter((s) => !NEGATIVE_STATUSES.includes(s.type));
  target.statDebuffs = [];
}
function createStatDebuff(kind, durationSec = 3.2) {
  switch (kind) {
    case "Overheated":
      return {
        kind,
        label: "Overheated",
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.82,
        defenseMult: 0.94,
        speedMult: 0.96,
        spinDrainMult: 1.35,
        energyRegenMult: 0.85,
        colorHex: "#ff5a2f"
      };
    case "ArcDisruption":
      return {
        kind,
        label: "Arc Disruption",
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.92,
        defenseMult: 0.9,
        speedMult: 0.85,
        spinDrainMult: 1.15,
        energyRegenMult: 0.8,
        colorHex: "#facc15"
      };
    case "DragSnare":
      return {
        kind,
        label: "Drag Snare",
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.95,
        defenseMult: 0.85,
        speedMult: 0.72,
        spinDrainMult: 1.2,
        energyRegenMult: 0.95,
        colorHex: "#d97706"
      };
    case "ArmorCorrosion":
      return {
        kind,
        label: "Armor Corroded",
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.88,
        defenseMult: 0.78,
        speedMult: 0.95,
        spinDrainMult: 1.1,
        energyRegenMult: 1,
        colorHex: "#f43f5e"
      };
    case "VoidSiphon":
      return {
        kind,
        label: "Void Siphon",
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.84,
        defenseMult: 0.92,
        speedMult: 0.9,
        spinDrainMult: 1.22,
        energyRegenMult: 0.75,
        colorHex: "#a855f7"
      };
  }
}
function applyStatDebuff(sim, target, kind, durationSec = 3.2, sourceLabel) {
  if (hasStatus(target, "Purify")) return;
  const spec = createStatDebuff(kind, durationSec);
  const existing = target.statDebuffs.find((d) => d.kind === kind);
  const wasNew = !existing;
  if (existing) {
    existing.remainingSec = Math.max(existing.remainingSec, spec.remainingSec);
  } else {
    target.statDebuffs.push(spec);
  }
  if (wasNew || target.trapDebuffCooldown <= 0) {
    target.trapDebuffCooldown = 1.25;
    sim.events.push({
      type: "trapDebuff",
      x: target.x,
      y: target.y + 0.22,
      z: target.z,
      intensity: 0.8,
      actorId: target.entityId,
      label: sourceLabel ? `${target.name}: ${spec.label} (${sourceLabel})` : `${target.name}: ${spec.label}!`,
      colorHex: spec.colorHex
    });
  }
}
function getCombinedDebuffMultipliers(entity) {
  let attackMult = 1;
  let defenseMult = 1;
  let speedMult = 1;
  let spinDrainMult = 1;
  let energyRegenMult = 1;
  for (const d of entity.statDebuffs) {
    attackMult *= d.attackMult;
    defenseMult *= d.defenseMult;
    speedMult *= d.speedMult;
    spinDrainMult *= d.spinDrainMult;
    energyRegenMult *= d.energyRegenMult;
  }
  return { attackMult, defenseMult, speedMult, spinDrainMult, energyRegenMult };
}
function applyStatus(target, type, durationSec, strength) {
  if (NEGATIVE_STATUSES.includes(type) && hasStatus(target, "Purify")) {
    return;
  }
  const resistMult = target.element === "Light" && NEGATIVE_STATUSES.includes(type) ? 0.85 : 1;
  const dur = durationSec * resistMult;
  const existing = target.statuses.find((s) => s.type === type);
  if (existing) {
    existing.remainingSec = Math.max(existing.remainingSec, dur);
    existing.strength = Math.max(existing.strength, strength);
  } else {
    target.statuses.push({ type, remainingSec: dur, strength });
  }
}
function hasStatus(entity, type) {
  return entity.statuses.find((s) => s.type === type);
}
function applyPartWear(sim, target, wearPoints) {
  const weights = [
    ["AttackBlade", 0.3],
    ["ArmorRing", 0.25],
    ["WeightDisc", 0.14],
    ["EnergyModule", 0.11],
    ["PerformanceDriver", 0.11],
    ["SpiritCore", 0.09]
  ];
  for (const [partKey, ratio] of weights) {
    if (target.partDurability[partKey] <= 0) continue;
    const prev = target.partDurability[partKey];
    const next = Math.max(0, prev - wearPoints * ratio);
    target.partDurability[partKey] = next;
    if (prev > 0 && next <= 0 && !target.brokenParts.includes(partKey)) {
      target.brokenParts.push(partKey);
      if (sim.analysis.firstBrokenPart === null) {
        sim.analysis.firstBrokenSide = target.entityId;
        sim.analysis.firstBrokenPart = partKey;
        sim.analysis.firstBrokenTimeSec = Number(sim.elapsedTime.toFixed(2));
      }
      sim.events.push({
        type: "partBreak",
        x: target.x,
        y: target.y + 0.22,
        z: target.z,
        vx: target.vx,
        vz: target.vz,
        intensity: 1,
        actorId: target.entityId,
        partKey,
        label: `${target.name}: ${partKey} SHATTERED!`,
        colorHex: "#f43f5e"
      });
    }
  }
}
function getModeModifiers(mode) {
  switch (mode) {
    case "Attack":
      return { thrustMult: 1.18, impactMult: 1.22, damageTakenMult: 1.12, rotDragMult: 1.18, stabilityRecovery: -1.5 };
    case "Defense":
      return { thrustMult: 0.78, impactMult: 0.88, damageTakenMult: 0.72, rotDragMult: 0.88, stabilityRecovery: 6.5 };
    case "Speed":
      return { thrustMult: 1.32, impactMult: 1.05, damageTakenMult: 1.05, rotDragMult: 1.14, stabilityRecovery: 0 };
    case "Stamina":
      return { thrustMult: 0.72, impactMult: 0.85, damageTakenMult: 0.92, rotDragMult: 0.72, stabilityRecovery: 4.5 };
    case "Berserk":
      return { thrustMult: 1.4, impactMult: 1.42, damageTakenMult: 1.25, rotDragMult: 1.45, stabilityRecovery: -4 };
    case "Counter":
      return { thrustMult: 0.82, impactMult: 1.35, damageTakenMult: 0.8, rotDragMult: 0.95, stabilityRecovery: 5 };
  }
}
function computeSteeringVector(actor, target, dt) {
  if (!actor.debugSteeringEnabled) {
    return { fx: 0, fz: 0 };
  }
  const dx = target.x - actor.x;
  const dz = target.z - actor.z;
  const dist = Math.hypot(dx, dz) || 1e-3;
  const dirX = dx / dist;
  const dirZ = dz / dist;
  const tanX = -dirZ;
  const tanZ = dirX;
  const rFromCenter = Math.hypot(actor.x, actor.z) || 1e-3;
  const toCenterX = -actor.x / rFromCenter;
  const toCenterZ = -actor.z / rFromCenter;
  let desiredX = 0;
  let desiredZ = 0;
  let effort = 1;
  if (rFromCenter > ARENA_DISH_RADIUS * 0.84) {
    desiredX += toCenterX * 1.35;
    desiredZ += toCenterZ * 1.35;
  }
  switch (actor.tacticalCommand) {
    case "Aggressive":
      desiredX += dirX * 1.2 + tanX * 0.28;
      desiredZ += dirZ * 1.2 + tanZ * 0.28;
      effort = 1.15;
      break;
    case "Defensive":
      desiredX += toCenterX * 1.05 + tanX * 0.35;
      desiredZ += toCenterZ * 1.05 + tanZ * 0.35;
      effort = 0.65;
      break;
    case "Chase": {
      const leadX = target.x + target.vx * 0.32 - actor.x;
      const leadZ = target.z + target.vz * 0.32 - actor.z;
      const leadLen = Math.hypot(leadX, leadZ) || 1;
      desiredX += leadX / leadLen;
      desiredZ += leadZ / leadLen;
      effort = 1.1;
      break;
    }
    case "Circle": {
      const idealDist = 1.85;
      const radialPull = clamp((dist - idealDist) * 0.6, -0.7, 0.7);
      desiredX += tanX * 1 + dirX * radialPull;
      desiredZ += tanZ * 1 + dirZ * radialPull;
      effort = 0.92;
      break;
    }
    case "Evade": {
      desiredX += -dirX * 0.75 + tanX * 0.85 + toCenterX * 0.55;
      desiredZ += -dirZ * 0.75 + tanZ * 0.85 + toCenterZ * 0.55;
      effort = 0.95;
      break;
    }
    case "ConserveEnergy":
      desiredX += toCenterX * 0.55 + tanX * 0.35;
      desiredZ += toCenterZ * 0.55 + tanZ * 0.35;
      effort = 0.35;
      break;
    case "HoldPosition":
      desiredX += toCenterX * 0.25;
      desiredZ += toCenterZ * 0.25;
      effort = 0.18;
      break;
    case "Counter":
      desiredX += dist < 1.3 ? dirX * 1.25 : toCenterX * 0.55 + tanX * 0.5;
      desiredZ += dist < 1.3 ? dirZ * 1.25 : toCenterZ * 0.55 + tanZ * 0.5;
      effort = dist < 1.3 ? 1.25 : 0.45;
      break;
  }
  const len = Math.hypot(desiredX, desiredZ) || 1;
  desiredX /= len;
  desiredZ /= len;
  const modeMod = getModeModifiers(actor.battleMode);
  let speedFactor = modeMod.thrustMult * effort;
  if (hasStatus(actor, "Overdrive")) speedFactor *= 1.35;
  if (hasStatus(actor, "Slow")) speedFactor *= 0.68;
  if (hasStatus(actor, "Freeze")) speedFactor *= 0.52;
  if (hasStatus(actor, "Shock")) {
    const jitter = Math.sin(actor.wobblePhase * 3.1) * 0.35;
    const jx = desiredX * Math.cos(jitter) - desiredZ * Math.sin(jitter);
    const jz = desiredX * Math.sin(jitter) + desiredZ * Math.cos(jitter);
    desiredX = jx;
    desiredZ = jz;
  }
  const controlEffectiveness = 0.55 + actor.stability / 100 * 0.45;
  const forceMag = actor.physical.accelerationForce * speedFactor * controlEffectiveness * dt * 14;
  return {
    fx: desiredX * forceMag,
    fz: desiredZ * forceMag
  };
}
function stepEntityKinematics(entity, other, dt, sim) {
  if (entity.ringedOut || entity.burstOut || entity.knockedOut) return;
  const arena = getArenaDefinition(sim.arenaId);
  entity.modeCooldown = Math.max(0, entity.modeCooldown - dt);
  entity.commandCooldown = Math.max(0, entity.commandCooldown - dt);
  entity.commandTimer += dt;
  entity.hitFlashTimer = Math.max(0, entity.hitFlashTimer - dt);
  entity.trapDebuffCooldown = Math.max(0, entity.trapDebuffCooldown - dt);
  for (const s of entity.abilitySlots) {
    s.cooldownRemaining = Math.max(0, s.cooldownRemaining - dt);
    s.activeRemaining = Math.max(0, s.activeRemaining - dt);
  }
  for (let i = entity.statuses.length - 1; i >= 0; i--) {
    entity.statuses[i].remainingSec -= dt;
    if (entity.statuses[i].remainingSec <= 0) {
      entity.statuses.splice(i, 1);
    }
  }
  for (let i = entity.statDebuffs.length - 1; i >= 0; i--) {
    entity.statDebuffs[i].remainingSec -= dt;
    if (entity.statDebuffs[i].remainingSec <= 0) {
      entity.statDebuffs.splice(i, 1);
    }
  }
  const weatherDef = getWeatherDefinition(sim.weather);
  let localFrictionMult = arena.surfaceFrictionMult * weatherDef.gripFrictionMult;
  let localRotDragMult = arena.rotationalDragMult * weatherDef.rotDragMult;
  let hazardEnergyDelta = arena.energyModPerSec;
  const hazardMult = sim.mutators.doubleHazards ? 2 : 1;
  for (const hz of arena.hazardZones) {
    const hzPos = evaluateDynamicHazardPosition(hz, sim.elapsedTime);
    const distHz = Math.hypot(entity.x - hzPos.x, entity.z - hzPos.z);
    if (distHz <= hz.radius) {
      if (hz.kind === "heat") {
        hazardEnergyDelta -= 3.5 * hazardMult;
        localRotDragMult += 0.45 * hazardMult;
        const heatDmg = (sim.mutators.doubleHazards ? 1.85 : 0.75) * dt;
        entity.durability = Math.max(0, entity.durability - heatDmg);
        recordAnalysisDamage(sim, entity.entityId, "hazard", heatDmg);
      } else if (hz.kind === "sand") {
        localFrictionMult += 0.65 * hazardMult;
      } else if (hz.kind === "shock") {
        const pulse = Math.sin(sim.elapsedTime * 2.2) > 0.35;
        if (pulse) {
          hazardEnergyDelta += 3.2;
        } else {
          entity.stability = Math.max(0, entity.stability - 4.5 * hazardMult * dt);
          if (sim.mutators.doubleHazards) {
            const shockDmg = 1.15 * dt;
            entity.durability = Math.max(0, entity.durability - shockDmg);
            recordAnalysisDamage(sim, entity.entityId, "hazard", shockDmg);
          }
        }
      } else if (hz.kind === "void") {
        localRotDragMult += 0.25 * hazardMult;
        if (entity.element === "Shadow" || entity.element === "Light") {
          hazardEnergyDelta += 2.2;
        } else {
          hazardEnergyDelta -= 2.2 * hazardMult;
          const voidDmg = (sim.mutators.doubleHazards ? 1.45 : 0.55) * dt;
          entity.durability = Math.max(0, entity.durability - voidDmg);
          recordAnalysisDamage(sim, entity.entityId, "hazard", voidDmg);
        }
      }
      if (hz.debuffKind) {
        applyStatDebuff(
          sim,
          entity,
          hz.debuffKind,
          (hz.debuffDurationSec ?? 3.2) * (sim.mutators.doubleHazards ? 1.6 : 1),
          hz.label
        );
      }
    }
  }
  const debuffs = getCombinedDebuffMultipliers(entity);
  const waterRegenBonus = entity.element === "Water" ? 1.12 : 1;
  const energyModulePenalty = entity.brokenParts.includes("EnergyModule") ? 0.55 : 1;
  const drainPenalty = hasStatus(entity, "Drain") ? -4.5 : 0;
  if (hasStatus(entity, "Drain")) {
    other.energy = Math.min(other.maxEnergy, other.energy + 3.2 * dt);
  }
  entity.energy = clamp(
    entity.energy + (entity.physical.energyRegenPerSec * waterRegenBonus * energyModulePenalty * debuffs.energyRegenMult + hazardEnergyDelta + drainPenalty) * dt,
    0,
    entity.maxEnergy
  );
  if (entity.battleMode === "Berserk" && (entity.entityId === "opponent" || entity.debugSteeringEnabled)) {
    entity.energy -= 6.5 * dt;
    if (entity.energy <= 0) {
      entity.energy = 0;
      entity.battleMode = "Attack";
    }
  }
  const steer = computeSteeringVector(entity, other, dt);
  const lightningAccelBonus = entity.element === "Lightning" ? 1.1 : 1;
  entity.vx += steer.fx * lightningAccelBonus * debuffs.speedMult / (entity.physical.totalMassKg * 12);
  entity.vz += steer.fz * lightningAccelBonus * debuffs.speedMult / (entity.physical.totalMassKg * 12);
  if (weatherDef.gustAccel > 0) {
    const gustAngle = sim.elapsedTime * 0.42;
    const gustMag = weatherDef.gustAccel * (0.65 + 0.35 * Math.sin(sim.elapsedTime * weatherDef.gustFreq)) / Math.max(0.03, entity.physical.totalMassKg * 18);
    entity.vx += Math.cos(gustAngle) * gustMag * dt;
    entity.vz += Math.sin(gustAngle) * gustMag * dt;
  }
  const distCenter = Math.hypot(entity.x, entity.z);
  const radialVelNow = distCenter > 1e-3 ? (entity.vx * entity.x + entity.vz * entity.z) / distCenter : 0;
  const exitingOpenGate = distCenter > ARENA_DISH_RADIUS - 0.65 && radialVelNow > 0.4 && isAtRingOutGate(entity.x, entity.z);
  if (!exitingOpenGate) {
    const bowlAccel = computeBowlRadialAccel(entity.x, entity.z);
    const gravityMult = sim.mutators.doubleGravity ? 2 : 1;
    entity.vx += bowlAccel.ax * gravityMult * dt;
    entity.vz += bowlAccel.az * gravityMult * dt;
  }
  const modeMod = !entity.debugSteeringEnabled ? getModeModifiers("Stamina") : getModeModifiers(entity.battleMode);
  const debuffDragPenalty = (1 - debuffs.speedMult) * 1.1;
  const spiralDrag = SPIRAL_BASE_DRAG + entity.physical.groundFriction * localFrictionMult * 0.3 + debuffDragPenalty;
  const damp = Math.exp(-spiralDrag * dt);
  entity.vx *= damp;
  entity.vz *= damp;
  const speed = Math.hypot(entity.vx, entity.vz);
  if (distCenter < 0.18 && speed < 0.045) {
    entity.vx *= 0.82;
    entity.vz *= 0.82;
  }
  const maxSpeed = (sim.arenaId === "frozen" ? 7.6 : 6.8) * debuffs.speedMult;
  const currSpd = Math.hypot(entity.vx, entity.vz);
  if (currSpd > maxSpeed && currSpd > 1e-3) {
    entity.vx = entity.vx / currSpd * maxSpeed;
    entity.vz = entity.vz / currSpd * maxSpeed;
  }
  entity.x += entity.vx * dt;
  entity.z += entity.vz * dt;
  for (const pillar of arena.pillars) {
    const pState = evaluateDynamicPillarState(pillar, sim.elapsedTime);
    const pdx = entity.x - pState.x;
    const pdz = entity.z - pState.z;
    const pDist = Math.hypot(pdx, pdz);
    const minPDist = pillar.radius + entity.physical.effectiveRadiusM * 0.88;
    if (pDist < minPDist && pDist > 1e-4) {
      const pnx = pdx / pDist;
      const pnz = pdz / pDist;
      entity.x = pState.x + pnx * minPDist;
      entity.z = pState.z + pnz * minPDist;
      const relVx = entity.vx - pState.vx;
      const relVz = entity.vz - pState.vz;
      const relVn = relVx * pnx + relVz * pnz;
      if (relVn < 0) {
        entity.vx -= 1.75 * relVn * pnx;
        entity.vz -= 1.75 * relVn * pnz;
        const pillarDmg = Math.abs(relVn) * 0.68 * (sim.mutators.doubleHazards ? 1.5 : 1);
        entity.durability = Math.max(0, entity.durability - pillarDmg);
        recordAnalysisDamage(sim, entity.entityId, "pillar", pillarDmg);
        entity.omega = Math.max(0, entity.omega - Math.abs(relVn) * 0.52);
        sim.events.push({
          type: "pillarBounce",
          x: entity.x,
          y: arenaFloorHeight(entity.x, entity.z) + 0.15,
          z: entity.z,
          intensity: clamp(Math.abs(relVn) / 4.5, 0.25, 0.95),
          actorId: entity.entityId
        });
        if (pillar.debuffKind) {
          applyStatDebuff(
            sim,
            entity,
            pillar.debuffKind,
            pillar.debuffDurationSec ?? 3.2,
            pillar.motion ? "Moving Pillar" : "Obsidian Pillar"
          );
        }
      }
    }
  }
  entity.y = arenaFloorHeight(entity.x, entity.z);
  const driverBrokenPenalty = entity.brokenParts.includes("PerformanceDriver") ? 1.45 : 1;
  const wobbleDragPenalty = 1 + (1 - entity.stability / 100) * 0.65;
  const frictionSpinLoss = entity.physical.groundFriction * localFrictionMult * (0.5 + speed * 0.18);
  const burnPenalty = hasStatus(entity, "Burn") ? 1.85 : 0;
  const drainSpinPenalty = hasStatus(entity, "Drain") ? 1.3 : 0;
  const totalSpinDecay = (entity.physical.rotationalDrag * 185 * localRotDragMult * driverBrokenPenalty * modeMod.rotDragMult * wobbleDragPenalty + frictionSpinLoss * 1.35 + burnPenalty + drainSpinPenalty) * debuffs.spinDrainMult * dt;
  const burnDmg = (hasStatus(entity, "Burn") ? 0.65 : 0) + (hasStatus(entity, "Drain") ? 0.45 : 0);
  if (burnDmg > 0) {
    const tickStatusDmg = burnDmg * dt;
    entity.durability = Math.max(0, entity.durability - tickStatusDmg);
    recordAnalysisDamage(sim, entity.entityId, "status", tickStatusDmg);
  }
  entity.omega = Math.max(
    sim.mutators.ringOutOnly ? MIN_SPIN_OMEGA * 1.15 : 0,
    entity.omega - totalSpinDecay
  );
  entity.spinAngle = (entity.spinAngle + entity.omega * dt) % (Math.PI * 200);
  entity.rotationalEnergy = 0.5 * entity.physical.momentOfInertia * entity.omega * entity.omega;
  entity.staminaRatio = clamp(
    entity.rotationalEnergy / Math.max(1e-4, entity.initialRotationalEnergy),
    0,
    1
  );
  const iceStabilityBonus = entity.element === "Ice" ? 1.1 : 1;
  const weightBrokenMult = entity.brokenParts.includes("WeightDisc") ? 0.65 : 1;
  if (weatherDef.stabilityDrainPerSec > 0) {
    entity.stability = clamp(entity.stability - weatherDef.stabilityDrainPerSec * dt, 0, 100);
  }
  if (entity.staminaRatio < 0.36) {
    const lowDrain = (0.36 - entity.staminaRatio) * 28 * dt;
    entity.stability = clamp(entity.stability - lowDrain, 0, 100);
  } else {
    entity.stability = clamp(
      entity.stability + (3.2 + modeMod.stabilityRecovery) * iceStabilityBonus * weightBrokenMult * weatherDef.stabilityRecoveryMult * dt,
      0,
      100
    );
  }
  const targetTilt = (100 - entity.stability) / 100 * 0.42;
  entity.wobbleTilt += (targetTilt - entity.wobbleTilt) * Math.min(1, dt * 8);
  entity.wobblePhase += (8 + (1 - entity.staminaRatio) * 10) * dt;
  const distFromCenter = Math.hypot(entity.x, entity.z);
  const bladeMargin = Math.max(0.62, entity.physical.effectiveRadiusM * 1.38);
  const maxAllowed = ARENA_DISH_RADIUS - bladeMargin;
  if (distFromCenter > maxAllowed) {
    const nx = entity.x / distFromCenter;
    const nz = entity.z / distFromCenter;
    const radialVel = entity.vx * nx + entity.vz * nz;
    const earthAnchor = entity.element === "Earth" ? 1.14 : 1;
    const atGate = isAtRingOutGate(entity.x, entity.z);
    const gateSpeedThreshold = (sim.mutators.ringOutOnly ? 1.35 : 1.75) * earthAnchor;
    if (distFromCenter > ARENA_RING_OUT_RADIUS) {
      entity.ringedOut = true;
      sim.events.push({
        type: "ringOut",
        x: entity.x,
        y: entity.y,
        z: entity.z,
        intensity: 1.2,
        actorId: entity.entityId,
        label: `${entity.name} Ring Out!`
      });
      return;
    }
    if (atGate && (radialVel > gateSpeedThreshold || distFromCenter > maxAllowed + 0.16)) {
    } else if (atGate) {
      if (radialVel > 0) {
        entity.x = nx * (maxAllowed - 0.01);
        entity.z = nz * (maxAllowed - 0.01);
        entity.y = arenaFloorHeight(entity.x, entity.z);
        const tanX = -nz;
        const tanZ = nx;
        const tanVel = entity.vx * tanX + entity.vz * tanZ;
        entity.vx = -nx * Math.max(0.18, radialVel * 0.25) + tanX * (tanVel * 0.85);
        entity.vz = -nz * Math.max(0.18, radialVel * 0.25) + tanZ * (tanVel * 0.85);
      }
    } else {
      entity.x = nx * (maxAllowed - 0.015);
      entity.z = nz * (maxAllowed - 0.015);
      entity.y = arenaFloorHeight(entity.x, entity.z);
      if (radialVel > 0) {
        const tanX = -nz;
        const tanZ = nx;
        const tanVel = entity.vx * tanX + entity.vz * tanZ;
        const inwardSpeed = Math.max(0.32, radialVel * 0.34);
        const dampedTanVel = tanVel * 0.62;
        entity.vx = -nx * inwardSpeed + tanX * dampedTanVel;
        entity.vz = -nz * inwardSpeed + tanZ * dampedTanVel;
        entity.omega = Math.max(0, entity.omega - radialVel * 0.45);
        if (radialVel > 0.85) {
          sim.events.push({
            type: "wallBounce",
            x: entity.x,
            y: entity.y + 0.12,
            z: entity.z,
            intensity: clamp(radialVel / 4.5, 0.2, 0.9),
            actorId: entity.entityId
          });
        }
      }
    }
  }
  const durRatio = entity.durability / Math.max(1, entity.maxDurability);
  if (!sim.mutators.ringOutOnly && (entity.brokenParts.includes("SpiritCore") || entity.brokenParts.length >= 3 || entity.stability <= 0 && durRatio < 0.2)) {
    entity.knockedOut = true;
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.6);
    sim.events.push({
      type: "knockout",
      x: entity.x,
      y: entity.y + 0.2,
      z: entity.z,
      intensity: 1.45,
      isCritical: true,
      actorId: entity.entityId,
      label: `${entity.name} KNOCKOUT!`
    });
    return;
  }
  if (entity.omega < MIN_SPIN_OMEGA) {
    entity.lowSpinTimer += dt;
  } else {
    entity.lowSpinTimer = Math.max(0, entity.lowSpinTimer - dt * 2);
  }
}
function resolveTopCollision(sim) {
  const a = sim.player;
  const b = sim.opponent;
  if (a.ringedOut || b.ringedOut || a.burstOut || b.burstOut || a.knockedOut || b.knockedOut) {
    return;
  }
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const minDist = a.physical.effectiveRadiusM + b.physical.effectiveRadiusM;
  if (dist >= minDist || dist < 1e-4) return;
  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minDist - dist;
  const invMassA = 1 / a.physical.totalMassKg;
  const invMassB = 1 / b.physical.totalMassKg;
  const invMassSum = invMassA + invMassB;
  a.x -= nx * overlap * (invMassA / invMassSum);
  a.z -= nz * overlap * (invMassA / invMassSum);
  b.x += nx * overlap * (invMassB / invMassSum);
  b.z += nz * overlap * (invMassB / invMassSum);
  const rvx = b.vx - a.vx;
  const rvz = b.vz - a.vz;
  const velAlongNormal = rvx * nx + rvz * nz;
  if (velAlongNormal > 0) return;
  const modeA = a.entityId === "player" && !a.debugSteeringEnabled ? getModeModifiers("Stamina") : getModeModifiers(a.battleMode);
  const modeB = getModeModifiers(b.battleMode);
  const e = clamp((a.physical.restitution + b.physical.restitution) * 0.5 + 0.35, 0.5, 0.94);
  let j = -(1 + e) * velAlongNormal / invMassSum;
  const minSeparationSpeed = (2.45 + 0.45 * (a.omega / 110 * modeA.impactMult + b.omega / 110 * modeB.impactMult)) * (sim.mutators.ringOutOnly ? 1.2 : 1);
  j = Math.max(j, minSeparationSpeed / invMassSum);
  const impulseX = j * nx;
  const impulseZ = j * nz;
  a.vx -= impulseX * invMassA;
  a.vz -= impulseZ * invMassA;
  b.vx += impulseX * invMassB;
  b.vz += impulseZ * invMassB;
  const tx = -nz;
  const tz = nx;
  const spinDiffKick = ((a.omega - b.omega) * 0.011 + 0.85) * Math.sign(a.omega + b.omega);
  a.vx += tx * spinDiffKick * 0.52;
  a.vz += tz * spinDiffKick * 0.52;
  b.vx -= tx * spinDiffKick * 0.52;
  b.vz -= tz * spinDiffKick * 0.52;
  const impactSpeed = Math.abs(velAlongNormal) + 1.2;
  if (impactSpeed > 4.2) {
    sim.adaptiveMemory.highSpeedClashes += 1;
  }
  const isCritical = impactSpeed > 4.6 || Math.random() < (a.attributes.critical + b.attributes.critical) / 1e3;
  const critMult = isCritical ? 1.32 : 1;
  const elemAonB = getDualElementalMultiplier(a.element, a.secondaryElement, b.element, b.secondaryElement);
  const elemBonA = getDualElementalMultiplier(b.element, b.secondaryElement, a.element, a.secondaryElement);
  const aShield = hasStatus(a, "Shield")?.strength ?? 0;
  const bShield = hasStatus(b, "Shield")?.strength ?? 0;
  const aWeakMult = hasStatus(a, "Weaken") ? 0.78 : 1;
  const bWeakMult = hasStatus(b, "Weaken") ? 0.78 : 1;
  const fireBonusA = a.element === "Fire" ? 1.08 : 1;
  const fireBonusB = b.element === "Fire" ? 1.08 : 1;
  const earthResistA = a.element === "Earth" ? 0.88 : 1;
  const earthResistB = b.element === "Earth" ? 0.88 : 1;
  const aBladePenalty = a.brokenParts.includes("AttackBlade") ? 0.82 : 1;
  const bBladePenalty = b.brokenParts.includes("AttackBlade") ? 0.82 : 1;
  const aArmorPenalty = a.brokenParts.includes("ArmorRing") ? 1.25 : 1;
  const bArmorPenalty = b.brokenParts.includes("ArmorRing") ? 1.25 : 1;
  const aDebuffs = getCombinedDebuffMultipliers(a);
  const bDebuffs = getCombinedDebuffMultipliers(b);
  const atkRatioAonB = clamp(
    Math.pow(
      a.attributes.attack * aDebuffs.attackMult / Math.max(25, b.attributes.defense * bDebuffs.defenseMult),
      0.82
    ),
    0.65,
    1.65
  );
  const atkRatioBonA = clamp(
    Math.pow(
      b.attributes.attack * bDebuffs.attackMult / Math.max(25, a.attributes.defense * aDebuffs.defenseMult),
      0.82
    ),
    0.65,
    1.65
  );
  const rawDmgToB = (1.35 + impactSpeed * 0.56) * atkRatioAonB * modeA.impactMult * modeB.damageTakenMult * elemAonB * fireBonusA * aWeakMult * aBladePenalty * bArmorPenalty * earthResistB * (1 - bShield) * critMult;
  const rawDmgToA = (1.35 + impactSpeed * 0.56) * atkRatioBonA * modeB.impactMult * modeA.damageTakenMult * elemBonA * fireBonusB * bWeakMult * bBladePenalty * aArmorPenalty * earthResistA * (1 - aShield) * critMult;
  a.durability = Math.max(0, a.durability - rawDmgToA);
  b.durability = Math.max(0, b.durability - rawDmgToB);
  recordAnalysisDamage(sim, "player", "clash", rawDmgToA, isCritical);
  recordAnalysisDamage(sim, "opponent", "clash", rawDmgToB, isCritical);
  applyPartWear(sim, a, rawDmgToA * 3.1);
  applyPartWear(sim, b, rawDmgToB * 3.1);
  if (a.element === "Shadow") {
    const siphon = 2.4;
    b.energy = Math.max(0, b.energy - siphon);
    a.energy = Math.min(a.maxEnergy, a.energy + siphon);
  }
  if (b.element === "Shadow") {
    const siphon = 2.4;
    a.energy = Math.max(0, a.energy - siphon);
    b.energy = Math.min(b.maxEnergy, b.energy + siphon);
  }
  a.omega = Math.max(0, a.omega - rawDmgToA * 0.42);
  b.omega = Math.max(0, b.omega - rawDmgToB * 0.42);
  a.stability = Math.max(0, a.stability - rawDmgToA * 1.15);
  b.stability = Math.max(0, b.stability - rawDmgToB * 1.15);
  const aResPenalty = a.brokenParts.includes("EnergyModule") ? 0.7 : 1;
  const bResPenalty = b.brokenParts.includes("EnergyModule") ? 0.7 : 1;
  a.resonance = Math.min(100, a.resonance + (7.5 + impactSpeed * 1.5) * a.physical.resonanceRate * aResPenalty);
  b.resonance = Math.min(100, b.resonance + (7.5 + impactSpeed * 1.5) * b.physical.resonanceRate * bResPenalty);
  a.hitFlashTimer = isCritical ? 0.08 : 0.045;
  b.hitFlashTimer = isCritical ? 0.08 : 0.045;
  sim.collisionCount += 1;
  sim.maxImpactImpulse = Math.max(sim.maxImpactImpulse, impactSpeed);
  const CLASH_STREAK_GAP_SEC = 1.35;
  const hitTime = Number(sim.elapsedTime.toFixed(2));
  const prevStreak = sim.activeClashStreak;
  if (prevStreak && hitTime - prevStreak.endTimeSec <= CLASH_STREAK_GAP_SEC) {
    prevStreak.endTimeSec = hitTime;
    prevStreak.durationSec = Number((prevStreak.endTimeSec - prevStreak.startTimeSec).toFixed(2));
    prevStreak.hitCount += 1;
    prevStreak.peakImpulse = Number(Math.max(prevStreak.peakImpulse, impactSpeed).toFixed(2));
  } else {
    sim.activeClashStreak = {
      startTimeSec: hitTime,
      endTimeSec: hitTime,
      durationSec: 0,
      hitCount: 1,
      peakImpulse: Number(impactSpeed.toFixed(2))
    };
  }
  const curStreak = sim.activeClashStreak;
  const bestStreak = sim.analysis.longestClashStreak;
  if (curStreak && (!bestStreak || curStreak.durationSec > bestStreak.durationSec || curStreak.durationSec === bestStreak.durationSec && curStreak.hitCount > bestStreak.hitCount)) {
    sim.analysis.longestClashStreak = { ...curStreak };
  }
  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5 + 0.16;
  const midZ = (a.z + b.z) * 0.5;
  if (!sim.mutators.ringOutOnly && b.durability <= 0 && (impactSpeed > 2.2 || isCritical)) {
    b.burstOut = true;
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.14);
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.78);
    sim.cameraTrauma = 1;
    sim.pendingHighlightMarker = {
      clashX: midX,
      clashZ: midZ,
      isCritical: true,
      eventLabel: "BURST FINISH!"
    };
    sim.events.push({
      type: "burst",
      x: b.x,
      y: b.y + 0.25,
      z: b.z,
      vx: b.vx,
      vz: b.vz,
      intensity: 1.6,
      isCritical: true,
      actorId: "opponent",
      label: "BURST FINISH!"
    });
    return;
  }
  if (!sim.mutators.ringOutOnly && a.durability <= 0 && (impactSpeed > 2.2 || isCritical)) {
    a.burstOut = true;
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.14);
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.78);
    sim.cameraTrauma = 1;
    sim.pendingHighlightMarker = {
      clashX: midX,
      clashZ: midZ,
      isCritical: true,
      eventLabel: "BURST FINISH!"
    };
    sim.events.push({
      type: "burst",
      x: a.x,
      y: a.y + 0.25,
      z: a.z,
      vx: a.vx,
      vz: a.vz,
      intensity: 1.6,
      isCritical: true,
      actorId: "player",
      label: "BURST FINISH!"
    });
    return;
  }
  sim.pendingHighlightMarker = {
    clashX: midX,
    clashZ: midZ,
    isCritical,
    eventLabel: isCritical ? "CRITICAL CLASH!" : void 0
  };
  if (isCritical || impactSpeed > 3.4) {
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.095);
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.24);
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.78);
  } else {
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.025);
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.38);
  }
  sim.events.push({
    type: "collision",
    x: midX,
    y: midY,
    z: midZ,
    intensity: clamp(impactSpeed / 5.5, 0.25, 1.3),
    isCritical,
    label: isCritical ? "CRITICAL CLASH!" : void 0
  });
}
function checkBossPhaseTransitions(sim) {
  if (sim.bossPhases.length === 0) return;
  const opp = sim.opponent;
  const healthRatio = Math.min(
    opp.staminaRatio,
    opp.durability / Math.max(1, opp.maxDurability)
  );
  sim.bossPhases.forEach((bp, idx) => {
    if (sim.triggeredBossPhaseIndices.includes(idx)) return;
    if (healthRatio <= bp.thresholdRatio) {
      sim.triggeredBossPhaseIndices.push(idx);
      opp.battleMode = bp.modeShift;
      opp.tacticalCommand = bp.commandShift;
      opp.energy = Math.min(opp.maxEnergy, opp.energy + bp.energyBurst);
      opp.resonance = Math.min(100, opp.resonance + 35);
      opp.stability = Math.min(100, opp.stability + 22);
      if (bp.arenaShock) {
        const dx = sim.player.x - opp.x;
        const dz = sim.player.z - opp.z;
        const d = Math.hypot(dx, dz) || 1;
        sim.player.vx += dx / d * 3.2;
        sim.player.vz += dz / d * 3.2;
      }
      sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.5);
      sim.events.push({
        type: "bossPhase",
        x: opp.x,
        y: opp.y + 0.3,
        z: opp.z,
        intensity: 1.2,
        isCritical: true,
        actorId: "opponent",
        label: bp.bannerText,
        colorHex: "#f43f5e"
      });
    }
  });
}
function aiThink(sim) {
  const ai = sim.opponent;
  const player = sim.player;
  const dist = Math.hypot(player.x - ai.x, player.z - ai.z);
  const aiCenterDist = Math.hypot(ai.x, ai.z);
  const personality = sim.aiPersonality;
  const scores = {
    Aggressive: 0.3,
    Defensive: 0.3,
    Chase: 0.3,
    Circle: 0.3,
    Evade: 0.2,
    ConserveEnergy: 0.2,
    HoldPosition: 0.15,
    Counter: 0.15
  };
  if (personality === "Aggressive" || personality === "HeavyAssault") {
    scores.Aggressive += 0.55;
    scores.Chase += 0.45;
  } else if (personality === "Defensive") {
    scores.Defensive += 0.55;
    scores.HoldPosition += 0.4;
    scores.ConserveEnergy += 0.3;
  } else if (personality === "Evasive") {
    scores.Evade += 0.5;
    scores.Circle += 0.55;
  } else if (personality === "Tactical") {
    scores.Circle += 0.4;
    scores.Chase += 0.3;
    scores.Counter += 0.35;
  } else if (personality === "Adaptive") {
    const pSpd = Math.hypot(player.vx, player.vz);
    if (sim.adaptiveMemory.highSpeedClashes >= 2 || pSpd > 3.6) {
      scores.Counter += 0.72;
      scores.HoldPosition += 0.35;
    } else if (sim.adaptiveMemory.playerAbilitiesObserved >= 2) {
      scores.Aggressive += 0.62;
      scores.Chase += 0.48;
    } else {
      scores.Circle += 0.5;
      scores.Defensive += 0.4;
    }
  }
  if (aiCenterDist > ARENA_DISH_RADIUS * 0.65) {
    scores.Defensive += 0.65;
  }
  if (ai.staminaRatio < 0.35 && player.staminaRatio > ai.staminaRatio + 0.1) {
    scores.Aggressive += 0.55;
  } else if (ai.staminaRatio > player.staminaRatio + 0.18) {
    scores.ConserveEnergy += 0.45;
    scores.Evade += 0.35;
  }
  if (dist > 2.6) {
    scores.Chase += 0.45;
  }
  let bestCmd = ai.tacticalCommand;
  let bestScore = -999;
  Object.keys(scores).forEach((cmd) => {
    const noise = sim.aiDifficulty === "Easy" ? Math.random() * 0.45 : Math.random() * 0.12;
    if (scores[cmd] + noise > bestScore) {
      bestScore = scores[cmd] + noise;
      bestCmd = cmd;
    }
  });
  setTacticalCommand(sim, "opponent", bestCmd);
  if (ai.modeCooldown <= 0) {
    if (personality === "Adaptive" && sim.adaptiveMemory.highSpeedClashes >= 2 && ai.durability > ai.maxDurability * 0.35) {
      setBattleMode(sim, "opponent", "Counter");
    } else if (ai.durability < ai.maxDurability * 0.32 || ai.stability < 38) {
      setBattleMode(sim, "opponent", "Defense");
    } else if ((personality === "Aggressive" || personality === "HeavyAssault") && ai.energy > 45 && ai.staminaRatio > 0.55) {
      setBattleMode(sim, "opponent", "Berserk");
    } else if (ai.staminaRatio < 0.38) {
      setBattleMode(sim, "opponent", "Stamina");
    } else if (personality === "Evasive" || dist > 3) {
      setBattleMode(sim, "opponent", "Speed");
    } else if (personality === "Aggressive") {
      setBattleMode(sim, "opponent", "Attack");
    }
  }
  if (!sim.mutators.noAbilities) {
    if (ai.resonance >= 100 && ai.energy >= 20) {
      activateAbility(sim, "opponent", 3);
      return;
    }
    if (ai.durability < ai.maxDurability * 0.55 || ai.stability < 52) {
      if (activateAbility(sim, "opponent", 1)) return;
    }
    if (dist < 2.4 && ai.energy >= 30) {
      if (activateAbility(sim, "opponent", 0)) return;
    }
    if (ai.energy >= 45 && sim.aiDifficulty !== "Easy") {
      activateAbility(sim, "opponent", 2);
    }
  }
}
function evaluateVictoryConditions(sim) {
  if (sim.phase !== "Combat" && sim.phase !== "Critical") return;
  const p = sim.player;
  const o = sim.opponent;
  if (!sim.mutators.ringOutOnly) {
    if (o.burstOut) {
      finishBattle(sim, "player", "BurstFinish");
      return;
    }
    if (p.burstOut) {
      finishBattle(sim, "opponent", "BurstFinish");
      return;
    }
    if (o.knockedOut) {
      finishBattle(sim, "player", "Knockout");
      return;
    }
    if (p.knockedOut) {
      finishBattle(sim, "opponent", "Knockout");
      return;
    }
  }
  if (o.ringedOut) {
    finishBattle(sim, "player", "RingOut");
    return;
  }
  if (p.ringedOut) {
    finishBattle(sim, "opponent", "RingOut");
    return;
  }
  if (!sim.mutators.ringOutOnly) {
    if (o.lowSpinTimer >= 0.6 && p.lowSpinTimer < 0.6) {
      sim.events.push({
        type: "spinFinish",
        x: o.x,
        y: o.y,
        z: o.z,
        intensity: 1,
        actorId: "opponent",
        label: "SPIN FINISH!"
      });
      finishBattle(sim, "player", "SpinFinish");
      return;
    }
    if (p.lowSpinTimer >= 0.6 && o.lowSpinTimer < 0.6) {
      sim.events.push({
        type: "spinFinish",
        x: p.x,
        y: p.y,
        z: p.z,
        intensity: 1,
        actorId: "player",
        label: "SPIN FINISH!"
      });
      finishBattle(sim, "opponent", "SpinFinish");
      return;
    }
  }
  if (sim.elapsedTime >= MAX_BATTLE_DURATION) {
    const pScore = p.staminaRatio * 0.65 + p.durability / p.maxDurability * 0.35;
    const oScore = o.staminaRatio * 0.65 + o.durability / o.maxDurability * 0.35;
    finishBattle(sim, pScore >= oScore ? "player" : "opponent", "Survival");
    return;
  }
  const isCriticalNow = p.staminaRatio < 0.28 || o.staminaRatio < 0.28 || p.durability / p.maxDurability < 0.25 || o.durability / p.maxDurability < 0.25;
  if (isCriticalNow && sim.phase === "Combat") {
    sim.phase = "Critical";
    sim.events.push({
      type: "criticalPhase",
      x: 0,
      y: 0.5,
      z: 0,
      intensity: 0.8,
      label: "CRITICAL PHASE!"
    });
  }
}
function captureHighlightObstacles(sim) {
  const arena = getArenaDefinition(sim.arenaId);
  const list = [];
  for (const p of arena.pillars) {
    const st = evaluateDynamicPillarState(p, sim.elapsedTime);
    list.push({ x: st.x, z: st.z, radius: p.radius, kind: "pillar" });
  }
  for (const hz of arena.hazardZones) {
    const pos = evaluateDynamicHazardPosition(hz, sim.elapsedTime);
    list.push({ x: pos.x, z: pos.z, radius: hz.radius, kind: hz.kind });
  }
  return list;
}
function recordHighlightFrame(sim, forceMarker, markCritical = false) {
  const marker = sim.pendingHighlightMarker;
  const pShield = sim.player.statuses.some((s) => s.type === "Shield") || sim.player.abilitySlots.some((s) => s.activeRemaining > 0 && isShieldAbility(s.abilityId));
  const pFire = sim.player.statuses.some((s) => s.type === "Burn") || sim.player.abilitySlots.some((s) => s.activeRemaining > 0 && isFireAbility(s.abilityId));
  const pActiveSlots = [
    Boolean(sim.player.abilitySlots[0] && sim.player.abilitySlots[0].activeRemaining > 0),
    Boolean(sim.player.abilitySlots[1] && sim.player.abilitySlots[1].activeRemaining > 0),
    Boolean(sim.player.abilitySlots[2] && sim.player.abilitySlots[2].activeRemaining > 0),
    Boolean(sim.player.abilitySlots[3] && sim.player.abilitySlots[3].activeRemaining > 0)
  ];
  const pActiveSlotIdx = sim.player.abilitySlots.findIndex((s) => s.activeRemaining > 0);
  const oShield = sim.opponent.statuses.some((s) => s.type === "Shield") || sim.opponent.abilitySlots.some((s) => s.activeRemaining > 0 && isShieldAbility(s.abilityId));
  const oFire = sim.opponent.statuses.some((s) => s.type === "Burn") || sim.opponent.abilitySlots.some((s) => s.activeRemaining > 0 && isFireAbility(s.abilityId));
  const oActiveSlots = [
    Boolean(sim.opponent.abilitySlots[0] && sim.opponent.abilitySlots[0].activeRemaining > 0),
    Boolean(sim.opponent.abilitySlots[1] && sim.opponent.abilitySlots[1].activeRemaining > 0),
    Boolean(sim.opponent.abilitySlots[2] && sim.opponent.abilitySlots[2].activeRemaining > 0),
    Boolean(sim.opponent.abilitySlots[3] && sim.opponent.abilitySlots[3].activeRemaining > 0)
  ];
  const oActiveSlotIdx = sim.opponent.abilitySlots.findIndex((s) => s.activeRemaining > 0);
  const frame = {
    t: sim.elapsedTime,
    px: sim.player.x,
    pz: sim.player.z,
    pVx: sim.player.vx,
    pVz: sim.player.vz,
    pSpinAngle: sim.player.spinAngle,
    pRpm: Math.round(sim.player.omega * 9.55),
    pStaminaPct: Math.round(sim.player.staminaRatio * 100),
    pDurabilityPct: Math.round(sim.player.durability / Math.max(1, sim.player.maxDurability) * 100),
    pEnergyPct: Math.round(sim.player.energy / Math.max(1, sim.player.maxEnergy) * 100),
    pResonance: Math.round(sim.player.resonance),
    pShield,
    pFire,
    pActiveSlotIdx: pActiveSlotIdx >= 0 ? pActiveSlotIdx : void 0,
    pActiveSlots,
    pStatuses: sim.player.statuses.map((s) => s.type),
    ox: sim.opponent.x,
    oz: sim.opponent.z,
    oVx: sim.opponent.vx,
    oVz: sim.opponent.vz,
    oSpinAngle: sim.opponent.spinAngle,
    oRpm: Math.round(sim.opponent.omega * 9.55),
    oStaminaPct: Math.round(sim.opponent.staminaRatio * 100),
    oDurabilityPct: Math.round(sim.opponent.durability / Math.max(1, sim.opponent.maxDurability) * 100),
    oEnergyPct: Math.round(sim.opponent.energy / Math.max(1, sim.opponent.maxEnergy) * 100),
    oResonance: Math.round(sim.opponent.resonance),
    oShield,
    oFire,
    oActiveSlotIdx: oActiveSlotIdx >= 0 ? oActiveSlotIdx : void 0,
    oActiveSlots,
    oStatuses: sim.opponent.statuses.map((s) => s.type),
    clashX: marker?.clashX,
    clashZ: marker?.clashZ,
    isCritical: Boolean(marker?.isCritical) || markCritical,
    eventLabel: forceMarker ?? marker?.eventLabel,
    obstacles: captureHighlightObstacles(sim)
  };
  sim.pendingHighlightMarker = null;
  sim.highlightFrames.push(frame);
  if (sim.highlightFrames.length > 350) {
    sim.highlightFrames.shift();
  }
}
function buildMatchHighlightClip(sim, perspective = "player") {
  if (sim.highlightFrames.length < 2) return void 0;
  const arena = getArenaDefinition(sim.arenaId);
  const frames = sim.highlightFrames.slice(-250);
  const lastFrame = frames[frames.length - 1];
  const rawWinner = sim.winnerSide ?? "player";
  if (perspective === "opponent") {
    return {
      arenaId: sim.arenaId,
      playerName: sim.opponent.name,
      opponentName: sim.player.name,
      playerColor: ELEMENTS[sim.opponent.element]?.primaryColor ?? "#f43f5e",
      opponentColor: ELEMENTS[sim.player.element]?.primaryColor ?? "#38bdf8",
      floorPalette: arena.floorPalette,
      arenaPrimaryColor: arena.primaryColor,
      arenaAccentColor: arena.accentColor,
      winnerSide: rawWinner === "player" ? "opponent" : "player",
      finishReason: sim.finishReason ?? "Survival",
      finalBlowTimeSec: lastFrame.t,
      frames: frames.map((f) => ({
        t: f.t,
        px: f.ox,
        pz: f.oz,
        pVx: f.oVx,
        pVz: f.oVz,
        pSpinAngle: f.oSpinAngle,
        pRpm: f.oRpm,
        pStaminaPct: f.oStaminaPct,
        pDurabilityPct: f.oDurabilityPct,
        pEnergyPct: f.oEnergyPct,
        pResonance: f.oResonance,
        pShield: f.oShield,
        pFire: f.oFire,
        pActiveSlotIdx: f.oActiveSlotIdx,
        pActiveSlots: f.oActiveSlots,
        pStatuses: f.oStatuses,
        ox: f.px,
        oz: f.pz,
        oVx: f.pVx,
        oVz: f.pVz,
        oSpinAngle: f.pSpinAngle,
        oRpm: f.pRpm,
        oStaminaPct: f.pStaminaPct,
        oDurabilityPct: f.pDurabilityPct,
        oEnergyPct: f.pEnergyPct,
        oResonance: f.pResonance,
        oShield: f.pShield,
        oFire: f.pFire,
        oActiveSlotIdx: f.pActiveSlotIdx,
        oActiveSlots: f.pActiveSlots,
        oStatuses: f.pStatuses,
        clashX: f.clashX,
        clashZ: f.clashZ,
        isCritical: f.isCritical,
        eventLabel: f.eventLabel,
        obstacles: f.obstacles
      }))
    };
  }
  return {
    arenaId: sim.arenaId,
    playerName: sim.player.name,
    opponentName: sim.opponent.name,
    playerColor: ELEMENTS[sim.player.element]?.primaryColor ?? "#38bdf8",
    opponentColor: ELEMENTS[sim.opponent.element]?.primaryColor ?? "#f43f5e",
    floorPalette: arena.floorPalette,
    arenaPrimaryColor: arena.primaryColor,
    arenaAccentColor: arena.accentColor,
    winnerSide: rawWinner,
    finishReason: sim.finishReason ?? "Survival",
    finalBlowTimeSec: lastFrame.t,
    frames: frames.map((f) => ({ ...f }))
  };
}
function finishBattle(sim, winner, reason) {
  const finishBanner = reason === "BurstFinish" ? "BURST FINISH!" : reason === "RingOut" ? "RING OUT!" : reason === "Knockout" ? "KNOCKOUT FINISH!" : reason === "SpinFinish" ? "SPIN FINISH!" : "TIME DECISION!";
  if (!sim.pendingHighlightMarker) {
    const loser = winner === "player" ? sim.opponent : sim.player;
    sim.pendingHighlightMarker = {
      clashX: loser.x,
      clashZ: loser.z,
      isCritical: true,
      eventLabel: finishBanner
    };
  }
  recordHighlightFrame(sim, finishBanner);
  recordAnalysisTimelinePoint(sim);
  sim.phase = "Finish";
  sim.winnerSide = winner;
  sim.finishReason = reason;
  sim.finishTimer = 0;
}
function buildBattleAnalysisReport(sim, perspective = "player") {
  const roundBreak = (b) => ({
    clash: Number(b.clash.toFixed(1)),
    hazard: Number(b.hazard.toFixed(1)),
    pillar: Number(b.pillar.toFixed(1)),
    ability: Number(b.ability.toFixed(1)),
    status: Number(b.status.toFixed(1))
  });
  const flipSide = perspective === "opponent";
  const flipSideName = (s) => flipSide ? s === "player" ? "opponent" : "player" : s;
  const highestMoment = sim.analysis.highestDamageMoment ? {
    ...sim.analysis.highestDamageMoment,
    actorSide: flipSideName(sim.analysis.highestDamageMoment.actorSide),
    victimSide: flipSideName(sim.analysis.highestDamageMoment.victimSide)
  } : null;
  const longestStreak = sim.analysis.longestClashStreak ? { ...sim.analysis.longestClashStreak } : null;
  const breaches = (sim.analysis.criticalThresholdBreaches ?? []).map((b) => ({
    ...b,
    side: flipSideName(b.side)
  }));
  const momentumSwing = sim.analysis.peakMomentumSwing ? {
    ...sim.analysis.peakMomentumSwing,
    leaderAfter: flipSideName(sim.analysis.peakMomentumSwing.leaderAfter)
  } : null;
  return {
    damageTakenByPlayer: roundBreak(
      flipSide ? sim.analysis.damageDealtByPlayer : sim.analysis.damageTakenByPlayer
    ),
    damageDealtByPlayer: roundBreak(
      flipSide ? sim.analysis.damageTakenByPlayer : sim.analysis.damageDealtByPlayer
    ),
    firstBrokenSide: sim.analysis.firstBrokenSide === null ? null : flipSideName(sim.analysis.firstBrokenSide),
    firstBrokenPart: sim.analysis.firstBrokenPart,
    firstBrokenTimeSec: sim.analysis.firstBrokenTimeSec,
    peakPlayerRpm: flipSide ? sim.analysis.peakOpponentRpm : sim.analysis.peakPlayerRpm,
    peakOpponentRpm: flipSide ? sim.analysis.peakPlayerRpm : sim.analysis.peakOpponentRpm,
    durationSec: Number(sim.elapsedTime.toFixed(2)),
    timeline: sim.analysis.timeline.map(
      (pt) => flipSide ? {
        timeSec: pt.timeSec,
        playerStaminaPct: pt.opponentStaminaPct,
        opponentStaminaPct: pt.playerStaminaPct,
        playerArmorPct: pt.opponentArmorPct,
        opponentArmorPct: pt.playerArmorPct
      } : { ...pt }
    ),
    highestDamageMoment: highestMoment,
    longestClashStreak: longestStreak,
    criticalThresholdBreaches: breaches,
    peakMomentumSwing: momentumSwing
  };
}
function stepBattleSimulation(sim, dt) {
  if (sim.hitstopTimer > 0 && (sim.phase === "Combat" || sim.phase === "Critical" || sim.phase === "Finish")) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
    return;
  }
  sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 1.6);
  sim.slowMotionTimer = Math.max(0, sim.slowMotionTimer - dt);
  if (sim.phase === "Launch") {
    sim.launchCountdown = Math.max(0, sim.launchCountdown - dt);
    if (sim.launchCountdown <= 0 && !sim.isOnlineRemote) {
      applyLaunchVelocities(
        sim,
        sim.launchSelection.powerRatio,
        sim.launchSelection.angleRad,
        void 0,
        { allowPerfect: false }
      );
      sim.events.push({
        type: "ability",
        x: sim.player.x,
        y: sim.player.y + 0.25,
        z: sim.player.z,
        intensity: 0.75,
        actorId: "player",
        label: "AUTO-LAUNCH ENGAGED!",
        colorHex: "#f59e0b"
      });
    }
    return;
  }
  if (sim.phase === "Finish") {
    sim.finishTimer += dt;
    for (const ent of [sim.player, sim.opponent]) {
      if (ent.ringedOut) {
        ent.x += ent.vx * dt * 0.65;
        ent.z += ent.vz * dt * 0.65;
        ent.vx *= Math.exp(-1.2 * dt);
        ent.vz *= Math.exp(-1.2 * dt);
      } else if (!ent.burstOut) {
        ent.spinAngle = (ent.spinAngle + ent.omega * dt) % (Math.PI * 200);
      }
    }
    const finishHoldSec = sim.finishReason === "BurstFinish" || sim.finishReason === "Knockout" ? 2.35 : sim.finishReason === "Survival" ? 0.95 : 1.35;
    if (sim.finishTimer >= finishHoldSec) {
      sim.phase = "Results";
    }
    return;
  }
  if (sim.phase !== "Combat" && sim.phase !== "Critical") return;
  if (sim.highlightFrames.length === 0) {
    recordHighlightFrame(sim);
  }
  if (sim.analysis.timeline.length === 0) {
    recordAnalysisTimelinePoint(sim);
  }
  sim.elapsedTime += dt;
  sim.teamSwitchCooldown = Math.max(0, sim.teamSwitchCooldown - dt);
  if (!sim.isOnlineRemote && !sim.disableAi) {
    sim.aiDecisionTimer -= dt;
    if (sim.aiDecisionTimer <= 0) {
      aiThink(sim);
      sim.aiDecisionTimer = sim.aiDifficulty === "Easy" ? 0.85 : sim.aiDifficulty === "Normal" ? 0.55 : sim.aiDifficulty === "Hard" ? 0.38 : 0.28;
    }
    checkBossPhaseTransitions(sim);
  }
  stepEntityKinematics(sim.player, sim.opponent, dt, sim);
  stepEntityKinematics(sim.opponent, sim.player, dt, sim);
  resolveTopCollision(sim);
  checkCriticalThresholdBreaches(sim);
  sim.analysis.peakPlayerRpm = Math.max(
    sim.analysis.peakPlayerRpm,
    Math.round(sim.player.omega * 9.55)
  );
  sim.analysis.peakOpponentRpm = Math.max(
    sim.analysis.peakOpponentRpm,
    Math.round(sim.opponent.omega * 9.55)
  );
  sim.analysisTimelineAccum += dt;
  if (sim.analysisTimelineAccum >= 0.5) {
    sim.analysisTimelineAccum = 0;
    recordAnalysisTimelinePoint(sim);
  }
  if (sim.isOnlineRemote) {
    sim.player.ringedOut = false;
    sim.player.burstOut = false;
    sim.player.knockedOut = false;
    sim.opponent.ringedOut = false;
    sim.opponent.burstOut = false;
    sim.opponent.knockedOut = false;
    return;
  }
  evaluateVictoryConditions(sim);
  if (sim.phase === "Combat" || sim.phase === "Critical") {
    sim.highlightSampleAccum += dt;
    if (sim.highlightSampleAccum >= 0.04 || sim.pendingHighlightMarker) {
      sim.highlightSampleAccum = 0;
      recordHighlightFrame(sim);
    }
  }
}
function serializeAuthEntity(e) {
  return {
    x: Number(e.x.toFixed(4)),
    z: Number(e.z.toFixed(4)),
    vx: Number(e.vx.toFixed(4)),
    vz: Number(e.vz.toFixed(4)),
    omega: Number(e.omega.toFixed(3)),
    spinAngle: Number(e.spinAngle.toFixed(3)),
    staminaRatio: Number(e.staminaRatio.toFixed(4)),
    durability: Number(e.durability.toFixed(3)),
    stability: Number(e.stability.toFixed(2)),
    energy: Number(e.energy.toFixed(2)),
    resonance: Number(e.resonance.toFixed(2)),
    partDurability: { ...e.partDurability },
    brokenParts: [...e.brokenParts],
    statuses: e.statuses.map((s) => ({ ...s })),
    statDebuffs: e.statDebuffs.map((d) => ({ ...d })),
    abilityCooldowns: [
      Number((e.abilitySlots[0]?.cooldownRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[1]?.cooldownRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[2]?.cooldownRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[3]?.cooldownRemaining ?? 0).toFixed(2))
    ],
    abilityActive: [
      Number((e.abilitySlots[0]?.activeRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[1]?.activeRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[2]?.activeRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[3]?.activeRemaining ?? 0).toFixed(2))
    ],
    ringedOut: e.ringedOut,
    burstOut: e.burstOut,
    knockedOut: e.knockedOut
  };
}
function extractAuthoritativeSnapshot(sim, seq, tickEvents, recipientRole) {
  const isHost = recipientRole === "host";
  const mappedEvents = isHost ? tickEvents : tickEvents.map((ev) => ({
    ...ev,
    actorId: ev.actorId === "player" ? "opponent" : ev.actorId === "opponent" ? "player" : void 0
  }));
  return {
    seq,
    elapsedTime: Number(sim.elapsedTime.toFixed(3)),
    phase: sim.phase,
    hitstopTimer: Number(sim.hitstopTimer.toFixed(3)),
    slowMotionTimer: Number(sim.slowMotionTimer.toFixed(3)),
    cameraTrauma: Number(sim.cameraTrauma.toFixed(3)),
    collisionCount: sim.collisionCount,
    maxImpactImpulse: Number(sim.maxImpactImpulse.toFixed(3)),
    perfectLaunch: isHost ? sim.perfectLaunch : sim.opponentPerfectLaunch,
    opponentPerfectLaunch: isHost ? sim.opponentPerfectLaunch : sim.perfectLaunch,
    p: serializeAuthEntity(isHost ? sim.player : sim.opponent),
    o: serializeAuthEntity(isHost ? sim.opponent : sim.player),
    events: mappedEvents
  };
}

// src/server/pvpRooms.ts
var VALID_TOP_IDS = new Set(TOP_DEFINITIONS.map((t) => t.id));
var VALID_COMPONENT_IDS = new Set(COMPONENTS.map((c) => c.id));
var VALID_ABILITY_IDS = new Set(ABILITIES.map((a) => a.id));
var VALID_ELEMENT_IDS = new Set(Object.keys(ELEMENTS));
var VALID_ARENA_IDS = new Set(Object.keys(ARENAS));
var VALID_EVO_PATHS = new Map(EVOLUTION_PATHS.map((e) => [e.id, e]));
function sanitizeArenaId(raw) {
  return typeof raw === "string" && VALID_ARENA_IDS.has(raw) ? raw : "standard";
}
function validateAndResolveOnlineBuild(raw, playerId) {
  const b = raw && typeof raw === "object" ? raw : {};
  const cloudSave = getCloudSaveForCommander(playerId);
  let topDefId = typeof b.topDefinitionId === "string" && VALID_TOP_IDS.has(b.topDefinitionId) ? b.topDefinitionId : "top.ignis.drake";
  if (cloudSave) {
    const ownsRequested = cloudSave.unlockedTopIds.includes(topDefId) || cloudSave.ownedTops.some((t) => t.definitionId === topDefId);
    if (!ownsRequested && cloudSave.ownedTops.length > 0) {
      topDefId = cloudSave.ownedTops[0].definitionId;
    }
  } else {
    const def = getTopDefinition(topDefId);
    if (def.isBoss || def.rarity === "Mythic") {
      topDefId = "top.ignis.drake";
    }
  }
  const topDef = getTopDefinition(topDefId);
  const ownedInstance = cloudSave?.ownedTops.find((t) => t.definitionId === topDefId);
  const compRaw = b.equippedComponents && typeof b.equippedComponents === "object" ? b.equippedComponents : {};
  const equippedComponents = { ...topDef.defaultComponents };
  for (const cat of COMPONENT_CATEGORIES) {
    const rawCandidate = compRaw[cat.id];
    const candidate = typeof rawCandidate === "string" ? rawCandidate : "";
    const compDef = COMPONENTS.find((c) => c.id === candidate);
    if (compDef && compDef.category === cat.id && VALID_COMPONENT_IDS.has(candidate)) {
      if (!cloudSave || cloudSave.unlockedComponentIds.includes(candidate)) {
        equippedComponents[cat.id] = candidate;
      }
    }
  }
  const compCheck = validateTopConfiguration(equippedComponents);
  const finalComponents = compCheck.valid ? equippedComponents : { ...topDef.defaultComponents };
  const abRaw = Array.isArray(b.equippedAbilities) ? b.equippedAbilities : [];
  const equippedAbilities = [
    typeof abRaw[0] === "string" && VALID_ABILITY_IDS.has(abRaw[0]) ? abRaw[0] : topDef.defaultAbilities[0],
    typeof abRaw[1] === "string" && VALID_ABILITY_IDS.has(abRaw[1]) ? abRaw[1] : topDef.defaultAbilities[1],
    typeof abRaw[2] === "string" && VALID_ABILITY_IDS.has(abRaw[2]) ? abRaw[2] : topDef.defaultAbilities[2],
    typeof abRaw[3] === "string" && VALID_ABILITY_IDS.has(abRaw[3]) ? abRaw[3] : topDef.defaultAbilities[3]
  ];
  const reqLevel = Number.isFinite(Number(b.level)) ? Math.max(1, Math.round(Number(b.level))) : 1;
  const maxAllowedLevel = ownedInstance ? ownedInstance.level : cloudSave ? 10 : 5;
  const level = Math.min(50, Math.min(maxAllowedLevel, reqLevel));
  const reqEvo = Number(b.evolutionStage) === 1 ? 1 : 0;
  const evolutionStage = ownedInstance ? Math.min(ownedInstance.evolutionStage, reqEvo) : 0;
  const reqPathId = typeof b.evolutionPathId === "string" ? b.evolutionPathId : null;
  const evolutionPathId = evolutionStage === 1 && reqPathId && VALID_EVO_PATHS.has(reqPathId) ? reqPathId : evolutionStage === 1 ? ownedInstance?.evolutionPathId ?? null : null;
  const secondaryElement = typeof b.secondaryElement === "string" && VALID_ELEMENT_IDS.has(b.secondaryElement) ? b.secondaryElement : null;
  const rawCosmetics = b.cosmetics && typeof b.cosmetics === "object" ? b.cosmetics : null;
  const hexOk = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
  const validPatterns = /* @__PURE__ */ new Set(["solid", "striped", "circuit", "apex"]);
  const cosmetics = rawCosmetics && hexOk(rawCosmetics.primaryColor) && hexOk(rawCosmetics.trimColor) && hexOk(rawCosmetics.trailColor) ? {
    primaryColor: hexOk(rawCosmetics.primaryColor),
    trimColor: hexOk(rawCosmetics.trimColor),
    trailColor: hexOk(rawCosmetics.trailColor),
    pattern: typeof rawCosmetics.pattern === "string" && validPatterns.has(rawCosmetics.pattern) ? rawCosmetics.pattern : "solid"
  } : ownedInstance?.cosmetics;
  return {
    build: {
      topDefinitionId: topDefId,
      level,
      secondaryElement,
      equippedComponents: finalComponents,
      equippedAbilities,
      evolutionStage,
      evolutionPathId,
      cosmetics
    },
    upgradeLevels: cloudSave?.componentUpgradeLevels ?? {},
    characterStats: cloudSave?.character?.stats,
    capacitorLevel: cloudSave?.capacitorLevel ?? 0
  };
}
function toTopSimConfig(entityId, handle, resolved) {
  const { build, upgradeLevels, characterStats, capacitorLevel } = resolved;
  const topDef = getTopDefinition(build.topDefinitionId);
  const attributes = calculateAttributes(
    build.topDefinitionId,
    build.equippedComponents,
    upgradeLevels,
    build.level,
    build.evolutionPathId,
    characterStats,
    build.secondaryElement
  );
  const physical = calculatePhysicalProfile(
    build.topDefinitionId,
    build.equippedComponents,
    upgradeLevels,
    build.level,
    build.evolutionPathId,
    characterStats,
    build.secondaryElement,
    capacitorLevel
  );
  return {
    entityId,
    name: handle,
    element: topDef.element,
    secondaryElement: build.secondaryElement,
    attributes,
    physical,
    abilities: build.equippedAbilities,
    initialMode: "Stamina",
    initialCommand: "HoldPosition",
    evolutionStage: build.evolutionStage
  };
}
var RECONNECT_GRACE_MS = 15e3;
var HEARTBEAT_INTERVAL_MS = 25e3;
var IDLE_ROOM_TTL_MS = 15 * 6e4;
var MAX_SPECTATORS_PER_ROOM = 6;
var rooms = /* @__PURE__ */ new Map();
var friendlyQueue = [];
var rankedQueue = [];
var socketIdentity = /* @__PURE__ */ new WeakMap();
var aliveSockets = /* @__PURE__ */ new WeakMap();
var allActiveSockets = /* @__PURE__ */ new Set();
function sendJson(ws, msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}
function broadcastRoom(room, msg) {
  for (const m of room.members) {
    if (m.connected && m.ws) {
      sendJson(m.ws, msg);
    }
  }
  for (const s of room.spectators) {
    sendJson(s.ws, msg);
  }
}
function serializeRoom(room) {
  return {
    roomId: room.roomId,
    code: room.code,
    mode: room.mode,
    arenaId: room.arenaId,
    mutators: room.mutators,
    hostPlayerId: room.hostPlayerId,
    phase: room.phase,
    spectatorCount: room.spectators.length,
    spectators: room.spectators.map((s) => ({
      playerId: s.playerId,
      handle: s.handle
    })),
    members: room.members.map((m) => ({
      playerId: m.playerId,
      handle: m.handle,
      mmr: m.mmr,
      ready: m.ready,
      connected: m.connected,
      build: m.resolvedBuild.build,
      appearance: getCommanderById(m.playerId)?.appearance,
      launchLocked: m.launchPower !== null
    }))
  };
}
function generateRoomCode() {
  return String(crypto2.randomInt(1e5, 1e6));
}
function removeFromQueues(playerId) {
  for (let i = friendlyQueue.length - 1; i >= 0; i--) {
    if (friendlyQueue[i].playerId === playerId) friendlyQueue.splice(i, 1);
  }
  for (let i = rankedQueue.length - 1; i >= 0; i--) {
    if (rankedQueue[i].playerId === playerId) rankedQueue.splice(i, 1);
  }
}
function clearRoomTimers(room) {
  if (room.launchTimer) {
    clearTimeout(room.launchTimer);
    room.launchTimer = null;
  }
  if (room.simInterval) {
    clearInterval(room.simInterval);
    room.simInterval = null;
  }
  if (room.reconnectTimer) {
    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = null;
  }
}
function finalizeMatchFromRoom(room, winnerId, finishReason) {
  if (room.phase === "Finished") return;
  room.phase = "Finished";
  clearRoomTimers(room);
  const p1 = room.members[0];
  const p2 = room.members[1];
  let mmrDelta = 0;
  const updatedCommanders = [];
  const hostClip = room.sim ? buildMatchHighlightClip(room.sim, "player") : void 0;
  const guestClip = room.sim ? buildMatchHighlightClip(room.sim, "opponent") : void 0;
  const hostAnalysis = room.sim ? buildBattleAnalysisReport(room.sim, "player") : void 0;
  const guestAnalysis = room.sim ? buildBattleAnalysisReport(room.sim, "opponent") : void 0;
  const durationSec = room.sim?.elapsedTime ?? 0;
  if (p1 && p2) {
    const res = recordOnlineMatchResult({
      matchId: `${room.roomId}-${room.createdAtMs}`,
      roomCode: room.code,
      mode: room.mode,
      arenaId: room.arenaId,
      p1Id: p1.playerId,
      p2Id: p2.playerId,
      winnerId,
      finishReason,
      durationSec,
      highlightSummaryJson: hostClip ? JSON.stringify({
        winnerSide: hostClip.winnerSide,
        finishReason: hostClip.finishReason,
        finalBlowTimeSec: hostClip.finalBlowTimeSec,
        frameCount: hostClip.frames.length
      }) : null
    });
    mmrDelta = res.mmrDelta;
    const c1 = getCommanderById(p1.playerId);
    const c2 = getCommanderById(p2.playerId);
    if (c1) updatedCommanders.push(sanitizeCommanderPublic(c1));
    if (c2) updatedCommanders.push(sanitizeCommanderPublic(c2));
  }
  for (const m of room.members) {
    if (!m.connected || !m.ws) continue;
    const isHost = m.playerId === room.hostPlayerId;
    sendJson(m.ws, {
      type: "match_finalized",
      roomId: room.roomId,
      winnerId,
      finishReason,
      mmrDelta,
      commanders: updatedCommanders,
      highlights: isHost ? hostClip : guestClip,
      analysis: isHost ? hostAnalysis : guestAnalysis
    });
  }
  for (const s of room.spectators) {
    sendJson(s.ws, {
      type: "match_finalized",
      roomId: room.roomId,
      winnerId,
      finishReason,
      mmrDelta,
      commanders: updatedCommanders,
      highlights: hostClip,
      analysis: hostAnalysis,
      asSpectator: true
    });
  }
}
function handleDisconnectFromRoom(ws) {
  const idInfo = socketIdentity.get(ws);
  if (!idInfo) return;
  removeFromQueues(idInfo.playerId);
  if (!idInfo.roomId) return;
  const room = rooms.get(idInfo.roomId);
  idInfo.roomId = null;
  if (!room) return;
  if (idInfo.isSpectator) {
    idInfo.isSpectator = false;
    room.spectators = room.spectators.filter((s) => s.ws !== ws && s.playerId !== idInfo.playerId);
    broadcastRoom(room, { type: "room_update", room: serializeRoom(room) });
    return;
  }
  const member = room.members.find((m) => m.playerId === idInfo.playerId);
  if (!member) return;
  if (member.ws && member.ws !== ws) return;
  member.ws = null;
  member.connected = false;
  member.disconnectedAtMs = Date.now();
  if (room.phase === "Launch" || room.phase === "Combat") {
    const other = room.members.find((m) => m.playerId !== member.playerId && m.connected);
    if (!other) {
      clearRoomTimers(room);
      room.phase = "Finished";
      rooms.delete(room.roomId);
      return;
    }
    room.reconnectGraceTargetId = member.playerId;
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
    sendJson(other.ws, {
      type: "opponent_reconnecting",
      roomId: room.roomId,
      disconnectedPlayerId: member.playerId,
      graceSec: Math.round(RECONNECT_GRACE_MS / 1e3)
    });
    room.reconnectTimer = setTimeout(() => {
      if (room.phase !== "Launch" && room.phase !== "Combat") return;
      const stillDisconnected = room.members.find(
        (m) => m.playerId === member.playerId && !m.connected
      );
      if (stillDisconnected) {
        const remaining = room.members.find((m) => m.playerId !== member.playerId);
        if (remaining) {
          finalizeMatchFromRoom(room, remaining.playerId, "Survival");
          sendJson(remaining.ws, {
            type: "opponent_disconnected",
            roomId: room.roomId,
            remainingWinnerId: remaining.playerId
          });
        }
      }
    }, RECONNECT_GRACE_MS);
    return;
  }
  room.members = room.members.filter((m) => m.playerId !== idInfo.playerId);
  if (room.members.length === 0) {
    clearRoomTimers(room);
    rooms.delete(room.roomId);
    return;
  }
  room.hostPlayerId = room.members[0].playerId;
  broadcastRoom(room, { type: "room_update", room: serializeRoom(room) });
}
function explicitLeaveRoom(ws) {
  const idInfo = socketIdentity.get(ws);
  if (!idInfo) return;
  removeFromQueues(idInfo.playerId);
  if (!idInfo.roomId) return;
  const room = rooms.get(idInfo.roomId);
  idInfo.roomId = null;
  if (!room) return;
  if (idInfo.isSpectator) {
    idInfo.isSpectator = false;
    room.spectators = room.spectators.filter((s) => s.ws !== ws && s.playerId !== idInfo.playerId);
    broadcastRoom(room, { type: "room_update", room: serializeRoom(room) });
    return;
  }
  const leaving = room.members.find((m) => m.playerId === idInfo.playerId);
  if (leaving) {
    leaving.ws = null;
    leaving.connected = false;
  }
  if (room.phase === "Launch" || room.phase === "Combat") {
    const remaining = room.members.find((m) => m.playerId !== idInfo.playerId && m.connected);
    if (remaining) {
      finalizeMatchFromRoom(room, remaining.playerId, "Survival");
      sendJson(remaining.ws, {
        type: "opponent_disconnected",
        roomId: room.roomId,
        remainingWinnerId: remaining.playerId
      });
    } else {
      clearRoomTimers(room);
      rooms.delete(room.roomId);
    }
    return;
  }
  room.members = room.members.filter((m) => m.playerId !== idInfo.playerId);
  if (room.members.length === 0) {
    clearRoomTimers(room);
    rooms.delete(room.roomId);
    return;
  }
  room.hostPlayerId = room.members[0].playerId;
  broadcastRoom(room, { type: "room_update", room: serializeRoom(room) });
}
function startSynchronizedLaunch(room) {
  if (room.members.length < 2) return;
  clearRoomTimers(room);
  room.phase = "Launch";
  const hostMember = room.members.find((m) => m.playerId === room.hostPlayerId) ?? room.members[0];
  const guestMember = room.members.find((m) => m.playerId !== hostMember.playerId) ?? room.members[1];
  const hostDef = clampLaunchAngleToSide(
    PLAYER_LAUNCH_SPAWN.x,
    PLAYER_LAUNCH_SPAWN.z,
    0,
    0,
    "right"
  );
  hostMember.launchPower = null;
  hostMember.launchAngle = null;
  hostMember.launchTargetX = hostDef.targetX;
  hostMember.launchTargetZ = hostDef.targetZ;
  hostMember.launchPerfect = false;
  const guestDef = clampLaunchAngleToSide(
    OPPONENT_LAUNCH_SPAWN.x,
    OPPONENT_LAUNCH_SPAWN.z,
    0,
    0,
    "left"
  );
  guestMember.launchPower = null;
  guestMember.launchAngle = null;
  guestMember.launchTargetX = guestDef.targetX;
  guestMember.launchTargetZ = guestDef.targetZ;
  guestMember.launchPerfect = false;
  broadcastRoom(room, {
    type: "launch_phase_start",
    roomId: room.roomId,
    arenaId: room.arenaId,
    countdownSec: 5,
    room: serializeRoom(room)
  });
  room.launchTimer = setTimeout(() => {
    finalizeSynchronizedLaunch(room);
  }, 5100);
}
function finalizeSynchronizedLaunch(room) {
  if (room.phase !== "Launch") return;
  if (room.launchTimer) {
    clearTimeout(room.launchTimer);
    room.launchTimer = null;
  }
  const hostMember = room.members.find((m) => m.playerId === room.hostPlayerId) ?? room.members[0];
  const guestMember = room.members.find((m) => m.playerId !== hostMember.playerId) ?? room.members[1];
  if (!hostMember || !guestMember) return;
  room.phase = "Combat";
  const hostDefault = clampLaunchAngleToSide(
    PLAYER_LAUNCH_SPAWN.x,
    PLAYER_LAUNCH_SPAWN.z,
    hostMember.launchTargetX,
    hostMember.launchTargetZ,
    "right"
  );
  const hostLaunch = {
    playerId: hostMember.playerId,
    powerRatio: hostMember.launchPower ?? 0.74,
    angleRad: hostMember.launchAngle ?? hostDefault.angleRad,
    targetX: hostMember.launchTargetX,
    targetZ: hostMember.launchTargetZ,
    perfect: Boolean(hostMember.launchPerfect)
  };
  const guestDefault = clampLaunchAngleToSide(
    OPPONENT_LAUNCH_SPAWN.x,
    OPPONENT_LAUNCH_SPAWN.z,
    guestMember.launchTargetX,
    guestMember.launchTargetZ,
    "left"
  );
  const guestLaunch = {
    playerId: guestMember.playerId,
    powerRatio: guestMember.launchPower ?? 0.74,
    angleRad: guestMember.launchAngle ?? guestDefault.angleRad,
    targetX: guestMember.launchTargetX,
    targetZ: guestMember.launchTargetZ,
    perfect: Boolean(guestMember.launchPerfect)
  };
  const sim = createBattleSimulation({
    battleId: `pvp-${room.roomId}-${room.createdAtMs}`,
    arenaId: room.arenaId,
    playerConfig: toTopSimConfig("player", hostMember.handle, hostMember.resolvedBuild),
    opponentConfig: toTopSimConfig("opponent", guestMember.handle, guestMember.resolvedBuild),
    aiPersonality: "Adaptive",
    aiDifficulty: "Normal",
    startInPhase: "Launch",
    debugMode: false,
    isOnlineRemote: false,
    disableAi: true,
    launchHandedness: "right",
    playerSpawn: PLAYER_LAUNCH_SPAWN,
    opponentSpawn: OPPONENT_LAUNCH_SPAWN,
    mutators: room.mutators
  });
  applyLaunchVelocities(
    sim,
    hostLaunch.powerRatio,
    hostLaunch.angleRad,
    {
      powerRatio: guestLaunch.powerRatio,
      angleRad: guestLaunch.angleRad
    },
    {
      allowPerfect: Boolean(hostMember.launchPerfect),
      opponentPerfect: Boolean(guestMember.launchPerfect)
    }
  );
  room.sim = sim;
  room.tickCount = 0;
  room.lastSnapshotTick = 0;
  room.lastLaunches = [hostLaunch, guestLaunch];
  broadcastRoom(room, {
    type: "battle_start",
    roomId: room.roomId,
    arenaId: room.arenaId,
    mode: room.mode,
    launches: [hostLaunch, guestLaunch],
    room: serializeRoom(room)
  });
  room.simInterval = setInterval(() => {
    stepAuthoritativeRoomTick(room);
  }, 20);
}
function stepAuthoritativeRoomTick(room) {
  const sim = room.sim;
  if (!sim || room.phase !== "Combat") return;
  const prevEventLen = sim.events.length;
  stepBattleSimulation(sim, FIXED_DT);
  room.tickCount += 1;
  const newEvents = sim.events.slice(prevEventLen);
  if (sim.events.length > 200) {
    sim.events.splice(0, sim.events.length - 100);
  }
  if (sim.phase === "Finish" || sim.phase === "Results") {
    const winnerMember = sim.winnerSide === "player" ? room.members.find((m) => m.playerId === room.hostPlayerId) ?? room.members[0] : room.members.find((m) => m.playerId !== room.hostPlayerId) ?? room.members[1];
    const finishReason = sim.finishReason ?? "SpinFinish";
    broadcastSnapshots(room, newEvents);
    finalizeMatchFromRoom(room, winnerMember.playerId, finishReason);
    return;
  }
  if (newEvents.length > 0 || room.tickCount - room.lastSnapshotTick >= 2) {
    room.lastSnapshotTick = room.tickCount;
    broadcastSnapshots(room, newEvents);
  }
}
function broadcastSnapshots(room, events) {
  const sim = room.sim;
  if (!sim) return;
  for (const m of room.members) {
    if (!m.connected || !m.ws) continue;
    const role = m.playerId === room.hostPlayerId ? "host" : "guest";
    const snapshot = extractAuthoritativeSnapshot(sim, room.tickCount, events, role);
    sendJson(m.ws, {
      type: "server_snapshot",
      roomId: room.roomId,
      snapshot
    });
  }
  if (room.spectators.length > 0) {
    const spectatorSnapshot = extractAuthoritativeSnapshot(sim, room.tickCount, events, "host");
    for (const s of room.spectators) {
      sendJson(s.ws, {
        type: "server_snapshot",
        roomId: room.roomId,
        snapshot: spectatorSnapshot
      });
    }
  }
}
function tryMatchQueue(mode) {
  const q = mode === "OnlineRanked" ? rankedQueue : friendlyQueue;
  while (q.length >= 2) {
    const p1 = q.shift();
    const p2 = q.shift();
    if (p1.playerId === p2.playerId) continue;
    if (p1.ws.readyState !== 1) {
      q.unshift(p2);
      continue;
    }
    if (p2.ws.readyState !== 1) {
      q.unshift(p1);
      continue;
    }
    const c1 = getCommanderById(p1.playerId);
    const c2 = getCommanderById(p2.playerId);
    if (!c1 || !c2) continue;
    const roomId = `room-${crypto2.randomUUID().slice(0, 8)}`;
    const room = {
      roomId,
      code: generateRoomCode(),
      mode,
      arenaId: p1.arenaId,
      mutators: { ...DEFAULT_BATTLE_MUTATORS },
      hostPlayerId: p1.playerId,
      phase: "Lobby",
      launchTimer: null,
      simInterval: null,
      reconnectTimer: null,
      reconnectGraceTargetId: null,
      sim: null,
      tickCount: 0,
      lastSnapshotTick: 0,
      members: [
        {
          playerId: p1.playerId,
          handle: c1.handle,
          mmr: c1.mmr,
          ws: p1.ws,
          connected: true,
          disconnectedAtMs: null,
          resolvedBuild: p1.resolvedBuild,
          ready: true,
          launchPower: null,
          launchAngle: null,
          launchTargetX: 0,
          launchTargetZ: 0,
          launchPerfect: false,
          lastAbilityAtMs: 0
        },
        {
          playerId: p2.playerId,
          handle: c2.handle,
          mmr: c2.mmr,
          ws: p2.ws,
          connected: true,
          disconnectedAtMs: null,
          resolvedBuild: p2.resolvedBuild,
          ready: true,
          launchPower: null,
          launchAngle: null,
          launchTargetX: 0,
          launchTargetZ: 0,
          launchPerfect: false,
          lastAbilityAtMs: 0
        }
      ],
      spectators: [],
      createdAtMs: Date.now()
    };
    rooms.set(roomId, room);
    socketIdentity.set(p1.ws, { playerId: p1.playerId, roomId });
    socketIdentity.set(p2.ws, { playerId: p2.playerId, roomId });
    broadcastRoom(room, { type: "match_found", room: serializeRoom(room) });
    startSynchronizedLaunch(room);
  }
}
var maintenanceInterval = null;
function ensureMaintenanceTimer() {
  if (maintenanceInterval) return;
  maintenanceInterval = setInterval(() => {
    for (const ws of allActiveSockets) {
      if (ws.readyState !== 1) {
        allActiveSockets.delete(ws);
        continue;
      }
      if (aliveSockets.get(ws) === false) {
        allActiveSockets.delete(ws);
        try {
          ws.terminate();
        } catch {
        }
        continue;
      }
      aliveSockets.set(ws, false);
      try {
        ws.ping();
      } catch {
      }
    }
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      if (room.phase === "Lobby" && now - room.createdAtMs > IDLE_ROOM_TTL_MS || room.phase === "Finished" && now - room.createdAtMs > IDLE_ROOM_TTL_MS) {
        clearRoomTimers(room);
        rooms.delete(roomId);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
  maintenanceInterval.unref();
}
function shutdownPvpRooms() {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
  for (const room of rooms.values()) {
    clearRoomTimers(room);
  }
  rooms.clear();
  friendlyQueue.length = 0;
  rankedQueue.length = 0;
  for (const ws of allActiveSockets) {
    try {
      ws.close(1001, "Server shutting down");
    } catch {
    }
  }
  allActiveSockets.clear();
}
function handlePvpWebSocketConnection(ws) {
  ensureMaintenanceTimer();
  allActiveSockets.add(ws);
  aliveSockets.set(ws, true);
  ws.on("pong", () => {
    aliveSockets.set(ws, true);
  });
  ws.on("message", (raw) => {
    aliveSockets.set(ws, true);
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      sendJson(ws, { type: "error", message: "Invalid message JSON" });
      return;
    }
    const msgType = typeof msg.type === "string" ? msg.type : "";
    if (msgType === "ping") {
      sendJson(ws, { type: "pong", ts: Number(msg.ts) || Date.now() });
      return;
    }
    if (msgType === "auth") {
      const token = typeof msg.token === "string" ? msg.token : "";
      const playerId = verifySessionToken(token);
      const commander2 = playerId ? getCommanderById(playerId) : null;
      if (!playerId || !commander2) {
        sendJson(ws, { type: "auth_error", message: "Invalid or expired session token." });
        return;
      }
      let reattachedRoomId = null;
      for (const room2 of rooms.values()) {
        if (room2.phase !== "Launch" && room2.phase !== "Combat") continue;
        const member2 = room2.members.find((m) => m.playerId === playerId);
        if (member2) {
          member2.ws = ws;
          member2.connected = true;
          member2.disconnectedAtMs = null;
          reattachedRoomId = room2.roomId;
          if (room2.reconnectGraceTargetId === playerId && room2.reconnectTimer) {
            clearTimeout(room2.reconnectTimer);
            room2.reconnectTimer = null;
            room2.reconnectGraceTargetId = null;
          }
          break;
        }
      }
      socketIdentity.set(ws, { playerId, roomId: reattachedRoomId });
      sendJson(ws, {
        type: "auth_ok",
        commander: sanitizeCommanderPublic(commander2)
      });
      if (reattachedRoomId) {
        const room2 = rooms.get(reattachedRoomId);
        if (room2) {
          broadcastRoom(room2, { type: "room_rejoined", room: serializeRoom(room2) });
          if (room2.sim && room2.phase === "Combat") {
            const role = playerId === room2.hostPlayerId ? "host" : "guest";
            sendJson(ws, {
              type: "server_snapshot",
              roomId: room2.roomId,
              snapshot: extractAuthoritativeSnapshot(room2.sim, room2.tickCount, [], role)
            });
          }
        }
      }
      return;
    }
    const identity = socketIdentity.get(ws);
    if (!identity) {
      sendJson(ws, { type: "auth_error", message: "Authenticate first." });
      return;
    }
    const commander = getCommanderById(identity.playerId);
    if (!commander) return;
    if (msgType === "queue_join") {
      explicitLeaveRoom(ws);
      const mode = msg.mode === "OnlineRanked" ? "OnlineRanked" : "OnlineFriendly";
      const arenaId = sanitizeArenaId(msg.arenaId);
      const resolvedBuild = validateAndResolveOnlineBuild(msg.build, identity.playerId);
      const targetQ = mode === "OnlineRanked" ? rankedQueue : friendlyQueue;
      targetQ.push({ playerId: identity.playerId, ws, arenaId, resolvedBuild });
      sendJson(ws, { type: "queue_waiting", mode, position: targetQ.length });
      tryMatchQueue(mode);
      return;
    }
    if (msgType === "queue_leave") {
      removeFromQueues(identity.playerId);
      sendJson(ws, { type: "queue_left" });
      return;
    }
    if (msgType === "create_room") {
      explicitLeaveRoom(ws);
      const mode = msg.mode === "OnlineRanked" ? "OnlineRanked" : "OnlineFriendly";
      const arenaId = sanitizeArenaId(msg.arenaId);
      const mutators = mode === "OnlineFriendly" ? sanitizeBattleMutators(msg.mutators) : { ...DEFAULT_BATTLE_MUTATORS };
      const resolvedBuild = validateAndResolveOnlineBuild(msg.build, identity.playerId);
      const roomId = `room-${crypto2.randomUUID().slice(0, 8)}`;
      const room2 = {
        roomId,
        code: generateRoomCode(),
        mode,
        arenaId,
        mutators,
        hostPlayerId: identity.playerId,
        phase: "Lobby",
        launchTimer: null,
        simInterval: null,
        reconnectTimer: null,
        reconnectGraceTargetId: null,
        sim: null,
        tickCount: 0,
        lastSnapshotTick: 0,
        members: [
          {
            playerId: identity.playerId,
            handle: commander.handle,
            mmr: commander.mmr,
            ws,
            connected: true,
            disconnectedAtMs: null,
            resolvedBuild,
            ready: true,
            launchPower: null,
            launchAngle: null,
            launchTargetX: 0,
            launchTargetZ: 0,
            launchPerfect: false,
            lastAbilityAtMs: 0
          }
        ],
        spectators: [],
        createdAtMs: Date.now()
      };
      rooms.set(roomId, room2);
      identity.roomId = roomId;
      identity.isSpectator = false;
      sendJson(ws, { type: "room_joined", room: serializeRoom(room2) });
      return;
    }
    if (msgType === "join_room") {
      const code = typeof msg.code === "string" ? msg.code.trim() : "";
      const asSpectator = Boolean(msg.asSpectator);
      if (asSpectator) {
        const targetRoom2 = Array.from(rooms.values()).find(
          (r) => r.code === code && r.mode === "OnlineFriendly" && r.phase !== "Finished"
        );
        if (!targetRoom2) {
          sendJson(ws, {
            type: "error",
            message: "Friendly room not found or already finished for spectating."
          });
          return;
        }
        if (targetRoom2.members.some((m) => m.playerId === identity.playerId)) {
          sendJson(ws, {
            type: "error",
            message: "You are already a combatant in this room."
          });
          return;
        }
        if (targetRoom2.spectators.length >= MAX_SPECTATORS_PER_ROOM) {
          sendJson(ws, {
            type: "error",
            message: "Spectator capacity reached for this room."
          });
          return;
        }
        explicitLeaveRoom(ws);
        targetRoom2.spectators = targetRoom2.spectators.filter(
          (s) => s.playerId !== identity.playerId
        );
        targetRoom2.spectators.push({
          playerId: identity.playerId,
          handle: commander.handle,
          ws,
          joinedAtMs: Date.now()
        });
        identity.roomId = targetRoom2.roomId;
        identity.isSpectator = true;
        sendJson(ws, {
          type: "room_joined",
          room: serializeRoom(targetRoom2),
          asSpectator: true
        });
        broadcastRoom(targetRoom2, {
          type: "room_update",
          room: serializeRoom(targetRoom2)
        });
        if (targetRoom2.phase === "Launch") {
          sendJson(ws, {
            type: "launch_phase_start",
            roomId: targetRoom2.roomId,
            arenaId: targetRoom2.arenaId,
            countdownSec: 5,
            room: serializeRoom(targetRoom2),
            asSpectator: true
          });
        } else if (targetRoom2.phase === "Combat" && targetRoom2.sim) {
          sendJson(ws, {
            type: "battle_start",
            roomId: targetRoom2.roomId,
            arenaId: targetRoom2.arenaId,
            mode: targetRoom2.mode,
            launches: targetRoom2.lastLaunches ?? [],
            room: serializeRoom(targetRoom2),
            asSpectator: true
          });
          sendJson(ws, {
            type: "server_snapshot",
            roomId: targetRoom2.roomId,
            snapshot: extractAuthoritativeSnapshot(
              targetRoom2.sim,
              targetRoom2.tickCount,
              [],
              "host"
            )
          });
        }
        return;
      }
      const targetRoom = Array.from(rooms.values()).find(
        (r) => r.code === code && r.phase === "Lobby" && r.members.length < 2
      );
      if (!targetRoom) {
        sendJson(ws, { type: "error", message: "Room code not found or room already full." });
        return;
      }
      explicitLeaveRoom(ws);
      const resolvedBuild = validateAndResolveOnlineBuild(msg.build, identity.playerId);
      targetRoom.members.push({
        playerId: identity.playerId,
        handle: commander.handle,
        mmr: commander.mmr,
        ws,
        connected: true,
        disconnectedAtMs: null,
        resolvedBuild,
        ready: true,
        launchPower: null,
        launchAngle: null,
        launchTargetX: 0,
        launchTargetZ: 0,
        launchPerfect: false,
        lastAbilityAtMs: 0
      });
      identity.roomId = targetRoom.roomId;
      identity.isSpectator = false;
      broadcastRoom(targetRoom, { type: "room_joined", room: serializeRoom(targetRoom) });
      return;
    }
    if (msgType === "leave_room") {
      explicitLeaveRoom(ws);
      return;
    }
    const room = identity.roomId ? rooms.get(identity.roomId) : void 0;
    if (!room || identity.isSpectator) return;
    const member = room.members.find((m) => m.playerId === identity.playerId);
    if (!member) return;
    if (msgType === "start_room_match" && room.hostPlayerId === identity.playerId) {
      if (room.members.length === 2) {
        startSynchronizedLaunch(room);
      }
      return;
    }
    if (msgType === "launch_aim" && room.phase === "Launch") {
      const isHost = member.playerId === room.hostPlayerId;
      const spawn = isHost ? PLAYER_LAUNCH_SPAWN : OPPONENT_LAUNCH_SPAWN;
      const handedness = isHost ? "right" : "left";
      const clamped = clampLaunchAngleToSide(
        spawn.x,
        spawn.z,
        Number(msg.targetX) || 0,
        Number(msg.targetZ) || 0,
        handedness
      );
      member.launchTargetX = clamped.targetX;
      member.launchTargetZ = clamped.targetZ;
      member.launchAngle = clamped.angleRad;
      return;
    }
    if (msgType === "launch_commit" && room.phase === "Launch") {
      const isHost = member.playerId === room.hostPlayerId;
      const spawn = isHost ? PLAYER_LAUNCH_SPAWN : OPPONENT_LAUNCH_SPAWN;
      const handedness = isHost ? "right" : "left";
      const power = Math.max(0.15, Math.min(1, Number(msg.powerRatio) || 0.72));
      const rawAngle = Number.isFinite(Number(msg.angleRad)) ? Number(msg.angleRad) : 0;
      const enforced = clampLaunchAngleToSide(
        spawn.x,
        spawn.z,
        spawn.x + Math.cos(rawAngle) * 2.8,
        spawn.z + Math.sin(rawAngle) * 2.8,
        handedness
      );
      member.launchPower = power;
      member.launchAngle = enforced.angleRad;
      member.launchTargetX = enforced.targetX;
      member.launchTargetZ = enforced.targetZ;
      member.launchPerfect = isPowerInPerfectWindow(power);
      broadcastRoom(room, {
        type: "launch_player_locked",
        playerId: member.playerId,
        perfect: member.launchPerfect
      });
      if (room.members.every((m) => m.launchPower !== null)) {
        finalizeSynchronizedLaunch(room);
      }
      return;
    }
    if (msgType === "ability_use" && room.phase === "Combat" && room.sim) {
      const slotIndex = Math.max(0, Math.min(3, Math.floor(Number(msg.slotIndex) || 0)));
      const now = Date.now();
      if (now - member.lastAbilityAtMs < 650) return;
      const side = member.playerId === room.hostPlayerId ? "player" : "opponent";
      const activated = activateAbility(room.sim, side, slotIndex);
      if (activated) {
        member.lastAbilityAtMs = now;
        broadcastRoom(room, {
          type: "remote_ability",
          playerId: member.playerId,
          slotIndex
        });
      }
      return;
    }
  });
  ws.on("close", () => {
    allActiveSockets.delete(ws);
    handleDisconnectFromRoom(ws);
  });
}
function getOnlineLobbySummary() {
  const openRooms = Array.from(rooms.values()).filter((r) => r.phase === "Lobby" && r.members.length < 2).map((r) => ({
    roomId: r.roomId,
    code: r.code,
    mode: r.mode,
    arenaId: r.arenaId,
    hostHandle: r.members[0]?.handle ?? "Commander",
    hostMmr: r.members[0]?.mmr ?? 1e3,
    mutators: r.mutators,
    spectatorCount: r.spectators.length
  }));
  const spectatableRooms = Array.from(rooms.values()).filter(
    (r) => r.mode === "OnlineFriendly" && r.members.length === 2 && r.phase !== "Finished" && r.spectators.length < MAX_SPECTATORS_PER_ROOM
  ).map((r) => ({
    roomId: r.roomId,
    code: r.code,
    arenaId: r.arenaId,
    phase: r.phase,
    p1Handle: r.members[0]?.handle ?? "P1",
    p2Handle: r.members[1]?.handle ?? "P2",
    spectatorCount: r.spectators.length,
    mutators: r.mutators
  }));
  return {
    activeRooms: rooms.size,
    openRooms,
    spectatableRooms,
    friendlyQueueSize: friendlyQueue.length,
    rankedQueueSize: rankedQueue.length
  };
}

// server.ts
function createRateLimiter(maxRequests, windowMs) {
  const buckets = /* @__PURE__ */ new Map();
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, hits] of buckets.entries()) {
      const active = hits.filter((t) => t > cutoff);
      if (active.length === 0) buckets.delete(ip);
      else buckets.set(ip, active);
    }
  }, Math.max(3e4, windowMs));
  cleanup.unref();
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;
    const prev = buckets.get(ip) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= maxRequests) {
      res.status(429).json({ error: "Too many requests. Please slow down and try again shortly." });
      return;
    }
    recent.push(now);
    buckets.set(ip, recent);
    next();
  };
}
function sanitizeAppearance(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const validStyles = ["spiky", "sleek", "braided", "visor"];
  const hexOk = (v, fallback) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
  return {
    hairStyle: validStyles.includes(String(input.hairStyle)) ? input.hairStyle : "spiky",
    hairColor: hexOk(input.hairColor, "#38bdf8"),
    outfitColor: hexOk(input.outfitColor, "#0f172a"),
    accentColor: hexOk(input.accentColor, "#f59e0b")
  };
}
function extractBearerCommanderId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return verifySessionToken(token);
}
function requireAuth(req, res, next) {
  const commanderId = extractBearerCommanderId(req);
  if (!commanderId || !getCommanderById(commanderId)) {
    res.status(401).json({ error: "Invalid or expired session token." });
    return;
  }
  req.commanderId = commanderId;
  next();
}
function isValidCloudSavePayload(raw) {
  if (!raw || typeof raw !== "object") return false;
  const candidate = raw;
  return typeof candidate.schemaVersion === "number" && Array.isArray(candidate.ownedTops) && candidate.ownedTops.length > 0 && typeof candidate.playerScore === "number" && Boolean(candidate.character && typeof candidate.character === "object");
}
async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss: https:; font-src 'self' data:; worker-src 'self' blob:;"
    );
    next();
  });
  app.use(express.json({ limit: "256kb" }));
  const authRateLimit = createRateLimiter(25, 6e4);
  const saveRateLimit = createRateLimiter(40, 6e4);
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      storage: "sqlite-wal",
      ...getStoreMetrics(),
      ...getOnlineLobbySummary()
    });
  });
  app.post("/api/auth/session", authRateLimit, (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const mode = body.mode === "register" || body.mode === "login" ? body.mode : "guest";
    const handle = typeof body.handle === "string" ? body.handle.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "Arena Challenger";
    const passcode = typeof body.passcode === "string" ? body.passcode : "";
    const existingPlayerId = typeof body.playerId === "string" ? body.playerId.trim() : void 0;
    const guestSecret = typeof body.guestSecret === "string" ? body.guestSecret.trim() : void 0;
    const appearance = sanitizeAppearance(body.appearance);
    if (mode === "register") {
      const result = registerAccountCommander({
        handle,
        passcode,
        title,
        appearance
      });
      if (!result.commander) {
        res.status(400).json({ error: result.error ?? "Unable to register commander." });
        return;
      }
      const token2 = issueSessionToken(result.commander.playerId);
      res.status(201).json({
        token: token2,
        commander: sanitizeCommanderPublic(result.commander)
      });
      return;
    }
    if (mode === "login") {
      const result = authenticateAccountCommander(handle, passcode);
      if (!result.commander) {
        res.status(401).json({ error: result.error ?? "Authentication failed." });
        return;
      }
      const token2 = issueSessionToken(result.commander.playerId);
      res.json({
        token: token2,
        commander: sanitizeCommanderPublic(result.commander)
      });
      return;
    }
    const authenticatedPlayerId = extractBearerCommanderId(req);
    const guestResult = registerOrUpdateGuestCommander({
      playerId: existingPlayerId,
      guestSecret,
      authenticatedPlayerId,
      handle: handle || "Commander",
      title,
      appearance
    });
    const token = issueSessionToken(guestResult.commander.playerId);
    res.json({
      token,
      guestSecret: guestResult.guestSecret,
      commander: sanitizeCommanderPublic(guestResult.commander)
    });
  });
  app.get("/api/leaderboard", (req, res) => {
    const season = req.query.season === "all" ? "all" : "current";
    res.json({
      season,
      seasonInfo: getCurrentSeasonInfo(),
      entries: getLeaderboardList(season)
    });
  });
  app.get("/api/season", (req, res) => {
    const season = getCurrentSeasonInfo();
    const commanderId = extractBearerCommanderId(req);
    const claimedTiers = commanderId ? getClaimedSeasonTiers(commanderId, season.seasonNumber) : [];
    res.json({
      season,
      tiers: RANK_TIERS,
      claimedTiers
    });
  });
  app.post("/api/season/claim", saveRateLimit, requireAuth, (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const rawTierId = typeof body.tierId === "string" ? body.tierId.trim() : "";
    const validTier = RANK_TIERS.find((t) => t.id === rawTierId);
    if (!validTier) {
      res.status(400).json({ error: "Invalid rank tier id." });
      return;
    }
    const result = claimSeasonTierReward(req.commanderId, validTier.id);
    if (!result.ok) {
      res.status(400).json({
        error: result.error ?? "Unable to claim season reward.",
        seasonNumber: result.seasonNumber,
        claimedTiers: result.claimedTiers
      });
      return;
    }
    res.json({
      ok: true,
      seasonNumber: result.seasonNumber,
      tier: result.tier,
      claimedTiers: result.claimedTiers
    });
  });
  app.get("/api/shadow-opponents", (req, res) => {
    const excludeId = extractBearerCommanderId(req) ?? void 0;
    res.json({
      opponents: getShadowOpponents(excludeId)
    });
  });
  app.get("/api/rooms", (_req, res) => {
    res.json(getOnlineLobbySummary());
  });
  app.get("/api/save", requireAuth, (req, res) => {
    const commanderId = req.commanderId;
    const commander = getCommanderById(commanderId);
    if (!commander) {
      res.status(404).json({ error: "Commander not found." });
      return;
    }
    const save = getCloudSaveForCommander(commanderId);
    res.json({
      commander: sanitizeCommanderPublic(commander),
      save
    });
  });
  app.put("/api/save", saveRateLimit, requireAuth, (req, res) => {
    const commanderId = req.commanderId;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (!isValidCloudSavePayload(body.save)) {
      res.status(400).json({ error: "Invalid cloud save payload." });
      return;
    }
    const result = saveCloudProfileForCommander(commanderId, body.save);
    if (!result.commander) {
      const status = result.error?.includes("not found") ? 404 : 400;
      res.status(status).json({ error: result.error ?? "Unable to sync cloud save." });
      return;
    }
    res.json({
      ok: true,
      commander: sanitizeCommanderPublic(result.commander)
    });
  });
  app.use("/api", (err, _req, res, _next) => {
    const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) || 500 : 500;
    res.status(status).json({ error: status === 413 ? "Payload too large." : "Server error." });
  });
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    handlePvpWebSocketConnection(ws);
  });
  httpServer.on("upgrade", (req, socket, head) => {
    const reqUrl = req.url ?? "";
    if (reqUrl === "/ws" || reqUrl.startsWith("/ws?")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path2.resolve(process.cwd(), "dist");
    if (fs2.existsSync(distDir)) {
      app.use(express.static(distDir, { maxAge: "7d", index: false }));
      app.get("*", (_req, res) => {
        res.sendFile(path2.join(distDir, "index.html"));
      });
    }
  }
  const port = Number(process.env.PORT) || 3e3;
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(
      `[Spin Legends Server] Listening on http://0.0.0.0:${port} (${isProd ? "production" : "development"})`
    );
  });
  const gracefulShutdown = (signal) => {
    console.log(`[Spin Legends Server] Received ${signal}, draining connections...`);
    shutdownPvpRooms();
    wss.close();
    httpServer.close(() => {
      closeStore();
      process.exit(0);
    });
    setTimeout(() => {
      closeStore();
      process.exit(0);
    }, 3e3).unref();
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
startServer().catch((err) => {
  console.error(
    "[Spin Legends Server] Fatal startup failure:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
