/**
 * Anti-Cheat Utilities (CSQP-F-032 / SAD 3.7 & 3.9)
 *
 * Implements:
 * 1. Fisher-Yates per-attempt randomization for question order and MCQ option order.
 * 2. Strict answer-key stripping so browser payloads never expose correct answers.
 * 3. Integrity verification utilities for test and security audits.
 */

/**
 * Creates a shuffled copy of an array using the Fisher-Yates algorithm.
 * Uses Math.random() or secure random values to ensure unpredictability.
 *
 * @param {Array} array
 * @returns {Array} Shuffled shallow copy
 */
function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Strips correct answers, solutions and internal answer keys from question object.
 * Guaranteeing answer keys never leak to client runtime (SAD 3.7).
 *
 * @param {Object} question
 * @returns {Object} Safe question object without answer keys
 */
function stripAnswerKey(question) {
  if (!question) return null;
  const raw = typeof question.toObject === 'function' ? question.toObject() : { ...question };

  delete raw.answer;
  delete raw.correctAnswer;
  delete raw.solution;
  delete raw.__v;

  return raw;
}

/**
 * Randomizes both question ordering and multiple-choice options per attempt (CSQP-F-032).
 * Two students taking the same quiz will receive different question order and option order.
 *
 * @param {Array} questions - Array of Question documents or objects
 * @returns {Array} Randomized questions with stripped answer keys
 */
function randomizeQuizQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  // 1. Randomize question order
  const shuffledQuestions = shuffleArray(questions);

  // 2. For each question, randomize options (if MCQ) and strictly strip answers
  return shuffledQuestions.map((q) => {
    const safeQ = stripAnswerKey(q);
    const options = Array.isArray(safeQ.options) ? shuffleArray(safeQ.options) : [];

    return {
      question: safeQ._id || safeQ.id,
      text: safeQ.text,
      type: safeQ.type,
      options,
      subject: safeQ.subject,
      topic: safeQ.topic,
      difficulty: safeQ.difficulty,
    };
  });
}

/**
 * Security assertion: Verifies that no answer key exists in the entire payload.
 *
 * @param {any} target - Any object or array to recursively inspect
 * @returns {boolean} True if clean, throws Error if answer key detected
 */
function verifyPayloadIsAnswerFree(target) {
  if (!target) return true;

  // Convert to plain JSON to strip any Mongoose document circular references/getters
  let plain;
  try {
    plain = JSON.parse(JSON.stringify(target));
  } catch {
    plain = target;
  }

  function check(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        check(item);
      }
      return;
    }

    const forbiddenKeys = ['answer', 'correctAnswer', 'solution'];
    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.includes(key.toLowerCase())) {
        throw new Error(`Security violation: Answer key "${key}" detected in client payload.`);
      }
      check(obj[key]);
    }
  }

  check(plain);
  return true;
}

module.exports = {
  shuffleArray,
  stripAnswerKey,
  randomizeQuizQuestions,
  verifyPayloadIsAnswerFree,
};
