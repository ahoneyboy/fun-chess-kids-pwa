/* ============================================================
 * 内容库校验：所有课程演示着法、任务答案、题目解法、残局 FEN
 * 必须都能被规则引擎接受。
 * 运行：node tests/test-content.js
 * ============================================================ */
const { Chess } = require('../js/chess-core.js');
global.FC = {};
require('../js/content.js');
const C = global.FC.CONTENT;

let bad = 0;
const fail = m => { console.log('❌ ' + m); bad++; };

function tryMoves(fen, moves, label) {
  const g = new Chess(fen);
  for (const item of moves) {
    const san = typeof item === 'string' ? item : item.san;
    if (!san) continue;
    if (!g.move(san)) { fail(label + ' 着法非法: ' + san + ' | fen: ' + fen); return; }
  }
}

for (const l of C.lessons) {
  for (const d of (l.demos || [])) tryMoves(d.fen, d.moves, '课程[' + l.id + '][' + d.title + ']');
  if (l.task) {
    const g = new Chess(l.task.fen);
    if (!l.task.accept.some(s => { const m = g.move(s); if (m) { g.undo(); return true; } return false; }))
      fail('课程[' + l.id + ']任务无合法答案');
  }
}

for (const q of C.quizzes) {
  if (q.replies) {
    // 序列题：解法依次走 + 固定应手，最后必须将杀
    const g = new Chess(q.fen);
    let ok = true;
    for (let i = 0; i < q.solution.length; i++) {
      if (!g.move(q.solution[i])) { fail('题目[' + q.id + ']序列第' + (i + 1) + '步非法'); ok = false; break; }
      const reply = q.replies[i];
      if (reply && i < q.solution.length - 1 && !g.move(reply)) { fail('题目[' + q.id + ']应手非法'); ok = false; break; }
    }
    if (ok && q.type === 'mate' && !g.isCheckmate()) fail('题目[' + q.id + ']解答后未将杀');
  } else {
    // 单步多解题：每个解法独立可走
    for (const s of q.solution) {
      const g = new Chess(q.fen);
      if (!g.move(s)) fail('题目[' + q.id + ']解法非法: ' + s);
    }
  }
}

for (const e of C.endgames) {
  try { new Chess(e.fen); } catch (err) { fail('残局[' + e.id + '] FEN 非法: ' + e.fen); }
}

console.log(bad === 0
  ? '✅ 内容库全部校验通过：' + C.lessons.length + ' 课程 / ' + C.quizzes.length + ' 题 / ' + C.endgames.length + ' 残局'
  : '❌ ' + bad + ' 处问题');
process.exit(bad ? 1 : 0);
