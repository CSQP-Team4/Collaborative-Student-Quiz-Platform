// Seed accounts (CSQP-5). One per role plus extra students for analytics
// and leaderboard tests. Same emails as the client's demo mode (CSQP-12).
// Passwords are hashed by seed.js before saving (CSQP-SR-002).

const SEED_USERS = [
  { key: 'admin', name: 'Demo Admin', email: 'admin@pes.edu', role: 'admin' },
  { key: 'instructor', name: 'Demo Instructor', email: 'instructor@pes.edu', role: 'instructor' },
  { key: 'student', name: 'Demo Student', email: 'student@pes.edu', role: 'student' },
  { key: 'student2', name: 'Rahul Nair', email: 'student2@pes.edu', role: 'student' },
  { key: 'student3', name: 'Priya Sharma', email: 'student3@pes.edu', role: 'student' },
];

module.exports = { SEED_USERS };
