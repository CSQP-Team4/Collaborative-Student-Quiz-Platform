// Jest helper: a fresh, seeded MongoDB for every test suite that needs data
// (CSQP-5; STP 10: "teardown scripts that re-seed MongoDB before every suite").
//
// Usage in a test file:
//   const { useSeededDatabase } = require('../test-utils/testDb');
//   const db = useSeededDatabase();      // registers beforeAll / afterAll
//   it('...', () => { const { users } = db.seed; ... });
//
// Needs a MongoDB server. Set MONGODB_URI_TEST, or it defaults to
// mongodb://127.0.0.1:27017/csqp_test. CI provides one (see ci.yml).

const mongoose = require('mongoose');
const { seedDatabase, resetDatabase } = require('../seed/seed');

const DEFAULT_TEST_URI = 'mongodb://127.0.0.1:27017/csqp_test';

function testDatabaseUri() {
  const base = process.env.MONGODB_URI_TEST || DEFAULT_TEST_URI;
  // Each Jest worker gets its own database so parallel suites never collide.
  const worker = process.env.JEST_WORKER_ID || '1';
  const url = new URL(base);
  const dbName = url.pathname.replace(/^\//, '') || 'csqp_test';
  url.pathname = `/${dbName}_${worker}`;
  return url.toString();
}

function assertTestDatabase(name) {
  // Safety net: seeding deletes everything, so never touch a non-test database.
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to reset database "${name}": test database names must contain "test".`);
  }
}

async function connectTestDb() {
  const uri = testDatabaseUri();
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }
  assertTestDatabase(mongoose.connection.name);
}

async function resetAndSeed(options) {
  assertTestDatabase(mongoose.connection.name);
  return seedDatabase(options);
}

async function clearTestDb() {
  assertTestDatabase(mongoose.connection.name);
  await resetDatabase();
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

// Connects and re-seeds before the suite; drops the test database after it.
function useSeededDatabase(options) {
  const state = { seed: null };
  beforeAll(async () => {
    await connectTestDb();
    state.seed = await resetAndSeed(options);
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  return state;
}

module.exports = {
  useSeededDatabase,
  connectTestDb,
  resetAndSeed,
  clearTestDb,
  disconnectTestDb,
  assertTestDatabase,
  testDatabaseUri,
};
