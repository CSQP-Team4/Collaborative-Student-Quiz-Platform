
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

module.exports = mongoose.model('Question', questionSchema);
