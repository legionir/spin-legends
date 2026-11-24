import type { BattleSimulationState } from '../simulation/physicsEngine';
import { isFireAbility, isShieldAbility } from './catalog';
import { StatusEffectType } from './types';

export interface ActiveStatusSlotInfo {
  active: boolean;
  isFire: boolean;
  isShield: boolean;
}

export interface PlayerActiveStatusesResult {
  isFireActive: boolean;
  isShieldActive: boolean;
  activeSlotFlags: [boolean, boolean, boolean, boolean];
  slotEffects: [
    ActiveStatusSlotInfo,
    ActiveStatusSlotInfo,
    ActiveStatusSlotInfo,
    ActiveStatusSlotInfo,
  ];
}

export interface HudStatusSubject {
  statuses: ReadonlyArray<StatusEffectType | { type: StatusEffectType }>;
  slots: ReadonlyArray<{ abilityId: string; active: number }>;
}

/**
 * Single source of truth for resolving active Fire, Shield, and per-slot states
 * across simulation highlight recording, 3D scene visuals, and BattleHud.
 */
export function getPlayerActiveStatuses(
  player: BattleSimulationState['player'] | HudStatusSubject
): PlayerActiveStatusesResult {
  const rawSlots: ReadonlyArray<{ abilityId: string; isActive: boolean }> =
    'abilitySlots' in player
      ? player.abilitySlots.map((s) => ({
          abilityId: s.abilityId,
          isActive: s.activeRemaining > 0,
        }))
      : player.slots.map((s) => ({
          abilityId: s.abilityId,
          isActive: s.active > 0,
        }));

  const buildSlot = (idx: number): ActiveStatusSlotInfo => {
    const slot = rawSlots[idx];
    if (!slot || !slot.isActive) {
      return { active: false, isFire: false, isShield: false };
    }
    return {
      active: true,
      isFire: isFireAbility(slot.abilityId),
      isShield: isShieldAbility(slot.abilityId),
    };
  };

  const slotEffects: PlayerActiveStatusesResult['slotEffects'] = [
    buildSlot(0),
    buildSlot(1),
    buildSlot(2),
    buildSlot(3),
  ];

  const activeSlotFlags: [boolean, boolean, boolean, boolean] = [
    slotEffects[0].active,
    slotEffects[1].active,
    slotEffects[2].active,
    slotEffects[3].active,
  ];

  const hasStatus = (target: StatusEffectType): boolean =>
    player.statuses.some((s) => (typeof s === 'string' ? s === target : s.type === target));

  const isShieldActive = hasStatus('Shield') || slotEffects.some((s) => s.isShield);
  const isFireActive = hasStatus('Burn') || slotEffects.some((s) => s.isFire);

  return {
    isFireActive,
    isShieldActive,
    activeSlotFlags,
    slotEffects,
  };
}
