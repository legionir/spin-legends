import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ELEMENTS, OPPONENTS, getTopDefinition } from '../domain/catalog.ts';
import {
  RANK_TIERS,
  applySeasonSoftReset,
  buildSeededShadowOpponents,
  createDefaultCosmetics,
  getRankTierForMmr,
  inferAiPersonalityFromBuild,
} from '../domain/rules.ts';
import { sanitizeAndMigrateSave } from '../domain/saveValidation.ts';
import type {
  ArenaId,
  CharacterAppearance,
  FinishReason,
  MatchMode,
  PlayerSaveData,
  RankTierDefinition,
  RankTierId,
  SeasonInfo,
  ShadowOpponentProfile,
} from '../domain/types.ts';

export interface StoredCommander {
  playerId: string;
  handle: string;
  title: string;
  passcodeHash?: string;
  guestSecretHash?: string;
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

export interface StoredOnlineMatch {
  id: string;
  roomCode?: string;
  mode: MatchMode;
  arenaId: ArenaId;
  p1Id: string;
  p2Id: string;
  winnerId: string;
  finishReason: FinishReason;
  durationSec: number;
  mmrDelta: number;
  createdAtMs: number;
}

interface LegacyStoreSchema {
  commanders?: Record<string, StoredCommander>;
  cloudSaves?: Record<string, PlayerSaveData>;
  matches?: StoredOnlineMatch[];
}

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'spin-legends.db');
const LEGACY_JSON_PATH = path.resolve(process.cwd(), 'data', 'spin-legends-store.json');

const SEED_RIVALS: StoredCommander[] = [
  {
    playerId: 'rival-valkyrie',
    handle: 'valkyrie_prime',
    title: 'Grand Champion',
    mmr: 1480,
    wins: 42,
    losses: 9,
    bestScore: 5420,
    seasonScore: 5420,
    secretsFound: 4,
    endingBadge: 'LEGEND',
    appearance: {
      hairStyle: 'sleek',
      hairColor: '#a855f7',
      outfitColor: '#0f172a',
      accentColor: '#38bdf8',
    },
    updatedAtMs: Date.now() - 3600_000,
  },
  {
    playerId: 'rival-kael',
    handle: 'kael_vanguard',
    title: 'Solaris Duelist',
    mmr: 1340,
    wins: 31,
    losses: 12,
    bestScore: 4180,
    seasonScore: 3920,
    secretsFound: 3,
    endingBadge: 'GOOD',
    appearance: {
      hairStyle: 'spiky',
      hairColor: '#facc15',
      outfitColor: '#7c2d12',
      accentColor: '#f97316',
    },
    updatedAtMs: Date.now() - 7200_000,
  },
  {
    playerId: 'rival-noctis',
    handle: 'lady_noctis',
    title: 'Umbra Sovereign',
    mmr: 1265,
    wins: 27,
    losses: 14,
    bestScore: 3690,
    seasonScore: 3690,
    secretsFound: 3,
    endingBadge: 'BAD',
    appearance: {
      hairStyle: 'visor',
      hairColor: '#e879f9',
      outfitColor: '#3b0764',
      accentColor: '#f43f5e',
    },
    updatedAtMs: Date.now() - 10800_000,
  },
];

let dbInstance: DatabaseSync | null = null;
let cachedSessionSecret: string | null = null;

function resolveDbPath(): string {
  return process.env.SPIN_LEGENDS_DB_PATH?.trim() || DEFAULT_DB_PATH;
}

function openSqliteDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:') {
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

function insertCommanderRow(db: DatabaseSync, c: StoredCommander): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO commanders (
      player_id, handle, handle_lower, title, passcode_hash, guest_secret_hash,
      mmr, wins, losses, best_score, season_score, secrets_found, ending_badge,
      appearance_json, updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const baseHandleLower = (c.handle.trim() || c.playerId).toLowerCase();
  const handleExists = db
    .prepare('SELECT 1 FROM commanders WHERE handle_lower = ?')
    .get(baseHandleLower);
  const safeHandleLower = handleExists
    ? `${baseHandleLower}_${c.playerId.slice(-6).toLowerCase()}`
    : baseHandleLower;

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

function bootstrapAndMigrateIfEmpty(db: DatabaseSync, dbPath: string): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM commanders').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  // Attempt one-time migration from legacy JSON file when using the default DB file
  if (dbPath === DEFAULT_DB_PATH && fs.existsSync(LEGACY_JSON_PATH)) {
    try {
      const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
      const parsed = JSON.parse(raw) as LegacyStoreSchema;
      if (parsed && typeof parsed === 'object' && parsed.commanders) {
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const c of Object.values(parsed.commanders)) {
            if (c && typeof c.playerId === 'string') {
              insertCommanderRow(db, c);
            }
          }
          if (parsed.cloudSaves && typeof parsed.cloudSaves === 'object') {
            const saveStmt = db.prepare(`
              INSERT OR REPLACE INTO cloud_saves (commander_id, save_json, player_score, updated_at_ms)
              VALUES (?, ?, ?, ?)
            `);
            for (const [pid, rawSave] of Object.entries(parsed.cloudSaves)) {
              const sanitized = sanitizeAndMigrateSave(rawSave);
              if (sanitized && db.prepare('SELECT 1 FROM commanders WHERE player_id = ?').get(pid)) {
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
              if (m && typeof m.id === 'string') {
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
          db.exec('COMMIT');
          try {
            fs.renameSync(LEGACY_JSON_PATH, `${LEGACY_JSON_PATH}.migrated.bak`);
          } catch {
            // non-fatal
          }
          const postCount = db.prepare('SELECT COUNT(*) as cnt FROM commanders').get() as { cnt: number };
          if (postCount.cnt > 0) return;
        } catch {
          db.exec('ROLLBACK');
        }
      }
    } catch {
      // Fallback to seeded rivals below
    }
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const c of SEED_RIVALS) {
      insertCommanderRow(db, c);
    }
    db.exec('COMMIT');
  } catch {
    db.exec('ROLLBACK');
  }
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (cachedSessionSecret) return cachedSessionSecret;

  const db = openSqliteDb();
  const row = db
    .prepare("SELECT value FROM server_meta WHERE key = 'session_secret'")
    .get() as { value?: string } | undefined;
  if (row?.value && row.value.length >= 32) {
    cachedSessionSecret = row.value;
    return row.value;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT OR REPLACE INTO server_meta (key, value) VALUES ('session_secret', ?)").run(
    generated
  );
  cachedSessionSecret = generated;
  return generated;
}

function rowToCommander(row: Record<string, unknown> | undefined): StoredCommander | null {
  if (!row) return null;
  let appearance: CharacterAppearance = {
    hairStyle: 'spiky',
    hairColor: '#38bdf8',
    outfitColor: '#0f172a',
    accentColor: '#f59e0b',
  };
  try {
    const parsed = JSON.parse(String(row.appearance_json ?? '{}')) as Partial<CharacterAppearance>;
    appearance = { ...appearance, ...parsed };
  } catch {
    // keep default
  }
  return {
    playerId: String(row.player_id),
    handle: String(row.handle),
    title: String(row.title),
    passcodeHash: row.passcode_hash ? String(row.passcode_hash) : undefined,
    guestSecretHash: row.guest_secret_hash ? String(row.guest_secret_hash) : undefined,
    mmr: Number(row.mmr),
    wins: Number(row.wins),
    losses: Number(row.losses),
    bestScore: Number(row.best_score),
    seasonScore: Number(row.season_score),
    secretsFound: Number(row.secrets_found),
    endingBadge: String(row.ending_badge),
    appearance,
    updatedAtMs: Number(row.updated_at_ms),
  };
}

export function closeStore(): void {
  if (dbInstance) {
    try {
      dbInstance.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // ignore if :memory:
    }
    dbInstance.close();
    dbInstance = null;
  }
  cachedSessionSecret = null;
}

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasscode(passcode: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(passcode, salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function issueSessionToken(playerId: string): string {
  const payloadObj = {
    pid: playerId,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 3600 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');
  const a = Buffer.from(sigB64, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      pid?: string;
      exp?: number;
    };
    if (!parsed.pid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed.pid;
  } catch {
    return null;
  }
}

export function sanitizeCommanderPublic(
  c: StoredCommander
): Omit<StoredCommander, 'passcodeHash' | 'guestSecretHash'> {
  const { passcodeHash: _p, guestSecretHash: _g, ...pub } = c;
  return pub;
}

export function getCommanderById(playerId: string): StoredCommander | null {
  const db = openSqliteDb();
  const row = db
    .prepare('SELECT * FROM commanders WHERE player_id = ?')
    .get(playerId) as Record<string, unknown> | undefined;
  return rowToCommander(row);
}

export function findCommanderByHandle(handle: string): StoredCommander | null {
  const db = openSqliteDb();
  const target = handle.trim().toLowerCase();
  const row = db
    .prepare('SELECT * FROM commanders WHERE handle_lower = ?')
    .get(target) as Record<string, unknown> | undefined;
  return rowToCommander(row);
}

export function registerOrUpdateGuestCommander(params: {
  playerId?: string;
  guestSecret?: string;
  authenticatedPlayerId?: string | null;
  handle: string;
  title: string;
  appearance: CharacterAppearance;
}): { commander: StoredCommander; guestSecret?: string } {
  const db = openSqliteDb();
  const cleanHandle = params.handle.trim().slice(0, 24) || 'Commander';
  const cleanTitle = params.title.trim().slice(0, 28) || 'Arena Challenger';
  const now = Date.now();

  const existing = params.playerId ? getCommanderById(params.playerId) : null;
  const ownsExistingGuest =
    existing &&
    !existing.passcodeHash &&
    (params.authenticatedPlayerId === existing.playerId ||
      Boolean(
        params.guestSecret &&
          existing.guestSecretHash &&
          verifyPasscode(params.guestSecret, existing.guestSecretHash)
      ));

  if (existing && ownsExistingGuest) {
    // Ensure handle uniqueness if changed
    const conflicting = db
      .prepare('SELECT player_id FROM commanders WHERE handle_lower = ? AND player_id != ?')
      .get(cleanHandle.toLowerCase(), existing.playerId);
    const handleLower = conflicting
      ? `${cleanHandle.toLowerCase()}_${existing.playerId.slice(-6).toLowerCase()}`
      : cleanHandle.toLowerCase();

    db.prepare(`
      UPDATE commanders
      SET handle = ?, handle_lower = ?, title = ?, appearance_json = ?, updated_at_ms = ?
      WHERE player_id = ?
    `).run(cleanHandle, handleLower, cleanTitle, JSON.stringify(params.appearance), now, existing.playerId);

    const updated = getCommanderById(existing.playerId)!;
    return { commander: updated };
  }

  // Create fresh guest commander with cryptographic guest proof secret
  const pid = `cmd-${crypto.randomUUID().slice(0, 8)}`;
  const freshGuestSecret = crypto.randomBytes(24).toString('base64url');
  const guestSecretHash = hashPasscode(freshGuestSecret);
  const handleTaken = db
    .prepare('SELECT 1 FROM commanders WHERE handle_lower = ?')
    .get(cleanHandle.toLowerCase());
  const safeHandleLower = handleTaken
    ? `${cleanHandle.toLowerCase()}_${pid.slice(-6).toLowerCase()}`
    : cleanHandle.toLowerCase();

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
    commander: getCommanderById(pid)!,
    guestSecret: freshGuestSecret,
  };
}

export function registerAccountCommander(params: {
  handle: string;
  passcode: string;
  title: string;
  appearance: CharacterAppearance;
}): { commander: StoredCommander | null; error?: string } {
  const db = openSqliteDb();
  const cleanHandle = params.handle.trim().slice(0, 24);
  if (cleanHandle.length < 3) {
    return { commander: null, error: 'Handle must be at least 3 characters.' };
  }
  if (params.passcode.length < 4) {
    return { commander: null, error: 'Passcode must be at least 4 characters.' };
  }
  if (findCommanderByHandle(cleanHandle)) {
    return { commander: null, error: 'Commander handle already exists. Switch to Sign In.' };
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
    params.title.trim().slice(0, 28) || 'Arena Challenger',
    hashPasscode(params.passcode),
    JSON.stringify(params.appearance),
    now
  );

  return { commander: getCommanderById(pid)! };
}

export function authenticateAccountCommander(
  handle: string,
  passcode: string
): { commander: StoredCommander | null; error?: string } {
  const found = findCommanderByHandle(handle);
  if (!found || !found.passcodeHash) {
    return { commander: null, error: 'Commander handle or passcode invalid.' };
  }
  if (!verifyPasscode(passcode, found.passcodeHash)) {
    return { commander: null, error: 'Commander handle or passcode invalid.' };
  }
  return { commander: found };
}

export function getCloudSaveForCommander(playerId: string): PlayerSaveData | null {
  const db = openSqliteDb();
  const row = db
    .prepare('SELECT save_json FROM cloud_saves WHERE commander_id = ?')
    .get(playerId) as { save_json?: string } | undefined;
  if (!row?.save_json) return null;
  try {
    return sanitizeAndMigrateSave(JSON.parse(row.save_json));
  } catch {
    return null;
  }
}

export function saveCloudProfileForCommander(
  playerId: string,
  rawSave: unknown
): { commander: StoredCommander | null; error?: string } {
  const db = openSqliteDb();
  const cmd = getCommanderById(playerId);
  if (!cmd) return { commander: null, error: 'Commander not found.' };

  const sanitized = sanitizeAndMigrateSave(rawSave);
  if (!sanitized) {
    return { commander: null, error: 'Invalid cloud save schema.' };
  }

  // Anti-cheat progression sanity bounds
  const prevSave = getCloudSaveForCommander(playerId);
  if (prevSave) {
    const scoreJump = sanitized.playerScore - prevSave.playerScore;
    const goldJump = sanitized.currencies.gold - prevSave.currencies.gold;
    const evoJump = sanitized.currencies.evolutionTokens - prevSave.currencies.evolutionTokens;
    const fragJump =
      sanitized.currencies.legendaryFragments - prevSave.currencies.legendaryFragments;
    if (scoreJump > 30_000 || goldJump > 25_000 || evoJump > 25 || fragJump > 50) {
      return {
        commander: null,
        error: 'Cloud save rejected: progression delta exceeds security bounds.',
      };
    }
  } else {
    // First upload cap to prevent injecting inflated initial saves straight onto leaderboard
    if (
      sanitized.playerScore > 50_000 ||
      sanitized.currencies.gold > 35_000 ||
      sanitized.currencies.evolutionTokens > 40
    ) {
      return {
        commander: null,
        error: 'Cloud save rejected: initial progression exceeds security bounds.',
      };
    }
  }

  const now = Date.now();
  const pinnedSave: PlayerSaveData = {
    ...sanitized,
    playerId,
    updatedAtMs: now,
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
  const nextBadge = pinnedSave.activeEndingId
    ? pinnedSave.activeEndingId.replace('ending.', '').toUpperCase()
    : cmd.endingBadge;

  const conflict = db
    .prepare('SELECT player_id FROM commanders WHERE handle_lower = ? AND player_id != ?')
    .get(nextHandle.toLowerCase(), playerId);
  const safeHandleLower = conflict
    ? `${nextHandle.toLowerCase()}_${playerId.slice(-6).toLowerCase()}`
    : nextHandle.toLowerCase();

  db.exec('BEGIN IMMEDIATE');
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
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return {
      commander: null,
      error: err instanceof Error ? err.message : 'Unable to save cloud profile.',
    };
  }

  return { commander: getCommanderById(playerId)! };
}

export function getLeaderboardList(
  season: 'current' | 'all'
): Array<Omit<StoredCommander, 'passcodeHash' | 'guestSecretHash'>> {
  const db = openSqliteDb();
  const orderCol = season === 'current' ? 'season_score' : 'best_score';
  const rows = db
    .prepare(`SELECT * FROM commanders ORDER BY mmr DESC, ${orderCol} DESC LIMIT 30`)
    .all() as Array<Record<string, unknown>>;

  return rows
    .map((r) => rowToCommander(r))
    .filter((c): c is StoredCommander => c !== null)
    .map(sanitizeCommanderPublic);
}

export function recordOnlineMatchResult(params: {
  matchId: string;
  roomCode?: string;
  mode: MatchMode;
  arenaId: ArenaId;
  p1Id: string;
  p2Id: string;
  winnerId: string;
  finishReason: FinishReason;
  durationSec?: number;
  highlightSummaryJson?: string | null;
}): { mmrDelta: number } {
  const db = openSqliteDb();
  const existing = db
    .prepare('SELECT mmr_delta FROM matches WHERE id = ?')
    .get(params.matchId) as { mmr_delta?: number } | undefined;
  if (existing && typeof existing.mmr_delta === 'number') {
    return { mmrDelta: existing.mmr_delta };
  }

  const p1 = getCommanderById(params.p1Id);
  const p2 = getCommanderById(params.p2Id);
  let mmrDelta = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    if (p1 && p2) {
      const winner = params.winnerId === p1.playerId ? p1 : p2;
      const loser = params.winnerId === p1.playerId ? p2 : p1;
      if (params.mode === 'OnlineRanked') {
        const expectedWin = 1 / (1 + Math.pow(10, (loser.mmr - winner.mmr) / 400));
        mmrDelta = Math.max(8, Math.round(32 * (1 - expectedWin)));
        winner.mmr += mmrDelta;
        loser.mmr = Math.max(400, loser.mmr - mmrDelta);
      }
      winner.wins += 1;
      loser.losses += 1;
      winner.seasonScore += params.mode === 'OnlineRanked' ? 180 : 90;
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

    db.exec('COMMIT');
  } catch {
    db.exec('ROLLBACK');
  }

  return { mmrDelta };
}

export function getStoreMetrics() {
  const db = openSqliteDb();
  const cmdRow = db.prepare('SELECT COUNT(*) as cnt FROM commanders').get() as { cnt: number };
  const matchRow = db.prepare('SELECT COUNT(*) as cnt FROM matches').get() as { cnt: number };
  return {
    totalCommanders: cmdRow.cnt,
    totalMatches: matchRow.cnt,
  };
}

const SEASON_DURATION_MS = 28 * 24 * 3600 * 1000;

function readSeasonMeta(db: DatabaseSync): {
  seasonNumber: number;
  seasonName: string;
  startedAtMs: number;
  endsAtMs: number;
} {
  const rows = db
    .prepare(
      "SELECT key, value FROM server_meta WHERE key IN ('season_number', 'season_name', 'season_started_at_ms', 'season_ends_at_ms')"
    )
    .all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const now = Date.now();
  const seasonNumber = Math.max(1, Number(map.get('season_number')) || 1);
  const seasonName = map.get('season_name') || `Season ${seasonNumber}: Genesis Vortex`;
  const startedAtMs = Number(map.get('season_started_at_ms')) || now;
  const endsAtMs = Number(map.get('season_ends_at_ms')) || startedAtMs + SEASON_DURATION_MS;

  if (!map.has('season_number') || !map.has('season_ends_at_ms')) {
    const upsert = db.prepare('INSERT OR REPLACE INTO server_meta (key, value) VALUES (?, ?)');
    upsert.run('season_number', String(seasonNumber));
    upsert.run('season_name', seasonName);
    upsert.run('season_started_at_ms', String(startedAtMs));
    upsert.run('season_ends_at_ms', String(endsAtMs));
  }

  return { seasonNumber, seasonName, startedAtMs, endsAtMs };
}

export function rolloverCompetitiveSeason(nowMs = Date.now()): SeasonInfo {
  const db = openSqliteDb();
  const prev = readSeasonMeta(db);
  const nextNumber = prev.seasonNumber + 1;
  const nextName = `Season ${nextNumber}: Ascendant Clash`;
  const nextEnd = nowMs + SEASON_DURATION_MS;

  db.exec('BEGIN IMMEDIATE');
  try {
    const upsert = db.prepare('INSERT OR REPLACE INTO server_meta (key, value) VALUES (?, ?)');
    upsert.run('season_number', String(nextNumber));
    upsert.run('season_name', nextName);
    upsert.run('season_started_at_ms', String(nowMs));
    upsert.run('season_ends_at_ms', String(nextEnd));

    const commanders = db.prepare('SELECT player_id, mmr FROM commanders').all() as Array<{
      player_id: string;
      mmr: number;
    }>;
    const updateCmd = db.prepare(
      'UPDATE commanders SET mmr = ?, season_score = 0, updated_at_ms = ? WHERE player_id = ?'
    );
    for (const c of commanders) {
      updateCmd.run(applySeasonSoftReset(Number(c.mmr)), nowMs, c.player_id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    seasonNumber: nextNumber,
    seasonName: nextName,
    startsAtMs: nowMs,
    endsAtMs: nextEnd,
    daysRemaining: Math.max(1, Math.ceil(SEASON_DURATION_MS / (24 * 3600 * 1000))),
  };
}

export function getCurrentSeasonInfo(): SeasonInfo {
  const db = openSqliteDb();
  const now = Date.now();
  const meta = readSeasonMeta(db);
  if (now >= meta.endsAtMs) {
    return rolloverCompetitiveSeason(now);
  }
  const daysRemaining = Math.max(0, Math.ceil((meta.endsAtMs - now) / (24 * 3600 * 1000)));
  return {
    seasonNumber: meta.seasonNumber,
    seasonName: meta.seasonName,
    startsAtMs: meta.startedAtMs,
    endsAtMs: meta.endsAtMs,
    daysRemaining,
  };
}

export function getClaimedSeasonTiers(playerId: string, seasonNumber?: number): RankTierId[] {
  const db = openSqliteDb();
  const activeSeason = seasonNumber ?? getCurrentSeasonInfo().seasonNumber;
  const rows = db
    .prepare(
      'SELECT tier_id FROM season_reward_claims WHERE commander_id = ? AND season_number = ?'
    )
    .all(playerId, activeSeason) as Array<{ tier_id: string }>;
  const validIds = new Set<RankTierId>(RANK_TIERS.map((t) => t.id));
  return rows
    .map((r) => r.tier_id as RankTierId)
    .filter((id) => validIds.has(id));
}

export function claimSeasonTierReward(
  playerId: string,
  tierId: RankTierId
): {
  ok: boolean;
  error?: string;
  seasonNumber: number;
  tier?: RankTierDefinition;
  claimedTiers: RankTierId[];
} {
  const db = openSqliteDb();
  const season = getCurrentSeasonInfo();
  const tier = RANK_TIERS.find((t) => t.id === tierId);
  if (!tier) {
    return {
      ok: false,
      error: 'Unknown rank tier.',
      seasonNumber: season.seasonNumber,
      claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber),
    };
  }

  const commander = getCommanderById(playerId);
  if (!commander) {
    return {
      ok: false,
      error: 'Commander not found.',
      seasonNumber: season.seasonNumber,
      claimedTiers: [],
    };
  }

  if (commander.mmr < tier.minMmr) {
    return {
      ok: false,
      error: `Requires at least ${tier.minMmr} MMR to claim ${tier.name} rewards.`,
      seasonNumber: season.seasonNumber,
      claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber),
    };
  }

  const existing = db
    .prepare(
      'SELECT 1 FROM season_reward_claims WHERE commander_id = ? AND season_number = ? AND tier_id = ?'
    )
    .get(playerId, season.seasonNumber, tierId);

  if (existing) {
    return {
      ok: false,
      error: 'Tier reward already claimed for this season.',
      seasonNumber: season.seasonNumber,
      tier,
      claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber),
    };
  }

  db.prepare(
    'INSERT INTO season_reward_claims (commander_id, season_number, tier_id, claimed_at_ms) VALUES (?, ?, ?, ?)'
  ).run(playerId, season.seasonNumber, tierId, Date.now());

  return {
    ok: true,
    seasonNumber: season.seasonNumber,
    tier,
    claimedTiers: getClaimedSeasonTiers(playerId, season.seasonNumber),
  };
}

const SEED_RIVAL_OPPONENT_MAP: Record<string, string> = {
  'rival-valkyrie': 'opp.zephyr_01',
  'rival-kael': 'opp.ignis_01',
  'rival-noctis': 'opp.shadow_01',
};

export function getShadowOpponents(excludePlayerId?: string): ShadowOpponentProfile[] {
  const db = openSqliteDb();
  const rows = db
    .prepare(
      `
      SELECT c.*, cs.save_json
      FROM commanders c
      LEFT JOIN cloud_saves cs ON cs.commander_id = c.player_id
      ORDER BY c.mmr DESC, c.season_score DESC
      LIMIT 24
    `
    )
    .all() as Array<Record<string, unknown>>;

  const profiles: ShadowOpponentProfile[] = [];
  const usedIds = new Set<string>();

  for (const row of rows) {
    const cmd = rowToCommander(row);
    if (!cmd || cmd.playerId === excludePlayerId) continue;

    let parsedSave: PlayerSaveData | null = null;
    if (typeof row.save_json === 'string' && row.save_json.length > 0) {
      try {
        parsedSave = sanitizeAndMigrateSave(JSON.parse(row.save_json));
      } catch {
        parsedSave = null;
      }
    }

    if (parsedSave && parsedSave.ownedTops.length > 0) {
      const activeTop =
        parsedSave.ownedTops.find((t) => t.instanceId === parsedSave.selectedTopInstanceId) ??
        parsedSave.ownedTops[0];
      const topDef = getTopDefinition(activeTop.definitionId);
      const aiPersonality = inferAiPersonalityFromBuild(
        activeTop.equippedComponents,
        topDef.id
      );
      const aiDifficulty =
        cmd.mmr >= 1650
          ? 'Expert'
          : cmd.mmr >= 1320
            ? 'Hard'
            : cmd.mmr >= 1020
              ? 'Normal'
              : 'Easy';

      profiles.push({
        id: `shadow-cmd-${cmd.playerId}`,
        playerId: cmd.playerId,
        handle: cmd.handle,
        title: cmd.title,
        element: topDef.element,
        secondaryElement: activeTop.secondaryElement,
        mmr: cmd.mmr,
        wins: cmd.wins,
        losses: cmd.losses,
        rankTier: getRankTierForMmr(cmd.mmr).id,
        topDefinitionId: topDef.id,
        topDisplayName: topDef.displayName,
        level: activeTop.level,
        evolutionStage: activeTop.evolutionStage,
        evolutionPathId: activeTop.evolutionPathId,
        equippedComponents: { ...activeTop.equippedComponents },
        equippedAbilities: [...activeTop.equippedAbilities],
        cosmetics: activeTop.cosmetics,
        aiPersonality,
        aiDifficulty,
        source: 'commander',
        appearance: cmd.appearance,
      });
      usedIds.add(cmd.playerId);
      continue;
    }

    // Fallback template for seeded/un-synced commanders so top leaderboard slots always have playable builds
    const mappedOppId = SEED_RIVAL_OPPONENT_MAP[cmd.playerId];
    const templateOpp =
      OPPONENTS.find((o) => o.id === mappedOppId) ??
      OPPONENTS[profiles.length % OPPONENTS.length];
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
      evolutionPathId: cmd.mmr >= 1400 ? 'evo.hybrid' : null,
      equippedComponents: { ...templateOpp.components },
      equippedAbilities: [...templateOpp.abilities],
      cosmetics: createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
      aiPersonality: inferAiPersonalityFromBuild(templateOpp.components, topDef.id),
      aiDifficulty: cmd.mmr >= 1420 ? 'Expert' : cmd.mmr >= 1200 ? 'Hard' : 'Normal',
      source: 'seed',
      appearance: cmd.appearance,
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

