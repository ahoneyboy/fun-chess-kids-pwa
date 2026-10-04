/* ============================================================
 * perft 测试：验证着法生成（含易位/吃过路兵/升变/将军过滤）
 * 的完全正确性 —— 各经典局面的着法数必须与公布值完全一致。
 * 运行：node tests/perft.js
 * ============================================================ */
const { Chess } = require('../js/chess-core.js');

const CASES = [
  {
    name: '起始局面',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expect: { 1: 20, 2: 400, 3: 8902, 4: 197281 }
  },
  {
    name: 'Kiwipete（易位/闪击密集）',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expect: { 1: 48, 2: 2039, 3: 97862 }
  },
  {
    name: '位置3（吃过路兵/牵制）',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expect: { 1: 14, 2: 191, 3: 2812, 4: 43238 }
  },
  {
    name: '位置4（升变/易位权）',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expect: { 1: 6, 2: 264, 3: 9467 }
  },
  {
    name: '位置5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expect: { 1: 44, 2: 1486, 3: 62379 }
  },
  {
    name: '位置6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    expect: { 1: 46, 2: 2079, 3: 89890 }
  }
];

let failed = 0;
for (const c of CASES) {
  for (const depth of Object.keys(c.expect).map(Number)) {
    const g = new Chess(c.fen);
    const t0 = Date.now();
    const n = g.perft(depth);
    const ok = n === c.expect[depth];
    if (!ok) failed++;
    console.log(`${ok ? '✅' : '❌'} ${c.name} depth=${depth}  得到 ${n}  期望 ${c.expect[depth]}  (${Date.now() - t0}ms)`);
  }
}
console.log(failed === 0 ? '\n全部 perft 测试通过 ✅' : `\n${failed} 项 perft 测试失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
