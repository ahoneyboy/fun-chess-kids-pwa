/* ============================================================
 * 趣棋小将 FunChess Kids · AI 引擎
 * ------------------------------------------------------------
 * 纯 JavaScript 实现：
 *  - Minimax（Negamax 形式）+ Alpha-Beta 剪枝
 *  - 评估函数：子力价值 + 位置表(PST) + 兵型（叠兵/孤兵/通路兵）
 *    + 双象 + 车路 + 王城安全 + 中残局分段王位置表
 *  - 静态搜索(Quiescence) + 将军延伸 + 迭代加深 + 杀手着法/历史启发
 *  - 按难度控制搜索深度、随机窗口与"失误率"，保证"可赢但不弱智"
 * 不依赖 WebAssembly；在 Web Worker 中运行以避免卡 UI。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chess-core.js'));
  else root.FunChessEngine = factory(root.FunChess);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (FC) {
  'use strict';
  const { WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, typeOf, colorOf } = FC;

  const MATE = 100000;                       // 将杀分值上限
  const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 0]; // 兵100 马320 象330 车500 后900

  /* 位置表（白方视角，下标 0 = a8 ... 63 = h1） */
  const PST_PAWN = [
      0,  0,  0,  0,  0,  0,  0,  0,
     50, 50, 50, 50, 50, 50, 50, 50,
     10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5,-10,  0,  0,-10, -5,  5,
      5, 10, 10,-20,-20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0];
  const PST_KNIGHT = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50];
  const PST_BISHOP = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20];
  const PST_ROOK = [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0];
  const PST_QUEEN = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20];
  const PST_KING_MID = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20];
  const PST_KING_END = [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50];
  const PST = [null, PST_PAWN, PST_KNIGHT, PST_BISHOP, PST_ROOK, PST_QUEEN, null];
  /* 通路兵奖励（按前进排数） */
  const PASSED_BONUS = [0, 10, 20, 35, 60, 100, 140, 140];

  /* 非兵非王子力总量（判断中/残局阶段） */
  function nonPawnMaterial(game) {
    let npm = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = game.board[sq];
      if (!p) continue;
      const t = typeOf(p);
      if (t !== PAWN && t !== KING) npm += PIECE_VALUE[t];
    }
    return npm;
  }

  /* 王城兵盾：王前方三列有己方兵保护加分，缺失减分（仅中局） */
  function kingShield(game, color) {
    const ks = game.kings[color];
    if (ks < 0) return 0;
    const row = ks >> 4, file = ks & 15;
    const dir = color === WHITE ? -1 : 1;
    let s = 0;
    for (let df = -1; df <= 1; df++) {
      const f = file + df;
      if (f < 0 || f > 7) continue;
      let found = false;
      for (let r = row + dir; r >= 0 && r <= 7; r += dir) {
        const p = game.board[r * 16 + f];
        if (p) { if (colorOf(p) === color && typeOf(p) === PAWN) found = true; break; }
      }
      s += found ? 8 : -10;
    }
    return s;
  }

  /* 局面评估：返回白方视角分值（正=白优，单位 centipawn） */
  function evaluate(game) {
    const b = game.board;
    let score = 0;
    let bishopsW = 0, bishopsB = 0;
    const wPawns = [], bPawns = [], wRooks = [], bRooks = [];
    const wFile = [0, 0, 0, 0, 0, 0, 0, 0], bFile = [0, 0, 0, 0, 0, 0, 0, 0];

    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const c = colorOf(p), t = typeOf(p);
      const row = sq >> 4, file = sq & 15;
      const idx = c === WHITE ? row * 8 + file : (7 - row) * 8 + file;
      let v = PIECE_VALUE[t];
      if (t !== KING) v += PST[t][idx];
      if (c === WHITE) score += v; else score -= v;
      if (t === BISHOP) { if (c === WHITE) bishopsW++; else bishopsB++; }
      if (t === PAWN) { if (c === WHITE) { wPawns.push(sq); wFile[file]++; } else { bPawns.push(sq); bFile[file]++; } }
      if (t === ROOK) { (c === WHITE ? wRooks : bRooks).push(sq); }
    }

    const endgame = nonPawnMaterial(game) <= 1300;

    /* 王：中局躲在角落安全，残局要走向中心 */
    const kTable = endgame ? PST_KING_END : PST_KING_MID;
    const kw = game.kings[WHITE], kb = game.kings[BLACK];
    if (kw >= 0) score += kTable[(kw >> 4) * 8 + (kw & 15)];
    if (kb >= 0) score -= kTable[(7 - (kb >> 4)) * 8 + (kb & 15)];

    /* 兵型：叠兵 / 孤兵 */
    for (let f = 0; f < 8; f++) {
      if (wFile[f] > 1) score -= 12 * (wFile[f] - 1);
      if (bFile[f] > 1) score += 12 * (bFile[f] - 1);
      const wNeighbors = (f > 0 ? wFile[f - 1] : 0) + (f < 7 ? wFile[f + 1] : 0);
      const bNeighbors = (f > 0 ? bFile[f - 1] : 0) + (f < 7 ? bFile[f + 1] : 0);
      if (wFile[f] && !wNeighbors) score -= 14 * wFile[f];
      if (bFile[f] && !bNeighbors) score += 14 * bFile[f];
    }

    /* 通路兵：前方没有敌兵阻挡/监视 */
    for (const sq of wPawns) {
      const row = sq >> 4, f = sq & 15;
      let passed = true;
      for (const e of bPawns) {
        const er = e >> 4, ef = e & 15;
        if (ef >= f - 1 && ef <= f + 1 && er < row) { passed = false; break; }
      }
      if (passed) score += PASSED_BONUS[6 - row] || 140;
    }
    for (const sq of bPawns) {
      const row = sq >> 4, f = sq & 15;
      let passed = true;
      for (const e of wPawns) {
        const er = e >> 4, ef = e & 15;
        if (ef >= f - 1 && ef <= f + 1 && er > row) { passed = false; break; }
      }
      if (passed) score -= PASSED_BONUS[row - 1] || 140;
    }

    /* 双象 */
    if (bishopsW >= 2) score += 30;
    if (bishopsB >= 2) score -= 30;

    /* 车路：开放线/半开放线 */
    for (const sq of wRooks) {
      const f = sq & 15;
      if (!wFile[f] && !bFile[f]) score += 16;
      else if (!wFile[f]) score += 8;
    }
    for (const sq of bRooks) {
      const f = sq & 15;
      if (!wFile[f] && !bFile[f]) score -= 16;
      else if (!bFile[f]) score -= 8;
    }

    /* 王城安全（中局） */
    if (!endgame) score += kingShield(game, WHITE) - kingShield(game, BLACK);

    /* 行棋方便宜 */
    score += game.turn === WHITE ? 10 : -10;
    return score;
  }

  const sameMove = (a, b) => !!a && !!b && a.from === b.from && a.to === b.to && a.promotion === b.promotion;
  const moveKey = m => m.from * 8192 + m.to * 64 + (m.promotion || 0);

  /* ---------- 搜索 ---------- */
  function search(game, options) {
    const opts = Object.assign({
      depth: 3, maxTimeMs: 1500, randomness: 0, blunderChance: 0, useQuiescence: true
    }, options || {});
    const start = Date.now();
    const deadline = start + opts.maxTimeMs;
    let nodes = 0, timeUp = false;
    const killers = []; for (let i = 0; i < 64; i++) killers.push([null, null]);
    const historyTab = new Int32Array(1 << 20);
    const us = game.turn;

    /* 搜索路径中出现重复局面 -> 视作和棋分（避免来回长将） */
    function isRepetition() {
      const hh = game.hashHistory;
      const cur = game.hash;
      const limit = Math.min(game.halfmove, hh.length - 1);
      for (let i = hh.length - 2; i >= hh.length - 1 - limit && i >= 0; i--) {
        if (hh[i] === cur) return true;
      }
      return false;
    }

    const evalSide = () => { const e = evaluate(game); return game.turn === WHITE ? e : -e; };

    function orderMoves(moves, ply, prevBest) {
      for (const m of moves) {
        let s;
        if (prevBest && sameMove(prevBest, m)) s = 1e6;
        else if (m.captured) s = 1e5 + PIECE_VALUE[typeOf(m.captured)] * 8 - PIECE_VALUE[typeOf(m.piece)];
        else if (m.promotion) s = 9e4;
        else {
          const k = killers[ply] || [null, null];
          if (sameMove(k[0], m)) s = 8e4;
          else if (sameMove(k[1], m)) s = 7.9e4;
          else s = historyTab[moveKey(m)];
        }
        m._s = s;
      }
      moves.sort((a, b) => b._s - a._s);
    }

    /* 静态搜索：只延伸吃子/升变，消除"水平线效应" */
    function quiesce(alpha, beta, ply) {
      if ((nodes & 2047) === 0 && Date.now() > deadline) timeUp = true;
      if (timeUp) return alpha;
      nodes++;
      const stand = evalSide();
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (ply > 28) return alpha;
      const caps = [];
      for (const m of game._generatePseudo()) if (m.captured || m.promotion) caps.push(m);
      caps.sort((a, b) =>
        ((b.captured ? PIECE_VALUE[typeOf(b.captured)] * 10 : 0) + (b.promotion ? PIECE_VALUE[b.promotion] : 0) - PIECE_VALUE[typeOf(b.piece)])
        - ((a.captured ? PIECE_VALUE[typeOf(a.captured)] * 10 : 0) + (a.promotion ? PIECE_VALUE[a.promotion] : 0) - PIECE_VALUE[typeOf(a.piece)]));
      for (const m of caps) {
        const mover = colorOf(m.piece);
        game._makeMove(m);
        if (game.inCheck(mover)) { game._unmakeMove(); continue; } // 跳过非法着法
        const s = -quiesce(-beta, -alpha, ply + 1);
        game._unmakeMove();
        if (timeUp) return alpha;
        if (s >= beta) return s;
        if (s > alpha) alpha = s;
      }
      return alpha;
    }

    function negamax(depth, alpha, beta, ply) {
      if ((nodes & 2047) === 0 && Date.now() > deadline) timeUp = true;
      if (timeUp) return 0;
      nodes++;
      if (game.halfmove >= 100) return 0;
      if (ply > 0 && isRepetition()) return 0;
      const inChk = game.inCheck();
      if (depth <= 0) {
        if (inChk) depth = 1;                      // 将军延伸
        else return opts.useQuiescence ? quiesce(alpha, beta, ply) : evalSide();
      }
      const moves = game.generateMoves();
      if (!moves.length) return inChk ? -MATE + ply : 0; // 将杀 / 逼和
      orderMoves(moves, ply, null);
      let best = -Infinity;
      for (const m of moves) {
        game._makeMove(m);
        const s = -negamax(depth - 1, -beta, -alpha, ply + 1);
        game._unmakeMove();
        if (timeUp) return best > -Infinity ? best : alpha;
        if (s > best) best = s;
        if (s > alpha) alpha = s;
        if (alpha >= beta) {
          if (!m.captured) { // 安静着法触发截断 -> 记入杀手/历史表
            const k = killers[ply];
            if (!sameMove(k[0], m)) { k[1] = k[0]; k[0] = m; }
            historyTab[moveKey(m)] += depth * depth;
          }
          break;
        }
      }
      return best;
    }

    /* ---------- 根结点：迭代加深 ---------- */
    const rootMoves = game.generateMoves();
    if (!rootMoves.length) return null;
    let best = null, bestScore = -Infinity, reachedDepth = 0;
    const rootScores = new Map();

    for (let d = 1; d <= opts.depth; d++) {
      orderMoves(rootMoves, 0, best);
      let alpha = -Infinity, iterBest = null, iterScore = -Infinity;
      for (const m of rootMoves) {
        game._makeMove(m);
        const s = -negamax(d - 1, -Infinity, -alpha, 1);
        game._unmakeMove();
        if (timeUp) break;
        rootScores.set(moveKey(m), s);
        if (s > iterScore) { iterScore = s; iterBest = m; }
        if (s > alpha) alpha = s;
      }
      if (iterBest && (!timeUp || d === 1)) { best = iterBest; bestScore = iterScore; reachedDepth = d; }
      if (timeUp) break;
      if (Math.abs(bestScore) > MATE - 1000) break; // 已找到杀棋
    }

    /* ---------- 低难度：在前几名里带随机地挑（可赢但不弱智） ---------- */
    let chosen = best, chosenScore = bestScore;
    if (opts.randomness > 0 || opts.blunderChance > 0) {
      const entries = [];
      for (const m of rootMoves) {
        const s = rootScores.has(moveKey(m)) ? rootScores.get(moveKey(m)) : -Infinity;
        entries.push({ m, s });
      }
      entries.sort((a, b) => b.s - a.s);
      const top = entries.length ? entries[0].s : 0;
      let pool = entries.filter(e => e.s > -Infinity && e.s >= top - Math.max(opts.randomness, 0));
      if (opts.blunderChance > 0 && Math.random() < opts.blunderChance) {
        const loose = entries.filter(e => e.s > -Infinity && e.s >= top - 300);
        if (loose.length) pool = loose;
      }
      if (pool.length) {
        const weights = pool.map((_, i) => 1 / Math.pow(1.6, i));
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < pool.length; i++) {
          r -= weights[i];
          if (r <= 0) { chosen = pool[i].m; chosenScore = pool[i].s; break; }
        }
      }
    }

    return {
      move: chosen ? { from: chosen.from, to: chosen.to, promotion: chosen.promotion, flags: chosen.flags, piece: chosen.piece, captured: chosen.captured } : null,
      score: chosenScore,                                        // 行棋方视角
      scoreWhite: us === WHITE ? chosenScore : -chosenScore,     // 白方视角
      bestScore, bestMove: best ? { from: best.from, to: best.to, promotion: best.promotion, piece: best.piece, captured: best.captured } : null,
      depth: reachedDepth, nodes, timeMs: Date.now() - start
    };
  }

  /* 分析一个局面：返回最佳着法与白方视角评估（复盘用） */
  function analyzePosition(game, opts) {
    const o = Object.assign({ randomness: 0, blunderChance: 0, maxTimeMs: 800, useQuiescence: true }, opts || {});
    const r = search(game, o);
    if (!r) {
      // 无着法可走：将杀 / 逼和
      const mated = game.isCheckmate();
      const scoreWhite = mated ? (game.turn === WHITE ? -MATE : MATE) : 0;
      return { scoreWhite, bestScore: scoreWhite, best: null, isMate: mated, mateIn: 0, terminal: true, nodes: 0, depth: 0 };
    }
    const isMate = Math.abs(r.bestScore) > MATE - 1000;
    const mateIn = isMate ? Math.ceil((MATE - Math.abs(r.bestScore)) / 2) : 0;
    return {
      scoreWhite: r.scoreWhite, bestScore: r.bestScore,
      best: r.bestMove, isMate, mateIn, terminal: false,
      nodes: r.nodes, depth: r.depth
    };
  }

  /* 四档难度参数：深度 / 随机窗口 / 偶发失误率 / 时间上限 */
  const DIFFICULTIES = {
    1: { name: '入门', depth: 1, randomness: 150, blunderChance: 0.20, maxTimeMs: 800, useQuiescence: false },
    2: { name: '初级', depth: 2, randomness: 90, blunderChance: 0.07, maxTimeMs: 1200, useQuiescence: true },
    3: { name: '中级', depth: 3, randomness: 30, blunderChance: 0, maxTimeMs: 2000, useQuiescence: true },
    4: { name: '高级', depth: 4, randomness: 0, blunderChance: 0, maxTimeMs: 2600, useQuiescence: true }
  };

  return { MATE, PIECE_VALUE, evaluate, nonPawnMaterial, search, analyzePosition, DIFFICULTIES };
});
