// Seeds MongoDB with known test data (CSQP-5, STP sections 7, 10 and 11).
//
//   resetDatabase()  removes all documents from every CSQP collection
//   seedDatabase()   resets, then inserts users, questions and a sample quiz
//
// Used by `npm run seed` (src/seed/run.js) and by the Jest helper in
// src/test-utils/testDb.js, which re-seeds before each test suite.

const bcrypt = require('bcryptjs');

const AuditLog = require('../models/AuditLog');
const Material = require('../models/Material');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const { SEED_QUESTIONS } = require('./questions');
const { SEED_USERS } = require('./users');

const MODELS = [User, Material, Question, Quiz, QuizAttempt, AuditLog];

// Default password for every seed account; override with SEED_PASSWORD.
const DEFAULT_SEED_PASSWORD = 'Password1';
const BCRYPT_ROUNDS = 10;

async function resetDatabase() {
  // deleteMany keeps the collections and their indexes; init() builds any
  // index that is missing (e.g. on a brand-new database).
  await Promise.all(MODELS.map((Model) => Model.init()));
  await Promise.all(MODELS.map((Model) => Model.deleteMany({})));
}

async function seedUsers(password) {
  // Salted bcrypt hashes only, never plaintext (CSQP-SR-002).
  const docs = await Promise.all(
    SEED_USERS.map(async ({ key, ...user }) => ({
      ...user,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      // Seed accounts skip email verification so they can log in straight
      // away; real registrations still start unverified (CSQP-F-001).
      isVerified: true,
    })),
  );
  const created = await User.insertMany(docs);
  const byKey = {};
  SEED_USERS.forEach(({ key }, i) => {
    byKey[key] = created[i];
  });
  return byKey;
}

async function seedQuestions(users) {
  const docs = SEED_QUESTIONS.map(({ status = 'approved', ...question }) => {
    const studentContribution = status !== 'approved';
    return {
      ...question,
      options: question.options || [],
      status,
      // Approved questions come from the instructor; pending and rejected
      // ones are student contributions waiting for or after review.
      createdBy: studentContribution ? users.student._id : users.instructor._id,
      reviewedBy: status === 'pending' ? null : users.instructor._id,
    };
  });
  return Question.insertMany(docs);
}

async function seedQuizzes(users, questions) {
  // One published quiz from approved Data Structures questions, so quiz and
  // attempt features (Sprint 2) have something to load.
  const dsQuestions = questions.filter(
    (q) => q.subject === 'Data Structures' && q.status === 'approved' && q.type !== 'SUBJECTIVE',
  );
  return Quiz.insertMany([
    {
      title: 'Data Structures Basics',
      subject: 'Data Structures',
      description: 'Seed quiz: objective questions on lists, trees, graphs and searching.',
      questions: dsQuestions.slice(0, 5).map((q) => q._id),
      duration: 10, // minutes
      createdBy: users.instructor._id,
      isPublished: true,
    },
  ]);
}

async function seedDatabase({ password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD } = {}) {
  await resetDatabase();
  const users = await seedUsers(password);
  const questions = await seedQuestions(users);
  const quizzes = await seedQuizzes(users, questions);

  return {
    users,
    counts: {
      users: Object.keys(users).length,
      questions: questions.length,
      approvedQuestions: questions.filter((q) => q.status === 'approved').length,
      pendingQuestions: questions.filter((q) => q.status === 'pending').length,
      quizzes: quizzes.length,
    },
  };
}

module.exports = { seedDatabase, resetDatabase, DEFAULT_SEED_PASSWORD };
