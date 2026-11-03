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
 * POST /api/quizzes
 * CSQP-20: Create a quiz using manual selection or random sampling.
 */
exports.createQuiz = async (req, res) => {
  try {
    const {
      title,
      subject,
      description = '',
      selectionMode,
      questionIds,
      questionCount,
      duration,
      attemptCap,
    } = req.body || {};

    // Validate common quiz configuration.
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      typeof subject !== 'string' ||
      !subject.trim() ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      !Number.isInteger(attemptCap) ||
      attemptCap < 1
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_QUIZ_CONFIGURATION',
        message:
          'Title, subject, positive integer duration and positive integer attempt cap are required.',
        timestamp: new Date().toISOString(),
      });
    }

    if (!['manual', 'random'].includes(selectionMode)) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_SELECTION_MODE',
        message: 'Selection mode must be manual or random.',
        timestamp: new Date().toISOString(),
      });
    }

    let selectedQuestions;

    if (selectionMode === 'manual') {
      if (
        !Array.isArray(questionIds) ||
        questionIds.length === 0 ||
        !questionIds.every((id) =>
          mongoose.Types.ObjectId.isValid(id)
        ) ||
        new Set(questionIds.map(String)).size !== questionIds.length
      ) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'INVALID_QUESTION_SELECTION',
          message:
            'Select at least one question using unique, valid question IDs.',
          timestamp: new Date().toISOString(),
        });
      }

      selectedQuestions = await Question.find({
        _id: { $in: questionIds },
        status: 'approved',
        subject: subject.trim(),
      }).select('_id');

      if (selectedQuestions.length !== questionIds.length) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'INVALID_QUESTION_SELECTION',
          message:
            'All selected questions must exist, be approved, and belong to the specified subject.',
          timestamp: new Date().toISOString(),
        });
      }

      // Preserve the instructor's selection order.
      const questionMap = new Map(
        selectedQuestions.map((q) => [q._id.toString(), q._id])
      );
      selectedQuestions = questionIds.map((id) => ({
        _id: questionMap.get(String(id)),
      }));
    } else {
      if (!Number.isInteger(questionCount) || questionCount < 1) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'INVALID_QUESTION_COUNT',
          message: 'Question count must be a positive integer.',
          timestamp: new Date().toISOString(),
        });
      }

      selectedQuestions = await Question.aggregate([
        {
          $match: {
            subject: subject.trim(),
            status: 'approved',
          },
        },
        { $sample: { size: questionCount } },
        { $project: { _id: 1 } },
      ]);

      if (selectedQuestions.length !== questionCount) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'INSUFFICIENT_QUESTIONS',
          message:
            'Not enough approved questions exist for the requested question count.',
          timestamp: new Date().toISOString(),
        });
      }
    }

    const quiz = await Quiz.create({
      title: title.trim(),
      subject: subject.trim(),
      description:
        typeof description === 'string' ? description.trim() : '',
      questions: selectedQuestions.map((q) => q._id),
      duration,
      attemptCap,
      createdBy: req.user.id,
      isPublished: false,
    });

    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Quiz created successfully.',
      quiz: {
        id: quiz._id,
        title: quiz.title,
        subject: quiz.subject,
        description: quiz.description,
        questionCount: quiz.questions.length,
        duration: quiz.duration,
        attemptCap: quiz.attemptCap,
        isPublished: quiz.isPublished,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to create quiz.',
      timestamp: new Date().toISOString(),
    });
  }
};


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
      const expiresAt =
        existingAttempt.expiresAt ||
        new Date(existingAttempt.startedAt.getTime() + durationMs);
      const isExpired = Date.now() >= expiresAt.getTime();

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
            endsAt: expiresAt,
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

    const expiresAt = new Date(now.getTime() + durationMs);

    const attempt = await QuizAttempt.create({
      student: studentId,
      quiz: quiz._id,
      status: 'in_progress',
      shuffledQuestions: randomized,
      startedAt: now,
      expiresAt,
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
        endsAt: attempt.expiresAt,
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
  const timestamp = () => new Date().toISOString();

  try {
    const isNewEndpoint = req.route?.path === '/quizzes/:id/submit';
    const quizId = isNewEndpoint ? req.params.id : null;
    const attemptId = isNewEndpoint ? req.body.attemptId : req.params.id;
    const studentId = req.user.id;
    const { responses } = req.body || {};

    // Validate request payload.
    if (
      !Array.isArray(responses) ||
      responses.some(
        (r) =>
          !r ||
          typeof r !== 'object' ||
          Array.isArray(r) ||
          !(r.question?._id || r.question) ||
          typeof (r.answer ?? r.selectedOption) !== 'string'
      )
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_RESPONSES',
        message: 'Responses must be an array of valid question and answer objects.',
        timestamp: timestamp(),
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(attemptId) ||
      (quizId && !mongoose.Types.ObjectId.isValid(quizId))
    ) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'INVALID_ID',
        message: 'Invalid attempt or quiz identifier.',
        timestamp: timestamp(),
      });
    }

    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      student: studentId,
    });

    // Do not disclose another student's attempt.
    if (!attempt) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: 'INVALID_ATTEMPT_SESSION',
        message: 'The attempt session is invalid or does not belong to you.',
        timestamp: timestamp(),
      });
    }

    if (
      quizId &&
      attempt.quiz.toString() !== quizId
    ) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: 'INVALID_ATTEMPT_SESSION',
        message: 'The attempt does not belong to this quiz.',
        timestamp: timestamp(),
      });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        error: 'ATTEMPT_ALREADY_CLOSED',
        message: `This attempt has already been ${attempt.status}.`,
        timestamp: timestamp(),
      });
    }

    const questionIds = attempt.shuffledQuestions.map(
      (sq) => sq.question.toString()
    );
    const questionTypes = new Map(
      attempt.shuffledQuestions.map((sq) => [
        sq.question.toString(),
        sq.type,
      ])
    );

    // Reject answers for questions outside this attempt.
    const seen = new Set();

    for (const response of responses) {
      const questionId = (
        response.question?._id || response.question
      ).toString();

      if (
        !mongoose.Types.ObjectId.isValid(questionId) ||
        !questionIds.includes(questionId) ||
        seen.has(questionId)
      ) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: 'INVALID_RESPONSES',
          message: 'Responses contain an invalid, duplicate, or unrelated question.',
          timestamp: timestamp(),
        });
      }

      seen.add(questionId);
    }

    // Fetch answer keys only on the server.
    const questions = await Question.find({
      _id: { $in: questionIds },
    }).select('+answer type');

    const answerMap = new Map(
      questions.map((q) => [
        q._id.toString(),
        { answer: q.answer, type: q.type },
      ])
    );

    let calculatedScore = 0;
    let objectiveCount = 0;
    let pendingReviewCount = 0;

    const formattedResponses = responses.map((response) => {
      const questionId = (
        response.question?._id || response.question
      ).toString();

      const answer =
        response.answer ?? response.selectedOption;

      const questionType =
        questionTypes.get(questionId) ||
        answerMap.get(questionId)?.type;

      const correctAnswer = answerMap.get(questionId)?.answer;

      if (questionType === 'SUBJECTIVE') {
        pendingReviewCount += 1;

        return {
          question: questionId,
          answer: answer.trim(),
          gradingStatus: 'Pending Review',
        };
      }

      objectiveCount += 1;

      const normalize = (value) =>
        String(value).trim().toLowerCase();

      if (
        correctAnswer !== undefined &&
        normalize(answer) === normalize(correctAnswer)
      ) {
        calculatedScore += 1;
      }

      return {
        question: questionId,
        answer: answer.trim(),
        gradingStatus: 'Graded',
      };
    });

    // Commit the final score and close the attempt.
    attempt.responses = formattedResponses;
    attempt.score = calculatedScore;
    const durationMs = attempt.quiz.duration * 60 * 1000;
    const expiresAt =
      attempt.expiresAt ||
      new Date(attempt.startedAt.getTime() + durationMs);

    attempt.status = Date.now() >= expiresAt.getTime()
      ? 'timed_out'
      : 'submitted';
    attempt.submittedAt = new Date();

    await attempt.save();

    const totalQuestions = attempt.shuffledQuestions.length;
    const percentage =
      totalQuestions > 0
        ? Math.round((calculatedScore / totalQuestions) * 100)
        : 0;

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Quiz submitted successfully!',
      score: calculatedScore,
      totalQuestions,
      percentage,
      objectiveCount,
      pendingReviewCount,
      isFlaggedForReview: attempt.isFlaggedForReview,
      result: {
        attemptId: attempt._id,
        status: attempt.status,
        score: calculatedScore,
        totalQuestions,
        percentage,
        objectiveCount,
        pendingReviewCount,
        submittedAt: attempt.submittedAt,
        flaggedForReview: attempt.isFlaggedForReview,
      },
      timestamp: timestamp(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to submit quiz attempt.',
      timestamp: timestamp(),
    });
  }
};
