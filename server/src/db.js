
const mongoose = require('mongoose');

let inMemoryMongo = null;

async function connectDB() {
  let mongoURI = process.env.MONGODB_URI;

  // In local development, if MONGODB_URI is not set, spin up a transient in-memory MongoDB
  // so the server starts seamlessly out of the box without requiring manual setup.
  if (!mongoURI) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is not configured. Set it in your .env file.');
    }

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      console.log('⚡ No MONGODB_URI found. Starting embedded in-memory MongoDB for local dev...');
      inMemoryMongo = await MongoMemoryServer.create();
      mongoURI = inMemoryMongo.getUri();
      console.log(`📦 Embedded MongoDB running at: ${mongoURI}`);

      // Auto-seed the in-memory database with baseline accounts & question bank
      await mongoose.connect(mongoURI);
      const { seedDatabase } = require('./seed/seed');
      await seedDatabase();
      console.log('🌱 Seed data auto-loaded into embedded MongoDB (Accounts: student@pes.edu, instructor@pes.edu, admin@pes.edu / Password1)');
      return;
    } catch (err) {
      throw new Error(`Failed to initialize in-memory database: ${err.message}`);
    }
  }

  await mongoose.connect(mongoURI);
  console.log('MongoDB connected successfully');
}

module.exports = connectDB;
