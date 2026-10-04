/* ============================================================
 * 趣棋小将 · 应用骨架
 *  - Hash 路由：#/ 首页 #/learn #/lesson/:id #/quiz #/play
 *               #/history #/review/:id #/profile #/stats
 *  - 底部导航（手机/平板/PC 通用）
 *  - EngineClient：Web Worker 封装（含无 Worker 兜底）
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC = root.FC || {};

  /* ---------------- 引擎客户端 ---------------- */
  class EngineClient {
    constructor() {
      this.seq = 1;
      this.pending = new Map();
      this.worker = null;
      try {
        this.worker = new Worker('workers/engine-worker.js');
        this.worker.onmessage = e => this._onMessage(e.data);
        this.worker.onerror = e => {
          console.warn('Worker 异常，降级为主线程计算', e.message || e);
          this.worker = null;
        };
      } catch (err) {
        console.warn('无法创建 Worker（可能是 file:// 打开），降级为主线程计算');
        this.worker = null;
      }
    }

    _onMessage(d) {
      const p = this.pending.get(d.id);
      if (!p) return;
      if (d.type === 'progress') { p.onProgress && p.onProgress(d); return; }
      this.pending.delete(d.id);
      if (d.ok === false) p.reject(new Error(d.error || '引擎错误'));
      else p.resolve(d.result);
    }

    /* 主线程兜底（Worker 不可用时同步执行） */
    _fallback(type, payload, onProgress) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const FCe = root.FunChess, EN = root.FunChessEngine, AN = root.FunChessAnalysis;
            if (type === 'search') {
              const g = new FCe.Chess(payload.fen || FCe.START_FEN);
              for (const san of payload.moves || []) g.move(san);
              resolve(EN.search(g, payload.options || {}));
            } else if (type === 'eval') {
              const g = new FCe.Chess(payload.fen || FCe.START_FEN);
              for (const san of payload.moves || []) g.move(san);
              const info = EN.analyzePosition(g, { depth: payload.depth || 2, maxTimeMs: payload.maxTimeMs || 400 });
              resolve({ scoreWhite: info.scoreWhite, bestSan: info.best ? g.sanOfMove(info.best) : null, isMate: info.isMate, mateIn: info.mateIn });
            } else if (type === 'analyze-game') {
              resolve(AN.analyzeGame(payload, p => onProgress && onProgress(p)));
            } else reject(new Error('未知消息类型'));
          } catch (err) { reject(err); }
        }, 30);
      });
    }

    request(type, payload, onProgress) {
      if (!this.worker) return this._fallback(type, payload, onProgress);
      return new Promise((resolve, reject) => {
        const id = this.seq++;
        this.pending.set(id, { resolve, reject, onProgress });
        this.worker.postMessage({ id, type, payload });
      });
    }
  }
  FC.engine = new EngineClient();

  /* ---------------- 路由 ---------------- */
  FC.views = {};
  let currentBoardCleanup = null;
  FC.setPageCleanup = fn => { currentBoardCleanup = fn; };

  function parseHash() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = {};
    if (qs) for (const kv of qs.split('&')) { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
    return { page: parts[0] || 'home', arg: parts[1] || '', params };
  }

  function renderTabbar(page) {
    const tabs = [
      { id: 'home', icon: '🏠', label: '首页' },
      { id: 'learn', icon: '📖', label: '学习' },
      { id: 'play', icon: '♟️', label: '对战' },
      { id: 'history', icon: '📋', label: '记录' },
      { id: 'profile', icon: '😊', label: '我的' }
    ];
    return `<nav class="tabbar">${tabs.map(t =>
      `<a class="tab ${page === t.id || (t.id === 'learn' && ['lesson', 'quiz'].includes(page)) || (t.id === 'history' && ['review', 'stats'].includes(page)) ? 'active' : ''}" href="#/${t.id}">
        <span class="tab-icon">${t.icon}</span><span class="tab-label">${t.label}</span>
      </a>`).join('')}</nav>`;
  }

  function route() {
    const { page, arg, params } = parseHash();
    if (currentBoardCleanup) { try { currentBoardCleanup(); } catch (e) { /* 忽略 */ } currentBoardCleanup = null; }
    FC.tts.stop();
    const app = document.getElementById('app');
    const fn = FC.views[page] || FC.views.home;
    app.innerHTML = '';
    app.innerHTML = `<div class="page page-${page}">${fn.length >= 2 ? '' : ''}</div>`;
    const container = app.querySelector('.page');
    // 每个视图负责填充 container；tabbar 单独挂
    let tabHost = document.getElementById('tabbar-host');
    if (!tabHost) { tabHost = document.createElement('div'); tabHost.id = 'tabbar-host'; document.body.appendChild(tabHost); }
    tabHost.innerHTML = renderTabbar(page);
    Promise.resolve(fn(container, arg, params)).catch(err => {
      console.error('视图渲染失败', err);
      container.innerHTML = `<div class="card"><p>😵 页面出错了：${FC.esc(err.message)}</p><a class="btn btn-primary" href="#/">回首页</a></div>`;
    });
    window.scrollTo(0, 0);
  }

  FC.navigate = hash => { location.hash = hash; };
  window.addEventListener('hashchange', route);

  /* ---------------- 首页 ---------------- */
  FC.views.home = function (container) {
    const user = FC.store.getUser();
    const stats = FC.store.stats();
    const hour = new Date().getHours();
    const greet = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    const lessonsTotal = FC.CONTENT.lessons.length;
    const lessonsDone = user.lessonsDone.length;
    const tips = FC.CONTENT.tips[Math.min(4, Math.max(1, user.difficulty))];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    const nextLesson = FC.CONTENT.lessons.find(l => !user.lessonsDone.includes(l.id));

    container.innerHTML = `
      <header class="home-header">
        <div>
          <h1>${greet}，${FC.esc(user.nickname)} ${user.avatar}</h1>
          <p class="home-sub">今天也要快乐下棋哦！</p>
        </div>
        <div class="star-chip">⭐ ${user.stars}</div>
      </header>

      <div class="home-grid">
        <a class="home-card hc-learn" href="#/learn">
          <div class="hc-icon">📖</div>
          <div class="hc-title">学习课程</div>
          <div class="hc-sub">${lessonsDone}/${lessonsTotal} 已完成</div>
          <div class="progress"><div class="progress-fill" style="width:${Math.round(lessonsDone / lessonsTotal * 100)}%"></div></div>
        </a>
        <a class="home-card hc-play" href="#/play">
          <div class="hc-icon">♟️</div>
          <div class="hc-title">人机对战</div>
          <div class="hc-sub">${FC.store.getSettings().adaptive ? '自适应难度' : ''} ${['入门', '初级', '中级', '高级'][user.difficulty - 1]}</div>
        </a>
        <a class="home-card hc-quiz" href="#/quiz">
          <div class="hc-icon">🧩</div>
          <div class="hc-title">战术闯关</div>
          <div class="hc-sub">捉双 · 牵制 · 将杀</div>
        </a>
        <a class="home-card hc-stats" href="#/stats">
          <div class="hc-icon">📊</div>
          <div class="hc-title">我的统计</div>
          <div class="hc-sub">${stats.total ? `${stats.total} 盘 · 胜率 ${stats.winRate}%` : '还没有对局'}</div>
        </a>
      </div>

      <div class="card tip-card">
        <div class="tip-badge">💡 今日小贴士</div>
        <p>${tip}</p>
      </div>

      ${stats.recent.length ? `<div class="card">
        <div class="card-title">最近战绩</div>
        <div class="recent-dots">${stats.recent.map(r => `<span class="dot ${r}">${r === 'win' ? '胜' : r === 'loss' ? '负' : '和'}</span>`).join('')}</div>
        ${nextLesson ? `<a class="btn btn-primary btn-block" href="#/lesson/${nextLesson.id}">继续学习：${nextLesson.title}</a>` : `<a class="btn btn-primary btn-block" href="#/quiz">去闯战术关 →</a>`}
      </div>` : ''}
    `;
  };

  /* 首次加载立即渲染当前路由。
   * 必须等 DOMContentLoaded：此时 play.js 等后续视图脚本均已执行完毕，
   * 否则深链接（如 #/play）会因为视图未注册而错误回退到首页。 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', route);
  } else {
    route();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
