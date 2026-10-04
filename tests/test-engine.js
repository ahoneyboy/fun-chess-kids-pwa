/* ============================================================
 * AI 引擎冒烟测试：找到杀棋、抓住战术机会、评估方向正确、性能达标
 * 运行：node tests/test-engine.js
 * ============================================================ */
const { Chess } = require('../js/chess-core.js');
const Engine = require('../js/engine.js');

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('✅ ' + name + (extra ? ' —— ' + extra : ''));
  else { failed++; console.log('❌ ' + name + (extra ? ' —— ' + extra : '')); }
}

/* 1. 搜索找到底线将杀 Re8# */
{
  const g = new Chess('6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1');
  const r = Engine.search(g, { depth: 2, maxTimeMs: 2000 });
  const san = g.clone().sanOfMove(r.move);
  check('找到 Re8# 底线将杀', san === 'Re8#', `实际 ${san}，评分 ${r.score}`);
}

/* 2. 抓住捉双（Nc7+ 同时攻击王与车） */
{
  const g = new Chess('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
  const r = Engine.search(g, { depth: 3, maxTimeMs: 3000 });
  const san = g.clone().sanOfMove(r.move);
  check('深度3找到 Nc7+ 捉双', san === 'Nc7+', `实际 ${san}`);
}

/* 3. 评估方向：白方多车 -> 白方视角为正（无论轮谁走） */
{
  const gw = new Chess('k7/8/8/8/8/8/8/K5R1 w - - 0 1');
  const gb = new Chess('k7/8/8/8/8/8/8/K5R1 b - - 0 1');
  check('评估白优且方向一致', Engine.evaluate(gw) > 300 && Engine.analyzePosition(gb, { depth: 1 }).scoreWhite > 300,
    `静态=${Engine.evaluate(gw)} 搜索=${Engine.analyzePosition(gb, { depth: 1 }).scoreWhite}`);
}

/* 4. 起始局面评估接近均衡 */
{
  const g = new Chess();
  const e = Engine.evaluate(g);
  check('起始局面评估接近 0', Math.abs(e) < 80, `评估=${e}`);
}

/* 5. 性能：高级难度在中局局面 3 秒内走出合理着法 */
{
  const g = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
  const t0 = Date.now();
  const r = Engine.search(g, Engine.DIFFICULTIES[4]);
  const ms = Date.now() - t0;
  check('高级难度 3.5s 内出着', !!r.move && ms < 3500, `用时 ${ms}ms 节点 ${r.nodes} 深度 ${r.depth}`);
}

/* 6. 不送后：被攻击时知道逃走或防守 */
{
  // 白后 d1 被黑马 b2? 构造：黑车攻击白后，白应走掉后
  const g = new Chess('4k3/8/8/8/8/8/1r6/3Q2K1 w - - 0 1');
  const r = Engine.search(g, { depth: 3, maxTimeMs: 3000 });
  const san = g.clone().sanOfMove(r.move);
  check('白后懂得避开 b2 黑车（不走向被吃格）', !['Qd2'].includes(san) && san !== 'Qxb2', `实际 ${san}`);
}

console.log(failed === 0 ? '\n全部引擎测试通过 ✅' : `\n${failed} 项引擎测试失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
