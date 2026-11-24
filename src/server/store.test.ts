import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const TEST_DB_PATH = path.join(
  os.tmpdir(),
  `spin-legends-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.db`
);
process.env.SPIN_LEGENDS_DB_PATH = TEST_DB_PATH;

import { createDefaultSaveData } from '../domain/rules.ts';
import {
  createTestAuthoritativeRoom,
  finalizeSynchronizedLaunch,
  shutdownPvpRooms,
  stepAuthoritativeRoomTick,
  validateAndResolveOnlineBuild,
} from './pvpRooms.ts';
import {
  authenticateAccountCommander,
  closeStore,
  getCloudSaveForCommander,
  getLeaderboardList,
  getStoreMetrics,
  hashPasscode,
  issueSessionToken,
  recordOnlineMatchResult,
  registerAccountCommander,
  registerOrUpdateGuestCommander,
  saveCloudProfileForCommander,
  verifyPasscode,
  verifySessionToken,
} from './store.ts';

test.after(() => {
  shutdownPvpRooms();
  closeStore();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (fs.existsSync(`${TEST_DB_PATH}${suffix}`)) {
        fs.unlinkSync(`${TEST_DB_PATH}${suffix}`);
      }
    } catch {
      // ignore cleanup error
    }
  }
});

test('SQLite WAL store initializes cleanly with seeded hall of fame rivals', () => {
  const metrics = getStoreMetrics();
  assert.ok(metrics.totalCommanders >= 3);
});

test('scrypt passcode hashing and verification reject invalid passcodes', () => {
  const hash = hashPasscode('spin-secret-99');
  assert.equal(verifyPasscode('spin-secret-99', hash), true);
  assert.equal(verifyPasscode('wrong-pass', hash), false);
});

test('HMAC Bearer session tokens issue and verify cleanly and reject tampering', () => {
  const token = issueSessionToken('cmd-test-123');
  assert.equal(verifySessionToken(token), 'cmd-test-123');
  const tampered = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifySessionToken(tampered), null);
});

test('guest sessions enforce proof secret and reject account takeover without proof', () => {
  const guest1 = registerOrUpdateGuestCommander({
    handle: 'GuestOne',
    title: 'Challenger',
    appearance: {
      hairStyle: 'sleek',
      hairColor: '#38bdf8',
      outfitColor: '#0f172a',
      accentColor: '#f59e0b',
    },
  });
  assert.ok(guest1.commander.playerId);
  assert.ok(guest1.guestSecret);

  // Returning with valid proof reuses the exact guest commander
  const resumed = registerOrUpdateGuestCommander({
    playerId: guest1.commander.playerId,
    guestSecret: guest1.guestSecret,
    handle: 'GuestOne',
    title: 'Challenger',
    appearance: guest1.commander.appearance,
  });
  assert.equal(resumed.commander.playerId, guest1.commander.playerId);

  // Supplying playerId without matching guestSecret MUST NOT hijack guest1
  const spoofed = registerOrUpdateGuestCommander({
    playerId: guest1.commander.playerId,
    guestSecret: 'wrong-secret',
    handle: 'Hijacker',
    title: 'Challenger',
    appearance: guest1.commander.appearance,
  });
  assert.notEqual(spoofed.commander.playerId, guest1.commander.playerId);
});

test('commander registration, Cloud Save roundtrip, and progression delta anti-tamper guard', () => {
  const handle = `Duelist_${Date.now().toString(36)}`;
  const reg = registerAccountCommander({
    handle,
    passcode: 'blade2026',
    title: 'Solaris Ace',
    appearance: {
      hairStyle: 'spiky',
      hairColor: '#38bdf8',
      outfitColor: '#0f172a',
      accentColor: '#f59e0b',
    },
  });
  assert.ok(reg.commander);
  assert.equal(reg.commander.mmr, 1000);

  const dup = registerAccountCommander({
    handle,
    passcode: 'blade2026',
    title: 'Solaris Ace',
    appearance: reg.commander.appearance,
  });
  assert.equal(dup.commander, null);

  const authOk = authenticateAccountCommander(handle, 'blade2026');
  assert.equal(authOk.commander?.playerId, reg.commander.playerId);

  const authBad = authenticateAccountCommander(handle, 'badpass');
  assert.equal(authBad.commander, null);

  const save = createDefaultSaveData();
  save.playerScore = 2750;
  save.character.name = handle;
  const updated = saveCloudProfileForCommander(reg.commander.playerId, save);
  assert.ok(updated.commander);
  assert.equal(updated.commander.bestScore, 2750);

  const loaded = getCloudSaveForCommander(reg.commander.playerId);
  assert.equal(loaded?.playerScore, 2750);
  assert.equal(loaded?.playerId, reg.commander.playerId);

  // Attempt an impossible single-sync currency/score spike -> rejected
  const tamperedSave = createDefaultSaveData();
  tamperedSave.playerScore = 999999;
  tamperedSave.currencies.gold = 999999;
  const rejected = saveCloudProfileForCommander(reg.commander.playerId, tamperedSave);
  assert.equal(rejected.commander, null);
  assert.ok(rejected.error);
});

test('Ranked Online match updates MMR ELO idempotently and populates leaderboard', () => {
  const a = registerOrUpdateGuestCommander({
    handle: `Alpha_${Date.now().toString(36)}`,
    title: 'Challenger',
    appearance: {
      hairStyle: 'sleek',
      hairColor: '#a855f7',
      outfitColor: '#0f172a',
      accentColor: '#38bdf8',
    },
  }).commander;
  const b = registerOrUpdateGuestCommander({
    handle: `Beta_${Date.now().toString(36)}`,
    title: 'Challenger',
    appearance: {
      hairStyle: 'visor',
      hairColor: '#f43f5e',
      outfitColor: '#0f172a',
      accentColor: '#f59e0b',
    },
  }).commander;

  const matchId = `test-match-${Date.now()}`;
  const res = recordOnlineMatchResult({
    matchId,
    mode: 'OnlineRanked',
    arenaId: 'standard',
    p1Id: a.playerId,
    p2Id: b.playerId,
    winnerId: a.playerId,
    finishReason: 'BurstFinish',
    durationSec: 18.4,
  });
  assert.ok(res.mmrDelta >= 8);

  const repeat = recordOnlineMatchResult({
    matchId,
    mode: 'OnlineRanked',
    arenaId: 'standard',
    p1Id: a.playerId,
    p2Id: b.playerId,
    winnerId: a.playerId,
    finishReason: 'BurstFinish',
  });
  assert.equal(repeat.mmrDelta, res.mmrDelta);

  const board = getLeaderboardList('current');
  assert.ok(board.some((c) => c.playerId === a.playerId && c.mmr > 1000));
});

test('validateAndResolveOnlineBuild clamps unowned/spoofed builds against cloud save', () => {
  const { commander } = registerOrUpdateGuestCommander({
    handle: `BuildTest_${Date.now().toString(36)}`,
    title: 'Tactician',
    appearance: {
      hairStyle: 'sleek',
      hairColor: '#38bdf8',
      outfitColor: '#0f172a',
      accentColor: '#f59e0b',
    },
  });

  const resolved = validateAndResolveOnlineBuild(
    {
      topDefinitionId: 'nonexistent.top',
      level: 999,
      evolutionStage: 5,
    },
    commander.playerId
  );

  assert.equal(resolved.build.topDefinitionId, 'top.ignis.drake');
  assert.equal(resolved.build.level, 5);
  assert.equal(resolved.build.evolutionStage, 0);
});

test('server-authoritative PvP room ticks deterministically to match completion', () => {
  const p1 = registerOrUpdateGuestCommander({
    handle: `Host_${Date.now().toString(36)}`,
    title: 'Host',
    appearance: {
      hairStyle: 'spiky',
      hairColor: '#38bdf8',
      outfitColor: '#0f172a',
      accentColor: '#f59e0b',
    },
  }).commander;
  const p2 = registerOrUpdateGuestCommander({
    handle: `Guest_${Date.now().toString(36)}`,
    title: 'Guest',
    appearance: {
      hairStyle: 'visor',
      hairColor: '#f43f5e',
      outfitColor: '#0f172a',
      accentColor: '#38bdf8',
    },
  }).commander;

  const room = createTestAuthoritativeRoom({
    p1Id: p1.playerId,
    p2Id: p2.playerId,
    mode: 'OnlineRanked',
    arenaId: 'standard',
  });
  finalizeSynchronizedLaunch(room);
  if (room.simInterval) {
    clearInterval(room.simInterval);
    room.simInterval = null;
  }

  assert.equal(room.phase, 'Combat');
  assert.ok(room.sim);

  // Step 50Hz simulation ticks synchronously up to 92 seconds (4600 ticks)
  for (let i = 0; i < 4700 && room.phase === 'Combat'; i++) {
    stepAuthoritativeRoomTick(room);
  }

  assert.equal(room.phase, 'Finished');
  assert.ok(room.tickCount > 0);
});
