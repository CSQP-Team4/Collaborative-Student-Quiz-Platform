const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Uploaded files are stored in server/uploads/ (git-ignored)
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit from the SRS/SADS

// Allowed extensions and the MIME types browsers send for them
const ALLOWED_TYPES = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Random unique name so files never overwrite each other
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const unique = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}-${unique}-${base}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ALLOWED_TYPES[ext];
  const mimeOk =
    allowedMimes &&
    (allowedMimes.includes(file.mimetype) || file.mimetype === 'application/octet-stream');

  if (!mimeOk) {
    const err = new Error('Only PDF, DOCX and PPTX files are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    return cb(err);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
}).single('file'); // the form field must be named "file"

// Wrapper: turns upload problems into clean 400 responses in the team's error format
function uploadSingleFile(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError || err.code === 'INVALID_FILE_TYPE') {
      let error = 'UPLOAD_ERROR';
      let message = err.message;

      if (err.code === 'LIMIT_FILE_SIZE') {
        error = 'FILE_TOO_LARGE';
        message = 'File exceeds the 25MB size limit.';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        error = 'UNEXPECTED_FIELD';
        message = 'Send exactly one file in a form field named "file".';
      } else if (err.code === 'INVALID_FILE_TYPE') {
        error = 'INVALID_FILE_TYPE';
      }

      return res.status(400).json({
        success: false,
        statusCode: 400,
        error,
        message,
        timestamp: new Date().toISOString(),
      });
    }

    return next(err); // anything unexpected goes to the central error handler
  });
}

module.exports = { uploadSingleFile, UPLOAD_DIR, MAX_FILE_SIZE };