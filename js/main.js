// 装配根：加载主题世界包、阶段配置、奖励池、捏脸部件 → 组装 RunScene/UI/输入/音效。
// 新增世界只需加一份主题 JSON；玩法规则只存在于 core 纯模块与 JSON 配置。
import { GameScene } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { initMeta } from './core/meta.js';

const THEME_FILES = ['prod-incident.json', 'night-store.json', 'haunted-toaster.json'];

function failFast(msg) {
  document.body.innerHTML = `<pre style="color:#ff8a8a;padding:24px;font-size:16px">启动失败：${msg}</pre>`;
  throw new Error(msg);
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) failFast(`${path} 加载失败（HTTP ${res.status}），请通过本地静态服务器访问`);
  return res.json();
}

async function bootstrap() {
  const [themes, stagesCfg, rewards, partsCfg] = await Promise.all([
    Promise.all(THEME_FILES.map((f) => loadJson(`data/themes/${f}`))),
    loadJson('data/stages.json'),
    loadJson('data/rewards.json'),
    loadJson('data/character-parts.json'),
  ]);
  for (const t of themes) {
    if (!t.themeId || !Array.isArray(t.obstaclePool)) failFast(`主题包 ${t.themeId} 结构非法`);
  }

  initMeta(localStorage, partsCfg); // 新玩家首局前也能使用默认配件捏脸
  const app = document.getElementById('app');
  const canvas = document.getElementById('game-canvas');
  const ui = new UI(app, localStorage, partsCfg);
  document.getElementById('hud-layer').innerHTML = ui.hudMarkup();

  const scene = new GameScene({
    canvas,
    ui,
    sound: new Sound(),
    input: new Input(),
    storage: localStorage,
    themes,
    rewards,
    stagesCfg,
    partsCfg,
  });
  scene.showMenu();
}

bootstrap().catch((err) => failFast(err.message));
