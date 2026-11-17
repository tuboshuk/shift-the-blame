// Canvas 渲染器（v3 低刺激版）：背景只做远景剪影与氛围，障碍与角色保持最高可读性。
// 危险色只给障碍门；粒子/抖屏弱化；所有玩法状态由 RunScene 传入，本类只绘制。
import { FORM_META } from '../core/forms.js';
import { drawCharacter } from './character.js';

const STATE_GLYPH = { dash: '»', phase: '◌', smash: '✊' };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.layerOffset = [0, 0, 0];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.groundY = this.h - 110;
    this.playerX = Math.max(120, this.w * 0.22);
  }

  // 视差减速：远景明显慢于前景，避免眩晕（文档 4.1）。
  scroll(deltaPx) {
    this.layerOffset[0] += deltaPx * 0.12;
    this.layerOffset[1] += deltaPx * 0.3;
    this.layerOffset[2] += deltaPx * 0.5;
  }

  render(frame) {
    const { ctx, w, h } = this;
    const { theme, run, obstacles, particles, floatTexts, now, appearance, colors, invuln, shake, expression } = frame;
    const pal = theme.palette;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5);
    this._drawBackground(theme, pal);
    this._drawGround(pal);
    this._drawObstacles(obstacles, pal);
    drawCharacter(ctx, this.playerX, this.groundY, {
      appearance, colors, form: run.formState.form,
      runPhase: (run.elapsedMs / 260) % 1, invuln, now, expression,
    });
    this._drawParticles(particles);
    this._drawFloatTexts(floatTexts);
    ctx.restore();
  }

  _drawBackground(theme, pal) {
    const { ctx, w, h } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, pal.bg1);
    grad.addColorStop(1, pal.bg0);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    theme.world.bgLayers.forEach((layerId, i) => {
      this._drawLayer(layerId, pal, this.layerOffset[i], 0.1 + i * 0.08, i);
    });
  }

  // 远景一律剪影/柔化，不出现可交互物件的描边与高亮。
  _drawLayer(layerId, pal, offset, alpha, depth) {
    const { ctx, w, groundY } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    const gap = 300;
    const shift = -(offset % gap);
    for (let x = shift - gap; x < w + gap; x += gap) {
      switch (layerId) {
        case 'server_rack': {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.roundRect(x, groundY - 220, 150, 220, 8);
          ctx.fill();
          ctx.fillStyle = pal.primary;
          ctx.globalAlpha = alpha * 0.5;
          for (let r = 0; r < 4; r += 1) ctx.fillRect(x + 18, groundY - 200 + r * 44, 26, 5);
          ctx.globalAlpha = alpha;
          break;
        }
        case 'error_rain': {
          ctx.fillStyle = pal.primary;
          ctx.font = '12px monospace';
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillText('500', x + 40, groundY - 170 - ((offset / 4) % 240));
          ctx.globalAlpha = alpha;
          break;
        }
        case 'alert_light': {
          ctx.fillStyle = pal.danger;
          ctx.globalAlpha = alpha * 0.45;
          ctx.beginPath();
          ctx.arc(x + 70, groundY - 235, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          break;
        }
        case 'shelf': {
          ctx.fillStyle = 'rgba(90,70,45,0.35)';
          ctx.fillRect(x, groundY - 210, 180, 12);
          ctx.fillRect(x, groundY - 140, 180, 12);
          ctx.fillRect(x, groundY - 210, 10, 210);
          break;
        }
        case 'fridge': {
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.roundRect(x, groundY - 235, 120, 235, 10);
          ctx.fill();
          ctx.fillStyle = pal.primary;
          ctx.globalAlpha = alpha * 0.6;
          ctx.fillRect(x + 12, groundY - 225, 96, 6);
          ctx.globalAlpha = alpha;
          break;
        }
        case 'night_lamp': {
          ctx.fillStyle = pal.primary;
          ctx.globalAlpha = alpha * 0.4;
          ctx.beginPath();
          ctx.moveTo(x + 40, groundY - 250);
          ctx.lineTo(x - 20, groundY - 120);
          ctx.lineTo(x + 100, groundY - 120);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = alpha;
          break;
        }
        case 'kitchen': {
          ctx.fillStyle = 'rgba(0,0,0,0.32)';
          ctx.roundRect(x, groundY - 175, 180, 175, 10);
          ctx.fill();
          break;
        }
        case 'rift': {
          ctx.strokeStyle = pal.danger;
          ctx.lineWidth = 1.4;
          ctx.globalAlpha = alpha * 0.8;
          ctx.beginPath();
          ctx.moveTo(x + 30, groundY - 250);
          ctx.quadraticCurveTo(x + 70, groundY - 170, x + 20, groundY - 80);
          ctx.stroke();
          ctx.globalAlpha = alpha;
          break;
        }
        case 'shrine': {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x + 20, groundY - 230, 16, 230);
          ctx.fillRect(x + 92, groundY - 230, 16, 230);
          ctx.beginPath();
          ctx.arc(x + 64, groundY - 230, 50, Math.PI, 0);
          ctx.fill();
          break;
        }
        default:
          break;
      }
    }
    ctx.restore();
  }

  _drawGround(pal) {
    const { ctx, w, groundY, h } = this;
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = pal.primary;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.globalAlpha = 0.14;
    for (let x = -(this.layerOffset[2] % 96); x < w; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 34);
      ctx.lineTo(x + 38, groundY + 34);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawObstacles(obstacles, pal) {
    const { ctx, groundY } = this;
    for (const ob of obstacles) {
      const realColor = FORM_META[ob.needState].color;
      const shownForm = ob.fakeHint ? ob.fakeState : ob.needState;
      const x = ob.x;
      const y = groundY - 4;
      const matched = ob.needState === ob.currentForm;
      ctx.save();
      ctx.globalAlpha = ob.resolved ? 0.22 : 1;
      // 门体颜色永远表达真实形态；假提示门用虚线边框提示“标注有诈”
      ctx.fillStyle = 'rgba(12,14,18,0.85)';
      ctx.strokeStyle = realColor;
      ctx.lineWidth = matched ? 3.5 : 2;
      ctx.setLineDash(ob.fakeHint ? [6, 5] : []);
      ctx.shadowColor = realColor;
      ctx.shadowBlur = matched ? 10 : 4;
      ctx.beginPath();
      ctx.roundRect(x - 30, y - 86, 60, 86, 10);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      // 符号与名称：假提示显示虚假形态，并用危险色标注问号
      ctx.fillStyle = realColor;
      ctx.font = 'bold 22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(STATE_GLYPH[shownForm], x, y - 52);
      ctx.font = 'bold 15px system-ui';
      ctx.fillText(ob.glyph, x, y - 26);
      ctx.font = '11px system-ui';
      ctx.fillStyle = '#cfd6da';
      ctx.fillText(ob.name, x, y - 10);
      ctx.fillStyle = ob.fakeHint ? pal.danger : realColor;
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(`${FORM_META[shownForm].label}${ob.fakeHint ? ' ?' : ''}`, x, y - 94);
      ctx.restore();
    }
  }

  _drawParticles(particles) {
    const { ctx } = this;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawFloatTexts(texts) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = `bold ${t.size || 18}px system-ui`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
