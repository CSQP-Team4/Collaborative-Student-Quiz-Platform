# CSQP Analytics Service (CSQP-6)

Python 3.10 worker service for statistics and report generation (SAD 3.4, 3.5).
It runs separately from the Express API so heavy computations never block the
Node event loop. The Express API calls it over HTTP/JSON on localhost.

## Run locally

```bash
cd analytics
python3.10 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Open http://localhost:8001/docs for interactive API docs.

## Test

```bash
cd analytics
pytest
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + confirms pandas and reportlab are installed |
| GET | `/api/ping` | Round-trip check from the Express API |
| GET | `/api/mock/students/{studentId}/summary` | Mock student dashboard data (shape of CSQP-F-040) |
| GET | `/api/mock/quizzes/{quizId}/class-summary` | Mock class analytics (shape of CSQP-F-041) |

The mock endpoints let the Node API be tested without real analytics (STP 10).
Real endpoints replace them in Sprint 2.

## Calling it from Express

```js
// server: e.g. src/services/analyticsClient.js
const ANALYTICS_URL = process.env.ANALYTICS_URL || "http://localhost:8001";

async function getStudentSummary(studentId) {
  const res = await fetch(`${ANALYTICS_URL}/api/mock/students/${studentId}/summary`, {
    headers: { "X-Internal-Token": process.env.ANALYTICS_INTERNAL_TOKEN || "" },
  });
  if (!res.ok) throw new Error(`Analytics service error ${res.status}`);
  return res.json();
}
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANALYTICS_PORT` | `8001` | Port when run with `python -m app.main` |
| `ANALYTICS_INTERNAL_TOKEN` | empty | If set, `/api/*` calls must send `X-Internal-Token` with this value |
