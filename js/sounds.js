/* ============================================================
 * 趣棋小将 · 音效与语音（无外部资源，WebAudio 现场合成）
 *  - 移动/吃子/将军/升变/胜利/失败/答对/答错/星星
 *  - TTS：用系统语音把"小兵讲棋"读出来（可开关）
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC = root.FC || {};

  let ctx = null;
  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, delay) {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.15, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  const enabled = () => !FC.store || FC.store.getSettings().sound;

  FC.sfx = {
    move() { if (enabled()) tone(340, 0.09, 'triangle', 0.14); },
    capture() { if (enabled()) { tone(190, 0.12, 'square', 0.1); tone(140, 0.16, 'triangle', 0.12, 0.04); } },
    check() { if (enabled()) { tone(660, 0.1, 'sine', 0.16); tone(880, 0.14, 'sine', 0.14, 0.09); } },
    promote() { if (enabled()) { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.14, i * 0.08)); } },
    win() { if (enabled()) [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.13)); },
    lose() { if (enabled()) [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.14, i * 0.18)); },
    draw() { if (enabled()) [440, 440].forEach((f, i) => tone(f, 0.18, 'sine', 0.12, i * 0.2)); },
    correct() { if (enabled()) { tone(659, 0.12, 'sine', 0.16); tone(880, 0.18, 'sine', 0.16, 0.1); } },
    wrong() { if (enabled()) { tone(220, 0.2, 'sawtooth', 0.08); tone(180, 0.24, 'sawtooth', 0.07, 0.08); } },
    star() { if (enabled()) tone(1319, 0.18, 'sine', 0.14); },
    click() { if (enabled()) tone(520, 0.05, 'sine', 0.08); }
  };

  /* ---------- 语音讲解（TTS） ---------- */
  FC.tts = {
    speak(text) {
      try {
        if (!FC.store || !FC.store.getSettings().tts || !root.speechSynthesis) return;
        root.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 1.05;
        u.pitch = 1.15;
        root.speechSynthesis.speak(u);
      } catch (e) { /* 静默失败 */ }
    },
    stop() { try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (e) { /* 忽略 */ } }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
