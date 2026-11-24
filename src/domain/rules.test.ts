import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_DISH_RADIUS,
  LAUNCH_WINDOW_SECONDS,
  MAX_BATTLE_DURATION,
  TEAM_SWITCH_ENERGY_COST,
  addExperienceToTop,
  buildSortedLeaderboard,
  buildTournamentBracket,
  calculateAttributes,
  calculateBattleRewards,
  calculatePhysicalProfile,
  canEvolveTop,
  compareComponents,
  createDefaultCharacterProfile,
  createDefaultSaveData,
  evaluateBattleScoreBreakdown,
  getDualElementalMultiplier,
  getDurabilityBand,
  getElementalMultiplier,
  resolveStoryEnding,
  validateCharacterProfile,
  validateTopConfiguration,
} from './rules';
import {
  ARENAS,
  OPPONENTS,
  TOP_DEFINITIONS,
  getComponentDefinition,
  getOpponentDefinition,
  getTopDefinition,
  isFireAbility,
  isShieldAbility,
} from './catalog';
import { exportSaveToJson, importSaveFromJson } from '../infrastructure/persistence';
import { soundEngine } from '../audio/soundEngine';
import {
  REPLAY_WINDOW_SEC,
  resolveReplayCameraSegment,
  sampleReplayFrame,
  selectReplayWindowFrames,
} from './replay';
import { getPlayerActiveStatuses } from './statusManager';
import {
  FIXED_DT,
  LaunchHandedness,
  activateAbility,
  applyLaunchVelocities,
  applyStatDebuff,
  buildMatchHighlightClip,
  createBattleSimulation,
  evaluateDynamicHazardPosition,
  evaluateDynamicPillarState,
  setBattleMode,
  setLaunchAim,
  setTacticalCommand,
  stepBattleSimulation,
  switchPlayerTeamTop,
} from '../simulation/physicsEngine';

test('elemental interaction multiplier applies +15% / -10% across all 8 elements & dual resonance', () => {
  assert.equal(getElementalMultiplier('Fire', 'Ice'), 1.15);
  assert.equal(getElementalMultiplier('Fire', 'Water'), 0.9);
  assert.equal(getElementalMultiplier('Fire', 'Lightning'), 1.0);
  assert.equal(getElementalMultiplier('Lightning', 'Water'), 1.15);
  assert.equal(getElementalMultiplier('Shadow', 'Light'), 1.15);
  assert.equal(getElementalMultiplier('Wind', 'Earth'), 1.15);

  const dual = getDualElementalMultiplier('Fire', 'Earth', 'Ice', 'Lightning');
  assert.ok(dual > 1.05, 'Fire+Earth should gain positive dual resonance vs Ice+Lightning');
});

test('validateTopConfiguration accepts valid assemblies and rejects mismatched slots', () => {
  const starter = TOP_DEFINITIONS[0];
  assert.equal(validateTopConfiguration(starter.defaultComponents).valid, true);

  const invalid = {
    ...starter.defaultComponents,
    AttackBlade: 'core.ignis',
  };
  const res = validateTopConfiguration(invalid);
  assert.equal(res.valid, false);
  assert.ok(res.errors.length > 0);
});

test('different mechanical configurations produce distinct physical profiles & dual-element trade-off applies', () => {
  const ignis = getTopDefinition('top.ignis.drake');
  const aegis = getTopDefinition('top.aegis.titan');

  const fastPhys = calculatePhysicalProfile(ignis.id, ignis.defaultComponents, {}, 1, null);
  const heavyPhys = calculatePhysicalProfile(aegis.id, aegis.defaultComponents, {}, 1, null);
  const dualPhys = calculatePhysicalProfile(
    ignis.id,
    ignis.defaultComponents,
    {},
    1,
    null,
    undefined,
    'Shadow'
  );

  assert.ok(heavyPhys.totalMassKg > fastPhys.totalMassKg);
  assert.ok(heavyPhys.momentOfInertia > fastPhys.momentOfInertia);
  assert.ok(heavyPhys.maxDurability > fastPhys.maxDurability);
  assert.ok(fastPhys.accelerationForce > heavyPhys.accelerationForce);
  assert.ok(dualPhys.maxEnergy < fastPhys.maxEnergy, 'Dual element reduces max energy by 10%');
});

test('attribute calculation clamps between 1 and 100 and reflects upgrades', () => {
  const starter = TOP_DEFINITIONS[0];
  const baseAttrs = calculateAttributes(starter.id, starter.defaultComponents, {}, 1, null);
  const upgAttrs = calculateAttributes(
    starter.id,
    starter.defaultComponents,
    { [starter.defaultComponents.AttackBlade]: 4 },
    5,
    'evo.offensive'
  );
  assert.ok(upgAttrs.attack > baseAttrs.attack);
  assert.ok(upgAttrs.attack <= 100);
});

test('battle rewards are idempotent per battleId', () => {
  const first = calculateBattleRewards({
    battleId: 'battle-100',
    won: true,
    finishReason: 'BurstFinish',
    difficulty: 'Normal',
    isBoss: false,
    isTournament: true,
    durationSec: 32,
    processedBattleIds: [],
  });
  assert.equal(first.alreadyClaimed, false);
  assert.ok(first.gold > 100);
  assert.equal(first.evolutionTokens, 1);

  const duplicate = calculateBattleRewards({
    battleId: 'battle-100',
    won: true,
    finishReason: 'BurstFinish',
    difficulty: 'Normal',
    isBoss: false,
    isTournament: true,
    durationSec: 32,
    processedBattleIds: ['battle-100'],
  });
  assert.equal(duplicate.alreadyClaimed, true);
  assert.equal(duplicate.gold, 0);
  assert.equal(duplicate.xp, 0);
});

test('XP leveling and evolution eligibility enforce level & resource costs', () => {
  const save = createDefaultSaveData();
  const top = save.ownedTops[0];
  assert.equal(canEvolveTop(top, 'evo.offensive', save.currencies).eligible, false);

  const leveled = addExperienceToTop(top, 500);
  assert.ok(leveled.updated.level >= 3);
  assert.equal(canEvolveTop(leveled.updated, 'evo.offensive', save.currencies).eligible, true);
});

test('pure physics enforces no steering in standard play, allows debugOverride, and 5s auto-launch triggers cleanly', () => {
  const pTop = TOP_DEFINITIONS[0];
  const sTop = TOP_DEFINITIONS[1];
  const opp = getOpponentDefinition(OPPONENTS[0].id);
  const oppTop = getTopDefinition(opp.topId);

  const sim = createBattleSimulation({
    battleId: 'test-sim-1',
    arenaId: 'temple',
    playerConfig: {
      entityId: 'player',
      name: pTop.displayName,
      element: pTop.element,
      attributes: calculateAttributes(pTop.id, pTop.defaultComponents),
      physical: calculatePhysicalProfile(pTop.id, pTop.defaultComponents),
      abilities: pTop.defaultAbilities,
      initialMode: 'Attack',
      initialCommand: 'Aggressive',
      evolutionStage: 0,
    },
    playerTeamConfigs: [
      {
        entityId: 'player',
        name: pTop.displayName,
        element: pTop.element,
        attributes: calculateAttributes(pTop.id, pTop.defaultComponents),
        physical: calculatePhysicalProfile(pTop.id, pTop.defaultComponents),
        abilities: pTop.defaultAbilities,
        initialMode: 'Attack',
        initialCommand: 'Aggressive',
        evolutionStage: 0,
      },
      {
        entityId: 'player',
        name: sTop.displayName,
        element: sTop.element,
        attributes: calculateAttributes(sTop.id, sTop.defaultComponents),
        physical: calculatePhysicalProfile(sTop.id, sTop.defaultComponents),
        abilities: sTop.defaultAbilities,
        initialMode: 'Defense',
        initialCommand: 'Defensive',
        evolutionStage: 0,
      },
    ],
    opponentConfig: {
      entityId: 'opponent',
      name: oppTop.displayName,
      element: oppTop.element,
      attributes: calculateAttributes(oppTop.id, opp.components),
      physical: calculatePhysicalProfile(oppTop.id, opp.components),
      abilities: opp.abilities,
      initialMode: 'Speed',
      initialCommand: 'Circle',
      evolutionStage: 0,
    },
    aiPersonality: 'Adaptive',
    aiDifficulty: opp.difficulty,
    startInPhase: 'Launch',
  });

  // Aim reticle during 5s Launch phase, then let 5.0s countdown auto-launch
  assert.equal(sim.phase, 'Launch');
  setLaunchAim(sim, 1.5, -0.8);
  assert.equal(sim.launchSelection.aimSetByPlayer, true);

  const launchSteps = Math.ceil(LAUNCH_WINDOW_SECONDS / FIXED_DT) + 1;
  for (let i = 0; i < launchSteps; i++) {
    stepBattleSimulation(sim, FIXED_DT);
  }
  assert.equal(sim.phase, 'Combat', 'Simulation should auto-launch simultaneously after 5.0s');

  // Player CANNOT alter tactical command or battle mode in Pure Physics mode
  assert.equal(setTacticalCommand(sim, 'player', 'Chase'), false);
  assert.equal(setBattleMode(sim, 'player', 'Speed'), false);

  // Debug override explicitly permits command & mode switches
  assert.equal(setTacticalCommand(sim, 'player', 'Chase', { debugOverride: true }), true);
  assert.equal(setBattleMode(sim, 'player', 'Speed', { debugOverride: true }), true);

  // Team switch works during combat when energy >= 20
  assert.equal(switchPlayerTeamTop(sim, 1), true);
  assert.equal(sim.activeTeamIndex, 1);

  // Step simulation up to 95 seconds of simulated time
  const maxSteps = Math.ceil(95 / FIXED_DT);
  let abilityTried = false;
  for (let i = 0; i < maxSteps; i++) {
    stepBattleSimulation(sim, FIXED_DT);
    const currentPhase = sim.phase as string;
    if (!abilityTried && sim.player.energy >= 35 && (currentPhase === 'Combat' || currentPhase === 'Critical')) {
      abilityTried = activateAbility(sim, 'player', 0);
    }
    if (currentPhase === 'Results') break;
  }

  assert.equal(sim.phase, 'Results');
  assert.ok(sim.winnerSide === 'player' || sim.winnerSide === 'opponent');
  assert.ok(sim.finishReason !== null);
  assert.ok(sim.collisionCount > 0, 'Tops should collide at least once during battle');
  assert.equal(abilityTried, true, 'Player should be able to activate Slot 1 ability once energy fills');
});

test('applyLaunchVelocities enforces opposite launch arcs, blade wall clearance, and spiral convergence to center', () => {
  const pTop = TOP_DEFINITIONS[0];
  const opp = getOpponentDefinition(OPPONENTS[0].id);
  const oppTop = getTopDefinition(opp.topId);

  const makeSim = (id: string, handedness: LaunchHandedness = 'right') =>
    createBattleSimulation({
      battleId: id,
      arenaId: 'standard',
      launchHandedness: handedness,
      playerConfig: {
        entityId: 'player',
        name: pTop.displayName,
        element: pTop.element,
        attributes: calculateAttributes(pTop.id, pTop.defaultComponents),
        physical: calculatePhysicalProfile(pTop.id, pTop.defaultComponents),
        abilities: pTop.defaultAbilities,
        initialMode: 'Attack',
        initialCommand: 'Aggressive',
        evolutionStage: 0,
      },
      opponentConfig: {
        entityId: 'opponent',
        name: oppTop.displayName,
        element: oppTop.element,
        attributes: calculateAttributes(oppTop.id, opp.components),
        physical: calculatePhysicalProfile(oppTop.id, opp.components),
        abilities: opp.abilities,
        initialMode: 'Attack',
        initialCommand: 'Aggressive',
        evolutionStage: 0,
      },
      aiPersonality: opp.personality,
      aiDifficulty: opp.difficulty,
      startInPhase: 'Launch',
    });

  // Case A: Full 0..90 deg launch sector clamping on Right side ('right')
  const simA = makeSim('test-launch-right', 'right');
  const pSpawnR = Math.hypot(simA.player.x, simA.player.z);
  const oSpawnR = Math.hypot(simA.opponent.x, simA.opponent.z);
  assert.ok(pSpawnR >= 3.1 && pSpawnR < ARENA_DISH_RADIUS - 0.62, 'Player spawns cleanly on outer rim inside blade margin');
  assert.ok(oSpawnR >= 3.1 && oSpawnR < ARENA_DISH_RADIUS - 0.62, 'Opponent spawns cleanly on outer rim inside blade margin');

  const inwardA = Math.atan2(-simA.player.z, -simA.player.x);
  // Attempting forbidden Left side clamps smoothly to 0 deg (straight at center)
  setLaunchAim(simA, -0.5, -2.5);
  assert.ok(Math.abs(simA.launchSelection.angleRad - inwardA) < 0.02, 'Forbidden-side aim must clamp cleanly to 0 deg center line');

  // Aiming wide Right reaches full 90 deg (+pi/2)
  setLaunchAim(simA, simA.player.x + Math.cos(inwardA + Math.PI / 2) * 2.5, simA.player.z + Math.sin(inwardA + Math.PI / 2) * 2.5);
  assert.ok(
    Math.abs((simA.launchSelection.angleRad - inwardA) - Math.PI / 2) < 0.02,
    'Allowed-side aim must support full 90 degree (pi/2) sweep'
  );

  // Aiming at 60 deg Right vs Opponent CW spin gives strictly opposing orbital directions
  setLaunchAim(simA, simA.player.x + Math.cos(inwardA + 1.05) * 2.5, simA.player.z + Math.sin(inwardA + 1.05) * 2.5);
  applyLaunchVelocities(simA, 1.0);
  assert.equal(simA.phase, 'Combat');

  const initAngMomP = simA.player.x * simA.player.vz - simA.player.z * simA.player.vx;
  const initAngMomO = simA.opponent.x * simA.opponent.vz - simA.opponent.z * simA.opponent.vx;
  assert.ok(
    initAngMomP * initAngMomO < 0,
    'Player and Opponent must always launch in opposite orbital directions'
  );

  // Verify Left-handed online guest restricts to the opposite [0, -90 deg] sector
  const simLeft = makeSim('test-launch-left', 'left');
  setLaunchAim(
    simLeft,
    simLeft.player.x + Math.cos(inwardA - Math.PI / 2) * 2.5,
    simLeft.player.z + Math.sin(inwardA - Math.PI / 2) * 2.5
  );
  assert.ok(
    Math.abs((simLeft.launchSelection.angleRad - inwardA) + Math.PI / 2) < 0.02,
    'Left-handed guest must support full -90 degree sweep'
  );
  applyLaunchVelocities(simLeft, 0.9);
  const initAngMomLeft = simLeft.player.x * simLeft.player.vz - simLeft.player.z * simLeft.player.vx;
  assert.ok(initAngMomP * initAngMomLeft < 0, 'Left vs Right launch handedness must always oppose each other');

  // Step combat over 7s and confirm blades NEVER exceed inner wall clearance and tops spiral inward to collide
  let maxObservedR = 0;
  for (let i = 0; i < 350; i++) {
    stepBattleSimulation(simA, FIXED_DT);
    maxObservedR = Math.max(
      maxObservedR,
      Math.hypot(simA.player.x, simA.player.z),
      Math.hypot(simA.opponent.x, simA.opponent.z)
    );
  }
  assert.ok(
    maxObservedR <= ARENA_DISH_RADIUS - 0.6,
    `Tops must never clip past wall blade clearance (got maxR=${maxObservedR.toFixed(2)})`
  );
  assert.ok(simA.collisionCount > 0, 'Opposite-spinning spiral tops must converge and collide');

  // Verify unopposed pure-kinematic spiral settles near center without sticking to outer rim
  const soloSim = makeSim('test-solo-spiral', 'right');
  soloSim.isOnlineRemote = true;
  soloSim.opponent.physical.effectiveRadiusM = -99;
  soloSim.player.physical.effectiveRadiusM = 0.44;
  setLaunchAim(soloSim, soloSim.player.x + Math.cos(inwardA + Math.PI / 2) * 2.5, soloSim.player.z + Math.sin(inwardA + Math.PI / 2) * 2.5);
  applyLaunchVelocities(soloSim, 0.9);
  for (let i = 0; i < 650; i++) {
    soloSim.opponent.omega = 120;
    soloSim.opponent.staminaRatio = 1;
    stepBattleSimulation(soloSim, FIXED_DT);
  }
  const endRP = Math.hypot(soloSim.player.x, soloSim.player.z);
  assert.ok(
    endRP < 0.65,
    `Unopposed 90-deg launch must spiral steadily inward to center pocket (endR=${endRP.toFixed(2)})`
  );
});

test('tournament brackets, component comparison, durability bands, and JSON save roundtrip', () => {
  const bracket8 = buildTournamentBracket(8);
  assert.equal(bracket8.opponentIds.length, 8);
  assert.equal(bracket8.arenaIds.length, 8);

  const bracket16 = buildTournamentBracket(16);
  assert.equal(bracket16.opponentIds.length, 16);

  const compA = getComponentDefinition('blade.ember');
  const compB = getComponentDefinition('blade.celestial_scythe');
  const diff = compareComponents(compA, compB);
  assert.ok(diff.massDeltaGrams > 0);
  assert.ok(diff.durabilityDelta > 0);

  assert.equal(getDurabilityBand(100), 'Normal');
  assert.equal(getDurabilityBand(60), 'Minor');
  assert.equal(getDurabilityBand(35), 'Reduced');
  assert.equal(getDurabilityBand(12), 'Critical');
  assert.equal(getDurabilityBand(0), 'Failed');

  const save = createDefaultSaveData();
  save.playerScore = 1337;
  const json = exportSaveToJson(save);
  const parsed = importSaveFromJson(json);
  assert.ok(parsed.save !== null);
  assert.equal(parsed.save?.playerScore, 1337);
});

test('new save starts at 0 score and character creator validates & boosts attributes', () => {
  const save = createDefaultSaveData();
  assert.equal(save.playerScore, 0);
  assert.equal(save.discoveredSecrets.length, 0);
  assert.equal(save.character.created, false);

  const validChar = {
    ...createDefaultCharacterProfile(),
    created: true,
    name: 'Kael Vance',
    stats: { strength: 10, agility: 8, focus: 7, luck: 7 },
  };
  assert.equal(validateCharacterProfile(validChar).valid, true);

  const overBudget = {
    ...validChar,
    stats: { strength: 12, agility: 12, focus: 12, luck: 12 },
  };
  assert.equal(validateCharacterProfile(overBudget).valid, false);

  const starter = TOP_DEFINITIONS[0];
  const baseAttrs = calculateAttributes(starter.id, starter.defaultComponents);
  const boostedAttrs = calculateAttributes(
    starter.id,
    starter.defaultComponents,
    {},
    1,
    null,
    validChar.stats
  );
  assert.ok(boostedAttrs.attack > baseAttrs.attack);
  assert.ok(boostedAttrs.speed > baseAttrs.speed);
  assert.ok(boostedAttrs.critical > baseAttrs.critical);
});

test('battle scoring awards action points and detects secrets idempotently', () => {
  const breakdown = evaluateBattleScoreBreakdown({
    won: true,
    finishReason: 'RingOut',
    difficulty: 'Normal',
    isBoss: false,
    isTournament: true,
    collisionCount: 5,
    abilitiesUsed: 2,
    launchQuality: 1.16,
    playerRemainingStamina: 28,
    playerRemainingDurability: 55,
    discoveredSecrets: [],
    alreadyClaimed: false,
  });

  assert.ok(breakdown.totalPointsEarned > 500);
  assert.ok(breakdown.newlyDiscoveredSecrets.includes('secret.perfect_ripcord'));
  assert.ok(breakdown.newlyDiscoveredSecrets.includes('secret.ring_out_gate'));
  assert.ok(breakdown.newlyDiscoveredSecrets.includes('secret.critical_comeback'));

  const repeat = evaluateBattleScoreBreakdown({
    won: true,
    finishReason: 'RingOut',
    difficulty: 'Normal',
    isBoss: false,
    isTournament: true,
    collisionCount: 5,
    abilitiesUsed: 2,
    launchQuality: 1.16,
    playerRemainingStamina: 28,
    playerRemainingDurability: 55,
    discoveredSecrets: breakdown.newlyDiscoveredSecrets,
    alreadyClaimed: true,
  });
  assert.equal(repeat.totalPointsEarned, 0);
  assert.equal(repeat.newlyDiscoveredSecrets.length, 0);
});

test('leaderboard ranks player score dynamically and key decisions drive good/bad/neutral endings', () => {
  const save = createDefaultSaveData();
  save.character.name = 'Arya Blaze';
  save.playerScore = 2400;
  save.discoveredSecrets = [
    'secret.perfect_ripcord',
    'secret.ring_out_gate',
    'secret.stadium_cipher',
  ];

  const ranked = buildSortedLeaderboard(save);
  assert.ok(ranked.length >= 6);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].score >= ranked[i].score);
  }
  assert.ok(ranked.some((e) => e.isPlayer && e.name === 'Arya Blaze' && e.score === 2400));

  const goodDecisions = {
    'decision.syndicate_core': 'choice.report_guild',
    'decision.rival_chassis': 'choice.share_alloy',
    'decision.stadium_throne': 'choice.open_academy',
  };
  assert.equal(
    resolveStoryEnding({
      decisionHistory: goodDecisions,
      playerScore: 800,
      discoveredSecrets: [],
    }).type,
    'good'
  );
  assert.equal(
    resolveStoryEnding({
      decisionHistory: goodDecisions,
      playerScore: 2400,
      discoveredSecrets: save.discoveredSecrets,
    }).type,
    'legend'
  );

  assert.equal(
    resolveStoryEnding({
      decisionHistory: {
        'decision.syndicate_core': 'choice.install_core',
        'decision.rival_chassis': 'choice.target_fracture',
        'decision.stadium_throne': 'choice.claim_monopoly',
      },
      playerScore: 2400,
      discoveredSecrets: [],
    }).type,
    'bad'
  );

  assert.equal(
    resolveStoryEnding({
      decisionHistory: {
        'decision.syndicate_core': 'choice.seal_vault',
        'decision.rival_chassis': 'choice.request_inspection',
        'decision.stadium_throne': 'choice.seal_and_wander',
      },
      playerScore: 1500,
      discoveredSecrets: [],
    }).type,
    'neutral'
  );
});

test('non-focal stadium bowl separates 0°, 45°, and 90° launch trajectories instead of collapsing to one endpoint', () => {
  const pTop = TOP_DEFINITIONS[0];
  const opp = getOpponentDefinition(OPPONENTS[0].id);
  const oppTop = getTopDefinition(opp.topId);

  const sampleAtAngle = (offsetRad: number) => {
    const sim = createBattleSimulation({
      battleId: `traj-${offsetRad.toFixed(2)}`,
      arenaId: 'standard',
      launchHandedness: 'right',
      playerConfig: {
        entityId: 'player',
        name: pTop.displayName,
        element: pTop.element,
        attributes: calculateAttributes(pTop.id, pTop.defaultComponents),
        physical: calculatePhysicalProfile(pTop.id, pTop.defaultComponents),
        abilities: pTop.defaultAbilities,
        initialMode: 'Attack',
        initialCommand: 'Aggressive',
        evolutionStage: 0,
      },
      opponentConfig: {
        entityId: 'opponent',
        name: oppTop.displayName,
        element: oppTop.element,
        attributes: calculateAttributes(oppTop.id, opp.components),
        physical: calculatePhysicalProfile(oppTop.id, opp.components),
        abilities: opp.abilities,
        initialMode: 'Attack',
        initialCommand: 'Aggressive',
        evolutionStage: 0,
      },
      aiPersonality: opp.personality,
      aiDifficulty: opp.difficulty,
      startInPhase: 'Launch',
    });
    sim.isOnlineRemote = true;
    sim.opponent.physical.effectiveRadiusM = -99;
    sim.player.physical.effectiveRadiusM = 0.44;
    const inwardA = Math.atan2(-sim.player.z, -sim.player.x);
    setLaunchAim(
      sim,
      sim.player.x + Math.cos(inwardA + offsetRad) * 2.5,
      sim.player.z + Math.sin(inwardA + offsetRad) * 2.5
    );
    applyLaunchVelocities(sim, 0.85);
    for (let i = 0; i < 95; i++) {
      sim.opponent.omega = 120;
      sim.opponent.staminaRatio = 1;
      stepBattleSimulation(sim, FIXED_DT);
    }
    return { x: sim.player.x, z: sim.player.z, r: Math.hypot(sim.player.x, sim.player.z) };
  };

  const p0 = sampleAtAngle(0);
  const p45 = sampleAtAngle(Math.PI / 4);
  const p90 = sampleAtAngle(Math.PI / 2);

  const dist0To45 = Math.hypot(p0.x - p45.x, p0.z - p45.z);
  const dist45To90 = Math.hypot(p45.x - p90.x, p45.z - p90.z);
  const dist0To90 = Math.hypot(p0.x - p90.x, p0.z - p90.z);

  assert.ok(dist0To45 > 0.45, `0° and 45° must diverge cleanly (got ${dist0To45.toFixed(2)}m)`);
  assert.ok(dist45To90 > 0.45, `45° and 90° must diverge cleanly (got ${dist45To90.toFixed(2)}m)`);
  assert.ok(dist0To90 > 0.9, `0° and 90° must reach widely separated points (got ${dist0To90.toFixed(2)}m)`);
  assert.ok(p90.r > 2.0, `90° outer sweep should stay on wide orbit at t=1.9s (got r=${p90.r.toFixed(2)}m)`);
});

test('dynamic arena pillars/traps move over time, apply temporary stat debuffs, and Match Highlights records final blow', () => {
  const templeArena = ARENAS.temple;
  const movingPillar = templeArena.pillars.find((p) => Boolean(p.motion));
  const movingTrap = templeArena.hazardZones.find((h) => Boolean(h.motion));
  assert.ok(movingPillar, 'Temple arena must include at least one dynamic moving pillar');
  assert.ok(movingTrap, 'Temple arena must include at least one dynamic trap zone');

  const pT0 = evaluateDynamicPillarState(movingPillar, 0);
  const pT2 = evaluateDynamicPillarState(movingPillar, 2.0);
  assert.ok(Math.hypot(pT2.x - pT0.x, pT2.z - pT0.z) > 0.5, 'Dynamic pillar position must change over time');

  const hT0 = evaluateDynamicHazardPosition(movingTrap, 0);
  const hT2 = evaluateDynamicHazardPosition(movingTrap, 2.0);
  assert.ok(Math.hypot(hT2.x - hT0.x, hT2.z - hT0.z) > 0.3, 'Dynamic trap zone must move over time');

  const pTop = TOP_DEFINITIONS[0];
  const opp = getOpponentDefinition(OPPONENTS[0].id);
  const oppTop = getTopDefinition(opp.topId);

  const sim = createBattleSimulation({
    battleId: 'test-highlights-debuff',
    arenaId: 'temple',
    playerConfig: {
      entityId: 'player',
      name: pTop.displayName,
      element: pTop.element,
      attributes: calculateAttributes(pTop.id, pTop.defaultComponents),
      physical: calculatePhysicalProfile(pTop.id, pTop.defaultComponents),
      abilities: pTop.defaultAbilities,
      initialMode: 'Attack',
      initialCommand: 'Aggressive',
      evolutionStage: 0,
    },
    opponentConfig: {
      entityId: 'opponent',
      name: oppTop.displayName,
      element: oppTop.element,
      attributes: calculateAttributes(oppTop.id, opp.components),
      physical: calculatePhysicalProfile(oppTop.id, opp.components),
      abilities: opp.abilities,
      initialMode: 'Attack',
      initialCommand: 'Aggressive',
      evolutionStage: 0,
    },
    aiPersonality: opp.personality,
    aiDifficulty: opp.difficulty,
    startInPhase: 'Combat',
  });

  // Placing player top inside moving Quicksand trap triggers DragSnare debuff automatically
  const trapPos = evaluateDynamicHazardPosition(movingTrap, sim.elapsedTime);
  sim.player.x = trapPos.x;
  sim.player.z = trapPos.z;
  stepBattleSimulation(sim, FIXED_DT);
  assert.ok(
    sim.player.statDebuffs.some((d) => d.kind === (movingTrap.debuffKind ?? 'DragSnare')),
    'Passing through dynamic trap zone must trigger its stat debuff'
  );

  // Move out of hazard zone and verify debuff expires cleanly after its duration
  sim.arenaId = 'standard';
  sim.player.statDebuffs = [];
  applyStatDebuff(sim, sim.player, 'ArmorCorrosion', 1.2, 'CORRODED');
  assert.equal(sim.player.statDebuffs.length, 1);
  assert.ok(sim.player.statDebuffs[0].defenseMult < 1);

  for (let i = 0; i < 65; i++) {
    stepBattleSimulation(sim, FIXED_DT);
  }
  assert.equal(sim.player.statDebuffs.length, 0, 'Temporary stat debuff must expire cleanly after duration');
  sim.arenaId = 'temple';

  // Run battle until conclusion and verify Match Highlights clip contains final blow frames
  for (let i = 0; i < 4500 && sim.phase !== 'Finish' && sim.phase !== 'Results'; i++) {
    stepBattleSimulation(sim, FIXED_DT);
  }
  assert.ok(sim.phase === 'Finish' || sim.phase === 'Results');
  const clip = buildMatchHighlightClip(sim);
  assert.ok(clip, 'Match Highlights clip should be built at battle end');
  assert.ok(clip.frames.length >= 10, `Expected >=10 highlight frames, got ${clip.frames.length}`);
  assert.ok(
    Boolean(clip.frames[clip.frames.length - 1].eventLabel),
    'Final frame of Match Highlights clip should carry final blow label'
  );

  // Verify slow-motion replay window, 3-angle broadcast cuts, and interpolation
  const replayWindow = selectReplayWindowFrames(clip, REPLAY_WINDOW_SEC);
  assert.ok(replayWindow.length >= 2, 'Replay window should include at least 2 frames');
  const windowSpan = replayWindow[replayWindow.length - 1].t - replayWindow[0].t;
  assert.ok(
    windowSpan <= REPLAY_WINDOW_SEC + 0.15,
    `Replay window span (${windowSpan.toFixed(2)}s) should focus on final seconds`
  );

  const seg0 = resolveReplayCameraSegment(0.15);
  const seg1 = resolveReplayCameraSegment(0.5);
  const seg2 = resolveReplayCameraSegment(0.85);
  assert.equal(seg0.index, 0);
  assert.equal(seg0.code, 'CAM 01');
  assert.equal(seg1.index, 1);
  assert.equal(seg1.code, 'CAM 02');
  assert.equal(seg2.index, 2);
  assert.equal(seg2.code, 'CAM 03');

  const midSample = sampleReplayFrame(replayWindow, windowSpan * 0.5);
  assert.ok(midSample.progress > 0.45 && midSample.progress < 0.55);
  assert.ok(Number.isFinite(midSample.frame.px) && Number.isFinite(midSample.frame.ox));
});

test('Match highlight recording and replay frame sampling preserve active power states (shield, fire, ability slots) and dynamic weather audio', () => {
  const pTop = TOP_DEFINITIONS[0];
  const opp = getOpponentDefinition(OPPONENTS[0].id);
  const oppTop = getTopDefinition(opp.topId);

  const sim = createBattleSimulation({
    battleId: 'test-sim-active-powers',
    arenaId: 'frozen',
    weather: 'DustStorm',
    playerConfig: {
      entityId: 'player',
      name: pTop.displayName,
      element: pTop.element,
      attributes: calculateAttributes(pTop.id, pTop.defaultComponents),
      physical: calculatePhysicalProfile(pTop.id, pTop.defaultComponents),
      abilities: [
        'ability.fire.flame_burst',
        'ability.def.aegis_barrier',
        'ability.tac.slipstream_evade',
        'ability.ult.inferno_nova',
      ],
      initialMode: 'Attack',
      initialCommand: 'Aggressive',
      evolutionStage: 0,
    },
    opponentConfig: {
      entityId: 'opponent',
      name: oppTop.displayName,
      element: oppTop.element,
      attributes: calculateAttributes(oppTop.id, opp.components),
      physical: calculatePhysicalProfile(oppTop.id, opp.components),
      abilities: opp.abilities,
      initialMode: 'Defense',
      initialCommand: 'Defensive',
      evolutionStage: 0,
    },
    aiPersonality: 'Adaptive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
    disableAi: true,
  });

  assert.equal(sim.phase, 'Combat');

  // Verify unified catalog helpers
  assert.equal(isFireAbility('ability.fire.flame_burst'), true);
  assert.equal(isFireAbility('ability.ult.inferno_nova'), true);
  assert.equal(isShieldAbility('ability.def.aegis_barrier'), true);
  assert.equal(isShieldAbility('ability.light.radiant_shield'), true);
  assert.equal(isShieldAbility('ability.fire.flame_burst'), false);

  // Activate flame burst (slot 0) — should NOT self-inflict Burn or mark slot 3 Fire Ultimate active
  sim.player.energy = 50;
  const activatedFire = activateAbility(sim, 'player', 0);
  assert.ok(activatedFire, 'Flame burst should activate cleanly');
  assert.equal(
    sim.player.statuses.some((s) => s.type === 'Burn'),
    false,
    'Casting Flame Burst must not self-inflict Burn debuff onto the caster'
  );
  const fireTriggerFrame = sim.highlightFrames[sim.highlightFrames.length - 1];
  assert.equal(fireTriggerFrame.isCritical, false, 'Standard ability should not force isCritical');
  assert.deepEqual(fireTriggerFrame.pActiveSlots, [true, false, false, false]);
  assert.equal(fireTriggerFrame.pFire, true);

  // Activate shield (slot 1)
  sim.player.energy = 50;
  const activatedShield = activateAbility(sim, 'player', 1);
  assert.ok(activatedShield, 'Aegis barrier should activate cleanly');

  // Step simulation a few ticks
  for (let i = 0; i < 10; i++) {
    stepBattleSimulation(sim, FIXED_DT);
  }

  // Verify frames recorded active shield and fire states and isolated per-slot flags
  const activeFrames = sim.highlightFrames.filter(
    (f) =>
      f.pFire &&
      f.pShield &&
      f.pActiveSlots?.[0] === true &&
      f.pActiveSlots?.[1] === true &&
      f.pActiveSlots?.[3] === false
  );
  assert.ok(
    activeFrames.length >= 1,
    'Highlight frames must record pFire, pShield, and exact per-slot active flags without lighting unused Fire slots'
  );

  // Sample replay frame from recorded window and verify active power + resource retention
  const clip = buildMatchHighlightClip(sim);
  assert.ok(clip, 'Clip must be built');
  const replayFrames = selectReplayWindowFrames(clip, 2.5);
  const sampled = sampleReplayFrame(replayFrames, 0.2);
  assert.ok(
    sampled.frame.pFire || sampled.frame.pShield,
    'Sampled replay frame must retain active fire or shield state'
  );
  assert.deepEqual(
    sampled.frame.pActiveSlots,
    [true, true, false, false],
    'Sampled frame must preserve isolated active slot flags [true, true, false, false]'
  );
  assert.ok(
    typeof sampled.frame.pEnergyPct === 'number' && typeof sampled.frame.pResonance === 'number',
    'Sampled frame must retain interpolated energy & resonance telemetry'
  );

  // Verify opponent perspective highlight clip flips per-slot & resource fields cleanly
  const oppClip = buildMatchHighlightClip(sim, 'opponent');
  assert.ok(oppClip, 'Opponent clip must be built');
  const oppActiveFrame = oppClip.frames.find((f) => f.oShield && f.oFire);
  assert.ok(oppActiveFrame, 'Opponent perspective must preserve flipped oShield/oFire');
  assert.deepEqual(oppActiveFrame.oActiveSlots, [true, true, false, false]);

  // Test dynamic weather audio state transitions & forceApply path cleanly
  soundEngine.setWeatherAmbiance('DustStorm', true);
  soundEngine.updateWeatherDynamics(0.04, 1.2);
  soundEngine.updateWeatherDynamics(0.04, 1.2);
  soundEngine.setMuted(true);
  soundEngine.setMuted(false);
  soundEngine.setWeatherAmbiance('LightRain', true, true);
  soundEngine.updateWeatherDynamics(0.08, 1.0);
  soundEngine.setWeatherAmbiance('GaleWind', true);
  soundEngine.updateWeatherDynamics(0.08, 1.4);
  soundEngine.setWeatherAmbiance('Clear', false);
});

test('getPlayerActiveStatuses unifies sim/HUD status resolution and replay preserves brokenParts, partDurability, and statDebuffs', () => {
  const pTop = TOP_DEFINITIONS[0];
  const opp = getOpponentDefinition(OPPONENTS[0].id);
  const oppTop = getTopDefinition(opp.topId);

  const sim = createBattleSimulation({
    battleId: 'test-status-manager-replay-details',
    arenaId: 'temple',
    playerConfig: {
      entityId: 'player',
      name: pTop.displayName,
      element: pTop.element,
      attributes: calculateAttributes(pTop.id, pTop.defaultComponents),
      physical: calculatePhysicalProfile(pTop.id, pTop.defaultComponents),
      abilities: [
        'ability.fire.flame_burst',
        'ability.def.aegis_barrier',
        'ability.tac.slipstream_evade',
        'ability.ult.inferno_nova',
      ],
      initialMode: 'Attack',
      initialCommand: 'Aggressive',
      evolutionStage: 0,
    },
    opponentConfig: {
      entityId: 'opponent',
      name: oppTop.displayName,
      element: oppTop.element,
      attributes: calculateAttributes(oppTop.id, opp.components),
      physical: calculatePhysicalProfile(oppTop.id, opp.components),
      abilities: opp.abilities,
      initialMode: 'Defense',
      initialCommand: 'Defensive',
      evolutionStage: 0,
    },
    aiPersonality: 'Adaptive',
    aiDifficulty: 'Normal',
    startInPhase: 'Combat',
    disableAi: true,
  });

  // Rival inflicts Burn debuff on player while no Fire slot is channeled
  sim.player.statuses.push({ type: 'Burn', remainingSec: 2.5, strength: 1 });
  const simBurnOnly = getPlayerActiveStatuses(sim.player);
  assert.equal(simBurnOnly.isFireActive, true);
  assert.deepEqual(simBurnOnly.activeSlotFlags, [false, false, false, false]);
  assert.equal(simBurnOnly.slotEffects[0].isFire, false);
  assert.equal(simBurnOnly.slotEffects[3].isFire, false);

  // HUD shape with Burn status + active slot 1 Shield checks cleanly without lighting Fire slots
  const hudStatus = getPlayerActiveStatuses({
    statuses: ['Burn'],
    slots: [
      { abilityId: 'ability.fire.flame_burst', active: 0 },
      { abilityId: 'ability.def.aegis_barrier', active: 1.5 },
      { abilityId: 'ability.tac.slipstream_evade', active: 0 },
      { abilityId: 'ability.ult.inferno_nova', active: 0 },
    ],
  });
  assert.equal(hudStatus.isFireActive, true);
  assert.equal(hudStatus.isShieldActive, true);
  assert.deepEqual(hudStatus.activeSlotFlags, [false, true, false, false]);
  assert.equal(hudStatus.slotEffects[0].isFire, false);
  assert.equal(hudStatus.slotEffects[1].isShield, true);
  assert.equal(hudStatus.slotEffects[3].isFire, false);

  // Simulate mid-match single-part break, part durability drop, and stat debuff countdown
  sim.player.partDurability.AttackBlade = 0;
  sim.player.brokenParts = ['AttackBlade'];
  sim.opponent.partDurability.ArmorRing = 42;
  applyStatDebuff(sim, sim.player, 'DragSnare', 2.4, 'SNARED');
  applyStatDebuff(sim, sim.opponent, 'ArmorCorrosion', 1.8, 'CORRODED');

  for (let i = 0; i < 8; i++) {
    stepBattleSimulation(sim, FIXED_DT);
  }

  const clip = buildMatchHighlightClip(sim);
  assert.ok(clip, 'Highlight clip must be built');
  const sampled = sampleReplayFrame(clip.frames, 0.05);
  assert.ok(
    sampled.frame.pBrokenParts?.includes('AttackBlade'),
    'Sampled replay frame must preserve mid-match brokenParts'
  );
  assert.equal(
    sampled.frame.pPartDurability?.AttackBlade,
    0,
    'Sampled replay frame must preserve player partDurability'
  );
  assert.ok(
    typeof sampled.frame.oPartDurability?.ArmorRing === 'number' &&
      sampled.frame.oPartDurability.ArmorRing <= 50,
    'Sampled replay frame must preserve opponent partDurability'
  );
  assert.ok(
    sampled.frame.pStatDebuffs?.some((d) => d.kind === 'DragSnare' && d.remainingSec > 0),
    'Sampled replay frame must preserve player statDebuffs with positive countdown'
  );
  assert.ok(
    sampled.frame.oStatDebuffs?.some((d) => d.kind === 'ArmorCorrosion' && d.remainingSec > 0),
    'Sampled replay frame must preserve opponent statDebuffs with positive countdown'
  );

  // Opponent perspective must swap brokenParts, partDurability, and statDebuffs
  const oppClip = buildMatchHighlightClip(sim, 'opponent');
  assert.ok(oppClip, 'Opponent clip must be built');
  const oppLast = oppClip.frames[oppClip.frames.length - 1];
  assert.ok(oppLast.oBrokenParts?.includes('AttackBlade'));
  assert.equal(oppLast.oPartDurability?.AttackBlade, 0);
  assert.ok(oppLast.pStatDebuffs?.some((d) => d.kind === 'ArmorCorrosion'));
});

test('shared arena/battle constants live in domain/rules and soundEngine.dispose stops continuous nodes and closes AudioContext', () => {
  assert.equal(ARENA_DISH_RADIUS, 4.25);
  assert.equal(MAX_BATTLE_DURATION, 90);
  assert.equal(LAUNCH_WINDOW_SECONDS, 5.0);
  assert.equal(TEAM_SWITCH_ENERGY_COST, 20);

  let stopCalls = 0;
  let disconnectCalls = 0;
  let closeCalls = 0;

  const makeParam = () => ({
    value: 0,
    setTargetAtTime: () => {},
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
  });

  const makeSource = () => ({
    type: 'sine',
    buffer: null as AudioBuffer | null,
    loop: false,
    frequency: makeParam(),
    connect: () => {},
    disconnect: () => {
      disconnectCalls += 1;
    },
    start: () => {},
    stop: () => {
      stopCalls += 1;
    },
  });

  class MockAudioContext {
    public state: AudioContextState = 'running';
    public sampleRate = 48000;
    public currentTime = 0;
    public destination = {};
    public createGain() {
      return {
        gain: makeParam(),
        connect: () => {},
        disconnect: () => {
          disconnectCalls += 1;
        },
      };
    }
    public createBiquadFilter() {
      return {
        type: 'bandpass',
        frequency: makeParam(),
        Q: makeParam(),
        connect: () => {},
        disconnect: () => {
          disconnectCalls += 1;
        },
      };
    }
    public createOscillator() {
      return makeSource();
    }
    public createBuffer(_channels: number, length: number) {
      return {
        getChannelData: () => new Float32Array(length),
      };
    }
    public createBufferSource() {
      return makeSource();
    }
    public close() {
      closeCalls += 1;
      this.state = 'closed';
      return Promise.resolve();
    }
    public resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    public suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
  }

  const g = globalThis as unknown as {
    window?: { AudioContext?: unknown };
  };
  const prevWindow = g.window;
  g.window = { AudioContext: MockAudioContext };

  try {
    soundEngine.unlock();
    assert.equal(soundEngine.isAudioInitialized, true);
    soundEngine.setWeatherAmbiance('DustStorm', true);

    soundEngine.dispose();
    assert.equal(soundEngine.isAudioInitialized, false);
    assert.equal(stopCalls, 4, 'dispose must stop spinOsc1, spinOsc2, weatherLfo, and weatherNoiseSource');
    assert.ok(disconnectCalls >= 10, 'dispose must disconnect continuous audio graph nodes');
    assert.equal(closeCalls, 1, 'dispose must close the AudioContext');

    // Idempotent second dispose & clean re-unlock
    soundEngine.dispose();
    assert.equal(closeCalls, 1);
    soundEngine.unlock();
    assert.equal(soundEngine.isAudioInitialized, true);
    soundEngine.dispose();
  } finally {
    g.window = prevWindow;
  }
});
