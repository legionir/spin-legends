import {
  ELEMENTS,
  getAbilityDefinition,
  getArenaDefinition,
  getTopDefinition,
  getWeatherDefinition,
} from '../domain/catalog';
import { getPlayerActiveStatuses } from '../domain/statusManager';
import {
  ARENA_DISH_RADIUS,
  DEFAULT_BATTLE_MUTATORS,
  LAUNCH_WINDOW_SECONDS,
  MAX_BATTLE_DURATION,
  PERFECT_LAUNCH_RPM_BONUS,
  TEAM_SWITCH_ENERGY_COST,
  getDualElementalMultiplier,
  isPowerInPerfectWindow,
  sanitizeBattleMutators,
} from '../domain/rules';
import {
  AIPersonality,
  AbilityDefinition,
  ActiveStatDebuff,
  ArenaHazardZone,
  ArenaId,
  ArenaPillarObstacle,
  AttributeSet,
  BattleAnalysisClashStreak,
  BattleAnalysisDamageMoment,
  BattleAnalysisMomentumSwing,
  BattleAnalysisReport,
  BattleAnalysisThresholdBreach,
  BattleDamageBreakdown,
  BattleMode,
  BattleMutators,
  BattlePhase,
  BossPhaseSpec,
  DifficultyLevel,
  ElementType,
  FinishReason,
  HighlightStatDebuff,
  LaunchSelection,
  MatchHighlightClip,
  MatchHighlightFrame,
  MatchHighlightObstacleSnapshot,
  PartDurabilityKey,
  PartDurabilityMap,
  PhysicalProfile,
  StatDebuffKind,
  StatusEffectType,
  TacticalCommand,
  WeatherType,
} from '../domain/types';

export const FIXED_DT = 0.02; // 50 Hz fixed simulation timestep
export { ARENA_DISH_RADIUS, MAX_BATTLE_DURATION, LAUNCH_WINDOW_SECONDS, TEAM_SWITCH_ENERGY_COST };
export const ARENA_WALL_RADIUS = 4.46;
export const ARENA_RING_OUT_RADIUS = 4.78;
export const ARENA_DISH_CURVATURE = 0.045; // y(r) = k * r^2 (smooth concave stadium bowl)
export const BOWL_SLOPE_ACCEL = 3.85; // non-harmonic outer dish bank acceleration
export const CENTER_FUNNEL_ACCEL = 1.45; // gentle center pocket depression pull
export const SPIRAL_BASE_DRAG = 0.14; // low orbital damping so spirals stay wide before winding in
export const LAUNCH_SPEED_BASE = 2.55;
export const LAUNCH_SPEED_RANGE = 0.85;
export const LAUNCH_MIN_OFFSET = 0.0; // 0 deg: straight ahead toward arena center
export const LAUNCH_MAX_OFFSET = Math.PI / 2; // 90 deg: full perpendicular side-sector sweep
export const PLAYER_LAUNCH_SPAWN = { x: -2.45, z: 2.15 } as const; // r ≈ 3.26m, clear of blades & exit gates
export const OPPONENT_LAUNCH_SPAWN = { x: 2.45, z: -2.15 } as const;
export const MIN_SPIN_OMEGA = 11; // rad/s threshold for Spin Finish
export const TEAM_SWITCH_COOLDOWN = 4.0;
const REF_TOP_MASS_KG = 0.105;
const REF_MOMENT_OF_INERTIA = 0.0098;

export type LaunchHandedness = 'right' | 'left';

export function arenaFloorHeight(x: number, z: number): number {
  const rSq = x * x + z * z;
  const clampedRSq = Math.min(rSq, ARENA_RING_OUT_RADIUS * ARENA_RING_OUT_RADIUS);
  return ARENA_DISH_CURVATURE * clampedRSq;
}

/**
 * Non-harmonic parabolic/conical stadium bowl restoring acceleration.
 * Unlike a linear spring F = -k*r (where every angle collapses onto the same half-period focal point),
 * a saturating dish slope + center funnel preserves angular-momentum separation across 0°–90° launches
 * and sustains wide, multi-loop spirals before gently settling to (0,0).
 */
export function computeBowlRadialAccel(x: number, z: number): { ax: number; az: number } {
  const r = Math.hypot(x, z);
  if (r < 0.0001) return { ax: 0, az: 0 };
  const bankPull = BOWL_SLOPE_ACCEL * (r / (1.45 + r));
  const pocketPull = CENTER_FUNNEL_ACCEL * (r / (0.85 + r * r));
  const invR = (bankPull + pocketPull) / r;
  return {
    ax: -x * invR,
    az: -z * invR,
  };
}

export function evaluateDynamicPillarState(
  pillar: ArenaPillarObstacle,
  elapsedTime: number
): { x: number; z: number; vx: number; vz: number } {
  const m = pillar.motion;
  if (!m) {
    return { x: pillar.x, z: pillar.z, vx: 0, vz: 0 };
  }
  if (m.kind === 'orbit') {
    const r = m.orbitRadius ?? (Math.hypot(pillar.x, pillar.z) || 1.8);
    const baseAngle = m.phaseOffset ?? Math.atan2(pillar.z, pillar.x);
    const angle = baseAngle + elapsedTime * m.speedRadPerSec;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    return {
      x,
      z,
      vx: -Math.sin(angle) * r * m.speedRadPerSec,
      vz: Math.cos(angle) * r * m.speedRadPerSec,
    };
  }
  const phase = (m.phaseOffset ?? 0) + elapsedTime * m.speedRadPerSec;
  const ampX = m.ampX ?? 0;
  const ampZ = m.ampZ ?? 0;
  return {
    x: pillar.x + Math.sin(phase) * ampX,
    z: pillar.z + Math.cos(phase) * ampZ,
    vx: Math.cos(phase) * ampX * m.speedRadPerSec,
    vz: -Math.sin(phase) * ampZ * m.speedRadPerSec,
  };
}

export function evaluateDynamicHazardPosition(
  hz: ArenaHazardZone,
  elapsedTime: number
): { x: number; z: number } {
  const m = hz.motion;
  if (!m) {
    return { x: hz.x, z: hz.z };
  }
  if (m.kind === 'orbit') {
    const r = m.orbitRadius ?? (Math.hypot(hz.x, hz.z) || 2.0);
    const baseAngle = m.phaseOffset ?? Math.atan2(hz.z, hz.x);
    const angle = baseAngle + elapsedTime * m.speedRadPerSec;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
    };
  }
  const phase = (m.phaseOffset ?? 0) + elapsedTime * m.speedRadPerSec;
  return {
    x: hz.x + Math.sin(phase) * (m.ampX ?? 0),
    z: hz.z + Math.cos(phase) * (m.ampZ ?? 0),
  };
}

// 3 Stadium Ring-Out Exit Gates (at 60°, 180°, 300°) where the wall opens slightly
export function isAtRingOutGate(x: number, z: number): boolean {
  const angle = Math.atan2(z, x);
  const gates = [Math.PI / 3, Math.PI, -Math.PI / 3];
  for (const g of gates) {
    let diff = Math.abs(angle - g);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 0.24) return true;
  }
  return false;
}

export interface ActiveStatusEffect {
  type: StatusEffectType;
  remainingSec: number;
  strength: number;
}

export interface AbilitySlotRuntime {
  abilityId: string;
  cooldownRemaining: number;
  activeRemaining: number;
}

export interface TopSimConfig {
  entityId: 'player' | 'opponent';
  instanceId?: string;
  name: string;
  element: ElementType;
  secondaryElement?: ElementType | null;
  attributes: AttributeSet;
  physical: PhysicalProfile;
  abilities: [string, string, string, string];
  initialMode: BattleMode;
  initialCommand: TacticalCommand;
  evolutionStage: number;
}

export interface TeamMemberSnapshot {
  config: TopSimConfig;
  staminaRatio: number;
  omega: number;
  durability: number;
  maxDurability: number;
  stability: number;
  energy: number;
  resonance: number;
  partDurability: PartDurabilityMap;
  knockedOut: boolean;
}

export interface TopSimEntity {
  entityId: 'player' | 'opponent';
  name: string;
  element: ElementType;
  secondaryElement: ElementType | null;
  attributes: AttributeSet;
  physical: PhysicalProfile;
  evolutionStage: number;

  // Linear state
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;

  // Rotational state
  omega: number;
  spinAngle: number;
  initialRotationalEnergy: number;
  rotationalEnergy: number;
  staminaRatio: number; // 0..1
  stability: number; // 0..100
  wobbleTilt: number; // radians
  wobblePhase: number;
  lowSpinTimer: number;

  // Combat resources & per-component durability
  durability: number;
  maxDurability: number;
  partDurability: PartDurabilityMap;
  brokenParts: PartDurabilityKey[];
  energy: number;
  maxEnergy: number;
  resonance: number; // 0..100

  // Tactical / Debug state
  battleMode: BattleMode;
  modeCooldown: number;
  tacticalCommand: TacticalCommand;
  commandTimer: number;
  commandCooldown: number;
  debugSteeringEnabled: boolean;

  // Abilities & Status
  abilitySlots: AbilitySlotRuntime[];
  statuses: ActiveStatusEffect[];
  statDebuffs: ActiveStatDebuff[];
  trapDebuffCooldown: number;
  hitFlashTimer: number;
  ringedOut: boolean;
  burstOut: boolean;
  knockedOut: boolean;
}

export interface SimEvent {
  type:
    | 'collision'
    | 'wallBounce'
    | 'pillarBounce'
    | 'ability'
    | 'modeChange'
    | 'commandChange'
    | 'criticalPhase'
    | 'partBreak'
    | 'bossPhase'
    | 'teamSwitch'
    | 'trapDebuff'
    | 'burst'
    | 'knockout'
    | 'ringOut'
    | 'spinFinish'
    | 'perfectLaunch';
  x: number;
  y: number;
  z: number;
  intensity: number; // 0..1+
  isCritical?: boolean;
  actorId?: 'player' | 'opponent';
  partKey?: PartDurabilityKey;
  label?: string;
  colorHex?: string;
  vx?: number;
  vz?: number;
  nx?: number;
  nz?: number;
}

export interface AdaptiveMemory {
  playerAbilitiesObserved: number;
  highSpeedClashes: number;
  playerOffensiveBias: number;
  lastAdaptedAt: number;
}

export interface BattleSimulationState {
  battleId: string;
  arenaId: ArenaId;
  phase: BattlePhase;
  elapsedTime: number;
  launchCountdown: number; // 5.0 -> 0.0
  launchSelection: LaunchSelection;
  launchQuality: number; // 0.85..1.18
  perfectLaunch: boolean;
  opponentPerfectLaunch: boolean;
  weather: WeatherType;
  mutators: BattleMutators;
  analysis: BattleAnalysisReport;
  analysisTimelineAccum: number;
  activeClashStreak: BattleAnalysisClashStreak | null;
  thresholdBreachedFlags: {
    playerStamina: boolean;
    playerDurability: boolean;
    opponentStamina: boolean;
    opponentDurability: boolean;
  };
  prevLeadDeltaPct: number;
  slowMotionTimer: number;
  hitstopTimer: number;
  cameraTrauma: number;
  collisionCount: number;
  maxImpactImpulse: number;
  abilitiesUsedByPlayer: number;
  finishTimer: number;
  winnerSide: 'player' | 'opponent' | null;
  finishReason: FinishReason | null;
  player: TopSimEntity;
  opponent: TopSimEntity;
  aiPersonality: AIPersonality;
  aiDifficulty: DifficultyLevel;
  aiDecisionTimer: number;
  adaptiveMemory: AdaptiveMemory;
  bossPhases: BossPhaseSpec[];
  triggeredBossPhaseIndices: number[];
  isTeamBattle: boolean;
  playerTeam: TeamMemberSnapshot[];
  activeTeamIndex: number;
  teamSwitchCooldown: number;
  isOnlineRemote: boolean;
  isSpectating: boolean;
  spectatorCount: number;
  disableAi: boolean;
  launchHandedness: LaunchHandedness;
  highlightFrames: MatchHighlightFrame[];
  highlightSampleAccum: number;
  pendingHighlightMarker: {
    clashX?: number;
    clashZ?: number;
    isCritical?: boolean;
    eventLabel?: string;
  } | null;
  events: SimEvent[];
}

function createEmptyDamageBreakdown(): BattleDamageBreakdown {
  return { clash: 0, hazard: 0, pillar: 0, ability: 0, status: 0 };
}

function recordAnalysisDamage(
  sim: BattleSimulationState,
  victimSide: 'player' | 'opponent',
  source: keyof BattleDamageBreakdown,
  amount: number,
  isCritical = false
): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (victimSide === 'player') {
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
      actorSide: victimSide === 'player' ? 'opponent' : 'player',
      victimSide,
      isCritical,
    };
  }
}

function checkCriticalThresholdBreaches(sim: BattleSimulationState): void {
  const breaches = sim.analysis.criticalThresholdBreaches ?? (sim.analysis.criticalThresholdBreaches = []);
  const timeSec = Number(sim.elapsedTime.toFixed(2));
  const pDurRatio = sim.player.durability / Math.max(1, sim.player.maxDurability);
  const oDurRatio = sim.opponent.durability / Math.max(1, sim.opponent.maxDurability);

  if (!sim.thresholdBreachedFlags.playerStamina && sim.player.staminaRatio < 0.2) {
    sim.thresholdBreachedFlags.playerStamina = true;
    breaches.push({
      side: 'player',
      metric: 'stamina',
      timeSec,
      remainingPct: Math.max(0, Math.round(sim.player.staminaRatio * 100)),
    });
  }
  if (!sim.thresholdBreachedFlags.playerDurability && pDurRatio < 0.2) {
    sim.thresholdBreachedFlags.playerDurability = true;
    breaches.push({
      side: 'player',
      metric: 'durability',
      timeSec,
      remainingPct: Math.max(0, Math.round(pDurRatio * 100)),
    });
  }
  if (!sim.thresholdBreachedFlags.opponentStamina && sim.opponent.staminaRatio < 0.2) {
    sim.thresholdBreachedFlags.opponentStamina = true;
    breaches.push({
      side: 'opponent',
      metric: 'stamina',
      timeSec,
      remainingPct: Math.max(0, Math.round(sim.opponent.staminaRatio * 100)),
    });
  }
  if (!sim.thresholdBreachedFlags.opponentDurability && oDurRatio < 0.2) {
    sim.thresholdBreachedFlags.opponentDurability = true;
    breaches.push({
      side: 'opponent',
      metric: 'durability',
      timeSec,
      remainingPct: Math.max(0, Math.round(oDurRatio * 100)),
    });
  }
}

function recordAnalysisTimelinePoint(sim: BattleSimulationState): void {
  const pArmor = Math.round((sim.player.durability / Math.max(1, sim.player.maxDurability)) * 100);
  const oArmor = Math.round(
    (sim.opponent.durability / Math.max(1, sim.opponent.maxDurability)) * 100
  );
  const pStam = Math.round(sim.player.staminaRatio * 100);
  const oStam = Math.round(sim.opponent.staminaRatio * 100);
  const leadDelta = (pStam * 0.55 + pArmor * 0.45) - (oStam * 0.55 + oArmor * 0.45);
  if (sim.analysis.timeline.length > 0) {
    const swing = Math.abs(leadDelta - sim.prevLeadDeltaPct);
    const prevPeak = sim.analysis.peakMomentumSwing;
    if (!prevPeak || swing > prevPeak.swingDeltaPct) {
      sim.analysis.peakMomentumSwing = {
        timeSec: Number(sim.elapsedTime.toFixed(1)),
        leaderAfter: leadDelta >= 0 ? 'player' : 'opponent',
        swingDeltaPct: Number(swing.toFixed(1)),
      };
    }
  }
  sim.prevLeadDeltaPct = leadDelta;
  sim.analysis.timeline.push({
    timeSec: Number(sim.elapsedTime.toFixed(1)),
    playerStaminaPct: pStam,
    opponentStaminaPct: oStam,
    playerArmorPct: pArmor,
    opponentArmorPct: oArmor,
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function clampLaunchAngleToSide(
  spawnX: number,
  spawnZ: number,
  targetX: number,
  targetZ: number,
  handedness: LaunchHandedness
): { angleRad: number; targetX: number; targetZ: number } {
  const inwardAngle = Math.atan2(-spawnZ, -spawnX);
  const dx = targetX - spawnX;
  const dz = targetZ - spawnZ;
  const rawDist = Math.hypot(dx, dz);
  const dist = clamp(rawDist > 0.15 ? rawDist : 2.8, 1.5, 3.6);
  const rawAngle =
    rawDist > 0.15 ? Math.atan2(dz, dx) : inwardAngle + (handedness === 'right' ? 0.85 : -0.85);
  const rawDelta = normalizeAngle(rawAngle - inwardAngle);

  // Full 0..90 deg sector on the player's allowed side:
  // 'right' -> [0, +pi/2] (CCW spiral), 'left' -> [-pi/2, 0] (CW spiral).
  // If cursor sweeps behind the 90 deg line (> 115 deg off-side), snap smoothly to 90 deg rather than 0 deg.
  let clampedDelta: number;
  if (handedness === 'right') {
    clampedDelta =
      rawDelta < -Math.PI * 0.65
        ? LAUNCH_MAX_OFFSET
        : clamp(rawDelta, LAUNCH_MIN_OFFSET, LAUNCH_MAX_OFFSET);
  } else {
    clampedDelta =
      rawDelta > Math.PI * 0.65
        ? -LAUNCH_MAX_OFFSET
        : clamp(rawDelta, -LAUNCH_MAX_OFFSET, -LAUNCH_MIN_OFFSET);
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

function createInitialPartDurability(): PartDurabilityMap {
  return {
    SpiritCore: 100,
    AttackBlade: 100,
    ArmorRing: 100,
    WeightDisc: 100,
    PerformanceDriver: 100,
    EnergyModule: 100,
  };
}

function createEntity(
  cfg: TopSimConfig,
  spawnX: number,
  spawnZ: number,
  options?: {
    initialStaminaRatio?: number;
    initialDurabilityRatio?: number;
    debugSteeringEnabled?: boolean;
  }
): TopSimEntity {
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
    wobblePhase: cfg.entityId === 'player' ? 0 : Math.PI,
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
      activeRemaining: 0,
    })),
    statuses: [],
    statDebuffs: [],
    trapDebuffCooldown: 0,
    hitFlashTimer: 0,
    ringedOut: false,
    burstOut: false,
    knockedOut: false,
  };
}

export function createBattleSimulation(params: {
  battleId: string;
  arenaId?: ArenaId;
  playerConfig: TopSimConfig;
  opponentConfig: TopSimConfig;
  aiPersonality: AIPersonality;
  aiDifficulty: DifficultyLevel;
  bossPhases?: BossPhaseSpec[];
  playerTeamConfigs?: TopSimConfig[];
  initialPlayerStaminaRatio?: number;
  initialPlayerDurabilityRatio?: number;
  startInPhase?: 'Launch' | 'Combat';
  debugMode?: boolean;
  isOnlineRemote?: boolean;
  isSpectating?: boolean;
  spectatorCount?: number;
  disableAi?: boolean;
  launchHandedness?: LaunchHandedness;
  playerSpawn?: { x: number; z: number };
  opponentSpawn?: { x: number; z: number };
  weather?: WeatherType;
  mutators?: Partial<BattleMutators>;
}): BattleSimulationState {
  const handedness: LaunchHandedness = params.launchHandedness ?? 'right';
  const pSpawn = params.playerSpawn ?? PLAYER_LAUNCH_SPAWN;
  const oSpawn = params.opponentSpawn ?? OPPONENT_LAUNCH_SPAWN;

  const player = createEntity(params.playerConfig, pSpawn.x, pSpawn.z, {
    initialStaminaRatio: params.initialPlayerStaminaRatio,
    initialDurabilityRatio: params.initialPlayerDurabilityRatio,
    debugSteeringEnabled: Boolean(params.debugMode),
  });
  const opponent = createEntity(params.opponentConfig, oSpawn.x, oSpawn.z, {
    // Both tops obey authentic Pure Physics bowl & spiral mechanics unless Debug mode overrides!
    debugSteeringEnabled: Boolean(params.debugMode),
  });

  const teamConfigs =
    params.playerTeamConfigs && params.playerTeamConfigs.length > 1
      ? params.playerTeamConfigs
      : [params.playerConfig];
  const teamSnapshots: TeamMemberSnapshot[] = teamConfigs.map((cfg) => {
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
      knockedOut: false,
    };
  });

  // Default launch target sits cleanly inside the assigned 0-90 deg spiral sector
  const inwardP = Math.atan2(-pSpawn.z, -pSpawn.x);
  const defaultOffset = handedness === 'right' ? 0.85 : -0.85;
  const defaultAngle = inwardP + defaultOffset;
  const defaultTargetX = pSpawn.x + Math.cos(defaultAngle) * 2.8;
  const defaultTargetZ = pSpawn.z + Math.sin(defaultAngle) * 2.8;

  const sim: BattleSimulationState = {
    battleId: params.battleId,
    arenaId: params.arenaId ?? 'standard',
    phase: params.startInPhase ?? 'Launch',
    elapsedTime: 0,
    launchCountdown: LAUNCH_WINDOW_SECONDS,
    launchSelection: {
      angleRad: defaultAngle,
      powerRatio: 0.74,
      targetX: defaultTargetX,
      targetZ: defaultTargetZ,
      aimSetByPlayer: false,
      powerLockedByPlayer: false,
    },
    launchQuality: 1.0,
    perfectLaunch: false,
    opponentPerfectLaunch: false,
    weather: params.weather ?? 'Clear',
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
      peakMomentumSwing: null,
    },
    analysisTimelineAccum: 0,
    activeClashStreak: null,
    thresholdBreachedFlags: {
      playerStamina: false,
      playerDurability: false,
      opponentStamina: false,
      opponentDurability: false,
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
      lastAdaptedAt: 0,
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
    events: [],
  };

  if (sim.phase === 'Combat') {
    applyLaunchVelocities(sim, 0.85, sim.launchSelection.angleRad, undefined, {
      allowPerfect: false,
    });
  }

  return sim;
}

export function setLaunchAim(
  sim: BattleSimulationState,
  targetX: number,
  targetZ: number
): void {
  if (sim.phase !== 'Launch') return;
  const clamped = clampLaunchAngleToSide(
    sim.player.x,
    sim.player.z,
    targetX,
    targetZ,
    sim.launchHandedness
  );
  sim.launchSelection.targetX = clamped.targetX;
  sim.launchSelection.targetZ = clamped.targetZ;
  sim.launchSelection.angleRad = clamped.angleRad;
  sim.launchSelection.aimSetByPlayer = true;
}

export function applyLaunchVelocities(
  sim: BattleSimulationState,
  powerRatio: number,
  angleRad?: number,
  opponentLaunch?: { powerRatio: number; angleRad: number },
  options?: { allowPerfect?: boolean; opponentPerfect?: boolean }
): void {
  const clampedPower = clamp(powerRatio, 0.15, 1);
  const rawAngle = angleRad ?? sim.launchSelection.angleRad;
  // Enforce restricted side even if an unconstrained angle is passed in
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

  const isPerfectPlayer =
    options?.allowPerfect !== false && isPowerInPerfectWindow(clampedPower);
  sim.perfectLaunch = isPerfectPlayer;
  const perfectRpmMultP = isPerfectPlayer ? PERFECT_LAUNCH_RPM_BONUS : 1.0;
  const perfectSpeedMultP = isPerfectPlayer ? 1.05 : 1.0;
  const turboRpmMult = sim.mutators.turboSpin ? 2.0 : 1.0;
  const turboSpeedMult = sim.mutators.turboSpin ? 1.3 : 1.0;

  // powerRatio 0..1 -> launchQuality 0.85..1.18
  const q = 0.85 + clampedPower * 0.33;
  sim.launchQuality = q;

  // Preserve Survival carry-over stamina ratio if starting below 100%
  const pCarryRatio = sim.player.staminaRatio;
  const windBonusP = sim.player.element === 'Wind' ? 1.08 : 1.0;
  const targetPlayerBaseOmega =
    sim.player.physical.initialAngularVelocity * q * perfectRpmMultP * turboRpmMult;
  sim.player.omega = targetPlayerBaseOmega * Math.sqrt(pCarryRatio);
  sim.player.initialRotationalEnergy =
    0.5 * sim.player.physical.momentOfInertia * targetPlayerBaseOmega * targetPlayerBaseOmega;
  sim.player.rotationalEnergy =
    0.5 * sim.player.physical.momentOfInertia * sim.player.omega * sim.player.omega;
  sim.player.staminaRatio = pCarryRatio;

  const launchSpeedP =
    (LAUNCH_SPEED_BASE + clampedPower * LAUNCH_SPEED_RANGE) *
    windBonusP *
    perfectSpeedMultP *
    turboSpeedMult;
  sim.player.vx = Math.cos(chosenAngle) * launchSpeedP;
  sim.player.vz = Math.sin(chosenAngle) * launchSpeedP;

  if (isPerfectPlayer) {
    sim.events.push({
      type: 'perfectLaunch',
      x: sim.player.x,
      y: sim.player.y + 0.28,
      z: sim.player.z,
      intensity: 1.35,
      isCritical: true,
      actorId: 'player',
      label: 'PERFECT LAUNCH! +8% RPM',
      colorHex: '#facc15',
    });
  }

  // Simultaneous Opponent Launch from opposite rim in STRICTLY OPPOSITE orbital direction
  const windBonusO = sim.opponent.element === 'Wind' ? 1.08 : 1.0;
  if (opponentLaunch) {
    const oPower = clamp(opponentLaunch.powerRatio, 0.15, 1);
    const oppHandedness: LaunchHandedness = sim.launchHandedness === 'right' ? 'left' : 'right';
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
    const oppRpmMult = (oppPerfect ? PERFECT_LAUNCH_RPM_BONUS : 1.0) * turboRpmMult;
    const oppSpdMult = (oppPerfect ? 1.05 : 1.0) * turboSpeedMult;
    sim.opponent.omega = sim.opponent.physical.initialAngularVelocity * oQ * oppRpmMult;
    sim.opponent.initialRotationalEnergy =
      0.5 * sim.opponent.physical.momentOfInertia * sim.opponent.omega * sim.opponent.omega;
    sim.opponent.rotationalEnergy = sim.opponent.initialRotationalEnergy;
    sim.opponent.staminaRatio = 1;

    const launchSpeedO = (LAUNCH_SPEED_BASE + oPower * LAUNCH_SPEED_RANGE) * windBonusO * oppSpdMult;
    sim.opponent.vx = Math.cos(oppEnforced.angleRad) * launchSpeedO;
    sim.opponent.vz = Math.sin(oppEnforced.angleRad) * launchSpeedO;
  } else {
    const aiLaunchQ =
      sim.aiDifficulty === 'Easy'
        ? 0.92
        : sim.aiDifficulty === 'Normal'
          ? 1.0
          : sim.aiDifficulty === 'Hard'
            ? 1.08
            : 1.14;
    sim.opponent.omega = sim.opponent.physical.initialAngularVelocity * aiLaunchQ * turboRpmMult;
    sim.opponent.initialRotationalEnergy =
      0.5 * sim.opponent.physical.momentOfInertia * sim.opponent.omega * sim.opponent.omega;
    sim.opponent.rotationalEnergy = sim.opponent.initialRotationalEnergy;
    sim.opponent.staminaRatio = 1;

    // Opponent launches to the opposite orbital side relative to Player (CW vs CCW)
    const oppSign = sim.launchHandedness === 'right' ? -1 : 1;
    const inwardAngle = Math.atan2(-sim.opponent.z, -sim.opponent.x);
    const chordMag =
      sim.aiPersonality === 'Evasive'
        ? 1.18
        : sim.aiPersonality === 'Defensive'
          ? 0.58
          : sim.aiPersonality === 'Aggressive'
            ? 0.72
            : 0.92;
    const oAngle = inwardAngle + oppSign * clamp(chordMag, 0.35, LAUNCH_MAX_OFFSET - 0.12);
    const launchSpeedO = (LAUNCH_SPEED_BASE + 0.72 * LAUNCH_SPEED_RANGE) * aiLaunchQ * windBonusO;
    sim.opponent.vx = Math.cos(oAngle) * launchSpeedO;
    sim.opponent.vz = Math.sin(oAngle) * launchSpeedO;
  }

  sim.phase = 'Combat';
}

export function setTacticalCommand(
  sim: BattleSimulationState,
  side: 'player' | 'opponent',
  command: TacticalCommand,
  options?: { debugOverride?: boolean }
): boolean {
  if (sim.phase !== 'Combat' && sim.phase !== 'Critical') return false;
  // Physics Purity: Player cannot issue steering commands unless Debug Mode explicitly overrides!
  if (side === 'player' && !options?.debugOverride) return false;
  const entity = side === 'player' ? sim.player : sim.opponent;
  if (side === 'player' && options?.debugOverride) {
    entity.debugSteeringEnabled = true;
  }
  if (entity.tacticalCommand === command) return false;
  if (entity.commandCooldown > 0) return false;

  entity.tacticalCommand = command;
  entity.commandTimer = 0;
  entity.commandCooldown = 0.6;
  sim.events.push({
    type: 'commandChange',
    x: entity.x,
    y: entity.y,
    z: entity.z,
    intensity: 0.3,
    actorId: side,
    label: command,
  });
  return true;
}

export function setBattleMode(
  sim: BattleSimulationState,
  side: 'player' | 'opponent',
  mode: BattleMode,
  options?: { debugOverride?: boolean }
): boolean {
  if (sim.phase !== 'Combat' && sim.phase !== 'Critical') return false;
  // Physics Purity: Player cannot alter Battle Mode unless Debug Mode explicitly overrides!
  if (side === 'player' && !options?.debugOverride) return false;
  const entity = side === 'player' ? sim.player : sim.opponent;
  if (entity.battleMode === mode) return false;
  if (entity.modeCooldown > 0) return false;

  if (mode === 'Berserk' && entity.energy < 15) return false;
  if (mode === 'Berserk') {
    entity.energy = Math.max(0, entity.energy - 15);
  }

  entity.battleMode = mode;
  entity.modeCooldown = 1.4;
  sim.events.push({
    type: 'modeChange',
    x: entity.x,
    y: entity.y,
    z: entity.z,
    intensity: 0.45,
    actorId: side,
    label: `${mode} Mode`,
  });
  return true;
}

export function switchPlayerTeamTop(
  sim: BattleSimulationState,
  targetIndex: number
): boolean {
  if (!sim.isTeamBattle) return false;
  if (sim.phase !== 'Combat' && sim.phase !== 'Critical') return false;
  if (sim.teamSwitchCooldown > 0) return false;
  if (targetIndex === sim.activeTeamIndex) return false;
  const nextSnapshot = sim.playerTeam[targetIndex];
  if (!nextSnapshot || nextSnapshot.knockedOut) return false;
  if (sim.player.energy < TEAM_SWITCH_ENERGY_COST) return false;

  // Save current active top's runtime state
  const current = sim.player;
  const currSnap = sim.playerTeam[sim.activeTeamIndex];
  currSnap.staminaRatio = current.staminaRatio;
  currSnap.omega = current.omega;
  currSnap.durability = current.durability;
  currSnap.stability = current.stability;
  currSnap.energy = Math.max(0, current.energy - TEAM_SWITCH_ENERGY_COST);
  currSnap.resonance = current.resonance;
  currSnap.partDurability = { ...current.partDurability };
  currSnap.knockedOut = current.ringedOut || current.burstOut || current.knockedOut;

  // Swap in teammate preserving velocity position & teammate's spin/durability state
  const swapped = createEntity(nextSnapshot.config, current.x, current.z, {
    initialStaminaRatio: nextSnapshot.staminaRatio,
    initialDurabilityRatio: nextSnapshot.durability / Math.max(1, nextSnapshot.maxDurability),
    debugSteeringEnabled: current.debugSteeringEnabled,
  });
  swapped.vx = current.vx * 0.65;
  swapped.vz = current.vz * 0.65;
  swapped.omega = Math.max(MIN_SPIN_OMEGA + 18, nextSnapshot.omega);
  swapped.stability = nextSnapshot.stability;
  swapped.energy = Math.max(25, nextSnapshot.energy);
  swapped.resonance = nextSnapshot.resonance;
  swapped.partDurability = { ...nextSnapshot.partDurability };
  swapped.brokenParts = (Object.keys(swapped.partDurability) as PartDurabilityKey[]).filter(
    (k) => swapped.partDurability[k] <= 0
  );

  sim.player = swapped;
  sim.activeTeamIndex = targetIndex;
  sim.teamSwitchCooldown = TEAM_SWITCH_COOLDOWN;

  sim.events.push({
    type: 'teamSwitch',
    x: swapped.x,
    y: swapped.y + 0.25,
    z: swapped.z,
    intensity: 0.9,
    actorId: 'player',
    label: `TAG IN: ${swapped.name.toUpperCase()}`,
    colorHex: '#38bdf8',
  });
  return true;
}

export function quickSwapPlayerLoadout(
  sim: BattleSimulationState,
  nextConfig: TopSimConfig,
  presetName?: string
): boolean {
  if (sim.isOnlineRemote || sim.isSpectating) return false;
  if (sim.phase !== 'Launch' && sim.phase !== 'Combat' && sim.phase !== 'Critical') {
    return false;
  }

  const current = sim.player;
  const durRatio = clamp(current.durability / Math.max(1, current.maxDurability), 0.1, 1);
  const stamRatio = clamp(current.staminaRatio, 0.1, 1);
  const energyRatio = clamp(current.energy / Math.max(1, current.maxEnergy), 0, 1);

  const swapped = createEntity(nextConfig, current.x, current.z, {
    initialStaminaRatio: stamRatio,
    initialDurabilityRatio: durRatio,
    debugSteeringEnabled: current.debugSteeringEnabled,
  });
  swapped.vx = current.vx;
  swapped.vz = current.vz;
  swapped.vy = current.vy;
  swapped.spinAngle = current.spinAngle;
  swapped.wobbleTilt = current.wobbleTilt;
  swapped.wobblePhase = current.wobblePhase;
  swapped.stability = current.stability;
  swapped.energy = Math.max(15, swapped.maxEnergy * energyRatio);
  swapped.resonance = current.resonance;
  swapped.partDurability = { ...current.partDurability };
  swapped.brokenParts = [...current.brokenParts];

  sim.player = swapped;
  if (sim.playerTeam[sim.activeTeamIndex]) {
    sim.playerTeam[sim.activeTeamIndex].config = nextConfig;
  }

  sim.events.push({
    type: 'teamSwitch',
    x: swapped.x,
    y: swapped.y + 0.25,
    z: swapped.z,
    intensity: 0.9,
    actorId: 'player',
    label: `QUICK SWAP: ${(presetName ?? swapped.name).toUpperCase()}`,
    colorHex: '#f59e0b',
  });
  return true;
}

export function activateAbility(
  sim: BattleSimulationState,
  side: 'player' | 'opponent',
  slotIndex: number
): boolean {
  if (sim.mutators.noAbilities) return false;
  if (sim.phase !== 'Combat' && sim.phase !== 'Critical') return false;
  const actor = side === 'player' ? sim.player : sim.opponent;
  const target = side === 'player' ? sim.opponent : sim.player;
  const slot = actor.abilitySlots[slotIndex];
  if (!slot) return false;
  if (slot.cooldownRemaining > 0) return false;

  const def: AbilityDefinition = getAbilityDefinition(slot.abilityId);
  if (actor.energy < def.energyCost) return false;
  if (def.resonanceCost > 0 && actor.resonance < def.resonanceCost) return false;

  actor.energy -= def.energyCost;
  if (def.resonanceCost > 0) {
    actor.resonance = Math.max(0, actor.resonance - def.resonanceCost);
  }
  slot.cooldownRemaining = def.cooldownSec;
  slot.activeRemaining = def.durationSec;

  if (side === 'player') {
    sim.abilitiesUsedByPlayer += 1;
    sim.adaptiveMemory.playerAbilitiesObserved += 1;
  }

  const dx = target.x - actor.x;
  const dz = target.z - actor.z;
  const dist = Math.hypot(dx, dz) || 1;
  const nx = dx / dist;
  const nz = dz / dist;

  switch (def.effectKind) {
    case 'DashStrike': {
      const dashSpeed = 4.6 * def.power;
      actor.vx += nx * dashSpeed;
      actor.vz += nz * dashSpeed;
      actor.omega = Math.min(actor.physical.initialAngularVelocity * 1.15, actor.omega + 6);
      if (def.statusApplied === 'Overdrive') {
        applyStatus(actor, 'Overdrive', def.durationSec, def.power);
      } else if (def.statusApplied === 'Burn' || def.element === 'Fire') {
        if (dist < 3.2) {
          applyStatus(target, 'Burn', def.durationSec, def.power);
        }
      }
      break;
    }
    case 'ElementalBurst': {
      if (dist < 3.0) {
        const push = 3.8 * def.power;
        target.vx += nx * push;
        target.vz += nz * push;
        const dmg = 9 * def.power;
        target.durability = Math.max(0, target.durability - dmg);
        recordAnalysisDamage(sim, target.entityId, 'ability', dmg);
        applyPartWear(sim, target, 7 * def.power);
        target.omega = Math.max(0, target.omega - 7 * def.power);
        if (def.statusApplied) {
          applyStatus(target, def.statusApplied, def.durationSec, def.power);
        }
      }
      break;
    }
    case 'EnergyDrain': {
      if (dist < 3.2) {
        const stolen = Math.min(target.energy, 18 * def.power);
        target.energy = Math.max(0, target.energy - stolen);
        actor.energy = Math.min(actor.maxEnergy, actor.energy + stolen);
        applyStatus(target, 'Drain', def.durationSec, def.power);
      }
      break;
    }
    case 'PurifyCleanse': {
      cleanseNegativeStatuses(actor);
      applyStatus(actor, 'Purify', def.durationSec, 1);
      if (def.type === 'Defensive') {
        applyStatus(actor, 'Shield', def.durationSec, def.power);
      }
      actor.stability = Math.min(100, actor.stability + 18);
      if (dist < 2.7) {
        applyStatus(target, 'Weaken', def.durationSec, 1);
      }
      break;
    }
    case 'BarrierShield': {
      applyStatus(actor, 'Shield', def.durationSec, def.power);
      actor.stability = Math.min(100, actor.stability + 14);
      break;
    }
    case 'SpinStabilize': {
      actor.stability = Math.min(100, actor.stability + (def.power > 5 ? def.power : 20));
      actor.omega = Math.min(actor.physical.initialAngularVelocity * 1.1, actor.omega + 9);
      actor.vx += -nz * 2.2;
      actor.vz += nx * 2.2;
      if (def.statusApplied === 'Weaken' && dist < 2.8) {
        applyStatus(target, 'Weaken', def.durationSec, 1);
      }
      break;
    }
    case 'TacticalSurge': {
      applyStatus(actor, 'Overdrive', def.durationSec, def.power);
      actor.vx += nx * 2.4;
      actor.vz += nz * 2.4;
      break;
    }
    case 'VortexPull': {
      const toCenterLen = Math.hypot(target.x, target.z) || 1;
      target.vx += (-target.x / toCenterLen) * 3.8;
      target.vz += (-target.z / toCenterLen) * 3.8;
      break;
    }
    case 'UltimateStrike': {
      if (actor.element === 'Light') {
        cleanseNegativeStatuses(actor);
        applyStatus(actor, 'Purify', def.durationSec, 1);
      } else if (def.element === 'Wind') {
        applyStatus(actor, 'Overdrive', def.durationSec, 1.35);
        actor.vx += nx * 1.8;
        actor.vz += nz * 1.8;
      }
      actor.vx += nx * 6.8;
      actor.vz += nz * 6.8;
      actor.omega = Math.min(actor.physical.initialAngularVelocity * 1.25, actor.omega + 14);
      if (dist < 3.6) {
        if (def.element === 'Water') {
          const toCLen = Math.hypot(target.x, target.z) || 1;
          target.vx += (-target.x / toCLen) * 4.2 + nx * 2.2;
          target.vz += (-target.z / toCLen) * 4.2 + nz * 2.2;
        } else {
          target.vx += nx * 5.2;
          target.vz += nz * 5.2;
        }
        if (def.element === 'Shadow') {
          const siphon = Math.min(16, target.energy);
          target.energy -= siphon;
          actor.energy = Math.min(actor.maxEnergy, actor.energy + siphon);
        }
        const ultDmg = 16 * def.power;
        target.durability = Math.max(0, target.durability - ultDmg);
        recordAnalysisDamage(sim, target.entityId, 'ability', ultDmg, true);
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

  const resBrokenPenalty = actor.brokenParts.includes('EnergyModule') ? 0.7 : 1.0;
  actor.resonance = Math.min(
    100,
    actor.resonance + (def.type === 'Ultimate' ? 0 : 12 * actor.physical.resonanceRate * resBrokenPenalty)
  );

  sim.events.push({
    type: 'ability',
    x: actor.x,
    y: actor.y + 0.25,
    z: actor.z,
    intensity: def.type === 'Ultimate' ? 1.4 : 0.85,
    isCritical: def.type === 'Ultimate',
    actorId: side,
    label: def.displayName,
    colorHex: def.colorHex,
  });

  // Capture the activation moment after all statuses & resources update
  recordHighlightFrame(sim, `${def.displayName.toUpperCase()} ACTIVATED`, def.type === 'Ultimate');

  return true;
}

const NEGATIVE_STATUSES: StatusEffectType[] = ['Burn', 'Slow', 'Freeze', 'Shock', 'Weaken', 'Drain'];

function cleanseNegativeStatuses(target: TopSimEntity): void {
  target.statuses = target.statuses.filter((s) => !NEGATIVE_STATUSES.includes(s.type));
  target.statDebuffs = [];
}

export function createStatDebuff(kind: StatDebuffKind, durationSec = 3.2): ActiveStatDebuff {
  switch (kind) {
    case 'Overheated':
      return {
        kind,
        label: 'Overheated',
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.82,
        defenseMult: 0.94,
        speedMult: 0.96,
        spinDrainMult: 1.35,
        energyRegenMult: 0.85,
        colorHex: '#ff5a2f',
      };
    case 'ArcDisruption':
      return {
        kind,
        label: 'Arc Disruption',
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.92,
        defenseMult: 0.9,
        speedMult: 0.85,
        spinDrainMult: 1.15,
        energyRegenMult: 0.8,
        colorHex: '#facc15',
      };
    case 'DragSnare':
      return {
        kind,
        label: 'Drag Snare',
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.95,
        defenseMult: 0.85,
        speedMult: 0.72,
        spinDrainMult: 1.2,
        energyRegenMult: 0.95,
        colorHex: '#d97706',
      };
    case 'ArmorCorrosion':
      return {
        kind,
        label: 'Armor Corroded',
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.88,
        defenseMult: 0.78,
        speedMult: 0.95,
        spinDrainMult: 1.1,
        energyRegenMult: 1.0,
        colorHex: '#f43f5e',
      };
    case 'VoidSiphon':
      return {
        kind,
        label: 'Void Siphon',
        remainingSec: durationSec,
        durationSec,
        attackMult: 0.84,
        defenseMult: 0.92,
        speedMult: 0.9,
        spinDrainMult: 1.22,
        energyRegenMult: 0.75,
        colorHex: '#a855f7',
      };
  }
}

export function applyStatDebuff(
  sim: BattleSimulationState,
  target: TopSimEntity,
  kind: StatDebuffKind,
  durationSec = 3.2,
  sourceLabel?: string
): void {
  if (hasStatus(target, 'Purify')) return;
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
      type: 'trapDebuff',
      x: target.x,
      y: target.y + 0.22,
      z: target.z,
      intensity: 0.8,
      actorId: target.entityId,
      label: sourceLabel
        ? `${target.name}: ${spec.label} (${sourceLabel})`
        : `${target.name}: ${spec.label}!`,
      colorHex: spec.colorHex,
    });
  }
}

function getCombinedDebuffMultipliers(entity: TopSimEntity) {
  let attackMult = 1.0;
  let defenseMult = 1.0;
  let speedMult = 1.0;
  let spinDrainMult = 1.0;
  let energyRegenMult = 1.0;
  for (const d of entity.statDebuffs) {
    attackMult *= d.attackMult;
    defenseMult *= d.defenseMult;
    speedMult *= d.speedMult;
    spinDrainMult *= d.spinDrainMult;
    energyRegenMult *= d.energyRegenMult;
  }
  return { attackMult, defenseMult, speedMult, spinDrainMult, energyRegenMult };
}

function applyStatus(
  target: TopSimEntity,
  type: StatusEffectType,
  durationSec: number,
  strength: number
): void {
  if (NEGATIVE_STATUSES.includes(type) && hasStatus(target, 'Purify')) {
    return; // Purify grants temporary immunity
  }
  const resistMult = target.element === 'Light' && NEGATIVE_STATUSES.includes(type) ? 0.85 : 1.0;
  const dur = durationSec * resistMult;
  const existing = target.statuses.find((s) => s.type === type);
  if (existing) {
    existing.remainingSec = Math.max(existing.remainingSec, dur);
    existing.strength = Math.max(existing.strength, strength);
  } else {
    target.statuses.push({ type, remainingSec: dur, strength });
  }
}

function hasStatus(entity: TopSimEntity, type: StatusEffectType): ActiveStatusEffect | undefined {
  return entity.statuses.find((s) => s.type === type);
}

function applyPartWear(sim: BattleSimulationState, target: TopSimEntity, wearPoints: number): void {
  const weights: [PartDurabilityKey, number][] = [
    ['AttackBlade', 0.3],
    ['ArmorRing', 0.25],
    ['WeightDisc', 0.14],
    ['EnergyModule', 0.11],
    ['PerformanceDriver', 0.11],
    ['SpiritCore', 0.09],
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
        type: 'partBreak',
        x: target.x,
        y: target.y + 0.22,
        z: target.z,
        vx: target.vx,
        vz: target.vz,
        intensity: 1.0,
        actorId: target.entityId,
        partKey,
        label: `${target.name}: ${partKey} SHATTERED!`,
        colorHex: '#f43f5e',
      });
    }
  }
}

function getModeModifiers(mode: BattleMode) {
  switch (mode) {
    case 'Attack':
      return { thrustMult: 1.18, impactMult: 1.22, damageTakenMult: 1.12, rotDragMult: 1.18, stabilityRecovery: -1.5 };
    case 'Defense':
      return { thrustMult: 0.78, impactMult: 0.88, damageTakenMult: 0.72, rotDragMult: 0.88, stabilityRecovery: 6.5 };
    case 'Speed':
      return { thrustMult: 1.32, impactMult: 1.05, damageTakenMult: 1.05, rotDragMult: 1.14, stabilityRecovery: 0 };
    case 'Stamina':
      return { thrustMult: 0.72, impactMult: 0.85, damageTakenMult: 0.92, rotDragMult: 0.72, stabilityRecovery: 4.5 };
    case 'Berserk':
      return { thrustMult: 1.4, impactMult: 1.42, damageTakenMult: 1.25, rotDragMult: 1.45, stabilityRecovery: -4.0 };
    case 'Counter':
      return { thrustMult: 0.82, impactMult: 1.35, damageTakenMult: 0.8, rotDragMult: 0.95, stabilityRecovery: 5.0 };
  }
}

function computeSteeringVector(
  actor: TopSimEntity,
  target: TopSimEntity,
  dt: number
): { fx: number; fz: number } {
  // Pure Physics Mode: Zero artificial steering/tangential propulsion!
  // Orbital curves and inward spiral motion come purely from bowl gravity + friction.
  if (!actor.debugSteeringEnabled) {
    return { fx: 0, fz: 0 };
  }

  const dx = target.x - actor.x;
  const dz = target.z - actor.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const dirX = dx / dist;
  const dirZ = dz / dist;

  const tanX = -dirZ;
  const tanZ = dirX;

  const rFromCenter = Math.hypot(actor.x, actor.z) || 0.001;
  const toCenterX = -actor.x / rFromCenter;
  const toCenterZ = -actor.z / rFromCenter;

  let desiredX = 0;
  let desiredZ = 0;
  let effort = 1.0;

  if (rFromCenter > ARENA_DISH_RADIUS * 0.84) {
    desiredX += toCenterX * 1.35;
    desiredZ += toCenterZ * 1.35;
  }

  switch (actor.tacticalCommand) {
    case 'Aggressive':
      desiredX += dirX * 1.2 + tanX * 0.28;
      desiredZ += dirZ * 1.2 + tanZ * 0.28;
      effort = 1.15;
      break;
    case 'Defensive':
      desiredX += toCenterX * 1.05 + tanX * 0.35;
      desiredZ += toCenterZ * 1.05 + tanZ * 0.35;
      effort = 0.65;
      break;
    case 'Chase': {
      const leadX = target.x + target.vx * 0.32 - actor.x;
      const leadZ = target.z + target.vz * 0.32 - actor.z;
      const leadLen = Math.hypot(leadX, leadZ) || 1;
      desiredX += leadX / leadLen;
      desiredZ += leadZ / leadLen;
      effort = 1.1;
      break;
    }
    case 'Circle': {
      const idealDist = 1.85;
      const radialPull = clamp((dist - idealDist) * 0.6, -0.7, 0.7);
      desiredX += tanX * 1.0 + dirX * radialPull;
      desiredZ += tanZ * 1.0 + dirZ * radialPull;
      effort = 0.92;
      break;
    }
    case 'Evade': {
      desiredX += -dirX * 0.75 + tanX * 0.85 + toCenterX * 0.55;
      desiredZ += -dirZ * 0.75 + tanZ * 0.85 + toCenterZ * 0.55;
      effort = 0.95;
      break;
    }
    case 'ConserveEnergy':
      desiredX += toCenterX * 0.55 + tanX * 0.35;
      desiredZ += toCenterZ * 0.55 + tanZ * 0.35;
      effort = 0.35;
      break;
    case 'HoldPosition':
      desiredX += toCenterX * 0.25;
      desiredZ += toCenterZ * 0.25;
      effort = 0.18;
      break;
    case 'Counter':
      desiredX += (dist < 1.3 ? dirX * 1.25 : toCenterX * 0.55 + tanX * 0.5);
      desiredZ += (dist < 1.3 ? dirZ * 1.25 : toCenterZ * 0.55 + tanZ * 0.5);
      effort = dist < 1.3 ? 1.25 : 0.45;
      break;
  }

  const len = Math.hypot(desiredX, desiredZ) || 1;
  desiredX /= len;
  desiredZ /= len;

  const modeMod = getModeModifiers(actor.battleMode);
  let speedFactor = modeMod.thrustMult * effort;

  if (hasStatus(actor, 'Overdrive')) speedFactor *= 1.35;
  if (hasStatus(actor, 'Slow')) speedFactor *= 0.68;
  if (hasStatus(actor, 'Freeze')) speedFactor *= 0.52;
  if (hasStatus(actor, 'Shock')) {
    const jitter = Math.sin(actor.wobblePhase * 3.1) * 0.35;
    const jx = desiredX * Math.cos(jitter) - desiredZ * Math.sin(jitter);
    const jz = desiredX * Math.sin(jitter) + desiredZ * Math.cos(jitter);
    desiredX = jx;
    desiredZ = jz;
  }

  const controlEffectiveness = 0.55 + (actor.stability / 100) * 0.45;
  const forceMag = actor.physical.accelerationForce * speedFactor * controlEffectiveness * dt * 14;

  return {
    fx: desiredX * forceMag,
    fz: desiredZ * forceMag,
  };
}

function stepEntityKinematics(
  entity: TopSimEntity,
  other: TopSimEntity,
  dt: number,
  sim: BattleSimulationState
): void {
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

  // Evaluate Dynamic Arena Hazard / Trap Zones & Dynamic Weather at current entity position
  const weatherDef = getWeatherDefinition(sim.weather);
  let localFrictionMult = arena.surfaceFrictionMult * weatherDef.gripFrictionMult;
  let localRotDragMult = arena.rotationalDragMult * weatherDef.rotDragMult;
  let hazardEnergyDelta = arena.energyModPerSec;
  const hazardMult = sim.mutators.doubleHazards ? 2.0 : 1.0;

  for (const hz of arena.hazardZones) {
    const hzPos = evaluateDynamicHazardPosition(hz, sim.elapsedTime);
    const distHz = Math.hypot(entity.x - hzPos.x, entity.z - hzPos.z);
    if (distHz <= hz.radius) {
      if (hz.kind === 'heat') {
        hazardEnergyDelta -= 3.5 * hazardMult;
        localRotDragMult += 0.45 * hazardMult;
        const heatDmg = (sim.mutators.doubleHazards ? 1.85 : 0.75) * dt;
        entity.durability = Math.max(0, entity.durability - heatDmg);
        recordAnalysisDamage(sim, entity.entityId, 'hazard', heatDmg);
      } else if (hz.kind === 'sand') {
        localFrictionMult += 0.65 * hazardMult;
      } else if (hz.kind === 'shock') {
        const pulse = Math.sin(sim.elapsedTime * 2.2) > 0.35;
        if (pulse) {
          hazardEnergyDelta += 3.2;
        } else {
          entity.stability = Math.max(0, entity.stability - 4.5 * hazardMult * dt);
          if (sim.mutators.doubleHazards) {
            const shockDmg = 1.15 * dt;
            entity.durability = Math.max(0, entity.durability - shockDmg);
            recordAnalysisDamage(sim, entity.entityId, 'hazard', shockDmg);
          }
        }
      } else if (hz.kind === 'void') {
        localRotDragMult += 0.25 * hazardMult;
        if (entity.element === 'Shadow' || entity.element === 'Light') {
          hazardEnergyDelta += 2.2;
        } else {
          hazardEnergyDelta -= 2.2 * hazardMult;
          const voidDmg = (sim.mutators.doubleHazards ? 1.45 : 0.55) * dt;
          entity.durability = Math.max(0, entity.durability - voidDmg);
          recordAnalysisDamage(sim, entity.entityId, 'hazard', voidDmg);
        }
      }
      if (hz.debuffKind) {
        applyStatDebuff(
          sim,
          entity,
          hz.debuffKind,
          (hz.debuffDurationSec ?? 3.2) * (sim.mutators.doubleHazards ? 1.6 : 1.0),
          hz.label
        );
      }
    }
  }

  const debuffs = getCombinedDebuffMultipliers(entity);

  // Energy regeneration + EnergyModule break penalty + Drain status + temporary trap debuff multiplier
  const waterRegenBonus = entity.element === 'Water' ? 1.12 : 1.0;
  const energyModulePenalty = entity.brokenParts.includes('EnergyModule') ? 0.55 : 1.0;
  const drainPenalty = hasStatus(entity, 'Drain') ? -4.5 : 0;
  if (hasStatus(entity, 'Drain')) {
    other.energy = Math.min(other.maxEnergy, other.energy + 3.2 * dt);
  }
  entity.energy = clamp(
    entity.energy +
      (entity.physical.energyRegenPerSec *
        waterRegenBonus *
        energyModulePenalty *
        debuffs.energyRegenMult +
        hazardEnergyDelta +
        drainPenalty) *
        dt,
    0,
    entity.maxEnergy
  );

  if (entity.battleMode === 'Berserk' && (entity.entityId === 'opponent' || entity.debugSteeringEnabled)) {
    entity.energy -= 6.5 * dt;
    if (entity.energy <= 0) {
      entity.energy = 0;
      entity.battleMode = 'Attack';
    }
  }

  // Steering (autonomous for AI / Debug, natural precession only for Player in Pure Physics mode)
  const steer = computeSteeringVector(entity, other, dt);
  const lightningAccelBonus = entity.element === 'Lightning' ? 1.1 : 1.0;
  entity.vx += (steer.fx * lightningAccelBonus * debuffs.speedMult) / (entity.physical.totalMassKg * 12);
  entity.vz += (steer.fz * lightningAccelBonus * debuffs.speedMult) / (entity.physical.totalMassKg * 12);

  if (weatherDef.gustAccel > 0) {
    const gustAngle = sim.elapsedTime * 0.42;
    const gustMag =
      (weatherDef.gustAccel * (0.65 + 0.35 * Math.sin(sim.elapsedTime * weatherDef.gustFreq))) /
      Math.max(0.03, entity.physical.totalMassKg * 18);
    entity.vx += Math.cos(gustAngle) * gustMag * dt;
    entity.vz += Math.sin(gustAngle) * gustMag * dt;
  }

  // Non-harmonic stadium dish restoring gravity + center pocket funnel
  // Preserves distinct launch angles across 0°–90° and supports wide multi-loop spirals!
  const distCenter = Math.hypot(entity.x, entity.z);
  const radialVelNow =
    distCenter > 0.001 ? (entity.vx * entity.x + entity.vz * entity.z) / distCenter : 0;
  const exitingOpenGate =
    distCenter > ARENA_DISH_RADIUS - 0.65 &&
    radialVelNow > 0.4 &&
    isAtRingOutGate(entity.x, entity.z);
  if (!exitingOpenGate) {
    const bowlAccel = computeBowlRadialAccel(entity.x, entity.z);
    const gravityMult = sim.mutators.doubleGravity ? 2.0 : 1.0;
    entity.vx += bowlAccel.ax * gravityMult * dt;
    entity.vz += bowlAccel.az * gravityMult * dt;
  }

  // Ground & spiral friction + temporary speed debuff damping
  const modeMod =
    !entity.debugSteeringEnabled
      ? getModeModifiers('Stamina')
      : getModeModifiers(entity.battleMode);

  const debuffDragPenalty = (1 - debuffs.speedMult) * 1.1;
  const spiralDrag =
    SPIRAL_BASE_DRAG +
    entity.physical.groundFriction * localFrictionMult * 0.30 +
    debuffDragPenalty;
  const damp = Math.exp(-spiralDrag * dt);
  entity.vx *= damp;
  entity.vz *= damp;

  const speed = Math.hypot(entity.vx, entity.vz);
  if (distCenter < 0.18 && speed < 0.045) {
    entity.vx *= 0.82;
    entity.vz *= 0.82;
  }

  const maxSpeed = (sim.arenaId === 'frozen' ? 7.6 : 6.8) * debuffs.speedMult;
  const currSpd = Math.hypot(entity.vx, entity.vz);
  if (currSpd > maxSpeed && currSpd > 0.001) {
    entity.vx = (entity.vx / currSpd) * maxSpeed;
    entity.vz = (entity.vz / currSpd) * maxSpeed;
  }

  entity.x += entity.vx * dt;
  entity.z += entity.vz * dt;

  // Dynamic & Static Solid Pillar Collisions (transfers moving-pillar momentum cleanly!)
  for (const pillar of arena.pillars) {
    const pState = evaluateDynamicPillarState(pillar, sim.elapsedTime);
    const pdx = entity.x - pState.x;
    const pdz = entity.z - pState.z;
    const pDist = Math.hypot(pdx, pdz);
    const minPDist = pillar.radius + entity.physical.effectiveRadiusM * 0.88;
    if (pDist < minPDist && pDist > 0.0001) {
      const pnx = pdx / pDist;
      const pnz = pdz / pDist;
      entity.x = pState.x + pnx * minPDist;
      entity.z = pState.z + pnz * minPDist;
      const relVx = entity.vx - pState.vx;
      const relVz = entity.vz - pState.vz;
      const relVn = relVx * pnx + relVz * pnz;
      if (relVn < 0) {
        const pillarBounceMult = 1 + clamp(arena.wallRestitution * 0.95 + entity.physical.restitution * 0.25, 0.42, 0.85);
        entity.vx -= pillarBounceMult * relVn * pnx;
        entity.vz -= pillarBounceMult * relVn * pnz;
        const pillarDmg = Math.abs(relVn) * 0.68 * (sim.mutators.doubleHazards ? 1.5 : 1.0);
        entity.durability = Math.max(0, entity.durability - pillarDmg);
        recordAnalysisDamage(sim, entity.entityId, 'pillar', pillarDmg);
        const inertiaRatio = clamp(entity.physical.momentOfInertia / REF_MOMENT_OF_INERTIA, 0.68, 1.65);
        const massRatio = clamp(entity.physical.totalMassKg / REF_TOP_MASS_KG, 0.72, 1.55);
        entity.omega = Math.max(0, entity.omega - (Math.abs(relVn) * 0.52) / Math.sqrt(inertiaRatio));
        if (Math.abs(relVn) > 1.8) {
          sim.cameraTrauma = Math.min(
            1,
            sim.cameraTrauma + clamp((Math.abs(relVn) / 5.5) * massRatio * 0.3, 0.08, 0.42)
          );
        }
        sim.events.push({
          type: 'pillarBounce',
          x: entity.x,
          y: arenaFloorHeight(entity.x, entity.z) + 0.15,
          z: entity.z,
          intensity: clamp(Math.abs(relVn) / 4.5, 0.25, 0.95),
          actorId: entity.entityId,
          nx: Number(pnx.toFixed(3)),
          nz: Number(pnz.toFixed(3)),
        });
        if (pillar.debuffKind) {
          applyStatDebuff(
            sim,
            entity,
            pillar.debuffKind,
            pillar.debuffDurationSec ?? 3.2,
            pillar.motion ? 'Moving Pillar' : 'Obsidian Pillar'
          );
        }
      }
    }
  }

  entity.y = arenaFloorHeight(entity.x, entity.z);

  // Rotational energy loss & drag (penalized by broken driver & temporary debuffs)
  const driverBrokenPenalty = entity.brokenParts.includes('PerformanceDriver') ? 1.45 : 1.0;
  const wobbleDragPenalty = 1 + (1 - entity.stability / 100) * 0.65;
  const frictionSpinLoss = entity.physical.groundFriction * localFrictionMult * (0.5 + speed * 0.18);
  const burnPenalty = hasStatus(entity, 'Burn') ? 1.85 : 0;
  const drainSpinPenalty = hasStatus(entity, 'Drain') ? 1.3 : 0;

  const totalSpinDecay =
    ((entity.physical.rotationalDrag *
      185 *
      localRotDragMult *
      driverBrokenPenalty *
      modeMod.rotDragMult *
      wobbleDragPenalty +
      frictionSpinLoss * 1.35 +
      burnPenalty +
      drainSpinPenalty) *
      debuffs.spinDrainMult) *
    dt;

  const burnDmg = (hasStatus(entity, 'Burn') ? 0.65 : 0) + (hasStatus(entity, 'Drain') ? 0.45 : 0);
  if (burnDmg > 0) {
    const tickStatusDmg = burnDmg * dt;
    entity.durability = Math.max(0, entity.durability - tickStatusDmg);
    recordAnalysisDamage(sim, entity.entityId, 'status', tickStatusDmg);
  }

  entity.omega = Math.max(
    sim.mutators.ringOutOnly ? MIN_SPIN_OMEGA * 1.15 : 0,
    entity.omega - totalSpinDecay
  );
  entity.spinAngle = (entity.spinAngle + entity.omega * dt) % (Math.PI * 200);
  entity.rotationalEnergy = 0.5 * entity.physical.momentOfInertia * entity.omega * entity.omega;
  entity.staminaRatio = clamp(
    entity.rotationalEnergy / Math.max(0.0001, entity.initialRotationalEnergy),
    0,
    1
  );

  // Stability & Wobble physics (influenced subtly by arena weather)
  const iceStabilityBonus = entity.element === 'Ice' ? 1.1 : 1.0;
  const weightBrokenMult = entity.brokenParts.includes('WeightDisc') ? 0.65 : 1.0;
  if (weatherDef.stabilityDrainPerSec > 0) {
    entity.stability = clamp(entity.stability - weatherDef.stabilityDrainPerSec * dt, 0, 100);
  }
  if (entity.staminaRatio < 0.36) {
    const lowDrain = (0.36 - entity.staminaRatio) * 28 * dt;
    entity.stability = clamp(entity.stability - lowDrain, 0, 100);
  } else {
    entity.stability = clamp(
      entity.stability +
        (3.2 + modeMod.stabilityRecovery) *
          iceStabilityBonus *
          weightBrokenMult *
          weatherDef.stabilityRecoveryMult *
          dt,
      0,
      100
    );
  }

  const targetTilt = ((100 - entity.stability) / 100) * 0.42;
  entity.wobbleTilt += (targetTilt - entity.wobbleTilt) * Math.min(1, dt * 8);
  entity.wobblePhase += (8 + (1 - entity.staminaRatio) * 10) * dt;

  // Solid Perimeter Wall & Ring-Out Gate Evaluation
  // Ensure even full outer attack-blade meshes (r_blade <= 0.62m) NEVER clip past inner wall (ARENA_DISH_RADIUS = 4.25m)!
  const distFromCenter = Math.hypot(entity.x, entity.z);
  const bladeMargin = Math.max(0.62, entity.physical.effectiveRadiusM * 1.38);
  const maxAllowed = ARENA_DISH_RADIUS - bladeMargin;
  if (distFromCenter > maxAllowed) {
    const nx = entity.x / distFromCenter;
    const nz = entity.z / distFromCenter;
    const radialVel = entity.vx * nx + entity.vz * nz;
    const earthAnchor = entity.element === 'Earth' ? 1.14 : 1.0;

    const atGate = isAtRingOutGate(entity.x, entity.z);
    const gateSpeedThreshold = (sim.mutators.ringOutOnly ? 1.35 : 1.75) * earthAnchor;
    if (distFromCenter > ARENA_RING_OUT_RADIUS) {
      entity.ringedOut = true;
      sim.events.push({
        type: 'ringOut',
        x: entity.x,
        y: entity.y,
        z: entity.z,
        intensity: 1.2,
        actorId: entity.entityId,
        label: `${entity.name} Ring Out!`,
      });
      return;
    }

    if (atGate && (radialVel > gateSpeedThreshold || distFromCenter > maxAllowed + 0.16)) {
      // Top has entered an open exit gap with sufficient outward drive — allow clean unobstructed exit
    } else if (atGate) {
      // Gentle outer-lip curb for slow grazing tops near an open gate without an invisible wall rebound
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
      // Hard wall containment: ALWAYS keep blades inside the solid wall sectors between gates
      entity.x = nx * (maxAllowed - 0.015);
      entity.z = nz * (maxAllowed - 0.015);
      entity.y = arenaFloorHeight(entity.x, entity.z);
      if (radialVel > 0) {
        const tanX = -nz;
        const tanZ = nx;
        const tanVel = entity.vx * tanX + entity.vz * tanZ;
        const inertiaRatio = clamp(entity.physical.momentOfInertia / REF_MOMENT_OF_INERTIA, 0.68, 1.65);
        const massRatio = clamp(entity.physical.totalMassKg / REF_TOP_MASS_KG, 0.72, 1.55);
        // Arena-calibrated wall restitution + surface scrape friction so rebounds vary cleanly per stadium
        const wallBounceFactor = clamp(
          arena.wallRestitution * 0.85 + entity.physical.restitution * 0.14,
          0.2,
          0.58
        );
        const wallScrapeRetention = clamp(0.74 - arena.surfaceFrictionMult * 0.11, 0.54, 0.72);
        const inwardSpeed = Math.max(0.28, radialVel * wallBounceFactor);
        const dampedTanVel = tanVel * wallScrapeRetention;
        entity.vx = -nx * inwardSpeed + tanX * dampedTanVel;
        entity.vz = -nz * inwardSpeed + tanZ * dampedTanVel;
        entity.omega = Math.max(0, entity.omega - (radialVel * 0.45) / Math.sqrt(inertiaRatio));

        if (radialVel > 1.8) {
          sim.cameraTrauma = Math.min(
            1,
            sim.cameraTrauma + clamp((radialVel / 5.5) * massRatio * 0.28, 0.08, 0.36)
          );
        }

        if (radialVel > 0.85) {
          sim.events.push({
            type: 'wallBounce',
            x: entity.x,
            y: entity.y + 0.12,
            z: entity.z,
            intensity: clamp(radialVel / 4.5, 0.2, 0.9),
            actorId: entity.entityId,
            nx: Number((-nx).toFixed(3)),
            nz: Number((-nz).toFixed(3)),
          });
        }
      }
    }
  }

  // Knockout evaluation: SpiritCore destroyed or 3+ broken parts + critical stability collapse (bypassed in Ring-Out Only mode)
  const durRatio = entity.durability / Math.max(1, entity.maxDurability);
  if (
    !sim.mutators.ringOutOnly &&
    (entity.brokenParts.includes('SpiritCore') ||
      entity.brokenParts.length >= 3 ||
      (entity.stability <= 0 && durRatio < 0.2))
  ) {
    entity.knockedOut = true;
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.6);
    sim.events.push({
      type: 'knockout',
      x: entity.x,
      y: entity.y + 0.2,
      z: entity.z,
      intensity: 1.45,
      isCritical: true,
      actorId: entity.entityId,
      label: `${entity.name} KNOCKOUT!`,
    });
    return;
  }

  // Low spin tracking for Spin Finish
  if (entity.omega < MIN_SPIN_OMEGA) {
    entity.lowSpinTimer += dt;
  } else {
    entity.lowSpinTimer = Math.max(0, entity.lowSpinTimer - dt * 2);
  }
}

function resolveTopCollision(sim: BattleSimulationState): void {
  const a = sim.player;
  const b = sim.opponent;
  if (a.ringedOut || b.ringedOut || a.burstOut || b.burstOut || a.knockedOut || b.knockedOut) {
    return;
  }

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const minDist = a.physical.effectiveRadiusM + b.physical.effectiveRadiusM;

  if (dist >= minDist || dist < 0.0001) return;

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

  const modeA =
    a.entityId === 'player' && !a.debugSteeringEnabled
      ? getModeModifiers('Stamina')
      : getModeModifiers(a.battleMode);
  const modeB = getModeModifiers(b.battleMode);

  const inertiaRatioA = clamp(a.physical.momentOfInertia / REF_MOMENT_OF_INERTIA, 0.68, 1.65);
  const inertiaRatioB = clamp(b.physical.momentOfInertia / REF_MOMENT_OF_INERTIA, 0.68, 1.65);
  const massRatioA = clamp(a.physical.totalMassKg / REF_TOP_MASS_KG, 0.72, 1.55);
  const massRatioB = clamp(b.physical.totalMassKg / REF_TOP_MASS_KG, 0.72, 1.55);
  const avgInertiaRatio = (inertiaRatioA + inertiaRatioB) * 0.5;
  const avgMassRatio = (massRatioA + massRatioB) * 0.5;

  const baseRestitution = clamp((a.physical.restitution + b.physical.restitution) * 0.5 + 0.35, 0.5, 0.94);
  const heavyImpactFactor = clamp((Math.abs(velAlongNormal) - 1.6) / 3.4, 0, 1);
  // Heavy-mass dampening: high-inertia builds absorb part of sharp elastic snap so clashes feel grounded
  const heavyShockDamp = clamp(1.02 - (avgInertiaRatio - 1.0) * 0.14 * heavyImpactFactor, 0.84, 1.03);
  const e = clamp(baseRestitution * heavyShockDamp, 0.45, 0.94);
  let j = (-(1 + e) * velAlongNormal) / invMassSum;

  const heavyMinBounceDamp = clamp(1.06 - (avgMassRatio - 1.0) * 0.24, 0.84, 1.08);
  const minSeparationSpeed =
    (2.45 + 0.45 * ((a.omega / 110) * modeA.impactMult + (b.omega / 110) * modeB.impactMult)) *
    heavyMinBounceDamp *
    (sim.mutators.ringOutOnly ? 1.2 : 1.0);
  j = Math.max(j, minSeparationSpeed / invMassSum);

  const impulseX = j * nx;
  const impulseZ = j * nz;

  a.vx -= impulseX * invMassA;
  a.vz -= impulseZ * invMassA;
  b.vx += impulseX * invMassB;
  b.vz += impulseZ * invMassB;

  // Rotational-inertia weighted tangential deflection: high momentOfInertia raises threshold against sudden swerving
  const tx = -nz;
  const tz = nx;
  const invInertiaA = 1 / Math.max(0.004, a.physical.momentOfInertia);
  const invInertiaB = 1 / Math.max(0.004, b.physical.momentOfInertia);
  const invInertiaSum = invInertiaA + invInertiaB;
  const inertiaScale = clamp(1 / Math.pow(avgInertiaRatio, 0.5), 0.72, 1.18);
  const spinDiffKick = ((a.omega - b.omega) * 0.011 + 0.85) * Math.sign(a.omega + b.omega) * inertiaScale;
  const shareA = (invInertiaA / invInertiaSum) * 1.04;
  const shareB = (invInertiaB / invInertiaSum) * 1.04;
  a.vx += tx * spinDiffKick * shareA;
  a.vz += tz * spinDiffKick * shareA;
  b.vx -= tx * spinDiffKick * shareB;
  b.vz -= tz * spinDiffKick * shareB;

  const impactSpeed = Math.abs(velAlongNormal) + 1.2;
  if (impactSpeed > 4.2) {
    sim.adaptiveMemory.highSpeedClashes += 1;
  }

  const isCritical =
    impactSpeed > 4.6 ||
    Math.random() < (a.attributes.critical + b.attributes.critical) / 1000;
  const critMult = isCritical ? 1.32 : 1.0;

  // Dual-Element & Status Calculations
  const elemAonB = getDualElementalMultiplier(a.element, a.secondaryElement, b.element, b.secondaryElement);
  const elemBonA = getDualElementalMultiplier(b.element, b.secondaryElement, a.element, a.secondaryElement);

  const aShield = hasStatus(a, 'Shield')?.strength ?? 0;
  const bShield = hasStatus(b, 'Shield')?.strength ?? 0;
  const aWeakMult = hasStatus(a, 'Weaken') ? 0.78 : 1.0;
  const bWeakMult = hasStatus(b, 'Weaken') ? 0.78 : 1.0;

  const fireBonusA = a.element === 'Fire' ? 1.08 : 1.0;
  const fireBonusB = b.element === 'Fire' ? 1.08 : 1.0;
  const earthResistA = a.element === 'Earth' ? 0.88 : 1.0;
  const earthResistB = b.element === 'Earth' ? 0.88 : 1.0;

  const aBladePenalty = a.brokenParts.includes('AttackBlade') ? 0.82 : 1.0;
  const bBladePenalty = b.brokenParts.includes('AttackBlade') ? 0.82 : 1.0;
  const aArmorPenalty = a.brokenParts.includes('ArmorRing') ? 1.25 : 1.0;
  const bArmorPenalty = b.brokenParts.includes('ArmorRing') ? 1.25 : 1.0;

  const aDebuffs = getCombinedDebuffMultipliers(a);
  const bDebuffs = getCombinedDebuffMultipliers(b);

  const atkRatioAonB = clamp(
    Math.pow(
      (a.attributes.attack * aDebuffs.attackMult) /
        Math.max(25, b.attributes.defense * bDebuffs.defenseMult),
      0.82
    ),
    0.65,
    1.65
  );
  const atkRatioBonA = clamp(
    Math.pow(
      (b.attributes.attack * bDebuffs.attackMult) /
        Math.max(25, a.attributes.defense * aDebuffs.defenseMult),
      0.82
    ),
    0.65,
    1.65
  );

  const rawDmgToB =
    (1.35 + impactSpeed * 0.56) *
    atkRatioAonB *
    modeA.impactMult *
    modeB.damageTakenMult *
    elemAonB *
    fireBonusA *
    aWeakMult *
    aBladePenalty *
    bArmorPenalty *
    earthResistB *
    (1 - bShield) *
    critMult;

  const rawDmgToA =
    (1.35 + impactSpeed * 0.56) *
    atkRatioBonA *
    modeB.impactMult *
    modeA.damageTakenMult *
    elemBonA *
    fireBonusB *
    bWeakMult *
    bBladePenalty *
    aArmorPenalty *
    earthResistA *
    (1 - aShield) *
    critMult;

  a.durability = Math.max(0, a.durability - rawDmgToA);
  b.durability = Math.max(0, b.durability - rawDmgToB);
  recordAnalysisDamage(sim, 'player', 'clash', rawDmgToA, isCritical);
  recordAnalysisDamage(sim, 'opponent', 'clash', rawDmgToB, isCritical);

  applyPartWear(sim, a, rawDmgToA * 3.1);
  applyPartWear(sim, b, rawDmgToB * 3.1);

  // Shadow passive: siphons energy on clash
  if (a.element === 'Shadow') {
    const siphon = 2.4;
    b.energy = Math.max(0, b.energy - siphon);
    a.energy = Math.min(a.maxEnergy, a.energy + siphon);
  }
  if (b.element === 'Shadow') {
    const siphon = 2.4;
    a.energy = Math.max(0, a.energy - siphon);
    b.energy = Math.min(b.maxEnergy, b.energy + siphon);
  }

  a.omega = Math.max(0, a.omega - (rawDmgToA * 0.42) / Math.sqrt(inertiaRatioA));
  b.omega = Math.max(0, b.omega - (rawDmgToB * 0.42) / Math.sqrt(inertiaRatioB));

  a.stability = Math.max(0, a.stability - rawDmgToA * 1.15 * clamp(1 / Math.pow(inertiaRatioA, 0.45), 0.76, 1.18));
  b.stability = Math.max(0, b.stability - rawDmgToB * 1.15 * clamp(1 / Math.pow(inertiaRatioB, 0.45), 0.76, 1.18));

  const aResPenalty = a.brokenParts.includes('EnergyModule') ? 0.7 : 1.0;
  const bResPenalty = b.brokenParts.includes('EnergyModule') ? 0.7 : 1.0;
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
      peakImpulse: Number(impactSpeed.toFixed(2)),
    };
  }
  const curStreak = sim.activeClashStreak;
  const bestStreak = sim.analysis.longestClashStreak;
  if (
    curStreak &&
    (!bestStreak ||
      curStreak.durationSec > bestStreak.durationSec ||
      (curStreak.durationSec === bestStreak.durationSec && curStreak.hitCount > bestStreak.hitCount))
  ) {
    sim.analysis.longestClashStreak = { ...curStreak };
  }

  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5 + 0.16;
  const midZ = (a.z + b.z) * 0.5;

  if (!sim.mutators.ringOutOnly && b.durability <= 0 && (impactSpeed > 2.2 || isCritical)) {
    b.burstOut = true;
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.14);
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.78);
    sim.cameraTrauma = 1.0;
    sim.pendingHighlightMarker = {
      clashX: midX,
      clashZ: midZ,
      isCritical: true,
      eventLabel: 'BURST FINISH!',
    };
    sim.events.push({
      type: 'burst',
      x: b.x,
      y: b.y + 0.25,
      z: b.z,
      vx: b.vx,
      vz: b.vz,
      nx: Number(nx.toFixed(3)),
      nz: Number(nz.toFixed(3)),
      intensity: 1.6,
      isCritical: true,
      actorId: 'opponent',
      label: 'BURST FINISH!',
    });
    return;
  }
  if (!sim.mutators.ringOutOnly && a.durability <= 0 && (impactSpeed > 2.2 || isCritical)) {
    a.burstOut = true;
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.14);
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.78);
    sim.cameraTrauma = 1.0;
    sim.pendingHighlightMarker = {
      clashX: midX,
      clashZ: midZ,
      isCritical: true,
      eventLabel: 'BURST FINISH!',
    };
    sim.events.push({
      type: 'burst',
      x: a.x,
      y: a.y + 0.25,
      z: a.z,
      vx: a.vx,
      vz: a.vz,
      nx: Number((-nx).toFixed(3)),
      nz: Number((-nz).toFixed(3)),
      intensity: 1.6,
      isCritical: true,
      actorId: 'player',
      label: 'BURST FINISH!',
    });
    return;
  }

  sim.pendingHighlightMarker = {
    clashX: midX,
    clashZ: midZ,
    isCritical,
    eventLabel: isCritical ? 'CRITICAL CLASH!' : undefined,
  };

  const combinedMassFactor = clamp(
    (a.physical.totalMassKg + b.physical.totalMassKg) / (REF_TOP_MASS_KG * 2),
    0.72,
    1.5
  );
  const impulseWeight = clamp((j / (REF_TOP_MASS_KG * 2.8)) * combinedMassFactor, 0.42, 1.55);

  if (isCritical || impactSpeed > 3.4) {
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.095);
    sim.slowMotionTimer = Math.max(sim.slowMotionTimer, 0.24);
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + clamp(0.46 + impulseWeight * 0.34, 0.54, 0.94));
  } else {
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.025);
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + clamp(0.18 + impulseWeight * 0.24, 0.22, 0.64));
  }

  sim.events.push({
    type: 'collision',
    x: midX,
    y: midY,
    z: midZ,
    nx: Number(nx.toFixed(3)),
    nz: Number(nz.toFixed(3)),
    intensity: clamp(impactSpeed / 5.5, 0.25, 1.3),
    isCritical,
    label: isCritical ? 'CRITICAL CLASH!' : undefined,
  });
}

function checkBossPhaseTransitions(sim: BattleSimulationState): void {
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
        sim.player.vx += (dx / d) * 3.2;
        sim.player.vz += (dz / d) * 3.2;
      }
      sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.5);
      sim.events.push({
        type: 'bossPhase',
        x: opp.x,
        y: opp.y + 0.3,
        z: opp.z,
        intensity: 1.2,
        isCritical: true,
        actorId: 'opponent',
        label: bp.bannerText,
        colorHex: '#f43f5e',
      });
    }
  });
}

function aiThink(sim: BattleSimulationState): void {
  const ai = sim.opponent;
  const player = sim.player;
  const dist = Math.hypot(player.x - ai.x, player.z - ai.z);
  const aiCenterDist = Math.hypot(ai.x, ai.z);
  const personality = sim.aiPersonality;

  const scores: Record<TacticalCommand, number> = {
    Aggressive: 0.3,
    Defensive: 0.3,
    Chase: 0.3,
    Circle: 0.3,
    Evade: 0.2,
    ConserveEnergy: 0.2,
    HoldPosition: 0.15,
    Counter: 0.15,
  };

  if (personality === 'Aggressive' || personality === 'HeavyAssault') {
    scores.Aggressive += 0.55;
    scores.Chase += 0.45;
  } else if (personality === 'Defensive') {
    scores.Defensive += 0.55;
    scores.HoldPosition += 0.4;
    scores.ConserveEnergy += 0.3;
  } else if (personality === 'Evasive') {
    scores.Evade += 0.5;
    scores.Circle += 0.55;
  } else if (personality === 'Tactical') {
    scores.Circle += 0.4;
    scores.Chase += 0.3;
    scores.Counter += 0.35;
  } else if (personality === 'Adaptive') {
    // Adaptive AI analyzes player's speed/ability habits
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

  let bestCmd: TacticalCommand = ai.tacticalCommand;
  let bestScore = -999;
  (Object.keys(scores) as TacticalCommand[]).forEach((cmd) => {
    const noise = sim.aiDifficulty === 'Easy' ? Math.random() * 0.45 : Math.random() * 0.12;
    if (scores[cmd] + noise > bestScore) {
      bestScore = scores[cmd] + noise;
      bestCmd = cmd;
    }
  });
  setTacticalCommand(sim, 'opponent', bestCmd);

  if (ai.modeCooldown <= 0) {
    if (personality === 'Adaptive' && sim.adaptiveMemory.highSpeedClashes >= 2 && ai.durability > ai.maxDurability * 0.35) {
      setBattleMode(sim, 'opponent', 'Counter');
    } else if (ai.durability < ai.maxDurability * 0.32 || ai.stability < 38) {
      setBattleMode(sim, 'opponent', 'Defense');
    } else if (
      (personality === 'Aggressive' || personality === 'HeavyAssault') &&
      ai.energy > 45 &&
      ai.staminaRatio > 0.55
    ) {
      setBattleMode(sim, 'opponent', 'Berserk');
    } else if (ai.staminaRatio < 0.38) {
      setBattleMode(sim, 'opponent', 'Stamina');
    } else if (personality === 'Evasive' || dist > 3.0) {
      setBattleMode(sim, 'opponent', 'Speed');
    } else if (personality === 'Aggressive') {
      setBattleMode(sim, 'opponent', 'Attack');
    }
  }

  if (!sim.mutators.noAbilities) {
    if (ai.resonance >= 100 && ai.energy >= 20) {
      activateAbility(sim, 'opponent', 3);
      return;
    }
    if (ai.durability < ai.maxDurability * 0.55 || ai.stability < 52) {
      if (activateAbility(sim, 'opponent', 1)) return;
    }
    if (dist < 2.4 && ai.energy >= 30) {
      if (activateAbility(sim, 'opponent', 0)) return;
    }
    if (ai.energy >= 45 && sim.aiDifficulty !== 'Easy') {
      activateAbility(sim, 'opponent', 2);
    }
  }
}

function evaluateVictoryConditions(sim: BattleSimulationState): void {
  if (sim.phase !== 'Combat' && sim.phase !== 'Critical') return;

  const p = sim.player;
  const o = sim.opponent;

  if (!sim.mutators.ringOutOnly) {
    if (o.burstOut) {
      finishBattle(sim, 'player', 'BurstFinish');
      return;
    }
    if (p.burstOut) {
      finishBattle(sim, 'opponent', 'BurstFinish');
      return;
    }

    if (o.knockedOut) {
      finishBattle(sim, 'player', 'Knockout');
      return;
    }
    if (p.knockedOut) {
      finishBattle(sim, 'opponent', 'Knockout');
      return;
    }
  }

  if (o.ringedOut) {
    finishBattle(sim, 'player', 'RingOut');
    return;
  }
  if (p.ringedOut) {
    finishBattle(sim, 'opponent', 'RingOut');
    return;
  }

  if (!sim.mutators.ringOutOnly) {
    if (o.lowSpinTimer >= 0.6 && p.lowSpinTimer < 0.6) {
      sim.events.push({
        type: 'spinFinish',
        x: o.x,
        y: o.y,
        z: o.z,
        intensity: 1.0,
        actorId: 'opponent',
        label: 'SPIN FINISH!',
      });
      finishBattle(sim, 'player', 'SpinFinish');
      return;
    }
    if (p.lowSpinTimer >= 0.6 && o.lowSpinTimer < 0.6) {
      sim.events.push({
        type: 'spinFinish',
        x: p.x,
        y: p.y,
        z: p.z,
        intensity: 1.0,
        actorId: 'player',
        label: 'SPIN FINISH!',
      });
      finishBattle(sim, 'opponent', 'SpinFinish');
      return;
    }
  }

  if (sim.elapsedTime >= MAX_BATTLE_DURATION) {
    const pScore = p.staminaRatio * 0.65 + (p.durability / p.maxDurability) * 0.35;
    const oScore = o.staminaRatio * 0.65 + (o.durability / o.maxDurability) * 0.35;
    finishBattle(sim, pScore >= oScore ? 'player' : 'opponent', 'Survival');
    return;
  }

  const isCriticalNow =
    p.staminaRatio < 0.28 ||
    o.staminaRatio < 0.28 ||
    p.durability / p.maxDurability < 0.25 ||
    o.durability / p.maxDurability < 0.25;

  if (isCriticalNow && sim.phase === 'Combat') {
    sim.phase = 'Critical';
    sim.events.push({
      type: 'criticalPhase',
      x: 0,
      y: 0.5,
      z: 0,
      intensity: 0.8,
      label: 'CRITICAL PHASE!',
    });
  }
}

function captureHighlightObstacles(sim: BattleSimulationState): MatchHighlightObstacleSnapshot[] {
  const arena = getArenaDefinition(sim.arenaId);
  const list: MatchHighlightObstacleSnapshot[] = [];
  for (const p of arena.pillars) {
    const st = evaluateDynamicPillarState(p, sim.elapsedTime);
    list.push({ x: st.x, z: st.z, radius: p.radius, kind: 'pillar' });
  }
  for (const hz of arena.hazardZones) {
    const pos = evaluateDynamicHazardPosition(hz, sim.elapsedTime);
    list.push({ x: pos.x, z: pos.z, radius: hz.radius, kind: hz.kind });
  }
  return list;
}

function mapHighlightStatDebuffs(debuffs: ActiveStatDebuff[]): HighlightStatDebuff[] {
  return debuffs.map((d) => ({
    kind: d.kind,
    label: d.label,
    remainingSec: Number(d.remainingSec.toFixed(2)),
    colorHex: d.colorHex,
  }));
}

function recordHighlightFrame(
  sim: BattleSimulationState,
  forceMarker?: string,
  markCritical = false
): void {
  const marker = sim.pendingHighlightMarker;
  const pStatusFlags = getPlayerActiveStatuses(sim.player);
  const pActiveSlotIdx = sim.player.abilitySlots.findIndex((s) => s.activeRemaining > 0);

  const oStatusFlags = getPlayerActiveStatuses(sim.opponent);
  const oActiveSlotIdx = sim.opponent.abilitySlots.findIndex((s) => s.activeRemaining > 0);

  const frame: MatchHighlightFrame = {
    t: sim.elapsedTime,
    px: sim.player.x,
    pz: sim.player.z,
    pVx: sim.player.vx,
    pVz: sim.player.vz,
    pSpinAngle: sim.player.spinAngle,
    pRpm: Math.round(sim.player.omega * 9.55),
    pStaminaPct: Math.round(sim.player.staminaRatio * 100),
    pDurabilityPct: Math.round((sim.player.durability / Math.max(1, sim.player.maxDurability)) * 100),
    pEnergyPct: Math.round((sim.player.energy / Math.max(1, sim.player.maxEnergy)) * 100),
    pResonance: Math.round(sim.player.resonance),
    pPartDurability: { ...sim.player.partDurability },
    pBrokenParts: [...sim.player.brokenParts],
    pShield: pStatusFlags.isShieldActive,
    pFire: pStatusFlags.isFireActive,
    pActiveSlotIdx: pActiveSlotIdx >= 0 ? pActiveSlotIdx : undefined,
    pActiveSlots: pStatusFlags.activeSlotFlags,
    pStatuses: sim.player.statuses.map((s) => s.type),
    pStatDebuffs: mapHighlightStatDebuffs(sim.player.statDebuffs),
    ox: sim.opponent.x,
    oz: sim.opponent.z,
    oVx: sim.opponent.vx,
    oVz: sim.opponent.vz,
    oSpinAngle: sim.opponent.spinAngle,
    oRpm: Math.round(sim.opponent.omega * 9.55),
    oStaminaPct: Math.round(sim.opponent.staminaRatio * 100),
    oDurabilityPct: Math.round((sim.opponent.durability / Math.max(1, sim.opponent.maxDurability)) * 100),
    oEnergyPct: Math.round((sim.opponent.energy / Math.max(1, sim.opponent.maxEnergy)) * 100),
    oResonance: Math.round(sim.opponent.resonance),
    oPartDurability: { ...sim.opponent.partDurability },
    oBrokenParts: [...sim.opponent.brokenParts],
    oShield: oStatusFlags.isShieldActive,
    oFire: oStatusFlags.isFireActive,
    oActiveSlotIdx: oActiveSlotIdx >= 0 ? oActiveSlotIdx : undefined,
    oActiveSlots: oStatusFlags.activeSlotFlags,
    oStatuses: sim.opponent.statuses.map((s) => s.type),
    oStatDebuffs: mapHighlightStatDebuffs(sim.opponent.statDebuffs),
    clashX: marker?.clashX,
    clashZ: marker?.clashZ,
    isCritical: Boolean(marker?.isCritical) || markCritical,
    eventLabel: forceMarker ?? marker?.eventLabel,
    obstacles: captureHighlightObstacles(sim),
  };
  sim.pendingHighlightMarker = null;
  sim.highlightFrames.push(frame);
  if (sim.highlightFrames.length > 350) {
    sim.highlightFrames.shift();
  }
}

export function buildMatchHighlightClip(
  sim: BattleSimulationState,
  perspective: 'player' | 'opponent' = 'player'
): MatchHighlightClip | undefined {
  if (sim.highlightFrames.length < 2) return undefined;
  const arena = getArenaDefinition(sim.arenaId);
  const frames = sim.highlightFrames.slice(-250);
  const lastFrame = frames[frames.length - 1];
  const rawWinner = sim.winnerSide ?? 'player';

  if (perspective === 'opponent') {
    return {
      arenaId: sim.arenaId,
      playerName: sim.opponent.name,
      opponentName: sim.player.name,
      playerColor: ELEMENTS[sim.opponent.element]?.primaryColor ?? '#f43f5e',
      opponentColor: ELEMENTS[sim.player.element]?.primaryColor ?? '#38bdf8',
      floorPalette: arena.floorPalette,
      arenaPrimaryColor: arena.primaryColor,
      arenaAccentColor: arena.accentColor,
      winnerSide: rawWinner === 'player' ? 'opponent' : 'player',
      finishReason: sim.finishReason ?? 'Survival',
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
        pPartDurability: f.oPartDurability ? { ...f.oPartDurability } : undefined,
        pBrokenParts: f.oBrokenParts ? [...f.oBrokenParts] : undefined,
        pShield: f.oShield,
        pFire: f.oFire,
        pActiveSlotIdx: f.oActiveSlotIdx,
        pActiveSlots: f.oActiveSlots,
        pStatuses: f.oStatuses,
        pStatDebuffs: f.oStatDebuffs ? f.oStatDebuffs.map((d) => ({ ...d })) : undefined,
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
        oPartDurability: f.pPartDurability ? { ...f.pPartDurability } : undefined,
        oBrokenParts: f.pBrokenParts ? [...f.pBrokenParts] : undefined,
        oShield: f.pShield,
        oFire: f.pFire,
        oActiveSlotIdx: f.pActiveSlotIdx,
        oActiveSlots: f.pActiveSlots,
        oStatuses: f.pStatuses,
        oStatDebuffs: f.pStatDebuffs ? f.pStatDebuffs.map((d) => ({ ...d })) : undefined,
        clashX: f.clashX,
        clashZ: f.clashZ,
        isCritical: f.isCritical,
        eventLabel: f.eventLabel,
        obstacles: f.obstacles,
      })),
    };
  }

  return {
    arenaId: sim.arenaId,
    playerName: sim.player.name,
    opponentName: sim.opponent.name,
    playerColor: ELEMENTS[sim.player.element]?.primaryColor ?? '#38bdf8',
    opponentColor: ELEMENTS[sim.opponent.element]?.primaryColor ?? '#f43f5e',
    floorPalette: arena.floorPalette,
    arenaPrimaryColor: arena.primaryColor,
    arenaAccentColor: arena.accentColor,
    winnerSide: rawWinner,
    finishReason: sim.finishReason ?? 'Survival',
    finalBlowTimeSec: lastFrame.t,
    frames: frames.map((f) => ({ ...f })),
  };
}

function finishBattle(
  sim: BattleSimulationState,
  winner: 'player' | 'opponent',
  reason: FinishReason
): void {
  const finishBanner =
    reason === 'BurstFinish'
      ? 'BURST FINISH!'
      : reason === 'RingOut'
        ? 'RING OUT!'
        : reason === 'Knockout'
          ? 'KNOCKOUT FINISH!'
          : reason === 'SpinFinish'
            ? 'SPIN FINISH!'
            : 'TIME DECISION!';
  if (!sim.pendingHighlightMarker) {
    const loser = winner === 'player' ? sim.opponent : sim.player;
    sim.pendingHighlightMarker = {
      clashX: loser.x,
      clashZ: loser.z,
      isCritical: true,
      eventLabel: finishBanner,
    };
  }
  recordHighlightFrame(sim, finishBanner);
  recordAnalysisTimelinePoint(sim);

  sim.phase = 'Finish';
  sim.winnerSide = winner;
  sim.finishReason = reason;
  sim.finishTimer = 0;
}

export function buildBattleAnalysisReport(
  sim: BattleSimulationState,
  perspective: 'player' | 'opponent' = 'player'
): BattleAnalysisReport {
  const roundBreak = (b: BattleDamageBreakdown): BattleDamageBreakdown => ({
    clash: Number(b.clash.toFixed(1)),
    hazard: Number(b.hazard.toFixed(1)),
    pillar: Number(b.pillar.toFixed(1)),
    ability: Number(b.ability.toFixed(1)),
    status: Number(b.status.toFixed(1)),
  });
  const flipSide = perspective === 'opponent';
  const flipSideName = (s: 'player' | 'opponent'): 'player' | 'opponent' =>
    flipSide ? (s === 'player' ? 'opponent' : 'player') : s;
  const highestMoment: BattleAnalysisDamageMoment | null = sim.analysis.highestDamageMoment
    ? {
        ...sim.analysis.highestDamageMoment,
        actorSide: flipSideName(sim.analysis.highestDamageMoment.actorSide),
        victimSide: flipSideName(sim.analysis.highestDamageMoment.victimSide),
      }
    : null;
  const longestStreak: BattleAnalysisClashStreak | null = sim.analysis.longestClashStreak
    ? { ...sim.analysis.longestClashStreak }
    : null;
  const breaches: BattleAnalysisThresholdBreach[] = (
    sim.analysis.criticalThresholdBreaches ?? []
  ).map((b) => ({
    ...b,
    side: flipSideName(b.side),
  }));
  const momentumSwing: BattleAnalysisMomentumSwing | null = sim.analysis.peakMomentumSwing
    ? {
        ...sim.analysis.peakMomentumSwing,
        leaderAfter: flipSideName(sim.analysis.peakMomentumSwing.leaderAfter),
      }
    : null;

  return {
    damageTakenByPlayer: roundBreak(
      flipSide ? sim.analysis.damageDealtByPlayer : sim.analysis.damageTakenByPlayer
    ),
    damageDealtByPlayer: roundBreak(
      flipSide ? sim.analysis.damageTakenByPlayer : sim.analysis.damageDealtByPlayer
    ),
    firstBrokenSide:
      sim.analysis.firstBrokenSide === null
        ? null
        : flipSideName(sim.analysis.firstBrokenSide),
    firstBrokenPart: sim.analysis.firstBrokenPart,
    firstBrokenTimeSec: sim.analysis.firstBrokenTimeSec,
    peakPlayerRpm: flipSide ? sim.analysis.peakOpponentRpm : sim.analysis.peakPlayerRpm,
    peakOpponentRpm: flipSide ? sim.analysis.peakPlayerRpm : sim.analysis.peakOpponentRpm,
    durationSec: Number(sim.elapsedTime.toFixed(2)),
    timeline: sim.analysis.timeline.map((pt) =>
      flipSide
        ? {
            timeSec: pt.timeSec,
            playerStaminaPct: pt.opponentStaminaPct,
            opponentStaminaPct: pt.playerStaminaPct,
            playerArmorPct: pt.opponentArmorPct,
            opponentArmorPct: pt.playerArmorPct,
          }
        : { ...pt }
    ),
    highestDamageMoment: highestMoment,
    longestClashStreak: longestStreak,
    criticalThresholdBreaches: breaches,
    peakMomentumSwing: momentumSwing,
  };
}

export function stepBattleSimulation(sim: BattleSimulationState, dt: number): void {
  // Freeze simulation timers & physics during active hit-stop impact frames (both Combat/Critical & Burst Finish)
  if (
    sim.hitstopTimer > 0 &&
    (sim.phase === 'Combat' || sim.phase === 'Critical' || sim.phase === 'Finish')
  ) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
    return;
  }

  sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 1.6);
  sim.slowMotionTimer = Math.max(0, sim.slowMotionTimer - dt);

  // 5-second Launch Countdown with deterministic auto-launch fallback!
  if (sim.phase === 'Launch') {
    sim.launchCountdown = Math.max(0, sim.launchCountdown - dt);
    if (sim.launchCountdown <= 0 && !sim.isOnlineRemote) {
      applyLaunchVelocities(
        sim,
        sim.launchSelection.powerRatio,
        sim.launchSelection.angleRad,
        undefined,
        { allowPerfect: false }
      );
      sim.events.push({
        type: 'ability',
        x: sim.player.x,
        y: sim.player.y + 0.25,
        z: sim.player.z,
        intensity: 0.75,
        actorId: 'player',
        label: 'AUTO-LAUNCH ENGAGED!',
        colorHex: '#f59e0b',
      });
    }
    return;
  }

  if (sim.phase === 'Finish') {
    sim.finishTimer += dt;
    // Allow ringed-out top to coast visibly through the exit chute while winner keeps spinning
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
    const finishHoldSec =
      sim.finishReason === 'BurstFinish' || sim.finishReason === 'Knockout'
        ? 2.35
        : sim.finishReason === 'Survival'
          ? 0.95
          : 1.35;
    if (sim.finishTimer >= finishHoldSec) {
      sim.phase = 'Results';
    }
    return;
  }

  if (sim.phase !== 'Combat' && sim.phase !== 'Critical') return;

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
      sim.aiDecisionTimer =
        sim.aiDifficulty === 'Easy'
          ? 0.85
          : sim.aiDifficulty === 'Normal'
            ? 0.55
            : sim.aiDifficulty === 'Hard'
              ? 0.38
              : 0.28;
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
    // Authoritative server decides RingOut / Burst / KO / Finish; prevent premature client finish state
    sim.player.ringedOut = false;
    sim.player.burstOut = false;
    sim.player.knockedOut = false;
    sim.opponent.ringedOut = false;
    sim.opponent.burstOut = false;
    sim.opponent.knockedOut = false;
    return;
  }
  evaluateVictoryConditions(sim);

  if (sim.phase === 'Combat' || sim.phase === 'Critical') {
    sim.highlightSampleAccum += dt;
    if (sim.highlightSampleAccum >= 0.04 || sim.pendingHighlightMarker) {
      sim.highlightSampleAccum = 0;
      recordHighlightFrame(sim);
    }
  }
}

export interface AuthEntitySnapshot {
  x: number;
  z: number;
  vx: number;
  vz: number;
  omega: number;
  spinAngle: number;
  staminaRatio: number;
  durability: number;
  stability: number;
  energy: number;
  resonance: number;
  partDurability: PartDurabilityMap;
  brokenParts: PartDurabilityKey[];
  statuses: ActiveStatusEffect[];
  statDebuffs: ActiveStatDebuff[];
  abilityCooldowns: [number, number, number, number];
  abilityActive: [number, number, number, number];
  ringedOut: boolean;
  burstOut: boolean;
  knockedOut: boolean;
}

export interface AuthCombatSnapshot {
  seq: number;
  elapsedTime: number;
  phase: BattlePhase;
  hitstopTimer?: number;
  slowMotionTimer: number;
  cameraTrauma: number;
  collisionCount: number;
  maxImpactImpulse: number;
  perfectLaunch?: boolean;
  opponentPerfectLaunch?: boolean;
  p: AuthEntitySnapshot;
  o: AuthEntitySnapshot;
  events: SimEvent[];
}

function serializeAuthEntity(e: TopSimEntity): AuthEntitySnapshot {
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
      Number((e.abilitySlots[3]?.cooldownRemaining ?? 0).toFixed(2)),
    ],
    abilityActive: [
      Number((e.abilitySlots[0]?.activeRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[1]?.activeRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[2]?.activeRemaining ?? 0).toFixed(2)),
      Number((e.abilitySlots[3]?.activeRemaining ?? 0).toFixed(2)),
    ],
    ringedOut: e.ringedOut,
    burstOut: e.burstOut,
    knockedOut: e.knockedOut,
  };
}

export function extractAuthoritativeSnapshot(
  sim: BattleSimulationState,
  seq: number,
  tickEvents: SimEvent[],
  recipientRole: 'host' | 'guest'
): AuthCombatSnapshot {
  const isHost = recipientRole === 'host';
  const mappedEvents = isHost
    ? tickEvents
    : tickEvents.map((ev) => ({
        ...ev,
        actorId:
          ev.actorId === 'player'
            ? ('opponent' as const)
            : ev.actorId === 'opponent'
              ? ('player' as const)
              : undefined,
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
    events: mappedEvents,
  };
}

export function applyAuthoritativeSnapshot(
  sim: BattleSimulationState,
  snap: AuthCombatSnapshot
): void {
  if (!sim.isOnlineRemote) return;
  if (sim.phase !== 'Combat' && sim.phase !== 'Critical') return;

  sim.elapsedTime = snap.elapsedTime;
  if (snap.phase === 'Critical' && sim.phase === 'Combat') {
    sim.phase = 'Critical';
  }
  if (typeof snap.hitstopTimer === 'number') {
    sim.hitstopTimer = Math.max(sim.hitstopTimer, snap.hitstopTimer);
  }
  sim.slowMotionTimer = Math.max(sim.slowMotionTimer, snap.slowMotionTimer);
  sim.cameraTrauma = Math.max(sim.cameraTrauma, snap.cameraTrauma);
  sim.collisionCount = Math.max(sim.collisionCount, snap.collisionCount);
  sim.maxImpactImpulse = Math.max(sim.maxImpactImpulse, snap.maxImpactImpulse);
  if (typeof snap.perfectLaunch === 'boolean') {
    sim.perfectLaunch = sim.perfectLaunch || snap.perfectLaunch;
  }
  if (typeof snap.opponentPerfectLaunch === 'boolean') {
    sim.opponentPerfectLaunch = sim.opponentPerfectLaunch || snap.opponentPerfectLaunch;
  }

  const reconcileEntity = (entity: TopSimEntity, remote: AuthEntitySnapshot) => {
    const errDist = Math.hypot(remote.x - entity.x, remote.z - entity.z);
    if (errDist > 0.85) {
      entity.x = remote.x;
      entity.z = remote.z;
      entity.vx = remote.vx;
      entity.vz = remote.vz;
    } else {
      entity.x += (remote.x - entity.x) * 0.55;
      entity.z += (remote.z - entity.z) * 0.55;
      entity.vx += (remote.vx - entity.vx) * 0.6;
      entity.vz += (remote.vz - entity.vz) * 0.6;
    }
    entity.y = arenaFloorHeight(entity.x, entity.z);
    entity.omega += (remote.omega - entity.omega) * 0.65;
    entity.staminaRatio = remote.staminaRatio;
    entity.durability = remote.durability;
    entity.stability = remote.stability;
    entity.energy = remote.energy;
    entity.resonance = remote.resonance;
    entity.partDurability = {
      ...remote.partDurability,
      EnergyModule: remote.partDurability.EnergyModule ?? 100,
    };
    entity.brokenParts = [...remote.brokenParts];
    entity.statuses = remote.statuses.map((s) => ({ ...s }));
    entity.statDebuffs = remote.statDebuffs.map((d) => ({ ...d }));
    for (let i = 0; i < 4; i++) {
      if (entity.abilitySlots[i]) {
        entity.abilitySlots[i].cooldownRemaining = remote.abilityCooldowns[i] ?? 0;
        entity.abilitySlots[i].activeRemaining = remote.abilityActive[i] ?? 0;
      }
    }
    entity.ringedOut = remote.ringedOut;
    entity.burstOut = remote.burstOut;
    entity.knockedOut = remote.knockedOut;
  };

  reconcileEntity(sim.player, snap.p);
  reconcileEntity(sim.opponent, snap.o);

  if (Array.isArray(snap.events) && snap.events.length > 0) {
    sim.events.push(...snap.events);
  }
}

export type RemoteCombatSnapshot = AuthCombatSnapshot;

export function applyRemoteSnapshot(
  sim: BattleSimulationState,
  snap: AuthCombatSnapshot
): void {
  applyAuthoritativeSnapshot(sim, snap);
}

export function buildOpponentSimConfig(opponentId: string): TopSimConfig {
  const top = getTopDefinition(opponentId || 'top.ignis.drake');
  return {
    entityId: 'opponent',
    name: top.displayName,
    element: top.element,
    attributes: top.baseAttributes,
    physical: {
      totalMassKg: 0.11,
      effectiveRadiusM: 0.44,
      momentOfInertia: 0.01,
      rotationalDrag: 0.012,
      groundFriction: 0.25,
      restitution: 0.7,
      maxDurability: 100,
      initialAngularVelocity: 105,
      accelerationForce: 5,
      energyRegenPerSec: 7,
      maxEnergy: 100,
      resonanceRate: 1,
      bladeShape: 'sharp',
      driverType: 'flat',
    },
    abilities: top.defaultAbilities,
    initialMode: 'Attack',
    initialCommand: 'Aggressive',
    evolutionStage: 0,
  };
}
