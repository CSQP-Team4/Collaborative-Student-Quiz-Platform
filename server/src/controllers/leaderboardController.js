const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const analyticsClient = require('../services/analyticsClient');

const SCOPES = ['quiz', 'subject'];

function fail(res, statusCode, error, message) {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/leaderboard/settings  (CSQP-29)
 * The logged-in student's opt-in choice (profile settings).
 */
exports.getSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('leaderboardOptIn');
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'User not found.');
    return res.status(200).json({ success: true, statusCode: 200, optIn: user.leaderboardOptIn });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/leaderboard/settings  { optIn: true | false }  (CSQP-29)
 */
exports.updateSettings = async (req, res, next) => {
  const { optIn } = req.body || {};
  if (typeof optIn !== 'boolean') {
    return fail(res, 400, 'VALIDATION_ERROR', 'optIn must be true or false.');
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { leaderboardOptIn: optIn },
      { new: true, runValidators: true },
    ).select('leaderboardOptIn');
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'User not found.');
    return res.status(200).json({
      success: true,
      statusCode: 200,
      optIn: user.leaderboardOptIn,
      message: optIn ? 'You now appear on the leaderboard.' : 'You are hidden from the leaderboard.',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/leaderboard?scope=quiz|subject&id=<quizId or subject>  (CSQP-29 / CSQP-F-042)
 * Ranks students who opted in, per published quiz or per subject.
 * Students who opted out are filtered out here, before anything is sent to the
 * analytics service, so they can never appear in the response.
 */
exports.getLeaderboard = async (req, res, next) => {
  const scope = (req.query.scope || 'quiz').toLowerCase();
  if (!SCOPES.includes(scope)) {
    return fail(res, 400, 'INVALID_SCOPE', `scope must be one of: ${SCOPES.join(', ')}`);
  }

  try {
    const quizzes = await Quiz.find({ isPublished: true }).select('title subject').sort({ createdAt: 1 });
    const subjects = [...new Set(quizzes.map((q) => q.subject))].sort();
    const options = {
      quizzes: quizzes.map((q) => ({ id: q._id.toString(), title: q.title, subject: q.subject })),
      subjects,
    };

    let selectedId = req.query.id;
    let quizIds = [];
    let label = '';
    if (scope === 'quiz') {
      selectedId = selectedId || options.quizzes[0]?.id;
      const quiz = options.quizzes.find((q) => q.id === selectedId);
      if (selectedId && !quiz) {
        if (!mongoose.Types.ObjectId.isValid(selectedId)) {
          return fail(res, 400, 'INVALID_ID', 'Invalid quiz identifier.');
        }
        return fail(res, 404, 'QUIZ_NOT_FOUND', 'Quiz not found or not published.');
      }
      if (quiz) {
        quizIds = [quiz.id];
        label = quiz.title;
      }
    } else {
      selectedId = selectedId || subjects[0];
      if (selectedId && !subjects.includes(selectedId)) {
        return fail(res, 404, 'SUBJECT_NOT_FOUND', 'No published quizzes for this subject.');
      }
      quizIds = options.quizzes.filter((q) => q.subject === selectedId).map((q) => q.id);
      label = selectedId || '';
    }

    const [optedIn, viewer] = await Promise.all([
      User.find({ role: 'student', leaderboardOptIn: true }).select('name'),
      User.findById(req.user.id).select('leaderboardOptIn role'),
    ]);
    const names = new Map(optedIn.map((u) => [u._id.toString(), u.name]));

    const attempts = quizIds.length
      ? await QuizAttempt.find({
        quiz: { $in: quizIds },
        status: 'submitted',
        student: { $in: [...names.keys()] },
      }).select('student quiz score shuffledQuestions submittedAt updatedAt')
      : [];

    const board = await analyticsClient.getLeaderboard({
      scope,
      label,
      attempts: attempts.map((a) => ({
        studentId: a.student.toString(),
        studentName: names.get(a.student.toString()) || 'Student',
        quizId: a.quiz.toString(),
        submittedAt: (a.submittedAt || a.updatedAt).toISOString(),
        score: a.score,
        totalQuestions: a.shuffledQuestions.length,
      })),
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      options,
      scope,
      selectedId: selectedId || null,
      label,
      viewerOptedIn: viewer?.role === 'student' ? viewer.leaderboardOptIn : null,
      // Student IDs stay on the server; the viewer's own row is flagged instead.
      entries: board.entries.map(({ studentId, ...entry }) => ({
        ...entry,
        isYou: studentId === req.user.id,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof analyticsClient.AnalyticsUnavailableError) {
      return fail(res, 503, error.code, error.message);
    }
    return next(error);
  }
};
