import {
  ARENAS,
  COMPONENTS,
  ELEMENTS,
  ENDINGS_CATALOG,
  MISSIONS_CATALOG,
  OPPONENTS,
  SECRETS_CATALOG,
  TOP_DEFINITIONS,
  VICTORY_EMOTES,
  WEATHERS,
} from './catalog';
import {
  CHARACTER_BASE_STAT,
  CHARACTER_MAX_STAT,
  MAX_CAPACITOR_LEVEL,
  MAX_COMPONENT_UPGRADE_LEVEL,
  SAVE_SCHEMA_VERSION,
  buildTournamentBracket,
  createDefaultCharacterProfile,
  createDefaultCosmetics,
  createDefaultKeyBindings,
  createDefaultSaveData,
  createEmptyCareerStats,
  getCounterElementFor,
  getCurrentDailyResetKey,
  sanitizeBattleMutators,
  validateTopConfiguration,
} from './rules';
import type {
  ArenaId,
  ElementType,
  MatchHistoryEntry,
  PlayerSaveData,
  RivalRecord,
  VictoryEmoteId,
  WeatherType,
} from './types';

function clampFiniteInt(val: unknown, min: number, max: number, fallback = min): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function sanitizeAndMigrateSave(raw: unknown): PlayerSaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<PlayerSaveData>;
  const defaults = createDefaultSaveData();

  if (typeof data.schemaVersion !== 'number' || !Number.isFinite(data.schemaVersion)) return null;
  if (!Array.isArray(data.ownedTops) || data.ownedTops.length === 0) return null;

  const validComponentIds = new Set(COMPONENTS.map((c) => c.id));
  const validTopIds = new Set(TOP_DEFINITIONS.map((t) => t.id));
  const validElementIds = new Set(Object.keys(ELEMENTS));
  const validArenaIds = new Set(Object.keys(ARENAS));

  const cleanedTops = data.ownedTops
    .filter((t) => t && validTopIds.has(t.definitionId))
    .slice(0, 64)
    .map((t) => {
      const def = TOP_DEFINITIONS.find((d) => d.id === t.definitionId) ?? TOP_DEFINITIONS[0];
      const elem = ELEMENTS[def.element];
      const check = t.equippedComponents ? validateTopConfiguration(t.equippedComponents) : { valid: false };
      return {
        ...t,
        instanceId:
          typeof t.instanceId === 'string' && t.instanceId.trim().length > 0
            ? t.instanceId.trim().slice(0, 64)
            : `owned-${def.id}`,
        level: clampFiniteInt(t.level, 1, 50, 1),
        experience: clampFiniteInt(t.experience, 0, 500_000, 0),
        evolutionStage: t.evolutionStage === 1 ? 1 : 0,
        secondaryElement:
          t.secondaryElement && validElementIds.has(t.secondaryElement) ? t.secondaryElement : null,
        equippedComponents: check.valid ? t.equippedComponents : { ...def.defaultComponents },
        equippedAbilities:
          Array.isArray(t.equippedAbilities) && t.equippedAbilities.length === 4
            ? (t.equippedAbilities as [string, string, string, string])
            : ([...def.defaultAbilities] as [string, string, string, string]),
        cosmetics: t.cosmetics
          ? {
              ...createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
              ...t.cosmetics,
              victoryEmote: VICTORY_EMOTES.some((v) => v.id === t.cosmetics?.victoryEmote)
                ? (t.cosmetics.victoryEmote as VictoryEmoteId)
                : 'apex_flare',
            }
          : createDefaultCosmetics(elem.primaryColor, elem.secondaryColor),
        wins: clampFiniteInt(t.wins, 0, 100_000, 0),
        losses: clampFiniteInt(t.losses, 0, 100_000, 0),
        careerStats: t.careerStats
          ? {
              ...createEmptyCareerStats(),
              ...t.careerStats,
              matches: clampFiniteInt(t.careerStats.matches, 0, 200_000, 0),
              wins: clampFiniteInt(t.careerStats.wins, 0, 100_000, 0),
              losses: clampFiniteInt(t.careerStats.losses, 0, 100_000, 0),
              totalClashes: clampFiniteInt(t.careerStats.totalClashes, 0, 10_000_000, 0),
              peakImpulse: Number.isFinite(Number(t.careerStats.peakImpulse))
                ? Math.max(0, Math.min(500, Number(t.careerStats.peakImpulse)))
                : 0,
            }
          : {
              ...createEmptyCareerStats(),
              matches: clampFiniteInt(t.wins, 0, 100_000, 0) + clampFiniteInt(t.losses, 0, 100_000, 0),
              wins: clampFiniteInt(t.wins, 0, 100_000, 0),
              losses: clampFiniteInt(t.losses, 0, 100_000, 0),
            },
      };
    });

  if (cleanedTops.length === 0) return null;

  const selectedExists = cleanedTops.some((t) => t.instanceId === data.selectedTopInstanceId);
  const validSecretIds = new Set(SECRETS_CATALOG.map((s) => s.id));
  const validEndingIds = new Set(ENDINGS_CATALOG.map((e) => e.id));
  const defaultChar = createDefaultCharacterProfile();
  const rawChar = data.character;
  const clampStat = (v: unknown) => clampFiniteInt(v, CHARACTER_BASE_STAT, CHARACTER_MAX_STAT, CHARACTER_BASE_STAT);

  const sanitizedChar =
    rawChar && typeof rawChar === 'object'
      ? {
          created: Boolean(rawChar.created),
          name:
            typeof rawChar.name === 'string' && rawChar.name.trim().length >= 2
              ? rawChar.name.trim().slice(0, 24)
              : defaultChar.name,
          title:
            typeof rawChar.title === 'string' && rawChar.title.trim().length > 0
              ? rawChar.title.trim().slice(0, 28)
              : defaultChar.title,
          appearance: {
            hairStyle: rawChar.appearance?.hairStyle ?? defaultChar.appearance.hairStyle,
            hairColor: rawChar.appearance?.hairColor ?? defaultChar.appearance.hairColor,
            outfitColor: rawChar.appearance?.outfitColor ?? defaultChar.appearance.outfitColor,
            accentColor: rawChar.appearance?.accentColor ?? defaultChar.appearance.accentColor,
          },
          stats: {
            strength: clampStat(rawChar.stats?.strength),
            agility: clampStat(rawChar.stats?.agility),
            focus: clampStat(rawChar.stats?.focus),
            luck: clampStat(rawChar.stats?.luck),
          },
          createdAtMs: Number(rawChar.createdAtMs) || defaultChar.createdAtMs,
        }
      : defaultChar;

  const todayKey = getCurrentDailyResetKey();
  const rawMissions =
    data.missionProgress && typeof data.missionProgress === 'object'
      ? data.missionProgress
      : defaults.missionProgress;
  const isNewDay = data.dailyMissionResetKey !== todayKey;
  const syncedMissions: PlayerSaveData['missionProgress'] = {};
  for (const m of MISSIONS_CATALOG) {
    if (isNewDay && m.cadence === 'daily') {
      syncedMissions[m.id] = { progress: 0, claimed: false };
    } else {
      const existing = rawMissions[m.id];
      syncedMissions[m.id] = existing
        ? { progress: clampFiniteInt(existing.progress, 0, 100_000, 0), claimed: Boolean(existing.claimed) }
        : { progress: 0, claimed: false };
    }
  }

  const rawTeam = Array.isArray(data.teamTopInstanceIds)
    ? data.teamTopInstanceIds.filter((id) => cleanedTops.some((t) => t.instanceId === id))
    : [];
  const teamIds = [...rawTeam];
  for (const t of cleanedTops) {
    if (teamIds.length >= 3) break;
    if (!teamIds.includes(t.instanceId)) teamIds.push(t.instanceId);
  }

  const rawBracketSize =
    data.tournament?.bracketSize === 8 || data.tournament?.bracketSize === 16
      ? data.tournament.bracketSize
      : 4;
  const fallbackBracket = buildTournamentBracket(rawBracketSize);
  const validOpponentIds = new Set(OPPONENTS.map((o) => o.id));
  const oppIds =
    Array.isArray(data.tournament?.bracketOpponentIds) &&
    data.tournament.bracketOpponentIds.length >= 4
      ? data.tournament.bracketOpponentIds.filter((id) => validOpponentIds.has(id))
      : fallbackBracket.opponentIds;

  const rawUpgrades =
    data.componentUpgradeLevels && typeof data.componentUpgradeLevels === 'object'
      ? data.componentUpgradeLevels
      : {};
  const clampedUpgrades: Record<string, number> = {};
  for (const [cid, lvl] of Object.entries(rawUpgrades)) {
    if (validComponentIds.has(cid)) {
      clampedUpgrades[cid] = clampFiniteInt(lvl, 0, MAX_COMPONENT_UPGRADE_LEVEL, 0);
    }
  }

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    playerId:
      typeof data.playerId === 'string' && data.playerId.trim().length > 0
        ? data.playerId.trim().slice(0, 64)
        : defaults.playerId,
    updatedAtMs:
      typeof data.updatedAtMs === 'number' && Number.isFinite(data.updatedAtMs)
        ? data.updatedAtMs
        : Date.now(),
    playerLevel: clampFiniteInt(data.playerLevel, 1, 100, 1),
    playerExperience: clampFiniteInt(data.playerExperience, 0, 5_000_000, 0),
    playerScore: clampFiniteInt(data.playerScore, 0, 10_000_000, 0),
    scoreLog: Array.isArray(data.scoreLog) ? data.scoreLog.slice(0, 30) : [],
    discoveredSecrets: Array.isArray(data.discoveredSecrets)
      ? Array.from(new Set(data.discoveredSecrets.filter((id) => validSecretIds.has(id))))
      : [],
    character: sanitizedChar,
    decisionHistory:
      data.decisionHistory && typeof data.decisionHistory === 'object'
        ? { ...data.decisionHistory }
        : {},
    unlockedEndingIds: Array.isArray(data.unlockedEndingIds)
      ? Array.from(new Set(data.unlockedEndingIds.filter((id) => validEndingIds.has(id))))
      : [],
    activeEndingId:
      typeof data.activeEndingId === 'string' && validEndingIds.has(data.activeEndingId)
        ? data.activeEndingId
        : null,
    leaderboardEntries: Array.isArray(data.leaderboardEntries)
      ? data.leaderboardEntries.slice(0, 10)
      : [],
    currencies: {
      gold: clampFiniteInt(data.currencies?.gold, 0, 5_000_000, 0),
      metalShards: clampFiniteInt(data.currencies?.metalShards, 0, 1_000_000, 0),
      energyCrystals: clampFiniteInt(data.currencies?.energyCrystals, 0, 500_000, 0),
      elementalEssence: clampFiniteInt(data.currencies?.elementalEssence, 0, 500_000, 0),
      evolutionTokens: clampFiniteInt(data.currencies?.evolutionTokens, 0, 50_000, 0),
      legendaryFragments: clampFiniteInt(data.currencies?.legendaryFragments, 0, 50_000, 0),
    },
    ownedTops: cleanedTops,
    unlockedTopIds: Array.isArray(data.unlockedTopIds)
      ? Array.from(new Set(data.unlockedTopIds.filter((id) => validTopIds.has(id))))
      : defaults.unlockedTopIds,
    unlockedComponentIds: Array.isArray(data.unlockedComponentIds)
      ? Array.from(
          new Set([
            ...defaults.unlockedComponentIds,
            ...data.unlockedComponentIds.filter((id) => validComponentIds.has(id)),
          ])
        )
      : defaults.unlockedComponentIds,
    componentUpgradeLevels: clampedUpgrades,
    selectedTopInstanceId: selectedExists
      ? (data.selectedTopInstanceId as string)
      : cleanedTops[0].instanceId,
    teamTopInstanceIds: teamIds,
    selectedArenaId:
      typeof data.selectedArenaId === 'string' && validArenaIds.has(data.selectedArenaId)
        ? (data.selectedArenaId as ArenaId)
        : 'standard',
    presets: Array.isArray(data.presets) ? data.presets.slice(0, 16) : defaults.presets,
    processedBattleIds: Array.isArray(data.processedBattleIds)
      ? data.processedBattleIds.slice(-100)
      : [],
    tournament: {
      ...defaults.tournament,
      ...(data.tournament ?? {}),
      bracketSize: rawBracketSize,
      bracketOpponentIds: oppIds.length >= 4 ? oppIds : fallbackBracket.opponentIds,
      arenaIds:
        Array.isArray(data.tournament?.arenaIds) && data.tournament.arenaIds.length >= 4
          ? (data.tournament.arenaIds as ArenaId[])
          : fallbackBracket.arenaIds,
    },
    survivalBestWave: clampFiniteInt(data.survivalBestWave, 0, 500, 0),
    bossDefeatedIds: Array.isArray(data.bossDefeatedIds) ? data.bossDefeatedIds.slice(0, 32) : [],
    capacitorLevel: clampFiniteInt(data.capacitorLevel, 0, MAX_CAPACITOR_LEVEL, 0),
    visitedArenaIds: Array.isArray(data.visitedArenaIds)
      ? (Array.from(
          new Set(data.visitedArenaIds.filter((id) => validArenaIds.has(id)))
        ) as ArenaId[])
      : ['standard'],
    missionProgress: syncedMissions,
    dailyMissionResetKey: todayKey,
    settings: {
      ...defaults.settings,
      ...(data.settings ?? {}),
      uiScale: Math.max(0.85, Math.min(1.2, Number(data.settings?.uiScale) || 1.0)),
      reducedMotion: Boolean(data.settings?.reducedMotion),
      dynamicClashCamera: data.settings?.dynamicClashCamera !== false,
      keyBindings: (() => {
        const defaultBinds = createDefaultKeyBindings();
        const rawBinds =
          data.settings?.keyBindings && typeof data.settings.keyBindings === 'object'
            ? (data.settings.keyBindings as Partial<Record<keyof typeof defaultBinds, unknown>>)
            : {};
        const sanitized = { ...defaultBinds };
        for (const k of Object.keys(defaultBinds) as (keyof typeof defaultBinds)[]) {
          const val = rawBinds[k];
          if (typeof val === 'string' && val.length > 0 && val.length <= 16) {
            sanitized[k] = val;
          }
        }
        return sanitized;
      })(),
    },
    matchHistory: Array.isArray(data.matchHistory)
      ? (data.matchHistory
          .filter(
            (m): m is MatchHistoryEntry =>
              Boolean(m) &&
              typeof m.battleId === 'string' &&
              typeof m.opponentName === 'string' &&
              Boolean(m.analysis) &&
              Boolean(m.highlights)
          )
          .slice(0, 10))
      : [],
    rivals: Array.isArray(data.rivals)
      ? (data.rivals
          .filter(
            (r): r is RivalRecord =>
              Boolean(r) &&
              typeof r.playerId === 'string' &&
              typeof r.handle === 'string' &&
              validTopIds.has(r.topDefinitionId)
          )
          .slice(0, 12)
          .map((r) => {
            const elem = validElementIds.has(r.element) ? (r.element as ElementType) : 'Fire';
            const check = r.equippedComponents ? validateTopConfiguration(r.equippedComponents) : { valid: false };
            const def = TOP_DEFINITIONS.find((d) => d.id === r.topDefinitionId) ?? TOP_DEFINITIONS[0];
            return {
              ...r,
              handle: r.handle.trim().slice(0, 24) || 'Rival',
              element: elem,
              secondaryElement:
                r.secondaryElement && validElementIds.has(r.secondaryElement)
                  ? r.secondaryElement
                  : null,
              level: clampFiniteInt(r.level, 1, 50, 1),
              evolutionStage: r.evolutionStage === 1 ? 1 : 0,
              equippedComponents: check.valid ? r.equippedComponents : { ...def.defaultComponents },
              equippedAbilities:
                Array.isArray(r.equippedAbilities) && r.equippedAbilities.length === 4
                  ? (r.equippedAbilities as [string, string, string, string])
                  : ([...def.defaultAbilities] as [string, string, string, string]),
              mmr: clampFiniteInt(r.mmr, 100, 10_000, 1050),
              lossesToRival: clampFiniteInt(r.lossesToRival, 1, 9999, 1),
              winsAgainstRival: clampFiniteInt(r.winsAgainstRival, 0, 9999, 0),
              status: r.status === 'avenged' ? 'avenged' : 'unavenged',
              recommendedCounterElement: getCounterElementFor(elem),
            };
          }))
      : [],
    claimedSeasonRewardTiers: Array.isArray(data.claimedSeasonRewardTiers)
      ? Array.from(
          new Set(
            data.claimedSeasonRewardTiers
              .filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length <= 32)
              .slice(0, 32)
          )
        )
      : [],
    preferredMutators: sanitizeBattleMutators(data.preferredMutators),
    preferredWeather:
      typeof data.preferredWeather === 'string' && data.preferredWeather in WEATHERS
        ? (data.preferredWeather as WeatherType)
        : 'Clear',
    pvpMmr: clampFiniteInt(data.pvpMmr, 400, 10_000, 1000),
  };
}
