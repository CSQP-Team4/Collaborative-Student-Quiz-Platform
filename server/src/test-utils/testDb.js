
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seedDatabase, resetDatabase } = require('../seed/seed');

let inMemoryMongo = null;

// Each Jest worker gets its own isolated in-memory database.
function testDatabaseUri() {
  const worker = process.env.JEST_WORKER_ID || '1';
  return `mongodb://127.0.0.1/test_${worker}`;
}

function assertTestDatabase(name) {
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to reset database "${name}": test database names must contain "test".`
    );
  }
}

async function connectTestDb() {
  if (mongoose.connection.readyState === 1) {
    assertTestDatabase(mongoose.connection.name);
    return;
  }

  if (!inMemoryMongo) {
    inMemoryMongo = await MongoMemoryServer.create();
  }

  const worker = process.env.JEST_WORKER_ID || '1';
  const uri = inMemoryMongo.getUri(`csqp_test_${worker}`);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
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
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } finally {
    if (inMemoryMongo) {
      await inMemoryMongo.stop();
      inMemoryMongo = null;
    }
  }
}

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
