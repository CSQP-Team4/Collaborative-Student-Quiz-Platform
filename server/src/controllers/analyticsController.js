const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
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

  const questions = await Question.find({ _id: { $in: [...questionIds] } }).select('+answer topic text');
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
        questionId: id,
        text: sq.text || byId.get(id)?.text || '',
        topic: sq.topic || byId.get(id)?.topic || 'General',
        correct: Boolean(given) && given === key,
      };
    });

    return {
      attemptId: a._id.toString(),
      studentId: a.student?._id?.toString() || a.student?.toString() || '',
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

function unavailable(res, error) {
  return res.status(503).json({
    success: false,
    statusCode: 503,
    error: error.code,
    message: error.message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/analytics/class  (CSQP-28 / CSQP-F-041)
 * Per-quiz class analytics for the logged-in instructor's quizzes
 * (admins see every quiz): average score, participation rate and the
 * most-missed questions. Recomputed on every request, so each new
 * submission is included straight away.
 */
exports.getClassAnalytics = async (req, res, next) => {
  try {
    const quizFilter = req.user.role === 'admin' ? {} : { createdBy: req.user.id };
    const quizzes = await Quiz.find(quizFilter).select('title subject questions').sort({ createdAt: 1 });
    const quizIds = quizzes.map((q) => q._id);

    const [totalStudents, attempts] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      QuizAttempt.find({ quiz: { $in: quizIds }, status: 'submitted' })
        .populate('quiz', 'title subject')
        .sort({ submittedAt: 1 }),
    ]);

    const graded = await buildAttemptPayload(attempts);
    const summary = await analyticsClient.getClassSummary({
      totalStudents,
      quizzes: quizzes.map((q) => ({
        quizId: q._id.toString(),
        title: q.title,
        subject: q.subject,
        questionCount: q.questions.length,
      })),
      attempts: graded.map(({ studentId, quizId, submittedAt, score, totalQuestions, questions }) => ({
        studentId, quizId, submittedAt, score, totalQuestions, questions,
      })),
    });

    return res.status(200).json({
      success: true,
      statusCode: 200,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof analyticsClient.AnalyticsUnavailableError) return unavailable(res, error);
    return next(error);
  }
};

exports._buildAttemptPayload = buildAttemptPayload;
