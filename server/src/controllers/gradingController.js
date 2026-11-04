const mongoose = require('mongoose');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');

// Every question is worth one point in quizController scoring.
const MAX_MARKS = 1;

function sendError(res, statusCode, error, message) {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
  });
}

const round2 = (n) => Math.round(n * 100) / 100;

// CSQP-25: attempts that still have short answers waiting for manual grading.
async function listPendingReview(req, res) {
  try {
    const attempts = await QuizAttempt.find({
      'responses.gradingStatus': 'Pending Review',
    })
      .populate('student', 'name email')
      .populate('quiz', 'title subject')
      .sort({ submittedAt: 1 })
      .lean();

    const questionIds = new Set();
    attempts.forEach((a) =>
      a.responses.forEach((r) => {
        if (r.gradingStatus === 'Pending Review') questionIds.add(String(r.question));
      })
    );

    const questions = await Question.find({ _id: { $in: [...questionIds] } })
      .select('+answer text subject topic')
      .lean();
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    return res.status(200).json({
      success: true,
      count: attempts.length,
      attempts: attempts.map((a) => {
        const pending = a.responses.filter((r) => r.gradingStatus === 'Pending Review');
        return {
          id: a._id.toString(),
          student: a.student
            ? { id: a.student._id.toString(), name: a.student.name, email: a.student.email }
            : null,
          quiz: a.quiz
            ? { id: a.quiz._id.toString(), title: a.quiz.title, subject: a.quiz.subject }
            : null,
          status: a.status,
          submittedAt: a.submittedAt,
          score: a.score,
          totalQuestions: a.shuffledQuestions.length,
          pendingReviewCount: pending.length,
          pendingResponses: pending.map((r) => {
            const q = questionMap.get(String(r.question));
            return {
              questionId: String(r.question),
              questionText: q ? q.text : '',
              modelAnswer: q ? q.answer : '',
              studentAnswer: r.answer,
              maxMarks: MAX_MARKS,
            };
          }),
        };
      }),
    });
  } catch (error) {
    return sendError(res, 500, 'SERVER_ERROR', 'Unable to fetch the grading queue.');
  }
}

// CSQP-25: the instructor enters marks for one short answer; the total score updates.
async function gradeResponse(req, res) {
  const { id, questionId } = req.params;
  const marks = req.body ? req.body.marks : undefined;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(questionId)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid attempt or question id.');
  }
  if (typeof marks !== 'number' || !Number.isFinite(marks) || marks < 0 || marks > MAX_MARKS) {
    return sendError(res, 400, 'VALIDATION_ERROR', `marks must be a number between 0 and ${MAX_MARKS}.`);
  }

  const awarded = round2(marks);
  const qId = new mongoose.Types.ObjectId(questionId);

  try {
    // One atomic update, so two instructors cannot add marks to the same answer twice.
    const updated = await QuizAttempt.findOneAndUpdate(
      { _id: id, responses: { $elemMatch: { question: qId, gradingStatus: 'Pending Review' } } },
      {
        $set: { 'responses.$[r].marks': awarded, 'responses.$[r].gradingStatus': 'Graded' },
        $inc: { score: awarded },
      },
      {
        arrayFilters: [{ 'r.question': qId, 'r.gradingStatus': 'Pending Review' }],
        returnDocument: 'after',
      }
    );

    if (!updated) {
      const existing = await QuizAttempt.findById(id).select('responses').lean();
      if (!existing) {
        return sendError(res, 404, 'NOT_FOUND', 'Attempt not found.');
      }
      const response = existing.responses.find((r) => String(r.question) === questionId);
      if (!response) {
        return sendError(res, 404, 'NOT_FOUND', 'That question is not part of this attempt.');
      }
      return sendError(res, 409, 'ALREADY_GRADED', 'This answer is not waiting for review.');
    }

    const totalQuestions = updated.shuffledQuestions.length;
    const score = round2(updated.score);

    return res.status(200).json({
      success: true,
      attemptId: updated._id.toString(),
      questionId,
      marks: awarded,
      gradingStatus: 'Graded',
      score,
      totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0,
      pendingReviewCount: updated.responses.filter((r) => r.gradingStatus === 'Pending Review').length,
    });
  } catch (error) {
    return sendError(res, 500, 'SERVER_ERROR', 'Unable to save the marks.');
  }
}

module.exports = { listPendingReview, gradeResponse };
