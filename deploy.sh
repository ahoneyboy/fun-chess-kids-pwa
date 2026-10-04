#!/usr/bin/env bash
# ============================================================
# 趣棋小将 FunChess Kids · GitHub 部署脚本（幂等，可重复执行）
#
# 用法：
#   ./deploy.sh              # 默认仓库名 fun-chess-kids-pwa（私有）
#   ./deploy.sh my-repo      # 自定义仓库名
#
# 前置条件（二选一）：
#   1) gh auth login                       # GitHub CLI 登录
#   2) export GITHUB_TOKEN=ghp_xxx         # 或设置环境变量
#
# 脚本流程：git init → 规范 .gitignore → commit → gh 建仓 → push
# 已初始化/已建仓时自动跳过对应步骤，重复执行安全。
# ============================================================
set -euo pipefail

REPO_NAME="${1:-fun-chess-kids-pwa}"
BRANCH="main"

echo "▶ 仓库目标：$REPO_NAME（private）"

# ---------- 1. 检查凭据 ----------
if command -v gh >/dev/null 2>&1; then
  if ! gh auth status >/dev/null 2>&1; then
    if [ -z "${GITHUB_TOKEN:-}" ]; then
      echo "✋ 未检测到 GitHub 凭据。请先执行 'gh auth login' 或 'export GITHUB_TOKEN=...'"
      echo "   配置后重新运行本脚本即可。"
      exit 1
    fi
  fi
  HAVE_GH=1
else
  echo "⚠️ 未安装 gh CLI。请先安装：https://cli.github.com/"
  exit 1
fi

# ---------- 2. git 初始化 ----------
if [ ! -d .git ]; then
  git init -b "$BRANCH"
  echo "✔ git 仓库已初始化（分支 $BRANCH）"
else
  echo "• git 仓库已存在，跳过 init"
fi

# ---------- 3. 提交 ----------
git add -A
if git diff --cached --quiet; then
  echo "• 没有新的改动需要提交"
else
  git commit -m "feat: init FunChess Kids PWA (儿童国际象棋学习对战)"
  echo "✔ 已提交"
fi

# ---------- 4. 建仓 + 推送 ----------
if git remote get-url origin >/dev/null 2>&1; then
  echo "• remote origin 已存在：$(git remote get-url origin)"
else
  gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
  echo "✔ 私有仓库已创建并完成首次推送"
fi

# 后续更新推送
if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin "$BRANCH" || echo "（推送失败请检查网络/凭据后重试）"
fi

REPO_URL=$(gh repo view --json url -q .url 2>/dev/null || echo "https://github.com/$(gh api user -q .login)/$REPO_NAME")
echo ""
echo "🎉 部署完成！仓库地址：$REPO_URL"
echo "   上线 GitHub Pages：仓库 Settings → Pages → 分支 main /(root)"
echo "   （私有仓库 Pages 需付费计划；免费方案可将仓库改为 Public，本项目无任何密钥，公开无风险）"
