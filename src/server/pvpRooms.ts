import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  ABILITIES,
  ARENAS,
  COMPONENT_CATEGORIES,
  COMPONENTS,
  ELEMENTS,
  EVOLUTION_PATHS,
  TOP_DEFINITIONS,
  getTopDefinition,
} from '../domain/catalog.ts';
import {
  DEFAULT_BATTLE_MUTATORS,
  calculateAttributes,
  calculatePhysicalProfile,
  isPowerInPerfectWindow,
  sanitizeBattleMutators,
  validateTopConfiguration,
} from '../domain/rules.ts';
import type {
  ArenaId,
  BattleMutators,
  CosmeticCustomization,
  ElementType,
  EquippedComponents,
  FinishReason,
  MatchMode,
  PlayerSaveData,
} from '../domain/types.ts';
import {
  FIXED_DT,
  OPPONENT_LAUNCH_SPAWN,
  PLAYER_LAUNCH_SPAWN,
  activateAbility,
  applyLaunchVelocities,
  buildBattleAnalysisReport,
  buildMatchHighlightClip,
  clampLaunchAngleToSide,
  createBattleSimulation,
  extractAuthoritativeSnapshot,
  stepBattleSimulation,
  type BattleSimulationState,
  type TopSimConfig,
} from '../simulation/physicsEngine.ts';
import {
  getCloudSaveForCommander,
  getCommanderById,
  recordOnlineMatchResult,
  sanitizeCommanderPublic,
  verifySessionToken,
} from './store.ts';

export interface OnlinePlayerBuild {
  topDefinitionId: string;
  level: number;
  secondaryElement: ElementType | null;
  equippedComponents: EquippedComponents;
  equippedAbilities: [string, string, string, string];
  evolutionStage: number;
  evolutionPathId: string | null;
  cosmetics?: CosmeticCustomization;
}

const VALID_TOP_IDS = new Set(TOP_DEFINITIONS.map((t) => t.id));
const VALID_COMPONENT_IDS = new Set(COMPONENTS.map((c) => c.id));
const VALID_ABILITY_IDS = new Set(ABILITIES.map((a) => a.id));
const VALID_ELEMENT_IDS = new Set(Object.keys(ELEMENTS));
const VALID_ARENA_IDS = new Set(Object.keys(ARENAS));
const VALID_EVO_PATHS = new Map(EVOLUTION_PATHS.map((e) => [e.id, e]));

function sanitizeArenaId(raw: unknown): ArenaId {
  return typeof raw === 'string' && VALID_ARENA_IDS.has(raw) ? (raw as ArenaId) : 'standard';
}

export function validateAndResolveOnlineBuild(
  raw: unknown,
  playerId: string
): {
  build: OnlinePlayerBuild;
  upgradeLevels: Record<string, number>;
  characterStats?: PlayerSaveData['character']['stats'];
  capacitorLevel: number;
} {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const cloudSave = getCloudSaveForCommander(playerId);

  let topDefId =
    typeof b.topDefinitionId === 'string' && VALID_TOP_IDS.has(b.topDefinitionId)
      ? b.topDefinitionId
      : 'top.ignis.drake';

  if (cloudSave) {
    const ownsRequested =
      cloudSave.unlockedTopIds.includes(topDefId) ||
      cloudSave.ownedTops.some((t) => t.definitionId === topDefId);
    if (!ownsRequested && cloudSave.ownedTops.length > 0) {
      topDefId = cloudSave.ownedTops[0].definitionId;
    }
  } else {
    // Guests/accounts without synced cloud save can still pick starter/non-boss tops safely
    const def = getTopDefinition(topDefId);
    if (def.isBoss || def.rarity === 'Mythic') {
      topDefId = 'top.ignis.drake';
    }
  }

  const topDef = getTopDefinition(topDefId);
  const ownedInstance = cloudSave?.ownedTops.find((t) => t.definitionId === topDefId);

  const compRaw =
    b.equippedComponents && typeof b.equippedComponents === 'object'
      ? (b.equippedComponents as Record<string, unknown>)
      : {};
  const equippedComponents: EquippedComponents = { ...topDef.defaultComponents };
  for (const cat of COMPONENT_CATEGORIES) {
    const rawCandidate = compRaw[cat.id];
    const candidate = typeof rawCandidate === 'string' ? rawCandidate : '';
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
  const equippedAbilities: [string, string, string, string] = [
    typeof abRaw[0] === 'string' && VALID_ABILITY_IDS.has(abRaw[0])
      ? abRaw[0]
      : topDef.defaultAbilities[0],
    typeof abRaw[1] === 'string' && VALID_ABILITY_IDS.has(abRaw[1])
      ? abRaw[1]
      : topDef.defaultAbilities[1],
    typeof abRaw[2] === 'string' && VALID_ABILITY_IDS.has(abRaw[2])
      ? abRaw[2]
      : topDef.defaultAbilities[2],
    typeof abRaw[3] === 'string' && VALID_ABILITY_IDS.has(abRaw[3])
      ? abRaw[3]
      : topDef.defaultAbilities[3],
  ];

  const reqLevel = Number.isFinite(Number(b.level)) ? Math.max(1, Math.round(Number(b.level))) : 1;
  const maxAllowedLevel = ownedInstance ? ownedInstance.level : cloudSave ? 10 : 5;
  const level = Math.min(50, Math.min(maxAllowedLevel, reqLevel));

  const reqEvo = Number(b.evolutionStage) === 1 ? 1 : 0;
  const evolutionStage = ownedInstance ? Math.min(ownedInstance.evolutionStage, reqEvo) : 0;
  const reqPathId = typeof b.evolutionPathId === 'string' ? b.evolutionPathId : null;
  const evolutionPathId =
    evolutionStage === 1 && reqPathId && VALID_EVO_PATHS.has(reqPathId)
      ? reqPathId
      : evolutionStage === 1
        ? (ownedInstance?.evolutionPathId ?? null)
        : null;

  const secondaryElement =
    typeof b.secondaryElement === 'string' && VALID_ELEMENT_IDS.has(b.secondaryElement)
      ? (b.secondaryElement as ElementType)
      : null;

  const rawCosmetics =
    b.cosmetics && typeof b.cosmetics === 'object'
      ? (b.cosmetics as Partial<CosmeticCustomization>)
      : null;
  const hexOk = (v: unknown) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
  const validPatterns = new Set(['solid', 'striped', 'circuit', 'apex']);
  const cosmetics: CosmeticCustomization | undefined =
    rawCosmetics &&
    hexOk(rawCosmetics.primaryColor) &&
    hexOk(rawCosmetics.trimColor) &&
    hexOk(rawCosmetics.trailColor)
      ? {
          primaryColor: hexOk(rawCosmetics.primaryColor)!,
          trimColor: hexOk(rawCosmetics.trimColor)!,
          trailColor: hexOk(rawCosmetics.trailColor)!,
          pattern:
            typeof rawCosmetics.pattern === 'string' && validPatterns.has(rawCosmetics.pattern)
              ? (rawCosmetics.pattern as CosmeticCustomization['pattern'])
              : 'solid',
        }
      : ownedInstance?.cosmetics;

  return {
    build: {
      topDefinitionId: topDefId,
      level,
      secondaryElement,
      equippedComponents: finalComponents,
      equippedAbilities,
      evolutionStage,
      evolutionPathId,
      cosmetics,
    },
    upgradeLevels: cloudSave?.componentUpgradeLevels ?? {},
    characterStats: cloudSave?.character?.stats,
    capacitorLevel: cloudSave?.capacitorLevel ?? 0,
  };
}

function toTopSimConfig(
  entityId: 'player' | 'opponent',
  handle: string,
  resolved: ReturnType<typeof validateAndResolveOnlineBuild>
): TopSimConfig {
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
    initialMode: 'Stamina',
    initialCommand: 'HoldPosition',
    evolutionStage: build.evolutionStage,
  };
}

interface RoomMember {
  playerId: string;
  handle: string;
  mmr: number;
  ws: WebSocket | null;
  connected: boolean;
  disconnectedAtMs: number | null;
  resolvedBuild: ReturnType<typeof validateAndResolveOnlineBuild>;
  ready: boolean;
  launchPower: number | null;
  launchAngle: number | null;
  launchTargetX: number;
  launchTargetZ: number;
  launchPerfect: boolean;
  lastAbilityAtMs: number;
}

interface RoomSpectator {
  playerId: string;
  handle: string;
  ws: WebSocket;
  joinedAtMs: number;
}

interface OnlineRoom {
  roomId: string;
  code: string;
  mode: 'OnlineFriendly' | 'OnlineRanked';
  arenaId: ArenaId;
  mutators: BattleMutators;
  hostPlayerId: string;
  phase: 'Lobby' | 'Launch' | 'Combat' | 'Finished';
  launchTimer: ReturnType<typeof setTimeout> | null;
  simInterval: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectGraceTargetId: string | null;
  sim: BattleSimulationState | null;
  tickCount: number;
  lastSnapshotTick: number;
  lastLaunches?: Array<{
    playerId: string;
    powerRatio: number;
    angleRad: number;
    targetX: number;
    targetZ: number;
    perfect?: boolean;
  }>;
  members: RoomMember[];
  spectators: RoomSpectator[];
  createdAtMs: number;
}

interface QueueEntry {
  playerId: string;
  ws: WebSocket;
  arenaId: ArenaId;
  resolvedBuild: ReturnType<typeof validateAndResolveOnlineBuild>;
}

const RECONNECT_GRACE_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const IDLE_ROOM_TTL_MS = 15 * 60_000;
const MAX_SPECTATORS_PER_ROOM = 6;

const rooms = new Map<string, OnlineRoom>();
const friendlyQueue: QueueEntry[] = [];
const rankedQueue: QueueEntry[] = [];
const socketIdentity = new WeakMap<
  WebSocket,
  { playerId: string; roomId: string | null; isSpectator?: boolean }
>();
const aliveSockets = new WeakMap<WebSocket, boolean>();
const allActiveSockets = new Set<WebSocket>();

function sendJson(ws: WebSocket | null | undefined, msg: Record<string, unknown>): void {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: OnlineRoom, msg: Record<string, unknown>): void {
  for (const m of room.members) {
    if (m.connected && m.ws) {
      sendJson(m.ws, msg);
    }
  }
  for (const s of room.spectators) {
    sendJson(s.ws, msg);
  }
}

function serializeRoom(room: OnlineRoom) {
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
      handle: s.handle,
    })),
    members: room.members.map((m) => ({
      playerId: m.playerId,
      handle: m.handle,
      mmr: m.mmr,
      ready: m.ready,
      connected: m.connected,
      build: m.resolvedBuild.build,
      appearance: getCommanderById(m.playerId)?.appearance,
      launchLocked: m.launchPower !== null,
    })),
  };
}

function generateRoomCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function removeFromQueues(playerId: string): void {
  for (let i = friendlyQueue.length - 1; i >= 0; i--) {
    if (friendlyQueue[i].playerId === playerId) friendlyQueue.splice(i, 1);
  }
  for (let i = rankedQueue.length - 1; i >= 0; i--) {
    if (rankedQueue[i].playerId === playerId) rankedQueue.splice(i, 1);
  }
}

function clearRoomTimers(room: OnlineRoom): void {
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

function finalizeMatchFromRoom(
  room: OnlineRoom,
  winnerId: string,
  finishReason: FinishReason
): void {
  if (room.phase === 'Finished') return;
  room.phase = 'Finished';
  clearRoomTimers(room);

  const p1 = room.members[0];
  const p2 = room.members[1];
  let mmrDelta = 0;
  const updatedCommanders: Array<ReturnType<typeof sanitizeCommanderPublic>> = [];

  const hostClip = room.sim ? buildMatchHighlightClip(room.sim, 'player') : undefined;
  const guestClip = room.sim ? buildMatchHighlightClip(room.sim, 'opponent') : undefined;
  const hostAnalysis = room.sim ? buildBattleAnalysisReport(room.sim, 'player') : undefined;
  const guestAnalysis = room.sim ? buildBattleAnalysisReport(room.sim, 'opponent') : undefined;
  const durationSec = room.sim?.elapsedTime ?? 0;

  if (p1 && p2) {
    const res = recordOnlineMatchResult({
      matchId: `${room.roomId}-${room.createdAtMs}`,
      roomCode: room.code,
      mode: room.mode as MatchMode,
      arenaId: room.arenaId,
      p1Id: p1.playerId,
      p2Id: p2.playerId,
      winnerId,
      finishReason,
      durationSec,
      highlightSummaryJson: hostClip
        ? JSON.stringify({
            winnerSide: hostClip.winnerSide,
            finishReason: hostClip.finishReason,
            finalBlowTimeSec: hostClip.finalBlowTimeSec,
            frameCount: hostClip.frames.length,
          })
        : null,
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
      type: 'match_finalized',
      roomId: room.roomId,
      winnerId,
      finishReason,
      mmrDelta,
      commanders: updatedCommanders,
      highlights: isHost ? hostClip : guestClip,
      analysis: isHost ? hostAnalysis : guestAnalysis,
    });
  }

  for (const s of room.spectators) {
    sendJson(s.ws, {
      type: 'match_finalized',
      roomId: room.roomId,
      winnerId,
      finishReason,
      mmrDelta,
      commanders: updatedCommanders,
      highlights: hostClip,
      analysis: hostAnalysis,
      asSpectator: true,
    });
  }
}

function handleDisconnectFromRoom(ws: WebSocket): void {
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
    broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
    return;
  }

  const member = room.members.find((m) => m.playerId === idInfo.playerId);
  if (!member) return;

  // Ignore stale close event if member already reattached on a newer socket
  if (member.ws && member.ws !== ws) return;

  member.ws = null;
  member.connected = false;
  member.disconnectedAtMs = Date.now();

  if (room.phase === 'Launch' || room.phase === 'Combat') {
    const other = room.members.find((m) => m.playerId !== member.playerId && m.connected);
    if (!other) {
      // Both gone — terminate room cleanly
      clearRoomTimers(room);
      room.phase = 'Finished';
      rooms.delete(room.roomId);
      return;
    }

    // Start 15-second reconnect grace period before awarding forfeit
    room.reconnectGraceTargetId = member.playerId;
    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
    sendJson(other.ws, {
      type: 'opponent_reconnecting',
      roomId: room.roomId,
      disconnectedPlayerId: member.playerId,
      graceSec: Math.round(RECONNECT_GRACE_MS / 1000),
    });

    room.reconnectTimer = setTimeout(() => {
      if (room.phase !== 'Launch' && room.phase !== 'Combat') return;
      const stillDisconnected = room.members.find(
        (m) => m.playerId === member.playerId && !m.connected
      );
      if (stillDisconnected) {
        const remaining = room.members.find((m) => m.playerId !== member.playerId);
        if (remaining) {
          finalizeMatchFromRoom(room, remaining.playerId, 'Survival');
          sendJson(remaining.ws, {
            type: 'opponent_disconnected',
            roomId: room.roomId,
            remainingWinnerId: remaining.playerId,
          });
        }
      }
    }, RECONNECT_GRACE_MS);
    return;
  }

  // Lobby or Finished: remove member immediately
  room.members = room.members.filter((m) => m.playerId !== idInfo.playerId);
  if (room.members.length === 0) {
    clearRoomTimers(room);
    rooms.delete(room.roomId);
    return;
  }
  room.hostPlayerId = room.members[0].playerId;
  broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
}

function explicitLeaveRoom(ws: WebSocket): void {
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
    broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
    return;
  }

  const leaving = room.members.find((m) => m.playerId === idInfo.playerId);
  if (leaving) {
    leaving.ws = null;
    leaving.connected = false;
  }

  if (room.phase === 'Launch' || room.phase === 'Combat') {
    const remaining = room.members.find((m) => m.playerId !== idInfo.playerId && m.connected);
    if (remaining) {
      finalizeMatchFromRoom(room, remaining.playerId, 'Survival');
      sendJson(remaining.ws, {
        type: 'opponent_disconnected',
        roomId: room.roomId,
        remainingWinnerId: remaining.playerId,
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
  broadcastRoom(room, { type: 'room_update', room: serializeRoom(room) });
}

function startSynchronizedLaunch(room: OnlineRoom): void {
  if (room.members.length < 2) return;
  clearRoomTimers(room);
  room.phase = 'Launch';

  const hostMember = room.members.find((m) => m.playerId === room.hostPlayerId) ?? room.members[0];
  const guestMember = room.members.find((m) => m.playerId !== hostMember.playerId) ?? room.members[1];

  const hostDef = clampLaunchAngleToSide(
    PLAYER_LAUNCH_SPAWN.x,
    PLAYER_LAUNCH_SPAWN.z,
    0,
    0,
    'right'
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
    'left'
  );
  guestMember.launchPower = null;
  guestMember.launchAngle = null;
  guestMember.launchTargetX = guestDef.targetX;
  guestMember.launchTargetZ = guestDef.targetZ;
  guestMember.launchPerfect = false;

  broadcastRoom(room, {
    type: 'launch_phase_start',
    roomId: room.roomId,
    arenaId: room.arenaId,
    countdownSec: 5.0,
    room: serializeRoom(room),
  });

  room.launchTimer = setTimeout(() => {
    finalizeSynchronizedLaunch(room);
  }, 5100);
}

export function finalizeSynchronizedLaunch(room: OnlineRoom): void {
  if (room.phase !== 'Launch') return;
  if (room.launchTimer) {
    clearTimeout(room.launchTimer);
    room.launchTimer = null;
  }

  const hostMember = room.members.find((m) => m.playerId === room.hostPlayerId) ?? room.members[0];
  const guestMember = room.members.find((m) => m.playerId !== hostMember.playerId) ?? room.members[1];
  if (!hostMember || !guestMember) return;

  room.phase = 'Combat';

  const hostDefault = clampLaunchAngleToSide(
    PLAYER_LAUNCH_SPAWN.x,
    PLAYER_LAUNCH_SPAWN.z,
    hostMember.launchTargetX,
    hostMember.launchTargetZ,
    'right'
  );
  const hostLaunch = {
    playerId: hostMember.playerId,
    powerRatio: hostMember.launchPower ?? 0.74,
    angleRad: hostMember.launchAngle ?? hostDefault.angleRad,
    targetX: hostMember.launchTargetX,
    targetZ: hostMember.launchTargetZ,
    perfect: Boolean(hostMember.launchPerfect),
  };

  const guestDefault = clampLaunchAngleToSide(
    OPPONENT_LAUNCH_SPAWN.x,
    OPPONENT_LAUNCH_SPAWN.z,
    guestMember.launchTargetX,
    guestMember.launchTargetZ,
    'left'
  );
  const guestLaunch = {
    playerId: guestMember.playerId,
    powerRatio: guestMember.launchPower ?? 0.74,
    angleRad: guestMember.launchAngle ?? guestDefault.angleRad,
    targetX: guestMember.launchTargetX,
    targetZ: guestMember.launchTargetZ,
    perfect: Boolean(guestMember.launchPerfect),
  };

  const sim = createBattleSimulation({
    battleId: `pvp-${room.roomId}-${room.createdAtMs}`,
    arenaId: room.arenaId,
    playerConfig: toTopSimConfig('player', hostMember.handle, hostMember.resolvedBuild),
    opponentConfig: toTopSimConfig('opponent', guestMember.handle, guestMember.resolvedBuild),
    aiPersonality: 'Adaptive',
    aiDifficulty: 'Normal',
    startInPhase: 'Launch',
    debugMode: false,
    isOnlineRemote: false,
    disableAi: true,
    launchHandedness: 'right',
    playerSpawn: PLAYER_LAUNCH_SPAWN,
    opponentSpawn: OPPONENT_LAUNCH_SPAWN,
    mutators: room.mutators,
  });

  applyLaunchVelocities(
    sim,
    hostLaunch.powerRatio,
    hostLaunch.angleRad,
    {
      powerRatio: guestLaunch.powerRatio,
      angleRad: guestLaunch.angleRad,
    },
    {
      allowPerfect: Boolean(hostMember.launchPerfect),
      opponentPerfect: Boolean(guestMember.launchPerfect),
    }
  );

  room.sim = sim;
  room.tickCount = 0;
  room.lastSnapshotTick = 0;
  room.lastLaunches = [hostLaunch, guestLaunch];

  broadcastRoom(room, {
    type: 'battle_start',
    roomId: room.roomId,
    arenaId: room.arenaId,
    mode: room.mode,
    launches: [hostLaunch, guestLaunch],
    room: serializeRoom(room),
  });

  // Authoritative 50Hz simulation loop with ~20Hz personalized snapshot broadcasts (every 2-3 ticks)
  room.simInterval = setInterval(() => {
    stepAuthoritativeRoomTick(room);
  }, 20);
}

export function stepAuthoritativeRoomTick(room: OnlineRoom): void {
  const sim = room.sim;
  if (!sim || room.phase !== 'Combat') return;

  const prevEventLen = sim.events.length;
  stepBattleSimulation(sim, FIXED_DT);
  room.tickCount += 1;

  const newEvents = sim.events.slice(prevEventLen);
  if (sim.events.length > 200) {
    sim.events.splice(0, sim.events.length - 100);
  }

  if (sim.phase === 'Finish' || sim.phase === 'Results') {
    const winnerMember =
      sim.winnerSide === 'player'
        ? room.members.find((m) => m.playerId === room.hostPlayerId) ?? room.members[0]
        : room.members.find((m) => m.playerId !== room.hostPlayerId) ?? room.members[1];
    const finishReason: FinishReason = sim.finishReason ?? 'SpinFinish';
    // Push one final snapshot before finalizing so clients render final burst/ring-out impact
    broadcastSnapshots(room, newEvents);
    finalizeMatchFromRoom(room, winnerMember.playerId, finishReason);
    return;
  }

  // Broadcast snapshots every 2 ticks (~25Hz) or immediately if critical events occurred
  if (newEvents.length > 0 || room.tickCount - room.lastSnapshotTick >= 2) {
    room.lastSnapshotTick = room.tickCount;
    broadcastSnapshots(room, newEvents);
  }
}

function broadcastSnapshots(room: OnlineRoom, events: BattleSimulationState['events']): void {
  const sim = room.sim;
  if (!sim) return;
  for (const m of room.members) {
    if (!m.connected || !m.ws) continue;
    const role = m.playerId === room.hostPlayerId ? 'host' : 'guest';
    const snapshot = extractAuthoritativeSnapshot(sim, room.tickCount, events, role);
    sendJson(m.ws, {
      type: 'server_snapshot',
      roomId: room.roomId,
      snapshot,
    });
  }
  if (room.spectators.length > 0) {
    const spectatorSnapshot = extractAuthoritativeSnapshot(sim, room.tickCount, events, 'host');
    for (const s of room.spectators) {
      sendJson(s.ws, {
        type: 'server_snapshot',
        roomId: room.roomId,
        snapshot: spectatorSnapshot,
      });
    }
  }
}

function tryMatchQueue(mode: 'OnlineFriendly' | 'OnlineRanked'): void {
  const q = mode === 'OnlineRanked' ? rankedQueue : friendlyQueue;
  while (q.length >= 2) {
    const p1 = q.shift()!;
    const p2 = q.shift()!;
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

    const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
    const room: OnlineRoom = {
      roomId,
      code: generateRoomCode(),
      mode,
      arenaId: p1.arenaId,
      mutators: { ...DEFAULT_BATTLE_MUTATORS },
      hostPlayerId: p1.playerId,
      phase: 'Lobby',
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
          lastAbilityAtMs: 0,
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
          lastAbilityAtMs: 0,
        },
      ],
      spectators: [],
      createdAtMs: Date.now(),
    };

    rooms.set(roomId, room);
    socketIdentity.set(p1.ws, { playerId: p1.playerId, roomId });
    socketIdentity.set(p2.ws, { playerId: p2.playerId, roomId });

    broadcastRoom(room, { type: 'match_found', room: serializeRoom(room) });
    startSynchronizedLaunch(room);
  }
}

// Background liveness heartbeat & idle room TTL reaper
let maintenanceInterval: ReturnType<typeof setInterval> | null = null;

function ensureMaintenanceTimer(): void {
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
          // ignore
        }
        continue;
      }
      aliveSockets.set(ws, false);
      try {
        ws.ping();
      } catch {
        // ignore
      }
    }

    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      if (
        (room.phase === 'Lobby' && now - room.createdAtMs > IDLE_ROOM_TTL_MS) ||
        (room.phase === 'Finished' && now - room.createdAtMs > IDLE_ROOM_TTL_MS)
      ) {
        clearRoomTimers(room);
        rooms.delete(roomId);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
  maintenanceInterval.unref();
}

export function shutdownPvpRooms(): void {
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
      ws.close(1001, 'Server shutting down');
    } catch {
      // ignore
    }
  }
  allActiveSockets.clear();
}

export function handlePvpWebSocketConnection(ws: WebSocket): void {
  ensureMaintenanceTimer();
  allActiveSockets.add(ws);
  aliveSockets.set(ws, true);

  ws.on('pong', () => {
    aliveSockets.set(ws, true);
  });

  ws.on('message', (raw) => {
    aliveSockets.set(ws, true);
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      sendJson(ws, { type: 'error', message: 'Invalid message JSON' });
      return;
    }

    const msgType = typeof msg.type === 'string' ? msg.type : '';
    if (msgType === 'ping') {
      sendJson(ws, { type: 'pong', ts: Number(msg.ts) || Date.now() });
      return;
    }

    if (msgType === 'auth') {
      const token = typeof msg.token === 'string' ? msg.token : '';
      const playerId = verifySessionToken(token);
      const commander = playerId ? getCommanderById(playerId) : null;
      if (!playerId || !commander) {
        sendJson(ws, { type: 'auth_error', message: 'Invalid or expired session token.' });
        return;
      }

      // Check if player is reconnecting to an active room within the 15s grace window
      let reattachedRoomId: string | null = null;
      for (const room of rooms.values()) {
        if (room.phase !== 'Launch' && room.phase !== 'Combat') continue;
        const member = room.members.find((m) => m.playerId === playerId);
        if (member) {
          member.ws = ws;
          member.connected = true;
          member.disconnectedAtMs = null;
          reattachedRoomId = room.roomId;
          if (room.reconnectGraceTargetId === playerId && room.reconnectTimer) {
            clearTimeout(room.reconnectTimer);
            room.reconnectTimer = null;
            room.reconnectGraceTargetId = null;
          }
          break;
        }
      }

      socketIdentity.set(ws, { playerId, roomId: reattachedRoomId });
      sendJson(ws, {
        type: 'auth_ok',
        commander: sanitizeCommanderPublic(commander),
      });

      if (reattachedRoomId) {
        const room = rooms.get(reattachedRoomId);
        if (room) {
          broadcastRoom(room, { type: 'room_rejoined', room: serializeRoom(room) });
          if (room.sim && room.phase === 'Combat') {
            const role = playerId === room.hostPlayerId ? 'host' : 'guest';
            sendJson(ws, {
              type: 'server_snapshot',
              roomId: room.roomId,
              snapshot: extractAuthoritativeSnapshot(room.sim, room.tickCount, [], role),
            });
          }
        }
      }
      return;
    }

    const identity = socketIdentity.get(ws);
    if (!identity) {
      sendJson(ws, { type: 'auth_error', message: 'Authenticate first.' });
      return;
    }

    const commander = getCommanderById(identity.playerId);
    if (!commander) return;

    if (msgType === 'queue_join') {
      explicitLeaveRoom(ws);
      const mode: 'OnlineFriendly' | 'OnlineRanked' =
        msg.mode === 'OnlineRanked' ? 'OnlineRanked' : 'OnlineFriendly';
      const arenaId = sanitizeArenaId(msg.arenaId);
      const resolvedBuild = validateAndResolveOnlineBuild(msg.build, identity.playerId);
      const targetQ = mode === 'OnlineRanked' ? rankedQueue : friendlyQueue;
      targetQ.push({ playerId: identity.playerId, ws, arenaId, resolvedBuild });
      sendJson(ws, { type: 'queue_waiting', mode, position: targetQ.length });
      tryMatchQueue(mode);
      return;
    }

    if (msgType === 'queue_leave') {
      removeFromQueues(identity.playerId);
      sendJson(ws, { type: 'queue_left' });
      return;
    }

    if (msgType === 'create_room') {
      explicitLeaveRoom(ws);
      const mode: 'OnlineFriendly' | 'OnlineRanked' =
        msg.mode === 'OnlineRanked' ? 'OnlineRanked' : 'OnlineFriendly';
      const arenaId = sanitizeArenaId(msg.arenaId);
      const mutators =
        mode === 'OnlineFriendly'
          ? sanitizeBattleMutators(msg.mutators)
          : { ...DEFAULT_BATTLE_MUTATORS };
      const resolvedBuild = validateAndResolveOnlineBuild(msg.build, identity.playerId);
      const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
      const room: OnlineRoom = {
        roomId,
        code: generateRoomCode(),
        mode,
        arenaId,
        mutators,
        hostPlayerId: identity.playerId,
        phase: 'Lobby',
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
            lastAbilityAtMs: 0,
          },
        ],
        spectators: [],
        createdAtMs: Date.now(),
      };
      rooms.set(roomId, room);
      identity.roomId = roomId;
      identity.isSpectator = false;
      sendJson(ws, { type: 'room_joined', room: serializeRoom(room) });
      return;
    }

    if (msgType === 'join_room') {
      const code = typeof msg.code === 'string' ? msg.code.trim() : '';
      const asSpectator = Boolean(msg.asSpectator);

      if (asSpectator) {
        const targetRoom = Array.from(rooms.values()).find(
          (r) => r.code === code && r.mode === 'OnlineFriendly' && r.phase !== 'Finished'
        );
        if (!targetRoom) {
          sendJson(ws, {
            type: 'error',
            message: 'Friendly room not found or already finished for spectating.',
          });
          return;
        }
        if (targetRoom.members.some((m) => m.playerId === identity.playerId)) {
          sendJson(ws, {
            type: 'error',
            message: 'You are already a combatant in this room.',
          });
          return;
        }
        if (targetRoom.spectators.length >= MAX_SPECTATORS_PER_ROOM) {
          sendJson(ws, {
            type: 'error',
            message: 'Spectator capacity reached for this room.',
          });
          return;
        }
        explicitLeaveRoom(ws);
        targetRoom.spectators = targetRoom.spectators.filter(
          (s) => s.playerId !== identity.playerId
        );
        targetRoom.spectators.push({
          playerId: identity.playerId,
          handle: commander.handle,
          ws,
          joinedAtMs: Date.now(),
        });
        identity.roomId = targetRoom.roomId;
        identity.isSpectator = true;

        sendJson(ws, {
          type: 'room_joined',
          room: serializeRoom(targetRoom),
          asSpectator: true,
        });
        broadcastRoom(targetRoom, {
          type: 'room_update',
          room: serializeRoom(targetRoom),
        });

        if (targetRoom.phase === 'Launch') {
          sendJson(ws, {
            type: 'launch_phase_start',
            roomId: targetRoom.roomId,
            arenaId: targetRoom.arenaId,
            countdownSec: 5.0,
            room: serializeRoom(targetRoom),
            asSpectator: true,
          });
        } else if (targetRoom.phase === 'Combat' && targetRoom.sim) {
          sendJson(ws, {
            type: 'battle_start',
            roomId: targetRoom.roomId,
            arenaId: targetRoom.arenaId,
            mode: targetRoom.mode,
            launches: targetRoom.lastLaunches ?? [],
            room: serializeRoom(targetRoom),
            asSpectator: true,
          });
          sendJson(ws, {
            type: 'server_snapshot',
            roomId: targetRoom.roomId,
            snapshot: extractAuthoritativeSnapshot(
              targetRoom.sim,
              targetRoom.tickCount,
              [],
              'host'
            ),
          });
        }
        return;
      }

      const targetRoom = Array.from(rooms.values()).find(
        (r) => r.code === code && r.phase === 'Lobby' && r.members.length < 2
      );
      if (!targetRoom) {
        sendJson(ws, { type: 'error', message: 'Room code not found or room already full.' });
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
        lastAbilityAtMs: 0,
      });
      identity.roomId = targetRoom.roomId;
      identity.isSpectator = false;
      broadcastRoom(targetRoom, { type: 'room_joined', room: serializeRoom(targetRoom) });
      return;
    }

    if (msgType === 'leave_room') {
      explicitLeaveRoom(ws);
      return;
    }

    const room = identity.roomId ? rooms.get(identity.roomId) : undefined;
    if (!room || identity.isSpectator) return;
    const member = room.members.find((m) => m.playerId === identity.playerId);
    if (!member) return;

    if (msgType === 'start_room_match' && room.hostPlayerId === identity.playerId) {
      if (room.members.length === 2) {
        startSynchronizedLaunch(room);
      }
      return;
    }

    if (msgType === 'launch_aim' && room.phase === 'Launch') {
      const isHost = member.playerId === room.hostPlayerId;
      const spawn = isHost ? PLAYER_LAUNCH_SPAWN : OPPONENT_LAUNCH_SPAWN;
      const handedness = isHost ? 'right' : 'left';
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

    if (msgType === 'launch_commit' && room.phase === 'Launch') {
      const isHost = member.playerId === room.hostPlayerId;
      const spawn = isHost ? PLAYER_LAUNCH_SPAWN : OPPONENT_LAUNCH_SPAWN;
      const handedness = isHost ? 'right' : 'left';
      const power = Math.max(0.15, Math.min(1.0, Number(msg.powerRatio) || 0.72));
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
        type: 'launch_player_locked',
        playerId: member.playerId,
        perfect: member.launchPerfect,
      });
      if (room.members.every((m) => m.launchPower !== null)) {
        finalizeSynchronizedLaunch(room);
      }
      return;
    }

    if (msgType === 'ability_use' && room.phase === 'Combat' && room.sim) {
      const slotIndex = Math.max(0, Math.min(3, Math.floor(Number(msg.slotIndex) || 0)));
      const now = Date.now();
      if (now - member.lastAbilityAtMs < 650) return;
      const side = member.playerId === room.hostPlayerId ? 'player' : 'opponent';
      const activated = activateAbility(room.sim, side, slotIndex);
      if (activated) {
        member.lastAbilityAtMs = now;
        broadcastRoom(room, {
          type: 'remote_ability',
          playerId: member.playerId,
          slotIndex,
        });
      }
      return;
    }
  });

  ws.on('close', () => {
    allActiveSockets.delete(ws);
    handleDisconnectFromRoom(ws);
  });
}

// Exported helper for automated authoritative match testing
export function createTestAuthoritativeRoom(params: {
  p1Id: string;
  p2Id: string;
  mode: 'OnlineFriendly' | 'OnlineRanked';
  arenaId: ArenaId;
  mutators?: Partial<BattleMutators>;
  p1LaunchPower?: number;
  p2LaunchPower?: number;
}): OnlineRoom {
  const c1 = getCommanderById(params.p1Id);
  const c2 = getCommanderById(params.p2Id);
  if (!c1 || !c2) throw new Error('Test commanders not found');
  const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
  const p1Power = params.p1LaunchPower ?? 0.9;
  const p2Power = params.p2LaunchPower ?? 0.85;
  const mutators =
    params.mode === 'OnlineFriendly'
      ? sanitizeBattleMutators(params.mutators)
      : { ...DEFAULT_BATTLE_MUTATORS };
  const room: OnlineRoom = {
    roomId,
    code: generateRoomCode(),
    mode: params.mode,
    arenaId: params.arenaId,
    mutators,
    hostPlayerId: params.p1Id,
    phase: 'Launch',
    launchTimer: null,
    simInterval: null,
    reconnectTimer: null,
    reconnectGraceTargetId: null,
    sim: null,
    tickCount: 0,
    lastSnapshotTick: 0,
    members: [
      {
        playerId: params.p1Id,
        handle: c1.handle,
        mmr: c1.mmr,
        ws: null,
        connected: false,
        disconnectedAtMs: null,
        resolvedBuild: validateAndResolveOnlineBuild({}, params.p1Id),
        ready: true,
        launchPower: p1Power,
        launchAngle: -0.25,
        launchTargetX: 0.4,
        launchTargetZ: 0.4,
        launchPerfect: isPowerInPerfectWindow(p1Power),
        lastAbilityAtMs: 0,
      },
      {
        playerId: params.p2Id,
        handle: c2.handle,
        mmr: c2.mmr,
        ws: null,
        connected: false,
        disconnectedAtMs: null,
        resolvedBuild: validateAndResolveOnlineBuild({}, params.p2Id),
        ready: true,
        launchPower: p2Power,
        launchAngle: -1.1,
        launchTargetX: -0.4,
        launchTargetZ: -0.4,
        launchPerfect: isPowerInPerfectWindow(p2Power),
        lastAbilityAtMs: 0,
      },
    ],
    spectators: [],
    createdAtMs: Date.now(),
  };
  return room;
}

export function getOnlineLobbySummary() {
  const openRooms = Array.from(rooms.values())
    .filter((r) => r.phase === 'Lobby' && r.members.length < 2)
    .map((r) => ({
      roomId: r.roomId,
      code: r.code,
      mode: r.mode,
      arenaId: r.arenaId,
      hostHandle: r.members[0]?.handle ?? 'Commander',
      hostMmr: r.members[0]?.mmr ?? 1000,
      mutators: r.mutators,
      spectatorCount: r.spectators.length,
    }));
  const spectatableRooms = Array.from(rooms.values())
    .filter(
      (r) =>
        r.mode === 'OnlineFriendly' &&
        r.members.length === 2 &&
        r.phase !== 'Finished' &&
        r.spectators.length < MAX_SPECTATORS_PER_ROOM
    )
    .map((r) => ({
      roomId: r.roomId,
      code: r.code,
      arenaId: r.arenaId,
      phase: r.phase,
      p1Handle: r.members[0]?.handle ?? 'P1',
      p2Handle: r.members[1]?.handle ?? 'P2',
      spectatorCount: r.spectators.length,
      mutators: r.mutators,
    }));
  return {
    activeRooms: rooms.size,
    openRooms,
    spectatableRooms,
    friendlyQueueSize: friendlyQueue.length,
    rankedQueueSize: rankedQueue.length,
  };
}
