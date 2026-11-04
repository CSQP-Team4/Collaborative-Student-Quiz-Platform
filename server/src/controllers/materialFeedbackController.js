const mongoose = require('mongoose');
const Material = require('../models/Material');
const MaterialRating = require('../models/MaterialRating');
const MaterialComment = require('../models/MaterialComment');

const fail = (res, status, message) =>
  res.status(status).json({ success: false, statusCode: status, message });

async function findMaterialOr404(id, res) {
  if (!mongoose.isValidObjectId(id)) {
    fail(res, 404, 'Study material not found.');
    return null;
  }
  const material = await Material.findById(id);
  if (!material) {
    fail(res, 404, 'Study material not found.');
    return null;
  }
  return material;
}

// PUT /api/materials/:id/rating   body: { stars }
async function rateMaterial(req, res, next) {
  try {
    const { stars } = req.body || {};
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return fail(res, 400, 'stars must be an integer from 1 to 5.');
    }

    const material = await findMaterialOr404(req.params.id, res);
    if (!material) return;

    if (String(material.uploadedBy) === String(req.user.id)) {
      return fail(res, 403, 'You cannot rate your own material.');
    }

    await MaterialRating.findOneAndUpdate(
      { material: material._id, user: req.user.id },
      { stars },
      { upsert: true, setDefaultsOnInsert: true }
    );

    const [agg] = await MaterialRating.aggregate([
      { $match: { material: material._id } },
      { $group: { _id: null, avg: { $avg: '$stars' }, count: { $sum: 1 } } },
    ]);

    const ratingAverage = Math.round(agg.avg * 10) / 10;
    const ratingCount = agg.count;
    await Material.updateOne({ _id: material._id }, { ratingAverage, ratingCount });

    res.status(200).json({ success: true, ratingAverage, ratingCount, myRating: stars });
  } catch (error) {
    next(error);
  }
}

// POST /api/materials/:id/comments   body: { text }
async function addComment(req, res, next) {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (text.length < 1 || text.length > 1000) {
      return fail(res, 400, 'Comment must be 1 to 1000 characters.');
    }

    const material = await findMaterialOr404(req.params.id, res);
    if (!material) return;

    const comment = await MaterialComment.create({
      material: material._id,
      user: req.user.id,
      text,
    });

    res.status(201).json({
      success: true,
      comment: { id: comment._id, text: comment.text, createdAt: comment.createdAt },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/materials/:id/comments?page=1&limit=20
async function listComments(req, res, next) {
  try {
    const material = await findMaterialOr404(req.params.id, res);
    if (!material) return;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const [comments, total] = await Promise.all([
      MaterialComment.find({ material: material._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name'),
      MaterialComment.countDocuments({ material: material._id }),
    ]);

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      comments: comments.map((c) => ({
        id: c._id,
        text: c.text,
        author: c.user ? c.user.name : 'Unknown',
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { rateMaterial, addComment, listComments };
