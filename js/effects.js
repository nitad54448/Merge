(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});

  const activeTimers = new Set();

  const Timers = {
    after(ms, fn) {
      const id = setTimeout(() => {
        activeTimers.delete(id);
        fn();
      }, ms);
      activeTimers.add(id);
      return id;
    },
    clearAll() {
      for (const id of activeTimers) {
        clearTimeout(id);
      }
      activeTimers.clear();
    }
  };

  class EffectsEngine {
    constructor() {
      this.particles = [];
      this.floatingTexts = [];
      this.scaleAnims = {};
      this.tweenAnims = [];
    }

    reset() {
      this.particles = [];
      this.floatingTexts = [];
      this.scaleAnims = {};
      this.tweenAnims = [];
    }

    spawnBurst(x, y, color, count = 14) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 65 + Math.random() * 145;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 25,
          size: 2.8 + Math.random() * 3.8,
          color: color || '#fbbf24',
          life: 1
        });
      }
    }

    spawnText(x, y, text, color = '#fde047') {
      this.floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1
      });
    }

    popCell(r, c) {
      this.scaleAnims[`${r},${c}`] = 0.01;
    }

    addTween(val, waypoints, speed = 7, onDone = null, sizeScale = 1, tileOpts = null) {
      if (!waypoints || waypoints.length < 2) {
        if (onDone) onDone();
        return;
      }
      const durationMs = Math.max(60, Math.round(1000 / speed));
      const anim = {
        val,
        waypoints,
        progress: 0,
        speed,
        durationMs,
        startTime: performance.now(),
        done: false,
        onDone,
        sizeScale,
        tileOpts
      };
      this.tweenAnims.push(anim);
      Timers.after(durationMs + 50, () => {
        if (anim.done) return;
        anim.done = true;
        const idx = this.tweenAnims.indexOf(anim);
        if (idx !== -1) this.tweenAnims.splice(idx, 1);
        if (anim.onDone) anim.onDone();
      });
    }

    hasActiveTweens() {
      return this.tweenAnims.length > 0;
    }

    getScale(r, c, dt) {
      const key = `${r},${c}`;
      if (this.scaleAnims[key] === undefined) return 1;
      this.scaleAnims[key] += dt * 7.5;
      if (this.scaleAnims[key] >= 1) {
        delete this.scaleAnims[key];
        return 1;
      }
      const t = this.scaleAnims[key];
      return 0.72 + Math.sin(t * Math.PI) * 0.34 + t * 0.28;
    }

    _sampleWaypoints(waypoints, t) {
      const segs = waypoints.length - 1;
      if (segs <= 0) return waypoints[0];
      const clamped = Math.max(0, Math.min(1, t));
      const exact = clamped * segs;
      const idx = Math.min(segs - 1, Math.floor(exact));
      const localT = exact - idx;
      const a = waypoints[idx];
      const b = waypoints[idx + 1];
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT
      };
    }

    updateAndDraw(ctx, dt, cell, skinId, defaultTileOpts = null) {
      const nowMs = performance.now();
      // Tweened moving tiles
      for (let i = this.tweenAnims.length - 1; i >= 0; i--) {
        const anim = this.tweenAnims[i];
        anim.progress = Math.min(1, (nowMs - anim.startTime) / anim.durationMs);
        const eased = anim.waypoints.length === 2
          ? anim.progress * anim.progress
          : 1 - Math.pow(1 - anim.progress, 2);
        const pt = this._sampleWaypoints(anim.waypoints, eased);
        MP.Themes.drawTile(ctx, pt.x, pt.y, cell * anim.sizeScale, anim.val, skinId, anim.tileOpts || defaultTileOpts || {});
        if (anim.progress >= 1) {
          anim.done = true;
          this.tweenAnims.splice(i, 1);
          if (anim.onDone) anim.onDone();
        }
      }

      // Particle bursts
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        p.life -= dt * 2.4;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Floating score & combo popups
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= 36 * dt;
        ft.life -= dt * 1.3;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillText(ft.text, ft.x, ft.y + 1.5);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }
  }

  MP.Timers = Timers;
  MP.Effects = new EffectsEngine();
})(window);
