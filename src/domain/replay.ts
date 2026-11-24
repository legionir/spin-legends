import {
  HighlightStatDebuff,
  MatchHighlightClip,
  MatchHighlightFrame,
  PartDurabilityKey,
  PartDurabilityMap,
} from './types';

export const REPLAY_WINDOW_SEC = 2.8;
export const REPLAY_SLOWMO_SPEED = 0.42;
export const REPLAY_CLIMAX_HOLD_SEC = 2.6;

const PART_DURABILITY_KEYS: readonly PartDurabilityKey[] = [
  'SpiritCore',
  'AttackBlade',
  'ArmorRing',
  'WeightDisc',
  'PerformanceDriver',
  'EnergyModule',
];

export interface ReplayCameraSegment {
  index: 0 | 1 | 2;
  code: string;
  label: string;
  localProgress: number;
}

export interface ReplaySampleResult {
  frame: MatchHighlightFrame;
  rawIdx: number;
  progress: number;
  duration: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolatePartDurability(
  a?: PartDurabilityMap,
  b?: PartDurabilityMap,
  u = 0
): PartDurabilityMap | undefined {
  if (!a && !b) return undefined;
  const srcA = a ?? b!;
  const srcB = b ?? a!;
  const result = {} as PartDurabilityMap;
  for (const key of PART_DURABILITY_KEYS) {
    result[key] = Math.round(lerp(srcA[key] ?? 100, srcB[key] ?? 100, u));
  }
  return result;
}

function interpolateStatDebuffs(
  a?: HighlightStatDebuff[],
  b?: HighlightStatDebuff[],
  u = 0
): HighlightStatDebuff[] | undefined {
  if (!a && !b) return undefined;
  const activeList = (u > 0.5 ? b : a) ?? a ?? b ?? [];
  return activeList.map((d) => {
    const matchA = a?.find((x) => x.kind === d.kind);
    const matchB = b?.find((x) => x.kind === d.kind);
    const remainingSec =
      matchA && matchB
        ? Math.max(0, Number(lerp(matchA.remainingSec, matchB.remainingSec, u).toFixed(2)))
        : d.remainingSec;
    return {
      ...d,
      remainingSec,
    };
  });
}

export function selectReplayWindowFrames(
  clip: MatchHighlightClip,
  windowSec: number = REPLAY_WINDOW_SEC
): MatchHighlightFrame[] {
  const frames = clip.frames;
  if (frames.length <= 2) return frames.slice();
  const endT = frames[frames.length - 1].t;
  const targetWindow = Math.max(0.5, windowSec);

  const startCutoff = endT - targetWindow;
  let startIdx = 0;
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].t <= startCutoff) {
      startIdx = i;
      break;
    }
  }
  const sliced = frames.slice(startIdx);
  if (sliced.length >= 2) return sliced;
  return frames.slice(-2);
}

export function resolveReplayCameraSegment(progress: number): ReplayCameraSegment {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.34) {
    return {
      index: 0,
      code: 'CAM 01',
      label: 'WIDE BROADCAST',
      localProgress: p / 0.34,
    };
  }
  if (p < 0.68) {
    return {
      index: 1,
      code: 'CAM 02',
      label: 'LOW ACTION',
      localProgress: (p - 0.34) / 0.34,
    };
  }
  return {
    index: 2,
    code: 'CAM 03',
    label: 'OVERHEAD VAR',
    localProgress: Math.min(1, (p - 0.68) / 0.32),
  };
}

export function sampleReplayFrame(
  frames: MatchHighlightFrame[],
  timeOffsetSec: number
): ReplaySampleResult {
  if (frames.length === 0) {
    return {
      frame: {
        t: 0,
        px: 0,
        pz: 0,
        pVx: 0,
        pVz: 0,
        pSpinAngle: 0,
        pRpm: 0,
        pStaminaPct: 0,
        pDurabilityPct: 0,
        ox: 0,
        oz: 0,
        oVx: 0,
        oVz: 0,
        oSpinAngle: 0,
        oRpm: 0,
        oStaminaPct: 0,
        oDurabilityPct: 0,
      },
      rawIdx: 0,
      progress: 1,
      duration: 0.25,
    };
  }
  if (frames.length === 1) {
    return {
      frame: frames[0],
      rawIdx: 0,
      progress: 1,
      duration: 0.25,
    };
  }

  const tStart = frames[0].t;
  const duration = Math.max(0.25, frames[frames.length - 1].t - tStart);
  const clampedOffset = Math.max(0, Math.min(duration, timeOffsetSec));
  const targetT = tStart + clampedOffset;
  const progress = Math.max(0, Math.min(1, clampedOffset / duration));

  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (targetT <= b.t || i === frames.length - 2) {
      const span = Math.max(0.0001, b.t - a.t);
      const u = Math.max(0, Math.min(1, (targetT - a.t) / span));
      const picked = u > 0.5 ? b : a;
      return {
        rawIdx: u > 0.5 ? i + 1 : i,
        progress,
        duration,
        frame: {
          t: lerp(a.t, b.t, u),
          px: lerp(a.px, b.px, u),
          pz: lerp(a.pz, b.pz, u),
          pVx: lerp(a.pVx, b.pVx, u),
          pVz: lerp(a.pVz, b.pVz, u),
          pSpinAngle: lerp(a.pSpinAngle, b.pSpinAngle, u),
          pRpm: Math.round(lerp(a.pRpm, b.pRpm, u)),
          pStaminaPct: Math.round(lerp(a.pStaminaPct, b.pStaminaPct, u)),
          pDurabilityPct: Math.round(lerp(a.pDurabilityPct, b.pDurabilityPct, u)),
          pEnergyPct:
            a.pEnergyPct !== undefined || b.pEnergyPct !== undefined
              ? Math.round(lerp(a.pEnergyPct ?? b.pEnergyPct ?? 0, b.pEnergyPct ?? a.pEnergyPct ?? 0, u))
              : undefined,
          pResonance:
            a.pResonance !== undefined || b.pResonance !== undefined
              ? Math.round(lerp(a.pResonance ?? b.pResonance ?? 0, b.pResonance ?? a.pResonance ?? 0, u))
              : undefined,
          pPartDurability: interpolatePartDurability(a.pPartDurability, b.pPartDurability, u),
          pBrokenParts: [...(picked.pBrokenParts ?? a.pBrokenParts ?? b.pBrokenParts ?? [])],
          pShield: Boolean(a.pShield || b.pShield),
          pFire: Boolean(a.pFire || b.pFire),
          pActiveSlotIdx: (u > 0.5 ? b.pActiveSlotIdx : a.pActiveSlotIdx) ?? a.pActiveSlotIdx ?? b.pActiveSlotIdx,
          pActiveSlots: [
            Boolean(a.pActiveSlots?.[0] || b.pActiveSlots?.[0]),
            Boolean(a.pActiveSlots?.[1] || b.pActiveSlots?.[1]),
            Boolean(a.pActiveSlots?.[2] || b.pActiveSlots?.[2]),
            Boolean(a.pActiveSlots?.[3] || b.pActiveSlots?.[3]),
          ],
          pStatuses: (u > 0.5 ? b.pStatuses : a.pStatuses) ?? a.pStatuses ?? b.pStatuses ?? [],
          pStatDebuffs: interpolateStatDebuffs(a.pStatDebuffs, b.pStatDebuffs, u),
          ox: lerp(a.ox, b.ox, u),
          oz: lerp(a.oz, b.oz, u),
          oVx: lerp(a.oVx, b.oVx, u),
          oVz: lerp(a.oVz, b.oVz, u),
          oSpinAngle: lerp(a.oSpinAngle, b.oSpinAngle, u),
          oRpm: Math.round(lerp(a.oRpm, b.oRpm, u)),
          oStaminaPct: Math.round(lerp(a.oStaminaPct, b.oStaminaPct, u)),
          oDurabilityPct: Math.round(lerp(a.oDurabilityPct, b.oDurabilityPct, u)),
          oEnergyPct:
            a.oEnergyPct !== undefined || b.oEnergyPct !== undefined
              ? Math.round(lerp(a.oEnergyPct ?? b.oEnergyPct ?? 0, b.oEnergyPct ?? a.oEnergyPct ?? 0, u))
              : undefined,
          oResonance:
            a.oResonance !== undefined || b.oResonance !== undefined
              ? Math.round(lerp(a.oResonance ?? b.oResonance ?? 0, b.oResonance ?? a.oResonance ?? 0, u))
              : undefined,
          oPartDurability: interpolatePartDurability(a.oPartDurability, b.oPartDurability, u),
          oBrokenParts: [...(picked.oBrokenParts ?? a.oBrokenParts ?? b.oBrokenParts ?? [])],
          oShield: Boolean(a.oShield || b.oShield),
          oFire: Boolean(a.oFire || b.oFire),
          oActiveSlotIdx: (u > 0.5 ? b.oActiveSlotIdx : a.oActiveSlotIdx) ?? a.oActiveSlotIdx ?? b.oActiveSlotIdx,
          oActiveSlots: [
            Boolean(a.oActiveSlots?.[0] || b.oActiveSlots?.[0]),
            Boolean(a.oActiveSlots?.[1] || b.oActiveSlots?.[1]),
            Boolean(a.oActiveSlots?.[2] || b.oActiveSlots?.[2]),
            Boolean(a.oActiveSlots?.[3] || b.oActiveSlots?.[3]),
          ],
          oStatuses: (u > 0.5 ? b.oStatuses : a.oStatuses) ?? a.oStatuses ?? b.oStatuses ?? [],
          oStatDebuffs: interpolateStatDebuffs(a.oStatDebuffs, b.oStatDebuffs, u),
          clashX: u < 0.5 ? a.clashX : b.clashX,
          clashZ: u < 0.5 ? a.clashZ : b.clashZ,
          isCritical: a.isCritical || b.isCritical,
          eventLabel: b.eventLabel ?? a.eventLabel,
          obstacles: picked.obstacles ?? a.obstacles ?? b.obstacles,
        },
      };
    }
  }

  return {
    frame: frames[frames.length - 1],
    rawIdx: frames.length - 1,
    progress: 1,
    duration,
  };
}
