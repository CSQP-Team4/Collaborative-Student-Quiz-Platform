const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const { DEFAULT_SEED_PASSWORD } = require('../seed/seed');
const { SEED_QUESTIONS } = require('../seed/questions');
const {
  assertTestDatabase,
  resetAndSeed,
  useSeededDatabase,
} = require('../test-utils/testDb');

const db = useSeededDatabase();

describe('seed accounts (CSQP-5)', () => {
  it('creates at least one Student, Instructor and Admin', async () => {
    for (const role of ['student', 'instructor', 'admin']) {
      expect(await User.countDocuments({ role })).toBeGreaterThanOrEqual(1);
    }
    expect(db.seed.counts.users).toBe(await User.countDocuments());
  });

  it('stores only salted bcrypt hashes, never plaintext (CSQP-SR-002)', async () => {
    const users = await User.find().select('+password');
    const hashes = users.map((u) => u.password);

    hashes.forEach((hash) => {
      expect(hash).toMatch(/^\$2[aby]\$10\$/);
      expect(hash).not.toBe(DEFAULT_SEED_PASSWORD);
    });
    // Same password, different salt -> different hashes.
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(await bcrypt.compare(DEFAULT_SEED_PASSWORD, hashes[0])).toBe(true);
  });

  it('hides the password by default', async () => {
    const user = await User.findOne({ email: 'student@pes.edu' });
    expect(user.password).toBeUndefined();
  });
});

describe('seed question bank (CSQP-5)', () => {
  it('has at least 50 questions', async () => {
    expect(await Question.countDocuments()).toBeGreaterThanOrEqual(50);
  });

  it('covers several subjects, topics, all difficulties and all question types', async () => {
    const subjects = await Question.distinct('subject');
    const topics = await Question.distinct('topic');
    expect(subjects.length).toBeGreaterThanOrEqual(5);
    expect(topics.length).toBeGreaterThanOrEqual(15);
    expect((await Question.distinct('difficulty')).sort()).toEqual(['easy', 'hard', 'medium']);
    expect((await Question.distinct('type')).sort()).toEqual(['MCQ', 'SUBJECTIVE', 'TRUE_FALSE']);

    // Every subject has all three difficulty levels.
    for (const subject of subjects) {
      const levels = await Question.distinct('difficulty', { subject });
      expect(levels.sort()).toEqual(['easy', 'hard', 'medium']);
    }
  });

  it('includes pending student questions for the approval queue (CSQP-F-023)', async () => {
    const student = await User.findOne({ email: 'student@pes.edu' });
    const pending = await Question.find({ status: 'pending' });

    expect(pending.length).toBeGreaterThanOrEqual(5);
    pending.forEach((q) => {
      expect(q.createdBy.equals(student._id)).toBe(true);
      expect(q.reviewedBy).toBeNull();
    });
    expect(await Question.countDocuments({ status: 'approved' })).toBeGreaterThanOrEqual(45);
  });

  it('keeps answer keys out of default queries', async () => {
    const question = await Question.findOne({ type: 'MCQ' });
    expect(question.answer).toBeUndefined();
  });

  it('only builds the sample quiz from approved objective questions', async () => {
    const quiz = await Quiz.findOne().populate('questions');
    expect(quiz.isPublished).toBe(true);
    expect(quiz.questions.length).toBe(5);
    quiz.questions.forEach((q) => {
      expect(q.status).toBe('approved');
      expect(q.type).not.toBe('SUBJECTIVE');
    });
  });
});

describe('seed data is internally consistent', () => {
  it.each(SEED_QUESTIONS.map((q) => [q.text.slice(0, 50), q]))('%s', (_label, q) => {
    expect(q.subject && q.topic && q.text && q.answer).toBeTruthy();
    if (q.type === 'MCQ') {
      expect(q.options.length).toBe(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
    } else if (q.type === 'TRUE_FALSE') {
      expect(q.options).toEqual(['True', 'False']);
      expect(['True', 'False']).toContain(q.answer);
    } else {
      expect(q.type).toBe('SUBJECTIVE');
      expect(q.options).toBeUndefined();
    }
  });

  it('has no duplicate question texts', () => {
    const texts = SEED_QUESTIONS.map((q) => q.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('re-seeding (teardown)', () => {
  it('restores the baseline after tests change data', async () => {
    const before = await Question.countDocuments();
    await Question.deleteMany({ subject: 'Data Structures' });
    await User.create({ name: 'Temp', email: 'temp@pes.edu', password: 'x', role: 'student' });

    await resetAndSeed();

    expect(await Question.countDocuments()).toBe(before);
    expect(await User.findOne({ email: 'temp@pes.edu' })).toBeNull();
  });

  it('refuses to reset a database whose name does not contain "test"', () => {
    expect(() => assertTestDatabase('csqp')).toThrow(/Refusing to reset/);
    expect(() => assertTestDatabase(mongoose.connection.name)).not.toThrow();
  });
});
