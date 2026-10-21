
const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');
const {
  requestIdMiddleware,
  requestLoggingMiddleware,
} = require('./middleware');
const errorHandler = require('./errorHandler');

const app = express();

app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

app.use(cors());
app.use(express.json());

// Register API routes
app.use('/api', healthRouter);

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
