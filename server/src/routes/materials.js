const express = require('express');
const mongoose = require('mongoose');
const Material = require('../models/Material');
const fs = require('fs');
const { authenticateToken, authorizeRoles } = require('../middleware/rbac');
const { uploadSingleFile, UPLOAD_DIR } = require('../middleware/upload');
const {
  rateMaterial,
  addComment,
  listComments,
} = require('../controllers/materialFeedbackController');

const router = express.Router();

// Helper: error response in the team's standard format
const fail = (res, status, error, message) =>
  res.status(status).json({
    success: false,
    statusCode: status,
    error,
    message,
    timestamp: new Date().toISOString(),
  });

// Helper: delete an uploaded file if the request fails afterwards
const discardUpload = (file) =>
  file ? fs.promises.unlink(file.path).catch(() => {}) : Promise.resolve();

// GET /api/materials - View and search study materials
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const totalMaterials = await Material.countDocuments();
    if (totalMaterials === 0) {
      const User = require('../models/User');
      const uploader = (await User.findOne({ role: 'instructor' })) || (await User.findOne());
      if (uploader) {
        const samples = [
          {
            title: 'Operating Systems Process Synchronization & Semaphores',
            subject: 'Operating Systems',
            tags: ['semaphores', 'concurrency', 'deadlock', 'mutex'],
            fileUrl: '/api/materials/files/sample-os-notes.pdf',
            uploadedBy: uploader._id,
            versions: [{ version: 1, fileUrl: '/api/materials/files/sample-os-notes.pdf', uploadedBy: uploader._id }],
          },
          {
            title: 'Database Management Systems: SQL Queries & Normalization',
            subject: 'Database Management Systems',
            tags: ['sql', 'normalization', 'transactions', 'acid'],
            fileUrl: '/api/materials/files/sample-dbms-notes.pdf',
            uploadedBy: uploader._id,
            versions: [{ version: 1, fileUrl: '/api/materials/files/sample-dbms-notes.pdf', uploadedBy: uploader._id }],
          },
          {
            title: 'Computer Networks: TCP/IP & Socket Programming Guide',
            subject: 'Computer Networks',
            tags: ['tcp-ip', 'osi-model', 'sockets', 'routing'],
            fileUrl: '/api/materials/files/sample-cn-notes.pdf',
            uploadedBy: uploader._id,
            versions: [{ version: 1, fileUrl: '/api/materials/files/sample-cn-notes.pdf', uploadedBy: uploader._id }],
          },
          {
            title: 'Data Structures: Trees, Graphs & Dynamic Programming Cheat Sheet',
            subject: 'Data Structures',
            tags: ['trees', 'graphs', 'algorithms', 'dp'],
            fileUrl: '/api/materials/files/sample-dsa-notes.pdf',
            uploadedBy: uploader._id,
            versions: [{ version: 1, fileUrl: '/api/materials/files/sample-dsa-notes.pdf', uploadedBy: uploader._id }],
          },
          {
            title: 'Software Engineering: Agile Sprints, CI/CD & Design Patterns',
            subject: 'Software Engineering',
            tags: ['agile', 'scrum', 'design-patterns', 'testing'],
            fileUrl: '/api/materials/files/sample-se-notes.pdf',
            uploadedBy: uploader._id,
            versions: [{ version: 1, fileUrl: '/api/materials/files/sample-se-notes.pdf', uploadedBy: uploader._id }],
          },
        ];
        await Material.insertMany(samples);
      }
    }

    const { search, subject } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');

      filter.$or = [
        { title: searchRegex },
        { subject: searchRegex },
        { tags: searchRegex },
      ];
    }

    if (subject && subject.trim()) {
      filter.subject = new RegExp(
        subject.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
    }

    // CSQP-26: ?sort=rating puts the best-rated materials first
    const sort =
      req.query.sort === 'rating'
        ? { ratingAverage: -1, ratingCount: -1, createdAt: -1 }
        : { createdAt: -1 };

    const materials = await Material.find(filter)
      .populate('uploadedBy', 'name email')
      .sort(sort);

    res.status(200).json({
      success: true,
      count: materials.length,
      materials,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/materials - Add a study material
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { title, subject, tags, fileUrl } = req.body;

    if (!title || !subject || !fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title, subject, and file URL are required.',
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid file URL.',
      });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        success: false,
        message: 'File URL must use HTTP or HTTPS.',
      });
    }

    const materialTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
        ? tags.split(',')
        : [];

    const material = await Material.create({
      title: title.trim(),
      subject: subject.trim(),
      tags: materialTags.map((tag) => String(tag).trim()).filter(Boolean),
      fileUrl: fileUrl.trim(),
      uploadedBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Study material added successfully.',
      material,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/materials/:id - View one study material
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid material ID.',
      });
    }

    const material = await Material.findById(req.params.id)
      .populate('uploadedBy', 'name email');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found.',
      });
    }

    res.status(200).json({
      success: true,
      material,
    });
  } catch (error) {
    next(error);
  }
});

// CSQP-26: ratings and comments on materials
router.put('/:id/rating', authenticateToken, rateMaterial);
router.post('/:id/comments', authenticateToken, addComment);
router.get('/:id/comments', authenticateToken, listComments);

// Uploaded files are only served to logged-in users (CSQP-13)
router.use('/files', authenticateToken, express.static(UPLOAD_DIR));

// POST /api/materials/upload - Upload a study material file (PDF/DOCX/PPTX, max 25MB)
router.post(
  '/upload',
  authenticateToken,
  authorizeRoles('student', 'instructor'),
  uploadSingleFile,
  async (req, res, next) => {
    try {
      const { title, subject, tags } = req.body;

      if (!req.file) {
        return fail(res, 400, 'VALIDATION_ERROR', 'A file is required in the "file" field.');
      }

      if (
        typeof title !== 'string' || !title.trim() ||
        typeof subject !== 'string' || !subject.trim()
      ) {
        await discardUpload(req.file);
        return fail(res, 400, 'VALIDATION_ERROR', 'Title and subjectare required.');
      }

      const materialTags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
          ? tags.split(',')
          : [];

      const fileUrl = `/api/materials/files/${req.file.filename}`;

      const material = await Material.create({
        title: title.trim(),
        subject: subject.trim(),
        tags: materialTags.map((tag) => String(tag).trim()).filter(Boolean),
        fileUrl,
        uploadedBy: req.user.id,
        // Version 1 is recorded now so CSQP-15 (version history) can build on it
        versions: [{ version: 1, fileUrl, uploadedBy: req.user.id }],
      });

      res.status(201).json({
        success: true,
        message: 'Study material uploaded successfully.',
        material,
      });
    } catch (error) {
      await discardUpload(req.file);
      next(error);
    }
  }
);
module.exports = router;
