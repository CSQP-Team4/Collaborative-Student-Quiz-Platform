
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  const errorResponse = {
    success: false,
    statusCode,
    error: statusCode >= 500
      ? 'INTERNAL_SERVER_ERROR'
      : (err.code || 'REQUEST_ERROR'),
    message: statusCode >= 500
      ? 'An internal server error occurred.'
      : err.message,
    timestamp: new Date().toISOString(),
  };

  console.error(JSON.stringify({
    requestId: req.requestId,
    statusCode,
    error: errorResponse.error,
  }));

  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;

