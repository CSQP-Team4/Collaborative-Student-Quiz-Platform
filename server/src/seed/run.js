// CLI: `npm run seed` wipes and re-seeds the database in MONGODB_URI.
// Refuses to run when NODE_ENV=production.

require('dotenv').config();

const mongoose = require('mongoose');
const { seedDatabase } = require('./seed');
const { SEED_USERS } = require('./users');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is "production". Seeding deletes all data.');
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured. Set it in server/.env (see .env.example).');
  }

  await mongoose.connect(uri);
  console.log(`Seeding database "${mongoose.connection.name}" (all existing data will be replaced)...`);

  const { counts } = await seedDatabase();

  console.log('Done:');
  console.table(counts);
  console.log('Seed accounts (password: SEED_PASSWORD or "Password1"):');
  SEED_USERS.forEach((u) => console.log(`  ${u.role.padEnd(10)} ${u.email}`));
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
