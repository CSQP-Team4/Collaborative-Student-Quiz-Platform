# CSQP Client (React + Vite)

React 18 single-page app for the Collaborative Study Material & Quiz Platform.

## Run

```bash
cd client
npm install
cp .env.example .env.local   # then edit if needed
npm run dev                  # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit and component tests (Vitest + Testing Library) |
| `npm run lint` | Oxlint |
| `npm run build` | Production build to `dist/` |

## Authentication (CSQP-12)

Pages: `/login`, `/register`, `/verify-email`, and role dashboards
`/student`, `/instructor`, `/admin`. After login each role lands on its own
dashboard; other dashboards redirect back.

- The access token is kept in memory only; the session is restored on reload
  through the HttpOnly refresh-token cookie (`POST /api/auth/refresh`).
- The API contract the backend must match is at the top of
  `src/auth/authService.js`.

### Demo mode (no backend)

Until the auth API (CSQP-7, CSQP-8, CSQP-9) is merged, set
`VITE_USE_MOCK_AUTH=true` in `.env.local`. Demo accounts (password `Password1`):
`student@pes.edu`, `instructor@pes.edu`, `admin@pes.edu`.
New registrations verify with code `123456`. Data stays in your browser only.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api` | Express API base URL |
| `VITE_USE_MOCK_AUTH` | `false` | Use the in-browser demo auth |
| `VITE_COLLEGE_EMAIL_SUFFIX` | `.edu` | Required ending for registration emails |
