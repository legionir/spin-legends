import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import {
  ARENAS,
  MISSIONS_CATALOG,
  OPPONENTS,
  STORY_DECISIONS,
  TACTICAL_COMMANDS,
  getComponentDefinition,
  getEndingDefinition,
  getEvolutionPath,
  getOpponentDefinition,
  getSecretDefinition,
  getTopDefinition,
  resolveArenaDefaultWeather,
} from './domain/catalog';
import {
  MAX_CAPACITOR_LEVEL,
  MAX_COMPONENT_UPGRADE_LEVEL,
  RANK_TIERS,
  addExperienceToTop,
  buildTournamentBracket,
  calculateAttributes,
  calculateBattleRewards,
  calculatePhysicalProfile,
  canEvolveTop,
  createDefaultCosmetics,
  createDefaultSaveData,
  createEmptyCareerStats,
  evaluateBattleScoreBreakdown,
  getCapacitorUpgradeCost,
  getComponentUpgradeCost,
  getSeasonTierClaimKey,
  inferAiPersonalityFromBuild,
  isQuickSwapAllowedForMode,
  markRivalAvenged,
  recordMatchInHistory,
  resolveStoryEnding,
  upsertRivalOnLoss,
} from './domain/rules';
import {
  AIPersonality,
  ArenaId,
  BattleAnalysisReport,
  BattleMode,
  BattleMutators,
  BattleResultSummary,
  CameraPreset,
  CharacterProfile,
  ComponentCategory,
  CosmeticCustomization,
  DifficultyLevel,
  ElementType,
  EquippedComponents,
  GraphicsQuality,
  KeyBindings,
  LeaderboardEntry,
  LoadoutPreset,
  MatchMode,
  OwnedTopState,
  PlayerSaveData,
  RankTierId,
  RivalRecord,
  SceneTelemetry,
  ShadowOpponentProfile,
  TacticalCommand,
  VictoryEmoteId,
  WeatherType,
} from './domain/types';
import {
  BattleSimulationState,
  FIXED_DT,
  OPPONENT_LAUNCH_SPAWN,
  PLAYER_LAUNCH_SPAWN,
  TopSimConfig,
  activateAbility,
  applyAuthoritativeSnapshot,
  applyLaunchVelocities,
  buildBattleAnalysisReport,
  buildMatchHighlightClip,
  createBattleSimulation,
  quickSwapPlayerLoadout,
  setBattleMode,
  setLaunchAim,
  setTacticalCommand,
  stepBattleSimulation,
  switchPlayerTeamTop,
} from './simulation/physicsEngine';
import type { MatchHighlightClip } from './domain/types';
import { ArenaSceneController, ReplayHudTelemetry } from './scene/arenaScene';
import {
  getStorageStatus,
  loadPlayerSave,
  resetPlayerSave,
  savePlayerData,
} from './infrastructure/persistence';
import {
  buildOnlinePayloadFromTop,
  claimSeasonTierReward,
  getOnlineSessionState,
  onlinePvpClient,
  type OnlineRoomView,
} from './infrastructure/onlineClient';
import { soundEngine } from './audio/soundEngine';
import { TitleOverlay } from './ui/TitleOverlay';
import { BattleHud, CombatDamagePopup, HudSnapshot } from './ui/BattleHud';
import { WorkshopModal } from './ui/WorkshopModal';
import { CollectionModal } from './ui/CollectionModal';
import { TournamentModal } from './ui/TournamentModal';
import { BattleResultsModal, PauseModal, SettingsModal } from './ui/Modals';
import { CharacterCreatorModal } from './ui/CharacterCreatorModal';
import { LeaderboardModal } from './ui/LeaderboardModal';
import { EndingCeremonyModal, StoryDecisionModal } from './ui/DecisionAndEndingModals';
import { PreparationModal } from './ui/PreparationModal';
import { MissionsModal } from './ui/MissionsModal';
import { OnlineModal } from './ui/OnlineModal';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { HowToPlayModal } from './ui/HowToPlayModal';

type AppShellState = 'title' | 'playing' | 'paused' | 'replay' | 'gameover';
type ActiveModal =
  | 'none'
  | 'workshop'
  | 'collection'
  | 'training'
  | 'tournament'
  | 'survival'
  | 'boss'
  | 'team'
  | 'missions'
  | 'online'
  | 'settings'
  | 'character'
  | 'leaderboard';

interface PendingBattleConfig {
  mode: MatchMode;
  arenaId: ArenaId;
  opponentId: string;
  isTeamBattle: boolean;
  survivalWave?: number;
  carryStaminaRatio?: number;
  carryDurabilityRatio?: number;
  mutators?: BattleMutators;
  weather?: WeatherType;
  shadowOpponent?: ShadowOpponentProfile;
  revengeRival?: RivalRecord;
}

const CAMERA_PRESETS: CameraPreset[] = ['Broadcast', 'LowAction', 'TopDown', 'Orbit'];

function createHudSnapshot(
  sim: BattleSimulationState,
  bannerText: string | null,
  isSpectating = false,
  spectatorCount = 0
): HudSnapshot {
  const inwardA = Math.atan2(-sim.player.z, -sim.player.x);
  let angleDelta = sim.launchSelection.angleRad - inwardA;
  while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
  while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
  const launchAngleDeg = Math.round(Math.min(90, Math.max(0, Math.abs(angleDelta) * (180 / Math.PI))));

  return {
    phase: sim.phase,
    arenaId: sim.arenaId,
    weather: sim.weather,
    elapsedTime: sim.elapsedTime,
    launchCountdown: sim.launchCountdown,
    launchAimSet: sim.launchSelection.aimSetByPlayer,
    launchTargetX: sim.launchSelection.targetX,
    launchTargetZ: sim.launchSelection.targetZ,
    launchHandedness: sim.launchHandedness,
    launchAngleDeg,
    isTeamBattle: sim.isTeamBattle,
    teamSwitchCooldown: sim.teamSwitchCooldown,
    teamSlots: sim.playerTeam.map((m, idx) => ({
      name: m.config.name,
      element: m.config.element,
      staminaPct: Math.round(
        (idx === sim.activeTeamIndex ? sim.player.staminaRatio : m.staminaRatio) * 100
      ),
      knockedOut:
        idx === sim.activeTeamIndex
          ? sim.player.ringedOut || sim.player.burstOut || sim.player.knockedOut
          : m.knockedOut,
      active: idx === sim.activeTeamIndex,
    })),
    player: {
      name: sim.player.name,
      element: sim.player.element,
      secondaryElement: sim.player.secondaryElement,
      rpm: Math.round(sim.player.omega * 9.55),
      staminaPct: Math.round(sim.player.staminaRatio * 100),
      durabilityPct: Math.round(
        (sim.player.durability / Math.max(1, sim.player.maxDurability)) * 100
      ),
      stabilityPct: Math.round(sim.player.stability),
      energy: sim.player.energy,
      maxEnergy: sim.player.maxEnergy,
      resonance: sim.player.resonance,
      mode: sim.player.battleMode,
      command: sim.player.tacticalCommand,
      partDurability: { ...sim.player.partDurability },
      statuses: sim.player.statuses.map((s) => s.type),
      statDebuffs: sim.player.statDebuffs.map((d) => ({
        kind: d.kind,
        label: d.label,
        remainingSec: d.remainingSec,
        colorHex: d.colorHex,
      })),
      slots: sim.player.abilitySlots.map((s) => ({
        abilityId: s.abilityId,
        cooldown: s.cooldownRemaining,
        active: s.activeRemaining,
      })),
    },
    opponent: {
      name: sim.opponent.name,
      element: sim.opponent.element,
      secondaryElement: sim.opponent.secondaryElement,
      rpm: Math.round(sim.opponent.omega * 9.55),
      staminaPct: Math.round(sim.opponent.staminaRatio * 100),
      durabilityPct: Math.round(
        (sim.opponent.durability / Math.max(1, sim.opponent.maxDurability)) * 100
      ),
      stabilityPct: Math.round(sim.opponent.stability),
      mode: sim.opponent.battleMode,
      command: sim.opponent.tacticalCommand,
      statuses: sim.opponent.statuses.map((s) => s.type),
      statDebuffs: sim.opponent.statDebuffs.map((d) => ({
        kind: d.kind,
        label: d.label,
        remainingSec: d.remainingSec,
        colorHex: d.colorHex,
      })),
    },
    mutators: sim.mutators,
    isSpectating: isSpectating || sim.isSpectating,
    spectatorCount: spectatorCount || sim.spectatorCount,
    bannerText,
  };
}

function buildPlayerTopSimConfig(
  top: OwnedTopState,
  save: PlayerSaveData,
  initialMode: BattleMode,
  initialCommand: TacticalCommand
): TopSimConfig {
  const topDef = getTopDefinition(top.definitionId);
  const attrs = calculateAttributes(
    top.definitionId,
    top.equippedComponents,
    save.componentUpgradeLevels,
    top.level,
    top.evolutionPathId,
    save.character.stats,
    top.secondaryElement
  );
  const phys = calculatePhysicalProfile(
    top.definitionId,
    top.equippedComponents,
    save.componentUpgradeLevels,
    top.level,
    top.evolutionPathId,
    save.character.stats,
    top.secondaryElement,
    save.capacitorLevel
  );
  return {
    entityId: 'player',
    instanceId: top.instanceId,
    name: topDef.displayName,
    element: topDef.element,
    secondaryElement: top.secondaryElement,
    attributes: attrs,
    physical: phys,
    abilities: top.equippedAbilities,
    initialMode,
    initialCommand,
    evolutionStage: top.evolutionStage,
  };
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ArenaSceneController | null>(null);

  const [urlDebugForced] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'
  );

  const [save, setSave] = useState<PlayerSaveData>(() => createDefaultSaveData());
  const saveRef = useRef<PlayerSaveData>(save);
  const [saveLoaded, setSaveLoaded] = useState(false);

  const [shellState, setShellState] = useState<AppShellState>('title');
  const shellStateRef = useRef<AppShellState>('title');
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const activeModalRef = useRef<ActiveModal>('none');

  const [pendingBattle, setPendingBattle] = useState<PendingBattleConfig | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [launchMeter, setLaunchMeter] = useState(0.5);
  const [battleResult, setBattleResult] = useState<BattleResultSummary | null>(null);
  const [replayTelemetry, setReplayTelemetry] = useState<ReplayHudTelemetry | null>(null);
  const [pendingDecisionId, setPendingDecisionId] = useState<string | null>(null);
  const [pendingEndingId, setPendingEndingId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [webglWarning, setWebglWarning] = useState<string | null>(null);
  const [webglInitError, setWebglInitError] = useState<string | null>(null);
  const [webglContextLost, setWebglContextLost] = useState(false);
  const [sceneTelemetry, setSceneTelemetry] = useState<SceneTelemetry | null>(null);
  const [sceneRecoveryKey, setSceneRecoveryKey] = useState(0);
  const [keyBindingNotice, setKeyBindingNotice] = useState<string | null>(null);
  const hasBootstrappedSaveRef = useRef(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const howToPlayOpenRef = useRef(false);
  const [activeMatchMode, setActiveMatchMode] = useState<MatchMode>('Training');
  const [pauseQuickSwapFocus, setPauseQuickSwapFocus] = useState(false);
  const [reconnectGraceSec, setReconnectGraceSec] = useState<number | null>(null);
  const [onlineRttMs, setOnlineRttMs] = useState<number | null>(null);
  const [showFirstMatchHint, setShowFirstMatchHint] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sl_first_launch_hint_dismissed') !== '1';
    } catch {
      return true;
    }
  });

  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomView | null>(null);
  const [onlineQueueMode, setOnlineQueueMode] = useState<'OnlineFriendly' | 'OnlineRanked' | null>(
    null
  );
  const [onlineQueuePos, setOnlineQueuePos] = useState(0);
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string | null>(null);

  const onlineMatchRef = useRef<{
    roomId: string;
    myPlayerId: string;
    playerSideId: string;
    opponentPlayerId: string;
    opponentHandle: string;
    isHost: boolean;
    mode: 'OnlineFriendly' | 'OnlineRanked';
    arenaId: ArenaId;
    sentComplete: boolean;
  } | null>(null);

  const simRef = useRef<BattleSimulationState | null>(null);
  const simAccumulatorRef = useRef(0);
  const hudThrottleRef = useRef(0);
  const launchPhaseClockRef = useRef(0);
  const launchOscValueRef = useRef(0.5);
  const bannerRef = useRef<{ text: string; ttl: number } | null>(null);
  const [combatPopups, setCombatPopups] = useState<CombatDamagePopup[]>([]);
  const combatPopupsRef = useRef<{ popup: CombatDamagePopup; createdAtMs: number }[]>([]);
  const popupSeqRef = useRef(0);
  const lastPopupAtRef = useRef(0);
  const [workshopExploded, setWorkshopExploded] = useState(false);
  const [workshopCategory, setWorkshopCategory] = useState<ComponentCategory>('AttackBlade');
  const [workshopPartFocusSignal, setWorkshopPartFocusSignal] = useState(0);
  const prevGamepadButtonsRef = useRef<boolean[]>([]);
  const battleContextRef = useRef<{
    mode: MatchMode;
    arenaId: ArenaId;
    opponentId: string;
    isTeamBattle: boolean;
    survivalWave: number | null;
    preferredMode: BattleMode;
    preferredCommand: TacticalCommand;
    opponentName?: string;
    opponentTopDefinitionId?: string;
    opponentElement?: ElementType;
    opponentSecondaryElement?: ElementType | null;
    opponentLevel?: number;
    opponentEvolutionStage?: number;
    opponentEvolutionPathId?: string | null;
    opponentComponents?: EquippedComponents;
    opponentAbilities?: [string, string, string, string];
    opponentCosmetics?: CosmeticCustomization;
    opponentAppearance?: CharacterProfile['appearance'];
    opponentMmr?: number;
    isRevengeMatch?: boolean;
    mutators?: BattleMutators;
    weather?: WeatherType;
    shadowOpponent?: ShadowOpponentProfile;
    revengeRival?: RivalRecord;
  }>({
    mode: 'Training',
    arenaId: 'standard',
    opponentId: OPPONENTS[0].id,
    isTeamBattle: false,
    survivalWave: null,
    preferredMode: 'Attack',
    preferredCommand: 'Aggressive',
  });

  // Debug drawer & shortcuts strictly gated to Training mode
  const isDebugActive =
    activeMatchMode === 'Training' && (urlDebugForced || save.settings.debugMode);
  const isDebugActiveRef = useRef(isDebugActive);
  useEffect(() => {
    isDebugActiveRef.current = isDebugActive;
  }, [isDebugActive]);

  useEffect(() => {
    howToPlayOpenRef.current = howToPlayOpen;
  }, [howToPlayOpen]);

  const activeTop: OwnedTopState =
    save.ownedTops.find((t) => t.instanceId === save.selectedTopInstanceId) ?? save.ownedTops[0];

  const unclaimedMissionsCount = useMemo(
    () =>
      MISSIONS_CATALOG.filter((m) => {
        const entry = save.missionProgress[m.id];
        return entry && !entry.claimed && entry.progress >= m.target;
      }).length,
    [save.missionProgress]
  );

  const updateSave = useCallback((updater: (prev: PlayerSaveData) => PlayerSaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      saveRef.current = next;
      void savePlayerData(next).then(() => {
        const st = getStorageStatus();
        setStorageWarning(st.degraded ? st.reason : null);
      });
      return next;
    });
  }, []);

  useEffect(() => {
    document.body.dataset.state = shellState;
    shellStateRef.current = shellState;
  }, [shellState]);

  useEffect(() => {
    activeModalRef.current = activeModal;
  }, [activeModal]);

  const syncShowcaseVisuals = useCallback((currentSave: PlayerSaveData) => {
    const controller = sceneRef.current;
    if (!controller) return;
    controller.setArena(currentSave.selectedArenaId);
    controller.setWeather('Clear');
    controller.setBattleEnvironment(null);
    const top =
      currentSave.ownedTops.find((t) => t.instanceId === currentSave.selectedTopInstanceId) ??
      currentSave.ownedTops[0];
    const topDef = getTopDefinition(top.definitionId);
    const evoPath = top.evolutionPathId ? getEvolutionPath(top.evolutionPathId) : undefined;
    controller.setPlayerTopVisual({
      equipped: top.equippedComponents,
      element: topDef.element,
      secondaryElement: top.secondaryElement,
      evolutionStage: top.evolutionStage,
      scaleMultiplier: evoPath?.scaleMultiplier ?? 1,
      cosmetics: top.cosmetics,
    });
    const opp = getOpponentDefinition(OPPONENTS[0].id);
    const oppTop = getTopDefinition(opp.topId);
    controller.setOpponentTopVisual({
      equipped: opp.components,
      element: oppTop.element,
      secondaryElement: opp.secondaryElement,
      evolutionStage: 0,
    });
    controller.setVictoryEmotes(top.cosmetics?.victoryEmote ?? 'apex_flare', 'apex_flare');
  }, []);

  const syncActiveTeamMemberVisual = useCallback(
    (sim: BattleSimulationState, currentSave: PlayerSaveData) => {
      const controller = sceneRef.current;
      if (!controller) return;
      const snap = sim.playerTeam[sim.activeTeamIndex];
      const owned =
        currentSave.ownedTops.find((t) => t.instanceId === snap?.config.instanceId) ??
        currentSave.ownedTops.find((t) => t.instanceId === currentSave.selectedTopInstanceId) ??
        currentSave.ownedTops[0];
      const topDef = getTopDefinition(owned.definitionId);
      const evoPath = owned.evolutionPathId ? getEvolutionPath(owned.evolutionPathId) : undefined;
      controller.setPlayerTopVisual({
        equipped: owned.equippedComponents,
        element: topDef.element,
        secondaryElement: owned.secondaryElement,
        evolutionStage: owned.evolutionStage,
        scaleMultiplier: evoPath?.scaleMultiplier ?? 1,
        cosmetics: owned.cosmetics,
      });
    },
    []
  );

  // Start battle immediately into 5s Launch (or Combat when skipLaunchGauge)
  const startBattle = useCallback(
    (params: {
      mode: MatchMode;
      arenaId?: ArenaId;
      opponentId?: string;
      shadowOpponent?: ShadowOpponentProfile;
      revengeRival?: RivalRecord;
      mutators?: BattleMutators;
      weather?: WeatherType;
      isTeamBattle?: boolean;
      survivalWave?: number;
      carryStaminaRatio?: number;
      carryDurabilityRatio?: number;
      skipLaunchGauge?: boolean;
    }) => {
      soundEngine.unlock();
      const currentSave = saveRef.current;
      const arenaId = params.arenaId ?? currentSave.selectedArenaId ?? 'standard';
      const weather: WeatherType =
        params.weather ?? currentSave.preferredWeather ?? resolveArenaDefaultWeather(arenaId);
      const top =
        currentSave.ownedTops.find((t) => t.instanceId === currentSave.selectedTopInstanceId) ??
        currentSave.ownedTops[0];
      const topDef = getTopDefinition(top.definitionId);
      const evoPath = top.evolutionPathId ? getEvolutionPath(top.evolutionPathId) : undefined;

      const playerConfig = buildPlayerTopSimConfig(
        top,
        currentSave,
        battleContextRef.current.preferredMode,
        battleContextRef.current.preferredCommand
      );

      let teamConfigs: TopSimConfig[] | undefined;
      if (params.isTeamBattle && currentSave.teamTopInstanceIds.length > 1) {
        const teamOwned = currentSave.teamTopInstanceIds
          .map((id) => currentSave.ownedTops.find((t) => t.instanceId === id))
          .filter((t): t is OwnedTopState => Boolean(t));
        const ordered = [top, ...teamOwned.filter((t) => t.instanceId !== top.instanceId)].slice(
          0,
          3
        );
        teamConfigs = ordered.map((t) =>
          buildPlayerTopSimConfig(
            t,
            currentSave,
            battleContextRef.current.preferredMode,
            battleContextRef.current.preferredCommand
          )
        );
      }

      let oppId = params.opponentId ?? OPPONENTS[0].id;
      let oppName = '';
      let oppElement = topDef.element;
      let oppSecondary: ElementType | null = null;
      let oppAbilities: string[] = [];
      let oppStage = 0;
      let oppLevel = 1;
      let oppEvoPathId: string | null = null;
      let oppCosmetics: CosmeticCustomization | undefined;
      let oppComponents: EquippedComponents;
      let oAttrs: ReturnType<typeof calculateAttributes>;
      let oPhys: ReturnType<typeof calculatePhysicalProfile>;
      let aiPersonalityCmd: TacticalCommand = 'Aggressive';
      let aiPersonalityType: AIPersonality = 'Tactical';
      let aiDifficulty: DifficultyLevel = 'Normal';
      let bossPhases: ReturnType<typeof getOpponentDefinition>['bossPhases'] | undefined;
      let oppAppearance: CharacterProfile['appearance'] | undefined;
      let oppMmr: number | undefined;

      if (params.shadowOpponent) {
        const s = params.shadowOpponent;
        oppId = s.playerId;
        oppName = s.handle;
        const sTopDef = getTopDefinition(s.topDefinitionId);
        oppElement = s.element ?? sTopDef.element;
        oppSecondary = s.secondaryElement ?? null;
        oppAbilities = [...s.equippedAbilities];
        oppStage = s.evolutionStage;
        oppLevel = s.level;
        oppEvoPathId = s.evolutionPathId;
        oppCosmetics = s.cosmetics;
        oppComponents = s.equippedComponents;
        oAttrs = calculateAttributes(
          sTopDef.id,
          oppComponents,
          {},
          s.level,
          s.evolutionPathId,
          undefined,
          oppSecondary
        );
        oPhys = calculatePhysicalProfile(
          sTopDef.id,
          oppComponents,
          {},
          s.level,
          s.evolutionPathId,
          undefined,
          oppSecondary
        );
        aiPersonalityType = s.aiPersonality;
        aiPersonalityCmd =
          aiPersonalityType === 'Defensive'
            ? 'HoldPosition'
            : aiPersonalityType === 'Evasive'
              ? 'Circle'
              : 'Aggressive';
        aiDifficulty = s.aiDifficulty;
        oppAppearance = s.appearance;
        oppMmr = s.mmr;
      } else if (params.revengeRival) {
        const r = params.revengeRival;
        oppId = r.playerId;
        oppName = r.handle;
        const rTopDef = getTopDefinition(r.topDefinitionId);
        oppElement = r.element ?? rTopDef.element;
        oppSecondary = r.secondaryElement ?? null;
        oppComponents = r.equippedComponents;
        oppAbilities = [...r.equippedAbilities];
        oppStage = r.evolutionStage;
        oppLevel = r.level;
        oppEvoPathId = r.evolutionPathId;
        oppCosmetics = r.cosmetics;
        oAttrs = calculateAttributes(
          rTopDef.id,
          oppComponents,
          {},
          r.level,
          r.evolutionPathId,
          undefined,
          oppSecondary
        );
        oPhys = calculatePhysicalProfile(
          rTopDef.id,
          oppComponents,
          {},
          r.level,
          r.evolutionPathId,
          undefined,
          oppSecondary
        );
        aiPersonalityType = inferAiPersonalityFromBuild(oppComponents, rTopDef.id);
        aiPersonalityCmd =
          aiPersonalityType === 'Defensive'
            ? 'HoldPosition'
            : aiPersonalityType === 'Evasive'
              ? 'Circle'
              : 'Aggressive';
        aiDifficulty = 'Hard';
        oppAppearance = r.appearance;
        oppMmr = r.mmr;
      } else {
        const opp = getOpponentDefinition(oppId);
        const oppTop = getTopDefinition(opp.topId);
        oppName = opp.displayName;
        oppElement = oppTop.element;
        oppSecondary = opp.secondaryElement ?? null;
        oppAbilities = opp.abilities;
        oppStage = opp.isBoss ? 1 : 0;
        oppEvoPathId = opp.isBoss ? 'evo.hybrid' : null;
        oppComponents = opp.components;
        const waveScale =
          params.mode === 'Survival' && params.survivalWave
            ? Math.max(0, params.survivalWave - 1)
            : 0;
        oppLevel = opp.level + waveScale;
        oAttrs = calculateAttributes(
          opp.topId,
          opp.components,
          {},
          oppLevel,
          oppEvoPathId,
          undefined,
          opp.secondaryElement
        );
        oPhys = calculatePhysicalProfile(
          opp.topId,
          opp.components,
          {},
          oppLevel,
          oppEvoPathId,
          undefined,
          opp.secondaryElement
        );
        aiPersonalityType = opp.personality;
        aiPersonalityCmd = opp.personality === 'Evasive' ? 'Circle' : 'Aggressive';
        aiDifficulty = opp.difficulty;
        bossPhases = opp.bossPhases;
      }

      const allowTrainingDebug =
        params.mode === 'Training' && (urlDebugForced || currentSave.settings.debugMode);

      const battleId = `battle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const sim = createBattleSimulation({
        battleId,
        arenaId,
        playerConfig,
        opponentConfig: {
          entityId: 'opponent',
          name: oppName,
          element: oppElement,
          secondaryElement: oppSecondary,
          attributes: oAttrs,
          physical: oPhys,
          abilities: (oppAbilities.length === 4
            ? oppAbilities
            : topDef.defaultAbilities) as [string, string, string, string],
          initialMode:
            aiPersonalityType === 'Defensive'
              ? 'Defense'
              : aiPersonalityType === 'Evasive'
                ? 'Speed'
                : 'Attack',
          initialCommand: aiPersonalityCmd,
          evolutionStage: oppStage,
        },
        aiPersonality: aiPersonalityType,
        aiDifficulty,
        bossPhases,
        playerTeamConfigs: teamConfigs,
        initialPlayerStaminaRatio: params.carryStaminaRatio,
        initialPlayerDurabilityRatio: params.carryDurabilityRatio,
        startInPhase: params.skipLaunchGauge ? 'Combat' : 'Launch',
        debugMode: allowTrainingDebug,
        mutators: params.mutators,
        weather,
      });

      const resolvedOppTopId =
        params.shadowOpponent?.topDefinitionId ??
        params.revengeRival?.topDefinitionId ??
        (params.opponentId ? getOpponentDefinition(params.opponentId)?.topId : undefined);
      battleContextRef.current.mode = params.mode;
      battleContextRef.current.arenaId = arenaId;
      battleContextRef.current.opponentId = oppId;
      battleContextRef.current.opponentName = oppName;
      battleContextRef.current.opponentTopDefinitionId = resolvedOppTopId;
      battleContextRef.current.opponentElement = oppElement;
      battleContextRef.current.opponentSecondaryElement = oppSecondary;
      battleContextRef.current.opponentLevel = oppLevel;
      battleContextRef.current.opponentEvolutionStage = oppStage;
      battleContextRef.current.opponentEvolutionPathId = oppEvoPathId;
      battleContextRef.current.opponentComponents = oppComponents;
      battleContextRef.current.opponentAbilities =
        oppAbilities.length === 4
          ? ([...oppAbilities] as [string, string, string, string])
          : undefined;
      battleContextRef.current.opponentCosmetics = oppCosmetics;
      battleContextRef.current.opponentAppearance = oppAppearance;
      battleContextRef.current.opponentMmr = oppMmr;
      battleContextRef.current.isRevengeMatch = Boolean(params.revengeRival);
      battleContextRef.current.mutators = params.mutators;
      battleContextRef.current.weather = weather;
      battleContextRef.current.shadowOpponent = params.shadowOpponent;
      battleContextRef.current.revengeRival = params.revengeRival;
      battleContextRef.current.isTeamBattle = Boolean(teamConfigs && teamConfigs.length > 1);
      battleContextRef.current.survivalWave =
        params.mode === 'Survival' ? params.survivalWave ?? 1 : null;
      onlineMatchRef.current = null;
      setActiveMatchMode(params.mode);
      setReconnectGraceSec(null);
      setOnlineRttMs(null);

      simRef.current = sim;
      simAccumulatorRef.current = 0;
      launchPhaseClockRef.current = 0;
      bannerRef.current = null;
      combatPopupsRef.current = [];
      setCombatPopups([]);
      setWorkshopExploded(false);
      setPendingBattle(null);
      setBattleResult(null);
      setReplayTelemetry(null);
      setActiveModal('none');
      setHowToPlayOpen(false);

      if (sceneRef.current) {
        sceneRef.current.setReplayClip(null);
        sceneRef.current.setArena(arenaId);
        sceneRef.current.setWeather(weather);
        sceneRef.current.setBattleEnvironment({
          matchMode: params.mode,
          mutators: sim.mutators,
          survivalWave: params.mode === 'Survival' ? params.survivalWave ?? 1 : null,
        });
        sceneRef.current.setPlayerTopVisual({
          equipped: top.equippedComponents,
          element: topDef.element,
          secondaryElement: top.secondaryElement,
          evolutionStage: top.evolutionStage,
          scaleMultiplier: evoPath?.scaleMultiplier ?? 1,
          cosmetics: top.cosmetics,
        });
        sceneRef.current.setOpponentTopVisual({
          equipped: oppComponents,
          element: oppElement,
          secondaryElement: oppSecondary,
          evolutionStage: oppStage,
          cosmetics: oppCosmetics,
        });
        sceneRef.current.setVictoryEmotes(
          top.cosmetics?.victoryEmote ?? 'apex_flare',
          oppCosmetics?.victoryEmote ?? 'apex_flare'
        );
        sceneRef.current.clearCollisionHeatmap();
        sceneRef.current.clearFloorScuffs();
        sceneRef.current.setShowDiagnostics(
          Boolean(currentSave.settings.showDiagnostics || (params.mode === 'Training' && urlDebugForced))
        );
        sceneRef.current.setSpectatorMode(false);
        sceneRef.current.setCameraPreset(currentSave.settings.cameraPreset);
        sceneRef.current.setCameraMode('battle', 0);
        if (params.skipLaunchGauge) {
          sceneRef.current.triggerLaunchSlam(sim);
        }
      }

      if (params.skipLaunchGauge) {
        soundEngine.playLaunch();
      }

      setHud(createHudSnapshot(sim, null));
      setShellState('playing');
      document.body.dataset.state = 'playing';
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [urlDebugForced]
  );

  // Open pre-battle Preparation Briefing before entering the 5s Launch phase
  const openPreparation = useCallback((cfg: PendingBattleConfig) => {
    soundEngine.playClick();
    setActiveModal('none');
    setHowToPlayOpen(false);
    setPendingBattle({
      ...cfg,
      weather: cfg.weather ?? saveRef.current.preferredWeather ?? 'Clear',
    });
  }, []);

  const finalizeBattle = useCallback(
    (
      sim: BattleSimulationState,
      serverHighlights?: MatchHighlightClip,
      serverAnalysis?: BattleAnalysisReport
    ) => {
      const ctx = battleContextRef.current;
      const opp = getOpponentDefinition(ctx.opponentId);
      const won = sim.winnerSide === 'player';
      const finishReason = sim.finishReason ?? 'Survival';
      const currentSave = saveRef.current;
      const analysis = serverAnalysis ?? buildBattleAnalysisReport(sim);
      const activePlayerTop =
        currentSave.ownedTops.find((t) => t.instanceId === currentSave.selectedTopInstanceId) ??
        currentSave.ownedTops[0];
      const playerEmote: VictoryEmoteId = activePlayerTop?.cosmetics?.victoryEmote ?? 'apex_flare';
      const oppEmote: VictoryEmoteId = ctx.opponentCosmetics?.victoryEmote ?? 'apex_flare';
      const winnerEmote: VictoryEmoteId = won ? playerEmote : oppEmote;

      if (sim.isSpectating) {
        soundEngine.updateSpinHum(false, 0, 0);
        const summary: BattleResultSummary = {
          battleId: sim.battleId,
          mode: ctx.mode,
          arenaId: sim.arenaId,
          opponentName: ctx.opponentName ?? opp?.displayName,
          won: sim.winnerSide === 'player',
          winnerSide: sim.winnerSide ?? 'opponent',
          finishReason,
          durationSec: sim.elapsedTime,
          maxImpactImpulse: sim.maxImpactImpulse,
          collisionCount: sim.collisionCount,
          abilitiesUsed: 0,
          launchQuality: 1,
          playerRemainingStamina: sim.player.staminaRatio * 100,
          opponentRemainingStamina: sim.opponent.staminaRatio * 100,
          playerRemainingDurability:
            (sim.player.durability / Math.max(1, sim.player.maxDurability)) * 100,
          opponentRemainingDurability:
            (sim.opponent.durability / Math.max(1, sim.opponent.maxDurability)) * 100,
          partDurability: { ...sim.player.partDurability },
          brokenParts: [...sim.player.brokenParts],
          scoreBreakdown: {
            basePoints: 0,
            finishBonusPoints: 0,
            tacticalClashPoints: 0,
            abilityMasteryPoints: 0,
            perfectLaunchPoints: 0,
            secretBonusPoints: 0,
            totalPointsEarned: 0,
            newlyDiscoveredSecrets: [],
          },
          highlights: serverHighlights ?? buildMatchHighlightClip(sim),
          rewards: {
            gold: 0,
            xp: 0,
            metalShards: 0,
            energyCrystals: 0,
            elementalEssence: 0,
            evolutionTokens: 0,
            legendaryFragments: 0,
            alreadyClaimed: true,
          },
          perfectLaunch: sim.perfectLaunch,
          mutators: sim.mutators,
          weather: sim.weather,
          victoryEmote: winnerEmote,
          analysis,
          isSpectating: true,
        };
        setBattleResult(summary);
        const scene = sceneRef.current;
        if (
          summary.highlights &&
          summary.highlights.frames.length >= 2 &&
          scene &&
          !scene.isContextLost()
        ) {
          scene.setVictoryEmotes(playerEmote, oppEmote);
          setReplayTelemetry({
            angleIndex: 0,
            angleCode: 'CAM 01',
            angleLabel: 'WIDE BROADCAST',
            progress: 0,
            speed: 0.42,
            passCount: 0,
            inClimaxHold: false,
            finishReason: summary.finishReason,
            winnerSide: summary.winnerSide,
          });
          scene.setReplayClip(summary.highlights, {
            onTelemetry: (tel) => setReplayTelemetry(tel),
            onImpactSfx: (kind, intensity) => {
              if (kind === 'burst') soundEngine.playBurst();
              else soundEngine.playCollision(intensity, intensity > 1.0);
            },
            onFirstPassComplete: () => {
              setShellState((prev) => (prev === 'replay' ? 'gameover' : prev));
            },
          });
          soundEngine.setWeatherAmbiance(summary.weather ?? 'Clear', true);
          setShellState('replay');
        } else {
          setShellState('gameover');
        }
        return;
      }

      const rewards = calculateBattleRewards({
        battleId: sim.battleId,
        won,
        finishReason,
        difficulty: opp?.difficulty ?? 'Normal',
        isBoss: opp?.isBoss ?? false,
        isTournament: ctx.mode === 'Tournament',
        isSurvival: ctx.mode === 'Survival',
        survivalWave: ctx.survivalWave ?? undefined,
        durationSec: sim.elapsedTime,
        processedBattleIds: currentSave.processedBattleIds,
      });

      const playerStaminaPct = sim.player.staminaRatio * 100;
      const playerDurabilityPct =
        (sim.player.durability / Math.max(1, sim.player.maxDurability)) * 100;

      const scoreBreakdown = evaluateBattleScoreBreakdown({
        won,
        finishReason,
        difficulty: opp?.difficulty ?? 'Normal',
        isBoss: opp?.isBoss ?? false,
        isTournament: ctx.mode === 'Tournament',
        collisionCount: sim.collisionCount,
        abilitiesUsed: sim.abilitiesUsedByPlayer,
        launchQuality: sim.launchQuality,
        playerRemainingStamina: playerStaminaPct,
        playerRemainingDurability: playerDurabilityPct,
        discoveredSecrets: currentSave.discoveredSecrets,
        alreadyClaimed: rewards.alreadyClaimed,
        perfectLaunch: sim.perfectLaunch,
      });

      const summary: BattleResultSummary = {
        battleId: sim.battleId,
        mode: ctx.mode,
        arenaId: sim.arenaId,
        opponentName: ctx.opponentName ?? opp?.displayName,
        won,
        winnerSide: sim.winnerSide ?? 'opponent',
        finishReason,
        durationSec: sim.elapsedTime,
        maxImpactImpulse: sim.maxImpactImpulse,
        collisionCount: sim.collisionCount,
        abilitiesUsed: sim.abilitiesUsedByPlayer,
        launchQuality: sim.launchQuality,
        playerRemainingStamina: playerStaminaPct,
        opponentRemainingStamina: sim.opponent.staminaRatio * 100,
        playerRemainingDurability: playerDurabilityPct,
        opponentRemainingDurability:
          (sim.opponent.durability / Math.max(1, sim.opponent.maxDurability)) * 100,
        partDurability: { ...sim.player.partDurability },
        brokenParts: [...sim.player.brokenParts],
        survivalWave: ctx.survivalWave ?? undefined,
        scoreBreakdown,
        highlights: serverHighlights ?? buildMatchHighlightClip(sim),
        rewards,
        perfectLaunch: sim.perfectLaunch,
        mutators: sim.mutators,
        weather: sim.weather,
        victoryEmote: winnerEmote,
        isShadowPvP: ctx.mode === 'ShadowPvP',
        isRevengeMatch: ctx.isRevengeMatch,
        analysis,
        isSpectating: false,
      };

      soundEngine.updateSpinHum(false, 0, 0);
      soundEngine.playOutcome(won);

      if (!rewards.alreadyClaimed) {
        updateSave((prev) => {
          const nextTops = prev.ownedTops.map((t) => {
            if (t.instanceId !== prev.selectedTopInstanceId) return t;
            const { updated } = addExperienceToTop(t, rewards.xp);
            const prevStats = updated.careerStats ?? createEmptyCareerStats();
            return {
              ...updated,
              wins: updated.wins + (won ? 1 : 0),
              losses: updated.losses + (won ? 0 : 1),
              careerStats: {
                matches: prevStats.matches + 1,
                wins: prevStats.wins + (won ? 1 : 0),
                losses: prevStats.losses + (won ? 0 : 1),
                totalClashes: prevStats.totalClashes + sim.collisionCount,
                peakImpulse: Math.max(prevStats.peakImpulse, sim.maxImpactImpulse),
                burstFinishes:
                  prevStats.burstFinishes + (won && finishReason === 'BurstFinish' ? 1 : 0),
                ringOutFinishes:
                  prevStats.ringOutFinishes + (won && finishReason === 'RingOut' ? 1 : 0),
                spinFinishes:
                  prevStats.spinFinishes + (won && finishReason === 'SpinFinish' ? 1 : 0),
                knockoutFinishes:
                  prevStats.knockoutFinishes + (won && finishReason === 'Knockout' ? 1 : 0),
              },
            };
          });

          let nextTournament = prev.tournament;
          const totalBracketRounds = prev.tournament.bracketSize || 4;
          if (ctx.mode === 'Tournament' && won) {
            const nextRound = Math.min(totalBracketRounds, prev.tournament.currentRound + 1);
            const completed = Math.max(prev.tournament.completedRounds, nextRound);
            nextTournament = {
              ...prev.tournament,
              active: completed < totalBracketRounds,
              currentRound: nextRound,
              completedRounds: completed,
              championshipsWon:
                prev.tournament.championshipsWon + (completed >= totalBracketRounds ? 1 : 0),
            };
          }

          const nextVisitedArenas = Array.from(
            new Set([...prev.visitedArenaIds, sim.arenaId])
          ) as ArenaId[];

          const nextBossDefeatedIds =
            opp?.isBoss && won
              ? Array.from(new Set([...prev.bossDefeatedIds, opp.id]))
              : prev.bossDefeatedIds;

          const waveReached =
            ctx.mode === 'Survival' && ctx.survivalWave
              ? won
                ? ctx.survivalWave
                : Math.max(0, ctx.survivalWave - 1)
              : 0;
          const nextSurvivalBest = Math.max(prev.survivalBestWave, waveReached);

          const totalXp = prev.playerExperience + rewards.xp;
          const nextPlayerLevel = Math.max(prev.playerLevel, 1 + Math.floor(totalXp / 180));
          const mergedSecrets = Array.from(
            new Set([...prev.discoveredSecrets, ...scoreBreakdown.newlyDiscoveredSecrets])
          );

          // Update Mission & Achievement progress
          const nextMissionProgress = { ...prev.missionProgress };
          for (const m of MISSIONS_CATALOG) {
            const cur = nextMissionProgress[m.id] ?? { progress: 0, claimed: false };
            let nextVal = cur.progress;
            switch (m.metric) {
              case 'battles_won':
                if (won) nextVal += 1;
                break;
              case 'knockouts':
                if (won && (finishReason === 'BurstFinish' || finishReason === 'Knockout')) {
                  nextVal += 1;
                }
                break;
              case 'burst_finishes':
                if (won && finishReason === 'BurstFinish') nextVal += 1;
                break;
              case 'ring_outs':
                if (won && finishReason === 'RingOut') nextVal += 1;
                break;
              case 'abilities_used':
                nextVal += sim.abilitiesUsedByPlayer;
                break;
              case 'survival_wave':
                nextVal = Math.max(nextVal, nextSurvivalBest);
                break;
              case 'boss_defeated':
                nextVal = nextBossDefeatedIds.length;
                break;
              case 'arena_variety':
                nextVal = nextVisitedArenas.length;
                break;
              case 'secrets_found':
                nextVal = mergedSecrets.length;
                break;
            }
            nextMissionProgress[m.id] = { ...cur, progress: nextVal };
          }

          const newLogs = [
            {
              id: `score-${sim.battleId}`,
              label: `${won ? 'Victory' : 'Match'} vs ${ctx.opponentName ?? opp?.displayName ?? 'Opponent'} (${finishReason})`,
              points: scoreBreakdown.totalPointsEarned,
              category: 'battle' as const,
              timestampMs: Date.now(),
            },
            ...scoreBreakdown.newlyDiscoveredSecrets.map((sid) => {
              const sec = getSecretDefinition(sid);
              return {
                id: `sec-${sim.battleId}-${sid}`,
                label: `Secret Found: ${sec?.title ?? sid}`,
                points: sec?.points ?? 0,
                category: 'secret' as const,
                timestampMs: Date.now(),
              };
            }),
            ...prev.scoreLog,
          ].slice(0, 25);

          const totalWinsAfter = nextTops.reduce((acc, t) => acc + t.wins, 0);
          const readyDecision = STORY_DECISIONS.find(
            (d) => totalWinsAfter >= d.stageNumber && !prev.decisionHistory[d.id]
          );
          if (readyDecision) {
            setPendingDecisionId(readyDecision.id);
          }

          // Record Match in History
          const nextHistory = recordMatchInHistory(prev.matchHistory ?? [], {
            battleId: sim.battleId,
            timestampMs: Date.now(),
            mode: ctx.mode,
            arenaId: sim.arenaId,
            opponentName: ctx.opponentName ?? opp?.displayName ?? 'Opponent',
            opponentElement: ctx.opponentElement ?? getTopDefinition(opp?.topId ?? 'top.iron_vanguard').element,
            won,
            finishReason,
            durationSec: sim.elapsedTime,
            maxImpactImpulse: sim.maxImpactImpulse,
            collisionCount: sim.collisionCount,
            perfectLaunch: sim.perfectLaunch,
            mutators: sim.mutators,
            scoreEarned: scoreBreakdown.totalPointsEarned,
            analysis,
            highlights: summary.highlights!,
          });

          // Update Rivals list
          let nextRivals = prev.rivals ?? [];
          if (!won && (ctx.mode === 'ShadowPvP' || ctx.mode === 'OnlineRanked')) {
            nextRivals = upsertRivalOnLoss(nextRivals, {
              playerId: ctx.opponentId,
              handle: ctx.opponentName ?? opp?.displayName ?? 'Opponent',
              sourceMode: ctx.mode === 'OnlineRanked' ? 'OnlineRanked' : 'ShadowPvP',
              topDefinitionId:
                ctx.opponentTopDefinitionId ?? opp?.topId ?? 'top.iron_vanguard',
              element: ctx.opponentElement ?? getTopDefinition(opp?.topId ?? 'top.iron_vanguard').element,
              secondaryElement: ctx.opponentSecondaryElement ?? null,
              level: ctx.opponentLevel ?? 1,
              evolutionStage: ctx.opponentEvolutionStage ?? 0,
              evolutionPathId: ctx.opponentEvolutionPathId ?? null,
              equippedComponents: ctx.opponentComponents,
              equippedAbilities: ctx.opponentAbilities,
              cosmetics: ctx.opponentCosmetics,
              appearance: ctx.opponentAppearance,
              mmr: ctx.opponentMmr,
            });
          } else if (won && ctx.isRevengeMatch) {
            nextRivals = markRivalAvenged(nextRivals, ctx.opponentId);
          }

          return {
            ...prev,
            playerLevel: nextPlayerLevel,
            playerExperience: totalXp,
            playerScore: prev.playerScore + scoreBreakdown.totalPointsEarned,
            scoreLog: newLogs,
            discoveredSecrets: mergedSecrets,
            currencies: {
              gold: prev.currencies.gold + rewards.gold,
              metalShards: prev.currencies.metalShards + rewards.metalShards,
              energyCrystals: prev.currencies.energyCrystals + rewards.energyCrystals,
              elementalEssence: prev.currencies.elementalEssence + rewards.elementalEssence,
              evolutionTokens: prev.currencies.evolutionTokens + rewards.evolutionTokens,
              legendaryFragments: prev.currencies.legendaryFragments + rewards.legendaryFragments,
            },
            ownedTops: nextTops,
            processedBattleIds: [...prev.processedBattleIds.slice(-90), sim.battleId],
            tournament: nextTournament,
            visitedArenaIds: nextVisitedArenas,
            bossDefeatedIds: nextBossDefeatedIds,
            survivalBestWave: nextSurvivalBest,
            missionProgress: nextMissionProgress,
            matchHistory: nextHistory,
            rivals: nextRivals,
          };
        });
      }

      setBattleResult(summary);
      const scene = sceneRef.current;
      if (
        summary.highlights &&
        summary.highlights.frames.length >= 2 &&
        scene &&
        !scene.isContextLost()
      ) {
        scene.setVictoryEmotes(playerEmote, oppEmote);
        setReplayTelemetry({
          angleIndex: 0,
          angleCode: 'CAM 01',
          angleLabel: 'WIDE BROADCAST',
          progress: 0,
          speed: 0.42,
          passCount: 0,
          inClimaxHold: false,
          finishReason: summary.finishReason,
          winnerSide: summary.winnerSide,
        });
        scene.setReplayClip(summary.highlights, {
          onTelemetry: (tel) => setReplayTelemetry(tel),
          onImpactSfx: (kind, intensity) => {
            if (kind === 'burst') soundEngine.playBurst();
            else soundEngine.playCollision(intensity, intensity > 1.0);
          },
          onFirstPassComplete: () => {
            setShellState((prev) => (prev === 'replay' ? 'gameover' : prev));
          },
        });
        soundEngine.setWeatherAmbiance(summary.weather ?? 'Clear', true);
        setShellState('replay');
      } else {
        setShellState('gameover');
      }
    },
    [updateSave]
  );

  const handleLaunchNow = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.phase !== 'Launch') return;
    soundEngine.unlock();
    const power = 0.5 + 0.5 * Math.sin(launchPhaseClockRef.current * 4.2);

    if (sim.isOnlineRemote && onlineMatchRef.current) {
      if (sim.launchSelection.powerLockedByPlayer) return;
      sim.launchSelection.powerRatio = Math.max(0.15, Math.min(1, power));
      sim.launchSelection.powerLockedByPlayer = true;
      onlinePvpClient.sendLaunchCommit(sim.launchSelection.powerRatio, sim.launchSelection.angleRad);
      bannerRef.current = { text: 'LAUNCH LOCKED · WAITING FOR RIVAL...', ttl: 3.0 };
      setHud(createHudSnapshot(sim, bannerRef.current.text));
      return;
    }

    applyLaunchVelocities(sim, power);
    soundEngine.playLaunch();
    setHud(createHudSnapshot(sim, 'SIMULTANEOUS LAUNCH!'));
  }, []);

  const handleActivateAbility = useCallback((slotIdx: number) => {
    const sim = simRef.current;
    if (!sim) return;
    soundEngine.unlock();
    if (activateAbility(sim, 'player', slotIdx)) {
      if (sim.isOnlineRemote && onlineMatchRef.current) {
        onlinePvpClient.sendAbilityUse(slotIdx);
      }
      setHud(createHudSnapshot(sim, bannerRef.current?.text ?? null));
    }
  }, []);

  const handleSwitchTeamTop = useCallback((targetIdx: number) => {
    const sim = simRef.current;
    if (!sim) return;
    soundEngine.unlock();
    if (switchPlayerTeamTop(sim, targetIdx)) {
      soundEngine.playAbility(false);
      syncActiveTeamMemberVisual(sim, saveRef.current);
      setHud(createHudSnapshot(sim, bannerRef.current?.text ?? null));
    }
  }, [syncActiveTeamMemberVisual]);

  const handleFrameTick = useCallback(
    (dt: number) => {
      const sim = simRef.current;
      const state = shellStateRef.current;
      const scene = sceneRef.current;

      if (state === 'replay') {
        soundEngine.updateSpinHum(false, 0, 0);
        soundEngine.setDynamicMusic(saveRef.current.settings.dynamicMusic, false, false);
        soundEngine.updateWeatherDynamics(dt, 1.05);
        return;
      }

      if (state !== 'playing' || !sim) {
        soundEngine.updateSpinHum(false, 0, 0);
        soundEngine.setDynamicMusic(saveRef.current.settings.dynamicMusic, false, false);
        return;
      }

      // Optional Gamepad Polling during Launch & Live Combat
      if (saveRef.current.settings.gamepadEnabled && typeof navigator.getGamepads === 'function') {
        const gp = navigator.getGamepads()[0];
        if (gp) {
          const prev = prevGamepadButtonsRef.current;
          const pressedNow = gp.buttons.map((b) => b.pressed);
          const justPressed = (idx: number) => Boolean(pressedNow[idx] && !prev[idx]);
          if (sim.phase === 'Launch' && justPressed(0)) {
            handleLaunchNow();
          } else if (sim.phase === 'Combat' || sim.phase === 'Critical') {
            if (justPressed(0)) handleActivateAbility(0);
            if (justPressed(2)) handleActivateAbility(1);
            if (justPressed(1)) handleActivateAbility(2);
            if (justPressed(3)) handleActivateAbility(3);
            if ((justPressed(4) || justPressed(5)) && sim.isTeamBattle) {
              const nextIdx = (sim.activeTeamIndex + 1) % sim.playerTeam.length;
              handleSwitchTeamTop(nextIdx);
            }
          }
          prevGamepadButtonsRef.current = pressedNow;
        }
      }

      const wasLaunch = sim.phase === 'Launch';
      if (wasLaunch) {
        launchPhaseClockRef.current += dt;
        const osc = 0.5 + 0.5 * Math.sin(launchPhaseClockRef.current * 4.2);
        launchOscValueRef.current = osc;
        if (!sim.launchSelection.powerLockedByPlayer) {
          sim.launchSelection.powerRatio = osc;
        }
      }

      // Fixed 50Hz timestep with max 3 catch-up steps (runs in Launch too for 5s countdown!)
      const simStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const prevPlayerStam = sim.player.staminaRatio;
      const prevOppStam = sim.opponent.staminaRatio;
      const prevPlayerDur = sim.player.durability;
      const prevOppDur = sim.opponent.durability;
      simAccumulatorRef.current += dt;
      let steps = 0;
      while (simAccumulatorRef.current >= FIXED_DT && steps < 3) {
        stepBattleSimulation(sim, FIXED_DT);
        simAccumulatorRef.current -= FIXED_DT;
        steps += 1;
      }
      const droppedSteps =
        simAccumulatorRef.current >= FIXED_DT
          ? Math.floor(simAccumulatorRef.current / FIXED_DT)
          : 0;
      const simStepMs =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - simStartMs;
      scene?.setLastSimMetrics(simStepMs, droppedSteps);

      // Online PvP: auto-commit Launch power on 0.0s (server simulates combat authoritatively)
      if (sim.isOnlineRemote && onlineMatchRef.current) {
        if (
          sim.phase === 'Launch' &&
          sim.launchCountdown <= 0.05 &&
          !sim.launchSelection.powerLockedByPlayer
        ) {
          handleLaunchNow();
        }
      }

      if (wasLaunch && sim.phase !== 'Launch') {
        soundEngine.playLaunch();
      }

      const oppDeltaDmg = Math.max(
        0,
        (prevOppStam - sim.opponent.staminaRatio) * 1800 + (prevOppDur - sim.opponent.durability) * 14
      );
      const playerDeltaDmg = Math.max(
        0,
        (prevPlayerStam - sim.player.staminaRatio) * 1800 + (prevPlayerDur - sim.player.durability) * 14
      );
      let popupsChanged = false;
      const nowMs = simStartMs;

      // Process simulation events for VFX & Audio
      if (sim.events.length > 0 && scene) {
        const pushPopup = (
          wx: number,
          wy: number,
          wz: number,
          text: string,
          variant: CombatDamagePopup['variant'],
          subtext?: string
        ) => {
          const proj = scene.projectWorldToScreen(wx, wy, wz);
          if (!proj.visible) return;
          popupSeqRef.current += 1;
          const entry: { popup: CombatDamagePopup; createdAtMs: number } = {
            popup: {
              id: popupSeqRef.current,
              xPct: proj.xPct,
              yPct: proj.yPct,
              text,
              subtext,
              variant,
            },
            createdAtMs: nowMs,
          };
          combatPopupsRef.current = [...combatPopupsRef.current.slice(-6), entry];
          popupsChanged = true;
        };

        for (const ev of sim.events) {
          if (ev.type === 'collision') {
            scene.recordHeatmapImpact(ev.x, ev.z, ev.intensity);
            const dx = sim.opponent.x - sim.player.x;
            const dz = sim.opponent.z - sim.player.z;
            const nx = ev.nx ?? dx;
            const nz = ev.nz ?? dz;
            scene.triggerClashEffects(
              ev.x,
              ev.y,
              ev.z,
              ev.intensity,
              Boolean(ev.isCritical),
              ev.isCritical ? 0xfacc15 : 0xff6b2b,
              { tangentX: -nz, tangentZ: nx, sparkMode: 'metal' }
            );
            scene.triggerImpactRecoil('both', nx, nz, ev.intensity, Boolean(ev.isCritical));
            scene.recordImpactScuff(
              ev.x,
              ev.z,
              -nz,
              nx,
              ev.intensity,
              Boolean(ev.isCritical),
              false
            );
            if (ev.isCritical || ev.intensity >= 1.02) {
              scene.triggerClashCameraImpulse(ev.x, ev.y, ev.z, ev.isCritical ? 1.0 : 0.72);
            }
            if (ev.isCritical || nowMs - lastPopupAtRef.current >= 95) {
              lastPopupAtRef.current = nowMs;
              const rawDmg = Math.round(
                Math.max(
                  oppDeltaDmg,
                  playerDeltaDmg,
                  ev.intensity * (ev.isCritical ? 88 : 42)
                )
              );
              const playerTookMore = playerDeltaDmg > oppDeltaDmg * 1.15;
              const variant: CombatDamagePopup['variant'] = ev.isCritical
                ? 'critical'
                : playerTookMore
                  ? 'playerHit'
                  : 'normal';
              pushPopup(
                ev.x,
                ev.y + 0.34,
                ev.z,
                `${rawDmg}`,
                variant,
                ev.isCritical ? 'CRITICAL!' : undefined
              );
            }
            soundEngine.playCollision(ev.intensity, ev.isCritical);
            if (ev.label) bannerRef.current = { text: ev.label, ttl: 1.4 };
          } else if (ev.type === 'wallBounce' || ev.type === 'pillarBounce') {
            scene.recordHeatmapImpact(ev.x, ev.z, ev.intensity * 0.72);
            const nx = ev.nx ?? -ev.x;
            const nz = ev.nz ?? -ev.z;
            scene.triggerClashEffects(ev.x, ev.y, ev.z, ev.intensity * 0.72, false, 0x38bdf8, {
              tangentX: -nz,
              tangentZ: nx,
              sparkMode: 'metal',
            });
            scene.triggerImpactRecoil(
              ev.actorId ?? 'player',
              nx,
              nz,
              ev.intensity * 0.85,
              false
            );
            scene.triggerWallTremor(
              ev.intensity * (ev.type === 'wallBounce' ? 1.0 : 0.78),
              nx,
              nz,
              false
            );
            scene.recordImpactScuff(ev.x, ev.z, -nz, nx, ev.intensity * 0.72, false, false);
            soundEngine.playCollision(ev.intensity * 0.65, false);
          } else if (ev.type === 'ability' || ev.type === 'bossPhase') {
            const hex = ev.colorHex ? parseInt(ev.colorHex.replace('#', ''), 16) : 0x38bdf8;
            scene.triggerClashEffects(
              ev.x,
              ev.y,
              ev.z,
              ev.isCritical ? 1.2 : 0.85,
              Boolean(ev.isCritical),
              hex,
              { sparkMode: 'energy' }
            );
            if (ev.type === 'ability' && ev.label) {
              pushPopup(
                ev.x,
                ev.y + 0.38,
                ev.z,
                ev.label,
                ev.isCritical ? 'critical' : 'normal'
              );
            }
            soundEngine.playAbility(Boolean(ev.isCritical) || ev.type === 'bossPhase');
            if (ev.label) bannerRef.current = { text: ev.label, ttl: 1.8 };
          } else if (ev.type === 'teamSwitch') {
            scene.spawnBurstParticles(ev.x, ev.y, ev.z, 22, 0x38bdf8, 4.8);
            scene.spawnShockwave(ev.x, ev.y, ev.z, 0x38bdf8, 2.8, 0.24);
            syncActiveTeamMemberVisual(sim, saveRef.current);
            if (ev.label) bannerRef.current = { text: ev.label, ttl: 1.5 };
          } else if (ev.type === 'partBreak') {
            scene.triggerClashEffects(ev.x, ev.y, ev.z, 1.35, true, 0xf43f5e, {
              sparkMode: 'metal',
            });
            scene.triggerClashCameraImpulse(ev.x, ev.y, ev.z, 0.88);
            pushPopup(ev.x, ev.y + 0.4, ev.z, 'SHATTER!', 'critical', 'PART BREAK');
            if (ev.partKey) {
              scene.spawnPartEjection(ev.actorId ?? 'opponent', [ev.partKey], ev.vx ?? 0, ev.vz ?? 0);
            }
            soundEngine.playCollision(1.15, true);
            if (ev.label) bannerRef.current = { text: ev.label, ttl: 1.8 };
          } else if (ev.type === 'trapDebuff') {
            const hex = ev.colorHex ? parseInt(ev.colorHex.replace('#', ''), 16) : 0xf59e0b;
            scene.spawnBurstParticles(ev.x, ev.y, ev.z, 18, hex, 4.2);
            scene.spawnShockwave(ev.x, ev.y, ev.z, hex, 1.9, 0.22);
            if (ev.label) bannerRef.current = { text: ev.label, ttl: 1.5 };
          } else if (ev.type === 'perfectLaunch') {
            scene.triggerPerfectLaunchEffects(ev.x, ev.y, ev.z);
            soundEngine.playPerfectLaunch();
            bannerRef.current = { text: '⚡ PERFECT LAUNCH! +8% RPM', ttl: 2.2 };
          } else if (ev.type === 'burst' || ev.type === 'knockout') {
            if (ev.type === 'burst') {
              scene.recordHeatmapImpact(ev.x, ev.z, 1.5);
            }
            const nx = ev.nx ?? 1;
            const nz = ev.nz ?? 0;
            scene.triggerClashEffects(ev.x, ev.y, ev.z, 1.6, true, 0xff5a2f, {
              tangentX: -nz,
              tangentZ: nx,
              sparkMode: 'metal',
            });
            scene.triggerImpactRecoil(
              ev.actorId === 'player' ? 'opponent' : 'player',
              nx,
              nz,
              1.5,
              true
            );
            scene.triggerWallTremor(1.35, nx, nz, true);
            scene.recordImpactScuff(
              ev.x,
              ev.z,
              ev.vx ?? -nz,
              ev.vz ?? nx,
              1.55,
              true,
              ev.type === 'burst'
            );
            if (ev.type === 'burst') {
              scene.triggerBurstShake(1.0, 0.42);
              scene.triggerClashCameraImpulse(ev.x, ev.y, ev.z, 1.0);
              pushPopup(ev.x, ev.y + 0.45, ev.z, 'BURST!', 'burst');
              scene.spawnPartEjection(
                ev.actorId ?? 'opponent',
                ['SpiritCore', 'AttackBlade', 'ArmorRing', 'WeightDisc', 'PerformanceDriver', 'EnergyModule'],
                ev.vx ?? 0,
                ev.vz ?? 0
              );
            }
            soundEngine.playBurst();
            bannerRef.current = {
              text: ev.label ?? (ev.type === 'knockout' ? 'KNOCKOUT FINISH!' : 'BURST FINISH!'),
              ttl: 2.0,
            };
          } else if (
            ev.type === 'ringOut' ||
            ev.type === 'spinFinish' ||
            ev.type === 'criticalPhase'
          ) {
            if (ev.label) bannerRef.current = { text: ev.label, ttl: 1.8 };
          }
        }
        sim.events.length = 0;
      }

      if (bannerRef.current) {
        bannerRef.current.ttl -= dt;
        if (bannerRef.current.ttl <= 0) bannerRef.current = null;
      }

      const spinActive = sim.phase === 'Combat' || sim.phase === 'Critical';
      soundEngine.updateSpinHum(spinActive, sim.player.omega, sim.opponent.omega);
      soundEngine.setDynamicMusic(
        saveRef.current.settings.dynamicMusic,
        spinActive,
        sim.phase === 'Critical'
      );
      soundEngine.setWeatherAmbiance(sim.weather, true);
      soundEngine.updateWeatherDynamics(dt, sim.phase === 'Critical' ? 1.4 : 1.0);

      if (sim.phase === 'Results') {
        combatPopupsRef.current = [];
        setCombatPopups([]);
        setHud(createHudSnapshot(sim, bannerRef.current?.text ?? null));
        finalizeBattle(sim);
        return;
      }

      if (popupsChanged) {
        setCombatPopups(combatPopupsRef.current.map((e) => e.popup));
      }

      hudThrottleRef.current += dt;
      const throttleInterval = sim.phase === 'Launch' ? 0.045 : 0.06;
      if (hudThrottleRef.current >= throttleInterval) {
        hudThrottleRef.current = 0;
        if (combatPopupsRef.current.length > 0) {
          const active = combatPopupsRef.current.filter((e) => nowMs - e.createdAtMs < 740);
          if (active.length !== combatPopupsRef.current.length) {
            combatPopupsRef.current = active;
            setCombatPopups(active.map((e) => e.popup));
          }
        }
        if (sim.phase === 'Launch') {
          setLaunchMeter(launchOscValueRef.current);
        }
        setHud(createHudSnapshot(sim, bannerRef.current?.text ?? null));
      }
    },
    [
      finalizeBattle,
      handleActivateAbility,
      handleLaunchNow,
      handleSwitchTeamTop,
      syncActiveTeamMemberVisual,
    ]
  );

  // Bootstrap IndexedDB Save & ?autostart=1 once on mount
  useEffect(() => {
    if (hasBootstrappedSaveRef.current) return;
    hasBootstrappedSaveRef.current = true;

    const prefersReduced =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    let cancelled = false;
    void loadPlayerSave().then((loaded) => {
      if (cancelled) return;
      saveRef.current = loaded;
      setSave(loaded);
      setSaveLoaded(true);
      const st = getStorageStatus();
      setStorageWarning(st.degraded ? st.reason : null);

      soundEngine.setMuted(loaded.settings.muted);
      soundEngine.setVolume(loaded.settings.masterVolume);
      const controller = sceneRef.current;
      if (controller) {
        controller.applyQuality(loaded.settings.graphicsQuality);
        controller.setCameraSensitivity(loaded.settings.cameraSensitivity);
        controller.setCameraPreset(loaded.settings.cameraPreset);
        controller.setReducedMotion(Boolean(loaded.settings.reducedMotion) || prefersReduced);
        controller.setClashCameraEnabled(loaded.settings.dynamicClashCamera !== false);
      }
      syncShowcaseVisuals(loaded);

      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        startBattle({
          mode: 'Training',
          arenaId: loaded.selectedArenaId,
          opponentId: OPPONENTS[0].id,
          skipLaunchGauge: true,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [startBattle, syncShowcaseVisuals]);

  // Initialize Three.js Scene (supports non-destructive WebGL context recovery)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const controller = new ArenaSceneController({
      container,
      getSimulation: () => simRef.current,
      onFrameTick: handleFrameTick,
      onAimPoint: (x, z, lockPower) => {
        const sim = simRef.current;
        if (!sim || sim.phase !== 'Launch') return;
        setLaunchAim(sim, x, z);
        if (sim.isOnlineRemote && onlineMatchRef.current) {
          onlinePvpClient.sendLaunchAim(x, z);
        }
        if (lockPower) {
          handleLaunchNow();
        }
      },
      onContextLostChange: (lost) => {
        setWebglContextLost(lost);
        setWebglWarning(
          lost
            ? 'WebGL graphics context was interrupted. Attempting automatic GPU recovery...'
            : null
        );
      },
      onInitError: (reason) => {
        setWebglInitError(reason);
        setWebglWarning(reason);
      },
      onTelemetry: (telemetry) => {
        setSceneTelemetry(telemetry);
      },
      onLaunchSlamSfx: (power) => {
        soundEngine.playLaunchSlam(power);
      },
      onSelectWorkshopPart: (cat) => {
        soundEngine.playClick();
        setWorkshopCategory(cat);
        setWorkshopPartFocusSignal((prev) => prev + 1);
      },
      quality: saveRef.current.settings.graphicsQuality,
    });
    sceneRef.current = controller;
    if (controller.isSoftwareRenderer()) {
      setWebglWarning(
        'Software WebGL renderer detected. Visual quality auto-tuned for stable frame pacing.'
      );
    }

    const currentSave = saveRef.current;
    const prefersReduced =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    controller.applyQuality(currentSave.settings.graphicsQuality);
    controller.setCameraSensitivity(currentSave.settings.cameraSensitivity);
    controller.setCameraPreset(currentSave.settings.cameraPreset);
    controller.setReducedMotion(Boolean(currentSave.settings.reducedMotion) || prefersReduced);
    controller.setClashCameraEnabled(currentSave.settings.dynamicClashCamera !== false);

    const activeSim = simRef.current;
    if (activeSim) {
      controller.setArena(activeSim.arenaId);
      controller.setWeather(activeSim.weather);
      controller.setBattleEnvironment({
        matchMode: battleContextRef.current.mode,
        mutators: activeSim.mutators,
        survivalWave: battleContextRef.current.survivalWave,
      });
      syncActiveTeamMemberVisual(activeSim, currentSave);
      const recTop =
        currentSave.ownedTops.find((t) => t.instanceId === currentSave.selectedTopInstanceId) ??
        currentSave.ownedTops[0];
      const oppDef = getOpponentDefinition(battleContextRef.current.opponentId);
      const oppTop = getTopDefinition(oppDef.topId);
      controller.setOpponentTopVisual({
        equipped: oppDef.components,
        element: oppTop.element,
        secondaryElement: oppDef.secondaryElement,
        evolutionStage: oppDef.isBoss ? 1 : 0,
      });
      controller.setVictoryEmotes(
        recTop?.cosmetics?.victoryEmote ?? 'apex_flare',
        battleContextRef.current.opponentCosmetics?.victoryEmote ?? 'apex_flare'
      );
      controller.setShowDiagnostics(
        !onlineMatchRef.current &&
          Boolean(
            currentSave.settings.showDiagnostics ||
              (battleContextRef.current.mode === 'Training' && urlDebugForced)
          )
      );
      controller.setCameraMode('battle', onlineMatchRef.current?.isHost === false ? Math.PI : 0);
    } else {
      syncShowcaseVisuals(currentSave);
    }

    return () => {
      soundEngine.updateSpinHum(false, 0, 0);
      soundEngine.setDynamicMusic(false, false, false);
      controller.dispose();
      sceneRef.current = null;
      setSceneTelemetry(null);
    };
  }, [
    handleFrameTick,
    handleLaunchNow,
    sceneRecoveryKey,
    syncActiveTeamMemberVisual,
    syncShowcaseVisuals,
    urlDebugForced,
  ]);

  useEffect(() => {
    const onBeforeUnload = () => {
      soundEngine.dispose();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      soundEngine.dispose();
    };
  }, []);

  // Apply UI scale & Reduced Motion preference
  useEffect(() => {
    document.documentElement.style.setProperty('--sl-ui-scale', String(save.settings.uiScale));
    const prefersReduced =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    sceneRef.current?.setReducedMotion(Boolean(save.settings.reducedMotion) || prefersReduced);
  }, [save.settings.uiScale, save.settings.reducedMotion]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (shellState === 'playing' || shellState === 'paused') {
      scene.setCameraMode('battle');
    } else if (shellState === 'replay' || shellState === 'gameover') {
      if (!scene.hasReplayClip()) {
        scene.setCameraMode('battle');
      }
    } else if (activeModal === 'workshop') {
      scene.setCameraMode('workshop');
    } else {
      scene.setCameraMode('title');
    }
  }, [shellState, activeModal]);

  useEffect(() => {
    sceneRef.current?.setWorkshopExploded(
      shellState === 'title' && activeModal === 'workshop' && workshopExploded
    );
  }, [shellState, activeModal, workshopExploded]);

  useEffect(() => {
    sceneRef.current?.setWorkshopSelectedCategory(workshopCategory);
  }, [workshopCategory]);

  const handleSelectMode = useCallback((mode: BattleMode) => {
    const sim = simRef.current;
    if (!sim) return;
    soundEngine.unlock();
    if (setBattleMode(sim, 'player', mode, { debugOverride: isDebugActiveRef.current })) {
      soundEngine.playClick();
      setHud(createHudSnapshot(sim, bannerRef.current?.text ?? null));
    }
  }, []);

  const handleSelectCommand = useCallback((cmd: TacticalCommand) => {
    const sim = simRef.current;
    if (!sim) return;
    soundEngine.unlock();
    if (setTacticalCommand(sim, 'player', cmd, { debugOverride: isDebugActiveRef.current })) {
      soundEngine.playClick();
      setHud(createHudSnapshot(sim, bannerRef.current?.text ?? null));
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    updateSave((prev) => {
      const nextMuted = !prev.settings.muted;
      soundEngine.setMuted(nextMuted);
      return {
        ...prev,
        settings: { ...prev.settings, muted: nextMuted },
      };
    });
  }, [updateSave]);

  const handleCycleCameraPreset = useCallback(() => {
    soundEngine.playClick();
    updateSave((prev) => {
      const idx = CAMERA_PRESETS.indexOf(prev.settings.cameraPreset);
      const nextPreset = CAMERA_PRESETS[(idx + 1) % CAMERA_PRESETS.length];
      sceneRef.current?.setCameraPreset(nextPreset);
      return {
        ...prev,
        settings: { ...prev.settings, cameraPreset: nextPreset },
      };
    });
  }, [updateSave]);

  // Subscribe to WebSocket Online PvP events
  useEffect(() => {
    const startOnlineBattleFromRoom = (room: OnlineRoomView) => {
      const session = getOnlineSessionState();
      const myId = session.commander?.playerId;
      const isSpectator =
        !myId ||
        !room.members.some((m) => m.playerId === myId) ||
        Boolean(room.spectators?.some((s) => s.playerId === myId));

      let memberA = room.members[0];
      let memberB = room.members[1];
      if (!memberA || !memberB) return;

      if (!isSpectator && myId) {
        memberA = room.members.find((m) => m.playerId === myId) ?? room.members[0];
        memberB = room.members.find((m) => m.playerId !== myId) ?? room.members[1];
      }

      soundEngine.unlock();
      const currentSave = saveRef.current;

      const topDefA = getTopDefinition(memberA.build.topDefinitionId);
      const topDefB = getTopDefinition(memberB.build.topDefinitionId);
      const evoPathA = memberA.build.evolutionPathId
        ? getEvolutionPath(memberA.build.evolutionPathId)
        : undefined;
      const compA = memberA.build.equippedComponents as EquippedComponents;
      const compB = memberB.build.equippedComponents as EquippedComponents;
      const secA = (memberA.build.secondaryElement ?? null) as ElementType | null;
      const secB = (memberB.build.secondaryElement ?? null) as ElementType | null;

      const attrsA = calculateAttributes(
        topDefA.id,
        compA,
        {},
        memberA.build.level,
        memberA.build.evolutionPathId,
        undefined,
        secA
      );
      const physA = calculatePhysicalProfile(
        topDefA.id,
        compA,
        {},
        memberA.build.level,
        memberA.build.evolutionPathId,
        undefined,
        secA
      );
      const attrsB = calculateAttributes(
        topDefB.id,
        compB,
        {},
        memberB.build.level,
        memberB.build.evolutionPathId,
        undefined,
        secB
      );
      const physB = calculatePhysicalProfile(
        topDefB.id,
        compB,
        {},
        memberB.build.level,
        memberB.build.evolutionPathId,
        undefined,
        secB
      );

      const isHost = isSpectator ? true : room.hostPlayerId === myId;
      const battleId = `pvp-${room.roomId}-${Date.now()}`;

      const sim = createBattleSimulation({
        battleId,
        arenaId: room.arenaId,
        playerConfig: {
          entityId: 'player',
          name: memberA.handle,
          element: topDefA.element,
          secondaryElement: secA,
          attributes: attrsA,
          physical: physA,
          abilities: memberA.build.equippedAbilities,
          initialMode: 'Stamina',
          initialCommand: 'Aggressive',
          evolutionStage: memberA.build.evolutionStage,
        },
        opponentConfig: {
          entityId: 'opponent',
          name: memberB.handle,
          element: topDefB.element,
          secondaryElement: secB,
          attributes: attrsB,
          physical: physB,
          abilities: memberB.build.equippedAbilities,
          initialMode: 'Stamina',
          initialCommand: 'Aggressive',
          evolutionStage: memberB.build.evolutionStage,
        },
        aiPersonality: 'Tactical',
        aiDifficulty: 'Normal',
        startInPhase: 'Launch',
        debugMode: false,
        isOnlineRemote: true,
        disableAi: true,
        mutators: room.mutators,
        isSpectating: isSpectator,
        spectatorCount: room.spectators?.length ?? 0,
        launchHandedness: isHost ? 'right' : 'left',
        playerSpawn: isHost ? PLAYER_LAUNCH_SPAWN : OPPONENT_LAUNCH_SPAWN,
        opponentSpawn: isHost ? OPPONENT_LAUNCH_SPAWN : PLAYER_LAUNCH_SPAWN,
      });

      battleContextRef.current.mode = room.mode;
      battleContextRef.current.arenaId = room.arenaId;
      battleContextRef.current.opponentId = memberB.playerId;
      battleContextRef.current.opponentName = memberB.handle;
      battleContextRef.current.opponentTopDefinitionId = memberB.build.topDefinitionId;
      battleContextRef.current.opponentElement = topDefB.element;
      battleContextRef.current.opponentSecondaryElement = secB;
      battleContextRef.current.opponentLevel = memberB.build.level;
      battleContextRef.current.opponentEvolutionStage = memberB.build.evolutionStage;
      battleContextRef.current.opponentEvolutionPathId = memberB.build.evolutionPathId;
      battleContextRef.current.opponentComponents = compB;
      battleContextRef.current.opponentAbilities = memberB.build.equippedAbilities;
      battleContextRef.current.opponentCosmetics = memberB.build.cosmetics;
      battleContextRef.current.opponentAppearance = memberB.appearance;
      battleContextRef.current.opponentMmr = memberB.mmr;
      battleContextRef.current.isRevengeMatch = false;
      battleContextRef.current.shadowOpponent = undefined;
      battleContextRef.current.revengeRival = undefined;
      battleContextRef.current.isTeamBattle = false;
      battleContextRef.current.survivalWave = null;
      battleContextRef.current.mutators = room.mutators;
      battleContextRef.current.weather = 'Clear';
      setActiveMatchMode(room.mode);
      setReconnectGraceSec(null);

      onlineMatchRef.current = {
        roomId: room.roomId,
        myPlayerId: myId ?? 'spectator',
        playerSideId: memberA.playerId,
        opponentPlayerId: memberB.playerId,
        opponentHandle: memberB.handle,
        isHost,
        mode: room.mode,
        arenaId: room.arenaId,
        sentComplete: false,
      };

      simRef.current = sim;
      simAccumulatorRef.current = 0;
      launchPhaseClockRef.current = 0;
      bannerRef.current = {
        text: isSpectator
          ? `BROADCAST: ${memberA.handle.toUpperCase()} VS ${memberB.handle.toUpperCase()}`
          : `ONLINE DUEL VS ${memberB.handle.toUpperCase()}`,
        ttl: 2.2,
      };
      setPendingBattle(null);
      setBattleResult(null);
      setReplayTelemetry(null);
      setActiveModal('none');
      setHowToPlayOpen(false);

      if (sceneRef.current) {
        sceneRef.current.setReplayClip(null);
        sceneRef.current.setArena(room.arenaId);
        sceneRef.current.setWeather('Clear');
        sceneRef.current.setBattleEnvironment({
          matchMode: room.mode,
          mutators: room.mutators,
        });
        sceneRef.current.setPlayerTopVisual({
          equipped: compA,
          element: topDefA.element,
          secondaryElement: secA,
          evolutionStage: memberA.build.evolutionStage,
          scaleMultiplier: evoPathA?.scaleMultiplier ?? 1,
          cosmetics: memberA.build.cosmetics,
        });
        sceneRef.current.setOpponentTopVisual({
          equipped: compB,
          element: topDefB.element,
          secondaryElement: secB,
          evolutionStage: memberB.build.evolutionStage,
          cosmetics: memberB.build.cosmetics,
        });
        sceneRef.current.setVictoryEmotes(
          memberA.build.cosmetics?.victoryEmote ?? 'apex_flare',
          memberB.build.cosmetics?.victoryEmote ?? 'apex_flare'
        );
        sceneRef.current.clearCollisionHeatmap();
        sceneRef.current.clearFloorScuffs();
        sceneRef.current.setShowDiagnostics(false);
        sceneRef.current.setSpectatorMode(isSpectator);
        sceneRef.current.setCameraPreset(currentSave.settings.cameraPreset);
        sceneRef.current.setCameraMode('battle', isHost ? 0 : Math.PI);
      }

      setHud(
        createHudSnapshot(
          sim,
          bannerRef.current.text,
          isSpectator,
          room.spectators?.length ?? 0
        )
      );
      setShellState('playing');
      document.body.dataset.state = 'playing';
    };

    const rttPoll = window.setInterval(() => {
      if (onlineMatchRef.current) {
        setOnlineRttMs(onlinePvpClient.getRttMs());
      } else {
        setOnlineRttMs(null);
      }
    }, 1000);

    const graceTick = window.setInterval(() => {
      setReconnectGraceSec((prev) => (prev !== null && prev > 1 ? prev - 1 : prev));
    }, 1000);

    const unsub = onlinePvpClient.subscribe((msg) => {
      switch (msg.type) {
        case 'auth_ok':
          break;
        case 'queue_waiting':
          setOnlineQueueMode(msg.mode);
          setOnlineQueuePos(msg.position);
          setOnlineStatusMsg(`Searching ${msg.mode} opponent (Position #${msg.position})...`);
          break;
        case 'queue_left':
          setOnlineQueueMode(null);
          setOnlineQueuePos(0);
          break;
        case 'match_found':
        case 'room_joined':
        case 'room_update':
          setOnlineQueueMode(null);
          setOnlineRoom(msg.room);
          if (simRef.current && onlineMatchRef.current?.roomId === msg.room.roomId) {
            simRef.current.spectatorCount = msg.room.spectators?.length ?? 0;
          }
          break;
        case 'room_rejoined':
          setReconnectGraceSec(null);
          setOnlineRoom(msg.room);
          if (simRef.current && simRef.current.isOnlineRemote) {
            bannerRef.current = { text: 'RIVAL RECONNECTED · DUEL CONTINUES!', ttl: 2.0 };
          }
          break;
        case 'launch_phase_start':
          setOnlineRoom(msg.room);
          setOnlineQueueMode(null);
          startOnlineBattleFromRoom(msg.room);
          break;
        case 'launch_player_locked': {
          const match = onlineMatchRef.current;
          const sim = simRef.current;
          if (match && sim && msg.playerId !== match.myPlayerId) {
            bannerRef.current = { text: `${match.opponentHandle} LOCKED LAUNCH!`, ttl: 2.0 };
          }
          break;
        }
        case 'battle_start': {
          if (!simRef.current || onlineMatchRef.current?.roomId !== msg.roomId) {
            startOnlineBattleFromRoom(msg.room);
          }
          const match = onlineMatchRef.current;
          const sim = simRef.current;
          if (match && sim && sim.phase === 'Launch') {
            const myL = sim.isSpectating
              ? (msg.launches.find((l) => l.playerId === match.playerSideId) ?? msg.launches[0])
              : msg.launches.find((l) => l.playerId === match.myPlayerId);
            const oppL = sim.isSpectating
              ? (msg.launches.find((l) => l.playerId !== match.playerSideId) ?? msg.launches[1])
              : msg.launches.find((l) => l.playerId !== match.myPlayerId);
            applyLaunchVelocities(
              sim,
              myL?.powerRatio ?? sim.launchSelection.powerRatio,
              myL?.angleRad ?? sim.launchSelection.angleRad,
              oppL ? { powerRatio: oppL.powerRatio, angleRad: oppL.angleRad } : undefined,
              {
                allowPerfect: Boolean(myL?.perfect),
                opponentPerfect: Boolean(oppL?.perfect),
              }
            );
            soundEngine.playLaunch();
            bannerRef.current = { text: 'SIMULTANEOUS LAUNCH!', ttl: 1.6 };
            setHud(
              createHudSnapshot(
                sim,
                bannerRef.current.text,
                sim.isSpectating,
                msg.room.spectators?.length ?? sim.spectatorCount
              )
            );
          }
          break;
        }
        case 'remote_ability': {
          const match = onlineMatchRef.current;
          const sim = simRef.current;
          if (match && sim && msg.playerId !== match.myPlayerId) {
            activateAbility(sim, 'opponent', msg.slotIndex);
          }
          break;
        }
        case 'server_snapshot': {
          const sim = simRef.current;
          if (sim && sim.isOnlineRemote) {
            applyAuthoritativeSnapshot(sim, msg.snapshot);
          }
          break;
        }
        case 'opponent_reconnecting': {
          setReconnectGraceSec(msg.graceSec);
          bannerRef.current = {
            text: `RIVAL DISCONNECTED · ${msg.graceSec}S TO RECONNECT...`,
            ttl: msg.graceSec,
          };
          break;
        }
        case 'match_finalized': {
          setOnlineRoom(null);
          setReconnectGraceSec(null);
          if (msg.mmrDelta > 0) {
            setOnlineStatusMsg(
              `Match recorded! Ranked MMR shift: ±${msg.mmrDelta} (${msg.finishReason})`
            );
          }
          const match = onlineMatchRef.current;
          const sim = simRef.current;
          if (Array.isArray(msg.commanders) && match && !sim?.isSpectating) {
            const me = msg.commanders.find((c) => c.playerId === match.myPlayerId);
            if (me && typeof me.mmr === 'number') {
              updateSave((prev) => ({
                ...prev,
                pvpMmr: me.mmr,
              }));
            }
          }
          if (
            match &&
            match.roomId === msg.roomId &&
            !match.sentComplete &&
            sim &&
            sim.phase !== 'Results'
          ) {
            match.sentComplete = true;
            sim.winnerSide = msg.winnerId === match.playerSideId ? 'player' : 'opponent';
            sim.finishReason = msg.finishReason;
            sim.phase = 'Results';
            setHud(
              createHudSnapshot(
                sim,
                bannerRef.current?.text ?? null,
                sim.isSpectating,
                sim.spectatorCount
              )
            );
            finalizeBattle(sim, msg.highlights, msg.analysis);
          }
          break;
        }
        case 'opponent_disconnected': {
          const sim = simRef.current;
          const match = onlineMatchRef.current;
          setOnlineRoom(null);
          setReconnectGraceSec(null);
          if (
            match &&
            !match.sentComplete &&
            sim &&
            (sim.phase === 'Launch' || sim.phase === 'Combat' || sim.phase === 'Critical')
          ) {
            match.sentComplete = true;
            sim.winnerSide = 'player';
            sim.finishReason = 'Survival';
            sim.phase = 'Results';
            bannerRef.current = { text: 'RIVAL DISCONNECTED · FORFEIT VICTORY!', ttl: 2.5 };
            finalizeBattle(sim);
          } else {
            setOnlineStatusMsg('Rival disconnected from the room.');
          }
          break;
        }
        case 'error':
        case 'auth_error':
          setOnlineStatusMsg(msg.message);
          break;
      }
    });
    return () => {
      clearInterval(rttPoll);
      clearInterval(graceTick);
      unsub();
    };
  }, [finalizeBattle, updateSave]);

  const exitToTitle = useCallback(() => {
    if (onlineMatchRef.current) {
      onlinePvpClient.leaveRoom();
      onlineMatchRef.current = null;
      setOnlineRoom(null);
    }
    setReconnectGraceSec(null);
    setOnlineRttMs(null);
    setSceneTelemetry(null);
    sceneRef.current?.clearCollisionHeatmap();
    sceneRef.current?.clearFloorScuffs();
    sceneRef.current?.setShowDiagnostics(false);
    sceneRef.current?.setReplayClip(null);
    simRef.current = null;
    combatPopupsRef.current = [];
    setCombatPopups([]);
    setWorkshopExploded(false);
    setHud(null);
    setBattleResult(null);
    setReplayTelemetry(null);
    setPendingBattle(null);
    setActiveModal('none');
    setHowToPlayOpen(false);
    setShellState('title');
    soundEngine.setWeatherAmbiance('Clear', false);
    syncShowcaseVisuals(saveRef.current);
  }, [syncShowcaseVisuals]);

  useEffect(() => {
    if (shellState !== 'playing' && shellState !== 'replay') {
      soundEngine.setWeatherAmbiance('Clear', false);
    }
  }, [shellState]);

  // Unified Keyboard Bindings (Pure Physics: Launch + Item Slots + Team Switch; 1-8 Debug Only)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const key = e.key === ' ' ? ' ' : e.key.toLowerCase();
      const binds = saveRef.current.settings.keyBindings;

      if (key === 'm') {
        handleToggleMute();
        return;
      }

      if (shellStateRef.current === 'title') {
        if (e.key === 'Escape') {
          if (howToPlayOpenRef.current) {
            e.preventDefault();
            setHowToPlayOpen(false);
            return;
          }
          if (activeModalRef.current !== 'none') {
            e.preventDefault();
            setActiveModal('none');
            return;
          }
        }
        if (activeModalRef.current === 'none' && !howToPlayOpenRef.current) {
          if (pendingBattle) {
            if (e.key === 'Enter') {
              e.preventDefault();
              startBattle({
                mode: pendingBattle.mode,
                arenaId: pendingBattle.arenaId,
                opponentId: pendingBattle.opponentId,
                isTeamBattle: pendingBattle.isTeamBattle,
                survivalWave: pendingBattle.survivalWave,
                carryStaminaRatio: pendingBattle.carryStaminaRatio,
                carryDurabilityRatio: pendingBattle.carryDurabilityRatio,
                mutators: pendingBattle.mutators,
                weather: pendingBattle.weather,
              });
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setPendingBattle(null);
            }
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPreparation({
              mode: 'Training',
              arenaId: saveRef.current.selectedArenaId,
              opponentId: OPPONENTS[0].id,
              isTeamBattle: false,
            });
          }
        }
        return;
      }

      if (shellStateRef.current === 'playing') {
        const pauseBind = (binds.pause || 'p').toLowerCase();
        if (e.key === 'Escape' || key === pauseBind) {
          e.preventDefault();
          setShellState('paused');
          return;
        }
        const sim = simRef.current;
        if (!sim) return;
        const launchBind = binds.launch === ' ' ? ' ' : (binds.launch || ' ').toLowerCase();
        if (sim.phase === 'Launch' && key === launchBind) {
          e.preventDefault();
          handleLaunchNow();
          return;
        }
        if (key === (binds.cameraCycle || 'c').toLowerCase()) {
          e.preventDefault();
          handleCycleCameraPreset();
          return;
        }
        if (key === binds.ability1.toLowerCase()) {
          handleActivateAbility(0);
        } else if (key === binds.ability2.toLowerCase()) {
          handleActivateAbility(1);
        } else if (key === binds.ability3.toLowerCase()) {
          handleActivateAbility(2);
        } else if (key === binds.ability4.toLowerCase()) {
          handleActivateAbility(3);
        } else if (key === binds.teamSwitch.toLowerCase() && sim.isTeamBattle) {
          e.preventDefault();
          const nextIdx = (sim.activeTeamIndex + 1) % sim.playerTeam.length;
          handleSwitchTeamTop(nextIdx);
        } else if (isDebugActiveRef.current && battleContextRef.current.mode === 'Training') {
          const tacticalBinds = [
            binds.tactical1,
            binds.tactical2,
            binds.tactical3,
            binds.tactical4,
            binds.tactical5,
            binds.tactical6,
            binds.tactical7,
            binds.tactical8,
          ].map((k) => k.toLowerCase());
          const idx = tacticalBinds.indexOf(key);
          if (idx >= 0 && TACTICAL_COMMANDS[idx]) {
            handleSelectCommand(TACTICAL_COMMANDS[idx].id);
          }
        }
      } else if (shellStateRef.current === 'paused') {
        const pauseBind = (binds.pause || 'p').toLowerCase();
        if (e.key === 'Escape' || key === pauseBind) {
          e.preventDefault();
          setShellState('playing');
        }
      } else if (shellStateRef.current === 'replay') {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShellState('gameover');
        }
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        soundEngine.suspendForBackground();
        if (shellStateRef.current === 'playing' && !onlineMatchRef.current) {
          setShellState('paused');
        }
      } else {
        soundEngine.resumeFromBackground();
      }
    };

    const onBlur = () => {
      if (shellStateRef.current === 'playing' && !onlineMatchRef.current) {
        setShellState('paused');
      }
    };

    const onFocus = () => {
      if (!document.hidden) {
        soundEngine.resumeFromBackground();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [
    handleActivateAbility,
    handleCycleCameraPreset,
    handleLaunchNow,
    handleSelectCommand,
    handleSwitchTeamTop,
    handleToggleMute,
    openPreparation,
    pendingBattle,
    startBattle,
  ]);

  // Workshop / Forge / Collection Handlers
  const handleEquipComponent = (cat: ComponentCategory, compId: string) => {
    soundEngine.playClick();
    updateSave((prev) => {
      const next = {
        ...prev,
        ownedTops: prev.ownedTops.map((t) =>
          t.instanceId === prev.selectedTopInstanceId
            ? { ...t, equippedComponents: { ...t.equippedComponents, [cat]: compId } }
            : t
        ),
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleUnlockComponent = (compId: string) => {
    soundEngine.playClick();
    const comp = getComponentDefinition(compId);
    updateSave((prev) => {
      if (prev.unlockedComponentIds.includes(compId)) return prev;
      if (prev.currencies.gold < comp.unlockCostGold) return prev;
      return {
        ...prev,
        currencies: { ...prev.currencies, gold: prev.currencies.gold - comp.unlockCostGold },
        unlockedComponentIds: [...prev.unlockedComponentIds, compId],
      };
    });
  };

  const handleForgeMythicComponent = (compId: string) => {
    const comp = getComponentDefinition(compId);
    if (!comp.forgeCost) return;
    soundEngine.playAbility(true);
    updateSave((prev) => {
      if (prev.unlockedComponentIds.includes(compId)) return prev;
      const fc = comp.forgeCost!;
      if (
        prev.currencies.legendaryFragments < fc.legendaryFragments ||
        prev.currencies.energyCrystals < fc.energyCrystals ||
        prev.currencies.gold < fc.gold
      ) {
        return prev;
      }
      const pts = 220;
      const next: PlayerSaveData = {
        ...prev,
        playerScore: prev.playerScore + pts,
        scoreLog: [
          {
            id: `forge-comp-${compId}-${Date.now()}`,
            label: `Mythic Forged: ${comp.displayName}`,
            points: pts,
            category: 'progression' as const,
            timestampMs: Date.now(),
          },
          ...prev.scoreLog,
        ].slice(0, 25),
        currencies: {
          ...prev.currencies,
          legendaryFragments: prev.currencies.legendaryFragments - fc.legendaryFragments,
          energyCrystals: prev.currencies.energyCrystals - fc.energyCrystals,
          gold: prev.currencies.gold - fc.gold,
        },
        unlockedComponentIds: [...prev.unlockedComponentIds, compId],
        ownedTops: prev.ownedTops.map((t) =>
          t.instanceId === prev.selectedTopInstanceId
            ? { ...t, equippedComponents: { ...t.equippedComponents, [comp.category]: compId } }
            : t
        ),
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleUpgradeComponent = (compId: string) => {
    soundEngine.playAbility(false);
    const comp = getComponentDefinition(compId);
    updateSave((prev) => {
      const lvl = prev.componentUpgradeLevels[compId] ?? 0;
      if (lvl >= MAX_COMPONENT_UPGRADE_LEVEL) return prev;
      const cost = getComponentUpgradeCost(lvl);
      if (prev.currencies.gold < cost.gold || prev.currencies.metalShards < cost.metalShards) {
        return prev;
      }
      const pts = 45;
      return {
        ...prev,
        playerScore: prev.playerScore + pts,
        scoreLog: [
          {
            id: `upg-${compId}-${Date.now()}`,
            label: `Upgraded ${comp.displayName} to Lv.${lvl + 1}`,
            points: pts,
            category: 'progression' as const,
            timestampMs: Date.now(),
          },
          ...prev.scoreLog,
        ].slice(0, 25),
        currencies: {
          ...prev.currencies,
          gold: prev.currencies.gold - cost.gold,
          metalShards: prev.currencies.metalShards - cost.metalShards,
        },
        componentUpgradeLevels: {
          ...prev.componentUpgradeLevels,
          [compId]: lvl + 1,
        },
      };
    });
  };

  const handleUpgradeCapacitor = () => {
    soundEngine.playAbility(false);
    updateSave((prev) => {
      if (prev.capacitorLevel >= MAX_CAPACITOR_LEVEL) return prev;
      const cost = getCapacitorUpgradeCost(prev.capacitorLevel);
      if (
        prev.currencies.energyCrystals < cost.energyCrystals ||
        prev.currencies.gold < cost.gold
      ) {
        return prev;
      }
      const nextLvl = prev.capacitorLevel + 1;
      const pts = 85;
      return {
        ...prev,
        capacitorLevel: nextLvl,
        playerScore: prev.playerScore + pts,
        scoreLog: [
          {
            id: `cap-${nextLvl}-${Date.now()}`,
            label: `Arena Energy Capacitor Upgraded to Lv.${nextLvl}`,
            points: pts,
            category: 'progression' as const,
            timestampMs: Date.now(),
          },
          ...prev.scoreLog,
        ].slice(0, 25),
        currencies: {
          ...prev.currencies,
          energyCrystals: prev.currencies.energyCrystals - cost.energyCrystals,
          gold: prev.currencies.gold - cost.gold,
        },
      };
    });
  };

  const handleUpdateAbility = (slotIdx: number, abilityId: string) => {
    soundEngine.playClick();
    updateSave((prev) => ({
      ...prev,
      ownedTops: prev.ownedTops.map((t) => {
        if (t.instanceId !== prev.selectedTopInstanceId) return t;
        const nextAbilities = [...t.equippedAbilities] as [string, string, string, string];
        nextAbilities[slotIdx] = abilityId;
        return { ...t, equippedAbilities: nextAbilities };
      }),
    }));
  };

  const handleSetSecondaryElement = (element: ElementType | null) => {
    soundEngine.playClick();
    updateSave((prev) => {
      const next: PlayerSaveData = {
        ...prev,
        ownedTops: prev.ownedTops.map((t) =>
          t.instanceId === prev.selectedTopInstanceId ? { ...t, secondaryElement: element } : t
        ),
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleUpdateCosmetics = (cosmetics: CosmeticCustomization) => {
    updateSave((prev) => {
      const next: PlayerSaveData = {
        ...prev,
        ownedTops: prev.ownedTops.map((t) =>
          t.instanceId === prev.selectedTopInstanceId ? { ...t, cosmetics } : t
        ),
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleSavePreset = (name: string) => {
    soundEngine.playClick();
    updateSave((prev) => {
      const top =
        prev.ownedTops.find((t) => t.instanceId === prev.selectedTopInstanceId) ??
        prev.ownedTops[0];
      const newPreset: LoadoutPreset = {
        id: `preset-${Date.now()}`,
        name,
        topInstanceId: top.instanceId,
        components: { ...top.equippedComponents },
        abilities: [...top.equippedAbilities],
        secondaryElement: top.secondaryElement,
        cosmetics: { ...top.cosmetics },
        preferredMode: battleContextRef.current.preferredMode,
        preferredCommand: battleContextRef.current.preferredCommand,
      };
      return { ...prev, presets: [newPreset, ...prev.presets].slice(0, 8) };
    });
  };

  const handleApplyPreset = (preset: LoadoutPreset) => {
    soundEngine.playClick();
    battleContextRef.current.preferredMode = preset.preferredMode;
    battleContextRef.current.preferredCommand = preset.preferredCommand;
    updateSave((prev) => {
      const next = {
        ...prev,
        ownedTops: prev.ownedTops.map((t) =>
          t.instanceId === prev.selectedTopInstanceId
            ? {
                ...t,
                equippedComponents: { ...preset.components },
                equippedAbilities: [...preset.abilities] as [string, string, string, string],
                secondaryElement:
                  preset.secondaryElement !== undefined ? preset.secondaryElement : t.secondaryElement,
                cosmetics: preset.cosmetics ? { ...preset.cosmetics } : t.cosmetics,
              }
            : t
        ),
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleQuickSwapInBattle = (preset: LoadoutPreset) => {
    const sim = simRef.current;
    if (!sim || !isQuickSwapAllowedForMode(battleContextRef.current.mode, sim.isSpectating)) {
      return;
    }
    soundEngine.playClick();
    battleContextRef.current.preferredMode = preset.preferredMode;
    battleContextRef.current.preferredCommand = preset.preferredCommand;

    const currentSave = saveRef.current;
    const targetId = currentSave.ownedTops.some((t) => t.instanceId === preset.topInstanceId)
      ? preset.topInstanceId
      : currentSave.selectedTopInstanceId;
    const nextSave: PlayerSaveData = {
      ...currentSave,
      selectedTopInstanceId: targetId,
      ownedTops: currentSave.ownedTops.map((t) =>
        t.instanceId === targetId
          ? {
              ...t,
              equippedComponents: { ...preset.components },
              equippedAbilities: [...preset.abilities] as [string, string, string, string],
              secondaryElement:
                preset.secondaryElement !== undefined ? preset.secondaryElement : t.secondaryElement,
              cosmetics: preset.cosmetics ? { ...preset.cosmetics } : t.cosmetics,
            }
          : t
      ),
    };
    saveRef.current = nextSave;
    setSave(nextSave);
    void savePlayerData(nextSave);

    const swappedTop =
      nextSave.ownedTops.find((t) => t.instanceId === targetId) ?? nextSave.ownedTops[0];
    const nextConfig = buildPlayerTopSimConfig(
      swappedTop,
      nextSave,
      preset.preferredMode,
      preset.preferredCommand
    );
    if (quickSwapPlayerLoadout(sim, nextConfig, preset.name)) {
      syncActiveTeamMemberVisual(sim, nextSave);
      sceneRef.current?.setVictoryEmotes(
        swappedTop.cosmetics?.victoryEmote ?? 'apex_flare',
        battleContextRef.current.opponentCosmetics?.victoryEmote ?? 'apex_flare'
      );
      bannerRef.current = { text: `QUICK SWAP: ${preset.name.toUpperCase()}`, ttl: 1.6 };
      setHud(createHudSnapshot(sim, bannerRef.current.text));
    }
    setPauseQuickSwapFocus(false);
    setShellState('playing');
  };

  const createOwnedFromDef = (definitionId: string): OwnedTopState => {
    const def = getTopDefinition(definitionId);
    const elemHex = ARENAS.standard.primaryColor;
    return {
      instanceId: `owned-${definitionId}-${Date.now()}`,
      definitionId,
      level: 1,
      experience: 0,
      evolutionStage: 0,
      evolutionPathId: null,
      secondaryElement: null,
      equippedComponents: { ...def.defaultComponents },
      equippedAbilities: [...def.defaultAbilities],
      cosmetics: createDefaultCosmetics(elemHex, '#f97316'),
      wins: 0,
      losses: 0,
      careerStats: createEmptyCareerStats(),
    };
  };

  const handleUnlockTop = (definitionId: string) => {
    const def = getTopDefinition(definitionId);
    soundEngine.playAbility(false);
    updateSave((prev) => {
      if (prev.ownedTops.some((t) => t.definitionId === definitionId)) return prev;
      if (prev.currencies.gold < def.unlockCostGold) return prev;
      const newOwned = createOwnedFromDef(definitionId);
      const unlockedSet = new Set([
        ...prev.unlockedComponentIds,
        ...Object.values(def.defaultComponents),
      ]);
      const pts = 150;
      const next: PlayerSaveData = {
        ...prev,
        playerScore: prev.playerScore + pts,
        scoreLog: [
          {
            id: `unlock-top-${definitionId}-${Date.now()}`,
            label: `Commissioned ${def.displayName}`,
            points: pts,
            category: 'progression' as const,
            timestampMs: Date.now(),
          },
          ...prev.scoreLog,
        ].slice(0, 25),
        currencies: { ...prev.currencies, gold: prev.currencies.gold - def.unlockCostGold },
        ownedTops: [...prev.ownedTops, newOwned],
        unlockedTopIds: [...prev.unlockedTopIds, definitionId],
        unlockedComponentIds: Array.from(unlockedSet),
        selectedTopInstanceId: newOwned.instanceId,
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleForgeMythicTop = (definitionId: string) => {
    const def = getTopDefinition(definitionId);
    if (!def.forgeCost) return;
    soundEngine.playAbility(true);
    updateSave((prev) => {
      if (prev.ownedTops.some((t) => t.definitionId === definitionId)) return prev;
      const fc = def.forgeCost!;
      if (
        prev.currencies.legendaryFragments < fc.legendaryFragments ||
        prev.currencies.energyCrystals < fc.energyCrystals
      ) {
        return prev;
      }
      const newOwned = createOwnedFromDef(definitionId);
      const unlockedSet = new Set([
        ...prev.unlockedComponentIds,
        ...Object.values(def.defaultComponents),
      ]);
      const pts = 400;
      const next: PlayerSaveData = {
        ...prev,
        playerScore: prev.playerScore + pts,
        scoreLog: [
          {
            id: `forge-top-${definitionId}-${Date.now()}`,
            label: `Mythic Chassis Forged: ${def.displayName}`,
            points: pts,
            category: 'progression' as const,
            timestampMs: Date.now(),
          },
          ...prev.scoreLog,
        ].slice(0, 25),
        currencies: {
          ...prev.currencies,
          legendaryFragments: prev.currencies.legendaryFragments - fc.legendaryFragments,
          energyCrystals: prev.currencies.energyCrystals - fc.energyCrystals,
        },
        ownedTops: [...prev.ownedTops, newOwned],
        unlockedTopIds: [...prev.unlockedTopIds, definitionId],
        unlockedComponentIds: Array.from(unlockedSet),
        selectedTopInstanceId: newOwned.instanceId,
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleToggleTeamMember = (instanceId: string) => {
    soundEngine.playClick();
    updateSave((prev) => {
      const exists = prev.teamTopInstanceIds.includes(instanceId);
      if (exists) {
        if (prev.teamTopInstanceIds.length <= 1) return prev;
        return {
          ...prev,
          teamTopInstanceIds: prev.teamTopInstanceIds.filter((id) => id !== instanceId),
        };
      }
      const nextTeam =
        prev.teamTopInstanceIds.length >= 3
          ? [...prev.teamTopInstanceIds.slice(1), instanceId]
          : [...prev.teamTopInstanceIds, instanceId];
      return { ...prev, teamTopInstanceIds: nextTeam };
    });
  };

  const handleEvolveTop = (instanceId: string, pathId: string) => {
    const path = getEvolutionPath(pathId);
    if (!path) return;
    soundEngine.playAbility(true);
    updateSave((prev) => {
      const target = prev.ownedTops.find((t) => t.instanceId === instanceId);
      if (!target) return prev;
      const check = canEvolveTop(target, pathId, prev.currencies);
      if (!check.eligible) return prev;

      const apexSecretId = 'secret.elemental_apex';
      const secretNewlyFound = !prev.discoveredSecrets.includes(apexSecretId);
      const secretPts = secretNewlyFound ? getSecretDefinition(apexSecretId)?.points ?? 0 : 0;
      const evoPts = 300 + secretPts;

      const next: PlayerSaveData = {
        ...prev,
        playerScore: prev.playerScore + evoPts,
        discoveredSecrets: secretNewlyFound
          ? [...prev.discoveredSecrets, apexSecretId]
          : prev.discoveredSecrets,
        scoreLog: [
          {
            id: `evo-${instanceId}-${Date.now()}`,
            label: `Apex Evolution: ${path.displayName}${secretNewlyFound ? ' + Secret' : ''}`,
            points: evoPts,
            category: 'progression' as const,
            timestampMs: Date.now(),
          },
          ...prev.scoreLog,
        ].slice(0, 25),
        currencies: {
          ...prev.currencies,
          gold: prev.currencies.gold - path.goldCost,
          evolutionTokens: prev.currencies.evolutionTokens - path.evolutionTokensCost,
          elementalEssence: prev.currencies.elementalEssence - path.essenceCost,
        },
        ownedTops: prev.ownedTops.map((t) =>
          t.instanceId === instanceId
            ? { ...t, evolutionStage: 1, evolutionPathId: pathId }
            : t
        ),
      };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleClaimMission = (missionId: string) => {
    const mission = MISSIONS_CATALOG.find((m) => m.id === missionId);
    if (!mission) return;
    soundEngine.playAbility(false);
    updateSave((prev) => {
      const cur = prev.missionProgress[missionId];
      if (!cur || cur.claimed || cur.progress < mission.target) return prev;
      const r = mission.rewards;
      return {
        ...prev,
        playerScore: prev.playerScore + (r.score ?? 0),
        scoreLog: r.score
          ? [
              {
                id: `mis-${missionId}-${Date.now()}`,
                label: `Mission Claimed: ${mission.title}`,
                points: r.score,
                category: 'progression' as const,
                timestampMs: Date.now(),
              },
              ...prev.scoreLog,
            ].slice(0, 25)
          : prev.scoreLog,
        currencies: {
          ...prev.currencies,
          gold: prev.currencies.gold + (r.gold ?? 0),
          energyCrystals: prev.currencies.energyCrystals + (r.energyCrystals ?? 0),
          legendaryFragments: prev.currencies.legendaryFragments + (r.legendaryFragments ?? 0),
          elementalEssence: prev.currencies.elementalEssence + (r.elementalEssence ?? 0),
          evolutionTokens: prev.currencies.evolutionTokens + (r.evolutionTokens ?? 0),
        },
        missionProgress: {
          ...prev.missionProgress,
          [missionId]: { ...cur, claimed: true },
        },
      };
    });
  };

  const handleSaveCharacter = (profile: CharacterProfile) => {
    soundEngine.playAbility(false);
    updateSave((prev) => ({
      ...prev,
      character: profile,
    }));
    setActiveModal('none');
  };

  const handleUnlockCipherSecret = () => {
    soundEngine.playAbility(true);
    const cipherId = 'secret.stadium_cipher';
    const secDef = getSecretDefinition(cipherId);
    const pts = secDef?.points ?? 500;
    updateSave((prev) => {
      if (prev.discoveredSecrets.includes(cipherId)) return prev;
      return {
        ...prev,
        playerScore: prev.playerScore + pts,
        discoveredSecrets: [...prev.discoveredSecrets, cipherId],
        scoreLog: [
          {
            id: `sec-${cipherId}-${Date.now()}`,
            label: `Secret Decoded: ${secDef?.title ?? 'Neon Core Vault'}`,
            points: pts,
            category: 'secret' as const,
            timestampMs: Date.now(),
          },
          ...prev.scoreLog,
        ].slice(0, 25),
      };
    });
  };

  const handleMakeDecision = (decisionId: string, choiceId: string) => {
    const node = STORY_DECISIONS.find((d) => d.id === decisionId);
    const choice = node?.choices.find((c) => c.id === choiceId);
    if (!node || !choice) return;
    soundEngine.playAbility(false);

    let resolvedEndingToShow: string | null = null;

    updateSave((prev) => {
      if (prev.decisionHistory[decisionId]) return prev;
      const nextHistory = { ...prev.decisionHistory, [decisionId]: choiceId };
      const nextScore = prev.playerScore + (choice.scoreDelta ?? 0);
      const nextSave: PlayerSaveData = {
        ...prev,
        playerScore: nextScore,
        decisionHistory: nextHistory,
        scoreLog: choice.scoreDelta
          ? [
              {
                id: `dec-${decisionId}-${Date.now()}`,
                label: `Decision: ${choice.label}`,
                points: choice.scoreDelta,
                category: 'decision' as const,
                timestampMs: Date.now(),
              },
              ...prev.scoreLog,
            ].slice(0, 25)
          : prev.scoreLog,
        currencies: {
          ...prev.currencies,
          gold: prev.currencies.gold + (choice.goldDelta ?? 0),
          elementalEssence: prev.currencies.elementalEssence + (choice.essenceDelta ?? 0),
          evolutionTokens: prev.currencies.evolutionTokens + (choice.evoTokenDelta ?? 0),
        },
      };

      const answeredAll = STORY_DECISIONS.every((d) => Boolean(nextHistory[d.id]));
      if (answeredAll) {
        const ending = resolveStoryEnding(nextSave);
        resolvedEndingToShow = ending.id;
        nextSave.activeEndingId = ending.id;
        nextSave.unlockedEndingIds = Array.from(
          new Set([...nextSave.unlockedEndingIds, ending.id])
        );
      }

      return nextSave;
    });

    setPendingDecisionId(null);
    if (resolvedEndingToShow) {
      setPendingEndingId(resolvedEndingToShow);
    }
  };

  const handleStartNewLegacyRun = () => {
    soundEngine.playClick();
    updateSave((prev) => {
      const totalWins = prev.ownedTops.reduce((acc, t) => acc + t.wins, 0);
      const ending = prev.activeEndingId
        ? getEndingDefinition(prev.activeEndingId)
        : resolveStoryEnding(prev);
      const archived: LeaderboardEntry = {
        id: `legacy-${Date.now()}`,
        name: prev.character.name,
        title: prev.character.title,
        score: prev.playerScore,
        wins: totalWins,
        secretsFound: prev.discoveredSecrets.length,
        endingBadge: ending.type.toUpperCase(),
        isPlayer: false,
        appearance: prev.character.appearance,
      };
      return {
        ...prev,
        playerScore: 0,
        scoreLog: [],
        decisionHistory: {},
        activeEndingId: null,
        leaderboardEntries: [archived, ...prev.leaderboardEntries].slice(0, 8),
        tournament: {
          ...prev.tournament,
          active: false,
          currentRound: 0,
          completedRounds: 0,
        },
      };
    });
    setPendingEndingId(null);
  };

  const handleSelectTop = (instanceId: string) => {
    soundEngine.playClick();
    updateSave((prev) => {
      const next = { ...prev, selectedTopInstanceId: instanceId };
      syncShowcaseVisuals(next);
      return next;
    });
  };

  const handleSelectArena = (arenaId: ArenaId) => {
    soundEngine.playClick();
    sceneRef.current?.setArena(arenaId);
    updateSave((prev) => ({
      ...prev,
      selectedArenaId: arenaId,
      visitedArenaIds: Array.from(new Set([...prev.visitedArenaIds, arenaId])),
    }));
  };

  const handleQualityChange = (q: GraphicsQuality) => {
    sceneRef.current?.applyQuality(q);
    updateSave((prev) => ({ ...prev, settings: { ...prev.settings, graphicsQuality: q } }));
  };

  const canNextTournamentMatch =
    battleContextRef.current.mode === 'Tournament' &&
    save.tournament.currentRound < (save.tournament.bracketSize || 4);

  const survivalWaveCount = battleResult?.survivalWave ?? 1;
  const survivalNextOpp = OPPONENTS[survivalWaveCount % OPPONENTS.length];

  void saveLoaded;

  return (
    <MotionConfig reducedMotion={save.settings.reducedMotion ? 'always' : 'user'}>
    <div className="relative w-full h-full overflow-hidden bg-[#070b14] sl-ui-scaled">
      <OfflineIndicator />

      {/* Isolated WebGL Canvas Container */}
      <div
        ref={mountRef}
        data-testid="arena-canvas-mount"
        className="fixed inset-0 w-full h-full"
      />

      {/* WebGL Context Lost / Init Failure Recovery UI */}
      {webglInitError && (
        <div
          role="alert"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/92"
        >
          <div className="w-full max-w-md p-6 rounded-xl border border-rose-500/60 bg-slate-900 text-center space-y-4 shadow-2xl">
            <h2 className="text-lg font-black text-rose-300">3D Graphics Context Unavailable</h2>
            <p className="text-xs text-slate-300 leading-relaxed">{webglInitError}</p>
            <p className="text-[11px] text-slate-400">
              Your local progress and unlocked tops remain safely saved. Enable hardware acceleration or retry below.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold text-xs cursor-pointer"
            >
              Retry Arena Renderer
            </button>
          </div>
        </div>
      )}

      {!webglInitError && webglContextLost && (
        <div
          role="status"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg border border-amber-400 bg-slate-950/95 text-amber-200 text-xs font-bold flex items-center gap-2.5 shadow-xl"
        >
          <span>GPU graphics context lost — recovering automatically...</span>
          <button
            type="button"
            onClick={() => {
              const restored = sceneRef.current?.attemptContextRestore() ?? false;
              setWebglContextLost(false);
              setWebglWarning(null);
              if (!restored) {
                setSceneRecoveryKey((k) => k + 1);
              }
            }}
            className="px-2.5 py-1 rounded bg-sky-400 text-slate-950 font-extrabold cursor-pointer"
          >
            Restore 3D Scene
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-extrabold cursor-pointer"
          >
            Reload
          </button>
        </div>
      )}

      {/* Title Screen */}
      {shellState === 'title' &&
        activeModal === 'none' &&
        !howToPlayOpen &&
        !pendingBattle &&
        !pendingDecisionId &&
        !pendingEndingId && (
          <TitleOverlay
            save={save}
            activeTop={activeTop}
            unclaimedMissionsCount={unclaimedMissionsCount}
            storageWarning={storageWarning}
            webglWarning={webglWarning}
            onStartQuickBattle={() =>
              openPreparation({
                mode: 'Training',
                arenaId: save.selectedArenaId,
                opponentId: OPPONENTS[0].id,
                isTeamBattle: false,
              })
            }
            onOpenTraining={() => setActiveModal('training')}
            onOpenTournament={() => setActiveModal('tournament')}
            onOpenSurvival={() => setActiveModal('survival')}
            onOpenBoss={() => setActiveModal('boss')}
            onOpenTeamBattle={() => setActiveModal('team')}
            onOpenWorkshop={() => setActiveModal('workshop')}
            onOpenCollection={() => setActiveModal('collection')}
            onOpenMissions={() => setActiveModal('missions')}
            onOpenOnlineArena={() => setActiveModal('online')}
            onOpenCharacterCreator={() => setActiveModal('character')}
            onOpenLeaderboard={() => setActiveModal('leaderboard')}
            onOpenHowToPlay={() => setHowToPlayOpen(true)}
            onOpenSettings={() => {
              setKeyBindingNotice(null);
              setActiveModal('settings');
            }}
            onToggleMute={handleToggleMute}
          />
        )}

      {/* Pre-Battle Preparation Briefing */}
      {shellState === 'title' && pendingBattle && (
        <PreparationModal
          save={save}
          activeTop={activeTop}
          mode={pendingBattle.mode}
          arenaId={pendingBattle.arenaId}
          opponentId={pendingBattle.opponentId}
          isTeamBattle={pendingBattle.isTeamBattle}
          survivalWave={pendingBattle.survivalWave}
          mutators={pendingBattle.mutators}
          weather={pendingBattle.weather ?? save.preferredWeather ?? 'Clear'}
          onSelectWeather={(weather) => {
            soundEngine.playClick();
            setPendingBattle((prev) => (prev ? { ...prev, weather } : prev));
            updateSave((prev) => ({ ...prev, preferredWeather: weather }));
          }}
          onConfirmLaunch={() => startBattle(pendingBattle)}
          onCancel={() => setPendingBattle(null)}
        />
      )}

      {/* Active Battle HUD (Live Combat, Paused, and Cinematic Replay) */}
      {(shellState === 'playing' || shellState === 'paused' || shellState === 'replay') && hud && (
        <BattleHud
          hud={hud}
          playerAppearance={save.character.appearance}
          combatPopups={combatPopups}
          isReplay={shellState === 'replay'}
          replayTelemetry={replayTelemetry}
          onSkipReplay={() => setShellState('gameover')}
          launchMeterValue={launchMeter}
          muted={save.settings.muted}
          debugMode={isDebugActive}
          showDiagnostics={
            !onlineMatchRef.current &&
            (save.settings.showDiagnostics || (activeMatchMode === 'Training' && urlDebugForced))
          }
          telemetry={sceneTelemetry}
          cameraPreset={save.settings.cameraPreset}
          keyBindings={save.settings.keyBindings}
          survivalWave={battleContextRef.current.survivalWave}
          onlineRttMs={onlineRttMs}
          reconnectGraceSec={reconnectGraceSec}
          showFirstMatchHint={showFirstMatchHint}
          onDismissFirstMatchHint={() => {
            setShowFirstMatchHint(false);
            try {
              localStorage.setItem('sl_first_launch_hint_dismissed', '1');
            } catch {
              // ignore
            }
          }}
          onLaunch={handleLaunchNow}
          onSelectMode={handleSelectMode}
          onSelectCommand={handleSelectCommand}
          onActivateAbility={handleActivateAbility}
          onSwitchTeamTop={handleSwitchTeamTop}
          onCycleCameraPreset={handleCycleCameraPreset}
          onSelectCameraPreset={(preset) => {
            sceneRef.current?.setCameraPreset(preset);
            updateSave((prev) => ({
              ...prev,
              settings: { ...prev.settings, cameraPreset: preset },
            }));
          }}
          onExitSpectate={exitToTitle}
          onToggleDiagnostics={() => {
            updateSave((prev) => {
              const nextVal = !prev.settings.showDiagnostics;
              sceneRef.current?.setShowDiagnostics(nextVal);
              if (!nextVal) {
                setSceneTelemetry(null);
              }
              return { ...prev, settings: { ...prev.settings, showDiagnostics: nextVal } };
            });
          }}
          onClearHeatmap={() => {
            soundEngine.playClick();
            sceneRef.current?.clearCollisionHeatmap();
          }}
          onToggleMute={handleToggleMute}
          onPause={() => {
            setPauseQuickSwapFocus(false);
            setShellState('paused');
          }}
          canQuickSwap={
            !hud.isSpectating &&
            isQuickSwapAllowedForMode(battleContextRef.current.mode, hud.isSpectating)
          }
          onQuickSwap={() => {
            soundEngine.playClick();
            setPauseQuickSwapFocus(true);
            setShellState('paused');
          }}
        />
      )}

      {/* Pause Modal */}
      {shellState === 'paused' && (
        <PauseModal
          canQuickSwap={
            !hud?.isSpectating &&
            isQuickSwapAllowedForMode(activeMatchMode, hud?.isSpectating)
          }
          matchMode={activeMatchMode}
          presets={save.presets}
          activeTopInstanceId={save.selectedTopInstanceId}
          initialShowQuickSwap={pauseQuickSwapFocus}
          onQuickSwapPreset={handleQuickSwapInBattle}
          onResume={() => {
            setPauseQuickSwapFocus(false);
            setShellState('playing');
          }}
          onRestart={() => {
            setPauseQuickSwapFocus(false);
            if (onlineMatchRef.current) {
              exitToTitle();
              setActiveModal('online');
              return;
            }
            startBattle({
              mode: battleContextRef.current.mode,
              arenaId: battleContextRef.current.arenaId,
              opponentId: battleContextRef.current.opponentId,
              isTeamBattle: battleContextRef.current.isTeamBattle,
              survivalWave: battleContextRef.current.survivalWave ?? undefined,
              mutators: battleContextRef.current.mutators,
              weather: battleContextRef.current.weather,
              shadowOpponent: battleContextRef.current.shadowOpponent,
              revengeRival: battleContextRef.current.revengeRival,
            });
          }}
          onExitToTitle={() => {
            setPauseQuickSwapFocus(false);
            exitToTitle();
          }}
        />
      )}

      {/* Battle Results Modal */}
      {shellState === 'gameover' && battleResult && (
        <BattleResultsModal
          result={battleResult}
          canNextTournamentMatch={canNextTournamentMatch}
          hasBackgroundReplay={Boolean(
            battleResult.highlights &&
              battleResult.highlights.frames.length >= 2 &&
              replayTelemetry
          )}
          onPlayAgain={() => {
            if (
              battleContextRef.current.mode === 'OnlineFriendly' ||
              battleContextRef.current.mode === 'OnlineRanked'
            ) {
              exitToTitle();
              setActiveModal('online');
              return;
            }
            startBattle({
              mode: battleContextRef.current.mode,
              arenaId: battleContextRef.current.arenaId,
              opponentId: battleContextRef.current.opponentId,
              isTeamBattle: battleContextRef.current.isTeamBattle,
              survivalWave: battleContextRef.current.mode === 'Survival' ? 1 : undefined,
              mutators: battleContextRef.current.mutators,
              weather: battleContextRef.current.weather,
              shadowOpponent: battleContextRef.current.shadowOpponent,
              revengeRival: battleContextRef.current.revengeRival,
            });
          }}
          onNextTournamentMatch={() => {
            const roundIdx = save.tournament.currentRound;
            const oppId =
              save.tournament.bracketOpponentIds[roundIdx] ?? OPPONENTS[0].id;
            const arenaId = save.tournament.arenaIds[roundIdx] ?? save.selectedArenaId;
            startBattle({ mode: 'Tournament', arenaId, opponentId: oppId });
          }}
          onNextSurvivalWave={
            battleResult.mode === 'Survival' && battleResult.won
              ? () => {
                  const nextWave = (battleResult.survivalWave ?? 1) + 1;
                  const carryStamina = Math.min(
                    1,
                    battleResult.playerRemainingStamina / 100 + 0.18
                  );
                  const carryDurability = Math.min(
                    1,
                    battleResult.playerRemainingDurability / 100 + 0.18
                  );
                  startBattle({
                    mode: 'Survival',
                    arenaId: battleContextRef.current.arenaId,
                    opponentId: survivalNextOpp.id,
                    survivalWave: nextWave,
                    carryStaminaRatio: carryStamina,
                    carryDurabilityRatio: carryDurability,
                    weather: battleContextRef.current.weather,
                  });
                }
              : undefined
          }
          onOpenWorkshop={() => {
            exitToTitle();
            setActiveModal('workshop');
          }}
          onExitToTitle={exitToTitle}
        />
      )}

      {/* Workshop Drawer */}
      {shellState === 'title' && activeModal === 'workshop' && (
        <WorkshopModal
          save={save}
          activeTop={activeTop}
          exploded={workshopExploded}
          selectedCategory={workshopCategory}
          partFocusSignal={workshopPartFocusSignal}
          onSelectCategory={setWorkshopCategory}
          onToggleExplode={() => {
            soundEngine.playClick();
            setWorkshopExploded((prev) => !prev);
          }}
          onClose={() => {
            setWorkshopExploded(false);
            setActiveModal('none');
          }}
          onEquipComponent={handleEquipComponent}
          onUnlockComponent={handleUnlockComponent}
          onForgeMythicComponent={handleForgeMythicComponent}
          onUpgradeComponent={handleUpgradeComponent}
          onUpgradeCapacitor={handleUpgradeCapacitor}
          onUpdateAbility={handleUpdateAbility}
          onSetSecondaryElement={handleSetSecondaryElement}
          onUpdateCosmetics={handleUpdateCosmetics}
          onPreviewVictoryEmote={(emote) => sceneRef.current?.previewVictoryEmote(emote)}
          onSavePreset={handleSavePreset}
          onApplyPreset={handleApplyPreset}
        />
      )}

      {/* Collection, Team & Evolution Modal */}
      {shellState === 'title' && activeModal === 'collection' && (
        <CollectionModal
          save={save}
          activeTop={activeTop}
          onClose={() => setActiveModal('none')}
          onSelectTop={handleSelectTop}
          onUnlockTop={handleUnlockTop}
          onForgeMythicTop={handleForgeMythicTop}
          onToggleTeamMember={handleToggleTeamMember}
          onEvolveTop={handleEvolveTop}
        />
      )}

      {/* Modes, Arenas, Tournament, Survival, Boss & Team Select Modal */}
      {shellState === 'title' &&
        (activeModal === 'training' ||
          activeModal === 'tournament' ||
          activeModal === 'survival' ||
          activeModal === 'boss' ||
          activeModal === 'team') && (
          <TournamentModal
            save={save}
            initialTab={activeModal}
            onUpdateMutators={(mutators) =>
              updateSave((prev) => ({ ...prev, preferredMutators: mutators }))
            }
            onClose={() => setActiveModal('none')}
            onSelectArena={handleSelectArena}
            onToggleDiagnostics={() => {
              updateSave((prev) => {
                const nextVal = !prev.settings.showDiagnostics;
                sceneRef.current?.setShowDiagnostics(nextVal);
                if (!nextVal) {
                  setSceneTelemetry(null);
                }
                return { ...prev, settings: { ...prev.settings, showDiagnostics: nextVal } };
              });
            }}
            onStartTraining={(oppId, arenaId) =>
              openPreparation({
                mode: 'Training',
                arenaId,
                opponentId: oppId,
                isTeamBattle: false,
                mutators: save.preferredMutators,
              })
            }
            onStartTournamentMatch={() => {
              const idx = save.tournament.currentRound;
              const oppId = save.tournament.bracketOpponentIds[idx] ?? OPPONENTS[0].id;
              const arenaId = save.tournament.arenaIds[idx] ?? save.selectedArenaId;
              openPreparation({
                mode: 'Tournament',
                arenaId,
                opponentId: oppId,
                isTeamBattle: false,
              });
            }}
            onResetTournament={(bracketSize) => {
              const bracket = buildTournamentBracket(bracketSize);
              updateSave((prev) => ({
                ...prev,
                tournament: {
                  ...prev.tournament,
                  active: true,
                  bracketSize,
                  currentRound: 0,
                  completedRounds: 0,
                  bracketOpponentIds: bracket.opponentIds,
                  arenaIds: bracket.arenaIds,
                },
              }));
            }}
            onStartSurvival={(arenaId) =>
              openPreparation({
                mode: 'Survival',
                arenaId,
                opponentId: OPPONENTS[0].id,
                isTeamBattle: false,
                survivalWave: 1,
              })
            }
            onStartBossBattle={(bossId, arenaId) =>
              openPreparation({
                mode: 'Boss',
                arenaId,
                opponentId: bossId,
                isTeamBattle: false,
              })
            }
            onStartTeamBattle={(oppId, arenaId) =>
              openPreparation({
                mode: 'TeamBattle',
                arenaId,
                opponentId: oppId,
                isTeamBattle: true,
              })
            }
            onOpenOnlineArena={() => setActiveModal('online')}
          />
        )}

      {/* Missions & Achievements Modal */}
      {shellState === 'title' && activeModal === 'missions' && (
        <MissionsModal
          save={save}
          onClose={() => setActiveModal('none')}
          onClaimMission={handleClaimMission}
        />
      )}

      {/* Online Arena & Global League */}
      {shellState === 'title' && activeModal === 'online' && (
        <OnlineModal
          save={save}
          activeTop={activeTop}
          currentRoom={onlineRoom}
          queueMode={onlineQueueMode}
          queuePosition={onlineQueuePos}
          statusMessage={onlineStatusMsg}
          onClose={() => setActiveModal('none')}
          onConnectedUpdate={(cmd) => {
            if (!cmd) {
              setOnlineRoom(null);
              setOnlineQueueMode(null);
            }
          }}
          onCloudSaveLoaded={(loaded) => {
            soundEngine.setMuted(loaded.settings.muted);
            soundEngine.setVolume(loaded.settings.masterVolume);
            sceneRef.current?.applyQuality(loaded.settings.graphicsQuality);
            sceneRef.current?.setCameraSensitivity(loaded.settings.cameraSensitivity);
            sceneRef.current?.setCameraPreset(loaded.settings.cameraPreset);
            sceneRef.current?.setClashCameraEnabled(loaded.settings.dynamicClashCamera !== false);
            saveRef.current = loaded;
            setSave(loaded);
            void savePlayerData(loaded);
            syncShowcaseVisuals(loaded);
          }}
          onJoinQueue={(mode, arenaId) => {
            setOnlineStatusMsg(null);
            onlinePvpClient.joinQueue(mode, arenaId, buildOnlinePayloadFromTop(activeTop));
          }}
          onLeaveQueue={() => onlinePvpClient.leaveQueue()}
          onCreateRoom={(mode, arenaId, mutators) => {
            setOnlineStatusMsg(null);
            onlinePvpClient.createRoom(
              mode,
              arenaId,
              buildOnlinePayloadFromTop(activeTop),
              mutators
            );
          }}
          onJoinRoom={(code, options) => {
            setOnlineStatusMsg(null);
            onlinePvpClient.joinRoom(code, buildOnlinePayloadFromTop(activeTop), options);
          }}
          onLeaveRoom={() => {
            onlinePvpClient.leaveRoom();
            setOnlineRoom(null);
          }}
          onStartRoomMatch={() => onlinePvpClient.startRoomMatch()}
          onChallengeShadow={(shadow, mutators) => {
            startBattle({
              mode: 'ShadowPvP',
              arenaId: save.selectedArenaId,
              shadowOpponent: shadow,
              mutators,
            });
          }}
          onRevengeMatch={(rival) => {
            startBattle({
              mode: 'ShadowPvP',
              arenaId: save.selectedArenaId,
              revengeRival: rival,
            });
          }}
          onOpenWorkshop={() => {
            setActiveModal('workshop');
          }}
          onClaimSeasonReward={async (tierId: RankTierId) => {
            const res = await claimSeasonTierReward(tierId);
            if (res.ok) {
              const tierDef = RANK_TIERS.find((t) => t.id === tierId);
              const claimKey = getSeasonTierClaimKey(res.seasonNumber ?? 1, tierId);
              if (tierDef) {
                updateSave((prev) => ({
                  ...prev,
                  currencies: {
                    ...prev.currencies,
                    gold: prev.currencies.gold + tierDef.rewardGold,
                    energyCrystals:
                      prev.currencies.energyCrystals + tierDef.rewardCrystals,
                    legendaryFragments:
                      prev.currencies.legendaryFragments + tierDef.rewardFragments,
                  },
                  claimedSeasonRewardTiers: Array.from(
                    new Set([...(prev.claimedSeasonRewardTiers ?? []), claimKey])
                  ),
                }));
              }
              return true;
            }
            return false;
          }}
        />
      )}

      {/* Character Creator Modal */}
      {shellState === 'title' && activeModal === 'character' && (
        <CharacterCreatorModal
          initialProfile={save.character}
          onClose={() => setActiveModal('none')}
          onSave={handleSaveCharacter}
        />
      )}

      {/* Scoreboard, Secrets & Chronicle Modal */}
      {shellState === 'title' && activeModal === 'leaderboard' && (
        <LeaderboardModal
          save={save}
          onClose={() => setActiveModal('none')}
          onUnlockCipherSecret={handleUnlockCipherSecret}
          onMakeDecision={handleMakeDecision}
          onTriggerEndingPreview={() => {
            const ending = resolveStoryEnding(save);
            setActiveModal('none');
            setPendingEndingId(ending.id);
          }}
        />
      )}

      {/* Milestone Key Decision Modal */}
      {shellState === 'title' && pendingDecisionId && (
        <StoryDecisionModal
          decision={STORY_DECISIONS.find((d) => d.id === pendingDecisionId) ?? STORY_DECISIONS[0]}
          onChoose={(choiceId) => handleMakeDecision(pendingDecisionId, choiceId)}
        />
      )}

      {/* Ending Ceremony Modal */}
      {shellState === 'title' && pendingEndingId && !pendingDecisionId && (
        <EndingCeremonyModal
          ending={getEndingDefinition(pendingEndingId)}
          character={save.character}
          finalScore={save.playerScore}
          secretsFound={save.discoveredSecrets.length}
          onContinueFreePlay={() => setPendingEndingId(null)}
          onStartNewLegacyRun={handleStartNewLegacyRun}
        />
      )}

      {/* How to Play Modal */}
      {shellState === 'title' && howToPlayOpen && (
        <HowToPlayModal onClose={() => setHowToPlayOpen(false)} />
      )}

      {/* Settings Modal */}
      {shellState === 'title' && activeModal === 'settings' && (
        <SettingsModal
          save={save}
          urlDebugForced={urlDebugForced}
          bindingNotice={keyBindingNotice}
          onClose={() => {
            setKeyBindingNotice(null);
            setActiveModal('none');
          }}
          onChangeQuality={handleQualityChange}
          onChangeVolume={(v) => {
            soundEngine.setVolume(v);
            updateSave((prev) => ({ ...prev, settings: { ...prev.settings, masterVolume: v } }));
          }}
          onChangeSensitivity={(s) => {
            sceneRef.current?.setCameraSensitivity(s);
            updateSave((prev) => ({
              ...prev,
              settings: { ...prev.settings, cameraSensitivity: s },
            }));
          }}
          onToggleDebugMode={() =>
            updateSave((prev) => ({
              ...prev,
              settings: { ...prev.settings, debugMode: !prev.settings.debugMode },
            }))
          }
          onToggleDiagnostics={() =>
            updateSave((prev) => {
              const nextVal = !prev.settings.showDiagnostics;
              sceneRef.current?.setShowDiagnostics(nextVal);
              if (!nextVal) {
                setSceneTelemetry(null);
              }
              return {
                ...prev,
                settings: { ...prev.settings, showDiagnostics: nextVal },
              };
            })
          }
          onChangeCameraPreset={(preset) => {
            sceneRef.current?.setCameraPreset(preset);
            updateSave((prev) => ({
              ...prev,
              settings: { ...prev.settings, cameraPreset: preset },
            }));
          }}
          onChangeUiScale={(uiScale) =>
            updateSave((prev) => ({
              ...prev,
              settings: { ...prev.settings, uiScale },
            }))
          }
          onToggleDynamicMusic={() =>
            updateSave((prev) => ({
              ...prev,
              settings: { ...prev.settings, dynamicMusic: !prev.settings.dynamicMusic },
            }))
          }
          onToggleDynamicClashCamera={() =>
            updateSave((prev) => {
              const nextVal = prev.settings.dynamicClashCamera === false;
              sceneRef.current?.setClashCameraEnabled(nextVal);
              return {
                ...prev,
                settings: { ...prev.settings, dynamicClashCamera: nextVal },
              };
            })
          }
          onToggleGamepad={() =>
            updateSave((prev) => ({
              ...prev,
              settings: { ...prev.settings, gamepadEnabled: !prev.settings.gamepadEnabled },
            }))
          }
          onToggleReducedMotion={() =>
            updateSave((prev) => {
              const nextReduced = !prev.settings.reducedMotion;
              const prefersReduced =
                typeof window !== 'undefined' &&
                Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
              sceneRef.current?.setReducedMotion(nextReduced || prefersReduced);
              return {
                ...prev,
                settings: { ...prev.settings, reducedMotion: nextReduced },
              };
            })
          }
          onUpdateKeyBinding={(action: keyof KeyBindings, rawKey: string) => {
            const normalized = rawKey === ' ' ? ' ' : rawKey.toLowerCase();
            if (normalized === 'm') {
              setKeyBindingNotice('Key "M" is reserved for Global Mute.');
              return;
            }
            const currentBinds = saveRef.current.settings.keyBindings;
            const conflictEntry = (Object.entries(currentBinds) as Array<[keyof KeyBindings, string]>).find(
              ([k, val]) => k !== action && (val === ' ' ? ' ' : val.toLowerCase()) === normalized
            );
            if (conflictEntry) {
              const [conflictAction] = conflictEntry;
              const previousForAction = currentBinds[action];
              const displayKey = normalized === ' ' ? 'SPACE' : normalized.toUpperCase();
              setKeyBindingNotice(
                `Swapped "${displayKey}" between ${action} and ${conflictAction}.`
              );
              updateSave((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  keyBindings: {
                    ...prev.settings.keyBindings,
                    [action]: normalized,
                    [conflictAction]: previousForAction,
                  },
                },
              }));
              return;
            }
            setKeyBindingNotice(null);
            updateSave((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                keyBindings: { ...prev.settings.keyBindings, [action]: normalized },
              },
            }));
          }}
          onImportSave={(imported) => {
            soundEngine.setMuted(imported.settings.muted);
            soundEngine.setVolume(imported.settings.masterVolume);
            sceneRef.current?.applyQuality(imported.settings.graphicsQuality);
            sceneRef.current?.setCameraSensitivity(imported.settings.cameraSensitivity);
            sceneRef.current?.setCameraPreset(imported.settings.cameraPreset);
            const prefersReduced =
              typeof window !== 'undefined' &&
              Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
            sceneRef.current?.setReducedMotion(Boolean(imported.settings.reducedMotion) || prefersReduced);
            sceneRef.current?.setClashCameraEnabled(imported.settings.dynamicClashCamera !== false);
            saveRef.current = imported;
            setSave(imported);
            void savePlayerData(imported);
            syncShowcaseVisuals(imported);
          }}
          onResetSave={async () => {
            const fresh = await resetPlayerSave();
            saveRef.current = fresh;
            setSave(fresh);
            syncShowcaseVisuals(fresh);
            setActiveModal('none');
          }}
        />
      )}
    </div>
    </MotionConfig>
  );
}
