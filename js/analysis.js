/* ============================================================
 * 趣棋小将 FunChess Kids · 智能复盘分析器
 * ------------------------------------------------------------
 *  - 逐着对比「实际走法 vs 引擎最佳走法」，计算分差(cpLoss)
 *  - 失误分级：>=80cp 小失误 / >=150cp 大失误 / >=400cp 送子级
 *  - 失误归类：material 送子、missedCapture 漏吃、missedMate 错失将杀、
 *              tactic 漏看战术、opening 开局违例、endgame 残局失误
 *  - 面向儿童的"小兵讲棋"点评文案 + 整局总结 + 3~5 条优化步骤
 * 主线程与 Web Worker 共用（无 DOM 依赖）。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chess-core.js'), require('./engine.js'));
  else root.FunChessAnalysis = factory(root.FunChess, root.FunChessEngine);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (FC, Engine) {
  'use strict';
  const { Chess, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, typeOf, colorOf, algebraic, PIECE_NAME_CN } = FC;
  const MATE = Engine.MATE;
  const VAL = Engine.PIECE_VALUE;

  const clampCp = v => Math.max(-MATE, Math.min(MATE, v));

  /* 某方所有非兵非王子力 */
  function npmOf(game, color) {
    let n = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = game.board[sq];
      if (!p || colorOf(p) !== color) continue;
      const t = typeOf(p);
      if (t !== PAWN && t !== KING) n += VAL[t];
    }
    return n;
  }

  /* 局面阶段：开局(前10回合) / 残局(轻重重子<=13分) / 中局 */
  function detectPhase(game) {
    const npm = npmOf(game, WHITE) + npmOf(game, BLACK);
    if (npm <= 1300) return 'endgame';
    if (game.fullmove <= 10) return 'opening';
    return 'middlegame';
  }
  const PHASE_CN = { opening: '开局', middlegame: '中局', endgame: '残局' };

  /* 对手（即将行棋方）最大威胁：白吃多少分（用于识别送子） */
  function biggestThreat(game) {
    let best = 0, bestTo = -1;
    const mover = game.turn; // 刚走完的一方
    for (const m of game.generateMoves()) {
      if (!m.captured) continue;
      let gain = VAL[typeOf(m.captured)];
      // 目标格是否有保护（走子方其他子可回吃）
      let defended = false;
      game._makeMove(m);
      for (const r of game.generateMoves()) {
        if (r.captured && r.to === m.to) { defended = true; break; }
      }
      game._unmakeMove();
      if (defended) gain -= VAL[typeOf(m.piece)];
      if (gain > best) { best = gain; bestTo = m.to; }
    }
    return { gain: best, square: bestTo };
  }

  /* 误判类型 + 面向儿童的点评 */
  function classifyPly(ctx) {
    const {
      moveNo, san, side,            // side: 'w' | 'b'（走棋一方）
      evalBefore, evalAfter,        // 白方视角 cp（最佳应对下的局面分）
      best, bestSan,                // 走棋前的引擎最佳着法
      fenAfter, phase
    } = ctx;

    // 行棋方视角的分差（正 = 损失）
    const rawLoss = side === 'w' ? (evalBefore - evalAfter) : (evalAfter - evalBefore);
    const cpLoss = Math.max(0, Math.round(clampCp(rawLoss)));

    let level = 'none';
    if (cpLoss >= 400) level = 'blunder';
    else if (cpLoss >= 150) level = 'mistake';
    else if (cpLoss >= 80) level = 'minor';

    let type = 'none';
    if (level !== 'none') {
      const moverWinningMateBefore = best ? (side === 'w' ? evalBefore > MATE - 1000 : evalBefore < -(MATE - 1000)) : false;
      const moverWinningMateAfter = side === 'w' ? evalAfter > MATE - 1000 : evalAfter < -(MATE - 1000);
      const bestWasCapture = !!(best && best.captured);
      const bestTargetName = best && best.captured ? PIECE_NAME_CN[typeOf(best.captured)] + algebraic(best.to) : '';

      // 走完后对手能白吃多少（送子识别）
      let threat = { gain: 0, square: -1 };
      try { threat = biggestThreat(new Chess(fenAfter)); } catch (e) { /* 忽略 */ }
      const hanging = threat.gain >= 250;

      if (moverWinningMateBefore && !moverWinningMateAfter) type = 'missedMate';
      else if (bestWasCapture && cpLoss >= 150) type = 'missedCapture';
      else if (cpLoss >= 400) type = hanging ? 'material' : 'tactic';
      else if (cpLoss >= 150 && hanging) type = 'material';
      else if (phase === 'opening' && moveNo <= 10) type = 'opening';
      else if (phase === 'endgame') type = 'endgame';
      else type = 'tactic';

      const praise = ['稳稳的一步！', '不错哦，继续！', '好样的！', '很有想法的一步！'];
      const P = () => praise[Math.floor(Math.random() * praise.length)];
      const pieceCn = ctx.pieceCn || '棋子';

      const T = {
        none: () => san.includes('x') ? `👍 ${san} 吃到了好东西，${P()}` : (moveNo % 5 === 1 ? P() : ''),
        minor: () => `🤔 ${san} 之后有一点小损失，其实 ${bestSan} 更稳一点。没关系，小失误提醒我们多看一眼！`,
        mistake: {
          missedCapture: () => `👀 差一点！对手的${bestTargetName}没有保护，走 ${bestSan} 就能白赚一个。下次先找找"谁没被保护"！`,
          missedMate: () => `🏆 太可惜了，${bestSan} 可以直接将杀获胜！下次出击前先想一想"能不能一步将死对方"。`,
          material: () => `⚠️ ${san} 之后，${PIECE_NAME_CN[ctx.movedType] || pieceCn}会被对手白白吃掉。应该走 ${bestSan} 先保住它。走棋前记得数一数：我的子有保护吗？`,
          tactic: () => `⚡ 这步漏了对方的战术！${bestSan} 才是好棋。别灰心，战术题练多了自然就能看见啦。`,
          opening: () => `📚 开局要记住三件事：占领中心、快点出马和象、早点王车易位。${bestSan} 更符合开局原则哦。`,
          endgame: () => `🏰 残局里每一步都很关键，${bestSan} 会更好。记住：残局里王要勇敢地走出来帮忙！`
        },
        blunder: {
          missedMate: () => `🏆 最后一击就在眼前！${bestSan} 直接将杀。深呼吸，找一找对手王的出口被谁堵住了～`,
          missedCapture: () => `👀 哎呀，${bestTargetName}就摆在嘴边！走 ${bestSan} 可以白吃一个大子，下次记得"先找没保护的子"。`,
          material: () => `😭 ${san} 把${PIECE_NAME_CN[ctx.movedType] || pieceCn}送到了对手嘴边，${bestSan} 才能保住它。别灰心！走棋前默念："我的子有人保护吗？"`,
          tactic: () => `⚡ 对手的战术被抓了个正着！${bestSan} 能避开。多练练捉双和牵制题，你也能发现这些小陷阱。`,
          opening: () => `📚 开局阶段这一步损失有点大，${bestSan} 更稳。回想开局三原则：中心、出子、易位！`,
          endgame: () => `🏰 残局关键一步走偏了，${bestSan} 更好。残局练习会帮你在最后关头顶住！`
        }
      };
      const bucket = level === 'mistake' ? T.mistake : level === 'blunder' ? T.blunder : null;
      let comment = '';
      if (bucket) comment = (bucket[type] || bucket.tactic)();
      else comment = T.none();
      if (!comment) comment = '';

      return { cpLoss, level, type, comment, threatGain: threat.gain, bestSan, bestTargetName };
    }

    // 无明显失误：简短鼓励
    let comment = '';
    if (san && san.includes('#')) comment = `🎉 将杀！太棒了！`;
    else if (san && san.includes('x')) comment = `👍 ${san}，吃到子了！`;
    else if (san && san.includes('+')) comment = `✨ ${san} 将军！看对手怎么躲。`;
    return { cpLoss, level: 'none', type: 'none', comment, threatGain: 0, bestSan, bestTargetName: '' };
  }

  /* 单着准确率（儿童宽松口径） */
  function moveAccuracy(cpLoss) { return Math.round(100 * Math.exp(-cpLoss / 400)); }

  /* 整局总结：分阶段评价 + 优化步骤清单 + 星级 */
  function buildSummary(plies, meta) {
    // plies: [{moveNo, side, san, fenAfter, evalBefore, evalAfter, bestSan, cpLoss, level, type, comment, phase}]
    const phases = { opening: [], middlegame: [], endgame: [] };
    for (const p of plies) (phases[p.phase] || phases.middlegame).push(p);

    const phaseStat = {};
    for (const k of Object.keys(phases)) {
      const arr = phases[k];
      if (!arr.length) { phaseStat[k] = { count: 0 }; continue; }
      const avg = Math.round(arr.reduce((s, p) => s + p.cpLoss, 0) / arr.length);
      const worst = arr.reduce((a, b) => (b.cpLoss > a.cpLoss ? b : a), arr[0]);
      const acc = Math.round(arr.reduce((s, p) => s + moveAccuracy(p.cpLoss), 0) / arr.length);
      let text;
      if (k === 'opening') text = acc >= 80 ? '开局很扎实，出子和中心都做得不错！' : '开局阶段有几步可以更稳：先出马象、占领中心、早点易位。';
      else if (k === 'middlegame') text = acc >= 80 ? '中局思路清晰，战术嗅觉很棒！' : '中局是得分关键！多练捉双、牵制，走棋前先看看对手想干什么。';
      else text = acc >= 80 ? '残局收得漂亮，王也很活跃！' : '残局还需要加练：记住让王走出来、通路兵快步冲！';
      phaseStat[k] = { count: arr.length, avgLoss: avg, accuracy: acc, worst: { moveNo: worst.moveNo, san: worst.san, bestSan: worst.bestSan }, comment: text };
    }

    const accuracy = plies.length ? Math.round(plies.reduce((s, p) => s + moveAccuracy(p.cpLoss), 0) / plies.length) : 100;
    const stars = accuracy >= 80 ? 3 : accuracy >= 60 ? 2 : 1;

    /* 优化步骤：按严重度降序取 3~5 条 */
    const mistakes = plies.filter(p => p.level !== 'none' && p.type !== 'none');
    mistakes.sort((a, b) => b.cpLoss - a.cpLoss);
    const DRILLS = {
      material: { label: '防护与送子检查', link: '#/quiz?type=tactic' },
      missedCapture: { label: '捉子与无保护子练习', link: '#/quiz?type=fork' },
      missedMate: { label: '一步将杀专项', link: '#/quiz?type=mate' },
      tactic: { label: '战术闯关', link: '#/quiz' },
      opening: { label: '重学《开局三原则》', link: '#/lesson/opening-principles' },
      endgame: { label: '残局专项挑战', link: '#/quiz?tab=endgame' }
    };
    const improvements = mistakes.slice(0, 5).map(p => ({
      moveNo: p.moveNo,
      side: p.side,
      phase: p.phase,
      ply: p.ply,
      fenBefore: p.fenBefore, // 失误决策点的局面
      played: p.san,
      best: p.bestSan,
      cpLoss: p.cpLoss,
      reason: p.comment,
      drill: DRILLS[p.type] || DRILLS.tactic,
      type: p.type
    })).filter(x => x.best); // 必须有更优着法才可执行

    const gradeText = stars === 3 ? '这盘棋下得非常棒，像个小棋士！' : stars === 2 ? '不错的对局！按下面的步骤练一练，下一盘更厉害。' : '勇敢的尝试！跟着"优化步骤"练起来，进步会很快哦。';

    return { accuracy, stars, gradeText, phaseStat, improvements, mistakeCount: { minor: plies.filter(p => p.level === 'minor').length, mistake: plies.filter(p => p.level === 'mistake').length, blunder: plies.filter(p => p.level === 'blunder').length } };
  }

  /* 完整复盘：对整局逐着分析（Worker 与主线程兜底共用） */
  function analyzeGame(payload, onProgress) {
    const depth = payload.depth || 3;
    const perMoveMs = payload.maxTimePerMove || 600;
    const g = new Chess(payload.fen || FC.START_FEN);
    const sans = payload.moves || [];
    const post = (p) => { try { onProgress && onProgress(p); } catch (e) { /* 忽略 */ } };

    // 1) 逐局面评估（第 i 个局面 = 第 i 步之前，共 n+1 个）
    const snapshots = [];
    const total = sans.length + 1;
    for (let i = 0; i <= sans.length; i++) {
      const info = Engine.analyzePosition(g, { depth, maxTimeMs: perMoveMs });
      let bestSan = null;
      if (info.best) bestSan = g.sanOfMove(info.best);
      snapshots.push({
        fen: g.fen(), turn: g.turnColor(),
        evalWhite: info.scoreWhite, bestScore: info.bestScore,
        best: info.best, bestSan, isMate: info.isMate, mateIn: info.mateIn,
        phase: detectPhase(g)
      });
      if (i < sans.length) {
        const m = g.move(sans[i]);
        if (!m) throw new Error('复盘时着法无法应用：' + sans[i]);
      }
      post({ type: 'progress', done: i + 1, total });
    }

    // 2) 逐步对比与归类
    const out = [];
    for (let i = 0; i < sans.length; i++) {
      const before = snapshots[i], after = snapshots[i + 1];
      const side = before.turn;
      const moveNo = Math.floor(i / 2) + 1;
      const ctx = {
        ply: i, moveNo, side, san: sans[i],
        evalBefore: before.evalWhite, evalAfter: after.evalWhite,
        best: before.best, bestSan: before.bestSan,
        fenAfter: after.fen, phase: before.phase
      };
      // 实际走动的棋子种类（点评里说"把车送到嘴边"要知道是什么子）
      try {
        const posBefore = new Chess(before.fen);
        const mm = posBefore.move(sans[i]);
        if (mm) ctx.pieceCn = PIECE_NAME_CN[typeOf(mm.piece)] + algebraic(mm.from);
        ctx.movedType = mm ? typeOf(mm.piece) : 0;
      } catch (e) { /* 忽略 */ }
      const c = classifyPly(ctx);
      out.push({
        ply: i, moveNo, side, san: sans[i],
        fenBefore: before.fen, fenAfter: after.fen,
        evalBefore: before.evalWhite, evalAfter: after.evalWhite,
        bestSan: before.bestSan, bestMateIn: before.mateIn,
        cpLoss: c.cpLoss, level: c.level, type: c.type,
        comment: c.comment, phase: before.phase
      });
    }

    const summary = buildSummary(out, payload.meta || {});
    return { plies: out, summary, startFen: payload.fen || FC.START_FEN, sans };
  }

  return { classifyPly, buildSummary, analyzeGame, detectPhase, moveAccuracy, PHASE_CN };
});
