/* ============================================================
 * 趣棋小将 · 记录 / 我的 / 统计
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC;

  const RES_CN = { win: '胜', loss: '负', draw: '和' };

  /* ---------------- 对局历史 ---------------- */
  FC.views.history = function (container) {
    let filter = 'all';
    let diffFilter = '0';

    function render() {
      let games = FC.store.getGames();
      if (filter !== 'all') games = games.filter(g => g.playerResult === filter);
      if (diffFilter !== '0') games = games.filter(g => String(g.difficulty) === diffFilter);

      container.innerHTML = `
        <div class="page-title">📋 对局记录</div>
        <div class="row-gap filter-row">
          <div class="seg" id="his-res">
            ${['all', 'win', 'draw', 'loss'].map(v => `<button data-v="${v}" class="${filter === v ? 'active' : ''}">${v === 'all' ? '全部' : RES_CN[v]}</button>`).join('')}
          </div>
          <div class="seg" id="his-diff">
            ${['0', '1', '2', '3', '4'].map(v => `<button data-v="${v}" class="${diffFilter === v ? 'active' : ''}">${v === '0' ? '全部难度' : ['入门', '初级', '中级', '高级'][v - 1]}</button>`).join('')}
          </div>
        </div>
        ${games.length ? `<div class="game-list">${games.map(g => `
          <div class="card game-row">
            <div class="game-row-main" data-id="${g.id}">
              <span class="chip ${g.playerResult === 'win' ? 'chip-green' : g.playerResult === 'draw' ? 'chip-soft' : 'chip-red'}">${RES_CN[g.playerResult]}</span>
              <div class="game-row-body">
                <div class="game-row-title">${g.mode === 'endgame' ? '残局挑战' : '人机对战'} · ${g.difficultyName || ''} · ${g.color === 'w' ? '执白' : '执黑'}</div>
                <div class="game-row-sub">${FC.fmtDate(g.startTime)} · ${Math.ceil(g.moves.length / 2)} 回合 · ${g.resultText || ''}${g.review && g.review.summary ? ' · 准确率 ' + g.review.summary.accuracy + '%' : ''}</div>
              </div>
              ${g.review && g.review.summary ? `<span class="game-stars">${FC.starsHtml(g.review.summary.stars)}</span>` : ''}
            </div>
            <div class="row-gap">
              <a class="btn btn-primary btn-small" href="#/review/${g.id}">🔍 复盘</a>
              <button class="btn btn-danger-ghost btn-small" data-del="${g.id}">删除</button>
            </div>
          </div>`).join('')}</div>`
        : '<div class="card muted-p">还没有对局记录，去下一盘吧！<br><br><a class="btn btn-primary" href="#/play">开始对局</a></div>'}
      `;

      container.querySelector('#his-res').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        filter = b.dataset.v; render();
      });
      container.querySelector('#his-diff').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        diffFilter = b.dataset.v; render();
      });
      container.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await FC.confirm('确定删除这局记录吗？删除后无法恢复。', '删除');
          if (ok) { FC.store.deleteGame(btn.dataset.del); render(); }
        });
      });
    }
    render();
  };

  /* ---------------- 我的中心 ---------------- */
  FC.views.profile = function (container) {
    const user = FC.store.getUser();
    const settings = FC.store.getSettings();

    container.innerHTML = `
      <div class="page-title">😊 我的中心</div>
      <div class="card profile-card">
        <div class="avatar-big">${user.avatar}</div>
        <div class="profile-main">
          <input class="nick-input" id="nick" value="${FC.esc(user.nickname)}" maxlength="12" />
          <div class="profile-nums">
            <span>⭐ ${user.stars}</span><span>积分 ${user.score}</span><span>🔥 连胜 ${user.streak}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">选个头像</div>
        <div class="avatar-grid" id="avatar-grid">
          ${FC.AVATARS.map(a => `<button class="avatar-btn ${a === user.avatar ? 'active' : ''}" data-a="${a}">${a}</button>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">🏅 成就徽章（${user.badges.length}/${FC.BADGES.length}）</div>
        <div class="badge-grid">
          ${FC.BADGES.map(b => {
            const got = user.badges.includes(b.id);
            return `<div class="badge-item ${got ? '' : 'locked'}" title="${b.desc}">
              <div class="badge-icon">${got ? b.icon : '🔒'}</div>
              <div class="badge-name">${b.name}</div>
              <div class="badge-desc">${b.desc}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">⚙️ 设置</div>
        ${toggleRow('sound', '🔊 音效', settings.sound)}
        ${toggleRow('tts', '🗣️ 语音讲解（小兵念给你听）', settings.tts)}
        ${toggleRow('coach', '🪖 对局中讲解走棋原因（入门/初级）', settings.coach)}
        ${toggleRow('hints', '💡 允许使用提示', settings.hints)}
        ${toggleRow('showEval', '📊 显示局势评分条', settings.showEval)}
        ${toggleRow('adaptive', '📈 难度自适应（连赢升、连输降）', settings.adaptive)}
        <div class="setting-row">
          <span>🔒 锁定难度（家长）</span>
          <select id="lock-diff" class="select">
            <option value="0" ${!settings.lockedDifficulty ? 'selected' : ''}>不锁定</option>
            ${[1, 2, 3, 4].map(d => `<option value="${d}" ${settings.lockedDifficulty === d ? 'selected' : ''}>${['入门', '初级', '中级', '高级'][d - 1]}</option>`).join('')}
          </select>
        </div>
        <div class="setting-row">
          <span>⏰ 每日时长提醒（家长）</span>
          <select id="daily-limit" class="select">
            ${[[0, '不提醒'], [30, '30 分钟'], [60, '60 分钟'], [90, '90 分钟']].map(([v, t]) => `<option value="${v}" ${settings.dailyLimitMin === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card">
        <div class="card-title">💾 数据</div>
        <p class="muted-p">所有数据只保存在这台设备上（隐私最小化），可以导出备份或搬家。</p>
        <div class="row-gap">
          <button class="btn btn-ghost" id="btn-export">📤 导出数据</button>
          <button class="btn btn-ghost" id="btn-import">📥 导入数据</button>
          <button class="btn btn-danger-ghost" id="btn-reset">🗑️ 重置全部</button>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none" />
      </div>
      <p class="footer-note">趣棋小将 FunChess Kids · 无广告 · 无付费 · 让孩子安心学棋</p>
    `;

    function toggleRow(key, label, on) {
      return `<div class="setting-row">
        <span>${label}</span>
        <label class="switch"><input type="checkbox" data-setting="${key}" ${on ? 'checked' : ''}><span class="slider"></span></label>
      </div>`;
    }

    container.querySelectorAll('[data-setting]').forEach(input => {
      input.addEventListener('change', () => {
        FC.store.saveSettings({ [input.dataset.setting]: input.checked });
        FC.sfx.click();
      });
    });
    container.querySelector('#nick').addEventListener('change', e => {
      FC.store.patchUser(u => { u.nickname = e.target.value.trim() || '小棋手'; return u; });
      FC.toast('昵称已保存', 'ok');
    });
    container.querySelector('#avatar-grid').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      FC.store.patchUser(u => { u.avatar = b.dataset.a; return u; });
      container.querySelectorAll('.avatar-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      container.querySelector('.avatar-big').textContent = b.dataset.a;
      FC.sfx.click();
    });
    container.querySelector('#lock-diff').addEventListener('change', e => {
      FC.store.saveSettings({ lockedDifficulty: +e.target.value });
    });
    container.querySelector('#daily-limit').addEventListener('change', e => {
      FC.store.saveSettings({ dailyLimitMin: +e.target.value });
    });
    container.querySelector('#btn-export').addEventListener('click', () => {
      const blob = new Blob([FC.store.exportAll()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'funchess-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    container.querySelector('#btn-import').addEventListener('click', () => container.querySelector('#import-file').click());
    container.querySelector('#import-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          FC.store.importAll(reader.result);
          FC.toast('📥 导入成功！', 'ok');
          setTimeout(() => location.reload(), 800);
        } catch (err) { FC.toast('导入失败：' + err.message, 'warn'); }
      };
      reader.readAsText(file);
    });
    container.querySelector('#btn-reset').addEventListener('click', async () => {
      const ok = await FC.confirm('确定重置全部数据吗？<br>所有对局、课程进度、徽章都会被清空！', '全部重置');
      if (ok) { FC.store.resetAll(); location.reload(); }
    });
  };

  /* ---------------- 统计面板 ---------------- */
  FC.views.stats = function (container) {
    const s = FC.store.stats();
    container.innerHTML = `
      <div class="page-title">📊 统计面板</div>
      <div class="stat-grid">
        <div class="card stat-card"><div class="stat-num">${s.total}</div><div class="stat-label">总对局</div></div>
        <div class="card stat-card"><div class="stat-num">${s.winRate}%</div><div class="stat-label">胜率（${s.wins}胜 ${s.draws}和 ${s.losses}负）</div></div>
        <div class="card stat-card"><div class="stat-num">${s.streak}</div><div class="stat-label">当前连胜</div></div>
        <div class="card stat-card"><div class="stat-num">${s.bestStreak}</div><div class="stat-label">最长连胜</div></div>
      </div>

      <div class="card">
        <div class="card-title">🕸️ 薄弱环节雷达</div>
        ${s.total ? '<canvas id="radar" width="600" height="420" class="radar"></canvas><div class="radar-legend">开局 · 战术中局 · 残局 · 防守 · 进攻</div>'
        : '<p class="muted-p">下几盘棋后就能看到你的能力雷达图啦！</p>'}
      </div>

      <div class="card">
        <div class="card-title">🩹 常见失误分布</div>
        ${s.total ? mistBars(s.dist) : '<p class="muted-p">完成对局并复盘后，这里会统计你的常见失误类型。</p>'}
      </div>

      ${s.recent.length ? `<div class="card"><div class="card-title">最近 ${s.recent.length} 局</div>
        <div class="recent-dots">${s.recent.map(r => `<span class="dot ${r}">${RES_CN[r]}</span>`).join('')}</div></div>` : ''}
      ${s.accuracyAvg !== null ? `<div class="card"><div class="card-title">🎯 平均准确率</div><div class="stat-num">${s.accuracyAvg}%</div></div>` : ''}
      <div class="row-gap" style="margin-top:12px">
        <a class="btn btn-primary" href="#/quiz">🧩 去补薄弱环节</a>
        <a class="btn btn-ghost" href="#/history">📋 查看对局</a>
      </div>
    `;

    function mistBars(dist) {
      const names = { material: '送子/丢子', missedCapture: '漏吃', missedMate: '错失将杀', tactic: '漏看战术', opening: '开局违例', endgame: '残局失误' };
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      if (!total) return '<p class="muted-p">暂时没有失误记录 —— 也许你下得很棒，也许还没复盘过，先去复盘一盘吧！</p>';
      return Object.entries(dist).map(([k, v]) => `
        <div class="mist-row">
          <span class="mist-name">${names[k] || k}</span>
          <div class="mist-bar"><div class="mist-fill" style="width:${Math.round(v / total * 100)}%"></div></div>
          <span class="mist-num">${v}</span>
        </div>`).join('');
    }

    /* 五维雷达图 */
    const cv = container.querySelector('#radar');
    if (cv) drawRadar(cv, s.radar);
  };

  function drawRadar(cv, radar) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = 300, H = 210;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2, cy = H / 2 + 6, R = 74;
    const dims = ['opening', 'tactics', 'endgame', 'defense', 'attack'];
    const labels = ['开局', '战术中局', '残局', '防守', '进攻'];
    const angle = i => -Math.PI / 2 + i * 2 * Math.PI / 5;

    // 网格
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = angle(i), r = R * ring / 4;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.stroke();
    }
    // 轴与标签
    ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
    for (let i = 0; i < 5; i++) {
      const a = angle(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.stroke();
      const lx = cx + Math.cos(a) * (R + 16), ly = cy + Math.sin(a) * (R + 14);
      ctx.fillStyle = '#6B5E52';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], lx, ly);
    }
    // 数据面
    ctx.beginPath();
    dims.forEach((d, i) => {
      const a = angle(i), r = R * (radar[d] / 100);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(91, 141, 239, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#5B8DEF';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 数值点
    dims.forEach((d, i) => {
      const a = angle(i), r = R * (radar[d] / 100);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#5B8DEF';
      ctx.fill();
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
