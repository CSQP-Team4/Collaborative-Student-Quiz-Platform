
const mongoose = require('mongoose');

const materialVersionSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    fileUrl: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    versions: {
      type: [materialVersionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

materialSchema.index({
  title: 'text',
  subject: 'text',
  tags: 'text',
});

module.exports = mongoose.model('Material', materialSchema);
