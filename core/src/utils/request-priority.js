const { AsyncLocalStorage } = require('node:async_hooks');

const PRIORITIES = Object.freeze({
  critical: 0,
  foreground: 1,
  farm: 2,
  friend: 3,
  background: 4,
});

const priorityContext = new AsyncLocalStorage();

function normalizePriority(value) {
  const key = String(value || '').toLowerCase();
  return Object.hasOwn(PRIORITIES, key) ? key : 'foreground';
}

function runWithRequestPriority(priority, fn) {
  return priorityContext.run(normalizePriority(priority), fn);
}

function getRequestPriority(fallback = 'foreground') {
  return normalizePriority(priorityContext.getStore() || fallback);
}

function createRequestGate(options = {}) {
  // 限制同时在途请求数（降低到 2，拟真移动端单线程通信模型）
  const maxActive = Math.max(1, Number(options.maxActive) || 2);
  const maxQueued = Math.max(1, Number(options.maxQueued) || 100);
  // 请求之间的最小节流间隔，基线 250ms，配合随机抖动（250~400ms）模拟真实操作
  const minInterval = Math.max(0, Number(options.minInterval) || 250);
  let active = 0;
  let order = 0;
  let lastDispatchTime = 0;
  let timer = null;
  const queue = [];

  function drain() {
    if (timer) return;
    queue.sort((a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority] || a.order - b.order);
    if (active >= maxActive || queue.length === 0) return;

    const now = Date.now();
    const jitter = Math.floor(Math.random() * 150);
    const targetInterval = minInterval + jitter;
    const elapsed = now - lastDispatchTime;

    if (elapsed < targetInterval) {
      timer = setTimeout(() => {
        timer = null;
        drain();
      }, targetInterval - elapsed);
      return;
    }

    const entry = queue.shift();
    active++;
    lastDispatchTime = Date.now();
    let released = false;

    entry.resolve(() => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
      drain();
    });

    if (active < maxActive && queue.length > 0) {
      drain();
    }
  }

  function acquire(priority) {
    if (queue.length >= maxQueued) {
      return Promise.reject(new Error(`请求调度队列已满: queued=${queue.length}`));
    }
    return new Promise((resolve) => {
      queue.push({ priority: normalizePriority(priority), order: order++, resolve });
      drain();
    });
  }

  function snapshot() {
    return {
      active,
      queued: queue.length,
      byPriority: queue.reduce((result, item) => {
        result[item.priority] = (result[item.priority] || 0) + 1;
        return result;
      }, {}),
    };
  }

  return { acquire, snapshot };
}

module.exports = {
  PRIORITIES,
  normalizePriority,
  runWithRequestPriority,
  getRequestPriority,
  createRequestGate,
};
