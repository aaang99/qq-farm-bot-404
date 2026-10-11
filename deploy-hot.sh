#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== [1/4] 编译前端静态资源 ==="
# 使用精简配置快速安全构建，避免占用过高内存触发 OOM
cp web/vite.config.ts web/vite.config.ts.bak
python3 -c "
with open('web/vite.config.ts') as f:
    text = f.read()
text = text.replace('visualizer({', '/* visualizer({')
text = text.replace('brotliSize: true,\n    }),', 'brotliSize: true,\n    }), */')
with open('web/vite.config.ts', 'w') as f:
    f.write(text)
"

(cd web && NODE_OPTIONS='--max-old-space-size=1200' ./node_modules/.bin/vite build)
mv web/vite.config.ts.bak web/vite.config.ts

echo "=== [2/4] 强制完全同步前端产物到容器 ==="
rm -rf /root/qq-farm-bot/web/dist/dist 2>/dev/null || true
docker cp /root/qq-farm-bot/web/dist/. qq-farm-bot:/app/web/dist/

echo "=== [3/4] 强制同步核心后端文件到容器 ==="
docker cp /root/qq-farm-bot/core/src/. qq-farm-bot:/app/core/src/

echo "=== [4/4] 重启容器应用全部更新 ==="
docker restart qq-farm-bot

echo "=== 部署完成！全部最新改动已 100% 同步生效 ==="
