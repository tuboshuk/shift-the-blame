// 单局运行状态工厂与限时效果管理。v3：奖励以限时效果为主，难度按 Stage 台阶式晋升。
import { createFormState } from './forms.js';

export const BASE_SPEED = 260; // px/s
export const MAX_SPEED = 640;
export const MAX_HEARTS = 5;
export const HIT_INVULN_MS = 1500;

export function createRunState(theme, { seed = 1, now = 0, appearance = null } = {}) {
  return {
    themeId: theme.themeId,
    seed,
    appearance,
    formState: createFormState(now),
    hearts: 3,
    maxHearts: MAX_HEARTS,
    // 局内永久/累积型奖励状态
    modifiers: {
      shieldCharges: 0,
      deathSave: 0,
      phaseGrace: 0, // 秒
      smashGrace: 0, // 秒
      smashScoreMul: 0,
      dashCooldownReduce: false,
    },
    // 限时效果：{ key, value, expireAt（局内时钟 ms） }
    timedEffects: [],
    distance: 0, // 米
    obstacleScore: 0,
    combo: 0,
    bestCombo: 0,
    successCount: 0,
    hitCount: 0,
    rewardsTaken: 0,
    elapsedMs: 0,
    invulnUntil: 0,
    over: false,
    overReason: '',
  };
}

// 注册/刷新一个限时效果；同 key 以新效果替换（倍率不叠加，只刷新时长与数值）。
export function putTimedEffect(run, key, value, durationMs, now) {
  run.timedEffects = run.timedEffects.filter((e) => e.key !== key);
  run.timedEffects.push({ key, value, expireAt: now + durationMs });
}

// 每帧清理过期效果，返回被清理的 key 列表（供 UI 撤下图标）。
export function tickEffects(run, now) {
  const expired = run.timedEffects.filter((e) => now >= e.expireAt).map((e) => e.key);
  if (expired.length) run.timedEffects = run.timedEffects.filter((e) => now < e.expireAt);
  return expired;
}

export function activeTimed(run, key, now) {
  const e = run.timedEffects.find((x) => x.key === key && now < x.expireAt);
  return e ? e.value : null;
}

export function activeTimedEffects(run, now) {
  return run.timedEffects.filter((e) => now < e.expireAt);
}

// 基础移动速度：阶段台阶速度 × 限时速度修正，形态倍率由编排层另行相乘。
export function currentSpeed(run, stageParams, now = run.elapsedMs) {
  let speed = BASE_SPEED * stageParams.speedMul;
  const mul = activeTimed(run, 'speedMul', now);
  if (mul != null) speed *= mul;
  return Math.min(MAX_SPEED, speed);
}

// 当前受伤无敌时长：基础值 + 坚韧皮肤奖励的延长量。
export function invulnDurationMs(run, now) {
  const extra = activeTimed(run, 'invulnExtend', now);
  return HIT_INVULN_MS + (extra || 0);
}

export function totalScore(run) {
  return run.obstacleScore + Math.floor(run.distance);
}
