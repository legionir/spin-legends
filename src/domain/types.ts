export type TopArchetype = 'Attacker' | 'Defender' | 'Balance' | 'Stamina';

export type ElementType =
  | 'Fire'
  | 'Water'
  | 'Ice'
  | 'Lightning'
  | 'Earth'
  | 'Wind'
  | 'Shadow'
  | 'Light';

export type ComponentCategory =
  | 'SpiritCore'
  | 'AttackBlade'
  | 'ArmorRing'
  | 'WeightDisc'
  | 'PerformanceDriver'
  | 'EnergyModule';

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export type BattleMode =
  | 'Attack'
  | 'Defense'
  | 'Speed'
  | 'Stamina'
  | 'Berserk'
  | 'Counter';

export type TacticalCommand =
  | 'Aggressive'
  | 'Defensive'
  | 'Chase'
  | 'Circle'
  | 'Evade'
  | 'ConserveEnergy'
  | 'HoldPosition'
  | 'Counter';

export type AbilityType = 'Elemental' | 'Defensive' | 'Tactical' | 'Ultimate';

export type BattlePhase =
  | 'Idle'
  | 'Preparation'
  | 'Launch'
  | 'Combat'
  | 'Critical'
  | 'Finish'
  | 'Results';

export type FinishReason =
  | 'SpinFinish'
  | 'RingOut'
  | 'BurstFinish'
  | 'Knockout'
  | 'Survival';

export type AIPersonality =
  | 'Aggressive'
  | 'Defensive'
  | 'Tactical'
  | 'Evasive'
  | 'HeavyAssault'
  | 'Adaptive';

export type DifficultyLevel = 'Easy' | 'Normal' | 'Hard' | 'Expert';

export type BladeShape = 'sharp' | 'wide' | 'multipoint' | 'curved' | 'heavy' | 'vortex';
export type DriverType = 'flat' | 'sharp' | 'rubber' | 'ball';

export type StatusEffectType =
  | 'Burn'
  | 'Slow'
  | 'Freeze'
  | 'Shock'
  | 'Shield'
  | 'Overdrive'
  | 'Weaken'
  | 'Drain'
  | 'Purify';

export type GraphicsQuality = 'Low' | 'Medium' | 'High';

export type ArenaId =
  | 'standard'
  | 'volcanic'
  | 'frozen'
  | 'thunder'
  | 'temple'
  | 'shadow';

export type CameraPreset = 'Broadcast' | 'LowAction' | 'TopDown' | 'Orbit';

export type MatchMode =
  | 'Training'
  | 'Tournament'
  | 'Survival'
  | 'Boss'
  | 'TeamBattle'
  | 'ShadowPvP'
  | 'OnlineFriendly'
  | 'OnlineRanked';

export type PartDurabilityKey =
  | 'SpiritCore'
  | 'AttackBlade'
  | 'ArmorRing'
  | 'WeightDisc'
  | 'PerformanceDriver'
  | 'EnergyModule';

export type PartDurabilityMap = Record<PartDurabilityKey, number>;

export type DurabilityBand = 'Normal' | 'Minor' | 'Reduced' | 'Critical' | 'Failed';

export type CosmeticPattern = 'solid' | 'striped' | 'circuit' | 'apex';

export type WeatherType = 'Clear' | 'LightRain' | 'DustStorm' | 'GaleWind';

export interface WeatherDefinition {
  id: WeatherType;
  label: string;
  shortLabel: string;
  description: string;
  accentHex: string;
  fogHex: number;
  fogDensityBoost: number;
  particleHex: number;
  gripFrictionMult: number;
  rotDragMult: number;
  stabilityRecoveryMult: number;
  stabilityDrainPerSec: number;
  gustAccel: number;
  gustFreq: number;
}

export type VictoryEmoteId =
  | 'apex_flare'
  | 'cyclone_salute'
  | 'titan_hover'
  | 'eclipse_spin'
  | 'solar_crown';

export interface VictoryEmoteDefinition {
  id: VictoryEmoteId;
  label: string;
  description: string;
  accentHex: string;
}

export interface CosmeticCustomization {
  primaryColor: string;
  trimColor: string;
  trailColor: string;
  pattern: CosmeticPattern;
  victoryEmote?: VictoryEmoteId;
}

export interface TopCareerStats {
  matches: number;
  wins: number;
  losses: number;
  totalClashes: number;
  peakImpulse: number;
  burstFinishes: number;
  ringOutFinishes: number;
  spinFinishes: number;
  knockoutFinishes: number;
}

export interface LaunchSelection {
  angleRad: number;
  powerRatio: number; // 0..1
  targetX: number;
  targetZ: number;
  aimSetByPlayer: boolean;
  powerLockedByPlayer: boolean;
}

export type StatDebuffKind =
  | 'Overheated'
  | 'ArcDisruption'
  | 'DragSnare'
  | 'ArmorCorrosion'
  | 'VoidSiphon';

export interface ActiveStatDebuff {
  kind: StatDebuffKind;
  label: string;
  remainingSec: number;
  durationSec: number;
  attackMult: number;
  defenseMult: number;
  speedMult: number;
  spinDrainMult: number;
  energyRegenMult: number;
  colorHex: string;
}

export interface ObstacleMotionSpec {
  kind: 'orbit' | 'oscillate';
  speedRadPerSec: number;
  phaseOffset?: number;
  orbitRadius?: number;
  ampX?: number;
  ampZ?: number;
}

export interface ArenaHazardZone {
  id: string;
  x: number;
  z: number;
  radius: number;
  kind: 'heat' | 'shock' | 'sand' | 'void';
  label: string;
  motion?: ObstacleMotionSpec;
  debuffKind?: StatDebuffKind;
  debuffDurationSec?: number;
}

export interface ArenaPillarObstacle {
  id?: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  motion?: ObstacleMotionSpec;
  debuffKind?: StatDebuffKind;
  debuffDurationSec?: number;
}

export interface ArenaDefinition {
  id: ArenaId;
  displayName: string;
  subtitle: string;
  description: string;
  hazardSummary: string;
  surfaceFrictionMult: number;
  wallRestitution: number;
  rotationalDragMult: number;
  energyModPerSec: number;
  primaryColor: string;
  accentColor: string;
  floorPalette: [string, string, string];
  wallColorHex: number;
  trimColorHex: number;
  skyColorHex: number;
  hasMist: boolean;
  pillars: ArenaPillarObstacle[];
  hazardZones: ArenaHazardZone[];
}

export interface AttributeSet {
  attack: number;
  defense: number;
  stamina: number;
  speed: number;
  stability: number;
  control: number;
  energy: number;
  critical: number;
}

export interface PhysicalProfile {
  totalMassKg: number;
  effectiveRadiusM: number;
  momentOfInertia: number; // I = 0.5 * m * r^2
  rotationalDrag: number;
  groundFriction: number;
  restitution: number;
  maxDurability: number;
  initialAngularVelocity: number; // rad/s
  accelerationForce: number;
  energyRegenPerSec: number;
  maxEnergy: number;
  resonanceRate: number;
  bladeShape: BladeShape;
  driverType: DriverType;
}

export interface ElementDefinition {
  id: ElementType;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  emissiveHex: number;
  primaryHex: number;
  secondaryHex: number;
  strongAgainst: ElementType[];
  weakAgainst: ElementType[];
  passiveLabel: string;
}

export interface ComponentVisualSpec {
  primaryColor: number;
  accentColor: number;
  metalness: number;
  roughness: number;
  bladeShape?: BladeShape;
  driverType?: DriverType;
  bladeCount?: number;
}

export interface ComponentDefinition {
  id: string;
  displayName: string;
  description: string;
  category: ComponentCategory;
  rarity: Rarity;
  elementAffinity?: ElementType;
  massKg: number;
  radiusContribution: number;
  rotationalDrag: number;
  groundFriction: number;
  restitution: number;
  durability: number;
  modifiers: Partial<AttributeSet>;
  visual: ComponentVisualSpec;
  unlockCostGold: number;
  forgeCost?: {
    legendaryFragments: number;
    energyCrystals: number;
    gold: number;
  };
}

export type EquippedComponents = Record<ComponentCategory, string>;

export interface TopDefinition {
  id: string;
  displayName: string;
  title: string;
  description: string;
  archetype: TopArchetype;
  element: ElementType;
  rarity: Rarity;
  baseAttributes: AttributeSet;
  defaultComponents: EquippedComponents;
  defaultAbilities: [string, string, string, string];
  unlockCostGold: number;
  forgeCost?: {
    legendaryFragments: number;
    energyCrystals: number;
  };
  isBoss?: boolean;
}

export interface AbilityDefinition {
  id: string;
  displayName: string;
  description: string;
  type: AbilityType;
  element?: ElementType;
  energyCost: number;
  resonanceCost: number;
  cooldownSec: number;
  durationSec: number;
  power: number;
  effectKind:
    | 'DashStrike'
    | 'ElementalBurst'
    | 'BarrierShield'
    | 'SpinStabilize'
    | 'TacticalSurge'
    | 'VortexPull'
    | 'EnergyDrain'
    | 'PurifyCleanse'
    | 'UltimateStrike';
  statusApplied?: StatusEffectType;
  colorHex: string;
}

export interface BossPhaseSpec {
  thresholdRatio: number; // Triggered when min(staminaRatio, durabilityRatio) <= threshold
  phaseName: string;
  bannerText: string;
  modeShift: BattleMode;
  commandShift: TacticalCommand;
  energyBurst: number;
  arenaShock: boolean;
}

export interface OpponentDefinition {
  id: string;
  displayName: string;
  title: string;
  topId: string;
  personality: AIPersonality;
  difficulty: DifficultyLevel;
  level: number;
  isBoss: boolean;
  preferredArenaId?: ArenaId;
  secondaryElement?: ElementType | null;
  components: EquippedComponents;
  abilities: [string, string, string, string];
  rewardGold: number;
  rewardXp: number;
  description: string;
  bossPhases?: BossPhaseSpec[];
}

export interface EvolutionPath {
  id: string;
  displayName: string;
  focus: 'Offensive' | 'Defensive' | 'Hybrid';
  description: string;
  requiredLevel: number;
  goldCost: number;
  evolutionTokensCost: number;
  essenceCost: number;
  attributeBonuses: Partial<AttributeSet>;
  scaleMultiplier: number;
  emissiveBoost: number;
}

export interface OwnedTopState {
  instanceId: string;
  definitionId: string;
  level: number;
  experience: number;
  evolutionStage: number; // 0 = Base, 1 = Evolved
  evolutionPathId: string | null;
  secondaryElement: ElementType | null;
  equippedComponents: EquippedComponents;
  equippedAbilities: [string, string, string, string];
  cosmetics: CosmeticCustomization;
  wins: number;
  losses: number;
  careerStats: TopCareerStats;
}

export interface Currencies {
  gold: number;
  metalShards: number;
  energyCrystals: number;
  elementalEssence: number;
  evolutionTokens: number;
  legendaryFragments: number;
}

export interface LoadoutPreset {
  id: string;
  name: string;
  topInstanceId: string;
  components: EquippedComponents;
  abilities: [string, string, string, string];
  secondaryElement?: ElementType | null;
  cosmetics?: CosmeticCustomization;
  preferredMode: BattleMode;
  preferredCommand: TacticalCommand;
}

export interface TournamentState {
  active: boolean;
  bracketSize: 4 | 8 | 16;
  currentRound: number;
  completedRounds: number;
  bracketOpponentIds: string[];
  arenaIds: ArenaId[];
  championshipsWon: number;
}

export interface KeyBindings {
  ability1: string;
  ability2: string;
  ability3: string;
  ability4: string;
  launch: string;
  teamSwitch: string;
  pause: string;
  cameraCycle: string;
  tactical1: string;
  tactical2: string;
  tactical3: string;
  tactical4: string;
  tactical5: string;
  tactical6: string;
  tactical7: string;
  tactical8: string;
}

export interface SceneTelemetry {
  fps: number;
  frameTimeMs: number;
  simStepTimeMs: number;
  droppedSteps: number;
  quality: GraphicsQuality;
  qualityAutoAdjusted: boolean;
  particleBudget: number;
  heatmapImpacts?: number;
  heatmapPeakZone?: string;
  heatmapPeakIntensity?: number;
}

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  muted: boolean;
  cameraSensitivity: number;
  debugMode: boolean;
  cameraPreset: CameraPreset;
  uiScale: number; // 0.85 .. 1.2
  dynamicMusic: boolean;
  gamepadEnabled: boolean;
  showDiagnostics: boolean;
  reducedMotion?: boolean;
  dynamicClashCamera?: boolean;
  keyBindings: KeyBindings;
}

export interface MissionDefinition {
  id: string;
  cadence: 'daily' | 'challenge' | 'achievement';
  title: string;
  description: string;
  target: number;
  metric:
    | 'battles_won'
    | 'burst_finishes'
    | 'ring_outs'
    | 'knockouts'
    | 'abilities_used'
    | 'survival_wave'
    | 'boss_defeated'
    | 'parts_upgraded'
    | 'arena_variety'
    | 'secrets_found';
  rewards: {
    gold?: number;
    energyCrystals?: number;
    legendaryFragments?: number;
    elementalEssence?: number;
    evolutionTokens?: number;
    score?: number;
  };
}

export interface MissionProgressEntry {
  progress: number;
  claimed: boolean;
}

export interface SurvivalRunState {
  active: boolean;
  currentWave: number;
  carriedStaminaRatio: number;
  carriedDurabilityRatio: number;
  accumulatedScore: number;
}

export type HairStyleId = 'spiky' | 'sleek' | 'braided' | 'visor';

export interface CharacterAppearance {
  hairStyle: HairStyleId;
  hairColor: string;
  outfitColor: string;
  accentColor: string;
}

export interface CharacterStats {
  strength: number; // +Attack & Clash Impact
  agility: number; // +Speed & Control
  focus: number; // +Energy & Stability
  luck: number; // +Critical & Secret Affinity
}

export interface CharacterProfile {
  created: boolean;
  name: string;
  title: string;
  appearance: CharacterAppearance;
  stats: CharacterStats;
  createdAtMs: number;
}

export interface SecretDefinition {
  id: string;
  title: string;
  hint: string;
  lore: string;
  points: number;
}

export type DecisionAlignment = 'good' | 'bad' | 'neutral';

export interface StoryDecisionChoice {
  id: string;
  label: string;
  alignment: DecisionAlignment;
  description: string;
  rewardSummary: string;
  goldDelta?: number;
  scoreDelta?: number;
  essenceDelta?: number;
  evoTokenDelta?: number;
}

export interface StoryDecisionNode {
  id: string;
  stageNumber: number;
  title: string;
  prompt: string;
  unlockHint: string;
  choices: StoryDecisionChoice[];
}

export type EndingType = 'good' | 'bad' | 'neutral' | 'legend';

export interface EndingDefinition {
  id: string;
  type: EndingType;
  badgeLabel: string;
  title: string;
  subtitle: string;
  epilogue: string;
  accentHex: string;
}

export interface ScoreLogEntry {
  id: string;
  label: string;
  points: number;
  category: 'battle' | 'secret' | 'decision' | 'progression';
  timestampMs: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  title: string;
  score: number;
  wins: number;
  secretsFound: number;
  endingBadge: string;
  isPlayer: boolean;
  appearance?: CharacterAppearance;
  mmr?: number;
}

export interface PlayerSaveData {
  schemaVersion: number;
  playerId: string;
  updatedAtMs: number;
  playerLevel: number;
  playerExperience: number;
  playerScore: number;
  scoreLog: ScoreLogEntry[];
  discoveredSecrets: string[];
  character: CharacterProfile;
  decisionHistory: Record<string, string>; // decisionId -> choiceId
  unlockedEndingIds: string[];
  activeEndingId: string | null;
  leaderboardEntries: LeaderboardEntry[];
  currencies: Currencies;
  ownedTops: OwnedTopState[];
  unlockedTopIds: string[];
  unlockedComponentIds: string[];
  componentUpgradeLevels: Record<string, number>;
  selectedTopInstanceId: string;
  teamTopInstanceIds: string[];
  selectedArenaId: ArenaId;
  presets: LoadoutPreset[];
  processedBattleIds: string[];
  tournament: TournamentState;
  survivalBestWave: number;
  bossDefeatedIds: string[];
  capacitorLevel: number;
  visitedArenaIds: ArenaId[];
  missionProgress: Record<string, MissionProgressEntry>;
  dailyMissionResetKey: string;
  settings: GameSettings;
  matchHistory: MatchHistoryEntry[];
  rivals: RivalRecord[];
  claimedSeasonRewardTiers: string[];
  preferredMutators: BattleMutators;
  preferredWeather?: WeatherType;
  pvpMmr?: number;
}

export interface BattleScoreBreakdown {
  basePoints: number;
  finishBonusPoints: number;
  tacticalClashPoints: number;
  abilityMasteryPoints: number;
  perfectLaunchPoints: number;
  secretBonusPoints: number;
  totalPointsEarned: number;
  newlyDiscoveredSecrets: string[];
}

export interface MatchHighlightObstacleSnapshot {
  x: number;
  z: number;
  radius: number;
  kind: 'pillar' | 'heat' | 'shock' | 'sand' | 'void';
}

export interface HighlightStatDebuff {
  kind: StatDebuffKind;
  label: string;
  remainingSec: number;
  colorHex: string;
}

export interface MatchHighlightFrame {
  t: number;
  px: number;
  pz: number;
  pVx: number;
  pVz: number;
  pSpinAngle: number;
  pRpm: number;
  pStaminaPct: number;
  pDurabilityPct: number;
  pEnergyPct?: number;
  pResonance?: number;
  pPartDurability?: PartDurabilityMap;
  pBrokenParts?: PartDurabilityKey[];
  pShield?: boolean;
  pFire?: boolean;
  pActiveSlotIdx?: number;
  pActiveSlots?: [boolean, boolean, boolean, boolean];
  pStatuses?: StatusEffectType[];
  pStatDebuffs?: HighlightStatDebuff[];
  ox: number;
  oz: number;
  oVx: number;
  oVz: number;
  oSpinAngle: number;
  oRpm: number;
  oStaminaPct: number;
  oDurabilityPct: number;
  oEnergyPct?: number;
  oResonance?: number;
  oPartDurability?: PartDurabilityMap;
  oBrokenParts?: PartDurabilityKey[];
  oShield?: boolean;
  oFire?: boolean;
  oActiveSlotIdx?: number;
  oActiveSlots?: [boolean, boolean, boolean, boolean];
  oStatuses?: StatusEffectType[];
  oStatDebuffs?: HighlightStatDebuff[];
  clashX?: number;
  clashZ?: number;
  isCritical?: boolean;
  eventLabel?: string;
  obstacles?: MatchHighlightObstacleSnapshot[];
}

export interface MatchHighlightClip {
  arenaId: ArenaId;
  playerName: string;
  opponentName: string;
  playerColor: string;
  opponentColor: string;
  floorPalette: [string, string, string];
  arenaPrimaryColor: string;
  arenaAccentColor: string;
  winnerSide: 'player' | 'opponent';
  finishReason: FinishReason;
  finalBlowTimeSec: number;
  frames: MatchHighlightFrame[];
}

export interface BattleMutators {
  noAbilities: boolean;
  doubleGravity: boolean;
  turboSpin: boolean;
  ringOutOnly: boolean;
  doubleHazards: boolean;
}

export interface MutatorDefinition {
  id: keyof BattleMutators;
  label: string;
  shortLabel: string;
  description: string;
  accentHex: string;
}

export type RankTierId = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Legend';

export interface RankTierDefinition {
  id: RankTierId;
  name: string;
  minMmr: number;
  colorHex: string;
  rewardGold: number;
  rewardCrystals: number;
  rewardFragments: number;
}

export interface SeasonInfo {
  seasonNumber: number;
  seasonName: string;
  startsAtMs: number;
  endsAtMs: number;
  daysRemaining: number;
}

export interface BattleDamageBreakdown {
  clash: number;
  hazard: number;
  pillar: number;
  ability: number;
  status: number;
}

export interface BattleTimelinePoint {
  timeSec: number;
  playerStaminaPct: number;
  opponentStaminaPct: number;
  playerArmorPct: number;
  opponentArmorPct: number;
}

export interface BattleAnalysisDamageMoment {
  timeSec: number;
  amount: number;
  source: keyof BattleDamageBreakdown;
  actorSide: 'player' | 'opponent';
  victimSide: 'player' | 'opponent';
  isCritical: boolean;
}

export interface BattleAnalysisClashStreak {
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  hitCount: number;
  peakImpulse: number;
}

export interface BattleAnalysisThresholdBreach {
  side: 'player' | 'opponent';
  metric: 'stamina' | 'durability';
  timeSec: number;
  remainingPct: number;
}

export interface BattleAnalysisMomentumSwing {
  timeSec: number;
  leaderAfter: 'player' | 'opponent';
  swingDeltaPct: number;
}

export interface BattleAnalysisReport {
  damageTakenByPlayer: BattleDamageBreakdown;
  damageDealtByPlayer: BattleDamageBreakdown;
  firstBrokenSide: 'player' | 'opponent' | null;
  firstBrokenPart: PartDurabilityKey | null;
  firstBrokenTimeSec: number | null;
  peakPlayerRpm: number;
  peakOpponentRpm: number;
  durationSec: number;
  timeline: BattleTimelinePoint[];
  highestDamageMoment?: BattleAnalysisDamageMoment | null;
  longestClashStreak?: BattleAnalysisClashStreak | null;
  criticalThresholdBreaches?: BattleAnalysisThresholdBreach[];
  peakMomentumSwing?: BattleAnalysisMomentumSwing | null;
}

export interface MatchHistoryEntry {
  battleId: string;
  timestampMs: number;
  mode: MatchMode;
  arenaId: ArenaId;
  opponentName: string;
  opponentElement: ElementType;
  won: boolean;
  finishReason: FinishReason;
  durationSec: number;
  maxImpactImpulse: number;
  collisionCount: number;
  perfectLaunch: boolean;
  mutators: BattleMutators;
  scoreEarned?: number;
  analysis: BattleAnalysisReport;
  highlights: MatchHighlightClip;
}

export interface ShadowOpponentProfile {
  id: string;
  playerId: string;
  handle: string;
  title: string;
  element: ElementType;
  secondaryElement: ElementType | null;
  mmr: number;
  wins: number;
  losses: number;
  rankTier: RankTierId;
  topDefinitionId: string;
  topDisplayName: string;
  level: number;
  evolutionStage: number;
  evolutionPathId: string | null;
  equippedComponents: EquippedComponents;
  equippedAbilities: [string, string, string, string];
  cosmetics?: CosmeticCustomization;
  aiPersonality: AIPersonality;
  aiDifficulty: DifficultyLevel;
  source: 'commander' | 'seed';
  appearance: CharacterAppearance;
}

export interface RivalRecord {
  id: string;
  playerId: string;
  handle: string;
  sourceMode: 'ShadowPvP' | 'OnlineFriendly' | 'OnlineRanked';
  topDefinitionId: string;
  topDisplayName: string;
  element: ElementType;
  secondaryElement: ElementType | null;
  level: number;
  evolutionStage: number;
  evolutionPathId: string | null;
  equippedComponents: EquippedComponents;
  equippedAbilities: [string, string, string, string];
  cosmetics?: CosmeticCustomization;
  mmr: number;
  lossesToRival: number;
  winsAgainstRival: number;
  status: 'unavenged' | 'avenged';
  lastEncounterMs: number;
  recommendedCounterElement: ElementType;
  appearance?: CharacterAppearance;
}

export interface BattleResultSummary {
  battleId: string;
  mode: MatchMode;
  arenaId: ArenaId;
  opponentName?: string;
  won: boolean;
  winnerSide: 'player' | 'opponent';
  finishReason: FinishReason;
  durationSec: number;
  maxImpactImpulse: number;
  collisionCount: number;
  abilitiesUsed: number;
  launchQuality: number;
  perfectLaunch: boolean;
  mutators: BattleMutators;
  weather?: WeatherType;
  victoryEmote?: VictoryEmoteId;
  isShadowPvP?: boolean;
  isRevengeMatch?: boolean;
  isSpectating?: boolean;
  analysis?: BattleAnalysisReport;
  playerRemainingStamina: number;
  opponentRemainingStamina: number;
  playerRemainingDurability: number;
  opponentRemainingDurability: number;
  partDurability: PartDurabilityMap;
  brokenParts: PartDurabilityKey[];
  survivalWave?: number;
  scoreBreakdown: BattleScoreBreakdown;
  highlights?: MatchHighlightClip;
  rewards: {
    gold: number;
    metalShards: number;
    energyCrystals: number;
    elementalEssence: number;
    evolutionTokens: number;
    legendaryFragments: number;
    xp: number;
    alreadyClaimed: boolean;
  };
}
