/* ============================================================
 * 趣棋小将 · UI 工具：轻提示 / 弹窗 / 局势条 / 撒花 / 通用函数
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC = root.FC || {};

  FC.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  FC.fmtDate = ts => {
    const d = new Date(ts);
    const p = n => (n < 10 ? '0' + n : n);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  FC.fmtDur = sec => {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}分${s < 10 ? '0' + s : s}秒` : `${s}秒`;
  };
  FC.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- 轻提示 ---------- */
  FC.toast = (msg, type = 'info', dur = 2200) => {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, dur);
  };

  /* ---------- 弹窗 ---------- */
  FC.modal = ({ title = '', body = '', actions = null, onClose = null, wide = false }) => {
    const rootEl = document.getElementById('modal-root');
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal-card ${wide ? 'modal-wide' : ''}" role="dialog">
        ${title ? `<div class="modal-title">${title}</div>` : ''}
        <div class="modal-body">${body}</div>
        <div class="modal-actions"></div>
      </div>`;
    const act = ov.querySelector('.modal-actions');
    const close = () => {
      ov.classList.remove('show');
      setTimeout(() => ov.remove(), 200);
      onClose && onClose();
    };
    if (actions && actions.length) {
      for (const a of actions) {
        const b = document.createElement('button');
        b.className = 'btn ' + (a.className || 'btn-ghost');
        b.innerHTML = a.label;
        b.addEventListener('click', () => {
          if (a.onClick) a.onClick(close); else close();
        });
        act.appendChild(b);
      }
    } else act.remove();
    ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
    rootEl.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    return { close, el: ov };
  };

  FC.confirm = (msg, okLabel = '确定', cancelLabel = '取消') =>
    new Promise(resolve => {
      FC.modal({
        body: `<div class="confirm-text">${msg}</div>`,
        actions: [
          { label: cancelLabel, className: 'btn-ghost', onClick: close => { resolve(false); close(); } },
          { label: okLabel, className: 'btn-primary', onClick: close => { resolve(true); close(); } }
        ]
      });
    });

  /* ---------- 局势评分条（白方视角） ---------- */
  FC.createEvalBar = () => {
    const el = document.createElement('div');
    el.className = 'eval-bar';
    el.innerHTML = `
      <div class="eval-label-top">白</div>
      <div class="eval-track"><div class="eval-white-fill"></div></div>
      <div class="eval-label-bottom">黑</div>
      <div class="eval-score">0.0</div>`;
    const fill = el.querySelector('.eval-white-fill');
    const scoreEl = el.querySelector('.eval-score');
    return {
      el,
      set(scoreWhite, isMate, mateIn) {
        let pct, text;
        const MATE = 100000;
        if (isMate) {
          const whiteWins = scoreWhite > 0;
          pct = whiteWins ? 100 : 0;
          text = (whiteWins ? '白' : '黑') + `${mateIn ? mateIn : ''}杀`;
        } else {
          const cp = Math.max(-2000, Math.min(2000, scoreWhite || 0));
          pct = 100 * (1 / (1 + Math.exp(-cp / 320)));
          text = (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1);
        }
        fill.style.width = pct + '%';
        scoreEl.textContent = text;
      }
    };
  };

  /* ---------- 撒花 ---------- */
  FC.confetti = host => {
    if (!host) host = document.body;
    const emojis = ['🎉', '⭐', '🎊', '💛', '✨', '🏆'];
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('span');
      s.className = 'confetti';
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDelay = (Math.random() * 0.6) + 's';
      s.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      s.style.fontSize = (16 + Math.random() * 18) + 'px';
      host.appendChild(s);
      setTimeout(() => s.remove(), 3200);
    }
  };

  /* ---------- 其他 ---------- */
  FC.debounce = (fn, ms) => {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  FC.starsHtml = n => '⭐'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

  FC.AVATARS = ['🐣', '🦊', '🐼', '🐯', '🦄', '🐙', '🐧', '🐨', '🐰', '🦁', '🐸', '🦖'];
})(typeof globalThis !== 'undefined' ? globalThis : this);
