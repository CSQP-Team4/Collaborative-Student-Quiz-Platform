// HTTP client for the Python analytics service (SAD 3.3 "Internal RPC").
// The service runs separately (analytics/, default http://localhost:8001) so
// heavy statistics never block the Node event loop (SAD 3.5).

const DEFAULT_URL = 'http://localhost:8001';
// Leaves headroom inside the 5-second dashboard budget (CSQP-F-040).
const TIMEOUT_MS = 4000;

class AnalyticsUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AnalyticsUnavailableError';
    this.statusCode = 503;
    this.code = 'ANALYTICS_UNAVAILABLE';
    this.cause = cause;
  }
}

function baseUrl() {
  return (process.env.ANALYTICS_URL || DEFAULT_URL).replace(/\/+$/, '');
}

async function request(path, body) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.ANALYTICS_INTERNAL_TOKEN || '',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new AnalyticsUnavailableError(
      'The analytics service is not reachable. Start it with: cd analytics && uvicorn app.main:app --port 8001',
      err,
    );
  }
  if (!res.ok) {
    throw new AnalyticsUnavailableError(`The analytics service returned HTTP ${res.status}.`);
  }
  return res;
}

async function post(path, body) {
  return (await request(path, body)).json();
}

// Report downloads (CSQP-30): returns the file bytes plus its headers.
async function postFile(path, body) {
  const res = await request(path, body);
  return {
    content: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    disposition: res.headers.get('content-disposition') || 'attachment',
  };
}

module.exports = {
  AnalyticsUnavailableError,
  getStudentSummary: (payload) => post('/api/students/summary', payload),
  getClassSummary: (payload) => post('/api/quizzes/class-summary', payload),
  getLeaderboard: (payload) => post('/api/leaderboard', payload),
  getStudentReport: (payload, format) => postFile(`/api/reports/student?format=${format}`, payload),
  getClassReport: (payload, format) => postFile(`/api/reports/class?format=${format}`, payload),
};
