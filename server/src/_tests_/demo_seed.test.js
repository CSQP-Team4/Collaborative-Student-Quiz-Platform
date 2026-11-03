// Demo data script (CSQP-33 redesign): adds quizzes and attempts, is safe to re-run,
// and leaves everyone's leaderboard opt-in untouched.
const enrichDatabase = require('../seed/enrich_database');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const { useSeededDatabase } = require('../test-utils/testDb');

describe('enrich_database demo seed', () => {
  useSeededDatabase();
  const quiet = { log: () => {} };

  it('adds the four subject quizzes and one submitted attempt per student per quiz', async () => {
    const before = await Quiz.countDocuments();
    const optInBefore = (await User.find({ role: 'student' }).sort({ email: 1 })).map((u) => u.leaderboardOptIn);

    const created = await enrichDatabase(quiet);
    const quizzes = await Quiz.countDocuments({ isPublished: true });
    const students = await User.countDocuments({ role: 'student' });

    expect(created.quizzes).toBe(4);
    expect(quizzes).toBe(before + 4);
    expect(await QuizAttempt.countDocuments({ status: 'submitted' })).toBe(quizzes * students);
    expect(created.attempts).toBe(quizzes * students);

    const optInAfter = (await User.find({ role: 'student' }).sort({ email: 1 })).map((u) => u.leaderboardOptIn);
    expect(optInAfter).toEqual(optInBefore);
  });

  it('stores scores that match the recorded answers', async () => {
    const attempt = await QuizAttempt.findOne({ status: 'submitted' }).populate('quiz');
    const Question = require('../models/Question');
    const keys = await Question.find({ _id: { $in: attempt.responses.map((r) => r.question) } }).select('+answer');
    const key = new Map(keys.map((k) => [k._id.toString(), k.answer]));
    const correct = attempt.responses.filter((r) => key.get(r.question.toString()) === r.answer).length;
    expect(attempt.score).toBe(correct);
  });

  it('is safe to run twice', async () => {
    const attempts = await QuizAttempt.countDocuments();
    const second = await enrichDatabase(quiet);
    expect(second).toEqual({ quizzes: 0, attempts: 0 });
    expect(await QuizAttempt.countDocuments()).toBe(attempts);
  });
});
