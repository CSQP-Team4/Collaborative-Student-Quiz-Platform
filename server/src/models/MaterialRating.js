const mongoose = require('mongoose');

const materialRatingSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: 'stars must be an integer' },
    },
  },
  { timestamps: true }
);

materialRatingSchema.index({ material: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('MaterialRating', materialRatingSchema);
