/* ============================================================
 * 趣棋小将 · Canvas 棋盘组件
 * ------------------------------------------------------------
 *  - Canvas 2D 绘制棋盘与棋子（Unicode 字形 + 描边，柔和配色）
 *  - 统一交互层：pointer 事件同时支持手机触摸与 PC 鼠标
 *  - 两种操作：点击选子→点击落子；按住拖拽
 *  - 高亮：选中格 / 可走点 / 可吃环 / 上一步 / 被将军 / 提示箭头
 *  - 走子滑动动画、升变选择浮层
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FunChess;
  const { WHITE, BLACK, typeOf, colorOf, algebraic, fromAlgebraic } = FC;

  const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };

  class BoardView {
    constructor(container, opts = {}) {
      this.container = container;
      container.classList.add('fc-board-wrap');
      this.opts = Object.assign({
        orientation: 'w',          // 'w' 白方在下 | 'b' 黑方在下
        interactive: true,
        movableColor: null,        // 限定可动的一方；null = 跟随局面行棋方
        showCoords: true,
        highlightLastMove: true,
        onMove: null,              // ({from,to,promotion}) => boolean|Promise 是否接受
        colors: { light: '#F3E2C0', dark: '#C9A36B', frame: '#8A6B4A' }
      }, opts);

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'fc-board-canvas';
      container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.game = null;
      this.pieces = new Map();     // sq(0x88) -> 棋子码
      this.sel = -1;
      this.targets = new Set();
      this.captureTargets = new Set();
      this.lastMove = null;
      this.checkSq = -1;
      this.hintMove = null;
      this.drag = null;
      this.anim = null;
      this.size = 320;
      this.dpr = 1;

      this._promoResolve = null;
      this._buildPromoOverlay();
      this._bindPointer();

      if (root.ResizeObserver) {
        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(container);
      }
      // 窗口 resize 兜底（个别环境 ResizeObserver 在视口突变时不触发）
      this._onWinResize = () => { clearTimeout(this._wrT); this._wrT = setTimeout(() => this.resize(), 80); };
      root.addEventListener('resize', this._onWinResize);
      this.resize();
    }

    /* ---------- 数据同步 ---------- */
    setGame(game, o = {}) {
      this.game = game;
      if (o.orientation) this.opts.orientation = o.orientation;
      if (o.movableColor !== undefined) this.opts.movableColor = o.movableColor;
      this.lastMove = o.lastMove || null;
      this.hintMove = null;
      this.sel = -1;
      this.targets.clear();
      this.captureTargets.clear();
      this._syncCheck();
      this._syncPieces(o.animate ? o.lastMove : null);
      this.render();
    }

    _syncPieces(animateMove) {
      const prev = this.pieces;
      const next = new Map();
      if (this.game) {
        const b = this.game.board;
        for (let sq = 0; sq < 128; sq++) {
          if (sq & 0x88) { sq += 7; continue; }
          if (b[sq]) next.set(sq, b[sq]);
        }
      }
      this.pieces = next;
      this.anim = null;
      if (animateMove) {
        const p = prev.get(animateMove.from);
        if (p) this.anim = { piece: p, from: animateMove.from, to: animateMove.to, start: performance.now(), dur: 200 };
        this._raf();
      }
    }

    _syncCheck() {
      this.checkSq = -1;
      if (this.game && this.game.inCheck()) this.checkSq = this.game.kings[this.game.turn];
    }

    flip() {
      this.opts.orientation = this.opts.orientation === 'w' ? 'b' : 'w';
      this.render();
    }

    setHint(mv) { this.hintMove = mv; this.render(); }

    /* ---------- 尺寸与坐标 ---------- */
    resize() {
      const rect = this.container.getBoundingClientRect();
      const size = Math.max(200, Math.floor(Math.min(rect.width || 320, rect.height || rect.width || 320)));
      this.size = size;
      this.dpr = Math.min(2.5, root.devicePixelRatio || 1);
      this.canvas.width = Math.floor(size * this.dpr);
      this.canvas.height = Math.floor(size * this.dpr);
      this.canvas.style.width = size + 'px';
      this.canvas.style.height = size + 'px';
      this.render();
    }

    /* 0x88 格子 -> 画布中心坐标（跟随视角） */
    _sqToXY(sq) {
      const S = this.size / 8;
      let row = sq >> 4, file = sq & 15;
      if (this.opts.orientation === 'b') { row = 7 - row; file = 7 - file; }
      return { x: file * S + S / 2, y: row * S + S / 2, S };
    }

    /* 指针位置 -> 0x88 格子（不在棋盘内返回 -1） */
    _eventSquare(e) {
      const rect = this.canvas.getBoundingClientRect();
      const S = this.size / 8;
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      let i = Math.floor(y / S), j = Math.floor(x / S);
      if (i < 0 || i > 7 || j < 0 || j > 7) return -1;
      if (this.opts.orientation === 'b') { i = 7 - i; j = 7 - j; }
      return i * 16 + j;
    }

    /* ---------- 交互 ---------- */
    _bindPointer() {
      const c = this.canvas;
      c.style.touchAction = 'none'; // 防止拖拽时页面滚动
      c.addEventListener('pointerdown', e => this._down(e));
      c.addEventListener('pointermove', e => this._move(e));
      c.addEventListener('pointerup', e => this._up(e));
      c.addEventListener('pointercancel', () => { this.drag = null; this.render(); });
    }

    _canMoveColor() {
      if (this.opts.movableColor) return this.opts.movableColor;
      if (!this.game) return null;
      return this.game.turn === WHITE ? 'w' : 'b';
    }

    _down(e) {
      if (!this.opts.interactive || !this.game) return;
      const sq = this._eventSquare(e);
      if (sq < 0) return;
      // 已有选中且点在目标格 -> 落子
      if (this.sel >= 0 && this.targets.has(sq)) { this._attemptMove(this.sel, sq); return; }
      const p = this.pieces.get(sq);
      const color = this._canMoveColor();
      if (p && (!color || colorOf(p) === (color === 'w' ? WHITE : BLACK))) {
        this.sel = sq;
        this._computeTargets(sq);
        this.drag = { sq, piece: p, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, pid: e.pointerId };
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      } else {
        this.sel = -1;
        this.targets.clear();
        this.captureTargets.clear();
      }
      this.render();
    }

    _move(e) {
      if (!this.drag) return;
      if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 6) this.drag.moved = true;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.render();
    }

    _up(e) {
      if (!this.drag) return;
      const d = this.drag;
      this.drag = null;
      const sq = this._eventSquare(e);
      if (d.moved) {
        if (sq >= 0 && sq !== d.sq && this.targets.has(sq)) this._attemptMove(d.sq, sq);
        else { this.sel = -1; this.targets.clear(); this.captureTargets.clear(); }
      }
      // 未拖动 = 点击选子，保持选中状态
      this.render();
    }

    _computeTargets(sq) {
      this.targets.clear();
      this.captureTargets.clear();
      if (!this.game) return;
      const alg = algebraic(sq);
      for (const m of this.game.generateMoves({ square: alg })) {
        this.targets.add(m.to);
        if (m.captured) this.captureTargets.add(m.to);
      }
    }

    _attemptMove(from, to) {
      const finish = (promotion) => {
        const mv = { from: algebraic(from), to: algebraic(to), promotion };
        const keep = () => { this.sel = -1; this.targets.clear(); this.captureTargets.clear(); };
        keep();
        this.render();
        if (this.opts.onMove) {
          Promise.resolve(this.opts.onMove(mv)).catch(err => console.error('onMove 异常', err));
        }
      };
      // 兵到底线 -> 弹出升变选择
      const p = this.pieces.get(from);
      if (p && typeOf(p) === 1) {
        const lastRow = colorOf(p) === WHITE ? 0 : 7;
        if ((to >> 4) === lastRow) {
          this.sel = -1; this.targets.clear(); this.captureTargets.clear();
          this.render();
          this._askPromotion(colorOf(p)).then(t => { if (t) finish(t); });
          return;
        }
      }
      finish(undefined);
    }

    /* ---------- 升变浮层 ---------- */
    _buildPromoOverlay() {
      const ov = document.createElement('div');
      ov.className = 'fc-promo';
      ov.innerHTML = '<div class="fc-promo-card"><div class="fc-promo-title">小兵升级啦！选一个新身份：</div><div class="fc-promo-btns"></div></div>';
      ov.addEventListener('pointerdown', e => { if (e.target === ov) this._resolvePromo(null); });
      this._promoEl = ov;
      this.container.appendChild(ov);
    }

    _askPromotion(color) {
      return new Promise(resolve => {
        this._promoResolve = resolve;
        const btns = this._promoEl.querySelector('.fc-promo-btns');
        btns.innerHTML = '';
        for (const t of [5, 4, 3, 2]) { // 后 车 象 马
          const b = document.createElement('button');
          b.className = 'fc-promo-btn';
          b.textContent = GLYPH[t];
          b.title = { 5: '后', 4: '车', 3: '象', 2: '马' }[t];
          b.addEventListener('click', () => this._resolvePromo(t));
          btns.appendChild(b);
        }
        this._promoEl.classList.add('show');
      });
    }

    _resolvePromo(v) {
      this._promoEl.classList.remove('show');
      if (this._promoResolve) { this._promoResolve(v); this._promoResolve = null; }
    }

    /* ---------- 绘制 ---------- */
    render() {
      const ctx = this.ctx, S = this.size / 8, C = this.opts.colors;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.size, this.size);

      // 底框
      ctx.fillStyle = C.frame;
      ctx.fillRect(0, 0, this.size, this.size);

      const pad = 0;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const row = this.opts.orientation === 'w' ? i : 7 - i;
          const file = this.opts.orientation === 'w' ? j : 7 - j;
          const sq = row * 16 + file;
          const x = pad + j * S, y = pad + i * S;
          ctx.fillStyle = (row + file) % 2 === 0 ? C.light : C.dark;
          ctx.fillRect(x, y, S, S);

          // 上一步高亮
          if (this.opts.highlightLastMove && this.lastMove && (sq === this.lastMove.from || sq === this.lastMove.to)) {
            ctx.fillStyle = 'rgba(255, 196, 64, 0.45)';
            ctx.fillRect(x, y, S, S);
          }
          // 选中格
          if (sq === this.sel) {
            ctx.fillStyle = 'rgba(91, 141, 239, 0.4)';
            ctx.fillRect(x, y, S, S);
          }
          // 被将军
          if (sq === this.checkSq) {
            const g = ctx.createRadialGradient(x + S / 2, y + S / 2, S * 0.1, x + S / 2, y + S / 2, S * 0.55);
            g.addColorStop(0, 'rgba(255, 82, 82, 0.75)');
            g.addColorStop(1, 'rgba(255, 82, 82, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, S, S);
          }
        }
      }

      // 坐标
      if (this.opts.showCoords) {
        ctx.fillStyle = 'rgba(60, 45, 30, 0.55)';
        ctx.font = `600 ${Math.max(9, Math.floor(S * 0.16))}px -apple-system, "PingFang SC", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        for (let i = 0; i < 8; i++) {
          const row = this.opts.orientation === 'w' ? i : 7 - i;
          ctx.fillText(String(8 - row), pad + 3, pad + i * S + 2);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        for (let j = 0; j < 8; j++) {
          const file = this.opts.orientation === 'w' ? j : 7 - j;
          ctx.fillText('abcdefgh'[file], pad + j * S + S - 3, pad + (j + 1) * S - 2);
          ctx.textAlign = 'right';
        }
      }

      // 可走点 / 可吃环
      for (const sq of this.targets) {
        const { x, y } = this._sqToXY(sq);
        if (this.captureTargets.has(sq)) {
          ctx.strokeStyle = 'rgba(80, 120, 60, 0.85)';
          ctx.lineWidth = Math.max(2, S * 0.055);
          ctx.beginPath();
          ctx.arc(x, y, S * 0.42, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(70, 100, 50, 0.4)';
          ctx.beginPath();
          ctx.arc(x, y, S * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 提示箭头
      if (this.hintMove) this._drawArrow(this.hintMove.from, this.hintMove.to);

      // 棋子（拖拽与动画中的子最后绘制）
      const animSq = this.anim ? this.anim.to : -1;
      const dragSq = this.drag && this.drag.moved ? this.drag.sq : -1;
      for (const [sq, p] of this.pieces) {
        if (sq === dragSq || sq === animSq) continue;
        const { x, y } = this._sqToXY(sq);
        this._drawPiece(p, x, y, S);
      }
      if (this.anim) {
        const t = Math.min(1, (performance.now() - this.anim.start) / this.anim.dur);
        const ease = 1 - Math.pow(1 - t, 3);
        const a = this._sqToXY(this.anim.from), b = this._sqToXY(this.anim.to);
        this._drawPiece(this.anim.piece, a.x + (b.x - a.x) * ease, a.y + (b.y - a.y) * ease, S);
        if (t < 1) this._raf(); else this.anim = null;
      }
      if (this.drag && this.drag.moved) {
        const rect = this.canvas.getBoundingClientRect();
        this._drawPiece(this.drag.piece, this.drag.x - rect.left, this.drag.y - rect.top, S * 1.06);
      }
    }

    _drawPiece(piece, x, y, S) {
      const ctx = this.ctx;
      const g = GLYPH[typeOf(piece)];
      const white = colorOf(piece) === WHITE;
      ctx.save();
      ctx.font = `${Math.floor(S * 0.74)}px "Segoe UI Symbol","Apple Symbols","Noto Sans Symbols 2","PingFang SC",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = S * 0.06;
      ctx.shadowOffsetY = S * 0.03;
      ctx.fillStyle = white ? '#FFFFFF' : '#3A342C';
      ctx.fillText(g, x, y + S * 0.02);
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = Math.max(1.2, S * 0.04);
      ctx.strokeStyle = white ? 'rgba(70, 58, 40, 0.85)' : 'rgba(0, 0, 0, 0.55)';
      ctx.strokeText(g, x, y + S * 0.02);
      ctx.restore();
    }

    _drawArrow(from, to) {
      const ctx = this.ctx;
      const a = this._sqToXY(from), b = this._sqToXY(to);
      const S = this.size / 8;
      ctx.save();
      ctx.strokeStyle = 'rgba(46, 125, 220, 0.75)';
      ctx.fillStyle = 'rgba(46, 125, 220, 0.75)';
      ctx.lineWidth = Math.max(4, S * 0.14);
      ctx.lineCap = 'round';
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const head = Math.max(10, S * 0.3);
      const bx = b.x - ux * head * 0.6, by = b.y - uy * head * 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x + ux * S * 0.3, a.y + uy * S * 0.3);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // 箭头三角
      const px = -uy, py = ux;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - ux * head + px * head * 0.5, b.y - uy * head + py * head * 0.5);
      ctx.lineTo(b.x - ux * head - px * head * 0.5, b.y - uy * head - py * head * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    _raf() {
      if (this._rafPending) return;
      this._rafPending = true;
      requestAnimationFrame(() => { this._rafPending = false; this.render(); });
    }

    destroy() {
      if (this._ro) this._ro.disconnect();
      root.removeEventListener('resize', this._onWinResize);
      clearTimeout(this._wrT);
      this._promoEl.remove();
      this.canvas.remove();
    }
  }

  root.FCBoard = { BoardView, GLYPH };
})(typeof globalThis !== 'undefined' ? globalThis : this);
