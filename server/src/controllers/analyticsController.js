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

async function studentPayload(user) {
  const attempts = await QuizAttempt.find({ student: user.id, status: 'submitted' })
    .populate('quiz', 'title subject')
    .sort({ submittedAt: 1 });
  return { studentId: user.id, attempts: await buildAttemptPayload(attempts) };
}

async function classPayload(user) {
  const quizFilter = user.role === 'admin' ? {} : { createdBy: user.id };
  const quizzes = await Quiz.find(quizFilter).select('title subject questions').sort({ createdAt: 1 });
  const quizIds = quizzes.map((q) => q._id);

  const [totalStudents, attempts] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    QuizAttempt.find({ quiz: { $in: quizIds }, status: 'submitted' })
      .populate('quiz', 'title subject')
      .sort({ submittedAt: 1 }),
  ]);

  const graded = await buildAttemptPayload(attempts);
  return {
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
  };
}

/**
 * GET /api/analytics/me  (CSQP-27 / CSQP-F-040)
 * The logged-in student's quiz history, score trend and topic strengths.
 * Computed on every request from the database, so a quiz shows up as soon
 * as it is submitted (well inside the 5-second requirement).
 */
exports.getMyPerformance = async (req, res, next) => {
  try {
    const summary = await analyticsClient.getStudentSummary(await studentPayload(req.user));

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
    const summary = await analyticsClient.getClassSummary(await classPayload(req.user));

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

const REPORT_FORMATS = ['pdf', 'csv'];

function sendReport(res, file) {
  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', file.disposition);
  res.set('Cache-Control', 'no-store');
  return res.status(200).send(file.content);
}

function badFormat(res) {
  return res.status(400).json({
    success: false,
    statusCode: 400,
    error: 'INVALID_FORMAT',
    message: `format must be one of: ${REPORT_FORMATS.join(', ')}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/analytics/me/export?format=pdf|csv  (CSQP-30 / CSQP-F-043)
 * Built from the same data as GET /api/analytics/me, so the file matches the screen.
 */
exports.exportMyPerformance = async (req, res, next) => {
  const format = (req.query.format || 'pdf').toLowerCase();
  if (!REPORT_FORMATS.includes(format)) return badFormat(res);
  try {
    const payload = await studentPayload(req.user);
    const file = await analyticsClient.getStudentReport(
      { ...payload, studentName: req.user.name || req.user.email || 'Student' },
      format,
    );
    return sendReport(res, file);
  } catch (error) {
    if (error instanceof analyticsClient.AnalyticsUnavailableError) return unavailable(res, error);
    return next(error);
  }
};

/**
 * GET /api/analytics/class/export?format=pdf|csv  (CSQP-30 / CSQP-F-043)
 * Built from the same data as GET /api/analytics/class.
 */
exports.exportClassAnalytics = async (req, res, next) => {
  const format = (req.query.format || 'pdf').toLowerCase();
  if (!REPORT_FORMATS.includes(format)) return badFormat(res);
  try {
    const payload = await classPayload(req.user);
    const file = await analyticsClient.getClassReport(
      { ...payload, instructorName: req.user.name || req.user.email || 'Instructor' },
      format,
    );
    return sendReport(res, file);
  } catch (error) {
    if (error instanceof analyticsClient.AnalyticsUnavailableError) return unavailable(res, error);
    return next(error);
  }
};

exports._buildAttemptPayload = buildAttemptPayload;
