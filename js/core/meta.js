// MetaProgression：主题解锁链 + 捏脸配件/预设解锁 + 外观持久化。存储接口可注入，单测用内存实现。
const KEY = 'stb3_meta_v1';

export const PART_TYPES = ['faces', 'eyes', 'mouths', 'hairs', 'outfits', 'charms'];

export function defaultAppearance() {
  return {
    face: 'round',
    eyes: 'bean',
    mouth: 'smile',
    hair: 'ahoge',
    outfit: 'hoodie',
    mainColor: 'charcoal',
    accentColor: 'mint',
    charm: 'none',
  };
}

function emptyMeta() {
  return {
    runsCount: 0,
    totalDistance: 0,
    best: {}, // themeId -> { score, distance }
    unlocked: { themes: ['prod_incident'], parts: [], presets: ['programmer'] },
    appearance: defaultAppearance(),
  };
}

// 初始即可用的配件：无解锁条件的部件 + 全部颜色；预设取零局数解锁项。
export function initialUnlocked(partsCfg) {
  const parts = [];
  for (const type of PART_TYPES) {
    for (const item of partsCfg[type]) if (!item.unlock) parts.push(item.id);
  }
  for (const c of partsCfg.mainColors) parts.push(c.id);
  for (const c of partsCfg.accentColors) parts.push(c.id);
  return {
    parts: [...new Set(parts)],
    presets: partsCfg.presets.filter((p) => p.unlockRuns === 0).map((p) => p.id),
  };
}

// 启动时确保新玩家存档包含默认可用配件，避免首局前编辑器全锁定。
export function initMeta(storage, partsCfg) {
  if (storage.getItem(KEY)) return loadMeta(storage);
  const meta = emptyMeta();
  const init = initialUnlocked(partsCfg);
  meta.unlocked.parts = init.parts;
  meta.unlocked.presets = init.presets;
  saveMeta(storage, meta);
  return meta;
}

export function loadMeta(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyMeta();
    const merged = { ...emptyMeta(), ...JSON.parse(raw) };
    merged.unlocked = { ...emptyMeta().unlocked, ...(JSON.parse(raw).unlocked || {}) };
    merged.appearance = { ...defaultAppearance(), ...(JSON.parse(raw).appearance || {}) };
    return merged;
  } catch {
    return emptyMeta();
  }
}

export function saveMeta(storage, meta) {
  storage.setItem(KEY, JSON.stringify(meta));
}

// 主题解锁：前一主题的最远距离达到本主题 unlock.distance。
export function themeUnlockState(meta, themes) {
  const state = {};
  themes.forEach((theme, i) => {
    if (i === 0) {
      state[theme.themeId] = { unlocked: true };
      return;
    }
    const prevId = themes[i - 1].themeId;
    const prevBest = meta.best[prevId]?.distance ?? 0;
    const need = theme.unlock.distance;
    state[theme.themeId] = { unlocked: prevBest >= need, need, prevBest, prevId };
  });
  return state;
}

function partUnlockedByRule(rule, meta) {
  if (!rule) return true;
  if (rule.runs != null && meta.runsCount >= rule.runs) return true;
  if (rule.distance != null && meta.totalDistance >= rule.distance) return true;
  return false;
}

// 评估全部配件与预设的解锁状态（颜色不设解锁条件，始终可用）。
function evaluateUnlocks(meta, themes, partsCfg) {
  const tState = themeUnlockState(meta, themes);
  meta.unlocked.themes = themes.filter((t) => tState[t.themeId].unlocked).map((t) => t.themeId);

  const parts = [];
  for (const type of PART_TYPES) {
    for (const item of partsCfg[type]) {
      if (partUnlockedByRule(item.unlock, meta)) parts.push(item.id);
    }
  }
  for (const c of partsCfg.mainColors) parts.push(c.id);
  for (const c of partsCfg.accentColors) parts.push(c.id);
  meta.unlocked.parts = [...new Set(parts)];

  meta.unlocked.presets = partsCfg.presets
    .filter((p) => meta.runsCount >= p.unlockRuns)
    .map((p) => p.id);
}

// 一局结束后落盘：更新统计、最高分与解锁，返回新获得的解锁项供结算页展示。
export function recordRun(storage, themes, partsCfg, run, score) {
  const meta = loadMeta(storage);
  meta.runsCount += 1;
  meta.totalDistance += Math.floor(run.distance);

  const prev = meta.best[run.themeId] || { score: 0, distance: 0 };
  meta.best[run.themeId] = {
    score: Math.max(prev.score, score),
    distance: Math.max(prev.distance, Math.floor(run.distance)),
  };

  const before = {
    themes: [...meta.unlocked.themes],
    parts: [...meta.unlocked.parts],
    presets: [...meta.unlocked.presets],
  };
  evaluateUnlocks(meta, themes, partsCfg);
  const newly = {
    themes: meta.unlocked.themes.filter((x) => !before.themes.includes(x)),
    parts: meta.unlocked.parts.filter((x) => !before.parts.includes(x)),
    presets: meta.unlocked.presets.filter((x) => !before.presets.includes(x)),
  };
  saveMeta(storage, meta);
  return { meta, newly };
}

export function isPartUnlocked(meta, partId) {
  return meta.unlocked.parts.includes(partId);
}

// 保存整套外观；未解锁配件拒绝写入，返回是否成功。
export function saveAppearance(storage, appearance) {
  const meta = loadMeta(storage);
  const next = { ...meta.appearance, ...appearance };
  const values = Object.values(next);
  if (!values.every((id) => id === 'none' || meta.unlocked.parts.includes(id))) return false;
  meta.appearance = next;
  saveMeta(storage, meta);
  return true;
}

// 一键应用预设套装；预设未解锁时拒绝。
export function applyPreset(storage, partsCfg, presetId) {
  const meta = loadMeta(storage);
  const preset = partsCfg.presets.find((p) => p.id === presetId);
  if (!preset || !meta.unlocked.presets.includes(presetId)) return false;
  meta.appearance = { ...preset.appearance };
  saveMeta(storage, meta);
  return true;
}
