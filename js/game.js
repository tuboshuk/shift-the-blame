// RunScene：主游玩场景编排（v3）。玩法规则全部来自 core 纯模块与 JSON，本类只做时序与特效装配。
import { mulberry32 } from './core/rng.js';
import { cycleForm, FORM_META, SWITCH_COOLDOWN_MS, REDUCED_COOLDOWN_MS, formSpeedMul } from './core/forms.js';
import { createRunState, currentSpeed, totalScore, tickEffects, activeTimedEffects } from './core/runstate.js';
import { resolveCollision, RESULT } from './core/collision.js';
import { nextSpawnIntervalMs, spawnGroup, minGapPx } from './core/spawner.js';
import { resolveStage, nodeDistanceAt, stageBanner } from './core/stage.js';
import { rollNodeRewards, rollLoopRewards, cycleOptionIndex, autoSelect, applyReward } from './core/rewards.js';
import { loadMeta, recordRun, saveAppearance, applyPreset } from './core/meta.js';
import { resolveColors } from './render/character.js';
import { Renderer } from './render/renderer.js';

const PX_PER_METER = 10;
const LONG_PRESS_MS = 800;
const OVER_TO_RESULT_MS = 1400;
const BANNER_MS = 1900;

const PART_KEY = { faces: 'face', eyes: 'eyes', mouths: 'mouth', hairs: 'hair', outfits: 'outfit', charms: 'charm' };
const EFFECT_LABEL = {
  scoreMul: '分数倍率',
  speedMul: '速度修正',
  spawnMul: '障碍稀疏',
  invulnExtend: '坚韧皮肤',
  switchGrace: '切换容错',
};

export class GameScene {
  constructor({ canvas, ui, sound, input, storage, themes, rewards, stagesCfg, partsCfg }) {
    this.canvas = canvas;
    this.ui = ui;
    this.sound = sound;
    this.input = input;
    this.storage = storage;
    this.themes = themes;
    this.rewards = rewards;
    this.stagesCfg = stagesCfg;
    this.partsCfg = partsCfg;
    this.renderer = new Renderer(canvas);
    this.mode = 'menu';
    this.paused = false;
    this.menuIndex = 0;
    this.longPressTimer = null;
    this.longPressFired = false;
    this.bannerTimer = null;
    this.expression = 'normal';
    this.expressionUntil = 0;
    this._bindInput();
    this._bindUi();
  }

  _bindInput() {
    this.input.onShiftDown(() => this._onShiftDown());
    this.input.onShiftUp(() => this._onShiftUp());
    this.input.onBlur(() => this.pause());
  }

  _bindUi() {
    this.ui.on.theme = (i) => this.startRun(i);
    this.ui.on.restart = () => this.startRun(this.themeIndex);
    this.ui.on.menu = () => this.showMenu();
    this.ui.on.resume = () => this.resume();
    this.ui.on.mute = () => this.sound.toggleMute();
    this.ui.on.pointerShift = () => this._onShiftDown();
    this.ui.on.pointerShiftUp = () => this._onShiftUp();
    this.ui.on.editor = () => this.openEditor();
    this.ui.on.editorBack = () => this.showMenu();
    this.ui.on.part = (type, id) => {
      saveAppearance(this.storage, { [PART_KEY[type]]: id });
      this.ui.renderEditor();
    };
    this.ui.on.color = (type, id) => {
      saveAppearance(this.storage, { [type]: id });
      this.ui.renderEditor();
    };
    this.ui.on.preset = (id) => {
      applyPreset(this.storage, this.partsCfg, id);
      this.ui.renderEditor();
    };
  }

  // ---------------- 菜单 / 编辑器 ----------------

  showMenu() {
    this.mode = 'menu';
    this.paused = false;
    this.ui.hidePause();
    this.ui.hideResult();
    this.ui.hideReward();
    this.ui.hideStageBanner();
    const meta = loadMeta(this.storage);
    this.ui.setScreen('menu');
    this.ui.renderMenu(this.themes, meta, this.menuIndex);
  }

  openEditor() {
    this.mode = 'editor';
    this.ui.openEditor();
  }

  _onShiftDown() {
    this.sound.ensureContext();
    if (this.paused || this.mode === 'editor') return;
    if (this.mode === 'menu') {
      this.menuIndex = (this.menuIndex + 1) % this.themes.length;
      this.ui.renderMenu(this.themes, loadMeta(this.storage), this.menuIndex);
      this.sound.blip('switch');
      this._armLongPress(() => this.startRun(this.menuIndex));
    } else if (this.mode === 'running') {
      const cd = this.run.modifiers.dashCooldownReduce ? REDUCED_COOLDOWN_MS : SWITCH_COOLDOWN_MS;
      if (cycleForm(this.run.formState, this.run.elapsedMs, cd)) {
        this.sound.blip('switch');
        this._float(this.renderer.playerX, this.renderer.groundY - 96, FORM_META[this.run.formState.form].label, FORM_META[this.run.formState.form].color, 16);
      }
    } else if (this.mode === 'reward') {
      this.reward.index = cycleOptionIndex(this.reward.index, this.reward.options.length);
      this.sound.blip('switch');
    } else if (this.mode === 'over') {
      this._armLongPress(() => this.startRun(this.themeIndex));
    }
  }

  _onShiftUp() {
    clearTimeout(this.longPressTimer);
    const resultVisible = this.ui.root.querySelector('#result-overlay:not(.hidden)');
    if (this.mode === 'over' && !this.longPressFired && resultVisible) this.showMenu();
  }

  _armLongPress(fn) {
    this.longPressFired = false;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = setTimeout(() => {
      this.longPressFired = true;
      fn();
    }, LONG_PRESS_MS);
  }

  // ---------------- 开局 ----------------

  startRun(themeIndex) {
    clearTimeout(this.longPressTimer);
    const meta = loadMeta(this.storage);
    const theme = this.themes[themeIndex];
    if (!meta.unlocked.themes.includes(theme.themeId)) return; // 锁定主题拒绝开局
    this.themeIndex = themeIndex;
    this.theme = theme;
    this.ui.setSkin(theme.uiSkin);
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    this.run = createRunState(theme, { seed, now: 0, appearance: meta.appearance });
    this.appearance = meta.appearance;
    this.colors = resolveColors(this.partsCfg, this.appearance);
    this.rng = mulberry32(seed);
    this.obstacles = [];
    this.particles = [];
    this.floatTexts = [];
    this.spawnTimerMs = 900;
    this.nodeIndex = 0;
    this.nextNodeM = nodeDistanceAt(0, this.stagesCfg);
    this.shake = 0;
    this.expression = 'normal';
    this.mode = 'running';
    this.paused = false;
    this.ui.hidePause();
    this.ui.setScreen('game');
    this.renderer.resize(); // 游戏屏从隐藏切换后需要重新测量画布尺寸
    this.ui.toast(this._banter('runStart'), this.theme.palette.primary);
    this.sound.blip('start');
    this.lastTs = 0;
    if (!this.rafId) this._raf(performance.now());
  }

  // ---------------- 主循环 ----------------

  _raf(ts) {
    this.rafId = requestAnimationFrame((t) => this._raf(t));
    if (!this.lastTs) this.lastTs = ts;
    let dt = ts - this.lastTs;
    this.lastTs = ts;
    // 长帧上钳避免穿透；下钳 0 防止时间戳回退（开局首帧/定时器抖动）导致距离与背景倒转
    dt = Math.max(0, Math.min(50, dt));
    if (!this.paused && this.mode !== 'menu' && this.mode !== 'editor') {
      if (this.mode === 'running') this._updateRunning(dt);
      else if (this.mode === 'reward') this._updateReward(dt);
      this._updateEffects(dt);
    }
    if (this.run) this._draw(ts);
  }

  _updateRunning(dt) {
    const run = this.run;
    run.elapsedMs += dt;
    tickEffects(run, run.elapsedMs);
    const stage = resolveStage(run.distance, this.stagesCfg);
    this.stage = stage;
    const speedPx = currentSpeed(run, stage, run.elapsedMs) * formSpeedMul(run.formState.form);
    const dtSec = dt / 1000;
    run.distance += (speedPx * dtSec) / PX_PER_METER;
    this.renderer.scroll(speedPx * dtSec);

    // 生成障碍组合
    this.spawnTimerMs -= dt;
    if (this.spawnTimerMs <= 0) {
      this._spawnGroup(speedPx, stage);
      this.spawnTimerMs = nextSpawnIntervalMs(stage, this.rng, run, run.elapsedMs);
    }
    // 移动 + 碰撞
    for (const ob of this.obstacles) {
      ob.x -= speedPx * dtSec;
      ob.currentForm = run.formState.form;
      if (!ob.resolved && ob.x <= this.renderer.playerX + 24) {
        ob.resolved = true;
        this._resolve(ob);
      }
    }
    this.obstacles = this.obstacles.filter((ob) => ob.x > -80);

    // 里程节点 → 10 秒奖励
    if (run.distance >= this.nextNodeM) {
      this._enterReward();
      return;
    }
    if (run.over) {
      this._endRun();
      return;
    }
    this.ui.updateHud(this._hudSnapshot(stage));
  }

  _spawnGroup(speedPx, stage) {
    const startX = this.renderer.w + 50;
    const last = this.obstacles[this.obstacles.length - 1];
    const gap = Math.max(96, minGapPx(speedPx));
    if (last && startX - last.x < gap + 70) return; // 间距不足本轮跳过
    const group = spawnGroup(this.rng, this.theme.obstaclePool, stage);
    group.forEach((ob, i) => {
      this.obstacles.push({ ...ob, x: startX + i * (60 + gap), resolved: false, currentForm: this.run.formState.form });
    });
  }

  _resolve(ob) {
    const outcome = resolveCollision(ob, this.run, this.run.elapsedMs);
    const x = this.renderer.playerX;
    const y = this.renderer.groundY - 50;
    if (outcome.result === RESULT.PASS) {
      this._burst(x, y, this.theme.palette.primary, 9);
      this._float(x, y - 20, `+${outcome.gain}`, this.theme.palette.primary, 20);
      this.sound.blip('pass');
      this._setExpression('happy', 700);
    } else if (outcome.result === RESULT.GRACE) {
      this._float(x, y - 20, '容错', '#6fb8d9', 15);
      this.sound.blip('shield');
    } else if (outcome.result === RESULT.SHIELD) {
      this._burst(x, y, '#9db8d8', 10);
      this._float(x, y - 20, '护盾抵消', '#9db8d8', 17);
      this.sound.blip('shield');
    } else if (outcome.result === RESULT.DEATH_SAVE) {
      this._burst(x, y, '#e8c86a', 12);
      this._float(x, y - 20, '免死！', '#e8c86a', 19);
      this.sound.blip('shield');
    } else {
      this.shake = 9; // 抖屏弱化：幅度更小、恢复更快
      this._burst(x, y, this.theme.palette.danger, 10);
      this._float(x, y - 20, '碰撞 -1', this.theme.palette.danger, 19);
      this.ui.toast(this._banter('hit'), this.theme.palette.danger);
      this.sound.blip('hit');
      this._setExpression('hurt', 900);
    }
    this.ui.updateHud(this._hudSnapshot(this.stage));
  }

  // ---------------- 10 秒里程奖励 ----------------

  _enterReward() {
    this.mode = 'reward';
    const options = this.nodeIndex < this.stagesCfg.nodeRewards.length
      ? rollNodeRewards(this.nodeIndex, this.rewards, this.stagesCfg)
      : rollLoopRewards(this.rng, this.rewards, this.run);
    this.reward = { options, index: 0, remainMs: this.stagesCfg.decisionWindowMs, totalMs: this.stagesCfg.decisionWindowMs };
    this.ui.showReward(options, 0, this.reward.remainMs, this.reward.totalMs, this._banter('reward'));
    this.sound.blip('decision');
  }

  _updateReward(dt) {
    this.reward.remainMs -= dt;
    this.ui.updateReward(this.reward.remainMs, this.reward.totalMs, this.reward.index);
    if (this.reward.remainMs <= 0) this._finishReward();
  }

  _finishReward() {
    const option = autoSelect(this.reward.options, this.reward.index);
    applyReward(this.run, option, this.run.elapsedMs);
    this._float(this.renderer.playerX, this.renderer.groundY - 110, option.label, this.theme.palette.primary, 18);
    this.ui.hideReward();
    this.nodeIndex += 1;
    this.nextNodeM = nodeDistanceAt(this.nodeIndex, this.stagesCfg);
    this.mode = 'running';
    this.lastTs = 0;
    // 进入新阶段：展示阶段牌
    const banner = stageBanner(this.run.distance, this.stagesCfg);
    this.ui.showStageBanner(banner.label, banner.rule);
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.ui.hideStageBanner(), BANNER_MS);
    this.ui.updateHud(this._hudSnapshot(resolveStage(this.run.distance, this.stagesCfg)));
  }

  // ---------------- 结束与结算 ----------------

  _endRun() {
    this.mode = 'over';
    this.shake = 12;
    this._setExpression('hurt', 1200);
    this._burst(this.renderer.playerX, this.renderer.groundY - 50, this.theme.palette.danger, 16);
    this.sound.blip('over');
    setTimeout(() => {
      if (this.mode !== 'over') return;
      const score = totalScore(this.run);
      const { meta, newly } = recordRun(this.storage, this.themes, this.partsCfg, this.run, score);
      if (newly.themes.length || newly.parts.length || newly.presets.length) this.sound.blip('unlock');
      const banner = stageBanner(this.run.distance, this.stagesCfg);
      this.ui.showResult({
        theme: this.theme,
        run: this.run,
        score,
        best: meta.best[this.run.themeId],
        stageLabel: banner.label,
        newly,
      });
    }, OVER_TO_RESULT_MS);
  }

  // ---------------- 暂停 ----------------

  pause() {
    if (this.paused || this.mode === 'menu' || this.mode === 'over' || this.mode === 'editor') return;
    this.paused = true;
    clearTimeout(this.longPressTimer);
    this.ui.showPause();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.lastTs = 0;
    this.ui.hidePause();
  }

  // ---------------- 表情 / 特效与 HUD ----------------

  _setExpression(kind, ms) {
    this.expression = kind;
    this.expressionUntil = this.run.elapsedMs + ms;
  }

  _currentExpression() {
    return this.run.elapsedMs < this.expressionUntil ? this.expression : 'normal';
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const angle = (Math.PI * 2 * i) / n + this.rng();
      const speed = 70 + this.rng() * 130;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        r: 2 + this.rng() * 2.4,
        color,
        life: 520, maxLife: 520,
      });
    }
  }

  _float(x, y, text, color, size) {
    this.floatTexts.push({ x, y, text, color, size, life: 850, maxLife: 850 });
  }

  _updateEffects(dt) {
    const dtSec = dt / 1000;
    for (const p of this.particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 280 * dtSec;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.floatTexts) {
      t.y -= 30 * dtSec;
      t.life -= dt;
    }
    this.floatTexts = this.floatTexts.filter((t) => t.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.08);
  }

  _draw(now) {
    const invuln = this.run.elapsedMs < this.run.invulnUntil;
    this.renderer.render({
      theme: this.theme,
      run: this.run,
      obstacles: this.obstacles,
      particles: this.particles,
      floatTexts: this.floatTexts,
      now: this.run.elapsedMs,
      appearance: this.appearance,
      colors: this.colors,
      invuln,
      shake: this.shake,
      expression: this._currentExpression(),
    });
  }

  _hudSnapshot(stage) {
    const timed = activeTimedEffects(this.run, this.run.elapsedMs).map((e) => ({
      label: EFFECT_LABEL[e.key] || e.key,
      remainSec: Math.ceil((e.expireAt - this.run.elapsedMs) / 1000),
    }));
    return {
      hearts: this.run.hearts,
      maxHearts: this.run.maxHearts,
      form: this.run.formState.form,
      score: totalScore(this.run),
      distance: Math.floor(this.run.distance),
      stageLabel: stage.loopLevel > 0 ? `Stage 4+${stage.loopLevel}` : `Stage ${stage.stageIndex}`,
      timed,
      shields: this.run.modifiers.shieldCharges,
      deathSave: this.run.modifiers.deathSave,
    };
  }

  _banter(key) {
    const lines = this.theme.banter[key];
    return lines[Math.floor(this.rng() * lines.length)];
  }
}
