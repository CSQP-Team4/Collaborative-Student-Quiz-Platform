
const { randomUUID } = require('crypto');

function requestIdMiddleware(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

function requestLoggingMiddleware(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const logEntry = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startTime,
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}

module.exports = {
  requestIdMiddleware,
  requestLoggingMiddleware,
};
