// CSQP-35 / CSQP-NF-002: pings GET /api/health on a schedule and records each result.
const UptimeCheck = require('../models/UptimeCheck');

const DEFAULT_INTERVAL_MS = 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10 * 1000;

function defaultTarget() {
  return process.env.UPTIME_TARGET_URL || `http://localhost:${process.env.PORT || 5000}/api/health`;
}

/**
 * One probe. Healthy means HTTP 200 AND the API reports its database as
 * connected (an API that is up but cannot reach MongoDB is not usable).
 */
async function checkOnce({ url = defaultTarget(), timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const started = Date.now();
  const result = { checkedAt: new Date(started), ok: false, statusCode: null, responseMs: null, error: '', target: url };
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    result.statusCode = res.status;
    result.responseMs = Date.now() - started;
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (res.status !== 200) result.error = `HTTP ${res.status}`;
    else if (body.mongodb && body.mongodb !== 'connected') result.error = 'Database disconnected';
    else result.ok = true;
  } catch (err) {
    result.responseMs = Date.now() - started;
    result.error = err.name === 'TimeoutError' ? `Timed out after ${timeoutMs} ms` : `Unreachable: ${err.message}`;
  }
  return result;
}

async function recordCheck(options) {
  const result = await checkOnce(options);
  await UptimeCheck.create(result);
  return result;
}

/** Starts the probe loop; returns a function that stops it. */
function startMonitor({ intervalMs = Number(process.env.UPTIME_INTERVAL_MS) || DEFAULT_INTERVAL_MS, onResult, ...options } = {}) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const result = await recordCheck(options);
      if (onResult) onResult(result);
    } catch (err) {
      console.error('[uptime] could not record check:', err.message);
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

module.exports = { checkOnce, recordCheck, startMonitor, DEFAULT_INTERVAL_MS };
