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

// Escape special regex characters so user input is treated as plain text
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Accept only plain strings from the query (repeated params like ?a=1&a=2 become arrays)
const str = (value) => (typeof value === 'string' ? value.trim() : '');

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1 },
  rating: { ratingAverage: -1, ratingCount: -1, createdAt: -1 },
};

// GET /api/materials - Search and filter study materials (CSQP-14)
// Query params: q, subject, tag/tags, uploader, from, to, sort, page, limit
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    // Existing demo-data behaviour (kept from main): seed sample materials if the collection is empty
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

    const filter = {};

    // Keyword search across title, subject and tags ("search" is kept for older callers)
    const keyword = str(req.query.q) || str(req.query.search);
    if (keyword) {
      const keywordRegex = new RegExp(escapeRegex(keyword), 'i');
      filter.$or = [
        { title: keywordRegex },
        { subject: keywordRegex },
        { tags: keywordRegex },
      ];
    }

    // Subject filter (partial, case-insensitive)
    const subject = str(req.query.subject);
    if (subject) {
      filter.subject = new RegExp(escapeRegex(subject), 'i');
    }

    // Tag filter: material must contain ALL requested tags (exact, case-insensitive)
    const tagList = [...str(req.query.tag).split(','), ...str(req.query.tags).split(',')]
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagList.length) {
      filter.tags = {
        $all: tagList.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')),
      };
    }

    // Uploader filter: a user ID, or "me" for the logged-in user's own materials
    const uploader = str(req.query.uploader);
    if (uploader) {
      const uploaderId = uploader === 'me' ? req.user.id : uploader;
      if (!mongoose.isValidObjectId(uploaderId)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid uploader ID.');
      }
      filter.uploadedBy = uploaderId;
    }

    // Date range filter on upload date (the "to" date includes the whole day)
    const dateRange = {};
    const from = str(req.query.from);
    const to = str(req.query.to);
    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid "from" date. Use YYYY-MM-DD.');
      }
      dateRange.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid "to" date. Use YYYY-MM-DD.');
      }
      toDate.setUTCHours(23, 59, 59, 999);
      dateRange.$lte = toDate;
    }
    if (Object.keys(dateRange).length) {
      filter.createdAt = dateRange;
    }

    // Sorting (only whitelisted options)
    const sortKey = str(req.query.sort) || 'newest';
    const sortBy = SORT_OPTIONS[sortKey];
    if (!sortBy) {
      return fail(res, 400, 'VALIDATION_ERROR', 'sort must be one of: newest, oldest, title, rating.');
    }

    // Pagination (default 10 per page, maximum 50)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const [materials, total] = await Promise.all([
      Material.find(filter)
        .populate('uploadedBy', 'name email')
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit),
      Material.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: materials.length, // number of items on this page
      total,                   // total matches across all pages
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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


// ---------------------------------------------------------------------------
// CSQP-15: Study material revision history and versioning
// Old files are never overwritten: every upload becomes a new version, and the
// material's main fileUrl always points at the latest one.
// ---------------------------------------------------------------------------
const path = require('path');

// Files uploaded through /upload are stored locally and served under this prefix
const LOCAL_FILE_PREFIX = '/api/materials/files/';
const isLocalFile = (url) => typeof url === 'string' && url.startsWith(LOCAL_FILE_PREFIX);

// Materials created before versioning existed have no versions array.
// Their current file is treated as version 1.
const versionsOf = (material) =>
  material.versions && material.versions.length
    ? material.versions
    : [{
        version: 1,
        fileUrl: material.fileUrl,
        uploadedBy: material.uploadedBy,
        uploadedAt: material.createdAt,
      }];

// POST /api/materials/:id/versions - Upload a new revision of a material (CSQP-15)
// Allowed for the original uploader or an instructor. Form field "file".
router.post(
  '/:id/versions',
  authenticateToken,
  authorizeRoles('student', 'instructor'),
  uploadSingleFile,
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        await discardUpload(req.file);
        return fail(res, 400, 'VALIDATION_ERROR', 'Invalid material ID.');
      }

      if (!req.file) {
        return fail(res, 400, 'VALIDATION_ERROR', 'A file is required in the "file" field.');
      }

      const material = await Material.findById(req.params.id);
      if (!material) {
        await discardUpload(req.file);
        return fail(res, 404, 'NOT_FOUND', 'Study material not found.');
      }

      const isOwner = String(material.uploadedBy) === String(req.user.id);
      const isInstructor = (req.user.role || '').toLowerCase() === 'instructor';
      if (!isOwner && !isInstructor) {
        await discardUpload(req.file);
        return fail(
          res,
          403,
          'FORBIDDEN',
          'Only the original uploader or an instructor can add a new version.'
        );
      }

      // Older materials without a history: record their current file as version 1 first
      if (material.versions.length === 0) {
        material.versions.push({
          version: 1,
          fileUrl: material.fileUrl,
          uploadedBy: material.uploadedBy,
        });
      }

      const latest = Math.max(...material.versions.map((v) => v.version));
      const nextVersion = latest + 1;
      const fileUrl = `${LOCAL_FILE_PREFIX}${req.file.filename}`;

      material.versions.push({ version: nextVersion, fileUrl, uploadedBy: req.user.id });
      material.fileUrl = fileUrl; // main link always points at the newest version
      await material.save();

      res.status(201).json({
        success: true,
        message: 'New version uploaded successfully.',
        materialId: material._id,
        currentVersion: nextVersion,
        version: material.versions[material.versions.length - 1],
      });
    } catch (error) {
      await discardUpload(req.file);
      next(error);
    }
  }
);

// GET /api/materials/:id/versions - List the revision history, newest first (CSQP-15)
router.get('/:id/versions', authenticateToken, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid material ID.');
    }

    const material = await Material.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('versions.uploadedBy', 'name email')
      .lean();

    if (!material) {
      return fail(res, 404, 'NOT_FOUND', 'Study material not found.');
    }

    const all = versionsOf(material);
    const currentVersion = Math.max(...all.map((v) => v.version));

    const versions = all
      .map((v) => ({
        version: v.version,
        fileUrl: v.fileUrl,
        uploadedBy: v.uploadedBy,
        uploadedAt: v.uploadedAt,
        isCurrent: v.version === currentVersion,
        downloadUrl: `/api/materials/${material._id}/versions/${v.version}/download`,
      }))
      .sort((a, b) => b.version - a.version);

    res.status(200).json({
      success: true,
      materialId: material._id,
      title: material.title,
      currentVersion,
      count: versions.length,
      versions,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/materials/:id/versions/:n/download - Download one specific version (CSQP-15)
router.get('/:id/versions/:n/download', authenticateToken, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Invalid material ID.');
    }

    const versionNumber = Number(req.params.n);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Version must be a positive whole number.');
    }

    const material = await Material.findById(req.params.id).lean();
    if (!material) {
      return fail(res, 404, 'NOT_FOUND', 'Study material not found.');
    }

    const entry = versionsOf(material).find((v) => v.version === versionNumber);
    if (!entry) {
      return fail(res, 404, 'NOT_FOUND', `Version ${versionNumber} does not exist.`);
    }

    // Only files stored by this server can be downloaded here
    if (!isLocalFile(entry.fileUrl)) {
      return fail(res, 404, 'FILE_NOT_AVAILABLE', 'This version is not stored on this server.');
    }

    // path.basename prevents "../" tricks from escaping the uploads folder
    const filePath = path.join(UPLOAD_DIR, path.basename(entry.fileUrl));
    try {
      await fs.promises.access(filePath);
    } catch {
      return fail(res, 404, 'FILE_NOT_AVAILABLE', 'The file for this version is missing on the server.');
    }

    const safeTitle = String(material.title).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
    const downloadName = `${safeTitle}-v${versionNumber}${path.extname(filePath)}`;

    res.download(filePath, downloadName, (err) => {
      if (err && !res.headersSent) next(err);
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
