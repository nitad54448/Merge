(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});

  const SKINS = [
    {
      id: 'wood',
      name: 'Wood',
      desc: 'Warm carved woodgrain',
      swatch: 'linear-gradient(135deg, #d97706, #78350f)'
    },
    {
      id: 'iron',
      name: 'Iron',
      desc: 'Brushed steel & rivets',
      swatch: 'linear-gradient(135deg, #94a3b8, #334155)'
    },
    {
      id: 'jewel',
      name: 'Jewel',
      desc: 'Faceted prism gems',
      swatch: 'linear-gradient(135deg, #38bdf8, #7c3aed)'
    },
    {
      id: 'brick',
      name: 'Brick',
      desc: 'Bold arcade 3D blocks',
      swatch: 'linear-gradient(135deg, #fb7185, #be123c)'
    }
  ];

  const BACKGROUNDS = [
    {
      id: 'woodland',
      name: 'Woodland',
      desc: 'Warm cedar glow',
      swatch: 'linear-gradient(135deg, #5c3721, #1c100a)',
      themeColor: '#1c100a'
    },
    {
      id: 'ocean',
      name: 'Ocean',
      desc: 'Calm deep sea',
      swatch: 'linear-gradient(135deg, #1d5d8f, #061322)',
      themeColor: '#071324'
    },
    {
      id: 'sunset',
      name: 'Sunset',
      desc: 'Dusk plum & coral',
      swatch: 'linear-gradient(135deg, #7c2d4a, #170f1e)',
      themeColor: '#170f1e'
    },
    {
      id: 'slate',
      name: 'Slate',
      desc: 'Midnight clean slate',
      swatch: 'linear-gradient(135deg, #334155, #0f172a)',
      themeColor: '#0f172a'
    }
  ];

  const BASE_TIERS = {
    2:    { top: '#e08e45', bot: '#9c5221', rim: '#fbbf77', text: '#fffdf7' },
    4:    { top: '#c96f2d', bot: '#7d3c14', rim: '#f5a86b', text: '#fffdf7' },
    8:    { top: '#ea580c', bot: '#9a3412', rim: '#fdba74', text: '#ffffff' },
    16:   { top: '#e11d48', bot: '#881337', rim: '#fda4af', text: '#ffffff' },
    32:   { top: '#9333ea', bot: '#581c87', rim: '#d8b4fe', text: '#ffffff' },
    64:   { top: '#2563eb', bot: '#1e3a8a', rim: '#93c5fd', text: '#ffffff' },
    128:  { top: '#0284c7', bot: '#0c4a6e', rim: '#7dd3fc', text: '#ffffff' },
    256:  { top: '#059669', bot: '#064e3b', rim: '#6ee7b7', text: '#ffffff' },
    512:  { top: '#65a30d', bot: '#365314', rim: '#bef264', text: '#ffffff' },
    1024: { top: '#eab308', bot: '#854d0e', rim: '#fef08a', text: '#fffbeb' },
    2048: { top: '#f43f5e', bot: '#881337', rim: '#fde047', text: '#ffffff' },
    4096: { top: '#06b6d4', bot: '#164e63', rim: '#fef08a', text: '#ffffff' },
    8192: { top: '#ec4899', bot: '#701a75', rim: '#fef08a', text: '#ffffff' }
  };

  const WOOD_OVERRIDES = {
    2:    { top: '#d99b52', bot: '#9c6228', rim: '#f3cb8f', text: '#fffbeb' },
    4:    { top: '#bf7938', bot: '#7a4218', rim: '#e8ad73', text: '#fffbeb' },
    8:    { top: '#a85b28', bot: '#632e10', rim: '#dc8f5c', text: '#fffbeb' },
    16:   { top: '#c2410c', bot: '#7c2d12', rim: '#fdba74', text: '#ffffff' },
    32:   { top: '#b91c1c', bot: '#6e1111', rim: '#fca5a5', text: '#ffffff' },
    64:   { top: '#7e22ce', bot: '#4a127a', rim: '#d8b4fe', text: '#ffffff' },
    128:  { top: '#1d4ed8', bot: '#1e3a8a', rim: '#93c5fd', text: '#ffffff' },
    256:  { top: '#0f766e', bot: '#134e4a', rim: '#5eead4', text: '#ffffff' },
    512:  { top: '#15803d', bot: '#14532d', rim: '#86efac', text: '#ffffff' },
    1024: { top: '#d97706', bot: '#78350f', rim: '#fde047', text: '#fffbeb' },
    2048: { top: '#eab308', bot: '#854d0e', rim: '#fef9c3', text: '#ffffff' }
  };

  const IRON_OVERRIDES = {
    2:    { top: '#94a3b8', bot: '#475569', rim: '#cbd5e1', text: '#ffffff' },
    4:    { top: '#78889b', bot: '#384659', rim: '#b4c2d1', text: '#ffffff' },
    8:    { top: '#a17c5b', bot: '#593d25', rim: '#d6b494', text: '#ffffff' },
    16:   { top: '#b45309', bot: '#692d06', rim: '#fbbf24', text: '#ffffff' },
    32:   { top: '#be123c', bot: '#6b0f26', rim: '#fda4af', text: '#ffffff' },
    64:   { top: '#6d28d9', bot: '#3b1578', rim: '#c4b5fd', text: '#ffffff' },
    128:  { top: '#1d4ed8', bot: '#172554', rim: '#93c5fd', text: '#ffffff' },
    256:  { top: '#0e7490', bot: '#083344', rim: '#67e8f9', text: '#ffffff' },
    512:  { top: '#047857', bot: '#022c22', rim: '#6ee7b7', text: '#ffffff' },
    1024: { top: '#ca8a04', bot: '#713f12', rim: '#fde047', text: '#ffffff' },
    2048: { top: '#f59e0b', bot: '#78350f', rim: '#fef08a', text: '#ffffff' }
  };

  function getTierColors(val, skinId) {
    if (skinId === 'wood' && WOOD_OVERRIDES[val]) return WOOD_OVERRIDES[val];
    if (skinId === 'iron' && IRON_OVERRIDES[val]) return IRON_OVERRIDES[val];
    if (BASE_TIERS[val]) return BASE_TIERS[val];
    // Beyond 8192: cycle vibrant prism colors
    const exp = Math.max(0, Math.round(Math.log2(Math.max(2, val))));
    const cycle = [
      { top: '#14b8a6', bot: '#115e59', rim: '#fef08a', text: '#ffffff' },
      { top: '#f97316', bot: '#9a3412', rim: '#fef08a', text: '#ffffff' },
      { top: '#6366f1', bot: '#312e81', rim: '#fef08a', text: '#ffffff' }
    ];
    return cycle[exp % cycle.length];
  }

  function formatValue(val) {
    if (val >= 16384) {
      return Math.round(val / 1024) + 'K';
    }
    return String(val);
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSlot(ctx, x, y, size, skinId, highlightColor) {
    const r = Math.max(7, size * 0.17);
    ctx.save();
    roundedRectPath(ctx, x, y, size, size, r);
    if (skinId === 'wood') {
      ctx.fillStyle = 'rgba(20, 11, 6, 0.55)';
      ctx.fill();
      ctx.strokeStyle = highlightColor || 'rgba(217, 119, 6, 0.16)';
    } else if (skinId === 'iron') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
      ctx.fill();
      ctx.strokeStyle = highlightColor || 'rgba(148, 163, 184, 0.18)';
    } else if (skinId === 'jewel') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.54)';
      ctx.fill();
      ctx.strokeStyle = highlightColor || 'rgba(125, 211, 252, 0.18)';
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.52)';
      ctx.fill();
      ctx.strokeStyle = highlightColor || 'rgba(255, 255, 255, 0.12)';
    }
    ctx.lineWidth = highlightColor ? 2 : 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawWoodTexture(ctx, x, y, s, radius) {
    ctx.save();
    roundedRectPath(ctx, x + 2, y + 2, s - 4, s - 4, Math.max(5, radius - 2));
    ctx.clip();

    // Subtle horizontal woodgrain lines
    ctx.strokeStyle = 'rgba(42, 18, 4, 0.22)';
    ctx.lineWidth = Math.max(1, s * 0.025);
    for (let i = 0; i < 3; i++) {
      const yy = y + s * (0.24 + i * 0.26);
      ctx.beginPath();
      ctx.moveTo(x - 2, yy);
      ctx.bezierCurveTo(x + s * 0.35, yy - s * 0.05, x + s * 0.65, yy + s * 0.05, x + s + 2, yy - s * 0.02);
      ctx.stroke();
    }

    // Warm inner bevel frame
    ctx.strokeStyle = 'rgba(255, 243, 214, 0.18)';
    ctx.lineWidth = Math.max(1.2, s * 0.035);
    roundedRectPath(ctx, x + s * 0.07, y + s * 0.07, s * 0.86, s * 0.86, Math.max(4, radius * 0.72));
    ctx.stroke();
    ctx.restore();
  }

  function drawIronTexture(ctx, x, y, s, radius) {
    ctx.save();
    roundedRectPath(ctx, x + 2, y + 2, s - 4, s - 4, Math.max(5, radius - 2));
    ctx.clip();

    // Diagonal brushed metal gleam
    const gleam = ctx.createLinearGradient(x, y, x + s, y + s);
    gleam.addColorStop(0, 'rgba(255,255,255,0.16)');
    gleam.addColorStop(0.45, 'rgba(255,255,255,0.02)');
    gleam.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    gleam.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = gleam;
    ctx.fillRect(x, y, s, s);

    // 4 Corner rivets
    const inset = Math.max(4.5, s * 0.125);
    const rivetR = Math.max(1.3, s * 0.032);
    const corners = [
      [x + inset, y + inset],
      [x + s - inset, y + inset],
      [x + inset, y + s - inset],
      [x + s - inset, y + s - inset]
    ];
    for (const [rx, ry] of corners) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(rx, ry + 0.6, rivetR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(241, 245, 249, 0.58)';
      ctx.beginPath();
      ctx.arc(rx, ry, rivetR * 0.82, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawJewelTexture(ctx, x, y, s, radius) {
    ctx.save();
    roundedRectPath(ctx, x + 2, y + 2, s - 4, s - 4, Math.max(5, radius - 2));
    ctx.clip();

    const m = s * 0.15;
    // Top bright crystal facet
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s - m, y + m);
    ctx.lineTo(x + m, y + m);
    ctx.closePath();
    ctx.fill();

    // Left bright facet
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + m, y + m);
    ctx.lineTo(x + m, y + s - m);
    ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.fill();

    // Bottom deep facet
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.moveTo(x + m, y + s - m);
    ctx.lineTo(x + s - m, y + s - m);
    ctx.lineTo(x + s, y + s);
    ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.fill();

    // Inner diamond table border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + m, y + m, s - m * 2, s - m * 2);

    // Top-left star glint
    const gx = x + m * 1.15;
    const gy = y + m * 1.15;
    const gr = Math.max(2.5, s * 0.07);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.moveTo(gx, gy - gr);
    ctx.lineTo(gx + gr * 0.28, gy - gr * 0.28);
    ctx.lineTo(gx + gr, gy);
    ctx.lineTo(gx + gr * 0.28, gy + gr * 0.28);
    ctx.lineTo(gx, gy + gr);
    ctx.lineTo(gx - gr * 0.28, gy + gr * 0.28);
    ctx.lineTo(gx - gr, gy);
    ctx.lineTo(gx - gr * 0.28, gy - gr * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBrickTexture(ctx, x, y, s, radius) {
    ctx.save();
    // Gloss top strip
    roundedRectPath(ctx, x + 3, y + 3, s - 6, s * 0.38, Math.max(4, radius * 0.72));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    ctx.restore();
  }

  function drawCrownAccent(ctx, cx, yTop, s) {
    const w = Math.max(8, s * 0.24);
    const h = Math.max(5, s * 0.13);
    const y0 = yTop + s * 0.11;
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = 'rgba(113, 63, 18, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y0 + h);
    ctx.lineTo(cx - w / 2, y0 + h * 0.2);
    ctx.lineTo(cx - w * 0.22, y0 + h * 0.58);
    ctx.lineTo(cx, y0);
    ctx.lineTo(cx + w * 0.22, y0 + h * 0.58);
    ctx.lineTo(cx + w / 2, y0 + h * 0.2);
    ctx.lineTo(cx + w / 2, y0 + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTile(ctx, cx, cy, size, val, skinId, opts = {}) {
    const colors = getTierColors(val, skinId || 'wood');
    const scale = opts.scale !== undefined ? opts.scale : 1;
    const alpha = opts.alpha !== undefined ? opts.alpha : 1;
    const s = size * scale;
    if (s <= 1) return;

    const x = cx - s / 2;
    const y = cy - s / 2;
    const radius = Math.max(6, s * 0.18);
    const lipDepth = skinId === 'brick' ? Math.max(3, s * 0.08) : Math.max(2.5, s * 0.06);

    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;

    // 3D base lip
    roundedRectPath(ctx, x, y + lipDepth, s, s, radius);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // Main tile body gradient
    const grad = ctx.createLinearGradient(x, y, x, y + s);
    grad.addColorStop(0, colors.top);
    grad.addColorStop(1, colors.bot);
    roundedRectPath(ctx, x, y, s, s, radius);
    ctx.fillStyle = grad;
    ctx.fill();

    // Material texture overlay
    if (skinId === 'wood') {
      drawWoodTexture(ctx, x, y, s, radius);
    } else if (skinId === 'iron') {
      drawIronTexture(ctx, x, y, s, radius);
    } else if (skinId === 'jewel') {
      drawJewelTexture(ctx, x, y, s, radius);
    } else {
      drawBrickTexture(ctx, x, y, s, radius);
    }

    // Rim stroke (highlighted / danger / normal)
    roundedRectPath(ctx, x + 0.75, y + 0.75, s - 1.5, s - 1.5, radius);
    if (opts.danger) {
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#fb7185';
    } else if (opts.highlighted) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
    } else if (opts.mergeRing) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fde047';
    } else {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = colors.rim;
    }
    ctx.stroke();

    // 2048+ gold crown badge
    if (val >= 2048 && !opts.ghost) {
      drawCrownAccent(ctx, cx, y, s);
    }

    // Number label
    const text = formatValue(val);
    const len = text.length;
    const fontSize = len >= 4 ? s * 0.30 : len === 3 ? s * 0.36 : s * 0.44;
    ctx.font = `900 ${Math.max(10, Math.round(fontSize))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textY = val >= 2048 && !opts.ghost ? cy + s * 0.05 : cy + 0.5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillText(text, cx, textY + Math.max(1.2, s * 0.032));

    ctx.fillStyle = colors.text || '#ffffff';
    ctx.fillText(text, cx, textY);

    ctx.restore();
  }

  MP.Themes = {
    SKINS,
    BACKGROUNDS,
    getTierColors,
    formatValue,
    roundedRectPath,
    drawSlot,
    drawTile
  };
})(window);
