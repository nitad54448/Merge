(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});
  MP.Modes = MP.Modes || {};

  const COLS = 5;
  const ROWS = 5;

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

  function rollPieceVal(maxTile) {
    const pool = [2, 4, 8];
    if (maxTile >= 64) pool.push(16);
    if (maxTile >= 256) pool.push(32);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function rollPiece(maxTile) {
    const isDomino = Math.random() < 0.42;
    if (!isDomino) {
      return {
        kind: 'single',
        vals: [rollPieceVal(maxTile)],
        rot: 0
      };
    }
    const v1 = rollPieceVal(maxTile);
    let v2 = rollPieceVal(maxTile);
    if (v1 === v2 && Math.random() < 0.65) {
      v2 = v1 === 2 ? 4 : 2;
    }
    return {
      kind: 'domino',
      vals: [v1, v2],
      rot: Math.random() < 0.5 ? 0 : 1
    };
  }

  function getPieceCells(piece) {
    if (!piece) return [];
    if (piece.kind === 'single' || piece.vals.length === 1) {
      return [{ dr: 0, dc: 0, val: piece.vals[0] }];
    }
    const a = piece.vals[0];
    const b = piece.vals[1];
    const rot = ((piece.rot || 0) % 4 + 4) % 4;
    if (rot === 0) return [{ dr: 0, dc: 0, val: a }, { dr: 0, dc: 1, val: b }];
    if (rot === 1) return [{ dr: 0, dc: 0, val: a }, { dr: 1, dc: 0, val: b }];
    if (rot === 2) return [{ dr: 0, dc: 0, val: b }, { dr: 0, dc: 1, val: a }];
    return [{ dr: 0, dc: 0, val: b }, { dr: 1, dc: 0, val: a }];
  }

  function createInitialState() {
    return {
      grid: makeEmptyGrid(),
      activePiece: rollPiece(2),
      nextPiece: rollPiece(2),
      gameOver: false
    };
  }

  function validateSavedState(saved) {
    if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      if (!Array.isArray(saved.grid[r]) || saved.grid[r].length !== COLS) return false;
    }
    if (!saved.activePiece || !Array.isArray(saved.activePiece.vals)) {
      saved.activePiece = rollPiece(2);
    }
    if (!saved.nextPiece || !Array.isArray(saved.nextPiece.vals)) {
      saved.nextPiece = rollPiece(2);
    }
    return true;
  }

  function computeLayout(availW, availH, dpr) {
    const pad = 10;
    const gap = 7;
    const trayGap = 12;
    const maxCellW = (availW - pad * 2 - gap * (COLS - 1)) / COLS;
    const maxCellH = (availH - pad * 2 - trayGap - gap * (ROWS - 1)) / (ROWS + 1.9);
    const cell = Math.max(36, Math.floor(Math.min(maxCellW, maxCellH)));
    const trayHeight = Math.round(cell * 1.85);
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

  function canPlacePiece(grid, piece, ar, ac) {
    const cells = getPieceCells(piece);
    for (const p of cells) {
      const rr = ar + p.dr;
      const cc = ac + p.dc;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) return false;
      if (grid[rr][cc] !== null) return false;
    }
    return true;
  }

  function isGameOver(state) {
    if (state.gameOver) return true;
    const grid = state.grid;
    const cells = getPieceCells(state.activePiece);
    if (cells.length <= 1) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c] === null) return false;
        }
      }
      return true;
    }
    // 2-cell rotatable domino fits if ANY orthogonal empty pair exists anywhere
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) continue;
        if (c + 1 < COLS && grid[r][c + 1] === null) return false;
        if (r + 1 < ROWS && grid[r + 1][c] === null) return false;
      }
    }
    return true;
  }

  let drag = null;
  let trayHitRect = null;
  let rotateBtnRect = null;

  function resetTransient() {
    drag = null;
  }

  function findMatchComponents(grid) {
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const comps = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = grid[r][c];
        if (val === null || visited[r][c]) continue;

        const queue = [[r, c]];
        const cells = [];
        visited[r][c] = true;

        while (queue.length > 0) {
          const [cr, cc] = queue.shift();
          cells.push([cr, cc]);
          for (const [dr, dc] of dirs) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc] && grid[nr][nc] === val) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }

        if (cells.length >= 3) {
          comps.push({ val, cells });
        }
      }
    }
    return comps;
  }

  function resolveClusters(ctxApp, priorityCoords, combo) {
    const state = ctxApp.state;
    const grid = state.grid;
    const metrics = ctxApp.metrics;
    const comps = findMatchComponents(grid);

    if (comps.length === 0) {
      ctxApp.setBusy(false);
      ctxApp.onMoveComplete();
      return;
    }

    // Prefer component touching priorityCoords
    let chosen = comps[0];
    let anchor = chosen.cells[0];
    if (priorityCoords && priorityCoords.length > 0) {
      for (const comp of comps) {
        let matchedCoord = null;
        for (const [pr, pc] of priorityCoords) {
          if (comp.cells.some(([cr, cc]) => cr === pr && cc === pc)) {
            matchedCoord = [pr, pc];
            break;
          }
        }
        if (matchedCoord) {
          chosen = comp;
          anchor = matchedCoord;
          break;
        }
      }
    }

    const [mr, mc] = anchor;
    const val = chosen.val;
    const pos = cellCenter(metrics, mr, mc);

    if (val >= 2048) {
      // 2048 Super Blast: clear component + 3x3 surrounding neighborhood!
      const toClear = new Set();
      for (const [cr, cc] of chosen.cells) {
        toClear.add(`${cr},${cc}`);
      }
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = mr + dr;
          const cc = mc + dc;
          if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] !== null) {
            toClear.add(`${rr},${cc}`);
          }
        }
      }
      for (const key of toClear) {
        const [rr, cc] = key.split(',').map(Number);
        const cPos = cellCenter(metrics, rr, cc);
        MP.Effects.spawnBurst(cPos.x, cPos.y, '#fde047', 12);
        grid[rr][cc] = null;
      }
      MP.Effects.spawnText(pos.x, pos.y - 16, '2048 BLAST!', '#fde047');
      ctxApp.addScore(5000 * combo, pos.x, pos.y, combo);
      MP.Sound.playMerge(2048, combo + 1, ctxApp.skin);
      MP.Sound.playSmash();
    } else {
      for (const [cr, cc] of chosen.cells) {
        if (cr === mr && cc === mc) continue;
        const cPos = cellCenter(metrics, cr, cc);
        MP.Effects.spawnBurst(cPos.x, cPos.y, MP.Themes.getTierColors(val, ctxApp.skin).rim, 8);
        grid[cr][cc] = null;
      }
      const newVal = chosen.cells.length >= 5 ? val * 4 : val * 2;
      grid[mr][mc] = newVal;
      MP.Effects.popCell(mr, mc);
      MP.Effects.spawnBurst(pos.x, pos.y, MP.Themes.getTierColors(newVal, ctxApp.skin).rim, 18);
      ctxApp.addScore(newVal * combo, pos.x, pos.y, combo);
      MP.Sound.playMerge(newVal, combo, ctxApp.skin);
    }

    MP.Timers.after(145, () => {
      resolveClusters(ctxApp, [[mr, mc]], combo + 1);
    });
  }

  function placePieceAt(ar, ac, ctxApp) {
    const state = ctxApp.state;
    const piece = state.activePiece;
    if (!canPlacePiece(state.grid, piece, ar, ac)) {
      MP.Sound.playInvalid();
      return false;
    }

    ctxApp.pushUndoSnapshot();
    const cells = getPieceCells(piece);
    const placedCoords = [];
    for (const p of cells) {
      const rr = ar + p.dr;
      const cc = ac + p.dc;
      state.grid[rr][cc] = p.val;
      MP.Effects.popCell(rr, cc);
      placedCoords.push([rr, cc]);
    }

    MP.Sound.playDrop(ctxApp.skin);
    state.activePiece = state.nextPiece;
    state.nextPiece = rollPiece(getMaxTile(state));

    ctxApp.setBusy(true);
    MP.Timers.after(110, () => {
      resolveClusters(ctxApp, placedCoords, 1);
    });
    return true;
  }

  function rotateActivePiece(ctxApp) {
    const piece = ctxApp.state.activePiece;
    if (!piece || piece.kind === 'single') return;
    piece.rot = (piece.rot + 1) % 4;
    MP.Sound.playTick();
    ctxApp.saveAndRefreshHUD();
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

  function computeProjectedAnchor(metrics, piece, centerPxX, centerPxY) {
    const cells = getPieceCells(piece);
    const maxDr = cells.reduce((m, p) => Math.max(m, p.dr), 0);
    const maxDc = cells.reduce((m, p) => Math.max(m, p.dc), 0);
    const step = metrics.cell + metrics.gap;

    // Only project onto grid if lifted piece reaches inside or just above bottom of grid
    const gridBottom = metrics.gridTop + metrics.gridHeight;
    if (centerPxY > gridBottom + metrics.cell * 0.45) {
      return null;
    }

    const pieceCenterOffX = (maxDc * step) / 2;
    const pieceCenterOffY = (maxDr * step) / 2;
    const topLeftCenterX = centerPxX - pieceCenterOffX;
    const topLeftCenterY = centerPxY - pieceCenterOffY;

    const rawC = Math.round((topLeftCenterX - metrics.pad - metrics.cell / 2) / step);
    const rawR = Math.round((topLeftCenterY - metrics.gridTop - metrics.cell / 2) / step);

    return {
      ar: Math.max(0, Math.min(ROWS - 1 - maxDr, rawR)),
      ac: Math.max(0, Math.min(COLS - 1 - maxDc, rawC))
    };
  }

  function getCellFromGridTap(metrics, pos) {
    const step = metrics.cell + metrics.gap;
    const c = Math.floor((pos.x - metrics.pad + metrics.gap / 2) / step);
    const r = Math.floor((pos.y - metrics.gridTop + metrics.gap / 2) / step);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  function onPointerDown(pos, e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;

    if (pointInRect(pos, rotateBtnRect)) {
      rotateActivePiece(ctxApp);
      return;
    }

    const inTray = pointInRect(pos, trayHitRect) || pos.y >= ctxApp.metrics.trayTop;
    if (inTray) {
      drag = {
        fromTray: true,
        startX: pos.x,
        startY: pos.y,
        x: pos.x,
        y: pos.y,
        pointerType: e.pointerType || 'mouse',
        moved: false,
        anchor: null
      };
      return;
    }

    // Direct tap on grid
    const gridCell = getCellFromGridTap(ctxApp.metrics, pos);
    if (gridCell) {
      const piece = ctxApp.state.activePiece;
      const cells = getPieceCells(piece);
      const maxDr = cells.reduce((m, p) => Math.max(m, p.dr), 0);
      const maxDc = cells.reduce((m, p) => Math.max(m, p.dc), 0);
      const ar = Math.min(gridCell.r, ROWS - 1 - maxDr);
      const ac = Math.min(gridCell.c, COLS - 1 - maxDc);
      placePieceAt(ar, ac, ctxApp);
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
    const lift = drag.pointerType === 'touch' ? 42 : 0;
    drag.anchor = computeProjectedAnchor(ctxApp.metrics, ctxApp.state.activePiece, drag.x, drag.y - lift);
  }

  function onPointerUp(pos, e, ctxApp) {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (!d.moved) {
      if (d.fromTray) {
        rotateActivePiece(ctxApp);
      }
      return;
    }

    const lift = d.pointerType === 'touch' ? 42 : 0;
    const anchor = computeProjectedAnchor(ctxApp.metrics, ctxApp.state.activePiece, pos.x, pos.y - lift);
    if (anchor) {
      placePieceAt(anchor.ar, anchor.ac, ctxApp);
    }
  }

  function onPointerCancel() {
    drag = null;
  }

  function onKeyDown(e, ctxApp) {
    if (ctxApp.busy || ctxApp.state.gameOver) return;
    if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
      e.preventDefault();
      rotateActivePiece(ctxApp);
    }
  }

  function applyHammer(r, c, ctxApp) {
    const grid = ctxApp.state.grid;
    if (grid[r][c] === null) return false;
    grid[r][c] = null;
    const pos = cellCenter(ctxApp.metrics, r, c);
    MP.Effects.spawnBurst(pos.x, pos.y, '#f43f5e', 20);
    MP.Sound.playSmash();
    ctxApp.onMoveComplete();
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
    MP.Timers.after(120, () => resolveClusters(ctxApp, [[r1, c1], [r2, c2]], 1));
    return true;
  }

  function drawPieceAt(ctx, cx, cy, tileSize, tileGap, piece, skin, opts = {}) {
    const cells = getPieceCells(piece);
    const maxDr = cells.reduce((m, p) => Math.max(m, p.dr), 0);
    const maxDc = cells.reduce((m, p) => Math.max(m, p.dc), 0);
    const step = tileSize + tileGap;
    const originX = cx - (maxDc * step) / 2;
    const originY = cy - (maxDr * step) / 2;

    for (const p of cells) {
      MP.Themes.drawTile(
        ctx,
        originX + p.dc * step,
        originY + p.dr * step,
        tileSize,
        p.val,
        skin,
        opts
      );
    }
  }

  function render(ctx, dt, ctxApp) {
    const state = ctxApp.state;
    const metrics = ctxApp.metrics;
    const skin = ctxApp.skin;
    const { pad, gap, cell, gridTop, trayTop, trayHeight, width } = metrics;
    const grid = state.grid;

    // Draw 5x5 slots
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const slotX = pad + c * (cell + gap);
        const slotY = gridTop + r * (cell + gap);
        MP.Themes.drawSlot(ctx, slotX, slotY, cell, skin);
      }
    }

    // Ghost placement preview when dragging over grid
    const activeCells = getPieceCells(state.activePiece);
    if (drag && drag.moved && drag.anchor) {
      const { ar, ac } = drag.anchor;
      const valid = canPlacePiece(grid, state.activePiece, ar, ac);
      for (const p of activeCells) {
        const rr = ar + p.dr;
        const cc = ac + p.dc;
        const pos = cellCenter(metrics, rr, cc);
        if (valid) {
          MP.Themes.drawTile(ctx, pos.x, pos.y, cell, p.val, skin, { alpha: 0.38, ghost: true });
        } else {
          ctx.save();
          MP.Themes.roundedRectPath(ctx, pos.x - cell / 2, pos.y - cell / 2, cell, cell, Math.max(6, cell * 0.17));
          ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
          ctx.fill();
          ctx.strokeStyle = '#fb7185';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw grid tiles
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

    // Bottom Tray
    const trayW = width - pad * 2;
    MP.Themes.roundedRectPath(ctx, pad, trayTop, trayW, trayHeight, 14);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const trayCx = width / 2;
    const trayCy = trayTop + trayHeight / 2;
    const trayTileSize = Math.round(cell * 0.72);
    const trayGap = 5;

    // Hit box for active piece in tray
    trayHitRect = {
      x: trayCx - cell * 1.15,
      y: trayTop + 4,
      w: cell * 2.3,
      h: trayHeight - 8
    };

    // Draw active piece in tray if not currently dragged away
    if ((!drag || !drag.moved) && !state.gameOver && !ctxApp.busy) {
      drawPieceAt(ctx, trayCx, trayCy, trayTileSize, trayGap, state.activePiece, skin, {
        highlighted: true
      });
    }

    // Rotate button on left (when piece is domino)
    if (state.activePiece && state.activePiece.kind === 'domino' && !state.gameOver) {
      const btnW = Math.min(82, Math.round(trayW * 0.27));
      const btnH = 34;
      const btnX = pad + 10;
      const btnY = trayCy - btnH / 2;
      rotateBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      MP.Themes.roundedRectPath(ctx, btnX, btnY, btnW, btnH, 10);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.save();
      ctx.fillStyle = '#fef3c7';
      ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↻ Rotate', btnX + btnW / 2, trayCy);
      ctx.restore();
    } else {
      rotateBtnRect = null;
    }

    // NEXT piece preview on right
    const nextW = Math.min(84, Math.round(trayW * 0.27));
    const nextX = width - pad - nextW - 10;
    const nextY = trayTop + 8;
    const nextH = trayHeight - 16;
    MP.Themes.roundedRectPath(ctx, nextX, nextY, nextW, nextH, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '800 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXT', nextX + nextW / 2, nextY + 11);
    ctx.restore();

    if (state.nextPiece) {
      drawPieceAt(
        ctx,
        nextX + nextW / 2,
        nextY + nextH * 0.58,
        Math.round(cell * 0.43),
        3,
        state.nextPiece,
        skin,
        { alpha: 0.9 }
      );
    }

    // Floating dragged piece
    if (drag && drag.moved && state.activePiece) {
      const lift = drag.pointerType === 'touch' ? 42 : 0;
      drawPieceAt(ctx, drag.x, drag.y - lift, cell * 0.96, gap, state.activePiece, skin, {
        highlighted: true
      });
    }

    MP.Effects.updateAndDraw(ctx, dt, cell, skin);
  }

  MP.Modes.dice_grid = {
    id: 'dice_grid',
    name: 'Domino Merge',
    icon: '🎲',
    tagline: 'Rotate & place blocks on a 5×5 grid. Connect 3+ equal numbers to merge!',
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
