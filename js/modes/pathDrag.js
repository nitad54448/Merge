(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});
  MP.Modes = MP.Modes || {};

  const COLS = 5;
  const ROWS = 6;

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

  function rollIncomingVal(maxTile) {
    const pool = [2, 4, 8];
    if (maxTile >= 64) pool.push(16);
    if (maxTile >= 256) pool.push(32);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getEmptyCells(grid) {
    const list = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === null) list.push([r, c]);
      }
    }
    return list;
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

  function createInitialState() {
    const grid = makeEmptyGrid();
    const empty = getEmptyCells(grid);
    const starterPool = [2, 2, 4, 4, 8, 2, 4];
    for (let i = 0; i < starterPool.length && empty.length > 0; i++) {
      const idx = Math.floor(Math.random() * empty.length);
      const [r, c] = empty.splice(idx, 1)[0];
      grid[r][c] = starterPool[i];
    }
    return {
      grid,
      incoming: [2, 4],
      gameOver: false
    };
  }

  function validateSavedState(saved) {
    if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      if (!Array.isArray(saved.grid[r]) || saved.grid[r].length !== COLS) return false;
    }
    if (!Array.isArray(saved.incoming) || saved.incoming.length !== 2) {
      saved.incoming = [2, 4];
    }
    return true;
  }

  function computeLayout(availW, availH, dpr) {
    const pad = 10;
    const gap = 6;
    const topGap = 10;
    const maxCellW = (availW - pad * 2 - gap * (COLS - 1)) / COLS;
    const maxCellH = (availH - pad * 2 - topGap - gap * (ROWS - 1)) / (ROWS + 1.1);
    const cell = Math.max(36, Math.floor(Math.min(maxCellW, maxCellH)));
    const trayHeight = Math.round(cell * 1.04);
    const trayTop = pad;
    const gridTop = trayTop + trayHeight + topGap;
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
      trayTop,
      trayHeight,
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

  function getCellFromPos(metrics, pos) {
    const col = Math.floor((pos.x - metrics.pad + metrics.gap / 2) / (metrics.cell + metrics.gap));
    const row = Math.floor((pos.y - metrics.gridTop + metrics.gap / 2) / (metrics.cell + metrics.gap));
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return { r: row, c: col };
  }

  function computePaths(grid, startR, startC) {
    const val = grid[startR][startC];
    if (val === null) return null;

    const info = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    info[startR][startC] = { prev: null, isMerge: false, isStart: true };

    const queue = [[startR, startC]];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (info[nr][nc]) continue;

        const targetVal = grid[nr][nc];
        if (targetVal === null) {
          info[nr][nc] = { prev: [r, c], isMerge: false };
          queue.push([nr, nc]);
        } else if (targetVal === val) {
          info[nr][nc] = { prev: [r, c], isMerge: true };
        }
      }
    }
    return info;
  }

  function buildWaypoints(info, tr, tc) {
    const path = [];
    let cur = [tr, tc];
    while (cur) {
      path.push({ r: cur[0], c: cur[1] });
      const node = info[cur[0]][cur[1]];
      cur = node ? node.prev : null;
    }
    path.reverse();
    return path;
  }

  function isGameOver(state) {
    if (state.gameOver) return true;
    const grid = state.grid;
    if (getEmptyCells(grid).length > 0) return false;
    const dirs = [[1, 0], [0, 1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < ROWS && nc < COLS && grid[nr][nc] === v) return false;
        }
      }
    }
    return true;
  }

  // Transient state
  let selected = null;     // { r, c, paths }
  let drag = null;         // { sr, sc, val, paths, hoverR, hoverC, x, y, startX, startY, pointerType, moved }

  function resetTransient() {
    selected = null;
    drag = null;
  }

  function spawnIncomingTiles(state) {
    const empty = getEmptyCells(state.grid);
    for (let i = 0; i < state.incoming.length && empty.length > 0; i++) {
      const idx = Math.floor(Math.random() * empty.length);
      const [r, c] = empty.splice(idx, 1)[0];
      state.grid[r][c] = state.incoming[i];
      MP.Effects.popCell(r, c);
    }
    const maxTile = getMaxTile(state);
    state.incoming = [rollIncomingVal(maxTile), rollIncomingVal(maxTile)];
  }

  function executePathMove(sr, sc, tr, tc, paths, ctxApp) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;
    const node = paths && paths[tr] && paths[tr][tc];
    if (!node || node.isStart) {
      MP.Sound.playInvalid();
      return false;
    }

    const waypointsGrid = buildWaypoints(paths, tr, tc);
    if (waypointsGrid.length < 2) return false;

    ctxApp.pushUndoSnapshot();
    selected = null;
    ctxApp.setBusy(true);

    const val = grid[sr][sc];
    grid[sr][sc] = null;
    const isMerge = grid[tr][tc] === val;
    const pixelWaypoints = waypointsGrid.map((pt) => cellCenter(metrics, pt.r, pt.c));

    MP.Sound.playSlide();

    MP.Effects.addTween(val, pixelWaypoints, 8.5, () => {
      if (isMerge) {
        const newVal = val * 2;
        grid[tr][tc] = newVal;
        MP.Effects.popCell(tr, tc);
        const pos = cellCenter(metrics, tr, tc);
        MP.Effects.spawnBurst(pos.x, pos.y, MP.Themes.getTierColors(newVal, ctxApp.skin).rim, 18);
        ctxApp.addScore(newVal, pos.x, pos.y, 1);
        MP.Sound.playMerge(newVal, 1, ctxApp.skin);

        if (countTiles(grid) <= 1) {
          spawnIncomingTiles(state);
        }
      } else {
        grid[tr][tc] = val;
        MP.Effects.popCell(tr, tc);
        MP.Sound.playDrop(ctxApp.skin);
        spawnIncomingTiles(state);
      }

      ctxApp.setBusy(false);
      ctxApp.onMoveComplete();
    });

    return true;
  }

  function onPointerDown(pos, e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;
    const cellPos = getCellFromPos(ctxApp.metrics, pos);
    if (!cellPos) {
      selected = null;
      return;
    }

    const { r, c } = cellPos;
    const grid = ctxApp.state.grid;

    // If a tile is currently selected and user taps a reachable target cell
    if (selected && (selected.r !== r || selected.c !== c)) {
      const targetNode = selected.paths[r][c];
      if (targetNode && !targetNode.isStart) {
        executePathMove(selected.r, selected.c, r, c, selected.paths, ctxApp);
        return;
      }
    }

    if (grid[r][c] !== null) {
      const paths = computePaths(grid, r, c);
      const isSameAsSelected = Boolean(selected && selected.r === r && selected.c === c);
      selected = { r, c, paths };
      MP.Sound.playTick();

      drag = {
        sr: r,
        sc: c,
        val: grid[r][c],
        paths,
        hoverR: r,
        hoverC: c,
        startX: pos.x,
        startY: pos.y,
        x: pos.x,
        y: pos.y,
        pointerType: e.pointerType || 'mouse',
        moved: false,
        deselectIfTap: isSameAsSelected
      };
    } else {
      selected = null;
    }
  }

  function onPointerMove(pos, e, ctxApp) {
    if (!drag) return;
    const dx = pos.x - drag.startX;
    const dy = pos.y - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
      drag.moved = true;
    }
    drag.x = pos.x;
    drag.y = pos.y;

    const lift = drag.pointerType === 'touch' ? 24 : 0;
    const hovered = getCellFromPos(ctxApp.metrics, { x: pos.x, y: pos.y - lift });
    if (hovered) {
      drag.hoverR = hovered.r;
      drag.hoverC = hovered.c;
    } else {
      drag.hoverR = -1;
      drag.hoverC = -1;
    }
  }

  function onPointerUp(pos, e, ctxApp) {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (d.moved) {
      const lift = d.pointerType === 'touch' ? 24 : 0;
      const dropCell = getCellFromPos(ctxApp.metrics, { x: pos.x, y: pos.y - lift });
      if (dropCell && d.paths[dropCell.r][dropCell.c] && !d.paths[dropCell.r][dropCell.c].isStart) {
        executePathMove(d.sr, d.sc, dropCell.r, dropCell.c, d.paths, ctxApp);
      }
      return;
    }

    if (d.deselectIfTap) {
      selected = null;
      MP.Sound.playTick();
    }
  }

  function onPointerCancel() {
    drag = null;
  }

  function onKeyDown() {}

  function applyHammer(r, c, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r][c] === null) return false;
    grid[r][c] = null;
    selected = null;
    const pos = cellCenter(ctxApp.metrics, r, c);
    MP.Effects.spawnBurst(pos.x, pos.y, '#f43f5e', 20);
    MP.Sound.playSmash();
    if (countTiles(grid) === 0) {
      spawnIncomingTiles(ctxApp.state);
    }
    ctxApp.onMoveComplete();
    return true;
  }

  function applySwap(r1, c1, r2, c2, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r1][c1] === null || grid[r2][c2] === null) return false;
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
    selected = null;
    MP.Effects.popCell(r1, c1);
    MP.Effects.popCell(r2, c2);
    MP.Sound.playMerge(32, 1, ctxApp.skin);
    ctxApp.onMoveComplete();
    return true;
  }

  function render(ctx, dt, ctxApp) {
    const state = ctxApp.state;
    const metrics = ctxApp.metrics;
    const skin = ctxApp.skin;
    const { pad, gap, cell, trayTop, trayHeight, gridTop, width } = metrics;
    const grid = state.grid;

    // Top Incoming Tray
    const trayW = width - pad * 2;
    MP.Themes.roundedRectPath(ctx, pad, trayTop, trayW, trayHeight, 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXT', pad + 12, trayTop + trayHeight / 2);

    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.fillText('FREE MERGE', width - pad - 12, trayTop + trayHeight / 2);
    ctx.restore();

    const miniSize = Math.round(cell * 0.68);
    const incStartX = pad + 54;
    for (let i = 0; i < state.incoming.length; i++) {
      MP.Themes.drawTile(
        ctx,
        incStartX + i * (miniSize + 6) + miniSize / 2,
        trayTop + trayHeight / 2,
        miniSize,
        state.incoming[i],
        skin,
        {}
      );
    }

    const activePaths = (drag && drag.paths) || (selected && selected.paths) || null;

    // Draw grid slots & reachability hints
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const slotX = pad + c * (cell + gap);
        const slotY = gridTop + r * (cell + gap);
        const pNode = activePaths ? activePaths[r][c] : null;
        let highlight = null;
        if (pNode && !pNode.isStart && !pNode.isMerge) {
          highlight = 'rgba(56, 189, 248, 0.55)';
        }
        MP.Themes.drawSlot(ctx, slotX, slotY, cell, skin, highlight);

        if (pNode && !pNode.isStart && !pNode.isMerge) {
          ctx.save();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.beginPath();
          ctx.arc(slotX + cell / 2, slotY + cell / 2, Math.max(3.5, cell * 0.09), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Draw live BFS path preview if dragging over a reachable target
    if (drag && drag.moved && drag.hoverR >= 0 && drag.hoverC >= 0) {
      const hNode = drag.paths[drag.hoverR][drag.hoverC];
      if (hNode && !hNode.isStart) {
        const wp = buildWaypoints(drag.paths, drag.hoverR, drag.hoverC).map((pt) => cellCenter(metrics, pt.r, pt.c));
        ctx.save();
        ctx.strokeStyle = hNode.isMerge ? '#fde047' : '#38bdf8';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        wp.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw static grid tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = grid[r][c];
        if (!val) continue;
        if (drag && drag.moved && drag.sr === r && drag.sc === c) continue;

        const scale = MP.Effects.getScale(r, c, dt);
        const pos = cellCenter(metrics, r, c);
        const isSwapSel = ctxApp.swapFirst && ctxApp.swapFirst.r === r && ctxApp.swapFirst.c === c;
        const isSelected = selected && selected.r === r && selected.c === c;
        const isMergeTarget = Boolean(activePaths && activePaths[r][c] && activePaths[r][c].isMerge);

        MP.Themes.drawTile(ctx, pos.x, pos.y, cell, val, skin, {
          scale,
          highlighted: isSwapSel || isSelected,
          mergeRing: isMergeTarget
        });
      }
    }

    // Floating dragged tile
    if (drag && drag.moved) {
      const lift = drag.pointerType === 'touch' ? 24 : 0;
      MP.Themes.drawTile(ctx, drag.x, drag.y - lift, cell * 1.04, drag.val, skin, {
        highlighted: true
      });
    }

    MP.Effects.updateAndDraw(ctx, dt, cell, skin);
  }

  MP.Modes.path_drag = {
    id: 'path_drag',
    name: 'Slide & Merge',
    icon: '🧭',
    tagline: 'Slide blocks along open grid paths. Merges clear space with zero new spawns!',
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
