(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});
  MP.Modes = MP.Modes || {};

  const COLS = 5;
  const ROWS = 7;

  function makeEmptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
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

  function rollSpawnValue(maxTile) {
    const pool = [2, 4, 8, 16];
    if (maxTile >= 64) pool.push(32);
    if (maxTile >= 256) pool.push(64);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function createInitialState() {
    return {
      grid: makeEmptyGrid(),
      currentVal: 2,
      nextVal: 4,
      aimCol: 2,
      gameOver: false
    };
  }

  function validateSavedState(saved) {
    if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      if (!Array.isArray(saved.grid[r]) || saved.grid[r].length !== COLS) return false;
    }
    if (!saved.currentVal) saved.currentVal = 2;
    if (!saved.nextVal) saved.nextVal = 4;
    if (typeof saved.aimCol !== 'number') saved.aimCol = 2;
    return true;
  }

  function computeLayout(availW, availH, dpr) {
    const pad = 10;
    const gap = 6;
    const stagingGap = 10;
    const maxCellW = (availW - pad * 2 - gap * (COLS - 1)) / COLS;
    const maxCellH = (availH - pad * 2 - stagingGap - gap * (ROWS - 1)) / (ROWS + 1.24);
    const cell = Math.max(36, Math.floor(Math.min(maxCellW, maxCellH)));
    const stagingHeight = Math.round(cell * 1.2);
    const stagingTop = pad;
    const gridTop = stagingTop + stagingHeight + stagingGap;
    const gridHeight = ROWS * cell + (ROWS - 1) * gap;
    const width = pad * 2 + COLS * cell + (COLS - 1) * gap;
    const height = gridTop + gridHeight + pad;

    return {
      width,
      height,
      dpr,
      pad,
      gap,
      cell,
      stagingTop,
      stagingHeight,
      gridTop,
      gridHeight
    };
  }

  function cellCenter(metrics, r, c) {
    return {
      x: metrics.pad + c * (metrics.cell + metrics.gap) + metrics.cell / 2,
      y: metrics.gridTop + r * (metrics.cell + metrics.gap) + metrics.cell / 2
    };
  }

  // Floor is row ROWS - 1; drop downward from top staging bar
  function getLandingRow(grid, col, val) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][col] === null) return r;
    }
    if (grid[0][col] === val) return 0;
    return -1;
  }

  function canDropAny(grid, val) {
    for (let c = 0; c < COLS; c++) {
      if (getLandingRow(grid, c, val) !== -1) return true;
    }
    return false;
  }

  function isGameOver(state) {
    return Boolean(state.gameOver) || (!canDropAny(state.grid, state.currentVal) && !canDropAny(state.grid, state.nextVal));
  }

  let isPointerDown = false;
  let nextBoxRect = null;

  function resetTransient() {
    isPointerDown = false;
  }

  function applyDownwardGravity(grid) {
    let moved = false;
    const movedTargets = [];
    for (let c = 0; c < COLS; c++) {
      let writeR = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const val = grid[r][c];
        if (val !== null) {
          if (r !== writeR) {
            grid[writeR][c] = val;
            grid[r][c] = null;
            MP.Effects.popCell(writeR, c);
            movedTargets.push([writeR, c]);
            moved = true;
          }
          writeR--;
        }
      }
    }
    return { moved, movedTargets };
  }

  function findFirstMatch(grid, focusList) {
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
    const checkCell = (r, c) => {
      const val = grid[r][c];
      if (!val) return null;
      const matches = [];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === val) {
          matches.push([nr, nc]);
        }
      }
      return matches.length > 0 ? { r, c, val, matches } : null;
    };

    if (focusList && focusList.length) {
      for (const [fr, fc] of focusList) {
        if (fr >= 0 && fr < ROWS && fc >= 0 && fc < COLS) {
          const hit = checkCell(fr, fc);
          if (hit) return hit;
        }
      }
    }

    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        const hit = checkCell(r, c);
        if (hit) return hit;
      }
    }
    return null;
  }

  function resolveChains(ctxApp, combo, focusList) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;
    const hit = findFirstMatch(grid, focusList);

    if (!hit) {
      ctxApp.setBusy(false);
      ctxApp.onMoveComplete();
      return;
    }

    const { r, c, val, matches } = hit;
    for (const [mr, mc] of matches) {
      const mPos = cellCenter(metrics, mr, mc);
      MP.Effects.spawnBurst(mPos.x, mPos.y, MP.Themes.getTierColors(val, ctxApp.skin).rim, 8);
      grid[mr][mc] = null;
    }

    const newVal = val * Math.pow(2, matches.length);
    grid[r][c] = newVal;
    MP.Effects.popCell(r, c);

    const pos = cellCenter(metrics, r, c);
    MP.Effects.spawnBurst(pos.x, pos.y, MP.Themes.getTierColors(newVal, ctxApp.skin).rim, 16);
    ctxApp.addScore(newVal * combo, pos.x, pos.y, combo);
    MP.Sound.playMerge(newVal, combo, ctxApp.skin);

    MP.Timers.after(115, () => {
      const grav = applyDownwardGravity(grid);
      const nextFocus = [[r, c]].concat(grav.movedTargets);
      if (grav.moved) {
        MP.Timers.after(110, () => resolveChains(ctxApp, combo + 1, nextFocus));
      } else {
        resolveChains(ctxApp, combo + 1, nextFocus);
      }
    });
  }

  function triggerDrop(col, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;
    const state = ctxApp.state;
    const targetRow = getLandingRow(state.grid, col, state.currentVal);
    if (targetRow === -1) {
      MP.Sound.playInvalid();
      return;
    }

    ctxApp.pushUndoSnapshot();
    state.aimCol = col;
    ctxApp.setBusy(true);

    const droppedVal = state.currentVal;
    state.currentVal = state.nextVal;
    state.nextVal = rollSpawnValue(getMaxTile(state));

    const metrics = ctxApp.metrics;
    const startPt = {
      x: cellCenter(metrics, 0, col).x,
      y: metrics.stagingTop + metrics.stagingHeight / 2
    };
    const endPt = cellCenter(metrics, targetRow, col);

    MP.Effects.addTween(droppedVal, [startPt, endPt], 10.5, () => {
      MP.Sound.playDrop(ctxApp.skin);
      if (state.grid[targetRow][col] === droppedVal) {
        const newVal = droppedVal * 2;
        state.grid[targetRow][col] = newVal;
        MP.Effects.popCell(targetRow, col);
        const pos = cellCenter(metrics, targetRow, col);
        MP.Effects.spawnBurst(pos.x, pos.y, MP.Themes.getTierColors(newVal, ctxApp.skin).rim, 16);
        ctxApp.addScore(newVal, pos.x, pos.y, 1);
        MP.Sound.playMerge(newVal, 1, ctxApp.skin);
        MP.Timers.after(115, () => resolveChains(ctxApp, 2, [[targetRow, col]]));
      } else {
        state.grid[targetRow][col] = droppedVal;
        MP.Effects.popCell(targetRow, col);
        resolveChains(ctxApp, 1, [[targetRow, col]]);
      }
    });
  }

  function swapCurrentAndNext(ctxApp) {
    const state = ctxApp.state;
    const tmp = state.currentVal;
    state.currentVal = state.nextVal;
    state.nextVal = tmp;
    MP.Sound.playSlide();
    ctxApp.saveAndRefreshHUD();
  }

  function getColFromX(metrics, x) {
    const raw = Math.floor((x - metrics.pad + metrics.gap / 2) / (metrics.cell + metrics.gap));
    return Math.max(0, Math.min(COLS - 1, raw));
  }

  function isInNextBox(pos) {
    if (!nextBoxRect) return false;
    return (
      pos.x >= nextBoxRect.x &&
      pos.x <= nextBoxRect.x + nextBoxRect.w &&
      pos.y >= nextBoxRect.y &&
      pos.y <= nextBoxRect.y + nextBoxRect.h
    );
  }

  function onPointerDown(pos, e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;
    if (isInNextBox(pos)) {
      isPointerDown = false;
      swapCurrentAndNext(ctxApp);
      return;
    }
    isPointerDown = true;
    const col = getColFromX(ctxApp.metrics, pos.x);
    if (ctxApp.state.aimCol !== col) {
      ctxApp.state.aimCol = col;
      MP.Sound.playTick();
    }
  }

  function onPointerMove(pos, e, ctxApp) {
    if (!isPointerDown || ctxApp.busy) return;
    const col = getColFromX(ctxApp.metrics, pos.x);
    if (col !== ctxApp.state.aimCol) {
      ctxApp.state.aimCol = col;
      MP.Sound.playTick();
    }
  }

  function onPointerUp(pos, e, ctxApp) {
    if (!isPointerDown) return;
    isPointerDown = false;
    if (!ctxApp.busy && !ctxApp.state.gameOver) {
      triggerDrop(ctxApp.state.aimCol, ctxApp);
    }
  }

  function onPointerCancel() {
    isPointerDown = false;
  }

  function onKeyDown(e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;
    if (e.key === 'ArrowLeft') {
      ctxApp.state.aimCol = Math.max(0, ctxApp.state.aimCol - 1);
      MP.Sound.playTick();
    } else if (e.key === 'ArrowRight') {
      ctxApp.state.aimCol = Math.min(COLS - 1, ctxApp.state.aimCol + 1);
      MP.Sound.playTick();
    } else if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      triggerDrop(ctxApp.state.aimCol, ctxApp);
    } else if (e.key === 's' || e.key === 'S' || e.key === 'Tab') {
      e.preventDefault();
      swapCurrentAndNext(ctxApp);
    }
  }

  function applyHammer(r, c, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r][c] === null) return false;
    grid[r][c] = null;
    const pos = cellCenter(ctxApp.metrics, r, c);
    MP.Effects.spawnBurst(pos.x, pos.y, '#f43f5e', 20);
    MP.Sound.playSmash();
    ctxApp.setBusy(true);
    MP.Timers.after(100, () => {
      const grav = applyDownwardGravity(grid);
      MP.Timers.after(110, () => resolveChains(ctxApp, 1, grav.movedTargets));
    });
    return true;
  }

  function applySwap(r1, c1, r2, c2, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r1][c1] === null || grid[r2][c2] === null) return false;
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
    MP.Effects.popCell(r1, c1);
    MP.Effects.popCell(r2, c2);
    MP.Sound.playMerge(32, 1, ctxApp.skin);
    ctxApp.setBusy(true);
    MP.Timers.after(120, () => resolveChains(ctxApp, 1, [[r1, c1], [r2, c2]]));
    return true;
  }

  function render(ctx, dt, ctxApp) {
    const state = ctxApp.state;
    const metrics = ctxApp.metrics;
    const skin = ctxApp.skin;
    const { pad, gap, cell, stagingTop, stagingHeight, gridTop, gridHeight, width } = metrics;
    const grid = state.grid;
    const landingRow = !ctxApp.busy && ctxApp.boosterMode === 'NONE'
      ? getLandingRow(grid, state.aimCol, state.currentVal)
      : -1;

    // Column guides & empty slots
    for (let c = 0; c < COLS; c++) {
      const colX = pad + c * (cell + gap);
      if (c === state.aimCol && !state.gameOver) {
        MP.Themes.roundedRectPath(ctx, colX - 2, gridTop - 2, cell + 4, gridHeight + 4, 10);
        ctx.fillStyle = landingRow === -1 && !ctxApp.busy
          ? 'rgba(244, 63, 94, 0.11)'
          : 'rgba(56, 189, 248, 0.09)';
        ctx.fill();
      }
      for (let r = 0; r < ROWS; r++) {
        const slotY = gridTop + r * (cell + gap);
        MP.Themes.drawSlot(ctx, colX, slotY, cell, skin);
      }
    }

    // Top overflow danger dashed line
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.38)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad + 4, gridTop - 4);
    ctx.lineTo(width - pad - 4, gridTop - 4);
    ctx.stroke();
    ctx.restore();

    // Ghost landing preview + downward aim arrow line
    if (!ctxApp.busy && ctxApp.boosterMode === 'NONE' && !state.gameOver && landingRow !== -1) {
      const ghostPos = cellCenter(metrics, landingRow, state.aimCol);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ghostPos.x, stagingTop + stagingHeight);
      ctx.lineTo(ghostPos.x, ghostPos.y - cell * 0.45);
      ctx.stroke();
      ctx.restore();

      MP.Themes.drawTile(ctx, ghostPos.x, ghostPos.y, cell, state.currentVal, skin, {
        alpha: 0.30,
        ghost: true
      });
    }

    // Static grid tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = grid[r][c];
        if (!val) continue;
        const scale = MP.Effects.getScale(r, c, dt);
        const pos = cellCenter(metrics, r, c);
        const isSwapSel = ctxApp.swapFirst && ctxApp.swapFirst.r === r && ctxApp.swapFirst.c === c;
        MP.Themes.drawTile(ctx, pos.x, pos.y, cell, val, skin, {
          scale,
          highlighted: isSwapSel
        });
      }
    }

    // Top Staging Bar
    const trayW = width - pad * 2;
    MP.Themes.roundedRectPath(ctx, pad, stagingTop, trayW, stagingHeight, 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Active aiming tile aligned over aimCol
    if (!ctxApp.busy && !state.gameOver) {
      const aimX = pad + state.aimCol * (cell + gap) + cell / 2;
      const aimY = stagingTop + stagingHeight / 2;
      MP.Themes.drawTile(ctx, aimX, aimY, cell * 0.9, state.currentVal, skin, {
        highlighted: true
      });
    }

    // Clickable NEXT swap badge on right edge (or left if aimCol === COLS - 1)
    const nextSideCol = state.aimCol === COLS - 1 ? 0 : COLS - 1;
    const boxW = Math.round(cell * 0.98);
    const boxH = Math.round(stagingHeight * 0.86);
    const boxX = pad + nextSideCol * (cell + gap) + Math.round((cell - boxW) / 2);
    const boxY = stagingTop + (stagingHeight - boxH) / 2;
    nextBoxRect = { x: boxX, y: boxY, w: boxW, h: boxH };

    const needSwapHint = !canDropAny(grid, state.currentVal) && canDropAny(grid, state.nextVal);
    MP.Themes.roundedRectPath(ctx, boxX, boxY, boxW, boxH, 10);
    ctx.fillStyle = needSwapHint ? 'rgba(250, 204, 21, 0.22)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.strokeStyle = needSwapHint ? '#fde047' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = needSwapHint ? 2 : 1;
    ctx.stroke();

    const miniTile = Math.round(cell * 0.52);
    MP.Themes.drawTile(ctx, boxX + boxW / 2, boxY + boxH * 0.43, miniTile, state.nextVal, skin, {});

    ctx.save();
    ctx.fillStyle = needSwapHint ? '#fde047' : 'rgba(255, 255, 255, 0.72)';
    ctx.font = '800 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⇄ NEXT', boxX + boxW / 2, boxY + boxH - 8);
    ctx.restore();

    MP.Effects.updateAndDraw(ctx, dt, cell, skin);
  }

  MP.Modes.merge_mania = {
    id: 'merge_mania',
    name: 'Merge Mania',
    icon: '⬇️',
    tagline: 'Aim at the top & drop number blocks downward for gravity chain combos.',
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
