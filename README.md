# 趣棋小将 FunChess Kids ♟️

> 面向 6–14 岁儿童的国际象棋学习对战 PWA：学规则、练战术、与电脑对战，每局自动保存、智能复盘，用"小兵讲棋"的方式指出问题、给出更优走法和可执行的优化步骤。

**无广告 · 无付费陷阱 · 无诱导分享 · 数据只存本机（隐私最小化）**

---

## ✨ 功能总览

### 📖 学习模块
- **10 节互动课程**：棋子认知、兵的走法与升变、马象配合、车与后、王与将军、将杀与逼和、王车易位、吃过路兵、开局三原则、经典开局之旅
- 每课配 **Canvas 动画演示播放器**（逐步播放 + 中文讲解）与 **动手小任务**（在棋盘上完成任务才算学会）
- **12 道战术题**：一步将杀、捉双、牵制、串击、闪击、消除保护……分难度闯关，答对得星星
- **4 个残局专项挑战**：双车杀王、后杀王、单车杀王、护送升变（与电脑真刀真枪地打）

### ♟️ 人机对战
- 自研 AI 引擎（Minimax + Alpha-Beta 剪枝 + 静态搜索），**4 档难度**：入门 / 初级 / 中级 / 高级，保证"可赢但不弱智"
- 执白 / 执黑 / 随机选边；**"提示下一步"**（引擎推荐 + 箭头高亮）
- 完整规则：王车易位、吃过路兵、升变选子、三次重复、50 回合、逼和自动判和
- 悔棋、求和（电脑会看形势决定接不接受）、认输、每步计时（超时小助手代走）
- **实时局势评分条**、AI 思考动画、吃子统计
- **新手教学对弈**：入门/初级难度下，AI 每步用文字（可开语音）解释"我为什么这么走"
- **难度自适应**：连赢 2 局自动升档、连输 2 局自动降档；家长可锁定固定难度
- 每局开始前展示与难度匹配的**战术贴士**
- 每步实时保存到本地，中途退出可**续局**

### 🔍 智能复盘（核心亮点）
- 逐着分析：**实际走法 vs 引擎最佳走法**、分差、评分变化曲线图
- 失误分级：≥80cp 小失误 / ≥150cp 失误 / ≥400cp 大失误（送子级）
- 失误自动归类：送子、漏吃、错失将杀、漏看战术、开局违例、残局失误
- **"小兵讲棋"儿童化点评**：每一步用孩子能懂的语言解释"为什么这步更好"
- **试走分支**：在任何局面试自己的着法，电脑应一手并给出新评分对比
- 整局总结：开局/中局/残局分阶段评价 + 准确率 + 星级 + **3~5 条优化步骤清单**（每条附可跳转的关联练习）

### 📊 记录与成长
- 对局历史：按结果/难度筛选，一键进入复盘
- 统计面板：总对局、胜率、连胜、平均准确率、**常见失误分布**、**五维能力雷达**（开局/战术中局/残局/防守/进攻）
- 星星、积分、**10 枚成就徽章**（初次上阵、三连胜、小兵变大、复盘小侦探……）
- 数据导出 / 导入（JSON 备份搬家）

---

## 🚀 快速开始

### 方式一：本地运行（推荐开发/体验）

PWA 需要 HTTP 环境（Service Worker 不支持 `file://`），任选其一：

```bash
# Python
python3 -m http.server 8080

# 或 Node
npx serve .
```

然后浏览器打开 <http://localhost:8080>。

### 方式二：GitHub Pages 上线

1. 仓库 **Settings → Pages** → Source 选 `Deploy from a branch` → 分支 `main` / 目录 `/(root)` → Save
2. 稍等 1~2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`
3. 在手机浏览器打开 → 「添加到主屏幕」即可像 App 一样全屏使用（支持离线）

> 提示：GitHub 私有仓库的 Pages 需要付费计划；若需免费 Pages，把仓库可见性改为 Public（Settings → General → Danger Zone → Change visibility）。本项目是纯静态应用、不含任何密钥，公开无风险。

### 安装为桌面 / 手机应用

Chrome / Edge 地址栏右侧「安装」图标，或 iOS Safari → 分享 → 添加到主屏幕。安装后离线也能完整使用。

---

## 🧪 运行测试（Node ≥ 18）

```bash
node tests/perft.js        # 着法生成正确性：6 个经典局面 × perft，与公布值逐一比对
node tests/test-rules.js   # SAN 回放/悔棋/三次重复/50回合/升变/吃过路兵/易位权/逼和/子力不足
node tests/test-engine.js  # AI：找到杀棋、抓住捉双、评估方向、性能
node tests/test-content.js # 课程演示着法、任务答案、题解、残局 FEN 全量校验
```

push 到 `main` 时 GitHub Actions 会自动执行上述测试（见 `.github/workflows/ci.yml`）。

> **CI 首次推送说明**：推送 `.github/workflows/` 需要 GitHub 凭据具备 `workflow` 权限。若首次 `git push` 报
> `refusing to allow an OAuth App to create or update workflow`，执行以下命令补授权后，再
> `git add -f .github/workflows/ci.yml && git commit -m "ci: add workflow" && git push`：
>
> ```bash
> gh auth refresh -h github.com -s workflow   # 按提示完成浏览器授权
> ```

---

## 🏗️ 项目结构

```
FunChess Kids-pwa/
├── index.html              # 单页应用入口
├── manifest.json           # PWA 清单（可安装、独立窗口）
├── sw.js                   # Service Worker（离线缓存，更新时把 CACHE 版本号 +1）
├── css/style.css           # 柔和低饱和配色；手机/平板/PC 三端响应式
├── js/
│   ├── chess-core.js       # 规则核心（0x88 棋盘）：合法着法、将杀/逼和、
│   │                       #   易位/吃过路兵/升变、三次重复、50回合、SAN/PGN/FEN、Zobrist
│   ├── engine.js           # AI 引擎：Negamax + Alpha-Beta + 静态搜索 + 迭代加深，
│   │                       #   评估函数（子力+位置表+兵型+双象+车路+王城），4 档难度参数
│   ├── analysis.js         # 复盘分析器：逐着评估、失误分级与归类、
│   │                       #   儿童化点评文案、优化步骤清单（Worker/主线程共用）
│   ├── board.js            # Canvas 棋盘组件：触摸+鼠标统一交互、点击+拖拽、
│   │                       #   走子动画、升变浮层、提示箭头、将军高亮
│   ├── workers/…           # workers/engine-worker.js：AI 计算全部在后台线程
│   ├── content.js          # 内容库：10 课程 / 12 战术题 / 4 残局 / 贴士
│   ├── store.js            # localStorage 存储：对局记录、进度、徽章、统计聚合、导入导出
│   ├── sounds.js           # WebAudio 合成音效 + 语音讲解(TTS)，无外部音频资源
│   ├── ui.js               # 轻提示 / 弹窗 / 局势条 / 撒花
│   ├── app.js              # Hash 路由 + 首页
│   ├── play.js             # 对战页（人机 + 残局挑战）
│   ├── learn.js            # 学习 / 课程详情 / 战术闯关
│   ├── review.js           # 智能复盘页
│   └── data-views.js       # 历史 / 我的 / 统计
├── tools/make-icons.js     # 图标生成脚本（纯 Node 生成 PNG）
├── tests/                  # 4 套自动化测试
└── .github/workflows/ci.yml
```

## 🧠 关键设计

| 主题 | 说明 |
|---|---|
| 棋盘表示 | 0x88 数组，`Int8Array` 存子，make/unmake 增量更新 + Zobrist 哈希 |
| 搜索性能 | 迭代加深 + MVV-LVA/杀手着法/历史启发排序 + 静态搜索 + 将军延伸；起始局面 perft(4)=197281 约 36ms |
| 难度分级 | 入门(深度1+随机窗口150+20%失误率) → 初级(深度2) → 中级(深度3) → 高级(深度4+完整静态搜索)，均有时间上限防卡 UI |
| 复盘算法 | 每个局面独立评估（白方视角 centipawn），分差 = 走前评估 − 走后评估；阈值 80/150/400cp 分级；配合"对手最大威胁"识别送子 |
| 数据模型 | 对局记录：`{id, startTime, difficulty, color, playerResult, moves[{san, timeSpent}], pgn, review:{plies[], summary}, reviewed}`；用户：`{stars, score, badges[], streak, lessonsDone[], quizDone{}, endgameDone{}}` |
| 隐私合规 | 全部数据仅存本机 localStorage；无账号、无上报、无广告；家长可设每日时长提醒与锁定难度 |

## 📦 部署到 GitHub（deploy.sh）

仓库已含幂等脚本，一键完成 git 初始化 + 建仓 + 推送：

```bash
gh auth login          # 首次需要登录（或 export GITHUB_TOKEN=...）
./deploy.sh            # 默认建私有仓库 fun-chess-kids-pwa
./deploy.sh my-repo    # 自定义仓库名
```

> 本仓库即按上述流程部署：`https://github.com/ahoneyboy/fun-chess-kids-pwa`（private，凭据存在时自动推送；
> 若推送 CI 报 workflow scope 错误，见上文「CI 首次推送说明」）。

## ⚠️ 已知限制与路线图

- AI 为纯 JS 引擎，中级以上约 1200~1600 分水平，适合 6–14 岁学习人群；预留了接入云端 Stockfish 的扩展空间（`workers/engine-worker.js` 替换实现即可）
- 复盘分析为浏览器本地计算，整局 40 回合约需 20~40 秒（有进度条）；后续可加 Web Worker 并行
- 云同步（跨设备）暂以「导出/导入 JSON」代替，保持零账号零上传的隐私设计
- 语音讲解依赖系统 TTS（iOS 需在用户首次交互后可用）

## 📄 许可

MIT License
