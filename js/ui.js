// UI 表现层（v3）：菜单/捏脸编辑器/四区 HUD/里程奖励弹层/阶段牌/结算/暂停，不含任何玩法规则。
import { FORM_META } from './core/forms.js';
import { themeUnlockState, loadMeta, isPartUnlocked } from './core/meta.js';
import { drawPortrait, resolveColors } from './render/character.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const PART_GROUPS = [
  { type: 'faces', label: '脸型' },
  { type: 'eyes', label: '眼睛' },
  { type: 'mouths', label: '嘴巴' },
  { type: 'hairs', label: '发型' },
  { type: 'outfits', label: '衣服' },
  { type: 'charms', label: '挂件' },
];

export class UI {
  constructor(root, storage, partsCfg) {
    this.root = root;
    this.storage = storage;
    this.partsCfg = partsCfg;
    this.on = {};
    this._delegate();
  }

  setSkin(skin) {
    this.root.dataset.skin = skin;
  }

  setScreen(name) {
    this.root.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('hidden', el.id !== `screen-${name}`);
    });
  }

  _delegate() {
    this.root.addEventListener('click', (e) => {
      const themeCard = e.target.closest('[data-theme-index]');
      if (themeCard) {
        if (themeCard.dataset.locked === '1') return;
        return this.on.theme?.(Number(themeCard.dataset.themeIndex));
      }
      const partBtn = e.target.closest('[data-part-type]');
      if (partBtn) {
        if (partBtn.dataset.locked === '1') return;
        return this.on.part?.(partBtn.dataset.partType, partBtn.dataset.partId);
      }
      const colorBtn = e.target.closest('[data-color-type]');
      if (colorBtn) return this.on.color?.(colorBtn.dataset.colorType, colorBtn.dataset.colorId);
      const presetBtn = e.target.closest('[data-preset-id]');
      if (presetBtn) {
        if (presetBtn.dataset.locked === '1') return;
        return this.on.preset?.(presetBtn.dataset.presetId);
      }
      const act = e.target.closest('[data-action]');
      if (!act) return;
      ({
        restart: () => this.on.restart?.(),
        menu: () => this.on.menu?.(),
        resume: () => this.on.resume?.(),
        editor: () => this.on.editor?.(),
        'editor-back': () => this.on.editorBack?.(),
        mute: () => {
          const muted = this.on.mute?.();
          act.textContent = muted ? '🔇' : '🔊';
        },
      }[act.dataset.action] || (() => {}))();
    });
    const keyBtn = () => this.root.querySelector('#shift-btn');
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#shift-btn')) this.on.pointerShift?.();
    });
    this.root.addEventListener('pointerup', (e) => {
      if (e.target.closest('#shift-btn')) this.on.pointerShiftUp?.();
    });
  }

  // ---------------- 主菜单 ----------------

  renderMenu(themes, meta, selectedIndex) {
    this._themes = themes;
    const unlock = themeUnlockState(meta, themes);
    const screen = this.root.querySelector('#screen-menu');
    screen.innerHTML = `
      <div class="menu-head">
        <h1 class="game-title">SHIFT the Blame</h1>
        <p class="game-sub">三形态无尽奔跑 · 只用一个 Shift</p>
      </div>
      <div class="menu-scroll">
        <section class="menu-block">
          <h2>选择世界</h2>
          <div class="theme-cards">
            ${themes.map((t, i) => {
              const st = unlock[t.themeId];
              const best = meta.best[t.themeId];
              return `
              <article class="theme-card ${i === selectedIndex ? 'selected' : ''} ${st.unlocked ? '' : 'locked'}"
                data-theme-index="${i}" data-locked="${st.unlocked ? 0 : 1}">
                <h3>${escapeHtml(t.displayName)}</h3>
                <p class="theme-scene">${escapeHtml(t.world.scene)}</p>
                ${st.unlocked
                  ? `<p class="theme-best">${best ? `最高 ${best.score} 分 · ${best.distance}m` : '尚未挑战'}</p>`
                  : `<p class="theme-lock">🔒 前一世界达到 ${st.need}m 解锁（当前 ${st.prevBest}m）</p>`}
              </article>`;
            }).join('')}
          </div>
          <p class="menu-hint">短按 <span class="kbd">SHIFT</span> 切换世界 · 长按 <span class="kbd">SHIFT</span> 进入选中世界（也可点击卡片）</p>
        </section>
        <section class="menu-block editor-entry">
          <div>
            <h2>角色捏脸</h2>
            <p class="menu-hint">自由组合五官、发型、衣服与配色，主题预设可一键套用</p>
          </div>
          <button class="btn btn-wide" data-action="editor">打开捏脸编辑器</button>
        </section>
        <p class="menu-hint">已挑战 ${meta.runsCount} 局 · 累计里程 ${meta.totalDistance}m</p>
      </div>`;
  }

  // ---------------- 捏脸编辑器 ----------------

  openEditor() {
    this.setScreen('editor');
    this.renderEditor();
  }

  renderEditor() {
    const meta = loadMeta(this.storage);
    const ap = meta.appearance;
    const screen = this.root.querySelector('#screen-editor');
    const partChips = (type) => this.partsCfg[type].map((item) => {
      const unlocked = isPartUnlocked(meta, item.id);
      const active = this._appearanceKey(type) === item.id;
      const lockText = !unlocked && item.unlock
        ? `🔒 ${item.unlock.runs ? `${item.unlock.runs} 局` : `${item.unlock.distance}m`}`
        : '';
      return `<button class="chip ${active ? 'active' : ''}" data-part-type="${type}" data-part-id="${item.id}"
        data-locked="${unlocked ? 0 : 1}">${unlocked ? escapeHtml(item.name) : `${escapeHtml(item.name)} ${lockText}`}</button>`;
    }).join('');

    // 外观键为单数（mainColor），partsCfg 颜色数组为复数（mainColors），此处显式映射
    const colorSwatches = (colorType) => this.partsCfg[`${colorType}s`].map((c) => `
      <button class="swatch ${ap[colorType] === c.id ? 'active' : ''}" data-color-type="${colorType}"
        data-color-id="${c.id}" style="--sw:${c.hex}" title="${c.id}"></button>`).join('');

    screen.innerHTML = `
      <div class="editor-wrap">
        <div class="editor-head">
          <h2>捏脸编辑器</h2>
          <button class="btn btn-ghost btn-small" data-action="editor-back">返回菜单</button>
        </div>
        <div class="editor-body">
          <div class="editor-preview">
            <canvas id="avatar-canvas" width="260" height="260"></canvas>
            <div class="preset-row">
              ${this.partsCfg.presets.map((p) => {
                const unlocked = meta.unlocked.presets.includes(p.id);
                return `<button class="chip ${unlocked ? '' : 'locked'}" data-preset-id="${p.id}"
                  data-locked="${unlocked ? 0 : 1}">${unlocked ? escapeHtml(p.name) : `🔒 ${escapeHtml(p.name)}（${p.unlockRuns} 局）`}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="editor-controls">
            ${PART_GROUPS.map((g) => `
              <section class="edit-group">
                <h3>${g.label}</h3>
                <div class="chip-row">${partChips(g.type)}</div>
              </section>`).join('')}
            <section class="edit-group">
              <h3>主色（衣服）</h3>
              <div class="swatch-row">${colorSwatches('mainColor')}</div>
            </section>
            <section class="edit-group">
              <h3>强调色（装饰）</h3>
              <div class="swatch-row">${colorSwatches('accentColor')}</div>
            </section>
          </div>
        </div>
      </div>`;
    this._drawAvatar();
  }

  // partsCfg 的数组字段（faces/eyes/...）与 appearance 键（face/eye/...）的映射。
  _appearanceKey(type) {
    const map = { faces: 'face', eyes: 'eyes', mouths: 'mouth', hairs: 'hair', outfits: 'outfit', charms: 'charm' };
    return loadMeta(this.storage).appearance[map[type]];
  }

  _drawAvatar() {
    const canvas = this.root.querySelector('#avatar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const meta = loadMeta(this.storage);
    const colors = resolveColors(this.partsCfg, meta.appearance);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPortrait(ctx, canvas.width / 2, canvas.height / 2 + 24, 3.4, meta.appearance, colors, 'happy');
  }

  // ---------------- HUD（四区结构，文档 6.1）----------------

  hudMarkup() {
    return `
      <div class="hud">
        <div class="hud-left">
          <div class="hud-line">
            <span class="hud-stage" id="hud-stage">Stage 1</span>
            <span class="hud-item">分数 <b id="hud-score">0</b></span>
            <span class="hud-item">里程 <b id="hud-distance">0m</b></span>
          </div>
          <div class="hud-sub">
            <span id="hud-hearts" class="hud-hearts"></span>
            <span id="hud-effects" class="hud-effects"></span>
          </div>
        </div>
        <div class="hud-right">
          <span class="hud-forms">
            ${Object.entries(FORM_META).map(([key, m]) => `
              <span class="form-chip" data-form="${key}" style="--form-color:${m.color}">
                <i class="form-glyph">${{ dash: '»', phase: '◌', smash: '✊' }[key]}</i>${m.label}
              </span>`).join('')}
          </span>
          <button class="icon-btn" data-action="mute">${localStorage.getItem('stb_muted') === '1' ? '🔇' : '🔊'}</button>
        </div>
      </div>
      <div id="stage-banner" class="stage-banner hidden"></div>
      <div class="bottom-hint">切换顺序 <b>冲刺 → 相位 → 重击</b> · 按 <span class="kbd">SHIFT</span> 循环</div>
      <div id="toast" class="toast"></div>
      <div id="reward-overlay" class="overlay hidden"></div>
      <div id="result-overlay" class="overlay hidden"></div>
      <div id="pause-overlay" class="overlay hidden">
        <div class="pause-card">
          <h2>已暂停</h2>
          <p>窗口失焦，奔跑已冻结</p>
          <button class="btn" data-action="resume">点击继续</button>
        </div>
      </div>
      <button id="shift-btn" class="shift-btn">SHIFT</button>`;
  }

  updateHud(snap) {
    this.root.querySelector('#hud-hearts').textContent = '❤'.repeat(snap.hearts) + '🤍'.repeat(snap.maxHearts - snap.hearts);
    this.root.querySelector('#hud-score').textContent = String(snap.score);
    this.root.querySelector('#hud-distance').textContent = `${snap.distance}m`;
    this.root.querySelector('#hud-stage').textContent = snap.stageLabel;
    this.root.querySelectorAll('.form-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.form === snap.form);
    });
    const effects = [
      ...snap.timed.map((t) => `<span class="effect-chip">${escapeHtml(t.label)} ${t.remainSec}s</span>`),
      ...(snap.shields > 0 ? [`<span class="effect-chip">🛡${snap.shields}</span>`] : []),
      ...(snap.deathSave > 0 ? [`<span class="effect-chip">免死×${snap.deathSave}</span>`] : []),
    ];
    this.root.querySelector('#hud-effects').innerHTML = effects.join('');
  }

  showStageBanner(label, rule) {
    const el = this.root.querySelector('#stage-banner');
    el.innerHTML = `<b>${escapeHtml(label)}</b><span>${escapeHtml(rule)}</span>`;
    el.classList.remove('hidden');
  }

  hideStageBanner() {
    this.root.querySelector('#stage-banner')?.classList.add('hidden');
  }

  // ---------------- 10 秒里程奖励弹层 ----------------

  showReward(options, index, remainMs, totalMs, banter) {
    const overlay = this.root.querySelector('#reward-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <div class="decision-head">
        <h2>里程奖励</h2>
        <p class="decision-banter">${escapeHtml(banter)}</p>
      </div>
      <div class="decision-cards">
        ${options.map((o, i) => `
          <article class="decision-card ${i === index ? 'selected' : ''}" data-decision-index="${i}">
            <span class="decision-type">${{ score: '高分', survivor: '保命', comfort: '舒适', form: '形态' }[o.category]}</span>
            <h3>${escapeHtml(o.label)}</h3>
            <p>${escapeHtml(o.desc)}</p>
          </article>`).join('')}
      </div>
      <div class="decision-foot">
        <div class="decision-ring"><span id="decision-timer">10.0s</span></div>
        <p>按 <span class="kbd">SHIFT</span> 循环高亮 · 超时自动确认</p>
      </div>`;
    this.updateReward(remainMs, totalMs, index);
  }

  updateReward(remainMs, totalMs, index) {
    this.root.querySelectorAll('.decision-card').forEach((card, i) => {
      card.classList.toggle('selected', i === index);
    });
    const timer = this.root.querySelector('#decision-timer');
    if (timer) timer.textContent = `${(Math.max(0, remainMs) / 1000).toFixed(1)}s`;
    const ring = this.root.querySelector('.decision-ring');
    if (ring) ring.style.setProperty('--dec', `${(remainMs / totalMs) * 360}deg`);
  }

  hideReward() {
    this.root.querySelector('#reward-overlay')?.classList.add('hidden');
  }

  // ---------------- 结算 ----------------

  _partName(id) {
    for (const group of ['faces', 'eyes', 'mouths', 'hairs', 'outfits', 'charms']) {
      const hit = this.partsCfg[group].find((p) => p.id === id);
      if (hit) return hit.name;
    }
    const preset = this.partsCfg.presets.find((p) => p.id === id);
    return preset ? preset.name : id;
  }

  showResult(payload) {
    const { theme, run, score, best, stageLabel, newly } = payload;
    const unlockNames = [
      ...newly.themes.map((id) => `新世界：${this._themes.find((t) => t.themeId === id)?.displayName || id}`),
      ...newly.parts.map((id) => `新配件：${this._partName(id)}`),
      ...newly.presets.map((id) => `新预设：${this._partName(id)}`),
    ];
    const overlay = this.root.querySelector('#result-overlay');
    overlay.innerHTML = `
      <div class="result-card">
        <h2>本局结束 · ${escapeHtml(theme.displayName)}</h2>
        <div class="score-big">${score}<small>分</small></div>
        <div class="result-grid">
          <div><span>到达阶段</span><b>${escapeHtml(stageLabel)}</b></div>
          <div><span>存活里程</span><b>${Math.floor(run.distance)}m</b></div>
          <div><span>最高连击</span><b>x${run.bestCombo}</b></div>
          <div><span>成功通过</span><b>${run.successCount}</b></div>
          <div><span>碰撞次数</span><b>${run.hitCount}</b></div>
          <div><span>奖励次数</span><b>${run.rewardsTaken}</b></div>
          <div><span>历史最高</span><b>${best.score} 分 / ${best.distance}m</b></div>
        </div>
        ${unlockNames.length ? `<div class="unlock-box">🏆 ${unlockNames.map(escapeHtml).join('　')}</div>` : ''}
        <div class="result-actions">
          <button class="btn" data-action="restart">立即重开</button>
          <button class="btn btn-ghost" data-action="menu">回到主菜单</button>
        </div>
        <p class="menu-hint">短按 <span class="kbd">SHIFT</span> 回菜单 · 长按 <span class="kbd">SHIFT</span> 快速重开</p>
      </div>`;
    overlay.classList.remove('hidden');
  }

  hideResult() {
    this.root.querySelector('#result-overlay')?.classList.add('hidden');
  }

  showPause() {
    this.root.querySelector('#pause-overlay')?.classList.remove('hidden');
  }

  hidePause() {
    this.root.querySelector('#pause-overlay')?.classList.add('hidden');
  }

  toast(text, color) {
    const el = this.root.querySelector('#toast');
    el.textContent = text;
    el.style.color = color || '#fff';
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
}
