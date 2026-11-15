(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});
  MP.Modes = MP.Modes || {};

  const COLS = 5;
  const ROWS = 7;
  const PALETTE_OPTS = { palette: 'mania' };

  function makeEmptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function getTopRow(grid, col) {
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][col] !== null) return r;
    }
    return -1;
  }

  function countTiles(grid) {
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) count++;
      }
    }
    return count;
  }

  function getMaxTile(state) {
    let max = 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = state.grid[r][c];
        if (v && v > max) max = v;
      }
    }
    return max;
  }

  function isExposed(grid, r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    if (grid[r][c] === null) return false;
    if (r === 0 || grid[r - 1][c] === null) return true;
    if (c > 0 && grid[r][c - 1] === null) return true;
    if (c < COLS - 1 && grid[r][c + 1] === null) return true;
    return false;
  }

  function compactColumn(grid, col) {
    let writeR = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][col] !== null) {
        if (r !== writeR) {
          grid[writeR][col] = grid[r][col];
          grid[r][col] = null;
          MP.Effects.popCell(writeR, col);
        }
        writeR--;
      }
    }
  }

  function compactAllColumns(grid) {
    for (let c = 0; c < COLS; c++) {
      compactColumn(grid, c);
    }
  }

  function rollRowValue(maxTile) {
    const pool = [2, 4, 8];
    if (maxTile >= 64) pool.push(16);
    if (maxTile >= 256) pool.push(32);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function rollRowValues(maxTile) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      let val = rollRowValue(maxTile);
      if (c >= 2 && row[c - 1] === val && row[c - 2] === val) {
        val = val === 2 ? 4 : 2;
      }
      row.push(val);
    }
    return row;
  }

  function pickNonMatching(pool, forbiddenA, forbiddenB) {
    const choices = pool.filter((v) => v !== forbiddenA && v !== forbiddenB);
    const list = choices.length > 0 ? choices : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  function createInitialState() {
    const grid = makeEmptyGrid();
    const heights = [4, 3, 3, 2, 3];
    for (let i = heights.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = heights[i];
      heights[i] = heights[j];
      heights[j] = tmp;
    }

    // Fill columns bottom-up with higher numbers biased lower and no resting vertical matches
    for (let c = 0; c < COLS; c++) {
      const topR = ROWS - heights[c];
      for (let r = ROWS - 1; r >= topR; r--) {
        const below = r < ROWS - 1 ? grid[r + 1][c] : null;
        const pool = r >= ROWS - 2 ? [4, 8, 16, 8] : [2, 4, 2, 8];
        grid[r][c] = pickNonMatching(pool, below, null);
      }
    }

    // Guarantee a Move-1 vertical cascade setup: 2 (top), 4, 8 in one 3+ column, plus another exposed 2
    const tallCols = [];
    for (let c = 0; c < COLS; c++) {
      if (heights[c] >= 3) tallCols.push(c);
    }
    const cascadeCol = tallCols[Math.floor(Math.random() * tallCols.length)];
    const casTop = ROWS - heights[cascadeCol];
    grid[casTop][cascadeCol] = 2;
    grid[casTop + 1][cascadeCol] = 4;
    grid[casTop + 2][cascadeCol] = 8;
    if (casTop + 3 < ROWS && grid[casTop + 3][cascadeCol] === 8) {
      grid[casTop + 3][cascadeCol] = 16;
    }

    const otherCols = [];
    for (let c = 0; c < COLS; c++) {
      if (c !== cascadeCol) otherCols.push(c);
    }
    const pairCol = otherCols[Math.floor(Math.random() * otherCols.length)];
    const pairTop = ROWS - heights[pairCol];
    grid[pairTop][pairCol] = 2;
    if (pairTop + 1 < ROWS && grid[pairTop + 1][pairCol] === 2) {
      const belowBelow = pairTop + 2 < ROWS ? grid[pairTop + 2][pairCol] : null;
      grid[pairTop + 1][pairCol] = pickNonMatching([4, 8, 16], 2, belowBelow);
    }

    return {
      grid,
      paceMoves: 5,
      gameOver: false
    };
  }

  function validateSavedState(saved) {
    if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      if (!Array.isArray(saved.grid[r]) || saved.grid[r].length !== COLS) return false;
    }
    if (typeof saved.paceMoves !== 'number' || Number.isNaN(saved.paceMoves)) {
      saved.paceMoves = 5;
    }
    return true;
  }

  function computeLayout(availW, availH, dpr) {
    const pad = 10;
    const gap = 6;
    const footerGap = 8;
    const maxCellW = (availW - pad * 2 - gap * (COLS - 1)) / COLS;
    const maxCellH = (availH - pad * 2 - footerGap - gap * (ROWS - 1) - 8) / (ROWS + 0.64);
    const cell = Math.max(32, Math.floor(Math.min(maxCellW, maxCellH)));
    const footerHeight = Math.max(28, Math.round(cell * 0.62));
    const gridTop = pad + 4;
    const gridHeight = ROWS * cell + (ROWS - 1) * gap;
    const footerTop = gridTop + gridHeight + footerGap;
    const width = pad * 2 + COLS * cell + (COLS - 1) * gap;
    const height = footerTop + footerHeight + pad;

    return {
      width,
      height,
      dpr,
      pad,
      gap,
      cell,
      gridTop,
      gridHeight,
      footerTop,
      footerHeight
    };
  }

  function cellCenter(metrics, r, c) {
    return {
      x: metrics.pad + c * (metrics.cell + metrics.gap) + metrics.cell / 2,
      y: metrics.gridTop + r * (metrics.cell + metrics.gap) + metrics.cell / 2
    };
  }

  function getCellFromPos(metrics, pos) {
    const step = metrics.cell + metrics.gap;
    const c = Math.floor((pos.x - metrics.pad + metrics.gap / 2) / step);
    const r = Math.floor((pos.y - metrics.gridTop + metrics.gap / 2) / step);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  function getColFromX(metrics, x) {
    const raw = Math.floor((x - metrics.pad + metrics.gap / 2) / (metrics.cell + metrics.gap));
    return Math.max(0, Math.min(COLS - 1, raw));
  }

  function resolveMovePlan(grid, sr, sc, tr, tc, allowColFallback) {
    if (!isExposed(grid, sr, sc)) return null;
    const val = grid[sr][sc];

    // 1. Direct merge onto any other exposed matching block (any column, including same column)
    if (
      tr >= 0 &&
      tr < ROWS &&
      tc >= 0 &&
      tc < COLS &&
      (tr !== sr || tc !== sc) &&
      grid[tr][tc] === val &&
      isExposed(grid, tr, tc)
    ) {
      return { kind: 'direct_merge', sr, sc, tr, tc };
    }

    // 2. Column placement / top-merge onto another non-full column
    if (allowColFallback && tc >= 0 && tc < COLS && tc !== sc) {
      const destTop = getTopRow(grid, tc);
      if (destTop !== -1 && grid[destTop][tc] === val) {
        return { kind: 'top_merge', sr, sc, tr: destTop, tc };
      }
      if (destTop === -1) {
        return { kind: 'place', sr, sc, tr: ROWS - 1, tc };
      }
      if (destTop > 0) {
        return { kind: 'place', sr, sc, tr: destTop - 1, tc };
      }
      return { kind: 'invalid', sr, sc, tr: 0, tc };
    }

    return null;
  }

  function isGameOver(state) {
    if (state.gameOver) return true;
    const grid = state.grid;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === null) return false;
      }
    }
    // All 35 cells filled: only row 0 blocks are exposed
    for (let c = 0; c < COLS; c++) {
      for (let d = c + 1; d < COLS; d++) {
        if (grid[0][c] === grid[0][d]) return false;
      }
    }
    return true;
  }

  // Transient UI state (not persisted)
  let selected = null;     // { r, c }
  let drag = null;         // { sr, sc, val, startX, startY, x, y, pointerType, moved, prevSelected, tapCell }
  let pushBtnRect = null;

  function resetTransient() {
    selected = null;
    drag = null;
  }

  function triggerMergeFX(ctxApp, r, c, newVal, combo) {
    const pos = cellCenter(ctxApp.metrics, r, c);
    const colors = MP.Themes.getTierColors(newVal, 'mania');
    MP.Effects.popCell(r, c);
    MP.Effects.spawnBurst(pos.x, pos.y, colors.rim || '#fde047', 16);
    ctxApp.addScore(newVal * combo, pos.x, pos.y, combo);
    MP.Sound.playMerge(newVal, combo, ctxApp.skin);
  }

  function resolveCascades(ctxApp, combo, afterPlayerMove, didMergeInitial, fromPush = false) {
    const state = ctxApp.state;
    const grid = state.grid;
    let mergedAny = false;

    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 1; r--) {
        const val = grid[r][c];
        if (val !== null && grid[r - 1][c] === val) {
          const newVal = val * 2;
          grid[r][c] = newVal;
          grid[r - 1][c] = null;
          compactColumn(grid, c);
          triggerMergeFX(ctxApp, r, c, newVal, combo);
          mergedAny = true;
          break;
        }
      }
    }

    if (mergedAny) {
      MP.Timers.after(120, () => {
        resolveCascades(ctxApp, combo + 1, afterPlayerMove, didMergeInitial, fromPush);
      });
      return;
    }

    if (afterPlayerMove) {
      state.paceMoves -= didMergeInitial ? 1 : 2;
      if (countTiles(grid) <= 3 || state.paceMoves <= 0) {
        state.paceMoves = 5;
        MP.Timers.after(110, () => pushBottomRow(ctxApp));
        return;
      }
    } else if ((!fromPush && countTiles(grid) <= 2) || countTiles(grid) === 0) {
      state.paceMoves = 5;
      MP.Timers.after(110, () => pushBottomRow(ctxApp));
      return;
    }

    ctxApp.setBusy(false);
    ctxApp.onMoveComplete();
  }

  function pushBottomRow(ctxApp) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;
    const incomingRow = rollRowValues(getMaxTile(state));
    let overflow = false;

    MP.Sound.playPushRow();

    for (let c = 0; c < COLS; c++) {
      const incoming = incomingRow[c];
      if (grid[ROWS - 1][c] === incoming) {
        const newVal = incoming * 2;
        grid[ROWS - 1][c] = newVal;
        MP.Effects.popCell(ROWS - 1, c);
        const pos = cellCenter(metrics, ROWS - 1, c);
        const colors = MP.Themes.getTierColors(newVal, 'mania');
        MP.Effects.spawnBurst(pos.x, pos.y, colors.rim || '#fde047', 14);
        ctxApp.addScore(newVal, pos.x, pos.y, 1);
        MP.Sound.playMerge(newVal, 1, ctxApp.skin);
      } else {
        if (grid[0][c] !== null) {
          overflow = true;
        }
        for (let r = 0; r < ROWS - 1; r++) {
          grid[r][c] = grid[r + 1][c];
        }
        grid[ROWS - 1][c] = incoming;
        MP.Effects.popCell(ROWS - 1, c);
      }
    }

    state.paceMoves = 5;

    if (overflow) {
      state.gameOver = true;
      ctxApp.setBusy(false);
      ctxApp.onMoveComplete();
      return;
    }

    MP.Timers.after(120, () => {
      resolveCascades(ctxApp, 1, false, false, true);
    });
  }

  function commitMovePlan(plan, ctxApp, animate) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;
    const { kind, sr, sc, tr, tc } = plan;
    const val = grid[sr][sc];

    ctxApp.pushUndoSnapshot();
    selected = null;
    ctxApp.setBusy(true);
    grid[sr][sc] = null;

    const applyLanding = () => {
      if (kind === 'direct_merge' || kind === 'top_merge') {
        const newVal = val * 2;
        grid[tr][tc] = newVal;
        compactColumn(grid, tc);
        if (sc !== tc) compactColumn(grid, sc);
        const settledR = sc === tc && sr > tr ? tr + 1 : tr;
        triggerMergeFX(ctxApp, settledR, tc, newVal, 1);
        MP.Timers.after(120, () => {
          resolveCascades(ctxApp, 2, true, true);
        });
      } else {
        grid[tr][tc] = val;
        compactColumn(grid, sc);
        MP.Effects.popCell(tr, tc);
        MP.Sound.playDrop(ctxApp.skin);
        MP.Timers.after(110, () => {
          resolveCascades(ctxApp, 1, true, false);
        });
      }
    };

    if (animate) {
      const fromPt = cellCenter(metrics, sr, sc);
      const toPt = cellCenter(metrics, tr, tc);
      MP.Sound.playSlide();
      MP.Effects.addTween(val, [fromPt, toPt], 11, applyLanding, 1, PALETTE_OPTS);
    } else {
      applyLanding();
    }
  }

  function pointInRect(pos, rect) {
    return (
      rect &&
      pos.x >= rect.x &&
      pos.x <= rect.x + rect.w &&
      pos.y >= rect.y &&
      pos.y <= rect.y + rect.h
    );
  }

  function getHoverPlan(metrics, grid, sr, sc, px, py) {
    const cellPos = getCellFromPos(metrics, { x: px, y: py });
    if (cellPos) {
      if (cellPos.r === sr && cellPos.c === sc) return null;
      return resolveMovePlan(grid, sr, sc, cellPos.r, cellPos.c, true);
    }
    // Support dropping above the top of a target column
    if (px >= metrics.pad && px <= metrics.width - metrics.pad && py >= 0 && py < metrics.gridTop + metrics.gridHeight) {
      const col = getColFromX(metrics, px);
      if (col !== sc) {
        return resolveMovePlan(grid, sr, sc, 0, col, true);
      }
    }
    return null;
  }

  function onPointerDown(pos, e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;

    if (pointInRect(pos, pushBtnRect)) {
      selected = null;
      drag = null;
      ctxApp.pushUndoSnapshot();
      ctxApp.setBusy(true);
      ctxApp.state.paceMoves = 5;
      pushBottomRow(ctxApp);
      return;
    }

    const cellPos = getCellFromPos(ctxApp.metrics, pos);
    const grid = ctxApp.state.grid;
    const prevSelected = selected;
    const canPick = Boolean(cellPos && isExposed(grid, cellPos.r, cellPos.c));

    drag = {
      sr: canPick ? cellPos.r : -1,
      sc: canPick ? cellPos.c : -1,
      val: canPick ? grid[cellPos.r][cellPos.c] : null,
      tapCell: cellPos,
      tapCol: getColFromX(ctxApp.metrics, pos.x),
      prevSelected,
      startX: pos.x,
      startY: pos.y,
      x: pos.x,
      y: pos.y,
      pointerType: e.pointerType || 'mouse',
      moved: false
    };
  }

  function onPointerMove(pos, e, ctxApp) {
    if (!drag) return;
    const dx = pos.x - drag.startX;
    const dy = pos.y - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 8 && drag.sr !== -1) {
      drag.moved = true;
      selected = null;
      MP.Sound.playTick();
    }
    drag.x = pos.x;
    drag.y = pos.y;
  }

  function onPointerUp(pos, e, ctxApp) {
    if (!drag) return;
    const d = drag;
    drag = null;
    const grid = ctxApp.state.grid;

    if (d.moved && d.sr !== -1) {
      const lift = d.pointerType === 'touch' ? 28 : 0;
      const plan = getHoverPlan(ctxApp.metrics, grid, d.sr, d.sc, pos.x, pos.y - lift);
      if (plan) {
        if (plan.kind === 'invalid') {
          MP.Sound.playInvalid();
        } else {
          commitMovePlan(plan, ctxApp, false);
        }
      }
      return;
    }

    // Tap interaction
    const tapCell = getCellFromPos(ctxApp.metrics, pos);
    const tapCol = tapCell ? tapCell.c : getColFromX(ctxApp.metrics, pos.x);
    const tapR = tapCell ? tapCell.r : 0;

    if (d.prevSelected) {
      const ps = d.prevSelected;
      if (tapCell && tapCell.r === ps.r && tapCell.c === ps.c) {
        selected = null;
        MP.Sound.playTick();
        return;
      }
      const plan = resolveMovePlan(grid, ps.r, ps.c, tapR, tapCol, true);
      if (plan && plan.kind !== 'invalid') {
        commitMovePlan(plan, ctxApp, true);
        return;
      }
      if (plan && plan.kind === 'invalid') {
        MP.Sound.playInvalid();
      }
      if (tapCell && isExposed(grid, tapCell.r, tapCell.c)) {
        selected = { r: tapCell.r, c: tapCell.c };
        if (!plan || plan.kind !== 'invalid') MP.Sound.playTick();
      } else {
        selected = null;
      }
      return;
    }

    if (tapCell && isExposed(grid, tapCell.r, tapCell.c)) {
      selected = { r: tapCell.r, c: tapCell.c };
      MP.Sound.playTick();
    } else if (tapCell && grid[tapCell.r][tapCell.c] !== null) {
      MP.Sound.playInvalid();
    }
  }

  function onPointerCancel() {
    drag = null;
  }

  function onKeyDown(e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;
    if (e.key === 'r' || e.key === 'R') {
      selected = null;
      drag = null;
      ctxApp.pushUndoSnapshot();
      ctxApp.setBusy(true);
      ctxApp.state.paceMoves = 5;
      pushBottomRow(ctxApp);
    }
  }

  function applyHammer(r, c, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r][c] === null) return false;
    selected = null;
    drag = null;
    grid[r][c] = null;
    compactColumn(grid, c);
    const pos = cellCenter(ctxApp.metrics, r, c);
    MP.Effects.spawnBurst(pos.x, pos.y, '#f43f5e', 20);
    MP.Sound.playSmash();
    ctxApp.setBusy(true);
    MP.Timers.after(110, () => {
      resolveCascades(ctxApp, 1, false, false);
    });
    return true;
  }

  function applySwap(r1, c1, r2, c2, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r1][c1] === null || grid[r2][c2] === null) return false;
    selected = null;
    drag = null;
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
    compactAllColumns(grid);
    MP.Effects.popCell(r1, c1);
    MP.Effects.popCell(r2, c2);
    MP.Sound.playMerge(32, 1, ctxApp.skin);
    ctxApp.setBusy(true);
    MP.Timers.after(120, () => {
      resolveCascades(ctxApp, 1, false, false);
    });
    return true;
  }

  function drawCurvedArrow(ctx, fromPt, toPt, cell) {
    const dx = toPt.x - fromPt.x;
    const dy = toPt.y - fromPt.y;
    const dist = Math.hypot(dx, dy);
    if (dist < cell * 0.4) return;

    const midX = (fromPt.x + toPt.x) / 2;
    const midY = (fromPt.y + toPt.y) / 2;
    let ctrlX = midX;
    let ctrlY = midY - Math.min(cell * 1.15, Math.max(cell * 0.42, dist * 0.32));
    if (Math.abs(dx) < cell * 0.4) {
      const side = fromPt.x > cell * 2.5 ? -1 : 1;
      ctrlX = midX + side * Math.max(cell * 0.55, dist * 0.28);
      ctrlY = midY;
    }

    const headLen = Math.max(10, cell * 0.24);
    const endAngle = Math.atan2(toPt.y - ctrlY, toPt.x - ctrlX);
    const startAngle = Math.atan2(ctrlY - fromPt.y, ctrlX - fromPt.x);
    const sx = fromPt.x + Math.cos(startAngle) * (cell * 0.22);
    const sy = fromPt.y + Math.sin(startAngle) * (cell * 0.22);
    const ex = toPt.x - Math.cos(endAngle) * (cell * 0.22);
    const ey = toPt.y - Math.sin(endAngle) * (cell * 0.22);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(4, cell * 0.11);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      ctrlX,
      ctrlY,
      ex - Math.cos(endAngle) * headLen * 0.45,
      ey - Math.sin(endAngle) * headLen * 0.45
    );
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      ex - headLen * Math.cos(endAngle - Math.PI / 6),
      ey - headLen * Math.sin(endAngle - Math.PI / 6)
    );
    ctx.lineTo(
      ex - headLen * Math.cos(endAngle + Math.PI / 6),
      ey - headLen * Math.sin(endAngle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTropicalFoliage(ctx, x, y, w, h) {
    const drawLeaf = (cx, cy, rx, ry, rot, color) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    ctx.save();
    ctx.globalAlpha = 0.26;
    // Left tropical cluster
    drawLeaf(x + 12, y + h, 18, 7, -0.55, '#fb7185');
    drawLeaf(x + 28, y + h + 2, 16, 6, -0.25, '#fbbf24');
    drawLeaf(x + 4, y + h - 4, 14, 5, -0.95, '#34d399');
    // Right tropical cluster
    drawLeaf(x + w - 12, y + h, 18, 7, 0.55, '#a855f7');
    drawLeaf(x + w - 28, y + h + 2, 16, 6, 0.25, '#22d3ee');
    drawLeaf(x + w - 4, y + h - 4, 14, 5, 0.95, '#f45197');
    ctx.restore();
  }

  function render(ctx, dt, ctxApp) {
    const state = ctxApp.state;
    const metrics = ctxApp.metrics;
    const skin = ctxApp.skin;
    const { pad, gap, cell, gridTop, gridHeight, footerTop, footerHeight, width } = metrics;
    const grid = state.grid;

    const isDragging = Boolean(drag && drag.moved && drag.sr !== -1);
    const activeSrc = isDragging
      ? { r: drag.sr, c: drag.sc, val: drag.val }
      : selected && grid[selected.r] && grid[selected.r][selected.c] !== null
        ? { r: selected.r, c: selected.c, val: grid[selected.r][selected.c] }
        : null;

    let hoverPlan = null;
    if (isDragging) {
      const lift = drag.pointerType === 'touch' ? 28 : 0;
      hoverPlan = getHoverPlan(metrics, grid, drag.sr, drag.sc, drag.x, drag.y - lift);
    }

    // Cobalt-slate rounded board frame
    const boardX = pad - 4;
    const boardY = gridTop - 4;
    const boardW = width - (pad - 4) * 2;
    const boardH = gridHeight + 8;
    MP.Themes.roundedRectPath(ctx, boardX, boardY, boardW, boardH, 14);
    const boardGrad = ctx.createLinearGradient(0, boardY, 0, boardY + boardH);
    boardGrad.addColorStop(0, 'rgba(28, 56, 104, 0.78)');
    boardGrad.addColorStop(1, 'rgba(16, 33, 66, 0.86)');
    ctx.fillStyle = boardGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.30)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Column guides & deep navy slot wells
    const slotRadius = Math.max(7, cell * 0.17);
    for (let c = 0; c < COLS; c++) {
      const colX = pad + c * (cell + gap);
      const colDanger = state.paceMoves <= 1 && grid[0][c] !== null;

      if (hoverPlan && hoverPlan.tc === c && c !== activeSrc.c) {
        MP.Themes.roundedRectPath(ctx, colX - 2, gridTop - 2, cell + 4, gridHeight + 4, 10);
        ctx.fillStyle = hoverPlan.kind === 'invalid' ? 'rgba(244, 63, 94, 0.16)' : 'rgba(56, 189, 248, 0.14)';
        ctx.fill();
      } else if (colDanger) {
        MP.Themes.roundedRectPath(ctx, colX - 2, gridTop - 2, cell + 4, gridHeight + 4, 10);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.11)';
        ctx.fill();
      }

      for (let r = 0; r < ROWS; r++) {
        const slotY = gridTop + r * (cell + gap);
        ctx.save();
        MP.Themes.roundedRectPath(ctx, colX, slotY, cell, cell, slotRadius);
        ctx.fillStyle = 'rgba(12, 26, 54, 0.68)';
        ctx.fill();
        ctx.strokeStyle = colDanger && r === 0 ? 'rgba(251, 113, 133, 0.7)' : 'rgba(147, 197, 253, 0.16)';
        ctx.lineWidth = colDanger && r === 0 ? 1.8 : 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Pulse phase for exposed matching targets
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.008);

    // Draw grid tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = grid[r][c];
        if (!val) continue;
        if (isDragging && drag.sr === r && drag.sc === c) continue;

        const scale = MP.Effects.getScale(r, c, dt);
        const pos = cellCenter(metrics, r, c);
        const isSwapSel = ctxApp.swapFirst && ctxApp.swapFirst.r === r && ctxApp.swapFirst.c === c;
        const isTapSel = selected && selected.r === r && selected.c === c;
        const isColDanger = state.paceMoves <= 1 && r === 0;
        const isMatchTarget = Boolean(
          activeSrc &&
            (activeSrc.r !== r || activeSrc.c !== c) &&
            val === activeSrc.val &&
            isExposed(grid, r, c)
        );

        MP.Themes.drawTile(ctx, pos.x, pos.y, cell, val, skin, {
          palette: 'mania',
          scale,
          highlighted: isSwapSel || isTapSel,
          mergeRing: isMatchTarget,
          danger: isColDanger
        });

        if (isMatchTarget) {
          ctx.save();
          ctx.strokeStyle = `rgba(253, 224, 71, ${0.35 + pulse * 0.45})`;
          ctx.lineWidth = 2;
          MP.Themes.roundedRectPath(
            ctx,
            pos.x - cell / 2 - 3,
            pos.y - cell / 2 - 3,
            cell + 6,
            cell + 6,
            Math.max(8, cell * 0.2)
          );
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Ghost landing preview & curved white Bezier arrow when hovering a valid target
    if (isDragging && hoverPlan && hoverPlan.kind !== 'invalid') {
      const fromPt = cellCenter(metrics, drag.sr, drag.sc);
      const toPt = cellCenter(metrics, hoverPlan.tr, hoverPlan.tc);

      if (hoverPlan.kind === 'place') {
        MP.Themes.drawTile(ctx, toPt.x, toPt.y, cell, drag.val, skin, {
          palette: 'mania',
          alpha: 0.36,
          ghost: true
        });
      }

      drawCurvedArrow(ctx, fromPt, toPt, cell);
    }

    // Floating dragged tile with bright white highlight & glow
    if (isDragging && drag.val !== null) {
      const lift = drag.pointerType === 'touch' ? 28 : 0;
      MP.Themes.drawTile(ctx, drag.x, drag.y - lift, cell * 1.06, drag.val, skin, {
        palette: 'mania',
        highlighted: true,
        glow: true
      });
    }

    // Compact Row Rise Pace Bar + tropical foliage accents
    const trayW = width - pad * 2;
    ctx.save();
    MP.Themes.roundedRectPath(ctx, pad, footerTop, trayW, footerHeight, 11);
    ctx.fillStyle = 'rgba(13, 28, 56, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    drawTropicalFoliage(ctx, pad, footerTop, trayW, footerHeight);
    ctx.restore();

    const barY = footerTop + footerHeight / 2;
    const pipStartX = pad + 11;

    ctx.save();
    ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.86)';
    ctx.fillText('NEXT ROW', pipStartX, barY);

    for (let i = 0; i < 5; i++) {
      const px = pipStartX + 64 + i * 11.5;
      ctx.beginPath();
      ctx.arc(px, barY, 3.6, 0, Math.PI * 2);
      ctx.fillStyle =
        i < state.paceMoves
          ? state.paceMoves <= 1
            ? '#fb7185'
            : '#facc15'
          : 'rgba(255, 255, 255, 0.18)';
      ctx.fill();
    }

    const btnW = 64;
    const btnH = Math.min(22, footerHeight - 6);
    const btnX = width - pad - btnW - 5;
    const btnY = barY - btnH / 2;
    pushBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    MP.Themes.roundedRectPath(ctx, btnX, btnY, btnW, btnH, 9);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.20)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#cffafe';
    ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ +ROW', btnX + btnW / 2, barY + 0.5);
    ctx.restore();

    MP.Effects.updateAndDraw(ctx, dt, cell, skin, PALETTE_OPTS);
  }

  MP.Modes.mania_classic = {
    id: 'mania_classic',
    name: 'Mania Classic',
    icon: '🌺',
    tagline: 'Drag any exposed block onto matching numbers for deep stack cascades!',
    cols: COLS,
    rows: ROWS,
    createInitialState,
    validateSavedState,
    computeLayout,
    getMaxTile,
    isGameOver,
    resetTransient,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    applyHammer,
    applySwap,
    render
  };
})(window);
