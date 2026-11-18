const process = require("node:process");
const fetch = require("node-fetch");
const { version } = require("../../package.json");
const { getRuntimeConfig } = require("../config/config");
const { getSchedulerRegistrySnapshot } = require("../services/scheduler");

// 更新日志为内置静态内容，不依赖任何站外地址
const CHANGELOG_TEXT = [
  "# QQ Farm Bot 更新日志",
  "",
  "本仓库为存档版本，更新日志随仓库 docs/CHANGELOG.md 一并存放，",
  "可通过仓库页面查看历史变更。",
].join("\n");

const SCHEDULER_UNSUPPORTED_MESSAGE = "DataProvider does not support scheduler status";

function registerAdminPublicInfoRoutes({
  app,
  provider,
  store,
  getAccountIdFromRequest,
  canAccessAccount,
  sendProviderError,
}) {
  app.get("/api/ping", (req, res) => {
    res.json({
      ok: true,
      data: { ok: true, uptime: process.uptime(), version },
    });
  });

  app.get("/api/game-version", (req, res) => {
    const runtimeConfig = getRuntimeConfig();
    res.json({ ok: true, clientVersion: runtimeConfig.clientVersion });
  });

  app.get("/api/changelog", async (req, res) => {
    try {
      res.json({ ok: true, data: CHANGELOG_TEXT });
    }
    catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/auth/validate", (req, res) => {
    res.json({ ok: true, data: { valid: true } });
  });

  app.get("/api/scheduler", async (req, res) => {
    try {
      const accountId = getAccountIdFromRequest(req);
      if (accountId && !canAccessAccount(req, accountId))
        return res.status(403).json({ ok: false, error: "无权访问此账号" });

      if (provider && typeof provider.getSchedulerStatus === "function") {
        const status = await provider.getSchedulerStatus(accountId);
        return res.json({ ok: true, data: status });
      }

      return res.json({
        ok: true,
        data: {
          runtime: getSchedulerRegistrySnapshot(),
          worker: null,
          workerError: SCHEDULER_UNSUPPORTED_MESSAGE,
        },
      });
    }
    catch (error) {
      return sendProviderError(res, error);
    }
  });
}

module.exports = { registerAdminPublicInfoRoutes };
