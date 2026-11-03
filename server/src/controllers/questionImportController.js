
const Question = require('../models/Question');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

const REQUIRED_FIELDS = [
  'type',
  'text',
  'answer',
  'subject',
  'topic',
  'difficulty',
];

function normalize(value) {
  return value === undefined || value === null
    ? ''
    : String(value).trim();
}

function normalizeHeader(value) {
  return normalize(value).toLowerCase().replace(/[\s-]+/g, '_');
}

function parseOptions(value) {
  if (Array.isArray(value)) {
    return value.map(normalize).filter(Boolean);
  }

  const text = normalize(value);
  if (!text) return [];

  // Use | to separate options so commas inside option text remain valid.
  return text.split('|').map((item) => item.trim()).filter(Boolean);
}

function validateRow(rawRow, rowNumber, userId) {
  const row = {};

  for (const [key, value] of Object.entries(rawRow)) {
    row[normalizeHeader(key)] = value;
  }

  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!normalize(row[field])) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  const type = normalize(row.type).toUpperCase();
  const difficulty = normalize(row.difficulty).toLowerCase();
  const text = normalize(row.text);
  const answer = normalize(row.answer);
  const subject = normalize(row.subject);
  const topic = normalize(row.topic);
  const options = parseOptions(row.options);

  if (type && !['MCQ', 'TRUE_FALSE', 'SUBJECTIVE'].includes(type)) {
    errors.push('type must be MCQ, TRUE_FALSE, or SUBJECTIVE');
  }

  if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
    errors.push('difficulty must be easy, medium, or hard');
  }

  if (type === 'MCQ') {
    if (options.length < 2) {
      errors.push('MCQ requires at least two options separated by |');
    } else if (!options.includes(answer)) {
      errors.push('MCQ answer must match one of its options exactly');
    }
  }

  if (type === 'TRUE_FALSE') {
    if (!['true', 'false'].includes(answer.toLowerCase())) {
      errors.push('TRUE_FALSE answer must be True or False');
    }
  }

  if (type === 'SUBJECTIVE' && options.length > 0) {
    // Subjective questions may include optional choices, but these are
    // generally unnecessary; retain any supplied options.
  }

  if (errors.length) {
    return {
      rowNumber,
      errors,
    };
  }

  return {
    rowNumber,
    question: {
      type,
      text,
      answer,
      subject,
      topic,
      difficulty,
      options,
      // Never trust status or createdBy from an uploaded spreadsheet.
      status: 'pending',
      createdBy: userId,
    },
  };
}

function readUploadedRows(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    const error = new Error('Upload a CSV or Excel file using the "file" field.');
    error.statusCode = 400;
    throw error;
  }

  if (file.size > MAX_FILE_SIZE) {
    const error = new Error('File exceeds the 5 MB upload limit.');
    error.statusCode = 413;
    throw error;
  }

  const filename = (file.originalname || '').toLowerCase();

  if (filename.endsWith('.csv')) {
    const content = file.buffer.toString('utf8').replace(/^\uFEFF/, '');

    return parse(content, {
      bom: true,
      columns: (headers) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      skip_records_with_error: false,
    });
  }

  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!firstSheet) return [];

    return XLSX.utils.sheet_to_json(firstSheet, {
      defval: '',
      raw: false,
    });
  }

  const error = new Error('Unsupported file type. Upload .csv, .xlsx, or .xls.');
  error.statusCode = 400;
  throw error;
}

function sendError(res, statusCode, message, details) {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    error: statusCode === 413 ? 'FILE_TOO_LARGE' : 'IMPORT_FAILED',
    message,
    ...(details ? { details } : {}),
    timestamp: new Date().toISOString(),
  });
}

async function importQuestions(req, res) {
  let rows;

  try {
    rows = readUploadedRows(req.file);
  } catch (error) {
    return sendError(
      res,
      error.statusCode || 400,
      error.message || 'Unable to parse the uploaded file.'
    );
  }

  if (!rows.length) {
    return sendError(res, 400, 'The uploaded file contains no question rows.');
  }

  if (rows.length > MAX_ROWS) {
    return sendError(
      res,
      400,
      `The file contains ${rows.length} rows; the maximum is ${MAX_ROWS}.`
    );
  }

  const imported = [];
  const rejected = [];

  // CSV data records begin on line 2 because line 1 contains the header.
  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const result = validateRow(rows[index], rowNumber, req.user.id);

    if (result.errors) {
      rejected.push(result);
      continue;
    }

    imported.push(result.question);
  }

  let inserted = [];

  if (imported.length) {
    try {
      inserted = await Question.insertMany(imported, { ordered: false });
    } catch (error) {
      // Mongoose validation errors can occur even after our row checks.
      if (error.insertedDocs) {
        inserted = error.insertedDocs;
      }

      const insertedCount = inserted.length;
      return res.status(207).json({
        success: insertedCount > 0,
        message: 'Import completed with database validation errors.',
        importedCount: insertedCount,
        rejectedCount: rejected.length + (imported.length - insertedCount),
        errors: rejected,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return res.status(rejected.length ? 207 : 201).json({
    success: true,
    message: rejected.length
      ? 'Valid questions were imported; some rows were rejected.'
      : 'All questions were imported successfully.',
    importedCount: inserted.length,
    rejectedCount: rejected.length,
    errors: rejected,
    timestamp: new Date().toISOString(),
  });
}

function csvEscape(value) {
  let text = value === undefined || value === null ? '' : String(value);

  // Prevent spreadsheet software from interpreting exported text as a formula.
  if (/^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

async function exportQuestions(req, res) {
  const format = normalize(req.query.format || 'csv').toLowerCase();

  if (!['csv', 'xlsx'].includes(format)) {
    return sendError(res, 400, 'Unsupported export format. Use csv or xlsx.');
  }

  try {
    const questions = await Question.find({})
      .select('+answer')
      .sort({ createdAt: -1 })
      .lean();

    const data = questions.map((question) => ({
      type: question.type,
      text: question.text,
      options: (question.options || []).join('|'),
      answer: question.answer,
      subject: question.subject,
      topic: question.topic,
      difficulty: question.difficulty,
    }));

    const headers = [
      'type',
      'text',
      'options',
      'answer',
      'subject',
      'topic',
      'difficulty',
    ];

    if (format === 'csv') {
      const csv = [
        headers.map(csvEscape).join(','),
        ...data.map((row) =>
          headers.map((header) => csvEscape(row[header])).join(',')
        ),
      ].join('\r\n');

      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="questions.csv"',
        'Cache-Control': 'no-store',
      });

      return res.send(`\uFEFF${csv}`);
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="questions.xlsx"',
      'Cache-Control': 'no-store',
    });

    return res.send(buffer);
  } catch (error) {
    return sendError(res, 500, 'Unable to export questions.');
  }
}

async function listQuestions(req, res) {
  try {
    const { subject, topic, difficulty, type, search } = req.query;
    const filter = {};

    if (subject && subject !== 'All') {
      filter.subject = subject;
    }
    if (topic) {
      filter.topic = topic;
    }
    if (difficulty) {
      filter.difficulty = difficulty;
    }
    if (type) {
      filter.type = type;
    }
    if (search && search.trim()) {
      filter.text = { $regex: search.trim(), $options: 'i' };
    }

    const questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    return res.status(200).json({
      success: true,
      questions: questions.map((q) => ({
        id: q._id.toString(),
        type: q.type,
        text: q.text,
        options: q.options || [],
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        status: q.status,
        createdAt: q.createdAt,
      })),
    });
  } catch (error) {
    return sendError(res, 500, 'Unable to fetch questions.');
  }
}

module.exports = {
  importQuestions,
  exportQuestions,
  listQuestions,
  readUploadedRows,
  validateRow,
};
