import type {
  ArenaId,
  BattleAnalysisReport,
  BattleMutators,
  CharacterAppearance,
  CosmeticCustomization,
  FinishReason,
  MatchHighlightClip,
  OwnedTopState,
  PlayerSaveData,
  RankTierDefinition,
  RankTierId,
  SeasonInfo,
  ShadowOpponentProfile,
} from '../domain/types';
import type { AuthCombatSnapshot } from '../simulation/physicsEngine';

export interface OnlineCommanderPublic {
  playerId: string;
  handle: string;
  title: string;
  mmr: number;
  wins: number;
  losses: number;
  bestScore: number;
  seasonScore: number;
  secretsFound: number;
  endingBadge: string;
  appearance: CharacterAppearance;
  updatedAtMs: number;
}

export interface OnlinePlayerBuildPayload {
  topDefinitionId: string;
  level: number;
  secondaryElement: string | null;
  equippedComponents: Record<string, string>;
  equippedAbilities: [string, string, string, string];
  evolutionStage: number;
  evolutionPathId: string | null;
  cosmetics?: CosmeticCustomization;
}

export interface OnlineRoomMemberView {
  playerId: string;
  handle: string;
  mmr: number;
  ready: boolean;
  connected?: boolean;
  build: OnlinePlayerBuildPayload;
  appearance?: CharacterAppearance;
  launchLocked: boolean;
}

export interface OnlineRoomView {
  roomId: string;
  code: string;
  mode: 'OnlineFriendly' | 'OnlineRanked';
  arenaId: ArenaId;
  mutators?: BattleMutators;
  hostPlayerId: string;
  phase: 'Lobby' | 'Launch' | 'Combat' | 'Finished';
  spectatorCount?: number;
  spectators?: Array<{ playerId: string; handle: string }>;
  members: OnlineRoomMemberView[];
}

export interface OpenRoomListing {
  roomId: string;
  code: string;
  mode: 'OnlineFriendly' | 'OnlineRanked';
  arenaId: ArenaId;
  hostHandle: string;
  hostMmr: number;
  mutators?: BattleMutators;
  spectatorCount?: number;
}

export interface SpectatableRoomListing {
  roomId: string;
  code: string;
  arenaId: ArenaId;
  phase: 'Lobby' | 'Launch' | 'Combat';
  p1Handle: string;
  p2Handle: string;
  spectatorCount: number;
  mutators?: BattleMutators;
}

export interface OnlineLobbySummary {
  activeRooms: number;
  openRooms: OpenRoomListing[];
  spectatableRooms?: SpectatableRoomListing[];
  friendlyQueueSize: number;
  rankedQueueSize: number;
}

export interface SyncedLaunchEntry {
  playerId: string;
  powerRatio: number;
  angleRad: number;
  targetX: number;
  targetZ: number;
  perfect?: boolean;
}

export type PvPServerMessage =
  | { type: 'auth_ok'; commander: OnlineCommanderPublic }
  | { type: 'auth_error'; message: string }
  | { type: 'error'; message: string }
  | { type: 'pong'; ts: number }
  | { type: 'queue_waiting'; mode: 'OnlineFriendly' | 'OnlineRanked'; position: number }
  | { type: 'queue_left' }
  | { type: 'match_found'; room: OnlineRoomView }
  | { type: 'room_joined'; room: OnlineRoomView; asSpectator?: boolean }
  | { type: 'room_rejoined'; room: OnlineRoomView }
  | { type: 'room_update'; room: OnlineRoomView }
  | {
      type: 'launch_phase_start';
      roomId: string;
      arenaId: ArenaId;
      countdownSec: number;
      room: OnlineRoomView;
      asSpectator?: boolean;
    }
  | { type: 'launch_player_locked'; playerId: string; perfect?: boolean }
  | {
      type: 'battle_start';
      roomId: string;
      arenaId: ArenaId;
      mode: 'OnlineFriendly' | 'OnlineRanked';
      launches: SyncedLaunchEntry[];
      room: OnlineRoomView;
      asSpectator?: boolean;
    }
  | { type: 'remote_ability'; playerId: string; slotIndex: number }
  | { type: 'server_snapshot'; roomId: string; snapshot: AuthCombatSnapshot }
  | {
      type: 'opponent_reconnecting';
      roomId: string;
      disconnectedPlayerId: string;
      graceSec: number;
    }
  | {
      type: 'match_finalized';
      roomId: string;
      winnerId: string;
      finishReason: FinishReason;
      mmrDelta: number;
      commanders?: OnlineCommanderPublic[];
      highlights?: MatchHighlightClip;
      analysis?: BattleAnalysisReport;
      asSpectator?: boolean;
    }
  | { type: 'opponent_disconnected'; roomId: string; remainingWinnerId: string };

const GUEST_PROOF_PREFIX = 'sl_guest_proof_';

// Session Bearer token lives strictly in JS memory (never localStorage/sessionStorage)
let memoryToken: string | null = null;
let memoryCommander: OnlineCommanderPublic | null = null;

function readGuestProof(playerId?: string): string | undefined {
  if (!playerId) return undefined;
  try {
    return localStorage.getItem(`${GUEST_PROOF_PREFIX}${playerId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeGuestProof(playerId: string, secret: string): void {
  try {
    localStorage.setItem(`${GUEST_PROOF_PREFIX}${playerId}`, secret);
  } catch {
    // ignore storage errors in restricted environments
  }
}

export function getOnlineSessionState(): {
  authenticated: boolean;
  token: string | null;
  commander: OnlineCommanderPublic | null;
} {
  return {
    authenticated: Boolean(memoryToken && memoryCommander),
    token: memoryToken,
    commander: memoryCommander,
  };
}

export function clearOnlineSession(): void {
  memoryToken = null;
  memoryCommander = null;
}

export function buildOnlinePayloadFromTop(top: OwnedTopState): OnlinePlayerBuildPayload {
  return {
    topDefinitionId: top.definitionId,
    level: top.level,
    secondaryElement: top.secondaryElement,
    equippedComponents: { ...top.equippedComponents },
    equippedAbilities: [...top.equippedAbilities] as [string, string, string, string],
    evolutionStage: top.evolutionStage,
    evolutionPathId: top.evolutionPathId,
    cosmetics: top.cosmetics ? { ...top.cosmetics } : undefined,
  };
}

export async function authenticateOnlineSession(params: {
  mode: 'guest' | 'register' | 'login';
  handle: string;
  passcode?: string;
  title?: string;
  appearance?: CharacterAppearance;
  existingPlayerId?: string;
}): Promise<{ commander: OnlineCommanderPublic | null; error?: string }> {
  try {
    const guestSecret =
      params.mode === 'guest' ? readGuestProof(params.existingPlayerId) : undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (memoryToken) {
      headers.Authorization = `Bearer ${memoryToken}`;
    }

    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode: params.mode,
        handle: params.handle,
        passcode: params.passcode,
        title: params.title,
        appearance: params.appearance,
        playerId: params.existingPlayerId,
        guestSecret,
      }),
    });
    const data = (await res.json()) as {
      token?: string;
      guestSecret?: string;
      commander?: OnlineCommanderPublic;
      error?: string;
    };
    if (!res.ok || !data.token || !data.commander) {
      return { commander: null, error: data.error ?? 'Authentication failed.' };
    }
    memoryToken = data.token;
    memoryCommander = data.commander;
    if (data.guestSecret && params.mode === 'guest') {
      storeGuestProof(data.commander.playerId, data.guestSecret);
    }
    return { commander: data.commander };
  } catch {
    return { commander: null, error: 'Unable to reach Arena server.' };
  }
}

export async function fetchOnlineLeaderboard(
  season: 'current' | 'all'
): Promise<{ entries: OnlineCommanderPublic[]; seasonInfo?: SeasonInfo; error?: string }> {
  try {
    const res = await fetch(`/api/leaderboard?season=${season}`);
    const data = (await res.json()) as {
      entries?: OnlineCommanderPublic[];
      seasonInfo?: SeasonInfo;
      error?: string;
    };
    if (!res.ok || !Array.isArray(data.entries)) {
      return { entries: [], error: data.error ?? 'Failed to load leaderboard.' };
    }
    return { entries: data.entries, seasonInfo: data.seasonInfo };
  } catch {
    return { entries: [], error: 'Network error fetching leaderboard.' };
  }
}

export async function fetchOnlineLobbySummary(): Promise<{
  summary: OnlineLobbySummary | null;
  error?: string;
}> {
  try {
    const res = await fetch('/api/rooms');
    const data = (await res.json()) as OnlineLobbySummary & { error?: string };
    if (!res.ok) return { summary: null, error: data.error ?? 'Failed to fetch rooms.' };
    return { summary: data };
  } catch {
    return { summary: null, error: 'Unable to connect to lobby server.' };
  }
}

export async function fetchSeasonInfo(): Promise<{
  season: SeasonInfo | null;
  tiers: RankTierDefinition[];
  claimedTiers: RankTierId[];
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;
    const res = await fetch('/api/season', { headers });
    const data = (await res.json()) as {
      season?: SeasonInfo;
      tiers?: RankTierDefinition[];
      claimedTiers?: RankTierId[];
      error?: string;
    };
    if (!res.ok || !data.season) {
      return { season: null, tiers: [], claimedTiers: [], error: data.error ?? 'Failed to load season.' };
    }
    return {
      season: data.season,
      tiers: Array.isArray(data.tiers) ? data.tiers : [],
      claimedTiers: Array.isArray(data.claimedTiers) ? data.claimedTiers : [],
    };
  } catch {
    return { season: null, tiers: [], claimedTiers: [], error: 'Network error fetching season.' };
  }
}

export async function claimSeasonTierReward(tierId: RankTierId): Promise<{
  ok: boolean;
  seasonNumber?: number;
  tier?: RankTierDefinition;
  claimedTiers?: RankTierId[];
  error?: string;
}> {
  if (!memoryToken) return { ok: false, error: 'Sign in first to claim Season Rewards.' };
  try {
    const res = await fetch('/api/season/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memoryToken}`,
      },
      body: JSON.stringify({ tierId }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      seasonNumber?: number;
      tier?: RankTierDefinition;
      claimedTiers?: RankTierId[];
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Unable to claim reward.' };
    }
    return {
      ok: true,
      seasonNumber: data.seasonNumber,
      tier: data.tier,
      claimedTiers: data.claimedTiers,
    };
  } catch {
    return { ok: false, error: 'Network error claiming season reward.' };
  }
}

export async function fetchShadowOpponents(): Promise<{
  opponents: ShadowOpponentProfile[];
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;
    const res = await fetch('/api/shadow-opponents', { headers });
    const data = (await res.json()) as {
      opponents?: ShadowOpponentProfile[];
      error?: string;
    };
    if (!res.ok || !Array.isArray(data.opponents)) {
      return { opponents: [], error: data.error ?? 'Failed to fetch Shadow Opponents.' };
    }
    return { opponents: data.opponents };
  } catch {
    return { opponents: [], error: 'Network error fetching Shadow Opponents.' };
  }
}

export async function uploadCloudSave(save: PlayerSaveData): Promise<{
  ok: boolean;
  commander?: OnlineCommanderPublic;
  error?: string;
}> {
  if (!memoryToken) return { ok: false, error: 'Sign in first to sync Cloud Save.' };
  try {
    const res = await fetch('/api/save', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memoryToken}`,
      },
      body: JSON.stringify({ save }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      commander?: OnlineCommanderPublic;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? 'Cloud save upload failed.' };
    }
    if (data.commander) memoryCommander = data.commander;
    return { ok: true, commander: data.commander };
  } catch {
    return { ok: false, error: 'Network error during Cloud Save upload.' };
  }
}

export async function downloadCloudSave(): Promise<{
  save: PlayerSaveData | null;
  commander?: OnlineCommanderPublic;
  error?: string;
}> {
  if (!memoryToken) return { save: null, error: 'Sign in first to download Cloud Save.' };
  try {
    const res = await fetch('/api/save', {
      headers: {
        Authorization: `Bearer ${memoryToken}`,
      },
    });
    const data = (await res.json()) as {
      save?: PlayerSaveData | null;
      commander?: OnlineCommanderPublic;
      error?: string;
    };
    if (!res.ok) return { save: null, error: data.error ?? 'Cloud save download failed.' };
    if (data.commander) memoryCommander = data.commander;
    return { save: data.save ?? null, commander: data.commander };
  } catch {
    return { save: null, error: 'Network error during Cloud Save download.' };
  }
}

export class OnlinePvpClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(msg: PvPServerMessage) => void>();
  private authenticated = false;
  private rttMs: number | null = null;
  private rttTimer: number | null = null;

  subscribe(fn: (msg: PvPServerMessage) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(msg: PvPServerMessage): void {
    for (const fn of this.listeners) {
      fn(msg);
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.authenticated;
  }

  getRttMs(): number | null {
    return this.rttMs;
  }

  private startRttLoop(): void {
    this.stopRttLoop();
    const sendPing = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    };
    sendPing();
    this.rttTimer = window.setInterval(sendPing, 5000);
  }

  private stopRttLoop(): void {
    if (this.rttTimer !== null) {
      clearInterval(this.rttTimer);
      this.rttTimer = null;
    }
  }

  connect(): Promise<boolean> {
    if (!memoryToken) return Promise.resolve(false);
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
      return Promise.resolve(true);
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.authenticated = false;
    this.rttMs = null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    return new Promise((resolve) => {
      let settled = false;
      const ws = new WebSocket(url);
      this.ws = ws;

      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };

      ws.onopen = () => {
        if (!memoryToken) {
          finish(false);
          return;
        }
        ws.send(JSON.stringify({ type: 'auth', token: memoryToken }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as PvPServerMessage;
          if (msg.type === 'pong') {
            this.rttMs = Math.max(1, Math.round(Date.now() - msg.ts));
          } else if (msg.type === 'auth_ok') {
            this.authenticated = true;
            memoryCommander = msg.commander;
            this.startRttLoop();
            finish(true);
          } else if (msg.type === 'auth_error') {
            this.authenticated = false;
            finish(false);
          } else if (msg.type === 'match_finalized' && Array.isArray(msg.commanders) && memoryCommander) {
            const updated = msg.commanders.find((c) => c.playerId === memoryCommander?.playerId);
            if (updated) memoryCommander = updated;
          }
          this.emit(msg);
        } catch {
          // ignore malformed packet
        }
      };

      ws.onerror = () => {
        this.authenticated = false;
        this.stopRttLoop();
        finish(false);
      };

      ws.onclose = () => {
        this.authenticated = false;
        this.stopRttLoop();
        if (this.ws === ws) this.ws = null;
        finish(false);
      };
    });
  }

  disconnect(): void {
    this.stopRttLoop();
    this.rttMs = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.authenticated = false;
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  joinQueue(mode: 'OnlineFriendly' | 'OnlineRanked', arenaId: ArenaId, build: OnlinePlayerBuildPayload): void {
    this.send({ type: 'queue_join', mode, arenaId, build });
  }

  leaveQueue(): void {
    this.send({ type: 'queue_leave' });
  }

  createRoom(
    mode: 'OnlineFriendly' | 'OnlineRanked',
    arenaId: ArenaId,
    build: OnlinePlayerBuildPayload,
    mutators?: BattleMutators
  ): void {
    this.send({ type: 'create_room', mode, arenaId, build, mutators });
  }

  joinRoom(
    code: string,
    build: OnlinePlayerBuildPayload,
    options?: { asSpectator?: boolean }
  ): void {
    this.send({ type: 'join_room', code, build, asSpectator: Boolean(options?.asSpectator) });
  }

  leaveRoom(): void {
    this.send({ type: 'leave_room' });
  }

  startRoomMatch(): void {
    this.send({ type: 'start_room_match' });
  }

  sendLaunchAim(targetX: number, targetZ: number): void {
    this.send({ type: 'launch_aim', targetX, targetZ });
  }

  sendLaunchCommit(powerRatio: number, angleRad: number): void {
    this.send({ type: 'launch_commit', powerRatio, angleRad });
  }

  sendAbilityUse(slotIndex: number): void {
    this.send({ type: 'ability_use', slotIndex });
  }
}

export const onlinePvpClient = new OnlinePvpClient();
