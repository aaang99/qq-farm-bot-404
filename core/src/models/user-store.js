const fs = require('fs');
const path = require('path');
const { getDataFile, ensureDataDir } = require('../config/runtime-paths');
const crypto = require('crypto');

const USERS_FILE = getDataFile('users.json');
const CARDS_FILE = getDataFile('cards.json');
const LOGIN_ATTEMPTS_FILE = getDataFile('login-attempts.json');
const CARD_CLAIM_FILE = getDataFile('card-claim.json');

const DEFAULT_ACCOUNT_LIMIT = 2;

let cardClaimEnabled = false;
let cardClaimRecords = [];

const SALT_LENGTH = 32;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 10;

let loginAttempts = {};

function loadLoginAttempts() {
    try {
        ensureDataDir();
        if (fs.existsSync(LOGIN_ATTEMPTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(LOGIN_ATTEMPTS_FILE, 'utf8'));
            loginAttempts = data || {};
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (e) {
        loginAttempts = {};
    }
}

function saveLoginAttempts() {
    try {
        ensureDataDir();
        fs.writeFileSync(LOGIN_ATTEMPTS_FILE, JSON.stringify(loginAttempts, null, 2), 'utf8');
    } catch (e) {
        console.error('保存登录尝试记录失败:', e.message);
    }
}

function cleanExpiredAttempts() {
    const now = Date.now();
    let cleaned = false;
    
    for (const key of Object.keys(loginAttempts)) {
        const attempt = loginAttempts[key];
        if (attempt.lockedUntil && attempt.lockedUntil < now) {
            delete loginAttempts[key];
            cleaned = true;
        } else if (attempt.windowStart && (now - attempt.windowStart) > RATE_LIMIT_WINDOW) {
            delete loginAttempts[key];
            cleaned = true;
        }
    }
    
    if (cleaned) saveLoginAttempts();
}

function checkRateLimit(ip) {
    cleanExpiredAttempts();
    const ipKey = `ip:${ip}`;
    const now = Date.now();
    
    if (!loginAttempts[ipKey]) {
        loginAttempts[ipKey] = { count: 1, windowStart: now };
        saveLoginAttempts();
        return { allowed: true };
    }
    
    const attempt = loginAttempts[ipKey];
    
    if (now - attempt.windowStart > RATE_LIMIT_WINDOW) {
        loginAttempts[ipKey] = { count: 1, windowStart: now };
        saveLoginAttempts();
        return { allowed: true };
    }
    
    if (attempt.count >= MAX_ATTEMPTS_PER_IP) {
        const remainingMs = RATE_LIMIT_WINDOW - (now - attempt.windowStart);
        return { 
            allowed: false, 
            remainingMs,
            message: `请求过于频繁，请 ${Math.ceil(remainingMs / 1000)} 秒后重试`
        };
    }
    
    attempt.count++;
    saveLoginAttempts();
    return { allowed: true };
}

function checkAccountLockout(username) {
    cleanExpiredAttempts();
    const userKey = `user:${username}`;
    const now = Date.now();
    
    if (loginAttempts[userKey] && loginAttempts[userKey].lockedUntil) {
        if (loginAttempts[userKey].lockedUntil > now) {
            const remainingMs = loginAttempts[userKey].lockedUntil - now;
            return {
                locked: true,
                remainingMs,
                message: `账户已被锁定，请 ${Math.ceil(remainingMs / 1000 / 60)} 分钟后重试`
            };
        } else {
            delete loginAttempts[userKey];
            saveLoginAttempts();
        }
    }
    
    return { locked: false };
}

function recordFailedAttempt(username) {
    const userKey = `user:${username}`;
    const now = Date.now();
    
    if (!loginAttempts[userKey]) {
        loginAttempts[userKey] = { count: 1, firstAttempt: now };
    } else {
        loginAttempts[userKey].count++;
        loginAttempts[userKey].lastAttempt = now;
    }
    
    if (loginAttempts[userKey].count >= MAX_LOGIN_ATTEMPTS) {
        loginAttempts[userKey].lockedUntil = now + LOCKOUT_DURATION;
        saveLoginAttempts();
        return {
            locked: true,
            message: `登录失败次数过多，账户已被锁定 ${LOCKOUT_DURATION / 60000} 分钟`
        };
    }
    
    saveLoginAttempts();
    return {
        locked: false,
        remainingAttempts: MAX_LOGIN_ATTEMPTS - loginAttempts[userKey].count
    };
}

function clearFailedAttempts(username) {
    const userKey = `user:${username}`;
    if (loginAttempts[userKey]) {
        delete loginAttempts[userKey];
        saveLoginAttempts();
    }
}

function validatePasswordStrength(password) {
    if (!password || String(password).trim().length === 0) {
        return { valid: false, errors: ['请输入密码'] };
    }
    return { valid: true, errors: [] };
}

function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    }
    
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    if (storedPassword.includes(':')) {
        const [salt, hash] = storedPassword.split(':');
        const newHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
        return hash === newHash;
    } else {
        const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
        return storedPassword === legacyHash;
    }
}

function needsRehash(storedPassword) {
    return !storedPassword.includes(':');
}

const generateCardCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

let users = [];
let cards = [];

function loadUsers() {
    ensureDataDir();
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            users = Array.isArray(data.users) ? data.users : [];
        } else {
            users = [];
            saveUsers();
        }
    } catch (e) {
        console.error('加载用户数据失败:', e.message);
        users = [];
    }
}

function saveUsers() {
    ensureDataDir();
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), 'utf8');
    } catch (e) {
        console.error('保存用户数据失败:', e.message);
    }
}

function loadCards() {
    ensureDataDir();
    try {
        if (fs.existsSync(CARDS_FILE)) {
            const data = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
            cards = Array.isArray(data.cards) ? data.cards : [];
        } else {
            cards = [];
            saveCards();
        }
    } catch (e) {
        console.error('加载卡密数据失败:', e.message);
        cards = [];
    }
}

function saveCards() {
    ensureDataDir();
    try {
        fs.writeFileSync(CARDS_FILE, JSON.stringify({ cards }, null, 2), 'utf8');
    } catch (e) {
        console.error('保存卡密数据失败:', e.message);
    }
}

function initDefaultAdmin() {
    loadUsers();
    // 只要系统已有任何管理员账号（无论是 admin 还是自定义管理员如 17630803121），绝不能再自动新建 'admin' 账号！
    const hasAnyAdmin = users.some(u => u.role === 'admin' || u.role === 'super_admin');
    if (!hasAnyAdmin && users.length === 0) {
        const defaultPassword = 'admin';
        users.push({
            username: 'admin',
            password: hashPassword(defaultPassword),
            role: 'admin',
            createdAt: Date.now(),
            accountLimit: 2,
            card: {
                days: -1,
                expiresAt: null
            }
        });
        saveUsers();
        console.log('[用户系统] 系统暂无管理员，已创建默认管理员账号，默认密码: admin');
    }
}

function validateUser(username, password, ip = 'unknown') {
    loadUsers();
    loadLoginAttempts();

    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
        return { 
            error: 'rate_limit', 
            message: rateLimitResult.message,
            remainingMs: rateLimitResult.remainingMs
        };
    }

    const lockoutResult = checkAccountLockout(username);
    if (lockoutResult.locked) {
        return { 
            error: 'locked', 
            message: lockoutResult.message,
            remainingMs: lockoutResult.remainingMs
        };
    }
    
    const user = users.find(u => u.username === username);
    if (!user) {
        recordFailedAttempt(username);
        return { error: 'invalid_credentials', message: '用户名或密码错误' };
    }
    
    if (!verifyPassword(password, user.password)) {
        const attemptResult = recordFailedAttempt(username);
        if (attemptResult.locked) {
            return { 
                error: 'locked', 
                message: attemptResult.message 
            };
        }
        return { 
            error: 'invalid_credentials', 
            message: `用户名或密码错误，剩余尝试次数: ${attemptResult.remainingAttempts}` 
        };
    }
    
    clearFailedAttempts(username);
    
    if (needsRehash(user.password)) {
        user.password = hashPassword(password);
        saveUsers();
        console.log(`[安全] 用户 ${username} 密码已升级为新哈希算法`);
    }
    
    return {
        username: user.username,
        role: user.role,
        cardCode: user.cardCode || null,
        card: user.card || null,
        accountLimit: user.accountLimit || DEFAULT_ACCOUNT_LIMIT,
        avatar: user.avatar || '/default-user-avatar.png'
    };
}

function registerUser(username, password, cardCode, meta) {
    loadUsers();
    loadCards();
    const clientUa = String((meta && meta.ua) || '');
    const clientIp = String((meta && meta.ip) || '');

    if (!username || username.length < 3 || username.length > 32) {
        return { ok: false, error: '用户名长度需在3-32位之间' };
    }

    if (!/^\w+$/.test(username)) {
        return { ok: false, error: '用户名只能包含字母、数字和下划线' };
    }

    if (users.find(u => u.username === username)) {
        return { ok: false, error: '用户名已存在' };
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
        return { ok: false, error: passwordValidation.errors.join('；') };
    }

    const card = cards.find(c => c.code === cardCode);
    if (!card) {
        return { ok: false, error: '卡密不存在' };
    }

    const usable = isCardConsumable(card);
    if (!usable.ok) {
        return { ok: false, error: usable.error };
    }

    // 定制卡防刷：单账号限用一次、单 UA 限用一次、单 IP 限用一次（永久）
    if (card.type === 'custom') {
        const abuse = checkCustomCardAbuse(card, { username, ua: clientUa, ip: clientIp });
        if (!abuse.ok) {
            return { ok: false, error: abuse.error };
        }
    }

    if (card.isFree === true) {
        const freeCheck = checkFreeCardLimit({ username });
        if (!freeCheck.allowed) {
            return { ok: false, error: freeCheck.message };
        }
    }

    const cardType = card.type || 'time';
    if (cardType === 'quota') {
        return { ok: false, error: '注册只能使用时间卡密，额度卡密请登录后在续费中使用' };
    }

    const now = Date.now();
    
    const newUser = {
        username,
        password: hashPassword(password),
        role: 'user',
        cardCode,
        card: {
            code: card.code,
            description: card.description,
            days: card.days,
            expiresAt: card.days === -1 ? null : (now + card.days * 24 * 60 * 60 * 1000),
            enabled: true
        },
        accountLimit: Number(card.quota) > 0 ? Number(card.quota) : DEFAULT_ACCOUNT_LIMIT,
        avatar: '/default-user-avatar.png',
        createdAt: now
    };

    users.push(newUser);
    consumeCard(card, username, now);
    if (card.type === 'custom') {
        recordCustomCardUse(card, { username, ua: clientUa, ip: clientIp, now });
    }

    saveUsers();
    saveCards();
    
    clearFailedAttempts(username);

    return { ok: true, user: { username: newUser.username, role: newUser.role, card: newUser.card, accountLimit: newUser.accountLimit, avatar: newUser.avatar } };
}

// ============ 定制卡防刷（单账号 / 单 UA / 单 IP 各限一次） ============
function getCustomCardUses(card) {
    if (!Array.isArray(card.customUses)) card.customUses = [];
    return card.customUses;
}

// IP 维度采用频率限制（避免公司/学校/运营商 NAT 共用出口 IP 互相误伤）
const CUSTOM_CARD_IP_WINDOW_MS = 10 * 60 * 1000;
const CUSTOM_CARD_IP_MAX_USES = 2;

function checkCustomCardAbuse(card, { username = '', ua = '', ip = '' } = {}) {
    const uses = getCustomCardUses(card);
    if (uses.length === 0) return { ok: true };

    const normUser = String(username || '').trim().toLowerCase();
    const uaHash = ua ? crypto.createHash('sha256').update(ua).digest('hex') : '';
    const normIp = String(ip || '').replace(/^.*:/, '').trim();
    const now = Date.now();

    // 单账号 / 单设备：强限制，永久一次
    for (const u of uses) {
        if (normUser && u.username && String(u.username).toLowerCase() === normUser) {
            return { ok: false, error: '该账号已使用过此定制卡，每个账号限用一次' };
        }
        if (uaHash && u.uaHash && u.uaHash === uaHash) {
            return { ok: false, error: '当前设备已使用过此定制卡，每个设备限用一次' };
        }
    }

    // 单 IP：频率限制，窗口期内最多 N 次
    if (normIp) {
        const recentIpUses = uses.filter(
            u => u.ip && u.ip === normIp && (now - Number(u.usedAt || 0)) < CUSTOM_CARD_IP_WINDOW_MS
        );
        if (recentIpUses.length >= CUSTOM_CARD_IP_MAX_USES) {
            const oldest = Math.min(...recentIpUses.map(u => Number(u.usedAt || 0)));
            const waitMin = Math.max(1, Math.ceil((CUSTOM_CARD_IP_WINDOW_MS - (now - oldest)) / 60000));
            return {
                ok: false,
                error: `当前网络IP使用该卡过于频繁，请 ${waitMin} 分钟后再试`,
                remainingMs: CUSTOM_CARD_IP_WINDOW_MS - (now - oldest),
            };
        }
    }
    return { ok: true };
}

function recordCustomCardUse(card, { username = '', ua = '', ip = '', now = Date.now() } = {}) {
    const uses = getCustomCardUses(card);
    uses.push({
        username: String(username || '').toLowerCase(),
        uaHash: ua ? crypto.createHash('sha256').update(ua).digest('hex') : '',
        ip: String(ip || '').replace(/^.*:/, '').trim(),
        usedAt: now,
    });
}

// 卡密是否仍可用（支持定制卡多次使用）
// 消耗一次卡密（定制卡累加使用次数，达到上限即视为已用尽）
function consumeCard(card, username, now) {
    const isRepeatable = card.type === 'custom';
    if (!isRepeatable) {
        card.usedBy = username;
        card.usedAt = now;
        return;
    }
    card.useCount = (Number(card.useCount) || 0) + 1;
    card.usedAt = now;
    card.lastUsedBy = username;
    const unlimited = card.unlimitedUses === true || Number(card.maxUses) === -1;
    const exhausted = !unlimited && card.useCount >= Number(card.maxUses || 1);
    card.exhausted = exhausted;
}

function isCardConsumable(card) {
    if (!card) return { ok: false, error: '卡密不存在' };
    if (!card.enabled) return { ok: false, error: '卡密已被禁用' };
    if (card.usedBy) {
        // 定制卡：未达次数上限可继续使用
        if (card.type === 'custom') {
            const used = Number(card.useCount) || 0;
            const unlimited = card.unlimitedUses === true || Number(card.maxUses) === -1;
            if (unlimited || used < Number(card.maxUses || 1)) {
                return { ok: true };
            }
            return { ok: false, error: '卡密可使用次数已耗尽' };
        }
        return { ok: false, error: '卡密已被使用' };
    }
    return { ok: true };
}

function renewUser(username, cardCode) {
    loadUsers();
    loadCards();

    const user = users.find(u => u.username === username);
    if (!user) {
        return { ok: false, error: '用户不存在' };
    }

    const card = cards.find(c => c.code === cardCode);
    if (!card) {
        return { ok: false, error: '卡密不存在' };
    }

    const usable = isCardConsumable(card);
    if (!usable.ok) {
        return { ok: false, error: usable.error };
    }

    // 定制卡防刷：单账号限用一次
    if (card.type === 'custom') {
        const abuse = checkCustomCardAbuse(card, { username });
        if (!abuse.ok) {
            return { ok: false, error: abuse.error };
        }
    }

    const now = Date.now();
    const cardType = card.type || 'time';

    if (cardType === 'quota') {
        // 额度卡密：增加账号额度
        const currentLimit = user.accountLimit || DEFAULT_ACCOUNT_LIMIT;
        user.accountLimit = currentLimit + card.days;
    } else if (cardType === 'custom') {
        // 定制卡：按天数续期，并叠加自定义额度
        if (!user.card) {
            user.card = {
                code: card.code,
                description: card.description,
                days: 0,
                expiresAt: null,
                enabled: true
            };
        }
        const quotaAdd = Number(card.quota) || 0;
        if (quotaAdd > 0) {
            user.accountLimit = (user.accountLimit || DEFAULT_ACCOUNT_LIMIT) + quotaAdd;
        }
        const currentExpires = user.card.expiresAt || 0;
        const currentDays = user.card.days || 0;
        if (card.days === -1) {
            user.card.expiresAt = null;
            user.card.days = -1;
        } else if (user.card.days === -1) {
            user.card.expiresAt = null;
        } else {
            user.card.days = currentDays + card.days;
            if (currentExpires && currentExpires > now) {
                user.card.expiresAt = currentExpires + card.days * 24 * 60 * 60 * 1000;
            } else {
                user.card.expiresAt = now + card.days * 24 * 60 * 60 * 1000;
            }
        }
    } else {
        // 时间卡密：增加使用时长
        // 确保用户有card对象
        if (!user.card) {
            user.card = {
                code: card.code,
                description: card.description,
                days: 0,
                expiresAt: null,
                enabled: true
            };
        }
        
        const currentExpires = user.card.expiresAt || 0;
        const currentDays = user.card.days || 0;
        
        // days为-1表示永久
        if (card.days === -1) {
            // 永久卡，设置为永久
            user.card.expiresAt = null;
            user.card.days = -1;
        } else if (user.card.days === -1) {
            // 已经是永久，保持永久
            user.card.expiresAt = null;
        } else {
            // 累加天数
            user.card.days = currentDays + card.days;
            
            // 计算新的过期时间
            if (currentExpires && currentExpires > now) {
                // 未过期，在当前过期时间基础上增加
                user.card.expiresAt = currentExpires + card.days * 24 * 60 * 60 * 1000;
            } else {
                // 已过期或无过期时间，从现在开始计算
                user.card.expiresAt = now + card.days * 24 * 60 * 60 * 1000;
            }
        }
    }

    // 标记卡密已使用（定制卡累加次数）
    consumeCard(card, username, now);
    if (card.type === 'custom') {
        recordCustomCardUse(card, { username, now });
    }
    if (card.isFree === true) {
        recordFreeCardUsage({ username, cardCode: card.code, action: 'use' });
    }

    saveUsers();
    saveCards();

    return { ok: true, card: user.card, accountLimit: user.accountLimit || DEFAULT_ACCOUNT_LIMIT, cardType };
}

function getAllUsers() {
    loadUsers();
    return users.map(u => ({
        username: u.username,
        role: u.role,
        card: u.card,
        createdAt: u.createdAt || null,
        lastLoginAt: u.lastLoginAt || null,
        accountLimit: u.accountLimit || DEFAULT_ACCOUNT_LIMIT
    }));
}

function updateUser(username, updates) {
    loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return null;

    if (updates.expiresAt !== undefined) {
        if (!user.card) user.card = {};
        user.card.expiresAt = updates.expiresAt;
    }

    if (updates.enabled !== undefined) {
        if (!user.card) user.card = {};
        user.card.enabled = updates.enabled;
    }

    saveUsers();

    return { username: user.username, role: user.role, card: user.card, accountLimit: user.accountLimit || DEFAULT_ACCOUNT_LIMIT };
}

function editUser(oldUsername, updates) {
    loadUsers();
    
    const user = users.find(u => u.username === oldUsername);
    if (!user) {
        return { ok: false, error: '用户不存在' };
    }

    if (updates.newUsername && updates.newUsername !== oldUsername) {
        if (!/^\w{3,32}$/.test(updates.newUsername)) {
            return { ok: false, error: '用户名只能包含字母、数字和下划线，长度3-32位' };
        }
        const existingUser = users.find(u => u.username === updates.newUsername);
        if (existingUser) {
            return { ok: false, error: '用户名已存在' };
        }
        user.username = updates.newUsername;

        // 级联更新已用卡密所有者记录
        loadCards();
        let cardsChanged = false;
        for (const c of cards) {
            if (c.usedBy === oldUsername) {
                c.usedBy = updates.newUsername;
                cardsChanged = true;
            }
        }
        if (cardsChanged) saveCards();

        // 级联更新公开卡密领取记录
        loadCardClaimRecords();
        let claimsChanged = false;
        for (const r of cardClaimRecords) {
            if (r.username === oldUsername) {
                r.username = updates.newUsername;
                claimsChanged = true;
            }
        }
        if (claimsChanged) saveCardClaimRecords();
    }

    if (updates.password) {
        const passwordValidation = validatePasswordStrength(updates.password);
        if (!passwordValidation.valid) {
            return { ok: false, error: passwordValidation.errors.join('；') };
        }
        user.password = hashPassword(updates.password);
    }

    if (updates.accountLimit !== undefined) {
        user.accountLimit = Number.parseInt(updates.accountLimit, 10) || DEFAULT_ACCOUNT_LIMIT;
    }

    if (updates.isPermanent) {
        if (!user.card) user.card = {};
        user.card.days = -1;
        user.card.expiresAt = null;
    } else if (updates.expiresAt !== undefined) {
        if (!user.card) user.card = {};
        if (updates.expiresAt === null) {
            user.card.days = 0;
            user.card.expiresAt = null;
        } else {
            const now = Date.now();
            const expiresAt = Number.parseInt(updates.expiresAt, 10);
            user.card.expiresAt = expiresAt;
            const diffMs = expiresAt - now;
            const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
            user.card.days = diffDays > 0 ? diffDays : 0;
        }
    }

    saveUsers();

    return { 
        ok: true, 
        user: { 
            username: user.username, 
            role: user.role, 
            card: user.card, 
            accountLimit: user.accountLimit || DEFAULT_ACCOUNT_LIMIT 
        } 
    };
}

function getAllCards() {
    loadCards();
    return cards;
}

function createCard(description, days, type = 'time', isFree = false, extra = {}) {
    loadCards();

    const opts = extra || {};
    const cardType = type === 'quota' ? 'quota' : (type === 'custom' ? 'custom' : 'time');
    const customCode = typeof opts.code === 'string' ? opts.code.trim() : '';
    if (customCode) {
        if (customCode.length < 3 || customCode.length > 64) {
            return { ok: false, error: '自定义卡密长度需在 3-64 位之间' };
        }
        if (!/^[A-Za-z0-9_-]+$/.test(customCode)) {
            return { ok: false, error: '自定义卡密只能包含字母、数字、下划线和短横线' };
        }
        if (cards.find(c => c.code === customCode)) {
            return { ok: false, error: '该卡密已存在，请更换' };
        }
    }
    const newCard = {
        code: customCode || generateCardCode(),
        description,
        days: Number.parseInt(days, 10) || 30,
        type: cardType,
        isFree: Boolean(isFree),
        enabled: true,
        usedBy: null,
        usedAt: null,
        useCount: 0,
        createdAt: Date.now()
    };
    // 定制卡：可自定义额度、无限次数
    if (cardType === 'custom') {
        if (opts.quota !== undefined && opts.quota !== null && opts.quota !== '') {
            newCard.quota = Number.parseInt(opts.quota, 10) || 0;
        }
        newCard.unlimitedUses = opts.unlimitedUses === true;
        newCard.maxUses = newCard.unlimitedUses ? -1 : Math.max(1, Number.parseInt(opts.maxUses, 10) || 1);
    }

    cards.push(newCard);
    saveCards();

    return newCard;
}

function createCardsBatch(description, days, count, type = 'time', isFree = false, extra = {}) {
    loadCards();

    const opts = extra || {};
    const createdCards = [];
    const daysNum = Number.parseInt(days, 10) || 30;
    const countNum = Math.min(Math.max(Number.parseInt(count, 10) || 1, 1), 100);
    const cardType = type === 'quota' ? 'quota' : (type === 'custom' ? 'custom' : 'time');
    const freeFlag = Boolean(isFree);

    for (let i = 0; i < countNum; i++) {
        const newCard = {
            code: generateCardCode(),
            description,
            days: daysNum,
            type: cardType,
            isFree: freeFlag,
            enabled: true,
            usedBy: null,
            usedAt: null,
            useCount: 0,
            createdAt: Date.now()
        };
        if (cardType === 'custom') {
            if (opts.quota !== undefined && opts.quota !== null && opts.quota !== '') {
                newCard.quota = Number.parseInt(opts.quota, 10) || 0;
            }
            newCard.unlimitedUses = opts.unlimitedUses === true;
            newCard.maxUses = newCard.unlimitedUses ? -1 : Math.max(1, Number.parseInt(opts.maxUses, 10) || 1);
        }
        cards.push(newCard);
        createdCards.push(newCard);
    }

    saveCards();

    return createdCards;
}

function updateCard(code, updates) {
    loadCards();
    const card = cards.find(c => c.code === code);
    if (!card) return null;

    if (updates.description !== undefined) {
        card.description = updates.description;
    }

    if (updates.enabled !== undefined) {
        card.enabled = updates.enabled;
    }

    // 定制卡专属：天数 / 额度 / 剩余可使用次数
    if (card.type === 'custom') {
        if (updates.days !== undefined) {
            card.days = Number.parseInt(updates.days, 10) || 0;
        }
        if (updates.quota !== undefined) {
            card.quota = Math.max(0, Number.parseInt(updates.quota, 10) || 0);
        }
        if (updates.unlimitedUses !== undefined) {
            card.unlimitedUses = updates.unlimitedUses === true;
            if (card.unlimitedUses) card.maxUses = -1;
        }
        // 剩余次数：直接设定"还剩多少次可用"，内部换算为总上限
        if (updates.remainingUses !== undefined && card.unlimitedUses !== true) {
            const remaining = Math.max(0, Number.parseInt(updates.remainingUses, 10) || 0);
            card.maxUses = (Number(card.useCount) || 0) + remaining;
        }
        const unlimited = card.unlimitedUses === true || Number(card.maxUses) === -1;
        card.exhausted = !unlimited && (Number(card.useCount) || 0) >= Number(card.maxUses || 1);
    }

    saveCards();
    return card;
}

function deleteCard(code) {
    loadCards();
    const idx = cards.findIndex(c => c.code === code);
    if (idx === -1) return false;

    cards.splice(idx, 1);
    saveCards();
    return true;
}

function deleteCardsBatch(codes) {
    loadCards();
    if (!Array.isArray(codes) || codes.length === 0) {
        return { ok: false, error: '请提供要删除的卡密列表' };
    }

    let deletedCount = 0;
    const notFoundCodes = [];

    for (const code of codes) {
        const idx = cards.findIndex(c => c.code === code);
        if (idx !== -1) {
            cards.splice(idx, 1);
            deletedCount++;
        } else {
            notFoundCodes.push(code);
        }
    }

    saveCards();
    return {
        ok: true,
        deletedCount,
        notFoundCount: notFoundCodes.length,
        notFoundCodes: notFoundCodes.length > 0 ? notFoundCodes : undefined
    };
}

function deleteUser(username, forceDeleteAdmin = false) {
    loadUsers();
    const idx = users.findIndex(u => u.username === username);
    if (idx === -1) return { ok: false, error: '用户不存在' };

    // 不允许删除管理员账号（除非强制删除）
    if (!forceDeleteAdmin && users[idx].role === 'admin') {
        return { ok: false, error: '不能删除管理员账号' };
    }

    users.splice(idx, 1);
    saveUsers();
    return { ok: true };
}

function changePassword(username, oldPassword, newPassword) {
    loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) {
        return { ok: false, error: '用户不存在' };
    }

    if (!verifyPassword(oldPassword, user.password)) {
        return { ok: false, error: '当前密码错误' };
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
        return { ok: false, error: passwordValidation.errors.join('；') };
    }

    user.password = hashPassword(newPassword);
    if (user.mustChangePassword) {
        delete user.mustChangePassword;
    }

    saveUsers();
    return { ok: true, message: '密码修改成功' };
}

// 保存用户微信登录配置
// 获取用户微信登录配置
// 获取用户账号额度
// 检查用户是否可以添加更多账号
initDefaultAdmin();

// ============ 卡密领取功能 ============
function loadCardClaimRecords() {
    ensureDataDir();
    try {
        if (fs.existsSync(CARD_CLAIM_FILE)) {
            const data = JSON.parse(fs.readFileSync(CARD_CLAIM_FILE, 'utf8'));
            cardClaimEnabled = data.enabled === true;
            cardClaimRecords = data.records || [];
        } else {
            cardClaimEnabled = true;
            cardClaimRecords = [];
            saveCardClaimRecords();
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (e) {
        cardClaimEnabled = true;
        cardClaimRecords = [];
    }
}

function saveCardClaimRecords() {
    ensureDataDir();
    try {
        fs.writeFileSync(CARD_CLAIM_FILE, JSON.stringify({
            enabled: cardClaimEnabled,
            records: cardClaimRecords
        }, null, 2), 'utf8');
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (e) {
        // console.error('保存卡密领取记录失败:', e.message);
    }
}

function getCardClaimStatus() {
    loadCardClaimRecords();
    return { enabled: cardClaimEnabled };
}

function setCardClaimStatus(enabled) {
    loadCardClaimRecords();
    cardClaimEnabled = !!enabled;
    saveCardClaimRecords();
    return { enabled: cardClaimEnabled };
}


const FREE_CARD_COOLDOWN_MS = 29 * 24 * 60 * 60 * 1000;

function checkFreeCardLimit({ ip = '', username = '', ua = '' } = {}) {
    loadCardClaimRecords();
    const now = Date.now();
    const uaHash = ua ? crypto.createHash('sha256').update(ua).digest('hex') : '';
    const normIp = String(ip || '').replace(/^.*:/, '').trim();
    const normUser = String(username || '').trim().toLowerCase();

    for (const r of cardClaimRecords) {
        const elapsed = now - Number(r.claimTime || r.usedTime || 0);
        if (elapsed < FREE_CARD_COOLDOWN_MS) {
            let matched = false;
            let reason = '';
            if (normUser && r.username && r.username.toLowerCase() === normUser) {
                matched = true;
                reason = '当前账号';
            } else if (normIp && r.ip && r.ip === normIp) {
                matched = true;
                reason = '您的网络IP';
            } else if (uaHash && r.uaHash && r.uaHash === uaHash) {
                matched = true;
                reason = '当前设备';
            }

            if (matched) {
                const remainingDays = Math.ceil((FREE_CARD_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
                return {
                    allowed: false,
                    remainingDays,
                    message: `免费卡密 29 天内仅限使用或领取一次！${reason}已参与过，距下次可用还剩 ${remainingDays} 天。`
                };
            }
        }
    }
    return { allowed: true };
}

function recordFreeCardUsage({ ip = '', username = '', ua = '', cardCode = '', action = 'use' } = {}) {
    loadCardClaimRecords();
    const uaHash = ua ? crypto.createHash('sha256').update(ua).digest('hex') : '';
    const normIp = String(ip || '').replace(/^.*:/, '').trim();
    cardClaimRecords.push({
        ip: normIp,
        uaHash,
        username: username || null,
        cardCode,
        action,
        claimTime: Date.now()
    });
    saveCardClaimRecords();
}

function checkUAClaimLimit(ua) {
    loadCardClaimRecords();
    const now = Date.now();
    const uaHash = crypto.createHash('sha256').update(ua).digest('hex');
    
    const record = cardClaimRecords.find(r => r.uaHash === uaHash);
    if (record) {
        const elapsed = now - record.claimTime;
        if (elapsed < 29 * 24 * 60 * 60 * 1000) {
            const remainingMs = 29 * 24 * 60 * 60 * 1000 - elapsed;
            return {
                allowed: false,
                remainingMs,
                message: '免费卡密 29 天内仅限领取一次！'
            };
        }
    }
    
    return { allowed: true };
}

function claimCardByUA(ua, username = null) {
    loadCards();
    loadCardClaimRecords();
    
    if (!cardClaimEnabled) {
        return { ok: false, error: '卡密领取功能未开启' };
    }
    
    const uaCheck = checkUAClaimLimit(ua);
    if (!uaCheck.allowed) {
        return { ok: false, error: uaCheck.message, remainingMs: uaCheck.remainingMs };
    }
    
    // 严格限制：只有管理员生成并标记为 isFree === true 的卡密才允许被免费领取
    // 定制卡不进可领取库存，次数已耗尽的卡也不进
    const unusedFreeCards = cards.filter(c => 
        c.isFree === true &&
        c.type === 'time' && 
        !c.usedBy && 
        c.enabled &&
        c.exhausted !== true
    );
    
    if (unusedFreeCards.length === 0) {
        return { ok: false, error: '当前暂无免费体验卡密，请联系管理员获取正式卡密！' };
    }
    
    const randomIndex = Math.floor(Math.random() * unusedFreeCards.length);
    const selectedCard = unusedFreeCards[randomIndex];
    
    const uaHash = crypto.createHash('sha256').update(ua).digest('hex');
    cardClaimRecords.push({
        uaHash,
        claimTime: Date.now(),
        cardCode: selectedCard.code,
        username: username || null
    });
    
    saveCardClaimRecords();
    
    return {
        ok: true,
        cardCode: selectedCard.code,
        days: selectedCard.days,
        description: selectedCard.description
    };
}

function getCardClaimRecords() {
    loadCardClaimRecords();
    return cardClaimRecords;
}

function clearExpiredClaimRecords() {
    loadCardClaimRecords();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    const beforeCount = cardClaimRecords.length;
    cardClaimRecords = cardClaimRecords.filter(r => 
        now - r.claimTime < oneDayMs
    );
    
    if (cardClaimRecords.length !== beforeCount) {
        saveCardClaimRecords();
    }
    
    return { cleared: beforeCount - cardClaimRecords.length };
}

function clearExpiredUsers(options) {
    loadUsers();
    const opts = options || {};
    const cleanupExpired = opts.expired !== false;
    const inactiveDays = Number(opts.inactiveDays) > 0 ? Number(opts.inactiveDays) : 0;
    const notRunningOnly = !!opts.notRunning;
    const isUserRunning = typeof opts.isUserRunning === 'function' ? opts.isUserRunning : null;
    const now = Date.now();
    const expiredUsers = [];
    const usersToKeep = [];

    for (const user of users) {
        if (user.role === 'admin') {
            usersToKeep.push(user);
            continue;
        }

        let matched = false;
        // 已到期账户
        if (cleanupExpired && user.card && user.card.expiresAt && user.card.expiresAt < now) {
            matched = true;
        }
        // 超过 N 天未登录，且名下无在线挂机账号（有账号在挂说明还在用，只是没登录网站）
        if (!matched && inactiveDays > 0 && user.lastLoginAt && (now - user.lastLoginAt) > inactiveDays * 86400000) {
            if (!isUserRunning || isUserRunning(user.username) === false) {
                matched = true;
            }
        }
        // 未挂机账户（名下无任何在线运行账号）
        if (!matched && notRunningOnly && isUserRunning && isUserRunning(user.username) === false) {
            matched = true;
        }

        if (matched) {
            expiredUsers.push(user.username);
        } else {
            usersToKeep.push(user);
        }
    }

    if (expiredUsers.length > 0) {
        users = usersToKeep;
        saveUsers();
    }

    return {
        ok: true,
        deletedCount: expiredUsers.length,
        deletedUsers: expiredUsers
    };
}

// 记录用户最后登录时间
function touchLastLogin(username) {
    loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return false;
    user.lastLoginAt = Date.now();
    saveUsers();
    return true;
}

function getUserCount() {
    loadUsers();
    return users.length;
}

// 验证卡密是否属于指定用户
function verifyCardOwnership(username, cardCode) {
    loadUsers();
    loadCards();

    if (!username || !cardCode) {
        return { ok: false, error: '请提供用户名和卡密' };
    }

    const user = users.find(u => u.username === username);
    if (!user) {
        return { ok: false, error: '用户名或卡密错误' };
    }

    const card = cards.find(c => c.code === cardCode);
    if (!card) {
        return { ok: false, error: '用户名或卡密错误' };
    }

    // 定制卡为多次共用卡，不能作为账号归属凭证
    if (card.type === 'custom') {
        return { ok: false, error: '定制卡不能用于验证账号归属' };
    }

    if (card.usedBy !== username) {
        return { ok: false, error: '卡密不属于该用户' };
    }

    return { ok: true };
}

// 通过卡密验证重置密码（无需旧密码）
function resetPasswordByCard(username, cardCode, newPassword) {
    loadUsers();

    const verifyResult = verifyCardOwnership(username, cardCode);
    if (!verifyResult.ok) {
        return verifyResult;
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
        return { ok: false, error: passwordValidation.errors.join('；') };
    }

    const user = users.find(u => u.username === username);
    user.password = hashPassword(newPassword);
    if (user.mustChangePassword) {
        delete user.mustChangePassword;
    }

    clearFailedAttempts(username);
    saveUsers();

    return { ok: true, message: '密码重置成功' };
}

module.exports = {
    validateUser,
    registerUser,
    renewUser,
    getAllUsers,
    updateUser,
    editUser,
    getAllCards,
    createCard,
    createCardsBatch,
    updateCard,
    deleteCard,
    deleteCardsBatch,
    deleteUser,
    changePassword,
    DEFAULT_ACCOUNT_LIMIT,
    getCardClaimStatus,
    setCardClaimStatus,
    claimCardByUA,
    getCardClaimRecords,
    clearExpiredClaimRecords,
    clearExpiredUsers,
    touchLastLogin,
    getUserCount,
    checkRateLimit,
    verifyCardOwnership,
    resetPasswordByCard,
};
