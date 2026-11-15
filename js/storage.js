(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});

  const MODE_IDS = ['mania_classic', 'merge_mania', 'drag_stack', 'shooter_2048', 'path_drag', 'dice_grid'];
  const META_KEY = 'mp_redcat_meta_v1';
  const RUN_PREFIX = 'mp_redcat_run_v1_';

  function defaultStats() {
    let legacyBest = 0;
    try {
      legacyBest = Number(localStorage.getItem('mm_best') || 0) || 0;
    } catch (_) {}

    return {
      mania_classic: { best: 0, maxTile: 2, played: 0 },
      merge_mania: { best: legacyBest, maxTile: 2, played: 0 },
      drag_stack: { best: 0, maxTile: 2, played: 0 },
      shooter_2048: { best: legacyBest, maxTile: 2, played: 0 },
      path_drag: { best: 0, maxTile: 2, played: 0 },
      dice_grid: { best: 0, maxTile: 2, played: 0 }
    };
  }

  function defaultMeta() {
    let legacyMuted = false;
    try {
      legacyMuted = localStorage.getItem('mm_muted') === '1';
    } catch (_) {}

    return {
      skin: 'wood',
      bg: 'woodland',
      muted: legacyMuted,
      lastMode: null,
      stats: defaultStats()
    };
  }

  let cachedMeta = null;

  function loadMeta() {
    const base = defaultMeta();
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return base;

      if (typeof parsed.skin === 'string') base.skin = parsed.skin;
      if (typeof parsed.bg === 'string') base.bg = parsed.bg;
      if (typeof parsed.muted === 'boolean') base.muted = parsed.muted;
      if (typeof parsed.lastMode === 'string' && MODE_IDS.includes(parsed.lastMode)) {
        base.lastMode = parsed.lastMode;
      }
      if (parsed.stats && typeof parsed.stats === 'object') {
        for (const id of MODE_IDS) {
          const s = parsed.stats[id];
          if (s && typeof s === 'object') {
            base.stats[id] = {
              best: Math.max(base.stats[id].best, Number(s.best) || 0),
              maxTile: Math.max(base.stats[id].maxTile, Number(s.maxTile) || 2),
              played: Math.max(0, Number(s.played) || 0)
            };
          }
        }
      }
    } catch (_) {}
    return base;
  }

  function getMeta() {
    if (!cachedMeta) {
      cachedMeta = loadMeta();
    }
    return cachedMeta;
  }

  function saveMeta() {
    if (!cachedMeta) return;
    try {
      localStorage.setItem(META_KEY, JSON.stringify(cachedMeta));
    } catch (_) {}
  }

  function setPreference(key, value) {
    const meta = getMeta();
    meta[key] = value;
    saveMeta();
  }

  function getModeStats(modeId) {
    const meta = getMeta();
    if (!meta.stats[modeId]) {
      meta.stats[modeId] = { best: 0, maxTile: 2, played: 0 };
    }
    return meta.stats[modeId];
  }

  function recordScore(modeId, score, maxTile) {
    const stats = getModeStats(modeId);
    let isNewBest = false;
    if (score > stats.best) {
      stats.best = score;
      isNewBest = true;
    }
    if (maxTile > stats.maxTile) {
      stats.maxTile = maxTile;
    }
    saveMeta();
    return isNewBest;
  }

  function incrementPlayed(modeId) {
    const stats = getModeStats(modeId);
    stats.played += 1;
    saveMeta();
  }

  function saveRun(modeId, stateObj) {
    if (!modeId || !stateObj) return;
    try {
      localStorage.setItem(RUN_PREFIX + modeId, JSON.stringify(stateObj));
    } catch (_) {}
  }

  function loadRun(modeId) {
    if (!modeId) return null;
    try {
      const raw = localStorage.getItem(RUN_PREFIX + modeId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function clearRun(modeId) {
    if (!modeId) return;
    try {
      localStorage.removeItem(RUN_PREFIX + modeId);
    } catch (_) {}
  }

  function hasActiveRun(modeId) {
    const run = loadRun(modeId);
    return Boolean(run && !run.gameOver);
  }

  MP.Storage = {
    MODE_IDS,
    getMeta,
    saveMeta,
    setPreference,
    getModeStats,
    recordScore,
    incrementPlayed,
    saveRun,
    loadRun,
    clearRun,
    hasActiveRun
  };
})(window);
