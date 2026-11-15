(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});

  const MODE_ORDER = ['drag_stack', 'shooter_2048', 'path_drag', 'dice_grid'];

  const HELP_CONTENT = {
    drag_stack: {
      title: '🧱 Drag & Merge',
      bullets: [
        'Drag the top block of any column (or tap a column, then tap another column) to move it.',
        'Drop onto an identical number to merge them (2 + 2 = 4, 4 + 4 = 8...) and trigger vertical chain combos.',
        'Merges are free! Every 2 non-merge moves (indicated by the 2 gold dots), the Next Row rises from the bottom.',
        'Tip: Tap ▲ +ROW anytime to bring up new blocks early, and keep columns from overflowing the top!'
      ]
    },
    shooter_2048: {
      title: '🚀 2048 Shooter',
      bullets: [
        'Aim across the 5 columns by dragging or tapping, then release to shoot blocks upward.',
        'Matching adjacent blocks automatically fuse into higher powers of 2 and pull remaining tiles up.',
        'Hit 2 or 3 matching blocks at once for 4× or 8× mega-merges!',
        'Tip: Tap the ⇄ NEXT preview box in the launcher to swap your current and upcoming block anytime.'
      ]
    },
    path_drag: {
      title: '🧭 Slide & Merge',
      bullets: [
        'Drag (or tap-select) any block and slide it through open orthogonal paths on the 5×6 board.',
        'Merging onto an equal block is a FREE move — no new blocks spawn on the board!',
        'Moving a block to an empty cell spawns the 2 Next Spawn blocks in random empty slots.',
        'Tip: Keep clear corridors open so large numbers can always reach each other.'
      ]
    },
    dice_grid: {
      title: '🎲 Domino Merge',
      bullets: [
        'Drag single or 2-tile domino blocks from the bottom tray onto empty spaces in the 5×5 grid (or tap a cell directly).',
        'Tap the tray piece or ↻ Rotate (or press R / Space) to rotate 2-tile dominoes before placing.',
        'Connect 3 or more identical numbers horizontally or vertically to merge them into the next tier (5+ gives 4×!).',
        'Merge 3+ 2048 blocks together to trigger a massive 3×3 Super Blast!'
      ]
    }
  };

  // DOM References
  const hubScreen = document.getElementById('hub-screen');
  const gameScreen = document.getElementById('game-screen');
  const modeGridEl = document.getElementById('mode-grid');
  const hubSkinBadge = document.getElementById('hub-skin-badge');
  const hubSoundBtn = document.getElementById('hub-btn-sound');
  const hubThemesBtn = document.getElementById('hub-btn-themes');
  const hubHelpBtn = document.getElementById('hub-btn-help');
  const hubInstallBtn = document.getElementById('hub-btn-install');

  const homeBtn = document.getElementById('btn-home');
  const activeModeBadge = document.getElementById('active-mode-badge');
  const scoreEl = document.getElementById('score-val');
  const bestEl = document.getElementById('best-val');
  const gameThemesBtn = document.getElementById('game-btn-themes');
  const gameHelpBtn = document.getElementById('game-btn-help');
  const gameSoundBtn = document.getElementById('game-btn-sound');
  const restartBtn = document.getElementById('btn-restart');

  const boardWrap = document.getElementById('board-wrap');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const modeBanner = document.getElementById('mode-banner');

  const hammerBtn = document.getElementById('btn-hammer');
  const swapBtn = document.getElementById('btn-swap');
  const undoBtn = document.getElementById('btn-undo');
  const hammerCountEl = document.getElementById('hammer-count');
  const swapCountEl = document.getElementById('swap-count');
  const undoCountEl = document.getElementById('undo-count');

  // Modals
  const themesModal = document.getElementById('themes-modal');
  const skinChoicesEl = document.getElementById('skin-choices');
  const bgChoicesEl = document.getElementById('bg-choices');

  const helpModal = document.getElementById('help-modal');
  const helpTabsEl = document.getElementById('help-tabs');
  const helpBodyEl = document.getElementById('help-body');

  const confirmModal = document.getElementById('confirm-modal');
  const confirmRestartBtn = document.getElementById('btn-confirm-restart');
  const cancelRestartBtn = document.getElementById('btn-cancel-restart');

  const gameoverModal = document.getElementById('gameover-modal');
  const newBestPill = document.getElementById('new-best-pill');
  const finalScoreEl = document.getElementById('final-score');
  const finalBestEl = document.getElementById('final-best');
  const finalTileEl = document.getElementById('final-tile');
  const playAgainBtn = document.getElementById('btn-play-again');
  const changeGameBtn = document.getElementById('btn-change-game');

  // Runtime App State
  let activeMode = null;
  let runState = null;
  let metrics = null;
  let busy = false;
  let boosterMode = 'NONE'; // NONE | HAMMER | SWAP_1 | SWAP_2
  let swapFirst = null;
  let newBestInRun = false;
  let activeHelpTab = 'drag_stack';
  let deferredInstallPrompt = null;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function applyThemeVisuals() {
    const meta = MP.Storage.getMeta();
    const bgObj = MP.Themes.BACKGROUNDS.find((b) => b.id === meta.bg) || MP.Themes.BACKGROUNDS[0];
    const skinObj = MP.Themes.SKINS.find((s) => s.id === meta.skin) || MP.Themes.SKINS[0];

    document.body.setAttribute('data-bg', bgObj.id);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', bgObj.themeColor);
    }
    if (hubSkinBadge) {
      hubSkinBadge.textContent = `${skinObj.name} • ${bgObj.name}`;
    }
  }

  function updateSoundButtons() {
    const icon = MP.Sound.muted ? '🔇' : '🔊';
    if (hubSoundBtn) hubSoundBtn.textContent = icon;
    if (gameSoundBtn) gameSoundBtn.textContent = icon;
  }

  function renderHub() {
    const meta = MP.Storage.getMeta();
    modeGridEl.innerHTML = '';

    for (const modeId of MODE_ORDER) {
      const mode = MP.Modes[modeId];
      if (!mode) continue;
      const stats = MP.Storage.getModeStats(modeId);
      const savedRun = MP.Storage.loadRun(modeId);
      const canResume = Boolean(savedRun && !savedRun.gameOver && mode.validateSavedState(savedRun));

      const card = document.createElement('div');
      card.className = 'mode-card' + (canResume ? ' has-save' : '');
      card.dataset.modeId = modeId;

      const top = document.createElement('div');
      top.className = 'mode-card-top';

      const emblem = document.createElement('div');
      emblem.className = 'mode-emblem';
      emblem.textContent = mode.icon;
      top.appendChild(emblem);

      if (canResume) {
        const tag = document.createElement('span');
        tag.className = 'mode-save-tag';
        tag.textContent = 'Saved';
        top.appendChild(tag);
      }

      const info = document.createElement('div');
      info.className = 'mode-info';
      const title = document.createElement('h2');
      title.textContent = mode.name;
      const desc = document.createElement('p');
      desc.textContent = mode.tagline;
      info.appendChild(title);
      info.appendChild(desc);

      const statRow = document.createElement('div');
      statRow.className = 'mode-stats';

      const bestPill = document.createElement('div');
      bestPill.className = 'mode-stat-pill';
      bestPill.innerHTML = `<span class="lbl">Best</span><span class="val gold">${stats.best.toLocaleString()}</span>`;

      const maxPill = document.createElement('div');
      maxPill.className = 'mode-stat-pill';
      maxPill.innerHTML = `<span class="lbl">Max Tile</span><span class="val">${MP.Themes.formatValue(stats.maxTile)}</span>`;

      statRow.appendChild(bestPill);
      statRow.appendChild(maxPill);

      const actions = document.createElement('div');
      actions.className = 'mode-actions';

      const playBtn = document.createElement('button');
      playBtn.className = 'mode-play-btn';
      playBtn.type = 'button';
      playBtn.textContent = canResume
        ? `▶ Resume (${(savedRun.score || 0).toLocaleString()})`
        : '▶ Play';
      playBtn.addEventListener('click', () => {
        MP.Sound.unlock();
        openMode(modeId, false);
      });
      actions.appendChild(playBtn);

      if (canResume) {
        const newBtn = document.createElement('button');
        newBtn.className = 'mode-new-btn';
        newBtn.type = 'button';
        newBtn.title = 'Start Fresh Game';
        newBtn.setAttribute('aria-label', `New ${mode.name} game`);
        newBtn.textContent = '↻';
        newBtn.addEventListener('click', () => {
          MP.Sound.unlock();
          openMode(modeId, true);
        });
        actions.appendChild(newBtn);
      }

      card.appendChild(top);
      card.appendChild(info);
      card.appendChild(statRow);
      card.appendChild(actions);
      modeGridEl.appendChild(card);
    }

    applyThemeVisuals();
    updateSoundButtons();
  }

  function persistCurrentRun() {
    if (activeMode && runState) {
      MP.Storage.saveRun(activeMode.id, runState);
    }
  }

  function showHub() {
    persistCurrentRun();
    MP.Timers.clearAll();
    MP.Effects.reset();
    if (activeMode) activeMode.resetTransient();

    activeMode = null;
    runState = null;
    busy = false;
    boosterMode = 'NONE';
    swapFirst = null;

    gameoverModal.classList.remove('open');
    confirmModal.classList.remove('open');
    gameScreen.classList.add('hidden');
    hubScreen.classList.remove('hidden');

    renderHub();
  }

  function createFreshRunState(mode) {
    return Object.assign(
      {
        modeId: mode.id,
        score: 0,
        hammers: 2,
        swaps: 2,
        undos: 2,
        nextBonusMilestone: 2000,
        highestUnlockedTile: 2,
        undoSnapshot: null
      },
      mode.createInitialState()
    );
  }

  function openMode(modeId, forceNew = false) {
    const mode = MP.Modes[modeId];
    if (!mode) return;

    MP.Timers.clearAll();
    MP.Effects.reset();
    mode.resetTransient();

    activeMode = mode;
    busy = false;
    boosterMode = 'NONE';
    swapFirst = null;
    newBestInRun = false;

    const saved = forceNew ? null : MP.Storage.loadRun(modeId);
    if (saved && !saved.gameOver && mode.validateSavedState(saved)) {
      runState = saved;
      if (typeof runState.score !== 'number') runState.score = 0;
      if (typeof runState.hammers !== 'number') runState.hammers = 2;
      if (typeof runState.swaps !== 'number') runState.swaps = 2;
      if (typeof runState.undos !== 'number') runState.undos = 2;
      if (typeof runState.nextBonusMilestone !== 'number') runState.nextBonusMilestone = 2000;
      if (typeof runState.highestUnlockedTile !== 'number') runState.highestUnlockedTile = mode.getMaxTile(runState);
      if (runState.undoSnapshot === undefined) runState.undoSnapshot = null;
    } else {
      runState = createFreshRunState(mode);
      MP.Storage.incrementPlayed(modeId);
      MP.Storage.saveRun(modeId, runState);
    }

    MP.Storage.setPreference('lastMode', modeId);

    hubScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    gameoverModal.classList.remove('open');
    confirmModal.classList.remove('open');

    activeModeBadge.textContent = `${mode.icon} ${mode.name}`;
    resizeCanvas();
    updateHUD();

    if (mode.isGameOver(runState)) {
      triggerGameOver();
    }
  }

  function resizeCanvas() {
    if (!activeMode || gameScreen.classList.contains('hidden')) return;
    const availW = boardWrap.clientWidth;
    const availH = boardWrap.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    const dpr = Math.min(global.devicePixelRatio || 1, 3);
    metrics = activeMode.computeLayout(availW, availH, dpr);

    canvas.style.width = metrics.width + 'px';
    canvas.style.height = metrics.height + 'px';
    canvas.width = Math.round(metrics.width * dpr);
    canvas.height = Math.round(metrics.height * dpr);
  }

  function updateHUD() {
    if (!activeMode || !runState) return;
    const stats = MP.Storage.getModeStats(activeMode.id);
    const displayBest = Math.max(stats.best, runState.score);

    scoreEl.textContent = runState.score.toLocaleString();
    bestEl.textContent = displayBest.toLocaleString();

    hammerCountEl.textContent = runState.hammers;
    swapCountEl.textContent = runState.swaps;
    undoCountEl.textContent = runState.undos;

    const locked = busy || Boolean(runState.gameOver);
    hammerBtn.disabled = locked || (runState.hammers <= 0 && boosterMode !== 'HAMMER');
    swapBtn.disabled = locked || (runState.swaps <= 0 && boosterMode !== 'SWAP_1' && boosterMode !== 'SWAP_2');
    undoBtn.disabled = locked || runState.undos <= 0 || !runState.undoSnapshot;

    hammerBtn.classList.toggle('active', boosterMode === 'HAMMER');
    swapBtn.classList.toggle('active', boosterMode === 'SWAP_1' || boosterMode === 'SWAP_2');

    if (boosterMode === 'HAMMER') {
      modeBanner.textContent = '🔨 Tap any block to smash it';
      modeBanner.classList.add('visible');
    } else if (boosterMode === 'SWAP_1') {
      modeBanner.textContent = '⇄ Tap first block to swap';
      modeBanner.classList.add('visible');
    } else if (boosterMode === 'SWAP_2') {
      modeBanner.textContent = '⇄ Tap second block to swap';
      modeBanner.classList.add('visible');
    } else {
      modeBanner.classList.remove('visible');
    }

    updateSoundButtons();
  }

  function triggerGameOver() {
    if (!activeMode || !runState) return;
    runState.gameOver = true;
    boosterMode = 'NONE';
    swapFirst = null;
    busy = false;

    const maxTile = activeMode.getMaxTile(runState);
    if (MP.Storage.recordScore(activeMode.id, runState.score, maxTile)) {
      newBestInRun = true;
    }
    MP.Storage.saveRun(activeMode.id, runState);
    MP.Sound.playGameOver();

    const stats = MP.Storage.getModeStats(activeMode.id);
    finalScoreEl.textContent = runState.score.toLocaleString();
    finalBestEl.textContent = stats.best.toLocaleString();
    finalTileEl.textContent = MP.Themes.formatValue(maxTile);
    newBestPill.classList.toggle('hidden', !newBestInRun);

    updateHUD();
    gameoverModal.classList.add('open');
  }

  // Context Bridge passed to every Game Mode
  const ctxApp = {
    get state() {
      return runState;
    },
    get skin() {
      return MP.Storage.getMeta().skin;
    },
    get metrics() {
      return metrics;
    },
    get busy() {
      return busy;
    },
    get boosterMode() {
      return boosterMode;
    },
    get swapFirst() {
      return swapFirst;
    },
    setBusy(val) {
      busy = Boolean(val);
      updateHUD();
    },
    pushUndoSnapshot() {
      if (!runState) return;
      const copy = deepClone(runState);
      copy.undoSnapshot = null;
      runState.undoSnapshot = copy;
    },
    addScore(points, x, y, combo = 1) {
      if (!runState || !activeMode) return;
      runState.score += points;

      const curMax = activeMode.getMaxTile(runState);
      if (MP.Storage.recordScore(activeMode.id, runState.score, curMax)) {
        newBestInRun = true;
      }

      // Score milestones every 2,000 pts cycle bonus boosters
      while (runState.score >= runState.nextBonusMilestone) {
        const milestoneIndex = Math.round(runState.nextBonusMilestone / 2000);
        const mod = milestoneIndex % 3;
        let rewardMsg = '+1 🔨 SMASH!';
        if (mod === 1) {
          runState.hammers += 1;
          rewardMsg = '+1 🔨 SMASH!';
        } else if (mod === 2) {
          runState.swaps += 1;
          rewardMsg = '+1 ⇄ SWAP!';
        } else {
          runState.undos += 1;
          rewardMsg = '+1 ↶ UNDO!';
        }
        runState.nextBonusMilestone += 2000;
        if (metrics) {
          MP.Effects.spawnText(metrics.width / 2, metrics.gridTop + 18, rewardMsg, '#38bdf8');
        }
      }

      // First-time high-tile milestones (512, 1024, 2048, 4096)
      const tileMilestones = [512, 1024, 2048, 4096];
      for (const mTile of tileMilestones) {
        if (curMax >= mTile && runState.highestUnlockedTile < mTile) {
          runState.highestUnlockedTile = mTile;
          runState.hammers += 1;
          runState.undos += 1;
          if (metrics) {
            MP.Effects.spawnText(metrics.width / 2, metrics.gridTop + 38, `${mTile}! +1 🔨 & ↶`, '#fde047');
          }
        }
      }

      if (x !== undefined && y !== undefined) {
        const label = combo > 1 ? `+${points} (×${combo}!)` : `+${points}`;
        MP.Effects.spawnText(x, y - 10, label, combo > 1 ? '#38bdf8' : '#fde047');
      }
      updateHUD();
    },
    saveAndRefreshHUD() {
      updateHUD();
      persistCurrentRun();
    },
    onMoveComplete() {
      if (!activeMode || !runState) return;
      const curMax = activeMode.getMaxTile(runState);
      if (MP.Storage.recordScore(activeMode.id, runState.score, curMax)) {
        newBestInRun = true;
      }

      if (activeMode.isGameOver(runState)) {
        triggerGameOver();
        return;
      }

      updateHUD();
      persistCurrentRun();
    }
  };

  // ==========================================
  // BOOSTERS (SMASH, SWAP, UNDO)
  // ==========================================
  hammerBtn.addEventListener('click', () => {
    MP.Sound.unlock();
    if (!activeMode || busy || !runState || runState.gameOver) return;
    if (boosterMode === 'HAMMER') {
      boosterMode = 'NONE';
    } else if (runState.hammers > 0) {
      boosterMode = 'HAMMER';
      swapFirst = null;
      activeMode.resetTransient();
    }
    updateHUD();
  });

  swapBtn.addEventListener('click', () => {
    MP.Sound.unlock();
    if (!activeMode || busy || !runState || runState.gameOver) return;
    if (boosterMode === 'SWAP_1' || boosterMode === 'SWAP_2') {
      boosterMode = 'NONE';
      swapFirst = null;
    } else if (runState.swaps > 0) {
      boosterMode = 'SWAP_1';
      swapFirst = null;
      activeMode.resetTransient();
    }
    updateHUD();
  });

  undoBtn.addEventListener('click', () => {
    MP.Sound.unlock();
    if (!activeMode || busy || !runState || runState.gameOver) return;
    if (runState.undos <= 0 || !runState.undoSnapshot) return;

    const nextUndoCount = runState.undos - 1;
    const restored = deepClone(runState.undoSnapshot);
    restored.undos = nextUndoCount;
    restored.undoSnapshot = null;
    restored.gameOver = false;

    MP.Timers.clearAll();
    MP.Effects.reset();
    activeMode.resetTransient();
    boosterMode = 'NONE';
    swapFirst = null;
    busy = false;
    runState = restored;

    MP.Sound.playUndo();
    updateHUD();
    persistCurrentRun();
  });

  function getGridCellFromCanvasPos(pos) {
    if (!activeMode || !metrics) return null;
    const step = metrics.cell + metrics.gap;
    const c = Math.floor((pos.x - metrics.pad + metrics.gap / 2) / step);
    const r = Math.floor((pos.y - metrics.gridTop + metrics.gap / 2) / step);
    if (r < 0 || r >= activeMode.rows || c < 0 || c >= activeMode.cols) return null;
    return { r, c };
  }

  function handleBoosterTap(pos) {
    const cellPos = getGridCellFromCanvasPos(pos);
    if (!cellPos) return;
    const { r, c } = cellPos;
    const val = runState.grid[r][c];
    if (val === null) return;

    if (boosterMode === 'HAMMER') {
      ctxApp.pushUndoSnapshot();
      runState.hammers -= 1;
      boosterMode = 'NONE';
      updateHUD();
      if (!activeMode.applyHammer(r, c, ctxApp)) {
        runState.hammers += 1;
        updateHUD();
      }
    } else if (boosterMode === 'SWAP_1') {
      swapFirst = { r, c };
      boosterMode = 'SWAP_2';
      MP.Sound.playTick();
      updateHUD();
    } else if (boosterMode === 'SWAP_2') {
      const first = swapFirst;
      if (first.r === r && first.c === c) {
        swapFirst = null;
        boosterMode = 'SWAP_1';
        MP.Sound.playTick();
        updateHUD();
        return;
      }
      ctxApp.pushUndoSnapshot();
      runState.swaps -= 1;
      swapFirst = null;
      boosterMode = 'NONE';
      updateHUD();
      if (!activeMode.applySwap(first.r, first.c, r, c, ctxApp)) {
        runState.swaps += 1;
        updateHUD();
      }
    }
  }

  // ==========================================
  // CANVAS POINTER & KEYBOARD ROUTING
  // ==========================================
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!activeMode || !runState) return;
    e.preventDefault();
    MP.Sound.unlock();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const pos = getCanvasPos(e);
    if (boosterMode !== 'NONE') {
      handleBoosterTap(pos);
      return;
    }
    activeMode.onPointerDown(pos, e, ctxApp);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!activeMode || !runState || boosterMode !== 'NONE') return;
    e.preventDefault();
    activeMode.onPointerMove(getCanvasPos(e), e, ctxApp);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!activeMode || !runState || boosterMode !== 'NONE') return;
    e.preventDefault();
    activeMode.onPointerUp(getCanvasPos(e), e, ctxApp);
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (!activeMode) return;
    activeMode.onPointerCancel(e, ctxApp);
  });

  global.addEventListener('keydown', (e) => {
    if (!activeMode || !runState || gameScreen.classList.contains('hidden')) return;
    if (themesModal.classList.contains('open') || helpModal.classList.contains('open') || confirmModal.classList.contains('open') || gameoverModal.classList.contains('open')) {
      if (e.key === 'Escape') {
        themesModal.classList.remove('open');
        helpModal.classList.remove('open');
        confirmModal.classList.remove('open');
      }
      return;
    }
    activeMode.onKeyDown(e, ctxApp);
  });

  // ==========================================
  // MODALS: THEMES, HELP, CONFIRM, GAME OVER
  // ==========================================
  function renderThemesModal() {
    const meta = MP.Storage.getMeta();
    skinChoicesEl.innerHTML = '';
    for (const skin of MP.Themes.SKINS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-card' + (meta.skin === skin.id ? ' selected' : '');
      btn.innerHTML = `
        <span class="swatch" style="background: ${skin.swatch};"></span>
        <span>
          <div class="name">${skin.name}</div>
          <div class="desc">${skin.desc}</div>
        </span>
      `;
      btn.addEventListener('click', () => {
        MP.Sound.unlock();
        MP.Sound.playTick();
        MP.Storage.setPreference('skin', skin.id);
        applyThemeVisuals();
        renderThemesModal();
        if (!hubScreen.classList.contains('hidden')) renderHub();
      });
      skinChoicesEl.appendChild(btn);
    }

    bgChoicesEl.innerHTML = '';
    for (const bg of MP.Themes.BACKGROUNDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-card' + (meta.bg === bg.id ? ' selected' : '');
      btn.innerHTML = `
        <span class="swatch" style="background: ${bg.swatch};"></span>
        <span>
          <div class="name">${bg.name}</div>
          <div class="desc">${bg.desc}</div>
        </span>
      `;
      btn.addEventListener('click', () => {
        MP.Sound.unlock();
        MP.Sound.playTick();
        MP.Storage.setPreference('bg', bg.id);
        applyThemeVisuals();
        renderThemesModal();
        if (!hubScreen.classList.contains('hidden')) renderHub();
      });
      bgChoicesEl.appendChild(btn);
    }
  }

  function openThemesModal() {
    MP.Sound.unlock();
    renderThemesModal();
    themesModal.classList.add('open');
  }

  function renderHelpModal() {
    helpTabsEl.innerHTML = '';
    for (const modeId of MODE_ORDER) {
      const mode = MP.Modes[modeId];
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'help-tab' + (activeHelpTab === modeId ? ' active' : '');
      tab.textContent = `${mode.icon} ${mode.name}`;
      tab.addEventListener('click', () => {
        activeHelpTab = modeId;
        renderHelpModal();
      });
      helpTabsEl.appendChild(tab);
    }

    const content = HELP_CONTENT[activeHelpTab];
    helpBodyEl.innerHTML = `
      <h3>${content.title}</h3>
      <ul>
        ${content.bullets.map((b) => `<li>${b}</li>`).join('')}
      </ul>
      <p style="margin: 10px 0 0; font-size: 12px; color: var(--muted);">
        <strong>Boosters:</strong> 🔨 Smash destroys 1 tile • ⇄ Swap trades 2 tiles • ↶ Undo reverts 1 move. Earn bonus charges every 2,000 points & at 512+ milestones!
      </p>
    `;
  }

  function openHelpModal() {
    MP.Sound.unlock();
    if (activeMode) activeHelpTab = activeMode.id;
    renderHelpModal();
    helpModal.classList.add('open');
  }

  // Modal close handlers
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close-modal');
      const modal = document.getElementById(id);
      if (modal) modal.classList.remove('open');
    });
  });

  [themesModal, helpModal, confirmModal].forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });

  // Navigation & Action Buttons
  hubThemesBtn.addEventListener('click', openThemesModal);
  gameThemesBtn.addEventListener('click', openThemesModal);
  hubHelpBtn.addEventListener('click', openHelpModal);
  gameHelpBtn.addEventListener('click', openHelpModal);

  function handleSoundToggle() {
    MP.Sound.unlock();
    MP.Sound.toggleMute();
    updateSoundButtons();
  }

  hubSoundBtn.addEventListener('click', handleSoundToggle);
  gameSoundBtn.addEventListener('click', handleSoundToggle);

  homeBtn.addEventListener('click', () => {
    MP.Sound.unlock();
    showHub();
  });

  restartBtn.addEventListener('click', () => {
    MP.Sound.unlock();
    if (!activeMode || !runState) return;
    if (runState.score > 0 && !runState.gameOver) {
      confirmModal.classList.add('open');
    } else {
      openMode(activeMode.id, true);
    }
  });

  confirmRestartBtn.addEventListener('click', () => {
    confirmModal.classList.remove('open');
    if (activeMode) openMode(activeMode.id, true);
  });

  cancelRestartBtn.addEventListener('click', () => {
    confirmModal.classList.remove('open');
  });

  playAgainBtn.addEventListener('click', () => {
    MP.Sound.unlock();
    gameoverModal.classList.remove('open');
    if (activeMode) openMode(activeMode.id, true);
  });

  changeGameBtn.addEventListener('click', () => {
    MP.Sound.unlock();
    gameoverModal.classList.remove('open');
    showHub();
  });

  // ==========================================
  // RESIZE, PERSISTENCE & RENDER LOOP
  // ==========================================
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(boardWrap);
  }
  global.addEventListener('resize', resizeCanvas);
  global.addEventListener('orientationchange', resizeCanvas);

  global.addEventListener('pagehide', persistCurrentRun);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistCurrentRun();
    }
  });

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (activeMode && runState && metrics && !gameScreen.classList.contains('hidden')) {
      ctx.save();
      ctx.scale(metrics.dpr, metrics.dpr);
      ctx.clearRect(0, 0, metrics.width, metrics.height);
      activeMode.render(ctx, dt, ctxApp);
      ctx.restore();
    }

    requestAnimationFrame(frame);
  }

  // ==========================================
  // PWA INSTALL PROMPT & SERVICE WORKER
  // ==========================================
  global.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    hubInstallBtn.classList.remove('hidden');
  });

  hubInstallBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch (_) {}
    deferredInstallPrompt = null;
    hubInstallBtn.classList.add('hidden');
  });

  global.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hubInstallBtn.classList.add('hidden');
  });

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    global.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    });
  }

  // Boot onto the Game Selector Hub
  applyThemeVisuals();
  renderHub();
  requestAnimationFrame(frame);
})(window);
