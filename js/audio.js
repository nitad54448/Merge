(function (global) {
  'use strict';

  const MP = (global.MP = global.MP || {});

  class SoundEngine {
    constructor() {
      this.ctx = null;
    }

    get muted() {
      return MP.Storage ? MP.Storage.getMeta().muted : false;
    }

    get skin() {
      return MP.Storage ? MP.Storage.getMeta().skin : 'wood';
    }

    unlock() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (AudioCtx) {
          try {
            this.ctx = new AudioCtx();
          } catch (_) {
            this.ctx = null;
          }
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggleMute() {
      const next = !this.muted;
      if (MP.Storage) {
        MP.Storage.setPreference('muted', next);
      }
      return next;
    }

    _canPlay() {
      if (this.muted) return false;
      this.unlock();
      return Boolean(this.ctx);
    }

    playTick() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.028);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.032);
    }

    playSlide() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.075);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    }

    playDrop(skinOverride) {
      if (!this._canPlay()) return;
      const skin = skinOverride || this.skin;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (skin === 'iron') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(230, now);
        osc.frequency.exponentialRampToValueAtTime(85, now + 0.08);
        gain.gain.setValueAtTime(0.11, now);
      } else if (skin === 'jewel') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.085);
        gain.gain.setValueAtTime(0.14, now);
      } else {
        // wood / brick warm thock
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(skin === 'wood' ? 165 : 195, now);
        osc.frequency.exponentialRampToValueAtTime(58, now + 0.09);
        gain.gain.setValueAtTime(0.2, now);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    playMerge(value, combo = 1, skinOverride) {
      if (!this._canPlay()) return;
      const skin = skinOverride || this.skin;
      const now = this.ctx.currentTime;
      const tier = Math.min(12, Math.max(1, Math.log2(Math.max(2, value))));
      const semitoneShift = tier + (combo - 1) * 2;
      const baseFreq = 246.94 * Math.pow(2, semitoneShift / 12);

      let harmonics = [
        { mult: 1, type: 'sine', peak: 0.19, dur: 0.23 },
        { mult: 1.5, type: 'triangle', peak: 0.08, dur: 0.2 }
      ];

      if (skin === 'wood') {
        harmonics = [
          { mult: 1, type: 'triangle', peak: 0.21, dur: 0.18 },
          { mult: 2.0, type: 'sine', peak: 0.07, dur: 0.12 }
        ];
      } else if (skin === 'iron') {
        harmonics = [
          { mult: 1, type: 'triangle', peak: 0.17, dur: 0.22 },
          { mult: 2.41, type: 'sine', peak: 0.08, dur: 0.19 }
        ];
      } else if (skin === 'jewel') {
        harmonics = [
          { mult: 1, type: 'sine', peak: 0.16, dur: 0.26 },
          { mult: 2.0, type: 'sine', peak: 0.09, dur: 0.24 },
          { mult: 3.0, type: 'sine', peak: 0.05, dur: 0.2 }
        ];
      } else if (skin === 'brick') {
        harmonics = [
          { mult: 1, type: 'square', peak: 0.07, dur: 0.14 },
          { mult: 1.5, type: 'triangle', peak: 0.12, dur: 0.17 }
        ];
      }

      harmonics.forEach((h) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = h.type;
        osc.frequency.setValueAtTime(baseFreq * h.mult, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * h.mult * 1.015, now + h.dur);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(h.peak, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + h.dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + h.dur + 0.015);
      });
    }

    playPushRow() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.linearRampToValueAtTime(210, now + 0.11);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    playSmash() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    playUndo() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      [420, 320].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
    }

    playInvalid() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);
    }

    playGameOver() {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime;
      const notes = [330, 293.66, 261.63, 196];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const t = now + i * 0.11;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }
  }

  MP.Sound = new SoundEngine();
})(window);
