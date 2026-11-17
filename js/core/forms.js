// ShiftStateMachine：冲刺 / 相位 / 重击三形态循环切换，带切换冷却。
// v3：形态色降饱和，配合整体低刺激视觉；冷却可被奖励缩短。
export const FORM = {
  DASH: 'dash',
  PHASE: 'phase',
  SMASH: 'smash',
};

export const FORM_ORDER = [FORM.DASH, FORM.PHASE, FORM.SMASH];

export const FORM_META = {
  dash: { label: '冲刺', speedMul: 1.25, color: '#6fcf97', hint: '快速穿过冲刺门' },
  phase: { label: '相位', speedMul: 1.0, color: '#6fb8d9', hint: '虚化穿过裂隙墙' },
  smash: { label: '重击', speedMul: 0.85, color: '#e0995e', hint: '撞碎实体异常物' },
};

export const SWITCH_COOLDOWN_MS = 180;
export const REDUCED_COOLDOWN_MS = 110;

export function createFormState(now = 0) {
  return { index: 0, form: FORM_ORDER[0], lastSwitchAt: -Infinity, switchedAt: now };
}

// 按一次 Shift 循环一档；冷却内忽略，返回是否切换成功。cooldownMs 由奖励动态决定。
export function cycleForm(formState, now, cooldownMs = SWITCH_COOLDOWN_MS) {
  if (now - formState.lastSwitchAt < cooldownMs) return false;
  formState.index = (formState.index + 1) % FORM_ORDER.length;
  formState.form = FORM_ORDER[formState.index];
  formState.lastSwitchAt = now;
  formState.switchedAt = now;
  return true;
}

// 当前形态的实际速度倍率：形态基础倍率 × 路线/限时速度修正由 runstate 统一处理。
export function formSpeedMul(form) {
  return FORM_META[form].speedMul;
}

// 相位容错：切入相位后的一段时间内碰撞免伤（时长由奖励提供，单位秒）。
export function isPhaseGrace(formState, run, now) {
  if (formState.form !== FORM.PHASE || run.modifiers.phaseGrace <= 0) return false;
  return now - formState.switchedAt < run.modifiers.phaseGrace * 1000;
}

// 重击容错：重击范围扩大奖励后，切入重击的短窗口内错配免伤。
export function isSmashGrace(formState, run, now) {
  if (formState.form !== FORM.SMASH || run.modifiers.smashGrace <= 0) return false;
  return now - formState.switchedAt < run.modifiers.smashGrace * 1000;
}
