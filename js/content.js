/* ============================================================
 * 趣棋小将 · 内容库：课程 / 战术题库 / 残局挑战 / 贴士
 * 所有 FEN 与着法均经过规则引擎校验。
 * ============================================================ */
(function (root) {
  'use strict';
  const FC = root.FC = root.FC || {};

  FC.CONTENT = {

    /* ============ 学习课程 ============ */
    lessons: [
      {
        id: 'pieces-intro', icon: '🐴', title: '认识棋子朋友', stars: 2,
        summary: '和 6 个棋子朋友打个招呼：马会跳、象走斜线、车跑直线！',
        sections: [
          { h: '棋盘和棋子', p: '棋盘有 64 个格子，深浅相间。白方 16 个子，黑方 16 个子，每方都有一个最重要的"王"。' },
          { h: '马 🐴 走"日"字', p: '马走"日"字，先直两格再拐一格，它是唯一能跳过其他棋子的棋子！' },
          { h: '象 🐘 走斜线', p: '象沿着斜线走，永远只能待在同一种颜色的格子上，所以它有一双"彩色的眼睛"。' },
          { h: '车 🚗 走直线', p: '车横着走、竖着走，只要路上没有挡路的棋子，它能一口气冲到底。' },
          { h: '后 👑 最强大', p: '后像车和象的合体，横竖斜都能走，是棋盘上最强大的棋子。' },
          { h: '王 👦 最重要', p: '王每次只能走一小格，王被抓死（将杀）这盘棋就输啦。' }
        ],
        demos: [
          { title: '马走"日"字', fen: 'k7/8/8/8/8/8/8/K5N1 w - - 0 1', moves: [
            { san: 'Nf3', note: '马走"日"字：横两格竖一格，还能跳过别的棋子！' },
            { san: 'Kb8', note: '' },
            { san: 'Nh4', note: '再跳一下，马落点总是跟出发点颜色不同哦。' },
            { san: 'Ka8', note: '' },
            { san: 'Ng6', note: '马在棋盘中央最厉害，能管到 8 个格子。' }] },
          { title: '象走斜线', fen: 'k7/8/8/8/8/8/8/K4B2 w - - 0 1', moves: [
            { san: 'Bc4', note: '象沿斜线飞行，一格都不许拐弯。' },
            { san: 'Kb8', note: '' },
            { san: 'Bg8', note: '象一口气飞到对面底线，它永远只能踩同一种颜色的格子。' }] },
          { title: '车跑直线', fen: 'k7/8/8/8/8/8/8/K6R w - - 0 1', moves: [
            { san: 'Rh8+', note: '车横冲直撞！路上有子就得停下或吃掉它。' }] }
        ],
        task: { fen: 'k7/8/8/3n4/8/2N5/8/K7 w - - 0 1', goal: '用马吃掉黑马（马走"日"字），点击白马再点黑马吧！', accept: ['Nxd5'], hint: '马从 c3 出发，跳"日"字正好踩到 d5。' }
      },
      {
        id: 'pawn', icon: '🎖️', title: '小兵大冒险', stars: 2,
        summary: '兵只能向前走，但升变后能变成最强的后！',
        sections: [
          { h: '向前冲！', p: '兵只能向前走，不能后退。第一步可以走 1 格或 2 格，以后每次只能走 1 格。' },
          { h: '斜着吃子', p: '兵吃子是斜着吃的：左前或右前一格有敌子才能吃。正面挡住是吃不到的！' },
          { h: '升变 👑', p: '小兵勇敢冲到底线，就能升级成后、车、象或马（通常选后）！' }
        ],
        demos: [
          { title: '兵的走法', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'e4', note: '白兵第一步可以走两格！' },
            { san: 'e5', note: '黑兵也可以。' },
            { san: 'd4', note: '再往前就只能一格一格走了。' },
            { san: 'd5', note: '两个兵正面相遇，谁也吃不到谁。' }] },
          { title: '升变时刻', fen: '8/P7/8/8/8/8/8/k1K5 w - - 0 1', moves: [
            { san: 'a8=Q+', note: '小兵到达底线，升级成后！这就是"升变"。' }] }
        ],
        task: { fen: '4k3/8/8/8/4n3/3P4/8/4K3 w - - 0 1', goal: '用兵斜着吃掉黑马！', accept: ['dxe4'], hint: '兵不直着吃，要斜着吃：d3 的兵可以吃 e4 的马。' }
      },
      {
        id: 'knight-bishop', icon: '🐎', title: '马和象的好搭档', stars: 2,
        summary: '马跳"日"字管 8 个方向，象在斜线上飞驰，组合起来威力翻倍！',
        sections: [
          { h: '马在中央最强', p: '马在角落只能跳 2 格，在中央能管 8 格。所以开局要把马请到中心附近。' },
          { h: '象要放出来', p: '象被自己小兵堵住就没用了，开局要早点把象"放"出来。' },
          { h: '双象是好搭档', p: '一黑一白两个象配合，能覆盖整个棋盘！' }
        ],
        demos: [
          { title: '马的跳跃', fen: 'k7/8/8/8/8/8/8/K5N1 w - - 0 1', moves: [
            { san: 'Nf3', note: '从角落跳出来。' },
            { san: 'Kb8', note: '' },
            { san: 'Nd4', note: '中央的马最灵活！' }] },
          { title: '象的长距离射击', fen: 'k7/8/8/8/8/8/8/K4B2 w - - 0 1', moves: [
            { san: 'Bb5', note: '象一格飞了四格远！' }] }
        ],
        task: { fen: '4k3/8/8/8/2b5/8/8/4KB2 w - - 0 1', goal: '用象吃掉黑象（象走斜线）！', accept: ['Bxc4'], hint: 'f1 的象沿斜线 a6-f1 方向正好撞见 c4 的黑象。' }
      },
      {
        id: 'rook-queen', icon: '🚗', title: '车和后：大力士', stars: 2,
        summary: '车横竖冲撞，后无所不能 —— 学会使用最强大的棋子！',
        sections: [
          { h: '车的直线威力', p: '车在开放直线（没有兵挡路）上威力最大，两车在底线叠起来叫"叠车"。' },
          { h: '后要晚点出动', p: '后最强，也最怕被小兵和轻子追着跑。开局别急着把后放出去。' }
        ],
        demos: [
          { title: '车的底线威慑', fen: 'k7/8/8/8/8/8/8/K6R w - - 0 1', moves: [
            { san: 'Rh8+', note: '车一上底线，就把黑王按在角落里！' }] },
          { title: '后的全方向', fen: 'k7/8/8/8/8/8/1Q5K/8 w - - 0 1', moves: [
            { san: 'Qg7', note: '后横竖斜都能走，一步飞到大斜线中央！' }] }
        ],
        task: { fen: 'k2r4/8/8/8/8/8/8/3RK3 w - - 0 1', goal: '用车吃掉黑车！', accept: ['Rxd8'], hint: 'd1 的车沿 d 线直冲到底，d8 有一辆黑车。' }
      },
      {
        id: 'king-check', icon: '👑', title: '王与将军', stars: 2,
        summary: '王被攻击叫"将军"，必须马上应对：跑、挡、吃！',
        sections: [
          { h: '什么是将军', p: '你的王被对方棋子攻击，就叫"被将军"。这时候必须先救王，不能走别的棋！' },
          { h: '三种救王方法', p: '① 跑：王走到安全格子；② 挡：用别的棋子挡在中间；③ 吃：把攻击的棋子吃掉。' },
          { h: '王贴王', p: '两个王不能挨在一起，王的"气场"能赶走对方的王。' }
        ],
        demos: [
          { title: '将军！', fen: 'k7/8/8/8/8/8/8/1Q5K w - - 0 1', moves: [
            { san: 'Qb7+', note: '后被攻击？不，是后攻击王 —— 这就是"将军"！黑王必须马上应对。' }] }
        ],
        task: { fen: '8/8/8/8/8/8/4r3/4K3 w - - 0 1', goal: '白王被车将军了！救王（跑、挡或吃都可以）。', accept: ['Kxe2', 'Kd1', 'Kf1'], hint: '黑车没有保护 —— 直接吃掉它也是救王的方法！' }
      },
      {
        id: 'checkmate', icon: '🏁', title: '将杀与逼和', stars: 2,
        summary: '王被将军又无处可逃 = 将杀获胜；没被将军却无路可走 = 逼和（和棋）！',
        sections: [
          { h: '将杀 = 获胜', p: '王被将军，而且跑不掉、挡不住、吃不了，就是"将杀"，这盘棋结束！' },
          { h: '小心逼和', p: '如果对方王没被将军却无路可走，叫"逼和"，结果是和棋！领先很多时千万别大意。' }
        ],
        demos: [
          { title: '愚人将杀（4 步速胜）', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'f3', note: '白方随便走了两步小兵……' },
            { san: 'e5', note: '黑方占领中心。' },
            { san: 'g4', note: '白方又走了一个小兵，王城大门打开了！' },
            { san: 'Qh4#', note: '将杀！黑后沿着对角线直取白王。这就是著名的"愚人将杀"。' }] },
          { title: '逼和陷阱', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', moves: [],
            note: '黑王没有被将军，却无路可走 —— 这是"逼和"，结果是和棋！所以最后要用将军逼迫对方。' }
        ],
        task: { fen: '6k1/5ppp/8/8/8/8/8/R6K w - - 0 1', goal: '一步将杀黑王！', accept: ['Ra8'], hint: '黑王被自己的三个小兵堵住了退路，把车送上第 8 横排！' }
      },
      {
        id: 'castling', icon: '🏰', title: '王车易位', stars: 2,
        summary: '一步棋让王躲进安全屋、把车请出来 —— 特殊又重要的走法！',
        sections: [
          { h: '怎么易位', p: '王向车移动两格，车跳到王旁边。短易位（王翼）：王 e1→g1；长易位（后翼）：王 e1→c1。' },
          { h: '四个条件', p: '① 王和车都没动过；② 中间没有棋子；③ 王不在被将军；④ 王经过和到达的格子不能被攻击。' }
        ],
        demos: [
          { title: '短易位与长易位', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', moves: [
            { san: 'O-O', note: '白方短易位：王躲进安全屋，车来到开放线！' },
            { san: 'O-O-O', note: '黑方长易位，王来到后翼。' }] }
        ],
        task: { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', goal: '完成短易位（王向 h1 车方向走两格）！', accept: ['O-O'], hint: '选中 e1 的王，直接点击 g1。' }
      },
      {
        id: 'enpassant', icon: '⚡', title: '神奇的吃过路兵', stars: 2,
        summary: '敌兵刚冲两格路过你面前？像它只走了一格一样吃掉它！',
        sections: [
          { h: '过路兵规则', p: '对方兵刚走两格、与你斜着擦肩而过的那一刻（下一手棋之内），你可以像它只走一格那样吃掉它，你的兵落在它"跳过"的格子上。' },
          { h: '过期作废', p: '只有紧接着的一步棋可以吃过路兵，机会一闪而过！' }
        ],
        demos: [
          { title: '吃过路兵演示', fen: 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', moves: [
            { san: 'exf6', note: '黑兵刚冲过 f6 落到 f5，白兵像它还站在 f6 一样吃掉它！这就是"吃过路兵"。' }] }
        ],
        task: { fen: 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', goal: '黑兵刚冲到 f5，吃过路兵！', accept: ['exf6'], hint: 'e5 的白兵斜着落到 f6，就像 f5 的黑兵还站在 f6 一样。' }
      },
      {
        id: 'opening-principles', icon: '📚', title: '开局三原则', stars: 2,
        summary: '占领中心、快点出子、早点易位 —— 开局的三句口诀！',
        sections: [
          { h: '原则一：占领中心', p: '中心 4 格（d4/e4/d5/e5）是棋盘的黄金地段，先用小兵占领！' },
          { h: '原则二：快点出子', p: '先把马和象请出来，别把同一个子走来走去，也别让后被追着跑。' },
          { h: '原则三：早点易位', p: '把王送进安全屋，再把车接到中线，你的开局就成功了一大半！' }
        ],
        demos: [
          { title: '好例子 vs 坏例子', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'e4', note: '✅ 占中心！' },
            { san: 'e5', note: '黑方也占中心。' },
            { san: 'Nf3', note: '✅ 快速出子，还攻击 e5 的兵。' },
            { san: 'Nc6', note: '黑方保护兵，也出子。' },
            { san: 'Bc4', note: '✅ 象瞄准 f7 要害，准备易位。' }] },
          { title: '坏例子', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'e4', note: '第一步不错。' },
            { san: 'e5', note: '黑方跟上。' },
            { san: 'Qh5', note: '❌ 后太早出动！容易被小兵追着跑，浪费时间。' }] }
        ],
        task: { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', goal: '第一步棋，选一个符合开局原则的走法！', accept: ['e4', 'd4', 'Nf3', 'c4'], hint: '占中心（e4/d4/c4）或出马（Nf3）都是好选择；别走 a/h 边兵或把后放出来。' }
      },
      {
        id: 'classic-openings', icon: '🗺️', title: '经典开局之旅', stars: 2,
        summary: '意大利、西班牙、后翼弃兵、西西里 —— 四大经典开局走一遍！',
        sections: [
          { h: '开局为什么重要', p: '开局是棋局的"开场舞蹈"，跳好了中局才有好位置。下面 4 个经典开局，每个都看一遍、跟着走一遍吧！' },
          { h: '小贴士', p: '不用背！理解每一步"为什么走"比背谱更重要。' }
        ],
        demos: [
          { title: '意大利开局', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'e4', note: '占中心。' }, { san: 'e5', note: '对占中心。' },
            { san: 'Nf3', note: '出马攻击 e5。' }, { san: 'Nc6', note: '保护兵。' },
            { san: 'Bc4', note: '象瞄准 f7 弱点 —— 这就是意大利开局！' }] },
          { title: '西班牙开局', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'e4', note: '占中心。' }, { san: 'e5', note: '对占中心。' },
            { san: 'Nf3', note: '出马。' }, { san: 'Nc6', note: '保护兵。' },
            { san: 'Bb5', note: '象远程牵制 c6 的马 —— 西班牙开局，高手最爱！' }] },
          { title: '后翼弃兵', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'd4', note: '白方占中心。' }, { san: 'd5', note: '黑方对占。' },
            { san: 'c4', note: '"弃"一个兵抢中心 —— 其实兵暂时不会被吃走！' }] },
          { title: '西西里防御', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: [
            { san: 'e4', note: '白方占中心。' }, { san: 'c5', note: '黑方从侧面反击中心 —— 最流行的应对！' },
            { san: 'Nf3', note: '出马。' }, { san: 'd6', note: '给 c5 的兵留出朋友。' },
            { san: 'd4', note: '白方冲中心，战斗开始！' }] }
        ],
        task: { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', goal: '跟着意大利开局走：完成白方的前三步（e4 → Nf3 → Bc4）！', accept: ['e4'], hint: '先走 e4，接着每一步按提示走：Nf3、Bc4。' }
      }
    ],

    /* ============ 战术题库 ============ */
    quizzes: [
      { id: 'q_backrank', type: 'mate', diff: 1, fen: '6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1',
        goal: '白方走：一步将杀！', solution: ['Re8'], explain: '黑王被自己的三个小兵堵住退路，车送上第 8 横排就是"底线将杀"。',
        hint: '黑王上面全是自己的兵，把车放到第 8 横排。' },
      { id: 'q_scholar', type: 'mate', diff: 1, fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w kq - 0 1',
        goal: '白方走：抓住 f7 的弱点，一步将杀！', solution: ['Qxf7'], explain: 'f7 是黑方开局最弱的点：后和象一起攻击它，这就是"学者将杀"。',
        hint: '后和象都瞄准着 f7。' },
      { id: 'q_qkmate', type: 'mate', diff: 1, fen: '7k/8/6K1/8/8/8/8/7Q w - - 0 1',
        goal: '白方走：用后将杀！', solution: ['Qh7'], explain: '王贴身保护着后，后走到 h7 就形成"贴身将杀"。',
        hint: '把后送到黑王鼻子底下，有王保护就不怕被吃。' },
      { id: 'q_rookmate', type: 'mate', diff: 1, fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1',
        goal: '白方走：用车将杀！', solution: ['Ra8'], explain: '王在角落守住逃跑格，车送上底线 —— 经典的"车底杀"。',
        hint: '车直冲第 8 横排。' },
      { id: 'q_fork_knight', type: 'fork', diff: 2, fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
        goal: '白方走：用马同时攻击王和车（捉双）！', solution: ['Nc7'], explain: '马跳到 c7，一口"咬住"两个子：将军又抓车，黑王逃走后马就能吃车。',
        hint: '找一个点，能同时攻击 e8 的王和 a8 的车。' },
      { id: 'q_fork_pawn', type: 'fork', diff: 1, fen: '7k/8/8/2r1q3/3P4/8/8/7K w - - 0 1',
        goal: '白方走：小兵的两路吃子，吃掉一个！', solution: ['dxc5', 'dxe5'], explain: '小兵同时攻击 c5 的车和 e5 的后 —— 吃哪个都赚大！这就是"兵的捉双"。',
        hint: '兵是斜着吃的，d4 的兵有两条斜路。' },
      { id: 'q_royal_fork', type: 'fork', diff: 3, fen: '2q3k1/8/8/5N2/8/8/8/4K3 w - - 0 1',
        goal: '白方走：一马双抓王和后（皇家捉双）！', solution: ['Ne7'], explain: '马跳 e7 同时将军和攻击后，这就是最华丽的"皇家捉双"。',
        hint: 'f5 的马往中心跳一步……' },
      { id: 'q_pin', type: 'pin', diff: 2, fen: '4k3/8/8/8/8/4n3/4R3/4K3 w - - 0 1',
        goal: '白方走：马被牵制在王前面，吃掉它！', solution: ['Rxe3'], explain: '黑马被王"钉"在 e 线上动弹不得，车直接吃掉它 —— 这就是"牵制"的威力。',
        hint: 'e 线上车、马、王排成一排。' },
      { id: 'q_skewer', type: 'skewer', diff: 2, fen: '1k5q/8/8/8/8/8/8/4R1K1 w - - 0 1',
        goal: '白方走：让王让路，吃掉后面的后！', solution: ['Re8'], explain: '车将军，王必须让路，后面的黑后就被"串"住了 —— 这叫"串击"。',
        hint: '把车送到第 8 横排将军。' },
      { id: 'q_discovery', type: 'discovered', diff: 2, fen: '7k/8/8/4N3/8/8/1B6/6K1 w - - 0 1',
        goal: '白方走：马一走开，让象发动突然袭击（闪击）！', solution: ['Ng6', 'Nf3', 'Nd3', 'Nc4', 'Nc6', 'Nd7', 'Ng4', 'Nf7'],
        explain: '马挡在象的射线上，马一走开，象突然将军 —— 这叫"闪击/闪将"！（推荐 Ng6 双将，最华丽！）',
        hint: '随便走一个安全的马步，b2 的象就会露出射线。' },
      { id: 'q_removal', type: 'removal', diff: 2, fen: '4k3/8/4n3/8/3q4/8/8/3RK3 w - - 0 1',
        goal: '白方走：后的保镖是马，先吃掉后！', solution: ['Rxd4'], explain: '黑后有马保护，但我们用车吃后：就算马吃回车，我们也白赚一个后（后 > 车）。',
        hint: '先数一数：吃后会不会亏？后值 9 分，车只值 5 分。' },
      { id: 'q_ladder', type: 'mate', diff: 3, fen: '7k/8/8/8/8/8/R7/1R4K1 w - - 0 1',
        goal: '白方走：双车"爬梯子"将杀（两步）！', solution: ['Ra7', 'Rb8'], replies: { 0: 'Kg8' },
        explain: '第一步用一辆车封锁第 7 横排，第二步另一辆车上第 8 横排将杀 —— 这就是"梯子将杀"。',
        hint: '先走 Ra7 切断黑王去第 7 横排的路。' }
    ],

    /* ============ 残局专项挑战（与电脑对战） ============ */
    endgames: [
      { id: 'e_two_rooks', icon: '🪜', title: '双车爬梯', fen: '7k/8/8/8/8/8/8/RR4K1 w - - 0 1', goal: 'mate', maxMoves: 15, diff: 2,
        desc: '用两辆车一层一层"关笼子"，15 步内将杀黑王。' },
      { id: 'e_queen', icon: '👑', title: '后围剿战', fen: '7k/8/8/8/8/8/8/K6Q w - - 0 1', goal: 'mate', maxMoves: 20, diff: 2,
        desc: '后是最强的子，但要小心别把黑王"逼和"哦！' },
      { id: 'e_rook', icon: '🚗', title: '单车擒王', fen: '7k/8/8/8/8/8/8/R5K1 w - - 0 1', goal: 'mate', maxMoves: 30, diff: 2,
        desc: '一车一王如何将杀？记住"对王"和"关笼子"两个技巧。' },
      { id: 'e_pawn', icon: '🎖️', title: '护送小兵', fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1', goal: 'promote', maxMoves: 25, diff: 2,
        desc: '王要在前面开路，护送小兵冲到底线升变！' }
    ],

    /* ============ 赛前小贴士（按难度） ============ */
    tips: {
      1: [
        '走棋前先问自己：我的这个子有朋友保护吗？',
        '看到对方没有保护的棋子，大胆去吃！',
        '小兵很重要，别随便把它们都送掉哦。',
        '开局先把马和象请出来，它们喜欢站在中间。'
      ],
      2: [
        '将军之前，先看看对方的王能逃到哪里。',
        '先数一数：这个格子有几个子保护？对方有几个子攻击？',
        '车到了开放线上威力翻倍，试着给它让出路来！',
        '对方来将军时别慌：跑、挡、吃，三个办法总有一个行得通。'
      ],
      3: [
        '每走一步前，先找一遍对手的"战术威胁"：将军、捉子、牵制。',
        '兑子之前算清楚得失：换掉的是"等值"还是"亏本"？',
        '通路兵是残局的宝贝，保护它、护送它冲刺！',
        '把车放到对手防不住的开放线上，经常能白赚一个兵。'
      ],
      4: [
        '计划比走子重要：想一想你这盘棋要进攻哪一边？',
        '让对手的子变"笨"（没好格子），让自己的子变"聪明"。',
        '王城兵动了就要小心底线将杀，提前给王留个"气窗"。',
        '残局里王是战斗力，勇敢让它走向中心！'
      ]
    },

    quizTypeNames: {
      mate: '将杀', fork: '捉双', pin: '牵制', skewer: '串击',
      discovered: '闪击', removal: '消除保护', tactic: '战术'
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
