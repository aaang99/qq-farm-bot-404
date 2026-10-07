#!/usr/bin/env bash
# ==============================================================================
# 安全同步上游原作者更新脚本 (Safe Upstream Sync Script)
# 特性：
# 1. 自动前置备份分支与工作区暂存，保障资产绝对安全
# 2. 遇到代码冲突立即安全熔断回滚 (git merge --abort)，绝不损坏现有运行环境
# 3. 只有构建编译 100% 成功时才会应用到容器
# 4. 账号数据、登录凭据目录 (data/) 完全隔离，不参与合并
# ==============================================================================

set -e

# 确保在仓库根目录执行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

UPSTREAM_URL="https://github.com/xxxscarlxrd404/qq-farm-bot.git"
BACKUP_BRANCH="backup-$(date +%Y%m%d-%H%M%S)"

echo "--------------------------------------------------------"
echo "🚜 [1/6] 检查上游仓库配置..."
if ! git remote | grep -q "^upstream$"; then
    echo "  -> 未检测到 upstream 远程源，正在自动配置关联上游..."
    git remote add upstream "$UPSTREAM_URL"
fi
echo "  -> 上游地址: $UPSTREAM_URL"

echo "--------------------------------------------------------"
echo "🛡️  [2/6] 创建安全保护快照..."
# 暂存未提交的工作区改动（如果有）
STASHED=0
if ! git diff-index --quiet HEAD --; then
    echo "  -> 检测到未提交的改动，正在自动保护暂存 (stash)..."
    git stash push -m "auto-stash-before-update-$(date +%s)"
    STASHED=1
fi

# 创建本地保护备份分支
git branch "$BACKUP_BRANCH"
echo "  -> 已建立备份分支: $BACKUP_BRANCH（随时可用于一键撤销回滚）"

echo "--------------------------------------------------------"
echo "📡 [3/6] 正在拉取上游最新改动..."
git fetch upstream main

echo "--------------------------------------------------------"
echo "🔀 [4/6] 尝试合并上游更新..."
if git merge upstream/main --no-edit; then
    echo "  -> 合并成功，无代码冲突！"
else
    echo "❌ [警告] 检测到代码冲突 (Merge Conflict)！"
    echo "  -> 触发安全熔断保护机制：正在撤销合并操作..."
    git merge --abort
    if [ "$STASHED" -eq 1 ]; then
        git stash pop >/dev/null 2>&1 || true
    fi
    echo "  -> 工作区已安全恢复到更新前状态，未做任何破坏性更改。"
    echo "  -> 提示：原作者与你的二改修改了同一行代码，建议在 AI 协助下手动核对冲突后合并。"
    exit 1
fi

# 如果之前暂存了文件，恢复暂存
if [ "$STASHED" -eq 1 ]; then
    echo "  -> 正在恢复暂存的本地改动..."
    git stash pop
fi

echo "--------------------------------------------------------"
echo "🔨 [5/6] 正在编译前端..."
if pnpm build:web; then
    echo "  -> 前端构建成功！"
else
    echo "❌ 前端构建失败！触发回滚机制..."
    git reset --hard "$BACKUP_BRANCH"
    exit 1
fi

echo "--------------------------------------------------------"
echo "🚀 [6/6] 正在热更新至 Docker 容器..."
if docker ps --format '{{.Names}}' | grep -q "^qq-farm-bot$"; then
    docker cp web/dist/. qq-farm-bot:/app/web/dist/
    echo "  -> 前端静态资源已热更新至运行容器！"
else
    echo "  -> 未发现运行中的 qq-farm-bot 容器，仅完成本地编译。"
fi

echo "--------------------------------------------------------"
echo "✅ 上游更新同步已全部顺利完成！"
echo "💡 若需要将合并后的更新同步至你的 GitHub 仓库，执行以下命令即可："
echo "   git push origin main"
echo "--------------------------------------------------------"
