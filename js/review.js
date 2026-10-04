/* ============================================================
 * 趣棋小将 · 智能复盘页面
 *  - 首次进入自动逐着分析（Worker 后台 + 进度条）
 *  - 棋谱树/列表导航、评分变化曲线、逐着点评面板
 *  - 试走分支：在任何局面试自己的着法，电脑应一手并给出新评分
 *  - 整局总结：分阶段评价 + 3~5 条优化步骤 + 关联练习
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC;
  const FunChess = root.FunChess;
  const { WHITE, BLACK, typeOf, colorOf, PIECE_NAME_CN } = FunChess;
  const BoardView = root.FCBoard.BoardView;

  const LEVEL_CN = { none: '', minor: '小失误', mistake: '失误', blunder: '大失误' };
  const TYPE_CN = {
    material: '送子', missedCapture: '漏吃', missedMate: '错失将杀',
    tactic: '漏看战术', opening: '开局违例', endgame: '残局失误'
  };
  const PHASE_CN = { opening: '开局', middlegame: '中局', endgame: '残局' };

  FC.views.review = async function (container, gameId) {
    const rec = FC.store.getGame(gameId);
    if (!rec) { container.innerHTML = '<div class="card">找不到这局棋</div>'; return; }

    container.innerHTML = `
      <a class="back-link" href="#/history">← 返回对局记录</a>
      <div class="page-title">🔍 智能复盘</div>
      <div class="card">
        <div class="review-meta">
          <span>${FC.fmtDate(rec.startTime)}</span>
          <span>${rec.difficultyName || ''}难度 · ${rec.color === 'w' ? '执白' : '执黑'}</span>
          <span class="chip ${rec.playerResult === 'win' ? 'chip-green' : rec.playerResult === 'draw' ? 'chip-soft' : 'chip-red'}">${rec.playerResult === 'win' ? '胜利' : rec.playerResult === 'draw' ? '和棋' : '失利'}</span>
        </div>
        <div id="review-progress" class="review-progress">
          <div class="progress"><div class="progress-fill" id="rp-fill" style="width:0%"></div></div>
          <p class="muted-p" id="rp-text">小兵正在逐着分析，请稍等…</p>
        </div>
      </div>
      <div id="review-main" style="display:none"></div>
    `;

    /* 需要分析则先分析 */
    let review = rec.review;
    if (!review || !review.plies) {
      try {
        review = await FC.engine.request('analyze-game', {
          moves: rec.moves.map(m => m.san),
          depth: 2,             // 深度2+静态搜索：兼顾速度与稳定（儿童教学足够）
          maxTimePerMove: 500
        }, p => {
          const fill = container.querySelector('#rp-fill');
          const text = container.querySelector('#rp-text');
          if (fill) fill.style.width = Math.round(p.done / p.total * 100) + '%';
          if (text) text.textContent = `小兵正在逐着分析… ${p.done}/${p.total}`;
        });
        FC.store.updateGame(rec.id, { review });
        if (FC.store.getUser().badges.indexOf('detective') < 0) FC.store.awardBadge('detective');
      } catch (err) {
        console.error('复盘分析失败', err);
        container.querySelector('#rp-text').textContent = '分析出错了：' + err.message;
        return;
      }
    }
    renderReview(container, rec, review);
  };

  function renderReview(container, rec, review) {
    const plies = review.plies;
    const summary = review.summary;
    container.querySelector('#review-progress').style.display = 'none';
    const main = container.querySelector('#review-main');
    main.style.display = '';

    let curPly = -1;              // -1 = 初始局面；i = 看 i 步之后的局面
    let branch = null;            // {game, fenStartPly} 试走分支

    main.innerHTML = `
      <div class="review-layout">
        <section class="review-main-col">
          <div class="board-with-eval">
            <div id="rev-eval"></div>
            <div id="rev-board" class="board-host"></div>
          </div>
          <div class="review-controls">
            <button class="btn btn-ghost btn-small" id="rv-first">⏮</button>
            <button class="btn btn-ghost btn-small" id="rv-prev">◀</button>
            <button class="btn btn-ghost btn-small" id="rv-next">▶</button>
            <button class="btn btn-ghost btn-small" id="rv-last">⏭</button>
            <button class="btn btn-ghost btn-small" id="rv-flip">🔄 翻转</button>
            <button class="btn btn-ghost btn-small" id="rv-branch-quit" style="display:none">↩️ 回到主线</button>
          </div>
          <canvas id="rv-graph" class="eval-graph" height="72"></canvas>
        </section>
        <aside class="review-aside">
          <div class="tabs" id="rv-tabs">
            <button data-t="moves" class="active">逐着点评</button>
            <button data-t="summary">整局总结</button>
          </div>
          <div id="rv-tab-moves">
            <div class="movelist movelist-review" id="rv-movelist"></div>
            <div class="card ply-card" id="rv-ply"></div>
          </div>
          <div id="rv-tab-summary" style="display:none"></div>
        </aside>
      </div>
    `;

    const gameAt = ply => {
      const g = new FunChess.Chess(review.startFen);
      for (let i = 0; i < ply; i++) g.move(plies[i].san);
      return g;
    };

    const board = new BoardView(main.querySelector('#rev-board'), {
      orientation: rec.color === 'w' ? 'w' : 'b',
      movableColor: null, // 由导航逻辑动态设定
      onMove: mv => onBranchMove(mv)
    });
    let evalBar = FC.createEvalBar();
    main.querySelector('#rev-eval').appendChild(evalBar.el);

    function setEval(scoreWhite, isMate, mateIn) { evalBar.set(scoreWhite, isMate, mateIn); }

    /* ---------- 局面导航 ---------- */
    function goto(ply, animate) {
      if (branch) { quitBranch(); }
      curPly = Math.max(-1, Math.min(plies.length - 1, ply));
      const g = gameAt(curPly + 1);
      const lastM = curPly >= 0 ? g.historyVerbose()[g.history.length - 1] : null;
      const sideToMove = g.turnColor();
      board.setGame(g, { lastMove: lastM, animate: !!animate, movableColor: sideToMove }); // 允许试走
      const info = curPly >= 0 ? plies[curPly] : { evalAfter: plies[0] ? plies[0].evalBefore : 0, isMateFlag: false };
      setEval(curPly >= 0 ? info.evalAfter : (plies[0] ? plies[0].evalBefore : 0));
      renderPlyPanel();
      highlightMoveList();
      drawGraph();
    }

    function renderPlyPanel() {
      const el = main.querySelector('#rv-ply');
      if (curPly < 0) {
        el.innerHTML = '<p class="muted-p">这是初始局面。用 ◀▶ 浏览每一步，也可以直接在棋盘上试走你的想法！</p>';
        return;
      }
      const p = plies[curPly];
      const sideCn = p.side === 'w' ? '白方' : '黑方';
      const who = (p.side === rec.color) ? '你' : '电脑';
      let tags = '';
      if (p.level !== 'none') {
        tags = `<span class="chip chip-${p.level === 'blunder' ? 'red' : p.level === 'mistake' ? 'orange' : 'yellow'}">${LEVEL_CN[p.level]}</span>`;
        if (p.type !== 'none') tags += ` <span class="chip chip-soft">${TYPE_CN[p.type] || ''}</span>`;
      } else {
        tags = '<span class="chip chip-green">好棋/正常</span>';
      }
      el.innerHTML = `
        <div class="ply-head">
          <b>第 ${p.moveNo} 回合 · ${who}(${sideCn})</b> ${tags}
        </div>
        <div class="ply-compare">
          <div class="ply-cell"><div class="ply-k">实际走法</div><div class="ply-v ${p.level !== 'none' ? 'bad' : 'good'}">${p.san}</div></div>
          <div class="ply-cell"><div class="ply-k">引擎推荐</div><div class="ply-v best">${p.bestSan || '—'}</div></div>
          <div class="ply-cell"><div class="ply-k">分差</div><div class="ply-v ${p.cpLoss >= 80 ? 'bad' : ''}">${p.cpLoss ? '-' + (p.cpLoss / 100).toFixed(1) : '0.0'}</div></div>
        </div>
        ${p.comment ? `<p class="ply-comment">${p.comment}</p>` : ''}
        <p class="muted-p">此时局面：${PHASE_CN[p.phase] || ''} · 评分 ${fmtEval(p.evalAfter)}</p>
      `;
    }

    const fmtEval = v => {
      if (Math.abs(v) > 90000) return (v > 0 ? '白' : '黑') + '方即将获胜';
      return (v >= 0 ? '+' : '') + (v / 100).toFixed(1);
    };

    function renderMoveList() {
      const el = main.querySelector('#rv-movelist');
      let html = '';
      for (let i = 0; i < plies.length; i += 2) {
        const w = plies[i], b = plies[i + 1];
        html += `<div class="ml-row">
          <span class="ml-no">${i / 2 + 1}.</span>
          <span class="ml-w ml-item ${cls(w)}" data-ply="${i}">${w.san}${mark(w)}</span>
          <span class="ml-b ml-item ${cls(b)}" data-ply="${i + 1}">${b ? b.san + mark(b) : ''}</span>
        </div>`;
      }
      el.innerHTML = html;
      el.querySelectorAll('.ml-item').forEach(item => {
        item.addEventListener('click', () => goto(+item.dataset.ply, false));
      });
    }
    /* 失误标记（b 为 undefined = 该行只有白方步，例如白方走出终局将杀） */
    const cls = p => !p ? '' : p.level === 'blunder' ? 'ml-blunder' : p.level === 'mistake' ? 'ml-mistake' : p.level === 'minor' ? 'ml-minor' : '';
    const mark = p => !p ? '' : p.level === 'blunder' ? '??' : p.level === 'mistake' ? '?' : p.level === 'minor' ? '?!' : '';
    function highlightMoveList() {
      main.querySelectorAll('.ml-item').forEach(item => item.classList.toggle('ml-cur', +item.dataset.ply === curPly));
      const cur = main.querySelector(`.ml-item[data-ply="${curPly}"]`);
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    /* ---------- 评分曲线 ---------- */
    function drawGraph() {
      const cv = main.querySelector('#rv-graph');
      const dpr = root.devicePixelRatio || 1;
      const w = cv.clientWidth || 300;
      cv.width = w * dpr; cv.height = 72 * dpr;
      cv.style.height = '72px';
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, 72);
      // 背景
      ctx.fillStyle = '#FFF4E0';
      ctx.fillRect(0, 0, w, 72);
      const n = plies.length;
      if (!n) return;
      const barW = w / n;
      for (let i = 0; i < n; i++) {
        const p = plies[i];
        let v = p.evalAfter;
        let frac = 0.5;
        if (Math.abs(v) > 90000) frac = v > 0 ? 1 : 0;
        else frac = 1 / (1 + Math.exp(-(v || 0) / 320));
        const h = frac * 72;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(i * barW + 0.5, 0, barW - 1, 72);
        ctx.fillStyle = v >= 0 ? '#8FB8F2' : '#3A342C';
        if (v >= 0) ctx.fillRect(i * barW + 0.5, 72 - h, barW - 1, h);
        else ctx.fillRect(i * barW + 0.5, 0, barW - 1, 72 - h);
        // 失误标记
        if (p.level === 'blunder' || p.level === 'mistake') {
          ctx.fillStyle = p.level === 'blunder' ? '#FF5252' : '#FFA726';
          ctx.beginPath();
          ctx.arc(i * barW + barW / 2, 6, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 当前位置指示
      if (curPly >= 0) {
        ctx.fillStyle = '#5B8DEF';
        ctx.fillRect(curPly * barW, 70, barW, 2);
      }
    }
    main.querySelector('#rv-graph').addEventListener('click', e => {
      const rect = e.target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ply = Math.floor(x / (rect.width / Math.max(1, plies.length)));
      goto(ply, false);
    });

    /* ---------- 试走分支 ---------- */
    async function onBranchMove(mv) {
      // 主线上走的正是主线着法 → 直接前进
      if (!branch && curPly + 1 < plies.length) {
        const nextSan = norm(plies[curPly + 1].san);
        const g = gameAt(curPly + 1);
        const m = g.move(mv);
        if (m && norm(m.san) === nextSan) { goto(curPly + 1, true); return; }
      }
      // 分支试走
      if (!branch) branch = { basePly: curPly, game: gameAt(curPly + 1) };
      const m = branch.game.move(mv);
      if (!m) return;
      board.setGame(branch.game, { lastMove: m, animate: true });
      FC.sfx.move();
      main.querySelector('#rv-branch-quit').style.display = '';
      const panel = main.querySelector('#rv-ply');
      panel.innerHTML = `<p>🧪 <b>试走分支</b>：你走了 ${m.san}，电脑思考中…</p>`;
      try {
        // 电脑应一手 + 新评分
        const sansBase = plies.slice(0, branch.basePly + 1).map(p => p.san);
        const r = await FC.engine.request('search', { fen: review.startFen, moves: [...sansBase, m.san], options: { depth: 2, maxTimeMs: 900, randomness: 0, blunderChance: 0, useQuiescence: true } });
        let replySan = null;
        if (r && r.move) {
          const replyMv = { from: r.move.from, to: r.move.to, promotion: r.move.promotion };
          const rm = branch.game.sanOfMove(r.move);
          replySan = rm;
          branch.game.move(r.move);
          board.setGame(branch.game, { lastMove: r.move, animate: true });
        }
        const ev = await FC.engine.request('eval', { fen: review.startFen, moves: [...sansBase, m.san, ...(replySan ? [replySan] : [])], depth: 2, maxTimeMs: 500 });
        const baseInfo = curPly >= 0 ? plies[curPly].evalAfter : (plies[0] ? plies[0].evalBefore : 0);
        const diff = (ev.scoreWhite - baseInfo) * (rec.color === 'w' ? 1 : -1);
        panel.innerHTML = `
          <p>🧪 <b>试走分支</b>：你走 ${m.san}${replySan ? '，电脑应 ' + replySan : ''}</p>
          <p>新局面评分：${fmtEval(ev.scoreWhite)}（主线：${fmtEval(baseInfo)}）</p>
          <p class="${diff >= 0 ? 'fb-ok' : 'fb-no'}">${diff >= 0 ? '📈 这个分支比主线好 ' + (diff / 100).toFixed(1) : '📉 这个分支比主线差 ' + (-diff / 100).toFixed(1)} 分</p>
          <p class="muted-p">可以继续在棋盘上往下试，或点「回到主线」。</p>`;
      } catch (e) {
        panel.innerHTML = '<p class="muted-p">分支分析失败，可以继续手动试走。</p>';
      }
    }

    function quitBranch() {
      branch = null;
      main.querySelector('#rv-branch-quit').style.display = 'none';
      goto(curPly, false);
    }
    main.querySelector('#rv-branch-quit').addEventListener('click', quitBranch);

    /* ---------- 总结页 ---------- */
    function renderSummary() {
      const el = main.querySelector('#rv-tab-summary');
      const s = summary;
      const phaseRow = k => {
        const ps = s.phaseStat[k];
        if (!ps || !ps.count) return '';
        return `<div class="sum-phase">
          <div class="sum-phase-head"><b>${PHASE_CN[k]}</b><span class="muted">${ps.count} 步 · 准确率 ${ps.accuracy}%</span></div>
          <p>${ps.comment}</p>
        </div>`;
      };
      el.innerHTML = `
        <div class="card sum-card">
          <div class="sum-head">
            <div class="sum-stars">${FC.starsHtml(s.stars)}</div>
            <div><b>准确率 ${s.accuracy}%</b><p>${s.gradeText}</p></div>
          </div>
          <div class="sum-stats">
            <span class="chip chip-yellow">小失误 ×${s.mistakeCount.minor}</span>
            <span class="chip chip-orange">失误 ×${s.mistakeCount.mistake}</span>
            <span class="chip chip-red">大失误 ×${s.mistakeCount.blunder}</span>
          </div>
        </div>
        ${phaseRow('opening')}${phaseRow('middlegame')}${phaseRow('endgame')}
        <div class="card sum-card">
          <div class="card-title">🚀 优化步骤（下一步练什么）</div>
          ${s.improvements.length ? s.improvements.map((it, i) => `
            <div class="improve-item">
              <div class="improve-no">${i + 1}</div>
              <div class="improve-body">
                <div class="improve-head">第 ${it.moveNo} 回合：你走 ${it.played}，更优 ${it.best} <span class="chip chip-soft">${PHASE_CN[it.phase]}</span></div>
                <p>${it.reason}</p>
                <a class="btn btn-ghost btn-small" href="${it.drill.link}">🎯 ${it.drill.label}</a>
              </div>
            </div>`).join('') : '<p class="muted-p">这盘棋没有明显失误，太棒了！挑战更高难度吧！</p>'}
        </div>`;
    }

    /* ---------- 事件 ---------- */
    main.querySelector('#rv-first').addEventListener('click', () => goto(-1, false));
    main.querySelector('#rv-prev').addEventListener('click', () => goto(curPly - 1, false));
    main.querySelector('#rv-next').addEventListener('click', () => goto(curPly + 1, true));
    main.querySelector('#rv-last').addEventListener('click', () => goto(plies.length - 1, false));
    main.querySelector('#rv-flip').addEventListener('click', () => board.flip());
    main.querySelector('#rv-tabs').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      main.querySelectorAll('#rv-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const isSum = b.dataset.t === 'summary';
      main.querySelector('#rv-tab-moves').style.display = isSum ? 'none' : '';
      main.querySelector('#rv-tab-summary').style.display = isSum ? '' : 'none';
      if (isSum) renderSummary();
    });
    root.addEventListener('resize', onResize);
    function onResize() { drawGraph(); }

    renderMoveList();
    renderSummary();
    FC.setPageCleanup(() => root.removeEventListener('resize', onResize));
    goto(-1, false);
  }

  const norm = s => String(s).replace(/[+#]/g, '');
})(typeof globalThis !== 'undefined' ? globalThis : this);
