const Question = require('../models/Question');

const TYPES = ['MCQ', 'TRUE_FALSE', 'SUBJECTIVE'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function clean(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function sendError(res, statusCode, error, message) {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
  });
}

// CSQP-F-020: students and instructors add questions to the shared bank.
async function createQuestion(req, res) {
  const body = req.body || {};
  const fields = {
    type: clean(body.type).toUpperCase(),
    text: clean(body.text),
    answer: clean(body.answer),
    subject: clean(body.subject),
    topic: clean(body.topic),
    difficulty: clean(body.difficulty).toLowerCase(),
  };
  const options = Array.isArray(body.options)
    ? body.options.map(clean).filter(Boolean)
    : [];

  const missing = Object.keys(fields).filter((key) => !fields[key]);
  if (missing.length) {
    return sendError(res, 400, 'VALIDATION_ERROR', `Missing required field(s): ${missing.join(', ')}`);
  }
  if (!TYPES.includes(fields.type)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'type must be MCQ, TRUE_FALSE, or SUBJECTIVE');
  }
  if (!DIFFICULTIES.includes(fields.difficulty)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'difficulty must be easy, medium, or hard');
  }

  // Status and createdBy are set by the server, never taken from the request body.
  const isStudent = clean(req.user.role).toLowerCase() === 'student';
  const question = new Question({
    ...fields,
    options,
    status: isStudent ? 'pending' : 'approved',
    createdBy: req.user.id,
  });

  try {
    await question.validate();
  } catch (error) {
    return sendError(res, 400, 'VALIDATION_ERROR', error.message);
  }

  try {
    await question.save({ validateBeforeSave: false });
  } catch (error) {
    return sendError(res, 500, 'SERVER_ERROR', 'Unable to save the question.');
  }

  return res.status(201).json({
    id: question._id.toString(),
    status: question.status,
  });
}

module.exports = { createQuestion };
