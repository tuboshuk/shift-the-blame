// 程序化 Q 版捏脸主角：脸型/眼睛/嘴巴/发型/衣服/双色/挂件七个部件自由组合。
// 全部 Canvas 矢量绘制，不依赖图片资源；外观数据由 meta.appearance 提供，颜色 hex 由编排层映射注入。
import { FORM_META } from '../core/forms.js';

const SKIN_TONE = '#ffd9b3';
const HAIR_TONE = '#4a3f38';

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------- 脸型 ----------------
function drawFaceShape(ctx, headY, face) {
  ctx.fillStyle = SKIN_TONE;
  if (face === 'square') {
    roundRect(ctx, -19, headY - 19, 38, 37, 11, SKIN_TONE);
  } else if (face === 'sharp') {
    ctx.beginPath();
    ctx.arc(0, headY - 2, 19, Math.PI, 0);
    ctx.lineTo(0, headY + 20);
    ctx.closePath();
    ctx.fill();
  } else {
    circle(ctx, 0, headY, 20, SKIN_TONE);
  }
}

// ---------------- 眼睛（expression 可临时覆盖）----------------
function drawEyes(ctx, headY, eye, expression) {
  const y = headY - 1;
  ctx.fillStyle = '#2b2622';
  ctx.strokeStyle = '#2b2622';
  if (expression === 'hurt') {
    ctx.lineWidth = 2;
    for (const sx of [-7, 7]) {
      ctx.beginPath();
      ctx.moveTo(sx - 2.6, y - 2.6); ctx.lineTo(sx + 2.6, y + 2.6);
      ctx.moveTo(sx + 2.6, y - 2.6); ctx.lineTo(sx - 2.6, y + 2.6);
      ctx.stroke();
    }
    return;
  }
  if (expression === 'happy' || eye === 'star') {
    const color = eye === 'star' ? '#e8c86a' : '#2b2622';
    ctx.fillStyle = color;
    for (const sx of [-7, 7]) {
      ctx.beginPath();
      ctx.arc(sx, y, 3.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    if (eye === 'star') {
      for (const sx of [-7, 7]) {
        ctx.beginPath();
        ctx.moveTo(sx, y - 5); ctx.lineTo(sx + 1.6, y - 1.6); ctx.lineTo(sx + 5, y - 1);
        ctx.lineTo(sx + 1.6, y + 1.2); ctx.lineTo(sx + 3, y + 4.6); ctx.lineTo(sx, y + 2.4);
        ctx.lineTo(sx - 3, y + 4.6); ctx.lineTo(sx - 1.6, y + 1.2); ctx.lineTo(sx - 5, y - 1);
        ctx.lineTo(sx - 1.6, y - 1.6);
        ctx.closePath();
        ctx.fill();
      }
    }
    return;
  }
  if (eye === 'sleepy') {
    ctx.lineWidth = 1.8;
    for (const sx of [-7, 7]) {
      ctx.beginPath();
      ctx.arc(sx, y - 1, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    return;
  }
  if (eye === 'sharp') {
    for (const sx of [-7, 7]) {
      ctx.beginPath();
      ctx.moveTo(sx - 3.4, y + 1.4);
      ctx.lineTo(sx + 3.4, y - 2.2);
      ctx.lineTo(sx + 3.4, y + 1.4);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // bean 豆豆眼
  circle(ctx, -7, y, 3.4, '#2b2622');
  circle(ctx, 7, y, 3.4, '#2b2622');
  circle(ctx, -6, y - 1, 1.1, '#fff');
  circle(ctx, 8, y - 1, 1.1, '#fff');
}

// ---------------- 嘴巴 ----------------
function drawMouth(ctx, headY, mouth, expression) {
  const y = headY + 7;
  ctx.strokeStyle = '#a35d4b';
  ctx.fillStyle = '#a35d4b';
  ctx.lineWidth = 1.6;
  const effective = expression === 'hurt' ? 'open' : expression === 'happy' ? 'smile' : mouth;
  if (effective === 'open') {
    circle(ctx, 0, y + 1, 3, '#9c4f41');
  } else if (effective === 'flat') {
    ctx.beginPath();
    ctx.moveTo(-4, y); ctx.lineTo(4, y);
    ctx.stroke();
  } else if (effective === 'cat') {
    ctx.beginPath();
    ctx.arc(-2.4, y, 2.4, 0.15 * Math.PI, 0.9 * Math.PI);
    ctx.arc(2.4, y, 2.4, 0.1 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, y - 1, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

// ---------------- 发型 ----------------
function drawHair(ctx, headY, hair, accent) {
  ctx.fillStyle = HAIR_TONE;
  ctx.strokeStyle = HAIR_TONE;
  if (hair === 'buns') {
    circle(ctx, -17, headY - 17, 7, HAIR_TONE);
    circle(ctx, 17, headY - 17, 7, HAIR_TONE);
  }
  if (hair === 'cap') {
    // 鸭舌帽：帽身用强调色，帽檐朝前
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, headY - 5, 19, Math.PI, Math.PI * 2);
    ctx.fill();
    roundRect(ctx, -20, headY - 9, 40, 6, 3, accent);
    roundRect(ctx, 2, headY - 8, 22, 5, 2, accent);
    return;
  }
  ctx.beginPath();
  ctx.arc(0, headY - 4, 20, Math.PI, Math.PI * 2);
  ctx.fill();
  if (hair === 'ahoge') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, headY - 22);
    ctx.quadraticCurveTo(6, headY - 30, 2, headY - 34);
    ctx.stroke();
  }
}

// ---------------- 衣服 ----------------
function drawOutfit(ctx, bodyY, outfit, colors) {
  const { main, accent } = colors;
  if (outfit === 'badge') {
    roundRect(ctx, -17, bodyY - 4, 34, 30, 8, main);
    roundRect(ctx, -17, bodyY + 12, 34, 14, 8, shade(main));
    roundRect(ctx, -6, bodyY + 2, 12, 9, 2, '#f4f1e8'); // 工牌卡
    ctx.fillStyle = accent;
    ctx.fillRect(-4, bodyY + 5, 8, 2);
  } else if (outfit === 'apron') {
    roundRect(ctx, -17, bodyY - 4, 34, 30, 8, shade(main));
    roundRect(ctx, -13, bodyY - 2, 26, 28, 6, main); // 围裙面
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, bodyY - 2); ctx.lineTo(-6, bodyY - 10);
    ctx.moveTo(10, bodyY - 2); ctx.lineTo(6, bodyY - 10);
    ctx.stroke();
  } else if (outfit === 'cape') {
    // 斗篷在身后，先画
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-14, bodyY - 8);
    ctx.quadraticCurveTo(-26, bodyY + 18, -20, bodyY + 28);
    ctx.lineTo(20, bodyY + 28);
    ctx.quadraticCurveTo(26, bodyY + 18, 14, bodyY - 8);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, -17, bodyY - 4, 34, 30, 10, main);
  } else {
    // hoodie 卫衣
    circle(ctx, 0, bodyY - 8, 11, shade(main)); // 兜帽
    roundRect(ctx, -17, bodyY - 4, 34, 30, 10, main);
    roundRect(ctx, -17, bodyY + 12, 34, 14, 8, shade(main));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, bodyY + 14); ctx.lineTo(8, bodyY + 14);
    ctx.stroke();
  }
}

// 简单压暗：用于衣服阴影区
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 34);
  const g = Math.max(0, ((n >> 8) & 255) - 34);
  const b = Math.max(0, (n & 255) - 34);
  return `rgb(${r},${g},${b})`;
}

// ---------------- 挂件 ----------------
function drawCharm(ctx, bodyY, charm, colors) {
  if (charm === 'none') return;
  if (charm === 'badge') {
    roundRect(ctx, 9, bodyY + 2, 9, 12, 2, '#f4f1e8');
    ctx.fillStyle = colors.accent;
    ctx.fillRect(11, bodyY + 5, 5, 2);
  } else if (charm === 'scanner') {
    roundRect(ctx, 16, bodyY - 2, 12, 7, 2, '#3a3f45');
    circle(ctx, 27, bodyY + 1, 2.4, colors.accent);
  } else if (charm === 'hamster') {
    circle(ctx, -15, bodyY - 8, 6, '#d8cfc0');
    circle(ctx, -19, bodyY - 13, 2.6, '#d8cfc0');
    circle(ctx, -11, bodyY - 13, 2.6, '#d8cfc0');
    circle(ctx, -16.5, bodyY - 9, 1, '#5b5147');
    circle(ctx, -13.5, bodyY - 9, 1, '#5b5147');
  } else if (charm === 'toast') {
    ctx.fillStyle = '#e3b877';
    ctx.beginPath();
    ctx.moveTo(-20, bodyY + 2);
    ctx.lineTo(-28, bodyY + 16);
    ctx.lineTo(-14, bodyY + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c98f4f';
    ctx.fillRect(-25, bodyY + 9, 8, 3);
  }
}

// 头部组合件（奔跑角色与编辑器预览共用）。
function drawHead(ctx, headY, appearance, colors, expression) {
  drawFaceShape(ctx, headY, appearance.face);
  // 腮红
  circle(ctx, -12, headY + 6, 2.6, 'rgba(224,138,120,0.35)');
  circle(ctx, 12, headY + 6, 2.6, 'rgba(224,138,120,0.35)');
  drawEyes(ctx, headY, appearance.eyes, expression);
  drawMouth(ctx, headY, appearance.mouth, expression);
  drawHair(ctx, headY, appearance.hair, colors.accent);
}

// opts: { appearance, colors:{main,accent}, form, runPhase, invuln, now, expression }
export function drawCharacter(ctx, x, groundY, opts) {
  const { appearance, colors, form, runPhase, invuln, now, expression = 'normal' } = opts;
  const formColor = FORM_META[form].color;

  ctx.save();
  if (invuln && Math.floor(now / 120) % 2 === 0) ctx.globalAlpha = 0.4;
  if (form === 'phase') ctx.globalAlpha *= 0.68;

  const lean = form === 'dash' ? 0.2 : form === 'smash' ? -0.05 : 0;
  const bob = Math.sin(runPhase * Math.PI * 2) * (form === 'smash' ? 1.4 : 2.6);
  ctx.translate(x, groundY + bob);
  ctx.rotate(lean);

  // 形态特效（降刺激：残影减到 2 个、透明度更低）
  if (form === 'dash') {
    for (let i = 1; i <= 2; i += 1) {
      ctx.fillStyle = `rgba(111,207,151,${0.08 / i})`;
      roundRect(ctx, -22 - i * 13, -46, 28, 44, 10, ctx.fillStyle);
    }
  }
  if (form === 'phase') {
    ctx.strokeStyle = 'rgba(111,184,217,0.42)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -34, 25 + Math.sin(now / 140) * 2.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 腿
  const legSwing = Math.sin(runPhase * Math.PI * 2) * 8;
  ctx.strokeStyle = '#34302c';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -10); ctx.lineTo(-6 - legSwing, 0);
  ctx.moveTo(6, -10); ctx.lineTo(6 + legSwing, 0);
  ctx.stroke();

  // 身体 + 挂件
  drawOutfit(ctx, -34, appearance.outfit, colors);
  drawCharm(ctx, -34, appearance.charm, colors);

  // 手臂（重击前置拳套）
  ctx.lineWidth = 5;
  ctx.strokeStyle = shade(colors.main);
  if (form === 'smash') {
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(20, -20);
    ctx.stroke();
    circle(ctx, 25, -18, 7, formColor);
  } else if (form === 'dash') {
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(-16, -24 + legSwing * 0.5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(-14, -22);
    ctx.stroke();
  }

  // 头
  drawHead(ctx, -52, appearance, colors, expression);

  // 形态头饰
  if (form === 'dash') {
    ctx.fillStyle = formColor;
    roundRect(ctx, -19, -60, 38, 5.5, 3, formColor);
  } else if (form === 'phase') {
    ctx.strokeStyle = formColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -52, 23, -0.4, 1.2);
    ctx.stroke();
  } else {
    ctx.fillStyle = formColor;
    roundRect(ctx, -18, -62, 36, 6.5, 3, formColor);
  }

  ctx.restore();

  // 落地阴影
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, groundY + 3, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 编辑器/结算头像预览：只画肩以上，居中于 (cx, cy)，scale 控制大小。
export function drawPortrait(ctx, cx, cy, scale, appearance, colors, expression = 'normal') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  drawOutfit(ctx, 6, appearance.outfit, colors);
  drawHead(ctx, -24, appearance, colors, expression);
  ctx.restore();
}

// 外观颜色 id → 实际 hex：游戏内角色与编辑器预览共用同一映射，避免两处色差。
export function resolveColors(partsCfg, appearance) {
  const main = partsCfg.mainColors.find((c) => c.id === appearance.mainColor);
  const accent = partsCfg.accentColors.find((c) => c.id === appearance.accentColor);
  return {
    main: main ? main.hex : '#6b7280',
    accent: accent ? accent.hex : '#8fd8b0',
  };
}
