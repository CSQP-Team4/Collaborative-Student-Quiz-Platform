// Standalone uptime monitor (CSQP-35):  cd server && npm run monitor
//
// Runs as its OWN process, separate from the API, so it can still record
// downtime when the API crashes or stops. Results go to MongoDB and appear
// on the admin Uptime report page.
require('dotenv').config();

const mongoose = require('mongoose');
const { startMonitor, DEFAULT_INTERVAL_MS } = require('./uptimeMonitor');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI in server/.env (the same database the API uses).');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const intervalMs = Number(process.env.UPTIME_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  console.log(`[uptime] checking ${process.env.UPTIME_TARGET_URL || `http://localhost:${process.env.PORT || 5000}/api/health`} every ${intervalMs / 1000}s`);

  const stop = startMonitor({
    intervalMs,
    onResult: (r) => console.log(`[uptime] ${r.checkedAt.toISOString()} ${r.ok ? 'UP  ' : 'DOWN'} ${r.statusCode ?? '-'} ${r.responseMs}ms ${r.error}`),
  });

  const shutdown = async () => {
    stop();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[uptime] failed to start:', err.message);
  process.exit(1);
});
