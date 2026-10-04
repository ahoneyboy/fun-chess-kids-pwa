/* ============================================================
 * 趣棋小将 · 对战页面
 *  - 人机对战：执白/执黑/随机、4 档难度、可选计时
 *  - 对局功能：悔棋、提示、求和、认输、升变、自动走子
 *  - 新手教学：入门/初级难度 AI 每步用文字(+语音)讲解思路
 *  - 局势评分条、AI 思考动画、每步实时保存防退出丢数据
 *  - 残局专项挑战：终局目标（将杀/升变）+ 步数限制
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC;
  const FunChess = root.FunChess;
  const { WHITE, BLACK, algebraic, typeOf, colorOf, PIECE_NAME_CN } = FunChess;
  const BoardView = root.FCBoard.BoardView;
  const GLYPH = root.FCBoard.GLYPH;

  const DIFF_NAMES = ['入门', '初级', '中级', '高级'];
  const PROMO_CHAR = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };

  let state = null;      // 当前对局状态
  let board = null;
  let evalBar = null;
  let minuteTimer = null;

  /* ---------------- 入口 ---------------- */
  FC.views.play = function (container, arg, params) {
    state = null;
    FC.setPageCleanup(() => {
      if (minuteTimer) { clearInterval(minuteTimer); minuteTimer = null; }
    });

    // 残局挑战直达
    if (params.mode === 'endgame' && params.id) {
      const eg = FC.CONTENT.endgames.find(e => e.id === params.id);
      if (eg) return startEndgame(container, eg);
    }
    renderSetup(container);
  };

  /* ---------------- 开局设置 ---------------- */
  function renderSetup(container) {
    const user = FC.store.getUser();
    const settings = FC.store.getSettings();
    const saved = FC.store.getCurrent();
    const diff = settings.lockedDifficulty || user.difficulty;

    container.innerHTML = `
      <div class="page-title">♟️ 人机对战</div>
      ${saved && saved.config && saved.config.mode !== 'endgame' ? `
      <div class="card resume-card">
        <div>发现一局没下完的棋（${saved.sans.length} 步）</div>
        <div class="row-gap">
          <button class="btn btn-primary" id="btn-resume">继续对局</button>
          <button class="btn btn-ghost" id="btn-discard">放弃它</button>
        </div>
      </div>` : ''}
      <div class="card setup-card">
        <div class="setup-row">
          <div class="setup-label">我执</div>
          <div class="seg" id="seg-color">
            <button data-v="w" class="active">⚪ 白方</button>
            <button data-v="b">⚫ 黑方</button>
            <button data-v="r">🎲 随机</button>
          </div>
        </div>
        <div class="setup-row">
          <div class="setup-label">难度</div>
          <div class="seg" id="seg-diff">
            ${[1, 2, 3, 4].map(d => `<button data-v="${d}" class="${d === diff ? 'active' : ''}">${DIFF_NAMES[d - 1]}</button>`).join('')}
          </div>
          ${settings.adaptive && !settings.lockedDifficulty ? '<div class="setup-note">📈 已开启难度自适应：连赢升档、连输降档</div>' : ''}
          ${settings.lockedDifficulty ? '<div class="setup-note">🔒 家长已锁定难度</div>' : ''}
        </div>
        <div class="setup-row">
          <div class="setup-label">每步计时</div>
          <div class="seg" id="seg-timer">
            <button data-v="0" class="active">不限时</button>
            <button data-v="30">30 秒</button>
            <button data-v="60">60 秒</button>
          </div>
        </div>
        <button class="btn btn-primary btn-block btn-big" id="btn-start">开始对局！</button>
      </div>
      <a class="btn btn-ghost btn-block" href="#/quiz?tab=endgame">🏰 去残局专项挑战</a>
    `;

    const segVal = id => {
      const seg = container.querySelector(id);
      seg.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        FC.sfx.click();
      });
      return () => seg.querySelector('.active').dataset.v;
    };
    const getColor = segVal('#seg-color');
    const getDiff = segVal('#seg-diff');
    const getTimer = segVal('#seg-timer');

    const resumeBtn = container.querySelector('#btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => {
      const cur = FC.store.getCurrent();
      if (cur) startGame(container, Object.assign({}, cur.config, { resume: cur }));
    });
    const discardBtn = container.querySelector('#btn-discard');
    if (discardBtn) discardBtn.addEventListener('click', () => { FC.store.clearCurrent(); renderSetup(container); });

    container.querySelector('#btn-start').addEventListener('click', () => {
      let color = getColor();
      if (color === 'r') color = Math.random() < 0.5 ? 'w' : 'b';
      startGame(container, {
        mode: 'ai', color, difficulty: +getDiff(), timerSec: +getTimer()
      });
    });
  }

  /* ---------------- 残局挑战 ---------------- */
  function startEndgame(container, eg) {
    FC.modal({
      title: eg.icon + ' ' + eg.title,
      body: `<p>${eg.desc}</p><p class="muted">最多 ${eg.maxMoves} 步完成目标，对手难度：${DIFF_NAMES[eg.diff - 1]}</p>`,
      actions: [
        { label: '先不了', className: 'btn-ghost', onClick: close => { close(); FC.navigate('#/quiz'); } },
        { label: '开始挑战！', className: 'btn-primary', onClick: close => { close(); startGame(container, { mode: 'endgame', endgame: eg, color: 'w', difficulty: eg.diff, timerSec: 0, startFen: eg.fen, maxMoves: eg.maxMoves, goal: eg.goal }); } }
      ]
    });
  }

  /* ---------------- 对局核心 ---------------- */
  function startGame(container, config) {
    const game = new FunChess.Chess(config.startFen || FunChess.START_FEN);
    state = {
      config, game,
      sans: [], times: [],
      playerColor: config.color,
      thinking: false, over: false,
      moveStartTs: Date.now(),
      timerId: null, remainSec: config.timerSec || 0,
      lastScoreWhite: 0,
      engineFirst: config.color === 'b' && !(config.resume && config.resume.sans.length % 2 === 1)
    };

    // 续局：重放已有着法
    if (config.resume) {
      for (const san of config.resume.sans) game.move(san);
      state.sans = config.resume.sans.slice();
      state.times = config.resume.times || [];
    }

    container.innerHTML = `
      <div class="play-layout">
        <section class="play-main">
          <div class="play-status card">
            <div class="status-me">${state.playerColor === 'w' ? '⚪ 你执白' : '⚫ 你执黑'} · ${DIFF_NAMES[config.difficulty - 1]}难度</div>
            <div class="status-turn" id="status-turn"></div>
            ${config.timerSec ? '<div class="status-timer" id="status-timer"></div>' : ''}
          </div>
          <div class="board-with-eval">
            <div id="eval-host"></div>
            <div id="board-host" class="board-host"></div>
          </div>
          <div class="play-controls">
            <button class="btn btn-ghost" id="btn-undo">↩️ 悔棋</button>
            <button class="btn btn-ghost" id="btn-hint">💡 提示</button>
            <button class="btn btn-ghost" id="btn-draw">🤝 求和</button>
            <button class="btn btn-danger-ghost" id="btn-resign">🏳️ 认输</button>
          </div>
        </section>
        <aside class="play-aside">
          <div class="card coach-card" id="coach-card">
            <div class="coach-name">🪖 小兵讲棋</div>
            <div class="coach-text" id="coach-text">${config.mode === 'endgame' ? '加油！完成目标就算赢～' : '祝你旗开得胜！先占中心、快出子、早易位。'}</div>
          </div>
          <div class="card movelist-card">
            <div class="card-title">棋谱</div>
            <div class="movelist" id="movelist"><div class="muted-p">对局开始后这里会记录每一步…</div></div>
          </div>
          <div class="card captured-card">
            <div class="card-title">战利品</div>
            <div id="captured-me" class="cap-row"></div>
            <div id="captured-opp" class="cap-row"></div>
          </div>
        </aside>
      </div>
    `;

    const boardHost = container.querySelector('#board-host');
    board = new BoardView(boardHost, {
      orientation: state.playerColor,
      onMove: onPlayerMove
    });
    if (FC.store.getSettings().showEval) {
      evalBar = FC.createEvalBar();
      container.querySelector('#eval-host').appendChild(evalBar.el);
    }

    container.querySelector('#btn-undo').addEventListener('click', undo);
    container.querySelector('#btn-hint').addEventListener('click', hint);
    container.querySelector('#btn-draw').addEventListener('click', offerDraw);
    container.querySelector('#btn-resign').addEventListener('click', resign);

    // 每日时长统计与提醒
    const settings = FC.store.getSettings();
    if (minuteTimer) clearInterval(minuteTimer);
    minuteTimer = setInterval(() => {
      const m = FC.store.addMinutes(1);
      if (settings.dailyLimitMin > 0 && m === settings.dailyLimitMin) {
        FC.toast('⏰ 今天下棋时间到啦，休息一下眼睛吧！（家长提醒）', 'warn', 5000);
      }
    }, 60000);

    updateAll({ animate: false });
    // 赛前小贴士（人机模式）
    if (config.mode === 'ai' && !config.resume) {
      const tips = FC.CONTENT.tips[config.difficulty] || FC.CONTENT.tips[2];
      FC.toast('💡 ' + tips[Math.floor(Math.random() * tips.length)], 'info', 4200);
    }
    // 每步计时
    if (config.timerSec) startTimer();
    // 黑方开局 / 续局轮到电脑
    if (state.game.turnColor() !== state.playerColor) engineTurn();
  }

  /* ---------------- 玩家走子 ---------------- */
  function onPlayerMove(mv) {
    if (!state || state.over || state.thinking) return false;
    if (state.game.turnColor() !== state.playerColor) return false;
    const m = state.game.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    if (!m) return false;
    afterMove(m, true);
    return true;
  }

  function afterMove(m, byPlayer) {
    FC.sfx.capture();
    if (m.san.includes('#')) FC.sfx.check();
    else if (m.san.includes('+')) FC.sfx.check();
    if (m.promotion) FC.sfx.promote();

    if (byPlayer) {
      state.times.push(Math.round((Date.now() - state.moveStartTs) / 1000));
    }
    state.sans.push(m.san);
    state.moveStartTs = Date.now();
    saveCurrent();
    updateAll({ animate: true, lastMove: m });

    if (checkEnd(byPlayer)) return;
    if (state.game.turnColor() !== state.playerColor) engineTurn();
    else if (state.config.timerSec) startTimer();
  }

  /* ---------------- 电脑走子 ---------------- */
  async function engineTurn() {
    if (!state || state.over) return;
    state.thinking = true;
    setStatus('🤔 电脑思考中…', true);
    stopTimer();
    const diffOpts = FunChessEngine.DIFFICULTIES[state.config.difficulty] || FunChessEngine.DIFFICULTIES[2];
    try {
      const r = await FC.engine.request('search', {
        moves: state.sans.slice(),
        options: diffOpts
      });
      if (!state || state.over) return;
      if (!r || !r.move) { finishFromBoard(); return; }
      const mv = { from: algebraic(r.move.from), to: algebraic(r.move.to), promotion: r.move.promotion ? PROMO_CHAR[r.move.promotion] : undefined };
      const m = state.game.move(mv);
      if (!m) throw new Error('引擎着法无法应用');
      state.lastScoreWhite = r.scoreWhite;
      state.thinking = false;
      coachExplain(m);
      afterMove(m, false);
    } catch (err) {
      console.error('引擎出错', err);
      state.thinking = false;
      FC.toast('电脑走子出错了，再试一次', 'warn');
      setStatus('该你走啦');
    }
  }

  /* 新手教学：讲解电脑为什么这么走（入门/初级） */
  function coachExplain(m) {
    const settings = FC.store.getSettings();
    if (state.config.mode !== 'ai' || state.config.difficulty > 2 || !settings.coach) return;
    const cn = PIECE_NAME_CN[typeOf(m.piece)];
    const to = algebraic(m.to);
    let text = '';
    if (m.flags & 4 || m.flags & 8) text = `我做王车易位啦！把王躲进安全的小屋，把车放出来干活～`;
    else if (m.promotion) text = `我的小兵冲到底线，升级成${PIECE_NAME_CN[m.promotion]}啦！小兵也很伟大的！`;
    else if (m.captured) {
      // 是否有保护
      let defended = false;
      const g = state.game;
      for (const r of g.generateMoves()) if (r.captured && r.to === m.to) { defended = true; break; }
      text = defended
        ? `我吃掉了你${algebraic(m.to)}的${PIECE_NAME_CN[typeOf(m.captured)]}，它有保护但值得交换。`
        : `我吃掉${to}的${PIECE_NAME_CN[typeOf(m.captured)]}，因为它没有朋友保护它！走棋前记得看看谁的子没人保护。`;
    } else if (m.san.includes('+')) text = `我将军了！(${m.san}) 记得保护你的王哦。`;
    else if (state.game.fullmove <= 10 && (typeOf(m.piece) === 2 || typeOf(m.piece) === 3) && (m.from >> 4) === (colorOf(m.piece) === WHITE ? 7 : 0)) {
      text = `我把${cn}从家里请出来，站到中心附近更有威力！`;
    } else if ([27, 28, 35, 36].includes(m.to)) { // d5/e5/d4/e4 中心四格
      text = `我走向中心！中心是棋盘上最黄金的地段。`;
    } else {
      text = `我把${cn}走到了更好的位置，等待机会～`;
    }
    const coachText = container_coach();
    if (coachText) coachText.textContent = text;
    FC.tts.speak(text);
  }
  function container_coach() { return document.getElementById('coach-text'); }

  /* ---------------- 界面刷新 ---------------- */
  function setStatus(text, thinking) {
    const el = document.getElementById('status-turn');
    if (el) el.innerHTML = thinking ? `<span class="thinking-dots"><i></i><i></i><i></i> ${text}</span>` : text;
  }

  function updateAll(opts = {}) {
    if (!state || !board) return;
    board.setGame(state.game, {
      lastMove: opts.lastMove ? { from: m_sq(opts.lastMove.from), to: m_sq(opts.lastMove.to) } : null,
      animate: !!opts.animate
    });
    renderMoveList();
    renderCaptured();
    if (!state.over) {
      const yourTurn = state.game.turnColor() === state.playerColor;
      setStatus(yourTurn ? (state.thinking ? '🤔 电脑思考中…' : '👉 该你走啦！') : '🤔 电脑思考中…', !yourTurn || state.thinking);
    }
    refreshEval();
  }
  const m_sq = x => typeof x === 'number' ? x : FunChess.fromAlgebraic(x);

  async function refreshEval() {
    if (!evalBar || !state || state.over) return;
    try {
      const r = await FC.engine.request('eval', { moves: state.sans.slice(), depth: 2, maxTimeMs: 350 });
      if (!state || state.over) return;
      state.lastScoreWhite = r.scoreWhite;
      evalBar.set(r.scoreWhite, r.isMate, r.mateIn);
    } catch (e) { /* 忽略 */ }
  }

  function renderMoveList() {
    const el = document.getElementById('movelist');
    if (!el) return;
    if (!state.sans.length) { el.innerHTML = '<div class="muted-p">对局开始后这里会记录每一步…</div>'; return; }
    let html = '';
    for (let i = 0; i < state.sans.length; i += 2) {
      html += `<div class="ml-row"><span class="ml-no">${i / 2 + 1}.</span><span class="ml-w">${state.sans[i] || ''}</span><span class="ml-b">${state.sans[i + 1] || ''}</span></div>`;
    }
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  function renderCaptured() {
    const me = document.getElementById('captured-me');
    const opp = document.getElementById('captured-opp');
    if (!me || !opp) return;
    const myColor = state.playerColor === 'w' ? WHITE : BLACK;
    const takenByMe = [], takenByOpp = [];
    for (const m of state.game.historyVerbose()) {
      if (!m.captured) continue;
      const capColor = colorOf(m.captured);
      const capGlyph = GLYPH[typeOf(m.captured)];
      if (colorOf(m.piece) === myColor) takenByMe.push(capGlyph); else takenByOpp.push(capGlyph);
    }
    me.innerHTML = `<span class="cap-label">我吃到的：</span>${takenByMe.join(' ') || '<span class="muted">还没有</span>'}`;
    opp.innerHTML = `<span class="cap-label">被吃掉的：</span>${takenByOpp.join(' ') || '<span class="muted">还没有</span>'}`;
  }

  /* ---------------- 计时 ---------------- */
  function startTimer() {
    stopTimer();
    if (!state || !state.config.timerSec || state.over) return;
    state.remainSec = state.config.timerSec;
    state.timerId = setInterval(() => {
      state.remainSec--;
      const el = document.getElementById('status-timer');
      if (el) {
        el.textContent = '⏱ ' + state.remainSec + 's';
        el.classList.toggle('danger', state.remainSec <= 5);
      }
      if (state.remainSec <= 0) {
        stopTimer();
        if (state.game.turnColor() === state.playerColor && !state.over) {
          FC.toast('⏰ 时间到！小助手帮你走了一步', 'warn');
          autoMoveForPlayer();
        }
      }
    }, 1000);
  }
  function stopTimer() { if (state && state.timerId) { clearInterval(state.timerId); state.timerId = null; } }

  async function autoMoveForPlayer() {
    if (!state || state.over || state.thinking) return;
    state.thinking = true;
    try {
      const r = await FC.engine.request('search', { moves: state.sans.slice(), options: FunChessEngine.DIFFICULTIES[state.config.difficulty] });
      if (!state || state.over) return;
      if (r && r.move) {
        const mv = { from: algebraic(r.move.from), to: algebraic(r.move.to), promotion: r.move.promotion ? PROMO_CHAR[r.move.promotion] : undefined };
        const m = state.game.move(mv);
        if (m) { state.thinking = false; afterMove(m, true); return; }
      }
      state.thinking = false;
    } catch (e) { state.thinking = false; }
  }

  /* ---------------- 对局功能按钮 ---------------- */
  function undo() {
    if (!state || state.over || state.thinking) return;
    const g = state.game;
    if (!g.history.length) return;
    // 撤到玩家上一次走子之前
    g.undo(); state.sans.pop();
    if (g.history.length && g.turnColor() !== state.playerColor) { g.undo(); state.sans.pop(); }
    if (g.turnColor() !== state.playerColor) { // 保险：轮到电脑就再撤一步
      if (g.history.length) { g.undo(); state.sans.pop(); }
    }
    state.times.pop();
    saveCurrent();
    FC.sfx.click();
    updateAll({ animate: false });
  }

  async function hint() {
    if (!state || state.over || state.thinking) return;
    if (!FC.store.getSettings().hints) { FC.toast('提示功能已被关闭', 'warn'); return; }
    if (state.game.turnColor() !== state.playerColor) return;
    FC.toast('💡 想一想…', 'info', 1200);
    try {
      const r = await FC.engine.request('search', { moves: state.sans.slice(), options: { depth: 3, maxTimeMs: 1500, randomness: 0, blunderChance: 0, useQuiescence: true } });
      if (!state || state.over || !r || !r.move) return;
      board.setHint({ from: r.move.from, to: r.move.to });
      const san = state.game.sanOfMove(r.move);
      FC.toast('💡 建议：' + (san || ''), 'info', 3000);
    } catch (e) { /* 忽略 */ }
  }

  function offerDraw() {
    if (!state || state.over || state.thinking) return;
    // 电脑在不利或均势时接受和棋
    const aiColor = state.playerColor === 'w' ? BLACK : WHITE;
    const aiScore = aiColor === WHITE ? state.lastScoreWhite : -state.lastScoreWhite;
    if (aiScore <= 40) {
      finish('draw', '协议和棋');
    } else {
      FC.toast('电脑摇摇头：「我形势不错，不接受和棋！」', 'info');
    }
  }

  async function resign() {
    if (!state || state.over) return;
    const ok = await FC.confirm('确定要认输吗？<br>再试一试也许还有机会哦！💪', '坚持认输', '继续下');
    if (ok) finish('loss', '认输');
  }

  /* ---------------- 终局判定 ---------------- */
  function checkEnd(byPlayer) {
    if (!state) return false;
    const res = state.game.gameResult();
    if (res) {
      if (res.draw) finish('draw', res.text);
      else {
        const winnerColor = res.winner === WHITE ? 'w' : 'b';
        finish(winnerColor === state.playerColor ? 'win' : 'loss', res.text);
      }
      return true;
    }
    // 残局挑战：升变目标 & 步数限制
    if (state.config.mode === 'endgame') {
      const eg = state.config.endgame;
      const plies = state.sans.length;
      if (state.config.goal === 'promote') {
        const promoted = state.game.historyVerbose().some(m => m.promotion && colorOf(m.piece) === (state.playerColor === 'w' ? WHITE : BLACK));
        if (promoted) { finish('win', '小兵成功升变！'); return true; }
      }
      const playerMoves = Math.ceil(plies / 2);
      if (playerMoves >= state.config.maxMoves) { finish('loss', eg.goal === 'promote' ? `${eg.maxMoves} 步内没有完成升变` : `${eg.maxMoves} 步内没有将杀`); return true; }
    }
    return false;
  }

  /* ---------------- 结算 ---------------- */
  function finish(playerResult, reasonText) {
    if (!state || state.over) return;
    state.over = true;
    stopTimer();
    FC.store.clearCurrent();

    const g = state.game;
    const sans = state.sans.slice();
    const isEndgame = state.config.mode === 'endgame';

    // 保存对局记录
    const rec = {
      id: FC.uid(),
      startTime: Date.now() - (state.times.reduce((a, b) => a + b, 0) + sans.length * 3) * 1000,
      endTime: Date.now(),
      mode: state.config.mode,
      difficulty: state.config.difficulty,
      difficultyName: DIFF_NAMES[state.config.difficulty - 1],
      color: state.playerColor,
      playerResult, resultText: reasonText,
      endgameId: isEndgame ? state.config.endgame.id : null,
      moves: sans.map((san, i) => ({ san, timeSpent: i % 2 === 0 ? (state.times[Math.floor(i / 2)] || 0) : 0 })),
      pgn: g.pgn({ White: state.playerColor === 'w' ? FC.store.getUser().nickname : ('电脑(' + DIFF_NAMES[state.config.difficulty - 1] + ')'), Black: state.playerColor === 'b' ? FC.store.getUser().nickname : ('电脑(' + DIFF_NAMES[state.config.difficulty - 1] + ')'), Result: playerResult }),
      reviewed: false
    };
    if (isEndgame) rec.playerResult = playerResult; // 残局也保存
    FC.store.addGame(rec);

    // 结算（残局挑战不计入难度自适应，但计入成就）
    let adjusted = null;
    if (!isEndgame) adjusted = FC.store.recordResult(playerResult);

    // 徽章
    const sansStr = sans.join(' ');
    if (!isEndgame) {
      FC.store.awardBadge('first_game');
      if (FC.store.getGames().length >= 10) FC.store.awardBadge('vet10');
      if (playerResult === 'win') { FC.store.awardBadge('first_win'); if (FC.store.getUser().streak >= 3) FC.store.awardBadge('win3'); }
      if (/=[QRBN]/.test(sansStr)) FC.store.awardBadge('promoted');
      if (/O-O/.test(sansStr)) FC.store.awardBadge('castler');
    } else {
      if (playerResult === 'win') {
        const u = FC.store.patchUser(x => { x.endgameDone[state.config.endgame.id] = { stars: 3, at: Date.now() }; return x; });
        FC.store.addStars(3);
        if (Object.keys(u.endgameDone).length >= 3) FC.store.awardBadge('endmaster');
      }
    }

    // 结算弹窗
    const stars = playerResult === 'win' ? 3 : playerResult === 'draw' ? 2 : 1;
    const emoji = playerResult === 'win' ? '🏆' : playerResult === 'draw' ? '🤝' : '💪';
    const title = playerResult === 'win' ? (isEndgame ? '挑战成功！' : '你赢啦！') : playerResult === 'draw' ? '平局！' : isEndgame ? '差一点点！' : '这局输了';
    const msg = playerResult === 'win' ? '恭喜你！你的棋艺又进步了！' : playerResult === 'draw' ? '势均力敌，下盘再分高下！' : '输棋不丢人，复盘一下看看哪里可以更好！';
    if (playerResult === 'win') { FC.sfx.win(); FC.confetti(); } else if (playerResult === 'draw') FC.sfx.draw(); else FC.sfx.lose();

    const actions = [];
    if (!isEndgame) {
      actions.push({ label: '🔍 复盘这局', className: 'btn-primary', onClick: close => { close(); FC.navigate('#/review/' + rec.id); } });
    } else {
      actions.push({ label: '🔁 再挑战一次', className: 'btn-primary', onClick: close => { close(); FC.navigate('#/quiz?tab=endgame'); setTimeout(() => FC.navigate('#/play?mode=endgame&id=' + state.config.endgame.id), 0); } });
    }
    actions.push({ label: '再来一局', className: 'btn-ghost', onClick: close => { close(); FC.navigate('#/play'); location.reload(); } });
    actions.push({ label: '回首页', className: 'btn-ghost', onClick: close => { close(); FC.navigate('#/'); } });

    FC.modal({
      title: `${emoji} ${title}`,
      body: `
        <p>${msg}</p>
        <p class="muted">原因：${reasonText} · 共 ${Math.ceil(sans.length / 2)} 回合</p>
        ${playerResult === 'win' ? '<p class="stars-big">' + FC.starsHtml(3) + '</p>' : ''}
        ${adjusted && adjusted.adjusted ? `<p class="muted">📈 难度已自动调整为「${DIFF_NAMES[adjusted.difficulty - 1]}」</p>` : ''}
      `,
      actions
    });
    setStatus('对局结束：' + reasonText);
  }

  /* ---------------- 续局快照 ---------------- */
  function saveCurrent() {
    if (!state || state.over) return;
    FC.store.saveCurrent({
      config: { mode: state.config.mode, color: state.playerColor, difficulty: state.config.difficulty, timerSec: state.config.timerSec, startFen: state.config.startFen, maxMoves: state.config.maxMoves, goal: state.config.goal, endgame: state.config.endgame ? { id: state.config.endgame.id } : undefined },
      sans: state.sans.slice(),
      times: state.times.slice(),
      startedAt: Date.now()
    });
  }

  function finishFromBoard() { const res = state.game.gameResult(); if (res) finish(res.draw ? 'draw' : 'win', res.text); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
