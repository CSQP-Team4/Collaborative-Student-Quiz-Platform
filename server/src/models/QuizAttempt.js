
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    answer: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'timed_out'],
      default: 'in_progress',
      required: true,
    },
    responses: {
      type: [responseSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    // CSQP-F-032: Per-attempt randomized snapshot of questions & shuffled options
    shuffledQuestions: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        text: String,
        type: {
          type: String,
          enum: ['MCQ', 'TRUE_FALSE', 'SUBJECTIVE'],
        },
        options: [String],
        subject: String,
        topic: String,
      },
    ],
    // CSQP-F-032: Anti-cheat security telemetry events (tab switch, clipboard attempt, blur)
    antiCheatEvents: [
      {
        eventType: {
          type: String,
          enum: ['TAB_SWITCH', 'CLIPBOARD_ATTEMPT', 'WINDOW_BLUR', 'RIGHT_CLICK_ATTEMPT'],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    isFlaggedForReview: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Required compound index for student quiz attempts.
quizAttemptSchema.index({ student: 1, quiz: 1, status: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
