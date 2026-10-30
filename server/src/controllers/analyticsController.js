const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const analyticsClient = require('../services/analyticsClient');

const normalize = (value) => (value ?? '').toString().trim().toLowerCase();

/**
 * Grades every question of each attempt and shapes the payload for the
 * analytics service. Answer keys stay inside Express: only `correct`
 * (true/false) and the topic are sent on.
 */
async function buildAttemptPayload(attempts) {
  const questionIds = new Set();
  for (const a of attempts) {
    for (const sq of a.shuffledQuestions) questionIds.add(sq.question.toString());
  }

  const questions = await Question.find({ _id: { $in: [...questionIds] } }).select('+answer topic');
  const byId = new Map(questions.map((q) => [q._id.toString(), q]));

  return attempts.map((a) => {
    const answers = new Map(
      a.responses.map((r) => [r.question.toString(), normalize(r.answer)]),
    );
    const results = a.shuffledQuestions.map((sq) => {
      const id = sq.question.toString();
      const key = normalize(byId.get(id)?.answer);
      const given = answers.get(id) || '';
      return {
        topic: sq.topic || byId.get(id)?.topic || 'General',
        correct: Boolean(given) && given === key,
      };
    });

    return {
      attemptId: a._id.toString(),
      quizId: a.quiz?._id?.toString() || a.quiz?.toString() || '',
      quizTitle: a.quiz?.title || 'Quiz',
      subject: a.quiz?.subject || '',
      submittedAt: (a.submittedAt || a.updatedAt).toISOString(),
      score: a.score,
      totalQuestions: a.shuffledQuestions.length,
      questions: results,
    };
  });
}

/**
 * GET /api/analytics/me  (CSQP-27 / CSQP-F-040)
 * The logged-in student's quiz history, score trend and topic strengths.
 * Computed on every request from the database, so a quiz shows up as soon
 * as it is submitted (well inside the 5-second requirement).
 */
exports.getMyPerformance = async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.user.id, status: 'submitted' })
      .populate('quiz', 'title subject')
      .sort({ submittedAt: 1 });

    const summary = await analyticsClient.getStudentSummary({
      studentId: req.user.id,
      attempts: await buildAttemptPayload(attempts),
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof analyticsClient.AnalyticsUnavailableError) {
      return res.status(503).json({
        success: false,
        statusCode: 503,
        error: error.code,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    return next(error);
  }
};

exports._buildAttemptPayload = buildAttemptPayload;
