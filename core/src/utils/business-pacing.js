const { performance } = require('node:perf_hooks');
function createBusinessPacing({ now = () => performance.now(), random = Math.random,
    setTimer = setTimeout, clearTimer = clearTimeout, minimumMs = 300, jitterMs = 150 } = {}) {
    let nextAt = 0;
    return {
        async wait(signal) {
            const cancelled = () => Object.assign(new Error('请求已中断: 连接已结束'), { code: 'CONNECTION_CLOSED' });
            if (signal?.aborted) throw cancelled();
            const delay = Math.max(0, nextAt - now());
            if (delay) await new Promise((resolve, reject) => {
                const timer = setTimer(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
                function abort() { clearTimer(timer); signal?.removeEventListener('abort', abort); reject(cancelled()); }
                signal?.addEventListener('abort', abort, { once: true });
            });
            if (signal?.aborted) throw cancelled();
        },
        sent() { nextAt = now() + minimumMs + Math.floor(random() * (jitterMs + 1)); },
    };
}
module.exports = { createBusinessPacing };
