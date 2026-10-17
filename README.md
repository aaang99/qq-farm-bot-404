<div align="center">

# QQ Farm Bot (已作废 / 停止维护)

🛑 **项目已全面作废 · 接口全部失效 · 停止一切维护**

</div>

> [!CAUTION]
> ### ⚠️ 停止维护与作废声明
> - **接口全面失效**：由于官方接口变更与验证协议升级，本项目涉及的所有自动化功能与登录接口均已**彻底失效**，已无法正常登录与使用。
> - **永久停止维护**：本项目已全面作废并**永久停止维护与更新**，不再接受任何 Issue、PR 或功能适配。
> - **仅供存档学习**：本仓库代码与配置文件仅作为个人代码归档与全栈/容器化技术学习研究之用，请勿尝试用于实际环境。

---

## 📌 免责声明

1. 本项目仅供学习和技术研究使用，不提供任何可用的线上服务。
2. 任何人因使用或运行历史代码产生的封号、数据丢失或法律纠纷，均由使用者自行承担，作者不作任何保证。
3. 本项目为开源学习存档，严禁任何形式的倒卖、源码售卖或收费代部署。

---

## 🐳 历史部署教程（仅供学习参考）

> 以下内容仅保留作为 Docker 容器化编排与 Node.js 全栈项目的部署学习参考。

### 方式 A：Docker Compose 部署（推荐）

```bash
git clone https://github.com/aaang99/qq-farm-bot-404.git
cd qq-farm-bot-404

# 构建并启动容器
docker compose up -d --build
```

#### 服务管理与日志

```bash
# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 停止并移除容器
docker compose down
```

#### 默认端口与数据映射

| 用途 | 端口 / 目录 | 说明 |
| :--- | :--- | :--- |
| Web 管理面板 | `3007` | 面板服务默认端口 |
| 抓包代理端口 | `18000` | 抓包服务端口（默认关闭） |
| 持久化数据 | `./data` | 配置文件与运行数据挂载目录 |

---

### 方式 B：源码本地运行

#### 依赖环境

- Node.js 20+
- pnpm 10+
- Git

#### 运行命令

```bash
git clone https://github.com/aaang99/qq-farm-bot-404.git
cd qq-farm-bot-404

# 启用 corepack 并安装依赖
corepack enable
pnpm install

# 构建前端产物
pnpm build:web

# 启动核心服务
pnpm dev:core
```

服务启动后，本地可通过 `http://localhost:3007` 访问管理面板。
