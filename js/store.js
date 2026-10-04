/* ============================================================
 * 趣棋小将 · 本地数据存储（localStorage，隐私最小化）
 *  - settings 用户设置 / user 进度与成就 / games 对局记录
 *  - current 进行中对局的实时快照（每步保存，防中途退出丢数据）
 *  - 统计聚合：胜率/连胜/失误分布/五维雷达
 *  - 星星 / 积分 / 徽章 / 难度自适应
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC = root.FC || {};

  const K = {
    settings: 'fc_settings_v1',
    user: 'fc_user_v1',
    games: 'fc_games_v1',
    current: 'fc_current_v1',
    minutes: 'fc_minutes_v1'
  };

  function read(key, def) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch (e) { return def; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('存储失败', e); }
  }

  const DEFAULT_SETTINGS = {
    sound: true,          // 音效
    tts: false,           // 语音讲解
    coach: true,          // 对局中 AI 文字讲解（入门/初级）
    hints: true,          // 允许"提示下一步"
    showEval: true,       // 显示局势条
    adaptive: true,       // 难度自适应
    lockedDifficulty: 0,  // 家长锁定难度（0=不锁定）
    dailyLimitMin: 0      // 每日时长提醒（分钟，0=不提醒）
  };

  const DEFAULT_USER = {
    nickname: '小棋手',
    avatar: '🐣',
    stars: 0,
    score: 0,
    badges: [],
    streak: 0,            // 当前连胜
    bestStreak: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    difficulty: 2,        // 当前建议难度（自适应结果）
    lessonsDone: [],      // 已完成课程 id
    quizDone: {},         // 题目 id -> true（首次答对）
    endgameDone: {}       // 残局 id -> { stars, moves }
  };

  /* ---------- 徽章定义 ---------- */
  FC.BADGES = [
    { id: 'first_game', icon: '🎲', name: '初次上阵', desc: '完成第一盘对局' },
    { id: 'first_win', icon: '🥇', name: '首场胜利', desc: '赢下第一盘棋' },
    { id: 'win3', icon: '🔥', name: '三连胜', desc: '连续赢下 3 盘' },
    { id: 'promoted', icon: '👑', name: '小兵变大', desc: '对局中升变过一个兵' },
    { id: 'castler', icon: '🏰', name: '安全小屋', desc: '对局中完成王车易位' },
    { id: 'scholar', icon: '🎓', name: '小小学者', desc: '学完全部课程' },
    { id: 'tactic10', icon: '🧠', name: '战术达人', desc: '答对 10 道战术题' },
    { id: 'endmaster', icon: '🏰', name: '残局小大师', desc: '完成 3 个残局挑战' },
    { id: 'detective', icon: '🔍', name: '复盘小侦探', desc: '完成第一次智能复盘' },
    { id: 'vet10', icon: '🛡️', name: '十局老将', desc: '完成 10 盘对局' }
  ];

  FC.store = {
    /* ---------- 设置 ---------- */
    getSettings() { return Object.assign({}, DEFAULT_SETTINGS, read(K.settings, {})); },
    saveSettings(patch) { const s = Object.assign({}, this.getSettings(), patch); write(K.settings, s); return s; },

    /* ---------- 用户 ---------- */
    getUser() { return Object.assign({}, DEFAULT_USER, read(K.user, {})); },
    saveUser(u) { write(K.user, u); return u; },
    patchUser(fn) { const u = fn(Object.assign({}, this.getUser())); return this.saveUser(u); },
    addStars(n) { return this.patchUser(u => { u.stars += n; u.score += n * 10; return u; }); },

    awardBadge(id) {
      const u = this.getUser();
      if (u.badges.includes(id)) return false;
      u.badges.push(id);
      this.saveUser(u);
      const b = FC.BADGES.find(x => x.id === id);
      if (b) FC.toast(`${b.icon} 获得徽章「${b.name}」！`, 'star', 3000);
      return true;
    },

    /* ---------- 对局记录 ---------- */
    getGames() { return read(K.games, []); },
    getGame(id) { return this.getGames().find(g => g.id === id) || null; },
    addGame(rec) {
      const games = this.getGames();
      games.unshift(rec);
      if (games.length > 200) games.length = 200; // 只保留最近 200 盘
      write(K.games, games);
      return rec;
    },
    updateGame(id, patch) {
      const games = this.getGames();
      const i = games.findIndex(g => g.id === id);
      if (i < 0) return null;
      games[i] = Object.assign({}, games[i], patch);
      write(K.games, games);
      return games[i];
    },
    deleteGame(id) { write(K.games, this.getGames().filter(g => g.id !== id)); },

    /* ---------- 进行中对局快照（每步实时保存） ---------- */
    saveCurrent(cur) { write(K.current, cur); },
    getCurrent() { return read(K.current, null); },
    clearCurrent() { try { localStorage.removeItem(K.current); } catch (e) { /* 忽略 */ } },

    /* ---------- 每日时长 ---------- */
    todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
    addMinutes(min) {
      const m = read(K.minutes, {});
      const k = this.todayKey();
      m[k] = (m[k] || 0) + min;
      write(K.minutes, m);
      return m[k];
    },
    todayMinutes() { return read(K.minutes, {})[this.todayKey()] || 0; },

    /* ---------- 对局结算：连胜/积分/难度自适应 ---------- */
    recordResult(playerResult) {
      const u = this.getUser();
      const s = this.getSettings();
      if (playerResult === 'win') { u.streak++; u.consecutiveWins++; u.consecutiveLosses = 0; u.score += 10; }
      else if (playerResult === 'loss') { u.streak = 0; u.consecutiveLosses++; u.consecutiveWins = 0; u.score += 2; }
      else { u.score += 4; }
      u.bestStreak = Math.max(u.bestStreak, u.streak);

      let adjusted = false, direction = 0;
      if (s.adaptive && !s.lockedDifficulty) {
        if (u.consecutiveWins >= 2 && u.difficulty < 4) { u.difficulty++; u.consecutiveWins = 0; adjusted = true; direction = 1; }
        else if (u.consecutiveLosses >= 2 && u.difficulty > 1) { u.difficulty--; u.consecutiveLosses = 0; adjusted = true; direction = -1; }
      }
      this.saveUser(u);
      return { adjusted, direction, difficulty: u.difficulty };
    },

    /* ---------- 统计聚合 ---------- */
    stats() {
      const games = this.getGames();
      const user = this.getUser();
      const total = games.length;
      const wins = games.filter(g => g.playerResult === 'win').length;
      const losses = games.filter(g => g.playerResult === 'loss').length;
      const draws = games.filter(g => g.playerResult === 'draw').length;
      const winRate = total ? Math.round(wins / total * 100) : 0;

      /* 失误分布 + 分阶段平均损失（来自复盘数据） */
      const dist = { material: 0, missedCapture: 0, missedMate: 0, tactic: 0, opening: 0, endgame: 0 };
      const phaseAcc = { opening: [], middlegame: [], endgame: [] };
      let blundersWhenWorse = 0, blundersTotal = 0;
      for (const g of games) {
        if (!g.review || !g.review.plies) continue;
        for (const p of g.review.plies) {
          if (p.level !== 'none' && dist[p.type] !== undefined) dist[p.type]++;
          if (p.level === 'blunder') {
            blundersTotal++;
            const whiteBetter = p.evalBefore > 0;
            if ((p.side === 'w') === whiteBetter) blundersWhenWorse++; // 优方犯大错=防守失误近似
          }
          const acc = FC.analysis ? FC.analysis.moveAccuracy(p.cpLoss) : null;
          if (acc !== null && phaseAcc[p.phase]) phaseAcc[p.phase].push(acc);
        }
      }
      const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
      const phaseAvg = { opening: avg(phaseAcc.opening), middlegame: avg(phaseAcc.middlegame), endgame: avg(phaseAcc.endgame) };

      /* 五维雷达（0-100，无数据给中性 60） */
      const neutral = v => v === null ? 60 : Math.max(10, Math.min(100, v));
      const defenseRaw = blundersTotal ? 100 - Math.round(blundersWhenWorse / blundersTotal * 60) - Math.round(losses / Math.max(1, total) * 30) : 60;
      const attackRaw = Math.round(winRate * 0.6 + (phaseAvg.middlegame || 60) * 0.4);
      const radar = {
        opening: neutral(phaseAvg.opening),
        tactics: neutral(phaseAvg.middlegame),
        endgame: neutral(phaseAvg.endgame),
        defense: neutral(defenseRaw),
        attack: neutral(attackRaw)
      };

      return {
        total, wins, losses, draws, winRate,
        streak: user.streak, bestStreak: user.bestStreak,
        dist, radar, recent: games.slice(0, 10).map(g => g.playerResult),
        accuracyAvg: (() => {
          const list = games.filter(g => g.review && g.review.summary).map(g => g.review.summary.accuracy);
          return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;
        })()
      };
    },

    /* ---------- 导入 / 导出 ---------- */
    exportAll() {
      return JSON.stringify({
        app: 'FunChess Kids', version: 1, exportedAt: Date.now(),
        settings: this.getSettings(), user: this.getUser(), games: this.getGames()
      }, null, 2);
    },
    importAll(json) {
      const data = JSON.parse(json);
      if (data.app !== 'FunChess Kids') throw new Error('不是趣棋小将的备份文件');
      if (data.settings) write(K.settings, Object.assign({}, DEFAULT_SETTINGS, data.settings));
      if (data.user) write(K.user, Object.assign({}, DEFAULT_USER, data.user));
      if (Array.isArray(data.games)) write(K.games, data.games);
      return true;
    },
    resetAll() {
      for (const k of Object.values(K)) { try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ } }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
