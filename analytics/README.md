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
| POST | `/api/students/summary` | Student dashboard: quiz history, score trend, topic strengths (CSQP-27 / F-040) |
| POST | `/api/quizzes/class-summary` | Class analytics per quiz: average, participation, most-missed questions (CSQP-28 / F-041) |
| GET | `/api/mock/students/{studentId}/summary` | Mock student dashboard data (shape of CSQP-F-040) |
| GET | `/api/mock/quizzes/{quizId}/class-summary` | Mock class analytics (shape of CSQP-F-041) |

The mock endpoints let the Node API be tested without real analytics (STP 10).

### Student dashboard (CSQP-27)

The Express route `GET /api/analytics/me` loads the student's submitted attempts,
grades every question (answer keys never leave Express) and posts them here.
A topic is a **strength** at 75% correct or more and a **weakness** below 50%.
The data is computed on every request, so a quiz appears on the dashboard
as soon as it is submitted.

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

### Class analytics (CSQP-28)

The Express route `GET /api/analytics/class` (instructors see their own quizzes,
admins see all) sends graded attempts here. Rules, so totals can be checked by hand:

- Each student counts **once per quiz**, using their latest submitted attempt (retakes don't skew the average).
- Participation rate = students who submitted / all students.
- Most-missed questions = lowest correct rate first, top 5, only questions someone got wrong.
