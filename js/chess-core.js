/* ============================================================
 * 趣棋小将 FunChess Kids · 国际象棋规则核心（0x88 棋盘表示）
 * ------------------------------------------------------------
 * 完整实现：
 *  - 合法着法生成（含王车易位、吃过路兵、兵升变）
 *  - 将军 / 将杀 / 逼和 判定
 *  - 50 回合规则、三次重复局面、子力不足自动和棋
 *  - SAN 代数记谱的生成与解析、PGN 导出、FEN 读写
 *  - Zobrist 哈希（搜索中快速做重复局面检测）
 * 独立成文件，供主线程、Web Worker、Node 测试共用。
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FunChess = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- 基础常量 ---------- */
  const EMPTY = 0;
  const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  const WHITE = 0, BLACK = 1;

  const typeOf = p => p & 7;              // 取棋子种类
  const colorOf = p => (p >> 3) & 1;      // 取棋子颜色（0=白 1=黑）
  const makePiece = (c, t) => (c << 3) | t;

  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  /* 0x88 坐标：sq = 行 * 16 + 列，行 0 为第 8 横排（a8=0，h1=119） */
  function algebraic(sq) { return FILES[sq & 15] + (8 - (sq >> 4)); }
  function fromAlgebraic(s) { return (8 - parseInt(s[1], 10)) * 16 + FILES.indexOf(s[0]); }
  function onBoard(sq) { return (sq & 0x88) === 0; }

  /* 着法标志位 */
  const FLAG_NORMAL = 0, FLAG_BIG_PAWN = 1, FLAG_EP = 2,
        FLAG_CASTLE_K = 4, FLAG_CASTLE_Q = 8, FLAG_PROMO = 16;

  /* 王车易位权利位 */
  const CASTLE_WK = 1, CASTLE_WQ = 2, CASTLE_BK = 4, CASTLE_BQ = 8;

  /* 各棋子走法方向偏移 */
  const KNIGHT_D = [-33, -31, -18, -14, 14, 18, 31, 33];
  const BISHOP_D = [-17, -15, 15, 17];
  const ROOK_D = [-16, -1, 1, 16];
  const KING_D = [-17, -16, -15, -1, 1, 15, 16, 17];

  /* 走子 / 被吃格子对易位权利的影响掩码 */
  const CASTLE_MASK = new Array(128).fill(15);
  CASTLE_MASK[116] = 15 & ~(CASTLE_WK | CASTLE_WQ); // e1
  CASTLE_MASK[119] = 15 & ~CASTLE_WK;               // h1
  CASTLE_MASK[112] = 15 & ~CASTLE_WQ;               // a1
  CASTLE_MASK[4]   = 15 & ~(CASTLE_BK | CASTLE_BQ); // e8
  CASTLE_MASK[7]   = 15 & ~CASTLE_BK;               // h8
  CASTLE_MASK[0]   = 15 & ~CASTLE_BQ;               // a8

  /* 棋子中文名（用于面向儿童的讲解文案） */
  const PIECE_NAME_CN = { 1: '兵', 2: '马', 3: '象', 4: '车', 5: '后', 6: '王' };
  const SAN_LETTER = { 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  const PROMO_FROM_CHAR = { n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN };
  const PROMO_TO_CHAR = { [KNIGHT]: 'N', [BISHOP]: 'B', [ROOK]: 'R', [QUEEN]: 'Q' };

  /* 升变参数兼容两种写法：字符 'q' 或数字类型码 QUEEN(5) */
  function resolvePromotion(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v >= PAWN && v <= KING ? v : 0;
    return PROMO_FROM_CHAR[String(v).toLowerCase()] || 0;
  }

  /* ---------- Zobrist 哈希（重复局面检测用） ---------- */
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  const rng = makeRng(20261004);
  const Z_PIECE = [new Array(7), new Array(7)];
  for (let c = 0; c < 2; c++) {
    for (let t = 1; t <= 6; t++) {
      Z_PIECE[c][t] = new Int32Array(128);
      for (let sq = 0; sq < 128; sq++) Z_PIECE[c][t][sq] = rng() | 0;
    }
  }
  const Z_CASTLE = new Int32Array(16);
  for (let i = 0; i < 16; i++) Z_CASTLE[i] = rng() | 0;
  const Z_EP = new Int32Array(9);
  for (let i = 0; i < 9; i++) Z_EP[i] = rng() | 0;
  const Z_TURN = rng() | 0;

  /* ============================================================
   * Chess 类：一盘棋（局面 + 历史 + 规则判定）
   * ============================================================ */
  class Chess {
    constructor(fen) { this.load(fen || START_FEN); }

    /* 从 FEN 载入局面 */
    load(fen) {
      const parts = String(fen).trim().split(/\s+/);
      if (parts.length < 2) throw new Error('非法 FEN：' + fen);
      this.board = new Int8Array(128);
      this.kings = [-1, -1];
      const rows = parts[0].split('/');
      if (rows.length !== 8) throw new Error('非法 FEN 棋盘行数');
      for (let r = 0; r < 8; r++) {
        let file = 0;
        for (const ch of rows[r]) {
          if (ch >= '1' && ch <= '8') { file += +ch; continue; }
          const lower = ch.toLowerCase();
          const t = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING }[lower];
          if (!t || file > 7) throw new Error('非法 FEN 棋子：' + ch);
          const color = ch === lower ? BLACK : WHITE;
          const sq = r * 16 + file;
          this.board[sq] = makePiece(color, t);
          if (t === KING) this.kings[color] = sq;
          file++;
        }
        if (file !== 8) throw new Error('非法 FEN 行宽：' + rows[r]);
      }
      this.turn = parts[1] === 'b' ? BLACK : WHITE;
      this.castling = 0;
      const cs = parts[2] || '-';
      if (cs.includes('K')) this.castling |= CASTLE_WK;
      if (cs.includes('Q')) this.castling |= CASTLE_WQ;
      if (cs.includes('k')) this.castling |= CASTLE_BK;
      if (cs.includes('q')) this.castling |= CASTLE_BQ;
      this.ep = parts[3] && parts[3] !== '-' ? fromAlgebraic(parts[3]) : -1;
      this.halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
      this.fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
      this.history = [];
      this.sanHistory = [];
      this.hashHistory = [];
      this.hash = this._computeHash();
      this.hashHistory.push(this.hash);
      this.posCounts = new Map();   // 局面键 -> 出现次数（三次重复判定）
      this.posCounts.set(this.positionKey(), 1);
      return this;
    }

    /* 输出 FEN */
    fen() {
      const rows = [];
      for (let r = 0; r < 8; r++) {
        let row = '', empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 16 + f];
          if (!p) { empty++; continue; }
          if (empty) { row += empty; empty = 0; }
          const ch = 'pnbrqk'[typeOf(p) - 1];
          row += colorOf(p) === WHITE ? ch.toUpperCase() : ch;
        }
        if (empty) row += empty;
        rows.push(row);
      }
      let castle = '';
      if (this.castling & CASTLE_WK) castle += 'K';
      if (this.castling & CASTLE_WQ) castle += 'Q';
      if (this.castling & CASTLE_BK) castle += 'k';
      if (this.castling & CASTLE_BQ) castle += 'q';
      if (!castle) castle = '-';
      return rows.join('/') + ' ' + (this.turn === WHITE ? 'w' : 'b') + ' ' + castle + ' '
        + (this.ep >= 0 ? algebraic(this.ep) : '-') + ' ' + this.halfmove + ' ' + this.fullmove;
    }

    _computeHash() {
      let h = 0;
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.board[sq];
        if (p) h ^= Z_PIECE[colorOf(p)][typeOf(p)][sq];
      }
      if (this.turn === BLACK) h ^= Z_TURN;
      h ^= Z_CASTLE[this.castling];
      h ^= Z_EP[this.ep < 0 ? 8 : (this.ep & 15)];
      return h;
    }

    /* 精确局面键（三次重复判定用；ep 只有真正可被吃时才计入） */
    positionKey() {
      const f = this.fen().split(' ');
      const epStr = this.ep >= 0 && this._epCapturable() ? algebraic(this.ep) : '-';
      return f[0] + ' ' + f[1] + ' ' + f[2] + ' ' + epStr;
    }

    /* 当前行棋方是否有兵可吃过路兵 */
    _epCapturable() {
      if (this.ep < 0) return false;
      const us = this.turn;
      const deltas = us === WHITE ? [15, 17] : [-15, -17];
      for (const d of deltas) {
        const s = this.ep + d;
        if (onBoard(s) && this.board[s] === makePiece(us, PAWN)) return true;
      }
      return false;
    }

    /* sq 是否被 by 方攻击 */
    attacked(sq, by) {
      const b = this.board;
      // 兵
      const pawn = makePiece(by, PAWN);
      const pd = by === WHITE ? [15, 17] : [-15, -17];
      for (const d of pd) { const s = sq + d; if (onBoard(s) && b[s] === pawn) return true; }
      // 马
      const kn = makePiece(by, KNIGHT);
      for (const d of KNIGHT_D) { const s = sq + d; if (onBoard(s) && b[s] === kn) return true; }
      // 王
      const kg = makePiece(by, KING);
      for (const d of KING_D) { const s = sq + d; if (onBoard(s) && b[s] === kg) return true; }
      // 车 / 后（直线）
      const rk = makePiece(by, ROOK), qu = makePiece(by, QUEEN), bi = makePiece(by, BISHOP);
      for (const d of ROOK_D) {
        let s = sq + d;
        while (onBoard(s)) { const p = b[s]; if (p) { if (p === rk || p === qu) return true; break; } s += d; }
      }
      // 象 / 后（斜线）
      for (const d of BISHOP_D) {
        let s = sq + d;
        while (onBoard(s)) { const p = b[s]; if (p) { if (p === bi || p === qu) return true; break; } s += d; }
      }
      return false;
    }

    /* color 方是否被将军（默认当前行棋方） */
    inCheck(color) {
      color = color === undefined ? this.turn : color;
      return this.attacked(this.kings[color], 1 - color);
    }

    /* 生成着法。opts.square: 只生成某格子的着法（支持 'e2' 或 0x88 数字）；opts.legal=false: 不过滤 */
    generateMoves(opts) {
      opts = opts || {};
      let square = opts.square;
      if (typeof square === 'string') square = fromAlgebraic(square);
      const pseudo = this._generatePseudo(square);
      if (opts.legal === false) return pseudo;
      const us = this.turn;
      const legal = [];
      for (const m of pseudo) {
        this._makeMove(m);
        if (!this.inCheck(us)) legal.push(m);
        this._unmakeMove();
      }
      return legal;
    }

    /* 生成伪合法着法（不检查走后被将军） */
    _generatePseudo(onlySquare) {
      const us = this.turn, them = 1 - us;
      const b = this.board;
      const moves = [];
      const push = (from, to, piece, captured, flags, promotion) => {
        moves.push({ from, to, piece, captured: captured || 0, flags: flags || 0, promotion: promotion || 0 });
      };
      const startSq = onlySquare !== undefined ? onlySquare : 0;
      for (let sq = startSq; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const piece = b[sq];
        if (!piece || colorOf(piece) !== us) continue;
        const t = typeOf(piece);
        if (t === PAWN) {
          const fwd = us === WHITE ? -16 : 16;
          const startRow = us === WHITE ? 6 : 1;
          const one = sq + fwd;
          if (onBoard(one) && !b[one]) {
            this._addPawnMove(push, sq, one, piece, 0, 0, us);
            const two = one + fwd;
            if ((sq >> 4) === startRow && !b[two]) push(sq, two, piece, 0, FLAG_BIG_PAWN);
          }
          const capDirs = us === WHITE ? [-17, -15] : [15, 17];
          for (const d of capDirs) {
            const to = sq + d;
            if (!onBoard(to)) continue;
            const target = b[to];
            if (target && colorOf(target) === them) this._addPawnMove(push, sq, to, piece, target, 0, us);
            else if (to === this.ep && this.ep >= 0) push(sq, to, piece, makePiece(them, PAWN), FLAG_EP);
          }
        } else if (t === KNIGHT || t === KING) {
          const dirs = t === KNIGHT ? KNIGHT_D : KING_D;
          for (const d of dirs) {
            const to = sq + d;
            if (!onBoard(to)) continue;
            const target = b[to];
            if (!target || colorOf(target) === them) push(sq, to, piece, target, 0);
          }
          if (t === KING && onlySquare === undefined) this._addCastles(push, us);
        } else {
          const dirs = t === BISHOP ? BISHOP_D : t === ROOK ? ROOK_D : KING_D;
          for (const d of dirs) {
            let to = sq + d;
            while (onBoard(to)) {
              const target = b[to];
              if (!target) push(sq, to, piece, 0, 0);
              else { if (colorOf(target) === them) push(sq, to, piece, target, 0); break; }
              to += d;
            }
          }
        }
        if (onlySquare !== undefined) break;
      }
      return moves;
    }

    /* 兵的着法：到底线自动展开成 4 种升变 */
    _addPawnMove(push, from, to, piece, captured, flags, us) {
      const promoRow = us === WHITE ? 0 : 7;
      if ((to >> 4) === promoRow) {
        for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) push(from, to, piece, captured, flags | FLAG_PROMO, pr);
      } else push(from, to, piece, captured, flags);
    }

    /* 王车易位：权利 + 路径无子 + 不在被将军/经过格被攻击时才可走 */
    _addCastles(push, us) {
      const b = this.board;
      if (this.inCheck(us)) return;
      if (us === WHITE) {
        const rk = makePiece(WHITE, ROOK), kg = makePiece(WHITE, KING);
        if ((this.castling & CASTLE_WK) && !b[117] && !b[118] && b[119] === rk && b[116] === kg
          && !this.attacked(117, BLACK) && !this.attacked(118, BLACK))
          push(116, 118, kg, 0, FLAG_CASTLE_K);
        if ((this.castling & CASTLE_WQ) && !b[113] && !b[114] && !b[115] && b[112] === rk && b[116] === kg
          && !this.attacked(114, BLACK) && !this.attacked(115, BLACK))
          push(116, 114, kg, 0, FLAG_CASTLE_Q);
      } else {
        const rk = makePiece(BLACK, ROOK), kg = makePiece(BLACK, KING);
        if ((this.castling & CASTLE_BK) && !b[5] && !b[6] && b[7] === rk && b[4] === kg
          && !this.attacked(5, WHITE) && !this.attacked(6, WHITE))
          push(4, 6, kg, 0, FLAG_CASTLE_K);
        if ((this.castling & CASTLE_BQ) && !b[1] && !b[2] && !b[3] && b[0] === rk && b[4] === kg
          && !this.attacked(2, WHITE) && !this.attacked(3, WHITE))
          push(4, 2, kg, 0, FLAG_CASTLE_Q);
      }
    }

    /* 执行着法（内部用，搜索时大量调用） */
    _makeMove(m) {
      const us = colorOf(m.piece);
      const undo = {
        m, castling: this.castling, ep: this.ep, halfmove: this.halfmove,
        fullmove: this.fullmove, hash: this.hash, capSq: -1, capPiece: 0
      };
      let h = this.hash;
      // 吃过路兵：被吃的兵不在落点格
      if (m.flags & FLAG_EP) {
        undo.capSq = us === WHITE ? m.to + 16 : m.to - 16;
        undo.capPiece = this.board[undo.capSq];
      } else if (m.captured) {
        undo.capSq = m.to;
        undo.capPiece = m.captured;
      }
      if (undo.capPiece) {
        this.board[undo.capSq] = EMPTY;
        h ^= Z_PIECE[colorOf(undo.capPiece)][typeOf(undo.capPiece)][undo.capSq];
      }
      this.board[m.from] = EMPTY;
      h ^= Z_PIECE[us][typeOf(m.piece)][m.from];
      const placed = m.promotion ? makePiece(us, m.promotion) : m.piece;
      this.board[m.to] = placed;
      h ^= Z_PIECE[us][typeOf(placed)][m.to];
      if (typeOf(m.piece) === KING) this.kings[us] = m.to;
      if (m.flags & FLAG_CASTLE_K) {
        const rf = m.to + 1, rt = m.to - 1, rp = this.board[rf];
        this.board[rt] = rp; this.board[rf] = EMPTY;
        h ^= Z_PIECE[us][ROOK][rf] ^ Z_PIECE[us][ROOK][rt];
      } else if (m.flags & FLAG_CASTLE_Q) {
        const rf = m.to - 2, rt = m.to + 1, rp = this.board[rf];
        this.board[rt] = rp; this.board[rf] = EMPTY;
        h ^= Z_PIECE[us][ROOK][rf] ^ Z_PIECE[us][ROOK][rt];
      }
      // 更新易位权利（走王/车或角上车被吃都会失去权利）
      const oc = this.castling;
      this.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
      if (oc !== this.castling) h ^= Z_CASTLE[oc] ^ Z_CASTLE[this.castling];
      // 过路兵格
      const oe = this.ep;
      this.ep = (m.flags & FLAG_BIG_PAWN) ? (m.from + m.to) >> 1 : -1;
      if (oe !== this.ep) h ^= Z_EP[oe < 0 ? 8 : oe & 15] ^ Z_EP[this.ep < 0 ? 8 : this.ep & 15];
      // 半回合计数（50 回合规则）
      this.halfmove = (typeOf(m.piece) === PAWN || undo.capPiece) ? 0 : this.halfmove + 1;
      if (us === BLACK) this.fullmove++;
      this.turn = 1 - us;
      h ^= Z_TURN;
      this.hash = h;
      this.history.push(undo);
      this.hashHistory.push(h);
      return undo;
    }

    /* 撤销着法（内部用） */
    _unmakeMove() {
      const undo = this.history.pop();
      this.hashHistory.pop();
      const m = undo.m, us = colorOf(m.piece);
      this.turn = us;
      this.castling = undo.castling;
      this.ep = undo.ep;
      this.halfmove = undo.halfmove;
      this.fullmove = undo.fullmove;
      this.hash = undo.hash;
      this.board[m.from] = m.promotion ? makePiece(us, PAWN) : m.piece;
      this.board[m.to] = EMPTY;
      if (undo.capPiece) this.board[undo.capSq] = undo.capPiece;
      if (typeOf(m.piece) === KING) this.kings[us] = m.from;
      if (m.flags & FLAG_CASTLE_K) {
        this.board[m.to + 1] = this.board[m.to - 1];
        this.board[m.to - 1] = EMPTY;
      } else if (m.flags & FLAG_CASTLE_Q) {
        this.board[m.to - 2] = this.board[m.to + 1];
        this.board[m.to + 1] = EMPTY;
      }
    }

    /* 生成某着法的 SAN 基础部分（不含 +/# 后缀），需要合法着法列表做消歧 */
    _sanBase(m, legalMoves) {
      if (m.flags & FLAG_CASTLE_K) return 'O-O';
      if (m.flags & FLAG_CASTLE_Q) return 'O-O-O';
      const t = typeOf(m.piece);
      const target = algebraic(m.to);
      let s = '';
      if (t === PAWN) {
        s = m.captured ? FILES[m.from & 15] + 'x' + target : target;
        if (m.promotion) s += '=' + PROMO_TO_CHAR[m.promotion];
      } else {
        s = SAN_LETTER[t];
        const others = (legalMoves || this.generateMoves())
          .filter(x => x !== m && typeOf(x.piece) === t && x.to === m.to && x.from !== m.from);
        if (others.length) {
          const sameFile = others.some(x => (x.from & 15) === (m.from & 15));
          const sameRank = others.some(x => (x.from >> 4) === (m.from >> 4));
          if (!sameFile) s += FILES[m.from & 15];
          else if (!sameRank) s += String(8 - (m.from >> 4));
          else s += algebraic(m.from);
        }
        if (m.captured) s += 'x';
        s += target;
      }
      return s;
    }

    /* 给已生成的合法着法 m 求完整 SAN（含 +/# 后缀），不改变局面 */
    sanOfMove(mv) {
      const legal = this.generateMoves();
      const m = legal.find(x => x.from === mv.from && x.to === mv.to && x.promotion === mv.promotion);
      if (!m) return null;
      let s = this._sanBase(m, legal);
      this._makeMove(m);
      if (this.inCheck(this.turn)) s += this.generateMoves().length ? '+' : '#';
      this._unmakeMove();
      return s;
    }

    /* 走一步棋：输入 SAN / 坐标串 / {from,to,promotion}，非法返回 null */
    move(input) {
      const legal = this.generateMoves();
      let m = null;
      if (typeof input === 'string') {
        m = this._findMoveByString(input, legal);
      } else if (input && input.from !== undefined) {
        const from = typeof input.from === 'string' ? fromAlgebraic(input.from) : input.from;
        const to = typeof input.to === 'string' ? fromAlgebraic(input.to) : input.to;
        const promo = resolvePromotion(input.promotion);
        const cands = legal.filter(x => x.from === from && x.to === to);
        if (promo) m = cands.find(x => x.promotion === promo) || null;
        else {
          m = cands.find(x => !x.promotion) || null;
          if (!m && cands.length) m = cands.find(x => x.promotion === QUEEN) || null;
        }
      }
      if (!m) return null;
      let san = this._sanBase(m, legal);
      this._makeMove(m);
      if (this.inCheck(this.turn)) san += this.generateMoves().length ? '+' : '#';
      m.san = san;
      m.color = colorOf(m.piece);
      m.fen = this.fen();   // 走完后的局面
      const key = this.positionKey();
      this.posCounts.set(key, (this.posCounts.get(key) || 0) + 1);
      this.sanHistory.push(san);
      return m;
    }

    /* 按字符串找合法着法：支持 e2e4 / e7e8q / Nf3 / exd5 / O-O 等 */
    _findMoveByString(str, legal) {
      let s = String(str).trim().replace(/[+#!?]/g, '');
      const mm = s.match(/^([a-h][1-8])[-x]?([a-h][1-8])(?:=?([nbrq]))?$/i);
      if (mm) {
        const from = fromAlgebraic(mm[1].toLowerCase());
        const to = fromAlgebraic(mm[2].toLowerCase());
        const promo = mm[3] ? PROMO_FROM_CHAR[mm[3].toLowerCase()] : 0;
        const cands = legal.filter(x => x.from === from && x.to === to);
        if (promo) return cands.find(x => x.promotion === promo) || null;
        return cands.find(x => !x.promotion) || cands.find(x => x.promotion === QUEEN) || null;
      }
      s = s.replace(/0/g, 'O');
      for (const m of legal) if (this._sanBase(m, legal) === s) return m;
      const up = s.toUpperCase();
      for (const m of legal) if (this._sanBase(m, legal).toUpperCase() === up) return m;
      return null;
    }

    /* 悔一步棋 */
    undo() {
      if (!this.history.length) return null;
      const key = this.positionKey();
      const c = this.posCounts.get(key) || 0;
      if (c <= 1) this.posCounts.delete(key); else this.posCounts.set(key, c - 1);
      const undo = this.history[this.history.length - 1];
      this._unmakeMove();
      this.sanHistory.pop();
      return undo.m;
    }

    /* ---------- 终局判定 ---------- */
    isCheckmate() { return this.inCheck() && this.generateMoves().length === 0; }
    isStalemate() { return !this.inCheck() && this.generateMoves().length === 0; }
    isThreefold() { return (this.posCounts.get(this.positionKey()) || 0) >= 3; }

    hasInsufficientMaterial() {
      const minors = [];
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.board[sq];
        if (!p) continue;
        const t = typeOf(p);
        if (t === PAWN || t === ROOK || t === QUEEN) return false;
        if (t === KNIGHT || t === BISHOP) {
          minors.push({ color: colorOf(p), type: t, sqColor: ((sq >> 4) + (sq & 15)) & 1 });
        }
      }
      if (minors.length <= 1) return true; // 王对王 / 王加单轻子对王
      // 双方各一象且同色格 -> 子力不足
      if (minors.length === 2 && minors[0].type === BISHOP && minors[1].type === BISHOP
        && minors[0].color !== minors[1].color && minors[0].sqColor === minors[1].sqColor) return true;
      return false;
    }

    isDraw() { return this.halfmove >= 100 || this.isThreefold() || this.hasInsufficientMaterial(); }
    isGameOver() { return this.isCheckmate() || this.isStalemate() || this.isDraw(); }

    /* 终局结果：{winner, text} 或 {draw, text} 或 null */
    gameResult() {
      if (this.isCheckmate()) {
        const loserText = this.turn === WHITE ? '白方' : '黑方';
        return { winner: 1 - this.turn, draw: false, text: loserText + '被将杀' };
      }
      if (this.isStalemate()) return { draw: true, text: '逼和（无子可动）' };
      if (this.halfmove >= 100) return { draw: true, text: '50 回合规则' };
      if (this.isThreefold()) return { draw: true, text: '三次重复局面' };
      if (this.hasInsufficientMaterial()) return { draw: true, text: '子力不足' };
      return null;
    }

    /* ---------- 其他工具 ---------- */
    /* 8x8 棋盘快照，行 0 = 第 8 横排 */
    board8x8() {
      const rows = [];
      for (let r = 0; r < 8; r++) {
        const row = [];
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 16 + f];
          row.push(p ? { type: typeOf(p), color: colorOf(p) } : null);
        }
        rows.push(row);
      }
      return rows;
    }

    get(alg) { const sq = typeof alg === 'string' ? fromAlgebraic(alg) : alg; return this.board[sq] || 0; }
    turnColor() { return this.turn === WHITE ? 'w' : 'b'; }
    historyVerbose() { return this.history.map(u => Object.assign({}, u.m)); }
    clone() { return new Chess(this.fen()); }

    /* 导出 PGN（含结果与表头） */
    pgn(headers) {
      const h = Object.assign({
        Event: 'FunChess Kids 友谊赛', Site: 'FunChess Kids PWA',
        Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
        Round: '-', White: '白方', Black: '黑方'
      }, headers || {});
      let res = '*';
      if (this.isCheckmate()) res = this.turn === WHITE ? '0-1' : '1-0';
      else if (this.isGameOver()) res = '1/2-1/2';
      let s = '';
      for (const k in h) s += '[' + k + ' "' + h[k] + '"]\n';
      s += '\n';
      let line = '';
      for (let i = 0; i < this.history.length; i++) {
        const m = this.history[i].m;
        if (i % 2 === 0) line += (i / 2 + 1) + '. ';
        line += (m.san || '') + ' ';
        if (line.length > 76) { s += line.trimEnd() + '\n'; line = ''; }
      }
      return s + (line + res).trim() + '\n';
    }

    /* perft：着法生成正确性测试（移动数精确计数） */
    perft(depth) {
      if (depth === 0) return 1;
      let n = 0;
      const us = this.turn;
      for (const m of this._generatePseudo()) {
        this._makeMove(m);
        if (!this.inCheck(us)) n += this.perft(depth - 1);
        this._unmakeMove();
      }
      return n;
    }
  }

  return {
    Chess, START_FEN, FILES,
    EMPTY, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, BLACK,
    typeOf, colorOf, makePiece, algebraic, fromAlgebraic, onBoard,
    FLAG_NORMAL, FLAG_BIG_PAWN, FLAG_EP, FLAG_CASTLE_K, FLAG_CASTLE_Q, FLAG_PROMO,
    PIECE_NAME_CN, PROMO_TO_CHAR, resolvePromotion
  };
});
