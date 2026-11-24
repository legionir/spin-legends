import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERFECT_LAUNCH_MIN,
  PERFECT_LAUNCH_MAX,
  PERFECT_LAUNCH_RPM_BONUS,
  MUTATOR_DEFINITIONS,
  calculateAttributes,
  calculatePhysicalProfile,
  isPowerInPerfectWindow,
  sanitizeBattleMutators,
  hasActiveMutators,
  getActiveMutatorLabels,
  getRankTierForMmr,
  getNextRankTier,
  getTierProgressPct,
  applySeasonSoftReset,
  getSeasonTierClaimKey,
  getCounterElementFor,
  inferAiPersonalityFromBuild,
  buildSeededShadowOpponents,
  recordMatchInHistory,
  upsertRivalOnLoss,
  markRivalAvenged,
} from './rules';
import {
  createBattleSimulation,
  stepBattleSimulation,
  applyLaunchVelocities,
  activateAbility,
  buildBattleAnalysisReport,
  buildMatchHighlightClip,
  FIXED_DT,
} from '../simulation/physicsEngine';
import { TOP_DEFINITIONS } from './catalog';

test('Perfect Launch Window verifies golden ratio and +8% RPM bonus', () => {
  assert.equal(PERFECT_LAUNCH_MIN, 0.80);
  assert.equal(PERFECT_LAUNCH_MAX, 0.94);
  assert.equal(PERFECT_LAUNCH_RPM_BONUS, 1.08);

  assert.equal(isPowerInPerfectWindow(0.50), false);
  assert.equal(isPowerInPerfectWindow(0.79), false);
  assert.equal(isPowerInPerfectWindow(0.80), true);
  assert.equal(isPowerInPerfectWindow(0.87), true);
  assert.equal(isPowerInPerfectWindow(0.94), true);
  assert.equal(isPowerInPerfectWindow(0.95), false);
  assert.equal(isPowerInPerfectWindow(1.00), false);

  const top1 = TOP_DEFINITIONS[0];
  const top2 = TOP_DEFINITIONS[1];
  const makeSim = (turboSpin = false) =>
    createBattleSimulation({
      battleId: `perfect-test-${turboSpin}`,
      arenaId: 'standard',
      playerConfig: {
        entityId: 'player',
        name: top1.displayName,
        element: top1.element,
        attributes: calculateAttributes(top1.id, top1.defaultComponents, {}, 1, null),
        physical: calculatePhysicalProfile(top1.id, top1.defaultComponents, {}, 1, null),
        abilities: [...top1.defaultAbilities],
        initialMode: 'Attack',
        initialCommand: 'Aggressive',
        evolutionStage: 0,
      },
      opponentConfig: {
        entityId: 'opponent',
        name: top2.displayName,
        element: top2.element,
        attributes: calculateAttributes(top2.id, top2.defaultComponents, {}, 1, null),
        physical: calculatePhysicalProfile(top2.id, top2.defaultComponents, {}, 1, null),
        abilities: [...top2.defaultAbilities],
        initialMode: 'Defense',
        initialCommand: 'Defensive',
        evolutionStage: 0,
      },
      aiPersonality: 'Aggressive',
      aiDifficulty: 'Normal',
      startInPhase: 'Launch',
      mutators: {
        noAbilities: false,
        doubleGravity: false,
        turboSpin,
        ringOutOnly: false,
        doubleHazards: false,
      },
    });

  const simPerfect = makeSim(false);
  applyLaunchVelocities(simPerfect, 0.87);
  assert.equal(simPerfect.perfectLaunch, true);
  assert.ok(simPerfect.events.some((e) => e.type === 'perfectLaunch'));

  const simNormal = makeSim(false);
  applyLaunchVelocities(simNormal, 0.78);
  assert.equal(simNormal.perfectLaunch, false);

  // Confirm +8% RPM boost relative to non-perfect power
  assert.ok(simPerfect.player.omega > simNormal.player.omega * 1.08);

  // Confirm Turbo Spin doubles initial RPM (2.0x)
  const simTurbo = makeSim(true);
  applyLaunchVelocities(simTurbo, 0.78);
  assert.ok(Math.abs(simTurbo.player.omega / simNormal.player.omega - 2.0) < 0.01);
});

test('Battle Mutators sanitize, detect active state, and label correctly', () => {
  const cleanDefault = sanitizeBattleMutators(null);
  assert.equal(hasActiveMutators(cleanDefault), false);
  assert.deepEqual(getActiveMutatorLabels(cleanDefault), []);

  const modified = sanitizeBattleMutators({
    turboSpin: true,
    doubleGravity: true,
    bogusField: 123,
  });
  assert.equal(modified.turboSpin, true);
  assert.equal(modified.doubleGravity, true);
  assert.equal(modified.noAbilities, false);
  assert.equal(hasActiveMutators(modified), true);

  const labels = getActiveMutatorLabels(modified);
  assert.ok(labels.includes('2x Gravity'));
  assert.ok(labels.includes('Turbo Spin 2x'));
  assert.equal(MUTATOR_DEFINITIONS.length, 5);
});

test('Competitive Seasons MMR tiers, progress calculations, and soft resets', () => {
  const bronze = getRankTierForMmr(850);
  assert.equal(bronze.id, 'Bronze');

  const gold = getRankTierForMmr(1220);
  assert.equal(gold.id, 'Gold');

  const legend = getRankTierForMmr(2400);
  assert.equal(legend.id, 'Legend');
  assert.equal(getNextRankTier(2400), null);
  assert.equal(getTierProgressPct(2400), 100);

  const nextTier = getNextRankTier(1050);
  assert.ok(nextTier);
  assert.equal(nextTier.id, 'Gold');

  const progress = getTierProgressPct(1100);
  assert.ok(progress >= 0 && progress <= 100);

  // Soft reset pulls towards 1000 baseline
  const resetHigh = applySeasonSoftReset(1600);
  assert.equal(resetHigh, 1300); // 1000 + (1600 - 1000) * 0.5
  const resetLow = applySeasonSoftReset(900);
  assert.equal(resetLow, 950);

  assert.equal(getSeasonTierClaimKey(2, 'Diamond'), 'S2:Diamond');
});

test('Rivals & Rematch Feed registers defeats, gives counter element, and marks avenged', () => {
  let rivals = upsertRivalOnLoss([], {
    playerId: 'commander-rival-1',
    handle: 'Nemesis',
    sourceMode: 'ShadowPvP',
    topDefinitionId: 'top.iron_vanguard',
    element: 'Earth',
    level: 5,
    mmr: 1250,
  });

  assert.equal(rivals.length, 1);
  assert.equal(rivals[0].handle, 'Nemesis');
  assert.equal(rivals[0].status, 'unavenged');
  assert.equal(rivals[0].lossesToRival, 1);
  assert.equal(rivals[0].recommendedCounterElement, getCounterElementFor('Earth'));

  // Defeat again to same rival increments loss counter
  rivals = upsertRivalOnLoss(rivals, {
    playerId: 'commander-rival-1',
    handle: 'Nemesis',
    sourceMode: 'OnlineRanked',
    topDefinitionId: 'top.iron_vanguard',
    element: 'Earth',
  });
  assert.equal(rivals.length, 1);
  assert.equal(rivals[0].lossesToRival, 2);

  // Avenge the rival
  const avenged = markRivalAvenged(rivals, 'commander-rival-1');
  assert.equal(avenged[0].status, 'avenged');
  assert.equal(avenged[0].winsAgainstRival, 1);
});

test('Shadow PvP seeded roster and AI personality inference from build', () => {
  const shadows = buildSeededShadowOpponents();
  assert.equal(shadows.length, 6);
  for (const s of shadows) {
    assert.ok(s.id.startsWith('shadow-seed-'));
    assert.ok(s.mmr >= 1000);
    assert.ok(s.topDefinitionId);
    assert.ok(s.equippedComponents.AttackBlade);
  }

  const starterTop = TOP_DEFINITIONS[0];
  const personality = inferAiPersonalityFromBuild(starterTop.defaultComponents, starterTop.id);
  assert.ok(typeof personality === 'string');
});

test('Physics simulation with Mutators, Battle Analysis telemetry, and 10-match history cap', () => {
  const top1 = TOP_DEFINITIONS[0];
  const top2 = TOP_DEFINITIONS[1];
  const sim = createBattleSimulation({
    battleId: 'test-battle-1',
    arenaId: 'standard',
    playerConfig: {
      entityId: 'player',
      name: top1.displayName,
      element: top1.element,
      attributes: calculateAttributes(top1.id, top1.defaultComponents, {}, 1, null),
      physical: calculatePhysicalProfile(top1.id, top1.defaultComponents, {}, 1, null),
      abilities: [...top1.defaultAbilities],
      initialMode: 'Attack',
      initialCommand: 'Aggressive',
      evolutionStage: 0,
    },
    opponentConfig: {
      entityId: 'opponent',
      name: top2.displayName,
      element: top2.element,
      attributes: calculateAttributes(top2.id, top2.defaultComponents, {}, 1, null),
      physical: calculatePhysicalProfile(top2.id, top2.defaultComponents, {}, 1, null),
      abilities: [...top2.defaultAbilities],
      initialMode: 'Defense',
      initialCommand: 'Defensive',
      evolutionStage: 0,
    },
    aiPersonality: 'Aggressive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
    mutators: {
      turboSpin: true,
      noAbilities: true,
      doubleGravity: true,
      ringOutOnly: true,
      doubleHazards: true,
    },
  });

  // Verify mutator initial conditions
  assert.equal(sim.mutators.turboSpin, true);
  assert.equal(sim.mutators.noAbilities, true);
  assert.equal(sim.mutators.doubleGravity, true);
  assert.equal(sim.mutators.ringOutOnly, true);
  assert.equal(sim.mutators.doubleHazards, true);

  // Under ringOutOnly, burst/spin loss should not end battle unless ring-out occurs
  sim.opponent.durability = 0;
  stepBattleSimulation(sim, FIXED_DT);
  assert.equal(sim.winnerSide, null);
  assert.notEqual(sim.phase, 'Results');

  // Ability cannot activate when noAbilities mutator is enabled
  assert.equal(activateAbility(sim, 'player', 0), false);

  // Advance several ticks to capture timeline sample
  for (let i = 0; i < 60; i++) {
    stepBattleSimulation(sim, FIXED_DT);
  }

  // Battle Analysis report builds cleanly
  const report = buildBattleAnalysisReport(sim);
  assert.ok(report.damageTakenByPlayer);
  assert.ok(report.damageDealtByPlayer);
  assert.ok(report.peakPlayerRpm > 0);
  assert.ok(report.peakOpponentRpm > 0);
  assert.ok(report.durationSec > 0);
  assert.ok(Array.isArray(report.timeline));
  assert.ok(report.timeline.length >= 1);

  const clip = buildMatchHighlightClip(sim);
  assert.ok(clip);
  let history = [] as ReturnType<typeof recordMatchInHistory>;
  for (let i = 0; i < 12; i++) {
    history = recordMatchInHistory(history, {
      battleId: `hist-${i}`,
      timestampMs: 1000 + i,
      mode: 'ShadowPvP',
      arenaId: 'standard',
      opponentName: `Rival ${i}`,
      opponentElement: 'Fire',
      won: i % 2 === 0,
      finishReason: 'RingOut',
      durationSec: 12,
      maxImpactImpulse: 4.5,
      collisionCount: 5,
      perfectLaunch: i % 3 === 0,
      mutators: { ...sim.mutators },
      scoreEarned: 250,
      analysis: report,
      highlights: clip,
    });
  }
  assert.equal(history.length, 10);
  assert.equal(history[0].battleId, 'hist-11');
});
