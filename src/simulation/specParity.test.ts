import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABILITIES,
  MISSIONS_CATALOG,
  OPPONENTS,
  TOP_DEFINITIONS,
  getOpponentDefinition,
  getTopDefinition,
} from '../domain/catalog';
import {
  CHARACTER_BASE_STAT,
  CHARACTER_MAX_STAT,
  SAVE_SCHEMA_VERSION,
  calculateAttributes,
  calculatePhysicalProfile,
  createDefaultKeyBindings,
  createDefaultSaveData,
  getCurrentDailyResetKey,
  isQuickSwapAllowedForMode,
  validateContentCatalog,
} from '../domain/rules';
import { sanitizeAndMigrateSave } from '../domain/saveValidation';
import { AIPersonality, ElementType } from '../domain/types';
import {
  BattleSimulationState,
  FIXED_DT,
  TopSimConfig,
  activateAbility,
  applyLaunchVelocities,
  buildBattleAnalysisReport,
  createBattleSimulation,
  quickSwapPlayerLoadout,
  stepBattleSimulation,
} from './physicsEngine';

function buildConfigFromTopId(topId: string, entityId: 'player' | 'opponent'): TopSimConfig {
  const def = getTopDefinition(topId);
  return {
    entityId,
    name: def.displayName,
    element: def.element,
    attributes: calculateAttributes(def.id, def.defaultComponents),
    physical: calculatePhysicalProfile(def.id, def.defaultComponents),
    abilities: def.defaultAbilities,
    initialMode: 'Attack',
    initialCommand: 'Aggressive',
    evolutionStage: 0,
  };
}

test('validateContentCatalog verifies unique IDs, cross-references, finite bounds, and 8-element Ultimate parity', () => {
  const report = validateContentCatalog();
  assert.equal(report.valid, true, `Catalog validation errors: ${report.errors.join(' | ')}`);
  assert.deepEqual(report.errors, []);

  const elements: ElementType[] = [
    'Fire',
    'Water',
    'Ice',
    'Lightning',
    'Earth',
    'Wind',
    'Shadow',
    'Light',
  ];
  for (const elem of elements) {
    assert.ok(
      TOP_DEFINITIONS.some((t) => t.element === elem),
      `Expected at least one Top for element ${elem}`
    );
    assert.ok(
      Object.values(ABILITIES).some((a) => a.type === 'Ultimate' && a.element === elem),
      `Expected a signature Ultimate ability for element ${elem}`
    );
  }
});

test('sanitizeAndMigrateSave rejects corrupt roots, clamps stats/currencies, resets daily missions, and migrates 7-key KeyBindings', () => {
  assert.equal(sanitizeAndMigrateSave(null), null);
  assert.equal(sanitizeAndMigrateSave('corrupt'), null);
  assert.equal(sanitizeAndMigrateSave({ schemaVersion: Number.NaN, ownedTops: [] }), null);
  assert.equal(sanitizeAndMigrateSave({ schemaVersion: SAVE_SCHEMA_VERSION, ownedTops: [] }), null);

  const valid = createDefaultSaveData();
  const legacyBindSubset = {
    launch: 'j',
    ability1: 'q',
    ability2: 'w',
    ability3: 'e',
    ability4: 'r',
    teamSwitch: 't',
    pause: 'p',
  };

  const dailyMission = MISSIONS_CATALOG.find((m) => m.cadence === 'daily');
  const persistentMission = MISSIONS_CATALOG.find((m) => m.cadence !== 'daily');
  assert.ok(dailyMission && persistentMission, 'Expected both daily and non-daily missions in catalog');

  const tampered = {
    ...valid,
    schemaVersion: 1,
    dailyMissionResetKey: '1999-01-01',
    missionProgress: {
      [dailyMission.id]: { progress: 1, claimed: true },
      [persistentMission.id]: { progress: 6, claimed: false },
    },
    currencies: {
      gold: -500,
      metalShards: Number.POSITIVE_INFINITY,
      energyCrystals: Number.NaN,
      elementalEssence: 999_999_999,
      evolutionTokens: -3,
      legendaryFragments: 42.6,
    },
    character: {
      ...valid.character,
      name: '  A  ',
      stats: { strength: 99, agility: -10, focus: Number.NaN, luck: 12 },
    },
    discoveredSecrets: ['secret.perfect_ripcord', 'secret.non_existent'],
    visitedArenaIds: ['standard', 'invalid_arena'],
    settings: {
      ...valid.settings,
      keyBindings: legacyBindSubset,
    },
  };

  const migrated = sanitizeAndMigrateSave(tampered);
  assert.ok(migrated !== null);
  assert.equal(migrated.currencies.gold, 0);
  assert.equal(migrated.currencies.metalShards, 0);
  assert.equal(migrated.currencies.energyCrystals, 0);
  assert.equal(migrated.currencies.elementalEssence, 500_000);
  assert.equal(migrated.currencies.evolutionTokens, 0);
  assert.equal(migrated.currencies.legendaryFragments, 43);

  // Character stats clamped between CHARACTER_BASE_STAT and CHARACTER_MAX_STAT
  assert.equal(migrated.character.stats.strength, CHARACTER_MAX_STAT);
  assert.equal(migrated.character.stats.agility, CHARACTER_BASE_STAT);
  assert.equal(migrated.character.stats.focus, CHARACTER_BASE_STAT);
  assert.equal(migrated.character.stats.luck, Math.min(CHARACTER_MAX_STAT, 12));

  // Invalid catalog references stripped
  assert.deepEqual(migrated.discoveredSecrets, ['secret.perfect_ripcord']);
  assert.deepEqual(migrated.visitedArenaIds, ['standard']);

  // Daily mission resets on date rollover while persistent mission preserves progress
  assert.equal(migrated.dailyMissionResetKey, getCurrentDailyResetKey());
  assert.equal(migrated.missionProgress[dailyMission.id].claimed, false);
  assert.equal(migrated.missionProgress[dailyMission.id].progress, 0);
  assert.equal(migrated.missionProgress[persistentMission.id].progress, 6);

  // Legacy 7-key bindings keep customized values and hydrate missing cameraCycle & tactical1..8
  const defaults = createDefaultKeyBindings();
  assert.equal(migrated.settings.keyBindings.launch, 'j');
  assert.equal(migrated.settings.keyBindings.ability1, 'q');
  assert.equal(migrated.settings.keyBindings.pause, 'p');
  assert.equal(migrated.settings.keyBindings.cameraCycle, defaults.cameraCycle);
  assert.equal(migrated.settings.keyBindings.tactical1, defaults.tactical1);
  assert.equal(migrated.settings.keyBindings.tactical8, defaults.tactical8);
});

test('6-part durability tracks EnergyModule break penalty, emits partBreak/burst with vx/vz, and activates Elemental Ultimates', () => {
  const opp = getOpponentDefinition(OPPONENTS[0].id);
  const simIntact = createBattleSimulation({
    battleId: 'test-6part-intact',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: {
      ...buildConfigFromTopId(opp.topId, 'opponent'),
      abilities: opp.abilities,
    },
    aiPersonality: 'Defensive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
  });
  simIntact.isOnlineRemote = true; // isolate pure passive energy regen from AI variance
  simIntact.player.energy = 10;
  simIntact.opponent.energy = 10;

  const simBrokenModule = createBattleSimulation({
    battleId: 'test-6part-broken-module',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: {
      ...buildConfigFromTopId(opp.topId, 'opponent'),
      abilities: opp.abilities,
    },
    aiPersonality: 'Defensive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
  });
  simBrokenModule.isOnlineRemote = true;
  simBrokenModule.player.energy = 10;
  simBrokenModule.player.partDurability.EnergyModule = 0;
  simBrokenModule.player.brokenParts.push('EnergyModule');

  // Keep tops separated for pure passive regeneration measurement
  simIntact.player.x = -2.2;
  simIntact.opponent.x = 2.2;
  simBrokenModule.player.x = -2.2;
  simBrokenModule.opponent.x = 2.2;

  for (let i = 0; i < 40; i++) {
    stepBattleSimulation(simIntact, FIXED_DT);
    stepBattleSimulation(simBrokenModule, FIXED_DT);
  }
  assert.ok(
    simBrokenModule.player.energy < simIntact.player.energy,
    `Broken EnergyModule must reduce energy regen (${simBrokenModule.player.energy.toFixed(2)} vs ${simIntact.player.energy.toFixed(2)})`
  );

  // Signature Elemental Ultimates: Water pull, Wind overdrive, Shadow energy siphon
  for (const [topId, expectedAbility] of [
    ['top.aegis.titan', 'ability.ult.abyssal_maelstrom'],
    ['top.zephyr.valkyrie', 'ability.ult.cyclone_tempest'],
    ['top.umbra.phantom', 'ability.ult.eclipse_abyss'],
  ] as const) {
    const ultSim = createBattleSimulation({
      battleId: `test-ult-${topId}`,
      arenaId: 'standard',
      playerConfig: buildConfigFromTopId(topId, 'player'),
      opponentConfig: buildConfigFromTopId('top.glacier.sentinel', 'opponent'),
      aiPersonality: 'Tactical',
      aiDifficulty: 'Normal',
      startInPhase: 'Combat',
    });
    assert.equal(ultSim.player.abilitySlots[3].abilityId, expectedAbility);
    ultSim.player.energy = 100;
    ultSim.player.resonance = 100;
    ultSim.player.x = -0.8;
    ultSim.player.z = 0;
    ultSim.opponent.x = 0.8;
    ultSim.opponent.z = 0;
    ultSim.opponent.energy = 50;
    const ok = activateAbility(ultSim, 'player', 3);
    assert.equal(ok, true, `Signature ultimate ${expectedAbility} should activate`);
    if (topId === 'top.umbra.phantom') {
      assert.ok(ultSim.opponent.energy <= 34.5, 'Shadow Ultimate must siphon rival energy');
    }
    if (topId === 'top.zephyr.valkyrie') {
      assert.ok(
        ultSim.player.statuses.some((s) => s.type === 'Overdrive'),
        'Wind Ultimate must apply Overdrive'
      );
    }
  }

  // Trigger head-on critical clash to force partBreak / BurstFinish event with vx/vz
  const burstSim = createBattleSimulation({
    battleId: 'test-burst-ejection',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: buildConfigFromTopId('top.glacier.sentinel', 'opponent'),
    aiPersonality: 'Aggressive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
  });
  burstSim.opponent.durability = 2;
  burstSim.opponent.partDurability.EnergyModule = 1;
  burstSim.opponent.partDurability.ArmorRing = 1;
  burstSim.player.x = -0.25;
  burstSim.player.z = 0;
  burstSim.player.vx = 6.2;
  burstSim.player.vz = 0;
  burstSim.opponent.x = 0.25;
  burstSim.opponent.z = 0;
  burstSim.opponent.vx = -4.5;
  burstSim.opponent.vz = 0;

  let sawPartBreakWithVel = false;
  let sawBurstWithVel = false;
  for (let i = 0; i < 30; i++) {
    stepBattleSimulation(burstSim, FIXED_DT);
    for (const ev of burstSim.events) {
      if (ev.type === 'partBreak' && typeof ev.vx === 'number' && typeof ev.vz === 'number') {
        sawPartBreakWithVel = true;
      }
      if (ev.type === 'burst' && typeof ev.vx === 'number' && typeof ev.vz === 'number') {
        sawBurstWithVel = true;
      }
    }
    if (burstSim.phase === 'Finish' || burstSim.phase === 'Results') break;
  }
  assert.equal(burstSim.finishReason, 'BurstFinish', 'Zero-durability high impact should trigger BurstFinish');
  assert.equal(sawPartBreakWithVel, true, 'partBreak event should include vx/vz velocity');
  assert.equal(sawBurstWithVel, true, 'burst event should include vx/vz velocity');
});

test('all 6 AI personalities exhibit distinct tactical decisions and battle modes', () => {
  const personalities: AIPersonality[] = [
    'Aggressive',
    'Defensive',
    'Tactical',
    'Evasive',
    'HeavyAssault',
    'Adaptive',
  ];

  const observedBehavior = new Map<AIPersonality, { cmd: string; mode: string }>();

  for (const p of personalities) {
    const sim = createBattleSimulation({
      battleId: `ai-${p}`,
      arenaId: 'standard',
      playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
      opponentConfig: buildConfigFromTopId('top.terra.colossus', 'opponent'),
      aiPersonality: p,
      aiDifficulty: 'Hard',
      startInPhase: 'Combat',
    });

    // Place near center orbit at moderate distance with ample energy
    sim.player.x = -0.8;
    sim.player.z = 0;
    sim.opponent.x = 0.9;
    sim.opponent.z = 0.2;
    sim.opponent.energy = 80;
    sim.opponent.staminaRatio = 0.85;
    sim.opponent.modeCooldown = 0;
    sim.opponent.commandCooldown = 0;
    sim.aiDecisionTimer = 0.01;
    if (p === 'Adaptive') {
      sim.adaptiveMemory.highSpeedClashes = 3;
      sim.adaptiveMemory.playerAbilitiesObserved = 3;
    }

    for (let i = 0; i < 6; i++) {
      stepBattleSimulation(sim, FIXED_DT);
    }

    observedBehavior.set(p, {
      cmd: sim.opponent.tacticalCommand,
      mode: sim.opponent.battleMode,
    });
  }

  assert.ok(
    observedBehavior.get('Defensive')?.cmd === 'HoldPosition' ||
      observedBehavior.get('Defensive')?.cmd === 'Defensive',
    `Defensive AI chose unexpected command: ${observedBehavior.get('Defensive')?.cmd}`
  );
  assert.ok(
    observedBehavior.get('Evasive')?.cmd === 'Evade' ||
      observedBehavior.get('Evasive')?.cmd === 'Circle',
    `Evasive AI chose unexpected command: ${observedBehavior.get('Evasive')?.cmd}`
  );
  assert.equal(
    observedBehavior.get('Adaptive')?.mode,
    'Counter',
    'Adaptive AI must shift into Counter mode after high-speed clashes'
  );
  const distinctSignatures = new Set(
    Array.from(observedBehavior.values()).map((v) => `${v.cmd}:${v.mode}`)
  );
  assert.ok(
    distinctSignatures.size >= 4,
    `Expected >=4 distinct personality behavior signatures, got ${distinctSignatures.size}`
  );
});

test('archetype & elemental matchups simulate cleanly with bounded finite state', () => {
  const matchups: Array<[string, string]> = [
    ['top.ignis.drake', 'top.aegis.titan'], // Fire Attacker vs Water Defender
    ['top.volt.striker', 'top.glacier.sentinel'], // Lightning vs Ice Stamina
    ['top.terra.colossus', 'top.zephyr.valkyrie'], // Heavy Earth vs Light Wind
    ['top.umbra.phantom', 'top.solaris.seraph'], // Shadow vs Light
  ];

  for (const [pTopId, oTopId] of matchups) {
    const sim: BattleSimulationState = createBattleSimulation({
      battleId: `balance-${pTopId}-${oTopId}`,
      arenaId: 'standard',
      playerConfig: buildConfigFromTopId(pTopId, 'player'),
      opponentConfig: buildConfigFromTopId(oTopId, 'opponent'),
      aiPersonality: 'Tactical',
      aiDifficulty: 'Normal',
      startInPhase: 'Launch',
    });
    applyLaunchVelocities(sim, 0.85);

    for (let i = 0; i < 4600; i++) {
      stepBattleSimulation(sim, FIXED_DT);
      assert.ok(Number.isFinite(sim.player.x) && Number.isFinite(sim.player.z));
      assert.ok(Number.isFinite(sim.opponent.x) && Number.isFinite(sim.opponent.z));
      assert.ok(Number.isFinite(sim.player.omega) && Number.isFinite(sim.opponent.omega));
      if ((sim.phase as string) === 'Results') break;
    }

    assert.equal(sim.phase, 'Results', `Matchup ${pTopId} vs ${oTopId} should finish cleanly`);
    assert.ok(sim.winnerSide === 'player' || sim.winnerSide === 'opponent');
    assert.ok(sim.finishReason !== null);
  }
});

test('hit-stop freezes simulation time & finish transition on critical collision and burst finish', () => {
  const critSim = createBattleSimulation({
    battleId: 'test-crit-hitstop',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: buildConfigFromTopId('top.terra.colossus', 'opponent'),
    aiPersonality: 'Aggressive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
  });
  critSim.player.x = -0.22;
  critSim.player.z = 0;
  critSim.player.vx = 5.4;
  critSim.player.vz = 0;
  critSim.opponent.x = 0.22;
  critSim.opponent.z = 0;
  critSim.opponent.vx = -5.4;
  critSim.opponent.vz = 0;

  for (let i = 0; i < 20; i++) {
    stepBattleSimulation(critSim, FIXED_DT);
    if (critSim.hitstopTimer >= 0.08) break;
  }
  assert.ok(critSim.hitstopTimer >= 0.08, 'Critical collision must trigger noticeable hitstopTimer');
  const frozenTime = critSim.elapsedTime;
  const frozenSlowMo = critSim.slowMotionTimer;
  stepBattleSimulation(critSim, FIXED_DT);
  assert.equal(critSim.elapsedTime, frozenTime, 'Simulation elapsedTime must freeze during hit-stop');
  assert.equal(critSim.slowMotionTimer, frozenSlowMo, 'Slow-motion timer must hold until hit-stop ends');

  // Burst Finish hit-stop freezes Finish phase progression briefly at moment of burst
  const burstSim = createBattleSimulation({
    battleId: 'test-burst-hitstop',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: buildConfigFromTopId('top.glacier.sentinel', 'opponent'),
    aiPersonality: 'Aggressive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
  });
  burstSim.opponent.durability = 2;
  burstSim.player.x = -0.22;
  burstSim.player.z = 0;
  burstSim.player.vx = 6.2;
  burstSim.player.vz = 0;
  burstSim.opponent.x = 0.22;
  burstSim.opponent.z = 0;
  burstSim.opponent.vx = -4.5;
  burstSim.opponent.vz = 0;

  for (let i = 0; i < 20; i++) {
    stepBattleSimulation(burstSim, FIXED_DT);
    if (burstSim.phase === 'Finish') break;
  }
  assert.equal(burstSim.finishReason, 'BurstFinish');
  assert.ok(burstSim.hitstopTimer >= 0.1, 'BurstFinish must trigger extended hit-stop impact freeze');
  stepBattleSimulation(burstSim, FIXED_DT);
  assert.equal(burstSim.finishTimer, 0, 'Finish timer must freeze while BurstFinish hit-stop is active');
});

test('Quick Swap eligibility respects battle modes and swaps active loadout cleanly mid-combat', () => {
  assert.equal(isQuickSwapAllowedForMode('Training', false), true);
  assert.equal(isQuickSwapAllowedForMode('Boss', false), true);
  assert.equal(isQuickSwapAllowedForMode('TeamBattle', false), true);
  assert.equal(isQuickSwapAllowedForMode('Tournament', false), false);
  assert.equal(isQuickSwapAllowedForMode('Survival', false), false);
  assert.equal(isQuickSwapAllowedForMode('ShadowPvP', false), false);
  assert.equal(isQuickSwapAllowedForMode('OnlineRanked', false), false);
  assert.equal(isQuickSwapAllowedForMode('OnlineFriendly', false), false);
  assert.equal(isQuickSwapAllowedForMode('Training', true), false);

  const sim = createBattleSimulation({
    battleId: 'test-quick-swap',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: buildConfigFromTopId('top.aegis.titan', 'opponent'),
    aiPersonality: 'Tactical',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
  });
  sim.player.x = 1.2;
  sim.player.z = -0.75;
  sim.player.vx = 2.1;
  sim.player.vz = -1.4;
  sim.player.staminaRatio = 0.68;

  const swapConfig = buildConfigFromTopId('top.volt.tempest', 'player');
  const swapped = quickSwapPlayerLoadout(sim, swapConfig, 'Volt Preset');
  assert.equal(swapped, true);
  assert.equal(sim.player.element, 'Lightning');
  assert.equal(sim.player.x, 1.2);
  assert.equal(sim.player.z, -0.75);
  assert.equal(sim.player.vx, 2.1);
  assert.ok(Math.abs(sim.player.staminaRatio - 0.68) < 1e-6);
  assert.ok(
    sim.events.some((ev) => ev.type === 'teamSwitch' && ev.label?.includes('VOLT PRESET')),
    'Quick swap should emit swap event for visual sync'
  );
});

test('buildBattleAnalysisReport captures Battle Recap moments and flips opponent perspective', () => {
  const sim = createBattleSimulation({
    battleId: 'test-battle-recap',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: buildConfigFromTopId('top.terra.colossus', 'opponent'),
    aiPersonality: 'Aggressive',
    aiDifficulty: 'Hard',
    startInPhase: 'Combat',
  });

  // Trigger rapid repeated collisions to create a multi-hit clash streak, peak damage, and threshold breaches
  sim.player.x = -0.22;
  sim.player.z = 0;
  sim.player.vx = 5.6;
  sim.player.vz = 0;
  sim.opponent.x = 0.22;
  sim.opponent.z = 0;
  sim.opponent.vx = -5.2;
  sim.opponent.vz = 0;
  sim.opponent.durability = sim.opponent.maxDurability * 0.23;

  for (let i = 0; i < 45; i++) {
    stepBattleSimulation(sim, FIXED_DT);
    if (i === 18 && (sim.phase as string) !== 'Results') {
      // Pull back together for a second rapid impact within 1.35s streak window
      sim.player.x = -0.24;
      sim.player.vx = 4.9;
      sim.opponent.x = 0.24;
      sim.opponent.vx = -4.6;
    }
    if ((sim.phase as string) === 'Results') break;
  }

  // Simulate enough combat timeline ticks to record momentum swings and low stamina breach
  sim.player.staminaRatio = 0.15;
  for (let i = 0; i < 20; i++) {
    if ((sim.phase as string) === 'Results') break;
    stepBattleSimulation(sim, FIXED_DT);
  }

  const playerReport = buildBattleAnalysisReport(sim, 'player');
  assert.ok(playerReport.highestDamageMoment, 'Expected highestDamageMoment to be captured');
  assert.ok(playerReport.highestDamageMoment.amount > 0);
  assert.ok(playerReport.longestClashStreak, 'Expected longestClashStreak to be captured');
  assert.ok(playerReport.longestClashStreak.hitCount >= 1);
  assert.ok(
    Array.isArray(playerReport.criticalThresholdBreaches) &&
      playerReport.criticalThresholdBreaches.length >= 1,
    'Expected at least one critical <20% threshold breach'
  );
  assert.ok(
    playerReport.timeline.length >= 1,
    'Expected timeline samples to be captured'
  );

  // Verify opponent perspective flips sides cleanly
  const oppReport = buildBattleAnalysisReport(sim, 'opponent');
  assert.ok(oppReport.highestDamageMoment);
  assert.equal(
    oppReport.highestDamageMoment.actorSide,
    playerReport.highestDamageMoment.actorSide === 'player' ? 'opponent' : 'player'
  );
  assert.equal(
    oppReport.highestDamageMoment.victimSide,
    playerReport.highestDamageMoment.victimSide === 'player' ? 'opponent' : 'player'
  );
  if (playerReport.criticalThresholdBreaches && oppReport.criticalThresholdBreaches) {
    assert.equal(
      oppReport.criticalThresholdBreaches[0].side,
      playerReport.criticalThresholdBreaches[0].side === 'player' ? 'opponent' : 'player'
    );
  }
  if (playerReport.peakMomentumSwing && oppReport.peakMomentumSwing) {
    assert.equal(
      oppReport.peakMomentumSwing.leaderAfter,
      playerReport.peakMomentumSwing.leaderAfter === 'player' ? 'opponent' : 'player'
    );
  }
});

test('open Ring-Out exit gates allow knocked tops to exit unobstructed without invisible wall rebounds', () => {
  const sim = createBattleSimulation({
    battleId: 'test-ringout-gate-exit',
    arenaId: 'standard',
    playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
    opponentConfig: buildConfigFromTopId('top.zephyr.valkyrie', 'opponent'),
    aiPersonality: 'Aggressive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
  });
  sim.disableAi = true;

  // Aim opponent directly toward the 180-deg exit gate (-X axis) at realistic post-clash knockback speed
  sim.player.x = 0.5;
  sim.player.z = 0;
  sim.player.vx = 0;
  sim.player.vz = 0;
  sim.opponent.x = -3.2;
  sim.opponent.z = 0;
  sim.opponent.vx = -3.1;
  sim.opponent.vz = 0;

  let sawRingOut = false;
  for (let i = 0; i < 60; i++) {
    stepBattleSimulation(sim, FIXED_DT);
    if (sim.opponent.ringedOut || sim.finishReason === 'RingOut') {
      sawRingOut = true;
      break;
    }
  }

  assert.equal(sawRingOut, true, 'Top driven into an open exit gate at 3.1 m/s must fly out cleanly for RingOut');
  assert.equal(sim.finishReason, 'RingOut');
  assert.equal(sim.winnerSide, 'player');
});

test('dynamic arena weather subtly modulates grip friction, spin drag, stability, and crosswind drift', () => {
  const createWeatherSim = (weather: 'Clear' | 'LightRain' | 'DustStorm' | 'GaleWind') => {
    const sim = createBattleSimulation({
      battleId: `test-weather-${weather}`,
      arenaId: 'standard',
      playerConfig: buildConfigFromTopId('top.ignis.drake', 'player'),
      opponentConfig: buildConfigFromTopId('top.glacier.sentinel', 'opponent'),
      aiPersonality: 'Defensive',
      aiDifficulty: 'Normal',
      startInPhase: 'Combat',
      weather,
    });
    sim.disableAi = true;
    sim.player.x = -1.6;
    sim.player.z = 0;
    sim.player.vx = 2.0;
    sim.player.vz = 0.8;
    sim.player.stability = 75;
    sim.opponent.x = 2.0;
    sim.opponent.z = 0;
    sim.opponent.vx = 0;
    sim.opponent.vz = 0;
    for (let i = 0; i < 60; i++) {
      stepBattleSimulation(sim, FIXED_DT);
    }
    return sim;
  };

  const clearSim = createWeatherSim('Clear');
  const rainSim = createWeatherSim('LightRain');
  const dustSim = createWeatherSim('DustStorm');
  const galeSim = createWeatherSim('GaleWind');

  assert.equal(clearSim.weather, 'Clear');
  assert.equal(rainSim.weather, 'LightRain');
  assert.ok(
    rainSim.player.omega > clearSim.player.omega,
    `LightRain should have lower rotational drag than Clear (${rainSim.player.omega.toFixed(2)} vs ${clearSim.player.omega.toFixed(2)})`
  );
  assert.ok(
    dustSim.player.omega < clearSim.player.omega,
    `DustStorm should induce higher rotational drag than Clear (${dustSim.player.omega.toFixed(2)} vs ${clearSim.player.omega.toFixed(2)})`
  );
  assert.ok(
    dustSim.player.stability < clearSim.player.stability,
    `DustStorm should yield lower net stability than Clear (${dustSim.player.stability.toFixed(2)} vs ${clearSim.player.stability.toFixed(2)})`
  );
  const galeVelDelta = Math.hypot(
    galeSim.opponent.vx - clearSim.opponent.vx,
    galeSim.opponent.vz - clearSim.opponent.vz
  );
  assert.ok(
    galeVelDelta > 0.01,
    `GaleWind crosswinds should shift top trajectory vs Clear weather (delta=${galeVelDelta.toFixed(5)})`
  );
  assert.ok(
    galeSim.player.stability < clearSim.player.stability,
    `GaleWind should lower net stability vs Clear weather (${galeSim.player.stability.toFixed(2)} vs ${clearSim.player.stability.toFixed(2)})`
  );
});

test('sanitizeAndMigrateSave preserves valid preferredWeather and victoryEmote and falls back on invalid values', () => {
  const valid = createDefaultSaveData();
  const withCustomWeatherAndEmote = {
    ...valid,
    preferredWeather: 'DustStorm',
    ownedTops: valid.ownedTops.map((t, idx) =>
      idx === 0 ? { ...t, cosmetics: { ...t.cosmetics, victoryEmote: 'titan_hover' } } : t
    ),
  };
  const preserved = sanitizeAndMigrateSave(withCustomWeatherAndEmote);
  assert.ok(preserved !== null);
  assert.equal(preserved.preferredWeather, 'DustStorm');
  assert.equal(preserved.ownedTops[0].cosmetics.victoryEmote, 'titan_hover');

  const withInvalidWeatherAndEmote = {
    ...valid,
    preferredWeather: 'VolcanoApocalypse',
    ownedTops: valid.ownedTops.map((t, idx) =>
      idx === 0 ? { ...t, cosmetics: { ...t.cosmetics, victoryEmote: 'unknown_emote' } } : t
    ),
  };
  const sanitized = sanitizeAndMigrateSave(withInvalidWeatherAndEmote);
  assert.ok(sanitized !== null);
  assert.equal(sanitized.preferredWeather, 'Clear');
  assert.equal(sanitized.ownedTops[0].cosmetics.victoryEmote, 'apex_flare');
});

test('moment-of-inertia resists collision deflection, scales cameraTrauma with mass, and arena wallRestitution differentiates rebounds', () => {
  const makeCustomTop = (
    entityId: 'player' | 'opponent',
    components: {
      SpiritCore: string;
      AttackBlade: string;
      ArmorRing: string;
      WeightDisc: string;
      PerformanceDriver: string;
      EnergyModule: string;
    }
  ): TopSimConfig => {
    const def = TOP_DEFINITIONS[0];
    return {
      entityId,
      name: entityId === 'player' ? 'Heavy Build' : 'Light Build',
      element: def.element,
      attributes: calculateAttributes(def.id, components),
      physical: calculatePhysicalProfile(def.id, components),
      abilities: def.defaultAbilities,
      initialMode: 'Defense',
      initialCommand: 'HoldPosition',
      evolutionStage: 0,
    };
  };

  const heavyConfig = makeCustomTop('player', {
    SpiritCore: 'core.aegis',
    AttackBlade: 'blade.titan',
    ArmorRing: 'armor.fortress',
    WeightDisc: 'weight.tungsten',
    PerformanceDriver: 'driver.rubber',
    EnergyModule: 'energy.cell',
  });
  const lightConfig = makeCustomTop('opponent', {
    SpiritCore: 'core.volt',
    AttackBlade: 'blade.glider',
    ArmorRing: 'armor.feather',
    WeightDisc: 'weight.light',
    PerformanceDriver: 'driver.sharp',
    EnergyModule: 'energy.cell',
  });

  assert.ok(heavyConfig.physical.momentOfInertia > lightConfig.physical.momentOfInertia);
  assert.ok(heavyConfig.physical.groundFriction > lightConfig.physical.groundFriction);
  assert.ok(heavyConfig.physical.restitution !== lightConfig.physical.restitution);

  // Compare heavy-vs-heavy collision trauma against light-vs-light collision trauma at same impact speed
  const runClash = (aCfg: TopSimConfig, bCfg: TopSimConfig) => {
    const sim = createBattleSimulation({
      battleId: `test-inertia-${aCfg.name}-${bCfg.name}`,
      arenaId: 'standard',
      playerConfig: { ...aCfg, entityId: 'player' },
      opponentConfig: { ...bCfg, entityId: 'opponent' },
      aiPersonality: 'Defensive',
      aiDifficulty: 'Normal',
      startInPhase: 'Combat',
    });
    sim.disableAi = true;
    sim.player.x = -0.35;
    sim.player.z = 0;
    sim.player.vx = 3.2;
    sim.player.vz = 0;
    sim.opponent.x = 0.35;
    sim.opponent.z = 0;
    sim.opponent.vx = -3.2;
    sim.opponent.vz = 0;
    stepBattleSimulation(sim, FIXED_DT);
    return sim;
  };

  const heavyVsHeavy = runClash(heavyConfig, heavyConfig);
  const lightVsLight = runClash(lightConfig, lightConfig);
  assert.ok(heavyVsHeavy.collisionCount >= 1 && lightVsLight.collisionCount >= 1);
  assert.ok(
    heavyVsHeavy.cameraTrauma > lightVsLight.cameraTrauma,
    `Heavy collision must generate higher cameraTrauma (${heavyVsHeavy.cameraTrauma.toFixed(3)} vs ${lightVsLight.cameraTrauma.toFixed(3)})`
  );

  // Verify asymmetric heavy vs light collision deflects light top more tangentially/linearly
  const asym = runClash(heavyConfig, lightConfig);
  const heavySpdAfter = Math.hypot(asym.player.vx, asym.player.vz);
  const lightSpdAfter = Math.hypot(asym.opponent.vx, asym.opponent.vz);
  assert.ok(
    lightSpdAfter > heavySpdAfter,
    `Light top should rebound faster than heavy top (${lightSpdAfter.toFixed(2)} vs ${heavySpdAfter.toFixed(2)})`
  );

  // Compare Frozen vs Temple wall bounce restitution
  const testWallBounce = (arenaId: 'frozen' | 'temple') => {
    const sim = createBattleSimulation({
      battleId: `test-wall-${arenaId}`,
      arenaId,
      playerConfig: lightConfig,
      opponentConfig: { ...heavyConfig, entityId: 'opponent' },
      aiPersonality: 'Defensive',
      aiDifficulty: 'Normal',
      startInPhase: 'Combat',
    });
    sim.disableAi = true;
    sim.opponent.x = 0;
    sim.opponent.z = 0;
    sim.player.x = 3.64; // hits solid wall between gates (0 deg)
    sim.player.z = 0;
    sim.player.vx = 3.6;
    sim.player.vz = 0;
    stepBattleSimulation(sim, FIXED_DT);
    return Math.abs(sim.player.vx);
  };

  const frozenInward = testWallBounce('frozen');
  const templeInward = testWallBounce('temple');
  assert.ok(
    frozenInward > templeInward,
    `Frozen Dome wall restitution should rebound faster than Ancient Temple stone (${frozenInward.toFixed(2)} vs ${templeInward.toFixed(2)})`
  );
});




