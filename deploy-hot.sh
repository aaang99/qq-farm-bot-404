#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== [1/4] 编译前端静态资源 (轻量极速模式) ==="
# 临时停止 napcat 腾出 300MB 物理内存给前端编译
docker stop qq-farm-napcat 2>/dev/null || true
sync

(cd web && NODE_OPTIONS='--max-old-space-size=768' ./node_modules/.bin/vite build)

# 编译完成后立即拉起 napcat
docker start qq-farm-napcat 2>/dev/null || true

echo "=== [2/4] 强制完全同步前端产物到容器 ==="
rm -rf /root/qq-farm-bot/web/dist/dist 2>/dev/null || true
docker cp /root/qq-farm-bot/web/dist/. qq-farm-bot:/app/web/dist/

echo "=== [3/4] 强制同步核心后端文件到容器 ==="
docker cp /root/qq-farm-bot/core/src/. qq-farm-bot:/app/core/src/

echo "=== [4/4] 重启容器应用全部更新 ==="
docker restart qq-farm-bot

echo "=== 部署完成！全部最新改动已 100% 同步生效 ==="
