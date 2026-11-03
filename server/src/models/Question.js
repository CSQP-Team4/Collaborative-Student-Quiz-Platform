
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['MCQ', 'TRUE_FALSE', 'SUBJECTIVE'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      default: [],
    },
    answer: {
      type: String,
      required: true,
      select: false,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    // CSQP-F-020: questions are tagged by subject, topic and difficulty.
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// CSQP-F-021: each question type has its own rules.
questionSchema.pre('validate', function () {
  const options = (this.options || []).map((o) => String(o).trim()).filter(Boolean);
  const answer = String(this.answer || '').trim();

  if (this.type === 'MCQ') {
    if (options.length < 2 || options.length > 6) {
      throw new Error('MCQ questions need between 2 and 6 options');
    }
    const unique = new Set(options.map((o) => o.toLowerCase()));
    if (unique.size !== options.length) {
      throw new Error('MCQ options must be unique');
    }
    if (!options.includes(answer)) {
      throw new Error('MCQ answer must match one of the options');
    }
  } else if (this.type === 'TRUE_FALSE') {
    if (!['true', 'false'].includes(answer.toLowerCase())) {
      throw new Error('True/False answer must be "True" or "False"');
    }
  } else if (this.type === 'SUBJECTIVE') {
    if (!answer) {
      throw new Error('Short-answer questions need a model answer');
    }
  }
});

module.exports = mongoose.model('Question', questionSchema);
