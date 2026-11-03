# Collaborative Study Material & Quiz Platform (CSQP)

[![Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/CSQP-Team4/Collaborative-Student-Quiz-Platform)
[![Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20Python-green)](#tech-stack)
[![Tests Passing](https://img.shields.io/badge/Tests-177%20Passed-brightgreen)](server/src/_tests_)
[![Performance SLA](https://img.shields.io/badge/p90%20Latency-227.6ms%20(%3C%3D2s)-success)](docs/SECURITY_CHECKLIST.md)
[![SRS Version](https://img.shields.io/badge/SRS-v1.0-orange)](docs/)

A full-stack collaborative learning and assessment platform designed for students and educators. CSQP allows students to share, version, and review study materials, contribute questions to a centralized question bank, attempt timed and anti-cheat protected quizzes, and gain actionable learning insights through performance analytics.

---

## 📌 Team 4 - Member Profiles & Jira Task Ownership

| Member | SRN | Primary Role | Jira Stories Owned | Sprint 1 Focus | Sprint 2 Focus | Status |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| **John S Thomas** | `PES2UG24CS207` | Security & Performance QA / Auth Lead | **10** | Email registration, JWT login, refresh tokens, RBAC middleware, account lockout | Anti-cheat engine, single active attempt, password reset, latency p90 <= 2s benchmark, security audit checklist | **10/10 Done (100%)** |
| **Krishna Manoj** | `PES2UG24CS236` | Test Engineer / Core Engine Dev | **8** | Project scaffolding, Mongoose schemas, error handling/logging, TLS 1.2+ HTTPS | Bulk question import (CSV/Excel), quiz assembly, countdown timer, instant auto-grading | In Progress |
| **Harshith R Reddy** | `PES2UG24CS188` | QA Lead / CI & Analytics Dev | **10** | GitHub Actions CI, test seed fixtures, Python analytics skeleton, Auth UI | Student dashboard, instructor class analytics, opt-in leaderboard, report export, WCAG 2.1 AA UI, 99.5% uptime | In Progress |
| **Kritika Mahapatra** | `PES2UG24CS239` | Test Engineer / Content & UI Dev | **9** | Material upload & limits, material search/filter, version history | Question types (MCQ/TF/Short), question contribution, instructor approval queue, subjective grading queue, ratings & comments, 5K user scale | In Progress |

---

## 🎯 Agile Project Management (Jira + GitHub Workflow)

The team manages requirements, sprints, and story tracking through **Jira Software**, fully integrated with this GitHub repository via smart commits and pull requests.

- **Jira Workspace**: [CSQP Jira Project](https://harshithrreddy006.atlassian.net) (Key: `CSQP`)
- **Total Tracked Stories**: 37 stories across Practice Sprint, Sprint 1, and Sprint 2.
- **Workflow Automation**: Every feature branch and commit starts with the Jira issue key (e.g. `CSQP-23: implement anti-cheat engine`), automatically linking GitHub commits, pull requests, and status transitions directly to Jira.

### 🗓️ Sprint Schedule & Roadmap

```text
 12 Oct – 16 Oct             19 Oct – 23 Oct             26 Oct – 30 Oct
 [Practice Sprint] ────────► [Sprint 1 Execution] ─────► [Sprint 2 Execution]
 • Project Scaffolding       • Auth & Security Stack     • Timed Quiz & Anti-Cheat
 • GitHub Actions CI         • Study Material Sharing    • Concurrency & Lockouts
                             • 1-Min Demo Video          • Performance Benchmarks (p90)
                                                         • STRIDE Security Audit
```

#### 1. Practice Sprint (12 Oct 2026 – 16 Oct 2026)
* **Goal**: Technical foundation, dev environment alignment, and automated CI pipeline.
* **Key Deliverables**:
  - `CSQP-1`: Full-stack scaffolding (React SPA, Express API, MongoDB connection, health check) — *Krishna Manoj*
  - `CSQP-4`: GitHub Actions CI pipeline with automated linting and unit test execution — *Harshith R Reddy*

#### 2. Sprint 1 (19 Oct 2026 – 23 Oct 2026)
* **Goal**: Working login-to-upload vertical slice: complete authentication & RBAC, study material upload, search, and versioning.
* **Stories in Scope**:
  - **Auth & Security Stack (John)**: `CSQP-7` (Email registration & verification), `CSQP-8` (JWT login), `CSQP-9` (Refresh-token rotation), `CSQP-10` (RBAC middleware), `CSQP-11` (Account lockout & audit logging).
  - **Core Backend & Scaffolding (Krishna)**: `CSQP-1` (Scaffolding), `CSQP-2` (Mongoose collection schemas), `CSQP-3` (Centralized error handler & logger), `CSQP-34` (TLS 1.2+ HTTPS enforcement).
  - **CI, Testing & Analytics Skeleton (Harshith)**: `CSQP-4` (CI pipeline), `CSQP-5` (Test fixtures & seeds), `CSQP-6` (Python analytics skeleton), `CSQP-12` (Auth UI & role dashboard shell).
  - **Study Materials Engine (Kritika)**: `CSQP-13` (Material upload with size/type checks), `CSQP-14` (Multi-criteria search & filtering), `CSQP-15` (Material revision history).

#### 3. Sprint 2 (26 Oct 2026 – 30 Oct 2026)
* **Goal**: Curated question bank, timed anti-cheat quizzes with auto-grading, analytics dashboards, and non-functional requirement (NFR) validation.
* **Delivered by John S Thomas (`PES2UG24CS207`) — 100% Completed & Merged**:
  - `CSQP-31`: **Password Reset via Email (CSQP-F-004)** — Secure cryptographic token verification and Gmail SMTP delivery.
  - `CSQP-23`: **Anti-Cheat Engine (CSQP-F-032 / SAD 3.7)** — Fisher-Yates per-attempt question & MCQ option randomization, strict answer-key stripping, and client clipboard / tab-switch lock.
  - `CSQP-24`: **Single Active Attempt Lock (CSQP-F-033 / TC-Att-04)** — Concurrency guard returning 409 Conflict with session resumption.
  - `CSQP-32`: **Performance Benchmark (CSQP-NF-001 / TC-Perf-01)** — Proved $p90 = 227.6\text{ ms} \le 2.0\text{s}$ under concurrent load with zero 500 errors.
  - `CSQP-36`: **STRIDE Security Audit & Checklist (CSQP-NF-003)** — Verified personal data protection, answer security, role guards, lockout immutability, and published formal checklist.

---

## 🛠️ Key Features & Architectural Highlights

### 1. Authentication & Role-Based Access Control (RBAC)
- University email verification (`@pes.edu`) via time-limited 6-digit OTP and direct link via Gmail SMTP.
- Secure JWT-based session management with rotating refresh tokens (15-60 min access, 7-day refresh in HttpOnly cookies).
- Granular permissions for **Student**, **Instructor**, and **Admin** roles with 403 Forbidden enforcement.
- Brute-force protection: 15-minute account lockout after 5 consecutive failed login attempts with non-repudiation audit logging.
- Salted password hashing using `bcrypt` ($\ge 10$ salt rounds, `select: false` in queries).
- Secure password reset flow via emailed single-use reset tokens with 15-minute expiration.

### 2. Anti-Cheat Engine & Academic Integrity
- **Fisher-Yates Question & Option Shuffling:** Every attempt receives a randomized question order and randomized multiple-choice option arrangement.
- **Strict Answer-Key Stripping:** Correct answers (`answer`, `correctAnswer`, `solution`) are excluded from all client-facing quiz payloads, eliminating browser dev tools tampering.
- **Client Security Lock (`useAntiCheat`):** Disables text selection (`user-select: none`), intercepts and blocks clipboard events (`copy`, `cut`, `paste`) and context menus.
- **Proctoring Telemetry:** Monitors tab switching (`visibilitychange`) and window blur, reporting telemetry to `/api/attempts/:id/anti-cheat` and flagging attempts after 3 violations.
- **Single Active Attempt Concurrency Lock:** Prevents multiple simultaneous sessions per student; allows resumption of legitimate active sessions.

### 3. Study Material Sharing & Question Bank
- Multi-format file uploads (up to 25MB) categorized with subject and topic tags.
- Support for MCQ, True/False, and Subjective questions with peer contribution and instructor moderation workflows.
- Material version history retention allowing access to historical revisions.

---

## 💻 Tech Stack

- **Frontend**: React 18, React Router v6, Vite, Axios client, CSS3 Design Tokens conforming to WCAG 2.1 AA.
- **Backend API**: Node.js & Express 5 (RESTful architecture, API-level RBAC, centralized error envelope, rate limiting).
- **Database**: MongoDB (v6+) & Mongoose 9 ODM (Compound indexes on `{ student: 1, quiz: 1, status: 1 }` and `{ email: 1 }`).
- **Email Service**: Transactional Nodemailer with Gmail SMTP.
- **Analytics Service**: Python 3.10+ & FastAPI (statistical computations & reporting worker).
- **Testing**: Jest, Supertest, Vitest, React Testing Library.

---

## 📂 Repository Structure

```text
Collaborative-Student-Quiz-Platform/
├── .github/
│   ├── pull_request_template.md # Standardized PR template with Jira story & checklist
│   └── workflows/
│       ├── ci.yml              # Multi-tier CI (Node API, React SPA, Python Analytics)
│       └── pr-checks.yml       # Enforces Jira issue key format on PR titles & branches
├── client/                     # Frontend Single-Page Application (React 18 + Vite)
│   ├── src/
│   │   ├── api/                # Axios HTTP client configuration with in-memory tokens
│   │   ├── auth/               # AuthContext, AuthProvider, ProtectedRoute, role helpers
│   │   ├── components/         # Shared UI components (AuthLayout, FormField)
│   │   ├── hooks/              # Custom hooks (useAntiCheat: clipboard & tab monitoring)
│   │   ├── pages/              # Login, Register, VerifyEmail, ForgotPassword, ResetPassword, QuizAttemptPage
│   │   │   └── dashboards/     # Role-based dashboard views (Student, Instructor, Admin)
│   │   ├── services/           # API services (quizService, authService)
│   │   ├── test/               # Vitest render helpers and mock auth setup
│   │   └── utils/              # Client-side form validators & college email checks
│   ├── package.json
│   └── vite.config.js
├── server/                     # Backend REST API Service (Node.js & Express 5)
│   ├── src/
│   │   ├── controllers/        # Request handlers (authController, quizController)
│   │   ├── middleware/         # RBAC role authorization & IP rate limiter
│   │   ├── models/             # Mongoose schemas (User, Material, Question, Quiz, QuizAttempt, AuditLog)
│   │   ├── routes/             # Express routers (health, auth, users, quizzes)
│   │   ├── seed/               # Initial seed dataset (questions, demo users)
│   │   ├── utils/              # antiCheat engine (Fisher-Yates) & Nodemailer Gmail SMTP mailer
│   │   ├── test-utils/         # Test database fixtures
│   │   ├── _tests_/            # Jest/Supertest automated test suites
│   │   │   ├── anti_cheat_quiz.test.js
│   │   │   ├── auth_login_refresh.test.js
│   │   │   ├── auth_registration.test.js
│   │   │   ├── password_reset.test.js
│   │   │   ├── performance_benchmark.test.js
│   │   │   ├── rbac_and_lockout.test.js
│   │   │   └── security_audit.test.js
│   │   ├── app.js              # Express app definition & middleware pipeline
│   │   ├── db.js               # MongoDB connection logic
│   │   └── server.js           # Server HTTP entrypoint
│   └── package.json
├── analytics/                  # Python Statistical & Analytics Service (FastAPI)
│   ├── app/                    # FastAPI app, RPC config, and mock analytical fixtures
│   └── tests/                  # Pytest test suite
├── docs/                       # Specifications, Test Plans & Security Audits
│   ├── Team4_SAD.pdf           # Software Architecture & Design Document
│   ├── Team4_TestPlan.pdf      # Software Test Plan (STP)
│   ├── SECURITY_CHECKLIST.md   # Formal STRIDE Security Audit Checklist (CSQP-NF-003)
│   └── *.png                   # UML component and sequence diagrams
├── .gitignore                  # Global git ignore configuration
└── README.md                   # Project overview, agile sprint tracking & directory structure
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18 or newer
- **MongoDB**: v6 or newer (running locally or MongoDB Atlas)
- **Python**: 3.10+ (for analytics service)

### 2. Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CSQP-Team4/Collaborative-Student-Quiz-Platform.git
   cd Collaborative-Student-Quiz-Platform
   ```

2. **Backend Setup:**
   ```bash
   cd server
   npm install
   # Configure server/.env:
   # PORT=5001
   # MONGODB_URI=mongodb://127.0.0.1:27017/csqp
   # JWT_SECRET=your_jwt_secret
   # JWT_REFRESH_SECRET=your_refresh_secret
   # EMAIL_USER=your_email@gmail.com
   # EMAIL_PASS=your_gmail_app_password
   # CLIENT_URL=http://localhost:5173
   npm run seed    # Seeds demo users and approved questions
   npm run dev     # Starts backend API on port 5001
   ```

3. **Frontend Setup:**
   ```bash
   cd ../client
   npm install
   npm run dev     # Starts Vite dev server at http://localhost:5173
   ```

---

## 🧪 Testing & Quality Assurance

The codebase maintains **100% pass rates across 177 automated test cases**:

```bash
# Run backend Jest test suite (141 tests across 13 suites)
npm --prefix server test

# Run frontend Vitest test suite (36 tests across 6 suites)
npm --prefix client test

# Run system performance benchmark (TC-Perf-01 / CSQP-NF-001)
npm --prefix server run benchmark
```

### Performance & Latency Benchmark (`TC-Perf-01`)
* **Test Scope:** 350+ concurrent requests across health checks, salted bcrypt logins, quiz catalog queries, and end-to-end quiz attempts & grading.
* **Target:** $p90 \le 2000\text{ ms}$, 0 HTTP 500 errors.
* **Achieved:** $p90 = \mathbf{227.6\text{ ms}}$ (**8.8x faster than SLA**), **0 server errors**.

### Security Verification (`CSQP-NF-003`)
Complete verification against the STRIDE Threat Model (SAD 3.9) documented in [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md).
