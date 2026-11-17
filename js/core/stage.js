// 阶段机纯函数：里程节点（300/700/1200，之后每 500m）与 Stage 1-4 + Loop 难度参数。
// 配置由 stages.json 注入，本文件不持有可变状态，保证同里程必然得到同阶段。

// 第 nodeIndex 个奖励节点的里程（nodeIndex 从 0 开始）。
export function nodeDistanceAt(nodeIndex, cfg) {
  if (nodeIndex < cfg.nodeDistances.length) return cfg.nodeDistances[nodeIndex];
  const last = cfg.nodeDistances[cfg.nodeDistances.length - 1];
  const extra = nodeIndex - cfg.nodeDistances.length + 1;
  return last + extra * cfg.loopStep;
}

// 依据里程定位当前阶段与 Loop 层级（Stage 4 之后每 500m 为一级 Loop）。
export function stageAtDistance(distance, cfg) {
  const stages = cfg.stages;
  let base = stages[0];
  for (const s of stages) {
    if (distance >= s.fromDistance) base = s;
    else break;
  }
  const lastStage = stages[stages.length - 1];
  let loopLevel = 0;
  if (base.index === lastStage.index && distance > lastStage.fromDistance) {
    loopLevel = Math.floor((distance - lastStage.fromDistance) / cfg.loopStep);
  }
  return { stageIndex: base.index, loopLevel, base };
}

// 合成当前生效的难度参数：Loop 层级在 Stage 4 基础上继续提速、加密，间隔有地板。
export function resolveStage(distance, cfg) {
  const { stageIndex, loopLevel, base } = stageAtDistance(distance, cfg);
  const speedMul = Math.min(
    2.4,
    base.speedMul * (loopLevel > 0 ? cfg.loopSpeedGrowth ** loopLevel : 1),
  );
  const spawnIntervalMs = Math.max(
    cfg.loopSpawnFloorMs,
    base.spawnIntervalMs - (loopLevel > 0 ? loopLevel * 40 : 0),
  );
  return {
    stageIndex,
    loopLevel,
    rule: base.rule,
    speedMul,
    spawnIntervalMs,
    maxGroup: base.maxGroup,
    comboChance: base.comboChance,
    fakeHint: base.fakeHint,
  };
}

// 跨越节点后返回新阶段的展示信息（阶段牌用）。
export function stageBanner(distance, cfg) {
  const s = resolveStage(distance, cfg);
  const label = s.loopLevel > 0 ? `Stage 4+${s.loopLevel}` : `Stage ${s.stageIndex}`;
  return { label, rule: s.rule };
}
