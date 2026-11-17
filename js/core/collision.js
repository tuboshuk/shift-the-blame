// 碰撞结算纯函数：形态匹配则通过，否则按 无敌帧/容错 → 护盾 → 免死 → 掉心 顺序处理。
import { FORM, isPhaseGrace, isSmashGrace } from './forms.js';
import { activeTimed, invulnDurationMs } from './runstate.js';

export const RESULT = {
  PASS: 'pass', // 形态正确，成功通过
  GRACE: 'grace', // 无敌帧或容错窗口内，免伤通过
  SHIELD: 'shield', // 护盾抵消
  DEATH_SAVE: 'death_save', // 致命一击被免死次数接住
  HIT: 'hit', // 掉心
};

function comboMultiplier(run) {
  return 1 + Math.min(run.combo, 20) * 0.1;
}

// 成功通过障碍的得分：基础分 × 连击倍率 × 限时分数倍率 × 重击强化。
export function successGain(obstacle, run, now) {
  let gain = obstacle.score * comboMultiplier(run);
  const scoreMul = activeTimed(run, 'scoreMul', now);
  if (scoreMul != null) gain *= scoreMul;
  if (run.formState.form === FORM.SMASH) gain *= 1 + run.modifiers.smashScoreMul;
  return Math.round(gain);
}

// 切换容错奖励：任意形态切换后的短窗口内错配免伤。
function isSwitchGrace(run, now) {
  const graceSec = activeTimed(run, 'switchGrace', now);
  if (graceSec == null) return false;
  return now - run.formState.switchedAt < graceSec * 1000;
}

// 结算一次碰撞，原地更新 run，返回结果类型与得分变化。
export function resolveCollision(obstacle, run, now) {
  // 形态正确
  if (obstacle.needState === run.formState.form) {
    const gain = successGain(obstacle, run, now);
    run.obstacleScore += gain;
    run.combo += 1;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    run.successCount += 1;
    return { result: RESULT.PASS, gain };
  }
  // 无敌帧 / 相位容错 / 重击容错 / 通用切换容错
  if (
    now < run.invulnUntil
    || isPhaseGrace(run.formState, run, now)
    || isSmashGrace(run.formState, run, now)
    || isSwitchGrace(run, now)
  ) {
    return { result: RESULT.GRACE, gain: 0 };
  }
  // 护盾优先抵消任意错配
  if (run.modifiers.shieldCharges > 0) {
    run.modifiers.shieldCharges -= 1;
    run.invulnUntil = now + 800;
    return { result: RESULT.SHIELD, gain: 0 };
  }
  // 致命一击且持有免死：保留 1 颗心并给 2 秒无敌
  if (run.hearts - 1 <= 0 && run.modifiers.deathSave > 0) {
    run.modifiers.deathSave -= 1;
    run.hearts = 1;
    run.hitCount += 1;
    run.combo = 0;
    run.invulnUntil = now + 2000;
    return { result: RESULT.DEATH_SAVE, gain: 0 };
  }
  // 硬吃伤害
  run.hearts -= 1;
  run.hitCount += 1;
  run.combo = 0;
  run.invulnUntil = now + invulnDurationMs(run, now);
  if (run.hearts <= 0) {
    run.hearts = 0;
    run.over = true;
    run.overReason = 'hearts_depleted';
  }
  return { result: RESULT.HIT, gain: 0 };
}
