const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AuditLog = require('../models/AuditLog');
const {
  randomizeQuizQuestions,
  verifyPayloadIsAnswerFree,
} = require('../utils/antiCheat');

/**
 * GET /api/quizzes
 * Returns all published quizzes available for students to take
 */
exports.listPublishedQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ isPublished: true })
      .select('title subject description duration questions createdBy createdAt')
      .populate('createdBy', 'name');

    const result = quizzes.map((q) => ({
      id: q._id,
      title: q.title,
      subject: q.subject,
      description: q.description,
      duration: q.duration,
      questionCount: q.questions.length,
      instructor: q.createdBy?.name || 'Instructor',
      createdAt: q.createdAt,
    }));

    return res.status(200).json({
      success: true,
      statusCode: 200,
      quizzes: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to list quizzes.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * GET /api/quizzes/:id
 * Fetches overview of a specific published quiz (without questions/answers)
 */
exports.getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_ID',
        message: 'Invalid quiz identifier.',
        timestamp: new Date().toISOString(),
      });
    }

    const quiz = await Quiz.findOne({ _id: id, isPublished: true })
      .select('title subject description duration questions createdBy')
      .populate('createdBy', 'name');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found or is not currently published.',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      statusCode: 200,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        subject: quiz.subject,
        description: quiz.description,
        duration: quiz.duration,
        questionCount: quiz.questions.length,
        instructor: quiz.createdBy?.name || 'Instructor',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to retrieve quiz.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/quizzes/:id/attempts (CSQP-F-032 & CSQP-F-033)
 *
 * Starts a new quiz attempt session:
 * 1. CSQP-F-033: Enforces single active attempt per student per quiz (409 Conflict on parallel session).
 * 2. CSQP-F-032: Randomizes question order & option order per attempt.
 * 3. SAD 3.7: Strictly strips answer keys from client response payload.
 */
exports.startQuizAttempt = async (req, res) => {
  try {
    const { id: quizId } = req.params;
    const studentId = req.user.id;
    const { resume } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_ID',
        message: 'Invalid quiz identifier.',
        timestamp: new Date().toISOString(),
      });
    }

    const quiz = await Quiz.findOne({ _id: quizId, isPublished: true }).populate('questions');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found or not published.',
        timestamp: new Date().toISOString(),
      });
    }

    // 1. Check for an existing in_progress attempt (CSQP-F-033: Single Active Attempt)
    const existingAttempt = await QuizAttempt.findOne({
      student: studentId,
      quiz: quizId,
      status: 'in_progress',
    });

    if (existingAttempt) {
      const durationMs = quiz.duration * 60 * 1000;
      const isExpired = new Date(existingAttempt.startedAt.getTime() + durationMs) < new Date();

      if (isExpired) {
        // Auto-close timed out attempt
        existingAttempt.status = 'timed_out';
        existingAttempt.submittedAt = new Date();
        await existingAttempt.save();
      } else if (resume) {
        // Resume authorized session
        verifyPayloadIsAnswerFree(existingAttempt.shuffledQuestions);
        return res.status(200).json({
          success: true,
          statusCode: 200,
          attempt: {
            id: existingAttempt._id,
            quizId: quiz._id,
            quizTitle: quiz.title,
            duration: quiz.duration,
            startedAt: existingAttempt.startedAt,
            endsAt: new Date(existingAttempt.startedAt.getTime() + durationMs),
            questions: existingAttempt.shuffledQuestions,
            status: existingAttempt.status,
          },
          resumed: true,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Block parallel attempt with 409 Conflict (CSQP-F-033 / TC-Att-04)
        return res.status(409).json({
          success: false,
          statusCode: 409,
          error: 'ACTIVE_ATTEMPT_EXISTS',
          message: 'An active attempt is already in progress for this quiz. Parallel attempts are blocked.',
          activeAttemptId: existingAttempt._id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Filter approved questions only
    const approvedQuestions = quiz.questions.filter((q) => q.status === 'approved');
    if (approvedQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'NO_QUESTIONS',
        message: 'This quiz has no approved questions available to attempt.',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Randomize question order and options order per attempt (CSQP-F-032 / TC-Att-03)
    const randomized = randomizeQuizQuestions(approvedQuestions);

    // 3. Guarantee answer key is completely stripped (SAD 3.7)
    verifyPayloadIsAnswerFree(randomized);

    const durationMs = quiz.duration * 60 * 1000;
    const now = new Date();

    const attempt = await QuizAttempt.create({
      student: studentId,
      quiz: quiz._id,
      status: 'in_progress',
      shuffledQuestions: randomized,
      startedAt: now,
    });

    return res.status(201).json({
      success: true,
      statusCode: 201,
      attempt: {
        id: attempt._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        duration: quiz.duration,
        startedAt: attempt.startedAt,
        endsAt: new Date(attempt.startedAt.getTime() + durationMs),
        questions: attempt.shuffledQuestions,
        status: attempt.status,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to start quiz attempt.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/attempts/:id/anti-cheat (CSQP-F-032 / SAD 3.9)
 * Records client security telemetry (clipboard copy/paste attempt, tab switch, window blur).
 */
exports.recordAntiCheatEvent = async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const studentId = req.user.id;
    const { eventType, details } = req.body;

    const validEvents = ['TAB_SWITCH', 'CLIPBOARD_ATTEMPT', 'WINDOW_BLUR', 'RIGHT_CLICK_ATTEMPT'];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_EVENT_TYPE',
        message: `Event type must be one of: ${validEvents.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }

    const attempt = await QuizAttempt.findOne({ _id: attemptId, student: studentId });
    if (!attempt) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'ATTEMPT_NOT_FOUND',
        message: 'Quiz attempt not found.',
        timestamp: new Date().toISOString(),
      });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'ATTEMPT_CLOSED',
        message: 'Cannot record security events on a closed attempt.',
        timestamp: new Date().toISOString(),
      });
    }

    attempt.antiCheatEvents.push({
      eventType,
      timestamp: new Date(),
      details: details || {},
    });

    // Flag for instructor review if suspicious activities exceed threshold
    if (attempt.antiCheatEvents.length >= 3) {
      attempt.isFlaggedForReview = true;
    }

    await attempt.save();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      eventRecorded: eventType,
      totalSecurityViolations: attempt.antiCheatEvents.length,
      flaggedForReview: attempt.isFlaggedForReview,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to record anti-cheat telemetry.',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * POST /api/attempts/:id/submit
 * Submits student answers, auto-grades objective questions, and closes attempt session
 */
exports.submitQuizAttempt = async (req, res) => {
  try {
    const { id: attemptId } = req.params;
    const studentId = req.user.id;
    const { responses = [] } = req.body;

    const attempt = await QuizAttempt.findOne({ _id: attemptId, student: studentId }).populate('quiz');
    if (!attempt) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        error: 'ATTEMPT_NOT_FOUND',
        message: 'Quiz attempt not found.',
        timestamp: new Date().toISOString(),
      });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'ATTEMPT_ALREADY_CLOSED',
        message: `This attempt has already been ${attempt.status}.`,
        timestamp: new Date().toISOString(),
      });
    }

    // Auto-grading: fetch actual answers from Question database with select('+answer')
    const questionIds = attempt.shuffledQuestions.map((sq) => sq.question);
    const questionsWithAnswers = await Question.find({ _id: { $in: questionIds } }).select('+answer');

    const answerMap = new Map();
    for (const q of questionsWithAnswers) {
      answerMap.set(q._id.toString(), q.answer);
    }

    let calculatedScore = 0;
    const formattedResponses = [];

    for (const resp of responses) {
      const qIdStr = (resp.question?._id || resp.question || '').toString();
      const submittedAnswer = (resp.answer || '').toString().trim();
      const correctAnswer = (answerMap.get(qIdStr) || '').toString().trim();

      if (submittedAnswer && correctAnswer && submittedAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        calculatedScore += 1;
      }

      formattedResponses.push({
        question: resp.question,
        answer: submittedAnswer,
      });
    }

    attempt.responses = formattedResponses;
    attempt.score = calculatedScore;
    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    await attempt.save();

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Quiz submitted successfully!',
      result: {
        attemptId: attempt._id,
        status: attempt.status,
        score: attempt.score,
        totalQuestions: attempt.shuffledQuestions.length,
        submittedAt: attempt.submittedAt,
        flaggedForReview: attempt.isFlaggedForReview,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to submit quiz attempt.',
      timestamp: new Date().toISOString(),
    });
  }
};
