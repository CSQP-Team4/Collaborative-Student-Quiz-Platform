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
| POST | `/api/leaderboard` | Opt-in leaderboard per quiz or subject (CSQP-29 / F-042) |
| POST | `/api/reports/student?format=pdf\|csv` | Student progress report file (CSQP-30 / F-043) |
| POST | `/api/reports/class?format=pdf\|csv` | Class analytics report file (CSQP-30 / F-043) |
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

### Report export (CSQP-30)

PDF files are made with reportlab and CSV files with pandas (SAD 3.6). Reports are built
from the same summary functions as the dashboards, so the file always matches the screen.
Express exposes them as `GET /api/analytics/me/export?format=pdf|csv` (students) and
`GET /api/analytics/class/export?format=pdf|csv` (instructors/admins). CSV files hold several
titled tables separated by a blank line and start with a UTF-8 BOM so Excel opens them correctly.

### Leaderboard (CSQP-29)

Students are **hidden by default** and opt in from *Profile settings* (`PUT /api/leaderboard/settings`).
Express (`GET /api/leaderboard?scope=quiz|subject&id=...`) only sends opted-in students' attempts here,
so students who opted out can never appear. Per quiz = each student's best score; per subject =
average of their best score on each quiz in that subject. Ties share a rank (1, 1, 3).
Seed data: Rahul Nair and Priya Sharma are opted in; Demo Student starts hidden so the toggle can be demoed.
