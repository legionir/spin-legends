/**
 * Sampled audio shipped in public/audio (OGG Vorbis, 44.1 kHz).
 * Effects are mono, music/stingers/weather are stereo. Files are loudness-matched at the
 * source (one-shots share one level, music -16 LUFS, weather beds -20 LUFS), so the
 * per-group `gain` below is pure mix balance.
 *
 * Still synthesized in soundEngine.ts (no files): spin hum, countdown ticks, power-bar
 * charge, Critical riser, UI clicks.
 */

export type SoundBus = 'sfx' | 'music' | 'amb';

export interface SoundGroup {
  files: string[];
  bus: SoundBus;
  gain: number;
  /** random playbackRate spread (+/-) so repeated hits don't sound identical */
  pitchJitter?: number;
  /** max simultaneous voices for this group */
  maxVoices?: number;
  /** ignore retriggers closer than this (seconds) */
  minInterval?: number;
}

const v = (base: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${base}_${String(i + 1).padStart(2, '0')}`);

export const ABILITY_SOUND_IDS = [
  'flame_burst', 'aqua_pulse', 'frost_impact', 'thunder_dash', 'aegis_barrier', 'gyro_anchor',
  'cryo_shell', 'overdrive_surge', 'vortex_pull', 'slipstream_evade', 'stone_guard',
  'cyclone_dash', 'shadow_veil', 'energy_drain', 'radiant_shield', 'purification',
] as const;

export const ULTIMATE_SOUND_IDS = [
  'inferno_nova', 'tempest_cataclysm', 'solar_burst', 'terraquake', 'abyssal_maelstrom',
  'absolute_zero', 'cyclone_tempest', 'eclipse_abyss',
] as const;

export const STATUS_LOOP_IDS = ['shield', 'burn', 'freeze', 'overdrive'] as const;
export type StatusLoopId = (typeof STATUS_LOOP_IDS)[number];

export const SOUND_GROUPS: Record<string, SoundGroup> = {
  // music bus
  'music.menu': { files: ['music.menu'], bus: 'music', gain: 0.85 },
  'music.battle': { files: ['music.battle'], bus: 'music', gain: 0.85 },
  'music.critical': { files: ['music.critical'], bus: 'music', gain: 0.85 },
  'stinger.win': { files: ['stinger.win'], bus: 'music', gain: 1.0 },
  'stinger.lose': { files: ['stinger.lose'], bus: 'music', gain: 1.0 },

  // impacts
  'impact.top.light': { files: v('impact.top.light', 4), bus: 'sfx', gain: 0.55, pitchJitter: 0.06, maxVoices: 4, minInterval: 0.04 },
  'impact.top.heavy': { files: v('impact.top.heavy', 4), bus: 'sfx', gain: 0.75, pitchJitter: 0.05, maxVoices: 4, minInterval: 0.05 },
  'impact.top.critical': { files: v('impact.top.critical', 2), bus: 'sfx', gain: 0.95, pitchJitter: 0.03, maxVoices: 2, minInterval: 0.08 },
  'impact.wall': { files: v('impact.wall', 3), bus: 'sfx', gain: 0.55, pitchJitter: 0.05, maxVoices: 3, minInterval: 0.06 },
  'impact.pillar': { files: v('impact.pillar', 3), bus: 'sfx', gain: 0.6, pitchJitter: 0.05, maxVoices: 3, minInterval: 0.06 },

  // match flow
  'launch.rip': { files: ['launch.rip'], bus: 'sfx', gain: 0.8, maxVoices: 2 },
  'launch.perfect': { files: ['launch.perfect'], bus: 'sfx', gain: 0.75, maxVoices: 1 },
  'launch.land': { files: ['launch.land'], bus: 'sfx', gain: 0.8, pitchJitter: 0.04, maxVoices: 2, minInterval: 0.05 },
  'finish.burst': { files: ['finish.burst'], bus: 'sfx', gain: 1.0, maxVoices: 2 },
  'finish.debris': { files: ['finish.debris'], bus: 'sfx', gain: 0.7, pitchJitter: 0.04, maxVoices: 2 },
  'finish.ringout': { files: ['finish.ringout'], bus: 'sfx', gain: 0.9, maxVoices: 1 },
  'finish.spinout': { files: ['finish.spinout'], bus: 'sfx', gain: 0.85, maxVoices: 1 },

  // weather
  'amb.rain': { files: ['amb.rain'], bus: 'amb', gain: 0.9 },
  'amb.dust': { files: ['amb.dust'], bus: 'amb', gain: 0.9 },
  'amb.gale': { files: ['amb.gale'], bus: 'amb', gain: 0.9 },
  'amb.thunder': { files: v('amb.thunder', 2), bus: 'amb', gain: 0.55, pitchJitter: 0.05, maxVoices: 1 },
};

for (const id of ABILITY_SOUND_IDS) {
  SOUND_GROUPS[`ability.${id}`] = { files: [`ability.${id}`], bus: 'sfx', gain: 0.75, maxVoices: 2, minInterval: 0.05 };
}
for (const id of ULTIMATE_SOUND_IDS) {
  SOUND_GROUPS[`ult.${id}`] = { files: [`ult.${id}`], bus: 'sfx', gain: 0.95, maxVoices: 1 };
}
for (const id of STATUS_LOOP_IDS) {
  SOUND_GROUPS[`loop.${id}`] = { files: [`loop.${id}`], bus: 'sfx', gain: 0.22 };
}

/** Load order: what a battle needs first, the long music files last. */
export const LOAD_PRIORITY: string[] = [
  'impact.top.light', 'impact.top.heavy', 'impact.top.critical', 'impact.wall', 'impact.pillar',
  'launch.rip', 'launch.land', 'launch.perfect', 'finish.burst', 'finish.debris', 'finish.ringout',
  'finish.spinout', ...ABILITY_SOUND_IDS.map((a) => `ability.${a}`),
  ...ULTIMATE_SOUND_IDS.map((u) => `ult.${u}`), ...STATUS_LOOP_IDS.map((l) => `loop.${l}`),
  'stinger.win', 'stinger.lose', 'amb.thunder', 'amb.rain', 'amb.dust', 'amb.gale',
  'music.menu', 'music.battle', 'music.critical',
];

/** "Flame Burst" / "ability.fire.flame_burst" -> "flame_burst" */
export function abilitySoundKey(labelOrId: string | undefined): string | null {
  if (!labelOrId) return null;
  const tail = labelOrId.includes('.') ? labelOrId.split('.').pop() ?? '' : labelOrId;
  const key = tail.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if ((ABILITY_SOUND_IDS as readonly string[]).includes(key)) return `ability.${key}`;
  if ((ULTIMATE_SOUND_IDS as readonly string[]).includes(key)) return `ult.${key}`;
  return null;
}
