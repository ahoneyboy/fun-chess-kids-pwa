# 趣棋小将 FunChess Kids · 总体架构设计（1 页）

## 1. 定位与运行形态

面向 6–14 岁儿童的国际象棋学习对战应用。原始需求为微信小程序；本项目按目录约定实现为 **PWA**（单页应用 + Service Worker），手机/平板/PC 浏览器与「添加到主屏幕」均可使用，可部署到 GitHub Pages，离线可用。原有的微信云开发同步改为「本机存储 + JSON 导出/导入」，保持零账号、零上传的儿童隐私最小化设计。

## 2. 模块分层

```
┌────────────── 视图层（js/app.js 路由 + 各视图文件） ──────────────┐
│  home │ learn/lesson/quiz │ play │ review │ history │ profile │ stats │
├────────────── 组件层 ────────────────────────────────────────────┤
│  board.js(Canvas棋盘: 触摸/鼠标、点击+拖拽、动画、升变浮层)        │
│  ui.js(弹窗/轻提示/局势条/撒花)   sounds.js(WebAudio音效+TTS)      │
├────────────── 领域层（纯计算、无 DOM、Worker 与 Node 共用） ────────┤
│  chess-core.js 规则核心     engine.js AI搜索      analysis.js 复盘 │
├────────────── 数据层 ────────────────────────────────────────────┤
│  store.js(localStorage: 对局/进度/徽章/统计/续局快照/导入导出)      │
│  content.js(课程/题库/残局/贴士静态内容)                           │
└──────────── 后台线程：workers/engine-worker.js ──────────────────┘
        search(对局走子) │ eval(局势条/分支试走) │ analyze-game(整局复盘)
```

主线程永不执行 AI 计算；Worker 不可用时自动降级为主线程计算（file:// 调试场景）。

## 3. 对局数据流

```
玩家走子 → Chess.move() 校验 → 音效/动画/棋谱/续局快照(每步localStorage)
        → Worker.search(难度参数) → 引擎着法 → AI讲解(入门/初级) → 终局判定
终局 → 结果弹窗 → 保存对局记录 → 更新连胜/积分/难度自适应 → 可进入复盘
```

复盘：`analyze-game` 逐局面评估（n+1 个快照，带进度回调）→ 逐着分差与失误归类 → 儿童化点评 → 分阶段总结 + 优化步骤清单 → 存入对局记录。

## 4. 关键算法

- **规则核心**：0x88 棋盘 + Int8Array，make/unmake 增量维护易位权/过路兵格/50回合计数/Zobrist 哈希；三次重复用「局面精确键 + 出现次数表」判定。正确性由 6 个经典局面 perft 与公布值比对保证。
- **AI**：Negamax + Alpha-Beta，迭代加深，MVV-LVA/杀手着法/历史启发排序，静态搜索消除水平线效应，将军延伸；评估 = 子力 + 位置表(中/残局分段) + 叠兵/孤兵/通路兵 + 双象 + 车路 + 王城兵盾。难度 = 深度 × 随机窗口 × 失误率 × 时间上限。
- **复盘归类**：cpLoss≥80/150/400 → 小失误/失误/大失误；类型 = 错失将杀 > 漏吃 > 送子(对手最大威胁≥250cp) > 开局违例(前10回合) > 残局失误(npm≤1300) > 战术；准确率 = mean(100·e^(−cpLoss/400))。
- **自适应难度**：连赢2局升档、连输2局降档（1–4 档闭环），家长可锁定。

## 5. 响应式策略

- 手机竖屏（<860px）：单列，状态栏 → 棋盘（宽度=min(容器, 视口)）→ 控制按钮 → 面板
- 平板横屏 / PC（≥860px 横屏 或 ≥980px）：`grid-template-columns: 棋盘列 + 信息面板列`，面板 sticky
- Canvas 尺寸由 ResizeObserver 驱动、DPR 感知；grid/flex 子项 `min-width:0` + canvas `max-width:100%` 防撑破
- 交互热区 ≥44px；`prefers-reduced-motion` 降级动画

## 6. 数据模型（localStorage）

- `fc_games_v1`：对局记录数组（≤200 条）。记录含 moves[{san,timeSpent}]、pgn、review{plies,summary}
- `fc_user_v1`：stars/score/badges/streak/lessonsDone/quizDone/endgameDone/difficulty
- `fc_settings_v1`：音效/TTS/讲解/提示/局势条/自适应/锁定难度/每日提醒
- `fc_current_v1`：进行中对局快照（每步写入，实现"中途退出可续局"）
- `fc_minutes_v1`：每日对局时长（家长提醒用）

## 7. 质量保障

tests/perft.js（着法生成金标准）、test-rules.js（规则语义）、test-engine.js（搜索质量与性能）、test-content.js（内容库全量校验）；CI 在 push 时自动执行。
