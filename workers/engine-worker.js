/* ============================================================
 * 趣棋小将 · 引擎 Worker
 * 所有 AI 计算都在后台线程进行，避免卡住界面：
 *  - search        对局中按难度走一步
 *  - eval          快速评估当前局面（局势条用）
 *  - analyze-game  整局复盘（带进度回报）
 * ============================================================ */
/* global FunChess, FunChessEngine, FunChessAnalysis */
importScripts('../js/chess-core.js', '../js/engine.js', '../js/analysis.js');

const FC = self.FunChess;
const Engine = self.FunChessEngine;
const Analysis = self.FunChessAnalysis;

/* 从起始 FEN + SAN 列表重建局面 */
function buildGame(payload) {
  const g = new FC.Chess(payload.fen || FC.START_FEN);
  for (const san of payload.moves || []) {
    const m = g.move(san);
    if (!m) throw new Error('着法无法应用：' + san);
  }
  return g;
}

self.onmessage = function (e) {
  const { id, type, payload } = e.data;
  const post = (msg) => self.postMessage(msg);
  try {
    if (type === 'search') {
      const g = buildGame(payload);
      const r = Engine.search(g, payload.options || {});
      post({ id, ok: true, result: r });
    } else if (type === 'eval') {
      // 快速评估（局势条）：浅层即可
      const g = buildGame(payload);
      const info = Engine.analyzePosition(g, { depth: payload.depth || 2, maxTimeMs: payload.maxTimeMs || 400 });
      post({ id, ok: true, result: { scoreWhite: info.scoreWhite, bestSan: info.best ? g.sanOfMove(info.best) : null, isMate: info.isMate, mateIn: info.mateIn } });
    } else if (type === 'analyze-game') {
      const result = Analysis.analyzeGame(payload, (p) => post({ id, type: 'progress', done: p.done, total: p.total }));
      post({ id, ok: true, result });
    } else {
      post({ id, ok: false, error: '未知消息类型：' + type });
    }
  } catch (err) {
    post({ id, ok: false, error: String((err && err.stack) || err) });
  }
};
