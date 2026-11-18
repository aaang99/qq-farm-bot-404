// Independent randomized queues, like the farm scheduler. Deadlines are server-owned.
const FRIEND_KEYS = ['autoSteal', 'autoHelp', 'autoStroke', 'autoPutHazard'];
function inGroup(key, group) {
    if (group === 'all') return true;
    if (group === 'steal') return key === 'autoSteal';
    if (group === 'help') return ['autoHelp', 'autoStroke', 'autoPutHazard'].includes(key);
    return !FRIEND_KEYS.includes(key);
}
function createRanchScheduler({ now = Date.now, random = Math.random } = {}) {
    const queues = Object.fromEntries(['farm', 'help', 'steal'].map(key => [key, { enabled: false, nextAt: 0, intervalSec: 0, running: false }]));
    let generation = 0;
    function sync(settings, policy) {
        for (const [key, queue] of Object.entries(queues)) {
            const enabled = Object.entries(settings).some(([name, value]) => value === true && inGroup(name, key));
            const signature = `${policy[`${key}Min`]}:${policy[`${key}Max`]}`;
            if (!enabled) Object.assign(queue, { enabled: false, nextAt: 0, intervalSec: 0 });
            else if (!queue.enabled || queue.signature !== signature) Object.assign(queue, { enabled: true, nextAt: now(), intervalSec: 0 });
            queue.signature = signature;
        }
    }
    function status(settings, policy) {
        sync(settings, policy);
        return Object.fromEntries(Object.entries(queues).map(([key, q]) => [key, { enabled: q.enabled, nextAt: q.nextAt, intervalSec: q.intervalSec, running: q.running }]));
    }
    async function tick({ settings, policy, run, stealDelay = () => 900000, ready = () => true }) {
        if (!ready()) return;
        const epoch = generation;
        sync(settings(), policy());
        // Register every due group before awaiting any one scene lease.
        const jobs = Object.entries(queues).filter(([, q]) => q.enabled && !q.running && now() >= q.nextAt).map(async ([key, queue]) => {
            queue.running = true;
            let result, failed = false;
            try { result = await run(key); }
            catch (err) { failed = true; throw err; }
            finally {
                if (epoch === generation) {
                    queue.running = false;
                    sync(settings(), policy());
                    if (queue.enabled) {
                        const p = policy();
                        const min = Math.max(1, Number(p[`${key}Min`]) || 10);
                        const max = Math.max(min, Number(p[`${key}Max`]) || min);
                        queue.intervalSec = key === 'steal' ? Math.max(1, Math.ceil(stealDelay() / 1000)) : min + Math.floor(random() * (max - min + 1));
                        const incomplete = result?.yielded || result?.cancelled || result?.status === 'yielded' || result?.status === 'deferred';
                        queue.nextAt = incomplete ? now() : now() + (failed ? Math.max(5, queue.intervalSec) : queue.intervalSec) * 1000;
                        if (!failed && !incomplete && Number.isFinite(result?.nextAt)) queue.nextAt = Math.min(queue.nextAt, Math.max(now() + 1000, result.nextAt));
                    }
                }
            }
        });
        const results = await Promise.allSettled(jobs);
        const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
        if (errors.length) throw new AggregateError(errors, errors.map(err => err.message).join('; '));
    }
    function reset() {
        generation++;
        for (const queue of Object.values(queues)) Object.assign(queue, { enabled: false, nextAt: 0, intervalSec: 0, running: false });
    }
    return { tick, status, reset };
}
module.exports = { createRanchScheduler, inGroup };
