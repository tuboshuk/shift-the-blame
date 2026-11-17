// 里程奖励纯逻辑：固定节点三选一与 Loop 随机三选一，效果由本注册表统一解释。
// JSON 只描述 effect，限时效果落 run.timedEffects，永久/累积效果落 run.modifiers。
import { pick, sampleDistinct } from './rng.js';
import { putTimedEffect } from './runstate.js';

function applyEffect(run, e, now) {
  switch (e.kind) {
    case 'timed':
      putTimedEffect(run, e.key, e.value, e.durationMs, now);
      return true;
    case 'flag':
      if (run.modifiers[e.key]) return false;
      run.modifiers[e.key] = true;
      return true;
    case 'modifier': {
      const cur = run.modifiers[e.key] || 0;
      if (e.maxStacks != null && cur / e.value >= e.maxStacks) return false;
      run.modifiers[e.key] = cur + e.value;
      return true;
    }
    default:
      return false;
  }
}

// 应用一张奖励卡；主效果被满级拦截时不计次数，附带效果仍独立结算。
export function applyReward(run, reward, now = 0) {
  const e = reward.effect;
  let ok = applyEffect(run, e, now);
  if (e.also) for (const a of e.also) ok = applyEffect(run, a, now) || ok;
  if (ok) run.rewardsTaken += 1;
  return ok;
}

// Loop 随机池过滤：flag 已生效、modifier 已满级的奖励不再出现；限时效果总可刷新。
export function availableRewards(allRewards, run) {
  return allRewards.filter((r) => {
    const e = r.effect;
    if (e.kind === 'flag') return !run.modifiers[e.key];
    if (e.kind === 'modifier' && e.maxStacks != null) {
      return (run.modifiers[e.key] || 0) / e.value < e.maxStacks;
    }
    return true;
  });
}

// 固定节点（300/700/1200m）：按 stages.nodeRewards 配置原样发三张。
export function rollNodeRewards(nodeIndex, allRewards, cfg) {
  const ids = cfg.nodeRewards[nodeIndex];
  return ids.map((id) => allRewards.find((r) => r.id === id)).filter(Boolean);
}

// Loop+：保证 1 个高分、1 个稳健（保命/舒适）、1 个形态强化；某组耗尽则从余池补。
export function rollLoopRewards(rng, allRewards, run) {
  const pool = availableRewards(allRewards, run);
  const groups = {
    score: pool.filter((r) => r.category === 'score'),
    steady: pool.filter((r) => r.category === 'survivor' || r.category === 'comfort'),
    form: pool.filter((r) => r.category === 'form'),
  };
  const picked = [];
  for (const key of ['score', 'steady', 'form']) {
    if (groups[key].length) picked.push(pick(rng, groups[key]));
  }
  if (picked.length < 3) {
    const rest = pool.filter((r) => !picked.includes(r));
    picked.push(...sampleDistinct(rng, rest, 3 - picked.length));
  }
  return picked.slice(0, 3);
}

export function cycleOptionIndex(index, len) {
  if (len <= 0) return 0;
  return (index + 1) % len;
}

// 10 秒不操作：自动确认当前高亮项（文档 2.1 兜底规则）。
export function autoSelect(options, highlightedIndex) {
  return options[Math.min(highlightedIndex, options.length - 1)];
}
