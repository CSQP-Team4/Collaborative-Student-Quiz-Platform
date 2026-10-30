const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const quizzesRouter = require('./routes/quizzes');
const analyticsRouter = require('./routes/analytics');
const {
  requestIdMiddleware,
  requestLoggingMiddleware,
} = require('./middleware');
const errorHandler = require('./errorHandler');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

app.use((req, res, next) => {
  if (!isProduction) return next();

  if (process.env.HTTPS_MODE === 'direct') {
    // Direct HTTPS is enforced by the HTTPS server in server.js.
    if (req.socket.encrypted) return next();
  } else if (
    process.env.HTTPS_MODE === 'proxy' &&
    req.secure
  ) {
    // Only use proxy mode behind a trusted HTTPS-terminating proxy.
    return next();
  }

  return res.status(400).json({
    success: false,
    statusCode: 400,
    error: 'HTTPS_REQUIRED',
    message: 'HTTPS is required.',
    timestamp: new Date().toISOString(),
  });
});



app.use(cors({
  origin: true,
  credentials: true,
  // Lets the browser read the file name of report downloads (CSQP-30).
  exposedHeaders: ['Content-Disposition'],
}));
app.use(cookieParser());
app.use(express.json());

// Register API routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api', quizzesRouter);

// Handle unknown endpoints
app.use((req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.path}`);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  next(err);
});

// Centralized error handler must come last
app.use(errorHandler);

module.exports = app;
