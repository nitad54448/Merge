(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});
  MP.Modes = MP.Modes || {};

  const COLS = 5;
  const ROWS = 7;

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

  function rollLowValue(maxTile) {
    const pool = [2, 4, 8];
    if (maxTile >= 64) pool.push(16);
    if (maxTile >= 256) pool.push(32);
    if (maxTile >= 1024) pool.push(64);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function rollPreviewRow(maxTile) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      let val = rollLowValue(maxTile);
      if (c >= 2 && row[c - 1] === val && row[c - 2] === val) {
        val = val === 2 ? 4 : 2;
      }
      row.push(val);
    }
    return row;
  }

  function createInitialState() {
    const grid = makeEmptyGrid();
    const starters = [2, 4, 8];
    // Populate bottom 2 rows cleanly without pre-existing vertical pairs
    for (let c = 0; c < COLS; c++) {
      const bot = starters[Math.floor(Math.random() * starters.length)];
      let top = starters[Math.floor(Math.random() * starters.length)];
      while (top === bot) {
        top = starters[Math.floor(Math.random() * starters.length)];
      }
      grid[ROWS - 1][c] = bot;
      grid[ROWS - 2][c] = top;
    }
    // Guarantee at least one easy first merge on top row (row 5)
    if (grid[ROWS - 2][0] === grid[ROWS - 2][1]) {
      // already has a pair
    } else {
      const candidate = grid[ROWS - 2][0];
      if (grid[ROWS - 1][2] !== candidate) {
        grid[ROWS - 2][2] = candidate;
      } else {
        grid[ROWS - 2][3] = grid[ROWS - 1][3] === 2 ? 4 : 2;
        grid[ROWS - 2][0] = grid[ROWS - 2][3] === grid[ROWS - 1][0] ? (grid[ROWS - 2][3] === 2 ? 4 : 2) : grid[ROWS - 2][3];
      }
    }

    return {
      grid,
      previewRow: rollPreviewRow(8),
      graceMoves: 2,
      gameOver: false
    };
  }

  function validateSavedState(saved) {
    if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      if (!Array.isArray(saved.grid[r]) || saved.grid[r].length !== COLS) return false;
    }
    if (!Array.isArray(saved.previewRow) || saved.previewRow.length !== COLS) {
      saved.previewRow = rollPreviewRow(8);
    }
    if (typeof saved.graceMoves !== 'number') saved.graceMoves = 2;
    return true;
  }

  function computeLayout(availW, availH, dpr) {
    const pad = 10;
    const gap = 6;
    const trayGap = 10;
    const maxCellW = (availW - pad * 2 - gap * (COLS - 1)) / COLS;
    const maxCellH = (availH - pad * 2 - trayGap - gap * (ROWS - 1)) / (ROWS + 1.38);
    const cell = Math.max(36, Math.floor(Math.min(maxCellW, maxCellH)));
    const trayHeight = Math.round(cell * 1.34);
    const gridTop = pad + 4;
    const gridHeight = ROWS * cell + (ROWS - 1) * gap;
    const trayTop = gridTop + gridHeight + trayGap;
    const width = pad * 2 + COLS * cell + (COLS - 1) * gap;
    const height = trayTop + trayHeight + pad;

    return {
      width,
      height,
      dpr,
      pad,
      gap,
      cell,
      gridTop,
      gridHeight,
      trayTop,
      trayHeight
    };
  }

  function cellCenter(metrics, r, c) {
    return {
      x: metrics.pad + c * (metrics.cell + metrics.gap) + metrics.cell / 2,
      y: metrics.gridTop + r * (metrics.cell + metrics.gap) + metrics.cell / 2
    };
  }

  function canDropOnCol(grid, sourceCol, targetCol) {
    if (sourceCol === targetCol || sourceCol < 0 || targetCol < 0 || targetCol >= COLS) return false;
    const srcTop = getTopRow(grid, sourceCol);
    if (srcTop === -1) return false;
    const val = grid[srcTop][sourceCol];
    const destTop = getTopRow(grid, targetCol);
    if (destTop === -1) return true;
    if (grid[destTop][targetCol] === val) return true;
    return destTop > 0;
  }

  function isGameOver(state) {
    if (state.gameOver) return true;
    const grid = state.grid;
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c] === null) return false;
    }
    // All 5 columns reach row 0: check if any top block can merge onto another top block
    for (let c = 0; c < COLS; c++) {
      for (let d = c + 1; d < COLS; d++) {
        if (grid[0][c] === grid[0][d]) return false;
      }
    }
    return true;
  }

  // Transient UI state (not persisted)
  let selectedCol = -1;
  let drag = null;
  let pushBtnRect = null;

  function resetTransient() {
    selectedCol = -1;
    drag = null;
  }

  function compactColumn(grid, col) {
    let writeR = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][col] !== null) {
        if (r !== writeR) {
          grid[writeR][col] = grid[r][col];
          grid[r][col] = null;
        }
        writeR--;
      }
    }
  }

  function resolveColumns(ctxApp, combo, afterPlayerMove, didMergeInitial, fromPush = false) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;
    const rimFallback = '#fbbf24';
    let mergedAny = false;

    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 1; r--) {
        const val = grid[r][c];
        if (val !== null && grid[r - 1][c] === val) {
          const newVal = val * 2;
          grid[r][c] = newVal;
          grid[r - 1][c] = null;
          compactColumn(grid, c);
          MP.Effects.popCell(r, c);

          const pos = cellCenter(metrics, r, c);
          const colors = MP.Themes.getTierColors(newVal, ctxApp.skin);
          MP.Effects.spawnBurst(pos.x, pos.y, colors.rim || rimFallback, 16);
          ctxApp.addScore(newVal * combo, pos.x, pos.y, combo);
          MP.Sound.playMerge(newVal, combo, ctxApp.skin);
          mergedAny = true;
          break;
        }
      }
    }

    if (mergedAny) {
      MP.Timers.after(125, () => {
        resolveColumns(ctxApp, combo + 1, afterPlayerMove, didMergeInitial, fromPush);
      });
      return;
    }

    if (afterPlayerMove) {
      const tilesLeft = countTiles(grid);
      if (didMergeInitial) {
        if (tilesLeft <= 2) {
          MP.Timers.after(110, () => pushPreviewRow(ctxApp));
          return;
        }
      } else {
        state.graceMoves -= 1;
        if (state.graceMoves <= 0) {
          state.graceMoves = 2;
          MP.Timers.after(110, () => pushPreviewRow(ctxApp));
          return;
        }
      }
    } else if (!fromPush && countTiles(grid) <= 1) {
      state.graceMoves = 2;
      MP.Timers.after(110, () => pushPreviewRow(ctxApp));
      return;
    }

    ctxApp.setBusy(false);
    ctxApp.onMoveComplete();
  }

  function pushPreviewRow(ctxApp) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;
    let overflow = false;

    MP.Sound.playPushRow();

    for (let c = 0; c < COLS; c++) {
      const incoming = state.previewRow[c];
      if (grid[ROWS - 1][c] === incoming) {
        // Bottom cell matches incoming row: merge directly in place without rising!
        const newVal = incoming * 2;
        grid[ROWS - 1][c] = newVal;
        MP.Effects.popCell(ROWS - 1, c);
        const pos = cellCenter(metrics, ROWS - 1, c);
        const colors = MP.Themes.getTierColors(newVal, ctxApp.skin);
        MP.Effects.spawnBurst(pos.x, pos.y, colors.rim, 14);
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

    state.previewRow = rollPreviewRow(getMaxTile(state));

    if (overflow) {
      state.gameOver = true;
      ctxApp.setBusy(false);
      ctxApp.onMoveComplete();
      return;
    }

    MP.Timers.after(120, () => {
      resolveColumns(ctxApp, 1, false, false, true);
    });
  }

  function executeMove(sourceCol, targetCol, ctxApp) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;

    if (!canDropOnCol(grid, sourceCol, targetCol)) {
      MP.Sound.playInvalid();
      return false;
    }

    ctxApp.pushUndoSnapshot();
    selectedCol = -1;

    const srcTop = getTopRow(grid, sourceCol);
    const val = grid[srcTop][sourceCol];
    const destTop = getTopRow(grid, targetCol);
    grid[srcTop][sourceCol] = null;

    let didMerge = false;
    let destRow = ROWS - 1;

    if (destTop === -1) {
      destRow = ROWS - 1;
      grid[destRow][targetCol] = val;
      MP.Sound.playDrop(ctxApp.skin);
    } else if (grid[destTop][targetCol] === val) {
      destRow = destTop;
      const newVal = val * 2;
      grid[destRow][targetCol] = newVal;
      didMerge = true;
      MP.Effects.popCell(destRow, targetCol);
      const pos = cellCenter(metrics, destRow, targetCol);
      const colors = MP.Themes.getTierColors(newVal, ctxApp.skin);
      MP.Effects.spawnBurst(pos.x, pos.y, colors.rim, 16);
      ctxApp.addScore(newVal, pos.x, pos.y, 1);
      MP.Sound.playMerge(newVal, 1, ctxApp.skin);
    } else {
      destRow = destTop - 1;
      grid[destRow][targetCol] = val;
      MP.Sound.playDrop(ctxApp.skin);
    }

    MP.Effects.popCell(destRow, targetCol);
    ctxApp.setBusy(true);

    if (didMerge) {
      MP.Timers.after(125, () => {
        resolveColumns(ctxApp, 2, true, true);
      });
    } else {
      resolveColumns(ctxApp, 1, true, false);
    }
    return true;
  }

  function getColFromX(metrics, x) {
    const raw = Math.floor((x - metrics.pad + metrics.gap / 2) / (metrics.cell + metrics.gap));
    return Math.max(0, Math.min(COLS - 1, raw));
  }

  function isInPushButton(pos) {
    if (!pushBtnRect) return false;
    return (
      pos.x >= pushBtnRect.x &&
      pos.x <= pushBtnRect.x + pushBtnRect.w &&
      pos.y >= pushBtnRect.y &&
      pos.y <= pushBtnRect.y + pushBtnRect.h
    );
  }

  function onPointerDown(pos, e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;

    if (isInPushButton(pos)) {
      selectedCol = -1;
      drag = null;
      ctxApp.pushUndoSnapshot();
      ctxApp.setBusy(true);
      ctxApp.state.graceMoves = 2;
      pushPreviewRow(ctxApp);
      return;
    }

    const col = getColFromX(ctxApp.metrics, pos.x);
    const topR = getTopRow(ctxApp.state.grid, col);
    const prevSelected = selectedCol;

    drag = {
      sourceCol: topR !== -1 ? col : -1,
      sourceRow: topR,
      val: topR !== -1 ? ctxApp.state.grid[topR][col] : null,
      tapCol: col,
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
    if (!drag.moved && Math.hypot(dx, dy) > 8 && drag.sourceCol !== -1) {
      drag.moved = true;
      selectedCol = -1;
      MP.Sound.playTick();
    }
    drag.x = pos.x;
    drag.y = pos.y;
  }

  function onPointerUp(pos, e, ctxApp) {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (d.moved && d.sourceCol !== -1) {
      const targetCol = getColFromX(ctxApp.metrics, pos.x);
      if (targetCol !== d.sourceCol) {
        executeMove(d.sourceCol, targetCol, ctxApp);
      }
      return;
    }

    // Tap interaction
    const tapCol = getColFromX(ctxApp.metrics, pos.x);
    if (d.prevSelected !== -1) {
      if (tapCol === d.prevSelected) {
        selectedCol = -1;
        MP.Sound.playTick();
      } else if (!executeMove(d.prevSelected, tapCol, ctxApp)) {
        if (getTopRow(ctxApp.state.grid, tapCol) !== -1) {
          selectedCol = tapCol;
          MP.Sound.playTick();
        } else {
          selectedCol = -1;
        }
      }
    } else if (getTopRow(ctxApp.state.grid, tapCol) !== -1) {
      selectedCol = tapCol;
      MP.Sound.playTick();
    }
  }

  function onPointerCancel() {
    drag = null;
  }

  function onKeyDown(e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;
    if (e.key === 'r' || e.key === 'R') {
      selectedCol = -1;
      ctxApp.pushUndoSnapshot();
      ctxApp.setBusy(true);
      ctxApp.state.graceMoves = 2;
      pushPreviewRow(ctxApp);
    }
  }

  function applyHammer(r, c, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r][c] === null) return false;
    grid[r][c] = null;
    compactColumn(grid, c);
    const pos = cellCenter(ctxApp.metrics, r, c);
    MP.Effects.spawnBurst(pos.x, pos.y, '#f43f5e', 20);
    MP.Sound.playSmash();
    ctxApp.setBusy(true);
    MP.Timers.after(110, () => {
      resolveColumns(ctxApp, 1, false, false);
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
    MP.Timers.after(120, () => {
      resolveColumns(ctxApp, 1, false, false);
    });
    return true;
  }

  function render(ctx, dt, ctxApp) {
    const state = ctxApp.state;
    const metrics = ctxApp.metrics;
    const skin = ctxApp.skin;
    const { pad, gap, cell, gridTop, gridHeight, trayTop, trayHeight, width } = metrics;
    const grid = state.grid;

    const activeDragCol = drag && drag.moved ? drag.sourceCol : -1;
    const activeSourceCol = activeDragCol !== -1 ? activeDragCol : selectedCol;
    const hoverCol = activeDragCol !== -1 ? getColFromX(metrics, drag.x) : -1;

    // Column guides & empty slots
    for (let c = 0; c < COLS; c++) {
      const colX = pad + c * (cell + gap);
      const colFullDanger =
        state.graceMoves === 1 &&
        grid[0][c] !== null &&
        grid[ROWS - 1][c] !== state.previewRow[c];

      // Column highlight when dragging or selected
      if (c === hoverCol && hoverCol !== activeDragCol) {
        const valid = canDropOnCol(grid, activeDragCol, hoverCol);
        MP.Themes.roundedRectPath(ctx, colX - 2, gridTop - 2, cell + 4, gridHeight + 4, 10);
        ctx.fillStyle = valid ? 'rgba(56, 189, 248, 0.14)' : 'rgba(244, 63, 94, 0.14)';
        ctx.fill();
      } else if (colFullDanger) {
        MP.Themes.roundedRectPath(ctx, colX - 2, gridTop - 2, cell + 4, gridHeight + 4, 10);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.10)';
        ctx.fill();
      }

      for (let r = 0; r < ROWS; r++) {
        const slotY = gridTop + r * (cell + gap);
        MP.Themes.drawSlot(ctx, colX, slotY, cell, skin, colFullDanger && r === 0 ? 'rgba(244,63,94,0.6)' : null);
      }
    }

    // Destination ghost preview when dragging or tapping a column
    if (activeSourceCol !== -1 && hoverCol !== -1 && hoverCol !== activeSourceCol && canDropOnCol(grid, activeSourceCol, hoverCol)) {
      const srcTop = getTopRow(grid, activeSourceCol);
      const srcVal = srcTop !== -1 ? grid[srcTop][activeSourceCol] : null;
      if (srcVal !== null) {
        const destTop = getTopRow(grid, hoverCol);
        const destRow = destTop === -1 ? ROWS - 1 : grid[destTop][hoverCol] === srcVal ? destTop : destTop - 1;
        const gPos = cellCenter(metrics, destRow, hoverCol);
        MP.Themes.drawTile(ctx, gPos.x, gPos.y, cell, srcVal, skin, { alpha: 0.35, ghost: true });
      }
    } else if (selectedCol !== -1 && !ctxApp.busy && ctxApp.boosterMode === 'NONE') {
      // Subtle highlight on valid target columns when a block is tap-selected
      for (let c = 0; c < COLS; c++) {
        if (c === selectedCol || !canDropOnCol(grid, selectedCol, c)) continue;
        const destTop = getTopRow(grid, c);
        const srcTop = getTopRow(grid, selectedCol);
        const isMerge = destTop !== -1 && srcTop !== -1 && grid[destTop][c] === grid[srcTop][selectedCol];
        if (isMerge) {
          const mPos = cellCenter(metrics, destTop, c);
          ctx.save();
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
          ctx.lineWidth = 2.5;
          MP.Themes.roundedRectPath(ctx, mPos.x - cell / 2 - 2, mPos.y - cell / 2 - 2, cell + 4, cell + 4, Math.max(8, cell * 0.2));
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw grid blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = grid[r][c];
        if (!val) continue;
        if (drag && drag.moved && drag.sourceRow === r && drag.sourceCol === c) continue;

        const scale = MP.Effects.getScale(r, c, dt);
        const pos = cellCenter(metrics, r, c);
        const isSwapSel = ctxApp.swapFirst && ctxApp.swapFirst.r === r && ctxApp.swapFirst.c === c;
        const isTapSel = selectedCol === c && getTopRow(grid, c) === r;
        const isColDanger = state.graceMoves === 1 && r === 0 && grid[ROWS - 1][c] !== state.previewRow[c];

        MP.Themes.drawTile(ctx, pos.x, pos.y, cell, val, skin, {
          scale,
          highlighted: isSwapSel || isTapSel,
          danger: isColDanger
        });
      }
    }

    // Bottom Incoming Preview Row Tray + Grace Pips + Push Button
    const trayW = width - pad * 2;
    MP.Themes.roundedRectPath(ctx, pad, trayTop, trayW, trayHeight, 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const miniSize = Math.round(cell * 0.62);
    const previewY = trayTop + 6 + miniSize / 2;
    for (let c = 0; c < COLS; c++) {
      const cx = pad + c * (cell + gap) + cell / 2;
      MP.Themes.drawTile(ctx, cx, previewY, miniSize, state.previewRow[c], skin, { alpha: 0.92 });
    }

    // Grace pips + manual ▲ +Row pill at bottom of tray
    const barY = trayTop + trayHeight - 12;
    const pipStartX = pad + 12;
    ctx.save();
    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.fillText('NEXT ROW', pipStartX, barY);

    for (let i = 0; i < 2; i++) {
      const px = pipStartX + 62 + i * 13;
      ctx.beginPath();
      ctx.arc(px, barY, 4, 0, Math.PI * 2);
      ctx.fillStyle = i < state.graceMoves ? '#fbbf24' : 'rgba(255, 255, 255, 0.18)';
      ctx.fill();
    }

    // Clickable ▲ +Row button
    const btnW = 66;
    const btnH = 19;
    const btnX = width - pad - btnW - 6;
    const btnY = barY - btnH / 2;
    pushBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    MP.Themes.roundedRectPath(ctx, btnX, btnY, btnW, btnH, 10);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.24)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ +ROW', btnX + btnW / 2, barY + 0.5);
    ctx.restore();

    // Floating dragged block (lifted up on touch so finger never blocks view)
    if (drag && drag.moved && drag.val !== null) {
      const lift = drag.pointerType === 'touch' ? 28 : 0;
      MP.Themes.drawTile(ctx, drag.x, drag.y - lift, cell * 1.06, drag.val, skin, {
        highlighted: true
      });
    }

    MP.Effects.updateAndDraw(ctx, dt, cell, skin);
  }

  MP.Modes.drag_stack = {
    id: 'drag_stack',
    name: 'Drag & Merge',
    icon: '🧱',
    tagline: 'Drag blocks between 5 columns & merge stacks before new rows rise.',
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
