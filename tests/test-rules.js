/* ============================================================
 * 规则功能测试：SAN 回放、三次重复、50 回合、升变、吃过路兵、
 * 易位权利、逼和、子力不足。
 * 运行：node tests/test-rules.js
 * ============================================================ */
const { Chess, algebraic, typeOf, colorOf, makePiece, WHITE, BLACK } = require('../js/chess-core.js');

let failed = 0;
function check(name, cond, extra) {
  if (cond) { console.log('✅ ' + name); }
  else { failed++; console.log('❌ ' + name + (extra ? ' —— ' + extra : '')); }
}

/* 1. 完整 SAN 回放：歌剧之局（Morphy），最后一步将杀 */
{
  const g = new Chess();
  const sans = ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3', 'Qxf3', 'dxe5',
    'Bc4', 'Nf6', 'Qb3', 'Qe7', 'Nc3', 'c6', 'Bg5', 'b5', 'Nxb5', 'cxb5',
    'Bxb5+', 'Nbd7', 'O-O-O', 'Rd8', 'Rxd7', 'Rxd7', 'Rd1', 'Qe6',
    'Bxd7+', 'Nxd7', 'Qb8+', 'Nxb8', 'Rd8#'];
  let ok = true, bad = '';
  for (const san of sans) {
    const m = g.move(san);
    if (!m) { ok = false; bad = san; break; }
  }
  check('歌剧之局 SAN 完整回放' + (bad ? '（卡在 ' + bad + '）' : ''), ok);
  check('歌剧之局最终将杀', g.isCheckmate());
  check('歌剧之局 PGN 包含将杀着法', g.pgn().includes('Rd8#'));
  check('回放后悔棋可回到起始', (() => { const h = new Chess(); for (const s of sans) h.move(s); for (let i = 0; i < sans.length; i++) h.undo(); return h.fen() === new Chess().fen(); })());
}

/* 2. 三次重复局面判和 */
{
  const g = new Chess();
  for (const s of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) g.move(s);
  check('三次重复局面 isThreefold', g.isThreefold());
  check('三次重复局面 isDraw', g.isDraw());
}

/* 3. 50 回合规则 */
{
  const g = new Chess('k7/8/8/8/8/8/8/K6R w - - 99 60');
  g.move('Rh2');
  check('半回合计数到 100 判和（50 回合规则）', g.isDraw() && g.halfmove >= 100);
}

/* 4. 子力不足 */
{
  check('王象对王=子力不足', new Chess('k7/8/8/8/8/8/8/K6B w - - 0 1').hasInsufficientMaterial());
  check('王对王=子力不足', new Chess('k7/8/8/8/8/8/8/K7 w - - 0 1').hasInsufficientMaterial());
  check('有兵不判子力不足', !new Chess('k7/8/8/8/8/8/8/KP6 w - - 0 1').hasInsufficientMaterial());
  check('同色格双象不足', new Chess('k7/8/2b5/8/8/8/8/K2B4 w - - 0 1').hasInsufficientMaterial());
}

/* 5. 吃过路兵 */
{
  const g = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
  const m = g.move('exf6');
  check('吃过路兵可以执行', !!m && m.flags & 2);
  check('吃过路兵后兵落到 f6', g.get('f6') === makePiece(WHITE, 1));
  check('吃过路兵后 e5 清空', g.get('e5') === 0);
  check('吃过路兵后 d5 黑兵仍在', g.get('d5') === makePiece(BLACK, 1));
}

/* 6. 升变 */
{
  const g = new Chess('8/P7/8/8/8/8/8/k1K5 w - - 0 1');
  const m = g.move('a8=Q');
  check('升变成功且默认升后', !!m && typeOf(g.get('a8')) === 5 && colorOf(g.get('a8')) === WHITE);
  check('升变 SAN 正确（该局面为将杀）', m.san === 'a8=Q#');
  // 指定升变马
  const g2 = new Chess('8/P7/8/8/8/8/8/k1K5 w - - 0 1');
  g2.move({ from: 'a7', to: 'a8', promotion: 'n' });
  check('按对象升变为马', typeOf(g2.get('a8')) === 2);
}

/* 7. 易位权利：走车方的权利同时失去，被吃角车的方也失去对应权利 */
{
  const g = new Chess('r3k3/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  g.move('Rxa8+');
  const parts = g.fen().split(' ')[2];
  // 白方走了 a1 车（失去 Q），黑方 a8 车被吃（失去 q）；双方短易位权保留
  check('吃角车后权利为 Kk（白 Q 与黑 q 均失去）', parts === 'Kk');
  const g2 = new Chess('r3k3/2N5/8/8/8/8/8/4K3 w kq - 0 1');
  g2.move('Nxa8');
  check('马吃角车只影响黑方 q 权利', g2.fen().split(' ')[2] === 'k');
}

/* 8. 被将军/穿越受攻击格时不能易位 */
{
  const g = new Chess('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1'); // 黑车 f2 攻击 f1
  const moves = g.generateMoves();
  const hasOO = moves.some(m => m.flags & 4);
  const hasOOO = moves.some(m => m.flags & 8);
  check('f1 受攻击时不能短易位', !hasOO);
  check('长易位仍可走', hasOOO);
}

/* 9. 逼和 */
{
  const g = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  check('典型逼和局面', g.isStalemate() && !g.inCheck(BLACK));
}

/* 10. SAN 解析：坐标 / 消歧 / O-O */
{
  const g = new Chess();
  g.move('e2e4'); g.move('e7e5');
  check('坐标格式 e2e4 可解析', g.historyVerbose().length === 2);
  const g2 = new Chess('1k6/8/8/R7/8/8/8/R5K1 w - - 0 1'); // 两车都在 a 列? a5/a1 同列 -> 用行消歧
  const m = g2.move('R1a3');
  check('同列双车用行号消歧 R1a3', !!m && m.san === 'R1a3');
  const g3 = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  g3.move('O-O');
  check('O-O 记谱可解析且王到位', algebraic(g3.kings[WHITE]) === 'g1');
  check('短易位后车到位', algebraic(g3.get('f1') ? g3.historyVerbose().at(-1).to : -1) === 'f1' || typeOf(g3.get('f1')) === 4);
}

/* 11. 将杀/将军 SAN 后缀 */
{
  const g = new Chess();
  g.move('f3'); g.move('e5'); g.move('g4');
  const m = g.move('Qh4');
  check('学者将杀 SAN 为 Qh4#', m.san === 'Qh4#');
}

/* 12. FEN 往返 */
{
  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 b - - 3 42'
  ];
  let ok = true;
  for (const f of fens) if (new Chess(f).fen() !== f) ok = false;
  check('FEN 读写往返一致', ok);
}

console.log(failed === 0 ? '\n全部规则测试通过 ✅' : `\n${failed} 项规则测试失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
