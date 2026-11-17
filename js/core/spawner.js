// EventSpawner：按 Stage 参数生成单/双/三障碍组合，并在高阶阶段标记假提示门。
// 时间与随机数均由外部注入，保持纯函数可测、同 seed 可复现。
import { pick } from './rng.js';
import { FORM_ORDER } from './forms.js';
import { activeTimed } from './runstate.js';

// 生成间隔：阶段基础间隔 × 稀疏奖励系数，再叠加 ±15% 抖动。
export function nextSpawnIntervalMs(stage, rng, run, now) {
  const sparseMul = activeTimed(run, 'spawnMul', now);
  const base = stage.spawnIntervalMs * (sparseMul || 1);
  const jitter = 0.85 + rng() * 0.3;
  return base * jitter;
}

// 本组障碍数量：Stage 1 恒为 1，其余阶段按 comboChance 出组合，Stage 4 可出三连。
export function groupSize(rng, stage) {
  if (stage.maxGroup <= 1) return 1;
  if (rng() >= stage.comboChance) return 1;
  if (stage.maxGroup >= 3 && rng() < 0.35) return 3;
  return 2;
}

// 生成一组障碍（不含坐标，坐标由编排层按最小间距排布）。
// 组内优先抽取不同 needState，保证玩家能逐个切形态通过，而不是死局。
export function spawnGroup(rng, pool, stage) {
  const n = groupSize(rng, stage);
  const chosen = [];
  const usedStates = new Set();
  let guard = 0;
  while (chosen.length < n && guard < 12) {
    const cand = pick(rng, pool);
    if (!usedStates.has(cand.needState)) {
      chosen.push({ ...cand });
      usedStates.add(cand.needState);
    }
    guard += 1;
  }
  while (chosen.length < n) chosen.push({ ...pick(rng, pool) });

  // 假提示：标注一个不存在的形态，真实形态仍以 needState 为准，渲染层据此画虚标。
  if (stage.fakeHint && rng() < 0.25) {
    const idx = Math.floor(rng() * chosen.length);
    const real = chosen[idx].needState;
    const others = FORM_ORDER.filter((f) => f !== real);
    chosen[idx].fakeHint = true;
    chosen[idx].fakeState = others[Math.floor(rng() * others.length)];
  }
  return chosen;
}

// 相邻障碍最小水平间距：保证按当前速度至少有 0.85s 反应时间。
export function minGapPx(speed) {
  return speed * 0.85;
}
