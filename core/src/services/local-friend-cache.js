const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const Long = require('long');
function revive(value) {
    if (!value || typeof value !== 'object') return value;
    if (Number.isInteger(value.low) && Number.isInteger(value.high) && typeof value.unsigned === 'boolean') return Long.fromBits(value.low, value.high, value.unsigned);
    for (const key of Object.keys(value)) value[key] = revive(value[key]);
    return value;
}
const { getDataDir } = require('../config/runtime-paths');

// One cache per account, player and scene. Disk contains listing metadata only.
function createLocalFriendCache({ key, scope, ttlMs = 300000, now = Date.now, directory = () => path.join(getDataDir(), 'friend-lists') }) {
    let identity, entry, pending, revision = 0;
    function file() { return path.join(directory(), Buffer.from(key + ':' + identity).toString('hex') + '.bin'); }
    function select() {
        const next = String(scope() || '');
        if (identity === next) return;
        identity = next; entry = null; pending = null; revision++;
        if (!identity) return;
        try {
            const saved = v8.deserialize(fs.readFileSync(file()));
            if (saved.key === key && saved.identity === identity && saved.version === 1) entry = { ...saved, value: revive(saved.value) };
        } catch { /* Missing/corrupt cache is a miss. */ }
    }
    return {
        async get(load, force = false) {
            select();
            if (pending) return pending;
            if (!force && entry && now() >= entry.updatedAt && now() - entry.updatedAt < ttlMs) return entry.value;
            const expected = identity, expectedRevision = revision;
            const job = Promise.resolve().then(load).then(value => {
                if (identity !== expected || revision !== expectedRevision) return value;
                entry = { version: 1, key, identity, updatedAt: now(), value };
                if (identity) {
                    try {
                        fs.mkdirSync(directory(), { recursive: true });
                        const target = file(), temp = target + '.tmp-' + process.pid;
                        fs.writeFileSync(temp, v8.serialize(entry), { mode: 0o600 });
                        fs.renameSync(temp, target);
                    } catch { /* A successful response remains usable if disk is unavailable. */ }
                }
                return value;
            }).finally(() => { if (pending === job) pending = null; });
            pending = job;
            return job;
        },
        clear() { select(); revision++; entry = null; pending = null; if (identity) { try { fs.unlinkSync(file()); } catch {} } },
    };
}
module.exports = { createLocalFriendCache };
