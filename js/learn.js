/* ============================================================
 * 趣棋小将 · 学习模块
 *  - 课程列表 / 课程详情（图文 + 互动演示播放器 + 动手小任务）
 *  - 战术测验：逐题作答、提示、看答案、星星奖励
 *  - 残局挑战列表（跳转到对战页）
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC;
  const FunChess = root.FunChess;
  const BoardView = root.FCBoard.BoardView;

  const norm = s => String(s).replace(/[+#]/g, '');

  /* ---------------- 课程列表 ---------------- */
  FC.views.learn = function (container) {
    const user = FC.store.getUser();
    container.innerHTML = `
      <div class="page-title">📖 学习课程</div>
      <div class="progress-card card">
        <span>已学 ${user.lessonsDone.length}/${FC.CONTENT.lessons.length} 课</span>
        <div class="progress"><div class="progress-fill" style="width:${Math.round(user.lessonsDone.length / FC.CONTENT.lessons.length * 100)}%"></div></div>
        <a class="btn btn-ghost btn-small" href="#/quiz">🧩 去战术闯关</a>
      </div>
      <div class="lesson-grid">
        ${FC.CONTENT.lessons.map(l => {
          const done = user.lessonsDone.includes(l.id);
          return `<a class="lesson-card card ${done ? 'done' : ''}" href="#/lesson/${l.id}">
            <div class="lesson-icon">${l.icon}</div>
            <div class="lesson-body">
              <div class="lesson-title">${l.title} ${done ? '<span class="done-check">✅</span>' : ''}</div>
              <div class="lesson-sum">${l.summary}</div>
              <div class="lesson-stars">${done ? FC.starsHtml(l.stars) : FC.starsHtml(0)}</div>
            </div>
          </a>`;
        }).join('')}
      </div>`;
  };

  /* ---------------- 课程详情 ---------------- */
  FC.views.lesson = function (container, lessonId) {
    const lesson = FC.CONTENT.lessons.find(l => l.id === lessonId);
    if (!lesson) { container.innerHTML = '<div class="card">课程不存在</div>'; return; }
    const user = FC.store.getUser();
    const done = user.lessonsDone.includes(lesson.id);

    container.innerHTML = `
      <a class="back-link" href="#/learn">← 返回课程列表</a>
      <div class="page-title">${lesson.icon} ${lesson.title}</div>
      <div class="lesson-sections">
        ${lesson.sections.map(s => `<div class="card section-card"><h3>${s.h}</h3><p>${s.p}</p></div>`).join('')}
      </div>

      <div id="demo-area"></div>

      ${lesson.task ? `
      <div class="card task-card">
        <div class="card-title">✍️ 动手试一试</div>
        <p class="task-goal">${lesson.task.goal}</p>
        <div id="task-board" class="task-board"></div>
        <div class="task-feedback" id="task-feedback"></div>
        <div class="row-gap"><button class="btn btn-ghost btn-small" id="task-hint">💡 看提示</button><button class="btn btn-ghost btn-small" id="task-reset">↩️ 重来</button></div>
      </div>` : ''}

      <button class="btn btn-primary btn-block btn-big" id="btn-complete">${done ? '✅ 已完成，再复习一遍' : '完成学习，领星星！'}</button>
    `;

    /* 演示播放器 */
    const demoArea = container.querySelector('#demo-area');
    const players = [];
    lesson.demos.forEach((demo, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'card demo-card';
      wrap.innerHTML = `
        <div class="card-title">🎬 ${demo.title}</div>
        ${demo.note ? `<p class="demo-note">${demo.note}</p>` : ''}
        <div class="demo-layout">
          <div class="demo-board" id="demo-board-${idx}"></div>
          <div class="demo-panel">
            <div class="demo-note-text" id="demo-note-${idx}">点击「下一步」看演示 →</div>
            <div class="row-gap">
              <button class="btn btn-ghost btn-small" id="demo-prev-${idx}">← 上一步</button>
              <button class="btn btn-primary btn-small" id="demo-next-${idx}">下一步 →</button>
            </div>
            <div class="demo-step" id="demo-step-${idx}"></div>
          </div>
        </div>`;
      demoArea.appendChild(wrap);

      const game = new FunChess.Chess(demo.fen);
      const bView = new BoardView(wrap.querySelector('#demo-board-' + idx), { interactive: false, showCoords: true });
      players.push({ game, bView, demo, idx, step: 0 });
      bView.setGame(game);

      const render = () => {
        const p = players[idx];
        const mvNote = p.step === 0 ? null : p.demo.moves[p.step - 1].note;
        const note = p.step === 0 ? '点击「下一步」看演示 →' : (mvNote || '…（电脑回了一步）');
        wrap.querySelector('#demo-note-' + idx).textContent = note || '…';
        wrap.querySelector('#demo-step-' + idx).textContent = p.step === 0 ? '' : `${p.step}/${p.demo.moves.length}：${p.demo.moves[p.step - 1].san}`;
        wrap.querySelector('#demo-prev-' + idx).disabled = p.step === 0;
        wrap.querySelector('#demo-next-' + idx).disabled = p.step >= p.demo.moves.length;
      };
      wrap.querySelector('#demo-next-' + idx).addEventListener('click', () => {
        const p = players[idx];
        if (p.step >= p.demo.moves.length) return;
        const mv = p.demo.moves[p.step];
        const m = p.game.move(mv.san);
        if (m) {
          p.bView.setGame(p.game, { lastMove: m, animate: true });
          if (mv.note) FC.sfx.move(); 
          p.step++;
          render();
        }
      });
      wrap.querySelector('#demo-prev-' + idx).addEventListener('click', () => {
        const p = players[idx];
        if (p.step <= 0) return;
        p.game.undo();
        p.step--;
        const lastM = p.step > 0 ? p.game.historyVerbose()[p.game.history.length - 1] : null;
        p.bView.setGame(p.game, { lastMove: lastM });
        render();
      });
      render();
    });

    /* 动手任务 */
    if (lesson.task) {
      const taskGame = new FunChess.Chess(lesson.task.fen);
      const tView = new BoardView(container.querySelector('#task-board'), {
        onMove: mv => {
          const m = taskGame.move(mv);
          const fb = container.querySelector('#task-feedback');
          if (m && lesson.task.accept.some(s => norm(s) === norm(m.san))) {
            fb.innerHTML = '<span class="fb-ok">🎉 答对了！你真棒！</span>';
            FC.sfx.correct();
            FC.confetti(container.querySelector('.task-card'));
            tView.setGame(taskGame, { lastMove: m, animate: true, movableColor: null });
            markTaskDone();
            return true;
          }
          if (m) {
            fb.innerHTML = '<span class="fb-no">🤔 不是这一步，再想想！</span>';
            FC.sfx.wrong();
            taskGame.undo();
            return false;
          }
          return false;
        }
      });
      tView.setGame(taskGame);
      container.querySelector('#task-hint').addEventListener('click', () => FC.toast('💡 ' + lesson.task.hint, 'info', 4000));
      container.querySelector('#task-reset').addEventListener('click', () => {
        taskGame.load(lesson.task.fen);
        tView.setGame(taskGame);
        container.querySelector('#task-feedback').innerHTML = '';
      });
    }

    /* 完成按钮 */
    container.querySelector('#btn-complete').addEventListener('click', () => {
      const u = FC.store.getUser();
      if (!u.lessonsDone.includes(lesson.id)) {
        FC.store.patchUser(x => { x.lessonsDone.push(lesson.id); return x; });
        FC.store.addStars(lesson.stars);
        FC.sfx.star();
        FC.confetti();
        FC.toast(`🎉 完成课程「${lesson.title}」+${lesson.stars}⭐`, 'star', 3000);
        if (FC.store.getUser().lessonsDone.length >= FC.CONTENT.lessons.length) FC.store.awardBadge('scholar');
        container.querySelector('#btn-complete').textContent = '✅ 已完成，去下一课 →';
        setTimeout(() => {
          const idx = FC.CONTENT.lessons.findIndex(l => l.id === lesson.id);
          const next = FC.CONTENT.lessons[idx + 1];
          FC.navigate(next ? '#/lesson/' + next.id : '#/learn');
        }, 1400);
      } else {
        FC.navigate('#/learn');
      }
    });

    function markTaskDone() {
      const btn = container.querySelector('#btn-complete');
      if (btn && !done) btn.innerHTML = '完成学习，领星星！';
    }

    FC.setPageCleanup(() => players.forEach(p => p.bView.destroy()));
  };

  /* ---------------- 战术闯关 ---------------- */
  FC.views.quiz = function (container, arg, params) {
    const user = FC.store.getUser();
    const types = ['all', ...new Set(FC.CONTENT.quizzes.map(q => q.type))];
    const typeNames = Object.assign({ all: '全部' }, FC.CONTENT.quizTypeNames);
    let filter = params.type || 'all';
    let showEndgames = params.tab === 'endgame';

    function render() {
      container.innerHTML = `
        <div class="page-title">🧩 战术闯关</div>
        <div class="seg seg-wrap" id="quiz-tabs">
          <button data-t="puzzle" class="${!showEndgames ? 'active' : ''}">🧩 战术题</button>
          <button data-t="endgame" class="${showEndgames ? 'active' : ''}">🏰 残局挑战</button>
        </div>
        <div id="quiz-body"></div>`;

      container.querySelector('#quiz-tabs').addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        showEndgames = b.dataset.t === 'endgame';
        FC.sfx.click();
        render();
      });

      const body = container.querySelector('#quiz-body');
      if (showEndgames) renderEndgameList(body);
      else renderPuzzles(body);
    }

    function renderEndgameList(body) {
      const u = FC.store.getUser();
      body.innerHTML = `<div class="endgame-grid">${FC.CONTENT.endgames.map(eg => {
        const done = u.endgameDone[eg.id];
        return `<a class="card endgame-card" href="#/play?mode=endgame&id=${eg.id}">
          <div class="lesson-icon">${eg.icon}</div>
          <div class="lesson-body">
            <div class="lesson-title">${eg.title} ${done ? '<span class="done-check">⭐</span>' : ''}</div>
            <div class="lesson-sum">${eg.desc}</div>
            <div class="lesson-stars">${done ? FC.starsHtml(3) : '未完成'}</div>
          </div>
        </a>`;
      }).join('')}</div>`;
    }

    function renderPuzzles(body) {
      const solved = Object.keys(user.quizDone).length;
      const list = FC.CONTENT.quizzes.filter(q => filter === 'all' || q.type === filter);
      body.innerHTML = `
        <div class="seg seg-wrap" id="quiz-filter">
          ${types.map(t => `<button data-v="${t}" class="${t === filter ? 'active' : ''}">${typeNames[t] || t}</button>`).join('')}
        </div>
        <div class="progress-card card"><span>已答对 ${solved}/${FC.CONTENT.quizzes.length} 题</span>
          <div class="progress"><div class="progress-fill" style="width:${Math.round(solved / FC.CONTENT.quizzes.length * 100)}%"></div></div>
        </div>
        ${list.length ? `<div class="quiz-runner card" id="quiz-runner"></div>` : '<div class="card muted-p">该分类下暂无题目</div>'}`;
      body.querySelector('#quiz-filter').addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        filter = b.dataset.v;
        FC.sfx.click();
        renderPuzzles(body);
      });
      if (list.length) runPuzzle(body.querySelector('#quiz-runner'), list, 0);
    }

    function runPuzzle(host, list, index) {
      if (index >= list.length) {
        host.innerHTML = `<div class="quiz-done">🎉 这一组的题都做完啦！<br><a class="btn btn-primary" href="#/quiz">再来一组</a></div>`;
        return;
      }
      const q = list[index];
      const user = FC.store.getUser();
      const solvedBefore = !!user.quizDone[q.id];
      const game = new FunChess.Chess(q.fen);
      let stepIdx = 0, tries = 0, revealed = false;

      host.innerHTML = `
        <div class="quiz-head">
          <span class="chip">${FC.CONTENT.quizTypeNames[q.type] || q.type}</span>
          <span class="chip chip-soft">难度 ${'★'.repeat(q.diff)}</span>
          <span class="quiz-count">${index + 1}/${list.length}</span>
          ${solvedBefore ? '<span class="chip chip-green">✓ 之前答对过</span>' : ''}
        </div>
        <p class="quiz-goal">${q.goal}</p>
        <div class="quiz-layout">
          <div id="quiz-board" class="task-board"></div>
          <div class="quiz-side">
            <div class="quiz-feedback" id="quiz-fb">动手试一试！</div>
            <div class="row-gap">
              <button class="btn btn-ghost btn-small" id="quiz-hint">💡 提示</button>
              <button class="btn btn-ghost btn-small" id="quiz-answer" style="display:none">👀 看答案</button>
            </div>
          </div>
        </div>`;

      const bView = new BoardView(host.querySelector('#quiz-board'), {
        onMove: mv => {
          if (revealed) return false;
          const m = game.move(mv);
          const fb = host.querySelector('#quiz-fb');
          if (m && q.solution.some((s, i) => i === stepIdx && norm(s) === norm(m.san))) {
            // 命中当前步
            stepIdx++;
            bView.setGame(game, { lastMove: m, animate: true });
            FC.sfx.correct();
            const reply = q.replies && q.replies[stepIdx - 1];
            if (stepIdx >= q.solution.length) {
              puzzleSolved();
            } else if (reply) {
              setTimeout(() => {
                const rm = game.move(reply);
                if (rm) { bView.setGame(game, { lastMove: rm, animate: true }); }
                fb.innerHTML = '<span class="fb-ok">👍 第一步正确！继续…</span>';
              }, 450);
            } else {
              fb.innerHTML = '<span class="fb-ok">👍 好球！继续…</span>';
            }
            return true;
          }
          if (m) {
            tries++;
            fb.innerHTML = tries >= 2
              ? `<span class="fb-no">还没有对哦…${q.hint}</span>`
              : '<span class="fb-no">🤔 再想一想！走棋前先看看对方的弱点。</span>';
            FC.sfx.wrong();
            game.undo();
            if (tries >= 2) host.querySelector('#quiz-answer').style.display = '';
            return false;
          }
          return false;
        }
      });
      bView.setGame(game);

      host.querySelector('#quiz-hint').addEventListener('click', () => {
        FC.toast('💡 ' + q.hint, 'info', 4500);
        host.querySelector('#quiz-answer').style.display = '';
      });
      host.querySelector('#quiz-answer').addEventListener('click', () => {
        revealed = true;
        const g2 = new FunChess.Chess(q.fen);
        for (let i = 0; i < q.solution.length; i++) {
          g2.move(q.solution[i]);
          const reply = q.replies && q.replies[i];
          if (reply && i < q.solution.length - 1) g2.move(reply);
        }
        bView.setGame(g2, { lastMove: g2.historyVerbose().at(-1) || null });
        host.querySelector('#quiz-fb').innerHTML = `<span class="fb-show">答案是：<b>${q.solution.join(' → ')}</b></span><p class="muted-p">${q.explain}</p>`;
        host.querySelector('#quiz-answer').style.display = 'none';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary btn-small';
        nextBtn.textContent = '下一题 →';
        nextBtn.addEventListener('click', () => runPuzzle(host, list, index + 1));
        host.querySelector('.quiz-side').appendChild(nextBtn);
      });

      function puzzleSolved() {
        FC.confetti(host);
        if (!solvedBefore) {
          FC.store.patchUser(x => { x.quizDone[q.id] = true; return x; });
          FC.store.addStars(1);
          FC.sfx.star();
          const u2 = FC.store.getUser();
          if (Object.keys(u2.quizDone).length >= 10) FC.store.awardBadge('tactic10');
        }
        FC.modal({
          title: '🎉 答对啦！',
          body: `<p>${q.explain}</p>${!solvedBefore ? '<p class="muted">首次答对 +1 ⭐</p>' : ''}`,
          actions: [
            { label: '下一题 →', className: 'btn-primary', onClick: close => { close(); runPuzzle(host, list, index + 1); } }
          ]
        });
      }
    }

    FC.setPageCleanup(() => { /* 棋盘随 DOM 销毁 */ });
    render();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
