const { CAPABILITIES } = require('../services/ranch');
const { normalizeSettings, SETTINGS_KEYS, normalizePolicy, getPolicyOptions, LIMITS } = require('../services/ranch-settings');

function registerAdminRanchRoutes({ app, provider, store, getAccountIdFromRequest, canAccessAccount, sendProviderError }) {
    const account = (req, res) => {
        const id = getAccountIdFromRequest(req);
        if (!id) { res.status(400).json({ ok: false, error: '缺少账号标识' }); return null; }
        if (!canAccessAccount(req, id)) { res.status(403).json({ ok: false, error: '无权访问此账号' }); return null; }
        return id;
    };
    const route = (method, path, fn) => app[method](path, async (req, res) => {
        const id = account(req, res); if (!id) return;
        try { res.json({ ok: true, data: await fn(id, req.body || {}, req) }); }
        catch (err) { sendProviderError(res, err); }
    });
    for (const resource of ['friends', 'activity', 'shop', 'illustrated', 'analytics', 'profile']) {
        route('get', `/api/ranch/${resource}`, (id, _body, req) => provider.getRanchResource(id, resource, req.query?.refresh === 'true'));
    }
    route('get', '/api/ranch/status', id => provider.getRanchStatus(id));
    route('post', '/api/ranch/connect', id => provider.connectRanch(id));
    route('post', '/api/ranch/disconnect', id => provider.disconnectRanch(id));
    route('post', '/api/ranch/action', (id, body) => provider.ranchAction(id, body));
    const settings = id => ({ ...normalizeSettings(store.getAutomation(id)), policy: normalizePolicy(store.getAutomation(id).ranch_policy), policyOptions: getPolicyOptions(), policyLimits: LIMITS, capabilities: CAPABILITIES });
    route('get', '/api/ranch/settings', id => settings(id));
    route('post', '/api/ranch/settings', (id, body) => {
        const patch = {};
        for (const [key, value] of Object.entries(body)) {
            if (key === 'policy') {
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('无效牧场策略');
                patch.ranch_policy = normalizePolicy({ ...normalizePolicy(store.getAutomation(id).ranch_policy), ...value }, true);
                continue;
            }
            if (!SETTINGS_KEYS[key] || typeof value !== 'boolean') throw new Error('无效牧场设置');
            patch[SETTINGS_KEYS[key]] = value;
        }
        if (patch.ranch_policy?.mode === 'simple') { patch.ranch_auto_buy = false; patch.ranch_auto_exchange = false; }
        store.applyConfigSnapshot({ automation: patch }, { accountId: id });
        if (provider.broadcastConfig) provider.broadcastConfig(id);
        return settings(id);
    });
}
module.exports = { registerAdminRanchRoutes };
